import express from "express";

import checkAuth from "../middleware/check-auth.js";
import * as ProductionTransferController from "../controllers/productionTransfers.js";

const router = express.Router();

// router.post("", checkAuth, ProductionTransferController.createProductionTransfer);

// router.put("/:id", checkAuth, ProductionTransferController.updateProductionTransfer);

// router.get("/:id", checkAuth, ProductionTransferController.getProductionTransfer);

router.get("/:id", checkAuth, ProductionTransferController.getProductionTransfers);

router.delete("/:id", checkAuth, ProductionTransferController.deleteProductionTransfer);

router.post("/sync", checkAuth, ProductionTransferController.syncProductionTransfer);

router.put("/approve/:id", checkAuth, ProductionTransferController.approveProductionTransfer);

router.put("/reject/:id", checkAuth, ProductionTransferController.rejectProductionTransfer);

export default router;