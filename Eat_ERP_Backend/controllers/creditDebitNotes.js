import sequelize from '../lib/database.js';
import { select, execute, invalid, text, today, toDate, dateOrNull, insertRow, updateRow, isFreezedMonth } from './sales.js';
import { fiscalYear, nextSeries } from '../lib/salesApproval.js';
import { escapeHtml, getAddress, numberToWords } from '../lib/salesPrint.js';

// Credit Debit Note (old PHP Credit_debit_note): credit / debit notes and expense vouchers (and their reversals)
// against a distributor, for an invoice or as promotion. Saved entries wait for approval; an approved one is
// changed or deleted through a copy (ref_id) approved in its turn. Approval gives the reference no
// (WHPL/<year>-CN|DN|EXP|EXPREV/<series>) and the printable note. Notes are also made by the system for payments,
// sales (promotion charges) and sales returns. Access: the Credit_Debit_Note role section.

const TRANSACTIONS = { 'Credit Note': 'CN', 'Debit Note': 'DN', 'Expense Voucher': 'EXP', 'Expense Voucher Reversal': 'EXPREV' };
const DISTRIBUTOR_TYPES = ['Promotion', 'Invoice'];
// Ledger balance adjustments are not shown here (old PHP)
const NOT_ADJUSTMENT = `ifnull(A.remarks, '') <> 'Adjusted through Ledger Balance'`;
const HOME_STATE_CODE = '27';

const STATUS_FILTERS = {
  approved: `A.status = 'Approved'`,
  // PHP's Pending tab had no brackets around the OR, so Deleted entries skipped the other filters
  pending: `(A.status = 'Pending' or A.status = 'Deleted')`,
  rejected: `A.status = 'Rejected'`,
  inactive: `A.status = 'InActive'`,
  all: '1 = 1'
};

const round = (value, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.sign(value) * Math.round(Math.abs(+value || 0) * factor) / factor;
};
const money = (value) => (+value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const roleDetails = (req) => req.userData.roleDetails || {};
const getAction = (req) => ({ insert: !!roleDetails(req).r_insert });

// Old PHP credit_debit_note_details.php buttons; freezed notes can no longer be changed
const getPermissions = (req, row) => {
  const role = roleDetails(req);
  if (!row) return { submit: !!role.r_insert, delete: false, approve: false };
  const status = text(row.status);
  const own = +row.modified_by === +req.userData.userId;
  const freezed = +row.freezed === 1;
  return {
    submit: !!role.r_edit && !freezed && (own || status === 'Approved' || status === 'InActive'),
    delete: !!role.r_delete && !freezed && (own || status === 'Approved') && status !== 'InActive',
    approve: !!role.r_approvals && !own && (status === 'Pending' || status === 'Deleted')
  };
};

const findNote = async (id, transaction, lock = false) => (await select(
  `select A.*, B.distributor_name, B.state_code as distributor_state_code, E.category as exp_category,
     concat(ifnull(U1.first_name, ''), ' ', ifnull(U1.last_name, '')) as createdby,
     concat(ifnull(U2.first_name, ''), ' ', ifnull(U2.last_name, '')) as modifiedby,
     concat(ifnull(U3.first_name, ''), ' ', ifnull(U3.last_name, '')) as approvedby
   from credit_debit_note A left join distributor_master B on (A.distributor_id = B.id)
   left join exp_cat_master E on (A.exp_category_id = E.id)
   left join user_master U1 on (A.created_by = U1.id) left join user_master U2 on (A.modified_by = U2.id)
   left join user_master U3 on (A.approved_by = U3.id)
   where A.id = :id${lock ? ' for update' : ''}`,
  { id }, transaction
))[0] || null;

// Old PHP get_pending_data: an approved note with a change waiting for approval opens as that change
const findPendingCopy = async (refId, transaction) => (await select(
  `select id from credit_debit_note where ref_id = :refId and status <> 'InActive' and status <> 'Rejected' order by id desc limit 1`,
  { refId }, transaction
))[0] || null;

// Where a system note came from (changing it by hand is overwritten when that entry is approved again)
const sourceOf = (row) => {
  if (row.payment_id) return { type: 'Payment', id: row.payment_id };
  if (row.distributor_out_id) return { type: 'Sale', id: row.distributor_out_id };
  if (row.distributor_in_id) return { type: 'Sales Return', id: row.distributor_in_id };
  return null;
};

// ---------- List ----------

export const getCreditDebitNotes = async (req, res, next) => {
  try {
    const status = STATUS_FILTERS[text(req.query.status)] ? text(req.query.status) : 'approved';
    const pageSize = Math.min(Math.max(+req.query.pageSize || 10, 1), 1000);
    const pageIndex = Math.max(+req.query.pageIndex || 0, 0);
    const query = text(req.query.query);
    const replacements = { search: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };
    const search = query
      ? `and (A.id like :search or date_format(A.date_of_transaction, '%d/%m/%Y') like :search or A.ref_no like :search
           or A.transaction like :search or A.amount like :search or A.remarks like :search or B.distributor_name like :search)`
      : '';
    const from = `from credit_debit_note A left join distributor_master B on (A.distributor_id = B.id)
      where ${NOT_ADJUSTMENT} and ${STATUS_FILTERS[status]} ${search}`;
    const [[count], rows, [counts]] = await Promise.all([
      select(`select count(*) as total ${from}`, replacements),
      select(
        `select A.id, A.date_of_transaction, A.ref_no, B.distributor_name, A.transaction, A.distributor_type, A.invoice_no,
           A.amount, A.remarks, A.status, A.payment_id, A.distributor_out_id, A.distributor_in_id
         ${from} order by A.modified_on desc, A.id desc limit :limit offset :offset`,
        replacements
      ),
      select(`select count(*) as all_count, sum(A.status = 'Approved') as approved, sum(A.status = 'Pending' or A.status = 'Deleted') as pending,
                sum(A.status = 'Rejected') as rejected, sum(A.status = 'InActive') as inactive
              from credit_debit_note A where ${NOT_ADJUSTMENT}`)
    ]);
    res.status(200).json({
      total: +count.total || 0,
      rows: rows.map((row) => ({ ...row, date_of_transaction: toDate(row.date_of_transaction), source: sourceOf(row) })),
      statusCount: {
        approved: +counts.approved || 0,
        pending: +counts.pending || 0,
        rejected: +counts.rejected || 0,
        inactive: +counts.inactive || 0,
        all: +counts.all_count || 0
      },
      action: getAction(req)
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching credit / debit notes failed!";
    next(error, req, res);
  }
};

// ---------- Form data ----------

export const getMasterData = async (req, res, next) => {
  try {
    const [distributors, categories] = await Promise.all([
      select(`select id, distributor_name, state, state_code from distributor_master where status = 'Approved' order by distributor_name`),
      select(`select id, category from exp_cat_master where status = 'Approved' order by category`)
    ]);
    res.status(200).json({ distributors, categories, transactions: Object.keys(TRANSACTIONS), action: getAction(req) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching credit / debit note master data failed!";
    next(error, req, res);
  }
};

// Old PHP get_total_outstanding (module credit_debit_note) + get_invoice: the distributor's outstanding (this note
// left out) and approved invoice nos
export const getDistributorDetails = async (req, res, next) => {
  try {
    const distributorId = +req.query.distributor_id || 0;
    if (!distributorId) {
      return res.status(422).json({ message: "Select the distributor." });
    }
    const noteIds = [+req.query.id || 0, +req.query.ref_id || 0];
    const [[row], invoices] = await Promise.all([
      select(
        `select ifnull((select sum(invoice_amount) from distributor_out where status = 'Approved' and distributor_id = :distributorId), 0)
           - ifnull((select sum(I.payment_amount) from payment_details_items I join payment_details P on (I.payment_id = P.id)
                where I.distributor_id = :distributorId and P.status = 'Approved'), 0)
           - ifnull((select sum(case when transaction = 'Debit Note' then amount * -1 else amount end) from credit_debit_note
                where status = 'Approved' and distributor_id = :distributorId and id not in (:noteIds)), 0)
           - ifnull((select sum(final_amount) from distributor_in where status = 'Approved' and distributor_id = :distributorId), 0) as total_outstanding`,
        { distributorId, noteIds }
      ),
      select(
        `select distinct invoice_no from distributor_out where status = 'Approved' and distributor_id = :distributorId and invoice_no <> ''
         order by invoice_no desc`,
        { distributorId }
      )
    ]);
    res.status(200).json({ outstanding: round(+row.total_outstanding || 0), invoices: invoices.map((invoice) => invoice.invoice_no) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching distributor details failed!";
    next(error, req, res);
  }
};

// ---------- One note ----------

export const getCreditDebitNote = async (req, res, next) => {
  try {
    const original = await findNote(+req.params.id || 0);
    if (!original || text(original.remarks) === 'Adjusted through Ledger Balance') {
      return res.status(404).json({ message: "Credit / debit note not found!" });
    }
    let note = original;
    if (original.status === 'Approved') {
      const copy = await findPendingCopy(original.id);
      if (copy) note = await findNote(copy.id);
    }
    res.status(200).json({
      note: { ...note, date_of_transaction: toDate(note.date_of_transaction), ref_date: toDate(note.ref_date) },
      permissions: getPermissions(req, note),
      changeOf: note.id !== original.id ? original.id : null,
      source: sourceOf(note)
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching credit / debit note failed!";
    next(error, req, res);
  }
};

// ---------- Save ----------

// Validates the form (old PHP validations.js form_credit_debit_note_details) and works out the tax: CGST + SGST for
// a Maharashtra distributor (state code 27), else IGST, on the amount before tax
const buildNote = async (req, existing) => {
  const body = req.body || {};
  const errors = {};
  const addError = (key, message) => {
    if (!errors[key]) errors[key] = { message };
  };

  const dateOfTransaction = dateOrNull(body.date_of_transaction);
  if (!dateOfTransaction) addError('date_of_transaction', 'Date of transaction is required.');
  else if (dateOfTransaction > today()) addError('date_of_transaction', 'Date of transaction cannot be in the future.');
  else if (await isFreezedMonth(dateOfTransaction)) addError('date_of_transaction', 'Please select another date, this date is freezed.');

  const distributorType = text(body.distributor_type);
  if (!DISTRIBUTOR_TYPES.includes(distributorType)) addError('distributor_type', 'Select Promotion or Invoice.');

  const distributorId = +body.distributor_id || 0;
  let distributor = null;
  if (!distributorId) {
    addError('distributor_id', 'Distributor is required.');
  } else {
    [distributor] = await select(`select id, state_code from distributor_master where id = :distributorId`, { distributorId });
    if (!distributor) addError('distributor_id', 'Distributor not found.');
  }

  const transaction = text(body.transaction);
  if (!TRANSACTIONS[transaction]) addError('transaction', 'Transaction is required.');

  const expCategoryId = +body.exp_category_id || 0;
  if (!expCategoryId) {
    addError('exp_category_id', 'Expense category is required.');
  } else if (!(await select(`select id from exp_cat_master where id = :expCategoryId`, { expCategoryId })).length) {
    addError('exp_category_id', 'Expense category not found.');
  }

  let invoiceNo = '';
  if (distributorType === 'Invoice') {
    invoiceNo = text(body.invoice_no);
    // PHP did not insist on it; an invoice note now names its invoice
    if (!invoiceNo) {
      addError('invoice_no', 'Select the invoice.');
    } else if (distributorId && !(await select(
      `select id from distributor_out where status = 'Approved' and distributor_id = :distributorId and invoice_no = :invoiceNo limit 1`,
      { distributorId, invoiceNo }
    )).length) {
      addError('invoice_no', `Invoice ${invoiceNo} is not an approved invoice of this distributor.`);
    }
  }

  const amountText = text(body.amount_without_tax).replace(/,/g, '');
  const amount = Number(amountText);
  if (!amountText) addError('amount_without_tax', 'Amount is required.');
  else if (isNaN(amount) || amount <= 0) addError('amount_without_tax', 'Amount should be greater than zero.');
  const taxText = text(body.tax).replace(/,/g, '');
  const tax = taxText === '' ? 0 : Number(taxText);
  if (isNaN(tax) || tax < 0 || tax > 100) addError('tax', 'Tax should be a percentage between 0 and 100.');

  const remarks = text(body.remarks).replace(/'/g, '');
  if (!remarks) addError('remarks', existing && existing.status === 'Approved' ? 'Give the reason for changing this approved note.' : 'Remarks are required.');

  if (Object.keys(errors).length) return { errors };

  const home = distributor && text(distributor.state_code) === HOME_STATE_CODE;
  const cgst = home ? round((tax / 2) * amount / 100) : 0;
  const sgst = cgst;
  const igst = home ? 0 : round(tax * amount / 100);
  return {
    row: {
      date_of_transaction: dateOfTransaction,
      distributor_id: distributorId,
      transaction,
      invoice_no: invoiceNo,
      distributor_type: distributorType,
      amount_without_tax: round(amount),
      tax: round(tax),
      cgst,
      sgst,
      igst,
      amount: round(amount + cgst + sgst + igst),
      remarks,
      exp_category_id: expCategoryId
    }
  };
};

// The pending copy (ref_id) that carries a change or deletion of an approved note
const saveCopy = async (original, row, status, userId, now, transaction) => {
  const copy = await findPendingCopy(original.id, transaction);
  const data = {
    ...row,
    status,
    modified_by: userId,
    modified_on: now,
    ref_id: original.id,
    ref_no: original.ref_no,
    ref_date: toDate(original.ref_date),
    freezed: original.freezed,
    distributor_out_id: original.distributor_out_id,
    distributor_in_id: original.distributor_in_id,
    payment_id: original.payment_id,
    modified_approved_date: now
  };
  if (copy) {
    await updateRow('credit_debit_note', copy.id, data, transaction);
    return copy.id;
  }
  return insertRow('credit_debit_note', { ...data, created_by: userId, created_on: now }, transaction);
};

export const createCreditDebitNote = async (req, res, next) => {
  try {
    const built = await buildNote(req, null);
    if (built.errors) return invalid(res, built.errors);
    const userId = req.userData.userId;
    const now = new Date();
    const id = await insertRow('credit_debit_note', {
      ...built.row, status: 'Pending', ref_id: null, created_by: userId, created_on: now, modified_by: userId, modified_on: now
    });
    res.status(201).json({ message: "Credit / debit note submitted for approval!", id });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Saving credit / debit note failed!";
    next(error, req, res);
  }
};

// Submit For Approval on an existing note
export const updateCreditDebitNote = async (req, res, next) => {
  try {
    const existing = await findNote(+req.params.id || 0);
    if (!existing) {
      return res.status(404).json({ message: "Credit / debit note not found!" });
    }
    if (!getPermissions(req, existing).submit) {
      return res.status(401).json({ message: "You cannot change this credit / debit note." });
    }
    const built = await buildNote(req, existing);
    if (built.errors) return invalid(res, built.errors);
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      let id = existing.id;
      if (existing.status === 'Approved') {
        id = await saveCopy(existing, built.row, 'Pending', userId, now, t);
      } else {
        await updateRow('credit_debit_note', id, { ...built.row, status: 'Pending', modified_by: userId, modified_on: now }, t);
      }
      await t.commit();
      res.status(200).json({ message: "Credit / debit note submitted for approval!", id });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Saving credit / debit note failed!";
    next(error, req, res);
  }
};

// Old PHP btn_delete: an approved note gets a deletion request (Deleted, waiting for approval); any other is set InActive
export const deleteCreditDebitNote = async (req, res, next) => {
  try {
    const existing = await findNote(+req.params.id || 0);
    if (!existing) {
      return res.status(404).json({ message: "Credit / debit note not found!" });
    }
    if (!getPermissions(req, existing).delete) {
      return res.status(401).json({ message: "You cannot delete this credit / debit note." });
    }
    if (await isFreezedMonth(toDate(existing.date_of_transaction))) {
      return invalid(res, { date_of_transaction: { message: 'This note is in a freezed month and cannot be deleted.' } });
    }
    const userId = req.userData.userId;
    const now = new Date();
    if (existing.status === 'Approved') {
      const remarks = text((req.body || {}).remarks).replace(/'/g, '');
      if (!remarks) {
        return invalid(res, { remarks: { message: 'Give the reason for deleting this approved note.' } });
      }
      const keep = ['date_of_transaction', 'distributor_id', 'transaction', 'invoice_no', 'distributor_type', 'amount_without_tax',
        'tax', 'cgst', 'sgst', 'igst', 'amount', 'exp_category_id'];
      const row = Object.fromEntries(keep.map((key) => [key, key === 'date_of_transaction' ? toDate(existing[key]) : existing[key]]));
      const t = await sequelize.transaction();
      try {
        const id = await saveCopy(existing, { ...row, remarks }, 'Deleted', userId, now, t);
        await t.commit();
        return res.status(200).json({ message: "Deletion submitted for approval!", id });
      } catch (error) {
        if (!t.finished) await t.rollback();
        throw error;
      }
    }
    await execute(
      `update credit_debit_note set status = 'InActive', modified_by = :userId, modified_on = :now where id = :id`,
      { userId, now, id: existing.id }
    );
    res.status(200).json({ message: "Credit / debit note deleted!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Deleting credit / debit note failed!";
    next(error, req, res);
  }
};

// ---------- Approve / Reject ----------

// Reference no: a new one from the Credit_debit_note series; an existing one keeps its year and number, only the
// type changes with the transaction (PHP dropped the year there: WHPL/26-CN/12 became WHPL/CN/12)
const referenceNo = async (refNo, transaction, refDate, t) => {
  const code = TRANSACTIONS[transaction] || 'EXPREV';
  if (text(refNo)) {
    // WHPL/26-CN/12, or WHPL/CN/12 as PHP left some
    const match = text(refNo).match(/^(WHPL\/(?:[^/-]*-)?)[A-Z]+(\/.+)$/);
    return match ? `${match[1]}${code}${match[2]}` : text(refNo);
  }
  const series = await nextSeries(sequelize, 'Credit_debit_note', t);
  // PHP cut the financial year one character short (WHPL/2-CN/...)
  return `WHPL/${fiscalYear(refDate).split('-')[0]}-${code}/${series}`;
};

// Old PHP save_data with btn_approve: a change (ref_id) is written back into the approved note; a deletion request
// makes it InActive. The note can then be printed.
export const approveCreditDebitNote = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot approve credit / debit notes." });
    }
    const id = +req.params.id || 0;
    const existing = await findNote(id);
    if (!existing) {
      return res.status(404).json({ message: "Credit / debit note not found!" });
    }
    if (!getPermissions(req, existing).approve) {
      return res.status(401).json({ message: "You cannot approve this credit / debit note." });
    }
    const userId = req.userData.userId;
    const now = new Date();
    const remarks = (text((req.body || {}).remarks) || text(existing.remarks)).replace(/'/g, '');
    const t = await sequelize.transaction();
    try {
      const locked = (await select(`select * from credit_debit_note where id = :id for update`, { id }, t))[0];
      if (!locked || (locked.status !== 'Pending' && locked.status !== 'Deleted')) {
        await t.rollback();
        return res.status(422).json({ message: "This note is no longer waiting for approval." });
      }
      const status = locked.status === 'Deleted' ? 'InActive' : 'Approved';
      const refDate = toDate(locked.ref_date) || today();
      const refNo = await referenceNo(locked.ref_no, locked.transaction, refDate, t);
      let noteId = id;
      if (locked.ref_id) {
        const refId = +locked.ref_id;
        if (!(await select(`select id from credit_debit_note where id = :refId for update`, { refId }, t)).length) {
          await t.rollback();
          return res.status(422).json({ message: `The note this changes (#${refId}) no longer exists.` });
        }
        await execute(
          `update credit_debit_note A, credit_debit_note B
           set A.date_of_transaction = B.date_of_transaction, A.distributor_id = B.distributor_id, A.transaction = B.transaction,
             A.amount = B.amount, A.status = :status, A.remarks = :remarks, A.modified_by = B.modified_by, A.modified_on = B.modified_on,
             A.approved_by = :userId, A.approved_on = :now, A.ref_no = :refNo, A.ref_date = :refDate, A.modified_approved_date = :today,
             A.amount_without_tax = B.amount_without_tax, A.tax = B.tax, A.igst = B.igst, A.cgst = B.cgst, A.sgst = B.sgst,
             A.distributor_type = B.distributor_type, A.invoice_no = B.invoice_no, A.exp_category_id = B.exp_category_id
           where A.id = :refId and B.id = :id`,
          { status, remarks, userId, now, refNo, refDate, today: today(), refId, id }, t
        );
        await execute(`delete from credit_debit_note where id = :id`, { id }, t);
        noteId = refId;
      } else {
        await execute(
          `update credit_debit_note set status = :status, remarks = :remarks, approved_by = :userId, approved_on = :now,
             ref_no = :refNo, ref_date = :refDate
           where id = :id`,
          { status, remarks, userId, now, refNo, refDate, id }, t
        );
      }
      await t.commit();
      res.status(200).json({
        message: status === 'InActive' ? "Credit / debit note deleted!" : `${locked.transaction} approved! Ref No: ${refNo}`,
        id: noteId,
        print: status === 'Approved'
      });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Approving credit / debit note failed!";
    next(error, req, res);
  }
};

// Old PHP btn_reject: the note is set aside; a rejected change or deletion leaves the approved note as it was
export const rejectCreditDebitNote = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot reject credit / debit notes." });
    }
    const id = +req.params.id || 0;
    const existing = await findNote(id);
    if (!existing) {
      return res.status(404).json({ message: "Credit / debit note not found!" });
    }
    if (!getPermissions(req, existing).approve) {
      return res.status(401).json({ message: "You cannot reject this credit / debit note." });
    }
    const remarks = text((req.body || {}).remarks).replace(/'/g, '');
    if (!remarks) {
      return invalid(res, { remarks: { message: 'Give the reason for rejecting this note.' } });
    }
    const userId = req.userData.userId;
    const now = new Date();
    const [result] = await execute(
      `update credit_debit_note set status = 'Rejected', remarks = :remarks, rejected_by = :userId, rejected_on = :now
       where id = :id and (status = 'Pending' or status = 'Deleted')`,
      { remarks, userId, now, id }
    );
    if (!(result && result.affectedRows)) {
      return res.status(422).json({ message: "This note is no longer waiting for approval." });
    }
    res.status(200).json({ message: "Credit / debit note rejected!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Rejecting credit / debit note failed!";
    next(error, req, res);
  }
};

// ---------- Printout ----------

const fmtDate = (value) => {
  const date = toDate(value);
  if (!date) return '';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
};
// PHP printed "h:m:i" (hour : month : minutes)
const fmtDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// Old PHP view_credit_debit_note (views/credit_debit_note/credit_debit_note.php): one note
const noteBody = async (note, assetUrl) => {
  const [party] = await select(
    `select distributor_name, address, city, pincode, state, country, gst_number from distributor_master where id = :id`,
    { id: note.distributor_id }
  );
  const e = escapeHtml;
  const name = e(note.transaction);
  const line = '1px solid #999';
  const tax = +note.tax || 0;
  const modified = fmtDateTime(note.created_on) !== fmtDateTime(note.modified_on);
  // Open grid like the PHP note: no outer left / right border; the amount column runs down the tax lines
  const amountCell = (value, extra = '') => `<td colspan="3" align="center" valign="top" style="border-left:${line};border-right:none;${extra}"><p><b>Rs.${money(value)}</b></p></td>`;
  return `<div class="debit_note">
  <div class="header-section">
    <img src="${assetUrl}logo.png" alt="" style="vertical-align:top;width:150px" />
    <p style="font-size:12px;line-height:18px;margin:0 0 10px">Unit no 30,31,35,36,37 Samhita Complex, 13, Off Andheri-Kurla, Andheri East, Mumbai 400072 Maharashtra India
      <br />+91 8268000456<br /><a href="mailto:cs@eatanytime.in">cs@eatanytime.in</a><br />GSTIN: 27AABCW7811R1ZN</p>
  </div>
  <table>
    <tr><td colspan="6" align="center"><h2><b>${name}</b></h2></td></tr>
    <tr><td width="17%"><p>Ref.</p></td><td width="3%">:</td><td width="40%"><p><b>${e(note.ref_no)}</b></p></td>
      <td width="22%"><p>Transaction Date</p></td><td width="4%">:</td><td width="14%"><p><b>${fmtDate(note.date_of_transaction)}</b></p></td></tr>
    <tr><td style="vertical-align:top"><p>Party's Name</p></td><td style="vertical-align:top">:</td>
      <td colspan="4" style="vertical-align:top"><p><b>${e(party ? party.distributor_name : '')}</b><br />
      ${party ? e(getAddress(party.address, '', party.city, party.pincode, party.state, party.country)) : ''}</p></td></tr>
    <tr><td><p>Party's GSTIN</p></td><td>:</td><td colspan="4"><p><b>${e(party ? party.gst_number : '')}</b></p></td></tr>
    <tr><td><p>Reference Invoice No.</p></td><td>:</td><td colspan="4"><p><b>${e(note.invoice_no)}</b></p></td></tr>
    <tr><td colspan="6" style="height:10px">&nbsp;</td></tr>
    <tr>
      <td colspan="3" style="border-top:${line};border-bottom:${line};border-right:${line}"><p>Particulars</p></td>
      <td colspan="3" align="center" style="border-top:${line};border-bottom:${line};border-left:${line}"><p>Amount</p></td>
    </tr>
    <tr valign="top">
      <td colspan="3" style="border-right:${line}"><p>Being ${name} raised for ${e(note.remarks)}</p></td>
      ${amountCell(note.amount_without_tax !== null && note.amount_without_tax !== undefined ? note.amount_without_tax : note.amount)}
    </tr>
    <tr valign="top"><td colspan="3" style="border-right:${line}"><p>CGST @ ${tax / 2}%</p></td>${amountCell(note.cgst)}</tr>
    <tr valign="top"><td colspan="3" style="border-right:${line}"><p>SGST @ ${tax / 2}%</p></td>${amountCell(note.sgst)}</tr>
    <tr valign="top"><td colspan="3" style="border-right:${line}"><p>IGST @ ${tax}%</p></td>${amountCell(note.igst)}</tr>
    <tr valign="top">
      <td colspan="3" style="border-top:${line};border-bottom:${line};border-right:${line}"><p>Total Amount</p></td>
      ${amountCell(note.amount, `border-top:${line};border-bottom:${line};`)}
    </tr>
    <tr>
      <td colspan="3" style="border-right:${line}"><p><b>Amount (in words)</b></p></td>
      <td colspan="3" rowspan="2" style="border-left:${line};border-bottom:${line};vertical-align:top"><p>Remarks: ${e(note.remarks)}</p></td>
    </tr>
    <tr><td colspan="3" style="height:40px;vertical-align:top;border-bottom:${line};border-right:${line}"><p>${e(numberToWords(note.amount).trim())} Only</p></td></tr>
    <tr><td colspan="6"><p style="text-align:center">This is a computer generated ${name}. No signature required.</p></td></tr>
  </table>
  <table class="user_data" style="margin-top:20px">
    <tr><td align="center"><b>Created By:</b> ${e(text(note.createdby))}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      ${modified ? `<b>Modified By:</b> ${e(text(note.modifiedby))}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;` : ''}<b>Approved By:</b> ${e(text(note.approvedby))}</td></tr>
    <tr><td align="center"><b>Created On:</b> ${fmtDateTime(note.created_on)}&nbsp;&nbsp;&nbsp;&nbsp;
      ${modified ? `<b>Modified On:</b> ${fmtDateTime(note.modified_on)}&nbsp;&nbsp;&nbsp;&nbsp;` : ''}<b>Approved On:</b> ${fmtDateTime(note.approved_on)}</td></tr>
  </table>
</div>`;
};

// Notes in one printable page, each on its own sheet
const notePage = (title, bodies) => `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 0; letter-spacing: 0.5px; font-family: 'Source Sans Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  .debit_note { margin: 20px auto; max-width: 800px; }
  .header-section { text-align: center; }
  h2 { font-size: 23px; font-weight: 600; margin: 0; padding: 0 0 5px; text-align: center; }
  p { padding: 0; margin: 0; font-size: 13px; line-height: 21px; }
  table { margin: 10px 0; border-collapse: collapse; width: 100%; }
  td { padding: 3px 10px; border: none; }
  .user_data td { padding: 5px; font-size: 12px; }
  @media print { .no-print { display: none; } @page { size: portrait; } }
  .page-break { page-break-after: always; break-after: page; }
</style></head>
<body>
<div class="no-print" style="text-align:right;padding:8px"><button onclick="window.print()">Print</button></div>
${bodies.join('<div class="page-break"></div>')}
</body></html>`;

// Several notes in one printout (Old Payment Upload)
export const renderNotes = async (ids, assetUrl, title) => {
  const bodies = [];
  for (const id of ids) {
    const note = await findNote(id);
    if (note) bodies.push(await noteBody(note, assetUrl));
  }
  return notePage(title, bodies);
};

// Available once it has a ref no
export const getCreditDebitNotePrint = async (req, res, next) => {
  try {
    const note = await findNote(+req.params.id || 0);
    if (!note) {
      return res.status(404).json({ message: "Credit / debit note not found!" });
    }
    if (!text(note.ref_no)) {
      return res.status(422).json({ message: "The note can be printed once it is approved." });
    }
    const assetUrl = `${req.protocol}://${req.get('host')}/assets/invoice/`;
    res.status(200).json({ html: notePage(`${note.transaction} ${note.ref_no}`, [await noteBody(note, assetUrl)]) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating credit / debit note failed!";
    next(error, req, res);
  }
};
