const express = require("express");

const UserRoleController = require("../controllers/userRoles");

const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.post("", checkAuth, UserRoleController.createUserRole);

router.put("/:id", checkAuth, UserRoleController.updateUserRole);

router.get("", checkAuth, UserRoleController.getUserRoles);

router.get("/:id", checkAuth, UserRoleController.getUserRole);

router.delete("/:id", checkAuth, UserRoleController.deleteUserRole);

module.exports = router;
