import { Op } from 'sequelize';
import DistributorType from '../models/distributorType.js';

// Distributor Type master (old PHP Distributor_type). Saved directly; new types are Active ('Approved').
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

export const createDistributorType = async (req, res, next) => {
  try {
    const distributorType = DistributorType.build({
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });
    distributorType.getRequestData(req);
    // Old PHP form hides Status when adding: new types are Active
    distributorType.status = 'Approved';

    const error = await distributorType.validateData();
    if (error) {
      return invalid(res, error);
    }

    await distributorType.save();
    return res.status(201).json({ message: "Distributor Type added successfully", distributorType });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a distributor type failed!";
    next(error, req, res);
  }
};

export const updateDistributorType = async (req, res, next) => {
  try {
    const distributorType = await DistributorType.findByPk(req.params.id);
    if (!distributorType) {
      return res.status(404).json({ message: "Distributor Type not found!" });
    }
    distributorType.getRequestData(req);
    distributorType.modified_by = req.userData.userId;

    const error = await distributorType.validateData();
    if (error) {
      return invalid(res, error);
    }

    await distributorType.save();
    res.status(200).json({ message: "Update successful!", distributorType });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update distributor type!";
    next(error, req, res);
  }
};

// Old PHP list: every distributor type (any status), latest modified first
export const getDistributorTypes = async (req, res, next) => {
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
      condition['where'] = { distributor_type: { [Op.like]: `%${query}%` } };
    }

    const sortableKeys = ['distributor_type', 'status', 'modified_on'];
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

    const { count, rows } = await DistributorType.findAndCountAll(condition);

    res.status(200).json({
      message: "Distributor Types fetched successfully!",
      action: getAction(req),
      total: count,
      rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching distributor types failed!";
    next(error, req, res);
  }
};

export const getDistributorType = async (req, res, next) => {
  try {
    const distributorType = await DistributorType.findByPk(req.params.id);
    if (!distributorType) {
      return res.status(404).json({ message: "Distributor Type not found!" });
    }
    return res.status(200).json({ action: getAction(req), distributorType });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Distributor Type failed!";
    next(error, req, res);
  }
};
