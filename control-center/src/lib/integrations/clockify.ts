export interface ClockifyHours {
  total: number;
  byProject: Array<{ label: string; value: number }>;
}

interface ClockifyProject { id: string; name: string; archived?: boolean }
interface ClockifyEntry { projectId?: string; timeInterval?: { duration?: string; start?: string; end?: string } }

function parseDuration(duration?: string) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return Number(duration) / 3_600 || 0;
  return (Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)) / 3600;
}

export async function getClockifyHours(): Promise<ClockifyHours> {
  const key = process.env.CLOCKIFY_API_KEY;
  const workspace = process.env.CLOCKIFY_WORKSPACE_ID;
  const user = process.env.CLOCKIFY_USER_ID;
  if (!key || !workspace || !user) throw new Error("Clockify no està configurat");
  const headers = { "X-Api-Key": key };
  const end = new Date();
  const start = new Date(end.getTime() - 31 * 86_400_000);
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
