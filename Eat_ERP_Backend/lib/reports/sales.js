import { query, dmy, roundTo, today, ReportError } from './engine.js';
import { buildSalesSummaryReport } from '../salesSummaryReport.js';

// Sales reports (old PHP Export_model). The Sales Report fills one row per item (SKU level) and one row per invoice
// (invoice level); PHP made two files and zipped them, here they are two sheets of one workbook.

const REPORT_START = '2019-04-01';
// Sample and Product Expired are distributors, not customers (PHP: 1 and 189)
const SAMPLE_PARTY = 1;
const EXPIRY_PARTY = 189;
const NO_EINVOICE_PARTIES = [SAMPLE_PARTY, EXPIRY_PARTY, 214];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Week of the month, Monday first
const week = (column) => `WEEK(${column}, 1) - WEEK(date_format(${column}, '%Y-%m-01'), 1) + 1`;

// PHP's round(): half away from zero
const roundPhp = (value, decimals = 0) => {
  const factor = Math.pow(10, decimals);
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
};
const minus = (value) => 0 - (+value || 0);
const isDirect = (row) => String(row.class || '').trim().toUpperCase() === 'DIRECT';
const isSampleType = (row) => String(row.distributor_type || '').toLowerCase() === 'sample';

const PLATFORMS = [
  ['cred', 'Cred'], ['goqii', 'Goqii'], ['smytten', 'Smytten'], ['buykaro', 'Buykaro'], ['ondc - paytm', 'ONDC - Paytm'],
  ['ondc - phonepay', 'ONDC - PhonePay'], ['meesho', 'Meesho'], ['amazon', 'Amazon'], ['eat anytime', 'Website'], ['eatanytime', 'Website'],
  ['flipkart', 'Flipkart'], ['dpanda', 'Dpanda'], ['pop', 'POP Club'], ['blink', 'Blinkit'], ['ondc', 'ONDC']
];
const platformOf = (name) => {
  const text = String(name || '').toLowerCase();
  const match = PLATFORMS.find(([prefix]) => text.startsWith(prefix));
  return match ? match[1] : '';
};

// Month, Quarter and Year of a row. Quarters are calendar quarters, as PHP had them.
const periodOf = (value) => {
  const [, month, year] = dmy(value).split('/').map(Number);
  return { month: MONTHS[month - 1] || '', quarter: month ? `Q${Math.ceil(month / 3)}` : '', year };
};

// Direct customers are grouped by where the order went
const directName = (row) => (row.state_code === row.depot_state_code
  ? `${row.prefix} Direct-Local`
  : `${row.prefix} OOS-${row.state_code}_${row.state}`);

const taxOf = (row) => {
  const tax = +row.tax_amt || 0;
  if (+row.igst_amt) return { cgst: 0, sgst: 0, igst: tax, tax };
  const cgst = roundPhp(tax / 2, 2);
  return { cgst, sgst: tax - cgst, igst: 0, tax };
};

// ---------- Shared parts of the queries ----------

// One sales team per area, type and zone: sr_mapping has repeats and a plain join counted those sales twice
const mapping = (keys) => `(select ${keys}, min(id) as id from sr_mapping group by ${keys})`;

const partyFields = `D.distributor_name, D.class, D.city as distributor_city, D.state as dist_state, D.state_code as dist_state_code,
  D.gst_number as dist_gst_no, D.prefix, E.distributor_type, F.sales_rep_name, G.location, H.area, K.zone,
  L.sales_rep_name as salesrepname, M.sales_rep_name as salesrepname1`;

const partyJoins = (column) => `
  left join distributor_master D on (${column} = D.id)
  left join distributor_type_master E on (D.type_id = E.id)
  left join location_master G on (D.location_id = G.id)
  left join area_master H on (D.area_id = H.id)
  left join zone_master K on (D.zone_id = K.id)
  left join ${mapping('area_id, type_id, zone_id')} J1 on (D.area_id = J1.area_id and D.type_id = J1.type_id and D.zone_id = J1.zone_id)
  left join sr_mapping J on (J1.id = J.id)
  left join sales_rep_master F on (J.reporting_manager_id = F.id)
  left join sales_rep_master L on (J.sales_rep_id1 = L.id)
  left join sales_rep_master M on (J.sales_rep_id2 = M.id)`;

const itemFields = `P.item_name, P.product_name, P.quantity, P.short_name, P.grams as item_grams, P.hsn_code as item_hsn, Y.category_name`;
const itemJoins = (type, id) => `
  left join (select id, 'Bar' as type, short_name as item_name, product_name, null as quantity, short_name, category_id, grams, hsn_code from product_master
             union all
             select m.id, 'Box', m.box_name, m.box_name, sum(p.qty), m.short_name, m.category_id, m.grams, m.hsn_code
             from box_master m left join box_product p on (m.id = p.box_id) group by m.id) P on (${id} = P.id and ${type} = P.type)
  left join category_master Y on (P.category_id = Y.id)`;

const orderStates = `(select order_no, min(state) as state, min(state_code) as state_code from distributor_out
  where status = 'Approved' and order_no is not null and order_no != '' and state is not null and state != '' and state_code is not null and state_code != ''
  group by order_no)`;

const between = (column) => `${column} >= '${REPORT_START}' and ${column} >= :fromDate and ${column} <= :toDate`;
const notSample = `(D.class != 'sample' or D.class is null)`;

// ---------- SKU level ----------

const skuColumns = [
  { key: 'month', header: 'Month', width: 11 }, { key: 'quarter', header: 'Quarter', width: 8 }, { key: 'year', header: 'Year', width: 7 },
  { key: 'accounting_date', header: 'Accounting Date', type: 'date' }, { key: 'processing_date', header: 'Processing Date', type: 'date' },
  { key: 'week', header: 'Week', width: 6 }, { key: 'type', header: 'Type', width: 16 }, { key: 'invoice_no', header: 'Invoice No', width: 18 },
  { key: 'item_name', header: 'Name of Product', width: 30 }, { key: 'short_name', header: 'Short Name', width: 18 },
  { key: 'item_type', header: 'Box/Bar', width: 8 }, { key: 'category_name', header: 'Category', width: 16 },
  { key: 'qty', header: 'Qty', type: 'number', total: true }, { key: 'bar_qty', header: 'Bar Equivalent', type: 'number', total: true },
  { key: 'rate', header: 'MRP', type: 'money' }, { key: 'sell_rate', header: 'Sell Rate', type: 'money' },
  { key: 'amount', header: 'Amount', type: 'money', total: true }, { key: 'cgst', header: 'CGST', type: 'money', total: true },
  { key: 'sgst', header: 'SGST', type: 'money', total: true }, { key: 'igst', header: 'IGST', type: 'money', total: true },
  { key: 'tax', header: 'Total Tax', type: 'money', total: true }, { key: 'round_off', header: 'Rounding Off Amount', type: 'money', total: true },
  { key: 'total', header: 'Amount with Tax', type: 'money', total: true }, { key: 'depot_name', header: 'Depot' },
  { key: 'party', header: 'Distributor', width: 30 }, { key: 'distributor_type', header: 'Distributor Type', width: 16 },
  { key: 'state_code', header: 'State Code', width: 8 }, { key: 'state', header: 'State of supply', width: 18 }, { key: 'gst_no', header: 'GST no', width: 18 },
  { key: 'zone', header: 'Zone', width: 14 }, { key: 'area', header: 'Area', width: 14 }, { key: 'city', header: 'City', width: 14 },
  { key: 'location', header: 'Location', width: 14 }, { key: 'reporting_manager', header: 'Reporting Manager' }, { key: 'so1', header: 'SO1' }, { key: 'so2', header: 'SO2' },
  { key: 'due_date', header: 'Due Date', type: 'date' }, { key: 'order_no', header: 'Order no', width: 18 }, { key: 'combo_box_name', header: 'Combo Box Name' },
  { key: 'order_date', header: 'Order Date', type: 'date' }, { key: 'remarks', header: 'Remarks', width: 30 }, { key: 'system_id', header: 'System ID', width: 10 },
  { key: 'status', header: 'Status', width: 10 }, { key: 'nature_of_expense', header: 'Nature Of Expense' }, { key: 'cost', header: 'Cost', type: 'money' },
  { key: 'hsn_code', header: 'HSN Code', width: 10 }, { key: 'grams', header: 'Unit Weight', type: 'number' }, { key: 'platform', header: 'Platform', width: 12 }
];

const dated = (accounting, processing, row) => ({
  ...periodOf(accounting), accounting_date: accounting, processing_date: processing, week: row.dweek, status: row.status
});

const barQty = (row) => (row.quantity === null || row.quantity === undefined ? 1 : +row.quantity) * (+row.qty || 0);

const itemCells = (row) => ({
  item_name: row.item_name, short_name: row.short_name, item_type: row.type, category_name: row.category_name, rate: row.rate, sell_rate: row.sell_rate
});
const partyCells = (row) => ({
  distributor_type: row.distributor_type, state_code: row.dist_state_code, state: row.dist_state, gst_no: row.dist_gst_no, zone: row.zone, area: row.area,
  city: row.distributor_city, location: row.location, reporting_manager: row.sales_rep_name, so1: row.salesrepname, so2: row.salesrepname1, party: row.distributor_name
});

const skuSales = async (replacements) => {
  const rows = await query(
    `select A.id as saleid, A.invoice_no, A.invoice_date, A.due_date, A.order_no, A.order_date, A.city, A.state, A.state_code, A.shipping_address,
       A.round_off_amount, A.status, A.remarks, A.con_state, A.con_state_code, A.con_gst_number, B.type, B.item_id, B.box_name, B.qty, B.bar_qty,
       B.sell_rate, B.rate, B.cost, B.item_amount, B.igst_amt, B.tax_amt, B.total_amt, C.depot_name, C.state_code as depot_state_code,
       ${partyFields}, ${itemFields}, N.combo_box_name, ${week('A.invoice_date')} as dweek,
       case when N.hsn = 'Yes' then N.hsn_code else P.hsn_code end as hsn_code
     from distributor_out A
     left join (select B.distributor_out_id,
         case when B.type = 'Bar' then 'Bar' when C.control_unit = 'Piece' then 'Bar' else 'Box' end as type,
         case when B.type = 'Bar' then B.item_id when C.control_unit = 'Piece' then C.product_id else B.item_id end as item_id,
         C.box_name, B.qty,
         case when B.type = 'Bar' then B.qty when C.control_unit = 'Piece' then ifnull(B.qty, 0) * ifnull(C.product_qty, 0) else B.qty end as bar_qty,
         B.sell_rate, B.rate, C.cost, B.amount as item_amount, B.igst_amt, B.tax_amt, B.total_amt, B.combo_box_id
       from distributor_out_items B left join box_master C on (B.type = 'Box' and B.item_id = C.id)) B on (A.id = B.distributor_out_id)
     left join depot_master C on (A.depot_id = C.id)
     ${partyJoins('A.distributor_id')}
     left join combo_box_master N on (B.combo_box_id = N.id)
     ${itemJoins('B.type', 'B.item_id')}
     where ${between('A.invoice_date')} and A.status = 'Approved' and A.distributor_id not in (${SAMPLE_PARTY}, ${EXPIRY_PARTY})
       and A.depot_id in (:depotIds) and ${notSample}
     order by A.invoice_date, A.invoice_no`,
    replacements
  );
  return rows.map((row, index) => {
    const { cgst, sgst, igst, tax } = taxOf(row);
    const party = isDirect(row)
      ? { party: directName(row), state_code: row.state_code, state: row.state, gst_no: null, city: row.city }
      : {
        ...(row.shipping_address === 'no' ? { state_code: row.con_state_code, state: row.con_state, gst_no: row.con_gst_number } : {})
      };
    const last = index === rows.length - 1 || rows[index + 1].invoice_no !== row.invoice_no;
    const roundOff = +row.round_off_amount || 0;
    const cells = { ...partyCells(row), ...party };
    return {
      ...dated(row.invoice_date, row.invoice_date, row), ...itemCells(row), ...cells,
      type: 'SALES', invoice_no: row.invoice_no, item_name: row.box_name || row.product_name, qty: row.qty, bar_qty: row.bar_qty,
      amount: row.item_amount, cgst, sgst, igst, tax, round_off: last ? roundOff : null, total: (+row.total_amt || 0) + (last ? roundOff : 0),
      depot_name: row.depot_name, due_date: row.due_date, order_no: row.order_no, combo_box_name: row.combo_box_name, order_date: row.order_date,
      remarks: row.remarks, system_id: row.saleid, cost: row.cost, hsn_code: row.hsn_code, grams: row.item_grams, platform: platformOf(cells.party)
    };
  });
};

// An allocation leaves the distributor (negative) and reaches the store (positive)
const skuAllocations = async (replacements) => {
  const stores = `(select store_id, type_id, zone_id, location_id, min(id) as id from store_master group by store_id, type_id, zone_id, location_id)`;
  const storeTeam = `
    left join ${mapping('area_id1, type_id, zone_id, location_id')} R1 on (S.store_id = R1.area_id1 and S.type_id = R1.type_id and S.zone_id = R1.zone_id and S.location_id = R1.location_id)
    left join sr_mapping R on (R1.id = R.id)
    left join sales_rep_master T on (R.reporting_manager_id = T.id)
    left join sales_rep_master U on (R.sales_rep_id1 = U.id)
    left join sales_rep_master W on (R.sales_rep_id2 = W.id)`;
  const fields = `A.id as ssid, A.date_of_processing, A.modified_on, A.remarks, A.status, B.type, B.item_id, B.qty, B.sell_rate, B.rate, B.amount as item_amount,
    ${week('A.date_of_processing')} as dweek, ${partyFields}, ${itemFields}, O.store_name, Q.distributor_type as d_type, Z.zone as d_zone,
    X.location as store_location, T.sales_rep_name as reporting_manager, U.sales_rep_name as sales1, W.sales_rep_name as sales2`;
  const common = `from distributor_sale A
    left join distributor_sale_items B on (A.id = B.distributor_sale_id)
    ${partyJoins('A.distributor_id')}
    ${itemJoins('B.type', 'B.item_id')}`;
  const [out, into] = await Promise.all([
    query(
      `select ${fields} ${common}
       left join store_master S on (A.to_distributor_id = S.id)
       left join relationship_master O on (S.store_id = O.id)
       left join zone_master Z on (S.zone_id = Z.id)
       left join distributor_type_master Q on (S.type_id = Q.id)
       left join location_master X on (S.location_id = X.id)
       ${storeTeam}
       where A.status = 'Approved' and ${between('A.date_of_processing')}`,
      replacements
    ),
    query(
      `select ${fields} ${common}
       left join relationship_master O on (A.store_id = O.id)
       left join ${stores} S1 on (O.id = S1.store_id and S1.type_id = 7 and A.zone_id = S1.zone_id and A.location_id = S1.location_id)
       left join store_master S on (S1.id = S.id)
       left join zone_master Z on (A.zone_id = Z.id)
       left join distributor_type_master Q on (O.type_id = Q.id)
       left join location_master X on (A.location_id = X.id)
       ${storeTeam}
       where A.status = 'Approved' and ${between('A.date_of_processing')}`,
      replacements
    )
  ]);
  const common2 = (row) => ({
    ...dated(row.date_of_processing, row.modified_on, row), ...itemCells(row),
    type: 'SSALLOCATION', invoice_no: 'SSALLOCATION', order_no: row.ssid, remarks: row.remarks, system_id: row.ssid
  });
  return [
    ...out.map((row) => ({
      ...common2(row), ...partyCells(row), so1: row.sales1, so2: row.sales2,
      qty: minus(row.qty), bar_qty: minus(barQty(row)), amount: minus(row.item_amount), total: minus(row.item_amount)
    })),
    ...into.map((row) => ({
      ...common2(row), party: row.store_name, distributor_type: row.d_type, zone: row.d_zone, area: row.store_name, city: row.distributor_city,
      location: row.store_location, reporting_manager: row.reporting_manager, so1: row.sales1, so2: row.sales2,
      qty: row.qty, bar_qty: barQty(row), amount: row.item_amount, total: row.item_amount
    }))
  ];
};

// A transfer leaves one distributor (negative) and reaches another (positive). It carries no value.
const skuTransfers = async (replacements) => {
  const side = (column) => query(
    `select A.id as transferid, A.date_of_transfer, A.modified_on, A.remarks, A.status, B.type, B.item_id, B.qty,
       ${week('A.date_of_transfer')} as dweek, ${partyFields}, ${itemFields}
     from distributor_transfer A
     left join distributor_transfer_items B on (A.id = B.distributor_transfer_id)
     ${partyJoins(column)}
     ${itemJoins('B.type', 'B.item_id')}
     where A.status = 'Approved' and ${between('A.date_of_transfer')} and ${notSample}
     order by A.date_of_transfer`,
    replacements
  );
  const [out, into] = await Promise.all([side('A.distributor_out_id'), side('A.distributor_in_id')]);
  const cells = (row, sign) => ({
    ...dated(row.date_of_transfer, row.modified_on, row), ...itemCells(row), ...partyCells(row),
    type: 'SSALLOCATION', invoice_no: 'TRANSFER', qty: sign * (+row.qty || 0), bar_qty: sign * barQty(row), amount: 0, total: 0,
    order_no: row.transferid, remarks: row.remarks, system_id: row.transferid
  });
  return [...out.map((row) => cells(row, -1)), ...into.map((row) => cells(row, 1))];
};

const skuSamples = async (replacements) => {
  const rows = await query(
    `select A.id as sampleid, A.distributor_id, A.invoice_date, A.voucher_no, A.due_date, A.sample_type, A.order_date, A.remarks, A.status, A.distributor_in_id,
       B.type, B.item_id, B.qty, B.sell_rate, B.rate, B.amount as item_amount, B.igst_amt, B.tax_amt, B.grams, C.depot_name,
       ${partyFields}, ${itemFields}, I.distributor_name as dname, ${week('A.date_of_processing')} as dweek
     from distributor_out A
     left join distributor_out_items B on (A.id = B.distributor_out_id)
     left join depot_master C on (A.depot_id = C.id)
     left join distributor_master I on (A.sample_distributor_id = I.id)
     ${partyJoins('A.distributor_id')}
     ${itemJoins('B.type', 'B.item_id')}
     where A.status = 'Approved' and A.depot_id in (:depotIds) and ${between('A.invoice_date')} and A.distributor_id in (${SAMPLE_PARTY}, ${EXPIRY_PARTY})`,
    replacements
  );
  return rows.map((row) => {
    const { cgst, sgst, igst, tax } = taxOf(row);
    const expired = String(row.dname || '').trim().toUpperCase() === 'PRODUCT EXPIRED';
    return {
      ...dated(row.invoice_date, row.invoice_date, row), ...itemCells(row), ...partyCells(row),
      type: expired ? 'PRODUCT EXPIRED' : String(row.distributor_name || '').toUpperCase(), invoice_no: row.voucher_no,
      qty: row.qty, bar_qty: barQty(row), amount: row.item_amount, cgst, sgst, igst, tax, total: (+row.item_amount || 0) + tax,
      depot_name: row.depot_name, party: row.dname, due_date: row.due_date, order_no: row.sample_type, order_date: row.order_date, remarks: row.remarks,
      system_id: +row.distributor_id === SAMPLE_PARTY ? row.sampleid : row.distributor_in_id, grams: row.grams
    };
  });
};

// The round off of a return sits on its last row, so a return's rows add up to its rounded amount. PHP counted it twice
// and always made it negative.
const skuReturns = async (replacements) => {
  const rows = await query(
    `select A.id as srid, A.date_of_processing, A.sales_return_no, A.order_no, A.remarks, A.status, A.final_amount, B.type, B.item_id, B.qty, B.sell_rate, B.grams,
       B.rate, B.amount as item_amount, B.igst_amt, B.tax_amt, C.depot_name, C.state_code as depot_state_code, ${partyFields}, ${itemFields},
       Q.state, Q.state_code, ${week('A.date_of_processing')} as dweek
     from distributor_in A
     left join distributor_in_items B on (A.id = B.distributor_in_id)
     left join depot_master C on (A.depot_id = C.id)
     ${partyJoins('A.distributor_id')}
     ${itemJoins('B.type', 'B.item_id')}
     left join ${orderStates} Q on (A.order_no = Q.order_no)
     where A.status = 'Approved' and A.depot_id in (:depotIds) and ${between('A.date_of_processing')}
     order by A.id`,
    replacements
  );
  return rows.map((row, index) => {
    const { cgst, sgst, igst, tax } = taxOf(row);
    const last = index === rows.length - 1 || rows[index + 1].srid !== row.srid;
    const final = +row.final_amount || 0;
    const roundOff = last ? roundPhp(final) - final : 0;
    const direct = isDirect(row) ? { party: directName(row), state_code: row.state_code, state: row.state } : {};
    const cells = { ...partyCells(row), ...direct };
    return {
      ...dated(row.date_of_processing, row.date_of_processing, row), ...itemCells(row), ...cells,
      type: isSampleType(row) ? 'SAMPLE' : 'SALES RETURN', invoice_no: row.sales_return_no, qty: minus(row.qty), bar_qty: minus(barQty(row)),
      amount: minus(row.item_amount), cgst: minus(cgst), sgst: minus(sgst), igst: minus(igst), tax: minus(tax), round_off: last ? minus(roundOff) : null,
      total: minus((+row.item_amount || 0) + tax + roundOff), depot_name: row.depot_name, order_no: row.order_no, remarks: row.remarks, system_id: row.srid,
      hsn_code: row.item_hsn, grams: row.item_grams, platform: platformOf(cells.party)
    };
  });
};

const skuCreditDebit = async (replacements) => {
  const rows = await query(
    `select A.date_of_transaction, A.modified_on, A.transaction, A.amount_without_tax, A.amount, A.igst, A.cgst, A.sgst, A.status, A.remarks, A.ref_no,
       B.category, ${partyFields}, ${week('A.date_of_transaction')} as dweek
     from credit_debit_note A
     left join exp_cat_master B on (A.exp_category_id = B.id)
     ${partyJoins('A.distributor_id')}
     where A.status = 'Approved' and ${between('A.date_of_transaction')}`,
    replacements
  );
  return rows.map((row) => {
    const [cgst, sgst, igst] = [+row.cgst || 0, +row.sgst || 0, +row.igst || 0];
    const tax = cgst + sgst + igst;
    const base = +row.amount_without_tax || 0;
    // Without a taxable amount the note is whole rupees, as in PHP
    const amount = base ? +row.amount || 0 : roundPhp(+row.amount || 0);
    const roundOff = base ? amount - base - tax : amount - (+row.amount || 0);
    const sign = row.transaction === 'Credit Note' || row.transaction === 'Expense Voucher' ? -1 : 1;
    return {
      ...dated(row.date_of_transaction, row.modified_on, row), ...partyCells(row),
      type: String(row.transaction || '').toUpperCase(), invoice_no: row.ref_no, amount: sign * base, cgst: sign * cgst, sgst: sign * sgst, igst: sign * igst,
      tax: sign * tax, round_off: sign * roundOff, total: sign * amount, remarks: row.remarks, nature_of_expense: row.category
    };
  });
};

// ---------- Invoice level ----------

const RATES = [0, 5, 12, 18];
const invoiceColumns = [
  { key: 'month', header: 'Month', width: 11 }, { key: 'quarter', header: 'Quarter', width: 8 }, { key: 'year', header: 'Year', width: 7 },
  { key: 'processing_date', header: 'Processing Date', type: 'date' }, { key: 'accounting_date', header: 'Accounting Date', type: 'date' },
  { key: 'week', header: 'Week', width: 6 }, { key: 'type', header: 'Type', width: 16 }, { key: 'invoice_no', header: 'Invoice No', width: 18 },
  ...RATES.map((rate) => ({ key: `taxable_${rate}`, header: `Invoice @${rate}%`, type: 'money', total: true })),
  { key: 'amount', header: 'Invoice Amount', type: 'money', total: true },
  ...[5, 12, 18].map((rate) => ({ key: `cgst_${rate}`, header: `CGST ${rate / 2}%`, type: 'money', total: true })),
  { key: 'cgst', header: 'CGST', type: 'money', total: true },
  ...[5, 12, 18].map((rate) => ({ key: `sgst_${rate}`, header: `SGST ${rate / 2}%`, type: 'money', total: true })),
  { key: 'sgst', header: 'SGST', type: 'money', total: true },
  ...[5, 12, 18].map((rate) => ({ key: `igst_${rate}`, header: `IGST ${rate}%`, type: 'money', total: true })),
  { key: 'igst', header: 'IGST', type: 'money', total: true },
  { key: 'tax', header: 'Total Tax', type: 'money', total: true }, { key: 'round_off', header: 'Round Of Amount', type: 'money', total: true },
  { key: 'total', header: 'Invoice Total Amount', type: 'money', total: true }, { key: 'depot_name', header: 'Depot' },
  { key: 'party', header: 'Distributor', width: 30 }, { key: 'distributor_type', header: 'Distributor Type', width: 16 },
  { key: 'state_code', header: 'State Code', width: 8 }, { key: 'state', header: 'State of supply', width: 18 }, { key: 'gst_no', header: 'GST no', width: 18 },
  { key: 'zone', header: 'Zone', width: 14 }, { key: 'area', header: 'Area', width: 14 }, { key: 'city', header: 'City', width: 14 }, { key: 'location', header: 'Location', width: 14 },
  { key: 'sales_rep_name', header: 'Sales Representative' }, { key: 'due_date', header: 'Due Date', type: 'date' }, { key: 'order_no', header: 'Order no', width: 18 },
  { key: 'order_date', header: 'Order Date', type: 'date' }, { key: 'remarks', header: 'Remarks', width: 30 }, { key: 'system_id', header: 'System ID', width: 10 },
  { key: 'status', header: 'Status', width: 10 }, { key: 'mobile_no', header: 'Contact No', width: 14 }, { key: 'states', header: 'States', width: 24 },
  { key: 'platform', header: 'Platform', width: 12 }
];

const rateSlot = (rate) => (RATES.includes(rate) ? rate : 0);

// head: the invoice. taxes: its items added up per tax rate. One invoice is one row whatever its tax rates.
const invoiceFigures = (head, taxes, total, roundDown) => {
  const figures = {};
  RATES.forEach((rate) => { figures[`taxable_${rate}`] = 0; });
  const intraState = {};
  taxes.forEach((line) => {
    const rate = rateSlot(+line.tax_percentage);
    figures[`taxable_${rate}`] += +line.amt_exc_tax || 0;
    if (rate) intraState[rate] = +line.cgst_amt !== 0;
  });
  const fill = () => {
    [5, 12, 18].forEach((rate) => {
      const taxable = figures[`taxable_${rate}`];
      const half = rate in intraState && intraState[rate] ? roundPhp(taxable * rate / 200, 2) : 0;
      figures[`cgst_${rate}`] = half;
      figures[`sgst_${rate}`] = half;
      figures[`igst_${rate}`] = rate in intraState && !intraState[rate] ? roundPhp(taxable * rate / 100, 2) : 0;
    });
    const sum = (prefix) => [5, 12, 18].reduce((value, rate) => value + figures[`${prefix}_${rate}`], 0);
    const hasTax = +head.tax_amount !== 0 && head.tax_amount !== null && head.tax_amount !== '';
    const inter = +head.igst_amount !== 0;
    figures.amount = RATES.reduce((value, rate) => value + figures[`taxable_${rate}`], 0);
    figures.cgst = hasTax && !inter ? sum('cgst') : 0;
    figures.sgst = hasTax && !inter ? sum('sgst') : 0;
    figures.igst = hasTax && inter ? sum('igst') : 0;
    figures.tax = figures.cgst + figures.sgst + figures.igst;
    figures.total = roundPhp(+total || 0);
    figures.round_off = roundPhp(figures.total - (figures.amount + figures.tax), 2);
  };
  fill();
  // A return's negative round off is taken out of its taxable amount, at its own rate. PHP divided by 1.05 for all rates.
  if (roundDown && figures.round_off < 0 && taxes.length) {
    const rate = rateSlot(+taxes[taxes.length - 1].tax_percentage);
    figures[`taxable_${rate}`] = roundPhp(figures[`taxable_${rate}`] + (rate ? Math.floor((figures.round_off / (1 + rate / 100)) * 100) / 100 : figures.round_off), 2);
    fill();
  }
  return figures;
};

// Items per invoice and tax rate, for the invoices of a period
const taxesBy = async (idColumn, table, parent, where, replacements) => {
  const rows = await query(
    `select B.${idColumn} as parent_id, B.tax_percentage, sum(B.cgst_amt) as cgst_amt,
       sum(B.total_amt) - (ifnull(sum(B.cgst_amt), 0) + ifnull(sum(B.sgst_amt), 0) + ifnull(sum(B.igst_amt), 0)) as amt_exc_tax
     from ${parent} A join ${table} B on (A.id = B.${idColumn})
     where ${where} group by B.${idColumn}, B.tax_percentage`,
    replacements
  );
  const taxes = new Map();
  rows.forEach((row) => {
    if (!taxes.has(row.parent_id)) taxes.set(row.parent_id, []);
    taxes.get(row.parent_id).push(row);
  });
  return taxes;
};

const invoiceRow = (head, cells, figures) => {
  const cancelled = head.status === 'InActive';
  const zeroed = cancelled ? Object.fromEntries(Object.keys(figures).map((key) => [key, 0])) : figures;
  return {
    ...periodOf(cells.date), processing_date: cells.date, accounting_date: cells.date, week: head.dweek, status: cancelled ? 'Cancelled' : head.status,
    ...zeroed, depot_name: head.depot_name, distributor_type: head.distributor_type, zone: head.dist_zone, area: head.area, city: head.distributor_city,
    location: head.location, sales_rep_name: head.sales_rep_name, order_no: head.order_no, remarks: head.remarks,
    platform: platformOf(cells.party), ...cells
  };
};

const invoiceHeadFields = `C.depot_name, C.state as depot_state, C.state_code as depot_state_code, D.distributor_name, D.class, D.city as distributor_city, D.prefix,
  D.state as dist_state, D.state_code as dist_state_code, D.gst_number as dist_gst_no, E.distributor_type, G.location, H.area, K.zone as dist_zone`;
const invoiceHeadJoins = `
  left join depot_master C on (A.depot_id = C.id)
  left join distributor_master D on (A.distributor_id = D.id)
  left join distributor_type_master E on (D.type_id = E.id)
  left join location_master G on (D.location_id = G.id)
  left join area_master H on (D.area_id = H.id)
  left join zone_master K on (D.zone_id = K.id)`;

const invoiceSales = async (replacements) => {
  const where = `(A.status = 'Approved' or A.status = 'InActive') and A.depot_id in (:depotIds) and A.invoice_date >= :fromDate and A.invoice_date <= :toDate
    and A.distributor_id not in (${SAMPLE_PARTY}, ${EXPIRY_PARTY})`;
  const [heads, taxes] = await Promise.all([
    query(
      `select A.id, A.invoice_no, A.invoice_date, A.tax_amount, A.igst_amount, A.invoice_amount, A.client_name, A.gstin, A.state, A.state_code, A.due_date, A.order_no,
         A.order_date, A.remarks, A.status, A.mobile_no, ${invoiceHeadFields}, F.sales_rep_name, ${week('A.invoice_date')} as dweek
       from distributor_out A ${invoiceHeadJoins}
       left join sales_rep_master F on (A.sales_rep_id = F.id)
       where ${where} and ${notSample}
       order by A.invoice_date desc, A.id`,
      replacements
    ),
    taxesBy('distributor_out_id', 'distributor_out_items', 'distributor_out', where, replacements)
  ]);
  return heads.map((head) => {
    const direct = isDirect(head);
    const state = (direct && head.state) || head.dist_state;
    const party = !direct
      ? head.distributor_name
      : head.client_name && head.gstin ? head.client_name : directName(head);
    return invoiceRow(head, {
      date: head.invoice_date, type: 'SALES', invoice_no: head.invoice_no, party, state, state_code: (direct && head.state_code) || head.dist_state_code,
      gst_no: (direct && head.gstin) || head.dist_gst_no, due_date: head.due_date, order_date: head.order_date, system_id: head.id, mobile_no: head.mobile_no,
      states: `${head.depot_state} - ${state}`
    }, invoiceFigures(head, taxes.get(head.id) || [], head.invoice_amount, false));
  });
};

const invoiceSamples = async (replacements) => {
  const where = `A.status = 'Approved' and A.depot_id in (:depotIds) and A.invoice_date >= :fromDate and A.invoice_date <= :toDate`;
  const [heads, taxes] = await Promise.all([
    query(
      `select A.id, A.voucher_no, A.invoice_date, A.tax_amount, A.igst_amount, A.final_amount, A.due_date, A.order_no, A.order_date, A.remarks, A.status,
         ${invoiceHeadFields}, F.sales_rep_name, ${week('A.date_of_processing')} as dweek
       from distributor_out A ${invoiceHeadJoins}
       left join sales_rep_master F on (A.sales_rep_id = F.id)
       where ${where} and D.class = 'sample'`,
      replacements
    ),
    taxesBy('distributor_out_id', 'distributor_out_items', 'distributor_out', where, replacements)
  ]);
  return heads.map((head) => invoiceRow(head, {
    date: head.invoice_date, type: 'Sample & Product Expired', invoice_no: head.voucher_no, party: head.distributor_name, state: head.dist_state,
    state_code: head.dist_state_code, gst_no: head.dist_gst_no, due_date: head.due_date, order_date: head.order_date, system_id: head.id
  }, invoiceFigures(head, taxes.get(head.id) || [], head.final_amount, false)));
};

const invoiceReturns = async (replacements) => {
  const where = `A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_processing >= :fromDate and A.date_of_processing <= :toDate`;
  const [heads, taxes] = await Promise.all([
    query(
      `select A.id, A.sales_return_no, A.date_of_processing, A.tax_amount, A.igst_amount, A.final_amount, A.order_no, A.remarks, A.status,
         ${invoiceHeadFields}, F.sales_rep_name, Q.state, Q.state_code, ${week('A.date_of_processing')} as dweek
       from distributor_in A ${invoiceHeadJoins}
       left join ${mapping('area_id, type_id, zone_id')} J1 on (D.area_id = J1.area_id and D.type_id = J1.type_id and D.zone_id = J1.zone_id)
       left join sr_mapping J on (J1.id = J.id)
       left join sales_rep_master F on (A.sales_rep_id = F.id and J.reporting_manager_id = F.id)
       left join ${orderStates} Q on (A.order_no = Q.order_no)
       where ${where}`,
      replacements
    ),
    taxesBy('distributor_in_id', 'distributor_in_items', 'distributor_in', where, replacements)
  ]);
  return heads.map((head) => {
    const direct = isDirect(head);
    return invoiceRow(head, {
      date: head.date_of_processing, type: isSampleType(head) ? 'SAMPLE' : 'SALES RETURN', invoice_no: head.sales_return_no,
      party: direct ? directName(head) : head.distributor_name, state: direct ? head.state : head.dist_state, state_code: direct ? head.state_code : head.dist_state_code,
      gst_no: head.dist_gst_no, system_id: head.id, states: `${head.depot_state} - ${head.state}`
    }, invoiceFigures(head, taxes.get(head.id) || [], head.final_amount, true));
  });
};

// ---------- Sales Report ----------

const dateRange = { name: 'dates', type: 'dateRange', label: 'Period' };
const check = (name, label, group, on) => ({ name, type: 'checkbox', label, group, default: on });
const SKU_LEVEL = 'SKU level';
const INVOICE_LEVEL = 'Invoice level';

const SKU_SECTIONS = [['sales', skuSales], ['ssallocation', skuAllocations], ['dist_transfer', skuTransfers], ['sample', skuSamples], ['salesreturn', skuReturns], ['credit_debit', skuCreditDebit]];
const INVOICE_SECTIONS = [['invoicelevel', invoiceSales], ['invoicelevelsample', invoiceSamples], ['invoicelevelsalesreturn', invoiceReturns]];

const salesReport = {
  key: 'sales-report',
  name: 'Sales Report',
  group: 'Sales',
  repId: 1,
  description: 'Sales, returns, samples, allocations, transfers and notes, by item or by invoice.',
  filters: [
    dateRange,
    check('sales', 'Sales', SKU_LEVEL, true),
    check('salesreturn', 'Sales Return', SKU_LEVEL, true),
    check('credit_debit', 'Credit / Debit Note', SKU_LEVEL, true),
    check('sample', 'Sample & Product Expired', SKU_LEVEL, true),
    check('ssallocation', 'SS Allocation', SKU_LEVEL, false),
    check('dist_transfer', 'Distributor Transfer', SKU_LEVEL, false),
    check('invoicelevel', 'Sales', INVOICE_LEVEL, false),
    check('invoicelevelsalesreturn', 'Sales Return', INVOICE_LEVEL, false),
    check('invoicelevelsample', 'Sample & Product Expired', INVOICE_LEVEL, false)
  ],
  run: async (ctx) => {
    const { filters, depotIds } = ctx;
    const chosen = (sections) => sections.filter(([name]) => filters[name]).map(([, build]) => build);
    const sku = chosen(SKU_SECTIONS);
    const invoice = chosen(INVOICE_SECTIONS);
    if (!sku.length && !invoice.length) throw new ReportError('Select at least one section of the report.');
    if (!depotIds.length) throw new ReportError('No depots are assigned to your user.');
    const replacements = { depotIds, fromDate: filters.fromDate, toDate: filters.toDate };
    // One at a time: these are the largest queries in the ERP
    const collect = async (builds) => {
      const rows = [];
      for (const build of builds) rows.push(...(await build(replacements)));
      return rows;
    };
    return {
      sheets: [
        ...(sku.length ? [{ name: 'SKU Level', columns: skuColumns, rows: await collect(sku) }] : []),
        ...(invoice.length ? [{ name: 'Invoice Level', columns: invoiceColumns, rows: await collect(invoice) }] : [])
      ]
    };
  }
};

// ---------- Sales Summary ----------

const salesSummary = {
  key: 'sales-summary',
  name: 'Sales Summary',
  group: 'Sales',
  repId: 36,
  fileOnly: true,
  description: 'The month-end sales summary workbook for any period.',
  filters: [dateRange],
  run: async (ctx) => {
    if (!ctx.depotIds.length) throw new ReportError('No depots are assigned to your user.');
    const { buffer } = await buildSalesSummaryReport({ fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate, depotIds: ctx.depotIds });
    return {
      sheets: [],
      file: { name: `Sale_Summary_Report_${today()}.xlsm`, type: 'application/vnd.ms-excel.sheet.macroEnabled.12', content: buffer }
    };
  }
};

// ---------- E-Invoice JSON ----------

const present = (value) => value !== null && value !== undefined && value !== '' && value !== 'null';
const first99 = (value) => String(value === null || value === undefined ? '' : value).substring(0, 99);
const money2 = (value) => roundPhp(+value || 0, 2);
const whole = (value) => parseInt(value, 10) || 0;

const buyerOf = (row) => {
  const buyer = (Gstin, name, address, Loc, pincode, Stcd) => ({
    Gstin, LglNm: first99(name), TrdNm: null, Pos: row.state_code, Addr1: first99(address), Addr2: null, Loc, Pin: whole(pincode), Stcd, Ph: null, Em: null
  });
  if (present(row.gstin)) return buyer(row.gstin, row.client_name, row.address, row.state, row.pincode, row.state_code);
  if (present(row.con_gst_number)) return buyer(row.con_gst_number, row.con_name, row.con_address, row.con_state, row.con_pincode, row.con_state_code);
  return buyer(row.distributor_gst_number, row.distributor_name, row.distributor_address, row.distributor_state, row.distributor_pincode, row.distributor_state_code);
};

const einvoiceOf = (row) => ({
  Version: '1.1',
  TranDtls: { TaxSch: 'GST', SupTyp: 'B2B', RegRev: null, EcmGstin: null },
  DocDtls: { Typ: 'INV', No: row.invoice_no, Dt: dmy(row.invoice_date) },
  SellerDtls: {
    Gstin: row.depot_gst_no, TrdNm: null, Addr1: first99(row.depot_address), Addr2: null, Loc: row.depot_state, Pin: whole(row.depot_pincode),
    Stcd: row.depot_state_code, Ph: '8268000456', Em: 'cs@eatanytime.in'
  },
  BuyerDtls: buyerOf(row),
  DispDtls: null,
  ShipDtls: null,
  ValDtls: {
    AssVal: money2(row.amount), IgstVal: money2(row.igst_amount), CgstVal: money2(row.cgst_amount), SgstVal: money2(row.sgst_amount), CesVal: 0, StCesVal: 0,
    Discount: 0, OthChrg: money2(row.shipping_charges), RndOffAmt: money2(row.round_off_amount), TotInvVal: money2(row.invoice_amount), TotInvValFc: 0
  },
  ExpDtls: null,
  EwbDtls: null,
  PayDtls: null,
  RefDtls: null,
  AddlDocDtls: null,
  ItemList: []
});

const einvoiceItem = (row, slNo) => ({
  SlNo: String(slNo), PrdDesc: row.box_name, IsServc: 'N', HsnCd: row.hsn_code, Barcde: null, Qty: money2(row.item_qty), FreeQty: 0, Unit: 'PCS',
  UnitPrice: money2(row.item_sell_rate), TotAmt: money2(row.item_amount), Discount: 0, PreTaxVal: 0, AssAmt: money2(row.item_amount), GstRt: money2(row.item_tax_percentage),
  IgstAmt: money2(row.item_igst_amt), CgstAmt: money2(row.item_cgst_amt), SgstAmt: money2(row.item_sgst_amt), CesRt: 0, CesAmt: 0, CesNonAdvlAmt: 0, StateCesRt: 0, StateCesAmt: 0,
  StateCesNonAdvlAmt: 0, OthChrg: 0, TotItemVal: money2(row.item_total_amt), OrdLineRef: null, OrgCntry: null, PrdSlNo: null, BchDtls: null, AttribDtls: [{ Nm: null, Val: null }]
});

const einvoiceJson = {
  key: 'einvoice-json',
  name: 'E-Invoice JSON',
  group: 'Sales',
  repId: 38,
  downloadLabel: 'Download JSON',
  description: 'B2B invoices of a period as the JSON the e-invoice portal takes.',
  filters: [dateRange],
  run: async (ctx) => {
    const { fromDate, toDate } = ctx.filters;
    const rows = await query(
      `select A.*, B.depot_name, B.address as depot_address, B.state as depot_state, B.pincode as depot_pincode, B.state_code as depot_state_code, B.gst_no as depot_gst_no,
         C.distributor_name, C.address as distributor_address, C.pincode as distributor_pincode, C.state as distributor_state, C.state_code as distributor_state_code,
         C.gst_number as distributor_gst_number, D.qty as item_qty, D.sell_rate as item_sell_rate, D.amount as item_amount, D.cgst_amt as item_cgst_amt, D.sgst_amt as item_sgst_amt,
         D.igst_amt as item_igst_amt, D.total_amt as item_total_amt, D.tax_percentage as item_tax_percentage,
         case when D.type = 'Combo Box' then F.combo_box_name else E.box_name end as box_name,
         case when D.type = 'Combo Box' then F.hsn_code else E.hsn_code end as hsn_code
       from distributor_out A
       left join depot_master B on (A.depot_id = B.id)
       left join distributor_master C on (A.distributor_id = C.id)
       left join distributor_out_sale_items D on (A.id = D.distributor_out_id)
       left join box_master E on (D.type = 'Box' and D.item_id = E.id)
       left join combo_box_master F on (D.type = 'Combo Box' and D.item_id = F.id)
       where A.status = 'Approved' and A.distributor_id not in (:parties) and A.invoice_date >= :fromDate and A.invoice_date <= :toDate
         and ((A.gstin is not null and A.gstin != '') or (A.con_gst_number is not null and A.con_gst_number != '') or (C.gst_number is not null and C.gst_number != ''))
       order by A.invoice_date, A.invoice_no`,
      { parties: NO_EINVOICE_PARTIES, fromDate, toDate }
    );
    const invoices = [];
    const summary = [];
    rows.forEach((row, index) => {
      if (!index || rows[index - 1].invoice_no !== row.invoice_no) {
        const invoice = einvoiceOf(row);
        invoices.push(invoice);
        summary.push({
          invoice_no: row.invoice_no, invoice_date: row.invoice_date, gstin: invoice.BuyerDtls.Gstin, buyer: invoice.BuyerDtls.LglNm,
          amount: row.amount, tax: (+row.cgst_amount || 0) + (+row.sgst_amount || 0) + (+row.igst_amount || 0), total: row.invoice_amount, items: 0
        });
      }
      const invoice = invoices[invoices.length - 1];
      invoice.ItemList.push(einvoiceItem(row, invoice.ItemList.length + 1));
      summary[summary.length - 1].items += 1;
    });
    return {
      sheets: [{
        name: 'Invoices',
        columns: [
          { key: 'invoice_no', header: 'Invoice No', width: 18 }, { key: 'invoice_date', header: 'Invoice Date', type: 'date' }, { key: 'gstin', header: 'Buyer GSTIN', width: 18 },
          { key: 'buyer', header: 'Buyer', width: 32 }, { key: 'items', header: 'Items', type: 'number' }, { key: 'amount', header: 'Taxable', type: 'money', total: true },
          { key: 'tax', header: 'Tax', type: 'money', total: true }, { key: 'total', header: 'Invoice Total', type: 'money', total: true }
        ],
        rows: summary
      }],
      file: { name: `einvoice_data_${fromDate}_to_${toDate}.json`, type: 'application/json', content: Buffer.from(JSON.stringify(invoices)) }
    };
  }
};

export default [salesReport, salesSummary, einvoiceJson];
