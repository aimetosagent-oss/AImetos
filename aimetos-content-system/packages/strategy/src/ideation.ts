import type { ContentIdea, MockScenario, RealContentRecord } from "../../shared/src/domain.ts";
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
  temporalContext?: TemporalDecisionContext,
  records: RealContentRecord[] = []
): ContentIdea[] {
  const lowQuality = scenario === "no_qualified_ideas";
  const modifier = lowQuality ? -2 : analysis.weightedScore >= 4 ? 0.4 : 0;
  const ideas = [
    withScore({
      id: "idea_measure_hidden_losses",
      title: "Antes de automatizar un proceso, mide estas 3 pérdidas invisibles.",
      objective: "Convertir el criterio antes que tecnología en un diagnóstico empresarial accionable.",
      audience: "Gerentes y responsables de operaciones de PYMEs y empresas B2B.",
      pain: "Muchos procesos se automatizan sin medir cuánto tiempo, retrabajo y espera están perdiendo realmente.",
      value: "Un diagnóstico de tres pérdidas: tiempo operativo, retrabajo por errores y espera entre responsables.",
      mainMessage: "Antes de elegir una herramienta, mide dónde se pierde tiempo, dónde se repite trabajo y dónde el proceso queda esperando.",
      cta: "¿Cuál de estas tres pérdidas pesa más hoy en uno de tus procesos?",
      priority: 1,
      justification: "Recoge el patrón que mejor funciona —criterio antes que tecnología—, lo convierte en una herramienta práctica y evita repetir vacaciones, continuidad y dashboards.",
      relatedService: "Diagnóstico y automatización de procesos",
      primaryChannel: "linkedin",
      estimatedEffort: 2,
      commercialImpact: score(5 + modifier),
      differentiation: score(4.7 + modifier),
      authority: score(4.8 + modifier),
      reusability: score(4.8 + modifier),
      category: "Estrategia",
      language: "es",
      funnelStage: "MOFU",
      businessConsequence: "Automatizaciones que no recuperan la inversión porque atacan tareas visibles, pero no la pérdida real.",
      proofOrExample: "Una plantilla simple para medir minutos perdidos, repeticiones y tiempo de espera antes de construir.",
      editorialFamily: "real_cases",
      appearancesLast4Posts: 0,
      repetitionPenalty: 0,
      diversityBonus: 0.8,
      temporalBonus: 0,
      expandToArticle: true
    }),
    withScore({
      id: "idea_n8n_failures",
      title: "La demo funcionó. Producción falló. Estas son las 4 preguntas que faltaban.",
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
      appearancesLast4Posts: 0,
      repetitionPenalty: 0,
      diversityBonus: 0.55,
      temporalBonus: 0,
      expandToArticle: true
    }),
    withScore({
      id: "idea_whatsapp_agent",
      title: "Cuándo un agente de WhatsApp mejora ventas y cuándo añade ruido",
      objective: "Separar un caso de uso comercial real de una implantación por moda.",
      audience: "Empresas de servicios con consultas repetitivas y seguimiento comercial.",
      pain: "Tienen conversaciones dispersas y poca trazabilidad del lead.",
      value: "Tres criterios para decidir entre agente, CRM o rediseño del proceso.",
      mainMessage: "El canal no arregla un proceso comercial desordenado.",
      cta: "¿Dónde se pierde hoy el seguimiento de tus conversaciones?",
      priority: 3,
      justification: "Recupera un tema comercial probado sin repetir llamadas: plantea una decisión entre canal, CRM y proceso.",
      relatedService: "Agentes, CRM i canals",
      primaryChannel: "linkedin",
      estimatedEffort: 3,
      commercialImpact: score(4.5 + modifier),
      differentiation: score(4.3 + modifier),
      authority: score(4.4 + modifier),
      reusability: score(4.5 + modifier),
      category: "Comparativa",
      language: "es",
      funnelStage: "MOFU",
      businessConsequence: "Añadir un agente a un proceso desordenado dispersa todavía más los leads.",
      proofOrExample: "Árbol de decisión entre agente, CRM y rediseño del proceso.",
      editorialFamily: "agents_channels",
      lastUsedAt: "2026-07-21",
      appearancesLast4Posts: 0,
      repetitionPenalty: 0,
      diversityBonus: 0.35,
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
      priority: 4,
      justification: "El tema queda temporalmente penalizado perquè Content Intelligence s'ha publicat el 20/08.",
      relatedService: "Dashboards",
      primaryChannel: "linkedin",
      estimatedEffort: 2,
      commercialImpact: score(5 + modifier),
      differentiation: score(5 + modifier),
      authority: score(5 + modifier),
      reusability: score(4 + modifier),
      category: "Estrategia",
      language: "es",
      funnelStage: "MOFU",
      businessConsequence: "Medir sin activar decisiones consume tiempo y retrasa las correcciones.",
      proofOrExample: "Tres preguntas que convierten una métrica en una decisión.",
      editorialFamily: "dashboards_measurement",
      lastUsedAt: "2026-08-20",
      appearancesLast4Posts: 1,
      repetitionPenalty: 1.5,
      diversityBonus: 0,
      temporalBonus: 0,
      expandToArticle: false
    }),
    withScore({
      id: "idea_august_process_stress",
      title: "Agosto es una prueba de estrés para tus procesos.",
      objective: "Hacer visible la fragilidad operativa que aparece durante las vacaciones.",
      audience: "Gerentes y responsables de operaciones de PYMEs y empresas B2B.",
      pain: "Durante las vacaciones aparecen aprobaciones detenidas, consultas sin propietario y tareas que nadie sabe continuar.",
      value: "Un criterio práctico para reforzar responsables, traspaso, documentación y alertas antes de automatizar.",
      mainMessage: "Si un proceso se frena porque alguien está de vacaciones, el problema no son las vacaciones.",
      cta: "¿Qué proceso se vuelve más lento en tu empresa cuando llega agosto?",
      priority: 5,
      justification: "El resultat recent valida l'angle, però LI-08 i LI-09 ja l'han consumit editorialment i no s'ha de repetir ara.",
      relatedService: "Processos, operacions i automatització",
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
      proofOrExample: "LI-08: 267 impressions i 167 persones assolides; angle validat però ja publicat.",
      editorialFamily: "processes_operations",
      lastUsedAt: "2026-08-11",
      appearancesLast4Posts: 1,
      repetitionPenalty: 2.25,
      diversityBonus: 0,
      temporalBonus: 0,
      temporalContext: "Vacances d'agost",
      expiresAt: "2026-08-31T23:59:59+02:00",
      expandToArticle: false
    })
  ];
  const recent = records
    .filter((record) => record.platform === "linkedin" && record.publishedAt)
    .sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!));
  return ideas.map((idea) => {
    const familyRecords = recent.filter((record) => record.editorialFamily === idea.editorialFamily);
    const appearancesLast4Posts = recent.slice(0, 4).filter((record) => record.editorialFamily === idea.editorialFamily).length;
    const lastUsedAt = familyRecords[0]?.publishedAt?.slice(0, 10) || idea.lastUsedAt;
    const observedPenalty = appearancesLast4Posts > 0 ? Math.max(idea.repetitionPenalty, appearancesLast4Posts * 1.25) : idea.repetitionPenalty;
    return applyTemporalModifiers(
      {
        ...idea,
        globalScore: averageScore(idea),
        lastUsedAt,
        appearancesLast4Posts,
        repetitionPenalty: observedPenalty,
        diversityBonus: appearancesLast4Posts === 0 ? idea.diversityBonus : 0
      },
      temporalContext
    );
  });
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
