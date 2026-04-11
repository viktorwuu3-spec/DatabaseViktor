import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { purchasesTable, cashInTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/financial-summary", async (_req, res) => {
  try {
    const [purchaseResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${purchasesTable.harga_total}), 0)` })
      .from(purchasesTable);

    const [cashInResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${cashInTable.jumlah_kas_masuk}), 0)` })
      .from(cashInTable);

    const total_pengeluaran = Number(purchaseResult.total) || 0;
    const total_kas_masuk = Number(cashInResult.total) || 0;
    const saldo_akhir = total_kas_masuk - total_pengeluaran;
    const kekurangan_dana = saldo_akhir < 0 ? Math.abs(saldo_akhir) : 0;

    res.json({
      total_pengeluaran,
      total_kas_masuk,
      saldo_akhir,
      kekurangan_dana,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get financial summary" });
  }
});

export default router;
