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
import * as XLSX from "xlsx";
import { generatePdfReport, formatRupiah, formatTanggal } from "./pdf-utils.js";

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

    const grandTotal = data.reduce((sum, r) => sum + (r.harga_total ?? 0), 0);

    const doc = generatePdfReport({
      title: "LAPORAN RENCANA PEMBELIAN",
      subtitle: `Total ${data.length} rencana`,
      layout: "landscape",
      columns: [
        { label: "No.", width: 35, align: "center", getValue: (_r, i) => String(i + 1) },
        { label: "Nomor", width: 65, getValue: (r) => String(r.nomor ?? "-") },
        { label: "Tanggal", width: 82, getValue: (r) => formatTanggal(r.tanggal as string) },
        { label: "Kategori", width: 62, getValue: (r) => String(r.kategori ?? "-") },
        { label: "Keterangan", width: 130, getValue: (r) => String(r.keterangan ?? "-") },
        { label: "Jml", width: 30, align: "right", getValue: (r) => String(r.jumlah ?? 0) },
        { label: "Satuan", width: 42, getValue: (r) => String(r.satuan ?? "-") },
        { label: "Harga Satuan", width: 85, align: "right", getValue: (r) => formatRupiah(r.harga_satuan as number) },
        { label: "Harga Total", width: 90, align: "right", getValue: (r) => formatRupiah(r.harga_total as number) },
        { label: "Supplier", width: 90, getValue: (r) => String(r.supplier ?? "-") },
      ],
      data: data as unknown as Record<string, unknown>[],
      totalLabel: "GRAND TOTAL",
      totalValue: formatRupiah(grandTotal),
      totalColumnIndex: 8,
      signatureLeft: "Diajukan oleh,",
      signatureRight: "Disetujui oleh,",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=rencana-pembelian.pdf");
    doc.pipe(res);
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
