import express from "express";

import * as PackagingController from "../controllers/packaging.js";

import checkAuth from "../middleware/check-auth.js";
import multer from "../middleware/file.js";

const router = express.Router();

const cpUpload = multer.fields(
  [
    { name: 'doc_document', maxCount: 10 }
  ]
);

router.get("/mailPackagingDetails/:mailType", PackagingController.mailPackagingDetails);

router.get("/getDepotList", checkAuth, PackagingController.getDepotList);

router.get("/getMasterData", checkAuth, PackagingController.getMasterData);

router.get("/getPackagingStock/:manufacturer_id/:product_id", checkAuth, PackagingController.getPackagingStock);

router.get("/getManufacturerTotalStock/:production_id/:product_id", checkAuth, PackagingController.getManufacturerTotalStock);

router.post("", checkAuth, PackagingController.createPackaging);

router.put("/:id", checkAuth, PackagingController.updatePackaging);

router.get("", checkAuth, PackagingController.getPackagings);

// router.get("/rawMaterialRequest", checkAuth, PackagingController.getRMRequest);

router.get("/:id", checkAuth, PackagingController.getPackaging);

router.get("/getAllocations/:id", checkAuth, PackagingController.getAllocations);

router.put("/allocate/:id", checkAuth, PackagingController.allocate);

router.get("/getTransfers/:id", checkAuth, PackagingController.getTransfers);

router.put("/transfer/:id", checkAuth, PackagingController.transfer);

router.get("/getReturns/:id", checkAuth, PackagingController.getReturns);

router.put("/retain/:id", checkAuth, PackagingController.retainBalanceMaterial);

router.put("/return/:id", checkAuth, PackagingController.returnBalanceMaterial);

router.put("/waste/:id", checkAuth, PackagingController.wasteBalanceMaterial);

router.put("/allocationPending/:id", checkAuth, PackagingController.allocationPending);

router.put("/workInProgress/:id", checkAuth, PackagingController.workInProgress);

router.put("/submit/:id", checkAuth, PackagingController.submitPackaging);

router.delete("/:id", checkAuth, PackagingController.deletePackaging);

router.put("/approve/:id", checkAuth, PackagingController.approvePackaging);

router.put("/reject/:id", checkAuth, PackagingController.rejectPackaging);

router.get("/getBatchQty/:id", checkAuth, PackagingController.getBatchQty);

router.put("/updateBatchQty/:id", checkAuth, PackagingController.updateBatchQty);

router.put("/approveBatchQty/:id", checkAuth, PackagingController.approveBatchQty);

router.put("/rejectBatchQty/:id", checkAuth, PackagingController.rejectBatchQty);

router.put("/setBatchQty/:id", checkAuth, PackagingController.setBatchQty);

export default router;