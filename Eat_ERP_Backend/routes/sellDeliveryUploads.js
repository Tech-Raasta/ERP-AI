const express = require("express");

const SellDeliveryUploadController = require("../controllers/sellDeliveryUploads");

const checkAuth = require("../middleware/check-auth");

const uploadExcel = require("../middleware/upload-excel");

const router = express.Router();

router.get("/getSellDeliveryUploadFormat", checkAuth, SellDeliveryUploadController.getSellDeliveryUploadFormat)

// router.get("/getSellDeliveryUploadDetails/:id", checkAuth, SellDeliveryUploadController.getSellDeliveryUploadDetails);

router.post("", checkAuth, uploadExcel, SellDeliveryUploadController.createSellDeliveryUpload);

// router.put("/:id", checkAuth, SellDeliveryUploadController.updateSellDeliveryUpload);

router.get("", checkAuth, SellDeliveryUploadController.getSellDeliveryUploads);

// router.get("/:id", checkAuth, SellDeliveryUploadController.getSellDeliveryUpload);

router.delete("/:id", checkAuth, SellDeliveryUploadController.deleteSellDeliveryUpload);

// router.put("/approve/:id", checkAuth, SellDeliveryUploadController.approveSellDeliveryUpload);

// router.put("/reject/:id", checkAuth, SellDeliveryUploadController.rejectSellDeliveryUpload);

module.exports = router;
