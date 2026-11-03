import express from 'express';

import * as CityController from '../controllers/cities.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.get("/getMasterData", checkAuth, CityController.getMasterData);

router.post("", checkAuth, CityController.createCity);

router.put("/:id", checkAuth, CityController.updateCity);

router.get("", checkAuth, CityController.getCities);

router.delete("/:id", checkAuth, CityController.deleteCity);

export default router;
