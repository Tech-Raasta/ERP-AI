import express from "express";

import * as EasyEcomApiController from "../controllers/easyEcomApis.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.post("/authentication", checkAuth, EasyEcomApiController.authentication);

router.get("/getInventoryWithBarcode", checkAuth, EasyEcomApiController.getInventoryWithBarcode);

router.post("/updateBulkInventoryWithBatchCode", checkAuth, EasyEcomApiController.updateBulkInventoryWithBatchCode);

// router.get("/getAllOrders/:startDate/:endDate", EasyEcomApiController.getAllOrders);
router.get("/getAllOrders", EasyEcomApiController.getAllOrders);
router.get("/getAllOrdersOnlySales", EasyEcomApiController.getAllOrdersOnlySales);
router.get("/getAllOrdersOnlySalesReturn", EasyEcomApiController.getAllOrdersOnlySalesReturn);

router.get("/getShopifyOrder/:name", EasyEcomApiController.getShopifyOrder);

export default router;