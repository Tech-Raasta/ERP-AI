const express = require("express");

const GrnController = require("../controllers/grns");

const checkAuth = require("../middleware/check-auth");
const checkFreeze = require("../middleware/check-freeze");

const router = express.Router();

router.get("/getMasterData", checkAuth, GrnController.getMasterData)

router.get("/getPurchaseOrders/:vendorId", checkAuth, GrnController.getPurchaseOrders);

router.get("/getPurchaseOrder/:id", checkAuth, GrnController.getPurchaseOrder);

router.get("/getGrnDetails/:id", checkAuth, GrnController.getGrnDetails);

router.post("", checkAuth, checkFreeze, GrnController.createGrn);

router.put("/:id", checkAuth, checkFreeze, GrnController.updateGrn);

router.get("", checkAuth, GrnController.getGrns);

router.get("/:id", checkAuth, GrnController.getGrn);

router.delete("/:id", checkAuth, checkFreeze, GrnController.deleteGrn);

router.put("/approve/:id", checkAuth, checkFreeze, GrnController.approveGrn);

router.put("/reject/:id", checkAuth, checkFreeze, GrnController.rejectGrn);

module.exports = router;
