// import { Router } from "express";
import express from "express";
import { createVisitor } from "../controllers/exhibitionVisitor.js";

const router = express.Router();

router.post("", createVisitor);

export default router;