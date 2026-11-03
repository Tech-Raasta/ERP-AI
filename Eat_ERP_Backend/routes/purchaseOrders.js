import express from "express";

import * as PurchaseOrderController from "../controllers/purchaseOrders.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.get("/mailPurchaseOrderDetails", PurchaseOrderController.mailPurchaseOrderDetails);

router.get("/getMasterData", checkAuth, PurchaseOrderController.getMasterData);

router.post("", checkAuth, PurchaseOrderController.createPurchaseOrder);

router.put("/:id", checkAuth, PurchaseOrderController.updatePurchaseOrder);

router.get("", checkAuth, PurchaseOrderController.getPurchaseOrders);

router.get("/:id", checkAuth, PurchaseOrderController.getPurchaseOrder);

router.delete("/:id", checkAuth, PurchaseOrderController.deletePurchaseOrder);

router.put("/approve/:id", checkAuth, PurchaseOrderController.approvePurchaseOrder);

router.put("/reject/:id", checkAuth, PurchaseOrderController.rejectPurchaseOrder);

router.get("/emailPurchaseOrder/:id", checkAuth, PurchaseOrderController.emailPurchaseOrder);

router.get("/getOldPoRate/:raw_material_id/:depot_id", checkAuth, PurchaseOrderController.getOldPoRate);

export default router;