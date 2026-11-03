const express = require("express");

const FreezeController = require("../controllers/freezes");

const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.post("", checkAuth, FreezeController.createFreeze);

// router.put("/:id", checkAuth, FreezeController.updateFreeze);

router.get("/:financialYear", checkAuth, FreezeController.getFreezes);

// router.get("/:id", checkAuth, FreezeController.getFreeze);

// router.delete("/:id", checkAuth, FreezeController.deleteFreeze);

module.exports = router;
