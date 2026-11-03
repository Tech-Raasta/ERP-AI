import { query, ReportError } from './engine.js';

// Finished goods stock (old PHP Export_model). PHP joined 13 subqueries per report and repeated them for the Product Item
// report. Here every stock movement is one line in one list, and both reports add that list up.

// Stock in this ERP starts here (PHP: > 2022-06-05)
const STOCK_START = '2022-06-05';

// A transfer from production counts when it is approved, any other on its transfer date
const TRANSFER_DAY = `case when A.production_id is not null then date(A.approved_on) else A.date_of_transfer end`;
const OTHER_PARTIES = `(1, 63, 64, 65, 66, 189)`;
const SAMPLE_PARTIES = `(1, 63, 64, 65, 66)`;
const EXPIRY_PARTY = 189;

const line = (kind, type, item, qty, day, tables, where) => `
  select ${kind.depot || 'A.depot_id'} as depot_id, ${type} as type, ${item} as item_id, ${qty} as qty, date(${day}) as day, '${kind.name || kind}' as kind
  from ${tables} where A.status = 'Approved' and ${where}`;

// status and depot apply to every line. The dates are not filtered here, so opening and the period add up from one list.
const movementLines = () => {
  const after = (column) => `${column} > '${STOCK_START}'`;
  const items = (table, itemTable, key) => `${table} A join ${itemTable} B on (A.id = B.${key})`;
  const out = items('distributor_out', 'distributor_out_items', 'distributor_out_id');
  const depotIn = (column) => `${column} in (:depotIds)`;
  const inDepots = depotIn('A.depot_id');
  const transfer = items('depot_transfer', 'depot_transfer_items', 'depot_transfer_id');
  const bars = (table, itemTable, key) => `${items(table, itemTable, key)} join box_product C on (B.box_id = C.box_id)`;
  return [
    line('production', `'Box'`, 'B.box_id', 'B.qty', 'A.date_of_processing', items('batch_processing', 'batch_variations', 'batch_processing_id'),
      `${inDepots} and ${after('A.date_of_processing')} and B.box_id is not null`),
    line({ name: 'depot_in', depot: 'A.depot_in_id' }, 'B.type', 'B.item_id', 'B.qty', TRANSFER_DAY, transfer,
      `${depotIn('A.depot_in_id')} and ${after('A.date_of_transfer')} and B.type in ('Bar', 'Box') and B.item_id is not null`),
    line({ name: 'depot_out', depot: 'A.depot_out_id' }, 'B.type', 'B.item_id', 'B.qty', TRANSFER_DAY, transfer,
      `${depotIn('A.depot_out_id')} and ${after('A.date_of_transfer')} and B.type in ('Bar', 'Box') and B.item_id is not null`),
    line('sale', 'B.type', 'B.item_id', 'B.qty', 'A.invoice_date', out,
      `${inDepots} and ${after('A.date_of_processing')} and A.distributor_id not in ${OTHER_PARTIES} and B.item_id is not null`),
    line('sample', 'B.type', 'B.item_id', 'B.qty', 'A.date_of_processing', out,
      `${inDepots} and ${after('A.date_of_processing')} and A.distributor_id in ${SAMPLE_PARTIES} and B.item_id is not null`),
    line('expire', 'B.type', 'B.item_id', 'B.qty', 'A.date_of_processing', out,
      `${inDepots} and ${after('A.date_of_processing')} and A.distributor_id = ${EXPIRY_PARTY} and B.item_id is not null`),
    line('pending', 'B.type', 'B.item_id', 'B.qty', 'A.date_of_processing', out,
      `${inDepots} and ${after('A.date_of_processing')} and A.delivery_status = 'Pending' and B.item_id is not null`),
    line('sale_return', 'B.type', 'B.item_id', 'B.qty', 'A.date_of_processing', items('distributor_in', 'distributor_in_items', 'distributor_in_id'),
      `${inDepots} and ${after('A.date_of_processing')} and B.item_id is not null`),
    // Conversions: a box opened into bars, bars packed into a box, one bar or box relabelled as another
    line('convert_out', `'Box'`, 'B.box_id', 'B.qty', 'A.date_of_processing', items('box_to_bar', 'box_to_bar_qty', 'box_to_bar_id'),
      `${inDepots} and ${after('A.date_of_processing')} and B.box_id is not null`),
    line('convert_out', `'Bar'`, 'C.product_id', 'B.qty * C.qty', 'A.date_of_processing', bars('bar_to_box', 'bar_to_box_qty', 'bar_to_box_id'),
      `${inDepots} and ${after('A.date_of_processing')} and C.product_id is not null`),
    line('convert_out', `'Bar'`, 'A.product_out_id', 'A.qty', 'A.approved_on', 'bar_to_bar A', `${inDepots} and ${after('A.date_of_transfer')}`),
    line('convert_out', `'Box'`, 'A.box_out_id', 'A.qty_out', 'A.approved_on', 'box_to_box A', `${inDepots} and ${after('A.date_of_transfer')}`),
    line('convert_in', `'Box'`, 'B.box_id', 'B.qty', 'A.date_of_processing', items('bar_to_box', 'bar_to_box_qty', 'bar_to_box_id'),
      `${inDepots} and ${after('A.date_of_processing')} and B.box_id is not null`),
    line('convert_in', `'Bar'`, 'C.product_id', 'B.qty * C.qty', 'A.date_of_processing', bars('box_to_bar', 'box_to_bar_qty', 'box_to_bar_id'),
      `${inDepots} and ${after('A.date_of_processing')} and C.product_id is not null`),
    line('convert_in', `'Bar'`, 'A.product_in_id', 'A.qty', 'A.approved_on', 'bar_to_bar A', `${inDepots} and ${after('A.date_of_transfer')} and A.product_in_id is not null`),
    line('convert_in', `'Box'`, 'A.box_in_id', 'A.qty_in', 'A.approved_on', 'box_to_box A', `${inDepots} and ${after('A.date_of_transfer')} and A.box_in_id is not null`)
  ].join(' union all ');
};

const KINDS_IN = `'production', 'depot_in', 'sale_return', 'convert_in'`;
const KINDS_OUT = `'depot_out', 'sale', 'sample', 'expire', 'convert_out'`;
const periodQty = (kind) => `ifnull(sum(case when M.kind = '${kind}' and M.day >= :fromDate then M.qty end), 0) as ${kind}_qty`;

// Boxes sold as loose pieces count as bars on the item report
const asItems = (lines) => `
  select M.depot_id, case when M.type = 'Box' and C.control_unit = 'Piece' then 'Bar' else M.type end as type,
    case when M.type = 'Box' and C.control_unit = 'Piece' then C.product_id else M.item_id end as item_id,
    case when M.type = 'Box' and C.control_unit = 'Piece' then ifnull(M.qty, 0) * ifnull(C.product_qty, 0) else M.qty end as qty,
    M.day, M.kind
  from (${lines}) M left join box_master C on (M.type = 'Box' and M.item_id = C.id)`;

const stockRows = (depotIds, fromDate, toDate, { items, categories }) => {
  const lines = movementLines();
  const category = categories ? ', Y.category_name' : '';
  const categoryJoin = categories ? 'left join category_master Y on (P.category_id = Y.id)' : '';
  const extra = categories ? ', category_id' : '';
  return query(
    `select D.state, D.city, D.depot_name, M.type, P.item_name, ifnull(P.grams, 0) as unit_weight${category},
       ifnull(sum(case when M.kind in (${KINDS_IN}) and M.day < :fromDate then M.qty
                       when M.kind in (${KINDS_OUT}) and M.day < :fromDate then -M.qty end), 0) as opening_qty,
       ${['production', 'depot_in', 'depot_out', 'sale', 'sample', 'expire', 'sale_return', 'convert_out', 'convert_in'].map(periodQty).join(', ')},
       ifnull(sum(case when M.kind = 'pending' and M.day >= :fromDate then M.qty end), 0) as del_pending_qty
     from (${items ? asItems(lines) : lines}) M
     left join (select id, 'Bar' as type, short_name as item_name, grams${extra} from product_master
                union all select id, 'Box' as type, short_name as item_name, grams${extra} from box_master) P
       on (M.item_id = P.id and M.type = P.type)
     ${categoryJoin}
     left join depot_master D on (M.depot_id = D.id)
     where M.day <= :toDate
     group by D.state, D.city, D.depot_name, M.type, P.item_name, P.grams${category}
     order by D.depot_name, M.type, P.item_name`,
    { depotIds, fromDate, toDate }
  );
};

const number = (key, header) => ({ key, header, type: 'number', total: true });

const stockColumns = (categories) => [
  { key: 'state', header: 'State', width: 18 },
  { key: 'city', header: 'City', width: 16 },
  { key: 'depot_name', header: 'Depot Name' },
  { key: 'type', header: 'Type', width: 8 },
  { key: 'item_name', header: 'Product', width: 30 },
  { key: 'unit_weight', header: 'Unit Weight', type: 'number' },
  number('opening_qty', 'Opening Qty'),
  number('production_qty', 'Production Qty'),
  number('depot_in_qty', 'Depot In Qty'),
  number('depot_out_qty', 'Depot Out Qty'),
  number('sale_qty', 'Sale Qty'),
  number('sample_qty', 'Sample Qty'),
  number('expire_qty', 'Expire Qty'),
  number('sale_return_qty', 'Sale Return Qty'),
  number('convert_out_qty', 'Convert Out Qty'),
  number('convert_in_qty', 'Convert In Qty'),
  number('closing_qty', 'Closing Balance'),
  number('del_pending_qty', 'Pending Qty'),
  number('physical_qty', 'Physical Qty'),
  ...(categories ? [{ key: 'category_name', header: 'Category' }] : [])
];

const stockReport = (options) => async (ctx) => {
  if (!ctx.depotIds.length) throw new ReportError('No depots are assigned to your user.');
  const { fromDate, toDate } = ctx.filters;
  const rows = (await stockRows(ctx.depotIds, fromDate, toDate, options)).map((row) => {
    const value = (key) => +row[key] || 0;
    const closing = value('opening_qty') + value('production_qty') + value('depot_in_qty') - value('depot_out_qty') - value('sale_qty')
      - value('sample_qty') - value('expire_qty') + value('sale_return_qty') - value('convert_out_qty') + value('convert_in_qty');
    return { ...row, closing_qty: closing, physical_qty: closing + value('del_pending_qty') };
  });
  return { sheets: [{ name: 'Stock', columns: stockColumns(options.categories), rows }] };
};

const dateRange = { name: 'dates', type: 'dateRange', label: 'Period' };

export default [
  {
    key: 'product-stock',
    name: 'Product Stock',
    group: 'Stock',
    repId: 4,
    description: 'Opening, every movement and closing stock of each product, depot by depot.',
    filters: [dateRange],
    run: stockReport({ items: false, categories: false })
  },
  {
    key: 'product-item-stock',
    name: 'Product Item Stock',
    group: 'Stock',
    repId: 4,
    description: 'Product Stock with loose-piece boxes counted as bars, and the category of each item.',
    filters: [dateRange],
    run: stockReport({ items: true, categories: true })
  }
];
