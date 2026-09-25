import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ClientContentRecommendation, ClientMonthlyReport } from "./pipeline.ts";
import {
  OpenAIIntegrationError,
  type OpenAIIntegrationErrorCode,
  type OpenAIResponsesClient
} from "./openai-client.ts";

type EditorialIdea = Pick<
  ClientContentRecommendation,
  "title" | "whyRecommended" | "funnelStage" | "singleObjective" | "postCopy" | "imagePrompt"
>;

export type GeneratedEditorialReport = {
  executiveSummary: string;
  executiveReading: string[];
  decision: {
    nextAction: string;
    justification: string;
    confidenceLabel: string;
  };
  recommendations: EditorialIdea[];
  socialDistribution: Array<{
    channel: string;
    label: string;
    format: string;
    publishTime: string;
    reason: string;
    adaptation: string;
  }>;
  validation: {
    metrics24h: string;
    metrics72h: string;
    metrics7d: string;
  };
};

export type EditorialReportResult = {
  report: GeneratedEditorialReport;
  providerFailed: boolean;
  errorCode?: OpenAIIntegrationErrorCode;
};

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["executiveSummary", "executiveReading", "decision", "recommendations", "socialDistribution", "validation"],
  properties: {
    executiveSummary: { type: "string" },
    executiveReading: { type: "array", items: { type: "string" } },
    decision: {
      type: "object",
      additionalProperties: false,
      required: ["nextAction", "justification", "confidenceLabel"],
      properties: {
        nextAction: { type: "string" },
        justification: { type: "string" },
        confidenceLabel: { type: "string" }
      }
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "whyRecommended", "funnelStage", "singleObjective", "postCopy", "imagePrompt"],
        properties: {
          title: { type: "string" },
          whyRecommended: { type: "string" },
          funnelStage: { type: "string", enum: ["TOFU", "MOFU", "BOFU"] },
          singleObjective: { type: "string" },
          postCopy: { type: "string" },
          imagePrompt: { type: "string" }
        }
      }
    },
    socialDistribution: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["channel", "label", "format", "publishTime", "reason", "adaptation"],
        properties: {
          channel: { type: "string" },
          label: { type: "string" },
          format: { type: "string" },
          publishTime: { type: "string" },
          reason: { type: "string" },
          adaptation: { type: "string" }
        }
      }
    },
    validation: {
      type: "object",
      additionalProperties: false,
      required: ["metrics24h", "metrics72h", "metrics7d"],
      properties: {
        metrics24h: { type: "string" },
        metrics72h: { type: "string" },
        metrics7d: { type: "string" }
      }
    }
  }
} satisfies Record<string, unknown>;

function fallbackReport(source: ClientMonthlyReport): GeneratedEditorialReport {
  return {
    executiveSummary: source.executiveSummary,
    executiveReading: source.executiveReading,
    decision: {
      nextAction: source.decision.nextAction,
      justification: source.decision.justification,
      confidenceLabel: source.decision.confidenceLabel
    },
    recommendations: source.recommendations.slice(0, 3).map((item) => ({
      title: item.title,
      whyRecommended: item.whyRecommended,
      funnelStage: item.funnelStage,
      singleObjective: item.singleObjective,
      postCopy: item.postCopy,
      imagePrompt: item.imagePrompt
    })),
    socialDistribution: source.socialDistribution
      .filter((item) => ["linkedin", "meta", "facebook_personal"].includes(item.channel))
      .map((item) => ({
        channel: item.channel,
        label: item.label,
        format: item.format,
        publishTime: item.publishTime,
        reason: item.reason,
        adaptation: item.adaptation
      })),
    validation: {
      metrics24h: "Registrar impressions, abast, reaccions, comentaris i visites al perfil a les 24 h.",
      metrics72h: "Comparar creixement, conversa i qualitat d'audiència a les 72 h sense barrejar finestres.",
      metrics7d: "Tancar la lectura als 7 dies i decidir si el patró es valida, s'ajusta o es descarta."
    }
  };
}

function buildReportContext(source: ClientMonthlyReport): Record<string, unknown> {
  const fallback = fallbackReport(source);
  return {
    reportId: source.reportId,
    period: source.period,
    businessObjective: source.businessObjective,
    strategy: source.strategy,
    decision: source.decision,
    executiveReading: source.executiveReading,
    recommendations: fallback.recommendations,
    socialDistribution: fallback.socialDistribution,
    evidence: {
      confidence: source.realIntelligence.confidence,
      global: source.realIntelligence.global,
      winners: source.realIntelligence.winners,
      audience: source.realIntelligence.audience,
      commercialSignals: source.realIntelligence.commercialSignals,
      timing: source.realIntelligence.timing,
      weeklyValidation: source.weeklyValidation,
      marketSignals: source.realIntelligence.marketSignals.slice(0, 8),
      editorialMemory: source.realIntelligence.editorialMemory.slice(-8),
      dataQuality: source.realIntelligence.dataQuality
    }
  };
}

function preserveDeterministicFields(
  generated: GeneratedEditorialReport,
  source: ClientMonthlyReport
): GeneratedEditorialReport {
  const fallback = fallbackReport(source);
  return {
    ...generated,
    decision: {
      ...generated.decision,
      nextAction: fallback.decision.nextAction,
      confidenceLabel: fallback.decision.confidenceLabel
    },
    recommendations: fallback.recommendations.map((fixed, index) => ({
      ...fixed,
      ...(generated.recommendations[index] || {}),
      title: fixed.title,
      funnelStage: fixed.funnelStage,
      singleObjective: fixed.singleObjective
    })),
    socialDistribution: fallback.socialDistribution.map((fixed, index) => ({
      ...fixed,
      ...(generated.socialDistribution[index] || {}),
      channel: fixed.channel,
      label: fixed.label,
      format: fixed.format,
      publishTime: fixed.publishTime
    }))
  };
}

function isGeneratedEditorialReport(value: unknown): value is GeneratedEditorialReport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GeneratedEditorialReport>;
  return typeof candidate.executiveSummary === "string"
    && Array.isArray(candidate.executiveReading)
    && candidate.executiveReading.every((item) => typeof item === "string")
    && !!candidate.decision
    && typeof candidate.decision.nextAction === "string"
    && typeof candidate.decision.justification === "string"
    && typeof candidate.decision.confidenceLabel === "string"
    && Array.isArray(candidate.recommendations)
    && Array.isArray(candidate.socialDistribution)
    && !!candidate.validation
    && typeof candidate.validation.metrics24h === "string"
    && typeof candidate.validation.metrics72h === "string"
    && typeof candidate.validation.metrics7d === "string";
}

export function loadEditorialReportInstructions(): string {
  return readFileSync(fileURLToPath(new URL("../../../prompts/editorial-report.md", import.meta.url)), "utf8");
}

export async function generateEditorialReportSafely(
  client: OpenAIResponsesClient,
  source: ClientMonthlyReport
): Promise<EditorialReportResult> {
  const fallback = fallbackReport(source);
  try {
    const generated = await client.requestStructured<GeneratedEditorialReport>({
      kind: "report",
      instructions: loadEditorialReportInstructions(),
      input: JSON.stringify(buildReportContext(source)),
      maxOutputTokens: 5000,
      format: {
        type: "json_schema",
        name: "aimetos_editorial_report",
        strict: true,
        schema: reportSchema
      }
    });
    if (!isGeneratedEditorialReport(generated)) {
      throw new OpenAIIntegrationError("OpenAI ha retornat un informe invàlid.", "invalid_response");
    }
    return { report: preserveDeterministicFields(generated, source), providerFailed: false };
  } catch (error) {
    return {
      report: fallback,
      providerFailed: true,
      errorCode: error instanceof OpenAIIntegrationError ? error.code : "unavailable"
    };
  }
}
