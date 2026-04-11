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
import { generatePdfReport, formatRupiah, formatTanggal, buildFilterInfoLines } from "./pdf-utils.js";

const router: IRouter = Router();

function buildCashInFilters(params: {
  search?: string;
  startDate?: string;
  endDate?: string;
  kategori?: string;
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
  if (params.kategori) {
    if (params.kategori === "Lain-Lain") {
      conditions.push(eq(cashInTable.kategori, ""));
    } else {
      conditions.push(ilike(cashInTable.kategori, params.kategori));
    }
  }
  return conditions;
}

async function queryCashIn(conditions: SQL[], ids?: number[]) {
  if (ids && ids.length > 0) {
    return db.select().from(cashInTable).where(inArray(cashInTable.id, ids)).orderBy(cashInTable.id);
  }
  return conditions.length > 0
    ? db.select().from(cashInTable).where(and(...conditions)).orderBy(cashInTable.id)
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

async function getDistinctCategories(): Promise<string[]> {
  const result = await db
    .selectDistinct({ kategori: cashInTable.kategori })
    .from(cashInTable)
    .where(sql`${cashInTable.kategori} != ''`);
  return result.map((r) => r.kategori).sort();
}

router.get("/cash-in", async (req, res) => {
  try {
    const parsed = GetCashInListQueryParams.safeParse(req.query);
    const filters = parsed.success ? parsed.data : {};
    const conditions = buildCashInFilters(filters);
    const items = await queryCashIn(conditions);
    const totals = await getCashTotals();
    const kategori_list = await getDistinctCategories();

    res.json({
      items,
      kategori_list,
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

    const { nomor, tanggal, keterangan, jumlah_kas_masuk, kategori } = parsed.data;

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
        kategori: kategori || "",
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
    const totals = await getCashTotals();

    const namedCats = [...new Set(data.map((r) => r.kategori).filter((k) => k !== ""))].sort();
    const hasUncategorized = data.some((r) => !r.kategori);
    const categories = hasUncategorized && namedCats.length > 0 && !namedCats.includes("Lain-Lain") ? [...namedCats, "Lain-Lain"] : namedCats;
    const getDisplayKategori = (r: { kategori: string }) => r.kategori || "Lain-Lain";

    const filterInfo = buildFilterInfoLines({
      startDate: params.startDate,
      endDate: params.endDate,
      search: params.search,
      kategori: params.kategori,
      selectedCount: ids?.length,
    });

    const today = new Date();
    const headerRows: Record<string, string>[] = [
      { No: `Pengambilan Kas Terbaru Per ${formatTanggal(today.toISOString().split("T")[0])}` },
    ];
    if (filterInfo.length > 0) {
      filterInfo.forEach((line) => headerRows.push({ No: line }));
    }
    headerRows.push({});

    if (categories.length > 0) {
      const dataRows = data.map((r, idx) => {
        const row: Record<string, unknown> = {
          Nomor: idx + 1,
          Tanggal: r.tanggal,
        };
        for (const cat of categories) {
          row[cat] = getDisplayKategori(r) === cat ? r.jumlah_kas_masuk : null;
        }
        return row;
      });

      const totalRow: Record<string, unknown> = { Nomor: "Total", Tanggal: "" };
      for (const cat of categories) {
        totalRow[cat] = data
          .filter((r) => getDisplayKategori(r) === cat)
          .reduce((sum, r) => sum + (r.jumlah_kas_masuk ?? 0), 0);
      }

      const grandTotal = data.reduce((sum, r) => sum + (r.jumlah_kas_masuk ?? 0), 0);
      const grandTotalRow: Record<string, unknown> = { Nomor: "Total Keseluruhan", Tanggal: "" };
      grandTotalRow[categories[0] || "Total"] = grandTotal;

      const ws = XLSX.utils.json_to_sheet(headerRows, { skipHeader: true });
      XLSX.utils.sheet_add_json(ws, dataRows, { origin: headerRows.length });
      XLSX.utils.sheet_add_json(ws, [totalRow, {}, grandTotalRow], {
        skipHeader: true,
        origin: headerRows.length + 1 + dataRows.length,
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kas Masuk");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=kas-masuk.xlsx");
      res.send(buffer);
    } else {
      const dataRows = data.map((r) => ({
        No: r.nomor,
        Tanggal: r.tanggal,
        Keterangan: r.keterangan,
        "Jumlah Kas Masuk": r.jumlah_kas_masuk,
      }));

      const totalKasMasuk = data.reduce((sum, r) => sum + (r.jumlah_kas_masuk ?? 0), 0);

      const summaryRows: Record<string, unknown>[] = [
        {},
        { Keterangan: "TOTAL KAS MASUK", "Jumlah Kas Masuk": totalKasMasuk },
        {},
        { Keterangan: "Total Kas Masuk (Semua)", "Jumlah Kas Masuk": totals.total_kas_masuk },
        { Keterangan: "Total Pengeluaran", "Jumlah Kas Masuk": totals.total_pengeluaran },
        { Keterangan: "Sisa Kas", "Jumlah Kas Masuk": totals.sisa_kas },
      ];

      const ws = XLSX.utils.json_to_sheet(headerRows, { skipHeader: true });
      XLSX.utils.sheet_add_json(ws, dataRows, { origin: headerRows.length });
      XLSX.utils.sheet_add_json(ws, summaryRows, { skipHeader: true, origin: headerRows.length + 1 + dataRows.length });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kas Masuk");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=kas-masuk.xlsx");
      res.send(buffer);
    }
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

    const namedCatsPdf = [...new Set(data.map((r) => r.kategori).filter((k) => k !== ""))].sort();
    const hasUncatPdf = data.some((r) => !r.kategori);
    const categoriesPdf = hasUncatPdf && namedCatsPdf.length > 0 && !namedCatsPdf.includes("Lain-Lain") ? [...namedCatsPdf, "Lain-Lain"] : namedCatsPdf;
    const getDisplayKategoriPdf = (r: { kategori: string }) => r.kategori || "Lain-Lain";

    const filterInfo = buildFilterInfoLines({
      startDate: params.startDate,
      endDate: params.endDate,
      search: params.search,
      kategori: params.kategori,
      selectedCount: ids?.length,
    });

    const today = new Date();

    if (categoriesPdf.length > 0) {
      const catWidth = Math.min(140, Math.floor(380 / categoriesPdf.length));
      const columns = [
        { label: "No.", width: 35, align: "center" as const, getValue: (_r: Record<string, unknown>, i: number) => String(i + 1) },
        { label: "Tanggal", width: 80, getValue: (r: Record<string, unknown>) => formatTanggal(r.tanggal as string) },
        ...categoriesPdf.map((cat) => ({
          label: cat,
          width: catWidth,
          align: "right" as const,
          getValue: (r: Record<string, unknown>) =>
            getDisplayKategoriPdf(r as { kategori: string }) === cat ? formatRupiah(r.jumlah_kas_masuk as number) : "-",
        })),
      ];

      const totalRow: Record<string, unknown> = { _isTotal: true, tanggal: "" };
      const categoryTotals: Record<string, number> = {};
      for (const cat of categoriesPdf) {
        categoryTotals[cat] = data
          .filter((r) => getDisplayKategoriPdf(r) === cat)
          .reduce((sum, r) => sum + (r.jumlah_kas_masuk ?? 0), 0);
      }

      const grandTotal = data.reduce((sum, r) => sum + (r.jumlah_kas_masuk ?? 0), 0);

      const doc = generatePdfReport({
        title: `Pengambilan Kas Terbaru Per ${formatTanggal(today.toISOString().split("T")[0])}`,
        subtitle: `Total ${data.length} transaksi`,
        filterInfo,
        layout: categoriesPdf.length > 2 ? "landscape" : "portrait",
        columns,
        data: data as unknown as Record<string, unknown>[],
        summaryLines: [
          ...categoriesPdf.map((cat) => `Total ${cat}: ${formatRupiah(categoryTotals[cat])}`),
          `Total Keseluruhan: ${formatRupiah(grandTotal)}`,
        ],
        totalLabel: "TOTAL",
        totalValue: formatRupiah(grandTotal),
        totalColumnIndex: columns.length - 1,
        signatureLeft: "Dibuat oleh,",
        signatureRight: "Diketahui oleh,",
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=kas-masuk.pdf");
      doc.pipe(res);
      doc.end();
    } else {
      const totalKasMasuk = data.reduce((sum, r) => sum + (r.jumlah_kas_masuk ?? 0), 0);

      const doc = generatePdfReport({
        title: "LAPORAN KAS MASUK",
        subtitle: `Total ${data.length} transaksi`,
        filterInfo,
        layout: "portrait",
        columns: [
          { label: "No.", width: 40, align: "center", getValue: (_r, i) => String(i + 1) },
          { label: "Nomor", width: 85, getValue: (r) => String(r.nomor ?? "-") },
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
    }
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

    const { nomor, tanggal, keterangan, jumlah_kas_masuk, kategori } = bodyParsed.data;

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
        kategori: kategori || "",
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
