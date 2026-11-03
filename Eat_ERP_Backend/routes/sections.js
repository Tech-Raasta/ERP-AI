const express = require("express");

const SectionController = require("../controllers/sections");

const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.post("", checkAuth, SectionController.createSection);

router.put("/:id", checkAuth, SectionController.updateSection);

router.get("", checkAuth, SectionController.getSections);

router.get("/:id", checkAuth, SectionController.getSection);

router.delete("/:id", checkAuth, SectionController.deleteSection);

module.exports = router;
