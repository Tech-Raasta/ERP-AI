import { query, roundTo, ReportError } from './engine.js';

// Accounting and distributor reports (old PHP Export_model). repId is the report's tick on the User Roles screen.

const dateRange = { name: 'dates', type: 'dateRange', label: 'Period' };
const money = (key, header, extra = {}) => ({ key, header, type: 'money', ...extra });
const number = (key, header, extra = {}) => ({ key, header, type: 'number', ...extra });
const text = (key, header, extra = {}) => ({ key, header, ...extra });
const date = (key, header) => ({ key, header, type: 'date' });

// ---------- Distributor Ledger (rep 5) ----------

const SALE_TYPE = `case when distributor_in_type = 'exchanged' then 'Sales Exchanged Out' when distributor_in_type = 'expired' then 'Sales Expired Out'`;

// The movements of one distributor. The payment remark keeps its invoice no when the payment has no remark (PHP's concat
// gave nothing at all).
const ledgerLines = (condition) => `
  select invoice_date as ref_date, ${SALE_TYPE} else invoice_no end as reference, invoice_amount as debit_amount, null as credit_amount,
    date_of_processing as rdate, remarks, ${SALE_TYPE} else 'Sale' end as type, order_no
  from distributor_out where status = 'Approved' and distributor_id = :distributorId and ${condition('invoice_date')}
  union all
  select date_of_processing, sales_return_no, null, final_amount, date_of_processing, remarks, 'Sales Return', order_no
  from distributor_in where status = 'Approved' and distributor_id = :distributorId and ${condition('date_of_processing')}
  union all
  select A.date_of_deposit, A.id, null, B.payment_amount, A.date_of_deposit, concat_ws(' - ', B.invoice_no, A.remarks), 'Payment', ''
  from payment_details A join payment_details_items B on (A.id = B.payment_id)
  where A.status = 'Approved' and B.distributor_id = :distributorId and B.payment_amount is not null and ${condition('A.date_of_deposit')}
  union all
  select date_of_transaction, ref_no,
    case when transaction = 'Debit Note' or transaction = 'Expense Voucher Reversal' then amount end,
    case when transaction = 'Credit Note' or transaction = 'Expense Voucher' then amount end,
    date_of_transaction, remarks, transaction, ''
  from credit_debit_note where status = 'Approved' and distributor_id = :distributorId and ${condition('date_of_transaction')}`;

const distributorLedger = {
  key: 'distributor-ledger',
  name: 'Distributor Ledger',
  group: 'Accounting',
  repId: 5,
  description: 'Every sale, return, payment and note of a distributor, with the running balance.',
  filters: [
    { name: 'distributor_id', type: 'distributor', label: 'Distributor', required: true },
    dateRange,
    { name: 'remarks', type: 'checkbox', label: 'Show remarks', default: true }
  ],
  run: async (ctx) => {
    const distributorId = +ctx.filters.distributor_id;
    const { fromDate, toDate } = ctx.filters;
    const [distributor] = await query(`select distributor_name from distributor_master where id = :distributorId`, { distributorId });
    if (!distributor) throw new ReportError('Distributor not found.');
    const replacements = { distributorId, fromDate, toDate };
    const [[opening], lines] = await Promise.all([
      query(
        `select ifnull(sum(debit_amount), 0) as debit_amount, ifnull(sum(credit_amount), 0) as credit_amount
         from (${ledgerLines((column) => `${column} < :fromDate`)}) A`,
        replacements
      ),
      query(
        `select * from (${ledgerLines((column) => `${column} >= :fromDate and ${column} <= :toDate`)}) A order by A.rdate asc, A.ref_date asc`,
        replacements
      )
    ]);
    let balance = (+opening.debit_amount || 0) - (+opening.credit_amount || 0);
    const rows = [{
      ref_date: fromDate, type: 'Opening Balance', reference: 'Opening Balance',
      debit_amount: roundTo(opening.debit_amount), credit_amount: roundTo(opening.credit_amount), running_balance: roundTo(balance)
    }];
    lines.forEach((line) => {
      balance += (+line.debit_amount || 0) - (+line.credit_amount || 0);
      rows.push({ ...line, running_balance: roundTo(balance) });
    });
    const totalDebit = rows.reduce((sum, row) => sum + (+row.debit_amount || 0), 0);
    const totalCredit = rows.reduce((sum, row) => sum + (+row.credit_amount || 0), 0);
    return {
      subtitle: distributor.distributor_name,
      sheets: [{
        name: 'Ledger Account',
        columns: [
          date('ref_date', 'Ref Date'), text('type', 'Type', { width: 20 }), text('reference', 'Reference', { width: 24 }),
          money('debit_amount', 'Debit', { total: true }), money('credit_amount', 'Credit', { total: true }), money('running_balance', 'Running Balance'),
          ...(ctx.filters.remarks ? [text('remarks', 'Remarks', { width: 40 })] : []), text('order_no', 'Order No')
        ],
        rows,
        footer: [{ label: 'Closing Balance', key: 'credit_amount', value: roundTo(totalDebit - totalCredit) }]
      }]
    };
  }
};

// ---------- All Distributor Ledger (rep 14) ----------

const allDistributorLedger = {
  key: 'all-distributor-ledger',
  name: 'All Distributor Ledger',
  group: 'Accounting',
  repId: 14,
  description: 'Sales, returns, payments and notes of every distributor in the period.',
  filters: [dateRange],
  run: async (ctx) => {
    const rows = await query(
      `select A.date_of_processing as ref_date, A.invoice_no as reference, A.invoice_amount as debit_amount, null as credit_amount, M.distributor_name, A.remarks
       from distributor_out A left join distributor_master M on (A.distributor_id = M.id)
       where A.status = 'Approved' and A.invoice_date >= :fromDate and A.invoice_date <= :toDate
       union all
       select A.date_of_processing, null, null, A.final_amount, M.distributor_name, A.remarks
       from distributor_in A left join distributor_master M on (A.distributor_id = M.id)
       where A.status = 'Approved' and A.date_of_processing >= :fromDate and A.date_of_processing <= :toDate
       union all
       select A.date_of_deposit, B.invoice_no, null, B.payment_amount, M.distributor_name, A.remarks
       from payment_details A join payment_details_items B on (A.id = B.payment_id) left join distributor_master M on (B.distributor_id = M.id)
       where A.status = 'Approved' and A.date_of_deposit >= :fromDate and A.date_of_deposit <= :toDate and B.payment_amount is not null
       union all
       select A.date_of_transaction, A.transaction,
         case when A.transaction = 'Debit Note' or A.transaction = 'Expense Voucher Reversal' then A.amount end,
         case when A.transaction = 'Credit Note' or A.transaction = 'Expense Voucher' then A.amount end,
         M.distributor_name, A.remarks
       from credit_debit_note A join distributor_master M on (A.distributor_id = M.id)
       where A.status = 'Approved' and A.date_of_transaction >= :fromDate and A.date_of_transaction <= :toDate
       order by ref_date`,
      { fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate }
    );
    const totalOf = (key) => rows.reduce((sum, row) => sum + (+row[key] || 0), 0);
    return {
      sheets: [{
        name: 'All Distributor Ledger',
        columns: [
          date('ref_date', 'Ref Date'), text('distributor_name', 'Distributor Name', { width: 36 }), text('reference', 'Reference', { width: 24 }),
          money('debit_amount', 'Debit', { total: true }), money('credit_amount', 'Credit', { total: true }), text('remarks', 'Remarks', { width: 40 })
        ],
        rows,
        footer: [{ label: 'Net Balance', key: 'credit_amount', value: roundTo(totalOf('debit_amount') - totalOf('credit_amount')) }]
      }]
    };
  }
};

// ---------- Aging Wise (rep 6) ----------

// House and internal accounts PHP leaves out of aging
const NOT_AGED = '1, 64, 65, 66, 189, 237';

// Each entry falls in a band by its age on the date; payments and notes reduce the band of their own date, as in PHP
const agingWise = {
  key: 'aging-wise',
  name: 'Aging Wise',
  group: 'Accounting',
  repId: 6,
  description: 'What each distributor owes on a date, split by how old it is.',
  filters: [{ name: 'date', type: 'date', label: 'Date' }],
  run: async (ctx) => {
    const rows = await query(
      `select B.distributor_id, H.distributor_name, S.distributor_type, T.sales_rep_name, Q.area, U.location, W.zone,
         max(X.sales_rep_name) as so1, max(Y.sales_rep_name) as so2, B.days_0_30, B.days_30_45, B.days_46_60, B.days_61_90, B.days_91_above,
         round(B.days_0_30 + B.days_30_45 + B.days_46_60 + B.days_61_90 + B.days_91_above, 0) as tot_receivable
       from
       (select A.distributor_id,
          round(ifnull(sum(case when A.no_of_days < 30 then A.amount else 0 end), 0), 0) as days_0_30,
          round(ifnull(sum(case when A.no_of_days >= 30 and A.no_of_days <= 45 then A.amount else 0 end), 0), 0) as days_30_45,
          round(ifnull(sum(case when A.no_of_days >= 46 and A.no_of_days <= 60 then A.amount else 0 end), 0), 0) as days_46_60,
          round(ifnull(sum(case when A.no_of_days >= 61 and A.no_of_days <= 90 then A.amount else 0 end), 0), 0) as days_61_90,
          round(ifnull(sum(case when A.no_of_days >= 91 then A.amount else 0 end), 0), 2) as days_91_above
        from
        (select distributor_id, datediff(:date, date_of_processing) as no_of_days, invoice_amount as amount
         from distributor_out where status = 'Approved' and invoice_date <= :date and distributor_id not in (${NOT_AGED})
         union all
         select B.distributor_id, datediff(:date, A.date_of_deposit), B.payment_amount * -1
         from payment_details A join payment_details_items B on (A.id = B.payment_id)
         where A.status = 'Approved' and A.date_of_deposit <= :date and B.distributor_id not in (${NOT_AGED})
         union all
         select distributor_id, datediff(:date, date_of_processing), final_amount * -1
         from distributor_in where status = 'Approved' and date_of_processing <= :date and distributor_id not in (${NOT_AGED})
         union all
         select distributor_id, datediff(:date, date_of_transaction),
           case when transaction = 'Credit Note' or transaction = 'Expense Voucher' then amount * -1 else amount end
         from credit_debit_note where status = 'Approved' and date_of_transaction <= :date and distributor_id not in (${NOT_AGED})) A
        group by A.distributor_id) B
       left join distributor_master H on (B.distributor_id = H.id)
       left join distributor_type_master S on (H.type_id = S.id) left join sales_rep_master T on (H.sales_rep_id = T.id)
       left join area_master Q on (H.area_id = Q.id) left join location_master U on (H.location_id = U.id) left join zone_master W on (H.zone_id = W.id)
       left join sr_mapping V on (H.type_id = V.type_id and H.zone_id = V.zone_id and H.area_id = V.area_id)
       left join sales_rep_master X on (V.sales_rep_id1 = X.id) left join sales_rep_master Y on (V.sales_rep_id2 = Y.id)
       where round(B.days_0_30 + B.days_30_45 + B.days_46_60 + B.days_61_90 + B.days_91_above, 0) <> 0
       group by B.distributor_id, H.distributor_name, S.distributor_type, T.sales_rep_name, Q.area, U.location, W.zone,
         B.days_0_30, B.days_30_45, B.days_46_60, B.days_61_90, B.days_91_above`,
      { date: ctx.filters.date }
    );
    return {
      sheets: [{
        name: 'Aging Wise',
        columns: [
          number('distributor_id', 'Distributor Id', { decimals: 0 }), text('distributor_name', 'Distributor Name', { width: 36 }),
          money('days_0_30', '0 - 30 Days', { total: true }), money('days_30_45', '30 - 45 Days', { total: true }), money('days_46_60', '46 - 60 Days', { total: true }),
          money('days_61_90', '61 - 90 Days', { total: true }), money('days_91_above', '91+', { total: true }), money('tot_receivable', 'Total Receivable', { total: true }),
          text('distributor_type', 'Distributor Type'), text('sales_rep_name', 'Sales Representative Name'), text('so1', 'SO1'), text('so2', 'SO2'),
          text('zone', 'Zone'), text('area', 'Area'), text('location', 'Location')
        ],
        rows
      }]
    };
  }
};

// ---------- Ledger Balance (rep 20, shown with the Ledger tick) ----------

// Taken per distributor. PHP listed only distributors with entries in the period, so one with an opening balance and no
// entries vanished from the report, and it grouped by name, joining two distributors of the same name. The closing
// balance adjustment and the Tally upload on PHP's screen change data, so they are not part of this report.
const ledgerBalance = {
  key: 'ledger-balance',
  name: 'Ledger Balance',
  group: 'Accounting',
  repId: 16,
  description: 'Opening balance, debits, credits and closing balance of every distributor.',
  filters: [
    dateRange,
    { name: 'includes_zero', type: 'checkbox', label: 'Include zero closing balance' },
    { name: 'includes_twenty', type: 'checkbox', label: 'Only closing balance under 20' }
  ],
  run: async (ctx) => {
    const { fromDate, toDate, includes_zero: includesZero, includes_twenty: underTwenty } = ctx.filters;
    const rows = await query(
      `select A.distributor_id, M.distributor_name,
         round(ifnull(sum(case when A.moved_on < :fromDate then ifnull(A.debit, 0) - ifnull(A.credit, 0) end), 0), 2) as opening_balance,
         round(ifnull(sum(case when A.moved_on >= :fromDate then A.debit end), 0), 2) as debit_amount,
         round(ifnull(sum(case when A.moved_on >= :fromDate then A.credit end), 0), 2) as credit_amount
       from
       (select distributor_id, invoice_date as moved_on, invoice_amount as debit, null as credit from distributor_out where status = 'Approved' and invoice_date <= :toDate
        union all
        select distributor_id, date_of_processing, null, final_amount from distributor_in where status = 'Approved' and date_of_processing <= :toDate
        union all
        select B.distributor_id, A.date_of_deposit, null, B.payment_amount from payment_details A join payment_details_items B on (A.id = B.payment_id)
        where A.status = 'Approved' and A.date_of_deposit <= :toDate and B.payment_amount is not null
        union all
        select distributor_id, date_of_transaction,
          case when transaction = 'Debit Note' or transaction = 'Expense Voucher Reversal' then amount end,
          case when transaction = 'Credit Note' or transaction = 'Expense Voucher' then amount end
        from credit_debit_note where status = 'Approved' and date_of_transaction <= :toDate) A
       join distributor_master M on (A.distributor_id = M.id)
       group by A.distributor_id, M.distributor_name order by M.distributor_name`,
      { fromDate, toDate }
    );
    rows.forEach((row) => {
      row.closing_balance = roundTo(+row.opening_balance + +row.debit_amount - +row.credit_amount);
    });
    return {
      sheets: [{
        name: 'Ledger Balance',
        columns: [
          text('distributor_name', 'Distributor Name', { width: 40 }), money('opening_balance', 'Opening Balance', { total: true }),
          money('debit_amount', 'Debit', { total: true }), money('credit_amount', 'Credit', { total: true }), money('closing_balance', 'Closing Balance', { total: true })
        ],
        rows: rows.filter((row) => (includesZero || row.closing_balance !== 0) && (!underTwenty || row.closing_balance < 20))
      }]
    };
  }
};

// ---------- Payment Receivables (rep 9) ----------

// PHP joined payments to invoices row by row, so an invoice part-paid twice counted its full amount twice (1,000 paid
// 300 + 200 showed 1,500 pending, not 500). Payments are added up per invoice first. The sheet was also titled
// "Product Stock Report".
const paymentReceivables = {
  key: 'payment-receivables',
  name: 'Payment Receivables',
  group: 'Other',
  repId: 9,
  description: 'Unpaid invoices of each distributor, with the total pending.',
  filters: [dateRange],
  run: async (ctx) => {
    const invoices = await query(
      `select A.distributor_id, B.distributor_name, F.location, A.date_of_processing as invoice_date, A.due_date, A.invoice_no, A.voucher_no,
         round(A.invoice_amount, 0) - ifnull(P.paid, 0) as pending_amount
       from distributor_out A left join distributor_master B on (A.distributor_id = B.id) left join location_master F on (B.location_id = F.id)
       left join
       (select I.distributor_id, I.invoice_no, sum(round(I.payment_amount, 0)) as paid
        from payment_details D join payment_details_items I on (D.id = I.payment_id)
        where D.status = 'Approved' group by I.distributor_id, I.invoice_no) P
       on (A.distributor_id = P.distributor_id and A.invoice_no = P.invoice_no)
       where A.status = 'Approved' and A.invoice_no is not null and A.invoice_no <> '' and A.invoice_date >= :fromDate and A.invoice_date <= :toDate
       order by A.distributor_id, A.date_of_processing`,
      { fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate }
    );
    const totals = new Map();
    invoices.forEach((row) => totals.set(row.distributor_id, (totals.get(row.distributor_id) || 0) + (+row.pending_amount || 0)));
    const rows = invoices.filter((row) => +row.pending_amount > 0).map((row) => ({ ...row, total_pending_amount: roundTo(totals.get(row.distributor_id)) }));
    return {
      sheets: [{
        name: 'Payment Receivables',
        columns: [
          number('distributor_id', 'Distributor Id', { decimals: 0 }), text('distributor_name', 'Distributor Name', { width: 36 }), money('total_pending_amount', 'Total Pending Amount'),
          date('invoice_date', 'Invoice Date'), date('due_date', 'Due Date'), text('invoice_no', 'Invoice No', { width: 20 }), money('pending_amount', 'Amount', { total: true }),
          text('voucher_no', 'Voucher No'), text('location', 'Location')
        ],
        rows
      }]
    };
  }
};

// ---------- Distributor Master (rep 7) ----------

const distributorMaster = {
  key: 'distributor-master',
  name: 'Distributor Master',
  group: 'Other',
  repId: 7,
  description: 'Distributors changed in the period, with their contact and how recently they bought.',
  filters: [dateRange],
  run: async (ctx) => {
    const rows = await query(
      `select A.*, B.sales_rep_name, D.area, F.distributor_type, H.zone, N.location,
         J.contact_person as c_contact_person, J.email_id as c_email_id, J.mobile as c_mobile,
         case when L.no_of_days <= 90 then 'Active' when L.no_of_days <= 180 then 'Inactive' else 'Dormant' end as d_status
       from distributor_master A
       left join sales_rep_master B on (A.sales_rep_id = B.id) left join area_master D on (A.area_id = D.id)
       left join distributor_type_master F on (A.type_id = F.id) left join zone_master H on (A.zone_id = H.id)
       left join location_master N on (A.location_id = N.id)
       left join (select C.* from distributor_contacts C join (select distributor_id, min(id) as id from distributor_contacts group by distributor_id) M on (C.id = M.id)) J
         on (A.id = J.distributor_id)
       left join (select distributor_id, datediff(curdate(), max(date_of_processing)) as no_of_days from distributor_out where status = 'Approved' group by distributor_id) L
         on (A.id = L.distributor_id)
       where A.status = 'Approved' and date(A.modified_on) >= :fromDate and date(A.modified_on) <= :toDate
       order by A.id`,
      { fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate }
    );
    return {
      sheets: [{
        name: 'Distributor Master',
        columns: [
          number('id', 'Distributor Id', { decimals: 0 }), text('distributor_name', 'Distributor Name', { width: 36 }), text('address', 'Address', { width: 40 }), text('city', 'City'),
          text('pincode', 'Pincode'), text('state', 'State'), text('country', 'Country'), text('email_id', 'Email Id'), text('mobile', 'Mobile'),
          text('tin_number', 'Tin Number'), text('cst_number', 'Cst Number'), text('sales_rep_name', 'Sales Representative'), number('sell_out', 'Margin On MRP (In %)'),
          text('send_invoice', 'Generate Invoice'), text('credit_period', 'Credit Period (In Days)'), text('class', 'Class'), text('area', 'Area'),
          text('distributor_type', 'Type'), text('zone', 'Zone'), text('location', 'Location'), text('c_contact_person', 'Contact Person'),
          text('c_email_id', 'Contact Email Id'), text('c_mobile', 'Contact Mobile'), text('d_status', 'Status'), date('created_on', 'Created On'),
          date('modified_on', 'Modified On'), text('gst_number', 'GST Number')
        ],
        rows
      }]
    };
  }
};

// ---------- Sales Return (rep 8) ----------

// PHP worked tax out from the header's old cst rate, which GST-era returns do not fill, so their tax came to 0. The tax
// saved on each item is used; the rate is the fallback for old entries.
const salesReturn = {
  key: 'sales-return',
  name: 'Sales Return',
  group: 'Sales',
  repId: 8,
  description: 'Approved sales returns, item by item.',
  filters: [dateRange],
  run: async (ctx) => {
    if (!ctx.depotIds.length) return { sheets: [] };
    const rows = await query(
      `select A.id, A.date_of_processing, A.cst, B.type, B.qty, B.rate, B.sell_rate, B.amount, B.tax_amt, B.total_amt,
         case when B.type = 'Box' then H.box_name else J.short_name end as item_name, D.distributor_name, D.sell_out, F.depot_name
       from distributor_in A left join distributor_in_items B on (A.id = B.distributor_in_id)
       left join distributor_master D on (A.distributor_id = D.id) left join depot_master F on (A.depot_id = F.id)
       left join box_master H on (B.item_id = H.id) left join product_master J on (B.item_id = J.id)
       where A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_processing >= :fromDate and A.date_of_processing <= :toDate
       order by A.id`,
      { depotIds: ctx.depotIds, fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate }
    );
    rows.forEach((row) => {
      const amount = (+row.qty || 0) * (+row.sell_rate || 0);
      const hasItemTax = row.total_amt !== null && +row.total_amt !== 0;
      row.amount_excl = hasItemTax ? +row.amount || amount : amount;
      row.tax = hasItemTax ? +row.tax_amt || 0 : (amount * (+row.cst || 0)) / 100;
      row.total = hasItemTax ? +row.total_amt : amount + row.tax;
    });
    return {
      sheets: [{
        name: 'Sales Return',
        columns: [
          date('date_of_processing', 'Date Of Return'), text('distributor_name', 'Distributor Name', { width: 36 }), text('item_name', 'Name Of Product', { width: 32 }),
          text('type', 'Box/Bar'), number('qty', 'Qty', { total: true }), money('rate', 'MRP'), money('sell_rate', 'Sell Rate'), number('sell_out', 'Margin'),
          money('amount_excl', 'Amount (Excl Tax)', { total: true }), money('tax', 'Tax', { total: true }), money('total', 'Total Amount', { total: true }), text('depot_name', 'Depot')
        ],
        rows
      }]
    };
  }
};

// ---------- Distributor Transfer (rep 26, shown with the Raw Material Stock tick) ----------

// PHP used UNION, which dropped a second identical line of the same transfer
const distributorTransfer = {
  key: 'distributor-transfer',
  name: 'Distributor Transfer',
  group: 'Production',
  repId: 2,
  description: 'Stock moved between distributors.',
  filters: [dateRange],
  run: async (ctx) => {
    const rows = await query(
      `select A.date_of_transfer, B.distributor_name as dist_out_name, C.distributor_name as dist_in_name,
         case when I.type = 'Box' then BX.box_name else P.product_name end as product_name, I.type, I.qty
       from distributor_transfer A
       left join distributor_master B on (A.distributor_out_id = B.id) left join distributor_master C on (A.distributor_in_id = C.id)
       left join distributor_transfer_items I on (A.id = I.distributor_transfer_id)
       left join box_master BX on (I.item_id = BX.id) left join product_master P on (I.item_id = P.id)
       where A.status = 'Approved' and A.date_of_transfer > '2022-06-05' and A.date_of_transfer >= :fromDate and A.date_of_transfer <= :toDate
       order by A.date_of_transfer, A.id`,
      { fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate }
    );
    return {
      sheets: [{
        name: 'Distributor Transfer',
        columns: [
          date('date_of_transfer', 'Date Of Transfer'), text('dist_out_name', 'Distributor Out Name', { width: 34 }), text('dist_in_name', 'Distributor In Name', { width: 34 }),
          text('product_name', 'Product Name', { width: 32 }), text('type', 'Type'), number('qty', 'Quantity', { total: true })
        ],
        rows
      }]
    };
  }
};

export default [salesReturn, distributorLedger, allDistributorLedger, agingWise, ledgerBalance, paymentReceivables, distributorMaster, distributorTransfer];
