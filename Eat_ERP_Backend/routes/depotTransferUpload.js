import { Router } from "express";
import checkAuth from "../middleware/check-auth.js";
import multer from "../middleware/excel-file.js";

import { approveDepotTransferUpload, createDepotTransferUpload, getDepotTransferUploadFormat, getDepotTransferUploads, rejectDepotTransferUpload } from "../controllers/depotTransferUploadFiles.js";

const router = Router();

const cpUpload = multer.fields(
    [
        { name: 'doc_document', maxCount: 1 }
    ]
);

router.get("/getDepotTransferUploadFormat", checkAuth, getDepotTransferUploadFormat)
router.post("", checkAuth, cpUpload, createDepotTransferUpload);
router.put("/approve/:id", checkAuth, approveDepotTransferUpload);
router.put("/reject/:id", checkAuth, rejectDepotTransferUpload);
router.get("", checkAuth, getDepotTransferUploads);

export default router;
