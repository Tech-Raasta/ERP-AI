const express = require("express");

const DashboardController = require("../controllers/dashboard");

const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.get("/getData", checkAuth, DashboardController.getData);

module.exports = router;
