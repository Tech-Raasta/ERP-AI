const express = require("express");

const StockReconciliationController = require("../controllers/stockReconciliations");

const checkAuth = require("../middleware/check-auth");
const checkFreeze = require("../middleware/check-freeze");

const router = express.Router();

router.get("/getMasterData", checkAuth, StockReconciliationController.getMasterData);

router.post("/getDepotStock", checkAuth, StockReconciliationController.getDepotStock);

router.post("", checkAuth, checkFreeze, StockReconciliationController.createStockReconciliation);

router.put("/:id", checkAuth, checkFreeze, StockReconciliationController.updateStockReconciliation);

router.get("", checkAuth, StockReconciliationController.getStockReconciliations);

router.get("/:id", checkAuth, StockReconciliationController.getStockReconciliation);

router.delete("/:id", checkAuth, checkFreeze, StockReconciliationController.deleteStockReconciliation);

router.put("/approve/:id", checkAuth, checkFreeze, StockReconciliationController.approveStockReconciliation);

router.put("/reject/:id", checkAuth, checkFreeze, StockReconciliationController.rejectStockReconciliation);

module.exports = router;
