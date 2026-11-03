import express from "express";

import * as DepotTransferController from "../controllers/depotTransfers.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.get("/getMasterData", checkAuth, DepotTransferController.getMasterData);

router.get("/getBarcodes/:type/:item_id", checkAuth, DepotTransferController.getBarcodes);

router.get("/getRawMaterialStock/:depot_id/:item_id", checkAuth, DepotTransferController.getRawMaterialStock);

router.post("", checkAuth, DepotTransferController.createDepotTransfer);

router.put("/:id", checkAuth, DepotTransferController.updateDepotTransfer);

router.get("", checkAuth, DepotTransferController.getDepotTransfers);

router.get("/:id", checkAuth, DepotTransferController.getDepotTransfer);

router.delete("/:id", checkAuth, DepotTransferController.deleteDepotTransfer);

router.put("/approve/:id", checkAuth, DepotTransferController.approveDepotTransfer);

router.put("/reject/:id", checkAuth, DepotTransferController.rejectDepotTransfer);

export default router;