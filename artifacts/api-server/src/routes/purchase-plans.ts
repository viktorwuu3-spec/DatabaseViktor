import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { purchasePlansTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, inArray, or } from "drizzle-orm";
import {
  CreatePurchasePlanBody,
  UpdatePurchasePlanBody,
  GetPurchasePlansQueryParams,
  GetPurchasePlanParams,
  UpdatePurchasePlanParams,
  DeletePurchasePlanParams,
  BulkDeletePurchasePlansBody,
  ExportPurchasePlansExcelQueryParams,
  ExportPurchasePlansPdfQueryParams,
} from "@workspace/api-zod";
import type { SQL } from "drizzle-orm";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

const router: IRouter = Router();

function buildPlanFilters(params: {
  search?: string;
  startDate?: string;
  endDate?: string;
  kategori?: string;
}): SQL[] {
  const conditions: SQL[] = [];
  if (params.search) {
    conditions.push(
      or(
        ilike(purchasePlansTable.keterangan, `%${params.search}%`),
        ilike(purchasePlansTable.nomor, `%${params.search}%`),
      )!,
    );
  }
  if (params.startDate) {
    conditions.push(gte(purchasePlansTable.tanggal, params.startDate));
  }
  if (params.endDate) {
    conditions.push(lte(purchasePlansTable.tanggal, params.endDate));
  }
  if (params.kategori) {
    conditions.push(eq(purchasePlansTable.kategori, params.kategori));
  }
  return conditions;
}

async function queryPlans(conditions: SQL[], ids?: number[]) {
  const allConditions = [...conditions];
  if (ids && ids.length > 0) {
    allConditions.push(inArray(purchasePlansTable.id, ids));
  }
  return allConditions.length > 0
    ? db.select().from(purchasePlansTable).where(and(...allConditions)).orderBy(purchasePlansTable.id)
    : db.select().from(purchasePlansTable).orderBy(purchasePlansTable.id);
}

router.get("/purchase-plans", async (req, res) => {
  try {
    const parsed = GetPurchasePlansQueryParams.safeParse(req.query);
    const filters = parsed.success ? parsed.data : {};
    const conditions = buildPlanFilters(filters);
    const data = await queryPlans(conditions);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to get purchase plans");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/purchase-plans", async (req, res) => {
  try {
    const parsed = CreatePurchasePlanBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, catatan, kategori, supplier, supplier_contact } = parsed.data;
    const harga_total = jumlah * harga_satuan;

    const [created] = await db
      .insert(purchasePlansTable)
      .values({ nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total, catatan, kategori, supplier: supplier || null, supplier_contact: supplier_contact || null })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create purchase plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/purchase-plans/bulk-delete", async (req, res) => {
  try {
    const parsed = BulkDeletePurchasePlansBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input: ids array required" });
      return;
    }

    const { ids } = parsed.data;
    if (ids.length === 0) {
      res.status(400).json({ error: "No IDs provided" });
      return;
    }

    const deleted = await db
      .delete(purchasePlansTable)
      .where(inArray(purchasePlansTable.id, ids))
      .returning();

    res.json({ success: true, message: `${deleted.length} data berhasil dihapus` });
  } catch (err) {
    req.log.error({ err }, "Failed to bulk delete purchase plans");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/purchase-plans/export/excel", async (req, res) => {
  try {
    const parsed = ExportPurchasePlansExcelQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};
    const conditions = buildPlanFilters(params);
    const ids = params.ids ? params.ids.split(",").map(Number).filter((n) => !isNaN(n)) : undefined;
    const data = await queryPlans(conditions, ids);

    const ws = XLSX.utils.json_to_sheet(
      data.map((r) => ({
        No: r.nomor,
        Tanggal: r.tanggal,
        Kategori: r.kategori || "-",
        Keterangan: r.keterangan,
        Jumlah: r.jumlah,
        Satuan: r.satuan,
        "Harga Satuan": r.harga_satuan,
        "Harga Total": r.harga_total,
        Supplier: r.supplier || "-",
        Kontak: r.supplier_contact || "-",
        Catatan: r.catatan,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rencana Pembelian");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=rencana-pembelian.xlsx");
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Failed to export purchase plans to Excel");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/purchase-plans/export/pdf", async (req, res) => {
  try {
    const parsed = ExportPurchasePlansPdfQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};
    const conditions = buildPlanFilters(params);
    const ids = params.ids ? params.ids.split(",").map(Number).filter((n) => !isNaN(n)) : undefined;
    const data = await queryPlans(conditions, ids);

    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=rencana-pembelian.pdf");
    doc.pipe(res);

    doc.fontSize(16).font("Helvetica-Bold").text("LAPORAN RENCANA PEMBELIAN", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");

    const cols = [
      { label: "No", key: "nomor", width: 55 },
      { label: "Tanggal", key: "tanggal", width: 70 },
      { label: "Kategori", key: "kategori", width: 65 },
      { label: "Keterangan", key: "keterangan", width: 120 },
      { label: "Jumlah", key: "jumlah", width: 50 },
      { label: "Satuan", key: "satuan", width: 50 },
      { label: "Harga Sat.", key: "harga_satuan", width: 80 },
      { label: "Total", key: "harga_total", width: 80 },
      { label: "Supplier", key: "supplier", width: 80 },
    ];

    const tableTop = doc.y;
    let x = 40;

    doc.font("Helvetica-Bold");
    cols.forEach((col) => {
      doc.text(col.label, x, tableTop, { width: col.width });
      x += col.width;
    });

    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(800, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica");
    data.forEach((row) => {
      const y = doc.y;
      x = 40;
      cols.forEach((col) => {
        const val = String((row as Record<string, unknown>)[col.key] ?? "-");
        doc.text(val || "-", x, y, { width: col.width });
        x += col.width;
      });
      doc.moveDown(0.3);
    });

    doc.moveTo(40, doc.y).lineTo(800, doc.y).stroke();
    doc.moveDown(2);

    const sigY = doc.y;
    doc.font("Helvetica").fontSize(10);
    doc.text("Diajukan oleh", 40, sigY);
    doc.text("Disetujui oleh", 500, sigY);
    doc.moveDown(3);
    const lineY = doc.y;
    doc.moveTo(40, lineY).lineTo(200, lineY).stroke();
    doc.moveTo(500, lineY).lineTo(660, lineY).stroke();
    doc.moveDown(0.5);
    doc.text("Tanggal: __________", 40, doc.y);
    doc.text("Tanggal: __________", 500, doc.y - 15);

    doc.end();
  } catch (err) {
    req.log.error({ err }, "Failed to export purchase plans to PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/purchase-plans/:id", async (req, res) => {
  try {
    const parsed = GetPurchasePlanParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [row] = await db
      .select()
      .from(purchasePlansTable)
      .where(eq(purchasePlansTable.id, parsed.data.id));

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get purchase plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/purchase-plans/:id", async (req, res) => {
  try {
    const paramsParsed = UpdatePurchasePlanParams.safeParse({ id: Number(req.params.id) });
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const bodyParsed = UpdatePurchasePlanBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, catatan, kategori, supplier, supplier_contact } = bodyParsed.data;
    const harga_total = jumlah * harga_satuan;

    const [updated] = await db
      .update(purchasePlansTable)
      .set({ nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total, catatan, kategori, supplier: supplier || null, supplier_contact: supplier_contact || null })
      .where(eq(purchasePlansTable.id, paramsParsed.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update purchase plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/purchase-plans/:id", async (req, res) => {
  try {
    const parsed = DeletePurchasePlanParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [deleted] = await db
      .delete(purchasePlansTable)
      .where(eq(purchasePlansTable.id, parsed.data.id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({ success: true, message: "Purchase plan deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete purchase plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
