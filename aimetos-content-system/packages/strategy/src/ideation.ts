import type { ContentIdea, MockScenario } from "../../shared/src/domain.ts";
import type { RuntimeConfig } from "../../config/src/env.ts";
import type { PerformanceAnalysis } from "../../analytics/src/performance.ts";

function averageScore(idea: Pick<ContentIdea, "commercialImpact" | "differentiation" | "estimatedEffort" | "reusability" | "authority">): number {
  const ease = 6 - idea.estimatedEffort;
  return Number(((idea.commercialImpact + idea.differentiation + ease + idea.reusability + idea.authority) / 5).toFixed(2));
}

function score(value: number): number {
  return Math.min(5, Math.max(1, Number(value.toFixed(2))));
}

function withScore(idea: Omit<ContentIdea, "globalScore" | "status">): ContentIdea {
  return { ...idea, status: "DRAFT_IDEA", globalScore: averageScore(idea) };
}

export function generateFiveIdeas(analysis: PerformanceAnalysis, scenario: MockScenario): ContentIdea[] {
  const lowQuality = scenario === "no_qualified_ideas";
  const modifier = lowQuality ? -2 : analysis.weightedScore >= 4 ? 0.4 : 0;
  const ideas = [
    withScore({
      id: "idea_ai_criterion",
      title: "La IA ho va dir. Ningú no ho va qüestionar",
      objective: "Reforçar criteri humà i governança en decisions assistides per IA.",
      audience: "Gerents i responsables d'operacions que incorporen IA a processos interns.",
      pain: "Accepten resultats automàtics sense saber com revisar-los ni qui respon quan fallen.",
      value: "Un criteri simple per decidir què pot suggerir la IA i què ha de validar una persona.",
      mainMessage: "La IA pot accelerar una decisió, però no pot eliminar la responsabilitat ni la revisió humana.",
      cta: "Descarregar una checklist de validació humana",
      priority: 1,
      justification: "Connecta amb el senyal qualitatiu de criteri abans que tecnologia i obre una línia nova sense repetir agents de veu.",
      relatedService: "IA aplicada i governança",
      primaryChannel: "linkedin",
      estimatedEffort: 2,
      commercialImpact: score(5 + modifier),
      differentiation: score(5 + modifier),
      authority: score(5 + modifier),
      reusability: score(4 + modifier),
      category: "Estrategia",
      language: "ca",
      funnelStage: "MOFU",
      businessConsequence: "Una decisió automàtica no qüestionada pot escalar errors operatius i de negoci.",
      proofOrExample: "Tres preguntes de validació abans d'acceptar una recomanació automàtica."
    }),
    withScore({
      id: "idea_n8n_failures",
      title: "Els 7 errors que fan fragils les automatitzacions amb n8n",
      objective: "Educar sobre robustesa operativa.",
      audience: "Responsables tecnics i operatius amb workflows manuals o semi-automatitzats.",
      pain: "Els workflows funcionen en demo pero fallen quan hi ha dades incompletes.",
      value: "Criteris practics de retries, logs, validacio i ownership.",
      mainMessage: "Automatitzar no es unir nodes: es dissenyar un sistema que aguanti errors.",
      cta: "Revisar un workflow critic amb AImetos",
      priority: 2,
      justification: "Tema diferencial i molt reutilitzable per blog, LinkedIn i newsletter.",
      relatedService: "Automatitzacions amb n8n",
      primaryChannel: "blog",
      estimatedEffort: 2,
      commercialImpact: score(4 + modifier),
      differentiation: score(5 + modifier),
      authority: score(5 + modifier),
      reusability: score(5 + modifier),
      category: "Error habitual",
      language: "ca",
      funnelStage: "MOFU",
      businessConsequence: "Un workflow fràgil genera incidències, retraball i dependència tècnica.",
      proofOrExample: "Exemple operatiu amb error, registre i reintent segur."
    }),
    withScore({
      id: "idea_whatsapp_agent",
      title: "Quan un agent de WhatsApp millora vendes i quan nomes afegeix soroll",
      objective: "Separar casos d'us reals de moda.",
      audience: "Empreses de serveis amb consultes repetitives i seguiment comercial.",
      pain: "Tenen converses disperses i baixa traçabilitat del lead.",
      value: "Criteris per decidir si cal agent, CRM o redisseny de proces.",
      mainMessage: "El canal no arregla un proces comercial desordenat; l'agent ha de tancar el cercle.",
      cta: "Mapar el proces comercial actual",
      priority: 3,
      justification: "Apropa venda consultiva sense clickbait.",
      relatedService: "Agents de WhatsApp",
      primaryChannel: "linkedin",
      estimatedEffort: 3,
      commercialImpact: score(4 + modifier),
      differentiation: score(4 + modifier),
      authority: score(4 + modifier),
      reusability: score(4 + modifier),
      category: "Comparativa",
      language: "ca",
      funnelStage: "MOFU",
      businessConsequence: "Afegir un agent a un procés desordenat dispersa encara més els leads.",
      proofOrExample: "Arbre de decisió entre agent, CRM i redisseny de procés."
    }),
    withScore({
      id: "idea_dashboard_decisions",
      title: "Un dashboard no serveix si no canvia cap decisio",
      objective: "Reposicionar dashboards com sistemes de decisio.",
      audience: "Gerencia i operacions amb informes manuals.",
      pain: "Mesuren molt pero actuen tard.",
      value: "Checklist per passar d'informe a sistema d'alertes i decisions.",
      mainMessage: "La metrica important es la que activa una decisio clara.",
      cta: "Identificar les 5 decisions que hauria d'activar el dashboard",
      priority: 4,
      justification: "Reforça autoritat en dashboards i automatitzacio interna.",
      relatedService: "Dashboards",
      primaryChannel: "blog",
      estimatedEffort: 2,
      commercialImpact: score(4 + modifier),
      differentiation: score(4 + modifier),
      authority: score(4 + modifier),
      reusability: score(5 + modifier),
      category: "Opinio tecnica",
      language: "ca",
      funnelStage: "TOFU",
      businessConsequence: "Mesurar sense activar decisions consumeix temps i retarda les correccions.",
      proofOrExample: "Tres preguntes que converteixen una mètrica en una decisió."
    }),
    withScore({
      id: "idea_crm_ai",
      title: "CRM amb IA: que automatitzar abans d'afegir un agent",
      objective: "Crear confiança amb una seqüencia d'implantacio prudent.",
      audience: "Equips comercials B2B amb CRM infrautilitzat.",
      pain: "Volen IA pero encara perden seguiments basics.",
      value: "Ordre d'implantacio: dades, camps, alertes, workflows, agent.",
      mainMessage: "La IA comercial funciona quan el CRM ja captura el proces real.",
      cta: "Fer una revisio de CRM i seguiment",
      priority: 5,
      justification: "Genera leads qualificats amb una promesa realista.",
      relatedService: "CRM i IA aplicada",
      primaryChannel: "newsletter",
      estimatedEffort: 3,
      commercialImpact: score(4 + modifier),
      differentiation: score(3.5 + modifier),
      authority: score(4 + modifier),
      reusability: score(4 + modifier),
      category: "Estrategia",
      language: "ca",
      funnelStage: "MOFU",
      businessConsequence: "Aplicar IA sobre dades i seguiments incomplets accelera els errors comercials.",
      proofOrExample: "Seqüència dades, camps, alertes, workflows i agent."
    })
  ];
  return ideas.map((idea) => ({ ...idea, globalScore: averageScore(idea) }));
}

export function selectBestIdeas(ideas: ContentIdea[], config: RuntimeConfig): ContentIdea[] {
  return ideas
    .filter(
      (idea) =>
        idea.globalScore >= config.thresholds.minAverageScore &&
        idea.commercialImpact >= config.thresholds.minCommercialImpact
    )
    .sort((a, b) => b.globalScore - a.globalScore || b.commercialImpact - a.commercialImpact)
    .slice(0, 3)
    .map((idea, index) => ({
      ...idea,
      priority: index + 1,
      status: "SELECTED"
    }));
}
