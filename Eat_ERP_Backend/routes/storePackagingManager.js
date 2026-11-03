import express from "express";

import * as StorePackagingManagerController from "../controllers/storePackagingManager.js";

import checkAuth from "../middleware/check-auth.js";
// import multer from "../middleware/file.js";

const router = express.Router();

// const cpUpload = multer.fields(
//   [
//     { name: 'doc_document', maxCount: 1 }
//   ]
// );

router.get("/getDepotList", checkAuth, StorePackagingManagerController.getDepotList);

// router.get("/getMasterData", checkAuth, StorePackagingManagerController.getMasterData);

// router.get("/getProductionStock/:manufacturer_id/:product_id", checkAuth, StorePackagingManagerController.getProductionStock);

// router.post("", checkAuth, StorePackagingManagerController.createProduction);

router.put("/:id", checkAuth, StorePackagingManagerController.assemble);

router.get("", checkAuth, StorePackagingManagerController.getProductions);

// router.get("/rawMaterialRequest", checkAuth, StorePackagingManagerController.getRMRequest);

router.get("/:id", checkAuth, StorePackagingManagerController.getPackaging);

router.get("/getBarcodeStock/:id/:barcode", checkAuth, StorePackagingManagerController.getBarcodeStock);


router.get("/checkBarcode/:id/:barcode", checkAuth, StorePackagingManagerController.checkBarcode);


router.get("/getBatchRawMaterial/:id", checkAuth, StorePackagingManagerController.getBatchRawMaterial);

router.get("/getRawMaterialStock/:id", checkAuth, StorePackagingManagerController.getRawMaterialStock);

router.get("/getRawMaterialBarcodeStock/:id/:barcode", checkAuth, StorePackagingManagerController.getRawMaterialBarcodeStock);

router.put("/assembleRawMaterial/:id", checkAuth, StorePackagingManagerController.assembleRawMaterial);


router.put("/transfer/:id", checkAuth, StorePackagingManagerController.transfer);

router.put("/receive/:id", checkAuth, StorePackagingManagerController.receive);

router.put("/cancelReceive/:id", checkAuth, StorePackagingManagerController.cancelReceive);

// router.delete("/:id", checkAuth, StorePackagingManagerController.deleteProduction);

// router.put("/approve/:id", checkAuth, StorePackagingManagerController.approveProduction);

// router.put("/reject/:id", checkAuth, StorePackagingManagerController.rejectProduction);

// router.get("/getOldPoRate/:raw_material_id", checkAuth, StorePackagingManagerController.getOldPoRate);

export default router;