import { Op } from 'sequelize';
import Area from '../models/area.js';
import Zone from '../models/zone.js';
import DistributorType from '../models/distributorType.js';

// Area master (old PHP Area). Saved directly; new areas are Active ('Approved').
// No delete in the old app: an area is switched off with status InActive.

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

// Old PHP: Approved distributor types and zones (zones are filtered by type on the form)
export const getMasterData = async (req, res, next) => {
  try {
    const types = await DistributorType.findAll({
      where: { status: 'Approved' },
      attributes: ['id', 'distributor_type'],
      order: [['distributor_type', 'ASC']]
    });
    const zones = await Zone.findAll({
      where: { status: 'Approved' },
      attributes: ['id', 'zone', 'type_id'],
      order: [['zone', 'ASC']]
    });
    return res.status(200).json({ types, zones });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createArea = async (req, res, next) => {
  try {
    const area = Area.build({
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });
    area.getRequestData(req);
    // Old PHP form hides Status when adding: new areas are Active
    area.status = 'Approved';

    const error = await area.validateData();
    if (error) {
      return invalid(res, error);
    }

    await area.save();
    return res.status(201).json({ message: "Area added successfully", area });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating an area failed!";
    next(error, req, res);
  }
};

export const updateArea = async (req, res, next) => {
  try {
    const area = await Area.findByPk(req.params.id);
    if (!area) {
      return res.status(404).json({ message: "Area not found!" });
    }
    area.getRequestData(req);
    area.modified_by = req.userData.userId;

    const error = await area.validateData();
    if (error) {
      return invalid(res, error);
    }

    await area.save();
    res.status(200).json({ message: "Update successful!", area });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update area!";
    next(error, req, res);
  }
};

// Old PHP list showed only Approved areas, so an InActive area could never be found again;
// here every area is listed with its status.
export const getAreas = async (req, res, next) => {
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

    const condition = {
      include: [
        { model: DistributorType, as: 'distributorType', attributes: ['distributor_type'] },
        { model: Zone, as: 'zone', attributes: ['zone'] }
      ]
    };
    if (query) {
      condition['where'] = {
        [Op.or]: [
          { area: { [Op.like]: `%${query}%` } },
          { '$distributorType.distributor_type$': { [Op.like]: `%${query}%` } },
          { '$zone.zone$': { [Op.like]: `%${query}%` } }
        ]
      };
    }

    const direction = (sort && sort.order && sort.order.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
    let order = [['modified_on', 'DESC']];
    if (sort && ['area', 'status', 'modified_on'].includes(sort.key)) {
      order = [[sort.key, direction]];
    } else if (sort && sort.key === 'distributor_type') {
      order = [[{ model: DistributorType, as: 'distributorType' }, 'distributor_type', direction]];
    } else if (sort && sort.key === 'zone_name') {
      order = [[{ model: Zone, as: 'zone' }, 'zone', direction]];
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

    const { count, rows } = await Area.findAndCountAll(condition);

    res.status(200).json({
      message: "Areas fetched successfully!",
      action: getAction(req),
      total: count,
      rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching areas failed!";
    next(error, req, res);
  }
};
