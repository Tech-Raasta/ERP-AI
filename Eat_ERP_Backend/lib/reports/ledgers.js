import { query, roundTo, ReportError } from './engine.js';

// General ledger reports (old PHP Export getledgerreport / gettrialbalancereport), from account_ledger_entries.
// Credit is positive and debit negative, as in PHP. repId is the report's tick on the User Roles screen.

const dateRange = { name: 'dates', type: 'dateRange', label: 'Period' };
const money = (key, header, extra = {}) => ({ key, header, type: 'money', ...extra });
const text = (key, header, extra = {}) => ({ key, header, ...extra });
const date = (key, header) => ({ key, header, type: 'date' });

const ACTIVE = `status = 'approved' and is_active = 1`;
const inPeriod = `${ACTIVE} and ref_date >= :fromDate and ref_date <= :toDate`;

// ---------- Trial Balance (rep 17) ----------

// PHP's query joined the groups on a column that does not exist (acc_id) and read an opening_bal column that does not
// exist, so this report could not run. Ledgers join their group by fk_group_id, and the opening balance is what the
// Ledger Report uses: the entries before the period. A ledger with only an opening balance is listed too, or the two
// sides would not agree.
const trialBalance = {
  key: 'trial-balance',
  name: 'Trial Balance',
  group: 'Accounting',
  repId: 17,
  description: 'Opening balance, debits, credits and closing balance of every account.',
  filters: [dateRange],
  run: async (ctx) => {
    const rows = await query(
      `select E.acc_id, ifnull(M.ledger_name, E.ledger_name) as ledger_name, M.ledger_type, G.group_name, E.opening_bal, E.debit_amt, E.credit_amt
       from
       (select acc_id, max(ledger_name) as ledger_name,
          ifnull(sum(case when ref_date < :fromDate then (case when type = 'Debit' then amount * -1 else amount end) end), 0) as opening_bal,
          ifnull(sum(case when ref_date >= :fromDate and type = 'Debit' then amount end), 0) as debit_amt,
          ifnull(sum(case when ref_date >= :fromDate and type = 'Credit' then amount end), 0) as credit_amt
        from account_ledger_entries where ${ACTIVE} and ref_date <= :toDate group by acc_id) E
       left join account_ledger_master M on (E.acc_id = M.id) left join account_group_master G on (M.fk_group_id = G.id)
       order by ledger_name`,
      { fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate }
    );
    const lines = rows
      .map((row) => {
        const opening = +row.opening_bal || 0;
        const closing = opening - (+row.debit_amt || 0) + (+row.credit_amt || 0);
        return {
          ...row,
          opening_debit: opening < 0 ? opening * -1 : null,
          opening_credit: opening >= 0 ? opening : null,
          closing_debit: closing < 0 ? closing * -1 : null,
          closing_credit: closing >= 0 ? closing : null
        };
      })
      .filter((row) => row.opening_debit || row.opening_credit || +row.debit_amt || +row.credit_amt);
    lines.forEach((row, index) => { row.sr_no = index + 1; });
    const totalOf = (key) => lines.reduce((sum, row) => sum + (+row[key] || 0), 0);
    // Stored vouchers do not always balance (rounding, entries with no voucher no), so the gap is shown, not hidden
    const difference = roundTo(totalOf('debit_amt') - totalOf('credit_amt'));
    return {
      sheets: [{
        name: 'Trial Balance',
        columns: [
          { key: 'sr_no', header: 'Sr No', type: 'number', decimals: 0, width: 8 }, text('ledger_name', 'Particulars', { width: 40 }), text('ledger_type', 'Account Category'),
          money('opening_debit', 'Opening Debit', { total: true }), money('opening_credit', 'Opening Credit', { total: true }),
          money('debit_amt', 'Transaction Debit', { total: true }), money('credit_amt', 'Transaction Credit', { total: true }),
          money('closing_debit', 'Closing Debit', { total: true }), money('closing_credit', 'Closing Credit', { total: true }), text('group_name', 'Business Category')
        ],
        rows: lines,
        footer: [{ label: 'Difference (Debit - Credit)', key: 'credit_amt', value: difference }]
      }]
    };
  }
};

// ---------- Ledger Report (rep 16) ----------

// The entries of one account, with the other side of each voucher shown as the ledger. A main entry is shown through
// the entries of its voucher, so PHP lost main entries that have no voucher no; they are listed as they are.
const ledgerLines = `
  select * from
  (select A.id, A.ref_id, A.invoice_no, A.acc_id, A.ledger_name, A.ledger_code,
     case when B.cp_acc_id = :accId then (case when A.type = 'Debit' then 'Credit' else 'Debit' end) else A.type end as type,
     A.amount, A.payment_ref, A.voucher_id, A.narration, A.ref_date, B.cp_acc_id, B.cp_ledger_name, B.cp_ledger_code
   from (select * from account_ledger_entries where ${inPeriod}
     and ref_type in ('Distributor_Sales', 'Distributor_Sales_Return') and ledger_type != 'Main Entry') A
   left join
   (select distinct voucher_id as cp_voucher_id, acc_id as cp_acc_id, ledger_name as cp_ledger_name, ledger_code as cp_ledger_code
    from account_ledger_entries where ${inPeriod}
      and ref_type in ('Distributor_Sales', 'Distributor_Sales_Return') and ledger_type = 'Main Entry') B
   on (A.voucher_id = B.cp_voucher_id)
   union all
   select A.id, A.ref_id, A.invoice_no, A.acc_id, A.ledger_name, A.ledger_code, A.type, A.amount, A.payment_ref, A.voucher_id, A.narration, A.ref_date,
     null, null, null
   from account_ledger_entries A where ${inPeriod} and ref_type in ('Distributor_Sales', 'Distributor_Sales_Return')
     and ledger_type = 'Main Entry' and voucher_id is null and acc_id = :accId
   union all
   select A.id, A.ref_id, A.invoice_no, A.acc_id, A.ledger_name, A.ledger_code,
     case when A.type = 'Debit' then 'Credit' else 'Debit' end, A.amount, A.payment_ref, A.voucher_id, A.narration, A.ref_date,
     B.acc_id, B.ledger_name, B.ledger_code
   from (select * from account_ledger_entries where ${inPeriod} and ref_type = 'journal_voucher' and acc_id != :accId) A
   left join (select * from account_ledger_entries where ${inPeriod} and ref_type = 'journal_voucher' and acc_id = :accId) B
   on (A.ref_id = B.ref_id)
   union all
   select A.id, A.ref_id, A.invoice_no, A.acc_id, A.ledger_name, A.ledger_code,
     case when B.cp_acc_id = :accId then (case when A.type = 'Debit' then 'Credit' else 'Debit' end) else A.type end,
     A.amount, A.payment_ref, A.voucher_id, A.narration, A.ref_date, B.cp_acc_id, B.cp_ledger_name, B.cp_ledger_code
   from (select * from account_ledger_entries where ${inPeriod} and ref_type = 'payment_receipt' and ledger_type = 'Main Entry') A
   left join
   (select distinct voucher_id as cp_voucher_id, acc_id as cp_acc_id, ledger_name as cp_ledger_name, ledger_code as cp_ledger_code
    from account_ledger_entries where ${inPeriod} and ref_type = 'payment_receipt' and ledger_type = 'Sub Entry') B
   on (A.voucher_id = B.cp_voucher_id)) AA
  where AA.acc_id = :accId or AA.cp_acc_id = :accId
  order by AA.ref_date, AA.id`;

const drCr = (value) => (value < 0 ? 'Dr' : 'Cr');

const ledgerReport = {
  key: 'ledger-report',
  name: 'Ledger Report',
  group: 'Accounting',
  repId: 16,
  description: 'Every entry of one account in the period, with the running balance.',
  filters: [{ name: 'ledger_id', type: 'ledger', label: 'Ledger', required: true }, dateRange],
  run: async (ctx) => {
    const accId = +ctx.filters.ledger_id;
    const { fromDate, toDate } = ctx.filters;
    const [ledger] = await query(`select ledger_name from account_ledger_master where id = :accId`, { accId });
    if (!ledger) throw new ReportError('Ledger not found.');
    const [[opening], entries] = await Promise.all([
      query(
        `select ifnull(sum(case when type = 'Debit' then amount * -1 else amount end), 0) as opening_bal
         from account_ledger_entries where acc_id = :accId and ${ACTIVE} and ref_date < :fromDate`,
        { accId, fromDate }
      ),
      query(ledgerLines, { accId, fromDate, toDate })
    ]);
    let balance = roundTo(opening.opening_bal);
    const rows = [{
      ref_date: fromDate, ledger_name: 'Opening Balance', balance: Math.abs(balance), balance_type: drCr(balance),
      ...(balance < 0 ? { debit: Math.abs(balance) } : { credit: balance })
    }];
    let totalDebit = 0;
    let totalCredit = 0;
    entries.forEach((entry, index) => {
      const amount = +entry.amount || 0;
      const isDebit = entry.type === 'Debit';
      if (isDebit) totalDebit += amount; else totalCredit += amount;
      balance = roundTo(balance + (isDebit ? amount * -1 : amount));
      // The other side of the voucher, or the entry's own ledger when there is none
      const other = entry.cp_acc_id && +entry.cp_acc_id !== accId && entry.cp_ledger_code;
      rows.push({
        sr_no: index + 1,
        voucher_id: entry.voucher_id,
        ref_date: entry.ref_date,
        ledger_code: other ? entry.cp_ledger_code : entry.ledger_code,
        ledger_name: other ? entry.cp_ledger_name : entry.ledger_name,
        ref_id: entry.ref_id,
        invoice_no: entry.invoice_no,
        debit: isDebit ? amount : null,
        credit: isDebit ? null : amount,
        balance: Math.abs(balance),
        balance_type: drCr(balance),
        payment_ref: entry.payment_ref,
        narration: entry.narration
      });
    });
    const movement = totalCredit - totalDebit;
    return {
      subtitle: ledger.ledger_name,
      sheets: [{
        name: 'Ledger',
        columns: [
          { key: 'sr_no', header: 'Sr No', type: 'number', decimals: 0, width: 8 }, text('voucher_id', 'Ref ID (Voucher No)'), date('ref_date', 'Date'), text('ledger_code', 'Ledger Code'),
          text('ledger_name', 'Ledger Name', { width: 36 }), text('ref_id', 'Ref 1'), text('invoice_no', 'Ref 2'), money('debit', 'Debit'), money('credit', 'Credit'),
          money('balance', 'Balance'), text('balance_type', 'DB/CR', { width: 8 }), text('payment_ref', 'Knock Off Ref'), text('narration', 'Narration', { width: 40 })
        ],
        rows,
        footer: [
          { label: `Period Total (${drCr(movement)})`, key: 'balance', value: roundTo(Math.abs(movement)) },
          { label: `Closing Balance (${drCr(balance)})`, key: 'balance', value: roundTo(Math.abs(balance)) }
        ]
      }]
    };
  }
};

export default [trialBalance, ledgerReport];
