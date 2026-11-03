import express from 'express';

import * as RecipeController from '../controllers/recipes.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.get("/getMasterData", checkAuth, RecipeController.getMasterData);

router.post("", checkAuth, RecipeController.createRecipe);

router.put("/:id", checkAuth, RecipeController.updateRecipe);

router.get("", checkAuth, RecipeController.getRecipes);

router.get("/:id", checkAuth, RecipeController.getRecipe);

export default router;
