import { Op } from 'sequelize';
import Zone from '../models/zone.js';
import DistributorType from '../models/distributorType.js';

// Zone master (old PHP Zone). Saved directly; new zones are Active ('Approved').
// No delete in the old app: a zone is switched off with status InActive.

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

// Old PHP: Approved distributor types for the dropdown
export const getMasterData = async (req, res, next) => {
  try {
    const types = await DistributorType.findAll({
      where: { status: 'Approved' },
      attributes: ['id', 'distributor_type'],
      order: [['distributor_type', 'ASC']]
    });
    return res.status(200).json({ types });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createZone = async (req, res, next) => {
  try {
    const zone = Zone.build({
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });
    zone.getRequestData(req);
    // Old PHP form hides Status when adding: new zones are Active
    zone.status = 'Approved';

    const error = await zone.validateData();
    if (error) {
      return invalid(res, error);
    }

    await zone.save();
    return res.status(201).json({ message: "Zone added successfully", zone });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a zone failed!";
    next(error, req, res);
  }
};

export const updateZone = async (req, res, next) => {
  try {
    const zone = await Zone.findByPk(req.params.id);
    if (!zone) {
      return res.status(404).json({ message: "Zone not found!" });
    }
    zone.getRequestData(req);
    zone.modified_by = req.userData.userId;

    const error = await zone.validateData();
    if (error) {
      return invalid(res, error);
    }

    await zone.save();
    res.status(200).json({ message: "Update successful!", zone });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update zone!";
    next(error, req, res);
  }
};

// Old PHP list showed only Approved zones, so an InActive zone could never be found again;
// here every zone is listed with its status.
export const getZones = async (req, res, next) => {
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
      include: [{ model: DistributorType, as: 'distributorType', attributes: ['distributor_type'] }]
    };
    if (query) {
      condition['where'] = {
        [Op.or]: [
          { zone: { [Op.like]: `%${query}%` } },
          { '$distributorType.distributor_type$': { [Op.like]: `%${query}%` } }
        ]
      };
    }

    const direction = (sort && sort.order && sort.order.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
    let order = [['modified_on', 'DESC']];
    if (sort && ['zone', 'status', 'modified_on'].includes(sort.key)) {
      order = [[sort.key, direction]];
    } else if (sort && sort.key === 'distributor_type') {
      order = [[{ model: DistributorType, as: 'distributorType' }, 'distributor_type', direction]];
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

    const { count, rows } = await Zone.findAndCountAll(condition);

    res.status(200).json({
      message: "Zones fetched successfully!",
      action: getAction(req),
      total: count,
      rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching zones failed!";
    next(error, req, res);
  }
};

export const getZone = async (req, res, next) => {
  try {
    const zone = await Zone.findByPk(req.params.id);
    if (!zone) {
      return res.status(404).json({ message: "Zone not found!" });
    }
    return res.status(200).json({ action: getAction(req), zone });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Zone failed!";
    next(error, req, res);
  }
};
