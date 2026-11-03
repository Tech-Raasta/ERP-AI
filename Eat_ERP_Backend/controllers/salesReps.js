import { Op, QueryTypes } from 'sequelize';
import sequelize from '../lib/database.js';

import SalesRep, { SR_TYPES } from '../models/salesRep.js';
import DocumentDetail, { replaceDocuments } from '../models/documentDetail.js';
import User from '../models/user.js';

// Sales Representative master (old PHP Sales_rep). Saved directly with status 'Approved' (Active) or 'InActive'.
// Saving also keeps the sales rep's login user (user_master) in step, as Sales_rep_model::save_data does.

const DOC_REF_TYPE = 'Sales_Rep';
// multer (middleware/file.js) stores files under assets/uploads/<last segment of the api url>
const DOC_FOLDER = 'sales_rep';
// Old PHP: new sales rep login users get role 8 and this default password
const SALES_REP_ROLE_ID = 8;
const DEFAULT_PASSWORD = 'pass@123';

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

// Old PHP get_zone: distinct Approved zones
const getZones = async () => sequelize.query(
  `select distinct zone from zone_master where status = 'Approved' order by zone`,
  { type: QueryTypes.SELECT }
);

const parseDocs = (req) => {
  if (req.body.docs === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(req.body.docs);
  } catch (error) {
    return [];
  }
};

// Old PHP: create the login user when no user has this email / sales rep, otherwise update the linked user
const syncUser = async (salesRep, userId, t) => {
  const now = new Date();
  const existing = await User.count({
    where: { [Op.or]: [{ email_id: salesRep.email_id }, { sales_rep_id: salesRep.id }] },
    transaction: t
  });

  if (existing === 0) {
    await User.create({
      first_name: salesRep.sales_rep_name,
      email_id: salesRep.email_id,
      password: DEFAULT_PASSWORD,
      mobile: salesRep.mobile,
      role_id: SALES_REP_ROLE_ID,
      status: salesRep.status,
      remarks: salesRep.remarks,
      created_by: userId,
      created_on: now,
      modified_by: userId,
      modified_on: now,
      sales_rep_id: salesRep.id
    }, { transaction: t });
  } else {
    await User.update({
      first_name: salesRep.sales_rep_name,
      status: salesRep.status,
      email_id: salesRep.email_id,
      mobile: salesRep.mobile,
      modified_by: userId,
      modified_on: now
    }, { where: { sales_rep_id: salesRep.id }, transaction: t });
  }
};

const saveSalesRep = async (req, res, salesRep) => {
  salesRep.getRequestData(req);
  salesRep.modified_by = req.userData.userId;

  const error = await salesRep.validateData();
  if (error) {
    return invalid(res, error);
  }

  const t = await sequelize.transaction();
  try {
    await salesRep.save({ transaction: t });
    const docs = parseDocs(req);
    if (docs !== undefined) {
      await replaceDocuments(DOC_REF_TYPE, salesRep.id, docs, Array.isArray(req.files) ? req.files : [], DOC_FOLDER, t);
    }
    await syncUser(salesRep, req.userData.userId, t);
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }
  return null;
};

export const getMasterData = async (req, res, next) => {
  try {
    const zones = await getZones();
    return res.status(200).json({ zones });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createSalesRep = async (req, res, next) => {
  try {
    const salesRep = SalesRep.build({ created_by: req.userData.userId });
    const response = await saveSalesRep(req, res, salesRep);
    if (response) {
      return response;
    }
    return res.status(201).json({ message: "Sales Representative added successfully", salesRep });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a sales representative failed!";
    next(error, req, res);
  }
};

export const updateSalesRep = async (req, res, next) => {
  try {
    const salesRep = await SalesRep.findByPk(req.params.id);
    if (!salesRep) {
      return res.status(404).json({ message: "Sales Representative not found!" });
    }
    const response = await saveSalesRep(req, res, salesRep);
    if (response) {
      return response;
    }
    res.status(200).json({ message: "Update successful!", salesRep });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update sales representative!";
    next(error, req, res);
  }
};

export const getSalesReps = async (req, res, next) => {
  try {
    let status = 'salesrep';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_on', order: 'desc' };

    if (req.query) {
      status = req.query.status ? req.query.status.toString().trim().toLowerCase() : 'salesrep';
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query.toString().trim() : '';
      sort = { key: req.query.key, order: req.query.order };
    }

    // Old PHP checkstatus counts: Approved reps by type + InActive reps
    const counts = await SalesRep.findAll({
      attributes: ['status', 'sr_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status', 'sr_type'],
      raw: true
    });
    const statusCount = { salesrep: 0, promoter: 0, merchandiser: 0, inactive: 0 };
    for (const item of counts) {
      const itemStatus = (item.status || '').trim().toUpperCase();
      const itemType = (item.sr_type || '').trim().toUpperCase();
      if (itemStatus === 'INACTIVE') {
        statusCount.inactive += parseInt(item.count);
      } else if (itemStatus === 'APPROVED') {
        for (const key in SR_TYPES) {
          if (itemType === SR_TYPES[key].toUpperCase()) {
            statusCount[key] += parseInt(item.count);
          }
        }
      }
    }

    const where = status === 'inactive'
      ? { status: 'InActive' }
      : { status: 'Approved', sr_type: SR_TYPES[status] || SR_TYPES.salesrep };
    if (query) {
      where[Op.or] = [
        { sales_rep_name: { [Op.like]: `%${query}%` } },
        { pan_no: { [Op.like]: `%${query}%` } },
        { email_id: { [Op.like]: `%${query}%` } },
        { mobile: { [Op.like]: `%${query}%` } }
      ];
    }

    const sortableKeys = ['sales_rep_name', 'pan_no', 'email_id', 'mobile', 'target_pm', 'modified_on'];
    let order = [['modified_on', 'DESC']];
    if (sort && sort.key && sortableKeys.includes(sort.key)) {
      order = [[sort.key, (sort.order && sort.order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC')]];
    }

    const condition = { where, order };
    if (pageSize !== 'ALL') {
      if (pageIndex) {
        condition['offset'] = (pageIndex * pageSize);
      }
      if (pageSize) {
        condition['limit'] = pageSize;
      }
    }

    const { count, rows } = await SalesRep.findAndCountAll(condition);

    res.status(200).json({
      message: "Sales Representatives fetched successfully!",
      action: getAction(req),
      total: count,
      statusCount,
      rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching sales representatives failed!";
    next(error, req, res);
  }
};

export const getSalesRep = async (req, res, next) => {
  try {
    const salesRep = await SalesRep.findByPk(req.params.id);
    if (!salesRep) {
      return res.status(404).json({ message: "Sales Representative not found!" });
    }

    const documents = await DocumentDetail.findAll({ where: { doc_ref_id: salesRep.id, doc_ref_type: DOC_REF_TYPE } });
    const zones = await getZones();

    return res.status(200).json({ action: getAction(req), salesRep, documents, zones });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Sales Representative failed!";
    next(error, req, res);
  }
};
