const express = require("express");

const SellController = require("../controllers/sells");

const checkAuth = require("../middleware/check-auth");
const checkFreeze = require("../middleware/check-freeze");

const router = express.Router();

router.get("/getMasterData", checkAuth, SellController.getMasterData);

router.get("/getSellInvoice/:id", checkAuth, SellController.getSellInvoice);

router.post("", checkAuth, checkFreeze, SellController.createSell);

router.put("/:id", checkAuth, checkFreeze, SellController.updateSell);

router.get("", checkAuth, SellController.getSells);

router.get("/:id", checkAuth, SellController.getSell);

router.delete("/:id", checkAuth, checkFreeze, SellController.deleteSell);

router.put("/approve/:id", checkAuth, checkFreeze, SellController.approveSell);

router.put("/reject/:id", checkAuth, checkFreeze, SellController.rejectSell);

module.exports = router;
