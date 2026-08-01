import type { PravaahDocument } from "@/lib/schemas";
import { enumLabel, formatCount, formatDate, daysBetween } from "@/lib/format";
import type { Role } from "@/lib/schemas/enums";
import { can } from "@/lib/rbac/matrix";
import {
  assert, deriveConfidence, finalise, insufficiency, nearestFromDocs, passageOf,
  sourceFromDoc, sourceFromRecordSet,
  type AnswerContext, type Assertion, type BuiltAnswer, type Source,
} from "./answerModel";
import { hrRetrievalPermitted } from "./access";

/**
 * E10-S3 — the curated question bank (PRD §9.4) plus a template-driven path
 * for parameterised questions computed live from the seed.
 *
 * Every entry is deterministic: the same question, asked by the same role,
 * always produces the same answer, the same citations and the same confidence
 * state (AI-G10). Nothing here calls a network or a model.
 *
 * Three entries deliberately do not answer:
 *   • `amc-hajipur`      — honest insufficiency (E10-S4 AC2, demo closer)
 *   • `project-forecast` — inference beyond the documents (E10-S4 AC3)
 *   • `hr-appointment`   — HR branch excluded from retrieval (E10-S3 AC7)
 */

export interface BankEntry {
  id: string;
  question: string;
  aliases: string[];
  keywords: string[];
  /** Roles this question is offered to as a starter suggestion. */
  suggestFor: Role[];
  category: "Warranty & OEM" | "Commissioning" | "Projects" | "Expiry & compliance" | "Contracts" | "People";
  build: (ctx: AnswerContext) => BuiltAnswer;
}

/* ------------------------------------------------------------------ helpers */

const LIVE_PROJECT = new Set(["MOBILISED", "IN_PROGRESS"]);

function byType(ctx: AnswerContext, type: PravaahDocument["type"]): PravaahDocument[] {
  return ctx.scope.documents.filter((d) => d.type === type);
}

function titled(docs: PravaahDocument[], suffix: string): PravaahDocument[] {
  return docs.filter((d) => d.title.endsWith(suffix));
}

function markers(sources: Source[]): number[] {
  return sources.map((s) => s.marker);
}

/** Every source list is numbered 1..n in the order the answer first cites it. */
function makeSources(
  docs: PravaahDocument[],
  heading: string,
  questionId: string,
): Source[] {
  return docs.map((doc, i) => {
    const p = passageOf(doc, heading);
    return sourceFromDoc(i + 1, doc, { passageId: p?.id ?? null, quote: p?.text ?? null, fromQuestion: questionId });
  });
}

function noSourcesInScope(
  ctx: AnswerContext,
  what: string,
  searched: string[],
  nearestPool: PravaahDocument[],
  nearestWhy: string,
): BuiltAnswer {
  return insufficiency(ctx, {
    searched,
    nearest: nearestFromDocs(nearestPool, nearestWhy),
    note: `No ${what} is present in the ${formatCount(ctx.scope.searchedCount)} documents your role may retrieve. This is a scope result, not a statement about the whole vault.`,
  });
}

function fallbackPool(ctx: AnswerContext): PravaahDocument[] {
  return ctx.scope.documents.filter((d) => d.passages.some((p) => p.heading !== "Summary"));
}

/* ------------------------------------------------------------- bank entries */

const warrantyPeriod: BankEntry = {
  id: "warranty-screw",
  question: "What is our standard warranty period on screw compressors?",
  aliases: ["standard warranty period screw compressor", "how long is the warranty on a screw compressor"],
  keywords: ["warranty", "period", "screw", "compressor", "standard", "months", "term"],
  suggestFor: ["SERVICE_MANAGER", "DIRECTOR_BUSINESS", "BRANCH_MANAGER", "SALES_EXECUTIVE", "FIELD_ENGINEER", "AUDITOR"],
  category: "Warranty & OEM",
  build: (ctx) => {
    const docs = titled(byType(ctx, "WARRANTY_TERMS"), "— ELGi").slice(0, 3);
    if (docs.length === 0) {
      return noSourcesInScope(ctx, "OEM warranty terms document", searchedWarranty(ctx), fallbackPool(ctx), "Nearest technical document in your scope");
    }
    const sources = makeSources(docs, "Clause 3", "warranty-screw");
    const all = markers(sources);
    const assertions: Assertion[] = [
      assert("The standard warranty on electric lubricated screw compressors is 18 months from the date of commissioning, or 4,000 running hours, whichever occurs earlier.", ...all),
      assert("The same clause puts piston compressors on 12 months from commissioning, so the two product lines do not share a term.", ...all.slice(0, 2)),
    ];
    return finalise(ctx, "SEEDED", assertions, sources, deriveConfidence({ sources, agreeing: true }), {
      candidateCount: byType(ctx, "WARRANTY_TERMS").length,
    });
  },
};

const warrantyPiston: BankEntry = {
  id: "warranty-piston",
  question: "How long is the warranty on a piston compressor?",
  aliases: ["piston compressor warranty length"],
  keywords: ["warranty", "piston", "compressor", "months", "how", "long"],
  suggestFor: ["FIELD_ENGINEER", "SALES_EXECUTIVE"],
  category: "Warranty & OEM",
  build: (ctx) => {
    const docs = titled(byType(ctx, "WARRANTY_TERMS"), "— ELGi").slice(0, 2);
    if (!docs.length) return noSourcesInScope(ctx, "OEM warranty terms document", searchedWarranty(ctx), fallbackPool(ctx), "Nearest technical document in your scope");
    const sources = makeSources(docs, "Clause 3", "warranty-piston");
    const assertions = [
      assert("Piston compressors carry 12 months of warranty from the date of commissioning.", ...markers(sources)),
      assert("The running-hours ceiling of 4,000 hours in the same clause is written against electric lubricated screw compressors, not against piston machines.", sources[0]!.marker),
    ];
    return finalise(ctx, "SEEDED", assertions, sources, deriveConfidence({ sources, agreeing: true }));
  },
};

const warrantyConditions: BankEntry = {
  id: "warranty-conditions",
  question: "What conditions must be met for the OEM warranty to remain valid?",
  aliases: ["warranty void conditions", "what invalidates the warranty"],
  keywords: ["warranty", "conditions", "valid", "invalid", "void", "remain", "clause"],
  suggestFor: ["SERVICE_MANAGER", "FIELD_ENGINEER", "DIRECTOR_BUSINESS", "AUDITOR"],
  category: "Warranty & OEM",
  build: (ctx) => {
    const docs = titled(byType(ctx, "WARRANTY_TERMS"), "— ELGi").slice(0, 3);
    if (!docs.length) return noSourcesInScope(ctx, "OEM warranty terms document", searchedWarranty(ctx), fallbackPool(ctx), "Nearest technical document in your scope");
    const sources = makeSources(docs, "Clause 7", "warranty-conditions");
    const all = markers(sources);
    const rs = sourceFromRecordSet(
      sources.length + 1, "commissioning-register", "Commissioning Register — submission tracking",
      "/service/commissioning",
      "Commissioning reports and their submission state against the principal's window.",
    );
    const assertions = [
      assert("Warranty holds only where the dealer-completed installation and commissioning report reaches the principal within seven days of commissioning.", ...all),
      assert("The same clause requires that genuine consumables have been used throughout.", ...all.slice(0, 2)),
      assert("Because the seven-day window is a warranty condition rather than an administrative one, submission state is tracked as an operational record.", rs.marker),
    ];
    return finalise(ctx, "SEEDED", assertions, [...sources, rs], deriveConfidence({ sources, agreeing: true }));
  },
};

const maintenanceIntervals: BankEntry = {
  id: "maintenance-intervals",
  question: "What are the maintenance intervals for the ELGi screw compressor range?",
  aliases: ["service intervals screw compressor", "when to change filters"],
  keywords: ["maintenance", "interval", "service", "filter", "oil", "hours", "schedule", "elgi", "screw"],
  suggestFor: ["FIELD_ENGINEER", "SERVICE_MANAGER", "STORE_INCHARGE"],
  category: "Warranty & OEM",
  build: (ctx) => {
    const docs = byType(ctx, "OEM_MANUAL").slice(0, 3);
    if (!docs.length) return noSourcesInScope(ctx, "OEM operation and maintenance manual", searchedManuals(ctx), fallbackPool(ctx), "Nearest technical document in your scope");
    const sources = makeSources(docs, "Section 4", "maintenance-intervals");
    const all = markers(sources);
    const assertions = [
      assert("Air filter and oil filter elements are both replaced at 2,000 running hours.", ...all),
      assert("The air-oil separator and the compressor oil change both fall at 4,000 hours, or annually, whichever is earlier.", ...all),
    ];
    return finalise(ctx, "SEEDED", assertions, sources, deriveConfidence({ sources, agreeing: true }), {
      candidateCount: byType(ctx, "OEM_MANUAL").length,
    });
  },
};

const separatorInterval: BankEntry = {
  id: "separator-interval",
  question: "When is the air-oil separator due for replacement?",
  aliases: ["air oil separator change interval"],
  keywords: ["air-oil", "separator", "replacement", "due", "interval", "4000", "hours"],
  suggestFor: ["FIELD_ENGINEER", "STORE_INCHARGE"],
  category: "Warranty & OEM",
  build: (ctx) => {
    const docs = byType(ctx, "OEM_MANUAL").slice(0, 2);
    if (!docs.length) return noSourcesInScope(ctx, "OEM operation and maintenance manual", searchedManuals(ctx), fallbackPool(ctx), "Nearest technical document in your scope");
    const sources = makeSources(docs, "Section 4", "separator-interval");
    const assertions = [
      assert("The air-oil separator is replaced at 4,000 running hours, or annually, whichever comes first.", ...markers(sources)),
      assert("That is twice the 2,000-hour interval the same section sets for the air and oil filter elements.", sources[0]!.marker),
    ];
    return finalise(ctx, "SEEDED", assertions, sources, deriveConfidence({ sources, agreeing: true }));
  },
};

const commissioningFad: BankEntry = {
  id: "commissioning-fad",
  question: "What free air delivery was recorded in the commissioning certificate?",
  aliases: ["what capacity was recorded in the commissioning certificate", "tested capacity at commissioning", "fad recorded at commissioning"],
  keywords: ["free", "air", "delivery", "fad", "capacity", "recorded", "commissioning", "certificate", "cfm", "tested"],
  suggestFor: ["SERVICE_MANAGER", "DIRECTOR_BUSINESS", "PROJECT_MANAGER", "AUDITOR"],
  category: "Commissioning",
  build: (ctx) => {
    const docs = byType(ctx, "COMMISSIONING_CERTIFICATE").slice(0, 1);
    if (!docs.length) {
      return noSourcesInScope(ctx, "commissioning certificate", searchedCommissioning(ctx), fallbackPool(ctx), "Nearest technical document in your scope");
    }
    const sources = makeSources(docs, "Recorded Parameters", "commissioning-fad");
    const m = sources[0]!.marker;
    const assertions = [
      assert(`${docs[0]!.title} records free air delivery measured at 412 CFM against a rated 420 CFM at 7.5 bar working pressure.`, m),
      assert("That is a shortfall of 8 CFM, or 1.9% below the rated figure — inside the tolerance the certificate was signed off against.", m),
      assert("Full-load current on the same certificate was recorded at 148 A on a 415 V three-phase supply.", m),
    ];
    return finalise(ctx, "SEEDED", assertions, sources, deriveConfidence({ sources, agreeing: true }), {
      candidateCount: byType(ctx, "COMMISSIONING_CERTIFICATE").length,
      caveat: "This is the certificate for one machine. Asking about a different serial will return a different figure — the answer is not a fleet average.",
    });
  },
};

const commissioningTraining: BankEntry = {
  id: "commissioning-training",
  question: "Was operator training acknowledged by the customer at handover?",
  aliases: ["operator training acknowledgement handover"],
  keywords: ["operator", "training", "acknowledged", "handover", "customer", "acknowledgement"],
  suggestFor: ["SERVICE_MANAGER", "AUDITOR"],
  category: "Commissioning",
  build: (ctx) => {
    const docs = byType(ctx, "COMMISSIONING_CERTIFICATE").slice(0, 3);
    if (!docs.length) return noSourcesInScope(ctx, "commissioning certificate", searchedCommissioning(ctx), fallbackPool(ctx), "Nearest technical document in your scope");
    const sources = makeSources(docs, "Customer Acknowledgement", "commissioning-training");
    const assertions = [
      assert("Each certificate read records that operator training was completed and acknowledged by the customer representative at handover.", ...markers(sources)),
      assert("The acknowledgement is captured on the certificate itself rather than as a separate training record.", sources[0]!.marker),
    ];
    return finalise(ctx, "SEEDED", assertions, sources, deriveConfidence({ sources, agreeing: true }), {
      caveat: null,
      candidateCount: byType(ctx, "COMMISSIONING_CERTIFICATE").length,
    });
  },
};

const commissioningCount: BankEntry = {
  id: "commissioning-count",
  question: "How many commissioning certificates does the vault hold, and what do they record?",
  aliases: ["count of commissioning certificates"],
  keywords: ["how", "many", "commissioning", "certificates", "hold", "count", "record"],
  suggestFor: ["DIRECTOR_BUSINESS", "AUDITOR", "SERVICE_MANAGER"],
  category: "Commissioning",
  build: (ctx) => {
    const all = byType(ctx, "COMMISSIONING_CERTIFICATE");
    if (!all.length) return noSourcesInScope(ctx, "commissioning certificate", searchedCommissioning(ctx), fallbackPool(ctx), "Nearest technical document in your scope");
    const rs = sourceFromRecordSet(1, "vault-commissioning", "Vault catalogue — Installed Assets branch, commissioning certificates",
      "/vault?category=INSTALLED_ASSETS&type=COMMISSIONING_CERTIFICATE",
      `${formatCount(all.length)} commissioning certificates in the branch you may access.`);
    const sample = all.slice(0, 2).map((d, i) => {
      const p = passageOf(d, "Recorded Parameters");
      return sourceFromDoc(i + 2, d, { passageId: p?.id ?? null, quote: p?.text ?? null, fromQuestion: "commissioning-count" });
    });
    const assertions = [
      assert(`${formatCount(all.length)} commissioning certificates are held in the branch of the vault your role may open.`, 1),
      assert("Each records the measured parameters at handover — free air delivery against rated, working pressure, and full-load current on the supply as found.", ...sample.map((s) => s.marker)),
      assert("Each also carries the customer's acknowledgement that operator training was completed.", sample[0]!.marker),
    ];
    return finalise(ctx, "TEMPLATE", assertions, [rs, ...sample], {
      state: "HIGH",
      basis: `The count is computed from the vault catalogue, and the description is quoted from ${sample.length} certificates read in full.`,
    }, { candidateCount: all.length });
  },
};

const testCertificateTerms: BankEntry = {
  id: "test-certificate-terms",
  question: "What does a third-party test certificate confirm, and how long is it valid?",
  aliases: ["hydraulic test certificate validity"],
  keywords: ["test", "certificate", "third-party", "hydraulic", "valid", "validity", "confirm", "pressure"],
  suggestFor: ["PROJECT_MANAGER", "DIRECTOR_BUSINESS", "ACCOUNTS_EXECUTIVE"],
  category: "Projects",
  build: (ctx) => {
    const docs = byType(ctx, "TEST_CERTIFICATE").slice(0, 3);
    if (!docs.length) {
      return noSourcesInScope(ctx, "third-party test certificate", searchedProjects(ctx), fallbackPool(ctx), "Nearest technical document in your scope");
    }
    const sources = makeSources(docs, "Test Result", "test-certificate-terms");
    const all = markers(sources);
    const assertions = [
      assert("A third-party test certificate records a hydraulic test at 1.5 times working pressure held for 30 minutes with no observed pressure drop or visible leakage.", ...all),
      assert("The certificate is valid for twelve months from the date of test, so it lapses on a rolling basis rather than with the project.", ...all),
    ];
    return finalise(ctx, "SEEDED", assertions, sources, deriveConfidence({ sources, agreeing: true }), {
      candidateCount: byType(ctx, "TEST_CERTIFICATE").length,
    });
  },
};

/* ---------------------------------------------------- template-driven entries */

const expiringSixty: BankEntry = {
  id: "expiring-sixty",
  question: "Which documents in my scope expire in the next sixty days?",
  aliases: ["what is expiring soon", "documents expiring in 60 days"],
  keywords: ["expire", "expiring", "sixty", "60", "days", "lapse", "documents", "soon", "next"],
  suggestFor: ["SERVICE_MANAGER", "DIRECTOR_BUSINESS", "ACCOUNTS_EXECUTIVE", "PROJECT_MANAGER", "STORE_INCHARGE", "AUDITOR", "HR_ADMIN"],
  category: "Expiry & compliance",
  build: (ctx) => {
    const list = ctx.scope.documents
      .filter((d) => d.expiresOn)
      .map((d) => ({ d, days: daysBetween(ctx.now, d.expiresOn!) }))
      .filter((x) => x.days <= 60)
      .sort((a, b) => a.days - b.days);

    if (!list.length) {
      return insufficiency(ctx, {
        searched: [
          `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`,
          "The expiry date recorded on every document that carries one",
        ],
        nearest: [],
        note: "Nothing in your scope carries an expiry date inside sixty days.",
      });
    }

    const rs = sourceFromRecordSet(1, "vault-expiring", "Vault catalogue — expiry within 60 days", "/vault/expiring",
      `${formatCount(list.length)} documents with an expiry date on or before ${formatDate(new Date(ctx.now.getTime() + 60 * 86_400_000))}.`);

    const shown = list.slice(0, 6);
    const sources: Source[] = [rs, ...shown.map((x, i) =>
      sourceFromDoc(i + 2, x.d, { fromQuestion: "expiring-sixty", quote: x.d.expiresOn ? `Expiry recorded on the document record: ${formatDate(x.d.expiresOn)}.` : null }))];

    const assertions: Assertion[] = [
      assert(`${formatCount(list.length)} documents you may access carry an expiry date inside the next sixty days.`, 1),
      ...shown.map((x, i) => assert(
        `${x.d.title} ${x.days < 0 ? `lapsed on ${formatDate(x.d.expiresOn!)}` : `expires on ${formatDate(x.d.expiresOn!)}, in ${x.days} ${x.days === 1 ? "day" : "days"}`}.`,
        i + 2,
      )),
    ];
    if (list.length > shown.length) {
      assertions.push(assert(`The remaining ${formatCount(list.length - shown.length)} are listed in full on the expiring-documents screen, each with its linked entity and owner.`, 1));
    }

    return finalise(ctx, "TEMPLATE", assertions, sources, {
      state: "HIGH",
      basis: `Computed from the expiry date recorded on each document; every document named above is cited individually, and the count is the whole set, not a sample.`,
    }, { candidateCount: list.length });
  },
};

const expiringTestCerts: BankEntry = {
  id: "expiring-test-certs",
  question: "Which test certificates for live projects expire in the next sixty days?",
  aliases: ["test certificates expiring live projects"],
  keywords: ["test", "certificates", "live", "projects", "expire", "expiring", "sixty", "60", "days"],
  suggestFor: ["PROJECT_MANAGER", "DIRECTOR_BUSINESS", "AUDITOR"],
  category: "Expiry & compliance",
  build: (ctx) => {
    const liveIds = new Set(ctx.ds.projects.filter((p) => LIVE_PROJECT.has(p.status)).map((p) => p.id));
    const list = ctx.scope.documents
      .filter((d) => d.type === "TEST_CERTIFICATE" && d.linkedId && liveIds.has(d.linkedId) && d.expiresOn)
      .map((d) => ({ d, days: daysBetween(ctx.now, d.expiresOn!) }))
      .filter((x) => x.days >= 0 && x.days <= 60)
      .sort((a, b) => a.days - b.days);

    if (!list.length) {
      return noSourcesInScope(
        ctx, "test certificate on a live project with an expiry inside sixty days",
        searchedProjects(ctx),
        ctx.scope.documents.filter((d) => d.expiresOn && daysBetween(ctx.now, d.expiresOn) <= 60),
        "Also expiring inside sixty days, in a branch you can open",
      );
    }

    const sources = list.map((x, i) => sourceFromDoc(i + 1, x.d, {
      fromQuestion: "expiring-test-certs",
      quote: passageOf(x.d, "Test Result")?.text ?? null,
      passageId: passageOf(x.d, "Test Result")?.id ?? null,
    }));

    const assertions: Assertion[] = [
      assert(`${formatCount(list.length)} third-party test ${list.length === 1 ? "certificate" : "certificates"} on a live project ${list.length === 1 ? "expires" : "expire"} inside the next sixty days.`, ...markers(sources)),
      ...list.map((x, i) => {
        const project = ctx.ds.projects.find((p) => p.id === x.d.linkedId);
        return assert(
          `${x.d.title} expires on ${formatDate(x.d.expiresOn!)}, in ${x.days} days, against ${project?.name ?? x.d.linkedId} which is ${enumLabel(project?.status ?? "")}.`,
          i + 1,
        );
      }),
    ];

    return finalise(ctx, "TEMPLATE", assertions, sources, {
      state: "HIGH",
      basis: `Computed live from the expiry date on each certificate and the current status of its project; ${formatCount(list.length)} of ${formatCount(ctx.scope.documents.filter((d) => d.type === "TEST_CERTIFICATE").length)} test certificates in your scope match, and each is cited.`,
    }, {
      candidateCount: ctx.scope.documents.filter((d) => d.type === "TEST_CERTIFICATE").length,
      caveat: "A lapsed certificate on a live project is raised to the Command Centre exception feed, so this list should never be the first you hear of it.",
    });
  },
};

const licencesInsurance: BankEntry = {
  id: "licences-insurance",
  question: "What licences and insurance policies does the company hold, and when do they expire?",
  aliases: ["company licences insurance expiry"],
  keywords: ["licence", "license", "insurance", "policy", "policies", "company", "hold", "expire", "statutory"],
  suggestFor: ["ACCOUNTS_EXECUTIVE", "DIRECTOR_BUSINESS", "AUDITOR", "SUPER_ADMIN", "STORE_INCHARGE"],
  category: "Expiry & compliance",
  build: (ctx) => {
    const licences = byType(ctx, "LICENCE");
    const insurance = byType(ctx, "INSURANCE");
    if (!licences.length && !insurance.length) {
      return noSourcesInScope(ctx, "company licence or insurance policy", searchedCompany(ctx), fallbackPool(ctx), "Nearest company document in your scope");
    }
    const withExpiry = [...licences, ...insurance]
      .filter((d) => d.expiresOn)
      .sort((a, b) => new Date(a.expiresOn!).getTime() - new Date(b.expiresOn!).getTime());
    const earliest = withExpiry.slice(0, 3);

    const rs = sourceFromRecordSet(1, "vault-company", "Vault catalogue — Company branch", "/vault?category=COMPANY",
      `${formatCount(licences.length)} licences and ${formatCount(insurance.length)} insurance policies.`);
    const sources: Source[] = [rs, ...earliest.map((d, i) => sourceFromDoc(i + 2, d, {
      fromQuestion: "licences-insurance",
      quote: `Expiry recorded on the document record: ${formatDate(d.expiresOn!)}.`,
    }))];

    const assertions: Assertion[] = [
      assert(`The Company branch holds ${formatCount(licences.length)} licences and ${formatCount(insurance.length)} insurance policies, all with an expiry date recorded.`, 1),
      ...earliest.map((d, i) => assert(
        `${d.title} expires on ${formatDate(d.expiresOn!)}, ${daysBetween(ctx.now, d.expiresOn!)} days from today.`,
        i + 2,
      )),
      assert("Every licence and policy in this branch is treated as materially operational, so its approaching expiry raises a Command Centre exception rather than only a notification.", 1),
    ];

    return finalise(ctx, "TEMPLATE", assertions, sources, {
      state: "HIGH",
      basis: `Counts are computed from the vault catalogue and the three earliest expiries are cited to the individual document records.`,
    }, { candidateCount: licences.length + insurance.length });
  },
};

const warrantyLapsing: BankEntry = {
  id: "warranty-lapsing",
  question: "Which OEM warranty documents are due to lapse, and who owns them?",
  aliases: ["warranty terms expiring owner"],
  keywords: ["warranty", "documents", "lapse", "lapsing", "due", "owns", "owner", "expiring", "oem"],
  suggestFor: ["SERVICE_MANAGER", "DIRECTOR_BUSINESS"],
  category: "Expiry & compliance",
  build: (ctx) => {
    const list = byType(ctx, "WARRANTY_TERMS")
      .filter((d) => d.expiresOn && daysBetween(ctx.now, d.expiresOn) <= 60)
      .map((d) => ({ d, days: daysBetween(ctx.now, d.expiresOn!) }))
      .sort((a, b) => a.days - b.days);

    if (!list.length) {
      return noSourcesInScope(ctx, "warranty terms document lapsing inside sixty days", searchedWarranty(ctx), byType(ctx, "WARRANTY_TERMS"), "Warranty terms on file, expiring later");
    }
    const ownerName = ctx.ds.users.find((u) => u.id === list[0]!.d.ownerUserId)?.name ?? list[0]!.d.ownerUserId;
    const sources = list.slice(0, 5).map((x, i) => sourceFromDoc(i + 1, x.d, {
      fromQuestion: "warranty-lapsing",
      quote: `Owner ${ownerName}. Expiry recorded on the document record: ${formatDate(x.d.expiresOn!)}.`,
    }));

    const assertions: Assertion[] = [
      assert(`${formatCount(list.length)} OEM warranty terms documents lapse inside sixty days, all owned by ${ownerName}.`, ...markers(sources)),
      ...list.slice(0, 5).map((x, i) => assert(
        `${x.d.title} lapses on ${formatDate(x.d.expiresOn!)}, in ${x.days} days.`,
        i + 1,
      )),
    ];
    if (list.length > 5) {
      assertions.push(assert(`A further ${formatCount(list.length - 5)} lapse inside the same window and appear on the expiring-documents screen.`, sources[0]!.marker));
    }
    return finalise(ctx, "TEMPLATE", assertions, sources, {
      state: "HIGH",
      basis: "Computed from the expiry date and owner recorded on each warranty document; each document named is cited individually.",
    }, { candidateCount: byType(ctx, "WARRANTY_TERMS").length });
  },
};

const statutoryFilings: BankEntry = {
  id: "statutory-filings",
  question: "What statutory filing acknowledgements are held in the vault?",
  aliases: ["gstr acknowledgements on file", "pf esic filings held"],
  keywords: ["statutory", "filing", "filings", "acknowledgement", "gstr", "pf", "ecr", "esic", "held", "returns"],
  suggestFor: ["ACCOUNTS_EXECUTIVE", "AUDITOR", "SUPER_ADMIN"],
  category: "Expiry & compliance",
  build: (ctx) => {
    const docs = byType(ctx, "STATUTORY_RETURN");
    if (!docs.length) return noSourcesInScope(ctx, "statutory filing acknowledgement", searchedCompany(ctx), fallbackPool(ctx), "Nearest company document in your scope");
    const kinds = ["GSTR-1", "GSTR-3B", "PF ECR", "ESIC"];
    const counts = kinds.map((k) => ({ k, n: docs.filter((d) => d.title.endsWith(k)).length }));
    const recent = [...docs].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()).slice(0, 3);
    const rs = sourceFromRecordSet(1, "vault-statutory", "Vault catalogue — Statutory branch", "/vault?category=STATUTORY",
      `${formatCount(docs.length)} filing acknowledgements.`);
    const sources: Source[] = [rs, ...recent.map((d, i) => sourceFromDoc(i + 2, d, {
      fromQuestion: "statutory-filings",
      quote: `Filed acknowledgement retained ${formatDate(d.uploadedAt)}.`,
    }))];
    const assertions: Assertion[] = [
      assert(`The Statutory branch holds ${formatCount(docs.length)} filing acknowledgements: ${counts.map((c) => `${formatCount(c.n)} ${c.k}`).join(", ")}.`, 1),
      ...recent.map((d, i) => assert(`${d.title} was retained on ${formatDate(d.uploadedAt)}.`, i + 2)),
      assert("None of these acknowledgements carries an expiry date, so they never appear on the expiring-documents screen.", 1),
    ];
    return finalise(ctx, "TEMPLATE", assertions, sources, {
      state: "HIGH",
      basis: "Counts are computed from the vault catalogue and the three most recent acknowledgements are cited individually.",
    }, { candidateCount: docs.length });
  },
};

const poCopies: BankEntry = {
  id: "po-copies",
  question: "Which customer purchase order copies are held on file?",
  aliases: ["customer po copies on file"],
  keywords: ["purchase", "order", "copies", "customer", "held", "file", "po"],
  suggestFor: ["SALES_EXECUTIVE", "ACCOUNTS_EXECUTIVE", "BRANCH_MANAGER"],
  category: "Contracts",
  build: (ctx) => {
    const docs = byType(ctx, "PURCHASE_ORDER_COPY");
    if (!docs.length) return noSourcesInScope(ctx, "customer purchase order copy", searchedCustomers(ctx), fallbackPool(ctx), "Nearest customer document in your scope");
    const withCustomer = docs.filter((d) => d.linkedType === "CUSTOMER" && d.linkedId);
    const target = withCustomer[0];
    const customer = target ? ctx.ds.customers.find((c) => c.id === target.linkedId) : undefined;
    const forCustomer = customer ? withCustomer.filter((d) => d.linkedId === customer.id) : [];
    const rs = sourceFromRecordSet(1, "vault-po", "Vault catalogue — Customers branch, purchase order copies",
      "/vault?category=CUSTOMERS&type=PURCHASE_ORDER_COPY", `${formatCount(docs.length)} purchase order copies in your scope.`);
    const cited = (forCustomer.length ? forCustomer : docs).slice(0, 3);
    const sources: Source[] = [rs, ...cited.map((d, i) => sourceFromDoc(i + 2, d, {
      fromQuestion: "po-copies",
      quote: `Retained against ${customer?.tradeName ?? "the linked customer"} on ${formatDate(d.uploadedAt)}.`,
    }))];
    const assertions: Assertion[] = [
      assert(`${formatCount(docs.length)} customer purchase order copies are held in the branch of the vault your role may open.`, 1),
      ...(customer && forCustomer.length
        ? [assert(`${formatCount(forCustomer.length)} of them sit against ${customer.tradeName}.`, ...cited.map((_, i) => i + 2))]
        : []),
      ...cited.map((d, i) => assert(`${d.title} was retained on ${formatDate(d.uploadedAt)}.`, i + 2)),
    ];
    return finalise(ctx, "TEMPLATE", assertions, sources, {
      state: "MODERATE",
      basis: "The counts are computed from the catalogue, but a purchase order copy carries no indexed body text — the answer is about which documents exist, not about what they say.",
    }, {
      candidateCount: docs.length,
      caveat: "Purchase order copies are indexed on their catalogue record only. To read the commercial terms, open the document itself.",
    });
  },
};

const gaDrawing: BankEntry = {
  id: "ga-drawing",
  question: "Where is the general arrangement drawing for the 1200 KLD sewage treatment plant?",
  aliases: ["general arrangement drawing sewage treatment plant"],
  keywords: ["general", "arrangement", "drawing", "ga", "1200", "kld", "sewage", "treatment", "plant", "where"],
  suggestFor: ["PROJECT_MANAGER", "STORE_INCHARGE"],
  category: "Projects",
  build: (ctx) => {
    const project = ctx.ds.projects.find((p) => p.name.includes("1200 KLD"));
    const docs = ctx.scope.documents.filter(
      (d) => d.type === "PROJECT_DRAWING" && project && d.linkedId === project.id,
    );
    if (!docs.length || !project) {
      return noSourcesInScope(ctx, "general arrangement drawing for that project", searchedProjects(ctx), fallbackPool(ctx), "Nearest technical document in your scope");
    }
    const doc = docs[0]!;
    const sources = [sourceFromDoc(1, doc, {
      fromQuestion: "ga-drawing",
      quote: `Catalogue record — revision ${doc.revision ?? "not recorded"}, approval state ${enumLabel(doc.approvalState ?? "not recorded")}, retained ${formatDate(doc.uploadedAt)}.`,
    })];
    const assertions = [
      assert(`${doc.title} is held in the Projects branch against ${project.name}, at revision ${doc.revision ?? "not recorded"}.`, 1),
      assert(`${formatCount(docs.length)} drawings in total are filed against that project.`, 1),
    ];
    return finalise(ctx, "SEEDED", assertions, sources, deriveConfidence({ sources, agreeing: true, metadataOnly: true }), {
      candidateCount: docs.length,
      caveat: "Low confidence, and here is why: a drawing is a CAD sheet, so nothing inside it is indexed. This answer locates the document and reports its catalogue record. It does not tell you what the drawing shows — open it to confirm the arrangement.",
    });
  },
};

/* ------------------------------------------------- deliberate non-answers */

const amcExclusionsGeneral: BankEntry = {
  id: "amc-exclusions-general",
  question: "What is excluded from a comprehensive AMC?",
  aliases: ["comprehensive amc exclusions", "what does the amc not cover"],
  keywords: ["amc", "exclusions", "excluded", "comprehensive", "cover", "scope", "contract"],
  suggestFor: ["SERVICE_MANAGER", "BRANCH_MANAGER", "DIRECTOR_BUSINESS", "SALES_EXECUTIVE"],
  category: "Contracts",
  build: (ctx) => {
    if (!can(ctx.viewer.role, "amc")) {
      return insufficiency(ctx, {
        searched: [
          `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`,
          "Document types AMC Agreement and Customer Agreement",
        ],
        nearest: nearestFromDocs(byType(ctx, "CUSTOMER_AGREEMENT"), "Customer agreement in your scope"),
        note: "AMC contract records sit outside your role's permissions, and the vault holds no AMC agreement document, so there is nothing to answer from.",
      });
    }
    const contracts = ctx.ds.amcContracts.filter((c) => c.coverage === "COMPREHENSIVE");
    const rs = sourceFromRecordSet(1, "amc-contracts", `AMC contract records — comprehensive (${formatCount(contracts.length)})`,
      "/service/amc", contracts[0]?.exclusions ?? "");
    const assertions = [
      assert("The vault holds no document of type AMC Agreement, so this is answered from the AMC contract records rather than from a signed agreement on file.", 1),
      assert(`Across ${formatCount(contracts.length)} comprehensive contracts the exclusions are identical: consumable oil beyond the first fill, air-end overhaul, damage from incorrect utility supply, and any work arising from unauthorised third-party intervention.`, 1),
      assert("The same variant includes all scheduled preventive visits, breakdown attendance and genuine OEM spares except the consumables listed as excluded.", 1),
    ];
    return finalise(ctx, "TEMPLATE", assertions, [rs], {
      state: "MODERATE",
      basis: `One record set, consistent across ${formatCount(contracts.length)} contracts. No document in the vault corroborates it, and that missing signed agreement is why this is not High.`,
    }, {
      candidateCount: contracts.length,
      caveat: "This answer cites a record set, not a document. If a client disputes a scope exclusion, the signed agreement is the instrument that settles it — and it is not in the vault.",
    });
  },
};

const amcHajipur: BankEntry = {
  id: "amc-hajipur",
  question: "What are the scope exclusions in the AMC for the compressors at the Hajipur unit?",
  aliases: ["hajipur amc exclusions", "amc at hajipur"],
  keywords: ["hajipur", "amc", "exclusions", "compressors", "unit", "scope"],
  suggestFor: ["DIRECTOR_BUSINESS", "SERVICE_MANAGER", "DIRECTOR_STRATEGY", "BRANCH_MANAGER", "AUDITOR", "PROJECT_MANAGER", "ACCOUNTS_EXECUTIVE", "SUPER_ADMIN"],
  category: "Contracts",
  build: (ctx) => {
    const agreements = ctx.ds.documents.filter((d) => d.type === "AMC_AGREEMENT").length;
    const hajipurCustomers = ctx.ds.customers.filter((c) => /hajipur/i.test(c.legalName));
    const hajipurSites = ctx.ds.sites.filter((s) =>
      /hajipur/i.test(s.name) || /hajipur/i.test(s.district) || /hajipur/i.test(s.address)).length;
    const hajipurDocs = ctx.scope.documents.filter((d) =>
      /hajipur/i.test(d.title) || d.passages.some((p) => /hajipur/i.test(p.text)));

    const hajipurAmc = can(ctx.viewer.role, "amc")
      ? ctx.ds.amcContracts.filter((a) => hajipurCustomers.some((c) => c.id === a.customerId))
      : [];

    const recordNote = hajipurAmc.length
      ? ` An AMC contract record does exist — ${hajipurAmc[0]!.number}, against ${hajipurCustomers.find((c) => c.id === hajipurAmc[0]!.customerId)?.tradeName} — but a contract record is not the executed agreement, and its summary field has deliberately not been quoted here as though it were.`
      : "";

    return insufficiency(ctx, {
      searched: [
        `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope, of ${formatCount(ctx.corpusTotal)} in the vault`,
        `Document type AMC Agreement — ${formatCount(agreements)} documents of that type exist anywhere in the vault`,
        `Titles and every indexed passage for the term "Hajipur" — ${formatCount(hajipurDocs.length)} ${hajipurDocs.length === 1 ? "document" : "documents"} matched, all of them supply agreements`,
        `Customer master — ${formatCount(hajipurCustomers.length)} customers at Hajipur; site master — ${formatCount(hajipurSites)} sites of that name`,
      ],
      candidateCount: hajipurDocs.length,
      nearest: nearestFromDocs(hajipurDocs, "Mentions Hajipur, but is a supply agreement and states no scope exclusion", 3),
      note:
        "No supporting source was found. The vault holds no executed AMC agreement for any customer, so there is no clause to quote and no answer has been synthesised." +
        recordNote +
        " Uploading the signed agreement against the customer record is what would make this question answerable.",
    });
  },
};

const projectForecast: BankEntry = {
  id: "project-forecast",
  question: "Will the Effluent Treatment Plant project finish on time?",
  aliases: ["will the project finish on time", "project completion forecast"],
  keywords: ["will", "finish", "time", "project", "effluent", "treatment", "plant", "forecast", "late", "delay", "complete"],
  suggestFor: ["DIRECTOR_BUSINESS", "PROJECT_MANAGER", "DIRECTOR_STRATEGY"],
  category: "Projects",
  build: (ctx) => {
    const project = ctx.ds.projects.find((p) => p.name.startsWith("Effluent Treatment Plant"));
    const docs = project
      ? ctx.scope.documents.filter((d) => d.linkedId === project.id).slice(0, 3)
      : [];

    if (!project || !docs.length) {
      return insufficiency(ctx, {
        searched: [
          `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`,
          "Documents linked to the Effluent Treatment Plant project",
        ],
        nearest: nearestFromDocs(fallbackPool(ctx), "Nearest document in your scope"),
        note: "The project's documents sit outside your permissions, and no forecast would have been produced in any case — the vault records what has happened, not what will.",
      });
    }

    const sources = docs.map((d, i) => sourceFromDoc(i + 1, d, {
      fromQuestion: "project-forecast",
      quote: `Filed against ${project.name} on ${formatDate(d.uploadedAt)}.`,
    }));
    const rs = sourceFromRecordSet(sources.length + 1, "project-record", `Project record — ${project.name}`,
      `/projects/${project.id}`,
      `Contractual completion ${formatDate(project.contractualCompletion)}; status ${enumLabel(project.status)}.`);

    const assertions = [
      assert(`The contract for ${project.name} sets completion at ${formatDate(project.contractualCompletion)} and the project stands at ${enumLabel(project.status)}.`, rs.marker),
      assert(`${formatCount(docs.length)} documents are filed against it in the branch you may open, the most recent on ${formatDate(docs[0]!.uploadedAt)}.`, ...markers(sources)),
      assert("None of those documents contains a completion forecast, a revised programme or a delay analysis.", ...markers(sources)),
    ];

    return finalise(ctx, "INFERENCE_LIMIT", assertions, [...sources, rs], {
      state: "LOW",
      basis: "The documents support statements about what has been recorded. They do not support a prediction, and none has been made.",
    }, {
      candidateCount: docs.length,
      caveat: "This question asks for a forecast. The vault holds records of what has happened; it holds no basis for predicting what will. Schedule variance against the S-curve is computed on the project screen from executed quantities — that is evidence you can act on, and it is not the same thing as a completion date.",
    });
  },
};

const hrAppointment: BankEntry = {
  id: "hr-appointment",
  question: "Is an appointment letter on file for every employee?",
  aliases: ["appointment letter on file", "employee appointment letters held"],
  keywords: ["appointment", "letter", "employee", "file", "hr", "personnel", "staff"],
  suggestFor: ["HR_ADMIN", "SUPER_ADMIN"],
  category: "People",
  build: (ctx) => {
    if (!hrRetrievalPermitted(ctx.viewer.role)) {
      return {
        kind: "HR_EXCLUDED",
        assertions: [],
        sources: [],
        confidence: "INSUFFICIENT",
        confidenceBasis: "The HR branch was excluded before retrieval ran, so there is no evidence to weigh.",
        caveat: "Employee personal data in the HR branch is excluded from retrieval for your role. It was not searched, nothing from it was read, and nothing from it has been summarised or redacted into this answer. Access to that branch is held by HR & Admin.",
        searchedCount: ctx.scope.searchedCount,
        candidateCount: 0,
        readCount: 0,
        searchedDescription: [
          `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`,
          "HR branch — excluded before retrieval, not searched",
        ],
        nearest: [],
        scopeNote: ctx.scope.exclusions.join(" · "),
      };
    }
    const docs = ctx.scope.documents.filter((d) => d.type === "APPOINTMENT_LETTER");
    const employees = ctx.ds.employees.length;
    if (!docs.length) {
      return insufficiency(ctx, {
        searched: [`${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`, "Document type Appointment letter"],
        nearest: [],
      });
    }
    const sources = docs.slice(0, 3).map((d, i) => sourceFromDoc(i + 1, d, {
      fromQuestion: "hr-appointment",
      quote: `Held against employee record ${d.linkedId ?? "not recorded"}, retained ${formatDate(d.uploadedAt)}.`,
    }));
    const assertions = [
      assert(`${formatCount(docs.length)} appointment letters are held in the HR branch against a register of ${formatCount(employees)} employees.`, ...markers(sources)),
      assert(`That leaves ${formatCount(Math.max(employees - docs.length, 0))} employee records with no appointment letter filed in the vault.`, ...markers(sources)),
    ];
    return finalise(ctx, "TEMPLATE", assertions, sources, {
      state: "MODERATE",
      basis: "The counts are computed from the catalogue. An appointment letter carries no indexed body text, so this answers which records exist, not what they say.",
    }, {
      candidateCount: docs.length,
      caveat: "AI-G9 — nothing has been inferred about any individual. This answer reports document counts against the employee register and nothing else.",
    });
  },
};

/* ------------------------------------------------------ searched-set copy */

function searchedWarranty(ctx: AnswerContext): string[] {
  return [
    `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`,
    "Document types Warranty terms and Technical literature",
    "Full text of every indexed clause",
  ];
}
function searchedManuals(ctx: AnswerContext): string[] {
  return [
    `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`,
    "Document types OEM manual and Technical literature",
  ];
}
function searchedCommissioning(ctx: AnswerContext): string[] {
  return [
    `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`,
    "Installed Assets branch — commissioning certificates",
  ];
}
function searchedProjects(ctx: AnswerContext): string[] {
  return [
    `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`,
    "Projects branch — test certificates, drawings, client approvals and measurement records",
  ];
}
function searchedCustomers(ctx: AnswerContext): string[] {
  return [
    `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`,
    "Customers branch — supply agreements and purchase order copies",
  ];
}
function searchedCompany(ctx: AnswerContext): string[] {
  return [
    `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope`,
    "Company and Statutory branches — licences, insurance policies and filing acknowledgements",
  ];
}

/* --------------------------------------------------------------- registry */

export const QUESTION_BANK: BankEntry[] = [
  warrantyPeriod, warrantyPiston, warrantyConditions,
  maintenanceIntervals, separatorInterval,
  commissioningFad, commissioningTraining, commissioningCount,
  testCertificateTerms,
  expiringSixty, expiringTestCerts, licencesInsurance, warrantyLapsing, statutoryFilings,
  poCopies, gaDrawing,
  amcExclusionsGeneral, amcHajipur, projectForecast, hrAppointment,
];

export function entryById(id: string): BankEntry | null {
  return QUESTION_BANK.find((e) => e.id === id) ?? null;
}

/* ---------------------------------------------------------------- matching */

const MATCH_STOP = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "is", "are", "was", "were",
  "what", "which", "who", "how", "does", "do", "did", "our", "we", "my", "me", "i", "it",
  "that", "this", "any", "all", "at", "by", "from", "with", "be", "been", "there", "their",
]);

export function normaliseQuestion(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !MATCH_STOP.has(t));
}

export interface Match { entry: BankEntry; score: number; exact: boolean }

/**
 * Deterministic keyword match. A question that does not clear the threshold is
 * never forced onto the nearest entry — it falls through to the honest
 * insufficiency path, which is the correct behaviour, not a failure mode.
 */
export function matchQuestion(raw: string): Match | null {
  const tokens = normaliseQuestion(raw);
  if (!tokens.length) return null;
  const joined = tokens.join(" ");

  let best: Match | null = null;
  for (const entry of QUESTION_BANK) {
    const canonical = normaliseQuestion(entry.question).join(" ");
    if (canonical === joined) return { entry, score: 1000, exact: true };
    for (const alias of entry.aliases) {
      if (normaliseQuestion(alias).join(" ") === joined) return { entry, score: 1000, exact: true };
    }

    const kw = new Set(entry.keywords);
    let hits = 0;
    for (const t of tokens) if (kw.has(t)) hits += 1;
    const canonicalTokens = new Set(normaliseQuestion(entry.question));
    let overlap = 0;
    for (const t of tokens) if (canonicalTokens.has(t)) overlap += 1;

    const coverage = hits / Math.max(tokens.length, 1);
    const recall = hits / Math.max(entry.keywords.length, 1);
    const score = hits * 10 + overlap * 4 + coverage * 30 + recall * 20;

    if (hits >= 2 && coverage >= 0.34 && (!best || score > best.score)) {
      best = { entry, score, exact: false };
    }
  }
  return best;
}

/* ------------------------------------------------------------- suggestions */

/** E10-S3 AC5 — starter questions grounded in real scenarios, differing by role. */
export function suggestionsFor(role: Role, limit = 5): BankEntry[] {
  const preferred = QUESTION_BANK.filter((e) => e.suggestFor.includes(role));
  const filler = QUESTION_BANK.filter((e) => !e.suggestFor.includes(role) && e.id !== "amc-hajipur");
  return [...preferred, ...filler].slice(0, limit);
}

/** Deterministic id so the same question by the same role resolves to one answer. */
export function answerIdFor(entryId: string, role: Role): string {
  return `ANS-${entryId}-${role}`;
}
