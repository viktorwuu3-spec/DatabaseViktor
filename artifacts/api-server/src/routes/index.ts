import { Router, type IRouter } from "express";
import healthRouter from "./health";
import purchasesRouter from "./purchases";
import purchasePlansRouter from "./purchase-plans";
import dashboardRouter from "./dashboard";
import backupRouter from "./backup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(purchasesRouter);
router.use(purchasePlansRouter);
router.use(dashboardRouter);
router.use(backupRouter);

export default router;
