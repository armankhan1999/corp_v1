"use client";

import * as React from "react";
import Link from "next/link";
import {
  BellOff, CheckCheck, Inbox, MessageSquare, Send, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelative, formatCount, enumLabel } from "@/lib/format";
import { EmptyState, Overline, Panel, PanelHeader, SimulatedBadge, StatusBadge, Explainer } from "@/components/patterns/primitives";
import { ROLE_LABEL, type NotificationChannel, type Role } from "@/lib/schemas/enums";

const READ_KEY = "pravaah.v1.notifications.read";

export interface NotificationRow {
  id: string; type: string; title: string; body: string;
  entityType: string | null; entityId: string | null; href: string | null;
  read: boolean; at: string; digest: boolean;
}
export interface MessageRow {
  id: string; channel: NotificationChannel; recipientLabel: string; recipientPhone: string;
  template: string; content: string; entityType: string | null; entityId: string | null;
  state: string; at: string;
}
export interface PreferenceRow {
  id: string; notificationType: string; role: Role; channels: NotificationChannel[];
}

type Tab = "INBOX" | "MESSAGES" | "PREFERENCES";

const STATE_TONE: Record<string, "ok" | "info" | "warn" | "danger" | "neutral"> = {
  READ: "ok", DELIVERED: "info", SENT: "info", QUEUED: "neutral", FAILED: "danger",
};

const CHANNEL_NOTE: Record<NotificationChannel, string | null> = {
  IN_APP: null,
  WHATSAPP: "DLT registration is not required for WhatsApp.",
  EMAIL: null,
  SMS: "Transactional SMS requires TRAI DLT registration of header and template.",
};

export function NotificationCentre({
  rows, messages, preferences, viewerIsOwner, canEditPreferences, todayIso,
}: {
  rows: NotificationRow[];
  messages: MessageRow[];
  preferences: PreferenceRow[];
  viewerIsOwner: boolean;
  canEditPreferences: boolean;
  todayIso: string;
}) {
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const [tab, setTab] = React.useState<Tab>("INBOX");
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = React.useState("");
  const [channelFilter, setChannelFilter] = React.useState("");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(READ_KEY);
      if (raw) setReadIds(new Set(JSON.parse(raw) as string[]));
    } catch { /* storage unavailable */ }
    setHydrated(true);
  }, []);

  const persist = (next: Set<string>) => {
    setReadIds(next);
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify([...next]));
    } catch { /* storage unavailable */ }
  };

  const isRead = (n: NotificationRow) => n.read || readIds.has(n.id);
  const markRead = (id: string) => persist(new Set([...readIds, id]));
  const markAllRead = () => persist(new Set([...readIds, ...rows.map((r) => r.id)]));

  const types = [...new Set(rows.map((r) => r.type))].sort();
  const filtered = rows.filter((r) => !typeFilter || r.type === typeFilter);
  const unread = rows.filter((r) => !isRead(r)).length;

  const filteredMessages = messages.filter((m) => !channelFilter || m.channel === channelFilter);

  /* Grouped by type, as E11-S4 requires. */
  const grouped = filtered.reduce<Record<string, NotificationRow[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">Notification Centre</h1>
          <p className="t-body-sm mt-1 text-text-mid">Everything the platform needs you to know.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Everything the platform needs you to know, so nothing depends on your having
            noticed it at the moment it happened.
        </Explainer>
        </div>
        {tab === "INBOX" && unread > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            className="t-body-sm inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <CheckCheck className="size-4" aria-hidden />
            Mark all {formatCount(unread)} as read
          </button>
        ) : null}
      </div>

      {!viewerIsOwner ? (
        <p className="t-body-sm rounded-md border border-info/40 bg-info-bg px-3 py-2 text-info">
          Your role has no seeded notifications. Showing the platform feed so the surface can be
          walked.
        </p>
      ) : null}

      <div role="tablist" aria-label="Notification views" className="flex gap-1">
        {([
          ["INBOX", Inbox, `Inbox${unread ? ` (${unread})` : ""}`],
          ["MESSAGES", MessageSquare, `Outbound log (${messages.length})`],
          ["PREFERENCES", SlidersHorizontal, "Channels"],
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "t-body-sm inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 transition-colors duration-150",
              tab === key
                ? "bg-primary-100 font-medium text-text-hi shadow-[inset_0_0_0_1px_var(--line-strong)]"
                : "text-text-mid hover:bg-surface-2 hover:text-text-hi",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "INBOX" ? (
        <Panel>
          <PanelHeader
            title="Inbox"
            sub="Grouped by type. Read state persists for this browser."
            right={
              <select
                aria-label="Filter by type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="t-body-sm min-h-9 rounded-md border border-line bg-surface-2 px-2 text-text-hi"
              >
                <option value="">All types</option>
                {types.map((t) => (
                  <option key={t} value={t}>{enumLabel(t)}</option>
                ))}
              </select>
            }
          />
          {!hydrated ? (
            <div className="flex flex-col gap-2 p-4">
              {[0, 1, 2, 3].map((i) => <div key={i} className="pv-skeleton h-14 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            typeFilter ? (
              <EmptyState
                icon={BellOff}
                title="Nothing matches that filter"
                body={`No notifications of type "${enumLabel(typeFilter)}".`}
                action={
                  <button
                    type="button"
                    onClick={() => setTypeFilter("")}
                    className="t-body-sm min-h-9 rounded-md border border-line px-3 text-text-mid hover:border-line-strong hover:text-text-hi"
                  >
                    Clear filter
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={BellOff}
                title="Nothing needs your attention"
                body={`Evaluated ${formatDateTime(now)} IST. New alerts appear here as soon as they are raised.`}
              />
            )
          ) : (
            <div className="flex flex-col">
              {Object.entries(grouped).map(([type, items]) => (
                <section key={type}>
                  <h2 className="t-overline border-b border-line bg-surface-2 px-4 py-1.5 text-text-lo">
                    {enumLabel(type)} · {items.length}
                  </h2>
                  <ul>
                    {items.map((n) => {
                      const read = isRead(n);
                      const rowClass = cn(
                        "flex min-h-14 items-start gap-3 px-4 py-3 transition-colors duration-150",
                        n.href && "hover:bg-surface-2",
                        !read && "bg-primary-100/40",
                      );
                      const inner = (
                          <>
                            <span
                              aria-hidden
                              className={cn(
                                "mt-1.5 size-2 shrink-0 rounded-full",
                                read ? "bg-line-strong" : "bg-primary-500",
                              )}
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  "t-body block",
                                  read ? "text-text-mid" : "font-medium text-text-hi",
                                )}
                              >
                                {enumLabel(n.title)}
                              </span>
                              <span className="t-body-sm block text-text-mid">{n.body}</span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <span className="t-body-sm text-text-lo">
                                {formatRelative(n.at, now)}
                              </span>
                              {!read ? <StatusBadge tone="info">Unread</StatusBadge> : null}
                            </span>
                          </>
                      );
                      return (
                        <li key={n.id} className="border-b border-line last:border-b-0">
                          {n.href ? (
                            <Link href={n.href} onClick={() => markRead(n.id)} className={rowClass}>
                              {inner}
                            </Link>
                          ) : (
                            <div className={rowClass}>{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "MESSAGES" ? (
        <Panel>
          <PanelHeader
            title="Outbound message log"
            sub="Every simulated message the platform has sent, with its delivery state."
            right={
              <div className="flex items-center gap-2">
                <SimulatedBadge what="WhatsApp Business API (INT-04) and SMS (INT-05)" />
                <select
                  aria-label="Filter by channel"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="t-body-sm min-h-9 rounded-md border border-line bg-surface-2 px-2 text-text-hi"
                >
                  <option value="">All channels</option>
                  {["IN_APP", "WHATSAPP", "EMAIL", "SMS"].map((c) => (
                    <option key={c} value={c}>{enumLabel(c)}</option>
                  ))}
                </select>
              </div>
            }
          />
          {filteredMessages.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No messages on that channel"
              body="Change the channel filter to see the rest of the log."
              action={
                <button
                  type="button"
                  onClick={() => setChannelFilter("")}
                  className="t-body-sm min-h-9 rounded-md border border-line px-3 text-text-mid hover:border-line-strong hover:text-text-hi"
                >
                  Clear filter
                </button>
              }
            />
          ) : (
            <ul className="flex flex-col">
              {filteredMessages.map((m) => (
                <li key={m.id} className="border-b border-line px-4 py-3 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={STATE_TONE[m.state] ?? "neutral"}>{enumLabel(m.state)}</StatusBadge>
                    <span className="t-overline text-text-lo">{enumLabel(m.channel)}</span>
                    <span className="t-body-sm text-text-mid">{m.recipientLabel}</span>
                    <span className="t-mono text-text-lo">{m.recipientPhone}</span>
                    <span className="t-body-sm ml-auto text-text-lo">{formatDateTime(m.at)}</span>
                  </div>
                  <pre className="t-body-sm mt-2 whitespace-pre-wrap rounded-md border border-line bg-surface-2 p-3 text-text-mid">
                    {m.content}
                  </pre>
                  <p className="t-body-sm mt-1 text-text-lo">
                    Template <span className="t-mono">{m.template}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {tab === "PREFERENCES" ? (
        <Panel>
          <PanelHeader
            title="Channel preferences"
            sub={
              canEditPreferences
                ? "Which channels carry which notification, per role."
                : "Read-only for your role. Channel routing is set by the platform administrator."
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Notification", "Role", "Channels", "Registration note"].map((h) => (
                    <th
                      key={h}
                      className="t-overline border-b border-line bg-surface-2 px-3 py-2 text-left text-text-lo"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preferences.map((p) => {
                  const notes = p.channels.map((c) => CHANNEL_NOTE[c]).filter(Boolean);
                  return (
                    <tr key={p.id} className="hover:bg-surface-2">
                      <td className="t-body-sm border-b border-line px-3 py-2 text-text-hi">
                        {enumLabel(p.notificationType)}
                      </td>
                      <td className="t-body-sm border-b border-line px-3 py-2 text-text-mid">
                        {ROLE_LABEL[p.role]}
                      </td>
                      <td className="border-b border-line px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {p.channels.map((c) => (
                            <StatusBadge key={c} tone={c === "WHATSAPP" ? "ok" : "neutral"} icon={false}>
                              {enumLabel(c)}
                            </StatusBadge>
                          ))}
                        </div>
                      </td>
                      <td className="t-body-sm border-b border-line px-3 py-2 text-text-lo">
                        {notes.length ? notes.join(" ") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line p-4">
            <Overline>Why WhatsApp is the primary actionable channel</Overline>
            <p className="t-body-sm mt-1 text-text-mid">
              WhatsApp Business API does not require TRAI DLT registration, and service replies
              inside the 24-hour customer window are free of charge. Transactional SMS does require
              DLT registration of both header and template, which is why it is the fallback rather
              than the default.
            </p>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
