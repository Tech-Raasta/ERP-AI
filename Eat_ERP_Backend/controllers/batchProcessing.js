import sequelize from '../lib/database.js';
import { select, execute, invalid, text, today, toDate, dateOrNull, insertRow, updateRow, userDepotIds } from './sales.js';
import { escapeHtml } from '../lib/salesPrint.js';

// Batch Processing (old PHP Batch_processing): what a batch consumed (raw and packaging material, from the product's
// recipe), what it made (boxes, bars) and its wastage. Saved entries wait for approval; an approved one is changed or
// deleted through a copy (ref_id) approved in its turn. Approval posts the stock. Access: the Batch_Processing role
// section (check-auth lets a POST / PUT through on r_insert / r_edit, so approval is checked here too).
// Entries made by the Production screens (production_id) are only shown here: Production owns their figures and stock.

const STATUS_FILTERS = {
  approved: `A.status = 'Approved'`,
  pending: `(A.status = 'Pending' or A.status = 'Deleted')`,
  rejected: `A.status = 'Rejected'`,
  inactive: `A.status = 'InActive'`,
  // Production's entries in progress: PHP had no tab for them, so they could not be seen
  inprocess: `A.status = 'InProcess'`
};

// The entry's own figures: copied to the approved entry when a change of it is approved. PHP left out packaging.
const ENTRY_COLUMNS = [
  'batch_id_as_per_fssai', 'batch_no_id', 'date_of_processing', 'depot_id', 'product_id', 'no_of_batch', 'qty_in_bar',
  'actual_wastage', 'wastage_percent', 'anticipated_wastage', 'wastage_variance', 'total_kg', 'output_kg', 'avg_grams',
  'production_id', 'anticipated_water_loss', 'anticipated_output_in_kg', 'anticipated_grams', 'anticipated_output_in_bars',
  'difference_in_bars', 'actual_water_loss', 'total_wastage', 'actual_wastage_percent', 'tentative', 'packaging'
];
const RAW_COLUMNS = ['raw_material_id', 'batch_qty', 'qty', 'barcode', 'expiry_date'];
const VARIATION_COLUMNS = ['box_id', 'variation_qty', 'qty', 'primary_packaging_id', 'primary_qty', 'primary_packaging_qty',
  'secondary_packaging_id', 'secondary_qty', 'secondary_packaging_qty'];

const roundTo = (value, decimals) => {
  const factor = Math.pow(10, decimals);
  return Math.round((+value || 0) * factor) / factor;
};
const number = (value) => Number(text(value).replace(/,/g, ''));
const roleDetails = (req) => req.userData.roleDetails || {};
const getAction = (req) => ({ insert: !!roleDetails(req).r_insert, export: !!roleDetails(req).r_export });

const isProductionEntry = (row) => +row.production_id > 0 || text(row.status) === 'InProcess';

// Old PHP batch_processing_details.php buttons; the server also holds to them
const getPermissions = (req, row) => {
  const role = roleDetails(req);
  if (!row) return { submit: !!role.r_insert, delete: false, approve: false };
  if (isProductionEntry(row)) return { submit: false, delete: false, approve: false };
  const status = text(row.status);
  const own = +row.modified_by === +req.userData.userId;
  return {
    submit: !!role.r_edit && (own || status === 'Approved' || status === 'InActive'),
    delete: !!role.r_delete && (own || status === 'Approved') && status !== 'InActive',
    approve: !!role.r_approvals && !own && (status === 'Pending' || status === 'Deleted')
  };
};

const findBatch = async (id, depotIds, transaction) => {
  if (!depotIds.length) return null;
  return (await select(
    `select A.*, B.product_name, B.avg_grams as product_avg_grams, B.anticipated_wastage as product_anticipated_wastage,
       B.anticipated_water_loss as product_anticipated_water_loss, C.depot_name, D.batch_no,
       concat(ifnull(U1.first_name, ''), ' ', ifnull(U1.last_name, '')) as createdby,
       concat(ifnull(U2.first_name, ''), ' ', ifnull(U2.last_name, '')) as modifiedby,
       concat(ifnull(U3.first_name, ''), ' ', ifnull(U3.last_name, '')) as approvedby
     from batch_processing A left join product_master B on (A.product_id = B.id)
     left join depot_master C on (A.depot_id = C.id) left join batch_master D on (A.batch_no_id = D.id)
     left join user_master U1 on (A.created_by = U1.id) left join user_master U2 on (A.modified_by = U2.id)
     left join user_master U3 on (A.approved_by = U3.id)
     where A.id = :id and A.depot_id in (:depotIds)`,
    { id, depotIds }, transaction
  ))[0] || null;
};

// A change or deletion of this approved entry that is still waiting for approval
const findPendingCopy = async (refId, transaction) => (await select(
  `select id from batch_processing where ref_id = :refId and (status = 'Pending' or status = 'Deleted') order by id desc limit 1`,
  { refId }, transaction
))[0] || null;

// PHP's own query left material_type empty on the receipt, so the receipt never listed any material
const findMaterials = (id, transaction) => select(
  `select A.*, B.rm_name, B.material_type from batch_raw_material A left join raw_material_master B on (A.raw_material_id = B.id)
   where A.batch_processing_id = :id order by A.id`,
  { id }, transaction
);

const findVariations = (id, transaction) => select(
  `select A.*, B.box_name from batch_variations A left join box_master B on (A.box_id = B.id)
   where A.batch_processing_id = :id order by A.id`,
  { id }, transaction
);

// ---------- List ----------

export const getBatches = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const status = STATUS_FILTERS[text(req.query.status)] ? text(req.query.status) : 'approved';
    const pageSize = Math.min(Math.max(+req.query.pageSize || 10, 1), 1000);
    const pageIndex = Math.max(+req.query.pageIndex || 0, 0);
    const query = text(req.query.query);
    const statusCount = { approved: 0, pending: 0, rejected: 0, inactive: 0, inprocess: 0 };
    if (!depotIds.length) {
      return res.status(200).json({ total: 0, rows: [], statusCount, action: getAction(req) });
    }
    const replacements = { depotIds, search: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };
    const search = query
      ? `and (A.id like :search or date_format(A.date_of_processing, '%d/%m/%Y') like :search or A.qty_in_bar like :search
           or A.actual_wastage like :search or B.product_name like :search or C.depot_name like :search
           or D.batch_no like :search or A.batch_id_as_per_fssai like :search)`
      : '';
    const from = `from batch_processing A left join product_master B on (A.product_id = B.id)
      left join depot_master C on (A.depot_id = C.id) left join batch_master D on (A.batch_no_id = D.id)
      where A.depot_id in (:depotIds) and ${STATUS_FILTERS[status]} ${search}`;
    const [[count], rows, [counts]] = await Promise.all([
      select(`select count(*) as total ${from}`, replacements),
      select(
        `select A.id, A.date_of_processing, A.qty_in_bar, A.actual_wastage, A.status, A.production_id,
           B.product_name, C.depot_name, ifnull(D.batch_no, A.batch_id_as_per_fssai) as batch_no
         ${from} order by A.modified_on desc, A.id desc limit :limit offset :offset`,
        replacements
      ),
      select(
        `select sum(status = 'Approved') as approved, sum(status = 'Pending' or status = 'Deleted') as pending,
           sum(status = 'Rejected') as rejected, sum(status = 'InActive') as inactive, sum(status = 'InProcess') as inprocess
         from batch_processing where depot_id in (:depotIds)`,
        { depotIds }
      )
    ]);
    res.status(200).json({
      total: +count.total || 0,
      rows: rows.map(({ production_id: productionId, ...row }) => ({
        ...row,
        date_of_processing: row.date_of_processing ? toDate(row.date_of_processing) : '',
        production: isProductionEntry({ production_id: productionId, status: row.status })
      })),
      statusCount: Object.fromEntries(Object.keys(statusCount).map((key) => [key, +counts[key] || 0])),
      action: getAction(req)
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching batch processing entries failed!";
    next(error, req, res);
  }
};

// ---------- Form data ----------

export const getMasterData = async (req, res, next) => {
  try {
    const depotIds = userDepotIds(req);
    const [batchNos, depots, products, rawMaterials] = await Promise.all([
      select(`select id, batch_no from batch_master where status = 'Approved' order by id desc`),
      // PHP offered every depot, but an entry for a depot outside the user's own then disappeared from their list
      depotIds.length
        ? select(`select id, depot_name from depot_master where status = 'Approved' and id in (:depotIds) order by depot_name`, { depotIds })
        : [],
      select(`select id, product_name, avg_grams, anticipated_wastage, anticipated_water_loss from product_master where status = 'Approved' order by product_name`),
      select(`select id, rm_name, material_type from raw_material_master where status = 'Approved' and material_type in ('Raw Material', 'Packaging Material') order by rm_name`)
    ]);
    res.status(200).json({ batchNos, depots, products, rawMaterials, action: getAction(req) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching batch processing master data failed!";
    next(error, req, res);
  }
};

// Old PHP get_batch_raw_material1 + get_variations: the product's approved recipe, per batch
export const getRecipe = async (req, res, next) => {
  try {
    const productId = +req.params.productId || 0;
    const [materials, variations] = await Promise.all([
      select(
        `select B.rm_id, C.rm_name, C.material_type, B.qty_per_batch
         from ingredients_master A join ingredients_details B on (B.ing_id = A.id) join raw_material_master C on (B.rm_id = C.id)
         where A.status = 'Approved' and A.product_id = :productId and C.material_type in ('Raw Material', 'Packaging Material')
         order by B.id`,
        { productId }
      ),
      select(
        `select B.box_id, C.box_name, B.variation_qty, B.primary_packaging_id, B.primary_qty, B.secondary_packaging_id, B.secondary_qty
         from ingredients_master A join ingredients_variations B on (A.id = B.ing_id) left join box_master C on (B.box_id = C.id)
         where A.product_id = :productId and B.box_status = 'Approved' order by B.id`,
        { productId }
      )
    ]);
    res.status(200).json({
      rawMaterials: materials.filter((row) => row.material_type === 'Raw Material'),
      packagingMaterials: materials.filter((row) => row.material_type === 'Packaging Material'),
      variations
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching the recipe failed!";
    next(error, req, res);
  }
};

// Old PHP Stock get_raw_material_barcodes, for all the rows of the form at once
export const getBarcodes = async (req, res, next) => {
  try {
    const ids = text(req.query.ids).split(',').map(Number).filter((id) => id > 0);
    if (!ids.length) return res.status(200).json({ barcodes: {} });
    const rows = await select(
      `select distinct B.raw_material_id, B.barcode from raw_material_in A join raw_material_in_item_weights B on (A.id = B.raw_material_in_id)
       where A.status = 'Approved' and B.raw_material_id in (:ids) and ifnull(B.barcode, '') <> ''`,
      { ids }
    );
    const barcodes = {};
    rows.forEach((row) => {
      if (!barcodes[row.raw_material_id]) barcodes[row.raw_material_id] = [];
      barcodes[row.raw_material_id].push(row.barcode);
    });
    res.status(200).json({ barcodes });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching barcodes failed!";
    next(error, req, res);
  }
};

export const getBatch = async (req, res, next) => {
  try {
    const batch = await findBatch(+req.params.id || 0, userDepotIds(req));
    if (!batch) {
      return res.status(404).json({ message: "Batch processing entry not found!" });
    }
    const [materials, variations, pendingCopy] = await Promise.all([
      findMaterials(batch.id),
      findVariations(batch.id),
      batch.status === 'Approved' ? findPendingCopy(batch.id) : null
    ]);
    const permissions = getPermissions(req, batch);
    res.status(200).json({
      batch: { ...batch, date_of_processing: batch.date_of_processing ? toDate(batch.date_of_processing) : '' },
      rawMaterials: materials.filter((row) => row.material_type !== 'Packaging Material'),
      packagingMaterials: materials.filter((row) => row.material_type === 'Packaging Material'),
      variations,
      production: isProductionEntry(batch),
      pendingCopyId: pendingCopy ? pendingCopy.id : null,
      // Only one change of an approved entry can wait for approval
      permissions: pendingCopy ? { ...permissions, submit: false, delete: false } : permissions
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching batch processing entry failed!";
    next(error, req, res);
  }
};

// ---------- Save ----------

// Old PHP get_wastage. Worked out here as well as on the form, so what is saved cannot differ from the rules.
// PHP stored actual_wastage_percent as a fraction (0.5 for 50%) though the form calls it a percentage.
const calculate = (totalQty, product, qtyInBar, actualWastage, actualWaterLoss) => {
  const gramsInBar = +product.avg_grams || 0;
  const anticipatedWastage = +product.anticipated_wastage || 0;
  const anticipatedWaterLoss = +product.anticipated_water_loss || 0;
  const outputKg = totalQty - (totalQty * (anticipatedWastage + anticipatedWaterLoss)) / 100;
  const outputBars = gramsInBar ? (outputKg * 1000) / gramsInBar : 0;
  const differenceInBars = outputBars - qtyInBar;
  const totalWastage = (differenceInBars * gramsInBar) / 1000 + actualWastage + actualWaterLoss;
  const wastagePercent = totalQty ? (actualWastage / totalQty) * 100 : 0;
  return {
    total_kg: roundTo(totalQty, 2),
    anticipated_wastage: roundTo(anticipatedWastage, 2),
    anticipated_water_loss: roundTo(anticipatedWaterLoss, 2),
    anticipated_grams: roundTo(gramsInBar, 2),
    anticipated_output_in_kg: roundTo(outputKg, 2),
    anticipated_output_in_bars: roundTo(outputBars, 2),
    avg_grams: roundTo(qtyInBar ? (outputKg * 1000) / qtyInBar : 0, 2),
    difference_in_bars: roundTo(differenceInBars, 2),
    total_wastage: roundTo(totalWastage, 2),
    actual_wastage_percent: roundTo(totalQty ? (totalWastage / totalQty) * 100 : 0, 2),
    wastage_percent: roundTo(wastagePercent, 2),
    wastage_variance: roundTo(wastagePercent - anticipatedWastage, 2)
  };
};

// The barcode's expiry date comes from the goods received. PHP only looked it up for a visible barcode box, and its
// searchable box never counted as visible, so it was not saved.
const expiryDates = async (rows, transaction) => {
  const barcodes = [...new Set(rows.map((row) => row.barcode).filter((barcode) => barcode && barcode !== 'NA'))];
  if (!barcodes.length) return new Map();
  const found = await select(
    `select B.raw_material_id, B.barcode, min(B.expiry_date) as expiry_date
     from raw_material_in A join raw_material_in_item_weights B on (A.id = B.raw_material_in_id)
     where A.status = 'Approved' and B.barcode in (:barcodes) group by B.raw_material_id, B.barcode`,
    { barcodes }, transaction
  );
  return new Map(found.map((row) => [`${row.raw_material_id}|${row.barcode}`, row.expiry_date ? toDate(row.expiry_date) : null]));
};

// Validates the form (old PHP validations.js form_batch_processing_details) and works out the figures
const buildBatch = async (req, existing) => {
  const body = req.body || {};
  const errors = {};
  const addError = (key, message) => {
    if (!errors[key]) errors[key] = { message };
  };

  const batchNoId = +body.batch_no_id || 0;
  let batchNo = null;
  if (!batchNoId) addError('batch_no_id', 'Batch no is required.');
  else {
    [batchNo] = await select(`select id, batch_no from batch_master where id = :batchNoId`, { batchNoId });
    if (!batchNo) addError('batch_no_id', 'Batch no not found.');
  }

  const dateOfProcessing = dateOrNull(body.date_of_processing);
  if (!dateOfProcessing) addError('date_of_processing', 'Date of processing is required.');
  else if (dateOfProcessing > today()) addError('date_of_processing', 'Date of processing cannot be in the future.');

  const depotId = +body.depot_id || 0;
  if (!depotId) addError('depot_id', 'Depot is required.');
  else if (!userDepotIds(req).includes(depotId)) addError('depot_id', 'You do not have access to this depot.');

  const productId = +body.product_id || 0;
  let product = null;
  if (!productId) addError('product_id', 'Product is required.');
  else {
    [product] = await select(`select id, avg_grams, anticipated_wastage, anticipated_water_loss from product_master where id = :productId`, { productId });
    if (!product) addError('product_id', 'Product not found.');
  }

  const noOfBatch = number(body.no_of_batch);
  if (!text(body.no_of_batch)) addError('no_of_batch', 'No. of batches is required.');
  else if (isNaN(noOfBatch) || noOfBatch <= 0) addError('no_of_batch', 'No. of batches should be greater than zero.');

  const qtyInBar = number(body.qty_in_bar);
  if (!text(body.qty_in_bar)) addError('qty_in_bar', 'Qty in bar is required.');
  else if (isNaN(qtyInBar) || qtyInBar < 0) addError('qty_in_bar', 'Qty in bar cannot be negative.');

  const actualWastage = number(body.actual_wastage);
  if (!text(body.actual_wastage)) addError('actual_wastage', 'Actual wastage is required.');
  else if (isNaN(actualWastage) || actualWastage < 0) addError('actual_wastage', 'Actual wastage cannot be negative.');

  const actualWaterLoss = number(body.actual_water_loss);
  if (isNaN(actualWaterLoss) || actualWaterLoss < 0) addError('actual_water_loss', 'Actual water loss cannot be negative.');

  const rawMaterials = (Array.isArray(body.raw_materials) ? body.raw_materials : [])
    .map((row) => ({
      raw_material_id: +row.raw_material_id || 0,
      batch_qty: roundTo(number(row.batch_qty), 4),
      qty: number(row.qty),
      qtyText: text(row.qty),
      barcode: text(row.barcode).substring(0, 30)
    }));
  if (!rawMaterials.length) addError('raw_materials', 'Please add atleast one raw material.');
  else if (rawMaterials.some((row) => !row.raw_material_id || !row.qtyText || isNaN(row.qty) || row.qty < 0)) {
    addError('raw_materials', 'Select the raw material and enter its actual qty on every row.');
  }

  const packaging = body.packaging ? 1 : 0;
  const packagingMaterials = packaging
    ? (Array.isArray(body.packaging_materials) ? body.packaging_materials : []).map((row) => ({
      raw_material_id: +row.raw_material_id || 0, qty: number(row.qty), qtyText: text(row.qty)
    }))
    : [];
  if (packagingMaterials.some((row) => !row.raw_material_id || !row.qtyText || isNaN(row.qty) || row.qty < 0)) {
    addError('packaging_materials', 'Select the packaging material and enter its qty on every row.');
  }

  const variations = (Array.isArray(body.variations) ? body.variations : []).filter((row) => +row.box_id).map((row) => {
    const qty = roundTo(number(row.qty), 2);
    const primaryQty = number(row.primary_qty) || 0;
    const secondaryQty = number(row.secondary_qty) || 0;
    return {
      box_id: +row.box_id,
      variation_qty: roundTo(number(row.variation_qty), 2),
      qty,
      primary_packaging_id: +row.primary_packaging_id || null,
      primary_qty: roundTo(primaryQty, 2),
      primary_packaging_qty: roundTo(qty * primaryQty, 2),
      secondary_packaging_id: +row.secondary_packaging_id || null,
      secondary_qty: roundTo(secondaryQty, 2),
      secondary_packaging_qty: roundTo(qty * secondaryQty, 2)
    };
  });
  if (variations.some((row) => row.qty < 0)) addError('variations', 'Box qty cannot be negative.');

  const remarks = text(body.remarks).replace(/'/g, '');
  if (existing && existing.status === 'Approved' && !remarks) addError('remarks', 'Give the reason for changing this approved entry.');

  const materialIds = [...new Set([...rawMaterials, ...packagingMaterials].map((row) => row.raw_material_id).filter(Boolean))];
  if (materialIds.length && !errors.raw_materials) {
    const known = await select(`select id from raw_material_master where id in (:materialIds)`, { materialIds });
    if (known.length !== materialIds.length) addError('raw_materials', 'A selected material no longer exists.');
  }

  if (Object.keys(errors).length) return { errors };

  const expiry = await expiryDates(rawMaterials);
  const totalQty = rawMaterials.reduce((sum, row) => sum + row.qty, 0);
  return {
    row: {
      batch_id_as_per_fssai: batchNo.batch_no,
      batch_no_id: batchNoId,
      date_of_processing: dateOfProcessing,
      depot_id: depotId,
      no_of_batch: noOfBatch,
      product_id: productId,
      qty_in_bar: roundTo(qtyInBar, 2),
      actual_wastage: roundTo(actualWastage, 2),
      actual_water_loss: roundTo(actualWaterLoss, 2),
      output_kg: existing ? +existing.output_kg || 0 : 0,
      production_id: 0,
      tentative: 0,
      packaging,
      remarks,
      ...calculate(totalQty, product, qtyInBar, actualWastage, actualWaterLoss)
    },
    // Recipes go to 4 decimals (433 of 1,092 lines use more than 2); PHP cut them to 2 on save, so stock did not
    // match the recipe
    materials: [
      ...rawMaterials.map((row) => ({
        raw_material_id: row.raw_material_id,
        batch_qty: row.batch_qty,
        qty: roundTo(row.qty, 4),
        barcode: row.barcode,
        expiry_date: expiry.get(`${row.raw_material_id}|${row.barcode}`) || null
      })),
      ...packagingMaterials.map((row) => ({ raw_material_id: row.raw_material_id, batch_qty: null, qty: roundTo(row.qty, 4), barcode: null, expiry_date: null }))
    ],
    variations
  };
};

const saveChildren = async (id, materials, variations, transaction) => {
  await execute(`delete from batch_raw_material where batch_processing_id = :id`, { id }, transaction);
  await execute(`delete from batch_variations where batch_processing_id = :id`, { id }, transaction);
  for (const row of materials) {
    await insertRow('batch_raw_material', { batch_processing_id: id, ...row }, transaction);
  }
  for (const row of variations) {
    await insertRow('batch_variations', { batch_processing_id: id, ...row }, transaction);
  }
};

export const createBatch = async (req, res, next) => {
  try {
    const built = await buildBatch(req, null);
    if (built.errors) return invalid(res, built.errors);
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const id = await insertRow('batch_processing', {
        ...built.row, status: 'Pending', ref_id: null, created_by: userId, created_on: now, modified_by: userId, modified_on: now
      }, t);
      await saveChildren(id, built.materials, built.variations, t);
      await t.commit();
      res.status(201).json({ message: "Batch processing entry submitted for approval!", id });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Saving batch processing entry failed!";
    next(error, req, res);
  }
};

// Submit For Approval on an existing entry: a change of an approved entry goes into a copy, the entry stays as it is
export const updateBatch = async (req, res, next) => {
  try {
    const existing = await findBatch(+req.params.id || 0, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Batch processing entry not found!" });
    }
    if (!getPermissions(req, existing).submit) {
      return res.status(401).json({ message: "You cannot change this batch processing entry." });
    }
    if (existing.status === 'Approved' && await findPendingCopy(existing.id)) {
      return res.status(409).json({ message: "A change of this entry is already waiting for approval." });
    }
    const built = await buildBatch(req, existing);
    if (built.errors) return invalid(res, built.errors);
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      let id = existing.id;
      if (existing.status === 'Approved') {
        id = await insertRow('batch_processing', {
          ...built.row, status: 'Pending', ref_id: existing.id, created_by: userId, created_on: now, modified_by: userId, modified_on: now
        }, t);
      } else {
        await updateRow('batch_processing', id, { ...built.row, status: 'Pending', modified_by: userId, modified_on: now }, t);
      }
      await saveChildren(id, built.materials, built.variations, t);
      await t.commit();
      res.status(200).json({ message: "Batch processing entry submitted for approval!", id });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Saving batch processing entry failed!";
    next(error, req, res);
  }
};

// Old PHP btn_delete: an approved entry gets a deletion request (Deleted, waiting for approval); any other is set InActive
export const deleteBatch = async (req, res, next) => {
  try {
    const existing = await findBatch(+req.params.id || 0, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Batch processing entry not found!" });
    }
    if (!getPermissions(req, existing).delete) {
      return res.status(401).json({ message: "You cannot delete this batch processing entry." });
    }
    const userId = req.userData.userId;
    const now = new Date();
    if (existing.status !== 'Approved') {
      await updateRow('batch_processing', existing.id, { status: 'InActive', modified_by: userId, modified_on: now });
      return res.status(200).json({ message: "Batch processing entry deleted!" });
    }
    if (await findPendingCopy(existing.id)) {
      return res.status(409).json({ message: "A change of this entry is already waiting for approval." });
    }
    const remarks = text((req.body || {}).remarks).replace(/'/g, '');
    if (!remarks) {
      return invalid(res, { remarks: { message: 'Give the reason for deleting this approved entry.' } });
    }
    const row = Object.fromEntries(ENTRY_COLUMNS.map((key) => [key, existing[key] === undefined ? null : existing[key]]));
    const t = await sequelize.transaction();
    try {
      const id = await insertRow('batch_processing', {
        ...row,
        date_of_processing: toDate(existing.date_of_processing),
        remarks,
        status: 'Deleted',
        ref_id: existing.id,
        created_by: userId,
        created_on: now,
        modified_by: userId,
        modified_on: now
      }, t);
      const materials = await findMaterials(existing.id, t);
      const variations = await findVariations(existing.id, t);
      const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source[key]]));
      await saveChildren(
        id,
        materials.map((item) => ({ ...pick(item, RAW_COLUMNS), expiry_date: item.expiry_date ? toDate(item.expiry_date) : null })),
        variations.map((item) => pick(item, VARIATION_COLUMNS)),
        t
      );
      await t.commit();
      res.status(200).json({ message: "Deletion submitted for approval!", id });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Deleting batch processing entry failed!";
    next(error, req, res);
  }
};

// ---------- Approve / Reject ----------

// Old PHP Stock_model::set_stock('Batch Processing'): takes the material of an approved entry out of stock. PHP also
// wrote the rows of a deleted entry (status InActive), and stock totals do not look at status, so a deleted batch went
// on reducing stock. A deleted entry now has no stock rows.
const postStock = async (id, userId, now, transaction) => {
  await execute(
    `delete from stock where batch_processing_id = :id and (stock_type = 'Batch Processing' or stock_type = 'Batch Packaging')`,
    { id }, transaction
  );
  const [batch] = await select(`select id, status, date_of_processing, depot_id from batch_processing where id = :id`, { id }, transaction);
  if (!batch || batch.status !== 'Approved') return;

  const base = {
    stock_date: toDate(batch.date_of_processing),
    depot_id: batch.depot_id,
    batch_processing_id: batch.id,
    raw_material_in_id: 0,
    depot_transfer_id: 0,
    raw_material_in_out_id: 0,
    production_id: 0,
    status: batch.status,
    created_by: userId,
    created_on: now,
    modified_by: userId,
    modified_on: now,
    approved_by: userId,
    approved_on: now
  };
  const takeOut = (fields, quantity) => insertRow('stock', { ...base, ...fields, quantity, stock_quantity: quantity * -1 }, transaction);

  for (const item of await select(`select * from batch_raw_material where batch_processing_id = :id`, { id }, transaction)) {
    await takeOut({
      stock_type: 'Batch Processing',
      raw_material_id: item.raw_material_id,
      barcode: text(item.barcode),
      expiry_date: item.expiry_date ? toDate(item.expiry_date) : null
    }, +item.qty || 0);
  }
  for (const item of await select(`select * from batch_variations where batch_processing_id = :id`, { id }, transaction)) {
    for (const [materialId, quantity] of [[item.primary_packaging_id, item.primary_packaging_qty], [item.secondary_packaging_id, item.secondary_packaging_qty]]) {
      if (materialId && +quantity > 0) {
        await takeOut({ stock_type: 'Batch Packaging', raw_material_id: materialId, barcode: '', expiry_date: null }, +quantity);
      }
    }
  }
};

// Old PHP save_data with btn_approve: a change (ref_id) is written back into the approved entry and its copy removed;
// a deletion request makes it InActive. Stock follows.
export const approveBatch = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot approve batch processing entries." });
    }
    const id = +req.params.id || 0;
    const existing = await findBatch(id, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Batch processing entry not found!" });
    }
    if (!getPermissions(req, existing).approve) {
      return res.status(401).json({ message: "You cannot approve this batch processing entry." });
    }
    const userId = req.userData.userId;
    const now = new Date();
    const remarks = (text((req.body || {}).remarks) || text(existing.remarks)).replace(/'/g, '');
    const t = await sequelize.transaction();
    try {
      const [locked] = await select(`select id, status, ref_id, modified_by from batch_processing where id = :id for update`, { id }, t);
      if (!locked || (locked.status !== 'Pending' && locked.status !== 'Deleted')) {
        await t.rollback();
        return res.status(409).json({ message: "This entry has already been dealt with." });
      }
      const status = locked.status === 'Deleted' ? 'InActive' : 'Approved';
      let approvedId = id;
      if (locked.ref_id) {
        const refId = locked.ref_id;
        const [original] = await select(`select id from batch_processing where id = :refId for update`, { refId }, t);
        if (!original) {
          await t.rollback();
          return res.status(409).json({ message: "The approved entry this change belongs to no longer exists." });
        }
        await execute(
          `update batch_processing A, batch_processing B
           set ${ENTRY_COLUMNS.map((key) => `A.${key} = B.${key}`).join(', ')}, A.status = :status, A.remarks = :remarks,
             A.modified_by = B.modified_by, A.modified_on = B.modified_on, A.approved_by = :userId, A.approved_on = :now
           where A.id = :refId and B.id = :id`,
          { status, remarks, userId, now, refId, id }, t
        );
        await execute(`delete from batch_raw_material where batch_processing_id = :refId`, { refId }, t);
        await execute(`delete from batch_variations where batch_processing_id = :refId`, { refId }, t);
        await execute(`update batch_raw_material set batch_processing_id = :refId where batch_processing_id = :id`, { refId, id }, t);
        await execute(`update batch_variations set batch_processing_id = :refId where batch_processing_id = :id`, { refId, id }, t);
        await execute(`delete from batch_processing where id = :id`, { id }, t);
        approvedId = refId;
      } else {
        await updateRow('batch_processing', id, { status, remarks, approved_by: userId, approved_on: now }, t);
      }
      await postStock(approvedId, userId, now, t);
      await t.commit();
      res.status(200).json({
        message: status === 'Approved' ? "Batch processing entry approved!" : "Batch processing entry deleted!",
        id: approvedId,
        print: status === 'Approved'
      });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Approving batch processing entry failed!";
    next(error, req, res);
  }
};

// PHP dropped the remarks here, so the reason for a rejection was lost
export const rejectBatch = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_approvals) {
      return res.status(401).json({ message: "You cannot reject batch processing entries." });
    }
    const existing = await findBatch(+req.params.id || 0, userDepotIds(req));
    if (!existing) {
      return res.status(404).json({ message: "Batch processing entry not found!" });
    }
    if (!getPermissions(req, existing).approve) {
      return res.status(401).json({ message: "You cannot reject this batch processing entry." });
    }
    const remarks = (text((req.body || {}).remarks) || text(existing.remarks)).replace(/'/g, '');
    const [result] = await execute(
      `update batch_processing set status = 'Rejected', remarks = :remarks, approved_by = :userId, approved_on = :now
       where id = :id and (status = 'Pending' or status = 'Deleted')`,
      { remarks, userId: req.userData.userId, now: new Date(), id: existing.id }
    );
    if (result && result.affectedRows === 0) {
      return res.status(409).json({ message: "This entry has already been dealt with." });
    }
    res.status(200).json({ message: "Batch processing entry rejected!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Rejecting batch processing entry failed!";
    next(error, req, res);
  }
};

// ---------- Add Batch No (popup on the form) ----------

// Old PHP save_batch_no sent the user back to a blank form, losing what they had typed
export const createBatchNo = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_insert) {
      return res.status(401).json({ message: "You cannot add batch numbers." });
    }
    const body = req.body || {};
    const batchNo = text(body.batch_no);
    const dateOfProcessing = dateOrNull(body.date_of_processing);
    const errors = {};
    if (!batchNo) errors.batch_no = { message: 'Batch no is required.' };
    else if ((await select(`select id from batch_master where batch_no = :batchNo and status = 'Approved' limit 1`, { batchNo })).length) {
      errors.batch_no = { message: 'This batch no already exists.' };
    }
    if (!dateOfProcessing) errors.date_of_processing = { message: 'Date is required.' };
    if (Object.keys(errors).length) return invalid(res, errors);
    const userId = req.userData.userId;
    const now = new Date();
    const id = await insertRow('batch_master', {
      batch_no: batchNo, date_of_processing: dateOfProcessing, status: 'Approved', created_by: userId, created_date: now, updated_by: userId, updated_date: now
    });
    res.status(201).json({ message: "Batch no added!", batchNo: { id, batch_no: batchNo } });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Adding batch no failed!";
    next(error, req, res);
  }
};

// ---------- Receipt ----------

const stamp = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const two = (part) => String(part).padStart(2, '0');
  // PHP printed the month where the minutes belong (h:m:i)
  return `${two(date.getDate())}-${two(date.getMonth() + 1)}-${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
};

const renderReceipt = (batch, items) => {
  const date = batch.date_of_processing ? toDate(batch.date_of_processing).split('-').reverse().join('/') : '';
  const line = (label, value) => `<tr><td width="185">${label}</td><td width="189" align="right">${escapeHtml(text(value))}</td></tr>`;
  const changed = stamp(batch.created_on) !== stamp(batch.modified_on);
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Batch Processing Receipt</title>
<style>
  @media print { @page { size: portrait } }
  body { font-family: verdana; font-size: 13px; margin: 1px; }
  table { border-collapse: collapse; border-color: #333; }
  td { padding: 5px; }
  h1 { margin: 0 0 5px; padding: 10px; font-size: 20px; text-align: center; background: #f1f1f1; }
  .signatures { margin-top: 15px; font-size: 12px; text-align: center; line-height: 22px; }
  .signatures span { margin: 0 14px; }
</style></head><body>
  <h1>Batch Processing Receipt</h1>
  <div style="width:400px">
    <table border="1" cellspacing="0">
      ${line('Location', batch.depot_name)}
      ${line('Date', date)}
      ${line('Batch No', batch.batch_no || batch.batch_id_as_per_fssai)}
      ${line('Product Name', batch.product_name)}
      ${line('Quantity', batch.qty_in_bar)}
      ${line('Wastage', batch.actual_wastage)}
      ${line('Created by', text(batch.createdby).trim())}
    </table>
  </div><br />
  <table border="1" cellspacing="0" width="100%">
    <tr><td width="54" align="center"><strong>Sr. No.</strong></td><td align="center"><strong>Raw Material Name</strong></td><td width="102" align="center"><strong>Quantity</strong></td></tr>
    ${items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(text(item.rm_name))}</td><td align="right">${escapeHtml(text(item.qty))}</td></tr>`).join('')}
  </table>
  <div class="signatures">
    <div>
      <span><b>Created By:</b> ${escapeHtml(text(batch.createdby).trim())}</span>
      ${changed ? `<span><b>Modified By:</b> ${escapeHtml(text(batch.modifiedby).trim())}</span>` : ''}
      <span><b>Approved By:</b> ${escapeHtml(text(batch.approvedby).trim())}</span>
    </div>
    <div>
      <span><b>Created On:</b> ${stamp(batch.created_on)}</span>
      ${changed ? `<span><b>Modified On:</b> ${stamp(batch.modified_on)}</span>` : ''}
      <span><b>Approved On:</b> ${stamp(batch.approved_on)}</span>
    </div>
  </div>
</body></html>`;
};

export const getBatchPrint = async (req, res, next) => {
  try {
    const batch = await findBatch(+req.params.id || 0, userDepotIds(req));
    if (!batch) {
      return res.status(404).json({ message: "Batch processing entry not found!" });
    }
    res.status(200).json({ html: renderReceipt(batch, await findMaterials(batch.id)) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Printing batch processing receipt failed!";
    next(error, req, res);
  }
};
