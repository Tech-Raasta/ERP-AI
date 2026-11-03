import { Op } from 'sequelize';

import City from '../models/city.js';
import State from '../models/state.js';

// City master (old PHP City_master): saved directly, delete is a soft delete (status = 3).
// Only active cities (status = 1) are listed or edited.

const findActiveCity = async (id) => {
  const city = await City.findByPk(id);
  return (city && +city.status === City.ACTIVE) ? city : null;
};

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

// Old PHP getStateList: state_master where status = 1
export const getMasterData = async (req, res, next) => {
  try {
    const states = await State.findAll({ where: { status: 1 }, attributes: ['id', 'state_name'], order: [['state_name', 'ASC']] });
    return res.status(200).json({ states });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createCity = async (req, res, next) => {
  try {
    const city = City.build({
      status: City.ACTIVE,
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });
    city.getRequestData(req);

    const error = await city.validateData();
    if (error) {
      return invalid(res, error);
    }

    await city.save();
    return res.status(201).json({ message: "City added successfully", city });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a City failed!";
    next(error, req, res);
  }
};

export const updateCity = async (req, res, next) => {
  try {
    const city = await findActiveCity(req.params.id);
    if (!city) {
      return res.status(404).json({ message: "City not found!" });
    }
    city.getRequestData(req);
    city.modified_by = req.userData.userId;

    const error = await city.validateData();
    if (error) {
      return invalid(res, error);
    }

    await city.save();
    res.status(200).json({ message: "Update successful!", city });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update city!";
    next(error, req, res);
  }
};

export const getCities = async (req, res, next) => {
  try {
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'city_name', order: 'asc' };

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
      where: { status: City.ACTIVE },
      include: [{ model: State, as: 'state', attributes: ['state_name'] }]
    };
    if (query) {
      condition['where'] = {
        status: City.ACTIVE,
        [Op.or]: [
          { city_name: { [Op.like]: `%${query}%` } },
          { '$state.state_name$': { [Op.like]: `%${query}%` } }
        ]
      };
    }

    const direction = (sort && sort.order && sort.order.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
    let order = [['city_name', 'ASC']];
    if (sort && sort.key === 'city_name') {
      order = [['city_name', direction]];
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

    const { count, rows } = await City.findAndCountAll(condition);

    res.status(200).json({
      message: "Cities fetched successfully!",
      action: getAction(req),
      total: count,
      rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Cities failed!";
    next(error, req, res);
  }
};

export const deleteCity = async (req, res, next) => {
  try {
    const city = await findActiveCity(req.params.id);
    if (!city) {
      return res.status(404).json({ message: "City not found!" });
    }

    // Old PHP delete_record: update city_master set status = 3
    city.status = City.DELETED;
    city.modified_by = req.userData.userId;

    await city.save();
    res.status(200).json({ message: "City deleted successfully!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Deleting City failed!";
    next(error, req, res);
  }
};
