import { Op } from 'sequelize';
import Category from "../models/category.js";

// Category master has no approval flow (same as old PHP module): records are saved directly.
// Delete is a soft delete (is_deleted = 0); only live categories are listed or editable.

const findActiveCategory = async (id) => {
  const category = await Category.findByPk(id);
  return (category && category.isActive()) ? category : null;
};

export const createCategory = async (req, res, next) => {
  try {
    const category = await Category.build({
      status: 1,
      is_deleted: 1,
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    category.getRequestData(req);

    const error = await category.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await category.save();

    return res.status(201).json({
      message: "Category added successfully",
      category: category
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a category failed!";
    next(error, req, res);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await findActiveCategory(req.params.id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found!"
      });
    }

    category.getRequestData(req);
    category.modified_by = req.userData.userId;

    const error = await category.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await category.save();
    res.status(200).json({ message: "Update successful!", category: category });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update category!";
    next(error, req, res);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'category_name', order: 'asc' };

    if (req.query) {
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query : '';
      sort = { key: req.query.key, order: req.query.order };
    }

    const condition = {};
    if (query) {
      condition['where'] = {
        ...Category.activeCondition,
        'category_name': { [Op.like]: `%${query}%` }
      };
    } else {
      condition['where'] = { ...Category.activeCondition };
    }

    const sortableKeys = ['id', 'category_name', 'modified_on'];
    let order = [['category_name', 'ASC']];
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

    const { count, rows } = await Category.findAndCountAll(condition);

    const roleDetails = req.userData.roleDetails;
    const action = {
      insert: roleDetails.r_insert ? true : false,
      update: roleDetails.r_edit ? true : false,
      delete: roleDetails.r_delete ? true : false
    };

    res.status(200).json({
      message: "Categories fetched successfully!",
      action: action,
      rows: rows,
      total: count
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching categories failed!";
    next(error, req, res);
  }
};

export const getCategory = async (req, res, next) => {
  try {
    const category = await findActiveCategory(req.params.id);
    if (category) {
      res.status(200).json(category);
    } else {
      res.status(404).json({ message: "Category not found!" });
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching category failed!";
    next(error, req, res);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const category = await findActiveCategory(req.params.id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found!"
      });
    }

    // Old PHP delete_record: update category_master set is_deleted = 0
    category.is_deleted = 0;
    category.modified_by = req.userData.userId;

    await category.save();
    res.status(200).json({ message: "Category deleted successfully!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Deleting category failed!";
    next(error, req, res);
  }
};
