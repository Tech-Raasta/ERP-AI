import express from "express";

import * as OldPaymentUploadController from "../controllers/oldPaymentUploads.js";

import checkAuth from "../middleware/check-auth.js";
import { xlsxUpload } from "../lib/excelUpload.js";

const router = express.Router();

const handleUpload = xlsxUpload(OldPaymentUploadController.UPLOAD_PATH, 'payment_upload');

// Old Payment Upload (old PHP Payment_upload); access from the 'Payment' role section
router.get("", checkAuth, OldPaymentUploadController.getOldPaymentUploads);

router.get("/format", checkAuth, OldPaymentUploadController.getUploadFormat);

router.get("/slips/:id", checkAuth, OldPaymentUploadController.getPaymentSlips);

router.get("/notes/:id", checkAuth, OldPaymentUploadController.getCreditNotes);

router.post("", checkAuth, handleUpload, OldPaymentUploadController.createOldPaymentUpload);

router.post("/process/:id", checkAuth, OldPaymentUploadController.processOldPaymentUpload);

router.put("/approve/:id", checkAuth, OldPaymentUploadController.approveOldPaymentUpload);

router.put("/reject/:id", checkAuth, OldPaymentUploadController.rejectOldPaymentUpload);

export default router;
