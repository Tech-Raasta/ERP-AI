import { query, roundTo, limitDepots, dmy } from './engine.js';

// Production and stock reports (old PHP Export_model). repId is the report's tick on the User Roles screen.

const STOCK_START = '2018-10-22'; // PHP counts stock from here
const PACKAGING_START = '2022-07-31'; // Packaging stock is counted from here

const dateRange = { name: 'dates', type: 'dateRange', label: 'Period' };

const money = (key, header, extra = {}) => ({ key, header, type: 'money', ...extra });
const number = (key, header, extra = {}) => ({ key, header, type: 'number', ...extra });
const text = (key, header, extra = {}) => ({ key, header, ...extra });
const date = (key, header) => ({ key, header, type: 'date' });

// ---------- Purchase Order (rep 10) ----------

// PHP wrote amounts as text ("1,234.00"), so its totals came to 0. The order's total repeats on each of its items, so it
// is added up once per order.
const purchaseOrder = {
  key: 'purchase-order',
  name: 'Purchase Order',
  group: 'Production',
  repId: 10,
  description: 'Approved purchase orders, item by item.',
  filters: [dateRange],
  run: async (ctx) => {
    if (!ctx.depotIds.length) return { sheets: [] };
    const rows = await query(
      `select A.id, A.order_date, A.delivery_date, A.amount, A.shipping_method, A.shipping_term, A.remarks,
         B.qty, B.rate, B.tax_per, B.amount as item_amount, C.vendor_name, D.rm_name
       from purchase_order A left join purchase_order_items B on (A.id = B.purchase_order_id)
       left join vendor_master C on (A.vendor_id = C.id) left join raw_material_master D on (B.item_id = D.id)
       where A.status = 'Approved' and A.depot_id in (:depotIds) and A.order_date >= :fromDate and A.order_date <= :toDate
       order by A.id`,
      { depotIds: ctx.depotIds, fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate }
    );
    const orders = new Map(rows.map((row) => [row.id, +row.amount || 0]));
    return {
      sheets: [{
        name: 'Purchase Order',
        columns: [
          date('order_date', 'PO Date'), text('vendor_name', 'Vendor Name', { width: 32 }), text('rm_name', 'Material Name', { width: 32 }),
          number('qty', 'Qty (In Kg)'), money('rate', 'Rate'), number('tax_per', 'GST Rate'), money('item_amount', 'Total Amount', { total: true }),
          date('delivery_date', 'Delivery Date'), money('amount', 'Order Total (In Rs)'), text('shipping_method', 'Shipping Method'),
          text('shipping_term', 'Shipping Term'), text('remarks', 'Remarks', { width: 32 })
        ],
        rows,
        footer: [{ label: 'Total Of Orders', key: 'amount', value: roundTo([...orders.values()].reduce((sum, value) => sum + value, 0)) }]
      }]
    };
  }
};

// ---------- Product Cost (rep 39, shown with the Purchase Order tick) ----------

const productCost = {
  key: 'product-cost',
  name: 'Product Cost',
  group: 'Production',
  repId: 10,
  description: 'What each box costs to make, from its recipe, packaging and today\'s material rates.',
  filters: [],
  run: async () => {
    const rows = await query(
      `select * from
       (select BB.*, (BB.cost * (1 + (BB.process_loss / 100))) as cost_including_process_loss from
        (select A.box_id, D.box_name, D.grams as uom, E.rm_name, E.material_type, E.rate as rate_in_kg,
           ((C.qty_per_batch / B.total_kgs) * D.grams) as qty_in_grams, (E.rate / 1000) as cost_per_gram,
           (((C.qty_per_batch / B.total_kgs) * D.grams) * (E.rate / 1000)) as cost, B.process_loss
         from ingredients_variations A left join ingredients_master B on (A.ing_id = B.id)
         left join ingredients_details C on (A.ing_id = C.ing_id) left join box_master D on (A.box_id = D.id)
         left join raw_material_master E on (C.rm_id = E.id)
         where A.box_status = 'Approved') BB
        union all
        select A.box_id, D.box_name, D.grams as uom, E.rm_name, E.material_type, A.primary_rate as rate_in_kg,
          case when A.primary_qty < 1 then 1 else A.primary_qty end as qty_in_grams, A.primary_cost as cost_per_gram,
          A.primary_cost as cost, 0 as process_loss, A.primary_cost as cost_including_process_loss
        from ingredients_variations A left join box_master D on (A.box_id = D.id)
        left join raw_material_master E on (A.primary_packaging_id = E.id)
        where A.box_status = 'Approved' and A.primary_qty > 0
        union all
        select A.box_id, D.box_name, D.grams as uom, E.rm_name, E.material_type, A.secondary_rate as rate_in_kg,
          case when A.secondary_qty < 1 then 1 else A.secondary_qty end as qty_in_grams, A.secondary_cost as cost_per_gram,
          A.secondary_cost as cost, 0 as process_loss, A.secondary_cost as cost_including_process_loss
        from ingredients_variations A left join box_master D on (A.box_id = D.id)
        left join raw_material_master E on (A.secondary_packaging_id = E.id)
        where A.box_status = 'Approved' and A.secondary_qty > 0) DD
       order by DD.box_id, DD.material_type desc, DD.rm_name`
    );
    return {
      sheets: [{
        name: 'Product Cost',
        columns: [
          text('box_name', 'Product Name', { width: 36 }), number('uom', 'UOM'), text('rm_name', 'Raw Material Name', { width: 32 }),
          number('qty_in_grams', 'Raw Material (Gm)'),
          // PHP rounded this to 2 places, which showed most materials as 0.00 or 0.01 per gram
          number('cost_per_gram', 'Cost Per Gram', { decimals: 4 }), money('cost', 'Cost'), number('process_loss', 'Process Loss'),
          money('cost_including_process_loss', 'Cost Including Process Loss'), money('rate_in_kg', 'Rate In (Kg) Ex Tax')
        ],
        rows
      }]
    };
  }
};

// ---------- Production Data (rep 11) ----------

const productionData = {
  key: 'production-data',
  name: 'Production Data',
  group: 'Production',
  repId: 11,
  description: 'Input, output and wastage of each approved batch.',
  filters: [dateRange],
  run: async (ctx) => {
    if (!ctx.depotIds.length) return { sheets: [] };
    const rows = await query(
      `select A.batch_id_as_per_fssai, A.date_of_processing, A.total_kg, A.output_kg, A.qty_in_bar, A.actual_wastage, A.wastage_percent,
         A.anticipated_wastage, A.wastage_variance, B.short_name, C.depot_name
       from batch_processing A left join product_master B on (A.product_id = B.id) left join depot_master C on (A.depot_id = C.id)
       where A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_processing >= :fromDate and A.date_of_processing <= :toDate
       order by A.id`,
      { depotIds: ctx.depotIds, fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate }
    );
    return {
      sheets: [{
        name: 'Production Data',
        columns: [
          text('batch_id_as_per_fssai', 'Batch Id'), date('date_of_processing', 'Date Of Processing'), text('depot_name', 'Depot Name'),
          text('short_name', 'Product Name', { width: 32 }), number('total_kg', 'Input Kg', { total: true }), number('output_kg', 'Output Kg', { total: true }),
          number('qty_in_bar', 'Qty In Bar'), number('actual_wastage', 'Actual Wastage Kg'), number('wastage_percent', 'Wastage %'),
          number('anticipated_wastage', 'Anticipated Wastage %'), number('wastage_variance', 'Wastage Variance (In %)')
        ],
        rows
      }]
    };
  }
};

// ---------- Raw Material Stock by receipt date (rep 2) ----------

// One column per receipt date. PHP found each cell by scanning the sheet, which took minutes on a long period.
const rawMaterialStock = {
  key: 'raw-material-stock',
  name: 'Raw Material Stock',
  group: 'Production',
  repId: 2,
  description: 'Stock received on each date, what production used, and the balance.',
  filters: [dateRange],
  run: async (ctx) => {
    if (!ctx.depotIds.length) return { sheets: [] };
    const replacements = {
      depotIds: ctx.depotIds, fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate, stockStart: STOCK_START, packagingStart: PACKAGING_START
    };
    const [materials, received, used] = await Promise.all([
      query(`select id, rm_name from raw_material_master where status = 'Approved' order by id`),
      query(
        `select B.raw_material_id, date(A.date_of_receipt) as receipt_date, sum(B.qty) as qty
         from raw_material_in A join raw_material_stock B on (A.id = B.raw_material_in_id)
         where A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_receipt >= :fromDate and A.date_of_receipt <= :toDate
           and A.date_of_receipt > :stockStart
         group by B.raw_material_id, date(A.date_of_receipt)`,
        replacements
      ),
      query(
        `select raw_material_id, sum(qty) as qty from
         (select B.raw_material_id, B.qty from batch_processing A join batch_raw_material B on (A.id = B.batch_processing_id)
          where A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_processing >= :fromDate and A.date_of_processing <= :toDate
            and A.date_of_processing > :stockStart
          union all
          select B.primary_packaging_id, ifnull(B.primary_packaging_qty, 0) from batch_processing A join batch_variations B on (A.id = B.batch_processing_id)
          where A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_processing >= :fromDate and A.date_of_processing <= :toDate
            and A.date_of_processing > :packagingStart
          union all
          select B.secondary_packaging_id, ifnull(B.secondary_packaging_qty, 0) from batch_processing A join batch_variations B on (A.id = B.batch_processing_id)
          where A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_processing >= :fromDate and A.date_of_processing <= :toDate
            and A.date_of_processing > :packagingStart) X
         where raw_material_id is not null group by raw_material_id`,
        replacements
      )
    ]);
    if (!received.length) return { sheets: [] };
    const dates = [...new Set(received.map((row) => dmyKey(row.receipt_date)))].sort();
    const usedBy = new Map(used.map((row) => [row.raw_material_id, +row.qty || 0]));
    const rows = materials.map((material) => {
      const row = { rm_name: material.rm_name, total_stock: 0, production_out: roundTo(usedBy.get(material.id) || 0) };
      received.filter((item) => item.raw_material_id === material.id).forEach((item) => {
        row[dmyKey(item.receipt_date)] = +item.qty || 0;
        row.total_stock += +item.qty || 0;
      });
      row.balance = roundTo(row.total_stock - row.production_out);
      return row;
    });
    return {
      sheets: [{
        name: 'Raw Material Stock',
        columns: [
          text('rm_name', 'Material Name', { width: 34 }),
          ...dates.map((key) => number(key, dmy(key), { total: true })),
          number('total_stock', 'Total Stock', { total: true }), number('production_out', 'Production Out', { total: true }), number('balance', 'Balance Stock', { total: true })
        ],
        rows
      }]
    };
  }
};
const dmyKey = (value) => (value instanceof Date
  ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  : String(value).substring(0, 10));

// ---------- Raw Material IN / Out Stock (rep 27) ----------

// PHP joined seven subqueries twice over, once for each way of reporting. All of it is one list of stock movements.
// With barcodes, goods received are taken from their weighed lots.
const movements = (byBarcode) => {
  const barcode = (column) => (byBarcode ? `ifnull(${column}, '')` : `''`);
  const received = byBarcode
    ? `select A.depot_id, B.raw_material_id, ifnull(W.barcode, '') as barcode, ifnull(W.net_weight, B.qty) as qty, A.date_of_receipt as moved_on, 'rm_in' as kind
       from raw_material_in A join raw_material_stock B on (A.id = B.raw_material_in_id)
       left join raw_material_in_item_weights W on (B.id = W.raw_material_in_item_id)`
    : `select A.depot_id, B.raw_material_id, '' as barcode, B.qty, A.date_of_receipt as moved_on, 'rm_in' as kind
       from raw_material_in A join raw_material_stock B on (A.id = B.raw_material_in_id)`;
  return `
    ${received} where A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_receipt > :stockStart and A.date_of_receipt <= :toDate
    union all
    select A.depot_id, B.raw_material_id, ${barcode('B.barcode')}, B.qty, A.date_of_processing, 'rm_stock_in'
    from raw_material_in_out A join raw_material_in_out_items B on (A.id = B.raw_material_in_out_id)
    where A.status = 'Approved' and B.type = 'Stock IN' and A.depot_id in (:depotIds) and A.date_of_processing > :stockStart and A.date_of_processing <= :toDate
    union all
    select A.depot_in_id, B.item_id, ${barcode('B.barcode')}, B.qty, A.date_of_transfer, 'depot_in'
    from depot_transfer A join depot_transfer_items B on (A.id = B.depot_transfer_id)
    where A.status = 'Approved' and B.type = 'Raw Material' and A.depot_in_id in (:depotIds) and A.date_of_transfer > :stockStart and A.date_of_transfer <= :toDate
    union all
    select A.depot_out_id, B.item_id, ${barcode('B.barcode')}, B.qty, A.date_of_transfer, 'depot_out'
    from depot_transfer A join depot_transfer_items B on (A.id = B.depot_transfer_id)
    where A.status = 'Approved' and B.type = 'Raw Material' and A.depot_out_id in (:depotIds) and A.date_of_transfer > :stockStart and A.date_of_transfer <= :toDate
    union all
    select A.depot_id, B.raw_material_id, ${barcode('B.barcode')}, B.qty, A.date_of_processing, 'batch_process'
    from batch_processing A join batch_raw_material B on (A.id = B.batch_processing_id)
    where A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_processing > :stockStart and A.date_of_processing <= :toDate
    union all
    select A.depot_id, B.primary_packaging_id, '', ifnull(B.primary_packaging_qty, 0), A.date_of_processing, 'batch_process'
    from batch_processing A join batch_variations B on (A.id = B.batch_processing_id)
    where A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_processing > :packagingStart and A.date_of_processing <= :toDate and B.primary_packaging_id is not null
    union all
    select A.depot_id, B.secondary_packaging_id, '', ifnull(B.secondary_packaging_qty, 0), A.date_of_processing, 'batch_process'
    from batch_processing A join batch_variations B on (A.id = B.batch_processing_id)
    where A.status = 'Approved' and A.depot_id in (:depotIds) and A.date_of_processing > :packagingStart and A.date_of_processing <= :toDate and B.secondary_packaging_id is not null
    union all
    select A.depot_id, B.raw_material_id, ${barcode('B.barcode')}, B.qty, A.date_of_processing, 'rm_stock_out'
    from raw_material_in_out A join raw_material_in_out_items B on (A.id = B.raw_material_in_out_id)
    where A.status = 'Approved' and B.type = 'Stock Out' and A.depot_id in (:depotIds) and A.date_of_processing > :stockStart and A.date_of_processing <= :toDate`;
};

const IN_KINDS = `('rm_in', 'rm_stock_in', 'depot_in')`;
const periodSum = (kind) => `round(ifnull(sum(case when X.moved_on >= :fromDate and X.kind = '${kind}' then X.qty end), 0), 2) as ${kind}_qty`;

const rawMaterialInOut = {
  key: 'raw-material-in-out',
  name: 'Raw Material IN/Out Stock',
  group: 'Production',
  repId: 2,
  description: 'Opening stock, everything in and out in the period, and closing stock, for each depot and material.',
  filters: [
    dateRange,
    { name: 'depot_id', type: 'depot', label: 'Depot', allowAll: true },
    { name: 'barcodes', type: 'checkbox', label: 'Show barcodes' }
  ],
  run: async (ctx) => {
    const depotIds = limitDepots(ctx);
    if (!depotIds.length) return { sheets: [] };
    const byBarcode = ctx.filters.barcodes;
    const rows = await query(
      `select D.state, D.city, D.depot_name, M.rm_name, M.material_type, X.barcode,
         round(ifnull(sum(case when X.moved_on < :fromDate then (case when X.kind in ${IN_KINDS} then X.qty else -X.qty end) end), 0), 2) as opening_qty,
         ${periodSum('depot_in')}, ${periodSum('rm_in')}, ${periodSum('rm_stock_in')},
         ${periodSum('depot_out')}, ${periodSum('batch_process')}, ${periodSum('rm_stock_out')}
       from (${movements(byBarcode)}) X
       left join depot_master D on (X.depot_id = D.id) left join raw_material_master M on (X.raw_material_id = M.id)
       where X.raw_material_id is not null
       group by X.depot_id, X.raw_material_id, X.barcode, D.state, D.city, D.depot_name, M.rm_name, M.material_type
       having opening_qty <> 0 or depot_in_qty <> 0 or rm_in_qty <> 0 or rm_stock_in_qty <> 0 or depot_out_qty <> 0 or batch_process_qty <> 0 or rm_stock_out_qty <> 0
       order by D.depot_name, M.rm_name, X.barcode`,
      { depotIds, fromDate: ctx.filters.fromDate, toDate: ctx.filters.toDate, stockStart: STOCK_START, packagingStart: PACKAGING_START }
    );
    rows.forEach((row) => {
      row.closing_qty = roundTo(+row.opening_qty + +row.depot_in_qty + +row.rm_in_qty + +row.rm_stock_in_qty - +row.depot_out_qty - +row.batch_process_qty - +row.rm_stock_out_qty);
    });
    return {
      sheets: [{
        name: 'Raw Material Stock',
        columns: [
          text('state', 'State'), text('city', 'City'), text('depot_name', 'Depot Name'), text('rm_name', 'Raw Material Name', { width: 32 }),
          ...(byBarcode ? [text('barcode', 'Barcode')] : []),
          text('material_type', 'Material Type'), number('opening_qty', 'Opening Qty'), number('depot_in_qty', 'Depot In Qty'),
          number('rm_in_qty', 'Raw Material In Qty'), number('rm_stock_in_qty', 'Stock In Qty'), number('depot_out_qty', 'Depot Out Qty'),
          number('batch_process_qty', 'Batch Process Qty'), number('rm_stock_out_qty', 'Stock Out Qty'), number('closing_qty', 'Closing Qty')
        ],
        rows
      }]
    };
  }
};

// ---------- Screen Load Time (rep 22, shown with the Payment Receivable tick) ----------

// The log has no date, so PHP's date filter did nothing and it exported all 490,000+ rows. A summary by screen answers
// what this report is for; the latest rows follow.
const LATEST_LOADS = 20000;
const screenLoad = {
  key: 'screen-load-time',
  name: 'Screen Load Time',
  group: 'Other',
  repId: 9,
  description: 'How long each ERP screen takes to load: a summary by screen, then the latest loads.',
  filters: [],
  run: async () => {
    const [summary, latest] = await Promise.all([
      query(
        `select substring_index(url, '?', 1) as screen, count(*) as loads, avg(loadtime) as average, max(loadtime) as slowest
         from loading_screen_log group by substring_index(url, '?', 1) order by average desc limit 2000`
      ),
      query(`select id, loadtime, url from loading_screen_log order by id desc limit ${LATEST_LOADS}`)
    ]);
    return {
      sheets: [
        {
          name: 'By Screen',
          columns: [text('screen', 'Screen', { width: 60 }), number('loads', 'Loads'), number('average', 'Average (Sec)'), number('slowest', 'Slowest (Sec)')],
          rows: summary
        },
        {
          name: 'Latest Loads',
          columns: [number('id', 'Id'), number('loadtime', 'Load Time (Sec)'), text('url', 'Url', { width: 70 })],
          rows: latest
        }
      ]
    };
  }
};

export default [purchaseOrder, productCost, productionData, rawMaterialStock, rawMaterialInOut, screenLoad];
