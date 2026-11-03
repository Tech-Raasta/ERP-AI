import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../lib/database.js';
import { select, execute, text, today, userDepotIds, toDate, insertRow, isFreezedMonth } from './sales.js';
import { saveReturnDetails, approveLockedReturn, renderReceipts } from './salesReturns.js';
import { getTaxType } from '../lib/salesCalc.js';
import { columnsOf, insertKnown } from '../lib/tableColumns.js';
import { loadWorkbook, cellValue, isEmptyRow, parseDate, cached, listValidation, uploadFileUrl } from '../lib/excelUpload.js';

// Sales Return Upload (old PHP Sales_return_upload). An Excel of returns becomes sales returns:
//   1. upload the file (sales_return_upload_files, status Uploading)
//   2. upload its data: every row is checked. A row returns either one SKU (Type, SKU Name, Qty, Batch No), or a
//      whole approved sale found by its Invoice No or PO No. Rows with the same date, depot, distributor, PO No and
//      Invoice No make one return. If any row fails nothing is saved and an error file (Error Remark per row) is
//      written; otherwise the returns are saved as Pending (sales_return_upload_details / _items) with a check file.
//   3. approve: every pending return becomes an approved sales return (Sales Return No, ledger, debit note; expired
//      goods written off to the Product Expired distributor with a voucher), or reject the file.
// Access follows the Sales Return section (old PHP get_access: Distributor_In).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
export const UPLOAD_DIR = 'assets/uploads/sales_return_upload/';
export const UPLOAD_PATH = path.join(ROOT, UPLOAD_DIR);
const TEMPLATE = path.join(ROOT, 'assets', 'templates', 'Sales_return_upload_format.xlsx');
const FILES = {
  localDir: UPLOAD_DIR,
  localPath: UPLOAD_PATH,
  // Files of uploads made in the old PHP app are on its server
  phpUrl: 'https://erp.eatanytime.in/eat_erp/assets/uploads/sales_return_upload/'
};

const FIRST_ROW = 5;
const LAST_COLUMN = 18; // R: Is Expired
const SKU_TYPES = ['Bar', 'Box'];

const roleDetails = (req) => req.userData.roleDetails || {};
const round = (value, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.sign(value) * Math.round(Math.abs(+value || 0) * factor) / factor;
};
const affected = (result) => (result && typeof result.affectedRows === 'number' ? result.affectedRows : 0);
const fileUrl = (req, folder, name) => uploadFileUrl(req, FILES, folder, name);
const isYes = (value) => text(value).toUpperCase() === 'YES';

const findFile = async (id, transaction, lock = false) => (
  await select(`select * from sales_return_upload_files where id = :id${lock ? ' for update' : ''}`, { id }, transaction)
)[0] || null;

// ---------- List ----------

const SORT_KEYS = { upload_date: 'upload_date', file_name: 'file_name', status: 'status', remarks: 'remarks' };

// Old PHP index (get_data): every upload, latest first
export const getSalesReturnUploads = async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(+req.query.pageSize || 10, 1), 500);
    const pageIndex = Math.max(+req.query.pageIndex || 0, 0);
    const query = text(req.query.query);
    const sortKey = SORT_KEYS[text(req.query.key)] || 'modified_on';
    const order = text(req.query.order).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const replacements = { search: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };
    const where = query
      ? `where (id like :search or date_format(upload_date, '%d/%m/%Y') like :search or file_name like :search
           or status like :search or remarks like :search)`
      : '';
    const [[count], rows] = await Promise.all([
      select(`select count(*) as total from sales_return_upload_files ${where}`, replacements),
      select(`select * from sales_return_upload_files ${where} order by ${sortKey} ${order}, id desc limit :limit offset :offset`, replacements)
    ]);
    const role = roleDetails(req);
    res.status(200).json({
      total: +count.total || 0,
      rows: rows.map((row) => ({
        id: row.id,
        upload_date: toDate(row.upload_date),
        file_name: row.file_name,
        status: row.status,
        // PHP kept <br/> in its remarks
        remarks: text(row.remarks).replace(/<br\s*\/?>/gi, ' '),
        file_url: fileUrl(req, row.file_path, row.file_name),
        error_file_url: fileUrl(req, row.error_file_path, row.error_file_name),
        check_file_url: fileUrl(req, row.check_file_path, row.check_file_name)
      })),
      action: { upload: !!role.r_insert, approve: !!role.r_approvals }
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching sales return uploads failed!";
    next(error, req, res);
  }
};

// ---------- Upload format ----------

// Old PHP download_upload_format: the template with drop-down lists of depots, distributors, types, SKUs (by type),
// batches of the last 9 months and Is Expired
export const getUploadFormat = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const nineMonthsAgo = new Date();
    nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);
    const [depots, distributors, products, boxes, batches] = await Promise.all([
      depotIds.length ? select(`select depot_name as name from depot_master where status = 'Approved' and id in (:depotIds) order by depot_name`, { depotIds }) : [],
      select(`select distributor_name as name from distributor_master where status = 'Approved' order by distributor_name`),
      select(`select product_name as name from product_master where status = 'Approved' order by product_name`),
      select(`select box_name as name from box_master where status = 'Approved' order by box_name`),
      select(`select distinct batch_no as name from batch_master where date_of_processing >= :from and status = 'Approved' and batch_no <> '' order by batch_no`, { from: toDate(nineMonthsAgo) })
    ]);

    const workbook = await loadWorkbook(await fs.promises.readFile(TEMPLATE));
    const sheet = workbook.getWorksheet('Sheet1') || workbook.worksheets[0];
    const lists = workbook.getWorksheet('Sheet2') || workbook.worksheets[1];
    const fill = (column, rows) => {
      rows.forEach((row, index) => { lists.getCell(`${column}${index + 2}`).value = row.name; });
      return Math.max(rows.length + 1, 2);
    };
    const lastDepot = fill('A', depots);
    const lastDistributor = fill('C', distributors);
    SKU_TYPES.forEach((type, index) => { lists.getCell(`G${index + 2}`).value = type; });
    const lastProduct = fill('I', products);
    const lastBox = fill('K', boxes);
    const lastBatch = fill('M', batches);
    lists.getCell('O2').value = 'yes';
    lists.getCell('O3').value = 'no';
    // SKU Name lists by Type (INDIRECT(Type) in the sheet), sized to the lists like PHP
    workbook.definedNames.model = [
      { name: 'Bar', ranges: [`Sheet2!$I$2:$I$${lastProduct}`] },
      { name: 'Box', ranges: [`Sheet2!$K$2:$K$${lastBox}`] }
    ];
    for (let row = FIRST_ROW; row <= 105; row++) {
      sheet.getCell(`B${row}`).dataValidation = listValidation(`Sheet2!$A$2:$A$${lastDepot}`);
      sheet.getCell(`C${row}`).dataValidation = listValidation(`Sheet2!$C$2:$C$${lastDistributor}`);
      sheet.getCell(`F${row}`).dataValidation = listValidation(`Sheet2!$G$2:$G$${SKU_TYPES.length + 1}`);
      sheet.getCell(`G${row}`).dataValidation = listValidation(`IF(F${row}="",F${row},INDIRECT(F${row}))`);
      sheet.getCell(`P${row}`).dataValidation = listValidation(`Sheet2!$M$2:$M$${lastBatch}`);
      sheet.getCell(`R${row}`).dataValidation = listValidation('Sheet2!$O$2:$O$3');
    }
    lists.state = 'hidden';

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_return_upload_format.xlsx"');
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    res.statusCode = 500;
    res.message = "Downloading sales return upload format failed!";
    next(error, req, res);
  }
};

// ---------- Upload ----------

// Old PHP upload_file + upload_file_data: saves the file, then reads its rows straight away
export const createSalesReturnUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ message: "Select the .xlsx file to upload." });
    }
    const now = new Date();
    const userId = req.userData.userId;
    const fileId = await insertRow('sales_return_upload_files', {
      file_name: req.file.filename,
      file_path: UPLOAD_DIR,
      upload_date: today(),
      status: 'Uploading',
      created_by: userId,
      created_on: now,
      modified_by: userId,
      modified_on: now
    });
    const result = await processFile(req, fileId);
    res.status(result.status === 'Error' ? 422 : 201).json({ id: fileId, ...result });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Uploading sales return file failed!";
    next(error, req, res);
  }
};

// Old PHP "Upload Data" on a file still marked Uploading
export const processSalesReturnUpload = async (req, res, next) => {
  try {
    const file = await findFile(+req.params.id || 0);
    if (!file) {
      return res.status(404).json({ message: "Sales return upload not found!" });
    }
    const result = await processFile(req, file.id);
    res.status(result.status === 'Error' ? 422 : 200).json({ id: file.id, ...result });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Uploading file data failed!";
    next(error, req, res);
  }
};

const lookups = (depotIds) => ({
  frozen: cached((date) => isFreezedMonth(date)),
  depot: cached(async (name) => (depotIds.length
    ? (await select(`select id, state, state_code from depot_master where depot_name = :name and id in (:depotIds) limit 1`, { name, depotIds }))[0]
    : null)),
  distributor: cached(async (name) => (await select(`select id, state from distributor_master where distributor_name = :name limit 1`, { name }))[0]),
  distributorById: cached(async (id) => (await select(`select id, state from distributor_master where id = :id limit 1`, { id }))[0]),
  // PHP looked SKUs up without a status filter
  product: cached(async (name) => (await select(`select id, grams, rate, tax_percentage from product_master where product_name = :name limit 1`, { name }))[0]),
  box: cached(async (name) => (await select(`select id, grams, rate, tax_percentage from box_master where box_name = :name limit 1`, { name }))[0]),
  batch: cached(async (batchNo) => (await select(`select id from batch_master where batch_no = :batchNo limit 1`, { batchNo }))[0]),
  cost: cached(async (key) => {
    const [type, id] = key.split('_');
    const table = type === 'Bar' ? 'product_master' : 'box_master';
    const [row] = await select(`select cost from ${table} where id = :id limit 1`, { id });
    return row ? +row.cost || 0 : 0;
  }),
  // The approved sale of an Invoice No / PO No, with its lines (Bar / Box as dispatched)
  sale: cached(async (key) => {
    const [column, value] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    const [sale] = await select(
      `select id, distributor_id, state, discount from distributor_out where status = 'Approved' and ${column === 'invoice' ? 'invoice_no' : 'order_no'} = :value order by id limit 1`,
      { value }
    );
    if (!sale) return null;
    const lines = await select(`select * from distributor_out_items where distributor_out_id = :id order by id`, { id: sale.id });
    return { sale, lines };
  }),
  // Invoice No / PO No already returned (or waiting in another upload)
  returned: cached(async (key) => {
    const [column, value] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    const field = column === 'invoice' ? 'invoice_nos' : 'order_no';
    const [done] = await select(`select id from distributor_in where ${field} = :value and status <> 'Rejected' and status <> 'InActive' limit 1`, { value });
    if (done) return true;
    const [waiting] = await select(`select id from sales_return_upload_details where ${field} = :value and status <> 'Rejected' and status <> 'InActive' limit 1`, { value });
    return !!waiting;
  })
});

// Optional number: blank is 0; otherwise must pass the check (PHP let non-numeric text through as 0)
const optional = (value, check, message, errors) => {
  if (value === '') return 0;
  const number = Number(value);
  if (isNaN(number) || !check(number)) {
    errors.push(message);
    return 0;
  }
  return round(number, 2);
};

// Validates one row (old PHP upload_file_data); returns { errors, header, lines }
const readRow = async (row, find) => {
  const cell = (column) => cellValue(row.getCell(column));
  const errors = [];
  const header = {};

  const creationDate = cell('A');
  if (creationDate === '') {
    errors.push('Creation date cannot be blank.');
  } else {
    header.creation_date = parseDate(creationDate);
    if (!header.creation_date) errors.push('Creation date should be in d-m-Y format.');
    else if (await find.frozen(header.creation_date)) errors.push('Creation date is freezed.');
  }

  const depotName = cell('B');
  if (!depotName) {
    errors.push('Depot Name cannot be blank.');
  } else {
    const depot = await find.depot(depotName);
    if (!depot) errors.push(`Depot Name ${depotName} not found.`);
    else Object.assign(header, { depot_id: depot.id, depot_state: text(depot.state) });
  }

  const distributorName = cell('C');
  header.order_no = String(cell('D')).replace(/["']/g, '');
  header.invoice_nos = String(cell('E')).replace(/["']/g, '');
  const skuType = String(cell('F'));
  let distributorId = '';
  let stateName = '';
  if ((skuType && !distributorName) || (!header.order_no && !header.invoice_nos && !distributorName)) {
    errors.push('Distributor Name cannot be blank.');
  } else if (distributorName) {
    const distributor = await find.distributor(distributorName);
    if (!distributor) errors.push(`Distributor Name ${distributorName} not found.`);
    else {
      distributorId = distributor.id;
      stateName = text(distributor.state);
    }
  }
  if (!header.order_no && !header.invoice_nos && !skuType) {
    errors.push('PO no, Invoice no or Sku details required.');
  }

  let discount = 0;
  const lines = [];
  if (skuType) {
    // One SKU returned
    const type = SKU_TYPES.find((option) => option.toUpperCase() === skuType.toUpperCase());
    if (!type) errors.push('Type should be Bar or Box.');
    const skuName = String(cell('G'));
    let item = null;
    if (!skuName) {
      errors.push('SKU Name cannot be blank.');
    } else if (type) {
      item = await (type === 'Bar' ? find.product(skuName) : find.box(skuName));
      if (!item) errors.push(`SKU Name ${skuName} not found.`);
    }
    let qty = 0;
    const qtyValue = cell('H');
    if (qtyValue === '') {
      errors.push('Quantity cannot be blank.');
    } else {
      qty = Number(qtyValue);
      if (isNaN(qty) || qty <= 0) {
        errors.push('Quantity should be greater than zero.');
        qty = 0;
      } else {
        qty = round(qty, 2);
      }
    }
    optional(cell('I'), (n) => n > 0, 'MRP should be greater than zero.', errors);
    discount = optional(cell('J'), (n) => n >= 0, 'Discount should be greater than or equal to zero.', errors);
    const value = optional(cell('K'), (n) => n > 0, 'Total Realisation Value should be greater than zero.', errors);
    const batchNo = String(cell('P'));
    let batchId = '';
    if (!batchNo) {
      errors.push('Batch No cannot be blank.');
    } else {
      const batch = await find.batch(batchNo);
      if (!batch) errors.push(`Batch No ${batchNo} not found.`);
      else batchId = batch.id;
    }
    if (item) {
      lines.push({
        type, item_id: item.id, grams: item.grams, rate: +item.rate || 0, tax_per: +item.tax_percentage || 0,
        qty, value, batch_no: batchId, margin_per: 0, promo_margin: 0
      });
    }
  } else if (header.invoice_nos || header.order_no) {
    // A whole sale returned, found by Invoice No (else PO No)
    const byInvoice = !!header.invoice_nos;
    const found = await find.sale(byInvoice ? `invoice:${header.invoice_nos}` : `order:${header.order_no}`);
    if (!found) {
      errors.push(byInvoice ? `Invoice No ${header.invoice_nos} details not found.` : `Order No ${header.order_no} details not found.`);
    } else {
      discount = +found.sale.discount || 0;
      if (!distributorId) distributorId = found.sale.distributor_id || '';
      if (text(found.sale.state)) stateName = text(found.sale.state);
      if (!found.lines.length) errors.push('Sales items not found.');
      found.lines.forEach((line) => lines.push({
        type: line.type, item_id: line.item_id, grams: line.grams, rate: +line.rate || 0, tax_per: +line.tax_percentage || 0,
        qty: +line.qty || 0, value: +line.total_amt || 0, batch_no: line.batch_no || 0,
        margin_per: line.margin_per || 0, promo_margin: line.promo_margin || 0
      }));
    }
  }

  if (header.invoice_nos && await find.returned(`invoice:${header.invoice_nos}`)) {
    errors.push(`Invoice No ${header.invoice_nos} already imported.`);
  }
  if (header.order_no && await find.returned(`order:${header.order_no}`)) {
    errors.push(`Order No ${header.order_no} already imported.`);
  }
  if (!distributorId) errors.push('Distributor Id not found.');

  // Customer state: from the sale of the Invoice No / PO No, else the distributor's
  if (!stateName && header.invoice_nos) {
    const found = await find.sale(`invoice:${header.invoice_nos}`);
    if (found && text(found.sale.state)) stateName = text(found.sale.state);
  }
  if (!stateName && header.order_no) {
    const found = await find.sale(`order:${header.order_no}`);
    if (found && text(found.sale.state)) stateName = text(found.sale.state);
  }
  if (!stateName && distributorId) {
    const distributor = await find.distributorById(distributorId);
    if (!distributor) errors.push(`Distributor Id ${distributorId} not found.`);
    else stateName = text(distributor.state);
  }

  // PHP did not check this column (old files hold '', 'Yes', 'no', even 'Cancelled oredr')
  const isExpired = text(cell('R'));
  if (isExpired && !['YES', 'NO'].includes(isExpired.toUpperCase())) errors.push('Is Expired should be yes or no.');

  Object.assign(header, {
    distributor_id: distributorId,
    state_name: stateName,
    discount,
    remarks: String(cell('Q')),
    is_expired: isExpired ? isExpired.toLowerCase() : 'no'
  });
  return { errors, header, lines };
};

// Old PHP: the return discount is the MRP value less the realisation value; MRP includes tax; valued at cost too
const calculateReturn = async (order, find) => {
  const taxType = getTaxType(order.depot_state, order.state_name);
  const discountPer = order.total_order_amt ? round(((order.total_order_amt - order.total_order_value) / order.total_order_amt) * 100, 2) : 0;
  const totals = { amount: 0, tax_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, final_amount: 0, cost_amount: 0 };
  const lines = [];
  for (const line of order.lines) {
    const cost = await find.cost(`${line.type}_${line.item_id}`);
    let sellRate = line.rate - (line.rate * discountPer) / 100;
    if (line.tax_per) sellRate = (sellRate / (100 + line.tax_per)) * 100;
    const cgst = taxType === 'Intra' ? line.tax_per / 2 : 0;
    const igst = taxType === 'Intra' ? 0 : line.tax_per;
    const cgstAmt = round(line.qty * ((sellRate * cgst) / 100));
    const igstAmt = round(line.qty * ((sellRate * igst) / 100));
    const taxAmt = round(cgstAmt * 2 + igstAmt);
    const amount = round(line.qty * sellRate);
    const totalAmt = round(amount + taxAmt);
    const costAmount = round(line.qty * cost);
    totals.amount += amount;
    totals.tax_amount += taxAmt;
    totals.cgst_amount += cgstAmt;
    totals.sgst_amount += cgstAmt;
    totals.igst_amount += igstAmt;
    totals.final_amount += totalAmt;
    totals.cost_amount += costAmount;
    lines.push({
      ...line, tax_type: taxType, sell_rate: round(sellRate, 4), amount, cgst_amt: cgstAmt, sgst_amt: cgstAmt,
      igst_amt: igstAmt, tax_amt: taxAmt, total_amt: totalAmt, cost_rate: cost, cost_amount: costAmount
    });
  }
  Object.keys(totals).forEach((key) => { totals[key] = round(totals[key]); });
  return {
    ...order,
    ...totals,
    lines,
    discount: discountPer,
    round_off_amount: round(Math.round(totals.final_amount) - totals.final_amount)
  };
};

// Reads, validates and saves the rows of an uploaded file (old PHP upload_file_data)
const processFile = async (req, fileId) => {
  const userId = req.userData.userId;
  const now = new Date();
  // Claim the file so it cannot be read twice at the same time
  const [claim] = await execute(
    `update sales_return_upload_files set status = 'InProcess', modified_by = :userId, modified_on = :now where id = :fileId and status = 'Uploading'`,
    { userId, now, fileId }
  );
  if (!affected(claim)) {
    return { status: 'Error', message: "This file's data has already been uploaded." };
  }
  const file = await findFile(fileId);
  const finish = async (status, remarks, extra = {}) => {
    await execute(
      `update sales_return_upload_files set status = :status, remarks = :remarks, modified_by = :userId, modified_on = :now
         ${extra.error_file_name ? ', error_file_path = :dir, error_file_name = :error_file_name' : ''}
         ${extra.check_file_name ? ', check_file_path = :dir, check_file_name = :check_file_name' : ''}
       where id = :fileId`,
      { status, remarks, userId, now: new Date(), fileId, dir: UPLOAD_DIR, error_file_name: extra.error_file_name, check_file_name: extra.check_file_name }
    );
    return { status, message: remarks, ...extra };
  };

  try {
    const source = text(file.file_path) === UPLOAD_DIR ? path.join(UPLOAD_PATH, path.basename(file.file_name)) : null;
    if (!source || !fs.existsSync(source)) {
      return finish('Error', 'The uploaded file was not found on this server. Please upload it again.');
    }
    let workbook;
    try {
      workbook = await loadWorkbook(await fs.promises.readFile(source));
    } catch (error) {
      return finish('Error', 'The file could not be read. Please upload the .xlsx downloaded from Download Format.');
    }
    const sheet = workbook.worksheets[0];
    const heading = (column) => text(cellValue(sheet.getCell(`${column}4`))).toUpperCase();
    if (!sheet || heading('A') !== 'CREATION DATE' || heading('D') !== 'PO NO' || heading('E') !== 'INVOICE NO' || heading('P') !== 'BATCH NO') {
      return finish('Error', 'The file is not in the sales return upload format. Please use Download Format.');
    }
    // PHP headed column S but wrote the errors into R (Is Expired)
    sheet.getCell('S4').value = 'Error Remark';
    sheet.getColumn('S').width = 30;

    const find = lookups(userDepotIds(req));
    const orders = new Map();
    let rowCount = 0;
    let errorRows = 0;
    for (let rowNum = FIRST_ROW; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      // PHP also read empty rows below the data and reported them as errors
      if (isEmptyRow(row, LAST_COLUMN)) continue;
      rowCount++;
      const { errors, header, lines } = await readRow(row, find);
      sheet.getCell(`S${rowNum}`).value = errors.join(' ');
      sheet.getCell(`S${rowNum}`).alignment = { wrapText: true };
      if (errors.length) {
        errorRows++;
        continue;
      }
      const key = [header.creation_date, header.depot_id, header.distributor_id, header.order_no, header.invoice_nos].join('|');
      if (!orders.has(key)) {
        orders.set(key, { ...header, lines: [], total_order_amt: 0, total_order_value: 0 });
      }
      const order = orders.get(key);
      lines.forEach((line) => {
        order.lines.push({ ...line, row_num: rowNum });
        order.total_order_amt += line.qty * line.rate;
        order.total_order_value += line.value;
      });
    }
    if (!rowCount) {
      return finish('Error', 'The file has no rows to upload.');
    }

    const stamp = Date.now();
    const ext = path.extname(file.file_name) || '.xlsx';
    // Like PHP, nothing is saved while any row has an error
    if (errorRows) {
      const errorFileName = `${stamp}_file_${fileId}_error${ext}`;
      await workbook.xlsx.writeFile(path.join(UPLOAD_PATH, errorFileName));
      const result = await finish('Error', `${errorRows} of ${rowCount} rows have errors, so nothing was uploaded. See the error file, correct the rows and upload again.`,
        { error_file_name: errorFileName });
      return { ...result, errorRows };
    }

    let saved = 0;
    let lineCount = 0;
    const t = await sequelize.transaction();
    try {
      for (const order of orders.values()) {
        const final = await calculateReturn(order, find);
        const detailId = await insertKnown('sales_return_upload_details', {
          file_id: fileId, date_of_processing: final.creation_date, depot_id: final.depot_id,
          distributor_id: final.distributor_id, sales_rep_id: null, amount: final.amount, tax: null, cst: 1,
          tax_amount: final.tax_amount, final_amount: final.final_amount, due_date: today(), status: 'Pending',
          remarks: final.remarks, modified_by: userId, modified_on: now, is_expired: final.is_expired,
          is_exchanged: 'no', final_cost_amount: final.cost_amount, ref_id: null, sales_return_no: null,
          cgst: 1, sgst: 1, igst: 1, cgst_amount: final.cgst_amount, sgst_amount: final.sgst_amount,
          igst_amount: final.igst_amount, freezed: 0, round_off_amount: final.round_off_amount,
          sales_type: final.invoice_nos ? 'Invoice' : 'Adhoc', invoice_nos: final.invoice_nos,
          discount: final.discount, order_no: final.order_no, sales_return_date: null,
          created_by: userId, created_on: now
        }, t);
        for (const line of final.lines) {
          await insertKnown('sales_return_upload_items', {
            distributor_in_id: detailId, type: line.type, item_id: line.item_id, qty: line.qty,
            sell_rate: line.sell_rate, grams: line.grams, rate: line.rate, amount: line.amount,
            cost_rate: line.cost_rate, cost_amount: line.cost_amount, cgst_amt: line.cgst_amt,
            sgst_amt: line.sgst_amt, igst_amt: line.igst_amt, tax_amt: line.tax_amt, total_amt: line.total_amt,
            batch_no: line.batch_no, margin_per: line.margin_per, tax_percentage: line.tax_per,
            promo_margin: line.promo_margin, tax_type: line.tax_type
          }, t);
          // Check file: the calculated amounts on the row (a whole invoice's lines add up on its row)
          const add = (column, amount) => {
            const current = Number(cellValue(sheet.getCell(`${column}${line.row_num}`))) || 0;
            sheet.getCell(`${column}${line.row_num}`).value = round(current + amount);
          };
          add('L', line.cgst_amt);
          add('M', line.sgst_amt);
          add('N', line.igst_amt);
          add('O', line.amount);
          lineCount++;
        }
        saved++;
      }
      const checkFileName = `${stamp}_file_${fileId}_check${ext}`;
      await workbook.xlsx.writeFile(path.join(UPLOAD_PATH, checkFileName));
      await t.commit();
      const result = await finish('Pending', `Returns uploaded - ${saved} (${lineCount} lines from ${rowCount} rows). Approve the file to make them sales returns.`,
        { check_file_name: checkFileName });
      return { ...result, uploaded: saved };
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    // Let it be uploaded again
    await execute(`update sales_return_upload_files set status = 'Uploading', modified_on = :now where id = :fileId`, { now: new Date(), fileId });
    throw error;
  }
};

// ---------- Approve / Reject ----------

// Old PHP approve_file_data + Distributor_in_model::save_approved_data: every pending return of the file becomes an
// approved sales return (the same approval as the Sales Return screen). All or nothing (PHP had no transaction).
export const approveSalesReturnUpload = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot approve sales return uploads." });
    }
    const fileId = +req.params.id || 0;
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const file = await findFile(fileId, t, true);
      if (!file) {
        await t.rollback();
        return res.status(404).json({ message: "Sales return upload not found!" });
      }
      if (file.status !== 'Pending') {
        await t.rollback();
        return res.status(422).json({ message: "Only a file waiting for approval (Pending) can be approved." });
      }
      const details = await select(
        `select A.*, B.state as depot_state, C.state as distributor_state from sales_return_upload_details A
         left join depot_master B on (A.depot_id = B.id) left join distributor_master C on (A.distributor_id = C.id)
         where A.status = 'Pending' and A.file_id = :fileId order by A.id for update`,
        { fileId }, t
      );
      if (!details.length) {
        await t.rollback();
        return res.status(422).json({ message: "No data found." });
      }

      const returnColumns = await columnsOf('distributor_in', t);
      const returnNos = [];
      let expired = 0;
      let warning = '';
      for (const detail of details) {
        const row = {};
        Object.entries(detail).forEach(([key, value]) => {
          if (!['id', 'depot_state', 'distributor_state'].includes(key) && returnColumns.has(key)) row[key] = value;
        });
        Object.assign(row, { status: 'Pending', file_id: fileId, created_on: now, modified_by: userId, modified_on: now, freezed: 0 });
        const returnId = await insertRow('distributor_in', row, t);

        const lines = (await select(`select * from sales_return_upload_items where distributor_in_id = :id order by id`, { id: detail.id }, t))
          .map((line) => ({
            ...line,
            tax_per: +line.tax_percentage || 0,
            // Older tables have no tax_type: the line's own tax amounts tell (IGST = inter state)
            tax_type: line.tax_type || (+line.igst_amt ? 'Inter' : (+line.cgst_amt || +line.sgst_amt) ? 'Intra'
              : getTaxType(detail.depot_state, detail.distributor_state))
          }));
        const isExpired = isYes(detail.is_expired);
        if (isExpired) expired++;
        // Lines, and for expired goods the write-off to Product Expired at cost (as the Sales Return screen saves them)
        await saveReturnDetails(returnId, {
          row: { ...row, id: returnId },
          lines,
          totals: { cost_amount: +detail.final_cost_amount || 0 },
          expired: isExpired,
          exchanged: false,
          exchangeLines: [],
          exchangeTotals: {}
        }, 'Pending', req, now, t);

        const [locked] = await select(`select * from distributor_in where id = :returnId for update`, { returnId }, t);
        const result = await approveLockedReturn(locked, { remarks: text(detail.remarks), userId, now }, t);
        if (result.error) throw new Error(result.error);
        if (!result.ledger) warning = 'Some distributors have no approved account ledger, so their ledger entries were not made.';
        returnNos.push(result.salesReturnNo);

        await execute(
          `update sales_return_upload_details set status = 'Approved', approved_by = :userId, approved_on = :now, sales_return_no = :salesReturnNo where id = :id`,
          { userId, now, salesReturnNo: result.salesReturnNo, id: detail.id }, t
        );
      }
      await execute(
        `update sales_return_upload_files set status = 'Approved', approved_by = :userId, approved_on = :now, modified_by = :userId, modified_on = :now where id = :fileId`,
        { userId, now, fileId }, t
      );
      await t.commit();

      const range = returnNos.length > 1 ? ` (${returnNos[0]} to ${returnNos[returnNos.length - 1]})` : returnNos.length ? ` (${returnNos[0]})` : '';
      res.status(200).json({
        message: `File approved. ${returnNos.length} sales returns created${range}${expired ? `, ${expired} written off as expired` : ''}.`,
        returns: returnNos.length,
        warning
      });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Approving sales return upload failed!";
    next(error, req, res);
  }
};

// Old PHP reject_file_data: the file and its returns are set aside as Rejected
export const rejectSalesReturnUpload = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot reject sales return uploads." });
    }
    const fileId = +req.params.id || 0;
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const file = await findFile(fileId, t, true);
      if (!file) {
        await t.rollback();
        return res.status(404).json({ message: "Sales return upload not found!" });
      }
      if (file.status !== 'Pending') {
        await t.rollback();
        return res.status(422).json({ message: "Only a file waiting for approval (Pending) can be rejected." });
      }
      await execute(
        `update sales_return_upload_files set status = 'Rejected', rejected_by = :userId, rejected_on = :now, modified_by = :userId, modified_on = :now where id = :fileId`,
        { userId, now, fileId }, t
      );
      await execute(
        `update sales_return_upload_details set status = 'Rejected', rejected_by = :userId, rejected_on = :now where file_id = :fileId`,
        { userId, now, fileId }, t
      );
      await t.commit();
      res.status(200).json({ message: "File rejected." });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Rejecting sales return upload failed!";
    next(error, req, res);
  }
};

// ---------- Receipts ----------

// The sales return receipts of an approved file in one printout. (PHP's hidden Get Invoices button sent the return
// ids to the sales invoice printout, so it printed the wrong documents.)
export const getSalesReturnUploadReceipts = async (req, res, next) => {
  try {
    const fileId = +req.params.id || 0;
    const returns = await select(`select id from distributor_in where file_id = :fileId and status = 'Approved' order by id`, { fileId });
    if (!returns.length) {
      return res.status(404).json({ message: "No approved sales returns found for this file." });
    }
    const assetUrl = `${req.protocol}://${req.get('host')}/assets/invoice/`;
    res.status(200).json({ html: await renderReceipts(returns.map((row) => row.id), assetUrl, `Sales Return Upload ${fileId} - Receipts`) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating receipts failed!";
    next(error, req, res);
  }
};
