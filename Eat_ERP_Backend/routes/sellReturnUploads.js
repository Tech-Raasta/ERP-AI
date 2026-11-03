const express = require("express");

const SellReturnUploadController = require("../controllers/sellReturnUploads");

const checkAuth = require("../middleware/check-auth");

const uploadExcel = require("../middleware/upload-excel");

const router = express.Router();

router.get("/getSellReturnUploadFormat", checkAuth, SellReturnUploadController.getSellReturnUploadFormat)

router.get("/getSellReturnUploadDetails/:id", checkAuth, SellReturnUploadController.getSellReturnUploadDetails);

router.post("", checkAuth, uploadExcel, SellReturnUploadController.createSellReturnUpload);

// router.put("/:id", checkAuth, SellReturnUploadController.updateSellReturnUpload);

router.get("", checkAuth, SellReturnUploadController.getSellReturnUploads);

router.get("/:id", checkAuth, SellReturnUploadController.getSellReturnUpload);

router.delete("/:id", checkAuth, SellReturnUploadController.deleteSellReturnUpload);

router.put("/approve/:id", checkAuth, SellReturnUploadController.approveSellReturnUpload);

router.put("/reject/:id", checkAuth, SellReturnUploadController.rejectSellReturnUpload);

module.exports = router;
