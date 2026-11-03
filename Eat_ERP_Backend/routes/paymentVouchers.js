import express from "express";

import * as PaymentVoucherController from "../controllers/paymentVouchers.js";

import checkAuth from "../middleware/check-auth.js";
import multer from "../middleware/file.js";

const router = express.Router();

const cpUpload = multer.fields(
  [
    { name: 'doc_document', maxCount: 10 }
  ]
);

router.get("/getMasterData", checkAuth, PaymentVoucherController.getMasterData);

router.get("/getVendorPos/:vendor_id", checkAuth, PaymentVoucherController.getVendorPos);

router.get("/getPoDetails/:po_id", checkAuth, PaymentVoucherController.getPoDetails);

router.post("", checkAuth, cpUpload, PaymentVoucherController.createPaymentVoucher);

router.put("/:id", checkAuth, cpUpload, PaymentVoucherController.updatePaymentVoucher);

router.get("", checkAuth, PaymentVoucherController.getPaymentVouchers);

router.get("/:id", checkAuth, PaymentVoucherController.getPaymentVoucher);

router.delete("/:id", checkAuth, PaymentVoucherController.deletePaymentVoucher);

router.put("/check/:id", checkAuth, PaymentVoucherController.checkPaymentVoucher);

router.put("/approve/:id", checkAuth, PaymentVoucherController.approvePaymentVoucher);

router.put("/reject/:id", checkAuth, PaymentVoucherController.rejectPaymentVoucher);

router.put("/rejectGrn/:id", checkAuth, PaymentVoucherController.rejectGrn);

export default router;