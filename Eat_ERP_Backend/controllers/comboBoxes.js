import { Op } from 'sequelize';
import sequelize from '../lib/database.js';

import ComboBox from '../models/comboBox.js';
import ComboBoxItem from '../models/comboBoxItem.js';
import Product from '../models/product.js';
import Box from '../models/box.js';
import Category from '../models/category.js';

// Combo Box master has no maker-checker flow (same as old PHP module):
// records are saved directly with status 'Approved' (Active) or 'InActive'.
// Items are either a 'Bar' (product_master) or a 'Box' (box_master).
// Cost, HSN Name, Category and Tax are hidden on the old PHP form, so the form does not edit them.

const invalid = (res, error) => res.status(422).json({
  message: "Invalid inputs passed, please check your data.",
  error: error
});

// Active records, plus any already on the combo box being edited
const activeOrIds = (ids) => (ids.length
  ? { [Op.or]: [{ status: 'Approved' }, { id: ids }] }
  : { status: 'Approved' });

const getBars = async (ids = []) => Product.findAll({
  where: activeOrIds(ids),
  attributes: ['id', 'product_name', 'grams', 'rate'],
  order: [['product_name', 'ASC']]
});

const getBoxes = async (ids = []) => Box.findAll({
  where: activeOrIds(ids),
  attributes: ['id', 'box_name', 'grams', 'rate'],
  order: [['box_name', 'ASC']]
});

// Item names by type (combo_box_items.item_id points to product_master or box_master)
const getItemNames = async (items) => {
  const barIds = items.filter((item) => item.type === 'Bar').map((item) => item.item_id);
  const boxIds = items.filter((item) => item.type === 'Box').map((item) => item.item_id);
  const bars = barIds.length ? await Product.findAll({ where: { id: barIds }, attributes: ['id', 'product_name'] }) : [];
  const boxes = boxIds.length ? await Box.findAll({ where: { id: boxIds }, attributes: ['id', 'box_name'] }) : [];
  const names = { Bar: new Map(), Box: new Map() };
  bars.forEach((bar) => names.Bar.set(bar.id, bar.product_name));
  boxes.forEach((box) => names.Box.set(box.id, box.box_name));
  return (item) => (names[item.type] && names[item.type].get(item.item_id)) || '';
};

// Builds combo_box_items rows from the request. Grams / rate are always taken from the
// product or box master, as the old PHP form did, so totals can't be tampered with.
const buildItems = async (req, existingItems = []) => {
  const rows = Array.isArray(req.body.items) ? req.body.items : [];
  if (rows.length === 0) {
    return { error: { errors: { items: { message: 'Please add atleast one product' } } } };
  }

  const ids = { Bar: [], Box: [] };
  for (const row of rows) {
    if (ids[row.type] && +row.item_id) {
      ids[row.type].push(+row.item_id);
    }
  }
  const bars = ids.Bar.length ? await Product.findAll({ where: { id: ids.Bar } }) : [];
  const boxes = ids.Box.length ? await Box.findAll({ where: { id: ids.Box } }) : [];
  const records = { Bar: new Map(bars.map((bar) => [bar.id, bar])), Box: new Map(boxes.map((box) => [box.id, box])) };
  const existing = new Set(existingItems.map((item) => `${item.type}-${item.item_id}`));

  const items = [];
  const seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `Row ${i + 1}`;
    if (row.type !== 'Bar' && row.type !== 'Box') {
      return { error: { errors: { items: { message: `${label}: Type must be Bar or Box` } } } };
    }
    const record = records[row.type].get(+row.item_id);
    if (!record) {
      return { error: { errors: { items: { message: `${label}: ${row.type === 'Bar' ? 'Product' : 'Box'} is required` } } } };
    }
    const key = `${row.type}-${record.id}`;
    const name = row.type === 'Bar' ? record.product_name : record.box_name;
    if (record.status !== 'Approved' && !existing.has(key)) {
      return { error: { errors: { items: { message: `${label}: ${name} is not active` } } } };
    }
    // Old PHP: "Please select different product for all records."
    if (seen.has(key)) {
      return { error: { errors: { items: { message: `${label}: ${name} is selected more than once` } } } };
    }
    seen.add(key);
    const qty = +row.qty;
    if (!row.qty || isNaN(qty) || qty <= 0) {
      return { error: { errors: { items: { message: `${label}: Qty must be greater than 0` } } } };
    }

    const item = ComboBoxItem.build({});
    item.setFromItem(row.type, record, qty);
    items.push(item);
  }

  return { items };
};

// Old PHP save_data: delete all combo_box_items rows of the combo box, then insert the posted rows
const saveItems = async (comboBox, items, t) => {
  await ComboBoxItem.destroy({ where: { combo_box_id: comboBox.id }, transaction: t });
  for (const item of items) {
    item.combo_box_id = comboBox.id;
    await item.save({ transaction: t });
  }
};

export const getMasterData = async (req, res, next) => {
  try {
    const bars = await getBars();
    const boxes = await getBoxes();

    return res.status(200).json({ bars, boxes });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createComboBox = async (req, res, next) => {
  let t;

  try {
    const comboBox = await ComboBox.build({
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    await comboBox.getRequestData(req);
    // New combo box is always Active
    comboBox.status = 'Approved';

    const { items, error: itemError } = await buildItems(req);
    if (itemError) {
      return invalid(res, itemError);
    }
    comboBox.setTotals(items);

    const error = await comboBox.validateData();
    if (error) {
      return invalid(res, error);
    }

    t = await sequelize.transaction();
    await comboBox.save({ transaction: t });
    await saveItems(comboBox, items, t);
    await t.commit();

    return res.status(201).json({
      message: "Combo Box added successfully",
      comboBox: comboBox
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }

    res.statusCode = 500;
    res.message = "Creating a combo box failed!";
    next(error, req, res);
  }
};

export const updateComboBox = async (req, res, next) => {
  let t;

  try {
    const comboBox = await ComboBox.findByPk(req.params.id);
    if (!comboBox) {
      return res.status(404).json({ message: "Combo Box not found!" });
    }

    await comboBox.getRequestData(req);
    comboBox.modified_by = req.userData.userId;

    const existingItems = await ComboBoxItem.findAll({ where: { combo_box_id: comboBox.id }, attributes: ['type', 'item_id'] });
    const { items, error: itemError } = await buildItems(req, existingItems);
    if (itemError) {
      return invalid(res, itemError);
    }
    comboBox.setTotals(items);

    const error = await comboBox.validateData();
    if (error) {
      return invalid(res, error);
    }

    t = await sequelize.transaction();
    await comboBox.save({ transaction: t });
    await saveItems(comboBox, items, t);
    await t.commit();

    res.status(200).json({
      message: "Update successful!",
      comboBox: comboBox
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }

    res.statusCode = 500;
    res.message = "Couldn't update combo box!";
    next(error, req, res);
  }
};

export const getComboBoxes = async (req, res, next) => {
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
      sort = { key: req.query.key, order: req.query.order };
    }

    const statusCount = {
      approved: 0,
      inActive: 0
    };
    const data = await ComboBox.findAll({
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

    const statusCondition = { status: status.trim().toUpperCase() === 'INACTIVE' ? 'InActive' : 'Approved' };

    const condition = {};
    if (query) {
      condition['where'] = {
        [Op.and]: [
          {[Op.or]: [
            { 'combo_box_name': {[Op.like]: `%${query}%` } },
            { 'short_name': {[Op.like]: `%${query}%` } },
            { 'asin': {[Op.like]: `%${query}%` } },
            { 'sku_code': {[Op.like]: `%${query}%` } },
            { 'barcode': {[Op.like]: `%${query}%` } },
            { 'hsn_code': {[Op.like]: `%${query}%` } }
          ]},
          statusCondition
        ]
      };
    } else {
      condition['where'] = statusCondition;
    }

    const sortableKeys = ['combo_box_name', 'short_name', 'asin', 'sku_code', 'barcode', 'hsn_code', 'grams', 'amount', 'gst', 'gst_rate', 'rate', 'modified_on'];
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

    condition['include'] = [{ model: Category, as: 'category', attributes: ['category_name'] }];

    const { count, rows } = await ComboBox.findAndCountAll(condition);

    // Old PHP list shows the items of each combo box as "Item Name - Qty"
    const comboIds = rows.map((row) => row.id);
    const items = comboIds.length
      ? await ComboBoxItem.findAll({ where: { combo_box_id: comboIds }, attributes: ['combo_box_id', 'type', 'item_id', 'qty'], order: [['id', 'ASC']] })
      : [];
    const nameOf = await getItemNames(items);
    const itemsByCombo = new Map();
    for (const item of items) {
      const list = itemsByCombo.get(item.combo_box_id) || [];
      list.push(`${nameOf(item)} - ${item.qty}`);
      itemsByCombo.set(item.combo_box_id, list);
    }
    const result = rows.map((row) => ({ ...row.toJSON(), combo_items: itemsByCombo.get(row.id) || [] }));

    const roleDetails = req.userData.roleDetails;
    const action = {
      insert: roleDetails.r_insert ? true : false,
      update: roleDetails.r_edit ? true : false
    };

    res.status(200).json({
      message: "Combo Boxes fetched successfully!",
      action: action,
      total: count,
      statusCount: statusCount,
      rows: result
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching combo boxes failed!";
    next(error, req, res);
  }
};

export const getComboBox = async (req, res, next) => {
  try {
    const comboBox = await ComboBox.findByPk(req.params.id);
    if (!comboBox) {
      return res.status(404).json({ message: "Combo Box not found!" });
    }

    const items = await ComboBoxItem.findAll({
      where: { combo_box_id: comboBox.id },
      attributes: ['id', 'type', 'item_id', 'qty', 'grams', 'rate', 'amount'],
      order: [['id', 'ASC']]
    });

    const roleDetails = req.userData.roleDetails;
    const action = {
      update: roleDetails.r_edit ? true : false
    };

    const bars = await getBars(items.filter((item) => item.type === 'Bar').map((item) => item.item_id));
    const boxes = await getBoxes(items.filter((item) => item.type === 'Box').map((item) => item.item_id));

    return res.status(200).json({ action, comboBox, items, bars, boxes });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Combo Box failed!";
    next(error, req, res);
  }
};
