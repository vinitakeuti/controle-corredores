import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type TermPdfData = {
  name: string;
  cpf: string | null;
  birthDate: Date | null;
  phone: string | null;
  email: string;
  joinedAt: Date;
  planName: string;
};

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Maceio" }).format(value) : "Não informado";
}

function valueOrFallback(value: string | null) {
  return value?.trim() || "Não informado";
}

function drawFittedText(page: PDFPage, font: PDFFont, value: string, x: number, y: number, width: number) {
  let size = 9;
  while (size > 6.5 && font.widthOfTextAtSize(value, size) > width) size -= .25;
  const clipped = font.widthOfTextAtSize(value, size) > width
    ? `${value.slice(0, Math.max(1, Math.floor(value.length * width / font.widthOfTextAtSize(value, size)) - 1))}…`
    : value;
  page.drawText(clipped, { x, y, size, font, color: rgb(.08, .08, .08) });
}

export async function buildPersonalizedLiabilityTermPdf(data: TermPdfData) {
  const source = await readFile(path.join(process.cwd(), "public", "termos", "PACELAB_Termo_Responsabilidade_2026.pdf"));
  const template = await PDFDocument.load(source);
  const document = await PDFDocument.create();
  const pages = await document.copyPages(template, template.getPageIndices());
  pages.forEach((templatePage) => document.addPage(templatePage));
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.getPage(0);

  drawFittedText(page, font, data.name, 166, 746, 360);
  drawFittedText(page, font, valueOrFallback(data.cpf), 102, 721, 140);
  drawFittedText(page, font, formatDate(data.birthDate), 351, 721, 155);
  drawFittedText(page, font, valueOrFallback(data.phone), 119, 686, 124);
  drawFittedText(page, font, data.email, 290, 686, 235);
  drawFittedText(page, font, formatDate(data.joinedAt), 149, 663, 135);
  drawFittedText(page, font, data.planName, 388, 663, 137);

  // Rebuilding the page tree, instead of saving the parsed source directly,
  // removes malformed cross-reference entries from the original template.
  // Safari on iOS rejects those entries and renders a black document.
  return document.save({
    addDefaultPage: false,
    updateFieldAppearances: false,
    useObjectStreams: false,
  });
}
