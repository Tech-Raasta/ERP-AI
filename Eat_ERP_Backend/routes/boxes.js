import express from 'express';

import * as BoxController from '../controllers/boxes.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.get("/getMasterData", checkAuth, BoxController.getMasterData);

router.post("", checkAuth, BoxController.createBox);

router.put("/:id", checkAuth, BoxController.updateBox);

router.get("", checkAuth, BoxController.getBoxes);

router.get("/:id", checkAuth, BoxController.getBox);

export default router;
