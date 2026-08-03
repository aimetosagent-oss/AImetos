import type { AgentRow } from "../types";

interface N8nWorkflow { id: string; name: string; active: boolean; updatedAt?: string }
interface N8nExecution { id: string; workflowId: string; status?: string; finished?: boolean; startedAt?: string; stoppedAt?: string }

function cadence(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("grasshopper")) return { label: "Setmanal · dilluns", maxGapHours: 8 * 24 };
  if (lower.includes("linkedin")) return { label: "Diari", maxGapHours: 30 };
  return { label: "Laborables", maxGapHours: 36 };
}

export async function getN8nAgents(): Promise<AgentRow[]> {
  const base = process.env.N8N_BASE_URL?.replace(/\/$/, "");
  const key = process.env.N8N_API_KEY;
  if (!base || !key) throw new Error("n8n no està configurat");
  const headers = { "X-N8N-API-KEY": key };
  const workflowResponse = await fetch(`${base}/api/v1/workflows?limit=100`, { headers, next: { revalidate: 300 } });
  if (!workflowResponse.ok) throw new Error(`n8n ha respost ${workflowResponse.status}`);
  const workflowJson = (await workflowResponse.json()) as { data?: N8nWorkflow[] };
  const trackedIds = new Set((process.env.N8N_TRACKED_WORKFLOW_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
  const keywords = ["lead", "outbound", "linkedin", "grasshopper", "email"];
  const selected = (workflowJson.data || []).filter((workflow) => trackedIds.size ? trackedIds.has(workflow.id) : workflow.active && keywords.some((word) => workflow.name.toLowerCase().includes(word)));
  const executions = await Promise.all(selected.map(async (workflow) => {
    const response = await fetch(`${base}/api/v1/executions?workflowId=${encodeURIComponent(workflow.id)}&limit=10&includeData=false`, { headers, next: { revalidate: 300 } });
    if (!response.ok) throw new Error(`n8n execucions ha respost ${response.status}`);
    const json = (await response.json()) as { data?: N8nExecution[] };
    return [workflow.id, json.data || []] as const;
  }));
  const executionMap = new Map(executions);
  return selected.map((workflow) => {
    const rule = cadence(workflow.name);
    const latest = (executionMap.get(workflow.id) || []).sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime())[0];
    const ageHours = latest?.startedAt ? (Date.now() - new Date(latest.startedAt).getTime()) / 3_600_000 : Infinity;
    const failed = latest?.status === "error" || latest?.status === "crashed";
    const stale = ageHours > rule.maxGapHours;
    return {
      id: workflow.id,
      name: workflow.name,
      cadence: rule.label,
      active: workflow.active,
      lastRun: latest?.startedAt,
      nextExpected: latest?.startedAt ? new Date(new Date(latest.startedAt).getTime() + rule.maxGapHours * 3_600_000).toISOString() : undefined,
      health: failed ? "error" : stale ? "warning" : "ok",
      error: failed ? `Última execució: ${latest?.status}` : stale ? "No s'ha executat dins la freqüència esperada" : undefined,
      url: `${base}/workflow/${workflow.id}`,
    } satisfies AgentRow;
  });
}
