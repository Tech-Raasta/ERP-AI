import { Op } from 'sequelize';

import VendorType from '../models/vendorType.js';

// Vendor Type master (old PHP Vendor_type). Saved directly; new types are Active ('Approved').
// No delete in the old app: a type is switched off with status InActive.

const invalid = (res, error) => res.status(422).json({
  message: "Invalid inputs passed, please check your data.",
  error: error
});

const getAction = (req) => {
  const roleDetails = req.userData.roleDetails;
  return {
    insert: roleDetails.r_insert ? true : false,
    update: roleDetails.r_edit ? true : false
  };
};

export const createVendorType = async (req, res, next) => {
  try {
    const vendorType = VendorType.build({
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });
    vendorType.getRequestData(req);
    // Old PHP form hides Status when adding: new types are Active
    vendorType.status = 'Approved';

    const error = await vendorType.validateData();
    if (error) {
      return invalid(res, error);
    }

    await vendorType.save();
    return res.status(201).json({ message: "Vendor Type added successfully", vendorType });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a vendor type failed!";
    next(error, req, res);
  }
};

export const updateVendorType = async (req, res, next) => {
  try {
    const vendorType = await VendorType.findByPk(req.params.id);
    if (!vendorType) {
      return res.status(404).json({ message: "Vendor Type not found!" });
    }
    vendorType.getRequestData(req);
    vendorType.modified_by = req.userData.userId;

    const error = await vendorType.validateData();
    if (error) {
      return invalid(res, error);
    }

    await vendorType.save();
    res.status(200).json({ message: "Update successful!", vendorType });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update vendor type!";
    next(error, req, res);
  }
};

// Old PHP list: every vendor type (any status), latest modified first
export const getVendorTypes = async (req, res, next) => {
  try {
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_on', order: 'desc' };

    if (req.query) {
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query.toString().trim() : '';
      sort = { key: req.query.key, order: req.query.order };
    }

    const condition = {};
    if (query) {
      condition['where'] = { vendor_type: { [Op.like]: `%${query}%` } };
    }

    const sortableKeys = ['vendor_type', 'status', 'modified_on'];
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

    const { count, rows } = await VendorType.findAndCountAll(condition);

    res.status(200).json({
      message: "Vendor types fetched successfully!",
      action: getAction(req),
      total: count,
      rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching vendor types failed!";
    next(error, req, res);
  }
};

export const getVendorType = async (req, res, next) => {
  try {
    const vendorType = await VendorType.findByPk(req.params.id);
    if (!vendorType) {
      return res.status(404).json({ message: "Vendor type not found!" });
    }
    return res.status(200).json({ action: getAction(req), vendorType });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching vendor type failed!";
    next(error, req, res);
  }
};
