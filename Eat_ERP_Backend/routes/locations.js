import express from 'express';

import * as LocationController from '../controllers/locations.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.get("/getMasterData", checkAuth, LocationController.getMasterData);

router.post("", checkAuth, LocationController.createLocation);

router.put("/:id", checkAuth, LocationController.updateLocation);

router.get("", checkAuth, LocationController.getLocations);

export default router;
