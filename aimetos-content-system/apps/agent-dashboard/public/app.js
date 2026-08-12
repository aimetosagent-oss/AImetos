const state = { activity: null, filter: "all" };
const formatter = new Intl.NumberFormat("ca-ES");
const dateFormatter = new Intl.DateTimeFormat("ca-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function byId(id) { return document.getElementById(id); }

const labels = {
  started: "En curs",
  succeeded: "Correcte",
  failed: "Error",
  warning: "Avís",
  waiting: "En espera"
};

function eventNode(event) {
  const node = document.createElement("article");
  node.className = `event severity-${event.severity}`;

  const rail = document.createElement("span");
  rail.className = `event-dot status-${event.status}`;
  const body = document.createElement("div");
  const top = document.createElement("div");
  top.className = "event-top";
  const identity = document.createElement("div");
  const agent = document.createElement("strong");
  agent.textContent = event.agentName;
  const workflow = document.createElement("span");
  workflow.textContent = event.workflowName;
  identity.append(agent, workflow);
  const badge = document.createElement("span");
  badge.className = `badge status-${event.status}`;
  badge.textContent = labels[event.status] || event.status;
  top.append(identity, badge);

  const title = document.createElement("h3");
  title.textContent = event.title;
  const summary = document.createElement("p");
  summary.textContent = event.summary;
  const meta = document.createElement("div");
  meta.className = "event-meta";
  const time = document.createElement("time");
  time.dateTime = event.occurredAt;
  time.textContent = dateFormatter.format(new Date(event.occurredAt));
  const correlation = document.createElement("span");
  correlation.textContent = event.retryCount ? `${event.retryCount} reintent(s)` : event.correlationId;
  meta.append(time, correlation);
  if (event.actionUrl) {
    const link = document.createElement("a");
    link.href = event.actionUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Obrir execució ↗";
    meta.appendChild(link);
  }
  body.append(top, title, summary, meta);
  node.append(rail, body);
  return node;
}

function renderList(id, events, emptyText) {
  const target = byId(id);
  target.replaceChildren();
  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = emptyText;
    target.appendChild(empty);
    return;
  }
  for (const event of events) target.appendChild(eventNode(event));
}

function render(activity) {
  state.activity = activity;
  byId("updatedAt").textContent = dateFormatter.format(new Date(activity.generatedAt));
  byId("attentionCount").textContent = formatter.format(activity.summary.attention);
  const summary = byId("summary");
  summary.replaceChildren();
  const cards = [
    ["Agents registrats", activity.summary.agents, "agents"],
    ["Execucions", activity.summary.executions, "executions"],
    ["Correctes", activity.summary.succeeded, "success"],
    ["En curs", activity.summary.running, "running"],
    ["Errors", activity.summary.failed, "failed"],
    ["Atenció", activity.summary.attention, "attention"]
  ];
  for (const [label, value, tone] of cards) {
    const card = document.createElement("article");
    card.className = `summary-card tone-${tone}`;
    const number = document.createElement("strong");
    number.textContent = formatter.format(value);
    const text = document.createElement("span");
    text.textContent = label;
    card.append(number, text);
    summary.appendChild(card);
  }
  renderList("important", activity.important, "No hi ha avisos importants.");
  renderRecent();
}

function renderRecent() {
  if (!state.activity) return;
  const events = state.filter === "all" ? state.activity.recent : state.activity.recent.filter((event) => event.status === state.filter);
  renderList("recent", events, "No hi ha activitat amb aquest filtre.");
}

async function loadActivity() {
  const button = byId("refresh");
  const banner = byId("errorBanner");
  button.disabled = true;
  button.textContent = "Actualitzant…";
  banner.hidden = true;
  try {
    const response = await fetch("/api/activity");
    if (!response.ok) throw new Error("No s'ha pogut carregar l'activitat.");
    render(await response.json());
  } catch (error) {
    banner.textContent = error.message;
    banner.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "Actualitzar";
  }
}

for (const button of document.querySelectorAll(".filter")) {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
    renderRecent();
  });
}
byId("refresh").addEventListener("click", loadActivity);
loadActivity();
