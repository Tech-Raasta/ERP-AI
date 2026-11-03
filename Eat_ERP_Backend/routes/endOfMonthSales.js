import { Router } from "express";

import * as EndOfMonthSalesController from "../controllers/endOfMonthSales.js";

import checkAuth from "../middleware/check-auth.js";

const router = Router();

// End of Month Sales (old PHP Freezed). Admin only: the controller checks the role (old PHP role_id 1).
router.get("", checkAuth, EndOfMonthSalesController.getMonths);

router.post("/freeze", checkAuth, EndOfMonthSalesController.freezeMonth);

router.post("/report", checkAuth, EndOfMonthSalesController.generateReport);

router.get("/report", checkAuth, EndOfMonthSalesController.downloadReport);

export default router;
