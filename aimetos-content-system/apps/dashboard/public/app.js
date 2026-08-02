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
    metric("Millor interès relatiu", data.instagram.bestRelativeEngagement)
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

  const scores = byId("contentScores");
  scores.innerHTML = "";
  for (const item of data.scoredContent) {
    const node = card("score-row");
    const snapshotPeriods = item.snapshots.map((snapshot) => snapshot.period).join(" · ") || "sense captures";
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
    data.metricsComplete ? "Mètriques principals carregades. Leads i reunions marcats a 0." : `Pendent LI-06 · camps: ${data.requiredMetrics.join(", ")}`
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
  setText("confidenceNote", report.decision.confidenceNote);
  setText("businessObjective", report.businessObjective);
  setText("strategyQuarter", report.strategy.quarterly);
  setText("strategyMonth", report.strategy.monthly);
  setText("strategyPublication", report.strategy.publication);
  setText("mode", report.technicalStatus.mode);
  setText("dataSource", report.technicalStatus.dataSource);
  setText("workflows", report.technicalStatus.n8nWorkflowsValidated + " validats");
  setText("credentials", report.technicalStatus.credentialsRequiredNow ? "Pendents" : "No requerides ara");

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

function setupTabs() {
  for (const button of document.querySelectorAll(".tab-button")) {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.toggle("active", item === button));
      byId("clientPanel").classList.toggle("active", tab === "client");
      byId("adminPanel").classList.toggle("active", tab === "admin");
    });
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
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

async function loadReport() {
  const button = byId("refreshReport");
  button.disabled = true;
  button.textContent = "Actualitzant...";
  try {
    const [response, linkedinResponse] = await Promise.all([fetch("/api/client-report"), fetch("/api/linkedin-start")]);
    if (!response.ok) throw new Error("No s'ha pogut carregar l'informe");
    if (!linkedinResponse.ok) throw new Error("No s'ha pogut carregar LinkedIn");
    render(await response.json());
    renderLinkedInStart(await linkedinResponse.json());
  } finally {
    button.disabled = false;
    button.textContent = "Actualitzar informe";
  }
}

setupTabs();
setupManualMetricsForm();
byId("refreshReport").addEventListener("click", loadReport);
loadReport().catch((error) => {
  setText("nextAction", "No s'ha pogut carregar l'informe");
  setText("decisionJustification", error.message);
});
