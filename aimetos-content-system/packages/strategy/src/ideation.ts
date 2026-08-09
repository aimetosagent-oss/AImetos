import type { ContentIdea, MockScenario } from "../../shared/src/domain.ts";
import type { RuntimeConfig } from "../../config/src/env.ts";
import type { PerformanceAnalysis } from "../../analytics/src/performance.ts";
import { applyTemporalModifiers, type TemporalDecisionContext } from "./editorial-calendar.ts";

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
  return Number((idea.globalScore + idea.diversityBonus + idea.temporalBonus - idea.repetitionPenalty).toFixed(2));
}

export function generateFiveIdeas(
  analysis: PerformanceAnalysis,
  scenario: MockScenario,
  temporalContext?: TemporalDecisionContext
): ContentIdea[] {
  const lowQuality = scenario === "no_qualified_ideas";
  const modifier = lowQuality ? -2 : analysis.weightedScore >= 4 ? 0.4 : 0;
  const ideas = [
    withScore({
      id: "idea_august_process_stress",
      title: "Agosto es una prueba de estrés para tus procesos.",
      objective: "Hacer visible la fragilidad operativa que aparece durante las vacaciones.",
      audience: "Gerentes y responsables de operaciones de PYMEs y empresas B2B.",
      pain: "Durante las vacaciones aparecen aprobaciones detenidas, consultas sin propietario y tareas que nadie sabe continuar.",
      value: "Un criterio práctico para reforzar responsables, traspaso, documentación y alertas antes de automatizar.",
      mainMessage: "Si un proceso se frena porque alguien está de vacaciones, el problema no son las vacaciones.",
      cta: "¿Qué proceso se vuelve más lento en tu empresa cuando llega agosto?",
      priority: 1,
      justification: "Aprovecha un contexto temporal relevante para hablar de continuidad operativa sin repetir integraciones, agentes ni conocimiento crítico.",
      relatedService: "Procesos, operaciones y automatización",
      primaryChannel: "linkedin",
      estimatedEffort: 2,
      commercialImpact: score(5 + modifier),
      differentiation: score(4.4 + modifier),
      authority: score(4.5 + modifier),
      reusability: score(4.2 + modifier),
      category: "Estrategia",
      language: "es",
      funnelStage: "MOFU",
      businessConsequence: "Aprobaciones detenidas, consultas sin responsable, tareas bloqueadas y seguimientos dependientes de memoria.",
      proofOrExample: "Un proceso que se ralentiza cuando falta una persona revela una dependencia operativa real.",
      editorialFamily: "processes_operations",
      appearancesLast4Posts: 0,
      repetitionPenalty: 0,
      diversityBonus: 0.65,
      temporalBonus: 0,
      temporalContext: "Vacances d'agost",
      expiresAt: "2026-08-31T23:59:59+02:00",
      expandToArticle: false
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
      justification: "Aporta demostración técnica, pero el ángulo Error / Log / Retry tuvo una señal inicial baja en LI-05.",
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
      editorialFamily: "technical_robustness",
      lastUsedAt: "2026-07-28",
      appearancesLast4Posts: 1,
      repetitionPenalty: 0.35,
      diversityBonus: 0.2,
      temporalBonus: 0,
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
      justification: "Tiene buena calidad potencial de audiencia, pero ya se ha tratado recientemente.",
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
      editorialFamily: "dashboards_measurement",
      lastUsedAt: "2026-07-16",
      appearancesLast4Posts: 0,
      repetitionPenalty: 0,
      diversityBonus: 0.35,
      temporalBonus: 0,
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
      editorialFamily: "human_criterion_governance",
      lastUsedAt: "2026-07-30",
      appearancesLast4Posts: 2,
      repetitionPenalty: 1.25,
      diversityBonus: 0,
      temporalBonus: 0,
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
      editorialFamily: "agents_channels",
      lastUsedAt: "2026-07-23",
      appearancesLast4Posts: 2,
      repetitionPenalty: 1.5,
      diversityBonus: 0,
      temporalBonus: 0,
      expandToArticle: false
    })
  ];
  return ideas.map((idea) => applyTemporalModifiers({ ...idea, globalScore: averageScore(idea) }, temporalContext));
}

export function selectBestIdeas(ideas: ContentIdea[], config: RuntimeConfig, now = new Date()): ContentIdea[] {
  return ideas
    .filter(
      (idea) =>
        idea.globalScore >= config.thresholds.minAverageScore &&
        idea.commercialImpact >= config.thresholds.minCommercialImpact &&
        idea.appearancesLast4Posts <= 2 &&
        (!idea.expiresAt || now.getTime() <= Date.parse(idea.expiresAt))
    )
    .sort((a, b) => editorialScore(b) - editorialScore(a) || b.commercialImpact - a.commercialImpact)
    .slice(0, 3)
    .map((idea, index) => ({
      ...idea,
      priority: index + 1,
      status: "SELECTED"
    }));
}
