import { Op, QueryTypes } from 'sequelize';
import sequelize from '../lib/database.js';

import BatchMaster from '../models/batchMaster.js';
import BatchMasterDoc from '../models/batchMasterDoc.js';

// Batch master (old PHP Batch_master): saved directly with status 'Approved' (Active) or 'InActive'.
// Production and the documents table are hidden on the old PHP form, so their current values are kept;
// documents are only replaced when a request sends them (docs + doc_file_<row> files).

const invalid = (res, error) => res.status(422).json({
  message: "Invalid inputs passed, please check your data.",
  error: error
});

// Old PHP: production_model->get_data('Approved'), shown by production id (p_id).
// Plain query: importing models/production.js here breaks the app's model import order (circular imports).
const getProductions = async (productionId) => sequelize.query(
  `select id, p_id from production_details
   where status = 'Approved' or id = :productionId
   order by modified_on desc`,
  { replacements: { productionId: productionId ? +productionId : 0 }, type: QueryTypes.SELECT }
);

// Rows come as a JSON string (multipart form) with optional files named doc_file_<row index>.
// Rows without a title are skipped, as in PHP.
const buildDocs = (req) => {
  let rows = [];
  try {
    rows = req.body.docs ? JSON.parse(req.body.docs) : [];
  } catch (error) {
    rows = [];
  }
  const files = Array.isArray(req.files) ? req.files : [];

  const docs = [];
  rows.forEach((row, index) => {
    const title = row && row.title ? row.title.toString().trim() : '';
    if (!title) {
      return;
    }
    const file = files.find((item) => item.fieldname === `doc_file_${index}`);
    docs.push({
      title,
      // multer (middleware/file.js) stores files in assets/uploads/batch_master with a unique name
      doc_img: file ? `batch_master/${file.filename}` : (row.doc_img || ''),
      receivable_doc: file ? file.originalname : (row.receivable_doc || '')
    });
  });
  return docs;
};

const saveDocs = async (batchMaster, req, t) => {
  if (req.body.docs === undefined) {
    return;
  }
  const docs = buildDocs(req);
  await BatchMasterDoc.destroy({ where: { batch_master_id: batchMaster.id }, transaction: t });
  for (const doc of docs) {
    await BatchMasterDoc.create({ ...doc, batch_master_id: batchMaster.id }, { transaction: t });
  }
};

const getAction = (req) => {
  const roleDetails = req.userData.roleDetails;
  return {
    insert: roleDetails.r_insert ? true : false,
    update: roleDetails.r_edit ? true : false
  };
};

export const getMasterData = async (req, res, next) => {
  try {
    const productions = await getProductions(null);
    return res.status(200).json({ productions });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createBatchMaster = async (req, res, next) => {
  let t;

  try {
    const now = new Date();
    const batchMaster = BatchMaster.build({
      status: 'Approved',
      created_by: req.userData.userId,
      created_date: now,
      updated_by: req.userData.userId,
      updated_date: now
    });

    batchMaster.getRequestData(req);
    // New batch is always Active
    batchMaster.status = 'Approved';

    const error = await batchMaster.validateData();
    if (error) {
      return invalid(res, error);
    }

    t = await sequelize.transaction();
    await batchMaster.save({ transaction: t });
    await saveDocs(batchMaster, req, t);
    await t.commit();

    return res.status(201).json({
      message: "Batch added successfully",
      batchMaster: batchMaster
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }

    res.statusCode = 500;
    res.message = "Creating a batch failed!";
    next(error, req, res);
  }
};

export const updateBatchMaster = async (req, res, next) => {
  let t;

  try {
    const batchMaster = await BatchMaster.findByPk(req.params.id);
    if (!batchMaster) {
      return res.status(404).json({ message: "Batch not found!" });
    }

    batchMaster.getRequestData(req);
    batchMaster.updated_by = req.userData.userId;
    batchMaster.updated_date = new Date();

    const error = await batchMaster.validateData();
    if (error) {
      return invalid(res, error);
    }

    t = await sequelize.transaction();
    await batchMaster.save({ transaction: t });
    await saveDocs(batchMaster, req, t);
    await t.commit();

    res.status(200).json({ message: "Update successful!", batchMaster: batchMaster });
  } catch (error) {
    if (t) {
      await t.rollback();
    }

    res.statusCode = 500;
    res.message = "Couldn't update batch!";
    next(error, req, res);
  }
};

export const getBatchMasters = async (req, res, next) => {
  try {
    let status = 'Approved';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'updated_date', order: 'desc' };

    if (req.query) {
      status = req.query.status ? req.query.status : 'Approved';
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query.toString().trim() : '';
      sort = { key: req.query.key, order: req.query.order };
    }

    const statusCount = {
      approved: 0,
      inActive: 0
    };
    const data = await BatchMaster.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      group: ['status'],
      raw: true
    });
    for (const item of data) {
      if (item.status === "Approved") {
        statusCount.approved = statusCount.approved + parseInt(item.count);
      } else if (item.status === "InActive") {
        statusCount.inActive = statusCount.inActive + parseInt(item.count);
      }
    }

    // status=all: every batch, like the old PHP list (get_data with no status filter)
    let statusCondition = { status: status.trim().toUpperCase() === 'INACTIVE' ? 'InActive' : 'Approved' };
    if (status.trim().toUpperCase() === 'ALL') {
      statusCondition = {};
    }

    const condition = {
      where: query
        ? { ...statusCondition, batch_no: { [Op.like]: `%${query}%` } }
        : statusCondition,
      attributes: ['id', 'batch_no', 'date_of_processing', 'production_id', 'status', 'remarks', 'updated_date']
    };

    // Old PHP list is ordered by updated_date desc
    const sortableKeys = ['batch_no', 'date_of_processing', 'updated_date'];
    let order = [['updated_date', 'DESC']];
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

    const { count, rows } = await BatchMaster.findAndCountAll(condition);

    res.status(200).json({
      message: "Batches fetched successfully!",
      action: getAction(req),
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching batches failed!";
    next(error, req, res);
  }
};

export const getBatchMaster = async (req, res, next) => {
  try {
    const batchMaster = await BatchMaster.findByPk(req.params.id, {
      attributes: ['id', 'batch_no', 'date_of_processing', 'production_id', 'status', 'remarks']
    });
    if (!batchMaster) {
      return res.status(404).json({ message: "Batch not found!" });
    }

    const docs = await BatchMasterDoc.findAll({
      where: { batch_master_id: batchMaster.id },
      attributes: ['title', 'doc_img', 'receivable_doc']
    });
    const productions = await getProductions(batchMaster.production_id);

    return res.status(200).json({ action: getAction(req), batchMaster, docs, productions });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Batch failed!";
    next(error, req, res);
  }
};
