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
    validated: "Validat"
  };
  return labels[status] || "Pendent de publicar";
}

function confidenceLabel(report) {
  return report.decision.confidenceLabel || (report.decision.confidence === "high" ? "Confiança inicial alta" : "Hipòtesi inicial");
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

function renderRecommendations(items) {
  const target = byId("recommendations");
  target.innerHTML = "";

  for (const [index, item] of items.entries()) {
    const node = card("recommendation");
    const recommended = item.recommended ? " · Recomanada" : "";
    const why = item.recommended ? '<p class="why-recommended">' + item.whyRecommended + "</p>" : "";
    const imageAsset = item.imageAsset || "/assets/linkedin-option-1-roi-agent-veu.png";
    const metrics = (item.metricsToTrack || []).map((value) => "<span>" + value + "</span>").join("");
    node.innerHTML =
      '<div class="option-label">Opció ' +
      (index + 1) +
      recommended +
      "</div><div><h3>" +
      item.title +
      "</h3><p>" +
      item.reason +
      "</p>" +
      why +
      "</div>" +
      '<div class="brief"><strong>Text del post</strong><p>' +
      item.postCopy +
      "</p></div>" +
      '<div class="brief-grid">' +
      '<div class="brief"><strong>Millor moment per publicar</strong><p>' +
      item.bestPublishTime +
      "</p></div>" +
      '<div class="brief"><strong>Estat</strong><p>' +
      statusLabel(item.publicationStatus) +
      "</p></div>" +
      "</div>" +
      '<div class="brief"><strong>Imatge recomanada</strong><p>' +
      item.visualBrief +
      '</p><a class="asset-link" href="' +
      imageAsset +
      '" target="_blank" rel="noreferrer">Obrir PNG proposat</a></div>' +
      '<div class="brief"><strong>Prompt visual premium</strong><p>' +
      item.imagePrompt +
      "</p></div>" +
      '<div class="brief"><strong>Què mesurarem després</strong><div class="metric-tags">' +
      metrics +
      "</div></div>" +
      '<div class="admin-only"><div class="brief"><strong>Hook intern</strong><p>' +
      item.hook +
      '</p></div><div class="brief"><strong>Peça a produir</strong><p>' +
      item.productionBrief +
      "</p></div></div>" +
      '<div class="footer-line"><span>' +
      item.displayChannel +
      " · " +
      item.displayFormat +
      "</span><strong>Dificultat " +
      item.effort +
      "</strong></div>";
    target.appendChild(node);
  }
}

function distributionLabel(value) {
  const labels = {
    publish_now: "Publicar ara",
    adapt_and_publish: "Adaptar i publicar",
    reuse_and_publish: "Reutilitzar i publicar"
  };
  return labels[value] || "Publicar";
}

function renderSocialDistribution(items) {
  const target = byId("socialDistribution");
  target.innerHTML = "";

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
    target.appendChild(node);
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
  setText("linkedinStatus", data.posts.length + " URLs registrades");
  setText("linkedinReason", data.reason);
  setText(
    "requiredMetrics",
    data.metricsComplete ? "Mètriques principals carregades. Leads i reunions marcats a 0." : data.requiredMetrics.join(", ")
  );

  const target = byId("linkedinPosts");
  target.innerHTML = "";
  for (const post of data.posts) {
    const node = card("url-card");
    node.innerHTML =
      "<div><strong>" +
      post.topic.replaceAll("-", " ") +
      '</strong><a href="' +
      post.url +
      '" target="_blank" rel="noreferrer">Obrir post</a></div><span>' +
      (data.metricsComplete ? "mètriques carregades" : post.status.replaceAll("_", " ")) +
      "</span>";
    target.appendChild(node);
  }
}

function render(report) {
  setText("period", report.period);
  setText("nextAction", report.decision.nextAction);
  setText("summary", report.executiveSummary);
  setText("bestFormat", report.decision.nextBestFormat);
  setText("bestChannel", report.decision.nextBestChannel);
  setText("confidence", confidenceLabel(report));
  setText("confidenceNote", report.decision.confidenceNote);
  setText("businessObjective", report.businessObjective);
  setText("strategyQuarter", report.strategy.quarterly);
  setText("strategyMonth", report.strategy.monthly);
  setText("strategyPublication", report.strategy.publication);
  setText("mode", report.technicalStatus.mode);
  setText("dataSource", report.technicalStatus.dataSource);
  setText("workflows", report.technicalStatus.n8nWorkflowsValidated + " validats");
  setText("credentials", report.technicalStatus.credentialsRequiredNow ? "Pendents" : "No requerides ara");

  renderTopContent(report.topContent);
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
byId("refreshReport").addEventListener("click", loadReport);
loadReport().catch((error) => {
  setText("nextAction", "No s'ha pogut carregar l'informe");
  setText("summary", error.message);
});
