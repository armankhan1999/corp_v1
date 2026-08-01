import { getDataset } from "@/lib/seed";
import { requireSession } from "@/components/domain/admin/serverSession";
import { can } from "@/lib/rbac/matrix";
import { NotificationCentre } from "@/components/domain/workflow/NotificationCentre";

export const dynamic = "force-dynamic";

/**
 * E11-S4 notification centre + E11-S6 channel preferences and outbound message
 * log. A notification for an entity the role cannot reach is never delivered at
 * all, rather than delivered and blocked on click.
 */
export default async function NotificationsPage() {
  const session = await requireSession();
  const ds = getDataset();

  const mine = ds.notifications
    .filter((n) => n.userId === session.userId)
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));

  // Fall back to the whole feed for roles with no seeded notifications, so the
  // screen demonstrates rather than sitting empty in a walkthrough.
  const rows = mine.length > 0 ? mine : ds.notifications.slice(0, 12);

  return (
    <NotificationCentre
      rows={rows.map((n) => ({
        id: n.id, type: n.type, title: n.title, body: n.body,
        entityType: n.entityType, entityId: n.entityId, href: n.href,
        read: n.read, at: n.at, digest: n.digest,
      }))}
      messages={ds.messageLog.map((m) => ({
        id: m.id, channel: m.channel, recipientLabel: m.recipientLabel,
        recipientPhone: m.recipientPhone, template: m.template, content: m.content,
        entityType: m.entityType, entityId: m.entityId, state: m.state, at: m.at,
      }))}
      preferences={ds.channelPreferences.map((p) => ({
        id: p.id, notificationType: p.notificationType, role: p.role, channels: p.channels,
      }))}
      viewerIsOwner={mine.length > 0}
      canEditPreferences={can(session.role, "chainDesigner")}
      todayIso={ds.meta.today}
    />
  );
}
