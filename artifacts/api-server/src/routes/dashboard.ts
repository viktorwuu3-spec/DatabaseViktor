import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { purchasesTable, purchasePlansTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const [purchaseStats] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        total_spend: sql<number>`COALESCE(SUM(harga_total), 0)::float`,
      })
      .from(purchasesTable);

    const [planStats] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        total_planned: sql<number>`COALESCE(SUM(harga_total), 0)::float`,
      })
      .from(purchasePlansTable);

    const [thisMonthPurchases] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(purchasesTable)
      .where(sql`tanggal LIKE ${currentMonth + "%"}`);

    const [thisMonthPlans] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(purchasePlansTable)
      .where(sql`tanggal LIKE ${currentMonth + "%"}`);

    res.json({
      total_purchases: purchaseStats?.total ?? 0,
      total_purchase_plans: planStats?.total ?? 0,
      total_spend: purchaseStats?.total_spend ?? 0,
      total_planned: planStats?.total_planned ?? 0,
      this_month_purchases: thisMonthPurchases?.count ?? 0,
      this_month_plans: thisMonthPlans?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent", async (req, res) => {
  try {
    const recentPurchases = await db
      .select()
      .from(purchasesTable)
      .orderBy(sql`id DESC`)
      .limit(5);

    const recentPlans = await db
      .select()
      .from(purchasePlansTable)
      .orderBy(sql`id DESC`)
      .limit(5);

    res.json({
      recent_purchases: recentPurchases,
      recent_plans: recentPlans,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get recent activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
