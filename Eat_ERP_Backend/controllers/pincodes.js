import { Op } from 'sequelize';

import Pincode from '../models/pincode.js';
import State from '../models/state.js';

// Pincode master (old PHP Pincode_master): saved directly, delete is a soft delete (status = 3).
// Only active pincodes (status = 1) are listed, viewed or edited.

const findActivePincode = async (id) => {
  const pincode = await Pincode.findByPk(id);
  return (pincode && +pincode.status === Pincode.ACTIVE) ? pincode : null;
};

// Old PHP getStateList: state_master where status = 1 (plus the pincode's current state when editing)
const getStates = async (stateId) => State.findAll({
  where: stateId ? { [Op.or]: [{ status: 1 }, { id: stateId }] } : { status: 1 },
  attributes: ['id', 'state_name'],
  order: [['state_name', 'ASC']]
});

const getAction = (req) => {
  const roleDetails = req.userData.roleDetails;
  return {
    insert: roleDetails.r_insert ? true : false,
    update: roleDetails.r_edit ? true : false,
    delete: roleDetails.r_delete ? true : false
  };
};

const invalid = (res, error) => res.status(422).json({
  message: "Invalid inputs passed, please check your data.",
  error: error
});

export const getMasterData = async (req, res, next) => {
  try {
    const states = await getStates(null);
    return res.status(200).json({ states });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createPincode = async (req, res, next) => {
  try {
    const pincode = Pincode.build({
      status: Pincode.ACTIVE,
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    pincode.getRequestData(req);

    const error = await pincode.validateData();
    if (error) {
      return invalid(res, error);
    }

    await pincode.save();

    return res.status(201).json({
      message: "Pincode added successfully",
      pincode: pincode
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a Pincode failed!";
    next(error, req, res);
  }
};

export const updatePincode = async (req, res, next) => {
  try {
    const pincode = await findActivePincode(req.params.id);
    if (!pincode) {
      return res.status(404).json({ message: "Pincode not found!" });
    }

    pincode.getRequestData(req);
    pincode.modified_by = req.userData.userId;

    const error = await pincode.validateData();
    if (error) {
      return invalid(res, error);
    }

    await pincode.save();
    res.status(200).json({ message: "Update successful!", pincode: pincode });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update pincode!";
    next(error, req, res);
  }
};

export const getPincodes = async (req, res, next) => {
  try {
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'pincode', order: 'asc' };

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

    const condition = {
      where: { status: Pincode.ACTIVE },
      include: [{ model: State, as: 'state', attributes: ['state_name'] }]
    };
    if (query) {
      condition['where'] = {
        status: Pincode.ACTIVE,
        [Op.or]: [
          { pincode: { [Op.like]: `%${query}%` } },
          { '$state.state_name$': { [Op.like]: `%${query}%` } }
        ]
      };
    }

    // Old PHP list is ordered by pincode
    let order = [['pincode', 'ASC']];
    const direction = (sort && sort.order && sort.order.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
    if (sort && sort.key === 'pincode') {
      order = [['pincode', direction]];
    } else if (sort && sort.key === 'state_name') {
      order = [[{ model: State, as: 'state' }, 'state_name', direction]];
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

    const { count, rows } = await Pincode.findAndCountAll(condition);

    res.status(200).json({
      message: "Pincodes fetched successfully!",
      action: getAction(req),
      total: count,
      rows: rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Pincodes failed!";
    next(error, req, res);
  }
};

export const getPincode = async (req, res, next) => {
  try {
    const pincode = await findActivePincode(req.params.id);
    if (!pincode) {
      return res.status(404).json({ message: "Pincode not found!" });
    }

    const states = await getStates(pincode.state_id);

    return res.status(200).json({ action: getAction(req), pincode, states });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Pincode failed!";
    next(error, req, res);
  }
};

export const deletePincode = async (req, res, next) => {
  try {
    const pincode = await findActivePincode(req.params.id);
    if (!pincode) {
      return res.status(404).json({ message: "Pincode not found!" });
    }

    // Old PHP delete_record: update pincode_master set status = 3
    pincode.status = Pincode.DELETED;
    pincode.modified_by = req.userData.userId;

    await pincode.save();
    res.status(200).json({ message: "Pincode deleted successfully!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Deleting Pincode failed!";
    next(error, req, res);
  }
};
