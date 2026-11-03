import express from "express";

import * as VendorPaymentController from "../controllers/vendorPayments.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

// router.get("/getMasterData", checkAuth, VendorPaymentController.getMasterData);

router.get("", checkAuth, VendorPaymentController.getVendorPayments);

router.post("", checkAuth, VendorPaymentController.createVendorPayment);

router.put("/:id", checkAuth, VendorPaymentController.updateVendorPayment);

router.get("/addVendorPayment", checkAuth, VendorPaymentController.addVendorPayment);

router.get("/editVendorPayment/:id", checkAuth, VendorPaymentController.editVendorPayment);

router.get("/generateVendorPaymentFile/:id", checkAuth, VendorPaymentController.generateVendorPaymentFile);

router.get("/sendVendorPaymentFile/:id", checkAuth, VendorPaymentController.sendVendorPaymentFile);

router.get("/:id", checkAuth, VendorPaymentController.getVendorPayment);

router.delete("/:id", checkAuth, VendorPaymentController.deleteVendorPayment);

router.put("/approve/:id", checkAuth, VendorPaymentController.approveVendorPayment);

router.put("/reject/:id", checkAuth, VendorPaymentController.rejectVendorPayment);

export default router;