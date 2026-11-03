import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../lib/database.js';
import { select, execute, text, today, userDepotIds, toDate, insertRow, isFreezedMonth } from './sales.js';
import { fiscalYear, nextSeries, setLedger, setCreditNote } from '../lib/salesApproval.js';
import { getTaxType, setDistributorOutItems } from '../lib/salesCalc.js';
import { getInvoiceData, renderInvoices } from '../lib/salesPrint.js';
import { columnsOf, insertKnown } from '../lib/tableColumns.js';
import { loadWorkbook, cellValue, isEmptyRow, parseDate, cached, listValidation, uploadFileUrl } from '../lib/excelUpload.js';

// Sales Upload (old PHP Sales_upload). An Excel of web / marketplace orders becomes sales:
//   1. upload the file (sales_upload_files, status Uploading)
//   2. upload its data: every row is validated; rows are grouped into orders by PO No and saved to
//      sales_upload_details / sales_upload_sale_items (status Pending). A check file (amounts filled in) and,
//      when rows fail, an error file (Error Remark per row) are written next to it.
//   3. approve: every pending order becomes an approved sale with its invoice number and ledger entries;
//      or reject the file.
// Access follows the Sales section (old PHP get_access: Distributor_Out).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
export const UPLOAD_DIR = 'assets/uploads/sale_upload/';
export const UPLOAD_PATH = path.join(ROOT, UPLOAD_DIR);
const TEMPLATE = path.join(ROOT, 'assets', 'templates', 'Sales_upload_format.xlsx');
// Files of uploads made in the old PHP app are on its server
const PHP_UPLOAD_URL = 'https://erp.eatanytime.in/eat_erp/assets/uploads/sales_upload/';

const FIRST_ROW = 5;
const SKU_TYPES = ['Bar', 'Box', 'Combo_box'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const roleDetails = (req) => req.userData.roleDetails || {};
const round = (value, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.sign(value) * Math.round(Math.abs(+value || 0) * factor) / factor;
};
const affected = (result) => (result && typeof result.affectedRows === 'number' ? result.affectedRows : 0);

const FILES = { localDir: UPLOAD_DIR, localPath: UPLOAD_PATH, phpUrl: PHP_UPLOAD_URL };
const fileUrl = (req, folder, name) => uploadFileUrl(req, FILES, folder, name);

const listRow = (req, row) => ({
  id: row.id,
  upload_date: toDate(row.upload_date),
  file_name: row.file_name,
  status: row.status,
  remarks: row.remarks,
  file_url: fileUrl(req, row.file_path, row.file_name),
  error_file_url: fileUrl(req, row.error_file_path, row.error_file_name),
  check_file_url: fileUrl(req, row.check_file_path, row.check_file_name)
});

const findFile = async (id, transaction, lock = false) => (
  await select(`select * from sales_upload_files where id = :id${lock ? ' for update' : ''}`, { id }, transaction)
)[0] || null;

// ---------- List ----------

const SORT_KEYS = { upload_date: 'upload_date', file_name: 'file_name', status: 'status', remarks: 'remarks' };

// Old PHP get_list_data: every upload (not limited by depot), latest first
export const getSaleUploads = async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(+req.query.pageSize || 10, 1), 500);
    const pageIndex = Math.max(+req.query.pageIndex || 0, 0);
    const query = text(req.query.query);
    const sortKey = SORT_KEYS[text(req.query.key)] || 'modified_on';
    const order = text(req.query.order).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const replacements = { search: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };
    const where = query
      ? `where (id like :search or date_format(upload_date, '%d/%m/%Y') like :search or file_name like :search
           or status like :search or remarks like :search or check_file_name like :search)`
      : '';
    const [[count], rows] = await Promise.all([
      select(`select count(*) as total from sales_upload_files ${where}`, replacements),
      select(`select * from sales_upload_files ${where} order by ${sortKey} ${order}, id desc limit :limit offset :offset`, replacements)
    ]);
    const role = roleDetails(req);
    res.status(200).json({
      total: +count.total || 0,
      rows: rows.map((row) => listRow(req, row)),
      action: { upload: !!role.r_insert, approve: !!role.r_approvals }
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching sales uploads failed!";
    next(error, req, res);
  }
};

// ---------- Upload format ----------

// Old PHP download_upload_format: the template with drop-down lists of depots, distributors, cities, types,
// SKUs (by type) and batches of the last 9 months
export const getUploadFormat = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const nineMonthsAgo = new Date();
    nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);
    const [depots, distributors, cities, products, boxes, comboBoxes, batches] = await Promise.all([
      depotIds.length ? select(`select depot_name as name from depot_master where status = 'Approved' and id in (:depotIds) order by depot_name`, { depotIds }) : [],
      select(`select distributor_name as name from distributor_master where status = 'Approved' order by distributor_name`),
      select(`select city_name as name from city_master where status = '1' order by city_name`),
      select(`select product_name as name from product_master where status = 'Approved' order by product_name`),
      select(`select box_name as name from box_master where status = 'Approved' order by box_name`),
      select(`select combo_box_name as name from combo_box_master where status = 'Approved' order by combo_box_name`),
      select(`select distinct batch_no as name from batch_master where date_of_processing >= :from and status = 'Approved' and batch_no <> '' order by batch_no`, { from: toDate(nineMonthsAgo) })
    ]);

    const workbook = await loadWorkbook(await fs.promises.readFile(TEMPLATE));
    const sheet = workbook.getWorksheet('Sheet1') || workbook.worksheets[0];
    const lists = workbook.getWorksheet('Sheet2') || workbook.worksheets[1];
    const fill = (column, rows) => {
      rows.forEach((row, index) => { lists.getCell(`${column}${index + 2}`).value = row.name; });
      return rows.length + 1;
    };
    const lastDepot = fill('A', depots);
    const lastDistributor = fill('C', distributors);
    const lastCity = fill('E', cities);
    SKU_TYPES.forEach((type, index) => { lists.getCell(`G${index + 2}`).value = type; });
    const lastProduct = fill('I', products);
    const lastBox = fill('K', boxes);
    const lastBatch = fill('M', batches);
    const lastComboBox = fill('O', comboBoxes);
    // SKU Name lists by Type (INDIRECT(Type) in the sheet), sized to the lists like PHP
    workbook.definedNames.model = [
      { name: 'Bar', ranges: [`Sheet2!$I$2:$I${Math.max(lastProduct, 2)}`] },
      { name: 'Box', ranges: [`Sheet2!$K$2:$K${Math.max(lastBox, 2)}`] },
      { name: 'Combo_box', ranges: [`Sheet2!$O$2:$O${Math.max(lastComboBox, 2)}`] }
    ];

    for (let row = FIRST_ROW; row <= 105; row++) {
      sheet.getCell(`B${row}`).dataValidation = listValidation(`Sheet2!$A$2:$A$${Math.max(lastDepot, 2)}`);
      sheet.getCell(`C${row}`).dataValidation = listValidation(`Sheet2!$C$2:$C$${Math.max(lastDistributor, 2)}`);
      sheet.getCell(`F${row}`).dataValidation = listValidation(`Sheet2!$E$2:$E$${Math.max(lastCity, 2)}`);
      sheet.getCell(`J${row}`).dataValidation = listValidation(`Sheet2!$G$2:$G$${SKU_TYPES.length + 1}`);
      sheet.getCell(`K${row}`).dataValidation = listValidation(`IF(J${row}="",J${row},INDIRECT(J${row}))`);
      sheet.getCell(`T${row}`).dataValidation = listValidation(`Sheet2!$M$2:$M$${Math.max(lastBatch, 2)}`);
    }
    lists.state = 'hidden';

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_upload_format.xlsx"');
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    res.statusCode = 500;
    res.message = "Downloading sales upload format failed!";
    next(error, req, res);
  }
};

// ---------- Upload ----------

// Old PHP upload_file + upload_file_data: saves the file, then reads its rows straight away
export const createSaleUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ message: "Select the .xlsx file to upload." });
    }
    const now = new Date();
    const userId = req.userData.userId;
    const fileId = await insertRow('sales_upload_files', {
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
    res.message = "Uploading sales file failed!";
    next(error, req, res);
  }
};

// Old PHP "Upload Data" on a file still marked Uploading (uploaded but its data never read)
export const processSaleUpload = async (req, res, next) => {
  try {
    const file = await findFile(+req.params.id || 0);
    if (!file) {
      return res.status(404).json({ message: "Sales upload not found!" });
    }
    const result = await processFile(req, file.id);
    res.status(result.status === 'Error' ? 422 : 200).json({ id: file.id, ...result });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Uploading file data failed!";
    next(error, req, res);
  }
};

const lookups = (depotIds, fileId) => ({
  frozen: cached(async (date) => {
    const [year, month] = date.split('-');
    const rows = await select(`select id from freezed_month_details where year = :year and month = :month limit 1`, { year, month: MONTHS[+month - 1] });
    return rows.length > 0;
  }),
  depot: cached(async (name) => (depotIds.length
    ? (await select(`select id, state, state_code from depot_master where depot_name = :name and id in (:depotIds) limit 1`, { name, depotIds }))[0]
    : null)),
  distributor: cached(async (name) => (await select(`select id, class from distributor_master where distributor_name = :name limit 1`, { name }))[0]),
  pincode: cached(async (pincode) => (await select(
    `select B.state_name, B.state_code, C.country_name from pincode_master A
     left join state_master B on (A.state_id = B.id) left join country_master C on (B.country_id = C.id)
     where A.pincode = :pincode limit 1`, { pincode }
  ))[0]),
  // PO No / Track ID already on a sale, or on another upload that is not rejected
  poExists: cached(async (orderNo) => {
    const [sale] = await select(`select id from distributor_out where order_no = :orderNo and status <> 'Rejected' and status <> 'InActive' limit 1`, { orderNo });
    if (sale) return true;
    const [upload] = await select(`select id from sales_upload_details where order_no = :orderNo and status <> 'Rejected' and status <> 'InActive' and file_id <> :fileId limit 1`, { orderNo, fileId });
    return !!upload;
  }),
  trackExists: cached(async (trackingId) => {
    const [sale] = await select(`select id from distributor_out where tracking_id = :trackingId and status <> 'Rejected' and status <> 'InActive' limit 1`, { trackingId });
    if (sale) return true;
    const [upload] = await select(`select id from sales_upload_details where tracking_id = :trackingId and status <> 'Rejected' and status <> 'InActive' and file_id <> :fileId limit 1`, { trackingId, fileId });
    return !!upload;
  }),
  batch: cached(async (batchNo) => (await select(`select id from batch_master where batch_no = :batchNo limit 1`, { batchNo }))[0]),
  product: cached(async (name) => (await select(`select id, grams, rate, tax_percentage from product_master where status = 'Approved' and product_name = :name limit 1`, { name }))[0]),
  box: cached(async (name) => (await select(`select id, grams, rate, tax_percentage from box_master where status = 'Approved' and box_name = :name limit 1`, { name }))[0]),
  comboBox: cached(async (name) => {
    const [comboBox] = await select(`select id, grams, rate, gst, gst_rate from combo_box_master where status = 'Approved' and combo_box_name = :name limit 1`, { name });
    if (!comboBox || text(comboBox.gst) === 'Yes') return comboBox ? { comboBox, items: [] } : null;
    const items = await select(
      `select A.type as item_type, A.item_id, A.qty as item_qty,
         case when A.type = 'Bar' then B.product_name else C.box_name end as item_name,
         case when A.type = 'Bar' then B.grams else C.grams end as item_grams,
         case when A.type = 'Bar' then B.rate else C.rate end as item_rate,
         case when D.gst = 'Yes' then D.gst_rate when A.type = 'Bar' then B.tax_percentage else C.tax_percentage end as item_tax_per
       from combo_box_items A
       left join product_master B on (A.type = 'Bar' and A.item_id = B.id)
       left join box_master C on (A.type = 'Box' and A.item_id = C.id)
       left join combo_box_master D on (A.combo_box_id = D.id)
       where A.combo_box_id = :id`,
      { id: comboBox.id }
    );
    return { comboBox, items };
  })
});

// Required number greater than zero (PHP let non-numeric text through as 0)
const positive = (value, label, errors) => {
  if (value === '') {
    errors.push(`${label} cannot be blank.`);
    return 0;
  }
  const number = Number(value);
  if (isNaN(number) || number <= 0) {
    errors.push(`${label} should be greater than zero.`);
    return 0;
  }
  return round(number, 2);
};

// Validates one row (old PHP upload_file_data); returns { errors, header, lines, value }
const readRow = async (row, find) => {
  const cell = (column) => cellValue(row.getCell(column));
  const errors = [];
  const header = {};

  const creationDate = cell('A');
  if (creationDate === '') {
    errors.push('Creation date cannot be blank.');
  } else {
    header.creation_date = parseDate(creationDate);
    if (!header.creation_date) {
      errors.push('Creation date should be in d-m-Y format.');
    } else if (await find.frozen(header.creation_date)) {
      errors.push('Creation date is already freezed.');
    }
  }

  header.depot = cell('B');
  if (!header.depot) {
    errors.push('Depot Name cannot be blank.');
  } else {
    const depot = await find.depot(header.depot);
    if (!depot) errors.push(`Depot Name ${header.depot} not found.`);
    else Object.assign(header, { depot_id: depot.id, depot_state: text(depot.state), depot_state_code: text(depot.state_code) });
  }

  header.distributor_name = cell('C');
  header.delivery_status = 'Delivered';
  if (!header.distributor_name) {
    errors.push('Distributor Name cannot be blank.');
  } else {
    const distributor = await find.distributor(header.distributor_name);
    if (!distributor) {
      errors.push(`Distributor Name ${header.distributor_name} not found.`);
    } else {
      header.distributor_id = distributor.id;
      // Only direct (web) customers are delivered on upload
      if (text(distributor.class).toUpperCase() !== 'DIRECT') header.delivery_status = 'Pending';
    }
  }

  header.name_of_customer = cell('D');
  header.address = cell('E');
  header.city = cell('F');
  header.pincode = cell('G');
  header.mobile_no = cell('H');
  if (!header.name_of_customer) errors.push('Name of Customer cannot be blank.');
  if (!header.address) errors.push('Address cannot be blank.');
  if (!header.city) errors.push('City cannot be blank.');
  if (!header.pincode) {
    errors.push('Pincode cannot be blank.');
  } else {
    const pincode = await find.pincode(header.pincode);
    if (!pincode) errors.push(`Pincode ${header.pincode} not found.`);
    else Object.assign(header, { state_name: text(pincode.state_name), state_code: text(pincode.state_code), country_name: text(pincode.country_name) });
  }
  if (!header.mobile_no) errors.push('Mobile No cannot be blank.');

  header.po_no = String(cell('I')).replace(/["']/g, '');
  if (!header.po_no) {
    errors.push('PO No cannot be blank.');
  } else if (await find.poExists(header.po_no)) {
    errors.push(`PO No ${header.po_no} already exist.`);
  }

  header.tracking_id = String(cell('U')).replace(/["']/g, '');
  if (header.tracking_id && await find.trackExists(header.tracking_id)) {
    errors.push(`Track ID ${header.tracking_id} already exist.`);
  }
  header.remarks = String(cell('V'));
  header.despatch_through = String(cell('W'));

  const qty = positive(cell('L'), 'Quantity', errors);
  positive(cell('M'), 'MRP', errors);
  const value = positive(cell('O'), 'Total Realisation Value', errors);
  const discount = cell('N');

  const batchNo = String(cell('T'));
  let batchId = '';
  if (!batchNo) {
    errors.push('Batch No cannot be blank.');
  } else {
    const batch = await find.batch(batchNo);
    if (!batch) errors.push(`Batch No ${batchNo} not found.`);
    else batchId = batch.id;
  }

  const lines = [];
  const skuType = String(cell('J'));
  const skuName = String(cell('K'));
  // PHP compared the type exactly; the drop-down gives these spellings
  const type = SKU_TYPES.find((option) => option.toUpperCase() === skuType.toUpperCase());
  if (!skuType) errors.push('Type cannot be blank.');
  else if (!type) errors.push('Type should be Bar, Box or Combo_box.');
  if (!skuName) {
    errors.push('SKU Name cannot be blank.');
  } else if (type) {
    const line = (lineType, itemId, item, lineQty, comboBoxId) => ({
      type: lineType, item_id: itemId, grams: item.grams, rate: +item.rate || 0, tax_per: +item.tax_per || 0,
      qty: lineQty, combo_box_id: comboBoxId, batch_id: batchId, discount
    });
    if (type === 'Bar' || type === 'Box') {
      const item = await (type === 'Bar' ? find.product(skuName) : find.box(skuName));
      if (!item) errors.push(`SKU Name ${skuName} not found.`);
      else lines.push(line(type, item.id, { ...item, tax_per: item.tax_percentage }, qty, 0));
    } else {
      const found = await find.comboBox(skuName);
      if (!found) {
        errors.push(`SKU Name ${skuName} not found.`);
      } else if (text(found.comboBox.gst) === 'Yes') {
        // A combo box with its own GST rate is sold as one line
        lines.push(line('Combo Box', found.comboBox.id, { ...found.comboBox, tax_per: found.comboBox.gst_rate }, qty, found.comboBox.id));
      } else if (!found.items.length) {
        errors.push(`Combo Box ${skuName} items not found.`);
      } else {
        found.items.forEach((item) => lines.push(line(
          item.item_type, item.item_id, { grams: item.item_grams, rate: item.item_rate, tax_per: item.item_tax_per },
          qty * (+item.item_qty || 0), found.comboBox.id
        )));
      }
    }
  }
  return { errors, header, lines, value };
};

// Old PHP: the order discount is MRP value less the realisation value, spread over its lines; MRP includes tax
const calculateOrder = (order) => {
  const taxType = getTaxType(order.depot_state, order.state_name);
  const discountPer = order.total_order_amt ? round(((order.total_order_amt - order.total_order_value) / order.total_order_amt) * 100, 6) : 0;
  const totals = { amount: 0, tax_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, final_amount: 0 };
  order.lines = order.lines.map((line) => {
    let sellRate = line.rate - (line.rate * discountPer) / 100;
    if (line.tax_per) sellRate = (sellRate / (100 + line.tax_per)) * 100;
    const cgst = taxType === 'Intra' ? line.tax_per / 2 : 0;
    const igst = taxType === 'Intra' ? 0 : line.tax_per;
    const cgstAmt = round(line.qty * ((sellRate * cgst) / 100));
    const sgstAmt = cgstAmt;
    const igstAmt = round(line.qty * ((sellRate * igst) / 100));
    const taxAmt = round(cgstAmt + sgstAmt + igstAmt);
    const amount = round(line.qty * sellRate);
    const totalAmt = round(amount + taxAmt);
    totals.amount += amount;
    totals.tax_amount += taxAmt;
    totals.cgst_amount += cgstAmt;
    totals.sgst_amount += sgstAmt;
    totals.igst_amount += igstAmt;
    totals.final_amount += totalAmt;
    return {
      ...line,
      tax_type: taxType,
      sell_rate: round(sellRate, 4),
      amount,
      cgst_amt: cgstAmt,
      sgst_amt: sgstAmt,
      igst_amt: igstAmt,
      tax_amt: taxAmt,
      total_amt: totalAmt,
      discount: round(discountPer, 2),
      discount_amt: round(line.qty * ((sellRate * discountPer) / 100))
    };
  });
  Object.keys(totals).forEach((key) => { totals[key] = round(totals[key]); });
  return {
    ...order,
    ...totals,
    tax_type: taxType,
    discount: discountPer,
    round_off_amount: round(Math.round(totals.final_amount) - totals.final_amount),
    invoice_amount: Math.round(totals.final_amount)
  };
};

// Reads, validates and saves the rows of an uploaded file (old PHP upload_file_data)
const processFile = async (req, fileId) => {
  const userId = req.userData.userId;
  const now = new Date();
  // Claim the file so it cannot be read twice at the same time
  const [claim] = await execute(
    `update sales_upload_files set status = 'InProcess', modified_by = :userId, modified_on = :now where id = :fileId and status = 'Uploading'`,
    { userId, now, fileId }
  );
  if (!affected(claim)) {
    return { status: 'Error', message: "This file's data has already been uploaded." };
  }
  const file = await findFile(fileId);
  const finish = async (status, remarks, extra = {}) => {
    await execute(
      `update sales_upload_files set status = :status, remarks = :remarks, modified_by = :userId, modified_on = :now
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
    if (!sheet || heading('A') !== 'CREATION DATE' || heading('I') !== 'PO NO' || heading('K') !== 'SKU NAME' || heading('T') !== 'BATCH NO') {
      return finish('Error', 'The file is not in the sales upload format. Please use Download Format.');
    }
    sheet.getCell('X4').value = 'Error Remark';
    sheet.getColumn('X').width = 30;
    sheet.getCell('Y4').value = 'Status';
    sheet.getColumn('Y').width = 30;

    const find = lookups(userDepotIds(req), fileId);
    const orders = new Map();
    const errorOrders = new Set();
    const rowOrder = {};
    let errorRows = 0;
    for (let rowNum = FIRST_ROW; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      // PHP also read empty rows below the data and reported them as errors
      if (isEmptyRow(row, 23)) continue;

      const { errors, header, lines, value } = await readRow(row, find);
      rowOrder[rowNum] = header.po_no;
      if (errors.length) {
        errorRows++;
        errorOrders.add(header.po_no);
        sheet.getCell(`X${rowNum}`).value = errors.join(' ');
        sheet.getCell(`X${rowNum}`).alignment = { wrapText: true };
        continue;
      }
      sheet.getCell(`X${rowNum}`).value = '';
      // Rows with the same PO No make one order; the first row gives its customer details
      if (!orders.has(header.po_no)) {
        orders.set(header.po_no, { ...header, lines: [], total_order_amt: 0, total_order_value: 0 });
      }
      const order = orders.get(header.po_no);
      lines.forEach((line) => {
        order.lines.push({ ...line, row_num: rowNum });
        order.total_order_amt += line.qty * line.rate;
      });
      order.total_order_value += value;
    }
    if (!Object.keys(rowOrder).length) {
      return finish('Error', 'The file has no rows to upload.');
    }

    // An order is uploaded only when all its rows are valid
    const saved = [];
    const t = await sequelize.transaction();
    try {
      for (const order of orders.values()) {
        if (errorOrders.has(order.po_no)) continue;
        const final = calculateOrder(order);
        const [existing] = await select(
          `select id from sales_upload_details where (order_no = :po${final.tracking_id ? ' or tracking_id = :track' : ''})
             and status <> 'Rejected' and status <> 'InActive' limit 1`,
          { po: final.po_no, track: final.tracking_id }, t
        );
        if (existing) continue;
        const detailId = await insertKnown('sales_upload_details', {
          file_id: fileId, date_of_processing: final.creation_date, invoice_no: '', depot_id: final.depot_id,
          distributor_id: final.distributor_id, sales_rep_id: null, amount: final.amount, tax: null, tax_per: 1,
          tax_amount: final.tax_amount, final_amount: final.final_amount, due_date: today(), order_no: final.po_no,
          despatch_through: final.despatch_through, status: 'Pending', remarks: final.remarks,
          modified_by: userId, modified_on: now, client_name: final.name_of_customer, address: final.address,
          city: final.city, pincode: final.pincode, state: final.state_name, country: final.country_name,
          mobile_no: final.mobile_no, discount: final.discount, date_of_dispatch: today(),
          delivery_status: final.delivery_status, delivery_date: today(), transport_type: '', vehicle_number: '',
          cgst: 1, sgst: 1, igst: 1, cgst_amount: final.cgst_amount, sgst_amount: final.sgst_amount,
          igst_amount: final.igst_amount, reverse_charge: 'no', shipping_address: 'yes', state_code: final.state_code,
          round_off_amount: final.round_off_amount, invoice_amount: final.invoice_amount,
          invoice_date: final.creation_date, email_date_time: now, basis_of_sales: 'PO Number', email_from: '',
          email_approved_by: '', gstin: '', created_by: userId, created_on: now, tracking_id: final.tracking_id
        }, t);
        for (const line of final.lines) {
          await insertKnown('sales_upload_sale_items', {
            distributor_out_id: detailId, type: line.type, item_id: line.item_id, qty: line.qty,
            sell_rate: line.sell_rate, grams: line.grams, rate: line.rate, amount: line.amount,
            cgst_amt: line.cgst_amt, sgst_amt: line.sgst_amt, igst_amt: line.igst_amt, tax_amt: line.tax_amt,
            total_amt: line.total_amt, margin_per: 0, promo_margin: 0, tax_percentage: line.tax_per,
            batch_no: line.batch_id, batch_qty: line.qty, combo_box_id: line.combo_box_id,
            discount: line.discount, discount_amt: line.discount_amt, tax_type: line.tax_type
          }, t);
          // Check file: the calculated amounts on the row (added up for a combo box's items)
          const add = (column, amount) => {
            const current = Number(cellValue(sheet.getCell(`${column}${line.row_num}`))) || 0;
            sheet.getCell(`${column}${line.row_num}`).value = round(current + amount);
          };
          add('P', line.cgst_amt);
          add('Q', line.sgst_amt);
          add('R', line.igst_amt);
          add('S', line.amount);
        }
        saved.push(final);
      }

      const savedPos = new Set(saved.map((order) => order.po_no));
      Object.entries(rowOrder).forEach(([rowNum, po]) => {
        sheet.getCell(`Y${rowNum}`).value = savedPos.has(po) ? 'Uploaded' : 'Not Uploaded';
      });
      const stamp = Date.now();
      const ext = path.extname(file.file_name) || '.xlsx';
      const extra = {};
      // The same workbook (Error Remark / Status / amounts) is written as the error and / or check file
      if (errorOrders.size) {
        extra.error_file_name = `${stamp}_file_${fileId}_error${ext}`;
        await workbook.xlsx.writeFile(path.join(UPLOAD_PATH, extra.error_file_name));
      }
      if (saved.length) {
        extra.check_file_name = `${stamp}_file_${fileId}_check${ext}`;
        await workbook.xlsx.writeFile(path.join(UPLOAD_PATH, extra.check_file_name));
      }
      const skipped = [...orders.keys(), ...errorOrders].filter((po, index, all) => po && !savedPos.has(po) && all.indexOf(po) === index);
      const remarks = [
        `Orders uploaded - ${saved.length}.`,
        `Rows with errors - ${errorRows}.`,
        skipped.length ? `Order Nos not uploaded - ${skipped.join(', ')}.` : '',
        extra.error_file_name ? 'See the error file for the reasons.' : ''
      ].filter(Boolean).join(' ');
      await t.commit();
      // PHP left a file with no valid order as Pending, with nothing to approve
      const result = await finish(saved.length ? 'Pending' : 'Error', remarks, extra);
      return { ...result, uploaded: saved.length, errorRows };
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    // Let it be uploaded again
    await execute(`update sales_upload_files set status = 'Uploading', modified_on = :now where id = :fileId`, { now: new Date(), fileId });
    throw error;
  }
};

// ---------- Approve / Reject ----------

// Old PHP approve_file_data + Distributor_out_model::save_approved_data: every pending order of the file becomes an
// approved sale with an invoice number, its items and ledger entries. All or nothing (PHP had no transaction).
export const approveSaleUpload = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot approve sales uploads." });
    }
    const fileId = +req.params.id || 0;
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const file = await findFile(fileId, t, true);
      if (!file) {
        await t.rollback();
        return res.status(404).json({ message: "Sales upload not found!" });
      }
      if (file.status !== 'Pending') {
        await t.rollback();
        return res.status(422).json({ message: "Only a file waiting for approval (Pending) can be approved." });
      }
      const details = await select(
        `select A.*, B.state as depot_state from sales_upload_details A left join depot_master B on (A.depot_id = B.id)
         where A.status = 'Pending' and A.file_id = :fileId order by A.id for update`,
        { fileId }, t
      );
      if (!details.length) {
        await t.rollback();
        return res.status(422).json({ message: "No data found." });
      }
      // Sales cannot be added to a freezed month (the uploads were checked, but the month may have been freezed since)
      const frozen = [];
      for (const date of new Set(details.map((detail) => toDate(detail.date_of_processing)))) {
        if (await isFreezedMonth(date, t)) frozen.push(date);
      }
      if (frozen.length) {
        await t.rollback();
        return res.status(422).json({ message: `Sales of freezed months cannot be approved (${frozen.join(', ')}). Reject the file instead.` });
      }

      const saleColumns = await columnsOf('distributor_out', t);
      const itemTable = (await columnsOf('sales_upload_sale_items', t)).size ? 'sales_upload_sale_items' : 'sales_upload_items';
      const invoices = [];
      let skipped = 0;
      let warning = '';
      for (const detail of details) {
        const [sale] = await select(
          `select id from distributor_out where order_no = :orderNo and status <> 'Rejected' and status <> 'InActive' limit 1`,
          { orderNo: detail.order_no }, t
        );
        if (sale) {
          skipped++;
          continue;
        }
        const invoiceDate = toDate(detail.date_of_processing);
        const series = await nextSeries(sequelize, 'Tax_Invoice', t);
        const invoiceNo = `W/${fiscalYear(invoiceDate)}/${series}`;
        const taxType = getTaxType(detail.depot_state, detail.state);
        const row = {};
        Object.entries(detail).forEach(([key, value]) => {
          if (key !== 'id' && key !== 'depot_state' && saleColumns.has(key)) row[key] = value;
        });
        const saleId = await insertKnown('distributor_out', {
          ...row,
          status: 'Approved',
          approved_by: userId,
          approved_on: now,
          invoice_no: invoiceNo,
          invoice_date: invoiceDate,
          created_on: now,
          modified_on: now,
          freezed: 0,
          tax_type: taxType,
          file_id: fileId
        }, t);

        // Older uploads kept their lines in sales_upload_items
        let lines = await select(`select * from ${itemTable} where distributor_out_id = :id order by id`, { id: detail.id }, t);
        if (!lines.length && itemTable !== 'sales_upload_items') {
          lines = await select(`select * from sales_upload_items where distributor_out_id = :id order by id`, { id: detail.id }, t);
        }
        for (const line of lines) {
          const { id, ...values } = line;
          await insertKnown('distributor_out_sale_items', { ...values, tax_type: values.tax_type || taxType, distributor_out_id: saleId }, t);
        }
        await setDistributorOutItems(sequelize, saleId, t);
        const ledger = await setLedger(sequelize, saleId, userId, t);
        await setCreditNote(sequelize, saleId, t);
        if (!ledger) warning = 'Some distributors have no approved account ledger, so their ledger entries were not made.';

        await execute(
          `update sales_upload_details set status = 'Approved', approved_by = :userId, approved_on = :now where id = :id`,
          { userId, now, id: detail.id }, t
        );
        invoices.push(invoiceNo);
      }
      await execute(
        `update sales_upload_files set status = 'Approved', approved_by = :userId, approved_on = :now, modified_by = :userId, modified_on = :now where id = :fileId`,
        { userId, now, fileId }, t
      );
      await t.commit();

      const range = invoices.length > 1 ? ` (invoices ${invoices[0]} to ${invoices[invoices.length - 1]})` : invoices.length ? ` (invoice ${invoices[0]})` : '';
      res.status(200).json({
        message: `File approved. ${invoices.length} sales created${range}.${skipped ? ` ${skipped} orders skipped: their PO No is already on a sale.` : ''}`,
        sales: invoices.length,
        skipped,
        warning
      });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Approving sales upload failed!";
    next(error, req, res);
  }
};

// Old PHP reject_file_data: the file and its orders are set aside as Rejected
export const rejectSaleUpload = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot reject sales uploads." });
    }
    const fileId = +req.params.id || 0;
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const file = await findFile(fileId, t, true);
      if (!file) {
        await t.rollback();
        return res.status(404).json({ message: "Sales upload not found!" });
      }
      if (file.status !== 'Pending') {
        await t.rollback();
        return res.status(422).json({ message: "Only a file waiting for approval (Pending) can be rejected." });
      }
      await execute(
        `update sales_upload_files set status = 'Rejected', rejected_by = :userId, rejected_on = :now, modified_by = :userId, modified_on = :now where id = :fileId`,
        { userId, now, fileId }, t
      );
      await execute(
        `update sales_upload_details set status = 'Rejected', rejected_by = :userId, rejected_on = :now where file_id = :fileId`,
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
    res.message = "Rejecting sales upload failed!";
    next(error, req, res);
  }
};

// ---------- Invoices ----------

// Old PHP get_file_invoices: the tax invoices of an approved file's sales, in one printout
export const getSaleUploadInvoices = async (req, res, next) => {
  try {
    const fileId = +req.params.id || 0;
    const sales = await select(
      `select id from distributor_out where file_id = :fileId and status = 'Approved' and invoice_no is not null and invoice_no <> '' order by id`,
      { fileId }
    );
    if (!sales.length) {
      return res.status(404).json({ message: "No approved sales found for this file." });
    }
    const invoices = [];
    for (const sale of sales) {
      const invoice = await getInvoiceData(sequelize, sale.id);
      if (text(invoice.class).toUpperCase() !== 'SAMPLE') invoices.push(invoice);
    }
    const assetUrl = `${req.protocol}://${req.get('host')}/assets/invoice/`;
    res.status(200).json({ html: renderInvoices(invoices, assetUrl, `Sales Upload ${fileId} - Tax Invoices`) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating invoices failed!";
    next(error, req, res);
  }
};
