import { Op } from 'sequelize';
import sequelize from '../lib/database.js';

import Product from '../models/product.js';
import Category from '../models/category.js';
import Box from '../models/box.js';

// Product master has no maker-checker flow (same as old PHP module):
// records are saved directly with status 'Approved' (Active) or 'InActive'.

const getCategories = async (product) => {
  const condition = product && product.category_id
    ? { [Op.or]: [{ id: product.category_id }, Category.activeCondition] }
    : Category.activeCondition;

  return Category.findAll({
    where: condition,
    attributes: ['id', 'category_name'],
    order: [['category_name', 'ASC']]
  });
};

// Old PHP: "update box_master set barcode, hsn_code, ... where product_id = ?" after every save.
// Raw-SQL behaviour is kept: no box validators (they need fields not in this update) and no modified_on bump.
const syncBoxes = async (product, t) => {
  await Box.update(product.getBoxSyncData(), {
    where: { product_id: product.id },
    validate: false,
    silent: true,
    transaction: t
  });
};

export const getMasterData = async (req, res, next) => {
  try {
    const categories = await getCategories(null);

    return res.status(200).json({ categories });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createProduct = async (req, res, next) => {
  let t;

  try {
    const product = await Product.build({
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    await product.getRequestData(req);
    // New product is always Active
    product.status = 'Approved';

    const error = await product.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    t = await sequelize.transaction();
    await product.save({ transaction: t });
    await syncBoxes(product, t);
    await t.commit();

    return res.status(201).json({
      message: "Product added successfully",
      product: product
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }

    res.statusCode = 500;
    res.message = "Creating a product failed!";
    next(error, req, res);
  }
};

export const updateProduct = async (req, res, next) => {
  let t;

  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found!" });
    }

    await product.getRequestData(req);
    product.modified_by = req.userData.userId;

    const error = await product.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    t = await sequelize.transaction();
    await product.save({ transaction: t });
    await syncBoxes(product, t);
    await t.commit();

    res.status(200).json({
      message: "Update successful!",
      product: product
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }

    res.statusCode = 500;
    res.message = "Couldn't update product!";
    next(error, req, res);
  }
};

export const getProducts = async (req, res, next) => {
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
      sort = { key: req.query.key ? req.query.key : 'modified_on', order: req.query.order ? req.query.order : 'desc' };
    }

    const statusCount = {
      approved: 0,
      inActive: 0
    };
    const data = await Product.findAll(
      {
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
        group: ['status'],
        raw: true
      }
    );
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
            { 'product_name': {[Op.like]: `%${query}%` } },
            { 'hsn_code': {[Op.like]: `%${query}%` } },
            { 'hsn_name': {[Op.like]: `%${query}%` } },
            { 'short_name': {[Op.like]: `%${query}%` } },
            { 'barcode': {[Op.like]: `%${query}%` } }
          ]},
          statusCondition
        ]
      };
    } else {
      condition['where'] = statusCondition;
    }

    const sortableKeys = ['product_name', 'short_name', 'grams', 'avg_grams', 'rate', 'cost', 'anticipated_wastage', 'tax_percentage', 'modified_on'];
    let order = [['modified_on', 'DESC']];
    if (sort && sort.key && sortableKeys.includes(sort.key)) {
      order = [[sort.key, (sort.order && sort.order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC')]];
    }
    condition['order'] = order;

    if (pageSize.toString().trim().toUpperCase() !== 'ALL') {
      if (pageIndex) {
        condition['offset'] = (pageIndex * pageSize);
      }
      if (pageSize) {
        condition['limit'] = pageSize;
      }
    }

    condition['include'] = [{ model: Category, as: 'category', attributes: ['category_name'] }];

    const { count, rows } = await Product.findAndCountAll(condition);

    res.status(200).json({
      message: "Products fetched successfully!",
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching products failed!";
    next(error, req, res);
  }
};

export const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found!" });
    }

    const roleDetails = req.userData.roleDetails;
    const action = {
      update: roleDetails.r_edit ? true : false
    };

    const categories = await getCategories(product);

    return res.status(200).json({ action, product, categories });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Product failed!";
    next(error, req, res);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found!"
      });
    }

    product.status = 'InActive';
    product.modified_by = req.userData.userId;

    const error = await product.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await product.save();
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Deleting Products failed!";
    next(error, req, res);
  }
};
