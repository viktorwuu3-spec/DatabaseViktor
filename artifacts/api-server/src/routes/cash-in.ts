import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cashInTable, purchasesTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, inArray, or, sql } from "drizzle-orm";
import {
  CreateCashInBody,
  UpdateCashInBody,
  GetCashInListQueryParams,
  UpdateCashInParams,
  DeleteCashInParams,
  BulkDeleteCashInBody,
  ExportCashInExcelQueryParams,
  ExportCashInPdfQueryParams,
} from "@workspace/api-zod";
import type { SQL } from "drizzle-orm";
import * as XLSX from "xlsx";
import { generatePdfReport, formatRupiah, formatTanggal } from "./pdf-utils.js";

const router: IRouter = Router();

function buildCashInFilters(params: {
  search?: string;
  startDate?: string;
  endDate?: string;
}): SQL[] {
  const conditions: SQL[] = [];
  if (params.search) {
    conditions.push(
      or(
        ilike(cashInTable.keterangan, `%${params.search}%`),
        ilike(cashInTable.nomor, `%${params.search}%`),
      )!,
    );
  }
  if (params.startDate) {
    conditions.push(gte(cashInTable.tanggal, params.startDate));
  }
  if (params.endDate) {
    conditions.push(lte(cashInTable.tanggal, params.endDate));
  }
  return conditions;
}

async function queryCashIn(conditions: SQL[], ids?: number[]) {
  const allConditions = [...conditions];
  if (ids && ids.length > 0) {
    allConditions.push(inArray(cashInTable.id, ids));
  }
  return allConditions.length > 0
    ? db
        .select()
        .from(cashInTable)
        .where(and(...allConditions))
        .orderBy(cashInTable.id)
    : db.select().from(cashInTable).orderBy(cashInTable.id);
}

async function getCashTotals() {
  const [kasResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(jumlah_kas_masuk), 0)::float`,
    })
    .from(cashInTable);

  const [pengeluaranResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(harga_total), 0)::float`,
    })
    .from(purchasesTable);

  const total_kas_masuk = kasResult?.total ?? 0;
  const total_pengeluaran = pengeluaranResult?.total ?? 0;
  const sisa_kas = total_kas_masuk - total_pengeluaran;

  return { total_kas_masuk, total_pengeluaran, sisa_kas };
}

router.get("/cash-in", async (req, res) => {
  try {
    const parsed = GetCashInListQueryParams.safeParse(req.query);
    const filters = parsed.success ? parsed.data : {};
    const conditions = buildCashInFilters(filters);
    const items = await queryCashIn(conditions);
    const totals = await getCashTotals();

    res.json({
      items,
      ...totals,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get cash in entries");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cash-in", async (req, res) => {
  try {
    const parsed = CreateCashInBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { nomor, tanggal, keterangan, jumlah_kas_masuk } = parsed.data;

    if (jumlah_kas_masuk <= 0) {
      res.status(400).json({ error: "Jumlah kas masuk harus positif" });
      return;
    }

    const [created] = await db
      .insert(cashInTable)
      .values({
        nomor,
        tanggal,
        keterangan: keterangan || "",
        jumlah_kas_masuk,
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create cash in entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cash-in/bulk-delete", async (req, res) => {
  try {
    const parsed = BulkDeleteCashInBody.safeParse(req.body);
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
      .delete(cashInTable)
      .where(inArray(cashInTable.id, ids))
      .returning();

    res.json({
      success: true,
      message: `${deleted.length} data berhasil dihapus`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to bulk delete cash in");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/cash-in/export/excel", async (req, res) => {
  try {
    const parsed = ExportCashInExcelQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};
    const conditions = buildCashInFilters(params);
    const ids = params.ids
      ? params.ids
          .split(",")
          .map(Number)
          .filter((n) => !isNaN(n))
      : undefined;
    const data = await queryCashIn(conditions, ids);

    const ws = XLSX.utils.json_to_sheet(
      data.map((r) => ({
        No: r.nomor,
        Tanggal: r.tanggal,
        Keterangan: r.keterangan,
        "Jumlah Kas Masuk": r.jumlah_kas_masuk,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kas Masuk");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=kas-masuk.xlsx",
    );
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Failed to export cash in to Excel");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/cash-in/export/pdf", async (req, res) => {
  try {
    const parsed = ExportCashInPdfQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};
    const conditions = buildCashInFilters(params);
    const ids = params.ids
      ? params.ids.split(",").map(Number).filter((n) => !isNaN(n))
      : undefined;
    const data = await queryCashIn(conditions, ids);
    const totals = await getCashTotals();

    const totalKasMasuk = data.reduce((sum, r) => sum + (r.jumlah_kas_masuk ?? 0), 0);

    const doc = generatePdfReport({
      title: "LAPORAN KAS MASUK",
      subtitle: `Total ${data.length} transaksi`,
      layout: "portrait",
      columns: [
        { label: "No", width: 30, align: "center", getValue: (_r, i) => String(i + 1) },
        { label: "Nomor", width: 80, getValue: (r) => String(r.nomor ?? "-") },
        { label: "Tanggal", width: 100, getValue: (r) => formatTanggal(r.tanggal as string) },
        { label: "Keterangan", width: 150, getValue: (r) => String(r.keterangan ?? "-") },
        { label: "Jumlah Kas Masuk", width: 120, align: "right", getValue: (r) => formatRupiah(r.jumlah_kas_masuk as number) },
      ],
      data: data as unknown as Record<string, unknown>[],
      summaryLines: [
        `Total Kas Masuk: ${formatRupiah(totals.total_kas_masuk)}`,
        `Total Pengeluaran: ${formatRupiah(totals.total_pengeluaran)}`,
        `Sisa Kas: ${formatRupiah(totals.sisa_kas)}`,
      ],
      totalLabel: "TOTAL KAS MASUK",
      totalValue: formatRupiah(totalKasMasuk),
      totalColumnIndex: 4,
      signatureLeft: "Dibuat oleh,",
      signatureRight: "Diketahui oleh,",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=kas-masuk.pdf");
    doc.pipe(res);
    doc.end();
  } catch (err) {
    req.log.error({ err }, "Failed to export cash in to PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/cash-in/:id", async (req, res) => {
  try {
    const paramsParsed = UpdateCashInParams.safeParse({
      id: Number(req.params.id),
    });
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const bodyParsed = UpdateCashInBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { nomor, tanggal, keterangan, jumlah_kas_masuk } = bodyParsed.data;

    if (jumlah_kas_masuk <= 0) {
      res.status(400).json({ error: "Jumlah kas masuk harus positif" });
      return;
    }

    const [updated] = await db
      .update(cashInTable)
      .set({
        nomor,
        tanggal,
        keterangan: keterangan || "",
        jumlah_kas_masuk,
      })
      .where(eq(cashInTable.id, paramsParsed.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update cash in entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cash-in/:id", async (req, res) => {
  try {
    const parsed = DeleteCashInParams.safeParse({
      id: Number(req.params.id),
    });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [deleted] = await db
      .delete(cashInTable)
      .where(eq(cashInTable.id, parsed.data.id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({ success: true, message: "Cash in entry deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete cash in entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { getCashTotals };
export default router;
