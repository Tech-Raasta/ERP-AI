const express = require("express");

const CountryController = require("../controllers/countries");

const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.post("", checkAuth, CountryController.createCountry);

router.put("/:id", checkAuth, CountryController.updateCountry);

router.get("", checkAuth, CountryController.getCountries);

router.get("/:id", checkAuth, CountryController.getCountry);

router.delete("/:id", checkAuth, CountryController.deleteCountry);

module.exports = router;
