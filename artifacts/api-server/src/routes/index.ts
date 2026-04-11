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
import categoriesRouter from "./categories";
import suppliersRouter from "./suppliers";

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
router.use(categoriesRouter);
router.use(suppliersRouter);

export default router;
