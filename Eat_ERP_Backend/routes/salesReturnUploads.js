import express from "express";

import * as SalesReturnUploadController from "../controllers/salesReturnUploads.js";

import checkAuth from "../middleware/check-auth.js";
import { xlsxUpload } from "../lib/excelUpload.js";

const router = express.Router();

const handleUpload = xlsxUpload(SalesReturnUploadController.UPLOAD_PATH, 'sales_return_upload');

// Sales Return Upload (old PHP Sales_return_upload); access from the Sales Return role section (Distributor_In)
router.get("", checkAuth, SalesReturnUploadController.getSalesReturnUploads);

router.get("/format", checkAuth, SalesReturnUploadController.getUploadFormat);

router.get("/receipts/:id", checkAuth, SalesReturnUploadController.getSalesReturnUploadReceipts);

router.post("", checkAuth, handleUpload, SalesReturnUploadController.createSalesReturnUpload);

router.post("/process/:id", checkAuth, SalesReturnUploadController.processSalesReturnUpload);

router.put("/approve/:id", checkAuth, SalesReturnUploadController.approveSalesReturnUpload);

router.put("/reject/:id", checkAuth, SalesReturnUploadController.rejectSalesReturnUpload);

export default router;
