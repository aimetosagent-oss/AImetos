export interface ClockifyHours {
  total: number;
  byProject: Array<{ label: string; value: number }>;
}

interface ClockifyProject { id: string; name: string; archived?: boolean }
interface ClockifyEntry { projectId?: string; timeInterval?: { duration?: string; start?: string; end?: string } }
interface ClockifyUser { id: string; activeWorkspace?: string; defaultWorkspace?: string }
interface ClockifyWorkspace { id: string; name: string }

function parseDuration(duration?: string) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return Number(duration) / 3_600 || 0;
  return (Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)) / 3600;
}

async function resolveClockifyIds(headers: { "X-Api-Key": string }) {
  let workspace = process.env.CLOCKIFY_WORKSPACE_ID;
  let user = process.env.CLOCKIFY_USER_ID;

  if (!workspace || !user) {
    const userResponse = await fetch("https://api.clockify.me/api/v1/user", { headers, next: { revalidate: 300 } });
    if (!userResponse.ok) throw new Error(`Clockify no ha pogut identificar l'usuari (${userResponse.status})`);
    const currentUser = (await userResponse.json()) as ClockifyUser;
    user ||= currentUser.id;
    workspace ||= currentUser.activeWorkspace || currentUser.defaultWorkspace;
  }

  if (!workspace) {
    const workspacesResponse = await fetch("https://api.clockify.me/api/v1/workspaces", { headers, next: { revalidate: 300 } });
    if (!workspacesResponse.ok) throw new Error(`Clockify no ha pogut llegir els espais de treball (${workspacesResponse.status})`);
    const workspaces = (await workspacesResponse.json()) as ClockifyWorkspace[];
    workspace = workspaces.find((item) => item.name.toLocaleLowerCase().includes("aimetos"))?.id || workspaces[0]?.id;
  }

  if (!workspace || !user) throw new Error("Clockify no ha pogut determinar l'usuari o l'espai de treball");
  return { workspace, user };
}

export type ClockifyPeriod = "7d" | "31d" | "month" | "previous-month";

export async function getClockifyHours(period: ClockifyPeriod = "31d"): Promise<ClockifyHours> {
  const key = process.env.CLOCKIFY_API_KEY;
  if (!key) throw new Error("Falta la clau API de Clockify");
  const headers = { "X-Api-Key": key };
  const { workspace, user } = await resolveClockifyIds(headers);
  const now = new Date();
  const end = period === "previous-month"
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : now;
  const start = period === "month"
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === "previous-month"
      ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
      : new Date(end.getTime() - (period === "7d" ? 7 : 31) * 86_400_000);
  const [projectsResponse, entriesResponse] = await Promise.all([
    fetch(`https://api.clockify.me/api/v1/workspaces/${workspace}/projects?page-size=1000`, { headers, next: { revalidate: 300 } }),
    fetch(`https://api.clockify.me/api/v1/workspaces/${workspace}/user/${user}/time-entries?start=${start.toISOString()}&end=${end.toISOString()}&page-size=1000&hydrated=false`, { headers, next: { revalidate: 300 } }),
  ]);
  if (!projectsResponse.ok || !entriesResponse.ok) throw new Error(`Clockify ha respost ${projectsResponse.status}/${entriesResponse.status}`);
  const projects = (await projectsResponse.json()) as ClockifyProject[];
  const entries = (await entriesResponse.json()) as ClockifyEntry[];
  const names = new Map(projects.map((project) => [project.id, project.name]));
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const label = entry.projectId ? names.get(entry.projectId) || "Projecte desconegut" : "Sense projecte";
    totals.set(label, (totals.get(label) || 0) + parseDuration(entry.timeInterval?.duration));
  }
  const byProject = [...totals.entries()].map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  return { total: Math.round(byProject.reduce((sum, row) => sum + row.value, 0) * 100) / 100, byProject };
}
