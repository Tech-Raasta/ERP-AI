import sequelize from '../lib/database.js';
import { fiscalYear, nextSeries, setLedger as setSalesLedger } from '../lib/salesApproval.js';
import { escapeHtml, getAddress, numberToWords } from '../lib/salesPrint.js';
import { columnsOf, hasTable, insertKnown } from '../lib/tableColumns.js';
import {
  select, execute, invalid, text, dateOrNull, today, ITEM_TYPES, userDepotIds, isFreezedMonth, toDate, insertRow, updateRow, assetUrl
} from './sales.js';

// Sales Return (old PHP Distributor_in). Goods coming back from a distributor, stored in distributor_in with
// distributor_in_sale_items (lines as entered) and distributor_in_items (combo boxes exploded).
// - Expired stock: also booked out to 'Product Expired' (distributor_out, distributor 189) at cost.
// - Exchange: the goods sent in exchange (distributor_out_exchange_items) become a sale (distributor_out,
//   distributor_in_type 'exchanged') that goes through Sales delivery.
// Every save goes to Pending; approval numbers the return, posts the ledger and approves the linked rows.

export const EXPIRY_DISTRIBUTOR = 189;
const SALES_TYPES = ['Adhoc', 'Invoice'];

// Old PHP list tabs; its Pending condition ("... and status='Pending' or status='Deleted'") missed brackets,
// so Deleted entries of every depot showed for everyone
const STATUS_CONDITIONS = {
  approved: `A.status = 'Approved'`,
  pending: `(A.status = 'Pending' or A.status = 'Deleted')`,
  rejected: `A.status = 'Rejected'`,
  inactive: `A.status = 'InActive'`
};

// Older databases have no distributor_in_sale_items table and no tax_type / combo_box_id on the item tables
// (see migrations/2026-10-30-sales-return-columns.sql): lines are read from distributor_in_items when the
// table is missing, and only existing columns are written (lib/tableColumns.js).
// Item tables that exist in this database (distributor_in_sale_items may not)
const returnItemTables = async (transaction) => {
  const tables = [];
  for (const table of ['distributor_in_sale_items', 'distributor_in_items', 'distributor_out_exchange_items']) {
    if (await hasTable(table, transaction)) tables.push(table);
  }
  return tables;
};

const round = (value, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.round((+value || 0) * factor) / factor;
};

const getAction = (req) => {
  const roleDetails = req.userData.roleDetails;
  return {
    insert: !!roleDetails.r_insert,
    update: !!roleDetails.r_edit,
    delete: !!roleDetails.r_delete,
    approve: !!roleDetails.r_approvals
  };
};

// Old PHP form buttons (distributor_in_details.php). Unlike Sales there is no "Pending without depot" case.
const getPermissions = (req, row) => {
  const roleDetails = req.userData.roleDetails;
  const status = text(row.status);
  const own = +row.modified_by === +req.userData.userId;
  const freezed = +row.freezed === 1;
  return {
    submit: !!roleDetails.r_edit && !freezed && (own || status === 'Approved' || status === 'InActive'),
    delete: !!roleDetails.r_delete && !freezed && status !== 'InActive' && (own || status === 'Approved'),
    // PHP also offered approval on Rejected entries, which only its Rejected tab lists; kept to Pending / Deleted
    approve: !!roleDetails.r_approvals && !freezed && !own && (status === 'Pending' || status === 'Deleted')
  };
};

const findReturn = async (id, depotIds, transaction) => {
  if (!depotIds.length) return null;
  const rows = await select(
    `select A.*, D.depot_name, D.state as depot_state from distributor_in A left join depot_master D on (A.depot_id = D.id)
     where A.id = :id and A.depot_id in (:depotIds)`,
    { id, depotIds }, transaction
  );
  return rows[0] || null;
};

const findPendingCopy = async (refId, transaction) => {
  const rows = await select(
    `select id from distributor_in where ref_id = :refId and status not in ('InActive', 'Rejected') order by id desc limit 1`,
    { refId }, transaction
  );
  return rows.length ? rows[0].id : null;
};

export const getSalesReturns = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const statusCount = Object.fromEntries(Object.keys(STATUS_CONDITIONS).map((key) => [key, 0]));
    if (!depotIds.length) {
      return res.status(200).json({ message: "Sales returns fetched successfully!", action: getAction(req), total: 0, statusCount, rows: [] });
    }
    const status = STATUS_CONDITIONS[text(req.query.status).toLowerCase()] ? text(req.query.status).toLowerCase() : 'approved';
    const query = text(req.query.query);
    const pageAll = text(req.query.pageSize).toUpperCase() === 'ALL';
    const pageSize = pageAll ? 0 : (+req.query.pageSize || 10);
    const pageIndex = +req.query.pageIndex || 0;

    const counts = await select(
      `select ${Object.keys(STATUS_CONDITIONS).map((key) => `sum(${STATUS_CONDITIONS[key]}) as ${key}`).join(', ')}
       from distributor_in A where A.depot_id in (:depotIds)`,
      { depotIds }
    );
    for (const key in statusCount) statusCount[key] = +counts[0][key] || 0;

    const search = query
      ? `and (A.id like :query or DATE_FORMAT(A.date_of_processing, '%d/%m/%Y') like :query or A.sales_return_no like :query
          or A.order_no like :query or B.distributor_name like :query or C.depot_name like :query or A.final_amount like :query)`
      : '';
    const from = `from distributor_in A
       left join distributor_master B on (A.distributor_id = B.id)
       left join depot_master C on (A.depot_id = C.id)
       where ${STATUS_CONDITIONS[status]} and A.depot_id in (:depotIds) ${search}`;
    const sortable = {
      date_of_processing: 'A.date_of_processing', sales_return_no: 'A.sales_return_no', order_no: 'A.order_no',
      depot_name: 'C.depot_name', distributor_name: 'B.distributor_name', final_amount: 'A.final_amount'
    };
    const sortKey = sortable[req.query.key] || 'A.modified_on';
    const sortOrder = text(req.query.order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const replacements = { depotIds, query: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };

    const total = await select(`select count(A.id) as count ${from}`, replacements);
    const rows = await select(
      `select A.id, A.date_of_processing, A.sales_return_no, A.order_no, A.final_amount, A.status, A.is_expired, A.is_exchanged,
         A.sales_type, A.invoice_nos, A.modified_on, B.distributor_name, C.depot_name,
         (select N.id from credit_debit_note N where N.distributor_in_id = A.id order by N.id desc limit 1) as credit_debit_note_id
       ${from}
       order by ${sortKey} ${sortOrder}, A.id desc
       ${pageAll ? '' : 'limit :limit offset :offset'}`,
      replacements
    );
    res.status(200).json({ message: "Sales returns fetched successfully!", action: getAction(req), total: +total[0].count, statusCount, rows });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching sales returns failed!";
    next(error, req, res);
  }
};

const itemNameJoin = (alias) => `
  left join product_master P on (${alias}.type = 'Bar' and ${alias}.item_id = P.id)
  left join box_master BX on (${alias}.type = 'Box' and ${alias}.item_id = BX.id)
  left join combo_box_master CB on (${alias}.type = 'Combo Box' and ${alias}.item_id = CB.id)
  left join batch_master BM on (BM.id = ${alias}.BATCH_COLUMN)`;
const itemName = `case when S.type = 'Bar' then P.product_name when S.type = 'Combo Box' then CB.combo_box_name else BX.box_name end as item_name`;

const loadLines = async (id, transaction) => {
  // Lines as entered; older returns (or databases without the table) only have the exploded lines
  let items = (await hasTable('distributor_in_sale_items', transaction)) ? await select(
    `select S.*, ${itemName}, BM.batch_no as batch_name from distributor_in_sale_items S ${itemNameJoin('S').replace('BATCH_COLUMN', 'batch_no')}
     where S.distributor_in_id = :id order by S.id`,
    { id }, transaction
  ) : [];
  if (!items.length) {
    items = await select(
      `select S.*, ${itemName}, BM.batch_no as batch_name from distributor_in_items S ${itemNameJoin('S').replace('BATCH_COLUMN', 'batch_no')}
       where S.distributor_in_id = :id order by S.id`,
      { id }, transaction
    );
  }
  const exchangeItems = await select(
    `select S.*, ${itemName}, BM.batch_no as batch_name from distributor_out_exchange_items S ${itemNameJoin('S').replace('BATCH_COLUMN', 'batch_no_ex')}
     where S.distributor_in_id = :id order by S.id`,
    { id }, transaction
  );
  return { items, exchangeItems };
};

export const getSalesReturn = async (req, res, next) => {
  try {
    const id = +req.params.id || 0;
    const depotIds = userDepotIds(req);
    if (!id || !depotIds.length) {
      return res.status(404).json({ message: "Sales return not found!" });
    }
    const rows = await select(
      `select A.*, B.distributor_name, B.state as distributor_state, D.depot_name, D.state as depot_state, F.sales_rep_name,
         E.state as invoice_state,
         concat(ifnull(U1.first_name, ''), ' ', ifnull(U1.last_name, '')) as created_by_name,
         concat(ifnull(U2.first_name, ''), ' ', ifnull(U2.last_name, '')) as modified_by_name,
         concat(ifnull(U3.first_name, ''), ' ', ifnull(U3.last_name, '')) as approved_by_name,
         (select N.id from credit_debit_note N where N.distributor_in_id = A.id order by N.id desc limit 1) as credit_debit_note_id,
         (select concat(ifnull(N.ref_no, ''), ' (', ifnull(N.status, ''), ')') from credit_debit_note N where N.distributor_in_id = A.id order by N.id desc limit 1) as credit_debit_note,
         concat(ifnull(U4.first_name, ''), ' ', ifnull(U4.last_name, '')) as rejected_by_name
       from distributor_in A
       left join distributor_master B on (A.distributor_id = B.id)
       left join depot_master D on (A.depot_id = D.id)
       left join sales_rep_master F on (A.sales_rep_id = F.id)
       left join user_master U4 on (A.rejected_by = U4.id)
       left join distributor_out E on (A.invoice_nos = E.invoice_no and E.status = 'Approved' and A.sales_type = 'Invoice')
       left join user_master U1 on (A.created_by = U1.id)
       left join user_master U2 on (A.modified_by = U2.id)
       left join user_master U3 on (A.approved_by = U3.id)
       where A.id = :id and A.depot_id in (:depotIds)
       limit 1`,
      { id, depotIds }
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Sales return not found!" });
    }
    const { items, exchangeItems } = await loadLines(id);
    const linked = await select(
      `select id, distributor_in_type, status, delivery_status, voucher_no, invoice_no, final_amount from distributor_out where distributor_in_id = :id`,
      { id }
    );
    res.status(200).json({
      action: getAction(req),
      permissions: getPermissions(req, rows[0]),
      salesReturn: { ...rows[0], state: rows[0].invoice_state || rows[0].distributor_state },
      items,
      exchangeItems,
      linked,
      pendingEditId: await findPendingCopy(id)
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Sales return failed!";
    next(error, req, res);
  }
};

// Batches made within 9 months before the return date (old PHP: today on add, the return date on edit)
const findBatches = (date) => select(
  `select id, batch_no from batch_master
   where date_of_processing >= date_sub(:date, interval 9 month) and status = 'Approved' and batch_no <> ''
   order by date_of_processing desc, id desc`,
  { date: date || today() }
);

export const getMasterData = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const depots = depotIds.length
      ? await select(`select id, depot_name, state from depot_master where status = 'Approved' and id in (:depotIds) order by depot_name`, { depotIds })
      : [];
    const distributors = await select(
      `select id, distributor_name, state, sell_out, credit_period from distributor_master where status = 'Approved' order by distributor_name`
    );
    const salesReps = await select(`select id, sales_rep_name from sales_rep_master where status = 'Approved' order by sales_rep_name`);
    const boxes = await select(`select id, box_name from box_master where status = 'Approved' order by box_name`);
    const comboBoxes = await select(`select id, combo_box_name from combo_box_master where status = 'Approved' and gst = 'Yes' order by modified_on desc`);
    const bars = await select(`select id, product_name from product_master where status = 'Approved' order by product_name`);
    const batches = await findBatches(dateOrNull(req.query.date));
    res.status(200).json({ action: getAction(req), depots, distributors, salesReps, boxes, comboBoxes, bars, batches });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

// Approved invoices of the distributor in the user's depots (old PHP get_invoice)
export const getInvoices = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const invoices = depotIds.length ? await select(
      `select distinct invoice_no from distributor_out
       where depot_id in (:depotIds) and status = 'Approved' and distributor_id = :distributorId and invoice_no <> ''
       order by invoice_no`,
      { depotIds, distributorId: +req.query.distributor_id || 0 }
    ) : [];
    res.status(200).json({ invoices: invoices.map((row) => row.invoice_no) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching invoices failed!";
    next(error, req, res);
  }
};

// Lines of an approved invoice to return (old PHP get_invoice_details: the exploded items, the invoice discount and state)
export const getInvoiceDetails = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const rows = depotIds.length ? await select(
      `select A.discount, A.state, B.type, B.item_id, B.qty, B.batch_no
       from distributor_out A join distributor_out_items B on (A.id = B.distributor_out_id)
       where A.status = 'Approved' and A.invoice_no = :invoiceNo and A.depot_id in (:depotIds)
       order by B.id`,
      { invoiceNo: text(req.query.invoice_no), depotIds }
    ) : [];
    res.status(200).json({
      discount: rows.length ? rows[0].discount : 0,
      state: rows.length ? rows[0].state : '',
      items: rows.map((row) => ({ type: row.type === 'Bar' ? 'Bar' : 'Box', item_id: row.item_id, qty: row.qty, batch_no: row.batch_no }))
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching invoice details failed!";
    next(error, req, res);
  }
};

// Rate (MRP), cost, grams, tax % and the distributor's category margins (old PHP get_product / box / combo_box_details)
const findItemDetails = async (type, id, distributorId) => {
  if (type === 'Combo Box') {
    const rows = await select(
      `select amount as rate, ifnull(cost, 0) as cost, grams, gst_rate as tax_percentage, 0 as inv_margin, 0 as pro_margin from combo_box_master where id = :id`,
      { id }
    );
    return rows[0] || null;
  }
  const table = type === 'Bar' ? 'product_master' : 'box_master';
  const rows = await select(
    `select A.rate, A.cost, A.grams, A.tax_percentage, B.inv_margin, B.pro_margin
     from ${table} A
     left join distributor_category_margin B on (A.category_id = B.category_id and (B.distributor_id = :distributorId or B.distributor_id is null))
     where A.id = :id order by (B.distributor_id is null), B.distributor_id limit 1`,
    { id, distributorId: distributorId || 0 }
  );
  return rows[0] || null;
};

export const getItemDetails = async (req, res, next) => {
  try {
    const details = await findItemDetails(text(req.query.type), +req.query.id || 0, +req.query.distributor_id || 0);
    if (!details) {
      return res.status(404).json({ message: "Item not found!" });
    }
    res.status(200).json({
      rate: +details.rate || 0,
      cost: +details.cost || 0,
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

// Old PHP get_amount: amount = qty x sell rate, tax = amount x tax %, split CGST + SGST or IGST
const calculateLine = (line, taxType) => {
  const amount = (+line.qty || 0) * (+line.sell_rate || 0);
  const taxPer = +line.tax_per || 0;
  return {
    tax_type: taxType,
    amount: round(amount),
    cgst_amt: taxType === 'Intra' ? round((amount * taxPer / 2) / 100) : 0,
    sgst_amt: taxType === 'Intra' ? round((amount * taxPer / 2) / 100) : 0,
    igst_amt: taxType === 'Intra' ? 0 : round((amount * taxPer) / 100),
    tax_amt: round((amount * taxPer) / 100),
    total_amt: round(amount + (amount * taxPer) / 100),
    cost_amount: round((+line.qty || 0) * (+line.cost_rate || 0))
  };
};

const totalsOf = (lines) => {
  const sum = (key) => round(lines.reduce((total, line) => total + (+line[key] || 0), 0));
  const finalAmount = sum('total_amt');
  return {
    amount: sum('amount'), cgst_amount: sum('cgst_amt'), sgst_amount: sum('sgst_amt'), igst_amount: sum('igst_amt'),
    tax_amount: sum('tax_amt'), final_amount: finalAmount, cost_amount: sum('cost_amount'),
    round_off_amount: round(Math.round(finalAmount) - finalAmount)
  };
};

const parseLines = async (rows, prefix, distributorId, taxType, addError, batchKey) => {
  const lines = [];
  for (let index = 0; index < rows.length; index++) {
    const item = rows[index] || {};
    const field = (name) => `${prefix}[${index}].${name}`;
    const type = text(item.type);
    const itemId = +item.item_id || 0;
    if (!ITEM_TYPES.includes(type)) addError(field('type'), 'Type is required');
    if (!itemId) addError(field('item_id'), 'Item is required');
    else if (ITEM_TYPES.includes(type) && !(await findItemDetails(type, itemId, distributorId))) addError(field('item_id'), 'Item not found');
    if (text(item.qty) === '' || isNaN(+item.qty)) addError(field('qty'), 'Qty is required');
    else if (!(+item.qty > 0)) addError(field('qty'), 'Qty must be more than 0');
    if (text(item.sell_rate) === '' || isNaN(+item.sell_rate)) addError(field('sell_rate'), 'Sell Rate is required');
    else if (+item.sell_rate < 0) addError(field('sell_rate'), 'Sell Rate cannot be negative');
    const batch = +item.batch_no || 0;
    if (!batch) addError(field('batch_no'), 'Batch is required');

    const line = {
      type,
      item_id: itemId,
      qty: round(item.qty),
      rate: round(item.rate),
      sell_rate: round(item.sell_rate, 4),
      cost_rate: round(item.cost_rate),
      grams: round(item.grams),
      tax_per: round(item.tax_per),
      margin_per: round(item.sell_margin),
      promo_margin: round(item.promo_margin),
      [batchKey]: batch || null
    };
    lines.push({ ...line, ...calculateLine(line, taxType) });
  }
  return lines;
};

// Validates the form and builds the return, its lines and the exchange lines (old PHP save_data + validations.js)
const buildReturn = async (req, existing) => {
  const body = req.body || {};
  const errors = {};
  const addError = (field, message) => { if (!errors[field]) errors[field] = { message }; };
  const depotIds = userDepotIds(req);

  const dateOfProcessing = dateOrNull(body.date_of_processing);
  if (!dateOfProcessing) addError('date_of_processing', 'Date is required');
  else if (dateOfProcessing > today()) addError('date_of_processing', 'Date cannot be in the future');
  else if (await isFreezedMonth(dateOfProcessing)) addError('date_of_processing', 'Please Select Another Date ,This Date is Freezed');

  const depotId = +body.depot_id || 0;
  const depot = depotIds.includes(depotId) ? (await select(`select id, state from depot_master where id = :depotId`, { depotId }))[0] : null;
  if (!depot) addError('depot_id', 'Depot is required');

  const distributorId = +body.distributor_id || 0;
  const distributor = distributorId ? (await select(`select id, state from distributor_master where id = :distributorId`, { distributorId }))[0] : null;
  if (!distributor) addError('distributor_id', 'Distributor is required');

  const salesRepId = +body.sales_rep_id || 0;
  if (!salesRepId) addError('sales_rep_id', 'Sales Representative is required');
  else if (!(await select(`select id from sales_rep_master where id = :salesRepId`, { salesRepId })).length) addError('sales_rep_id', 'Sales Representative not found');

  const dueDate = dateOrNull(body.due_date);
  if (!dueDate) addError('due_date', 'Due Date is required');

  const remarks = text(body.remarks);
  if (!remarks) addError('remarks', 'Remarks is required');

  const discount = text(body.discount);
  if (discount !== '' && (isNaN(+discount) || +discount < 0 || +discount > 100)) addError('discount', 'Discount must be between 0 and 100');

  // Invoice returns take the invoice's billing state, Adhoc ones the distributor's
  const salesType = text(body.sales_type);
  if (!SALES_TYPES.includes(salesType)) addError('sales_type', 'Sales Type is required');
  const invoiceNo = salesType === 'Invoice' ? text(body.invoice_no) : '';
  let state = distributor ? text(distributor.state) : '';
  if (salesType === 'Invoice') {
    const invoice = invoiceNo && depotIds.length ? (await select(
      `select state from distributor_out where invoice_no = :invoiceNo and status = 'Approved' and distributor_id = :distributorId and depot_id in (:depotIds) limit 1`,
      { invoiceNo, distributorId, depotIds }
    ))[0] : null;
    if (!invoice) addError('invoice_no', 'Invoice No. is required');
    else if (text(invoice.state)) state = text(invoice.state);
  }
  const taxType = depot && text(depot.state).toUpperCase() === state.toUpperCase() ? 'Intra' : 'Inter';

  const expired = body.expired === true || body.expired === 'true' || +body.expired === 1;
  const exchanged = body.exchanged === true || body.exchanged === 'true' || +body.exchanged === 1;

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) addError('items', 'Please add atleast one item.');
  const lines = await parseLines(items, 'items', distributorId, taxType, addError, 'batch_no');
  const totals = totalsOf(lines);
  if (lines.length && totals.final_amount === 0) addError('items', 'Amount cannot be zero.');

  let exchangeLines = [];
  let exchangeTotals = null;
  if (exchanged) {
    const rows = Array.isArray(body.exchange_items) ? body.exchange_items : [];
    if (!rows.length) addError('exchange_items', 'Please add atleast one exchange item.');
    exchangeLines = await parseLines(rows, 'exchange_items', distributorId, taxType, addError, 'batch_no_ex');
    exchangeTotals = totalsOf(exchangeLines);
  }

  if (Object.keys(errors).length) {
    return { errors };
  }

  const row = {
    date_of_processing: dateOfProcessing,
    depot_id: depotId,
    distributor_id: distributorId,
    sales_rep_id: salesRepId,
    amount: totals.amount,
    tax: 'gst',
    cst: existing && existing.cst !== null ? existing.cst : 5,
    tax_amount: totals.tax_amount,
    final_amount: totals.final_amount,
    final_cost_amount: totals.cost_amount,
    due_date: dueDate,
    remarks,
    is_expired: expired ? 'yes' : 'no',
    is_exchanged: exchanged ? 'yes' : 'no',
    sales_return_no: existing ? existing.sales_return_no : null,
    cgst: existing ? existing.cgst : 0,
    sgst: existing ? existing.sgst : 0,
    igst: existing ? existing.igst : 0,
    cgst_amount: totals.cgst_amount,
    sgst_amount: totals.sgst_amount,
    igst_amount: totals.igst_amount,
    round_off_amount: totals.round_off_amount,
    sales_type: salesType,
    invoice_nos: invoiceNo || null,
    discount: discount === '' ? 0 : round(discount),
    order_no: text(body.order_no),
    sales_return_date: existing ? toDate(existing.sales_return_date) : null
  };
  return { row, lines, totals, expired, exchanged, exchangeLines, exchangeTotals };
};

const insertSaleItem = (table, ownerKey, ownerId, line, transaction) => insertKnown(table, {
  [ownerKey]: ownerId,
  type: line.type,
  item_id: line.item_id,
  qty: line.qty,
  sell_rate: line.sell_rate,
  grams: line.grams,
  rate: line.rate,
  amount: line.amount,
  cost_rate: line.cost_rate,
  cost_amount: line.cost_amount,
  cgst_amt: line.cgst_amt,
  sgst_amt: line.sgst_amt,
  igst_amt: line.igst_amt,
  tax_amt: line.tax_amt,
  total_amt: line.total_amt,
  batch_no: line.batch_no,
  margin_per: line.margin_per,
  promo_margin: line.promo_margin,
  tax_percentage: line.tax_per,
  tax_type: line.tax_type,
  combo_box_id: line.type === 'Combo Box' ? line.item_id : null
}, transaction);

// Old PHP set_distributor_in_items: Bar / Box lines as entered, combo boxes exploded at MRP less the combo discount
const explodeLines = async (lines) => {
  const out = [];
  for (const line of lines) {
    if (line.type !== 'Combo Box') {
      out.push(line);
      continue;
    }
    const totals = await select(
      `select sum(:qty * ifnull(A.qty, 0) * ifnull(case when A.type = 'Box' then B.rate else C.rate end, 0)) as total_amount
       from combo_box_items A left join box_master B on (A.item_id = B.id) left join product_master C on (A.item_id = C.id)
       where A.combo_box_id = :comboBoxId`,
      { qty: line.qty, comboBoxId: line.item_id }
    );
    const totalAmount = totals.length ? (+totals[0].total_amount || 0) : 0;
    const discPer = totalAmount !== 0 ? round(((totalAmount - line.total_amt) / totalAmount) * 100) : 0;
    const contents = await select(
      `select A.type, A.item_id, A.qty, A.amount as item_amount,
         case when A.type = 'Box' then B.grams else C.grams end as item_grams,
         case when A.type = 'Box' then B.rate else C.rate end as item_rate,
         case when A.type = 'Box' then B.cost else C.cost end as item_cost,
         case when D.gst = 'Yes' then D.gst_rate when A.type = 'Box' then B.tax_percentage else C.tax_percentage end as item_tax_per
       from combo_box_items A left join box_master B on (A.item_id = B.id) left join product_master C on (A.item_id = C.id)
       left join combo_box_master D on (A.combo_box_id = D.id)
       where A.combo_box_id = :comboBoxId`,
      { comboBoxId: line.item_id }
    );
    for (const content of contents) {
      const qty = (+content.qty || 0) * line.qty;
      const rate = +content.item_rate || 0;
      const taxPer = +content.item_tax_per || 0;
      const sellRate = round(((rate - (rate * discPer) / 100) / (100 + taxPer)) * 100, 4);
      const cgst = line.tax_type === 'Intra' ? taxPer / 2 : 0;
      const igst = line.tax_type === 'Intra' ? 0 : taxPer;
      const cgstAmt = round(qty * ((sellRate * cgst) / 100));
      const igstAmt = round(qty * ((sellRate * igst) / 100));
      const amount = round(qty * sellRate);
      const taxAmt = round(cgstAmt * 2 + igstAmt);
      out.push({
        ...line,
        type: content.type,
        item_id: content.item_id,
        qty,
        sell_rate: sellRate,
        grams: +content.item_grams || 0,
        rate,
        cost_rate: +content.item_cost || 0,
        cost_amount: +content.item_amount || 0,
        amount,
        cgst_amt: cgstAmt,
        sgst_amt: cgstAmt,
        igst_amt: igstAmt,
        tax_amt: taxAmt,
        total_amt: round(amount + taxAmt),
        tax_per: taxPer,
        combo_box_id: line.item_id,
        exploded: true
      });
    }
  }
  return out;
};

// Removes the expired / exchange sale linked to a return (and its lines)
const removeLinkedOut = async (distributorInId, type, transaction) => {
  const rows = await select(`select id from distributor_out where distributor_in_id = :distributorInId and distributor_in_type = :type`, { distributorInId, type }, transaction);
  for (const row of rows) {
    await execute(`delete from distributor_out_items where distributor_out_id = :id`, { id: row.id }, transaction);
    await execute(`delete from distributor_out_sale_items where distributor_out_id = :id`, { id: row.id }, transaction);
    await execute(`delete from distributor_out where id = :id`, { id: row.id }, transaction);
  }
};

const upsertLinkedOut = async (distributorInId, type, data, transaction) => {
  const existing = await select(`select id from distributor_out where distributor_in_id = :distributorInId and distributor_in_type = :type limit 1`, { distributorInId, type }, transaction);
  if (existing.length) {
    await updateRow('distributor_out', existing[0].id, data, transaction);
    return existing[0].id;
  }
  return insertRow('distributor_out', { ...data, created_by: data.modified_by, created_on: data.modified_on }, transaction);
};

// Saves lines and the linked expiry / exchange sales of a return (old PHP save_data, after the header)
export const saveReturnDetails = async (id, built, status, req, now, transaction) => {
  const { row, lines, totals, expired, exchanged, exchangeLines, exchangeTotals } = built;
  const userId = req.userData.userId;

  const hasSaleItems = await hasTable('distributor_in_sale_items', transaction);
  if (hasSaleItems) await execute(`delete from distributor_in_sale_items where distributor_in_id = :id`, { id }, transaction);
  await execute(`delete from distributor_in_items where distributor_in_id = :id`, { id }, transaction);
  for (const line of lines) {
    await insertSaleItem('distributor_in_sale_items', 'distributor_in_id', id, line, transaction);
  }
  for (const line of await explodeLines(lines)) {
    await insertSaleItem('distributor_in_items', 'distributor_in_id', id, line, transaction);
  }

  // Expired stock: written off to 'Product Expired' at cost. PHP kept the entry when Expired was unticked; removed now.
  if (expired) {
    const outId = await upsertLinkedOut(id, 'expired', {
      date_of_processing: row.date_of_processing,
      depot_id: row.depot_id,
      distributor_id: EXPIRY_DISTRIBUTOR,
      sample_distributor_id: row.distributor_id,
      sales_rep_id: row.sales_rep_id,
      amount: totals.cost_amount,
      tax: '0',
      tax_per: 0,
      tax_amount: 0,
      final_amount: totals.cost_amount,
      status,
      delivery_status: 'Delivered',
      remarks: row.remarks,
      modified_by: userId,
      modified_on: now,
      distributor_in_id: id,
      distributor_in_type: 'expired'
    }, transaction);
    await execute(`delete from distributor_out_items where distributor_out_id = :outId`, { outId }, transaction);
    for (const line of lines) {
      await insertRow('distributor_out_items', {
        distributor_out_id: outId, type: line.type, item_id: line.item_id, qty: line.qty,
        sell_rate: line.cost_rate, grams: line.grams, rate: line.cost_rate, amount: line.cost_amount,
        combo_box_id: line.type === 'Combo Box' ? line.item_id : null
      }, transaction);
    }
  } else {
    await removeLinkedOut(id, 'expired', transaction);
  }

  // Exchange: the goods sent instead, as a sale waiting for delivery
  await execute(`delete from distributor_out_exchange_items where distributor_in_id = :id`, { id }, transaction);
  if (exchanged) {
    for (const line of exchangeLines) {
      await insertKnown('distributor_out_exchange_items', {
        distributor_in_id: id, type: line.type, item_id: line.item_id, qty: line.qty, sell_rate: line.sell_rate,
        grams: line.grams, rate: line.rate, amount: line.amount, cost_rate: line.cost_rate, cost_amount: line.cost_amount,
        cgst_amount: line.cgst_amt, sgst_amount: line.sgst_amt, igst_amount: line.igst_amt, tax_amount: line.tax_amt,
        total_amount: line.total_amt, margin_per: line.margin_per, promo_margin: line.promo_margin, tax_percentage: line.tax_per,
        batch_no_ex: line.batch_no_ex, tax_type: line.tax_type, combo_box_id: line.type === 'Combo Box' ? line.item_id : null
      }, transaction);
    }
    // PHP filled this sale's tax totals from the return and its lines with the return's amounts; the exchange's own now
    const outId = await upsertLinkedOut(id, 'exchanged', {
      date_of_processing: row.date_of_processing,
      depot_id: row.depot_id,
      distributor_id: row.distributor_id,
      sales_rep_id: row.sales_rep_id,
      amount: exchangeTotals.amount,
      tax: row.tax,
      tax_per: row.cst,
      tax_amount: exchangeTotals.tax_amount,
      final_amount: exchangeTotals.final_amount,
      status,
      delivery_status: 'Pending',
      remarks: row.remarks,
      modified_by: userId,
      modified_on: now,
      distributor_in_id: id,
      distributor_in_type: 'exchanged',
      cgst: row.cgst,
      sgst: row.sgst,
      igst: row.igst,
      cgst_amount: exchangeTotals.cgst_amount,
      sgst_amount: exchangeTotals.sgst_amount,
      igst_amount: exchangeTotals.igst_amount,
      discount: row.discount,
      // The sales ledger posts invoice_amount; PHP's set_ledger_sales posted this sale's final amount
      invoice_amount: exchangeTotals.final_amount,
      round_off_amount: 0,
      shipping_charges: 0
    }, transaction);
    await execute(`delete from distributor_out_items where distributor_out_id = :outId`, { outId }, transaction);
    await execute(`delete from distributor_out_sale_items where distributor_out_id = :outId`, { outId }, transaction);
    for (const line of exchangeLines) {
      const outLine = {
        distributor_out_id: outId, type: line.type, item_id: line.item_id, qty: line.qty, sell_rate: line.sell_rate,
        grams: line.grams, rate: line.rate, amount: line.amount, cgst_amt: line.cgst_amt, sgst_amt: line.sgst_amt,
        igst_amt: line.igst_amt, tax_amt: line.tax_amt, total_amt: line.total_amt, margin_per: line.margin_per,
        promo_margin: line.promo_margin, tax_percentage: line.tax_per, tax_type: line.tax_type,
        combo_box_id: line.type === 'Combo Box' ? line.item_id : 0
      };
      // Also kept as entered lines so the Sales screens show the exchange sale's items (PHP wrote only distributor_out_items)
      await insertRow('distributor_out_items', outLine, transaction);
      await insertRow('distributor_out_sale_items', outLine, transaction);
    }
  } else {
    await removeLinkedOut(id, 'exchanged', transaction);
  }
};

export const createSalesReturn = async (req, res, next) => {
  try {
    const built = await buildReturn(req, null);
    if (built.errors) {
      return invalid(res, built.errors);
    }
    const now = new Date();
    const userId = req.userData.userId;
    const t = await sequelize.transaction();
    try {
      const id = await insertRow('distributor_in', {
        ...built.row, status: 'Pending', ref_id: null, created_by: userId, created_on: now, modified_by: userId, modified_on: now
      }, t);
      await saveReturnDetails(id, built, 'Pending', req, now, t);
      await t.commit();
      res.status(201).json({ message: "Sales return submitted for approval!", id });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating sales return failed!";
    next(error, req, res);
  }
};

// Approved returns are changed through a Pending copy (ref_id) that replaces them on approval
export const updateSalesReturn = async (req, res, next) => {
  try {
    const existing = await findReturn(+req.params.id || 0, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Sales return not found!" });
    }
    if (!getPermissions(req, existing).submit) {
      return res.status(401).json({ message: "You cannot edit this sales return." });
    }
    const built = await buildReturn(req, existing);
    if (built.errors) {
      return invalid(res, built.errors);
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
      const data = { ...built.row, status: 'Pending', ref_id: refId, modified_by: userId, modified_on: now };
      if (refId) data.modified_approved_date = now;
      if (id) {
        await updateRow('distributor_in', id, data, t);
      } else {
        id = await insertRow('distributor_in', { ...data, created_by: userId, created_on: now }, t);
      }
      await saveReturnDetails(id, built, 'Pending', req, now, t);
      await t.commit();
      res.status(200).json({ message: "Sales return submitted for approval!", id });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Updating sales return failed!";
    next(error, req, res);
  }
};

// Copies a distributor_in row with all its lines and linked sales (Delete of an approved return)
const copyReturn = async (sourceId, overrides, linkedStatus, transaction) => {
  const source = (await select(`select * from distributor_in where id = :id`, { id: sourceId }, transaction))[0];
  delete source.id;
  const id = await insertRow('distributor_in', { ...source, ...overrides }, transaction);
  for (const table of await returnItemTables(transaction)) {
    for (const item of await select(`select * from ${table} where distributor_in_id = :id`, { id: sourceId }, transaction)) {
      delete item.id;
      await insertRow(table, { ...item, distributor_in_id: id }, transaction);
    }
  }
  for (const out of await select(`select * from distributor_out where distributor_in_id = :id`, { id: sourceId }, transaction)) {
    const outSourceId = out.id;
    delete out.id;
    const outId = await insertRow('distributor_out', {
      ...out, distributor_in_id: id, status: linkedStatus, approved_by: null, approved_on: null,
      modified_by: overrides.modified_by, modified_on: overrides.modified_on
    }, transaction);
    for (const table of ['distributor_out_items', 'distributor_out_sale_items']) {
      for (const item of await select(`select * from ${table} where distributor_out_id = :id`, { id: outSourceId }, transaction)) {
        delete item.id;
        await insertRow(table, { ...item, distributor_out_id: outId }, transaction);
      }
    }
  }
  return id;
};

// Old PHP Delete: an Approved return gets a 'Deleted' copy for approval; anything else (and its linked sales) is cancelled
export const deleteSalesReturn = async (req, res, next) => {
  try {
    const existing = await findReturn(+req.params.id || 0, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Sales return not found!" });
    }
    if (!getPermissions(req, existing).delete) {
      return res.status(401).json({ message: "You cannot delete this sales return." });
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
          return res.status(422).json({ message: "This sales return already has a change waiting for approval. Delete that entry instead." });
        }
        await copyReturn(existing.id, {
          status: 'Deleted', ref_id: existing.id, approved_by: null, approved_on: null,
          created_by: userId, created_on: now, modified_by: userId, modified_on: now, modified_approved_date: now
        }, 'Deleted', t);
        await t.commit();
        return res.status(200).json({ message: "Delete request submitted for approval!" });
      }
      await execute(`update distributor_in set status = 'InActive', modified_by = :userId, modified_on = :now where id = :id`, { id: existing.id, userId, now }, t);
      await execute(`update distributor_out set status = 'InActive', modified_by = :userId, modified_on = :now where distributor_in_id = :id`, { id: existing.id, userId, now }, t);
      await t.commit();
      res.status(200).json({ message: "Sales return cancelled!" });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Deleting sales return failed!";
    next(error, req, res);
  }
};

// Old PHP set_ledger: distributor credited with the return value; Sales and GST debited
const setReturnLedger = async (id, userId, transaction) => {
  const rows = await select(
    `select A.*, B.id as acc_id, B.ledger_name from distributor_in A
     left join account_ledger_master B on (A.distributor_id = B.ref_id and B.ref_type = 'Distributor')
     where A.id = :id and B.status = 'Approved' limit 1`,
    { id }, transaction
  );
  if (!rows.length) return false;
  const sale = rows[0];
  const now = new Date();
  const entries = [
    { entry_type: 'Total Amount', type: 'Credit', ledger_type: 'Main Entry', amount: sale.final_amount, acc_id: sale.acc_id, ledger_name: sale.ledger_name },
    { entry_type: 'Taxable Amount', type: 'Debit', ledger_type: 'Sub Entry', amount: sale.amount, acc_id: 1, ledger_name: 'Sales' },
    { entry_type: 'Tax', type: 'Debit', ledger_type: 'Sub Entry', amount: sale.tax_amount, acc_id: 2, ledger_name: 'GST' }
  ];
  const existing = await select(
    `select id, entry_type, voucher_id from account_ledger_entries where ref_id = :id and ref_type = 'Distributor_Sales_Return'`,
    { id }, transaction
  );
  let voucherId = existing.length ? existing[0].voucher_id : null;
  for (const entry of entries) {
    const data = {
      ref_id: id, ref_type: 'Distributor_Sales_Return', entry_type: entry.entry_type, invoice_no: null,
      vendor_id: sale.distributor_id, acc_id: entry.acc_id, ledger_name: entry.ledger_name, type: entry.type,
      amount: +entry.amount || 0, status: sale.status, is_active: 1, ledger_type: entry.ledger_type, narration: sale.remarks,
      ref_date: sale.sales_return_date || sale.date_of_processing, modified_by: userId, modified_on: now
    };
    const row = existing.find((item) => item.entry_type === entry.entry_type);
    if (row) {
      await updateRow('account_ledger_entries', row.id, data, transaction);
      continue;
    }
    if (!voucherId) voucherId = await nextSeries(sequelize, 'Account_Voucher', transaction);
    await insertRow('account_ledger_entries', { ...data, voucher_id: voucherId, created_by: userId, created_on: now }, transaction);
  }
  return true;
};

// Old PHP set_debit_note: its insert / update are commented out (the promotion reversal is switched off), so it only
// cancels a note already linked to the return when nothing is left to reverse. Ported as it behaves.
const setDebitNote = async (id, transaction) => {
  const sale = (await select(`select discount from distributor_in where id = :id`, { id }, transaction))[0];
  if (!sale) return;
  const discount = +sale.discount || 0;
  const items = await select(`select qty, rate, total_amt, margin_per, promo_margin from distributor_in_items where distributor_in_id = :id`, { id }, transaction);
  let invoiced = 0;
  let expected = 0;
  for (const item of items) {
    invoiced += +item.total_amt || 0;
    const rate = +item.rate || 0;
    expected += (+item.qty || 0) * (rate - (rate * ((+item.margin_per || 0) + (+item.promo_margin || 0) + discount)) / 100);
  }
  if (Math.round(invoiced - expected) === 0) {
    await execute(`update credit_debit_note set status = 'InActive' where distributor_in_id = :id`, { id }, transaction);
  }
};

// Return fields an approved change writes back into the original (old PHP approve query)
const MERGE_COLUMNS = [
  'date_of_processing', 'depot_id', 'distributor_id', 'sales_rep_id', 'amount', 'tax', 'cst', 'tax_amount', 'final_amount',
  'due_date', 'is_expired', 'is_exchanged', 'final_cost_amount', 'modified_by', 'modified_on', 'cgst', 'sgst', 'igst',
  'cgst_amount', 'sgst_amount', 'igst_amount', 'round_off_amount', 'freezed', 'sales_type', 'invoice_nos', 'discount', 'order_no'
];

// Approve (old PHP save_data with btn_approve)
// Approves a locked Pending (or Deleted) return inside the caller's transaction (old PHP save_approved_data):
// sales return no, linked expiry / exchange sales, ledger and debit note. Used by Sales Return and Sales Return Upload.
export const approveLockedReturn = async (locked, { remarks, userId, now }, t) => {
  const id = locked.id;
  const status = locked.status === 'Deleted' ? 'InActive' : 'Approved';
  const salesReturnDate = toDate(locked.sales_return_date) || today();
  let salesReturnNo = text(locked.sales_return_no);
  if (!salesReturnNo) {
    const series = await nextSeries(sequelize, 'Sales_Return', t);
    salesReturnNo = `WHPL/${fiscalYear(salesReturnDate).split('-')[0]}-SR/${series}`;
  }

  // Voucher no of the expired stock entry (kept if it already had one)
  const expiredRows = await select(
    `select id, voucher_no from distributor_out where distributor_in_id in (:ids) and distributor_id = :expiry order by (distributor_in_id = :refId) desc`,
    { ids: [id, +locked.ref_id || 0], expiry: EXPIRY_DISTRIBUTOR, refId: +locked.ref_id || 0 }, t
  );
  let voucherNo = expiredRows.length ? text(expiredRows[0].voucher_no) : '';
  const hasExpired = (await select(`select id from distributor_out where distributor_in_id = :id and distributor_id = :expiry`, { id, expiry: EXPIRY_DISTRIBUTOR }, t)).length > 0;
  if (hasExpired && !voucherNo) {
    const series = await nextSeries(sequelize, 'Voucher', t);
    voucherNo = `WHPL/${fiscalYear(salesReturnDate).split('-')[0]}-VOU/${series}`;
  }

  let returnId = id;
  const approvedFields = { status, remarks, userId, now, salesReturnNo, salesReturnDate };
  if (locked.ref_id) {
    const refId = +locked.ref_id;
    if (!(await select(`select id from distributor_in where id = :refId for update`, { refId }, t)).length) {
      return { error: `The return this changes (#${refId}) no longer exists.` };
    }
    await execute(
      `update distributor_in A, distributor_in B
       set ${MERGE_COLUMNS.map((column) => `A.${column} = B.${column}`).join(', ')},
         A.status = :status, A.remarks = :remarks, A.approved_by = :userId, A.approved_on = :now,
         A.sales_return_no = :salesReturnNo, A.sales_return_date = :salesReturnDate, A.modified_approved_date = :today
       where A.id = :refId and B.id = :id`,
      { ...approvedFields, today: today(), refId, id }, t
    );
    for (const table of await returnItemTables(t)) {
      await execute(`delete from ${table} where distributor_in_id = :refId`, { refId }, t);
      await execute(`update ${table} set distributor_in_id = :refId where distributor_in_id = :id`, { refId, id }, t);
    }
    // The original's linked sales are replaced by the copy's
    for (const out of await select(`select id from distributor_out where distributor_in_id = :refId`, { refId }, t)) {
      await execute(`delete from distributor_out_items where distributor_out_id = :outId`, { outId: out.id }, t);
      await execute(`delete from distributor_out_sale_items where distributor_out_id = :outId`, { outId: out.id }, t);
      await execute(`delete from distributor_out where id = :outId`, { outId: out.id }, t);
    }
    await execute(`update distributor_out set distributor_in_id = :refId where distributor_in_id = :id`, { refId, id }, t);
    await execute(`delete from distributor_in where id = :id`, { id }, t);
    returnId = refId;
  } else {
    await execute(
      `update distributor_in set status = :status, remarks = :remarks, approved_by = :userId, approved_on = :now,
         sales_return_no = :salesReturnNo, sales_return_date = :salesReturnDate
       where id = :id`,
      { ...approvedFields, id }, t
    );
  }
  await execute(
    `update distributor_out set status = :status, remarks = :remarks, approved_by = :userId, approved_on = :now, invoice_date = :salesReturnDate
     where distributor_in_id = :returnId`,
    { ...approvedFields, returnId }, t
  );
  if (voucherNo) {
    await execute(`update distributor_out set voucher_no = :voucherNo where distributor_in_id = :returnId and distributor_id = :expiry`,
      { voucherNo, returnId, expiry: EXPIRY_DISTRIBUTOR }, t);
  }

  const ledger = await setReturnLedger(returnId, userId, t);
  await setDebitNote(returnId, t);
  // Exchange sale ledger (old PHP set_ledger_sales)
  const exchange = (await select(`select id from distributor_out where distributor_in_id = :returnId and distributor_id <> :expiry limit 1`,
    { returnId, expiry: EXPIRY_DISTRIBUTOR }, t))[0];
  if (exchange) await setSalesLedger(sequelize, exchange.id, userId, t);
  return { status, returnId, salesReturnNo, ledger };
};

export const approveSalesReturn = async (req, res, next) => {
  try {
    if (!req.userData.roleDetails.r_approvals) {
      return res.status(401).json({ message: "You are not authorised!" });
    }
    const id = +req.params.id || 0;
    const existing = await findReturn(id, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Sales return not found!" });
    }
    if (!getPermissions(req, existing).approve) {
      return res.status(401).json({ message: "You cannot approve this sales return." });
    }
    const remarks = text((req.body || {}).remarks);
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const locked = (await select(`select * from distributor_in where id = :id for update`, { id }, t))[0];
      if (!locked || (locked.status !== 'Pending' && locked.status !== 'Deleted')) {
        await t.rollback();
        return res.status(422).json({ message: "This sales return is no longer waiting for approval." });
      }
      const result = await approveLockedReturn(locked, { remarks, userId, now }, t);
      if (result.error) {
        await t.rollback();
        return res.status(422).json({ message: result.error });
      }
      const { status, returnId, salesReturnNo, ledger } = result;
      await t.commit();

      res.status(200).json({
        message: status === 'InActive' ? "Sales return cancelled!" : `Sales return approved! Sales Return No: ${salesReturnNo}`,
        id: returnId,
        print: status === 'Approved',
        warning: ledger ? '' : 'No approved account ledger found for this distributor, so no ledger entries were made.'
      });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Approving sales return failed!";
    next(error, req, res);
  }
};

// Reject: remarks required. PHP left the linked expiry / exchange sales Pending (they then sat in Sales approval); rejected too now.
export const rejectSalesReturn = async (req, res, next) => {
  try {
    if (!req.userData.roleDetails.r_approvals) {
      return res.status(401).json({ message: "You are not authorised!" });
    }
    const existing = await findReturn(+req.params.id || 0, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Sales return not found!" });
    }
    if (!getPermissions(req, existing).approve) {
      return res.status(401).json({ message: "You cannot reject this sales return." });
    }
    const remarks = text((req.body || {}).remarks);
    if (!remarks) {
      return invalid(res, { remarks: { message: 'Remarks is required' } });
    }
    const now = new Date();
    const userId = req.userData.userId;
    const t = await sequelize.transaction();
    try {
      await execute(
        `update distributor_in set status = 'Rejected', remarks = :remarks, approved_by = :userId, approved_on = :now,
           rejected_by = :userId, rejected_on = :today where id = :id and status in ('Pending', 'Deleted')`,
        { remarks, userId, now, today: today(), id: existing.id }, t
      );
      await execute(`update distributor_out set status = 'Rejected', remarks = :remarks, modified_by = :userId, modified_on = :now where distributor_in_id = :id`,
        { remarks, userId, now, id: existing.id }, t);
      await t.commit();
      res.status(200).json({ message: "Sales return rejected!" });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Rejecting sales return failed!";
    next(error, req, res);
  }
};

// Sales Return Receipt (old PHP view_sales_return_receipt -> views/invoice/sales_return_receipt.php)
// Header, lines and exchange lines of a sales return receipt (old PHP view_sales_return_receipt)
const loadReceipt = async (id) => {
  const head = (await select(
    `select A.*, B.distributor_name, B.address, B.city, B.pincode, B.state, B.country, D.depot_name,
       concat(ifnull(U1.first_name, ''), ' ', ifnull(U1.last_name, '')) as createdby,
       concat(ifnull(U2.first_name, ''), ' ', ifnull(U2.last_name, '')) as modifiedby,
       concat(ifnull(U3.first_name, ''), ' ', ifnull(U3.last_name, '')) as approvedby
     from distributor_in A left join distributor_master B on (A.distributor_id = B.id) left join depot_master D on (A.depot_id = D.id)
     left join user_master U1 on (A.created_by = U1.id) left join user_master U2 on (A.modified_by = U2.id)
     left join user_master U3 on (A.approved_by = U3.id)
     where A.id = :id`,
    { id }
  ))[0];
  const items = await select(
    `select S.*, case when S.type = 'Box' then BX.box_name else P.product_name end as description, BM.batch_no as batch_name
     from distributor_in_items S left join box_master BX on (S.type = 'Box' and S.item_id = BX.id)
     left join product_master P on (S.type = 'Bar' and S.item_id = P.id) left join batch_master BM on (S.batch_no = BM.id)
     where S.distributor_in_id = :id order by S.id`,
    { id }
  );
  const exchange = await select(
    `select S.*, case when S.type = 'Box' then BX.box_name when S.type = 'Combo Box' then CB.combo_box_name else P.product_name end as description
     from distributor_out_exchange_items S left join box_master BX on (S.type = 'Box' and S.item_id = BX.id)
     left join product_master P on (S.type = 'Bar' and S.item_id = P.id) left join combo_box_master CB on (S.type = 'Combo Box' and S.item_id = CB.id)
     where S.distributor_in_id = :id order by S.id`,
    { id }
  );
  return { head, items, exchange };
};

// Receipts of several sales returns in one printout (Sales Return Upload)
export const renderReceipts = async (ids, assetUrlBase, title) => {
  const bodies = [];
  for (const id of ids) {
    const { head, items, exchange } = await loadReceipt(id);
    if (head) bodies.push(receiptBody(head, items, exchange, assetUrlBase));
  }
  return receiptPage(title, bodies);
};

export const getReceipt = async (req, res, next) => {
  try {
    const existing = await findReturn(+req.params.id || 0, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Sales return not found!" });
    }
    const id = existing.id;
    const { head, items, exchange } = await loadReceipt(id);
    res.status(200).json({ html: renderReceipt(head, items, exchange, assetUrl(req)) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating receipt failed!";
    next(error, req, res);
  }
};

const fmtDate = (value) => {
  const ymd = toDate(value);
  return ymd ? ymd.split('-').reverse().join('/') : '';
};
const fmtDateTime = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? '' : `${fmtDate(date)} ${date.toTimeString().substring(0, 8)}`;
};

const receiptBody = (head, items, exchange, assetUrlBase) => {
  const e = escapeHtml;
  const box = 'border-collapse:collapse;width:925px;max-width:100%;font-family:Arcon-Regular, OpenSans-Regular, Arcon, Verdana, Geneva, sans-serif;font-size:12px;border:1px solid #666';
  const cell = 'border-left:1px solid #666;border-right:1px solid #666;border-top:none;border-bottom:none';
  // Header grid of the old PHP receipt: cells carry their own borders inside the framed table
  const headCell = 'line-height:20px;padding-top:2px;padding-bottom:2px;';
  const r2 = (value) => round(value);
  const lines = items.map((item, index) => `<tr valign="top">
      <td align="center" style="${cell}">${index + 1}</td><td style="${cell}">${e(item.description)}</td>
      <td align="right" style="${cell}">${e(item.qty)}</td><td align="right" style="${cell}">${e(item.rate)}</td>
      <td align="right" style="${cell}">${r2(item.amount)}</td><td align="right" style="${cell}">${r2(item.cgst_amt)}</td>
      <td align="right" style="${cell}">${r2(item.sgst_amt)}</td><td align="right" style="${cell}">${r2(item.igst_amt)}</td>
      <td style="${cell}">${e(item.batch_name || item.batch_no)}</td><td align="right" style="${cell}">${r2(item.total_amt)}</td></tr>`).join('');
  const exchangeLines = exchange.map((item, index) => `<tr valign="top">
      <td align="center" style="${cell}">${index + 1}</td><td style="${cell}">${e(item.description)}</td>
      <td align="right" style="${cell}">${e(item.qty)}</td><td align="right" style="${cell}">${e(item.rate)}</td>
      <td align="right" style="${cell}">${r2(item.amount)}</td><td align="right" style="${cell}">${r2(item.cgst_amount)}</td>
      <td align="right" style="${cell}">${r2(item.sgst_amount)}</td><td align="right" style="${cell}">${r2(item.igst_amount)}</td></tr>`).join('');
  const words = `${numberToWords(head.final_amount)} Only`;
  const body = `
  <div>
    <table class="receipt" cellspacing="0" cellpadding="5" border="1" style="${box}">
      <tr><td colspan="10" style="padding:0"><table width="100%" border="0"><tr>
        <td width="30%"><img src="${assetUrlBase}logo.png" alt="" height="50" /></td>
        <td width="70%" style="color:#808080"><h1 style="margin:0;font-size:22px">Sales Return Receipt</h1></td>
      </tr></table></td></tr>
      <tr><td colspan="10" valign="top" style="line-height:20px;padding:0;border:0">
        <table width="100%" border="0" cellspacing="0" cellpadding="5" style="border-collapse:collapse">
          <tr>
            <td width="39%" rowspan="3" valign="top" style="${headCell}">
              <span style="font-size:13px;font-weight:500">Distributor Name</span><br />${e(head.distributor_name)}<br />
              ${e(getAddress(head.address, null, head.city, head.pincode, head.state, head.country))}
            </td>
            <td width="32%" valign="top" style="${headCell}border-left:1px solid #666;border-right:1px solid #666;border-bottom:1px solid #666">
              <span style="font-weight:500">Sales Return No.</span><br />${e(head.sales_return_no)}
            </td>
            <td width="15%" valign="top" style="${headCell}border-right:1px solid #666;border-bottom:1px solid #666">
              <span style="font-weight:500">Expired</span><br />${e(head.is_expired)}
            </td>
            <td width="14%" valign="top" style="${headCell}border-bottom:1px solid #666">
              <span style="font-weight:500">Exchanged</span><br />${e(head.is_exchanged)}
            </td>
          </tr>
          <tr>
            <td valign="top" style="${headCell}border-left:1px solid #666;border-right:1px solid #666;border-bottom:1px solid #666">
              <span style="font-weight:500">Location</span><br />${e(head.depot_name)}
            </td>
            <td valign="top" style="${headCell}border-right:1px solid #666;border-bottom:1px solid #666">
              <span style="font-weight:500">Prepare By</span><br />${e(head.createdby.trim())}
            </td>
            <td valign="top" style="${headCell}border-bottom:1px solid #666">
              <span style="font-weight:500">Dated</span><br />${fmtDate(head.date_of_processing)}
            </td>
          </tr>
          <tr>
            <td valign="top" style="${headCell}border-left:1px solid #666;border-right:1px solid #666">
              <span style="font-weight:500">Sales Type</span><br />${e(head.sales_type === 'Invoice' ? 'Invoice' : 'Adhoc')}
            </td>
            <td valign="top" style="${headCell}border-right:1px solid #666">
              <span style="font-weight:500">${head.sales_type === 'Invoice' ? 'Invoice No.' : ''}</span><br />${head.sales_type === 'Invoice' ? e(head.invoice_nos) : ''}
            </td>
            <td valign="top" style="${headCell}">&nbsp;</td>
          </tr>
        </table>
      </td></tr>
      <tr style="font-size:12px;font-weight:500"><td align="center">Sr. No.</td><td align="center">Description</td><td align="center">Quantity</td>
        <td align="center">Rate</td><td align="center">Amount</td><td align="center">Cgst</td><td align="center">Sgst</td><td align="center">Igst</td>
        <td align="center">Batch no</td><td align="center">Total Amount</td></tr>
      ${lines}
      <tr><td colspan="3"><span style="font-size:13px">Amount in Words: ${e(words)}</span></td>
        <td colspan="6" align="right" style="font-size:13px">Total</td>
        <td><span style="float:left">&#8377;</span><span style="float:right">${e(head.final_amount)}</span></td></tr>
      <tr><td colspan="3"><span style="font-size:13px">${e(words)}</span></td>
        <td colspan="7"><span style="font-size:13px">Remarks:</span> ${e(head.remarks)}</td></tr>
    </table>
    ${head.is_exchanged === 'yes' ? `
    <h3 style="font-family:Verdana, sans-serif">Exchange of stock</h3>
    <table class="receipt" cellspacing="0" cellpadding="5" border="1" style="${box}">
      <tr style="font-size:12px;font-weight:500"><td align="center">Sr. No.</td><td align="center">Description</td><td align="center">Quantity</td>
        <td align="center">Rate</td><td align="center">Amount</td><td align="center">Cgst</td><td align="center">Sgst</td><td align="center">Igst</td></tr>
      ${exchangeLines}
    </table>` : ''}
    <table class="user_data" border="0" style="border-collapse:collapse;margin-top:30px;font-size:12px;width:925px;max-width:100%" cellspacing="10">
      <tr><td style="font-weight:bold">Created By:</td><td>${e(head.createdby.trim())}</td><td style="font-weight:bold">Created On:</td><td>${fmtDateTime(head.created_on)}</td></tr>
      <tr><td style="font-weight:bold">Modified By:</td><td>${e(head.modifiedby.trim())}</td><td style="font-weight:bold">Modified On:</td><td>${fmtDateTime(head.modified_on)}</td></tr>
      <tr><td style="font-weight:bold">Approved By:</td><td>${e(head.approvedby.trim())}</td><td style="font-weight:bold">Approved On:</td><td>${fmtDateTime(head.approved_on)}</td></tr>
    </table>
  </div>`;
  return body;
};

// Receipts in one printable page (one per sales return, each on its own page)
const receiptPage = (title, bodies) => {
  const e = escapeHtml;
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${e(title)}</title>
    <style>
      @media print { .no-print { display: none; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      body { font-family: verdana; margin: 4px; }
      .receipt { border-collapse: collapse; }
      .receipt > tbody > tr > td { border: 1px solid #666; }
      .user_data td { border: none !important; padding: 5px !important; }
      .page-break { page-break-after: always; break-after: page; }
    </style></head>
    <body><div class="no-print" style="text-align:right;padding:8px"><button onclick="window.print()">Print</button></div>${bodies.join('<div class="page-break"></div>')}</body></html>`;
};

const renderReceipt = (head, items, exchange, assetUrlBase) => receiptPage(
  `Sales Return Receipt ${head.sales_return_no || ''}`, [receiptBody(head, items, exchange, assetUrlBase)]
);
