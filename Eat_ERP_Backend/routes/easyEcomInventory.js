import express from "express";

import * as EassEcomInventory from "../controllers/easyEcomInventory.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.get("/", checkAuth, EassEcomInventory.getEasyEcomInventory);
router.get("/:production_id", checkAuth, EassEcomInventory.getEasyEcomInventoryById);
router.post("/", checkAuth, EassEcomInventory.updateBulkInventory);

export default router;