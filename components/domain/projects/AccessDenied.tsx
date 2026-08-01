"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ShieldX } from "lucide-react";
import { Panel } from "@/components/patterns/primitives";
import { logOnly } from "./store";

/**
 * E6-S7 — a user without permission for a project is denied and the denial is
 * audit-logged. The message names the holder of the access rather than leaving
 * the user at a dead end. RBAC-6.
 */
export function ProjectAccessDenied({
  projectId, actor, reason,
}: {
  projectId: string;
  actor: { id: string; name: string; role: string };
  reason: "DENIED" | "NOT_FOUND";
}) {
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logOnly({
      actorId: actor.id,
      actorName: actor.name,
      action: reason === "DENIED" ? "ACCESS_DENIED" : "BLOCKED",
      entity: "PROJECT",
      entityId: projectId,
      detail:
        reason === "DENIED"
          ? `${actor.role} requested a project they do not manage — denied and recorded`
          : `Requested project ${projectId} does not exist`,
    });
  }, [projectId, actor, reason]);

  return (
    <Panel className="mx-auto max-w-2xl">
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <ShieldX className="size-8 text-danger" aria-hidden />
        <div>
          <h1 className="t-heading-lg text-text-hi">
            {reason === "DENIED" ? "Access denied to this project" : "No such project"}
          </h1>
          <p className="t-body-sm mx-auto mt-2 max-w-md text-text-mid">
            {reason === "DENIED" ? (
              <>
                Project records, documents and measurement books are visible only to the assigned project
                manager and to roles with portfolio-wide rights — Director – Business, Director – Strategy,
                Accounts Executive, Auditor and Super Admin. This attempt has been written to the audit log.
              </>
            ) : (
              <>
                The reference <span className="t-mono text-text-hi">{projectId}</span> does not match any
                project on record. It may have been renumbered.
              </>
            )}
          </p>
        </div>
        <Link
          href="/projects"
          className="t-body-sm inline-flex h-8 items-center rounded-md border border-primary-600 bg-primary-600 px-3 text-white hover:bg-primary-500"
        >
          Back to the portfolio
        </Link>
      </div>
    </Panel>
  );
}
