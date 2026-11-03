import express from "express";

import * as RawMaterialReconController from "../controllers/rawMaterialRecon.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.get("/getMasterData", checkAuth, RawMaterialReconController.getMasterData);

router.get("/getBarcodes/:raw_material_id", checkAuth, RawMaterialReconController.getBarcodes);

router.get("/getBarcodeStock/:id/:depot_id/:barcode", checkAuth, RawMaterialReconController.getBarcodeStock);

router.post("", checkAuth, RawMaterialReconController.createRawMaterialRecon);

router.put("/:id", checkAuth, RawMaterialReconController.updateRawMaterialRecon);

router.get("", checkAuth, RawMaterialReconController.getRawMaterialRecons);

router.get("/:id", checkAuth, RawMaterialReconController.getRawMaterialRecon);

router.delete("/:id", checkAuth, RawMaterialReconController.deleteRawMaterialRecon);

router.put("/approve/:id", checkAuth, RawMaterialReconController.approveRawMaterialRecon);

router.put("/reject/:id", checkAuth, RawMaterialReconController.rejectRawMaterialRecon);

export default router;