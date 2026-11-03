import { Router } from "express";

import * as SalesController from "../controllers/sales.js";

import checkAuth from "../middleware/check-auth.js";
import fileUpload from "../middleware/file.js";

const router = Router();

// Files are stored under assets/uploads/sales (receivable document, proof of dispatch / delivery)
const docUpload = fileUpload.any();

// Sales (old PHP Distributor_out). Phase 1: list and view. Phase 2: add / edit / delete (saved as Pending).
// Phase 3: approve / reject. Phase 4: gate pass, delivery, printouts.
router.get("/getMasterData", checkAuth, SalesController.getMasterData);

router.get("/itemDetails", checkAuth, SalesController.getItemDetails);

router.get("/consignees/:id", checkAuth, SalesController.getConsignees);

router.get("", checkAuth, SalesController.getSales);

router.post("", checkAuth, docUpload, SalesController.createSale);

router.put("/:id", checkAuth, docUpload, SalesController.updateSale);

router.delete("/:id", checkAuth, SalesController.deleteSale);

// Phase 3: approval (checkAuth lets 'approve' / 'reject' urls through on r_approvals; the controller re-checks it)
router.post("/:id/approve", checkAuth, SalesController.approveSale);

router.post("/:id/reject", checkAuth, SalesController.rejectSale);

// Phase 4: gate pass (Delivery Pending -> GP Issued) and delivery (GP Issued -> Delivered / back to HO), both need r_edit
router.get("/:id/dispatch", checkAuth, SalesController.getDispatch);

router.put("/:id/dispatch", checkAuth, docUpload, SalesController.dispatchSale);

router.put("/:id/delivery", checkAuth, docUpload, SalesController.updateDelivery);

// Printable HTML
router.get("/:id/invoice", checkAuth, SalesController.getInvoice);

router.get("/:id/gatePass", checkAuth, SalesController.getGatePass);

// id: 'd_<id>' or '<id>'
router.get("/:id", checkAuth, SalesController.getSale);

export default router;
