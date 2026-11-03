const express = require("express");

const SampleController = require("../controllers/samples");

const checkAuth = require("../middleware/check-auth");
const checkFreeze = require("../middleware/check-freeze");

const router = express.Router();

router.get("/getMasterData", checkAuth, SampleController.getMasterData)

router.post("", checkAuth, checkFreeze, SampleController.createSample);

router.put("/:id", checkAuth, checkFreeze, SampleController.updateSample);

router.get("", checkAuth, SampleController.getSamples);

router.get("/:id", checkAuth, SampleController.getSample);

router.delete("/:id", checkAuth, checkFreeze, SampleController.deleteSample);

router.put("/approve/:id", checkAuth, checkFreeze, SampleController.approveSample);

router.put("/reject/:id", checkAuth, checkFreeze, SampleController.rejectSample);

module.exports = router;
