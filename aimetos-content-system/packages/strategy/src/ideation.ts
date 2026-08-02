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

export function editorialScore(idea: ContentIdea): number {
  return Number((idea.globalScore + idea.diversityBonus - idea.repetitionPenalty).toFixed(2));
}

export function generateFiveIdeas(analysis: PerformanceAnalysis, scenario: MockScenario): ContentIdea[] {
  const lowQuality = scenario === "no_qualified_ideas";
  const modifier = lowQuality ? -2 : analysis.weightedScore >= 4 ? 0.4 : 0;
  const ideas = [
    withScore({
      id: "idea_integrations_data",
      title: "Tu empresa no necesita otra herramienta. Necesita que las que ya tiene se hablen.",
      objective: "Demostrar el valor empresarial de las integraciones antes de añadir más herramientas o IA.",
      audience: "Gerentes y responsables de operaciones de empresas B2B con varias herramientas desconectadas.",
      pain: "La misma información existe en CRM, Excel, correo y WhatsApp, y se actualiza manualmente.",
      value: "Una forma clara de detectar dónde conectar el proceso antes de comprar otra herramienta.",
      mainMessage: "Antes de añadir IA, conecta el proceso que ya existe.",
      cta: "¿En cuántos sitios vive hoy el mismo dato en tu empresa?",
      priority: 1,
      justification: "Introduce un problema comercial distinto y evita repetir criterio humano, agentes, llamadas o conocimiento crítico.",
      relatedService: "Integraciones y automatización de procesos",
      primaryChannel: "linkedin",
      estimatedEffort: 2,
      commercialImpact: score(5 + modifier),
      differentiation: score(4.6 + modifier),
      authority: score(4.6 + modifier),
      reusability: score(5 + modifier),
      category: "Estrategia",
      language: "es",
      funnelStage: "MOFU",
      businessConsequence: "Errores, tiempo administrativo, seguimientos perdidos y falta de una fuente única de verdad.",
      proofOrExample: "Un mismo dato de cliente actualizado manualmente en CRM, Excel, correo y WhatsApp.",
      editorialFamily: "integracions_i_dades",
      appearancesLast4Posts: 0,
      repetitionPenalty: 0,
      diversityBonus: 0.8,
      expandToArticle: true
    }),
    withScore({
      id: "idea_n8n_failures",
      title: "Los 7 errores que vuelven frágil una automatización",
      objective: "Educar sobre robustez operativa.",
      audience: "Responsables técnicos y operativos con workflows manuales o semiautomatizados.",
      pain: "Los workflows funcionan en una demo, pero fallan cuando reciben datos incompletos.",
      value: "Criterios prácticos de reintentos, logs, validación y responsabilidad.",
      mainMessage: "Automatizar no es unir nodos: es diseñar un sistema que resista errores.",
      cta: "¿Qué ocurre hoy cuando falla uno de tus procesos automáticos?",
      priority: 2,
      justification: "Aporta demostración técnica y equilibra la siguiente pieza de decisión empresarial.",
      relatedService: "Automatizaciones robustas",
      primaryChannel: "linkedin",
      estimatedEffort: 2,
      commercialImpact: score(4 + modifier),
      differentiation: score(5 + modifier),
      authority: score(5 + modifier),
      reusability: score(5 + modifier),
      category: "Error habitual",
      language: "es",
      funnelStage: "MOFU",
      businessConsequence: "Un workflow frágil genera incidencias, retrabajo y dependencia técnica.",
      proofOrExample: "Ejemplo operativo con error, registro y reintento seguro.",
      editorialFamily: "robustesa_tecnica",
      lastUsedAt: "2026-07-28",
      appearancesLast4Posts: 1,
      repetitionPenalty: 0.25,
      diversityBonus: 0.25,
      expandToArticle: true
    }),
    withScore({
      id: "idea_dashboard_decisions",
      title: "Un dashboard no sirve si no cambia ninguna decisión",
      objective: "Reposicionar los dashboards como sistemas de decisión.",
      audience: "Gerencia y operaciones con informes manuales.",
      pain: "Miden muchas variables, pero actúan tarde y sin responsables claros.",
      value: "Tres criterios para pasar de informe a sistema de alertas y decisiones.",
      mainMessage: "La métrica importante es la que activa una decisión clara.",
      cta: "¿Qué decisión debería activar hoy tu dashboard?",
      priority: 3,
      justification: "Es relevante, pero ya se ha tratado recientemente y conviene abrir antes la línea de integraciones.",
      relatedService: "Dashboards",
      primaryChannel: "linkedin",
      estimatedEffort: 2,
      commercialImpact: score(4 + modifier),
      differentiation: score(4 + modifier),
      authority: score(4 + modifier),
      reusability: score(5 + modifier),
      category: "Opinio tecnica",
      language: "es",
      funnelStage: "TOFU",
      businessConsequence: "Medir sin activar decisiones consume tiempo y retrasa las correcciones.",
      proofOrExample: "Tres preguntas que convierten una métrica en una decisión.",
      editorialFamily: "dashboards_i_mesura",
      lastUsedAt: "2026-07-16",
      appearancesLast4Posts: 0,
      repetitionPenalty: 0,
      diversityBonus: 0.35,
      expandToArticle: true
    }),
    withScore({
      id: "idea_ai_criterion",
      title: "La IA lo dijo. Nadie lo cuestionó.",
      objective: "Reforzar el criterio humano y la gobernanza en decisiones asistidas por IA.",
      audience: "Gerentes y responsables de operaciones que incorporan IA a procesos internos.",
      pain: "Aceptan resultados automáticos sin saber cómo revisarlos ni quién responde cuando fallan.",
      value: "Un criterio simple para decidir qué puede sugerir la IA y qué debe validar una persona.",
      mainMessage: "La IA puede acelerar una decisión, pero no eliminar la responsabilidad.",
      cta: "¿Qué decisiones no delegarías nunca por completo a una IA?",
      priority: 4,
      justification: "Buen ángulo comercial, pero las últimas publicaciones ya han trabajado criterio humano y modelo híbrido.",
      relatedService: "IA aplicada y gobernanza",
      primaryChannel: "linkedin",
      estimatedEffort: 2,
      commercialImpact: score(5 + modifier),
      differentiation: score(5 + modifier),
      authority: score(5 + modifier),
      reusability: score(4 + modifier),
      category: "Estrategia",
      language: "es",
      funnelStage: "MOFU",
      businessConsequence: "Una decisión automática no cuestionada puede escalar errores operativos y de negocio.",
      proofOrExample: "Tres preguntas de validación antes de aceptar una recomendación automática.",
      editorialFamily: "criteri_huma_i_governanca",
      lastUsedAt: "2026-07-30",
      appearancesLast4Posts: 2,
      repetitionPenalty: 1.25,
      diversityBonus: 0,
      expandToArticle: false
    }),
    withScore({
      id: "idea_whatsapp_agent",
      title: "Cuándo un agente de WhatsApp mejora ventas y cuándo añade ruido",
      objective: "Separar casos de uso reales de la moda.",
      audience: "Empresas de servicios con consultas repetitivas y seguimiento comercial.",
      pain: "Tienen conversaciones dispersas y poca trazabilidad del lead.",
      value: "Criterios para decidir si hace falta un agente, un CRM o rediseñar el proceso.",
      mainMessage: "El canal no arregla un proceso comercial desordenado.",
      cta: "¿Dónde se pierde hoy el seguimiento de tus conversaciones?",
      priority: 5,
      justification: "Tiene valor comercial, pero agentes, leads y llamadas ya aparecen demasiado en la secuencia reciente.",
      relatedService: "Agentes y canales",
      primaryChannel: "linkedin",
      estimatedEffort: 3,
      commercialImpact: score(4 + modifier),
      differentiation: score(4 + modifier),
      authority: score(4 + modifier),
      reusability: score(4 + modifier),
      category: "Comparativa",
      language: "es",
      funnelStage: "MOFU",
      businessConsequence: "Añadir un agente a un proceso desordenado dispersa todavía más los leads.",
      proofOrExample: "Árbol de decisión entre agente, CRM y rediseño del proceso.",
      editorialFamily: "agents_i_canals",
      lastUsedAt: "2026-07-23",
      appearancesLast4Posts: 2,
      repetitionPenalty: 1.5,
      diversityBonus: 0,
      expandToArticle: false
    })
  ];
  return ideas.map((idea) => ({ ...idea, globalScore: averageScore(idea) }));
}

export function selectBestIdeas(ideas: ContentIdea[], config: RuntimeConfig): ContentIdea[] {
  return ideas
    .filter(
      (idea) =>
        idea.globalScore >= config.thresholds.minAverageScore &&
        idea.commercialImpact >= config.thresholds.minCommercialImpact &&
        idea.appearancesLast4Posts <= 2
    )
    .sort((a, b) => editorialScore(b) - editorialScore(a) || b.commercialImpact - a.commercialImpact)
    .slice(0, 3)
    .map((idea, index) => ({
      ...idea,
      priority: index + 1,
      status: "SELECTED"
    }));
}
