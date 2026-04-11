import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { purchasesTable, cashInTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, inArray, or, sql } from "drizzle-orm";
import {
  CreatePurchaseBody,
  UpdatePurchaseBody,
  GetPurchasesQueryParams,
  GetPurchaseParams,
  UpdatePurchaseParams,
  DeletePurchaseParams,
  BulkDeletePurchasesBody,
  ExportPurchasesExcelQueryParams,
  ExportPurchasesPdfQueryParams,
} from "@workspace/api-zod";
import type { SQL } from "drizzle-orm";
import * as XLSX from "xlsx";
import { generatePdfReport, formatRupiah, formatTanggal, buildFilterInfoLines } from "./pdf-utils.js";

const router: IRouter = Router();

function buildPurchaseFilters(params: {
  search?: string;
  startDate?: string;
  endDate?: string;
  kategori?: string;
}): SQL[] {
  const conditions: SQL[] = [];
  if (params.search) {
    conditions.push(
      or(
        ilike(purchasesTable.keterangan, `%${params.search}%`),
        ilike(purchasesTable.nomor, `%${params.search}%`),
      )!,
    );
  }
  if (params.startDate) {
    conditions.push(gte(purchasesTable.tanggal, params.startDate));
  }
  if (params.endDate) {
    conditions.push(lte(purchasesTable.tanggal, params.endDate));
  }
  if (params.kategori) {
    conditions.push(eq(purchasesTable.kategori, params.kategori));
  }
  return conditions;
}

async function queryPurchases(conditions: SQL[], ids?: number[]) {
  if (ids && ids.length > 0) {
    return db.select().from(purchasesTable).where(inArray(purchasesTable.id, ids)).orderBy(purchasesTable.id);
  }
  return conditions.length > 0
    ? db.select().from(purchasesTable).where(and(...conditions)).orderBy(purchasesTable.id)
    : db.select().from(purchasesTable).orderBy(purchasesTable.id);
}

router.get("/purchases", async (req, res) => {
  try {
    const parsed = GetPurchasesQueryParams.safeParse(req.query);
    const filters = parsed.success ? parsed.data : {};
    const conditions = buildPurchaseFilters(filters);
    const data = await queryPurchases(conditions);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to get purchases");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/purchases", async (req, res) => {
  try {
    const parsed = CreatePurchaseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, catatan, kategori, supplier, supplier_contact } = parsed.data;
    const harga_total = jumlah * harga_satuan;

    const [created] = await db
      .insert(purchasesTable)
      .values({ nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total, catatan, kategori, supplier: supplier || null, supplier_contact: supplier_contact || null })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/purchases/bulk-delete", async (req, res) => {
  try {
    const parsed = BulkDeletePurchasesBody.safeParse(req.body);
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
      .delete(purchasesTable)
      .where(inArray(purchasesTable.id, ids))
      .returning();

    res.json({ success: true, message: `${deleted.length} data berhasil dihapus` });
  } catch (err) {
    req.log.error({ err }, "Failed to bulk delete purchases");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/purchases/export/excel", async (req, res) => {
  try {
    const parsed = ExportPurchasesExcelQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};
    const conditions = buildPurchaseFilters(params);
    const ids = params.ids ? params.ids.split(",").map(Number).filter((n) => !isNaN(n)) : undefined;
    const data = await queryPurchases(conditions, ids);

    const filterInfo = buildFilterInfoLines({
      startDate: params.startDate,
      endDate: params.endDate,
      kategori: params.kategori,
      search: params.search,
      selectedCount: ids?.length,
    });

    const headerRows: Record<string, string>[] = [
      { No: "LAPORAN DATA PEMBELIAN" },
    ];
    if (filterInfo.length > 0) {
      filterInfo.forEach((line) => headerRows.push({ No: line }));
    }
    headerRows.push({});

    const dataRows = data.map((r) => ({
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
    }));

    const grandTotal = data.reduce((sum, r) => sum + (r.harga_total ?? 0), 0);
    const [cashInResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${cashInTable.jumlah_kas_masuk}), 0)` })
      .from(cashInTable);
    const totalKasMasuk = Number(cashInResult.total) || 0;
    const saldoAkhir = totalKasMasuk - grandTotal;

    const summaryRows: Record<string, unknown>[] = [
      {},
      { Keterangan: "GRAND TOTAL", "Harga Total": grandTotal },
      {},
      { Keterangan: "Total Pengeluaran", "Harga Total": grandTotal },
      { Keterangan: "Total Kas Masuk", "Harga Total": totalKasMasuk },
      { Keterangan: "Saldo Akhir", "Harga Total": saldoAkhir },
    ];
    if (saldoAkhir < 0) {
      summaryRows.push({ Keterangan: "Kekurangan Dana", "Harga Total": Math.abs(saldoAkhir) });
    }

    const ws = XLSX.utils.json_to_sheet(headerRows, { skipHeader: true });
    XLSX.utils.sheet_add_json(ws, dataRows, { origin: headerRows.length });
    XLSX.utils.sheet_add_json(ws, summaryRows, { skipHeader: true, origin: headerRows.length + 1 + dataRows.length });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Pembelian");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=data-pembelian.xlsx");
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Failed to export purchases to Excel");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/purchases/export/pdf", async (req, res) => {
  try {
    const parsed = ExportPurchasesPdfQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};
    const conditions = buildPurchaseFilters(params);
    const ids = params.ids ? params.ids.split(",").map(Number).filter((n) => !isNaN(n)) : undefined;
    const data = await queryPurchases(conditions, ids);

    const grandTotal = data.reduce((sum, r) => sum + (r.harga_total ?? 0), 0);

    const [cashInResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${cashInTable.jumlah_kas_masuk}), 0)` })
      .from(cashInTable);
    const totalKasMasuk = Number(cashInResult.total) || 0;
    const saldoAkhir = totalKasMasuk - grandTotal;

    const summaryLines = [
      `Total Pengeluaran: ${formatRupiah(grandTotal)}`,
      `Total Kas Masuk: ${formatRupiah(totalKasMasuk)}`,
      `─────────────────────────`,
      `Saldo Akhir: ${formatRupiah(saldoAkhir)}`,
    ];
    if (saldoAkhir < 0) {
      summaryLines.push(`Kekurangan Dana: ${formatRupiah(Math.abs(saldoAkhir))}`);
    }

    const filterInfo = buildFilterInfoLines({
      startDate: params.startDate,
      endDate: params.endDate,
      kategori: params.kategori,
      search: params.search,
      selectedCount: ids?.length,
    });

    const doc = generatePdfReport({
      title: "LAPORAN DATA PEMBELIAN",
      subtitle: `Total ${data.length} transaksi`,
      filterInfo,
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
      footerSummaryLines: summaryLines,
      signatureLeft: "Dibuat oleh,",
      signatureRight: "Diketahui oleh,",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=data-pembelian.pdf");
    doc.pipe(res);
    doc.end();
  } catch (err) {
    req.log.error({ err }, "Failed to export purchases to PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/purchases/:id", async (req, res) => {
  try {
    const parsed = GetPurchaseParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [row] = await db
      .select()
      .from(purchasesTable)
      .where(eq(purchasesTable.id, parsed.data.id));

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/purchases/:id", async (req, res) => {
  try {
    const paramsParsed = UpdatePurchaseParams.safeParse({ id: Number(req.params.id) });
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const bodyParsed = UpdatePurchaseBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, catatan, kategori, supplier, supplier_contact } = bodyParsed.data;
    const harga_total = jumlah * harga_satuan;

    const [updated] = await db
      .update(purchasesTable)
      .set({ nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total, catatan, kategori, supplier: supplier || null, supplier_contact: supplier_contact || null })
      .where(eq(purchasesTable.id, paramsParsed.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/purchases/:id", async (req, res) => {
  try {
    const parsed = DeletePurchaseParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [deleted] = await db
      .delete(purchasesTable)
      .where(eq(purchasesTable.id, parsed.data.id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({ success: true, message: "Purchase deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
