import { Router } from "express";

import { getSalesUploadFormat, getSalesUploadDetails, createSalesUpload, getSalesUploads, getSalesUpload, deleteSalesUpload, approveSalesUpload, rejectSalesUpload } from "../controllers/salesUploads.js";

import checkAuth from "../middleware/check-auth.js";
import multer from "../middleware/file.js";
// import uploadExcel from "../middleware/upload-excel.js";

const router = Router();

const cpUpload = multer.fields(
    [
        { name: 'uploadFile', maxCount: 1 }
    ]
);

// router.get("/getS3SignedUploadUrl", checkAuth, SalesUploadController.getS3SignedUploadUrl);

router.get("/getSalesUploadFormat", checkAuth, getSalesUploadFormat)

router.get("/getSalesUploadDetails/:id", checkAuth, getSalesUploadDetails);

router.post("", checkAuth, cpUpload, createSalesUpload);

// router.put("/:id", checkAuth, SalesUploadController.updateSalesUpload);

router.get("", checkAuth, getSalesUploads);

router.get("/:id", checkAuth, getSalesUpload);

router.delete("/:id", checkAuth, deleteSalesUpload);

router.put("/approve/:id", checkAuth, approveSalesUpload);

router.put("/reject/:id", checkAuth, rejectSalesUpload);

export default router;
