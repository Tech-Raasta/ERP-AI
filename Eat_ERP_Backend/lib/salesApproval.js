import { QueryTypes } from 'sequelize';

// Sales approval helpers (old PHP Distributor_out_model: save_data approve branch, set_ledger, set_credit_note).
// Every function runs inside the caller's transaction.

const select = (sequelize, sql, replacements, transaction) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
const execute = (sequelize, sql, replacements, transaction) => sequelize.query(sql, { replacements, transaction });

// Old PHP calculateFiscalYearForDate: '2026-10-28' -> '26-27', '2027-02-01' -> '26-27'
export const fiscalYear = (date) => {
  if (!date) return '';
  const [year, month] = date.toString().substring(0, 10).split('-').map((part) => parseInt(part));
  const start = month < 4 ? year - 1 : year;
  return `${String(start).substring(2)}-${String(start + 1).substring(2)}`;
};

// Next number of a series_master type. The row is locked so two approvals never share a number
// (old PHP read and incremented without a lock).
export const nextSeries = async (sequelize, type, transaction) => {
  const rows = await select(sequelize, `select id, series from series_master where type = :type for update`, { type }, transaction);
  if (rows.length) {
    const series = (parseInt(rows[0].series) || 0) + 1;
    await execute(sequelize, `update series_master set series = :series where id = :id`, { series, id: rows[0].id }, transaction);
    return series;
  }
  await execute(sequelize, `insert into series_master (type, series) values (:type, 1)`, { type }, transaction);
  return 1;
};

const LEDGER_ENTRIES = [
  { entry_type: 'Total Amount', type: 'Debit', ledger_type: 'Main Entry', amount: 'invoice_amount' },
  { entry_type: 'Taxable Amount', type: 'Credit', ledger_type: 'Sub Entry', amount: 'amount', acc_id: 1, ledger_name: 'Sales' },
  { entry_type: 'Tax', type: 'Credit', ledger_type: 'Sub Entry', amount: 'tax_amount', acc_id: 2, ledger_name: 'GST' },
  { entry_type: 'Shipping Charges', type: 'Credit', ledger_type: 'Sub Entry', amount: 'shipping_charges', acc_id: 3, ledger_name: 'Shipping Charges' }
];

// Old PHP set_ledger: distributor debited with the invoice amount; Sales, GST and Shipping Charges credited.
// Returns false when the distributor has no approved account ledger (PHP skipped silently).
export const setLedger = async (sequelize, id, userId, transaction) => {
  const rows = await select(sequelize,
    `select A.*, B.id as acc_id, B.ledger_name
     from distributor_out A
     left join account_ledger_master B on (A.distributor_id = B.ref_id and B.ref_type = 'Distributor')
     where A.id = :id and B.status = 'Approved'
     limit 1`,
    { id }, transaction
  );
  if (!rows.length) return false;

  const sale = rows[0];
  const now = new Date();
  const existing = await select(sequelize,
    `select id, entry_type, voucher_id from account_ledger_entries where ref_id = :id and ref_type = 'Distributor_Sales'`,
    { id }, transaction
  );
  let voucherId = existing.length ? existing[0].voucher_id : null;

  for (const entry of LEDGER_ENTRIES) {
    const data = {
      ref_id: id,
      ref_type: 'Distributor_Sales',
      entry_type: entry.entry_type,
      invoice_no: sale.invoice_no,
      vendor_id: sale.distributor_id,
      acc_id: entry.acc_id || sale.acc_id,
      ledger_name: entry.ledger_name || sale.ledger_name,
      type: entry.type,
      amount: +sale[entry.amount] || 0,
      status: sale.status,
      is_active: 1,
      ledger_type: entry.ledger_type,
      narration: sale.remarks,
      ref_date: sale.invoice_date || sale.date_of_processing,
      modified_by: userId,
      modified_on: now
    };

    const row = existing.find((item) => item.entry_type === entry.entry_type);
    if (row) {
      await execute(sequelize,
        `update account_ledger_entries set ${Object.keys(data).map((key) => `${key} = :${key}`).join(', ')} where id = :rowId`,
        { ...data, rowId: row.id }, transaction
      );
      continue;
    }

    // PHP only updated when entries existed, so a row missing from an older voucher (e.g. Shipping Charges) was never added
    if (!voucherId) {
      voucherId = await nextSeries(sequelize, 'Account_Voucher', transaction);
    }
    const insert = { ...data, voucher_id: voucherId, created_by: userId, created_on: now };
    await execute(sequelize,
      `insert into account_ledger_entries (${Object.keys(insert).join(', ')}) values (${Object.keys(insert).map((key) => `:${key}`).join(', ')})`,
      insert, transaction
    );
  }
  return true;
};

// Old PHP set_credit_note: the promotion charges expense voucher ('SG - Promotion Charges', 18% GST) for the
// difference between what was invoiced and MRP less the item margin, promotion margin and sale discount.
// PHP guarded it with "bal_amount <= -1 && bal_amount >= 1", which is never true, so it never created one;
// switched on (approved by the business) with the intended "<= -1 || >= 1".
export const setCreditNote = async (sequelize, id, transaction) => {
  const sale = (await select(sequelize, `select * from distributor_out where id = :id`, { id }, transaction))[0];
  if (!sale) return;

  const existing = (await select(sequelize,
    `select id, ref_no, ref_date, modified_approved_date from credit_debit_note where distributor_out_id = :id order by id limit 1`,
    { id }, transaction
  ))[0];

  const discount = +sale.discount || 0;
  const items = await select(sequelize, `select * from distributor_out_items where distributor_out_id = :id`, { id }, transaction);
  let totalInvAmount = 0;
  let totalAmount = 0;
  let taxType = 'Intra';
  for (const item of items) {
    if ((+item.igst_amt || 0) > 0) taxType = 'Inter';
    totalInvAmount += +item.total_amt || 0;
    const totalMargin = (+item.margin_per || 0) + (+item.promo_margin || 0) + discount;
    const rate = +item.rate || 0;
    totalAmount += (+item.qty || 0) * (rate - (rate * totalMargin) / 100);
  }
  const round = (value, decimals = 0) => Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const balAmount = round(round(totalInvAmount, 2) - round(totalAmount, 2));

  // Nothing to book (or the sale was cancelled): a note made earlier is cancelled (PHP did not handle cancelled sales)
  if ((balAmount > -1 && balAmount < 1) || sale.status !== 'Approved') {
    if (existing) {
      await execute(sequelize, `update credit_debit_note set status = 'InActive' where id = :noteId`, { noteId: existing.id }, transaction);
    }
    return;
  }

  let refNo = existing ? existing.ref_no : null;
  let refDate = existing ? existing.ref_date : null;
  if (!existing) {
    const series = await nextSeries(sequelize, 'Credit_debit_note', transaction);
    const now = new Date();
    refDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    refNo = `WHPL/${fiscalYear(refDate).split('-')[0]}-EXP/${series}`;
  }

  const taxPer = 18;
  const amountWithoutTax = round(balAmount / (1 + taxPer / 100), 4);
  const cgst = taxType === 'Intra' ? round((amountWithoutTax * (taxPer / 2)) / 100, 4) : 0;
  const sgst = taxType === 'Intra' ? round((amountWithoutTax * (taxPer / 2)) / 100, 4) : 0;
  const igst = taxType === 'Intra' ? 0 : round((amountWithoutTax * taxPer) / 100, 4);

  const data = {
    date_of_transaction: sale.invoice_date || sale.date_of_processing,
    distributor_id: sale.distributor_id,
    transaction: 'Expense Voucher',
    invoice_no: sale.invoice_no,
    distributor_type: 'Invoice',
    amount: round(amountWithoutTax + cgst + sgst + igst),
    tax: taxPer,
    igst,
    cgst,
    sgst,
    amount_without_tax: amountWithoutTax,
    status: 'Approved',
    remarks: `SG - Promotion Charges Expense Voucher against invoice no ${sale.invoice_no}`,
    created_by: sale.created_by,
    created_on: sale.created_on,
    modified_by: sale.modified_by,
    modified_on: sale.modified_on,
    approved_by: sale.approved_by,
    approved_on: sale.approved_on,
    rejected_by: sale.rejected_by,
    rejected_on: sale.rejected_on,
    ref_no: refNo,
    ref_date: refDate,
    modified_approved_date: existing ? existing.modified_approved_date : null,
    distributor_out_id: id,
    exp_category_id: 1
  };

  const keys = Object.keys(data);
  if (existing) {
    await execute(sequelize,
      `update credit_debit_note set ${keys.map((key) => `${key} = :${key}`).join(', ')} where id = :noteId`,
      { ...data, noteId: existing.id }, transaction
    );
  } else {
    await execute(sequelize,
      `insert into credit_debit_note (${keys.join(', ')}) values (${keys.map((key) => `:${key}`).join(', ')})`,
      data, transaction
    );
  }
};

// Columns a pending copy (ref_id) writes back into the approved sale (old PHP approve query),
// plus the basis-of-sales / email fields PHP forgot, which made those edits vanish on approval.
export const MERGE_COLUMNS = [
  'date_of_processing', 'depot_id', 'distributor_id', 'sales_rep_id', 'amount', 'tax', 'tax_per', 'tax_amount',
  'final_amount', 'due_date', 'order_no', 'order_date', 'ref_invoice_no', 'ref_invoice_details', 'ref_invoice_date',
  'supplier_ref', 'despatch_doc_no', 'despatch_through', 'destination', 'modified_by', 'modified_on',
  'client_name', 'address', 'city', 'pincode', 'state', 'country', 'mobile_no', 'discount', 'sample_distributor_id',
  'delivery_status', 'delivery_date', 'receivable_doc', 'transport_type', 'vehicle_number', 'cgst', 'sgst', 'igst',
  'cgst_amount', 'sgst_amount', 'igst_amount', 'reverse_charge', 'shipping_address', 'distributor_consignee_id',
  'con_name', 'con_address', 'con_city', 'con_pincode', 'con_state', 'con_country', 'con_state_code', 'con_gst_number',
  'state_code', 'sample_type', 'gifting_remarks', 'promoter_sales_rep_id', 'blogger_name', 'blogger_address',
  'blogger_phone_no', 'blogger_email_id', 'round_off_amount', 'invoice_amount', 'gstin', 'unique_ref_no', 'shipping_charges',
  'basis_of_sales', 'email_from', 'email_approved_by', 'email_date_time'
];
