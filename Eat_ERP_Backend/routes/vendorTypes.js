import express from 'express';

import * as VendorTypeController from '../controllers/vendorType.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.post("", checkAuth, VendorTypeController.createVendorType);

router.put("/:id", checkAuth, VendorTypeController.updateVendorType);

router.get("", checkAuth, VendorTypeController.getVendorTypes);

router.get("/:id", checkAuth, VendorTypeController.getVendorType);

// No delete: the old PHP app switches a vendor type off with status InActive

export default router;
