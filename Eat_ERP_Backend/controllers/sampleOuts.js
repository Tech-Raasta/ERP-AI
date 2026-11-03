import sequelize from '../lib/database.js';
import { fiscalYear, nextSeries, MERGE_COLUMNS } from '../lib/salesApproval.js';
import { getGatePassData, getVoucherData, renderGatePass, renderVoucher, voucherPage } from '../lib/salesPrint.js';
import {
  select, execute, invalid, text, dateOrNull, today, ITEM_TYPES, DELIVERY_STATUSES, userDepotIds, getAction,
  getPermissions, isFreezedMonth, findSale, findPendingCopy, toDate, insertRow, updateRow, parseJson, assetUrl, isSampleRow,
  loadDispatch, issueGatePass
} from './sales.js';

// Sample / Expiry (old PHP Sample_out): free goods sent out as samples (gifting, promoters, bloggers) or written off
// as expired. Stored in distributor_out like sales, with distributor_id 1 (Sample) and the receiving distributor in
// sample_distributor_id (189 'Product Expired' for expiry). Items are valued at cost, without tax. Approval issues a
// Business Promotion Voucher number and a gate pass number; there is no ledger entry.

const SAMPLE_DISTRIBUTOR = 1;
const EXPIRY_DISTRIBUTOR = 189;
const SAMPLE_TYPES = ['Gifting', 'Promoter', 'Blogger'];
const UPLOAD_FOLDER = 'sample_out';

const SAMPLE_ROWS = `(A.distributor_id = 1 or A.distributor_id = 189)`;

// Old PHP get_list_data tabs; the list opens on Delivery Pending
const STATUS_CONDITIONS = {
  approved: `A.status = 'Approved'`,
  pending: `(A.status = 'Pending' and (A.delivery_status is null or A.delivery_status = ''))`,
  pending_for_approval: `((A.status = 'Pending' and A.delivery_status in ('Pending', 'GP Issued', 'Delivered Not Complete', 'Delivered')) or A.status = 'Deleted')`,
  pending_for_delivery: `(A.status = 'Approved' and A.delivery_status = 'Pending')`,
  gp_issued: `(A.status = 'Approved' and A.delivery_status = 'GP Issued')`,
  delivered_not_complete: `(A.status = 'Approved' and A.delivery_status = 'Delivered Not Complete')`,
  inactive: `A.status = 'InActive'`
};

const uploadedFile = (req, field) => {
  const file = (Array.isArray(req.files) ? req.files : []).find((item) => item.fieldname === field);
  return file ? `${UPLOAD_FOLDER}/${file.filename}` : null;
};

const findSample = async (id, depotIds, transaction) => {
  const sale = await findSale(id, depotIds, transaction);
  return sale && isSampleRow(sale) ? sale : null;
};

export const getSamples = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const statusCount = Object.fromEntries(Object.keys(STATUS_CONDITIONS).map((key) => [key, 0]));
    if (depotIds.length === 0) {
      return res.status(200).json({ message: "Samples fetched successfully!", action: getAction(req), total: 0, statusCount, rows: [] });
    }

    const status = req.query.status && STATUS_CONDITIONS[req.query.status.toString().toLowerCase()]
      ? req.query.status.toString().toLowerCase()
      : 'pending_for_delivery';
    const query = text(req.query.query);
    const pageAll = text(req.query.pageSize).toUpperCase() === 'ALL';
    const pageSize = pageAll ? 0 : (+req.query.pageSize || 10);
    const pageIndex = +req.query.pageIndex || 0;

    // Old PHP get_data_count (its "pending" count compared delivery_status = null, which never matches)
    const counts = await select(
      `select ${Object.keys(STATUS_CONDITIONS).map((key) => `sum(${STATUS_CONDITIONS[key]}) as ${key}`).join(', ')}
       from distributor_out A where A.depot_id in (:depotIds) and ${SAMPLE_ROWS}`,
      { depotIds }
    );
    for (const key in statusCount) {
      statusCount[key] = +counts[0][key] || 0;
    }

    const search = query
      ? `and (A.id like :query or DATE_FORMAT(A.date_of_processing, '%d/%m/%Y') like :query or A.invoice_no like :query
          or A.voucher_no like :query or A.final_amount like :query or A.status like :query or A.delivery_status like :query
          or B.distributor_name like :query or C.location like :query)`
      : '';
    const from = `from distributor_out A
       left join distributor_master B on (ifnull(A.sample_distributor_id, A.distributor_id) = B.id)
       left join location_master C on (B.location_id = C.id)
       left join depot_master D on (A.depot_id = D.id)
       where ${STATUS_CONDITIONS[status]} and ${SAMPLE_ROWS} and A.depot_id in (:depotIds) ${search}`;

    const sortable = {
      date_of_processing: 'A.date_of_processing',
      voucher_no: 'A.voucher_no',
      distributor_name: 'B.distributor_name',
      final_amount: 'A.final_amount',
      delivery_status: 'A.delivery_status'
    };
    const sortKey = sortable[req.query.key] || 'A.modified_on';
    const sortOrder = text(req.query.order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const replacements = { depotIds, query: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };

    const total = await select(`select count(A.id) as count ${from}`, replacements);
    const rows = await select(
      `select A.id, A.date_of_processing, A.invoice_no, A.voucher_no, A.gate_pass_no, A.distributor_id, A.sample_distributor_id,
         A.final_amount, A.status, A.delivery_status, A.sample_type, A.modified_on, B.distributor_name, C.location, D.depot_name
       ${from}
       order by ${sortKey} ${sortOrder}, A.id desc
       ${pageAll ? '' : 'limit :limit offset :offset'}`,
      replacements
    );

    res.status(200).json({ message: "Samples fetched successfully!", action: getAction(req), total: +total[0].count, statusCount, rows });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching samples failed!";
    next(error, req, res);
  }
};

export const getSample = async (req, res, next) => {
  try {
    const id = +req.params.id || 0;
    const depotIds = userDepotIds(req);
    if (!id || depotIds.length === 0) {
      return res.status(404).json({ message: "Sample not found!" });
    }
    const rows = await select(
      `select A.*, B.distributor_name, L.location, D.depot_name, D.state as depot_state, F.sales_rep_name,
         PR.sales_rep_name as promoter_name, G.sales_rep_name as delivery_person,
         concat(ifnull(H.first_name, ''), ' ', ifnull(H.last_name, '')) as modified_by_name,
         concat(ifnull(I.first_name, ''), ' ', ifnull(I.last_name, '')) as approved_by_name,
         P.status as po_status, P.mismatch
       from distributor_out A
       left join distributor_master B on (ifnull(A.sample_distributor_id, A.distributor_id) = B.id)
       left join location_master L on (B.location_id = L.id)
       left join depot_master D on (A.depot_id = D.id)
       left join sales_rep_master F on (A.sales_rep_id = F.id)
       left join sales_rep_master PR on (A.promoter_sales_rep_id = PR.id)
       left join sales_rep_master G on (A.delivery_sales_rep_id = G.id)
       left join user_master H on (A.modified_by = H.id)
       left join user_master I on (A.approved_by = I.id)
       left join distributor_po P on (A.distributor_po_id = P.id)
       where A.id = :id and A.depot_id in (:depotIds) and ${SAMPLE_ROWS}`,
      { id, depotIds }
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Sample not found!" });
    }
    // Old PHP read the entered lines and fell back to the exploded ones for older entries
    let items = await select(
      `select S.*, case when S.type = 'Bar' then P.product_name when S.type = 'Combo Box' then CB.combo_box_name else BX.box_name end as item_name
       from distributor_out_sale_items S
       left join product_master P on (S.type = 'Bar' and S.item_id = P.id)
       left join box_master BX on (S.type = 'Box' and S.item_id = BX.id)
       left join combo_box_master CB on (S.type = 'Combo Box' and S.item_id = CB.id)
       where S.distributor_out_id = :id order by S.id`,
      { id }
    );
    if (!items.length) {
      items = await select(
        `select S.*, case when S.type = 'Bar' then P.product_name else BX.box_name end as item_name
         from distributor_out_items S
         left join product_master P on (S.type = 'Bar' and S.item_id = P.id)
         left join box_master BX on (S.type = 'Box' and S.item_id = BX.id)
         where S.distributor_out_id = :id order by S.id`,
        { id }
      );
    }
    const pendingEditId = await findPendingCopy(id);
    res.status(200).json({
      action: getAction(req),
      permissions: getPermissions(req, rows[0]),
      sale: { ...rows[0], expiry: +rows[0].sample_distributor_id === EXPIRY_DISTRIBUTOR || +rows[0].distributor_id === EXPIRY_DISTRIBUTOR },
      items,
      pendingEditId
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Sample failed!";
    next(error, req, res);
  }
};

// Form master data (old PHP add / edit)
export const getMasterData = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const depots = depotIds.length
      ? await select(`select id, depot_name from depot_master where status = 'Approved' and id in (:depotIds) order by depot_name`, { depotIds })
      : [];
    const distributors = await select(
      `select id, distributor_name, credit_period from distributor_master where status = 'Approved' and id not in (1, 189) order by distributor_name`
    );
    const salesReps = await select(`select id, sales_rep_name from sales_rep_master where status = 'Approved' and sr_type = 'Sales Representative' order by sales_rep_name`);
    const promoters = await select(`select id, sales_rep_name from sales_rep_master where status = 'Approved' and sr_type = 'Promoter' order by sales_rep_name`);
    const boxes = await select(`select id, box_name from box_master where status = 'Approved' order by box_name`);
    const comboBoxes = await select(`select id, combo_box_name from combo_box_master where status = 'Approved' and gst = 'Yes' order by modified_on desc`);
    const bars = await select(`select id, product_name from product_master where status = 'Approved' order by product_name`);
    const sample = await select(`select credit_period from distributor_master where id = 1`);
    res.status(200).json({
      action: getAction(req), depots, distributors, salesReps, promoters, boxes, comboBoxes, bars,
      sampleCreditPeriod: sample.length ? sample[0].credit_period : null
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

// Old PHP Box/Product get_data (cost) and Combo_box get_data (rate): samples are valued at cost
const findItemDetails = async (type, id) => {
  const table = { Bar: 'product_master', Box: 'box_master', 'Combo Box': 'combo_box_master' }[type];
  if (!table) return null;
  const column = type === 'Combo Box' ? 'rate' : 'cost';
  const rows = await select(`select ${column} as rate, grams from ${table} where id = :id`, { id });
  return rows[0] || null;
};

export const getItemDetails = async (req, res, next) => {
  try {
    const details = await findItemDetails(text(req.query.type), +req.query.id || 0);
    if (!details) {
      return res.status(404).json({ message: "Item not found!" });
    }
    res.status(200).json({ rate: +details.rate || 0, grams: +details.grams || 0 });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching item details failed!";
    next(error, req, res);
  }
};

const round2 = (value) => Math.round((+value || 0) * 100) / 100;

// Validates the form and builds the row and its lines (old PHP Sample_out_model::save_data + validations.js)
const buildSample = async (req, existing) => {
  const body = typeof (req.body || {}).payload === 'string' ? parseJson(req.body.payload, {}) : (req.body || {});
  const errors = {};
  const addError = (field, message) => { if (!errors[field]) errors[field] = { message }; };
  const depotIds = userDepotIds(req);
  const keep = (key) => (existing ? existing[key] : null);

  const dateOfProcessing = dateOrNull(body.date_of_processing);
  if (!dateOfProcessing) addError('date_of_processing', 'Date is required');
  else if (dateOfProcessing > today()) addError('date_of_processing', 'Date cannot be in the future');
  else if (await isFreezedMonth(dateOfProcessing)) addError('date_of_processing', 'Please Select Another Date ,This Date is Freezed');

  const depotId = +body.depot_id || 0;
  if (!depotIds.includes(depotId) || !(await select(`select id from depot_master where id = :depotId`, { depotId })).length) {
    addError('depot_id', 'Depot is required');
  }

  const salesRepId = +body.sales_rep_id || 0;
  if (!salesRepId) addError('sales_rep_id', 'Sales Representative is required');
  else if (!(await select(`select id from sales_rep_master where id = :salesRepId`, { salesRepId })).length) addError('sales_rep_id', 'Sales Representative not found');

  // Expiry ticks the receiving distributor to 'Product Expired'
  const expiry = body.expiry === true || body.expiry === 'true' || body.expiry === 1 || body.expiry === '1';
  let sampleDistributorId = expiry ? EXPIRY_DISTRIBUTOR : (+body.sample_distributor_id || 0);
  if (!expiry) {
    if (!sampleDistributorId) addError('sample_distributor_id', 'Distributor is required');
    else if (!(await select(`select id from distributor_master where id = :sampleDistributorId and id not in (1, 189)`, { sampleDistributorId })).length) {
      addError('sample_distributor_id', 'Distributor not found');
    }
  }

  const sampleType = text(body.sample_type);
  if (sampleType && !SAMPLE_TYPES.includes(sampleType)) addError('sample_type', 'Invalid Type');
  const promoterId = sampleType === 'Promoter' ? (+body.promoter_sales_rep_id || null) : null;
  const bloggerEmail = sampleType === 'Blogger' ? text(body.blogger_email_id) : '';
  if (bloggerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bloggerEmail)) addError('blogger_email_id', 'Please enter a valid email');

  const dueDate = dateOrNull(body.due_date);
  if (!dueDate) addError('due_date', 'Due Date is required');

  const discount = text(body.discount);
  if (discount !== '' && (isNaN(+discount) || +discount < 0 || +discount > 100)) addError('discount', 'Discount must be between 0 and 100');

  const remarks = text(body.remarks);
  if (existing && existing.status === 'Approved' && !remarks) addError('remarks', 'Remarks is required');

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) addError('items', 'Please add atleast one item.');
  const lines = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index] || {};
    const type = text(item.type);
    const itemId = +item.item_id || 0;
    if (!ITEM_TYPES.includes(type)) addError(`items[${index}].type`, 'Type is required');
    if (!itemId) addError(`items[${index}].item_id`, 'Item is required');
    else if (ITEM_TYPES.includes(type) && !(await findItemDetails(type, itemId))) addError(`items[${index}].item_id`, 'Item not found');
    if (text(item.qty) === '' || isNaN(+item.qty)) addError(`items[${index}].qty`, 'Qty is required');
    else if (!(+item.qty > 0)) addError(`items[${index}].qty`, 'Qty must be more than 0');
    if (text(item.sell_rate) === '' || isNaN(+item.sell_rate)) addError(`items[${index}].sell_rate`, 'Sell Rate is required');
    else if (+item.sell_rate < 0) addError(`items[${index}].sell_rate`, 'Sell Rate cannot be negative');

    lines.push({
      type,
      item_id: itemId,
      qty: round2(item.qty),
      sell_rate: round2(item.sell_rate),
      grams: round2(item.grams),
      rate: round2(item.rate),
      amount: round2((+item.qty || 0) * (+item.sell_rate || 0))
    });
  }
  const total = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  if (lines.length && total === 0) addError('items', 'Amount cannot be zero.');

  if (Object.keys(errors).length) {
    return { errors };
  }

  // Shown (and editable) only once the entry left Pending; new entries start 'Pending'
  let deliveryStatus = existing ? (existing.delivery_status || 'Pending') : 'Pending';
  if (existing && existing.status !== 'Pending' && DELIVERY_STATUSES.includes(text(body.delivery_status))) {
    deliveryStatus = text(body.delivery_status);
  }
  // Old PHP: uploading the receivable document (edit only) marks it Delivered
  let receivableDoc = keep('receivable_doc');
  const receivableFile = existing && existing.status !== 'Pending' ? uploadedFile(req, 'receivable_doc_file') : null;
  if (receivableFile) {
    receivableDoc = receivableFile;
    deliveryStatus = 'Delivered';
  }

  const row = {
    date_of_processing: dateOfProcessing,
    invoice_no: keep('invoice_no'),
    voucher_no: keep('voucher_no'),
    // PHP left the gate pass no off the pending copy, so approving an edit wiped it; carry it over
    gate_pass_no: keep('gate_pass_no'),
    invoice_date: keep('invoice_date'),
    depot_id: depotId,
    distributor_id: existing && isSampleRow(existing) ? existing.distributor_id : SAMPLE_DISTRIBUTOR,
    sample_distributor_id: sampleDistributorId,
    sales_rep_id: salesRepId,
    amount: total,
    tax: null,
    tax_per: 0,
    tax_amount: 0,
    final_amount: total,
    due_date: dueDate,
    order_no: keep('order_no'),
    order_date: keep('order_date'),
    supplier_ref: text(body.supplier_ref),
    despatch_doc_no: text(body.despatch_doc_no),
    despatch_through: text(body.despatch_through),
    destination: text(body.destination),
    remarks,
    discount: discount === '' ? 0 : round2(discount),
    delivery_status: deliveryStatus,
    // PHP posted a disabled (never sent) delivery date and lost it on every edit; keep it
    delivery_date: keep('delivery_date'),
    sample_type: sampleType || null,
    gifting_remarks: sampleType === 'Gifting' ? text(body.gifting_remarks) : null,
    promoter_sales_rep_id: promoterId,
    blogger_name: sampleType === 'Blogger' ? text(body.blogger_name) : null,
    blogger_address: sampleType === 'Blogger' ? text(body.blogger_address) : null,
    blogger_phone_no: sampleType === 'Blogger' ? text(body.blogger_phone_no) : null,
    blogger_email_id: sampleType === 'Blogger' ? bloggerEmail : null,
    receivable_doc: receivableDoc
  };
  return { row, lines };
};

// Lines as entered, and distributor_out_items with combo boxes exploded (old PHP Sample_out_model::set_distributor_out_items:
// the combo's value is spread over its items at their MRP less the combo discount, before tax)
const saveSampleItems = async (id, lines, transaction) => {
  await execute(`delete from distributor_out_sale_items where distributor_out_id = :id`, { id }, transaction);
  await execute(`delete from distributor_out_items where distributor_out_id = :id`, { id }, transaction);
  for (const line of lines) {
    const saleItem = {
      distributor_out_id: id,
      type: line.type,
      item_id: line.item_id,
      qty: line.qty,
      sell_rate: line.sell_rate,
      grams: line.grams,
      rate: line.rate,
      amount: line.amount,
      combo_box_id: line.type === 'Combo Box' ? line.item_id : null
    };
    await insertRow('distributor_out_sale_items', saleItem, transaction);
    if (line.type !== 'Combo Box') {
      await insertRow('distributor_out_items', saleItem, transaction);
      continue;
    }

    const totals = await select(
      `select sum(:qty * ifnull(A.qty, 0) * ifnull(case when A.type = 'Box' then B.rate else C.rate end, 0)) as total_amount
       from combo_box_items A
       left join box_master B on (A.item_id = B.id)
       left join product_master C on (A.item_id = C.id)
       where A.combo_box_id = :comboBoxId`,
      { qty: line.qty, comboBoxId: line.item_id }, transaction
    );
    const totalAmount = totals.length ? (+totals[0].total_amount || 0) : 0;
    const discPer = totalAmount !== 0 ? round2(((totalAmount - line.amount) / totalAmount) * 100) : 0;
    const contents = await select(
      `select A.type, A.item_id, A.qty,
         case when A.type = 'Box' then B.grams else C.grams end as item_grams,
         case when A.type = 'Box' then B.rate else C.rate end as item_rate,
         case when D.gst = 'Yes' then D.gst_rate when A.type = 'Box' then B.tax_percentage else C.tax_percentage end as item_tax_per
       from combo_box_items A
       left join box_master B on (A.item_id = B.id)
       left join product_master C on (A.item_id = C.id)
       left join combo_box_master D on (A.combo_box_id = D.id)
       where A.combo_box_id = :comboBoxId`,
      { comboBoxId: line.item_id }, transaction
    );
    for (const content of contents) {
      const itemQty = (+content.qty || 0) * line.qty;
      const itemRate = +content.item_rate || 0;
      const taxPer = +content.item_tax_per || 0;
      const sellRate = Math.round(((itemRate - (itemRate * discPer) / 100) / (100 + taxPer)) * 100 * 10000) / 10000;
      await insertRow('distributor_out_items', {
        distributor_out_id: id,
        type: content.type,
        item_id: content.item_id,
        qty: itemQty,
        sell_rate: sellRate,
        grams: +content.item_grams || 0,
        rate: itemRate,
        amount: round2(itemQty * sellRate),
        combo_box_id: line.item_id
      }, transaction);
    }
  }
};

export const createSample = async (req, res, next) => {
  try {
    const { errors, row, lines } = await buildSample(req, null);
    if (errors) {
      return invalid(res, errors);
    }
    const now = new Date();
    const userId = req.userData.userId;
    const t = await sequelize.transaction();
    try {
      const id = await insertRow('distributor_out', {
        ...row, status: 'Pending', ref_id: null, created_by: userId, created_on: now, modified_by: userId, modified_on: now
      }, t);
      await saveSampleItems(id, lines, t);
      await t.commit();
      res.status(201).json({ message: "Sample submitted for approval!", id });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating sample failed!";
    next(error, req, res);
  }
};

// Same flow as Sales: an Approved entry is changed through a Pending copy (ref_id) replacing it on approval
export const updateSample = async (req, res, next) => {
  try {
    const existing = await findSample(+req.params.id || 0, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Sample not found!" });
    }
    if (!getPermissions(req, existing).submit) {
      return res.status(401).json({ message: "You cannot edit this sample." });
    }
    const { errors, row, lines } = await buildSample(req, existing);
    if (errors) {
      return invalid(res, errors);
    }

    const now = new Date();
    const userId = req.userData.userId;
    const t = await sequelize.transaction();
    try {
      let id = existing.id;
      let refId = existing.ref_id || null;
      if (existing.status === 'Approved') {
        refId = existing.id;
        id = await findPendingCopy(refId, t);
      }
      const data = { ...row, status: 'Pending', ref_id: refId, modified_by: userId, modified_on: now };
      if (refId) {
        data.modified_approved_date = now;
      }
      if (id) {
        await updateRow('distributor_out', id, data, t);
      } else {
        id = await insertRow('distributor_out', { ...data, created_by: userId, created_on: now }, t);
      }
      await saveSampleItems(id, lines, t);
      await t.commit();
      res.status(200).json({ message: "Sample submitted for approval!", id });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Updating sample failed!";
    next(error, req, res);
  }
};

// Approve (old PHP save_data with btn_approve): a Deleted request cancels the entry; otherwise Approved.
// First approval gives the voucher no 'WHPL/<fy start>-VOU/<series>' and the gate pass no 'WHPL/<fy>/gate_pass/<series>'.
export const approveSample = async (req, res, next) => {
  try {
    if (!req.userData.roleDetails.r_approvals) {
      return res.status(401).json({ message: "You are not authorised!" });
    }
    const id = +req.params.id || 0;
    const sample = await findSample(id, userDepotIds(req));
    if (!sample) {
      return res.status(404).json({ message: "Sample not found!" });
    }
    if (!getPermissions(req, sample).approve) {
      return res.status(401).json({ message: "You cannot approve this sample." });
    }

    const remarks = text((req.body || {}).remarks);
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const locked = (await select(`select * from distributor_out where id = :id for update`, { id }, t))[0];
      if (!locked || (locked.status !== 'Pending' && locked.status !== 'Deleted')) {
        await t.rollback();
        return res.status(422).json({ message: "This sample is no longer waiting for approval." });
      }

      const status = locked.status === 'Deleted' ? 'InActive' : 'Approved';
      let voucherNo = text(locked.voucher_no);
      let gatePassNo = text(locked.gate_pass_no) || null;
      let invoiceDate = toDate(locked.invoice_date);
      if (!voucherNo) {
        invoiceDate = invoiceDate || today();
        const voucherSeries = await nextSeries(sequelize, 'Voucher', t);
        voucherNo = `WHPL/${fiscalYear(invoiceDate).split('-')[0]}-VOU/${voucherSeries}`;
        if (!gatePassNo) {
          const gatePassSeries = await nextSeries(sequelize, 'Gate_Pass', t);
          gatePassNo = `WHPL/${fiscalYear(toDate(locked.date_of_processing))}/gate_pass/${gatePassSeries}`;
        }
      }

      let sampleId = id;
      if (locked.ref_id) {
        const refId = +locked.ref_id;
        const original = (await select(`select id, gate_pass_no from distributor_out where id = :refId for update`, { refId }, t))[0];
        if (!original) {
          await t.rollback();
          return res.status(422).json({ message: `The entry this changes (#${refId}) no longer exists.` });
        }
        await execute(
          `update distributor_out A, distributor_out B
           set ${MERGE_COLUMNS.map((column) => `A.${column} = B.${column}`).join(', ')},
             A.invoice_no = B.invoice_no, A.status = :status, A.remarks = :remarks, A.approved_by = :userId, A.approved_on = :now,
             A.voucher_no = :voucherNo, A.gate_pass_no = :gatePassNo, A.invoice_date = :invoiceDate, A.modified_approved_date = :today
           where A.id = :refId and B.id = :id`,
          { status, remarks, userId, now, voucherNo, gatePassNo: gatePassNo || original.gate_pass_no, invoiceDate, today: today(), refId, id }, t
        );
        await execute(`delete from distributor_out_sale_items where distributor_out_id = :refId`, { refId }, t);
        await execute(`update distributor_out_sale_items set distributor_out_id = :refId where distributor_out_id = :id`, { refId, id }, t);
        await execute(`delete from distributor_out_items where distributor_out_id = :refId`, { refId }, t);
        await execute(`update distributor_out_items set distributor_out_id = :refId where distributor_out_id = :id`, { refId, id }, t);
        await execute(`delete from distributor_out where id = :id`, { id }, t);
        sampleId = refId;
      } else {
        await execute(
          `update distributor_out set status = :status, remarks = :remarks, approved_by = :userId, approved_on = :now,
             voucher_no = :voucherNo, gate_pass_no = :gatePassNo, invoice_date = :invoiceDate
           where id = :id`,
          { status, remarks, userId, now, voucherNo, gatePassNo, invoiceDate, id }, t
        );
      }
      await t.commit();
      res.status(200).json({
        message: status === 'InActive' ? "Sample cancelled!" : `Sample approved! Voucher No: ${voucherNo}`,
        id: sampleId,
        voucher_no: voucherNo,
        print: status === 'Approved'
      });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Approving sample failed!";
    next(error, req, res);
  }
};

// Only lets the shared Sales handlers (delete, reject) act on sample rows
export const onlySamples = async (req, res, next) => {
  try {
    if (!(await findSample(+req.params.id || 0, userDepotIds(req)))) {
      return res.status(404).json({ message: "Sample not found!" });
    }
    next();
  } catch (error) {
    res.statusCode = 500;
    next(error, req, res);
  }
};

export const getDispatch = (req, res, next) => loadDispatch(req, res, next, { sample: true });

export const dispatchSample = (req, res, next) => issueGatePass(req, res, next, { sample: true });

// Old PHP GP Issued popup for samples (set_delivery_status): Delivered (saved as 'Delivered Not Complete') or
// Return To HO, and Active / InActive (InActive cancels the entry). No delivery date or proof here.
export const updateDelivery = async (req, res, next) => {
  try {
    const id = +req.params.id || 0;
    const sample = await findSample(id, userDepotIds(req));
    if (!sample) {
      return res.status(404).json({ message: "Sample not found!" });
    }
    if (sample.status !== 'Approved' || sample.delivery_status !== 'GP Issued') {
      return res.status(422).json({ message: "Only samples with a gate pass issued can be updated here." });
    }
    const deliveryStatus = text((req.body || {}).delivery_status);
    const status = text((req.body || {}).status) || 'Approved';
    const errors = {};
    if (!['Delivered Not Complete', 'Pending'].includes(deliveryStatus)) errors.delivery_status = { message: 'Delivery Status is required' };
    if (!['Approved', 'InActive'].includes(status)) errors.status = { message: 'Status is required' };
    if (Object.keys(errors).length) {
      return invalid(res, errors);
    }
    await execute(
      `update distributor_out set delivery_status = :deliveryStatus, status = :status, modified_by = :userId, modified_on = :now
       where id = :id and delivery_status = 'GP Issued'`,
      { deliveryStatus, status, userId: req.userData.userId, now: new Date(), id }
    );
    res.status(200).json({ message: status === 'InActive' ? "Sample cancelled!" : "Delivery status updated!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Updating delivery failed!";
    next(error, req, res);
  }
};

// Business Promotion Voucher (old PHP view_tax_invoice -> voucher.php)
export const getVoucher = async (req, res, next) => {
  try {
    const sample = await findSample(+req.params.id || 0, userDepotIds(req));
    if (!sample) {
      return res.status(404).json({ message: "Sample not found!" });
    }
    if (!text(sample.voucher_no)) {
      return res.status(422).json({ message: "The voucher is available once the sample is approved." });
    }
    res.status(200).json({ html: renderVoucher(await getVoucherData(sequelize, sample.id), assetUrl(req)) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating voucher failed!";
    next(error, req, res);
  }
};

// Gate pass with batch details, followed by the vouchers (old PHP view_gate_pass, Sample branch)
export const getGatePass = async (req, res, next) => {
  try {
    const sample = await findSample(+req.params.id || 0, userDepotIds(req));
    if (!sample) {
      return res.status(404).json({ message: "Sample not found!" });
    }
    const group = await select(`select gp_id from gp_data where dist_id = :id order by gp_id desc limit 1`, { id: sample.id });
    if (!group.length) {
      return res.status(422).json({ message: "No gate pass has been issued for this sample." });
    }
    const members = await select(`select distinct dist_id from gp_data where gp_id = :gpId`, { gpId: group[0].gp_id });
    const ids = (await select(`select id from distributor_out where id in (:ids) and depot_id in (:depotIds)`,
      { ids: members.map((row) => row.dist_id), depotIds: userDepotIds(req) })).map((row) => row.id);

    const gatePass = await getGatePassData(sequelize, ids);
    let voucherPages = '';
    for (const sampleId of ids) {
      const voucher = await getVoucherData(sequelize, sampleId);
      if (voucher && text(voucher.voucher_no)) {
        voucherPages += `<div class="page-break">&nbsp;</div>${voucherPage(voucher, assetUrl(req))}`;
      }
    }
    const user = (await select(`select first_name, last_name from user_master where id = :id`, { id: req.userData.userId }))[0];
    const createdBy = user ? `${text(user.first_name)} ${text(user.last_name)}`.trim() : '';
    res.status(200).json({ html: renderGatePass(gatePass, [], assetUrl(req), createdBy, voucherPages) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating gate pass failed!";
    next(error, req, res);
  }
};
