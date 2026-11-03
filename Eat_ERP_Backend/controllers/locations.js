import { Op } from 'sequelize';
import Location from '../models/location.js';
import Area from '../models/area.js';
import Zone from '../models/zone.js';
import DistributorType from '../models/distributorType.js';

// Location master (old PHP Location; access uses the 'Area' role section, as in PHP).
// Saved directly; new locations are Active ('Approved'). No delete: a location is switched off with status InActive.

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

// Old PHP: Approved types, zones and areas (zones filtered by type, areas by zone on the form)
export const getMasterData = async (req, res, next) => {
  try {
    const types = await DistributorType.findAll({ where: { status: 'Approved' }, attributes: ['id', 'distributor_type'], order: [['distributor_type', 'ASC']] });
    const zones = await Zone.findAll({ where: { status: 'Approved' }, attributes: ['id', 'zone', 'type_id'], order: [['zone', 'ASC']] });
    const areas = await Area.findAll({ where: { status: 'Approved' }, attributes: ['id', 'area', 'zone_id'], order: [['area', 'ASC']] });
    return res.status(200).json({ types, zones, areas });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createLocation = async (req, res, next) => {
  try {
    const location = Location.build({
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });
    location.getRequestData(req);
    // Old PHP form hides Status when adding: new locations are Active
    location.status = 'Approved';

    const error = await location.validateData();
    if (error) {
      return invalid(res, error);
    }

    await location.save();
    return res.status(201).json({ message: "Location added successfully", location });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a location failed!";
    next(error, req, res);
  }
};

export const updateLocation = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ message: "Location not found!" });
    }
    location.getRequestData(req);
    location.modified_by = req.userData.userId;

    const error = await location.validateData();
    if (error) {
      return invalid(res, error);
    }

    await location.save();
    res.status(200).json({ message: "Update successful!", location });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update location!";
    next(error, req, res);
  }
};

// Old PHP list showed only Approved locations, so an InActive location could never be found again;
// here every location is listed with its status.
export const getLocations = async (req, res, next) => {
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
        { model: Zone, as: 'zone', attributes: ['zone'] },
        { model: Area, as: 'area', attributes: ['area'] }
      ]
    };
    if (query) {
      condition['where'] = {
        [Op.or]: [
          { location: { [Op.like]: `%${query}%` } },
          { '$distributorType.distributor_type$': { [Op.like]: `%${query}%` } },
          { '$zone.zone$': { [Op.like]: `%${query}%` } },
          { '$area.area$': { [Op.like]: `%${query}%` } }
        ]
      };
    }

    const direction = (sort && sort.order && sort.order.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
    let order = [['modified_on', 'DESC']];
    if (sort && ['location', 'status', 'modified_on'].includes(sort.key)) {
      order = [[sort.key, direction]];
    } else if (sort && sort.key === 'distributor_type') {
      order = [[{ model: DistributorType, as: 'distributorType' }, 'distributor_type', direction]];
    } else if (sort && sort.key === 'zone_name') {
      order = [[{ model: Zone, as: 'zone' }, 'zone', direction]];
    } else if (sort && sort.key === 'area_name') {
      order = [[{ model: Area, as: 'area' }, 'area', direction]];
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

    const { count, rows } = await Location.findAndCountAll(condition);

    res.status(200).json({
      message: "Locations fetched successfully!",
      action: getAction(req),
      total: count,
      rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching locations failed!";
    next(error, req, res);
  }
};
