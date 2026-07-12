import { randomUUID } from "node:crypto";
import { allowedTransitions, type AuditEvent, type ContentStatus } from "../../shared/src/domain.ts";

export function canTransition(previousStatus: ContentStatus, nextStatus: ContentStatus): boolean {
  return allowedTransitions[previousStatus].includes(nextStatus);
}

export function transitionContentStatus(input: {
  previousStatus: ContentStatus;
  nextStatus: ContentStatus;
  user: string;
  comment: string;
  version: number;
  origin: string;
  now?: string;
}): AuditEvent {
  if (!canTransition(input.previousStatus, input.nextStatus)) {
    throw new Error("Invalid content status transition from " + input.previousStatus + " to " + input.nextStatus);
  }
  return {
    id: "audit_" + randomUUID(),
    user: input.user,
    date: input.now || new Date().toISOString(),
    change: "status_change",
    previousStatus: input.previousStatus,
    nextStatus: input.nextStatus,
    comment: input.comment,
    version: input.version,
    origin: input.origin
  };
}

export function transitionPath(statuses: ContentStatus[], origin = "mock-flow"): AuditEvent[] {
  const events: AuditEvent[] = [];
  for (let index = 1; index < statuses.length; index += 1) {
    events.push(
      transitionContentStatus({
        previousStatus: statuses[index - 1],
        nextStatus: statuses[index],
        user: "system",
        comment: "Automated mock transition",
        version: index,
        origin
      })
    );
  }
  return events;
}
