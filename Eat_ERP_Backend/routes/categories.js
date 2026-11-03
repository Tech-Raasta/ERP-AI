import express from 'express';

import { createCategory, updateCategory, getCategories, getCategory, deleteCategory } from '../controllers/categories.js';

// const CategoryController = require("../controllers/categories");

import checkAuth from '../middleware/check-auth.js';

// const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.post("", checkAuth, createCategory);

router.put("/:id", checkAuth, updateCategory);

router.get("", checkAuth, getCategories);

router.get("/:id", checkAuth, getCategory);

router.delete("/:id", checkAuth, deleteCategory);

// module.exports = router;

export default router;