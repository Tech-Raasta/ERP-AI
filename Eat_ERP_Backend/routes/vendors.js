import express from "express";

import * as VendorController from "../controllers/vendors.js";

import checkAuth from "../middleware/check-auth.js";
import multer from "../middleware/file.js";

const router = express.Router();

const cpUpload = multer.fields(
    [
        { name: 'bank_document', maxCount: 1 }, 
        { name: 'gst_document', maxCount: 1 }, 
        { name: 'pan_document', maxCount: 1 }, 
        { name: 'msme_document', maxCount: 1 }
    ]
);

router.get("/getMasterData", checkAuth, VendorController.getMasterData);

router.post("", checkAuth, cpUpload, VendorController.createVendor);

router.put("/:id", checkAuth, cpUpload, VendorController.updateVendor);

router.get("", checkAuth, VendorController.getVendors);

router.get("/:id", checkAuth, VendorController.getVendor);

router.delete("/:id", checkAuth, VendorController.deleteVendor);

router.put("/approve/:id", checkAuth, VendorController.approveVendor);

router.put("/reject/:id", checkAuth, VendorController.rejectVendor);

export default router;