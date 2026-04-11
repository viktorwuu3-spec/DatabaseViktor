import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { invoicesTable, invoiceItemsTable } from "@workspace/db";
import { eq, ilike, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import * as XLSX from "xlsx";
import { generatePdfReport, formatRupiah, formatTanggal } from "./pdf-utils.js";

function validateInvoiceData(data: Record<string, unknown>, items: unknown[]) {
  const errors: string[] = [];
  if (!data.nomor_invoice || typeof data.nomor_invoice !== "string" || !data.nomor_invoice.trim()) {
    errors.push("Nomor invoice wajib diisi");
  }
  if (!data.tanggal || typeof data.tanggal !== "string") {
    errors.push("Tanggal wajib diisi");
  }
  if (!data.pelanggan || typeof data.pelanggan !== "string" || !data.pelanggan.trim()) {
    errors.push("Pelanggan wajib diisi");
  }
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("Minimal 1 item diperlukan");
  } else {
    items.forEach((item: Record<string, unknown>, idx: number) => {
      if (!item.nama_item || typeof item.nama_item !== "string" || !(item.nama_item as string).trim()) {
        errors.push(`Item ${idx + 1}: nama item wajib diisi`);
      }
      if (!item.jumlah || typeof item.jumlah !== "number" || item.jumlah <= 0) {
        errors.push(`Item ${idx + 1}: jumlah harus > 0`);
      }
      if (!item.harga_satuan || typeof item.harga_satuan !== "number" || item.harga_satuan <= 0) {
        errors.push(`Item ${idx + 1}: harga satuan harus > 0`);
      }
    });
  }
  return errors;
}

const router: IRouter = Router();

async function getInvoiceWithItems(invoiceId: number) {
  const invoice = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!invoice.length) return null;

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoice_id, invoiceId));
  const itemsWithTotal = items.map((item) => ({
    ...item,
    total_item: item.jumlah * item.harga_satuan,
  }));
  const total_invoice = itemsWithTotal.reduce((sum, item) => sum + item.total_item, 0);

  return { ...invoice[0], items: itemsWithTotal, total_invoice };
}

router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const conditions: SQL[] = [];

    if (search && typeof search === "string") {
      conditions.push(
        ilike(invoicesTable.nomor_invoice, `%${search}%`)
      );
    }

    const invoices = conditions.length
      ? await db.select().from(invoicesTable).where(conditions[0]).orderBy(invoicesTable.id)
      : await db.select().from(invoicesTable).orderBy(invoicesTable.id);

    const result = await Promise.all(
      invoices.map(async (inv) => {
        const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoice_id, inv.id));
        const itemsWithTotal = items.map((item) => ({
          ...item,
          total_item: item.jumlah * item.harga_satuan,
        }));
        const total_invoice = itemsWithTotal.reduce((sum, item) => sum + item.total_item, 0);
        return { ...inv, items: itemsWithTotal, total_invoice };
      })
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/export/pdf", async (_req, res) => {
  try {
    const invoices = await db.select().from(invoicesTable).orderBy(invoicesTable.id);
    const allData = await Promise.all(
      invoices.map(async (inv) => {
        const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoice_id, inv.id));
        const total = items.reduce((sum, item) => sum + item.jumlah * item.harga_satuan, 0);
        return { ...inv, total_invoice: total };
      })
    );

    const grandTotal = allData.reduce((sum, inv) => sum + inv.total_invoice, 0);

    const doc = generatePdfReport({
      title: "DAFTAR INVOICE / MEMO",
      subtitle: `Total ${allData.length} invoice`,
      layout: "landscape",
      columns: [
        { label: "No.", width: 35, align: "center", getValue: (_r, i) => String(i + 1) },
        { label: "No. Invoice", width: 80, getValue: (r) => String(r.nomor_invoice ?? "-") },
        { label: "Tanggal", width: 80, getValue: (r) => formatTanggal(r.tanggal as string) },
        { label: "Pelanggan", width: 120, getValue: (r) => String(r.pelanggan ?? "-") },
        { label: "Kontak", width: 100, getValue: (r) => String(r.kontak_pelanggan ?? "-") },
        { label: "Keterangan", width: 130, getValue: (r) => String(r.keterangan ?? "-") },
        { label: "Total", width: 100, align: "right", getValue: (r) => formatRupiah(r.total_invoice as number) },
      ],
      data: allData as unknown as Record<string, unknown>[],
      totalLabel: "GRAND TOTAL",
      totalValue: formatRupiah(grandTotal),
      totalColumnIndex: 6,
      signatureLeft: "Dibuat oleh,",
      signatureRight: "Diketahui oleh,",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=daftar-invoice.pdf");
    doc.pipe(res);
    doc.end();
  } catch (error) {
    res.status(500).json({ error: "Failed to export PDF" });
  }
});

router.get("/export/excel", async (_req, res) => {
  try {
    const invoices = await db.select().from(invoicesTable).orderBy(invoicesTable.id);
    const allData = await Promise.all(
      invoices.map(async (inv, idx) => {
        const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoice_id, inv.id));
        const total = items.reduce((sum, item) => sum + item.jumlah * item.harga_satuan, 0);
        return {
          No: idx + 1,
          "No. Invoice": inv.nomor_invoice,
          Tanggal: inv.tanggal,
          Pelanggan: inv.pelanggan,
          Kontak: inv.kontak_pelanggan,
          Keterangan: inv.keterangan,
          "Total Invoice": total,
        };
      })
    );

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(allData);
    XLSX.utils.book_append_sheet(wb, ws, "Invoice");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=daftar-invoice.xlsx");
    res.send(buf);
  } catch (error) {
    res.status(500).json({ error: "Failed to export Excel" });
  }
});

router.get("/bulk-delete", (_req, res) => {
  res.status(405).json({ error: "Use POST method" });
});

router.post("/bulk-delete", async (req, res): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "IDs required" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.delete(invoiceItemsTable).where(inArray(invoiceItemsTable.invoice_id, ids));
      await tx.delete(invoicesTable).where(inArray(invoicesTable.id, ids));
    });
    res.json({ success: true, message: `${ids.length} invoice dihapus` });
  } catch (error) {
    res.status(500).json({ error: "Failed to bulk delete" });
  }
});

router.get("/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const result = await getInvoiceWithItems(id);
    if (!result) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

router.get("/:id/pdf", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const invoice = await getInvoiceWithItems(id);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoice.nomor_invoice}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).font("Helvetica-Bold").text("MEMO / INVOICE", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    doc.text(`No. Invoice: ${invoice.nomor_invoice}`, 50);
    doc.text(`Tanggal: ${formatTanggal(invoice.tanggal)}`, 50);
    doc.text(`Pelanggan: ${invoice.pelanggan}`, 50);
    if (invoice.kontak_pelanggan) doc.text(`Kontak: ${invoice.kontak_pelanggan}`, 50);
    if (invoice.keterangan) doc.text(`Keterangan: ${invoice.keterangan}`, 50);
    doc.moveDown(1);

    const tableTop = doc.y;
    const cols = [50, 80, 220, 280, 330, 400, 470];
    const colW = [30, 140, 60, 50, 70, 70, 0];

    doc.rect(50, tableTop, 495, 22).fill("#2563eb");
    doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
    doc.text("No.", cols[0] + 5, tableTop + 6, { width: colW[0] });
    doc.text("Nama Item", cols[1] + 5, tableTop + 6, { width: colW[1] });
    doc.text("Jumlah", cols[2] + 5, tableTop + 6, { width: colW[2], align: "right" });
    doc.text("Satuan", cols[3] + 5, tableTop + 6, { width: colW[3] });
    doc.text("Harga Satuan", cols[4] + 5, tableTop + 6, { width: colW[4], align: "right" });
    doc.text("Total", cols[5] + 5, tableTop + 6, { width: colW[5], align: "right" });

    let y = tableTop + 22;
    doc.fillColor("black").font("Helvetica").fontSize(8);

    invoice.items.forEach((item: { nama_item: string; jumlah: number; satuan: string; harga_satuan: number; total_item: number }, idx: number) => {
      if (idx % 2 === 0) {
        doc.save();
        doc.rect(50, y, 495, 18).fill("#f0f4ff");
        doc.restore();
        doc.fillColor("black");
      }
      doc.text(String(idx + 1), cols[0] + 5, y + 5, { width: colW[0], align: "center" });
      doc.text(item.nama_item, cols[1] + 5, y + 5, { width: colW[1] });
      doc.text(String(item.jumlah), cols[2] + 5, y + 5, { width: colW[2], align: "right" });
      doc.text(item.satuan, cols[3] + 5, y + 5, { width: colW[3] });
      doc.text(formatRupiah(item.harga_satuan), cols[4] + 5, y + 5, { width: colW[4], align: "right" });
      doc.text(formatRupiah(item.total_item), cols[5] + 5, y + 5, { width: colW[5], align: "right" });
      y += 18;
    });

    doc.rect(50, y, 495, 22).fill("#1e40af");
    doc.fillColor("white").font("Helvetica-Bold").fontSize(9);
    doc.text("TOTAL INVOICE", 55, y + 6, { width: 350 });
    doc.text(formatRupiah(invoice.total_invoice), cols[5] + 5, y + 6, { width: colW[5], align: "right" });
    y += 30;

    doc.fillColor("black").font("Helvetica");
    if (invoice.catatan) {
      doc.fontSize(9).text(`Catatan: ${invoice.catatan}`, 50, y);
      y = doc.y + 20;
    }

    y = Math.max(y, doc.y) + 30;
    doc.fontSize(9);
    doc.text("Dibuat oleh,", 80, y, { align: "left" });
    doc.text("Diterima oleh,", 380, y, { align: "left" });
    doc.text("________________", 70, y + 60);
    doc.text("________________", 370, y + 60);
    doc.fontSize(7);
    doc.text("Nama / Tanda Tangan", 60, y + 75);
    doc.text("Nama / Tanda Tangan", 360, y + 75);
    doc.fontSize(9);
    doc.text("Tanggal: _______________", 50, y + 90);
    doc.text("Tanggal: _______________", 350, y + 90);

    doc.end();
  } catch (error) {
    res.status(500).json({ error: "Failed to generate invoice PDF" });
  }
});

router.post("/", async (req, res): Promise<void> => {
  try {
    const { items, ...invoiceData } = req.body;

    const errors = validateInvoiceData(invoiceData, items);
    if (errors.length > 0) {
      res.status(400).json({ error: errors.join("; ") });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx.insert(invoicesTable).values({
        nomor_invoice: invoiceData.nomor_invoice,
        tanggal: invoiceData.tanggal,
        pelanggan: invoiceData.pelanggan,
        kontak_pelanggan: invoiceData.kontak_pelanggan || "",
        keterangan: invoiceData.keterangan || "",
        catatan: invoiceData.catatan || "",
      }).returning();

      for (const item of items) {
        await tx.insert(invoiceItemsTable).values({
          invoice_id: invoice.id,
          nama_item: item.nama_item,
          jumlah: item.jumlah,
          satuan: item.satuan || "pcs",
          harga_satuan: item.harga_satuan,
        });
      }

      return invoice.id;
    });

    const invoiceResult = await getInvoiceWithItems(result);
    res.status(201).json(invoiceResult);
  } catch (error) {
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.put("/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { items, ...invoiceData } = req.body;

    const errors = validateInvoiceData(invoiceData, items);
    if (errors.length > 0) {
      res.status(400).json({ error: errors.join("; ") });
      return;
    }

    const existing = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!existing.length) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(invoicesTable).set({
        nomor_invoice: invoiceData.nomor_invoice,
        tanggal: invoiceData.tanggal,
        pelanggan: invoiceData.pelanggan,
        kontak_pelanggan: invoiceData.kontak_pelanggan || "",
        keterangan: invoiceData.keterangan || "",
        catatan: invoiceData.catatan || "",
      }).where(eq(invoicesTable.id, id));

      await tx.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoice_id, id));

      for (const item of items) {
        await tx.insert(invoiceItemsTable).values({
          invoice_id: id,
          nama_item: item.nama_item,
          jumlah: item.jumlah,
          satuan: item.satuan || "pcs",
          harga_satuan: item.harga_satuan,
        });
      }
    });

    const result = await getInvoiceWithItems(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update invoice" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.transaction(async (tx) => {
      await tx.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoice_id, id));
      await tx.delete(invoicesTable).where(eq(invoicesTable.id, id));
    });
    res.json({ success: true, message: "Invoice deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

export default router;
