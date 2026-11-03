import express from "express";

import * as PaymentController from "../controllers/payments.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

// Payment Details (Transaction -> Bank, old PHP Payment); access from the 'Payment' role section
router.get("", checkAuth, PaymentController.getPayments);

router.get("/master", checkAuth, PaymentController.getMasterData);

router.get("/distributor", checkAuth, PaymentController.getDistributorDetails);

router.get("/slip/:id", checkAuth, PaymentController.getPaymentSlip);

router.put("/approve/:id", checkAuth, PaymentController.approvePayment);

router.put("/reject/:id", checkAuth, PaymentController.rejectPayment);

router.get("/:id", checkAuth, PaymentController.getPayment);

router.post("", checkAuth, PaymentController.createPayment);

router.put("/:id", checkAuth, PaymentController.updatePayment);

router.delete("/:id", checkAuth, PaymentController.deletePayment);

export default router;
