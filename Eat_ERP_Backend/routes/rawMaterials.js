import express from 'express';

import * as RawMaterialController from '../controllers/rawMaterials.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.post("", checkAuth, RawMaterialController.createRawMaterial);

router.put("/:id", checkAuth, RawMaterialController.updateRawMaterial);

router.get("", checkAuth, RawMaterialController.getRawMaterials);

router.get("/:id", checkAuth, RawMaterialController.getRawMaterial);

router.delete("/:id", checkAuth, RawMaterialController.deleteRawMaterial);

export default router;