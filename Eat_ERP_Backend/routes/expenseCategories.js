import express from 'express';

import { createExpenseCategory, updateExpenseCategory, getExpenseCategories, getExpenseCategory, deleteExpenseCategory } from '../controllers/expenseCategories.js';

import checkAuth from '../middleware/check-auth.js';


const router = express.Router();

router.post("", checkAuth, createExpenseCategory);

router.put("/:id", checkAuth, updateExpenseCategory);

router.get("", checkAuth, getExpenseCategories);

router.get("/:id", checkAuth, getExpenseCategory);

router.delete("/:id", checkAuth, deleteExpenseCategory);

export default router;