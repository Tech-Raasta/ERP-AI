import express from "express";

import * as SaleUploadController from "../controllers/saleUploads.js";

import checkAuth from "../middleware/check-auth.js";
import { xlsxUpload } from "../lib/excelUpload.js";

const router = express.Router();

const handleUpload = xlsxUpload(SaleUploadController.UPLOAD_PATH, 'sales_upload');

// Sales Upload (old PHP Sales_upload); access from the Sales role section (Distributor_Out)
router.get("", checkAuth, SaleUploadController.getSaleUploads);

router.get("/format", checkAuth, SaleUploadController.getUploadFormat);

router.get("/invoices/:id", checkAuth, SaleUploadController.getSaleUploadInvoices);

router.post("", checkAuth, handleUpload, SaleUploadController.createSaleUpload);

router.post("/process/:id", checkAuth, SaleUploadController.processSaleUpload);

router.put("/approve/:id", checkAuth, SaleUploadController.approveSaleUpload);

router.put("/reject/:id", checkAuth, SaleUploadController.rejectSaleUpload);

export default router;
