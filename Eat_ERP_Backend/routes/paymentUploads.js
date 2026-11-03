import { Router } from "express";
import checkAuth from "../middleware/check-auth.js";
import multer from "../middleware/file.js";

import {
  getPaymentUploadFormat,
  createPaymentUpload,
  getPaymentUploads,
  getPaymentUpload,
  approvePaymentUpload,
  rejectPaymentUpload,
  generatePaymentSlip,
  generateCreditDebitNote,
  getMasterData,
  createPaymentUploadSummary
} from "../controllers/paymentUploads.js";

const router = Router();

const cpUpload = multer.fields([
  { name: 'doc_document', maxCount: 1 }
]);

router.get("/getPaymentUploadFormat", checkAuth, getPaymentUploadFormat);
router.post("", checkAuth, cpUpload, createPaymentUpload);

// POST /api/payment_upload/summary
router.post("/summary", checkAuth, createPaymentUploadSummary);

router.get("", checkAuth, getPaymentUploads);
router.get("/getMasterData", checkAuth, getMasterData);
router.get("/payment_slip/:id", checkAuth, generatePaymentSlip);
router.get("/credit_debit_note/:id", checkAuth, generateCreditDebitNote);
router.get("/:id", checkAuth, getPaymentUpload);
router.put("/approve/:id", checkAuth, approvePaymentUpload);
router.put("/reject/:id", checkAuth, rejectPaymentUpload);

export default router;
