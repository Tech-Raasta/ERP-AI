import { Op } from 'sequelize';
import sequelize from '../lib/database.js';

import Depot, { getDepotMasterData } from '../models/depot.js';
import DepotContact from '../models/depotContact.js';
import User from '../models/user.js';

// Depot master has no maker-checker flow (same as old PHP module):
// records are saved directly with status 'Approved' (Active) or 'InActive'.

const saveDepotContacts = async (depot, body, t) => {
  const contacts = depot.getDepotContacts(body);
  for (const contact of contacts) {
    const depotContact = await DepotContact.build({
      depot_id: depot.id
    });
    await depotContact.getRequestData({ ...contact, depot_id: depot.id });
    const error = await depotContact.validateData();
    if (error) {
      return error;
    }

    await depotContact.save({ transaction: t });
  }

  return null;
};

const canAccessDepot = (req, depotId) => {
  const depotIds = req.userData.depotIds ? req.userData.depotIds : [];
  return depotIds.map(id => id.toString().trim()).includes(depotId.toString());
};

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getDepotMasterData();

    return res.status(200).json({ masterData });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createDepot = async (req, res, next) => {
  let t;

  try {
    const depot = await Depot.build({
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    depot.getRequestData(req);
    // New depot is always Active
    depot.status = 'Approved';

    let error = await depot.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    t = await sequelize.transaction();
    await depot.save({ transaction: t });

    error = await saveDepotContacts(depot, req.body, t);
    if (error) {
      await t.rollback();

      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // Give the creating user access to the new depot (old PHP: user_master.depot_ids)
    const user = await User.findByPk(req.userData.userId, { transaction: t });
    if (user) {
      const depotIds = user.depot_ids ? user.depot_ids.split(',').map(id => id.trim()).filter(id => id) : [];
      depotIds.push(depot.id.toString());
      user.depot_ids = depotIds.join(',');
      await user.save({ fields: ['depot_ids'], transaction: t });
    }

    await t.commit();

    return res.status(201).json({
      message: "Depot added successfully",
      depot: depot
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }

    res.statusCode = 500;
    res.message = "Creating a Depot failed!";
    next(error, req, res);
  }
};

export const updateDepot = async (req, res, next) => {
  let t;

  try {
    const depot = await Depot.findByPk(req.params.id);
    if (!depot) {
      return res.status(404).json({ message: "Depot not found!" });
    }

    if (!canAccessDepot(req, depot.id)) {
      return res.status(401).json({ message: "You do not have access to this depot." });
    }

    depot.getRequestData(req);
    depot.modified_by = req.userData.userId;

    let error = await depot.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    t = await sequelize.transaction();
    await depot.save({ transaction: t });

    await DepotContact.destroy({ where: { depot_id: depot.id }, transaction: t });

    error = await saveDepotContacts(depot, req.body, t);
    if (error) {
      await t.rollback();

      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await t.commit();

    res.status(200).json({ message: "Update successful!", depot: depot });
  } catch (error) {
    if (t) {
      await t.rollback();
    }

    res.statusCode = 500;
    res.message = "Couldn't update Depot!";
    next(error, req, res);
  }
};

export const getDepots = async (req, res, next) => {
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
    const data = await Depot.findAll(
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
            { 'depot_name': {[Op.like]: `%${query}%` } },
            { 'depot_code': {[Op.like]: `%${query}%` } },
            { 'email_id': {[Op.like]: `%${query}%` } },
            { 'mobile': {[Op.like]: `%${query}%` } }
          ]},
          statusCondition
        ]
      };
    } else {
      condition['where'] = statusCondition;
    }

    const sortableKeys = ['depot_name', 'depot_code', 'email_id', 'mobile', 'type', 'modified_on'];
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

    const { count, rows } = await Depot.findAndCountAll(condition);

    res.status(200).json({
      message: "Depots fetched successfully!",
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching depots failed!";
    next(error, req, res);
  }
};

export const getDepot = async (req, res, next) => {
  try {
    const depot = await Depot.findByPk(req.params.id, { include: ["contactPersons"] });
    if (!depot) {
      return res.status(404).json({ message: "Depot not found!" });
    }

    // Old PHP only allowed editing depots assigned to the user (user_master.depot_ids)
    if (!canAccessDepot(req, depot.id)) {
      return res.status(401).json({ message: "You do not have access to this depot." });
    }

    const roleDetails = req.userData.roleDetails;
    const action = {
      update: roleDetails.r_edit ? true : false
    };

    const masterData = await getDepotMasterData();

    return res.status(200).json({ action, depot, masterData });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Depot failed!";
    next(error, req, res);
  }
};
