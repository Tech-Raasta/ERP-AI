import fs from 'fs';
import path from 'path';

import { DataTypes, QueryTypes, Op, fn, col, where } from 'sequelize';
import ExcelJS from 'exceljs';

import sequelize from '../lib/database.js';
import { getReportPath, getTemplatePath, getUploadPath, round } from '../lib/common.js';

import PaymentUploadDetail from './paymentUploadDetail.js';
import PaymentUploadItem from './paymentUploadItem.js';
import PaymentDetails from './paymentDetails.js';
import PaymentDetailsItem from './paymentDetailsItem.js';
import Distributor from './distributor.js';
import Sale from './sale.js';
import BankMaster from './bankMaster.js';
import CreditDebitNote from './creditDebitNote.js';
import User from './user.js';
import PaymentUploadExpense from './paymentUploadExpense.js';
import PaymentDetailsExpense from './paymentDetailsExpense.js';

PaymentDetailsItem.belongsTo(PaymentDetails, { foreignKey: 'payment_id', as: 'payment' });
PaymentDetailsExpense.belongsTo(PaymentDetails, { foreignKey: 'payment_id', as: 'payment' });
PaymentUploadItem.belongsTo(PaymentUploadDetail, { foreignKey: 'payment_id', as: 'upload' });
PaymentUploadExpense.belongsTo(PaymentUploadDetail, { foreignKey: 'payment_id', as: 'upload' });
PaymentDetails.belongsTo(BankMaster, { foreignKey: 'bank_id', as: 'bank' });
CreditDebitNote.belongsTo(PaymentDetails, { foreignKey: 'payment_id', as: 'payment' });

// Caches to avoid repeated DB hits inside row loops
const bankCache = new Map();
const distributorCache = new Map();
const uniqueRefCache = new Map();
const invoiceExistsCache = new Map();
const balRowsCache = new Map();

const PaymentUpload = sequelize.define('payment_upload_files', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  upload_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: { notNull: true }
  },
  file_name: DataTypes.STRING,
  file_path: DataTypes.STRING,
  error_file_name: DataTypes.STRING,
  error_file_path: DataTypes.STRING,
  check_file_name: DataTypes.STRING,
  check_file_path: DataTypes.STRING,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  upload_type: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE
},
{
  timestamps: true,
  freezeTableName: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on'
});

PaymentUpload.hasMany(PaymentUploadDetail, { foreignKey: 'file_id', as: 'details', onDelete: 'CASCADE' });
PaymentUploadDetail.belongsTo(PaymentUpload, { foreignKey: 'file_id', as: 'file' });

// --- Helpers (PHP parity) ---

// PHP validateDate($strDate, $format). Supports the formats this controller uses:
// 'd-m-Y', 'd/m/Y', 'd-M-Y', 'Y-m-d'.
const validateDate = (strDate, format) => {
  if (!strDate || typeof strDate !== 'string') return null;
  const months3 = { JAN:1, FEB:2, MAR:3, APR:4, MAY:5, JUN:6, JUL:7, AUG:8, SEP:9, OCT:10, NOV:11, DEC:12 };
  let d, m, y;
  if (format === 'd-m-Y' || format === 'd/m/Y') {
    const sep = format.indexOf('-') !== -1 ? '-' : '/';
    const parts = strDate.split(sep);
    if (parts.length !== 3) return null;
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    y = parseInt(parts[2], 10);
  } else if (format === 'd-M-Y') {
    const parts = strDate.split('-');
    if (parts.length !== 3) return null;
    d = parseInt(parts[0], 10);
    m = months3[(parts[1] || '').toUpperCase()];
    y = parseInt(parts[2], 10);
  } else if (format === 'Y-m-d') {
    const parts = strDate.split('-');
    if (parts.length !== 3) return null;
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    d = parseInt(parts[2], 10);
  } else {
    return null;
  }
  if (!d || !m || !y) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  const yyyy = String(y).padStart(4, '0');
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const safeNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const stripQuotes = (v) => {
  if (v === null || v === undefined) return '';
  return String(v).replace(/'/g, '');
};

const cellValue = (worksheet, addr) => {
  const cell = worksheet.getCell(addr);
  if (cell == null || cell.value == null) return '';
  if (typeof cell.value === 'object') {
    if (cell.value.result !== undefined) return cell.value.result;
    if (cell.value.text !== undefined) return cell.value.text;
    if (cell.value.richText) return cell.value.richText.map(r => r.text).join('');
    if (cell.value instanceof Date) return cell.value;
  }
  return cell.value;
};

const cellText = (worksheet, addr) => {
  const v = cellValue(worksheet, addr);
  if (v == null) return '';
  if (v instanceof Date) {
    const dd = String(v.getUTCDate()).padStart(2, '0');
    const mm = String(v.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = String(v.getUTCFullYear());
    return `${dd}-${mm}-${yyyy}`;
  }
  return String(v).trim();
};

// --- Instance: prepare upload row before save ---
PaymentUpload.prototype.getRequestData = function(req) {
  try {
    this.upload_date = new Date().toISOString().substring(0, 10);
    this.file_name = '';
    this.check_file_name = '';
    this.upload_type = req.body && req.body.upload_type ? req.body.upload_type : '';
    return null;
  } catch (error) {
    return error;
  }
};

PaymentUpload.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, err => err);
    return error || null;
  } catch (error) {
    return error;
  }
};

// --- Download upload format (mirrors PHP download_upload_format) ---
PaymentUpload.prototype.getUploadFormat = async function() {
  try {
    const template = path.join(getTemplatePath(), 'Payment_upload_format.xlsx');
    if (!fs.existsSync(template)) return 'Template not found.';

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(template);
    const sheet2 = workbook.getWorksheet(2);

    const banks = await BankMaster.findAll({
      where: { status: 'Approved' },
      order: [['b_name', 'ASC']],
      attributes: ['b_name'],
      raw: true
    });
    let row = 2;
    for (const b of banks) sheet2.getCell(`A${row++}`).value = b.b_name;
    const bankCnt = row;

    sheet2.getCell('C2').value = 'Cash';
    sheet2.getCell('C3').value = 'Cheque';
    sheet2.getCell('C4').value = 'NEFT';
    const paymentModeCnt = 5;

    const distributors = await Distributor.findAll({
      where: { status: 'Approved' },
      order: [['distributor_name', 'ASC']],
      attributes: ['distributor_name'],
      raw: true
    });
    row = 2;
    for (const d of distributors) sheet2.getCell(`E${row++}`).value = d.distributor_name;
    const distCnt = row;

    sheet2.getCell('G2').value = 'Yes';
    sheet2.getCell('G3').value = 'No';
    const creditDebitCnt = 4;

    sheet2.getCell('I2').value = 'Yes';
    sheet2.getCell('I3').value = 'No';
    const taxCnt = 4;

    const sheet1 = workbook.getWorksheet(1);
    for (let r = 5; r <= 105; r++) {
      sheet1.getCell(`B${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Sheet2!$A$2:$A$${bankCnt - 1}`], showInputMessage: true, showErrorMessage: true };
      sheet1.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Sheet2!$C$2:$C$${paymentModeCnt - 1}`], showInputMessage: true, showErrorMessage: true };
      sheet1.getCell(`D${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Sheet2!$E$2:$E$${distCnt - 1}`], showInputMessage: true, showErrorMessage: true };
      // sheet1.getCell(`I${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Sheet2!$G$2:$G$${creditDebitCnt - 1}`], showInputMessage: true, showErrorMessage: true };
      // sheet1.getCell(`J${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Sheet2!$I$2:$I$${taxCnt - 1}`], showInputMessage: true, showErrorMessage: true };
    }
    sheet2.state = 'hidden';

    const fileName = `payment_upload_format_${Date.now()}.xlsx`;
    const filePath = path.join(getReportPath(), fileName);
    await workbook.xlsx.writeFile(filePath);
    return fileName;
  } catch (error) {
    return error;
  }
};

// --- Per-row Excel parsers for each upload_type ---
const parseRow = (worksheet, i, upload_type) => {
  let creation_date = '', bank = '', payment_mode = '', distributor_name = '', invoice_no = '',
      neft_no = '', payment_amount = '', remarks = '', credit_debit = '', tax = '', narration = '',
      commission = 0, gst = 0, unique_ref_no = '', transaction = '', actual_payment = 0;

  if (upload_type === 'Paytm') {
    creation_date = cellText(worksheet, `V${i}`);
    bank = 'HDFC Bank'; payment_mode = 'NEFT'; distributor_name = 'EATAnytime Direct - Paytm';
    neft_no = stripQuotes(cellValue(worksheet, `T${i}`));
    payment_amount = stripQuotes(cellValue(worksheet, `N${i}`));
    credit_debit = 'Yes'; tax = 'Yes';
    commission = stripQuotes(cellValue(worksheet, `O${i}`));
    gst = stripQuotes(cellValue(worksheet, `P${i}`));
    unique_ref_no = stripQuotes(cellValue(worksheet, `B${i}`));
    transaction = stripQuotes(cellValue(worksheet, `F${i}`));
    actual_payment = stripQuotes(cellValue(worksheet, `AA${i}`));
  } else if (upload_type === 'Razorpay') {
    creation_date = cellText(worksheet, `Y${i}`);
    bank = 'HDFC Bank'; payment_mode = 'NEFT'; distributor_name = 'EATAnytime Direct - Razorpay';
    neft_no = cellValue(worksheet, `X${i}`);
    payment_amount = cellValue(worksheet, `C${i}`);
    credit_debit = 'Yes'; tax = 'Yes';
    commission = cellValue(worksheet, `E${i}`);
    gst = cellValue(worksheet, `F${i}`);
    unique_ref_no = cellValue(worksheet, `S${i}`);
    transaction = cellValue(worksheet, `A${i}`);
    actual_payment = cellValue(worksheet, `H${i}`);

    const tx = String(transaction || '').trim().toUpperCase();
    if (tx === 'REFUND' || tx === 'TRANSFER') {
      actual_payment = cellValue(worksheet, `G${i}`);
      commission = safeNumber(commission);
      gst = safeNumber(gst);
      actual_payment = safeNumber(actual_payment);
      payment_amount = actual_payment - commission - gst;
    }
    if (tx === 'TRANSFER') narration = 'Kalandari Transfer';
  } else if (upload_type === 'Shiprocket') {
    creation_date = cellText(worksheet, `G${i}`);
    bank = 'HDFC Bank'; payment_mode = 'NEFT'; distributor_name = 'EAT Anytime Direct-COD';
    neft_no = cellValue(worksheet, `H${i}`);
    payment_amount = cellValue(worksheet, `F${i}`);
    credit_debit = 'No'; tax = 'No';
    commission = 0; gst = 0;
    unique_ref_no = '#' + (cellValue(worksheet, `D${i}`) || '');
    transaction = '';
    actual_payment = cellValue(worksheet, `F${i}`);

    payment_amount = safeNumber(payment_amount);
    if (payment_amount < 0) {
      invoice_no = 'On Account';
      credit_debit = 'Yes';
      unique_ref_no = '';
      transaction = 'REFUND';
    }
    creation_date = (creation_date || '').toString().trim();
  } else if (upload_type === 'Sodexo') {
    creation_date = cellText(worksheet, `AB${i}`);
    bank = 'HDFC Bank'; payment_mode = 'NEFT'; distributor_name = 'EATAnytime Direct - Sodexo';
    neft_no = cellValue(worksheet, `AC${i}`);
    payment_amount = cellValue(worksheet, `Q${i}`);
    credit_debit = 'Yes'; tax = 'Yes';
    commission = cellValue(worksheet, `AE${i}`);
    const mgst = safeNumber(cellValue(worksheet, `AG${i}`));
    const cgst = safeNumber(cellValue(worksheet, `AH${i}`));
    const igst = safeNumber(cellValue(worksheet, `AI${i}`));
    gst = mgst + cgst + igst;
    let uref = cellValue(worksheet, `AT${i}`);
    if (typeof uref === 'string' && uref.indexOf('-') !== -1) {
      uref = uref.substring(0, uref.indexOf('-'));
    }
    unique_ref_no = '#' + (uref || '');
    transaction = 'REFUND';
    actual_payment = cellValue(worksheet, `AA${i}`);
  } else {
    creation_date = cellValue(worksheet, `A${i}`);
    bank = cellText(worksheet, `B${i}`);
    payment_mode = cellText(worksheet, `C${i}`);
    distributor_name = cellText(worksheet, `D${i}`);
    invoice_no = cellText(worksheet, `E${i}`);
    neft_no = cellValue(worksheet, `F${i}`);
    payment_amount = cellValue(worksheet, `G${i}`);
    remarks = cellText(worksheet, `H${i}`);
    credit_debit = cellText(worksheet, `I${i}`);
    tax = cellText(worksheet, `J${i}`);
    narration = cellText(worksheet, `K${i}`);
    actual_payment = cellValue(worksheet, `G${i}`);
  }

  return { creation_date, bank, payment_mode, distributor_name, invoice_no, neft_no,
    payment_amount, remarks, credit_debit, tax, narration, commission, gst,
    unique_ref_no, transaction, actual_payment };
};


// Save file before validation to ensure it's available for error reporting, and kick off background processing
PaymentUpload.prototype.saveFileInfo = async function(req) {
  const uploadPath = path.join(getUploadPath(), 'payment_upload');
  if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

  const fileName = req.files.doc_document[0].filename;
  const filePath = path.join(uploadPath, fileName);

  if (!fs.existsSync(filePath)) {
    this.file_name = fileName;
    this.file_path = uploadPath + path.sep;
    this.status    = 'Failed';
    this.remarks   = 'File Not Found.';
    throw new Error('File not found.');
  }

  // ✅ File exists — store name and path so list shows it immediately
  this.file_name = fileName;
  this.file_path = uploadPath + path.sep;
  this.status    = 'Queued';
};

PaymentUpload.prototype.uploadFileData = async function(req) {
  this.status = 'Processing';
  await this.save();

  const uploadPath = this.file_path;
  const fileName   = this.file_name;
  const filePath   = path.join(uploadPath, fileName);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1);

  const remarks_col = 'AE';
  const inv_amt_col = 'AF';
  const bal_amt_col = 'AG';
  const start_row   = 5;

  worksheet.getCell(`${remarks_col}${start_row - 1}`).value = 'Error Remark';
  worksheet.getColumn(remarks_col).width = 30;

  const highestRow = worksheet.rowCount;

  const cellVal = (col, rowNum) => {
    const cell = worksheet.getCell(`${col}${rowNum}`);
    const v = cell.value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && v.result !== undefined) return v.result;
    return v;
  };

  // ── PHASE 1: Read all rows into memory (no DB calls) ─────────────────────
  const rawRows = [];
  for (let i = start_row; i <= highestRow; i++) {
    rawRows.push({
      rowNum: i,
      creation_date:    cellVal('A', i),
      bank:             String(cellVal('B', i) ?? '').trim(),
      payment_mode:     String(cellVal('C', i) ?? '').trim(),
      distributor_name: String(cellVal('D', i) ?? '').trim(),
      order_no:         String(cellVal('E', i) ?? '').trim().replace(/["']/g, ''),
      neft_no:          String(cellVal('F', i) ?? '').trim(),
      invoice_amount:   cellVal('G', i),
      commission:       cellVal('H', i) ?? 0,
      listing_fees:     cellVal('I', i) ?? 0,
      shipping:         cellVal('J', i) ?? 0,
      omc_cost:         cellVal('K', i) ?? 0,
      marketplace_fees: cellVal('L', i) ?? 0,
      storage_fees:     cellVal('M', i) ?? 0,
      unicommerce_charge:       cellVal('N', i) ?? 0,
      adtech_charges:           cellVal('O', i) ?? 0,
      cred_rewards_adjustment:  cellVal('P', i) ?? 0,
      cred_pay_adjustment:      cellVal('Q', i) ?? 0,
      cost_of_advertising:      cellVal('R', i) ?? 0,
      tcs_igst:         cellVal('S', i) ?? 0,
      tcs_sgst:         cellVal('T', i) ?? 0,
      tcs_cgst:         cellVal('U', i) ?? 0,
      tds:              cellVal('V', i) ?? 0,
      other_adjustment: cellVal('W', i) ?? 0,
      debt_adjustment:  cellVal('X', i) ?? 0,
      tds_claims:       cellVal('Y', i) ?? 0,
      lost_damage_inventory: cellVal('Z', i) ?? 0,
      credit_debit_note:    cellVal('AA', i) ?? 0,
      payment_amount:   cellVal('AB', i),
      remarks:          String(cellVal('AC', i) ?? '').trim(),
      narration:        String(cellVal('AD', i) ?? '').trim(),
    });
  }

  // ── PHASE 2: Pre-load ALL lookup data in 5 queries total ─────────────────

  // 2a. All banks
  const allBanks = await BankMaster.findAll({ attributes: ['id', 'b_name'], raw: true });
  const bankMap  = new Map(allBanks.map(b => [b.b_name, b.id]));

  // 2b. All distributors
  const allDists = await Distributor.findAll({ attributes: ['id', 'distributor_name'], raw: true });
  const distMap  = new Map(allDists.map(d => [d.distributor_name, d.id]));

  // 2c. All sales for order numbers in this file
  const orderNos = [...new Set(
    rawRows.map(r => r.order_no).filter(o => o && o !== 'On Account')
  )];
  const allSales = await Sale.findAll({
    where: { order_no: orderNos, status: 'Approved' },
    attributes: ['id', 'invoice_no', 'invoice_amount', 'order_no', 'distributor_id'],
    raw: true
  });
  const saleMap = new Map(allSales.map(s => [s.order_no, s]));

  // 2d. All approved payment totals for those invoices
  const invoiceNos = [...new Set(allSales.map(s => s.invoice_no))];
  const approvedTotals = invoiceNos.length ? await PaymentDetailsItem.findAll({
    attributes: ['invoice_no', [fn('sum', col('payment_amount')), 'total']],
    where: { invoice_no: invoiceNos },
    include: [{ model: PaymentDetails, as: 'payment', where: { status: 'Approved' }, attributes: [] }],
    group: ['invoice_no'],
    raw: true
  }) : [];
  const approvedMap = new Map(approvedTotals.map(r => [r.invoice_no, safeNumber(r.total)]));

  // 2e. All pending upload totals from other files for those invoices
  const uploadTotals = invoiceNos.length ? await PaymentUploadItem.findAll({
    attributes: ['invoice_no', [fn('sum', col('payment_amount')), 'total']],
    where: { invoice_no: invoiceNos },
    include: [{
      model: PaymentUploadDetail, as: 'upload',
      where: {
        file_id: { [Op.ne]: this.id },
        [Op.or]: [{ status: { [Op.notIn]: ['Rejected', 'InActive'] } }, { status: null }]
      },
      attributes: []
    }],
    group: ['invoice_no'],
    raw: true
  }) : [];
  const uploadMap = new Map(uploadTotals.map(r => [r.invoice_no, safeNumber(r.total)]));

  // ── PHASE 3: Validate all rows using in-memory maps (zero DB calls) ───────
  let objError    = 0;
  const payment_array = [];

  for (const row of rawRows) {
    let { rowNum, creation_date, bank, payment_mode, distributor_name,
          order_no, neft_no, invoice_amount, payment_amount } = row;
    let error = '';
    let blRowErr = false;
    let bank_id = 0, distributor_id = 0;
    let invoice_no = '', balance_amount = 0, final_amount = 0;

    // 1. Date
    if (!creation_date) {
      error += 'Creation date cannot be blank.';
      blRowErr = true;
    } else {
      const dt = creation_date instanceof Date ? creation_date : new Date(creation_date);
      if (isNaN(dt.getTime())) {
        error += 'Creation date should be in d-m-Y format.';
        blRowErr = true;
      } else {
        creation_date = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
      }
    }

    // 2. Bank — map lookup, no DB call
    if (!bank) {
      error += 'Bank Name cannot be blank.';
      blRowErr = true;
    } else if (!bankMap.has(bank)) {
      error += `Bank Name ${bank} not found.`;
      blRowErr = true;
    } else {
      bank_id = bankMap.get(bank);
    }

    // 3. Payment mode
    if (!payment_mode) {
      error += 'Payment Mode cannot be blank.';
      blRowErr = true;
    } else if (!['Cash', 'Cheque', 'NEFT'].includes(payment_mode)) {
      error += 'Payment Mode should be Cash, Cheque or NEFT.';
      blRowErr = true;
    }

    // 4. Distributor — map lookup, no DB call
    if (!distributor_name) {
      error += 'Distributor Name cannot be blank.';
      blRowErr = true;
    } else if (!distMap.has(distributor_name)) {
      error += `Distributor Name ${distributor_name} not found.`;
      blRowErr = true;
    } else {
      distributor_id = distMap.get(distributor_name);
    }

    // 5. Order number — map lookup, no DB call
    if (!order_no) {
      error += 'Order No cannot be blank.';
      blRowErr = true;
    } else if (order_no !== 'On Account') {
      const sale = saleMap.get(order_no);
      if (!sale) {
        error += `Order No ${order_no} Not Found.`;
        blRowErr = true;
      } else {
        invoice_no     = sale.invoice_no;
        const approved = approvedMap.get(invoice_no) ?? 0;
        const pending  = uploadMap.get(invoice_no)   ?? 0;
        invoice_amount = safeNumber(invoice_amount);
        balance_amount = invoice_amount - approved;
        final_amount   = invoice_amount - approved - pending - safeNumber(payment_amount);
      }
    }

    // 6. NEFT
    if (payment_mode === 'NEFT' && !neft_no) {
      error += 'NEFT No cannot be blank.';
      blRowErr = true;
    }

    // 7. Payment amount
    if (payment_amount === '' || payment_amount === null || payment_amount === undefined) {
      error += 'Payment Amount cannot be blank.';
      blRowErr = true;
    } else if (safeNumber(payment_amount) === 0) {
      error += 'Payment Amount should be greater than zero.';
      blRowErr = true;
    } else if (safeNumber(payment_amount) > invoice_amount) {
      error += 'Payment Amount should not exceed Invoice Amount.';
      blRowErr = true;
    }

    if (error) {
      objError = 1;
      const cell = worksheet.getCell(`${remarks_col}${rowNum}`);
      cell.value = error;
      cell.alignment = { wrapText: true };
    }

    if (blRowErr) continue;

    // Group valid rows
    const pay_amount = safeNumber(payment_amount);
    let groupIdx = payment_array.findIndex(p =>
      p.date_of_deposit === creation_date &&
      p.bank_id         === bank_id       &&
      p.payment_mode    === payment_mode  &&
      p.neft_no         === neft_no
    );
    if (groupIdx === -1) {
      groupIdx = payment_array.length;
      payment_array.push({
        date_of_deposit: creation_date, bank_id, payment_mode,
        remarks: row.remarks, total_amount: 0, neft_no, actual_payment: 0, items: []
      });
    }
    payment_array[groupIdx].items.push({
      ...row, distributor_id, invoice_no, invoice_amount,
      balance_amount, final_amount, payment_amount: pay_amount, row_num: rowNum, tax: 0
    });
    payment_array[groupIdx].total_amount   += pay_amount;
    payment_array[groupIdx].actual_payment += pay_amount;
  }

  // ── Error path ────────────────────────────────────────────────────────────
  const ext = path.extname(fileName) || '.xlsx';
  if (objError === 1) {
    const error_file_name = `${Date.now()}_file_${this.id}_error${ext}`;
    await workbook.xlsx.writeFile(path.join(uploadPath, error_file_name));
    this.error_file_name = error_file_name;
    this.error_file_path = uploadPath + path.sep;
    this.status  = 'Error';
    this.remarks = `Please check - ${error_file_name} file for errors.`;
    return null;
  }

  // ── Write inv/bal columns back to sheet ───────────────────────────────────
  worksheet.getCell(`${inv_amt_col}${start_row - 1}`).value = 'Inv Amount';
  worksheet.getCell(`${bal_amt_col}${start_row - 1}`).value = 'Bal Amount';
  for (const group of payment_array) {
    for (const it of group.items) {
      worksheet.getCell(`${inv_amt_col}${it.row_num}`).value = it.invoice_amount;
      worksheet.getCell(`${bal_amt_col}${it.row_num}`).value = it.final_amount;
    }
  }

  // ── PHASE 4: Bulk insert in chunks of 500 ────────────────────────────────
  const CHUNK = 500;
  let success_cnt = 0, fail_cnt = 0;
  const curusr = req.userData?.userId ?? null;

  for (const group of payment_array) {
    const t = await sequelize.transaction();
    try {
      const detail = await PaymentUploadDetail.create({
        file_id: this.id, date_of_deposit: group.date_of_deposit,
        bank_id: group.bank_id, payment_mode: group.payment_mode,
        total_amount: Math.round(parseFloat(group.actual_payment) * 100) / 100, status: 'Pending',
        remarks: group.remarks, created_by: curusr, modified_by: curusr,
        neft_no: group.neft_no, upload_type: 'Normal'
      }, { transaction: t });

      // Insert items in chunks
      for (let i = 0; i < group.items.length; i += CHUNK) {
        const chunk = group.items.slice(i, i + CHUNK);

        const createdItems = await PaymentUploadItem.bulkCreate(
          chunk.map(it => ({
            payment_id: detail.id, distributor_id: it.distributor_id,
            ref_no: it.neft_no, invoice_no: it.invoice_no,
            payment_amount: it.payment_amount, credit_debit_note: it.credit_debit_note,
            tax: it.tax, narration: it.narration,
            commission: 0, gst: 0, unique_ref_no: ''
          })),
          { transaction: t, returning: true }  // returning:true gives back IDs
        );

        await PaymentUploadExpense.bulkCreate(
          createdItems.map((item, idx) => {
            const it = chunk[idx];
            const n  = v => (v !== '' && v !== null && v !== undefined) ? v : 0;
            return {
              payment_id: detail.id, item_id: item.id,
              invoice_amount: n(it.invoice_amount), payment_amount: n(it.payment_amount),
              commission: n(it.commission),          listing_fees: n(it.listing_fees),
              shipping: n(it.shipping),              omc_cost: n(it.omc_cost),
              marketplace_fees: n(it.marketplace_fees), storage_fees: n(it.storage_fees),
              unicommerce_charge: n(it.unicommerce_charge), adtech_charges: n(it.adtech_charges),
              cred_rewards_adjustment: n(it.cred_rewards_adjustment),
              cred_pay_adjustment: n(it.cred_pay_adjustment),
              cost_of_advertising: n(it.cost_of_advertising),
              tcs_igst: n(it.tcs_igst), tcs_sgst: n(it.tcs_sgst), tcs_cgst: n(it.tcs_cgst),
              tds: n(it.tds), other_adjustment: n(it.other_adjustment),
              debt_adjustment: n(it.debt_adjustment), tds_claims: n(it.tds_claims),
              lost_damage_inventory: n(it.lost_damage_inventory),
              credit_debit_note: n(it.credit_debit_note),
            };
          }),
          { transaction: t }
        );

        success_cnt += chunk.length;
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      fail_cnt += group.items.length;
    }
  }

  // ── Save check file ───────────────────────────────────────────────────────
  const check_file_name = `${Date.now()}_file_${this.id}_check${ext}`;
  await workbook.xlsx.writeFile(path.join(uploadPath, check_file_name));
  this.check_file_name = check_file_name;
  this.check_file_path = uploadPath + path.sep;
  this.status  = 'Pending';
  this.remarks = `No of records uploaded - ${success_cnt}. No of records failed - ${fail_cnt}.`;
  return null;
};

// --- Approve (mirrors PHP approve_file_data) ---
PaymentUpload.prototype.approve = async function(req) {
  const t = await sequelize.transaction();
  try {
    const file_id = this.id;
    const curusr = req.userData.userId;
    const now = new Date();
    const upload_type = this.upload_type || '';

    const pendingDetails = await PaymentUploadDetail.findAll({
      where: { status: 'Pending', file_id }, transaction: t
    });

    for (const d of pendingDetails) {
      const payment = await PaymentDetails.create({
        date_of_deposit: d.date_of_deposit,
        bank_id: d.bank_id,
        payment_mode: d.payment_mode,
        total_amount: d.total_amount,
        status: 'Approved',
        remarks: d.remarks,
        created_by: d.created_by,
        created_on: d.created_on,
        modified_by: d.modified_by,
        modified_on: d.modified_on,
        approved_by: curusr,
        approved_on: now,
        file_id,
        neft_no: d.neft_no,
        upload_type: d.upload_type
      }, { transaction: t });
      const payment_id = payment.id;

      // Copy upload items into payment details items via Sequelize models
      const uploadItems = await PaymentUploadItem.findAll({
        where: { payment_id: d.id },
        transaction: t,
        raw: true
      });

      let paymentDetailsItem = [];
      if (uploadItems && uploadItems.length > 0) {
        const paymentDetailsItems = uploadItems.map(item => ({
          payment_id,
          distributor_id: item.distributor_id,
          ref_no: item.ref_no,
          invoice_no: item.invoice_no,
          bank_name: item.bank_name,
          bank_city: item.bank_city,
          payment_amount: item.payment_amount,
          settlement_id: item.settlement_id,
          settlement_start_date: item.settlement_start_date,
          settlement_end_date: item.settlement_end_date,
          credit_debit: item.credit_debit,
          tax: item.tax,
          narration: item.narration,
          commission: item.commission,
          gst: item.gst,
          unique_ref_no: item.unique_ref_no,
          credit_debit_note:item.credit_debit_note,
        }));
        paymentDetailsItem = await PaymentDetailsItem.bulkCreate(paymentDetailsItems, { transaction: t });

        // ---- Create credit_debit_note entries when credit_debit = 'Yes' ----
        for (const item of uploadItems) {
          if (item.credit_debit_note && item.credit_debit_note !== 0) {
            const distributor = await Sale.findOne({
              where: { distributor_id: item.distributor_id, invoice_no: item.invoice_no },
              attributes: ['invoice_amount'],
              raw: true
            });
            // const creditDebitAmount = safeNumber(distributor.invoice_amount || 0) - safeNumber(item.payment_amount);
            const creditDebitAmount = safeNumber(item.credit_debit_note);
            const itemTax = item.tax ? (String(item.tax).trim().toUpperCase() === 'YES' ? 1 : 0) : 0;
            
            // Create credit_debit_note entry
            await CreditDebitNote.create({
              date_of_transaction: d.date_of_deposit,
              payment_id,
              distributor_id: item.distributor_id,
              transaction: 'Credit Note',
              invoice_no: item.invoice_no || 'On Account',
              amount: creditDebitAmount,
              tax: itemTax,
              igst:0, 
              cgst:0, 
              sgst:0,
              status: 'Approved',
              remarks: item.narration || '',
              created_by: curusr,
              created_on: now,
              modified_by: curusr,
              modified_on: now,
              approved_by: curusr,
              approved_on: now,
              ref_no: item.ref_no
            }, { transaction: t });
          }
        }
      }

      // Copy upload expenses into payment details expenses via Sequelize models
      const uploadExpenses = await PaymentUploadExpense.findAll({
        where: { payment_id: d.id },
        transaction: t,
        raw: true
      });

      if (uploadExpenses && uploadExpenses.length > 0) {
        const paymentDetailsExpenses = uploadExpenses.map((item, index) => ({
          payment_id,
          item_id: paymentDetailsItem[index].id,
          invoice_amount: item.invoice_amount,
          payment_amount: item.payment_amount,
          commission: item.commission,
          listing_fees: item.listing_fees,
          shipping: item.shipping,
          omc_cost: item.omc_cost,
          marketplace_fees: item.marketplace_fees,
          storage_fees: item.storage_fees,
          unicommerce_charge: item.unicommerce_charge,
          adtech_charges: item.adtech_charges,
          cred_rewards_adjustment: item.cred_rewards_adjustment,
          cred_pay_adjustment: item.cred_pay_adjustment,
          cost_of_advertising: item.cost_of_advertising,
          tcs_igst: item.tcs_igst,
          tcs_sgst: item.tcs_sgst,
          tcs_cgst: item.tcs_cgst,
          tds: item.tds,
          other_adjustment: item.other_adjustment,
          debt_adjustment: item.debt_adjustment,
          tds_claims: item.tds_claims,
          lost_damage_inventory: item.lost_damage_inventory,
          credit_debit_note: item.credit_debit_note,
        }));
        await PaymentDetailsExpense.bulkCreate(paymentDetailsExpenses, { transaction: t });
      }

      // PHP: for non-Paytm/Razorpay, calls payment_model->generate_credit_debit_note($id, 'Approved').
      // That generator lives in Payment_model.php (out of scope here).
      // Hook left intentionally; implement when Node Payment model is ported.
    }

    await PaymentUpload.update(
      { status: 'Approved', approved_by: curusr, approved_on: now },
      { where: { id: file_id }, transaction: t }
    );
    await PaymentUploadDetail.update(
      { status: 'Approved', approved_by: curusr, approved_on: now },
      { where: { file_id }, transaction: t }
    );

    this.status = 'Approved';
    this.approved_by = curusr;
    this.approved_on = now;

    await t.commit();
    return null;
  } catch (error) {
    await t.rollback();
    return error;
  }
};

// --- Reject (mirrors PHP reject_file_data) ---
PaymentUpload.prototype.reject = async function(req) {
  const t = await sequelize.transaction();
  try {
    const curusr = req.userData.userId;
    const now = new Date();

    await PaymentUpload.update(
      { status: 'Rejected', rejected_by: curusr, rejected_on: now },
      { where: { id: this.id }, transaction: t }
    );
    await PaymentUploadDetail.update(
      { status: 'Rejected', rejected_by: curusr, rejected_on: now },
      { where: { file_id: this.id }, transaction: t }
    );

    this.status = 'Rejected';
    this.rejected_by = curusr;
    this.rejected_on = now;

    await t.commit();
    return null;
  } catch (error) {
    await t.rollback();
    return error;
  }
};

// --- Generate payment slip data (PHP generate_payment_slip) ---
// Returns assembled JSON; rendering (HTML/PDF) is the caller's concern.
PaymentUpload.prototype.generatePaymentSlip = async function() {
  const file_id = this.id;
  const ids = await PaymentDetails.findAll({
    where: { status: 'Approved', file_id },
    attributes: ['id'],
    order: [['id', 'ASC']],
    raw: true
  });

  const final_data = [];
  for (const { id } of ids) {
    const header = await PaymentDetails.findByPk(id, {
      include: [{ model: BankMaster, as: 'bank', attributes: ['b_name', 'b_branch'] }]
    });
    if (!header) continue;
    const h = header.get({ plain: true });
    const total_amount = round(safeNumber(h.total_amount), 2);
    const date_of_deposit = h.date_of_deposit
      ? (h.date_of_deposit instanceof Date ? h.date_of_deposit.toISOString().slice(0, 10) : String(h.date_of_deposit).slice(0, 10))
      : '';

    const y1 = date_of_deposit ? date_of_deposit.charAt(0) : '';
    const y2 = date_of_deposit ? date_of_deposit.charAt(1) : '';
    const y3 = date_of_deposit ? date_of_deposit.charAt(2) : '';
    const y4 = date_of_deposit ? date_of_deposit.charAt(3) : '';
    const m1 = date_of_deposit ? date_of_deposit.charAt(5) : '';
    const m2 = date_of_deposit ? date_of_deposit.charAt(6) : '';
    const d1 = date_of_deposit ? date_of_deposit.charAt(8) : '';
    const d2 = date_of_deposit ? date_of_deposit.charAt(9) : '';

    const itemsRaw = await PaymentDetailsItem.findAll({ where: { payment_id: id }, raw: true });
    const items = itemsRaw.map(item => ({
      payment_mode: h.payment_mode,
      date_of_deposit: h.date_of_deposit,
      cheque_no: h.payment_mode === 'Cash' ? null : item.ref_no,
      id: item.id,
      payment_id: item.payment_id,
      ref_no: item.ref_no,
      bank_name: h.payment_mode === 'Cheque' ? item.bank_name : null,
      bank_city: h.payment_mode === 'Cheque' ? item.bank_city : null,
      invoice_no: item.invoice_no,
      payment_amount: item.payment_amount,
      status: h.status,
      remarks: h.remarks,
      created_by: h.created_by,
      created_on: h.created_on,
      modified_by: h.modified_by,
      modified_on: h.modified_on,
      approved_by: h.approved_by,
      approved_on: h.approved_on,
      rejected_by: h.rejected_by,
      rejected_on: h.rejected_on
    }));

    const distributorIds = [...new Set(itemsRaw.map(item => item.distributor_id).filter(Boolean))];
    const distributorRows = distributorIds.length > 0
      ? await Distributor.findAll({ where: { id: distributorIds }, attributes: ['id', 'distributor_name'], raw: true })
      : [];
    const distributorMap = distributorRows.reduce((map, row) => {
      map[row.id] = row.distributor_name;
      return map;
    }, {});
    const distributor = itemsRaw.map(item => ({
      ...item,
      distributor_name: distributorMap[item.distributor_id] || ''
    }));

    final_data.push({
      id, total_amount, date_of_deposit,
      // convert_number_to_words helper not yet ported — caller can format.
      total_amount_in_words: '',
      b_name: h.bank?.b_name || '', b_branch: h.bank?.b_branch || '',
      createdby: h.created_by, modifiedby: h.modified_by, approvedby: h.approved_by,
      approved_on: h.approved_on, modified_on: h.modified_on, created_on: h.created_on,
      y1, y2, y3, y4, m1, m2, d1, d2,
      items, distributor
    });
  }

  return final_data;
};

// --- Generate credit/debit note data (PHP generate_credit_debit_note) ---
PaymentUpload.prototype.generateCreditDebitNote = async function() {
  const file_id = this.id;
  const ids = await CreditDebitNote.findAll({
    attributes: ['id'],
    where: { status: 'Approved' },
    include: [{
      model: PaymentDetails,
      as: 'payment',
      where: { file_id },
      attributes: []
    }],
    order: [['id', 'ASC']],
    raw: true
  });

  const final_data = [];
  for (const { id } of ids) {
    const creditNote = await CreditDebitNote.findByPk(id, { raw: true });
    if (!creditNote) continue;

    const createdUser = creditNote.created_by ? await User.findByPk(creditNote.created_by, { attributes: ['first_name', 'last_name'], raw: true }) : null;
    const modifiedUser = creditNote.modified_by ? await User.findByPk(creditNote.modified_by, { attributes: ['first_name', 'last_name'], raw: true }) : null;
    const approvedUser = creditNote.approved_by ? await User.findByPk(creditNote.approved_by, { attributes: ['first_name', 'last_name'], raw: true }) : null;

    const row = {
      ...creditNote,
      createdby: createdUser ? `${createdUser.first_name || ''} ${createdUser.last_name || ''}`.trim() : '',
      modifiedby: modifiedUser ? `${modifiedUser.first_name || ''} ${modifiedUser.last_name || ''}`.trim() : '',
      approvedby: approvedUser ? `${approvedUser.first_name || ''} ${approvedUser.last_name || ''}`.trim() : ''
    };

    const d = await Distributor.findByPk(row.distributor_id, { raw: true }) || {};
    const address = [d.address, d.city, d.pincode, d.state, d.country].filter(Boolean).join(', ');

    final_data.push({
      credit_debit_note: [row],
      total_amount_in_words: '', // convert_number_to_words to be ported
      distributor: {
        distributor_name: d.distributor_name || '',
        address,
        tin_number: d.tin_number || '',
        sales_rep_name: d.sales_rep_name || '',
        state: d.state || '',
        state_code: d.state_code || '',
        gst_number: d.gst_number || ''
      }
    });
  }

  return final_data;
};




// New Solution faster still slow
PaymentUpload.generateSummary = async function(fd, td, di) {
  const template = path.join(getTemplatePath(), 'Payment_upload_summary_format.xlsx');
  if (!fs.existsSync(template)) return 'Template not found.';

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(template);
  const worksheet = workbook.getWorksheet(1);

  let condition = {};
  if (di && di !== '' && di !== 'All') {
    condition.distributor_id = di;
  }

  // ── 1. Main fetch (unchanged) ──────────────────────────────────────────────
  const paymentDetails = await PaymentDetails.findAll({
    where: { date_of_deposit: { [Op.between]: [fd, td] } },
    order: [['id', 'DESC']],
    include: [
      {
        model: PaymentDetailsItem,
        as: 'items',
        where: Object.keys(condition).length ? condition : undefined,
        required: false,
      },
      {
        model: PaymentDetailsExpense,
        as: 'expenses',
        required: false,
      },
    ],
  });

  // ── 2. Collect all IDs / keys we'll need ──────────────────────────────────
  const bankIds       = new Set();
  const distributorIds = new Set();
  const invoiceKeys   = []; // { distributor_id, invoice_no } pairs for Sale lookup

  for (const pd of paymentDetails) {
    if (pd.bank_id) bankIds.add(pd.bank_id);
    for (const item of pd.items || []) {
      if (item.distributor_id) distributorIds.add(item.distributor_id);
      if (item.invoice_no && item.invoice_no !== 'On Account') {
        invoiceKeys.push({ distributor_id: item.distributor_id, invoice_no: item.invoice_no });
      }
    }
  }

  // ── 3. Batch-fetch everything in 3 queries ─────────────────────────────────
  const [banks, distributors, sales] = await Promise.all([
    bankIds.size
      ? BankMaster.findAll({
          where: { id: { [Op.in]: [...bankIds] } },
          attributes: ['id', 'b_name'],
          raw: true,
        })
      : [],

    distributorIds.size
      ? Distributor.findAll({
          where: { id: { [Op.in]: [...distributorIds] } },
          attributes: ['id', 'distributor_name'],
          raw: true,
        })
      : [],

    invoiceKeys.length
      ? Sale.findAll({
          where: { [Op.or]: invoiceKeys.map(k => ({
            distributor_id: k.distributor_id,
            invoice_no: k.invoice_no,
          })) },
          attributes: ['id', 'order_no', 'invoice_amount', 'distributor_id', 'invoice_no'],
          raw: true,
        })
      : [],
  ]);

  // ── 4. Build O(1) lookup Maps ──────────────────────────────────────────────
  const bankMap        = new Map(banks.map(b => [b.id, b]));
  const distributorMap = new Map(distributors.map(d => [d.id, d]));
  // composite key: `${distributor_id}__${invoice_no}`
  const saleMap        = new Map(
    sales.map(s => [`${s.distributor_id}__${s.invoice_no}`, s])
  );

  // ── 5. Write rows — zero DB calls inside the loop ─────────────────────────
  let rowNum = 2;
  for (const pd of paymentDetails) {
    const bank  = bankMap.get(pd.bank_id);
    const items = pd.items || [];

    for (const [index, item] of items.entries()) {
      if (item.invoice_no === 'On Account') continue;

      const distributor = distributorMap.get(item.distributor_id);
      const sale        = saleMap.get(`${item.distributor_id}__${item.invoice_no}`);
      const expense     = (pd.expenses || [])[index] || null;

      worksheet.getRow(rowNum).values = [
        pd.date_of_deposit,
        bank        ? bank.b_name            : '',
        pd.payment_mode,
        distributor ? distributor.distributor_name : '',
        item.invoice_no,
        sale        ? sale.order_no          : '',
        pd.neft_no,
        expense     ? expense.invoice_amount : (sale ? sale.invoice_amount : ''),
        expense     ? expense.commission            : 0,
        expense     ? expense.listing_fees          : 0,
        expense     ? expense.shipping              : 0,
        expense     ? expense.omc_cost              : 0,
        expense     ? expense.marketplace_fees      : 0,
        expense     ? expense.storage_fees          : 0,
        expense     ? expense.unicommerce_charge    : 0,
        expense     ? expense.adtech_charges        : 0,
        expense     ? expense.cred_rewards_adjustment : 0,
        expense     ? expense.cred_pay_adjustment   : 0,
        expense     ? expense.cost_of_advertising   : 0,
        expense     ? expense.tcs_igst              : 0,
        expense     ? expense.tcs_sgst              : 0,
        expense     ? expense.tcs_cgst              : 0,
        expense     ? expense.tds                   : 0,
        expense     ? expense.other_adjustment      : 0,
        expense     ? expense.debt_adjustment       : 0,
        expense     ? expense.tds_claims            : 0,
        expense     ? expense.lost_damage_inventory : 0,
        item.credit_debit_note || 0,
        item.payment_amount,
        pd.remarks,
        item.narration,
      ];
      rowNum++;
    }
  }

  // ── 6. Write file ──────────────────────────────────────────────────────────
  const fileName   = `payment_details_summary_${Date.now()}.xlsx`;
  const uploadPath = path.join(getUploadPath(), 'payment_upload');
  if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
  const filePath = path.join(uploadPath, fileName);
  await workbook.xlsx.writeFile(filePath);

  return { fileName, filePath };
};


// Old Slow solution
// PaymentUpload.generateSummary = async function(fd,td,di){
//   const template = path.join(getTemplatePath(), 'Payment_upload_summary_format.xlsx');
//   if (!fs.existsSync(template)) return 'Template not found.';

//   const workbook = new ExcelJS.Workbook();
//   await workbook.xlsx.readFile(template);
//   const worksheet = workbook.getWorksheet(1);

//   let condition = {}
//   if (di && di !== "" && di !== "All") {
//     condition.distributor_id = di;
//   }

//   const paymentDetails = await PaymentDetails.findAll({
//     where:{date_of_deposit:{[Op.between]: [fd, td]}},
//     order: [['id', 'DESC']],
//     include:[
//       {
//         model:PaymentDetailsItem,
//         as: 'items',
//         where:Object.keys(condition).length ? condition : undefined,
//         required: false
//       },
//       {
//         model:PaymentDetailsExpense,
//         as: 'expenses',
//         required: false
//       }
//     ]
//   });


//   let rowNum = 2;
//   console.log(JSON.stringify(paymentDetails));
//   for(const paymentDetail of paymentDetails){
//     const bankMaster = await BankMaster.findByPk(paymentDetail.bank_id, { attributes:['id', "b_name"], raw: true });
//     const items = paymentDetail.items || [];
//     for(const [index, item] of items.entries()){
//       const distributor = await Distributor.findByPk(item.distributor_id, { attributes:['id', "distributor_name"], raw: true });
//       const expense = (paymentDetail.expenses || [])[index] || null;

//       if(item.invoice_no !== "On Account"){
//         const sale = await Sale.findOne({where:{distributor_id:item.distributor_id, invoice_no:item.invoice_no }, attributes:['id', "order_no", "invoice_amount"], raw: true});

//         // Map to sheet columns A-AE (31 columns)
//         worksheet.getRow(rowNum).values = [
//           paymentDetail.date_of_deposit,                                              // A - Date of Deposit
//           bankMaster ? bankMaster.b_name : '',                                        // B - Bank
//           paymentDetail.payment_mode,                                                 // C - Payment Mode
//           distributor ? distributor.distributor_name : '',                            // D - Distributor Name
//           item.invoice_no,                                                            // E - Invoice No
//           sale ? sale.order_no : '',                                                  // F - Order No
//           paymentDetail.neft_no,                                                      // G - NEFT No
//           expense ? expense.invoice_amount : (sale ? sale.invoice_amount : ''),       // H - Invoice Amount
//           expense ? expense.commission : 0,                                           // I - Commission
//           expense ? expense.listing_fees : 0,                                         // J - Listing Fees
//           expense ? expense.shipping : 0,                                             // K - Shipping
//           expense ? expense.omc_cost : 0,                                             // L - OMS Cost
//           expense ? expense.marketplace_fees : 0,                                     // M - Marketplace Fees
//           expense ? expense.storage_fees : 0,                                         // N - Storage Fees
//           expense ? expense.unicommerce_charge : 0,                                   // O - Unicommerce Charge
//           expense ? expense.adtech_charges : 0,                                       // P - Ad-tech Charges
//           expense ? expense.cred_rewards_adjustment : 0,                              // Q - CRED Rewards Adjustment
//           expense ? expense.cred_pay_adjustment : 0,                                  // R - CRED Pay Adjustment
//           expense ? expense.cost_of_advertising : 0,                                  // S - Cost of Advertising
//           expense ? expense.tcs_igst : 0,                                             // T - TCS-IGST
//           expense ? expense.tcs_sgst : 0,                                             // U - TCS-SGST
//           expense ? expense.tcs_cgst : 0,                                             // V - TCS-CGST
//           expense ? expense.tds : 0,                                                  // W - TDS
//           expense ? expense.other_adjustment : 0,                                     // X - Other Adjustment
//           expense ? expense.debt_adjustment : 0,                                      // Y - Debt Adjustment
//           expense ? expense.tds_claims : 0,                                           // Z - TDS Claims
//           expense ? expense.lost_damage_inventory : 0,                                // AA - Lost/Damaged Inventory
//           item.credit_debit_note || 0,                                                // AB - Credit/Debit Note
//           item.payment_amount,                                                        // AC - Payment Amount
//           paymentDetail.remarks,                                                      // AD - Remarks
//           item.narration                                                              // AE - Narration
//         ];

//         rowNum++;
//       }
//     }
//   }


//   // Save to reports folder
//   const fileName = `payment_details_summary_${Date.now()}.xlsx`;
//   const uploadPath = path.join(getUploadPath(), 'payment_upload');
//   if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
//   const filePath = path.join(uploadPath, fileName);
//   await workbook.xlsx.writeFile(filePath);

//   return { fileName, filePath };
  
// }

export default PaymentUpload;
