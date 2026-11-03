import express from 'express';

import * as BatchMasterController from '../controllers/batchMasters.js';

import checkAuth from '../middleware/check-auth.js';
import multer from "../middleware/file.js";

const router = express.Router();

// Batch documents: files named doc_file_<row index> (stored in assets/uploads/batch_master)
const docUpload = multer.any();

router.get("/getMasterData", checkAuth, BatchMasterController.getMasterData);

router.post("", checkAuth, docUpload, BatchMasterController.createBatchMaster);

router.put("/:id", checkAuth, docUpload, BatchMasterController.updateBatchMaster);

router.get("", checkAuth, BatchMasterController.getBatchMasters);

router.get("/:id", checkAuth, BatchMasterController.getBatchMaster);

export default router;
