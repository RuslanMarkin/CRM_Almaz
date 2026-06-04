import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

export interface WaybillPdfData {
  number: string;
  waybillDate?: Date | null;
  // Закупка
  supplierName?: string | null;
  loadingAddress?: string | null;
  // Продажа
  buyerName?: string | null;
  unloadingAddress?: string | null;
  // Перевозчик
  carrierName?: string | null;
  tractorNumber?: string | null;
  trailerNumber?: string | null;
  // Весовые характеристики
  grossWeight?: string | null;
  tareWeight?: string | null;
  netWeight?: string | null;
  // Груз
  cargoName?: string | null;
  pricePerUnit?: string | null;
  currency?: string | null;
  notes?: string | null;
  // Спецификация
  specificationNumber?: string | null;
  contractNumber?: string | null;
}

function pickFirstExisting(paths: string[]): string | undefined {
  return paths.find(p => fs.existsSync(p));
}

function setupPdfFonts(doc: PDFKit.PDFDocument): { regular: string; bold: string } {
  // Built-in Helvetica in PDFKit is WinAnsi-only and breaks Cyrillic.
  const regularPath = pickFirstExisting([
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
  ]);
  const boldPath = pickFirstExisting([
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
  ]);

  if (regularPath) {
    doc.registerFont("Waybill-Regular", regularPath);
  }
  if (boldPath) {
    doc.registerFont("Waybill-Bold", boldPath);
  }

  return {
    regular: regularPath ? "Waybill-Regular" : "Helvetica",
    bold: boldPath ? "Waybill-Bold" : "Helvetica-Bold",
  };
}

function formatDate(date?: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatWeight(w?: string | null): string {
  if (!w) return "—";
  const n = parseFloat(w);
  return isNaN(n) ? "—" : n.toFixed(3) + " т";
}

export function generateWaybillPdf(data: WaybillPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
    });

    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 100; // margins
    const fonts = setupPdfFonts(doc);
    const primaryColor = "#1a1a2e";
    const accentColor = "#4f46e5";
    const mutedColor = "#6b7280";
    const borderColor = "#e5e7eb";

    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(50, 40, pageWidth, 60).fill(accentColor);

    doc
      .fillColor("#ffffff")
      .fontSize(18)
      .font(fonts.bold)
      .text("ТРАНСПОРТНАЯ НАКЛАДНАЯ", 60, 52, { width: pageWidth - 20 });

    doc
      .fontSize(10)
      .font(fonts.regular)
      .text(`№ ${data.number}   |   Дата: ${formatDate(data.waybillDate)}`, 60, 76);

    if (data.specificationNumber) {
      doc.text(`Спецификация: ${data.specificationNumber}${data.contractNumber ? `   |   Договор: ${data.contractNumber}` : ""}`, 60, 90);
    }

    let y = 120;

    // ── Section helper ────────────────────────────────────────────────────────
    function drawSection(title: string, rows: [string, string][], startY: number): number {
      // Section header
      doc.rect(50, startY, pageWidth, 22).fill("#f3f4f6");
      doc
        .fillColor(accentColor)
        .fontSize(9)
        .font(fonts.bold)
        .text(title.toUpperCase(), 58, startY + 7);

      let rowY = startY + 22;

      rows.forEach(([label, value], idx) => {
        if (idx % 2 === 0) {
          doc.rect(50, rowY, pageWidth, 20).fill("#fafafa");
        }
        doc
          .fillColor(mutedColor)
          .fontSize(8)
          .font(fonts.regular)
          .text(label, 58, rowY + 6, { width: 140 });
        doc
          .fillColor(primaryColor)
          .fontSize(9)
          .font(fonts.bold)
          .text(value || "—", 200, rowY + 6, { width: pageWidth - 150 });
        rowY += 20;
      });

      // Bottom border
      doc.rect(50, startY, pageWidth, rowY - startY).stroke(borderColor);

      return rowY + 12;
    }

    // ── Block 1: Закупка ─────────────────────────────────────────────────────
    y = drawSection("Закупка (поставщик)", [
      ["Поставщик", data.supplierName ?? "—"],
      ["Адрес погрузки", data.loadingAddress ?? "—"],
    ], y);

    // ── Block 2: Продажа ─────────────────────────────────────────────────────
    y = drawSection("Продажа (покупатель)", [
      ["Покупатель", data.buyerName ?? "—"],
      ["Адрес выгрузки", data.unloadingAddress ?? "—"],
    ], y);

    // ── Block 3: Перевозчик ──────────────────────────────────────────────────
    y = drawSection("Перевозчик", [
      ["Перевозчик", data.carrierName ?? "—"],
      ["Номер тягача", data.tractorNumber ?? "—"],
      ["Номер прицепа", data.trailerNumber ?? "—"],
    ], y);

    // ── Block 4: Весовые характеристики ──────────────────────────────────────
    y = drawSection("Весовые характеристики", [
      ["Брутто", formatWeight(data.grossWeight)],
      ["Тара", formatWeight(data.tareWeight)],
      ["Нетто", formatWeight(data.netWeight)],
    ], y);

    // ── Cargo info ────────────────────────────────────────────────────────────
    if (data.cargoName || data.pricePerUnit) {
      y = drawSection("Груз", [
        ["Наименование", data.cargoName ?? "—"],
        ...(data.pricePerUnit ? [["Цена за единицу", `${data.pricePerUnit} ${data.currency ?? "RUB"}`] as [string, string]] : []),
      ], y);
    }

    // ── Notes ─────────────────────────────────────────────────────────────────
    if (data.notes) {
      doc.rect(50, y, pageWidth, 22).fill("#f3f4f6");
      doc.fillColor(accentColor).fontSize(9).font(fonts.bold).text("ПРИМЕЧАНИЯ", 58, y + 7);
      y += 22;
      doc
        .fillColor(primaryColor)
        .fontSize(9)
        .font(fonts.regular)
        .text(data.notes, 58, y + 6, { width: pageWidth - 16 });
      y += 30;
    }

    // ── Signature block ───────────────────────────────────────────────────────
    y += 20;
    const sigWidth = (pageWidth - 20) / 3;

    ["Поставщик", "Перевозчик", "Покупатель"].forEach((label, i) => {
      const x = 50 + i * (sigWidth + 10);
      doc.rect(x, y, sigWidth, 50).stroke(borderColor);
      doc.fillColor(mutedColor).fontSize(8).font(fonts.regular).text(label, x + 8, y + 6);
      doc.moveTo(x + 8, y + 38).lineTo(x + sigWidth - 8, y + 38).stroke(borderColor);
      doc.fillColor(mutedColor).fontSize(7).text("подпись / печать", x + 8, y + 40);
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    doc
      .fillColor(mutedColor)
      .fontSize(7)
      .font(fonts.regular)
      .text(
        `Сформировано: ${new Date().toLocaleString("ru-RU")}`,
        50,
        doc.page.height - 30,
        { width: pageWidth, align: "right" }
      );

    doc.end();
  });
}
