import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { NotFoundError } from "@/lib/errors";

type PdfLine = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRateBps: number;
  totalCents: number;
};

export type PdfDocumentData = {
  kind: "Pressupost" | "Factura";
  number: string;
  issueDate: Date;
  dueLabel: string;
  dueDate: Date;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  paidCents?: number;
  notes: string | null;
  terms: string | null;
  client: {
    name: string;
    legalName: string | null;
    taxId: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    email: string | null;
  };
  organization: {
    tradeName: string;
    legalName: string | null;
    taxId: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
  };
  lines: PdfLine[];
};

type Palette = ReturnType<typeof createPalette>;
type PageState = { page: PDFPage; y: number };

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_TOP = 62;

export async function quotePdfByToken(token: string) {
  const quote = await db.quote.findUnique({
    where: { publicToken: token },
    include: {
      company: true,
      items: { orderBy: { position: "asc" } },
      organization: { include: { settings: true } },
    },
  });
  if (
    !quote?.organization.settings ||
    quote.status === "DRAFT" ||
    quote.status === "CANCELLED"
  ) {
    throw new NotFoundError("No s’ha trobat el pressupost");
  }
  return renderDocumentPdf({
    kind: "Pressupost",
    number: quote.number,
    issueDate: quote.issueDate,
    dueLabel: "Vàlid fins al",
    dueDate: quote.validUntil,
    currency: quote.currency,
    subtotalCents: quote.subtotalCents,
    discountCents: quote.discountAmountCents,
    taxCents: quote.taxAmountCents,
    totalCents: quote.totalCents,
    notes: quote.notesText,
    terms: quote.terms,
    client: quote.company,
    organization: quote.organization.settings,
    lines: quote.items,
  });
}

export async function invoicePdfByToken(token: string) {
  const invoice = await db.invoice.findUnique({
    where: { publicToken: token },
    include: {
      company: true,
      items: { orderBy: { position: "asc" } },
      organization: { include: { settings: true } },
    },
  });
  if (
    !invoice?.organization.settings ||
    invoice.status === "DRAFT" ||
    invoice.status === "CANCELLED"
  ) {
    throw new NotFoundError("No s’ha trobat la factura");
  }
  return renderDocumentPdf({
    kind: "Factura",
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueLabel: "Venciment",
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    subtotalCents: invoice.subtotalCents,
    discountCents: invoice.discountAmountCents,
    taxCents: invoice.taxAmountCents,
    totalCents: invoice.totalCents,
    paidCents: invoice.paidAmountCents,
    notes: invoice.notesText,
    terms: invoice.terms,
    client: invoice.company,
    organization: invoice.organization.settings,
    lines: invoice.items,
  });
}

export async function renderDocumentPdf(data: PdfDocumentData) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const { regular, bold } = await embedFonts(pdf);
  const logo = await embedLogo(pdf);
  const palette = createPalette();
  const safe = (value: string) => safeText(value, regular);
  let state = drawFirstPage(pdf, data, regular, bold, logo, palette, safe);

  for (const item of data.lines) {
    const descriptionLines = wrapToWidth(
      safe(item.description),
      regular,
      9,
      276,
    );
    const rowHeight = Math.max(24, descriptionLines.length * 12 + 10);

    if (state.y - rowHeight < 112) {
      state = drawContinuationPage(
        pdf,
        data,
        regular,
        bold,
        logo,
        palette,
        safe,
        "Línies del document",
      );
      state.y = drawTableHeader(state.page, bold, state.y, palette, safe);
    }

    descriptionLines.forEach((description, index) => {
      state.page.drawText(description, {
        x: 52,
        y: state.y - index * 12,
        size: 9,
        font: regular,
        color: palette.navy,
      });
    });
    state.page.drawText(safe(String(item.quantity)), {
      x: 350,
      y: state.y,
      size: 9,
      font: regular,
      color: palette.navy,
    });
    drawRight(
      state.page,
      regular,
      safe(formatMoney(item.unitPriceCents, data.currency)),
      467,
      state.y,
      9,
      palette.navy,
    );
    drawRight(
      state.page,
      bold,
      safe(formatMoney(item.totalCents, data.currency)),
      543,
      state.y,
      9,
      palette.navy,
    );
    state.y -= rowHeight;
    state.page.drawLine({
      start: { x: 52, y: state.y + 8 },
      end: { x: 543, y: state.y + 8 },
      thickness: 0.5,
      color: palette.line,
    });
  }

  const totalRows =
    3 +
    (data.discountCents ? 1 : 0) +
    (data.paidCents !== undefined ? 2 : 0);
  const totalsHeight = totalRows * 19 + 48;
  if (state.y - totalsHeight < 112) {
    state = drawContinuationPage(
      pdf,
      data,
      regular,
      bold,
      logo,
      palette,
      safe,
      "Resum econòmic",
    );
  }

  state.y -= 8;
  const totalsX = 380;
  state.y = drawTotal(
    state.page,
    regular,
    safe("Subtotal"),
    data.subtotalCents,
    data.currency,
    totalsX,
    state.y,
    palette.muted,
    safe,
  );
  if (data.discountCents) {
    state.y = drawTotal(
      state.page,
      regular,
      safe("Descompte"),
      -data.discountCents,
      data.currency,
      totalsX,
      state.y,
      palette.muted,
      safe,
    );
  }
  state.y = drawTotal(
    state.page,
    regular,
    safe("Impostos"),
    data.taxCents,
    data.currency,
    totalsX,
    state.y,
    palette.muted,
    safe,
  );
  state.y -= 10;
  state.page.drawRectangle({
    x: totalsX - 8,
    y: state.y - 8,
    width: 171,
    height: 30,
    color: palette.teal,
  });
  state.page.drawText(safe("TOTAL"), {
    x: totalsX,
    y: state.y + 3,
    size: 10,
    font: bold,
    color: rgb(1, 1, 1),
  });
  drawRight(
    state.page,
    bold,
    safe(formatMoney(data.totalCents, data.currency)),
    543,
    state.y + 3,
    11,
    rgb(1, 1, 1),
  );
  state.y -= 42;

  if (data.paidCents !== undefined) {
    state.y = drawTotal(
      state.page,
      regular,
      safe("Pagat"),
      data.paidCents,
      data.currency,
      totalsX,
      state.y,
      palette.muted,
      safe,
    );
    state.y = drawTotal(
      state.page,
      bold,
      safe("Pendent"),
      data.totalCents - data.paidCents,
      data.currency,
      totalsX,
      state.y,
      palette.navy,
      safe,
    );
  }

  if (data.notes) {
    state = drawSectionAcrossPages(
      pdf,
      state,
      data,
      bold,
      regular,
      logo,
      palette,
      safe,
      "Notes",
      data.notes,
    );
  }
  if (data.terms) {
    state = drawSectionAcrossPages(
      pdf,
      state,
      data,
      bold,
      regular,
      logo,
      palette,
      safe,
      "Condicions",
      data.terms,
    );
  }

  const pages = pdf.getPages();
  pages.forEach((page, index) =>
    drawFooter(
      page,
      regular,
      data.organization.tradeName,
      index + 1,
      pages.length,
      palette,
      safe,
    ),
  );

  return Buffer.from(await pdf.save());
}

async function embedFonts(pdf: PDFDocument) {
  try {
    const [regularBytes, boldBytes] = await Promise.all([
      readFile(
        path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf"),
      ),
      readFile(
        path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf"),
      ),
    ]);
    return {
      regular: await pdf.embedFont(regularBytes, { subset: true }),
      bold: await pdf.embedFont(boldBytes, { subset: true }),
    };
  } catch {
    return {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    };
  }
}

async function embedLogo(pdf: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "public", "brand", "logo-web.png"),
    );
    return await pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

function drawFirstPage(
  pdf: PDFDocument,
  data: PdfDocumentData,
  regular: PDFFont,
  bold: PDFFont,
  logo: PDFImage | null,
  palette: Palette,
  safe: (value: string) => string,
): PageState {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawDocumentHeader(
    page,
    data,
    regular,
    bold,
    logo,
    palette,
    safe,
  );

  drawLabel(page, regular, safe("EMISSOR"), 44, y, palette.teal);
  drawLabel(page, regular, safe("CLIENT"), 310, y, palette.teal);
  y -= 18;
  drawParty(
    page,
    bold,
    regular,
    safe(data.organization.tradeName),
    [
      data.organization.legalName,
      data.organization.taxId,
      data.organization.address,
      [data.organization.postalCode, data.organization.city]
        .filter(Boolean)
        .join(" "),
      data.organization.email,
      data.organization.phone,
    ].filter(Boolean) as string[],
    44,
    y,
    226,
    palette,
    safe,
  );
  drawParty(
    page,
    bold,
    regular,
    safe(data.client.name),
    [
      data.client.legalName,
      data.client.taxId,
      data.client.address,
      [data.client.postalCode, data.client.city].filter(Boolean).join(" "),
      data.client.email,
    ].filter(Boolean) as string[],
    310,
    y,
    235,
    palette,
    safe,
  );
  y -= 98;
  page.drawText(
    safe(`Data: ${data.issueDate.toLocaleDateString("ca-ES")}`),
    { x: 44, y, size: 9, font: regular, color: palette.muted },
  );
  page.drawText(
    safe(
      `${data.dueLabel}: ${data.dueDate.toLocaleDateString("ca-ES")}`,
    ),
    { x: 310, y, size: 9, font: regular, color: palette.muted },
  );
  y -= 28;
  y = drawTableHeader(page, bold, y, palette, safe);
  return { page, y };
}

function drawContinuationPage(
  pdf: PDFDocument,
  data: PdfDocumentData,
  regular: PDFFont,
  bold: PDFFont,
  logo: PDFImage | null,
  palette: Palette,
  safe: (value: string) => string,
  sectionTitle: string,
): PageState {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawDocumentHeader(
    page,
    data,
    regular,
    bold,
    logo,
    palette,
    safe,
    true,
  );
  page.drawText(safe(sectionTitle), {
    x: MARGIN,
    y,
    size: 12,
    font: bold,
    color: palette.navy,
  });
  y -= 28;
  return { page, y };
}

function drawDocumentHeader(
  page: PDFPage,
  data: PdfDocumentData,
  regular: PDFFont,
  bold: PDFFont,
  logo: PDFImage | null,
  palette: Palette,
  safe: (value: string) => string,
  compact = false,
) {
  const top = compact ? 792 : 790;
  if (logo) {
    const scaled = logo.scaleToFit(compact ? 106 : 142, compact ? 34 : 46);
    page.drawImage(logo, {
      x: 44,
      y: top - (compact ? 17 : 24),
      width: scaled.width,
      height: scaled.height,
    });
  } else {
    page.drawText(safe("AImetos"), {
      x: 44,
      y: top,
      size: compact ? 16 : 20,
      font: bold,
      color: palette.teal,
    });
  }
  page.drawText(safe(data.kind.toUpperCase()), {
    x: 400,
    y: top + 2,
    size: 11,
    font: bold,
    color: palette.teal,
  });
  const number = fitText(
    safe(data.number),
    bold,
    compact ? 14 : 18,
    151,
    10,
  );
  page.drawText(number.text, {
    x: 400,
    y: top - 20,
    size: number.size,
    font: bold,
    color: palette.navy,
  });
  const lineY = compact ? top - 48 : top - 78;
  page.drawLine({
    start: { x: 44, y: lineY },
    end: { x: 551, y: lineY },
    thickness: 1,
    color: palette.line,
  });
  return lineY - 24;
}

function drawTableHeader(
  page: PDFPage,
  bold: PDFFont,
  y: number,
  palette: Palette,
  safe: (value: string) => string,
) {
  page.drawRectangle({
    x: 44,
    y: y - 18,
    width: 507,
    height: 24,
    color: rgb(0.95, 0.97, 0.97),
  });
  page.drawText(safe("Descripció"), {
    x: 52,
    y: y - 10,
    size: 8,
    font: bold,
    color: palette.navy,
  });
  page.drawText(safe("Qtat."), {
    x: 345,
    y: y - 10,
    size: 8,
    font: bold,
    color: palette.navy,
  });
  page.drawText(safe("Preu"), {
    x: 398,
    y: y - 10,
    size: 8,
    font: bold,
    color: palette.navy,
  });
  page.drawText(safe("Total"), {
    x: 493,
    y: y - 10,
    size: 8,
    font: bold,
    color: palette.navy,
  });
  return y - 32;
}

function drawSectionAcrossPages(
  pdf: PDFDocument,
  initialState: PageState,
  data: PdfDocumentData,
  bold: PDFFont,
  regular: PDFFont,
  logo: PDFImage | null,
  palette: Palette,
  safe: (value: string) => string,
  title: string,
  content: string,
) {
  let state = initialState;
  let lines = wrapToWidth(safe(content), regular, 8, CONTENT_WIDTH);
  const lineHeight = 12;

  if (state.y < 116) {
    state = drawContinuationPage(
      pdf,
      data,
      regular,
      bold,
      logo,
      palette,
      safe,
      title,
    );
  } else {
    state.y -= 18;
    state.page.drawText(safe(title), {
      x: MARGIN,
      y: state.y,
      size: 9,
      font: bold,
      color: palette.navy,
    });
    state.y -= 17;
  }

  while (lines.length > 0) {
    const availableLines = Math.max(
      1,
      Math.floor((state.y - FOOTER_TOP - 10) / lineHeight),
    );
    const pageLines = lines.slice(0, availableLines);
    pageLines.forEach((line, index) =>
      state.page.drawText(line, {
        x: MARGIN,
        y: state.y - index * lineHeight,
        size: 8,
        font: regular,
        color: palette.muted,
      }),
    );
    state.y -= pageLines.length * lineHeight;
    lines = lines.slice(pageLines.length);

    if (lines.length > 0) {
      state = drawContinuationPage(
        pdf,
        data,
        regular,
        bold,
        logo,
        palette,
        safe,
        `${title} (continuació)`,
      );
    }
  }

  state.y -= 6;
  return state;
}

function drawFooter(
  page: PDFPage,
  regular: PDFFont,
  organizationName: string,
  pageNumber: number,
  pageCount: number,
  palette: Palette,
  safe: (value: string) => string,
) {
  page.drawLine({
    start: { x: 44, y: 54 },
    end: { x: 551, y: 54 },
    thickness: 0.5,
    color: palette.line,
  });
  page.drawText(
    truncateToWidth(
      safe(`${organizationName} - Document comercial generat per AImetos CRM`),
      regular,
      7,
      400,
    ),
    { x: 44, y: 36, size: 7, font: regular, color: palette.muted },
  );
  drawRight(
    page,
    regular,
    safe(`Pàgina ${pageNumber} de ${pageCount}`),
    551,
    36,
    7,
    palette.muted,
  );
}

function createPalette() {
  return {
    teal: rgb(0.03, 0.42, 0.49),
    navy: rgb(0.08, 0.17, 0.21),
    muted: rgb(0.38, 0.47, 0.51),
    line: rgb(0.86, 0.9, 0.91),
  };
}

function drawLabel(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  color: ReturnType<typeof rgb>,
) {
  page.drawText(text, { x, y, size: 7, font, color });
}

function drawParty(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  name: string,
  lines: string[],
  x: number,
  y: number,
  width: number,
  palette: Palette,
  safe: (value: string) => string,
) {
  page.drawText(truncateToWidth(name, bold, 11, width), {
    x,
    y,
    size: 11,
    font: bold,
    color: palette.navy,
  });
  lines.slice(0, 5).forEach((value, index) =>
    page.drawText(
      truncateToWidth(safe(value), regular, 8, width),
      {
        x,
        y: y - 15 - index * 12,
        size: 8,
        font: regular,
        color: palette.muted,
      },
    ),
  );
}

function drawRight(
  page: PDFPage,
  font: PDFFont,
  text: string,
  right: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>,
) {
  page.drawText(text, {
    x: right - font.widthOfTextAtSize(text, size),
    y,
    size,
    font,
    color,
  });
}

function drawTotal(
  page: PDFPage,
  font: PDFFont,
  label: string,
  value: number,
  currency: string,
  x: number,
  y: number,
  color: ReturnType<typeof rgb>,
  safe: (value: string) => string,
) {
  page.drawText(label, { x, y, size: 9, font, color });
  drawRight(
    page,
    font,
    safe(formatMoney(value, currency)),
    543,
    y,
    9,
    color,
  );
  return y - 18;
}

function safeText(value: string, font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  return Array.from(
    value
      .normalize("NFC")
      .replace(/[‐‑‒–—―]/g, "-")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""),
  )
    .map((character) =>
      supported.has(character.codePointAt(0) ?? 0) ? character : "?",
    )
    .join("");
}

function truncateToWidth(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  const suffix = "...";
  let output = value;
  while (
    output.length > 0 &&
    font.widthOfTextAtSize(`${output}${suffix}`, size) > maxWidth
  ) {
    output = output.slice(0, -1);
  }
  return `${output.trimEnd()}${suffix}`;
}

function fitText(
  value: string,
  font: PDFFont,
  preferredSize: number,
  maxWidth: number,
  minimumSize: number,
) {
  let size = preferredSize;
  while (size > minimumSize && font.widthOfTextAtSize(value, size) > maxWidth) {
    size -= 0.5;
  }
  return {
    text: truncateToWidth(value, font, size, maxWidth),
    size,
  };
}

function wrapToWidth(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const result: string[] = [];
  const paragraphs = value.replace(/\r\n?/g, "\n").split("\n");

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      result.push("");
      continue;
    }

    let current = "";
    for (const originalWord of words) {
      let word = originalWord;
      while (font.widthOfTextAtSize(word, size) > maxWidth) {
        let splitAt = word.length;
        while (
          splitAt > 1 &&
          font.widthOfTextAtSize(`${word.slice(0, splitAt)}-`, size) >
            maxWidth
        ) {
          splitAt -= 1;
        }
        const chunk = `${word.slice(0, splitAt)}-`;
        if (current) {
          result.push(current);
          current = "";
        }
        result.push(chunk);
        word = word.slice(splitAt);
      }

      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) result.push(current);
        current = word;
      }
    }
    if (current) result.push(current);
  }

  return result.length > 0 ? result : [""];
}
