import express from "express";

import * as ProductionPlanningController from "../controllers/productionPlanning.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.get("/getMasterData", checkAuth, ProductionPlanningController.getMasterData);

router.post("/getProductRawMaterials", checkAuth, ProductionPlanningController.getProductRawMaterials);

router.post("", checkAuth, ProductionPlanningController.createProductionPlanning);

router.put("/:id", checkAuth, ProductionPlanningController.updateProductionPlanning);

router.get("", checkAuth, ProductionPlanningController.getProductionPlannings);

router.get("/:id", checkAuth, ProductionPlanningController.getProductionPlanning);

router.delete("/:id", checkAuth, ProductionPlanningController.deleteProductionPlanning);

router.put("/approve/:id", checkAuth, ProductionPlanningController.approveProductionPlanning);

router.put("/reject/:id", checkAuth, ProductionPlanningController.rejectProductionPlanning);

// router.get("/getOldPoRate/:raw_material_id", checkAuth, ProductionPlanningController.getOldPoRate);

export default router;