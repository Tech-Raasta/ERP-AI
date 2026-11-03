const express = require("express");

const ShopifyApiController = require("../controllers/shopifyApis");

// const checkAuth = require("../middleware/check-auth");

// const uploadExcel = require("../middleware/upload-excel");

const router = express.Router();

router.get("/getOrders", ShopifyApiController.getOrders);

router.get("/updateOrders", ShopifyApiController.updateOrders);

// router.get("/getFbaShipmentReport", ShopifyApiController.getFbaShipmentReport);

// router.get("/getFbaShipmentReportDocument", ShopifyApiController.getFbaShipmentReportDocument);

// router.get("/downloadFbaShipmentReport", ShopifyApiController.downloadFbaShipmentReport);

// router.get("/getOrders", ShopifyApiController.getOrders);

module.exports = router;
