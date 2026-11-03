import express from 'express';

import * as DistributorController from '../controllers/distributors.js';

import checkAuth from '../middleware/check-auth.js';
import multer from "../middleware/file.js";

const router = express.Router();

// Distributor document: file field 'doc_file' (stored in assets/uploads/distributor)
const docUpload = multer.any();

router.get("/getMasterData", checkAuth, DistributorController.getMasterData);

router.post("", checkAuth, docUpload, DistributorController.createDistributor);

router.put("/:id", checkAuth, docUpload, DistributorController.updateDistributor);

router.get("", checkAuth, DistributorController.getDistributors);

// id: 'd_<id>' (distributor) or 's_<id>' (pending sales rep retailer)
router.get("/:id", checkAuth, DistributorController.getDistributor);

export default router;
