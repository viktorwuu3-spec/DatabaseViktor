import PDFDocument from "pdfkit";

export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Rp 0";
  const formatted = Math.abs(value).toLocaleString("id-ID");
  return value < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatTanggal(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const month = months[parseInt(parts[1], 10) - 1] || parts[1];
  const year = parts[0];
  return `${day} ${month} ${year}`;
}

interface Column {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
  getValue: (row: Record<string, unknown>, index: number) => string;
}

interface PdfReportOptions {
  title: string;
  subtitle?: string;
  filterInfo?: string[];
  columns: Column[];
  data: Record<string, unknown>[];
  summaryLines?: string[];
  footerSummaryLines?: string[];
  totalLabel?: string;
  totalValue?: string;
  totalColumnIndex?: number;
  signatureLeft: string;
  signatureRight: string;
  layout?: "portrait" | "landscape";
}

export function buildFilterInfoLines(params: {
  startDate?: string;
  endDate?: string;
  kategori?: string;
  search?: string;
  selectedCount?: number;
}): string[] {
  const lines: string[] = [];
  if (params.startDate && params.endDate) {
    lines.push(`Periode: ${formatTanggal(params.startDate)} s/d ${formatTanggal(params.endDate)}`);
  } else if (params.startDate) {
    lines.push(`Dari: ${formatTanggal(params.startDate)}`);
  } else if (params.endDate) {
    lines.push(`Sampai: ${formatTanggal(params.endDate)}`);
  }
  if (params.kategori) {
    lines.push(`Kategori: ${params.kategori}`);
  }
  if (params.search) {
    lines.push(`Pencarian: "${params.search}"`);
  }
  if (params.selectedCount && params.selectedCount > 0) {
    lines.push(`Data terpilih: ${params.selectedCount} item`);
  }
  return lines;
}

export function generatePdfReport(options: PdfReportOptions): PDFKit.PDFDocument {
  const {
    title, subtitle, filterInfo, columns: rawColumns, data, summaryLines,
    footerSummaryLines,
    totalLabel, totalValue, totalColumnIndex,
    signatureLeft, signatureRight,
    layout = "landscape",
  } = options;

  const doc = new PDFDocument({
    margin: 40,
    size: "A4",
    layout,
    bufferPages: true,
  });

  const pageWidth = layout === "landscape" ? 841.89 : 595.28;
  const pageHeight = layout === "landscape" ? 595.28 : 841.89;
  const marginLeft = 40;
  const marginRight = 40;
  const marginBottom = 50;
  const usableWidth = pageWidth - marginLeft - marginRight;
  const pageBottom = pageHeight - marginBottom;
  const rowHeight = 20;
  const headerHeight = 24;
  const padding = 5;

  const rawTableWidth = rawColumns.reduce((sum, col) => sum + col.width, 0);
  const scaleFactor = usableWidth / rawTableWidth;
  const columns = rawColumns.map((col) => ({ ...col, width: Math.round(col.width * scaleFactor) }));
  const widthDiff = usableWidth - columns.reduce((sum, col) => sum + col.width, 0);
  if (widthDiff !== 0) {
    const largest = columns.reduce((max, col, i) => (col.width > columns[max].width ? i : max), 0);
    columns[largest].width += widthDiff;
  }
  const tableWidth = usableWidth;
  const tableLeft = marginLeft;
  const tableRight = tableLeft + tableWidth;

  function drawHeader() {
    doc.fontSize(14).font("Helvetica-Bold").text(title, marginLeft, 40, {
      width: usableWidth,
      align: "center",
    });
    if (subtitle) {
      doc.fontSize(9).font("Helvetica").text(subtitle, marginLeft, doc.y + 2, {
        width: usableWidth,
        align: "center",
      });
    }
    const now = new Date();
    const dateStr = `${now.getDate()} ${["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][now.getMonth()]} ${now.getFullYear()}`;
    doc.fontSize(8).font("Helvetica").text(`Dicetak: ${dateStr}`, marginLeft, doc.y + 4, {
      width: usableWidth,
      align: "right",
    });
    if (filterInfo && filterInfo.length > 0) {
      doc.moveDown(0.2);
      doc.fontSize(8).font("Helvetica-Oblique").fillColor("#4b5563");
      filterInfo.forEach((line) => {
        doc.text(line, marginLeft, doc.y, { width: usableWidth, align: "center" });
      });
      doc.fillColor("black").font("Helvetica");
    }
    doc.moveDown(0.3);
  }

  function drawSummaryBox() {
    if (!summaryLines || summaryLines.length === 0) return;
    doc.fontSize(9).font("Helvetica");
    summaryLines.forEach((line) => {
      doc.text(line, marginLeft + 10, doc.y, { width: usableWidth - 20 });
    });
    doc.moveDown(0.3);
  }

  function drawTableHeader(y: number): number {
    doc.rect(tableLeft, y, tableWidth, headerHeight).fill("#2563eb");

    doc.strokeColor("white").lineWidth(0.5);
    let x = tableLeft;
    columns.forEach((col, i) => {
      if (i > 0) {
        doc.moveTo(x, y).lineTo(x, y + headerHeight).stroke();
      }
      x += col.width;
    });

    doc.fillColor("white").font("Helvetica-Bold").fontSize(7.5);
    x = tableLeft;
    columns.forEach((col) => {
      doc.text(col.label, x + padding, y + 6, {
        width: col.width - padding * 2,
        align: col.align || "left",
        lineBreak: false,
      });
      x += col.width;
    });
    doc.fillColor("black").strokeColor("#d1d5db");
    return y + headerHeight;
  }

  function drawRow(y: number, row: Record<string, unknown>, index: number, isEven: boolean): number {
    if (isEven) {
      doc.save();
      doc.rect(tableLeft, y, tableWidth, rowHeight).fill("#f0f4ff");
      doc.restore();
    }

    doc.fillColor("black").font("Helvetica").fontSize(7);
    let x = tableLeft;
    columns.forEach((col) => {
      const val = col.getValue(row, index);
      doc.text(val, x + padding, y + 6, {
        width: col.width - padding * 2,
        align: col.align || "left",
        lineBreak: false,
      });
      x += col.width;
    });

    doc.strokeColor("#e5e7eb").lineWidth(0.3);
    doc.moveTo(tableLeft, y + rowHeight).lineTo(tableRight, y + rowHeight).stroke();

    doc.strokeColor("#e5e7eb").lineWidth(0.3);
    x = tableLeft;
    columns.forEach((col, i) => {
      if (i > 0) {
        doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
      }
      x += col.width;
    });

    doc.moveTo(tableLeft, y).lineTo(tableLeft, y + rowHeight).stroke();
    doc.moveTo(tableRight, y).lineTo(tableRight, y + rowHeight).stroke();

    return y + rowHeight;
  }

  function drawTotalRow(y: number) {
    if (!totalLabel || !totalValue) return y;

    if (y + headerHeight + 10 > pageBottom) {
      doc.addPage();
      y = 40;
    }

    const totalHeight = 24;
    doc.rect(tableLeft, y, tableWidth, totalHeight).fill("#1e40af");

    const colIdx = totalColumnIndex ?? columns.length - 1;
    let labelEndX = tableLeft;
    for (let i = 0; i < colIdx; i++) {
      labelEndX += columns[i].width;
    }
    const valueX = labelEndX;
    const valueWidth = columns[colIdx].width;

    doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
    doc.text(totalLabel, tableLeft + padding, y + 7, {
      width: labelEndX - tableLeft - padding * 2,
      align: "right",
    });
    doc.text(totalValue, valueX + padding, y + 7, {
      width: valueWidth - padding * 2,
      align: "right",
    });

    doc.fillColor("black");
    return y + totalHeight;
  }

  function drawSignature(y: number) {
    if (y > pageBottom - 110) {
      doc.addPage();
      y = 60;
    }
    y += 30;
    doc.font("Helvetica").fontSize(9).fillColor("black");
    doc.text(signatureLeft, marginLeft + 30, y);
    doc.text(signatureRight, pageWidth - marginRight - 180, y);
    y += 60;
    doc.strokeColor("black").lineWidth(0.5);
    doc.moveTo(marginLeft + 30, y).lineTo(marginLeft + 180, y).stroke();
    doc.moveTo(pageWidth - marginRight - 180, y).lineTo(pageWidth - marginRight - 30, y).stroke();
    y += 4;
    doc.fontSize(7).fillColor("#6b7280");
    doc.text("Nama / Tanda Tangan", marginLeft + 30, y);
    doc.text("Nama / Tanda Tangan", pageWidth - marginRight - 180, y);
    y += 14;
    doc.fillColor("black").fontSize(8);
    doc.text("Tanggal: _______________", marginLeft + 30, y);
    doc.text("Tanggal: _______________", pageWidth - marginRight - 180, y);
  }

  function drawFooterSummary(y: number): number {
    if (!footerSummaryLines || footerSummaryLines.length === 0) return y;

    if (y + footerSummaryLines.length * 14 + 20 > pageBottom) {
      doc.addPage();
      y = 40;
    }

    y += 12;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("black");
    footerSummaryLines.forEach((line) => {
      if (line.startsWith("─")) {
        doc.font("Helvetica").fontSize(7);
        doc.text(line, marginLeft + 10, y, { width: 300 });
      } else if (line.includes("Kekurangan Dana")) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#dc2626");
        doc.text(line, marginLeft + 10, y, { width: 300 });
        doc.fillColor("black");
      } else if (line.includes("Saldo Akhir")) {
        doc.font("Helvetica-Bold").fontSize(9);
        doc.text(line, marginLeft + 10, y, { width: 300 });
      } else {
        doc.font("Helvetica").fontSize(9);
        doc.text(line, marginLeft + 10, y, { width: 300 });
      }
      y += 14;
    });

    return y;
  }

  function addPageNumber() {
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).font("Helvetica").fillColor("#9ca3af");
      doc.text(
        `Halaman ${i + 1} dari ${totalPages}`,
        marginLeft,
        pageHeight - 30,
        { width: usableWidth, align: "center" }
      );
    }
    doc.fillColor("black");
  }

  drawHeader();
  drawSummaryBox();

  let currentY = doc.y + 4;
  currentY = drawTableHeader(currentY);

  data.forEach((row, index) => {
    if (currentY + rowHeight > pageBottom - 10) {
      doc.addPage();
      currentY = 40;
      currentY = drawTableHeader(currentY);
    }
    currentY = drawRow(currentY, row, index, index % 2 === 0);
  });

  currentY = drawTotalRow(currentY);
  currentY = drawFooterSummary(currentY);
  drawSignature(currentY);
  addPageNumber();

  return doc;
}
