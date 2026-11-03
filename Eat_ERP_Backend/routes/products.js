import express from 'express';

import * as ProductController from '../controllers/products.js';

import checkAuth from '../middleware/check-auth.js';

const router = express.Router();

router.get("/getMasterData", checkAuth, ProductController.getMasterData);

router.post("", checkAuth, ProductController.createProduct);

router.put("/:id", checkAuth, ProductController.updateProduct);

router.get("", checkAuth, ProductController.getProducts);

router.get("/:id", checkAuth, ProductController.getProduct);

router.delete("/:id", checkAuth, ProductController.deleteProduct);

export default router;