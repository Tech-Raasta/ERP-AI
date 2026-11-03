import { Router } from "express";

import * as SalesReturnController from "../controllers/salesReturns.js";

import checkAuth from "../middleware/check-auth.js";

const router = Router();

// Sales Return (old PHP Distributor_in). Uses the 'Distributor_In' role section (check-auth maps /api/sales_return to it).
router.get("/getMasterData", checkAuth, SalesReturnController.getMasterData);

router.get("/invoices", checkAuth, SalesReturnController.getInvoices);

router.get("/invoiceDetails", checkAuth, SalesReturnController.getInvoiceDetails);

router.get("/itemDetails", checkAuth, SalesReturnController.getItemDetails);

router.get("", checkAuth, SalesReturnController.getSalesReturns);

router.post("", checkAuth, SalesReturnController.createSalesReturn);

router.put("/:id", checkAuth, SalesReturnController.updateSalesReturn);

router.delete("/:id", checkAuth, SalesReturnController.deleteSalesReturn);

// checkAuth lets 'approve' / 'reject' urls through on r_approvals; the controller re-checks it
router.post("/:id/approve", checkAuth, SalesReturnController.approveSalesReturn);

router.post("/:id/reject", checkAuth, SalesReturnController.rejectSalesReturn);

// Printable HTML
router.get("/:id/receipt", checkAuth, SalesReturnController.getReceipt);

router.get("/:id", checkAuth, SalesReturnController.getSalesReturn);

export default router;
