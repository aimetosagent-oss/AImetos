import type { ContentIdea, EditorialCalendar, EditorialFamily, TemporalEvent } from "../../shared/src/domain.ts";

export type TemporalDecisionContext = {
  activeEvents: TemporalEvent[];
  badge?: string;
};

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function resolveTemporalContext(calendar: EditorialCalendar, now = new Date()): TemporalDecisionContext {
  const today = dateKey(now);
  const activeEvents = calendar.events.filter(
    (event) => today >= event.validFrom && today <= event.validUntil && now.getTime() <= Date.parse(event.expiryAt)
  );
  const strongest = [...activeEvents].sort((a, b) => b.businessRelevance - a.businessRelevance)[0];
  return {
    activeEvents,
    badge: strongest ? `Context temporal: ${strongest.name}` : undefined
  };
}

export function temporalBonusForFamily(family: EditorialFamily, context?: TemporalDecisionContext): number {
  if (!context) return 0;
  return Number(
    Math.max(
      0,
      ...context.activeEvents
        .filter((event) => event.relatedEditorialFamilies.includes(family))
        .map((event) => event.maxPriorityBonus * event.businessRelevance)
    ).toFixed(2)
  );
}

export function applyTemporalModifiers(idea: ContentIdea, context?: TemporalDecisionContext): ContentIdea {
  const temporalBonus = temporalBonusForFamily(idea.editorialFamily, context);
  const event = context?.activeEvents.find((item) => item.relatedEditorialFamilies.includes(idea.editorialFamily));
  return {
    ...idea,
    temporalBonus,
    temporalContext: temporalBonus > 0 ? event?.name : undefined
  };
}
