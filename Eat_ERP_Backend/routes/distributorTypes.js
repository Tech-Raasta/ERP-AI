import express from 'express';

import * as DistributorTypeController from '../controllers/distributorTypes.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.post("", checkAuth, DistributorTypeController.createDistributorType);

router.put("/:id", checkAuth, DistributorTypeController.updateDistributorType);

router.get("", checkAuth, DistributorTypeController.getDistributorTypes);

router.get("/:id", checkAuth, DistributorTypeController.getDistributorType);

export default router;
