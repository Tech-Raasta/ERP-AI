import express from "express";

import * as RawMaterialInOutController from "../controllers/rawMaterialInOut.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.get("/getMasterData", checkAuth, RawMaterialInOutController.getMasterData);

router.get("/getBarcodes/:raw_material_id/:depot_id", checkAuth, RawMaterialInOutController.getBarcodes);

router.post("", checkAuth, RawMaterialInOutController.createRawMaterialInOut);

router.put("/:id", checkAuth, RawMaterialInOutController.updateRawMaterialInOut);

router.get("", checkAuth, RawMaterialInOutController.getRawMaterialInOuts);

router.get("/:id", checkAuth, RawMaterialInOutController.getRawMaterialInOut);

router.delete("/:id", checkAuth, RawMaterialInOutController.deleteRawMaterialInOut);

router.put("/approve/:id", checkAuth, RawMaterialInOutController.approveRawMaterialInOut);

router.put("/reject/:id", checkAuth, RawMaterialInOutController.rejectRawMaterialInOut);

export default router;