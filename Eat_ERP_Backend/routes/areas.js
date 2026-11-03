import express from 'express';

import * as AreaController from '../controllers/areas.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.get("/getMasterData", checkAuth, AreaController.getMasterData);

router.post("", checkAuth, AreaController.createArea);

router.put("/:id", checkAuth, AreaController.updateArea);

router.get("", checkAuth, AreaController.getAreas);

export default router;
