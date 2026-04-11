import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { purchasePlansTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
import {
  CreatePurchasePlanBody,
  UpdatePurchasePlanBody,
  GetPurchasePlansQueryParams,
  GetPurchasePlanParams,
  UpdatePurchasePlanParams,
  DeletePurchasePlanParams,
} from "@workspace/api-zod";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

const router: IRouter = Router();

router.get("/purchase-plans", async (req, res) => {
  try {
    const parsed = GetPurchasePlansQueryParams.safeParse(req.query);
    const search = parsed.success ? parsed.data.search : undefined;
    const tanggal = parsed.success ? parsed.data.tanggal : undefined;

    let conditions = [];
    if (search) {
      conditions.push(ilike(purchasePlansTable.keterangan, `%${search}%`));
    }
    if (tanggal) {
      conditions.push(eq(purchasePlansTable.tanggal, tanggal));
    }

    const data =
      conditions.length > 0
        ? await db
            .select()
            .from(purchasePlansTable)
            .where(and(...conditions))
            .orderBy(purchasePlansTable.id)
        : await db
            .select()
            .from(purchasePlansTable)
            .orderBy(purchasePlansTable.id);

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

    const { nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, catatan } = parsed.data;
    const harga_total = jumlah * harga_satuan;

    const [created] = await db
      .insert(purchasePlansTable)
      .values({ nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total, catatan })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create purchase plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/purchase-plans/export/excel", async (req, res) => {
  try {
    const data = await db.select().from(purchasePlansTable).orderBy(purchasePlansTable.id);

    const ws = XLSX.utils.json_to_sheet(
      data.map((r) => ({
        No: r.nomor,
        Tanggal: r.tanggal,
        Keterangan: r.keterangan,
        Jumlah: r.jumlah,
        Satuan: r.satuan,
        "Harga Satuan": r.harga_satuan,
        "Harga Total": r.harga_total,
        Catatan: r.catatan,
      }))
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
    const data = await db.select().from(purchasePlansTable).orderBy(purchasePlansTable.id);

    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=rencana-pembelian.pdf");
    doc.pipe(res);

    doc.fontSize(16).font("Helvetica-Bold").text("LAPORAN PENGAJUAN PEMBELIAN", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");

    const cols = [
      { label: "No", key: "nomor", width: 60 },
      { label: "Tanggal", key: "tanggal", width: 80 },
      { label: "Keterangan", key: "keterangan", width: 150 },
      { label: "Jumlah", key: "jumlah", width: 60 },
      { label: "Satuan", key: "satuan", width: 60 },
      { label: "Harga Satuan", key: "harga_satuan", width: 90 },
      { label: "Harga Total", key: "harga_total", width: 90 },
      { label: "Catatan", key: "catatan", width: 110 },
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
        const val = String((row as Record<string, unknown>)[col.key] ?? "");
        doc.text(val, x, y, { width: col.width });
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

    const { nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, catatan } = bodyParsed.data;
    const harga_total = jumlah * harga_satuan;

    const [updated] = await db
      .update(purchasePlansTable)
      .set({ nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total, catatan })
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
