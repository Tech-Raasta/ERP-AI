import express from 'express';

import * as PincodeController from '../controllers/pincodes.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.get("/getMasterData", checkAuth, PincodeController.getMasterData);

router.post("", checkAuth, PincodeController.createPincode);

router.put("/:id", checkAuth, PincodeController.updatePincode);

router.get("", checkAuth, PincodeController.getPincodes);

router.get("/:id", checkAuth, PincodeController.getPincode);

router.delete("/:id", checkAuth, PincodeController.deletePincode);

export default router;
