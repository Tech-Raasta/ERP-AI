import express from 'express';

import * as ZoneController from '../controllers/zones.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.get("/getMasterData", checkAuth, ZoneController.getMasterData);

router.post("", checkAuth, ZoneController.createZone);

router.put("/:id", checkAuth, ZoneController.updateZone);

router.get("", checkAuth, ZoneController.getZones);

router.get("/:id", checkAuth, ZoneController.getZone);

export default router;
