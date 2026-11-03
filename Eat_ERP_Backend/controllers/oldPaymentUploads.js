import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../lib/database.js';
import { select, execute, text, today, toDate, insertRow } from './sales.js';
import { NEW_UPLOAD_FILES } from './paymentUploads.js';
import { renderSlips, setCreditDebitNotes } from './payments.js';
import { renderNotes } from './creditDebitNotes.js';
import { loadWorkbook, cellValue, isEmptyRow, parseDate, listValidation, uploadFileUrl } from '../lib/excelUpload.js';

// Old Payment Upload (old PHP Payment_upload): the Normal format (Date, Bank, Mode, Distributor, Invoice No, NEFT No,
// Amount) or a gateway settlement report (Paytm, Razorpay, Shiprocket, Sodexo) becomes payments:
//   1. upload the file (payment_upload_files, status Uploading)
//   2. upload its data: every row is checked. Rows with the same date, bank, mode and NEFT No make one payment. If any
//      row fails nothing is saved and an error file is written; otherwise the payments are saved as Pending
//      (payment_upload_details / _items) with a check file.
//   3. approve: every pending payment becomes an approved payment (credit / debit notes except Paytm and Razorpay,
//      as in PHP), or reject the file.
// The marketplace settlement upload is New Payment Upload (controllers/paymentUploads.js); both share these tables.
// Access: the Payment role section.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
export const UPLOAD_DIR = 'assets/uploads/payment_upload/';
export const UPLOAD_PATH = path.join(ROOT, UPLOAD_DIR);
const TEMPLATE = path.join(ROOT, 'assets', 'templates', 'Payment_upload_old_format.xlsx');
const FILES = {
  localDir: UPLOAD_DIR,
  localPath: UPLOAD_PATH,
  // Files of uploads made in the old PHP app are on its server
  phpUrl: 'https://erp.eatanytime.in/eat_erp/assets/uploads/payment_upload/'
};

const ON_ACCOUNT = 'On Account';
const KALANDARI = 'Kalandari Transfer';
const MODES = ['Cash', 'Cheque', 'NEFT'];
// Columns of each format: where the data starts, the columns PHP wrote back, how far a row reaches
const FORMATS = {
  Normal: { start: 5, remarks: 'L', invoice: 'L', balance: 'M', columns: 11, date: 'Creation date', dateFormat: 'd-m-Y' },
  Paytm: { start: 2, remarks: 'BW', invoice: 'AU', balance: 'AV', columns: 27, date: 'Settled date', dateFormat: 'd-m-Y' },
  Razorpay: { start: 2, remarks: 'AB', invoice: 'AB', balance: 'AC', columns: 25, date: 'Settled_at', dateFormat: 'd-m-Y or d/m/Y' },
  Shiprocket: { start: 2, remarks: 'J', invoice: 'J', balance: 'K', columns: 8, date: 'Remittance date', dateFormat: 'Y-m-d' },
  Sodexo: { start: 2, remarks: 'AV', invoice: 'BC', balance: 'BD', columns: 46, date: 'Cheque date', dateFormat: 'd-M-Y' }
};
const GATEWAY_BY_UNIQUE_REF = ['Paytm', 'Razorpay'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const roleDetails = (req) => req.userData.roleDetails || {};
const round = (value, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.sign(value) * Math.round(Math.abs(+value || 0) * factor) / factor;
};
const affected = (result) => (result && typeof result.affectedRows === 'number' ? result.affectedRows : 0);
const fileUrl = (req, folder, name) => uploadFileUrl(req, FILES, folder, name);
const clean = (value) => String(value === null || value === undefined ? '' : value).replace(/'/g, '').trim();
const number = (value) => {
  const parsed = Number(clean(value).replace(/,/g, ''));
  return clean(value) === '' || isNaN(parsed) ? 0 : parsed;
};
const key = (value) => clean(value).toUpperCase();

const findFile = async (id, transaction, lock = false) => (
  await select(`select * from payment_upload_files where id = :id${lock ? ' for update' : ''}`, { id }, transaction)
)[0] || null;

// ---------- List ----------

const SORT_KEYS = { upload_date: 'upload_date', file_name: 'file_name', status: 'status', remarks: 'remarks' };

// Old PHP get_list_data, without the files of New Payment Upload
export const getOldPaymentUploads = async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(+req.query.pageSize || 10, 1), 500);
    const pageIndex = Math.max(+req.query.pageIndex || 0, 0);
    const query = text(req.query.query);
    const sortKey = SORT_KEYS[text(req.query.key)] || 'modified_on';
    const order = text(req.query.order).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const replacements = { search: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };
    const where = `where not ${NEW_UPLOAD_FILES} ${query
      ? `and (id like :search or date_format(upload_date, '%d/%m/%Y') like :search or file_name like :search
           or status like :search or remarks like :search or upload_type like :search)`
      : ''}`;
    const [[count], rows] = await Promise.all([
      select(`select count(*) as total from payment_upload_files ${where}`, replacements),
      select(`select * from payment_upload_files ${where} order by ${sortKey} ${order}, id desc limit :limit offset :offset`, replacements)
    ]);
    const role = roleDetails(req);
    res.status(200).json({
      total: +count.total || 0,
      rows: rows.map((row) => ({
        id: row.id,
        upload_date: toDate(row.upload_date),
        upload_type: row.upload_type,
        file_name: row.file_name,
        status: row.status,
        // PHP kept <br/> in its remarks
        remarks: text(row.remarks).replace(/<br\s*\/?>/gi, ' '),
        file_url: fileUrl(req, row.file_path, row.file_name),
        error_file_url: fileUrl(req, row.error_file_path, row.error_file_name),
        check_file_url: fileUrl(req, row.check_file_path, row.check_file_name)
      })),
      action: { upload: !!role.r_insert, approve: !!role.r_approvals },
      uploadTypes: Object.keys(FORMATS)
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching old payment uploads failed!";
    next(error, req, res);
  }
};

// ---------- Upload format ----------

// Old PHP download_upload_format: the Normal template with drop-down lists
export const getUploadFormat = async (req, res, next) => {
  try {
    const [banks, distributors] = await Promise.all([
      select(`select b_name as name from bank_master where status = 'Approved' order by b_name`),
      select(`select distributor_name as name from distributor_master where status = 'Approved' order by distributor_name`)
    ]);
    const workbook = await loadWorkbook(await fs.promises.readFile(TEMPLATE));
    const sheet = workbook.getWorksheet('Sheet1') || workbook.worksheets[0];
    const lists = workbook.getWorksheet('Sheet2') || workbook.worksheets[1];
    const fill = (column, rows) => {
      rows.forEach((row, index) => { lists.getCell(`${column}${index + 2}`).value = row.name; });
      return Math.max(rows.length + 1, 2);
    };
    const lastBank = fill('A', banks);
    MODES.forEach((mode, index) => { lists.getCell(`C${index + 2}`).value = mode; });
    const lastDistributor = fill('E', distributors);
    ['G', 'I'].forEach((column) => {
      lists.getCell(`${column}2`).value = 'Yes';
      lists.getCell(`${column}3`).value = 'No';
    });
    for (let row = FORMATS.Normal.start; row <= 105; row++) {
      sheet.getCell(`B${row}`).dataValidation = listValidation(`Sheet2!$A$2:$A$${lastBank}`);
      sheet.getCell(`C${row}`).dataValidation = listValidation(`Sheet2!$C$2:$C$${MODES.length + 1}`);
      sheet.getCell(`D${row}`).dataValidation = listValidation(`Sheet2!$E$2:$E$${lastDistributor}`);
      sheet.getCell(`I${row}`).dataValidation = listValidation('Sheet2!$G$2:$G$3');
      sheet.getCell(`J${row}`).dataValidation = listValidation('Sheet2!$I$2:$I$3');
    }
    lists.state = 'hidden';
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="payment_upload_format.xlsx"');
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    res.statusCode = 500;
    res.message = "Downloading payment upload format failed!";
    next(error, req, res);
  }
};

// ---------- Upload ----------

// Old PHP upload_file + upload_file_data: saves the file, then reads its rows straight away
export const createOldPaymentUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ message: "Select the .xlsx file to upload." });
    }
    const uploadType = text((req.body || {}).upload_type);
    if (!FORMATS[uploadType]) {
      fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(422).json({ message: "Select the upload type." });
    }
    const now = new Date();
    const userId = req.userData.userId;
    const fileId = await insertRow('payment_upload_files', {
      file_name: req.file.filename,
      file_path: UPLOAD_DIR,
      upload_date: today(),
      status: 'Uploading',
      upload_type: uploadType,
      created_by: userId,
      created_on: now,
      modified_by: userId,
      modified_on: now
    });
    const result = await processFile(req, fileId);
    res.status(result.status === 'Error' ? 422 : 201).json({ id: fileId, ...result });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Uploading payment file failed!";
    next(error, req, res);
  }
};

// Old PHP "Upload Data" on a file still marked Uploading
export const processOldPaymentUpload = async (req, res, next) => {
  try {
    const file = await findFile(+req.params.id || 0);
    if (!file) {
      return res.status(404).json({ message: "Payment upload not found!" });
    }
    const result = await processFile(req, file.id);
    res.status(result.status === 'Error' ? 422 : 200).json({ id: file.id, ...result });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Uploading file data failed!";
    next(error, req, res);
  }
};

// The values of one row in each format (old PHP upload_file_data, top of the row loop)
const readRow = (row, type) => {
  const cell = (column) => cellValue(row.getCell(column));
  const gateway = { bank: 'HDFC Bank', payment_mode: 'NEFT', invoice_no: '', remarks: '', credit_debit: 'Yes', tax: 'Yes', narration: '' };
  if (type === 'Paytm') {
    return {
      ...gateway,
      creation_date: cell('V'), distributor_name: 'EATAnytime Direct - Paytm', neft_no: clean(cell('T')),
      payment_amount: clean(cell('N')), commission: number(cell('O')), gst: number(cell('P')),
      unique_ref_no: clean(cell('B')), transaction: clean(cell('F')), actual_payment: number(cell('AA'))
    };
  }
  if (type === 'Razorpay') {
    const transaction = clean(cell('A'));
    const commission = number(cell('E'));
    const gst = number(cell('F'));
    const reversal = ['REFUND', 'TRANSFER'].includes(key(transaction));
    const actual = number(cell(reversal ? 'G' : 'H'));
    return {
      ...gateway,
      creation_date: cell('Y'), distributor_name: 'EATAnytime Direct - Razorpay', neft_no: clean(cell('X')),
      payment_amount: reversal ? String(actual - commission - gst) : clean(cell('C')), commission, gst,
      unique_ref_no: clean(cell('S')), transaction, actual_payment: actual,
      narration: key(transaction) === 'TRANSFER' ? KALANDARI : ''
    };
  }
  if (type === 'Shiprocket') {
    const amount = number(cell('F'));
    const refund = amount < 0;
    return {
      ...gateway,
      creation_date: cell('G'), distributor_name: 'EAT Anytime Direct-COD', neft_no: clean(cell('H')),
      payment_amount: String(amount), commission: 0, gst: 0,
      invoice_no: refund ? ON_ACCOUNT : '', credit_debit: refund ? 'Yes' : 'No', tax: 'No',
      unique_ref_no: refund ? '' : `#${clean(cell('D'))}`, transaction: refund ? 'REFUND' : '', actual_payment: amount
    };
  }
  if (type === 'Sodexo') {
    const reference = clean(cell('AT'));
    return {
      ...gateway,
      creation_date: cell('AB'), distributor_name: 'EATAnytime Direct - Sodexo', neft_no: clean(cell('AC')),
      payment_amount: clean(cell('Q')), commission: number(cell('AE')),
      gst: number(cell('AG')) + number(cell('AH')) + number(cell('AI')),
      unique_ref_no: reference.includes('-') ? `#${reference.substring(0, reference.indexOf('-'))}` : reference,
      transaction: 'REFUND', actual_payment: number(cell('AA'))
    };
  }
  return {
    creation_date: cell('A'), bank: clean(cell('B')), payment_mode: clean(cell('C')), distributor_name: clean(cell('D')),
    invoice_no: clean(cell('E')).replace(/"/g, ''), neft_no: clean(cell('F')), payment_amount: clean(cell('G')),
    remarks: clean(cell('H')), credit_debit: clean(cell('I')), tax: clean(cell('J')), narration: clean(cell('K')),
    commission: 0, gst: 0, unique_ref_no: '', transaction: '', actual_payment: number(cell('G'))
  };
};

// 'YYYY-MM-DD' of the date in each format (a time after it is ignored); Excel dates are taken as they are
const uploadDate = (value) => {
  if (value instanceof Date) return parseDate(value);
  const first = clean(value).split(' ')[0];
  const named = first.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (named) {
    const month = MONTHS.indexOf(named[2].toUpperCase()) + 1;
    return month ? parseDate(`${named[1]}-${month}-${named[3]}`) : null;
  }
  return parseDate(first);
};

const refundRow = (type, transaction) => {
  const code = key(transaction);
  return ((type === 'Paytm' || type === 'Shiprocket') && code === 'REFUND')
    || (type === 'Razorpay' && (code === 'REFUND' || code === 'TRANSFER'));
};

// What the rows need from the masters and sales, read once for the whole file instead of once per row
const loadLookups = async (rows, type, fileId) => {
  const distinct = (values) => [...new Set(values.filter(Boolean))];
  const refs = distinct(rows.filter((row) => !refundRow(type, row.transaction) && type !== 'Normal').map((row) => row.unique_ref_no));
  const refColumn = GATEWAY_BY_UNIQUE_REF.includes(type) ? 'unique_ref_no' : 'order_no';
  const refSales = refs.length ? await select(
    `select ${refColumn} as ref, invoice_no from distributor_out where status = 'Approved' and ${refColumn} in (:refs) order by id`,
    { refs }
  ) : [];
  const invoiceOfRef = new Map();
  refSales.forEach((sale) => { if (!invoiceOfRef.has(key(sale.ref))) invoiceOfRef.set(key(sale.ref), clean(sale.invoice_no)); });

  const invoiceNos = distinct([...rows.map((row) => row.invoice_no), ...invoiceOfRef.values()]).filter((no) => no !== ON_ACCOUNT);
  const [invoices, paid, uploaded] = invoiceNos.length ? await Promise.all([
    select(`select distributor_id, invoice_no, invoice_amount from distributor_out where status = 'Approved' and invoice_no in (:invoiceNos) order by id`, { invoiceNos }),
    select(
      `select A.distributor_id, A.invoice_no, sum(A.payment_amount) as total from payment_details_items A
       join payment_details B on (A.payment_id = B.id)
       where A.invoice_no in (:invoiceNos) and B.status = 'Approved' group by A.distributor_id, A.invoice_no`,
      { invoiceNos }
    ),
    select(
      `select A.distributor_id, A.invoice_no, sum(A.payment_amount) as total from payment_upload_items A
       join payment_upload_details B on (A.payment_id = B.id)
       where A.invoice_no in (:invoiceNos) and B.file_id <> :fileId and ((B.status <> 'Rejected' and B.status <> 'InActive') or B.status is null)
       group by A.distributor_id, A.invoice_no`,
      { invoiceNos, fileId }
    )
  ]) : [[], [], []];
  const invoiceMap = new Map();
  invoices.forEach((invoice) => { if (!invoiceMap.has(key(invoice.invoice_no))) invoiceMap.set(key(invoice.invoice_no), invoice); });
  const totals = (list) => new Map(list.map((row) => [`${row.distributor_id}|${key(row.invoice_no)}`, +row.total || 0]));

  const bankNames = distinct(rows.map((row) => row.bank));
  const distributorNames = distinct(rows.map((row) => row.distributor_name));
  const [banks, distributors] = await Promise.all([
    bankNames.length ? select(`select id, b_name as name from bank_master where b_name in (:bankNames)`, { bankNames }) : [],
    distributorNames.length ? select(`select id, distributor_name as name from distributor_master where distributor_name in (:distributorNames)`, { distributorNames }) : []
  ]);
  return {
    invoiceOfRef,
    invoiceMap,
    paid: totals(paid),
    uploaded: totals(uploaded),
    banks: new Map(banks.map((row) => [key(row.name), row.id])),
    distributors: new Map(distributors.map((row) => [key(row.name), row.id]))
  };
};

// Checks one row (old PHP upload_file_data) and gives its payment line
const checkRow = (row, type, find) => {
  const errors = [];
  const format = FORMATS[type];
  const line = { ...row };

  if (clean(row.creation_date) === '' && !(row.creation_date instanceof Date)) {
    errors.push(`${format.date} cannot be blank.`);
  } else {
    line.date_of_deposit = uploadDate(row.creation_date);
    if (!line.date_of_deposit) errors.push(`${format.date} should be in ${format.dateFormat} format.`);
  }

  if (!row.bank) {
    errors.push('Bank Name cannot be blank.');
  } else {
    line.bank_id = find.banks.get(key(row.bank));
    if (!line.bank_id) errors.push(`Bank Name ${row.bank} not found.`);
  }

  if (!row.payment_mode) errors.push('Payment Mode cannot be blank.');
  else if (!MODES.includes(row.payment_mode)) errors.push('Payment Mode should be Cash, Cheque or NEFT.');

  if (!row.distributor_name) {
    errors.push('Distributor Name cannot be blank.');
  } else {
    line.distributor_id = find.distributors.get(key(row.distributor_name));
    if (!line.distributor_id) errors.push(`Distributor Name ${row.distributor_name} not found.`);
  }

  const refund = refundRow(type, row.transaction);
  const transfer = type === 'Razorpay' && key(row.transaction) === 'TRANSFER';
  if (refund) {
    line.invoice_no = ON_ACCOUNT;
    line.credit_debit = type === 'Shiprocket' || transfer ? 'Yes' : 'No';
    line.tax = transfer ? 'Yes' : 'No';
  } else if (type !== 'Normal') {
    if (!row.unique_ref_no) {
      errors.push('Merchant unique ref cannot be blank.');
    } else if (!find.invoiceOfRef.has(key(row.unique_ref_no))) {
      errors.push(`Merchant unique ref ${row.unique_ref_no} Not Found.`);
    } else {
      line.invoice_no = find.invoiceOfRef.get(key(row.unique_ref_no));
    }
  }

  const amount = Number(clean(row.payment_amount).replace(/,/g, ''));
  let invoiceAmount = 0;
  let finalAmount = 0;
  if (!line.invoice_no) {
    errors.push('Invoice No cannot be blank.');
  } else if (line.invoice_no !== ON_ACCOUNT) {
    const invoice = find.invoiceMap.get(key(line.invoice_no));
    if (!invoice) {
      errors.push(`Invoice No ${line.invoice_no} Not Found.`);
    } else if (type === 'Normal' && line.distributor_id && +invoice.distributor_id !== +line.distributor_id) {
      // PHP took the payment against any distributor's invoice
      errors.push(`Invoice No ${line.invoice_no} does not belong to ${row.distributor_name}.`);
    } else {
      const pair = `${invoice.distributor_id}|${key(invoice.invoice_no)}`;
      invoiceAmount = +invoice.invoice_amount || 0;
      finalAmount = invoiceAmount - (find.paid.get(pair) || 0) - (find.uploaded.get(pair) || 0) - (isNaN(amount) ? 0 : amount);
    }
  }
  line.invoice_amount = invoiceAmount;
  line.final_amount = round(finalAmount);

  if (!row.neft_no) errors.push('NEFT No cannot be blank.');

  if (clean(row.payment_amount) === '') {
    errors.push('Payment Amount cannot be blank.');
  } else if (isNaN(amount)) {
    errors.push('Payment Amount should be a number.');
  } else if (amount === 0) {
    errors.push('Payment Amount should be greater than zero.');
  } else if ((type === 'Paytm' || type === 'Razorpay') && refund) {
    line.payment_amount = -amount;
    line.actual_payment = -row.actual_payment;
  } else {
    line.payment_amount = amount;
  }

  if (key(line.credit_debit) === 'YES') {
    if (!line.tax) errors.push('Tax cannot be blank.');
    if (type === 'Normal' && !line.narration) errors.push('Narration cannot be blank.');
  }
  return { errors, line };
};

// Rows with the same date, bank, mode and NEFT No make one payment (old PHP payment_array)
const addToPayment = (payments, line, type) => {
  const group = [line.date_of_deposit, line.bank_id, line.payment_mode, line.neft_no].join('|');
  const exists = payments.has(group);
  if (!exists) {
    payments.set(group, {
      date_of_deposit: line.date_of_deposit, bank_id: line.bank_id, payment_mode: line.payment_mode, neft_no: line.neft_no,
      remarks: line.remarks, total_amount: 0, actual_payment: 0, items: []
    });
  }
  const payment = payments.get(group);
  // A Sodexo settlement carries its commission and GST on every row: only the first counts
  const item = type === 'Sodexo' && exists ? { ...line, commission: 0, gst: 0 } : line;
  payment.items.push(item);
  payment.total_amount += type === 'Razorpay' && key(item.transaction) === 'TRANSFER'
    ? item.payment_amount
    : item.payment_amount - item.commission - item.gst;
  payment.actual_payment = type === 'Sodexo' ? item.actual_payment : payment.actual_payment + item.actual_payment;
};

// The saved lines of a payment: a Sodexo difference goes on the first line's commission, and the commission and GST
// taken by the gateway are shown as one On Account line against the settlement (old PHP, after inserting the lines)
const paymentLines = (payment, type) => {
  const lines = payment.items.map((item, index) => ({
    distributor_id: item.distributor_id, ref_no: item.neft_no, invoice_no: item.invoice_no, payment_amount: round(item.payment_amount),
    credit_debit: item.credit_debit, tax: item.tax, narration: item.narration,
    commission: round(type === 'Sodexo' && index === 0
      ? item.commission + (payment.total_amount - payment.actual_payment)
      : item.commission, 4),
    gst: round(item.gst, 4),
    unique_ref_no: item.unique_ref_no
  }));
  const charged = lines.filter((line) => line.narration !== KALANDARI);
  if (charged.length) {
    const { distributor_id: distributorId, ref_no: refNo } = charged[0];
    const total = charged
      .filter((line) => line.distributor_id === distributorId && line.ref_no === refNo)
      .reduce((sum, line) => sum + line.commission + line.gst, 0);
    if (total > 0) {
      lines.push({
        distributor_id: distributorId, ref_no: refNo, invoice_no: ON_ACCOUNT, payment_amount: round(-total),
        credit_debit: 'No', tax: 'No', narration: null, commission: null, gst: null, unique_ref_no: null
      });
    }
  }
  return lines;
};

// Reads, checks and saves the rows of an uploaded file (old PHP upload_file_data)
const processFile = async (req, fileId) => {
  const userId = req.userData.userId;
  const now = new Date();
  // Claim the file so it cannot be read twice at the same time
  const [claim] = await execute(
    `update payment_upload_files set status = 'InProcess', modified_by = :userId, modified_on = :now where id = :fileId and status = 'Uploading'`,
    { userId, now, fileId }
  );
  if (!affected(claim)) {
    return { status: 'Error', message: "This file's data has already been uploaded." };
  }
  const file = await findFile(fileId);
  const finish = async (status, remarks, extra = {}) => {
    await execute(
      `update payment_upload_files set status = :status, remarks = :remarks, modified_by = :userId, modified_on = :now
         ${extra.error_file_name ? ', error_file_path = :dir, error_file_name = :error_file_name' : ''}
         ${extra.check_file_name ? ', check_file_path = :dir, check_file_name = :check_file_name' : ''}
       where id = :fileId`,
      { status, remarks, userId, now: new Date(), fileId, dir: UPLOAD_DIR, error_file_name: extra.error_file_name, check_file_name: extra.check_file_name }
    );
    return { status, message: remarks, ...extra };
  };

  try {
    const type = text(file.upload_type);
    const format = FORMATS[type];
    if (!format) {
      return finish('Error', 'This file has no upload type. Please upload it again.');
    }
    const source = text(file.file_path) === UPLOAD_DIR ? path.join(UPLOAD_PATH, path.basename(file.file_name)) : null;
    if (!source || !fs.existsSync(source)) {
      return finish('Error', 'The uploaded file was not found on this server. Please upload it again.');
    }
    let workbook;
    try {
      workbook = await loadWorkbook(await fs.promises.readFile(source));
    } catch (error) {
      return finish('Error', 'The file could not be read. Please upload a valid .xlsx file.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return finish('Error', 'The file has no sheet to read.');
    }
    if (type === 'Normal') {
      const heading = (column) => text(cellValue(sheet.getCell(`${column}4`))).toUpperCase();
      if (heading('A') !== 'DATE OF DEPOSIT' || heading('E') !== 'INVOICE NO' || heading('G') !== 'PAYMENT AMOUNT') {
        return finish('Error', 'The file is not in the Normal format. Please use Download Format (marketplace settlement files go in New Payment Upload).');
      }
    }
    sheet.getCell(`${format.remarks}${format.start - 1}`).value = 'Error Remark';
    sheet.getColumn(format.remarks).width = 30;

    const rows = [];
    for (let rowNum = format.start; rowNum <= sheet.rowCount; rowNum++) {
      const row = sheet.getRow(rowNum);
      // PHP also read empty rows below the data and reported them as errors
      if (!isEmptyRow(row, format.columns)) rows.push({ ...readRow(row, type), row_num: rowNum });
    }
    if (!rows.length) {
      return finish('Error', 'The file has no rows to upload.');
    }

    const find = await loadLookups(rows, type, fileId);
    const payments = new Map();
    let errorRows = 0;
    for (const row of rows) {
      const { errors, line } = checkRow(row, type, find);
      if (errors.length) {
        errorRows++;
        const cell = sheet.getCell(`${format.remarks}${row.row_num}`);
        cell.value = errors.join(' ');
        cell.alignment = { wrapText: true };
      } else {
        addToPayment(payments, line, type);
      }
    }

    const stamp = Date.now();
    const ext = path.extname(file.file_name) || '.xlsx';
    // Like PHP, nothing is saved while any row has an error
    if (errorRows) {
      const errorFileName = `${stamp}_file_${fileId}_error${ext}`;
      await workbook.xlsx.writeFile(path.join(UPLOAD_PATH, errorFileName));
      const result = await finish('Error', `${errorRows} of ${rows.length} rows have errors, so nothing was uploaded. See the error file, correct the rows and upload again.`,
        { error_file_name: errorFileName });
      return { ...result, errorRows };
    }

    sheet.getCell(`${format.invoice}${format.start - 1}`).value = 'Inv Amount';
    sheet.getCell(`${format.balance}${format.start - 1}`).value = 'Bal Amount';
    let lineCount = 0;
    const t = await sequelize.transaction();
    try {
      for (const payment of payments.values()) {
        const paymentId = await insertRow('payment_upload_details', {
          file_id: fileId, date_of_deposit: payment.date_of_deposit, bank_id: payment.bank_id, payment_mode: payment.payment_mode,
          total_amount: round(payment.actual_payment), status: 'Pending', remarks: payment.remarks, created_by: userId, created_on: now,
          modified_by: userId, modified_on: now, neft_no: payment.neft_no, upload_type: type
        }, t);
        for (const line of paymentLines(payment, type)) {
          await insertRow('payment_upload_items', { ...line, payment_id: paymentId }, t);
          lineCount++;
        }
        for (const item of payment.items) {
          sheet.getCell(`${format.invoice}${item.row_num}`).value = item.invoice_amount;
          sheet.getCell(`${format.balance}${item.row_num}`).value = item.final_amount;
        }
      }
      const checkFileName = `${stamp}_file_${fileId}_check${ext}`;
      await workbook.xlsx.writeFile(path.join(UPLOAD_PATH, checkFileName));
      await t.commit();
      const result = await finish('Pending', `Payments uploaded - ${payments.size} (${lineCount} lines from ${rows.length} rows). Approve the file to make them approved payments.`,
        { check_file_name: checkFileName });
      return { ...result, uploaded: payments.size };
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    // Let it be uploaded again
    await execute(`update payment_upload_files set status = 'Uploading', modified_on = :now where id = :fileId`, { now: new Date(), fileId });
    throw error;
  }
};

// ---------- Approve / Reject ----------

const validDate = (value) => (value instanceof Date && isNaN(value.getTime()) ? null : value);

// Old PHP approve_file_data: every pending payment of the file becomes an approved payment. Paytm and Razorpay get no
// credit / debit notes here (PHP: "Do Nothing"). All or nothing (PHP had no transaction).
export const approveOldPaymentUpload = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot approve payment uploads." });
    }
    const fileId = +req.params.id || 0;
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const file = await findFile(fileId, t, true);
      if (!file) {
        await t.rollback();
        return res.status(404).json({ message: "Payment upload not found!" });
      }
      if (file.status !== 'Pending') {
        await t.rollback();
        return res.status(422).json({ message: "Only a file waiting for approval (Pending) can be approved." });
      }
      const details = await select(`select * from payment_upload_details where status = 'Pending' and file_id = :fileId order by id for update`, { fileId }, t);
      if (!details.length) {
        await t.rollback();
        return res.status(422).json({ message: "No data found." });
      }
      const noNotes = ['PAYTM', 'RAZORPAY'].includes(text(file.upload_type).toUpperCase());
      let notes = 0;
      for (const detail of details) {
        const paymentId = await insertRow('payment_details', {
          date_of_deposit: toDate(detail.date_of_deposit), bank_id: detail.bank_id, payment_mode: detail.payment_mode,
          total_amount: detail.total_amount, status: 'Approved', remarks: detail.remarks, created_by: detail.created_by,
          created_on: detail.created_on, modified_by: detail.modified_by, modified_on: detail.modified_on,
          approved_by: userId, approved_on: now, distributor_out_id: detail.distributor_out_id, ref_id: detail.ref_id,
          modified_approved_date: detail.modified_approved_date, file_id: fileId, neft_no: detail.neft_no, upload_type: detail.upload_type
        }, t);
        const items = await select(`select * from payment_upload_items where payment_id = :id order by id`, { id: detail.id }, t);
        for (const item of items) {
          await insertRow('payment_details_items', {
            payment_id: paymentId, distributor_id: item.distributor_id, ref_no: item.ref_no, invoice_no: item.invoice_no,
            bank_name: item.bank_name, bank_city: item.bank_city, payment_amount: item.payment_amount, settlement_id: item.settlement_id,
            settlement_start_date: validDate(item.settlement_start_date), settlement_end_date: validDate(item.settlement_end_date),
            credit_debit: item.credit_debit, tax: item.tax, narration: item.narration, commission: item.commission, gst: item.gst,
            unique_ref_no: item.unique_ref_no
          }, t);
        }
        if (!noNotes) notes += await setCreditDebitNotes(paymentId, 'Approved', userId, t);
      }
      await execute(
        `update payment_upload_files set status = 'Approved', approved_by = :userId, approved_on = :now, modified_by = :userId, modified_on = :now where id = :fileId`,
        { userId, now, fileId }, t
      );
      await execute(`update payment_upload_details set status = 'Approved', approved_by = :userId, approved_on = :now where file_id = :fileId`, { userId, now, fileId }, t);
      await t.commit();
      res.status(200).json({
        message: `File approved. ${details.length} payment${details.length > 1 ? 's' : ''} created${notes ? `, ${notes} credit / debit note${notes > 1 ? 's' : ''}` : ''}.`,
        payments: details.length,
        notes
      });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Approving payment upload failed!";
    next(error, req, res);
  }
};

// Old PHP reject_file_data: the file and its payments are set aside as Rejected
export const rejectOldPaymentUpload = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot reject payment uploads." });
    }
    const fileId = +req.params.id || 0;
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const file = await findFile(fileId, t, true);
      if (!file) {
        await t.rollback();
        return res.status(404).json({ message: "Payment upload not found!" });
      }
      if (file.status !== 'Pending') {
        await t.rollback();
        return res.status(422).json({ message: "Only a file waiting for approval (Pending) can be rejected." });
      }
      await execute(
        `update payment_upload_files set status = 'Rejected', rejected_by = :userId, rejected_on = :now, modified_by = :userId, modified_on = :now where id = :fileId`,
        { userId, now, fileId }, t
      );
      await execute(`update payment_upload_details set status = 'Rejected', rejected_by = :userId, rejected_on = :now where file_id = :fileId`, { userId, now, fileId }, t);
      await t.commit();
      res.status(200).json({ message: "File rejected." });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Rejecting payment upload failed!";
    next(error, req, res);
  }
};

// ---------- Printouts ----------

const assetUrl = (req) => `${req.protocol}://${req.get('host')}/assets/invoice/`;

// Old PHP generate_payment_slip: the receipt vouchers of an approved file
export const getPaymentSlips = async (req, res, next) => {
  try {
    const fileId = +req.params.id || 0;
    const payments = await select(`select id from payment_details where status = 'Approved' and file_id = :fileId order by id`, { fileId });
    if (!payments.length) {
      return res.status(404).json({ message: "No approved payments found for this file." });
    }
    res.status(200).json({ html: await renderSlips(payments.map((row) => row.id), assetUrl(req), `Payment Upload ${fileId} - Receipt Vouchers`) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating payment slips failed!";
    next(error, req, res);
  }
};

// Old PHP generate_credit_debit_note: the credit / debit notes of an approved file
export const getCreditNotes = async (req, res, next) => {
  try {
    const fileId = +req.params.id || 0;
    const notes = await select(
      `select distinct A.id from credit_debit_note A join payment_details B on (A.payment_id = B.id)
       where A.status = 'Approved' and B.file_id = :fileId order by A.id`,
      { fileId }
    );
    if (!notes.length) {
      return res.status(404).json({ message: "No credit notes found for this file." });
    }
    res.status(200).json({ html: await renderNotes(notes.map((row) => row.id), assetUrl(req), `Payment Upload ${fileId} - Credit Notes`) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating credit notes failed!";
    next(error, req, res);
  }
};
