const express = require("express");

const SellUploadController = require("../controllers/sellUploads");

const checkAuth = require("../middleware/check-auth");

const uploadExcel = require("../middleware/upload-excel");

const router = express.Router();

// router.get("/getS3SignedUploadUrl", checkAuth, SellUploadController.getS3SignedUploadUrl);

router.get("/getSellUploadFormat", checkAuth, SellUploadController.getSellUploadFormat)

router.get("/getSellUploadDetails/:id", checkAuth, SellUploadController.getSellUploadDetails);

router.post("", checkAuth, uploadExcel, SellUploadController.createSellUpload);

// router.put("/:id", checkAuth, SellUploadController.updateSellUpload);

router.get("", checkAuth, SellUploadController.getSellUploads);

router.get("/:id", checkAuth, SellUploadController.getSellUpload);

router.delete("/:id", checkAuth, SellUploadController.deleteSellUpload);

router.put("/approve/:id", checkAuth, SellUploadController.approveSellUpload);

router.put("/reject/:id", checkAuth, SellUploadController.rejectSellUpload);

module.exports = router;
