import express from "express";

import * as BatchProcessingController from "../controllers/batchProcessing.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

// Batch Processing (Transaction -> Production, old PHP Batch_processing); access from the 'Batch_Processing' role section
router.get("", checkAuth, BatchProcessingController.getBatches);

router.get("/master", checkAuth, BatchProcessingController.getMasterData);

router.get("/recipe/:productId", checkAuth, BatchProcessingController.getRecipe);

router.get("/barcodes", checkAuth, BatchProcessingController.getBarcodes);

router.get("/print/:id", checkAuth, BatchProcessingController.getBatchPrint);

router.post("/batch_no", checkAuth, BatchProcessingController.createBatchNo);

router.put("/approve/:id", checkAuth, BatchProcessingController.approveBatch);

router.put("/reject/:id", checkAuth, BatchProcessingController.rejectBatch);

router.get("/:id", checkAuth, BatchProcessingController.getBatch);

router.post("", checkAuth, BatchProcessingController.createBatch);

router.put("/:id", checkAuth, BatchProcessingController.updateBatch);

router.delete("/:id", checkAuth, BatchProcessingController.deleteBatch);

export default router;
