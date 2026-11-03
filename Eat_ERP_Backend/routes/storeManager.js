import express from "express";

import * as StoreManagerController from "../controllers/storeManager.js";

import checkAuth from "../middleware/check-auth.js";
// import multer from "../middleware/file.js";

const router = express.Router();

// const cpUpload = multer.fields(
//   [
//     { name: 'doc_document', maxCount: 1 }
//   ]
// );

router.get("/getDepotList", checkAuth, StoreManagerController.getDepotList);

// router.get("/getMasterData", checkAuth, StoreManagerController.getMasterData);

// router.get("/getProductionStock/:manufacturer_id/:product_id", checkAuth, StoreManagerController.getProductionStock);

// router.post("", checkAuth, StoreManagerController.createProduction);

router.put("/:id", checkAuth, StoreManagerController.assemble);

router.get("", checkAuth, StoreManagerController.getProductions);

// router.get("/rawMaterialRequest", checkAuth, StoreManagerController.getRMRequest);

router.get("/:id", checkAuth, StoreManagerController.getProduction);

router.get("/getBarcodeStock/:id/:barcode", checkAuth, StoreManagerController.getBarcodeStock);


router.get("/checkBarcode/:id/:barcode", checkAuth, StoreManagerController.checkBarcode);


router.get("/getBatchRawMaterial/:id", checkAuth, StoreManagerController.getBatchRawMaterial);

router.get("/getRawMaterialStock/:id", checkAuth, StoreManagerController.getRawMaterialStock);

router.get("/getRawMaterialBarcodeStock/:id/:barcode", checkAuth, StoreManagerController.getRawMaterialBarcodeStock);

router.put("/assembleRawMaterial/:id", checkAuth, StoreManagerController.assembleRawMaterial);


router.put("/transfer/:id", checkAuth, StoreManagerController.transfer);

router.put("/receive/:id", checkAuth, StoreManagerController.receive);

router.put("/cancelReceive/:id", checkAuth, StoreManagerController.cancelReceive);

// router.delete("/:id", checkAuth, StoreManagerController.deleteProduction);

// router.put("/approve/:id", checkAuth, StoreManagerController.approveProduction);

// router.put("/reject/:id", checkAuth, StoreManagerController.rejectProduction);

// router.get("/getOldPoRate/:raw_material_id", checkAuth, StoreManagerController.getOldPoRate);

export default router;