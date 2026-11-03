import express from "express";

import * as RequisitionController from "../controllers/requisition.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.get("/getMasterData", checkAuth, RequisitionController.getMasterData);

router.get("/getRequisitionItems/:depot_id", checkAuth, RequisitionController.getRequisitionItems);

router.get("/getItemStock/:depot_id/:item_id", checkAuth, RequisitionController.getItemStock);

router.post("", checkAuth, RequisitionController.createRequisition);

router.put("/:id", checkAuth, RequisitionController.updateRequisition);

router.put("/raiseProduction/:id", checkAuth, RequisitionController.raiseProduction);

router.get("", checkAuth, RequisitionController.getRequisitions);

router.get("/:id", checkAuth, RequisitionController.getRequisition);

router.delete("/:id", checkAuth, RequisitionController.deleteRequisition);

router.put("/approve/:id", checkAuth, RequisitionController.approveRequisition);

router.put("/reject/:id", checkAuth, RequisitionController.rejectRequisition);

// router.get("/getOldPoRate/:raw_material_id", checkAuth, RequisitionController.getOldPoRate);

export default router;