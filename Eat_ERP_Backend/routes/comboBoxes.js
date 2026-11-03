import express from 'express';

import * as ComboBoxController from '../controllers/comboBoxes.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.get("/getMasterData", checkAuth, ComboBoxController.getMasterData);

router.post("", checkAuth, ComboBoxController.createComboBox);

router.put("/:id", checkAuth, ComboBoxController.updateComboBox);

router.get("", checkAuth, ComboBoxController.getComboBoxes);

router.get("/:id", checkAuth, ComboBoxController.getComboBox);

export default router;
