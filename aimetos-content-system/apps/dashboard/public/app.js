const formatter = new Intl.NumberFormat("ca-ES");

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  byId(id).textContent = value;
}

function chip(value) {
  const node = document.createElement("span");
  node.className = "chip";
  node.textContent = value;
  return node;
}

function metric(label, value) {
  const node = document.createElement("div");
  node.className = "metric";
  node.innerHTML = "<span>" + label + "</span><strong>" + value + "</strong>";
  return node;
}

function card(className = "card") {
  const node = document.createElement("article");
  node.className = className;
  return node;
}

function statusLabel(status) {
  const labels = {
    pending_publish: "Pendent de publicar",
    published: "Publicat",
    metrics_24h: "Mètriques 24h",
    metrics_72h: "Mètriques 72h",
    validated: "Validat",
    scheduled: "Programat",
    not_planned: "No planificat"
  };
  return labels[status] || "Pendent de publicar";
}

function confidenceLabel(report) {
  return report.decision.confidenceLabel || (report.decision.confidence === "high" ? "Confiança inicial alta" : "Hipòtesi inicial");
}

function effortLabel(effort) {
  return { low: "baixa", medium: "mitjana", high: "alta" }[effort] || effort;
}

function renderTopContent(items) {
  const target = byId("topContent");
  const template = byId("topContentTemplate");
  target.innerHTML = "";

  for (const item of items.slice(0, 1)) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".rank").textContent = item.rank;
    node.querySelector("h3").textContent = item.title;
    node.querySelector("p").textContent = item.whyItWorked;

    const chips = node.querySelector(".chips");
    chips.append(chip("LinkedIn"), chip("Post LinkedIn"), chip(item.topic.replaceAll("-", " ")));

    const metrics = node.querySelector(".metric-stack");
    metrics.append(
      metric("Impressions", formatter.format(item.metrics.impressions || item.metrics.views || 0)),
      metric("Reaccions", formatter.format(item.metrics.reactions || 0)),
      metric("Comentaris", formatter.format(item.metrics.comments || 0)),
      metric("Visites perfil", formatter.format(item.metrics.profileVisits || 0))
    );
    target.appendChild(node);
  }
}

function renderWeeklyValidation(weekly) {
  if (!weekly) return;
  setText("weeklyPeriod", weekly.period);
  setText("visibilityWinner", weekly.visibilityWinner.title);
  setText("visibilityReason", weekly.visibilityWinner.reason);
  setText("audienceWinner", weekly.audienceQualityWinner.title);
  setText("audienceReason", weekly.audienceQualityWinner.reason);
  setText("commercialSignal", weekly.commercialSignal);
  setText("weeklyDecision", weekly.nextDecision);

  const target = byId("weeklyMetrics");
  target.innerHTML = "";
  target.append(
    metric("Publicacions", formatter.format(weekly.totals.posts)),
    metric("Impressions", formatter.format(weekly.totals.impressions)),
    metric("Abast*", formatter.format(weekly.totals.reach)),
    metric("Visites al perfil", formatter.format(weekly.totals.profileVisits)),
    metric("Reaccions", formatter.format(weekly.totals.reactions)),
    metric("Invitacions probables", formatter.format(weekly.totals.probableInvitations))
  );
}

function renderRealIntelligence(data) {
  setText("dataConfidence", `${data.confidence.label} · ${data.confidence.comparablePosts} posts comparables`);
  setText("sampleWarning", data.confidence.warning);

  const overview = byId("overviewMetrics");
  overview.innerHTML = "";
  overview.append(
    metric("LinkedIn", formatter.format(data.global.linkedinPosts)),
    metric("Instagram", formatter.format(data.global.instagramPosts)),
    metric("Impressions LI", formatter.format(data.global.impressions)),
    metric("Abast LI*", formatter.format(data.global.reach)),
    metric("Comentaris", formatter.format(data.global.comments)),
    metric("Leads confirmats", formatter.format(data.global.confirmedLeads))
  );

  const horizons = byId("horizonWeights");
  horizons.innerHTML = "";
  for (const item of data.horizons) horizons.append(chip(`${item.label} ${item.weight}%`));

  const winners = byId("winnerGrid");
  winners.innerHTML = "";
  for (const item of data.winners) {
    const node = card(`winner-card winner-${item.key}`);
    node.innerHTML = `<span>${item.label}</span><strong>${item.title}</strong><p>${item.reason}</p>`;
    winners.appendChild(node);
  }

  setText("audienceFitScore", `Audience fit ${data.audience.audienceFitScore}/100`);
  setText("audienceReading", data.audience.reading);
  const audience = byId("audienceMetrics");
  audience.innerHTML = "";
  audience.append(
    metric("Pic de decisors", `${data.audience.decisionMakerPeak}%`),
    metric("Sectors", data.audience.sectors.join(", ") || "Sense dades"),
    metric("Mides d'empresa", data.audience.companySizes.join(", ") || "Sense dades"),
    metric("Ubicacions", data.audience.locations.join(", ") || "Sense dades")
  );

  const commercial = data.commercialSignals;
  const commercialTarget = byId("commercialMetrics");
  commercialTarget.innerHTML = "";
  commercialTarget.append(
    metric("Visites perfil", formatter.format(commercial.profileViews)),
    metric("Invitacions rebudes", formatter.format(commercial.connectionRequestsReceived)),
    metric("Atribució probable", formatter.format(commercial.probableAttributedConnections)),
    metric("Missatges", formatter.format(commercial.messages)),
    metric("Leads", formatter.format(commercial.leads)),
    metric("Reunions", formatter.format(commercial.meetings)),
    metric("Pressupostos", formatter.format(commercial.proposals)),
    metric("Oportunitats", formatter.format(commercial.opportunities))
  );
  setText("attributionNote", commercial.attributionNote);

  const temporal = byId("temporalComparison");
  temporal.innerHTML = "";
  for (const item of data.weeklyComparisons) {
    const node = card("temporal-card");
    node.innerHTML = `<div><strong>${item.period}</strong><p>${item.reading}</p></div><div class="temporal-numbers"><span>${formatter.format(item.impressions)} impressions</span><span>${formatter.format(item.comments)} comentaris</span><span>${formatter.format(item.profileViews)} visites perfil</span></div>`;
    temporal.appendChild(node);
  }

  const instagram = byId("instagramSummary");
  instagram.innerHTML = "";
  instagram.append(
    metric("Publicacions", formatter.format(data.instagram.posts)),
    metric("Visualitzacions", formatter.format(data.instagram.views)),
    metric("M'agrada", formatter.format(data.instagram.reactions)),
    metric("Millor abast", data.instagram.bestReach),
    metric("Millor interès relatiu", data.instagram.bestRelativeEngagement),
    metric("Facebook empresa", data.instagram.facebookBusinessStatus === "pending" ? "Mètriques pendents" : "Dades disponibles")
  );
  setText("instagramWarning", data.instagram.warning);

  const signals = byId("marketSignals");
  signals.innerHTML = "";
  for (const item of data.marketSignals) {
    const node = card("signal-card");
    node.innerHTML = `<div><span>${item.signalType.replaceAll("_", " ")}</span><strong>${item.affectedTopic}</strong></div><p>${item.description}</p><em>${item.editorialImplication}</em>`;
    signals.appendChild(node);
  }

  const states = byId("dataStates");
  states.innerHTML = '<strong>Estat de les dades</strong>';
  for (const item of data.dataStates) states.append(chip(`${item.sourceType}: ${item.count}`));
  states.append(chip(`Baseline: ${data.dataQuality.baselineContentId}`));
  states.append(chip(`Pendents: ${data.dataQuality.pendingContentIds.join(", ") || "cap"}`));
  for (const conflict of data.dataQuality.conflicts) states.append(chip(`Conflicte ${conflict.contentId}`));

  const scores = byId("contentScores");
  scores.innerHTML = "";
  for (const item of data.scoredContent) {
    const node = card("score-row");
    const snapshotPeriods = item.snapshots.map((snapshot) => snapshot.snapshotLabel || snapshot.period).join(" · ") || "sense captures";
    node.innerHTML =
      `<div><span>${item.id} · ${item.platform} · ${item.sourceType}</span><strong>${item.title}</strong><p>${item.score.explanation}</p></div>` +
      `<div class="score-main"><strong>${item.score.total}/100</strong><span>${item.score.confidence.replaceAll("_", " ")}</span><span>${item.score.comparablePosts} comparables</span><span>${snapshotPeriods}</span></div>` +
      `<div class="score-breakdown"><span>Abast ${Math.round(item.score.breakdown.reach)}</span><span>Conversa ${Math.round(item.score.breakdown.conversation)}</span><span>Perfil ${Math.round(item.score.breakdown.profileInterest)}</span><span>Decisors ${Math.round(item.score.breakdown.decisionMaker)}</span><span>Comercial ${Math.round(item.score.breakdown.commercialSignal)}</span><span>Mostra ${Math.round(item.score.breakdown.sampleConfidence)}</span></div>`;
    scores.appendChild(node);
  }
}

function renderExecutiveReading(items) {
  const target = byId("executiveReading");
  target.innerHTML = "";
  for (const item of items.slice(0, 4)) {
    const node = document.createElement("li");
    node.textContent = item;
    target.appendChild(node);
  }
}

function recommendationDetail(item) {
  const imageLink = item.imageAsset
    ? '<a class="asset-link" href="' + item.imageAsset + '" target="_blank" rel="noreferrer">Obrir PNG proposat</a>'
    : '<span class="asset-pending">Imatge pendent de generar amb el prompt visual</span>';
  const metrics = (item.metricsToTrack || []).map((value) => "<span>" + value + "</span>").join("");
  const articleAction = item.expandToArticle
    ? '<button class="article-action" type="button">Ampliar a article</button><span class="article-action-note" hidden>Aquesta ampliació només es prepararà després d\'aprovar-la.</span>'
    : "";
  return (
    '<div class="brief"><strong>Text del post</strong><p>' + item.postCopy + "</p></div>" +
    '<div class="brief-grid"><div class="brief"><strong>Millor moment per publicar</strong><p>' + item.bestPublishTime +
    '</p></div><div class="brief"><strong>Estat</strong><p>' + statusLabel(item.publicationStatus) + "</p></div></div>" +
    '<div class="brief"><strong>Imatge recomanada</strong><p>' + item.visualBrief + "</p>" + imageLink + "</div>" +
    '<div class="brief"><strong>Prompt visual premium</strong><p>' + item.imagePrompt + "</p></div>" +
    '<div class="funnel-grid"><div><span>Client objectiu</span><strong>' + item.targetCustomer +
    '</strong></div><div><span>Problema concret</span><strong>' + item.concreteProblem +
    '</strong></div><div><span>Funnel</span><strong>' + item.funnelStage +
    '</strong></div><div><span>Objectiu únic</span><strong>' + item.singleObjective +
    '</strong></div><div><span>Conseqüència</span><strong>' + item.businessConsequence +
    '</strong></div><div><span>Prova</span><strong>' + item.proofOrExample + "</strong></div></div>" +
    '<div class="brief"><strong>Què mesurarem després</strong><div class="metric-tags">' + metrics + "</div></div>" +
    articleAction +
    '<div class="footer-line"><span>' + item.displayChannel + " · " + item.displayFormat +
    "</span><strong>Dificultat " + effortLabel(item.effort) + "</strong></div>"
  );
}

function renderRecommendations(items) {
  const target = byId("recommendations");
  target.innerHTML = "";

  for (const [index, item] of items.entries()) {
    const node = card("recommendation");
    const recommended = item.recommended ? " · Recomanada" : "";
    const priorityReason = item.recommended ? '<p class="why-recommended">' + item.whyRecommended + "</p>" : "";
    const heading = '<div class="option-label">Opció ' + (index + 1) + recommended +
      '</div><div><h3>' + item.title + '</h3><p>' + item.reason + "</p>" + priorityReason + "</div>";
    node.innerHTML = index === 0
      ? heading + recommendationDetail(item)
      : '<details class="idea-details"><summary><span>' + heading +
        '<span class="idea-summary-meta">' + item.singleObjective + ' · ' + item.funnelStage +
        '</span><span class="detail-action">Veure detall</span></span></summary>' + recommendationDetail(item) + "</details>";
    target.appendChild(node);
  }

  for (const button of target.querySelectorAll(".article-action")) {
    button.addEventListener("click", () => {
      const note = button.nextElementSibling;
      note.hidden = !note.hidden;
    });
  }
}

function distributionLabel(value) {
  const labels = {
    publish_now: "Publicar ara",
    adapt_and_publish: "Adaptar i publicar",
    reuse_and_publish: "Reutilitzar i publicar",
    not_recommended: "No recomanat"
  };
  return labels[value] || "Publicar";
}

function renderSocialDistribution(items) {
  const target = byId("socialDistribution");
  const otherTarget = byId("otherChannels");
  target.innerHTML = "";
  otherTarget.innerHTML = "";

  for (const item of items) {
    const node = card("channel-card");
    const metrics = (item.metricsToTrack || []).map((value) => "<span>" + value + "</span>").join("");
    node.innerHTML =
      '<div class="channel-card-header"><div><strong>' +
      item.label +
      '</strong><span>' +
      distributionLabel(item.recommendation) +
      '</span></div><em>' +
      item.publishTime +
      "</em></div>" +
      '<div class="channel-reason"><span>' + item.reason + "</span></div>" +
      '<div class="channel-meta"><span>' +
      item.format +
      '</span><span>' +
      statusLabel(item.status) +
      "</span></div>" +
      '<p>' +
      item.adaptation +
      "</p>" +
      '<div class="coherence-rule"><strong>Coherència</strong><p>' +
      item.coherenceRule +
      "</p></div>" +
      '<div class="metric-tags">' +
      metrics +
      "</div>";
    (item.channel === "linkedin" || item.channel === "meta" ? target : otherTarget).appendChild(node);
  }
}

function renderSimpleList(id, items, mapper) {
  const target = byId(id);
  target.innerHTML = "";
  for (const item of items) {
    const node = card("mini-card");
    node.innerHTML = mapper(item);
    target.appendChild(node);
  }
}

function renderLinkedInStart(data) {
  setText("linkedinStatus", data.posts.length + " publicacions registrades");
  setText("linkedinReason", data.reason);
  setText(
    "requiredMetrics",
    data.metricsComplete
      ? "Mètriques principals carregades. Leads i reunions marcats a 0."
      : `${data.nextStep} Camps: ${data.requiredMetrics.join(", ")}`
  );

  const target = byId("linkedinPosts");
  target.innerHTML = "";
  for (const post of data.posts) {
    const node = card("url-card");
    node.innerHTML =
      "<div><strong>" +
      (post.title || post.topic.replaceAll("-", " ")) +
      `</strong><small>${post.id} · ${post.sourceType} · ${post.snapshots} captures</small></div><span>` +
      post.status.replaceAll("_", " ") +
      "</span>";
    target.appendChild(node);
  }
}

function render(report) {
  setText("period", report.period);
  setText("nextAction", report.decision.nextAction);
  setText("decisionJustification", report.decision.justification);
  setText("recommendationLevel", report.decision.recommendationLevel[0].toUpperCase() + report.decision.recommendationLevel.slice(1));
  setText("confidence", confidenceLabel(report));
  setText("comparablePosts", formatter.format(report.decision.comparablePosts));
  setText("publishDate", report.decision.publishDate);
  setText("decisionChannels", report.decision.channels.join(" + "));
  const temporalBadge = byId("temporalBadge");
  temporalBadge.textContent = report.decision.temporalContext || "";
  temporalBadge.hidden = !report.decision.temporalContext;
  setText("confidenceNote", report.decision.confidenceNote);
  setText("businessObjective", report.businessObjective);
  setText("strategyQuarter", report.strategy.quarterly);
  setText("strategyMonth", report.strategy.monthly);
  setText("strategyPublication", report.strategy.publication);
  setText("mode", report.technicalStatus.mode);
  setText("dataSource", report.technicalStatus.dataSource);
  setText("workflows", report.technicalStatus.n8nWorkflowsValidated + " validats");
  setText("credentials", report.technicalStatus.credentialsRequiredNow ? "Pendents" : "No requerides ara");
  setText("chatStatus", report.technicalStatus.chatEnabled ? `${report.technicalStatus.chatProvider} actiu` : "Desactivat");

  renderRealIntelligence(report.realIntelligence);
  renderExecutiveReading(report.executiveReading || [report.executiveSummary]);
  renderRecommendations(report.recommendations);
  renderSocialDistribution(report.socialDistribution || []);
  renderSimpleList(
    "formats",
    report.formatInsights,
    (item) =>
      "<div><strong>" +
      item.format +
      "</strong><p>" +
      item.recommendation +
      '</p></div><span class="score">' +
      item.score +
      "</span>"
  );
  renderSimpleList(
    "calendar",
    report.calendar,
    (item) =>
      "<div><strong>" +
      item.day +
      "</strong><p>" +
      item.title +
      '</p><span class="muted">' +
      item.channel +
      " · " +
      item.format +
      "</span></div>"
  );
}

function appendChatMessage(role, content) {
  const node = document.createElement("article");
  node.className = `chat-message ${role}`;
  node.textContent = content;
  byId("chatMessages").appendChild(node);
  node.scrollIntoView({ block: "nearest" });
}

function setChatOpen(open) {
  byId("contentDirector").classList.toggle("open", open);
  byId("contentDirector").setAttribute("aria-hidden", String(!open));
  byId("chatBackdrop").hidden = !open;
  if (open) byId("contentDirectorInput").focus();
}

async function askContentDirector(question) {
  const text = question.trim();
  if (!text) return;
  appendChatMessage("user", text);
  const submit = byId("contentDirectorForm").querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Pensant...";
  try {
    const response = await fetch("/api/content-director", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No s'ha pogut obtenir una resposta");
    appendChatMessage("assistant", result.reply);
  } catch (error) {
    appendChatMessage("assistant error", error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Enviar";
  }
}

function setupContentDirector() {
  byId("openContentDirector").addEventListener("click", () => setChatOpen(true));
  byId("closeContentDirector").addEventListener("click", () => setChatOpen(false));
  byId("chatBackdrop").addEventListener("click", () => setChatOpen(false));
  for (const button of document.querySelectorAll("[data-chat-question]")) {
    button.addEventListener("click", () => askContentDirector(button.dataset.chatQuestion));
  }
  byId("contentDirectorForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = byId("contentDirectorInput");
    const question = input.value;
    input.value = "";
    await askContentDirector(question);
  });
}

function setupTabs() {
  for (const button of document.querySelectorAll(".tab-button")) {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.toggle("active", item === button));
      byId("clientPanel").classList.toggle("active", tab === "client");
      byId("adminPanel").classList.toggle("active", tab === "admin");
      byId("agentsPanel").classList.toggle("active", tab === "agents");
    });
  }
}

function agentStatusLabel(status) {
  return {
    started: "En curs",
    succeeded: "Correcte",
    failed: "Error",
    warning: "Avís",
    waiting: "En espera"
  }[status] || status;
}

function renderAgentEvent(event) {
  const node = card(`agent-event severity-${event.severity}`);
  const header = document.createElement("div");
  header.className = "agent-event-header";
  const identity = document.createElement("div");
  const agent = document.createElement("strong");
  agent.textContent = event.agentName;
  const workflow = document.createElement("span");
  workflow.textContent = event.workflowName;
  identity.append(agent, workflow);
  const badge = document.createElement("span");
  badge.className = `agent-status status-${event.status}`;
  badge.textContent = agentStatusLabel(event.status);
  header.append(identity, badge);

  const title = document.createElement("h3");
  title.textContent = event.title;
  const summary = document.createElement("p");
  summary.textContent = event.summary;
  const footer = document.createElement("div");
  footer.className = "agent-event-footer";
  const time = document.createElement("time");
  time.dateTime = event.occurredAt;
  time.textContent = new Intl.DateTimeFormat("ca-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt));
  const meta = document.createElement("span");
  meta.textContent = event.retryCount > 0 ? `${event.retryCount} reintent(s)` : event.correlationId;
  footer.append(time, meta);
  if (event.actionUrl) {
    const link = document.createElement("a");
    link.href = event.actionUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Obrir execució";
    footer.appendChild(link);
  }
  node.append(header, title, summary, footer);
  return node;
}

function renderAgentActivity(activity) {
  setText("agentActivityUpdated", `Actualitzat ${new Intl.DateTimeFormat("ca-ES", { timeStyle: "short" }).format(new Date(activity.generatedAt))}`);
  const summary = byId("agentSummary");
  summary.innerHTML = "";
  for (const [label, value, tone] of [
    ["Agents", activity.summary.agents, "neutral"],
    ["Execucions", activity.summary.executions, "neutral"],
    ["Correctes", activity.summary.succeeded, "success"],
    ["En curs", activity.summary.running, "info"],
    ["Errors", activity.summary.failed, "danger"],
    ["Requereixen atenció", activity.summary.attention, "warning"]
  ]) {
    const node = card(`agent-kpi tone-${tone}`);
    const number = document.createElement("strong");
    number.textContent = formatter.format(value);
    const text = document.createElement("span");
    text.textContent = label;
    node.append(number, text);
    summary.appendChild(node);
  }

  for (const [id, events, emptyText] of [
    ["agentImportant", activity.important, "No hi ha avisos importants."],
    ["agentRecent", activity.recent, "Encara no hi ha activitat registrada."]
  ]) {
    const target = byId(id);
    target.innerHTML = "";
    if (events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "agent-empty";
      empty.textContent = emptyText;
      target.appendChild(empty);
    } else {
      for (const event of events) target.appendChild(renderAgentEvent(event));
    }
  }
}

function setupManualMetricsForm() {
  const form = byId("manualMetricsForm");
  const status = byId("manualFormStatus");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "Desant...";
    const data = Object.fromEntries(new FormData(form).entries());
    for (const field of ["impressions", "views", "reach", "reactions", "comments", "shares", "saves", "sends", "profileViews", "followers", "invites", "leads", "meetings"]) {
      data[field] = Number(data[field] || 0);
    }
    try {
      const response = await fetch("/api/manual-metrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No s'ha pogut desar");
      status.textContent = `Captura desada: ${result.entry.id}`;
      form.reset();
      setDefaultCaptureTime();
      await loadReport();
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

function setDefaultCaptureTime() {
  const input = byId("manualMetricsForm").elements.namedItem("capturedAt");
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  input.value = now.toISOString().slice(0, 16);
}

async function loadReport() {
  const button = byId("refreshReport");
  button.disabled = true;
  button.textContent = "Actualitzant...";
  try {
    const [response, linkedinResponse, activityResponse] = await Promise.all([
      fetch("/api/client-report"),
      fetch("/api/linkedin-start"),
      fetch("/api/agent-activity")
    ]);
    if (!response.ok) throw new Error("No s'ha pogut carregar l'informe");
    if (!linkedinResponse.ok) throw new Error("No s'ha pogut carregar LinkedIn");
    if (!activityResponse.ok) throw new Error("No s'ha pogut carregar l'activitat dels agents");
    render(await response.json());
    renderLinkedInStart(await linkedinResponse.json());
    renderAgentActivity(await activityResponse.json());
  } finally {
    button.disabled = false;
    button.textContent = "Actualitzar informe";
  }
}

setupTabs();
setupManualMetricsForm();
setupContentDirector();
setDefaultCaptureTime();
byId("refreshReport").addEventListener("click", loadReport);
loadReport().catch((error) => {
  setText("nextAction", "No s'ha pogut carregar l'informe");
  setText("decisionJustification", error.message);
});
