import { QueryTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateLine, calculateTotals, getTaxType, round, setDistributorOutItems } from '../lib/salesCalc.js';
import { MERGE_COLUMNS, fiscalYear, nextSeries, setCreditNote, setLedger } from '../lib/salesApproval.js';
import { getGatePassData, getInvoiceData, renderGatePass, renderInvoice } from '../lib/salesPrint.js';

// Sales (old PHP Distributor_out).
// Phase 1: list and view. Phase 2: add / edit / delete, always saved as Pending for approval.
// Phase 3: approve (invoice no, pending copy merge, ledger, credit note) / reject. Phase 4: gate pass, delivery, uploads, printouts.

const select = (sql, replacements = {}, transaction) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
const execute = (sql, replacements = {}, transaction) => sequelize.query(sql, { replacements, transaction });

const invalid = (res, errors) => res.status(422).json({
  message: "Invalid inputs passed, please check your data.",
  error: { errors }
});

const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';
const dateOrNull = (value) => (/^\d{4}-\d{2}-\d{2}/.test(text(value)) ? text(value).substring(0, 10) : null);
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const ITEM_TYPES = ['Bar', 'Box', 'Combo Box'];
const DELIVERY_STATUSES = ['Pending', 'GP Issued', 'Delivered Not Complete', 'Delivered', 'Cancelled'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Distributors 1 and 189 are handled by the Sample / Expiry module, never by Sales (old PHP)
const EXCLUDED_DISTRIBUTORS = `(A.distributor_id <> 1 and A.distributor_id <> 189)`;

// Old PHP list tabs (get_list_data)
const STATUS_CONDITIONS = {
  approved: `A.status = 'Approved'`,
  pending: `(A.status = 'Pending' and (A.delivery_status is null or A.delivery_status = ''))`,
  pending_for_approval: `((A.status = 'Pending' and A.delivery_status in ('Pending', 'GP Issued', 'Delivered Not Complete', 'Delivered')) or A.status = 'Deleted')`,
  pending_for_delivery: `(A.status = 'Approved' and A.delivery_status = 'Pending')`,
  gp_issued: `(A.status = 'Approved' and A.delivery_status = 'GP Issued')`,
  delivered_not_complete: `(A.status = 'Approved' and A.delivery_status = 'Delivered Not Complete')`,
  inactive: `A.status = 'InActive'`
};

// Old PHP restricts sales to the depots of the logged in user (user_master.depot_ids)
const userDepotIds = (req) => (Array.isArray(req.userData.depotIds) ? req.userData.depotIds : [])
  .map((id) => +id)
  .filter((id) => id);

const getAction = (req) => {
  const roleDetails = req.userData.roleDetails;
  return {
    insert: roleDetails.r_insert ? true : false,
    update: roleDetails.r_edit ? true : false,
    delete: roleDetails.r_delete ? true : false,
    approve: roleDetails.r_approvals ? true : false
  };
};

// Old PHP form buttons (distributor_out_details.php):
// - Submit For Approval: own entry, an Approved / Cancelled sale (edit creates a pending copy), or a Pending entry without depot
// - Delete: same, except Cancelled sales
// Neither for a freezed sale or one whose distributor PO is not approved / mismatched.
const getPermissions = (req, sale) => {
  const roleDetails = req.userData.roleDetails;
  const status = text(sale.status);
  const own = +sale.modified_by === +req.userData.userId;
  const noDepot = !sale.depot_name && status === 'Pending';
  const poStatus = text(sale.po_status).toUpperCase();
  const poBlocked = +sale.mismatch === 1 || (poStatus !== '' && poStatus !== 'APPROVED');
  const freezed = +sale.freezed === 1;

  return {
    submit: !!roleDetails.r_edit && !freezed && !poBlocked && (own || status === 'Approved' || status === 'InActive' || noDepot),
    delete: !!roleDetails.r_delete && !freezed && !poBlocked && status !== 'InActive' && (own || status === 'Approved' || noDepot),
    // Approve / Reject: someone else's entry waiting for approval (PHP also offered it on Rejected entries, which no tab lists)
    approve: !!roleDetails.r_approvals && !poBlocked && !own && !!sale.depot_name && (status === 'Pending' || status === 'Deleted'),
    poMessage: +sale.mismatch === 1 ? 'Please clear Mismatch PO Entry.' : (poBlocked ? 'Please Approve PO Entry First.' : '')
  };
};

// Old PHP Freezed_model::check_freedzed_month
const isFreezedMonth = async (date, transaction) => {
  if (!date) return false;
  const [year, month] = date.split('-');
  const rows = await select(
    `select id from freezed_month_details where year = :year and month = :month limit 1`,
    { year, month: MONTHS[+month - 1] }, transaction
  );
  return rows.length > 0;
};

export const getSales = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const statusCount = {
      approved: 0, pending: 0, pending_for_approval: 0, pending_for_delivery: 0,
      gp_issued: 0, delivered_not_complete: 0, inactive: 0
    };
    if (depotIds.length === 0) {
      return res.status(200).json({ message: "Sales fetched successfully!", action: getAction(req), total: 0, statusCount, rows: [] });
    }

    const status = req.query.status && STATUS_CONDITIONS[req.query.status.toString().toLowerCase()]
      ? req.query.status.toString().toLowerCase()
      : 'approved';
    const query = req.query.query ? req.query.query.toString().trim() : '';
    const pageAll = req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL';
    const pageSize = pageAll ? 0 : (+req.query.pageSize || 10);
    const pageIndex = +req.query.pageIndex || 0;

    // Old PHP get_data_count (its "pending" count used "delivery_status = null", which never matches NULL)
    const counts = await select(
      `select
         sum(A.status = 'Approved') as approved,
         sum(${STATUS_CONDITIONS.pending}) as pending,
         sum(${STATUS_CONDITIONS.pending_for_approval}) as pending_for_approval,
         sum(${STATUS_CONDITIONS.pending_for_delivery}) as pending_for_delivery,
         sum(${STATUS_CONDITIONS.gp_issued}) as gp_issued,
         sum(${STATUS_CONDITIONS.delivered_not_complete}) as delivered_not_complete,
         sum(A.status = 'InActive') as inactive
       from distributor_out A
       where A.depot_id in (:depotIds) and ${EXCLUDED_DISTRIBUTORS}`,
      { depotIds }
    );
    for (const key in statusCount) {
      statusCount[key] = +counts[0][key] || 0;
    }

    // Old PHP search: same columns as the DataTables search
    const search = query
      ? `and (A.id like :query or DATE_FORMAT(A.date_of_processing, '%d/%m/%Y') like :query or A.invoice_no like :query
          or A.voucher_no like :query or A.gate_pass_no like :query or A.final_amount like :query or A.status like :query
          or A.client_name like :query or A.delivery_status like :query or A.invoice_amount like :query
          or DATE_FORMAT(A.invoice_date, '%d/%m/%Y') like :query or A.order_no like :query or A.tracking_id like :query
          or A.shipping_charges like :query or B.distributor_name like :query or B.class like :query)`
      : '';
    const where = `where ${STATUS_CONDITIONS[status]} and ${EXCLUDED_DISTRIBUTORS} and A.depot_id in (:depotIds) ${search}`;

    const sortable = {
      date_of_processing: 'A.date_of_processing',
      invoice_no: 'A.invoice_no',
      invoice_date: 'A.invoice_date',
      distributor_name: 'B.distributor_name',
      order_no: 'A.order_no',
      invoice_amount: 'A.invoice_amount',
      delivery_status: 'A.delivery_status'
    };
    const sortKey = sortable[req.query.key] || 'A.modified_on';
    const sortOrder = (req.query.order && req.query.order.toString().toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
    const replacements = { depotIds, query: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };

    const total = await select(
      `select count(A.id) as count from distributor_out A left join distributor_master B on (A.distributor_id = B.id) ${where}`,
      replacements
    );

    const rows = await select(
      `select concat('d_', A.id) as d_id, A.id, A.date_of_processing, A.invoice_no, A.voucher_no, A.gate_pass_no,
         A.distributor_id, A.final_amount, A.status, A.client_name, A.delivery_status, A.invoice_amount,
         A.invoice_date, A.order_no, A.tracking_id, A.proof_of_delivery, A.shipping_charges, A.modified_on,
         B.distributor_name, B.class, C.location, D.depot_name, E.id as credit_debit_note_id
       from distributor_out A
       left join distributor_master B on (A.distributor_id = B.id)
       left join location_master C on (B.location_id = C.id)
       left join depot_master D on (A.depot_id = D.id)
       left join credit_debit_note E on (A.id = E.distributor_out_id)
       ${where}
       order by ${sortKey} ${sortOrder}, A.id desc
       ${pageAll ? '' : 'limit :limit offset :offset'}`,
      replacements
    );

    res.status(200).json({
      message: "Sales fetched successfully!",
      action: getAction(req),
      total: +total[0].count,
      statusCount,
      rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching sales failed!";
    next(error, req, res);
  }
};

// Single sale with its items (old PHP edit view: get_distributor_out_data + get_distributor_out_items)
export const getSale = async (req, res, next) => {
  try {
    const id = +req.params.id.toString().replace(/^d_/, '');
    const depotIds = userDepotIds(req);
    if (!id || depotIds.length === 0) {
      return res.status(404).json({ message: "Sale not found!" });
    }

    const rows = await select(
      `select A.*, B.distributor_name, B.sell_out, B.class, ifnull(A.state, B.state) as state,
         C.location, D.depot_name, D.state as depot_state, F.sales_rep_name,
         concat(ifnull(H.first_name, ''), ' ', ifnull(H.last_name, '')) as modified_by_name,
         concat(ifnull(I.first_name, ''), ' ', ifnull(I.last_name, '')) as approved_by_name,
         E.id as credit_debit_note_id, P.status as po_status, P.mismatch, G.sales_rep_name as delivery_person
       from distributor_out A
       left join sales_rep_master G on (A.delivery_sales_rep_id = G.id)
       left join distributor_master B on (A.distributor_id = B.id)
       left join location_master C on (B.location_id = C.id)
       left join depot_master D on (A.depot_id = D.id)
       left join sales_rep_master F on (A.sales_rep_id = F.id)
       left join user_master H on (A.modified_by = H.id)
       left join user_master I on (A.approved_by = I.id)
       left join credit_debit_note E on (A.id = E.distributor_out_id)
       left join distributor_po P on (A.distributor_po_id = P.id)
       where A.id = :id and A.depot_id in (:depotIds)`,
      { id, depotIds }
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Sale not found!" });
    }

    // Items as entered (distributor_out_sale_items), with the item name by type
    const items = await select(
      `select S.*,
         case when S.type = 'Bar' then P.product_name
              when S.type = 'Combo Box' then CB.combo_box_name
              else BX.box_name end as item_name
       from distributor_out_sale_items S
       left join product_master P on (S.type = 'Bar' and S.item_id = P.id)
       left join box_master BX on (S.type = 'Box' and S.item_id = BX.id)
       left join combo_box_master CB on (S.type = 'Combo Box' and S.item_id = CB.id)
       where S.distributor_out_id = :id
       order by S.id`,
      { id }
    );

    // Old PHP get_pending_data: an edit of an approved sale is saved as a pending copy pointing to it (ref_id)
    const pending = await select(
      `select id from distributor_out where ref_id = :id and status not in ('InActive', 'Rejected') order by id desc limit 1`,
      { id }
    );

    return res.status(200).json({
      action: getAction(req),
      permissions: getPermissions(req, rows[0]),
      sale: rows[0],
      items,
      pendingEditId: pending.length ? pending[0].id : null
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Sale failed!";
    next(error, req, res);
  }
};

// Form master data (old PHP add / edit): the user's depots, distributors (except Sample 1 / Expiry 189),
// boxes, combo boxes with GST, bars (old sales only), cities and states for Direct customers.
export const getMasterData = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const depots = depotIds.length ? await select(
      `select id, depot_name, state from depot_master where status = 'Approved' and id in (:depotIds) order by depot_name`,
      { depotIds }
    ) : [];
    const distributors = await select(
      `select id, distributor_name, class, state, state_code, sell_out, sales_rep_id, credit_period
       from distributor_master where status = 'Approved' and id not in (1, 189) order by distributor_name`
    );
    const boxes = await select(`select id, box_name from box_master where status = 'Approved' order by box_name`);
    const comboBoxes = await select(
      `select id, combo_box_name from combo_box_master where status = 'Approved' and gst = 'Yes' order by modified_on desc`
    );
    const bars = await select(`select id, product_name from product_master where status = 'Approved' order by product_name`);
    const cities = await select(
      `select A.id, A.city_name, B.state_name, B.state_code, C.country_name
       from city_master A
       left join state_master B on (A.state_id = B.id)
       left join country_master C on (B.country_id = C.id)
       where A.status = 1 order by A.city_name`
    );
    const states = await select(`select state_name, state_code from state_master order by state_name`);

    res.status(200).json({ action: getAction(req), depots, distributors, boxes, comboBoxes, bars, cities, states });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

// Shipping addresses of a distributor (old PHP get_dist_consignee)
export const getConsignees = async (req, res, next) => {
  try {
    const consignees = await select(
      `select id, concat(ifnull(con_address, ''), ', ', ifnull(con_city, ''), ' - ', ifnull(con_pincode, ''), ', ', ifnull(con_state, '')) as address,
         con_state, con_state_code
       from distributor_consignee where distributor_id = :id order by id`,
      { id: +req.params.id || 0 }
    );
    res.status(200).json({ consignees });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching shipping addresses failed!";
    next(error, req, res);
  }
};

// Old PHP get_product_details / get_box_details / get_combo_box_details: MRP rate, grams, tax %
// and the distributor's category margin (inv_margin = invoice discount, pro_margin = promotion)
const findItemDetails = async (type, id, distributorId, transaction) => {
  if (type === 'Combo Box') {
    const rows = await select(
      `select amount as rate, grams, gst_rate as tax_percentage, 0 as inv_margin, 0 as pro_margin from combo_box_master where id = :id`,
      { id }, transaction
    );
    return rows[0] || null;
  }
  const table = type === 'Bar' ? 'product_master' : 'box_master';
  // PHP joined margins "for this distributor or null" and took the first row; prefer the distributor's own margin
  const rows = await select(
    `select A.rate, A.grams, A.tax_percentage, B.inv_margin, B.pro_margin
     from ${table} A
     left join distributor_category_margin B on (A.category_id = B.category_id and (B.distributor_id = :distributorId or B.distributor_id is null))
     where A.id = :id
     order by (B.distributor_id is null), B.distributor_id
     limit 1`,
    { id, distributorId: distributorId || 0 }, transaction
  );
  return rows[0] || null;
};

export const getItemDetails = async (req, res, next) => {
  try {
    const type = text(req.query.type);
    if (!ITEM_TYPES.includes(type)) {
      return res.status(422).json({ message: "Invalid item type!" });
    }
    const details = await findItemDetails(type, +req.query.id || 0, +req.query.distributor_id || 0);
    if (!details) {
      return res.status(404).json({ message: "Item not found!" });
    }
    res.status(200).json({
      rate: +details.rate || 0,
      grams: +details.grams || 0,
      tax_percentage: +details.tax_percentage || 0,
      inv_margin: +details.inv_margin || 0,
      pro_margin: +details.pro_margin || 0
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching item details failed!";
    next(error, req, res);
  }
};

const findSale = (id, depotIds, transaction) => (depotIds.length ? select(
  `select A.*, D.depot_name, P.status as po_status, P.mismatch
   from distributor_out A
   left join depot_master D on (A.depot_id = D.id)
   left join distributor_po P on (A.distributor_po_id = P.id)
   where A.id = :id and A.depot_id in (:depotIds)`,
  { id, depotIds }, transaction
) : Promise.resolve([])).then((rows) => rows[0] || null);

// The id of a live pending copy (edit or delete request) of an approved sale
const findPendingCopy = async (refId, transaction) => {
  const rows = await select(
    `select id from distributor_out where ref_id = :refId and status not in ('InActive', 'Rejected') order by id desc limit 1`,
    { refId }, transaction
  );
  return rows.length ? rows[0].id : null;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return dateOrNull(value);
};

// Validates the form and builds the distributor_out row and its sale items (old PHP save_data + validations.js)
const buildSale = async (req, existing) => {
  // Multipart saves (with a receivable document) send the form as a JSON 'payload' field
  const body = typeof (req.body || {}).payload === 'string' ? parseJson(req.body.payload, {}) : (req.body || {});
  const errors = {};
  const addError = (field, message) => { if (!errors[field]) errors[field] = { message }; };
  const depotIds = userDepotIds(req);

  const dateOfProcessing = dateOrNull(body.date_of_processing);
  if (!dateOfProcessing) addError('date_of_processing', 'Date is required');
  else if (dateOfProcessing > today()) addError('date_of_processing', 'Date cannot be in the future');
  else if (await isFreezedMonth(dateOfProcessing)) addError('date_of_processing', 'Please Select Another Date ,This Date is Freezed');

  const depotId = +body.depot_id || 0;
  const depot = depotIds.includes(depotId)
    ? (await select(`select id, state from depot_master where id = :depotId`, { depotId }))[0]
    : null;
  if (!depot) addError('depot_id', 'Depot is required');

  const distributorId = +body.distributor_id || 0;
  const distributor = distributorId && distributorId !== 1 && distributorId !== 189
    ? (await select(`select id, class, state, state_code, sales_rep_id from distributor_master where id = :distributorId`, { distributorId }))[0]
    : null;
  if (!distributor) addError('distributor_id', 'Distributor is required');
  const direct = !!distributor && text(distributor.class).toUpperCase() === 'DIRECT';

  const dueDate = dateOrNull(body.due_date);
  if (!dueDate) addError('due_date', 'Due Date is required');

  const reverseCharge = text(body.reverse_charge) || 'no';
  if (!['yes', 'no'].includes(reverseCharge)) addError('reverse_charge', 'Reverse Charge is required');

  const shippingAddress = text(body.shipping_address) || 'yes';
  if (!['yes', 'no'].includes(shippingAddress)) addError('shipping_address', 'Shipping Address is required');

  // Shipping to a consignee: its details are copied into the sale
  let consignee = null;
  if (shippingAddress === 'no') {
    const consigneeId = +body.distributor_consignee_id || 0;
    consignee = consigneeId && distributor
      ? (await select(`select * from distributor_consignee where id = :consigneeId and distributor_id = :distributorId`, { consigneeId, distributorId }))[0]
      : null;
    if (!consignee) addError('distributor_consignee_id', 'Shipping Address is required');
  }

  const basisOfSales = text(body.basis_of_sales);
  if (!['PO Number', 'Emails'].includes(basisOfSales)) addError('basis_of_sales', 'Basis of Sales is required');
  const orderNo = text(body.order_no);
  if (basisOfSales === 'PO Number') {
    if (!orderNo) {
      addError('order_no', 'Order No is required');
    } else {
      // Old PHP check_order_id_availablity: unique among live sales, ignoring this sale and the one it edits
      const refId = existing ? (existing.status === 'Approved' ? existing.id : (+existing.ref_id || 0)) : 0;
      const pendingCopyId = existing && existing.status === 'Approved' ? (await findPendingCopy(existing.id)) || 0 : 0;
      const duplicate = await select(
        `select id from distributor_out where order_no = :orderNo and id not in (:ids)
           and status <> 'InActive' and status <> 'Rejected' limit 1`,
        { orderNo, ids: [existing ? existing.id : 0, refId, pendingCopyId] }
      );
      if (duplicate.length) addError('order_no', 'Order No already exists');
    }
  }
  const emailFrom = text(body.email_from);
  const emailDateTime = text(body.email_date_time);
  if (basisOfSales === 'Emails') {
    if (!emailFrom) addError('email_from', 'Email from is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFrom)) addError('email_from', 'Please enter a valid email');
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(emailDateTime)) addError('email_date_time', 'Date time of email is required');
  }

  // Billing state decides CGST+SGST / IGST. Direct customers type it, others take the distributor's or the consignee's.
  let state = text(body.state);
  let stateCode = text(body.state_code);
  if (!direct && distributor) {
    state = consignee ? text(consignee.con_state) : text(distributor.state);
    stateCode = consignee ? text(consignee.con_state_code) : text(distributor.state_code);
  } else if (state && !stateCode) {
    const stateRow = await select(`select state_code from state_master where state_name = :state limit 1`, { state });
    stateCode = stateRow.length ? text(stateRow[0].state_code) : '';
  }
  // The State field is only on the form for Direct customers; otherwise the error belongs to the distributor
  if (!state && distributor) addError(direct ? 'state' : 'distributor_id', direct ? 'State is required' : 'State is not set for this distributor / shipping address');

  const discount = text(body.discount);
  if (discount !== '' && (isNaN(+discount) || +discount < 0 || +discount > 100)) addError('discount', 'Discount must be between 0 and 100');
  const shipping = text(body.shipping_charges);
  if (shipping !== '' && (isNaN(+shipping) || +shipping < 0)) addError('shipping_charges', 'Shipping Charges cannot be negative');

  const mobileNo = text(body.mobile_no);
  if (direct && mobileNo && !/^\d+$/.test(mobileNo)) addError('mobile_no', 'Please enter numbers only');

  const remarks = text(body.remarks);
  if (existing && existing.status === 'Approved' && !remarks) addError('remarks', 'Remarks is required');

  // Invoice date is only on the edit form
  const invoiceDate = existing ? dateOrNull(body.invoice_date) : null;
  if (invoiceDate && invoiceDate > today()) addError('invoice_date', 'Invoice Date cannot be in the future');

  // Items
  const taxType = getTaxType(depot ? depot.state : '', state);
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) addError('items', 'Please add atleast one item.');
  const lines = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index] || {};
    const type = text(item.type);
    const itemId = +item.item_id || 0;
    if (!ITEM_TYPES.includes(type)) addError(`items[${index}].type`, 'Type is required');
    if (!itemId) addError(`items[${index}].item_id`, 'Item is required');
    else if (ITEM_TYPES.includes(type) && !(await findItemDetails(type, itemId, distributorId))) addError(`items[${index}].item_id`, 'Item not found');
    if (text(item.qty) === '' || isNaN(+item.qty)) addError(`items[${index}].qty`, 'Qty is required');
    else if (!(+item.qty > 0)) addError(`items[${index}].qty`, 'Qty must be more than 0');
    if (text(item.sell_rate) === '' || isNaN(+item.sell_rate)) addError(`items[${index}].sell_rate`, 'Sell Rate is required');
    else if (+item.sell_rate < 0) addError(`items[${index}].sell_rate`, 'Sell Rate cannot be negative');
    const discPer = text(item.disc_per);
    if (discPer !== '' && (isNaN(+discPer) || +discPer < 0 || +discPer > 100)) addError(`items[${index}].disc_per`, 'Discount must be between 0 and 100');

    const line = {
      type,
      item_id: itemId,
      qty: round(item.qty),
      rate: round(item.rate),
      sell_rate: round(item.sell_rate, 4),
      grams: round(item.grams),
      tax_per: round(item.tax_per),
      margin_per: round(item.sell_margin),
      promo_margin: round(item.promo_margin),
      discount: round(item.disc_per)
    };
    lines.push({ ...line, ...calculateLine(line, taxType) });
  }

  const shippingCharges = round(body.shipping_charges);
  const totals = calculateTotals(lines, shippingCharges);
  if (lines.length && totals.final_amount === 0) addError('items', 'Amount cannot be zero.');

  if (Object.keys(errors).length) {
    return { errors };
  }

  // Shown (and editable) only once the sale left Pending; otherwise kept as is, new sales start 'Pending'
  let deliveryStatus = existing ? (existing.delivery_status || 'Pending') : 'Pending';
  if (existing && existing.status !== 'Pending' && DELIVERY_STATUSES.includes(text(body.delivery_status))) {
    deliveryStatus = text(body.delivery_status);
  }
  const keep = (key) => (existing ? existing[key] : null);

  // Old PHP: uploading the receivable document (shown once the sale left Pending) marks it Delivered
  let receivableDoc = keep('receivable_doc');
  const receivableFile = existing && existing.status !== 'Pending' ? uploadedFile(req, 'receivable_doc_file') : null;
  if (receivableFile) {
    receivableDoc = receivableFile;
    deliveryStatus = 'Delivered';
  }

  const row = {
    date_of_processing: dateOfProcessing,
    invoice_no: keep('invoice_no'),
    depot_id: depotId,
    distributor_id: distributorId,
    sales_rep_id: +body.sales_rep_id || distributor.sales_rep_id || null,
    amount: totals.amount,
    tax: 'gst',
    tax_per: existing && existing.tax_per !== null ? existing.tax_per : 5,
    tax_amount: totals.tax_amount,
    final_amount: totals.final_amount,
    due_date: dueDate,
    order_no: basisOfSales === 'PO Number' ? orderNo : '',
    order_date: basisOfSales === 'PO Number' ? dateOrNull(body.order_date) : null,
    ref_invoice_no: basisOfSales === 'PO Number' ? text(body.ref_invoice_no) : '',
    ref_invoice_details: basisOfSales === 'PO Number' ? text(body.ref_invoice_details) : '',
    ref_invoice_date: basisOfSales === 'PO Number' ? dateOrNull(body.ref_invoice_date) : null,
    supplier_ref: keep('supplier_ref'),
    despatch_doc_no: keep('despatch_doc_no'),
    despatch_through: keep('despatch_through'),
    destination: keep('destination'),
    remarks,
    client_name: direct ? text(body.client_name) : keep('client_name'),
    address: direct ? text(body.address) : keep('address'),
    city: direct ? text(body.city) : keep('city'),
    pincode: direct ? text(body.pincode) : keep('pincode'),
    state,
    country: direct ? text(body.country) : keep('country'),
    mobile_no: direct ? mobileNo : keep('mobile_no'),
    discount: round(body.discount),
    sample_distributor_id: keep('sample_distributor_id'),
    delivery_status: deliveryStatus,
    // PHP posted a disabled (never sent) delivery date and lost it on every edit; keep it
    delivery_date: keep('delivery_date'),
    transport_type: keep('transport_type'),
    vehicle_number: keep('vehicle_number'),
    cgst: existing ? existing.cgst : 0,
    sgst: existing ? existing.sgst : 0,
    igst: existing ? existing.igst : 0,
    cgst_amount: totals.cgst_amount,
    sgst_amount: totals.sgst_amount,
    igst_amount: totals.igst_amount,
    reverse_charge: reverseCharge,
    shipping_address: shippingAddress,
    distributor_consignee_id: consignee ? consignee.id : null,
    con_name: consignee ? consignee.con_name : null,
    con_address: consignee ? consignee.con_address : null,
    con_city: consignee ? consignee.con_city : null,
    con_pincode: consignee ? consignee.con_pincode : null,
    con_state: consignee ? consignee.con_state : null,
    con_country: consignee ? consignee.con_country : null,
    con_state_code: consignee ? consignee.con_state_code : null,
    con_gst_number: consignee ? consignee.con_gst_number : null,
    state_code: stateCode,
    round_off_amount: totals.round_off_amount,
    invoice_amount: totals.invoice_amount,
    invoice_date: invoiceDate,
    email_date_time: basisOfSales === 'Emails' ? emailDateTime.replace('T', ' ').substring(0, 19) : null,
    basis_of_sales: basisOfSales,
    email_from: basisOfSales === 'Emails' ? emailFrom : '',
    email_approved_by: basisOfSales === 'Emails' ? text(body.email_approved_by) : '',
    gstin: direct ? text(body.gstin) : keep('gstin'),
    unique_ref_no: direct ? text(body.unique_ref_no) : keep('unique_ref_no'),
    shipping_charges: shippingCharges,
    // PHP left the receivable document off the pending copy, so approving an edit wiped it; carry it over
    receivable_doc: receivableDoc
  };

  return { row, lines };
};

const insertRow = async (table, row, transaction) => {
  const keys = Object.keys(row);
  const [id] = await execute(
    `insert into ${table} (${keys.join(', ')}) values (${keys.map((key) => `:${key}`).join(', ')})`,
    row, transaction
  );
  return id;
};

const updateRow = (table, id, row, transaction) => {
  const keys = Object.keys(row);
  return execute(
    `update ${table} set ${keys.map((key) => `${key} = :${key}`).join(', ')} where id = :id`,
    { ...row, id }, transaction
  );
};

const saveSaleItems = async (id, lines, transaction) => {
  await execute(`delete from distributor_out_sale_items where distributor_out_id = :id`, { id }, transaction);
  for (const line of lines) {
    await insertRow('distributor_out_sale_items', {
      distributor_out_id: id,
      type: line.type,
      item_id: line.item_id,
      qty: line.qty,
      sell_rate: line.sell_rate,
      grams: line.grams,
      rate: line.rate,
      amount: line.amount,
      cgst_amt: line.cgst_amt,
      sgst_amt: line.sgst_amt,
      igst_amt: line.igst_amt,
      tax_amt: line.tax_amt,
      total_amt: line.total_amt,
      margin_per: line.margin_per,
      promo_margin: line.promo_margin,
      tax_percentage: line.tax_per,
      discount: line.discount,
      discount_amt: line.disc_amt,
      tax_type: line.tax_type,
      combo_box_id: line.type === 'Combo Box' ? line.item_id : 0
    }, transaction);
  }
  await setDistributorOutItems(sequelize, id, transaction);
};

// Old PHP save (new sale): saved as Pending, delivery status Pending, shown under Approval Pending
export const createSale = async (req, res, next) => {
  try {
    const { errors, row, lines } = await buildSale(req, null);
    if (errors) {
      return invalid(res, errors);
    }

    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const id = await insertRow('distributor_out', {
        ...row,
        status: 'Pending',
        ref_id: null,
        created_by: req.userData.userId,
        created_on: now,
        modified_by: req.userData.userId,
        modified_on: now
      }, t);
      await saveSaleItems(id, lines, t);
      await t.commit();
      res.status(201).json({ message: "Sale submitted for approval!", id });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating sale failed!";
    next(error, req, res);
  }
};

// Old PHP update: a Pending / Deleted / Cancelled entry is updated in place and becomes Pending.
// Editing an Approved sale saves a Pending copy (ref_id = the approved sale) that replaces it on approval.
export const updateSale = async (req, res, next) => {
  try {
    const existing = await findSale(+req.params.id || 0, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Sale not found!" });
    }
    if (!getPermissions(req, existing).submit) {
      return res.status(401).json({ message: "You cannot edit this sale." });
    }

    const { errors, row, lines } = await buildSale(req, existing);
    if (errors) {
      return invalid(res, errors);
    }

    const now = new Date();
    const t = await sequelize.transaction();
    try {
      let id = existing.id;
      let refId = existing.ref_id || null;
      if (existing.status === 'Approved') {
        refId = existing.id;
        // PHP opened the existing pending copy instead of the approved sale; never create a second one
        id = await findPendingCopy(refId, t);
      }

      const data = {
        ...row,
        status: 'Pending',
        ref_id: refId,
        modified_by: req.userData.userId,
        modified_on: now
      };
      if (refId) {
        data.modified_approved_date = now;
      }

      if (id) {
        await updateRow('distributor_out', id, data, t);
      } else {
        id = await insertRow('distributor_out', { ...data, created_by: req.userData.userId, created_on: now }, t);
      }
      await saveSaleItems(id, lines, t);
      await t.commit();
      res.status(200).json({ message: "Sale submitted for approval!", id });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Updating sale failed!";
    next(error, req, res);
  }
};

// Old PHP Delete button: an Approved sale gets a 'Deleted' copy waiting for approval (approving it cancels the sale);
// anything else is cancelled (InActive) straight away.
export const deleteSale = async (req, res, next) => {
  try {
    const existing = await findSale(+req.params.id || 0, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Sale not found!" });
    }
    if (!getPermissions(req, existing).delete) {
      return res.status(401).json({ message: "You cannot delete this sale." });
    }
    if (await isFreezedMonth(toDate(existing.date_of_processing))) {
      return invalid(res, { date_of_processing: { message: 'Please Select Another Date ,This Date is Freezed' } });
    }

    const now = new Date();
    const userId = req.userData.userId;
    const t = await sequelize.transaction();
    try {
      if (existing.status === 'Approved') {
        if (await findPendingCopy(existing.id, t)) {
          await t.rollback();
          return res.status(422).json({ message: "This sale already has a change waiting for approval. Delete that entry instead." });
        }

        const copy = (await select(`select * from distributor_out where id = :id`, { id: existing.id }, t))[0];
        delete copy.id;
        const id = await insertRow('distributor_out', {
          ...copy,
          status: 'Deleted',
          ref_id: existing.id,
          approved_by: null,
          approved_on: null,
          created_by: userId,
          created_on: now,
          modified_by: userId,
          modified_on: now,
          modified_approved_date: now
        }, t);

        const saleItems = await select(`select * from distributor_out_sale_items where distributor_out_id = :id order by id`, { id: existing.id }, t);
        for (const saleItem of saleItems) {
          delete saleItem.id;
          await insertRow('distributor_out_sale_items', { ...saleItem, distributor_out_id: id }, t);
        }
        await setDistributorOutItems(sequelize, id, t);
        await t.commit();
        return res.status(200).json({ message: "Delete request submitted for approval!" });
      }

      await execute(
        `update distributor_out set status = 'InActive', modified_by = :userId, modified_on = :now where id = :id`,
        { id: existing.id, userId, now }, t
      );
      await t.commit();
      res.status(200).json({ message: "Sale cancelled!" });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Deleting sale failed!";
    next(error, req, res);
  }
};

// Approve (old PHP save_data with btn_approve).
// - Deleted request -> InActive (the approved sale gets cancelled); otherwise Approved.
// - No invoice no yet (and not an exchange): next Tax_Invoice series, 'W/<fy>/<series>', invoice date defaults to the date.
// - Pending copy (ref_id): written back into the approved sale with its items, then removed.
// - New sale: Direct customers are marked Delivered.
// - Ledger entries and the promotion credit note follow the approved sale.
export const approveSale = async (req, res, next) => {
  try {
    if (!req.userData.roleDetails.r_approvals) {
      return res.status(401).json({ message: "You are not authorised!" });
    }
    const id = +req.params.id || 0;
    const sale = await findSale(id, userDepotIds(req));
    if (!sale) {
      return res.status(404).json({ message: "Sale not found!" });
    }
    if (!getPermissions(req, sale).approve) {
      return res.status(401).json({ message: "You cannot approve this sale." });
    }

    const remarks = text((req.body || {}).remarks);
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      // Lock the entry so it cannot be approved twice
      const locked = (await select(
        `select A.*, B.class from distributor_out A left join distributor_master B on (A.distributor_id = B.id) where A.id = :id for update`,
        { id }, t
      ))[0];
      if (!locked || (locked.status !== 'Pending' && locked.status !== 'Deleted')) {
        await t.rollback();
        return res.status(422).json({ message: "This sale is no longer waiting for approval." });
      }

      const status = locked.status === 'Deleted' ? 'InActive' : 'Approved';
      let invoiceNo = text(locked.invoice_no);
      let invoiceDate = toDate(locked.invoice_date);
      if (!invoiceNo && text(locked.distributor_in_type) !== 'exchanged') {
        const series = await nextSeries(sequelize, 'Tax_Invoice', t);
        invoiceDate = invoiceDate || toDate(locked.date_of_processing);
        invoiceNo = `W/${fiscalYear(invoiceDate)}/${series}`;
      }

      let saleId = id;
      if (locked.ref_id) {
        const refId = +locked.ref_id;
        const original = (await select(`select id from distributor_out where id = :refId for update`, { refId }, t))[0];
        if (!original) {
          await t.rollback();
          return res.status(422).json({ message: `The sale this entry changes (#${refId}) no longer exists.` });
        }

        await execute(
          `update distributor_out A, distributor_out B
           set ${MERGE_COLUMNS.map((column) => `A.${column} = B.${column}`).join(', ')},
             A.status = :status, A.remarks = :remarks, A.approved_by = :userId, A.approved_on = :now,
             A.invoice_no = :invoiceNo, A.invoice_date = :invoiceDate, A.modified_approved_date = :today
           where A.id = :refId and B.id = :id`,
          { status, remarks, userId, now, invoiceNo, invoiceDate, today: today(), refId, id }, t
        );
        await execute(`delete from distributor_out_sale_items where distributor_out_id = :refId`, { refId }, t);
        await execute(`update distributor_out_sale_items set distributor_out_id = :refId where distributor_out_id = :id`, { refId, id }, t);
        await execute(`delete from distributor_out_items where distributor_out_id = :refId`, { refId }, t);
        await execute(`update distributor_out_items set distributor_out_id = :refId where distributor_out_id = :id`, { refId, id }, t);
        await execute(`delete from distributor_out where id = :id`, { id }, t);
        saleId = refId;
      } else {
        const deliveryStatus = text(locked.class).toUpperCase() === 'DIRECT' ? 'Delivered' : locked.delivery_status;
        await execute(
          `update distributor_out set delivery_status = :deliveryStatus, status = :status, remarks = :remarks,
             approved_by = :userId, approved_on = :now, invoice_no = :invoiceNo, invoice_date = :invoiceDate
           where id = :id`,
          { deliveryStatus, status, remarks, userId, now, invoiceNo, invoiceDate, id }, t
        );
      }

      const ledger = await setLedger(sequelize, saleId, userId, t);
      await setCreditNote(sequelize, saleId, t);
      await t.commit();

      res.status(200).json({
        message: status === 'InActive' ? "Sale cancelled!" : `Sale approved! Invoice No: ${invoiceNo}`,
        id: saleId,
        invoice_no: invoiceNo,
        warning: ledger ? '' : 'No approved account ledger found for this distributor, so no ledger entries were made.'
      });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Approving sale failed!";
    next(error, req, res);
  }
};

// Reject (old PHP save_data with btn_reject): remarks are required; the entry is set aside as Rejected.
// A rejected change or delete request leaves the approved sale untouched.
export const rejectSale = async (req, res, next) => {
  try {
    if (!req.userData.roleDetails.r_approvals) {
      return res.status(401).json({ message: "You are not authorised!" });
    }
    const id = +req.params.id || 0;
    const sale = await findSale(id, userDepotIds(req));
    if (!sale) {
      return res.status(404).json({ message: "Sale not found!" });
    }
    if (!getPermissions(req, sale).approve) {
      return res.status(401).json({ message: "You cannot reject this sale." });
    }
    const remarks = text((req.body || {}).remarks);
    if (!remarks) {
      return invalid(res, { remarks: { message: 'Remarks is required' } });
    }

    const now = new Date();
    const userId = req.userData.userId;
    const [result] = await execute(
      `update distributor_out set status = 'Rejected', remarks = :remarks, approved_by = :userId, approved_on = :now,
         rejected_by = :userId, rejected_on = :today
       where id = :id and status in ('Pending', 'Deleted')`,
      { remarks, userId, now, today: today(), id }
    );
    if (result && result.affectedRows === 0) {
      return res.status(422).json({ message: "This sale is no longer waiting for approval." });
    }
    res.status(200).json({ message: "Sale rejected!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Rejecting sale failed!";
    next(error, req, res);
  }
};

// ---------------------------------------------------------------------------------------------
// Phase 4: dispatch (gate pass), delivery and printouts.
// Delivery flow (old PHP list tabs): Delivery Pending -> issue gate pass (batches, delivery person, tracking id)
// -> GP Issued -> Delivered (stored as 'Delivered Not Complete' by PHP) or Return To HO (back to Delivery Pending)
// -> uploading the receivable document on the sale form marks it Delivered.

// New uploads are stored as 'sales/<file>' under assets/uploads; old PHP values are bare file names
const UPLOAD_FOLDER = 'sales';
const uploadedFile = (req, field) => {
  const file = (Array.isArray(req.files) ? req.files : []).find((item) => item.fieldname === field);
  return file ? `${UPLOAD_FOLDER}/${file.filename}` : null;
};
const parseJson = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (error) { return fallback; }
};

// Sample / Expiry entries are distributor_out rows of distributor 1 (Sample) or 189 (Product Expired)
const isSampleRow = (row) => [1, 189].includes(+row.distributor_id);

// Approved sale waiting for a gate pass, with what the dispatch screen needs (old PHP get_batch_details page).
// Shared with Sample / Expiry (options.sample), which picks no tracking id / dispatch proof.
export const loadDispatch = async (req, res, next, options = {}) => {
  try {
    const id = +req.params.id || 0;
    const sale = await findSale(id, userDepotIds(req));
    if (!sale || isSampleRow(sale) !== !!options.sample) {
      return res.status(404).json({ message: "Sale not found!" });
    }
    const items = await select(
      `select A.id, A.type, A.item_id, A.qty, A.batch_no, A.batch_qty,
         case when A.type = 'Bar' then P.product_name else B.box_name end as item_name
       from distributor_out_items A
       left join box_master B on (A.type = 'Box' and A.item_id = B.id)
       left join product_master P on (A.type = 'Bar' and A.item_id = P.id)
       where A.distributor_out_id = :id order by A.id`,
      { id }
    );
    const deliveryPersons = await select(
      `select id, sales_rep_name from sales_rep_master where sr_type = 'Merchandizer' order by sales_rep_name`
    );
    // Batches made in the last 9 months (old PHP get_batch_details)
    const batches = await select(
      `select id, batch_no from batch_master
       where date_of_processing >= date_sub(curdate(), interval 9 month) and status = 'Approved' and batch_no <> ''
       order by date_of_processing desc, id desc`
    );
    // Samples show the receiving distributor (sample_distributor_id)
    const extra = await select(
      `select A.distributor_name, A.class, L.location from distributor_master A left join location_master L on (A.location_id = L.id) where A.id = :id`,
      { id: (options.sample && sale.sample_distributor_id) || sale.distributor_id || 0 }
    );
    res.status(200).json({
      sale: { ...sale, ...(extra[0] || {}) },
      items,
      deliveryPersons,
      batches,
      canDispatch: !!req.userData.roleDetails.r_edit && sale.status === 'Approved' && sale.delivery_status === 'Pending'
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching dispatch details failed!";
    next(error, req, res);
  }
};

export const getDispatch = (req, res, next) => loadDispatch(req, res, next, { sample: false });

// Old PHP set_sku_batch + generate_gate_pass: batches per item, delivery person, tracking id, dispatch date / proof;
// the sale moves to GP Issued and gets a gate pass number (one gate pass per sale here).
// Sample / Expiry (options.sample, old PHP Sample_out_model::set_sku_batch) has no tracking id / dispatch date / proof.
export const issueGatePass = async (req, res, next, options = {}) => {
  try {
    const id = +req.params.id || 0;
    const sale = await findSale(id, userDepotIds(req));
    if (!sale || isSampleRow(sale) !== !!options.sample) {
      return res.status(404).json({ message: "Sale not found!" });
    }
    if (sale.status !== 'Approved' || sale.delivery_status !== 'Pending') {
      return res.status(422).json({ message: "Only approved sales waiting for delivery can get a gate pass." });
    }

    const body = req.body || {};
    const errors = {};
    const salesRepId = +body.sales_rep_id || 0;
    const trackingId = text(body.tracking_id);
    const dateOfDispatch = dateOrNull(body.date_of_dispatch);
    if (!salesRepId) errors.sales_rep_id = { message: 'Delivery Person is required' };
    else if (!(await select(`select id from sales_rep_master where id = :salesRepId`, { salesRepId })).length) errors.sales_rep_id = { message: 'Delivery Person not found' };
    if (!options.sample && !trackingId) errors.tracking_id = { message: 'Tracking Id is required' };
    if (!options.sample && !dateOfDispatch) errors.date_of_dispatch = { message: 'Date of dispatch is required' };

    // batches: [{ id: distributor_out_items.id, allocations: [{ batch_id, qty }] }]
    const items = await select(`select id, qty from distributor_out_items where distributor_out_id = :id`, { id });
    const posted = parseJson(body.batches, []);
    const batchIds = [...new Set((Array.isArray(posted) ? posted : []).flatMap((row) => (row.allocations || []).map((a) => +a.batch_id)).filter((v) => v))];
    const validBatches = batchIds.length ? (await select(`select id from batch_master where id in (:batchIds)`, { batchIds })).map((row) => row.id) : [];
    const updates = [];
    items.forEach((item, index) => {
      const row = (Array.isArray(posted) ? posted : []).find((entry) => +entry.id === +item.id);
      const allocations = row && Array.isArray(row.allocations) ? row.allocations : [];
      if (!allocations.length || allocations.some((a) => !(+a.qty > 0) || !validBatches.includes(+a.batch_id))) {
        errors[`batches[${index}]`] = { message: 'Batch and qty are required' };
        return;
      }
      // Old PHP had this check (check_product_availablity_for_sku_details) but never called it
      const total = allocations.reduce((sum, a) => sum + (+a.qty || 0), 0);
      if (Math.round(total * 100) !== Math.round((+item.qty || 0) * 100)) {
        errors[`batches[${index}]`] = { message: 'Total no of qty does not match.' };
        return;
      }
      updates.push({ id: item.id, batch_no: allocations.map((a) => +a.batch_id).join(', '), batch_qty: allocations.map((a) => +a.qty).join(', ') });
    });
    if (Object.keys(errors).length) {
      return invalid(res, errors);
    }

    const now = new Date();
    const userId = req.userData.userId;
    const t = await sequelize.transaction();
    try {
      const locked = (await select(`select status, delivery_status, gate_pass_no, date_of_processing from distributor_out where id = :id for update`, { id }, t))[0];
      if (!locked || locked.status !== 'Approved' || locked.delivery_status !== 'Pending') {
        await t.rollback();
        return res.status(422).json({ message: "This sale is no longer waiting for delivery." });
      }

      for (const update of updates) {
        await execute(`update distributor_out_items set batch_no = :batch_no, batch_qty = :batch_qty where id = :id`, update, t);
      }

      // Gate pass group (gp_data) and number 'WHPL/<fy>/gp/<series>' (kept if the sale already had one)
      const gp = await select(`select ifnull(max(gp_id), 0) + 1 as gp_id from gp_data for update`, {}, t);
      await execute(`insert into gp_data (gp_id, dist_id, sales_rep_id) values (:gpId, :id, :salesRepId)`, { gpId: gp[0].gp_id, id, salesRepId }, t);
      let gatePassNo = text(locked.gate_pass_no);
      if (!gatePassNo) {
        const series = await nextSeries(sequelize, 'Gate_Pass_invoice', t);
        gatePassNo = `WHPL/${fiscalYear(toDate(locked.date_of_processing))}/gp/${series}`;
      }

      if (options.sample) {
        await execute(
          `update distributor_out set delivery_status = 'GP Issued', delivery_sales_rep_id = :salesRepId,
             gatepass_date = :now, gate_pass_no = :gatePassNo, modified_by = :userId, modified_on = :now
           where id = :id`,
          { salesRepId, now, gatePassNo, userId, id }, t
        );
      } else {
        await execute(
          `update distributor_out set delivery_status = 'GP Issued', delivery_sales_rep_id = :salesRepId, tracking_id = :trackingId,
             gatepass_date = :now, date_of_dispatch = :dateOfDispatch, proof_of_dispatch = :proof, gate_pass_no = :gatePassNo,
             modified_by = :userId, modified_on = :now
           where id = :id`,
          { salesRepId, trackingId, now, dateOfDispatch, proof: uploadedFile(req, 'proof_of_dispatch'), gatePassNo, userId, id }, t
        );
      }
      await t.commit();
      res.status(200).json({ message: `Gate pass issued: ${gatePassNo}`, gate_pass_no: gatePassNo });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Issuing gate pass failed!";
    next(error, req, res);
  }
};

export const dispatchSale = (req, res, next) => issueGatePass(req, res, next, { sample: false });

// Old PHP GP Issued popup (set_delivery_status): 'Delivered' (saved as 'Delivered Not Complete', needs date and proof)
// or 'Return To HO' (back to Delivery Pending).
export const updateDelivery = async (req, res, next) => {
  try {
    const id = +req.params.id || 0;
    const sale = await findSale(id, userDepotIds(req));
    if (!sale) {
      return res.status(404).json({ message: "Sale not found!" });
    }
    if (sale.status !== 'Approved' || sale.delivery_status !== 'GP Issued') {
      return res.status(422).json({ message: "Only sales with a gate pass issued can be updated here." });
    }

    const body = req.body || {};
    const deliveryStatus = text(body.delivery_status);
    const deliveryDate = dateOrNull(body.delivery_date);
    const proof = uploadedFile(req, 'proof_of_delivery');
    const errors = {};
    if (!['Delivered Not Complete', 'Pending'].includes(deliveryStatus)) errors.delivery_status = { message: 'Delivery Status is required' };
    if (deliveryStatus === 'Delivered Not Complete') {
      if (!deliveryDate) errors.delivery_date = { message: 'Delivery Date is required' };
      else if (deliveryDate > today()) errors.delivery_date = { message: 'Delivery Date cannot be in the future' };
      if (!proof) errors.proof_of_delivery = { message: 'Proof of Delivery is required' };
    }
    if (Object.keys(errors).length) {
      return invalid(res, errors);
    }

    const delivered = deliveryStatus === 'Delivered Not Complete';
    await execute(
      `update distributor_out set delivery_status = :deliveryStatus, person_receiving = :personReceiving,
         proof_of_delivery = :proof, delivery_date = :deliveryDate, modified_by = :userId, modified_on = :now
       where id = :id and delivery_status = 'GP Issued'`,
      {
        deliveryStatus,
        personReceiving: delivered ? text(body.person_receiving) : null,
        proof: delivered ? proof : null,
        deliveryDate: delivered ? deliveryDate : null,
        userId: req.userData.userId,
        now: new Date(),
        id
      }
    );
    res.status(200).json({ message: delivered ? "Sale marked as delivered!" : "Sale returned to HO (Delivery Pending)!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Updating delivery failed!";
    next(error, req, res);
  }
};

const assetUrl = (req) => `${req.protocol}://${req.get('host')}/assets/invoice/`;

// Old PHP view_tax_invoice: printable HTML of an approved sale. Only for distributors set to receive invoices (send_invoice).
export const getInvoice = async (req, res, next) => {
  try {
    const sale = await findSale(+req.params.id || 0, userDepotIds(req));
    if (!sale) {
      return res.status(404).json({ message: "Sale not found!" });
    }
    if (sale.status !== 'Approved' || !text(sale.invoice_no)) {
      return res.status(422).json({ message: "The invoice is available once the sale is approved." });
    }
    const invoice = await getInvoiceData(sequelize, sale.id);
    if (text(invoice.class).toUpperCase() === 'SAMPLE') {
      return res.status(422).json({ message: "Sample distributors get a promotion voucher, not a tax invoice." });
    }
    if (!invoice.send_invoice) {
      return res.status(422).json({ message: "Invoice printing is turned off for this distributor (Send Invoice is No)." });
    }
    res.status(200).json({ html: renderInvoice(invoice, assetUrl(req)) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating invoice failed!";
    next(error, req, res);
  }
};

// Old PHP view_gate_pass: the gate pass group of the sale (gp_data) with batch details and the invoices
export const getGatePass = async (req, res, next) => {
  try {
    const sale = await findSale(+req.params.id || 0, userDepotIds(req));
    if (!sale) {
      return res.status(404).json({ message: "Sale not found!" });
    }
    const group = await select(`select gp_id from gp_data where dist_id = :id order by gp_id desc limit 1`, { id: sale.id });
    if (!group.length) {
      return res.status(422).json({ message: "No gate pass has been issued for this sale." });
    }
    const members = await select(`select distinct dist_id from gp_data where gp_id = :gpId`, { gpId: group[0].gp_id });
    const depotIds = userDepotIds(req);
    const ids = (await select(`select id from distributor_out where id in (:ids) and depot_id in (:depotIds)`,
      { ids: members.map((row) => row.dist_id), depotIds })).map((row) => row.id);

    const gatePass = await getGatePassData(sequelize, ids);
    const invoices = [];
    for (const saleId of ids) {
      const invoice = await getInvoiceData(sequelize, saleId);
      if (invoice && invoice.send_invoice && text(invoice.class).toUpperCase() !== 'SAMPLE' && text(invoice.invoice_no)) {
        invoices.push(invoice);
      }
    }
    const user = (await select(`select first_name, last_name from user_master where id = :id`, { id: req.userData.userId }))[0];
    const createdBy = user ? `${text(user.first_name)} ${text(user.last_name)}`.trim() : '';
    res.status(200).json({ html: renderGatePass(gatePass, invoices, assetUrl(req), createdBy) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating gate pass failed!";
    next(error, req, res);
  }
};

// Shared with Sample / Expiry (controllers/samples.js), which works on the same distributor_out tables
export {
  select, execute, invalid, text, dateOrNull, today, ITEM_TYPES, DELIVERY_STATUSES, userDepotIds, getAction,
  getPermissions, isFreezedMonth, findSale, findPendingCopy, toDate, insertRow, updateRow, parseJson, assetUrl, isSampleRow
};
