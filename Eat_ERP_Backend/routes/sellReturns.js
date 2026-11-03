const express = require("express");

const SellReturnController = require("../controllers/sellReturns");

const checkAuth = require("../middleware/check-auth");
const checkFreeze = require("../middleware/check-freeze");

const router = express.Router();

router.get("/getMasterData", checkAuth, SellReturnController.getMasterData)

router.get("/getInvoiceNos/:distributor", checkAuth, SellReturnController.getInvoiceNos)

router.get("/getInvoiceDetails/:sellId", checkAuth, SellReturnController.getInvoiceDetails)

router.get("/updateSellReturnFromSells", checkAuth, SellReturnController.updateSellReturnFromSells)

router.post("", checkAuth, checkFreeze, SellReturnController.createSellReturn);

router.put("/:id", checkAuth, checkFreeze, SellReturnController.updateSellReturn);

router.get("", checkAuth, SellReturnController.getSellReturns);

router.get("/:id", checkAuth, SellReturnController.getSellReturn);

router.delete("/:id", checkAuth, checkFreeze, SellReturnController.deleteSellReturn);

router.put("/approve/:id", checkAuth, checkFreeze, SellReturnController.approveSellReturn);

router.put("/reject/:id", checkAuth, checkFreeze, SellReturnController.rejectSellReturn);

module.exports = router;
