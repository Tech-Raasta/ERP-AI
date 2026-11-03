import express from "express";

import * as ProductionController from "../controllers/productions.js";

import checkAuth from "../middleware/check-auth.js";
import multer from "../middleware/file.js";

const router = express.Router();

const cpUpload = multer.fields(
  [
    { name: 'doc_document', maxCount: 10 }
  ]
);

router.get("/mailProductionDetails/:mailType", ProductionController.mailProductionDetails);

router.get("/getDepotList", checkAuth, ProductionController.getDepotList);

router.get("/getMasterData", checkAuth, ProductionController.getMasterData);

router.get("/getProductionStock/:manufacturer_id/:product_id", checkAuth, ProductionController.getProductionStock);

router.get("/getManufacturerTotalStock/:production_id/:product_id", checkAuth, ProductionController.getManufacturerTotalStock);

router.post("", checkAuth, ProductionController.createProduction);

router.put("/:id", checkAuth, ProductionController.updateProduction);

router.get("", checkAuth, ProductionController.getProductions);

// router.get("/rawMaterialRequest", checkAuth, ProductionController.getRMRequest);

router.get("/:id", checkAuth, ProductionController.getProduction);

router.get("/getAllocations/:id", checkAuth, ProductionController.getAllocations);

//  Track barode
router.get("/trackBarcode/:barcode", checkAuth, ProductionController.trackProduction);

router.get("/getPackagingMaterialStock/:raw_material_id/:depot_id", checkAuth, ProductionController.getPackagingMaterialStock);

router.put("/allocate/:id", checkAuth, ProductionController.allocate);

router.get("/getTransfers/:id", checkAuth, ProductionController.getTransfers);

router.put("/transfer/:id", checkAuth, ProductionController.transfer);

router.get("/getReturns/:id", checkAuth, ProductionController.getReturns);

router.put("/retain/:id", checkAuth, ProductionController.retainBalanceMaterial);

router.put("/return/:id", checkAuth, ProductionController.returnBalanceMaterial);

router.put("/waste/:id", checkAuth, ProductionController.wasteBalanceMaterial);

router.put("/allocationPending/:id", checkAuth, ProductionController.allocationPending);

router.put("/workInProgress/:id", checkAuth, ProductionController.workInProgress);

router.put("/submit/:id", checkAuth, ProductionController.submitProduction);

router.delete("/:id", checkAuth, ProductionController.deleteProduction);

router.delete("/force/:id", checkAuth, ProductionController.forceDeleteProduction);

router.put("/approve/:id", checkAuth, ProductionController.approveProduction);

router.put("/reject/:id", checkAuth, ProductionController.rejectProduction);

router.get("/getBatchQty/:id", checkAuth, ProductionController.getBatchQty);

router.put("/updateBatchQty/:id", checkAuth, ProductionController.updateBatchQty);

router.put("/approveBatchQty/:id", checkAuth, ProductionController.approveBatchQty);

router.put("/rejectBatchQty/:id", checkAuth, ProductionController.rejectBatchQty);

router.put("/setBatchQty/:id", checkAuth, ProductionController.setBatchQty);

export default router;