import { Router, type IRouter } from "express";
import healthRouter from "./health";
import purchasesRouter from "./purchases";
import purchasePlansRouter from "./purchase-plans";
import cashInRouter from "./cash-in";
import dashboardRouter from "./dashboard";
import backupRouter from "./backup";
import aiAssistantRouter from "./ai-assistant";
import invoicesRouter from "./invoices";
import financialSummaryRouter from "./financial-summary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(purchasesRouter);
router.use(purchasePlansRouter);
router.use(cashInRouter);
router.use(dashboardRouter);
router.use(backupRouter);
router.use(aiAssistantRouter);
router.use("/invoices", invoicesRouter);
router.use(financialSummaryRouter);

export default router;
