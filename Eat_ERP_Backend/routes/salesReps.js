import express from 'express';

import * as SalesRepController from '../controllers/salesReps.js';

import checkAuth from '../middleware/check-auth.js';
import multer from "../middleware/file.js";

const router = express.Router();

// Documents: files named doc_file_<row index> (stored in assets/uploads/sales_rep)
const docUpload = multer.any();

router.get("/getMasterData", checkAuth, SalesRepController.getMasterData);

router.post("", checkAuth, docUpload, SalesRepController.createSalesRep);

router.put("/:id", checkAuth, docUpload, SalesRepController.updateSalesRep);

router.get("", checkAuth, SalesRepController.getSalesReps);

router.get("/:id", checkAuth, SalesRepController.getSalesRep);

export default router;
