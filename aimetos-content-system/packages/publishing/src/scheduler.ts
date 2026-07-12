import type { ContentIdea, MockScenario } from "../../shared/src/domain.ts";
import type { GeneratedContent } from "../../content/src/generator.ts";

export type PublicationPlan = {
  ideaId: string;
  scheduledAt: string;
  channels: string[];
  status: "scheduled" | "published" | "failed";
  publicationIds: string[];
  error?: string;
};

export function scheduleContent(idea: ContentIdea, generated: GeneratedContent, start = "2026-07-14T09:00:00.000Z"): PublicationPlan {
  const channels = ["blog", "linkedin", ...generated.adaptations.map((item) => item.channel)].filter(
    (value, index, list) => list.indexOf(value) === index
  );
  return {
    ideaId: idea.id,
    scheduledAt: start,
    channels,
    status: "scheduled",
    publicationIds: []
  };
}

export function publishMock(plan: PublicationPlan, scenario: MockScenario): PublicationPlan {
  if (scenario === "publishing_failure") {
    return {
      ...plan,
      status: "failed",
      error: "SIMULATED_PUBLISHING_FAILURE"
    };
  }
  return {
    ...plan,
    status: "published",
    publicationIds: plan.channels.map((channel) => "mock_" + channel + "_" + plan.ideaId)
  };
}
