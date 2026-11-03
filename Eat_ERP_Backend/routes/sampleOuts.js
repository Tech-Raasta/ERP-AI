import { Router } from "express";

import * as SampleController from "../controllers/sampleOuts.js";
import * as SalesController from "../controllers/sales.js";

import checkAuth from "../middleware/check-auth.js";
import fileUpload from "../middleware/file.js";

const router = Router();

// Files (receivable document) are stored under assets/uploads/sample_out
const docUpload = fileUpload.any();

// Sample / Expiry (old PHP Sample_out). Uses the 'Distributor_Out' (Sales) role section like the old menu.
router.get("/getMasterData", checkAuth, SampleController.getMasterData);

router.get("/itemDetails", checkAuth, SampleController.getItemDetails);

router.get("", checkAuth, SampleController.getSamples);

router.post("", checkAuth, docUpload, SampleController.createSample);

router.put("/:id", checkAuth, docUpload, SampleController.updateSample);

// Same delete / reject rules as Sales, limited to sample rows
router.delete("/:id", checkAuth, SampleController.onlySamples, SalesController.deleteSale);

router.post("/:id/approve", checkAuth, SampleController.approveSample);

router.post("/:id/reject", checkAuth, SampleController.onlySamples, SalesController.rejectSale);

// Gate pass (Delivery Pending -> GP Issued) and delivery (GP Issued -> Delivered / back to HO / cancelled)
router.get("/:id/dispatch", checkAuth, SampleController.getDispatch);

router.put("/:id/dispatch", checkAuth, docUpload, SampleController.dispatchSample);

router.put("/:id/delivery", checkAuth, SampleController.updateDelivery);

// Printable HTML
router.get("/:id/voucher", checkAuth, SampleController.getVoucher);

router.get("/:id/gatePass", checkAuth, SampleController.getGatePass);

router.get("/:id", checkAuth, SampleController.getSample);

export default router;
