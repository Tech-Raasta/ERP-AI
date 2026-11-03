import sequelize from '../lib/database.js';
import { select, execute, invalid, text, today, toDate, dateOrNull, insertRow, updateRow } from './sales.js';
import { fiscalYear, nextSeries } from '../lib/salesApproval.js';
import { escapeHtml, numberToWords } from '../lib/salesPrint.js';

// Payment Details (old PHP Payment / Payment_model): money received from distributors, deposited in our bank.
// A payment has a deposit date, bank and mode (Cash / Cheque / NEFT) and lines per distributor and invoice
// (or On Account). Saved entries wait for approval; an approved entry is changed or deleted through a copy
// (ref_id) that is approved in its turn. On approval, lines marked Credit Debit = Yes become credit / debit notes
// and a receipt voucher can be printed. Access: the Payment role section.

const MODES = ['Cash', 'Cheque', 'NEFT'];
const YES_NO = ['Yes', 'No'];
// Uploaded settlements (Payment Upload) carry gateway commission / GST per line
const GATEWAY_UPLOADS = ['Paytm', 'Razorpay', 'Sodexo'];
const DENOMINATIONS = [2000, 1000, 500, 100, 50, 20, 10];
const ON_ACCOUNT = 'On Account';

// Old PHP list tabs
const STATUS_FILTERS = {
  approved: `A.status = 'Approved'`,
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
// Zero dates (0000-00-00) of old rows come back as invalid dates
const validDate = (value) => (value instanceof Date && isNaN(value.getTime()) ? null : toDate(value));
const roleDetails = (req) => req.userData.roleDetails || {};

const getAction = (req) => ({ insert: !!roleDetails(req).r_insert });

// Old PHP payment_details.php buttons
const getPermissions = (req, row) => {
  const role = roleDetails(req);
  if (!row) return { submit: !!role.r_insert, delete: false, approve: false };
  const status = text(row.status);
  const own = +row.modified_by === +req.userData.userId;
  return {
    submit: !!role.r_edit && (own || status === 'Approved' || status === 'InActive'),
    delete: !!role.r_delete && (own || status === 'Approved') && status !== 'InActive',
    // PHP also offered it on Rejected entries; only entries waiting for approval now
    approve: !!role.r_approvals && !own && (status === 'Pending' || status === 'Deleted')
  };
};

const findPayment = async (id, transaction, lock = false) => (await select(
  `select A.*, B.b_name, B.b_branch,
     concat(ifnull(U1.first_name, ''), ' ', ifnull(U1.last_name, '')) as createdby,
     concat(ifnull(U2.first_name, ''), ' ', ifnull(U2.last_name, '')) as modifiedby,
     concat(ifnull(U3.first_name, ''), ' ', ifnull(U3.last_name, '')) as approvedby
   from payment_details A left join bank_master B on (A.bank_id = B.id)
   left join user_master U1 on (A.created_by = U1.id) left join user_master U2 on (A.modified_by = U2.id)
   left join user_master U3 on (A.approved_by = U3.id)
   where A.id = :id${lock ? ' for update' : ''}`,
  { id }, transaction
))[0] || null;

// Old PHP get_pending_data: an approved entry with a change waiting for approval opens as that change
const findPendingCopy = async (refId, transaction) => (await select(
  `select id from payment_details where ref_id = :refId and status <> 'InActive' and status <> 'Rejected' order by id desc limit 1`,
  { refId }, transaction
))[0] || null;

// ---------- List ----------

export const getPayments = async (req, res, next) => {
  try {
    const status = STATUS_FILTERS[text(req.query.status)] ? text(req.query.status) : 'approved';
    const pageSize = Math.min(Math.max(+req.query.pageSize || 10, 1), 1000);
    const pageIndex = Math.max(+req.query.pageIndex || 0, 0);
    const query = text(req.query.query);
    const replacements = { search: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };
    const search = query
      ? `and (A.id like :search or date_format(A.date_of_deposit, '%d/%m/%Y') like :search or B.b_name like :search
           or A.total_amount like :search or A.id in (select I.payment_id from payment_details_items I
             join distributor_master D on (I.distributor_id = D.id) where D.distributor_name like :search))`
      : '';
    const from = `from payment_details A left join bank_master B on (A.bank_id = B.id) where ${STATUS_FILTERS[status]} ${search}`;
    const [[count], rows, [counts]] = await Promise.all([
      select(`select count(*) as total ${from}`, replacements),
      select(
        `select A.id, A.date_of_deposit, A.payment_mode, A.status, A.total_amount, A.modified_on, A.upload_type, B.b_name
         ${from} order by A.modified_on desc, A.id desc limit :limit offset :offset`,
        replacements
      ),
      select(`select count(*) as all_count, sum(status = 'Approved') as approved, sum(status = 'Pending' or status = 'Deleted') as pending,
                sum(status = 'Rejected') as rejected, sum(status = 'InActive') as inactive from payment_details`)
    ]);
    // Distributor names of this page only, in one pass over the lines (payment_details_items has no index on payment_id)
    const ids = rows.map((row) => row.id);
    const names = ids.length ? await select(
      `select I.payment_id, group_concat(distinct D.distributor_name separator ', ') as distributor_name
       from payment_details_items I left join distributor_master D on (I.distributor_id = D.id)
       where I.payment_id in (:ids) group by I.payment_id`,
      { ids }
    ) : [];
    const nameOf = Object.fromEntries(names.map((row) => [row.payment_id, row.distributor_name]));
    res.status(200).json({
      total: +count.total || 0,
      rows: rows.map((row) => ({ ...row, date_of_deposit: toDate(row.date_of_deposit), distributor_name: nameOf[row.id] || '' })),
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
    res.message = "Fetching payments failed!";
    next(error, req, res);
  }
};

// ---------- Form data ----------

export const getMasterData = async (req, res, next) => {
  try {
    const [banks, distributors] = await Promise.all([
      select(`select id, b_name, b_branch from bank_master where status = 'Approved' order by b_name`),
      select(`select id, distributor_name from distributor_master where status = 'Approved' order by distributor_name`)
    ]);
    res.status(200).json({ banks, distributors, action: getAction(req) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching payment master data failed!";
    next(error, req, res);
  }
};

// Old PHP get_total_outstanding: approved invoices less approved payments (other than this one), credit / debit notes
// and sales returns
const totalOutstanding = async (distributorId, paymentIds) => {
  const [row] = await select(
    `select ifnull((select sum(invoice_amount) from distributor_out where status = 'Approved' and distributor_id = :distributorId), 0)
       - ifnull((select sum(I.payment_amount) from payment_details_items I join payment_details P on (I.payment_id = P.id)
            where I.distributor_id = :distributorId and P.status = 'Approved' and P.id not in (:paymentIds)), 0)
       - ifnull((select sum(case when transaction = 'Debit Note' then amount * -1 else amount end) from credit_debit_note
            where status = 'Approved' and distributor_id = :distributorId), 0)
       - ifnull((select sum(final_amount) from distributor_in where status = 'Approved' and distributor_id = :distributorId), 0) as total_outstanding`,
    { distributorId, paymentIds }
  );
  return Math.round(+row.total_outstanding || 0);
};

// Old PHP get_invoice_nos: the distributor's approved invoices with an unpaid balance
// (the distributor's payments are totalled once per invoice, not looked up per invoice)
const openInvoices = (distributorId, paymentIds) => select(
  `select A.invoice_no, A.client_name, A.invoice_date, round(ifnull(A.invoice_amount, 0) - ifnull(B.paid, 0), 2) as balance
   from distributor_out A
   left join (select I.invoice_no, sum(I.payment_amount) as paid from payment_details_items I join payment_details P on (I.payment_id = P.id)
     where I.distributor_id = :distributorId and P.status = 'Approved' and P.id not in (:paymentIds) group by I.invoice_no) B
     on (A.invoice_no = B.invoice_no)
   where A.status = 'Approved' and A.distributor_id = :distributorId and A.invoice_no is not null and A.invoice_no <> ''
     and round(ifnull(A.invoice_amount, 0) - ifnull(B.paid, 0), 2) > 0
   order by A.invoice_date desc, A.id desc`,
  { distributorId, paymentIds }
);

// This payment and the approved entry it changes are left out of "already paid"
const ownIds = (req) => [+req.query.id || 0, +req.query.ref_id || 0];

// Outstanding and open invoices of a distributor (old PHP get_total_outstanding + get_invoice_nos)
export const getDistributorDetails = async (req, res, next) => {
  try {
    const distributorId = +req.query.distributor_id || 0;
    if (!distributorId) {
      return res.status(422).json({ message: "Select the distributor." });
    }
    const [outstanding, invoices] = await Promise.all([
      totalOutstanding(distributorId, ownIds(req)),
      openInvoices(distributorId, ownIds(req))
    ]);
    res.status(200).json({ outstanding, invoices });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching distributor details failed!";
    next(error, req, res);
  }
};

// ---------- One payment ----------

export const getPayment = async (req, res, next) => {
  try {
    let id = +req.params.id || 0;
    const original = await findPayment(id);
    if (!original) {
      return res.status(404).json({ message: "Payment not found!" });
    }
    // An approved entry with a change waiting for approval opens as that change
    let payment = original;
    if (original.status === 'Approved') {
      const copy = await findPendingCopy(id);
      if (copy) {
        id = copy.id;
        payment = await findPayment(id);
      }
    }
    const [items, denominations] = await Promise.all([
      select(
        `select A.*, B.distributor_name from payment_details_items A left join distributor_master B on (A.distributor_id = B.id)
         where A.payment_id = :id order by A.id`,
        { id }
      ),
      select(`select * from payment_slip_denomination where payment_id = :id order by id limit 1`, { id })
    ]);
    res.status(200).json({
      payment: { ...payment, date_of_deposit: toDate(payment.date_of_deposit) },
      items: items.map((item) => ({
        ...item,
        settlement_start_date: validDate(item.settlement_start_date),
        settlement_end_date: validDate(item.settlement_end_date)
      })),
      denomination: denominations[0] || null,
      permissions: getPermissions(req, payment),
      changeOf: payment.id !== original.id ? original.id : null
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching payment failed!";
    next(error, req, res);
  }
};

// ---------- Save ----------

const numberOrNull = (value) => (text(value) === '' || isNaN(Number(value)) ? null : Number(value));

// Validates the form (old PHP validations.js form_payment_details + check_payment_details) and builds the rows
const buildPayment = async (req, existing, removing = false) => {
  const body = req.body || {};
  const errors = {};
  const addError = (key, message) => {
    if (!errors[key]) errors[key] = { message };
  };

  const dateOfDeposit = dateOrNull(body.date_of_deposit);
  if (!dateOfDeposit) addError('date_of_deposit', 'Date of deposit is required.');
  else if (dateOfDeposit > today()) addError('date_of_deposit', 'Date of deposit cannot be in the future.');

  const bankId = +body.bank_id || 0;
  if (!bankId) {
    addError('bank_id', 'Bank is required.');
  } else if (!(await select(`select id from bank_master where id = :bankId and status = 'Approved'`, { bankId })).length) {
    addError('bank_id', 'Select an approved bank.');
  }

  const mode = text(body.payment_mode);
  if (!mode) addError('payment_mode', 'Payment mode is required.');
  else if (!MODES.includes(mode)) addError('payment_mode', 'Payment mode should be Cash, Cheque or NEFT.');

  const remarks = text(body.remarks);
  // PHP: remarks are required when changing or deleting an approved entry
  if (existing && existing.status === 'Approved' && !remarks) {
    addError('remarks', removing ? 'Give the reason for deleting this approved payment.' : 'Give the reason for changing this approved payment.');
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) addError('items', 'Please add at least one item.');
  const distributorIds = [...new Set(rawItems.map((item) => +item.distributor_id || 0).filter(Boolean))];
  const known = distributorIds.length
    ? new Set((await select(`select id from distributor_master where id in (:distributorIds)`, { distributorIds })).map((row) => row.id))
    : new Set();
  const refLabel = mode === 'Cheque' ? 'Cheque No' : mode === 'NEFT' ? 'NEFT No' : 'Ref No';
  const items = [];
  for (const [index, raw] of rawItems.entries()) {
    const key = (field) => `items.${index}.${field}`;
    const distributorId = +raw.distributor_id || 0;
    if (!distributorId) addError(key('distributor_id'), 'Distributor is required.');
    else if (!known.has(distributorId)) addError(key('distributor_id'), 'Distributor not found.');
    const refNo = text(raw.ref_no);
    if (mode !== 'Cash' && !refNo) addError(key('ref_no'), `${refLabel} is required.`);
    const bankName = text(raw.bank_name);
    const bankCity = text(raw.bank_city);
    if (mode === 'Cheque') {
      if (!bankName) addError(key('bank_name'), 'Bank name is required.');
      if (!bankCity) addError(key('bank_city'), 'Bank city is required.');
    }
    const invoiceNo = text(raw.invoice_no) || ON_ACCOUNT;
    const amountText = text(raw.payment_amount);
    const amount = Number(amountText);
    if (amountText === '') addError(key('payment_amount'), 'Payment amount is required.');
    else if (isNaN(amount) || amount === 0) addError(key('payment_amount'), 'Enter the payment amount (negative for money paid back).');
    const creditDebit = text(raw.credit_debit);
    const tax = text(raw.tax);
    const narration = text(raw.narration);
    if (creditDebit && !YES_NO.includes(creditDebit)) addError(key('credit_debit'), 'Select Yes or No.');
    if (tax && !YES_NO.includes(tax)) addError(key('tax'), 'Select Yes or No.');
    if (creditDebit === 'Yes') {
      if (!tax) addError(key('tax'), 'Tax is required for a credit / debit note.');
      if (!narration) addError(key('narration'), 'Narration is required for a credit / debit note.');
    }
    items.push({
      distributor_id: distributorId,
      ref_no: refNo,
      bank_name: mode === 'Cheque' ? bankName : bankName || null,
      bank_city: mode === 'Cheque' ? bankCity : bankCity || null,
      invoice_no: invoiceNo,
      payment_amount: round(amount),
      // Settlement and gateway fields come from Payment Upload; kept as they were (PHP dropped commission / GST on edit)
      settlement_id: text(raw.settlement_id) || null,
      settlement_start_date: dateOrNull(raw.settlement_start_date),
      settlement_end_date: dateOrNull(raw.settlement_end_date),
      credit_debit: creditDebit,
      tax,
      narration,
      commission: numberOrNull(raw.commission),
      gst: numberOrNull(raw.gst),
      unique_ref_no: text(raw.unique_ref_no) || null
    });
  }

  // An invoice must be an approved invoice of that line's distributor
  for (const [index, item] of items.entries()) {
    if (item.invoice_no === ON_ACCOUNT || !item.distributor_id) continue;
    const [invoice] = await select(
      `select id from distributor_out where status = 'Approved' and invoice_no = :invoiceNo and distributor_id = :distributorId limit 1`,
      { invoiceNo: item.invoice_no, distributorId: item.distributor_id }
    );
    if (!invoice) addError(`items.${index}.invoice_no`, `Invoice ${item.invoice_no} is not an approved invoice of this distributor.`);
  }

  const totalAmount = round(items.reduce((sum, item) => sum + item.payment_amount, 0));

  let denomination = null;
  if (mode === 'Cash') {
    const raw = body.denomination || {};
    const count = (value, label) => {
      if (text(value) === '') return null;
      const number = Number(value);
      if (!Number.isInteger(number) || number < 0) {
        addError(`denomination.${label}`, 'Enter a whole number of notes.');
        return null;
      }
      return number;
    };
    denomination = {};
    let cash = 0;
    for (const note of DENOMINATIONS) {
      denomination[`denomination_${note}`] = count(raw[`denomination_${note}`], `denomination_${note}`);
      cash += (denomination[`denomination_${note}`] || 0) * note;
    }
    denomination.denomination_other = text(raw.denomination_other) || null;
    denomination.denomination_other_amount = numberOrNull(raw.denomination_other_amount);
    cash += denomination.denomination_other_amount || 0;
    // PHP left the 1000 notes out of this check
    if (round(cash) !== totalAmount) {
      addError('denomination', `Denomination total (Rs. ${money(cash)}) and total amount (Rs. ${money(totalAmount)}) are not the same.`);
    }
  }

  if (Object.keys(errors).length) return { errors };
  return {
    row: {
      date_of_deposit: dateOfDeposit,
      bank_id: bankId,
      payment_mode: mode,
      total_amount: totalAmount,
      remarks
    },
    items,
    denomination
  };
};

const saveLines = async (paymentId, items, denomination, transaction) => {
  await execute(`delete from payment_details_items where payment_id = :paymentId`, { paymentId }, transaction);
  for (const item of items) {
    await insertRow('payment_details_items', { ...item, payment_id: paymentId }, transaction);
  }
  await execute(`delete from payment_slip_denomination where payment_id = :paymentId`, { paymentId }, transaction);
  if (denomination) {
    await insertRow('payment_slip_denomination', { ...denomination, payment_id: paymentId }, transaction);
  }
};

// The pending copy (ref_id) that carries a change or deletion of an approved entry
const saveCopy = async (original, built, status, userId, now, transaction) => {
  const copy = await findPendingCopy(original.id, transaction);
  const row = {
    ...built.row,
    status,
    modified_by: userId,
    modified_on: now,
    ref_id: original.id,
    file_id: original.file_id,
    upload_type: original.upload_type,
    neft_no: original.neft_no,
    distributor_out_id: original.distributor_out_id,
    modified_approved_date: now
  };
  let id;
  if (copy) {
    id = copy.id;
    await updateRow('payment_details', id, row, transaction);
  } else {
    id = await insertRow('payment_details', { ...row, created_by: userId, created_on: now }, transaction);
  }
  await saveLines(id, built.items, built.denomination, transaction);
  return id;
};

export const createPayment = async (req, res, next) => {
  try {
    const built = await buildPayment(req, null);
    if (built.errors) return invalid(res, built.errors);
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const id = await insertRow('payment_details', {
        ...built.row, status: 'Pending', ref_id: null, created_by: userId, created_on: now, modified_by: userId, modified_on: now
      }, t);
      await saveLines(id, built.items, built.denomination, t);
      await t.commit();
      res.status(201).json({ message: "Payment submitted for approval!", id });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Saving payment failed!";
    next(error, req, res);
  }
};

// Submit For Approval on an existing entry (old PHP save_data without approve / reject / delete)
export const updatePayment = async (req, res, next) => {
  try {
    const existing = await findPayment(+req.params.id || 0);
    if (!existing) {
      return res.status(404).json({ message: "Payment not found!" });
    }
    if (!getPermissions(req, existing).submit) {
      return res.status(401).json({ message: "You cannot change this payment." });
    }
    const built = await buildPayment(req, existing);
    if (built.errors) return invalid(res, built.errors);
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      let id = existing.id;
      if (existing.status === 'Approved') {
        id = await saveCopy(existing, built, 'Pending', userId, now, t);
      } else {
        await updateRow('payment_details', id, { ...built.row, status: 'Pending', modified_by: userId, modified_on: now }, t);
        await saveLines(id, built.items, built.denomination, t);
      }
      await t.commit();
      res.status(200).json({ message: "Payment submitted for approval!", id });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Saving payment failed!";
    next(error, req, res);
  }
};

// Old PHP btn_delete: an approved entry gets a deletion request (Deleted, waiting for approval); any other is set InActive
export const deletePayment = async (req, res, next) => {
  try {
    const existing = await findPayment(+req.params.id || 0);
    if (!existing) {
      return res.status(404).json({ message: "Payment not found!" });
    }
    if (!getPermissions(req, existing).delete) {
      return res.status(401).json({ message: "You cannot delete this payment." });
    }
    const userId = req.userData.userId;
    const now = new Date();
    if (existing.status === 'Approved') {
      // The deletion request keeps the entry as it is (PHP saved whatever was on the form)
      const remarks = text((req.body || {}).remarks);
      if (!remarks) {
        return invalid(res, { remarks: { message: 'Give the reason for deleting this approved payment.' } });
      }
      const items = await select(`select * from payment_details_items where payment_id = :id order by id`, { id: existing.id });
      const [denomination] = await select(`select * from payment_slip_denomination where payment_id = :id limit 1`, { id: existing.id });
      const strip = ({ id, payment_id, ...rest }) => Object.fromEntries(
        Object.entries(rest).map(([key, value]) => [key, value instanceof Date && isNaN(value.getTime()) ? null : value])
      );
      const t = await sequelize.transaction();
      try {
        const id = await saveCopy(existing, {
          row: {
            date_of_deposit: toDate(existing.date_of_deposit), bank_id: existing.bank_id, payment_mode: existing.payment_mode,
            total_amount: existing.total_amount, remarks
          },
          items: items.map(strip),
          denomination: denomination ? strip(denomination) : null
        }, 'Deleted', userId, now, t);
        await t.commit();
        return res.status(200).json({ message: "Deletion submitted for approval!", id });
      } catch (error) {
        if (!t.finished) await t.rollback();
        throw error;
      }
    }
    await execute(
      `update payment_details set status = 'InActive', modified_by = :userId, modified_on = :now where id = :id`,
      { userId, now, id: existing.id }
    );
    res.status(200).json({ message: "Payment deleted!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Deleting payment failed!";
    next(error, req, res);
  }
};

// ---------- Credit / debit notes ----------

// Old PHP generate_credit_debit_note: on approval the payment's notes are redone from its lines marked
// Credit Debit = Yes (gateway uploads: one note per settlement for the commission); otherwise they follow its status.
export const setCreditDebitNotes = async (paymentId, status, userId, transaction) => {
  const now = new Date();
  if (status !== 'Approved') {
    await execute(
      `update credit_debit_note set status = :status, approved_by = :userId, approved_on = :now where payment_id = :paymentId`,
      { status, userId, now, paymentId }, transaction
    );
    return 0;
  }
  const [payment] = await select(`select date_of_deposit, upload_type from payment_details where id = :paymentId`, { paymentId }, transaction);
  const uploadType = text(payment && payment.upload_type);
  const gateway = GATEWAY_UPLOADS.includes(uploadType);
  await execute(
    `update credit_debit_note set status = 'InActive', remarks = concat(ifnull(remarks, ''), ' System generated update for payment entry modification.'),
       approved_by = :userId, approved_on = :now
     where payment_id = :paymentId and status <> 'InActive'`,
    { userId, now, paymentId }, transaction
  );
  const lines = gateway
    ? await select(
      `select distributor_id, 'On Account' as invoice_no, credit_debit, tax, narration,
         sum(commission) as commission, sum(payment_amount) as payment_amount, sum(gst) as gst
       from payment_details_items where payment_id = :paymentId
       group by distributor_id, ref_no, bank_name, bank_city, settlement_id, settlement_start_date, settlement_end_date, credit_debit, tax, narration`,
      { paymentId }, transaction)
    : await select(`select * from payment_details_items where payment_id = :paymentId order by id`, { paymentId }, transaction);

  const refDate = today();
  let created = 0;
  for (const line of lines) {
    if (!line.distributor_id || text(line.credit_debit).toUpperCase() !== 'YES') continue;
    const taxed = text(line.tax).toUpperCase() === 'YES';
    let paymentAmount = round(+line.payment_amount || 0);
    let transactionType;
    let reference;
    if (gateway || paymentAmount < 0) {
      transactionType = 'Credit Note';
      reference = 'CN';
      paymentAmount = Math.abs(paymentAmount);
    } else {
      transactionType = 'Debit Note';
      reference = 'DN';
    }
    const commission = +line.commission || 0;
    let gst = +line.gst || 0;
    let amount;
    if (uploadType === 'Razorpay' && text(line.narration) === 'Kalandari Transfer') {
      paymentAmount = paymentAmount + commission + gst;
      gst = 18;
      amount = round(paymentAmount / 1.18);
    } else if (gateway) {
      amount = round(commission);
      gst = taxed ? round(gst) : 0;
      paymentAmount = round(amount + gst);
      if (taxed && amount !== 0) gst = round((gst / amount) * 100);
    } else if (taxed) {
      gst = 18;
      amount = round(paymentAmount / 1.18);
    } else {
      gst = 0;
      amount = round(paymentAmount);
    }
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    if (taxed) {
      const [distributor] = await select(`select state_code from distributor_master where id = :id`, { id: line.distributor_id }, transaction);
      if (distributor && text(distributor.state_code) === '27') {
        cgst = round(amount * (gst / 2) / 100);
        sgst = cgst;
      } else {
        igst = round(amount * gst / 100);
      }
    }
    if (!(paymentAmount > 0)) continue;
    const series = await nextSeries(sequelize, 'Credit_debit_note', transaction);
    // PHP cut the financial year one character short (WHPL/2-CN/...)
    const refNo = `WHPL/${fiscalYear(refDate).split('-')[0]}-${reference}/${series}`;
    const onAccount = text(line.invoice_no) === ON_ACCOUNT || !text(line.invoice_no);
    await insertRow('credit_debit_note', {
      date_of_transaction: toDate(payment.date_of_deposit),
      distributor_id: line.distributor_id,
      transaction: transactionType,
      invoice_no: onAccount ? '' : line.invoice_no,
      distributor_type: onAccount ? 'Promotion' : 'Invoice',
      amount: paymentAmount,
      tax: gst,
      igst,
      cgst,
      sgst,
      amount_without_tax: amount,
      status: 'Approved',
      remarks: text(line.narration).replace(/'/g, ''),
      created_by: userId,
      created_on: now,
      modified_by: userId,
      modified_on: now,
      approved_by: userId,
      approved_on: now,
      ref_no: refNo,
      ref_date: refDate,
      exp_category_id: 6,
      payment_id: paymentId
    }, transaction);
    created++;
  }
  return created;
};

// ---------- Approve / Reject ----------

// Old PHP save_data with btn_approve: a change (ref_id) is written back into the approved entry; a deletion request
// makes it InActive. Credit / debit notes follow; the receipt voucher can then be printed.
export const approvePayment = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot approve payments." });
    }
    const id = +req.params.id || 0;
    const existing = await findPayment(id);
    if (!existing) {
      return res.status(404).json({ message: "Payment not found!" });
    }
    if (!getPermissions(req, existing).approve) {
      return res.status(401).json({ message: "You cannot approve this payment." });
    }
    const userId = req.userData.userId;
    const now = new Date();
    const remarks = text((req.body || {}).remarks) || text(existing.remarks);
    const t = await sequelize.transaction();
    try {
      const locked = await findPayment(id, t, true);
      if (!locked || (locked.status !== 'Pending' && locked.status !== 'Deleted')) {
        await t.rollback();
        return res.status(422).json({ message: "This payment is no longer waiting for approval." });
      }
      const status = locked.status === 'Deleted' ? 'InActive' : 'Approved';
      let paymentId = id;
      if (locked.ref_id) {
        const refId = +locked.ref_id;
        if (!(await select(`select id from payment_details where id = :refId for update`, { refId }, t)).length) {
          await t.rollback();
          return res.status(422).json({ message: `The payment this changes (#${refId}) no longer exists.` });
        }
        await execute(
          `update payment_details A, payment_details B
           set A.date_of_deposit = B.date_of_deposit, A.bank_id = B.bank_id, A.payment_mode = B.payment_mode,
             A.total_amount = B.total_amount, A.status = :status, A.remarks = :remarks,
             A.modified_by = B.modified_by, A.modified_on = B.modified_on,
             A.approved_by = :userId, A.approved_on = :now, A.modified_approved_date = :today
           where A.id = :refId and B.id = :id`,
          { status, remarks, userId, now, today: today(), refId, id }, t
        );
        await execute(`delete from payment_details_items where payment_id = :refId`, { refId }, t);
        await execute(`update payment_details_items set payment_id = :refId where payment_id = :id`, { refId, id }, t);
        await execute(`delete from payment_slip_denomination where payment_id = :refId`, { refId }, t);
        await execute(`update payment_slip_denomination set payment_id = :refId where payment_id = :id`, { refId, id }, t);
        await execute(`delete from payment_details where id = :id`, { id }, t);
        paymentId = refId;
      } else {
        await execute(
          `update payment_details set status = :status, remarks = :remarks, approved_by = :userId, approved_on = :now where id = :id`,
          { status, remarks, userId, now, id }, t
        );
      }
      const notes = await setCreditDebitNotes(paymentId, status, userId, t);
      await t.commit();
      res.status(200).json({
        message: status === 'InActive'
          ? "Payment deleted!"
          : `Payment approved!${notes ? ` ${notes} credit / debit note${notes > 1 ? 's' : ''} created.` : ''}`,
        id: paymentId,
        print: status === 'Approved'
      });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Approving payment failed!";
    next(error, req, res);
  }
};

// Old PHP btn_reject: the entry is set aside; a rejected change or deletion leaves the approved entry as it was
export const rejectPayment = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot reject payments." });
    }
    const id = +req.params.id || 0;
    const existing = await findPayment(id);
    if (!existing) {
      return res.status(404).json({ message: "Payment not found!" });
    }
    if (!getPermissions(req, existing).approve) {
      return res.status(401).json({ message: "You cannot reject this payment." });
    }
    const remarks = text((req.body || {}).remarks);
    if (!remarks) {
      return invalid(res, { remarks: { message: 'Give the reason for rejecting this payment.' } });
    }
    const userId = req.userData.userId;
    const now = new Date();
    const [result] = await execute(
      `update payment_details set status = 'Rejected', remarks = :remarks, rejected_by = :userId, rejected_on = :now
       where id = :id and (status = 'Pending' or status = 'Deleted')`,
      { remarks, userId, now, id }
    );
    if (!(result && result.affectedRows)) {
      return res.status(422).json({ message: "This payment is no longer waiting for approval." });
    }
    res.status(200).json({ message: "Payment rejected!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Rejecting payment failed!";
    next(error, req, res);
  }
};

// ---------- Receipt voucher ----------

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

// Old PHP generate_payment_slip (views/payment/payment_slip.php): one receipt voucher
const slipBody = async (payment, assetUrl) => {
  const items = await select(
    `select A.*, B.distributor_name from payment_details_items A left join distributor_master B on (A.distributor_id = B.id)
     where A.payment_id = :id order by A.id`,
    { id: payment.id }
  );
  const e = escapeHtml;
  const cheque = payment.payment_mode === 'Cheque';
  const total = +payment.total_amount || 0;
  // Old PHP payment_slip.php: an open grid. No outer left / right border, vertical lines between the columns,
  // no lines between the distributor rows; the heading and Total rows are ruled. Columns line up with the header
  // (Distributor 60%, Invoice No 22%, Amount 18%; with Cheque No the first two make room for it).
  const widths = cheque ? ['42%', '20%', '20%', '18%'] : ['60%', '22%', '18%'];
  const line = '1px solid #999';
  const cell = (content, { first = false, last = false, open = false, align = 'center', extra = '' } = {}) => `<td align="${align}" style="border-top:${line};border-bottom:${open ? 'none' : line};`
    + `border-left:${first ? 'none' : line};border-right:${last ? 'none' : line};${extra}">${content}</td>`;
  const row = (cells, open = false) => `<tr valign="top">${cells.map((content, index) => cell(content, {
    first: index === 0, last: index === cells.length - 1, open, align: index === 0 ? 'left' : 'center'
  })).join('')}</tr>`;
  const heading = row(['<p><b>Distributor Name</b></p>', '<p><b>Invoice No.</b></p>', ...(cheque ? ['<p><b>Cheque No.</b></p>'] : []), '<p><b>Amount</b></p>']);
  // Rows after the first have no top line either, so the distributor rows run on without separators
  const lines = items.map((item, index) => row([
    `<p>${e(item.distributor_name)}</p>`,
    `<p><b>${e(item.invoice_no)}</b></p>`,
    ...(cheque ? [`<p><b>${e(item.ref_no)}</b></p>`] : []),
    `<p><b>Rs. ${money(item.payment_amount)}</b></p>`
  ], true).replace(/border-top:[^;]*;/g, index === 0 ? '$&' : 'border-top:none;')).join('');
  const columns = widths.length;
  const totalRow = `<tr valign="top">${cell('<p><b>Total Amount</b></p>', { first: true, align: 'left', extra: '' }).replace('<td ', `<td colspan="${columns - 1}" `)}`
    + `${cell(`<p><b>Rs. ${money(total)}</b></p>`, { last: true })}</tr>`;
  const modified = fmtDateTime(payment.created_on) !== fmtDateTime(payment.modified_on);
  return `<div class="debit_note">
  <div class="header-section">
    <img src="${assetUrl}logo.png" alt="" style="vertical-align:top;width:150px" />
    <p style="font-size:12px;line-height:18px;margin:0 0 10px">Unit no 30,31,35,36,37 Samhita Complex, 13, Off Andheri-Kurla, Andheri East, Mumbai 400072 Maharashtra India
      <br />+91 8268000456<br /><a href="mailto:cs@eatanytime.in">cs@eatanytime.in</a><br />GSTIN: 27AABCW7811R1ZN</p>
  </div>
  <table class="info">
    <tr><td colspan="6" align="center"><h2><b>Receipt Voucher</b></h2></td></tr>
    <tr><td width="17%"><p>Ref.</p></td><td width="3%">:</td><td width="40%"><p><b>WHPL/RECEIPT/${e(fiscalYear(toDate(payment.date_of_deposit)))}/${payment.id}</b></p></td>
      <td width="22%"><p>Transaction Date</p></td><td width="4%">:</td><td width="14%"><p><b>${fmtDate(payment.date_of_deposit)}</b></p></td></tr>
    <tr><td><p>Bank name</p></td><td>:</td><td colspan="4"><p><b>${e(payment.b_name)}</b></p></td></tr>
    <tr><td style="vertical-align:top"><p>Deposit Mode</p></td><td style="vertical-align:top">:</td><td colspan="4"><p><b>${e(payment.payment_mode)}</b></p></td></tr>
  </table>
  <table style="margin-top:20px">
    <colgroup>${widths.map((width) => `<col width="${width}" />`).join('')}</colgroup>
    ${heading}
    ${lines}
    ${totalRow}
    <tr valign="top">
      <td style="height:40px;border:none;border-bottom:${line};border-right:${line}"><p><b>${e(numberToWords(total).trim())} Only</b></p></td>
      <td colspan="${columns - 1}" style="border:none;border-bottom:${line}"><p>Remarks: ${e(payment.remarks)}</p></td>
    </tr>
    <tr><td colspan="${columns}" style="border:none"><p style="text-align:center">This is a computer generated. No signature required.</p></td></tr>
  </table>
  <table class="user_data" style="margin-top:20px">
    <tr><td align="center"><b>Created By:</b> ${e(text(payment.createdby))}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      ${modified ? `<b>Modified By:</b> ${e(text(payment.modifiedby))}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;` : ''}<b>Approved By:</b> ${e(text(payment.approvedby))}</td></tr>
    <tr><td align="center"><b>Created On:</b> ${fmtDateTime(payment.created_on)}&nbsp;&nbsp;&nbsp;&nbsp;
      ${modified ? `<b>Modified On:</b> ${fmtDateTime(payment.modified_on)}&nbsp;&nbsp;&nbsp;&nbsp;` : ''}<b>Approved On:</b> ${fmtDateTime(payment.approved_on)}</td></tr>
  </table>
</div>`;
};

// Vouchers in one printable page, each on its own sheet
const slipPage = (title, bodies) => `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 0; letter-spacing: 0.5px; font-family: 'Source Sans Pro', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
  .debit_note { margin: 20px auto; max-width: 800px; }
  .header-section { text-align: center; }
  h2 { font-size: 23px; font-weight: 600; margin: 0; padding: 0 0 5px; text-align: center; }
  p { padding: 0; margin: 0; font-size: 13px; line-height: 21px; }
  table { margin: 10px 0; border-collapse: collapse; width: 100%; }
  td { padding: 3px 10px; }
  .info td { border: none; }
  .user_data td { border: none; padding: 5px; font-size: 12px; }
  @media print { .no-print { display: none; } @page { size: portrait; } }
  .page-break { page-break-after: always; break-after: page; }
</style></head>
<body>
<div class="no-print" style="text-align:right;padding:8px"><button onclick="window.print()">Print</button></div>
${bodies.join('<div class="page-break"></div>')}
</body></html>`;

// Receipt vouchers of several payments in one printout (Old Payment Upload)
export const renderSlips = async (ids, assetUrl, title) => {
  const bodies = [];
  for (const id of ids) {
    const payment = await findPayment(id);
    if (payment) bodies.push(await slipBody(payment, assetUrl));
  }
  return slipPage(title, bodies);
};

// The receipt voucher of an approved payment
export const getPaymentSlip = async (req, res, next) => {
  try {
    const payment = await findPayment(+req.params.id || 0);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found!" });
    }
    if (payment.status !== 'Approved') {
      return res.status(422).json({ message: "The receipt voucher is available once the payment is approved." });
    }
    const assetUrl = `${req.protocol}://${req.get('host')}/assets/invoice/`;
    res.status(200).json({ html: slipPage(`Receipt Voucher ${payment.id}`, [await slipBody(payment, assetUrl)]) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating receipt voucher failed!";
    next(error, req, res);
  }
};
