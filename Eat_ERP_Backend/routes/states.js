const express = require("express");

const StateController = require("../controllers/states");

const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.post("", checkAuth, StateController.createState);

router.put("/:id", checkAuth, StateController.updateState);

router.get("", checkAuth, StateController.getStates);

router.get("/:id", checkAuth, StateController.getState);

router.delete("/:id", checkAuth, StateController.deleteState);

module.exports = router;
