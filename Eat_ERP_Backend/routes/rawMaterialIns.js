import express from "express";

import * as RawMaterialInController from "../controllers/rawMaterialIns.js";

import checkAuth from "../middleware/check-auth.js";
import multer from "../middleware/file.js";

const router = express.Router();

const cpUpload = multer.fields(
  [
    { name: 'doc_document', maxCount: 10 }
  ]
);

router.get("/getMasterData", checkAuth, RawMaterialInController.getMasterData);

router.get("/setRawMaterialRate", checkAuth, RawMaterialInController.setRawMaterialRate);

router.get("/getVendorPos/:vendor_id", checkAuth, RawMaterialInController.getVendorPos);

router.get("/getPoDetails/:po_id", checkAuth, RawMaterialInController.getPoDetails);

router.post("", checkAuth, cpUpload, RawMaterialInController.createRawMaterialIn);

router.put("/:id", checkAuth, cpUpload, RawMaterialInController.updateRawMaterialIn);

router.put("/updateRate/:id", checkAuth, cpUpload, RawMaterialInController.updateRawMaterialInRate);

router.get("", checkAuth, RawMaterialInController.getRawMaterialIns);

router.get("/:id", checkAuth, RawMaterialInController.getRawMaterialIn);

router.delete("/:id", checkAuth, RawMaterialInController.deleteRawMaterialIn);

router.put("/grn_approve/:id", checkAuth, RawMaterialInController.approvePendingRawMaterialIn);


router.put("/approve/:id", checkAuth, RawMaterialInController.approveRawMaterialIn);

router.put("/reject/:id", checkAuth, RawMaterialInController.rejectRawMaterialIn);

router.delete("/deleteAttachment/:id", checkAuth, RawMaterialInController.deleteAttachment);

export default router;