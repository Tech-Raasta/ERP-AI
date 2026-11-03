import express from "express";

import * as ReportController from "../controllers/reports.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.post("/production", checkAuth, ReportController.production);

// The Reports screen: lib/reports holds the definitions; access from the 'Reports' role section and the role's report ticks
router.get("/catalog", checkAuth, ReportController.catalog);

router.get("/options/:key", checkAuth, ReportController.options);

router.post("/preview/:key", checkAuth, ReportController.previewReport);

router.post("/download/:key", checkAuth, ReportController.downloadReport);

// router.post("/stock", checkAuth, ReportController.stock);

// router.post("/sale", checkAuth, ReportController.sale);

// router.post("/summary", checkAuth, ReportController.summary);

export default router;