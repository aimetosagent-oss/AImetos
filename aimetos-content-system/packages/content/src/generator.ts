import type { ContentIdea } from "../../shared/src/domain.ts";

export type GeneratedContent = {
  ideaId: string;
  article: {
    title: string;
    slug: string;
    summary: string;
    body: string;
    seoTitle: string;
    seoDescription: string;
    cta: string;
  };
  linkedin: {
    text: string;
    cta: string;
  };
  adaptations: Array<{
    channel: string;
    format: string;
    content: string;
    metadata: Record<string, string | string[]>;
  }>;
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateContentForIdea(idea: ContentIdea): GeneratedContent {
  const slug = slugify(idea.title);
  const articleBody = [
    "# " + idea.title,
    "",
    "## Context",
    idea.audience + " sovint arriba a aquest punt: " + idea.pain,
    "",
    "## Criteri practic",
    idea.mainMessage,
    "",
    "## Com ho enfoca AImetos",
    "1. Mesura el volum i la repeticio del proces.",
    "2. Valida que hi hagi dades suficients i un propietari clar.",
    "3. Dissenya una primera versio petita, observable i reversible.",
    "4. Connecta el resultat amb CRM, reunions o seguiment comercial.",
    "",
    "## Valor",
    idea.value,
    "",
    "## Seguent pas",
    idea.cta + "."
  ].join("\n");

  return {
    ideaId: idea.id,
    article: {
      title: idea.title,
      slug,
      summary: idea.value,
      body: articleBody,
      seoTitle: idea.title + " | AImetos",
      seoDescription: idea.mainMessage,
      cta: idea.cta
    },
    linkedin: {
      text: [
        idea.title,
        "",
        "La pregunta no es si la IA pot fer-ho.",
        "La pregunta es si el proces te prou volum, criteris i traçabilitat per automatitzar-lo amb garanties.",
        "",
        idea.mainMessage,
        "",
        "A AImetos ho validem abans de construir: problema, dades, integracions, riscos i impacte comercial.",
        "",
        "CTA: " + idea.cta
      ].join("\n"),
      cta: idea.cta
    },
    adaptations: [
      {
        channel: "blog",
        format: "long_form",
        content: articleBody,
        metadata: { slug, language: idea.language, category: idea.category }
      },
      {
        channel: "newsletter",
        format: "email",
        content: "Assumpte: " + idea.title + "\n\n" + idea.value + "\n\n" + idea.cta,
        metadata: { segment: "b2b-operations", cta: idea.cta }
      },
      {
        channel: "instagram",
        format: "carousel",
        content: "5 diapositives: problema, criteri, exemple, risc, CTA.",
        metadata: { hashtags: ["#automatitzacio", "#iaempresa", "#aimetos"] }
      },
      {
        channel: "facebook",
        format: "post",
        content: idea.mainMessage + "\n\n" + idea.cta,
        metadata: { tone: "professional" }
      },
      {
        channel: "youtube",
        format: "script",
        content: "Guio de 4 minuts amb introduccio, criteris, exemple i CTA.",
        metadata: { title: idea.title, description: idea.value }
      },
      {
        channel: "reels",
        format: "short_script",
        content: "Hook: " + idea.pain + ". Resolucio: " + idea.mainMessage,
        metadata: { duration: "45s" }
      },
      {
        channel: "seo",
        format: "metadata",
        content: idea.mainMessage,
        metadata: {
          title: idea.title,
          description: idea.value,
          keywords: [idea.relatedService, "automatitzacio B2B", "IA empresarial"]
        }
      },
      {
        channel: "visual",
        format: "thumbnail_prompt",
        content: "Professional operations dashboard showing " + idea.relatedService + " impact, clean B2B style.",
        metadata: { usage: "thumbnail-or-cover" }
      }
    ]
  };
}
