import { Op } from 'sequelize';
import sequelize from '../lib/database.js';

import Box from '../models/box.js';
import BoxProduct from '../models/boxProduct.js';
import Product from '../models/product.js';
import Category from '../models/category.js';

// Box master has no maker-checker flow (same as old PHP module):
// records are saved directly with status 'Approved' (Active) or 'InActive'.

const invalid = (res, error) => res.status(422).json({
  message: "Invalid inputs passed, please check your data.",
  error: error
});

// Active products, plus any product already on the box being edited
const getProducts = async (productIds = []) => {
  const condition = productIds.length
    ? { [Op.or]: [{ status: 'Approved' }, { id: productIds }] }
    : { status: 'Approved' };

  return Product.findAll({
    where: condition,
    attributes: ['id', 'product_name', 'grams', 'rate'],
    order: [['product_name', 'ASC']]
  });
};

const getCategories = async (categoryId) => {
  const condition = categoryId
    ? { [Op.or]: [{ id: categoryId }, Category.activeCondition] }
    : Category.activeCondition;

  return Category.findAll({
    where: condition,
    attributes: ['id', 'category_name'],
    order: [['category_name', 'ASC']]
  });
};

// Builds box_product rows from the request. Grams / rate are always taken from product_master,
// as the old PHP form did, so totals can't be tampered with from the client.
const buildItems = async (req, existingProductIds = []) => {
  const rows = Array.isArray(req.body.items) ? req.body.items : [];
  if (rows.length === 0) {
    return { error: { errors: { items: { message: 'Add at least one product' } } } };
  }

  const productIds = rows.map((row) => +row.product_id).filter((id) => id);
  const products = await Product.findAll({ where: { id: productIds } });
  const productMap = new Map(products.map((product) => [product.id, product]));

  const items = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const product = productMap.get(+row.product_id);
    if (!product) {
      return { error: { errors: { items: { message: `Row ${i + 1}: Product is required` } } } };
    }
    if (product.status !== 'Approved' && !existingProductIds.includes(product.id)) {
      return { error: { errors: { items: { message: `Row ${i + 1}: Product (${product.product_name}) is not active` } } } };
    }
    const qty = +row.qty;
    if (!row.qty || isNaN(qty) || qty <= 0) {
      return { error: { errors: { items: { message: `Row ${i + 1}: Qty must be greater than 0` } } } };
    }

    const item = BoxProduct.build({});
    item.setFromProduct(product, qty);
    items.push(item);
  }

  return { items };
};

// Old PHP save_data: delete all box_product rows of the box, then insert the posted rows
const saveItems = async (box, items, t) => {
  await BoxProduct.destroy({ where: { box_id: box.id }, transaction: t });
  for (const item of items) {
    item.box_id = box.id;
    await item.save({ transaction: t });
  }
};

export const getMasterData = async (req, res, next) => {
  try {
    const products = await getProducts();
    const categories = await getCategories(null);

    return res.status(200).json({ products, categories });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createBox = async (req, res, next) => {
  let t;

  try {
    const box = await Box.build({
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    await box.getRequestData(req);
    // New box is always Active
    box.status = 'Approved';

    const { items, error: itemError } = await buildItems(req);
    if (itemError) {
      return invalid(res, itemError);
    }
    box.setTotals(items);

    const error = await box.validateData();
    if (error) {
      return invalid(res, error);
    }

    t = await sequelize.transaction();
    await box.save({ transaction: t });
    await saveItems(box, items, t);
    await t.commit();

    return res.status(201).json({
      message: "Box added successfully",
      box: box
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }

    res.statusCode = 500;
    res.message = "Creating a box failed!";
    next(error, req, res);
  }
};

export const updateBox = async (req, res, next) => {
  let t;

  try {
    const box = await Box.findByPk(req.params.id);
    if (!box) {
      return res.status(404).json({ message: "Box not found!" });
    }

    await box.getRequestData(req);
    box.modified_by = req.userData.userId;

    const existingItems = await BoxProduct.findAll({ where: { box_id: box.id }, attributes: ['product_id'] });
    const { items, error: itemError } = await buildItems(req, existingItems.map((item) => item.product_id));
    if (itemError) {
      return invalid(res, itemError);
    }
    box.setTotals(items);

    const error = await box.validateData();
    if (error) {
      return invalid(res, error);
    }

    t = await sequelize.transaction();
    await box.save({ transaction: t });
    await saveItems(box, items, t);
    await t.commit();

    res.status(200).json({
      message: "Update successful!",
      box: box
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }

    res.statusCode = 500;
    res.message = "Couldn't update box!";
    next(error, req, res);
  }
};

export const getBoxes = async (req, res, next) => {
  try {
    let status = 'Approved';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_on', order: 'desc' };

    if (req.query) {
      status = req.query.status ? req.query.status : 'Approved';
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query : '';
      sort = { key: req.query.key, order: req.query.order };
    }

    const statusCount = {
      approved: 0,
      inActive: 0
    };
    const data = await Box.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status'],
      raw: true
    });
    for (const item of data) {
      if (item.status === "Approved") {
        statusCount.approved = statusCount.approved + parseInt(item.count);
      } else if (item.status === "InActive") {
        statusCount.inActive = statusCount.inActive + parseInt(item.count);
      }
    }

    const statusCondition = { status: status.trim().toUpperCase() === 'INACTIVE' ? 'InActive' : 'Approved' };

    const condition = {};
    if (query) {
      condition['where'] = {
        [Op.and]: [
          {[Op.or]: [
            { 'box_name': {[Op.like]: `%${query}%` } },
            { 'short_name': {[Op.like]: `%${query}%` } },
            { 'asin': {[Op.like]: `%${query}%` } },
            { 'sku_code': {[Op.like]: `%${query}%` } },
            { 'barcode': {[Op.like]: `%${query}%` } }
          ]},
          statusCondition
        ]
      };
    } else {
      condition['where'] = statusCondition;
    }

    const sortableKeys = ['box_name', 'short_name', 'asin', 'sku_code', 'barcode', 'grams', 'rate', 'cost', 'modified_on'];
    let order = [['modified_on', 'DESC']];
    if (sort && sort.key && sortableKeys.includes(sort.key)) {
      order = [[sort.key, (sort.order && sort.order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC')]];
    }
    condition['order'] = order;

    if (pageSize !== 'ALL') {
      if (pageIndex) {
        condition['offset'] = (pageIndex * pageSize);
      }
      if (pageSize) {
        condition['limit'] = pageSize;
      }
    }

    condition['attributes'] = ['id', 'box_name', 'short_name', 'asin', 'sku_code', 'barcode', 'grams', 'rate', 'cost', 'amount',
      'hsn_code', 'hsn_name', 'tax_percentage', 'moq_inventory', 'moq_production', 'status', 'remarks', 'category_id'];
    condition['include'] = [{ model: Category, as: 'category', attributes: ['category_name'] }];

    const { count, rows } = await Box.findAndCountAll(condition);

    const roleDetails = req.userData.roleDetails;
    const action = {
      insert: roleDetails.r_insert ? true : false,
      update: roleDetails.r_edit ? true : false
    };

    res.status(200).json({
      message: "Boxes fetched successfully!",
      action: action,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching boxes failed!";
    next(error, req, res);
  }
};

export const getBox = async (req, res, next) => {
  try {
    const box = await Box.findByPk(req.params.id);
    if (!box) {
      return res.status(404).json({ message: "Box not found!" });
    }

    const items = await BoxProduct.findAll({
      where: { box_id: box.id },
      include: [{ model: Product, as: 'product', attributes: ['product_name'] }],
      order: [['id', 'ASC']]
    });

    const roleDetails = req.userData.roleDetails;
    const action = {
      update: roleDetails.r_edit ? true : false
    };

    const products = await getProducts(items.map((item) => item.product_id));
    const categories = await getCategories(box.category_id);

    return res.status(200).json({ action, box, items, products, categories });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Box failed!";
    next(error, req, res);
  }
};
