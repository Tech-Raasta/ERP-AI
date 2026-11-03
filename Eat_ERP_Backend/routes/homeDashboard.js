import express from "express";

import { getHomeDashboard } from "../controllers/homeDashboard.js";

import checkLogin from "../middleware/check-login.js";

const router = express.Router();

// Home page: any signed-in user; what it holds depends on the role (see the controller)
router.get("/", checkLogin, getHomeDashboard);

export default router;
