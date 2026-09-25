import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { ContentDecision } from "./content-decision-engine.ts";
import type { EditorialControlState, EditorialExperiment } from "./editorial-state.ts";

export type EditorialDecisionAction = "approve" | "reject" | "regenerate_alternative";

export type EditorialFeedback = {
  id: string;
  decisionId: string;
  candidateId: string;
  action: EditorialDecisionAction;
  reason?: string;
  conversationId?: string;
  timestamp: string;
};

type EditorialControlStoreData = {
  feedback: EditorialFeedback[];
  currentExperiment?: EditorialExperiment;
  previousExperiments: EditorialExperiment[];
};

const EMPTY_STORE: EditorialControlStoreData = { feedback: [], previousExperiments: [] };

export class EditorialControlStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private read(): EditorialControlStoreData {
    if (!existsSync(this.filePath)) return structuredClone(EMPTY_STORE);
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<EditorialControlStoreData>;
      return {
        feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
        currentExperiment: parsed.currentExperiment,
        previousExperiments: Array.isArray(parsed.previousExperiments) ? parsed.previousExperiments : []
      };
    } catch {
      return structuredClone(EMPTY_STORE);
    }
  }

  private write(data: EditorialControlStoreData): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    renameSync(temporary, this.filePath);
  }

  getState(): EditorialControlState {
    const data = this.read();
    const lastApproval = data.feedback.findLastIndex((item) => item.action === "approve");
    const excludedCandidateIds = data.feedback
      .slice(lastApproval + 1)
      .filter((item) => ["reject", "regenerate_alternative"].includes(item.action))
      .map((item) => item.candidateId);
    return {
      currentExperiment: data.currentExperiment,
      previousExperiments: data.previousExperiments,
      excludedCandidateIds: [...new Set(excludedCandidateIds)]
    };
  }

  record(
    action: EditorialDecisionAction,
    decision: ContentDecision,
    options: { reason?: string; conversationId?: string } = {}
  ): EditorialFeedback {
    const data = this.read();
    const feedback: EditorialFeedback = {
      id: randomUUID(),
      decisionId: decision.decision_id,
      candidateId: decision.candidate_id,
      action,
      reason: options.reason?.trim() || undefined,
      conversationId: options.conversationId,
      timestamp: new Date().toISOString()
    };
    data.feedback.push(feedback);
    data.feedback = data.feedback.slice(-200);

    if (action === "approve") {
      if (data.currentExperiment) {
        data.previousExperiments.push({ ...data.currentExperiment, status: "completed" });
      }
      data.currentExperiment = {
        id: `experiment_${decision.decision_id}`,
        source: "user_approved_decision",
        status: "planned",
        hypothesis: decision.experiment.hypothesis,
        primary_variable: decision.experiment.primary_variable,
        control_variables: decision.experiment.controls,
        confounders: decision.experiment.confounders,
        expected_signal: decision.experiment.expected_signal,
        measurement_windows: decision.experiment.measurement_windows,
        decision_id: decision.decision_id,
        started_at: feedback.timestamp
      };
      data.previousExperiments = data.previousExperiments.slice(-50);
    }

    this.write(data);
    return feedback;
  }
}
