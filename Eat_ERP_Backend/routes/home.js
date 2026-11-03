import express from "express";

import { getHome } from "../controllers/home.js";

const router = express.Router();

router.get("/", getHome);

// router.get("/test", HomeController.test);

// router.get("/clearDb", HomeController.clearDb)

// module.exports = router;
export default router;