import express from "express";

import * as SellingPartnerApiController from "../controllers/sellingPartnerApis.js";

// const checkAuth = require("../middleware/check-auth");

// const uploadExcel = require("../middleware/upload-excel");

const router = express.Router();

// router.get("/createFbaShipmentReport", SellingPartnerApiController.createFbaShipmentReport);

// router.get("/getFbaShipmentReport", SellingPartnerApiController.getFbaShipmentReport);

// router.get("/getFbaShipmentReportDocument", SellingPartnerApiController.getFbaShipmentReportDocument);

router.get("/downloadFbaShipmentReport", SellingPartnerApiController.downloadFbaShipmentReport);

router.get("/getOrders", SellingPartnerApiController.getSpApiOrders);

router.get("/getOrder/:orderId", SellingPartnerApiController.getSpApiOrder);

router.get("/getOrderItems/:orderId", SellingPartnerApiController.getSpApiOrderItems);

router.get("/downloadFbaReturnReport", SellingPartnerApiController.downloadFbaReturnReport);

// router.get("/updateOrders", SellingPartnerApiController.updateOrders);

export default router;
