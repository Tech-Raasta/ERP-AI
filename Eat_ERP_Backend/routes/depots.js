import express from "express";

import * as DepotController from "../controllers/depots.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.get("/getMasterData", checkAuth, DepotController.getMasterData);

router.post("", checkAuth, DepotController.createDepot);

router.put("/:id", checkAuth, DepotController.updateDepot);

router.get("", checkAuth, DepotController.getDepots);

router.get("/:id", checkAuth, DepotController.getDepot);

export default router;
