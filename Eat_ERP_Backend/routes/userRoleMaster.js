import express from "express";

import * as UserRoleController from "../controllers/userRoleMaster.js";

import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

// User Roles (Users -> User Roles, old PHP User_roles); access from the 'User_Roles' role section
router.get("", checkAuth, UserRoleController.getRoles);

router.get("/master", checkAuth, UserRoleController.getMasterData);

router.get("/:id", checkAuth, UserRoleController.getRole);

router.post("", checkAuth, UserRoleController.createRole);

router.put("/:id", checkAuth, UserRoleController.updateRole);

export default router;
