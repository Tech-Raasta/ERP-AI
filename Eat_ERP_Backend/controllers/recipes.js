import { Op, QueryTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { round } from '../lib/common.js';
import {
  costDetails,
  costPerGram,
  packagingCost,
  variationCost,
  variationTotal,
  variationBoxValues
} from '../lib/recipeCosting.js';

import Recipe from '../models/recipe.js';
import RecipeDetail from '../models/recipeDetail.js';
import RecipeVariation from '../models/recipeVariation.js';
import Product from '../models/product.js';
import RawMaterial from '../models/rawMaterial.js';
import Box from '../models/box.js';
import BoxProduct from '../models/boxProduct.js';
import { set_product_rate } from '../models/ingredient.js';

// Recipe Master (old PHP Ingredients_master). No approval flow: a recipe is saved as 'Approved'.
// Saving a recipe also creates / updates one box (box_master + box_product) per variation,
// exactly like Ingredients_master_model::save_data.

const PRODUCT_ATTRIBUTES = ['id', 'product_name', 'grams', 'rate', 'barcode', 'hsn_code', 'hsn_name', 'short_name', 'category_id', 'tax_percentage'];
// ingredients_details is never read by id in the old PHP app, so it is not selected / ordered by id here
const DETAIL_ATTRIBUTES = ['ing_id', 'rm_id', 'qty_per_batch', 'percent', 'rate', 'tax_per', 'cost'];

const invalid = (res, error) => res.status(422).json({
  message: "Invalid inputs passed, please check your data.",
  error: error
});

const itemError = (message) => ({ errors: { items: { message } } });

const num = (value) => {
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
};

const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';

const getAction = (req) => {
  const roleDetails = req.userData.roleDetails;
  return {
    insert: roleDetails.r_insert ? true : false,
    update: roleDetails.r_edit ? true : false
  };
};

// Dropdown data. Old PHP lists Approved records; when editing, records already used by the recipe are kept.
const getMasterOptions = async (recipe, details = [], variations = []) => {
  const productCond = recipe ? { id: recipe.product_id } : { status: 'Approved' };

  const rmIds = details.map((detail) => detail.rm_id);
  const pmIds = [];
  variations.forEach((variation) => {
    if (variation.primary_packaging_id) pmIds.push(variation.primary_packaging_id);
    if (variation.secondary_packaging_id) pmIds.push(variation.secondary_packaging_id);
  });

  const products = await Product.findAll({ where: productCond, attributes: PRODUCT_ATTRIBUTES, order: [['product_name', 'ASC']] });
  const rawMaterials = await RawMaterial.findAll({
    where: { [Op.or]: [{ status: 'Approved', material_type: 'Raw Material' }, { id: rmIds.length ? rmIds : [0] }] },
    attributes: ['id', 'rm_name', 'rate', 'tax_per'],
    order: [['rm_name', 'ASC']]
  });
  const packagingMaterials = await RawMaterial.findAll({
    where: { [Op.or]: [{ status: 'Approved', material_type: 'Packaging Material' }, { id: pmIds.length ? pmIds : [0] }] },
    attributes: ['id', 'rm_name', 'rate', 'tax_per', 'packaging_type'],
    order: [['rm_name', 'ASC']]
  });

  return { products, rawMaterials, packagingMaterials };
};

// Raw material lines. Rate / tax are always the current raw material master values
// (the old PHP form re-reads them every time the recipe is opened).
const buildDetails = async (body, savedRmIds) => {
  const rows = Array.isArray(body.recipeDetails) ? body.recipeDetails : [];
  if (rows.length === 0) {
    return { error: itemError('Please add atleast one raw material') };
  }

  const ids = rows.map((row) => +row.rm_id).filter((id) => id);
  const materials = await RawMaterial.findAll({ where: { id: ids.length ? ids : [0] } });
  const materialMap = new Map(materials.map((material) => [material.id, material]));

  const details = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `Raw Material row ${i + 1}`;
    const material = materialMap.get(+row.rm_id);
    if (!material || material.material_type !== 'Raw Material') {
      return { error: itemError(`${label}: Raw Material is required`) };
    }
    if (material.status !== 'Approved' && !savedRmIds.includes(material.id)) {
      return { error: itemError(`${label}: ${material.rm_name} is not active`) };
    }
    const qty = num(row.qty_per_batch);
    if (qty === null || qty < 0) {
      return { error: itemError(`${label}: Qty is required`) };
    }
    details.push({
      rm_id: material.id,
      qty_per_batch: round(qty, 4),
      rate: round(+material.rate || 0, 2),
      tax_per: round(+material.tax_per || 0, 2)
    });
  }

  const costed = costDetails(details);
  if (!costed.total_kgs) {
    return { error: itemError('Total raw material qty must be greater than 0') };
  }
  return { costed };
};

// Packaging rate: the rate shown on the form (taken from the packaging master when the packaging is chosen),
// falling back to the master rate.
const packagingValues = (row, prefix, material) => {
  if (!material) {
    return { id: null, qty: 0, rate: 0, tax_per: 0, cost: 0 };
  }
  const rate = num(row[`${prefix}_rate`]) !== null ? num(row[`${prefix}_rate`]) : (+material.rate || 0);
  const taxPer = num(row[`${prefix}_tax_per`]) !== null ? num(row[`${prefix}_tax_per`]) : (+material.tax_per || 0);
  const qty = num(row[`${prefix}_qty`]) || 0;
  return {
    id: material.id,
    qty: round(qty, 4),
    rate: round(rate, 4),
    tax_per: round(taxPer, 4),
    cost: packagingCost(qty, rate, taxPer)
  };
};

const buildVariations = async (body, recipe, cpg, savedVariations) => {
  const rows = Array.isArray(body.recipeVariations) ? body.recipeVariations : [];
  // Old PHP: "Please add atleast one item."
  if (rows.length === 0) {
    return { error: itemError('Please add atleast one variation') };
  }

  const savedBoxIds = savedVariations.map((variation) => variation.box_id).filter((id) => id);
  const postedBoxIds = rows.map((row) => +row.box_id).filter((id) => id);
  // Every saved variation owns a box: the old PHP form does not allow removing them
  if (savedBoxIds.some((id) => !postedBoxIds.includes(id))) {
    return { error: itemError('Saved variations cannot be removed. Set the variation status to InActive instead.') };
  }
  if (postedBoxIds.some((id) => !savedBoxIds.includes(id))) {
    return { error: itemError('Variation box does not belong to this recipe') };
  }

  const pmIds = [];
  rows.forEach((row) => {
    if (+row.primary_packaging_id) pmIds.push(+row.primary_packaging_id);
    if (+row.secondary_packaging_id) pmIds.push(+row.secondary_packaging_id);
  });
  const packagings = await RawMaterial.findAll({ where: { id: pmIds.length ? pmIds : [0] } });
  const packagingMap = new Map(packagings.map((packaging) => [packaging.id, packaging]));
  const savedPmIds = [];
  savedVariations.forEach((variation) => {
    if (variation.primary_packaging_id) savedPmIds.push(variation.primary_packaging_id);
    if (variation.secondary_packaging_id) savedPmIds.push(variation.secondary_packaging_id);
  });

  const variations = [];
  const asins = new Set();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `Variation row ${i + 1}`;

    const variationQty = num(row.variation_qty);
    if (variationQty === null || variationQty <= 0) {
      return { error: itemError(`${label}: Variation Qty is required`) };
    }
    const labour = num(row.labour);
    if (labour === null) {
      return { error: itemError(`${label}: Labour is required`) };
    }
    const mrp = num(row.mrp);
    if (mrp === null) {
      return { error: itemError(`${label}: MRP is required`) };
    }
    const boxStatus = text(row.box_status) || 'Approved';
    if (!['Approved', 'InActive'].includes(boxStatus)) {
      return { error: itemError(`${label}: Status must be Active or InActive`) };
    }

    const packagingFor = (prefix, type) => {
      const id = +row[`${prefix}_packaging_id`];
      if (!id) {
        return { value: packagingValues(row, prefix, null) };
      }
      const material = packagingMap.get(id);
      if (!material || material.material_type !== 'Packaging Material' || material.packaging_type !== type) {
        return { error: `${label}: ${type} Packaging is not valid` };
      }
      if (material.status !== 'Approved' && !savedPmIds.includes(material.id)) {
        return { error: `${label}: ${material.rm_name} is not active` };
      }
      return { value: packagingValues(row, prefix, material) };
    };
    const primary = packagingFor('primary', 'Primary');
    if (primary.error) return { error: itemError(primary.error) };
    const secondary = packagingFor('secondary', 'Secondary');
    if (secondary.error) return { error: itemError(secondary.error) };

    // Old PHP: ASIN must be different for every variation, and not used by an active combo box / other box
    const asin = text(row.asin);
    const boxId = +row.box_id || null;
    if (asin) {
      if (asins.has(asin)) {
        return { error: itemError(`${label}: Please select different asin for all records.`) };
      }
      asins.add(asin);
      const comboCount = await sequelize.query(
        `select count(*) as count from combo_box_master where status = 'Approved' and asin = :asin`,
        { replacements: { asin }, type: QueryTypes.SELECT }
      );
      const boxCount = await Box.count({ where: { status: 'Approved', asin, id: { [Op.ne]: boxId || 0 } } });
      if (+comboCount[0].count > 0 || boxCount > 0) {
        return { error: itemError(`${label}: Asin (${asin}) already in use.`) };
      }
    }

    const variation = {
      box_id: boxId,
      // Text used in the box name (old PHP uses the value as typed / as stored)
      qty_text: text(row.variation_qty),
      variation_qty: round(variationQty, 2),
      labour: round(labour, 2),
      other: round(num(row.other) || 0, 2),
      asin,
      sku_code: text(row.sku_code),
      mrp: round(mrp, 2),
      primary_packaging_id: primary.value.id,
      primary_qty: primary.value.qty,
      primary_rate: primary.value.rate,
      primary_tax_per: primary.value.tax_per,
      primary_cost: primary.value.cost,
      secondary_packaging_id: secondary.value.id,
      secondary_qty: secondary.value.qty,
      secondary_rate: secondary.value.rate,
      secondary_tax_per: secondary.value.tax_per,
      secondary_cost: secondary.value.cost,
      moq_inventory: round(num(row.moq_inventory) || 0, 4),
      moq_production: round(num(row.moq_production) || 0, 4),
      box_status: boxStatus
    };
    variation.variation_cost = variationCost(recipe.control_unit, variationQty, recipe.grams_per_unit, cpg);
    variation.total = variationTotal(variation);
    variations.push(variation);
  }

  return { variations };
};

// Old PHP save_data: one box per variation (insert or update) + its box_product row
const saveVariationBox = async (recipe, product, variation, ingVariationId, savedQtyText, userId, t) => {
  // Keep the stored qty text in the box name when the qty did not change (as the PHP form posts it back)
  const qtyText = (savedQtyText !== undefined && +savedQtyText === variation.variation_qty) ? `${savedQtyText}` : variation.qty_text;
  const values = variationBoxValues(recipe.control_unit, variation.variation_qty, recipe.grams_per_unit, product.rate, variation.mrp);

  const boxData = {
    box_name: `${product.product_name} - ${qtyText} ${recipe.control_unit}`,
    barcode: product.barcode,
    grams: values.grams,
    rate: round(variation.mrp, 2),
    cost: round(variation.total, 2),
    amount: values.amount,
    hsn_code: product.hsn_code,
    hsn_name: product.hsn_name,
    short_name: product.short_name,
    category_id: product.category_id ? product.category_id : null,
    tax_percentage: product.tax_percentage,
    asin: variation.asin,
    sku_code: variation.sku_code,
    modified_by: userId,
    ing_variation_id: ingVariationId,
    product_id: product.id,
    control_unit: recipe.control_unit,
    product_name: product.product_name,
    product_qty: values.product_qty,
    variation_qty: round(variation.variation_qty, 2),
    moq_inventory: round(variation.moq_inventory, 2),
    moq_production: round(variation.moq_production, 4),
    status: variation.box_status
  };

  let boxId = variation.box_id;
  if (!boxId) {
    // Box validators (required barcode / sku etc.) are for the Box form; PHP inserts these rows directly
    const box = await Box.create({ ...boxData, created_by: userId }, { validate: false, transaction: t });
    boxId = box.id;
    await RecipeVariation.update({ box_id: boxId }, { where: { id: ingVariationId }, transaction: t });
  } else {
    await Box.update(boxData, { where: { id: boxId }, validate: false, transaction: t });
    await sequelize.query(
      `update box_master set remarks = concat(ifnull(remarks, ''), ' Updated from Recipe Master.') where id = :boxId`,
      { replacements: { boxId }, transaction: t }
    );
  }

  await BoxProduct.destroy({ where: { box_id: boxId }, transaction: t });
  await BoxProduct.create({
    box_id: boxId,
    product_id: product.id,
    qty: values.product_qty,
    grams: values.grams,
    rate: values.box_product_rate,
    amount: values.amount
  }, { validate: false, transaction: t });
};

// Shared create / update flow
const saveRecipe = async (req, res, recipe) => {
  const userId = req.userData.userId;
  recipe.getRequestData(req);
  recipe.updated_by = userId;

  const savedDetails = recipe.id
    ? await RecipeDetail.findAll({ where: { ing_id: recipe.id }, attributes: DETAIL_ATTRIBUTES })
    : [];
  const savedVariations = recipe.id
    ? await RecipeVariation.findAll({ where: { ing_id: recipe.id }, raw: true })
    : [];

  const { costed, error: detailError } = await buildDetails(req.body, savedDetails.map((detail) => detail.rm_id));
  if (detailError) {
    return invalid(res, detailError);
  }
  recipe.total_kgs = costed.total_kgs;
  recipe.total_percent = costed.total_percent;
  recipe.total_cost = costed.total_cost;
  recipe.cost_per_gram = costPerGram(costed.total_cost, recipe.process_loss);

  const error = await recipe.validateData();
  if (error) {
    return invalid(res, error);
  }

  const product = await Product.findByPk(recipe.product_id);
  if (!product) {
    return invalid(res, { errors: { product_id: { message: 'Product does not exist' } } });
  }
  if (recipe.isNewRecord && product.status !== 'Approved') {
    return invalid(res, { errors: { product_id: { message: 'Product is not active' } } });
  }

  const { variations, error: variationError } = await buildVariations(req.body, recipe, recipe.cost_per_gram, savedVariations);
  if (variationError) {
    return invalid(res, variationError);
  }

  const savedQtyByBox = new Map(savedVariations.filter((variation) => variation.box_id).map((variation) => [variation.box_id, variation.variation_qty]));

  const t = await sequelize.transaction();
  try {
    await recipe.save({ transaction: t });

    await RecipeDetail.destroy({ where: { ing_id: recipe.id }, transaction: t });
    for (const line of costed.lines) {
      await RecipeDetail.create({
        ing_id: recipe.id,
        rm_id: line.rm_id,
        qty_per_batch: line.qty_per_batch,
        percent: line.percent,
        rate: line.rate,
        tax_per: line.tax_per,
        cost: line.cost
      }, { fields: ['ing_id', 'rm_id', 'qty_per_batch', 'percent', 'rate', 'tax_per', 'cost'], transaction: t });
    }

    await RecipeVariation.destroy({ where: { ing_id: recipe.id }, transaction: t });
    for (const variation of variations) {
      const { qty_text, ...variationData } = variation;
      const row = await RecipeVariation.create({ ...variationData, ing_id: recipe.id }, { transaction: t });
      await saveVariationBox(recipe, product, variation, row.id, savedQtyByBox.get(variation.box_id), userId, t);
    }

    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  // Old PHP: set_product_rate('Ingredients', id) -> recipe_cost_master / product_cost_master history
  try {
    await set_product_rate('Ingredients', `${recipe.id}`, userId);
  } catch (error) {
    console.log('Recipe cost history update failed', error);
  }

  return null;
};

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getMasterOptions(null);
    return res.status(200).json(masterData);
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createRecipe = async (req, res, next) => {
  try {
    const recipe = Recipe.build({
      status: 'Approved',
      created_by: req.userData.userId,
      updated_by: req.userData.userId
    });

    const response = await saveRecipe(req, res, recipe);
    if (response) {
      return response;
    }

    return res.status(201).json({
      message: "Recipe added successfully",
      recipe: recipe
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a recipe failed!";
    next(error, req, res);
  }
};

export const updateRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.findByPk(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found!" });
    }

    const response = await saveRecipe(req, res, recipe);
    if (response) {
      return response;
    }

    res.status(200).json({ message: "Update successful!", recipe: recipe });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update recipe!";
    next(error, req, res);
  }
};

export const getRecipes = async (req, res, next) => {
  try {
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'updated_date', order: 'desc' };

    if (req.query) {
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query.toString().trim() : '';
      sort = { key: req.query.key, order: req.query.order };
    }

    // Old PHP list: Approved recipes only, latest updated first
    const where = { status: 'Approved' };
    if (query) {
      where['$product.product_name$'] = { [Op.like]: `%${query}%` };
    }

    const direction = (sort && sort.order && sort.order.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
    let order = [['updated_date', 'DESC']];
    if (sort && sort.key === 'product_name') {
      order = [[{ model: Product, as: 'product' }, 'product_name', direction]];
    } else if (sort && ['total_batch_bar', 'per_bar', 'total_batch_in_grams', 'control_unit', 'cost_per_gram', 'total_cost'].includes(sort.key)) {
      order = [[sort.key, direction]];
    }

    const condition = {
      where,
      attributes: ['id', 'product_id', 'total_batch_bar', 'per_bar', 'total_batch_in_grams', 'control_unit', 'grams_per_unit', 'process_loss', 'cost_per_gram', 'total_cost', 'updated_date'],
      include: [{ model: Product, as: 'product', attributes: ['product_name'] }],
      order
    };
    if (pageSize !== 'ALL') {
      if (pageIndex) {
        condition['offset'] = (pageIndex * pageSize);
      }
      if (pageSize) {
        condition['limit'] = pageSize;
      }
    }

    const { count, rows } = await Recipe.findAndCountAll(condition);

    res.status(200).json({
      message: "Recipes fetched successfully!",
      action: getAction(req),
      total: count,
      rows: rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching recipes failed!";
    next(error, req, res);
  }
};

export const getRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.findByPk(req.params.id, {
      include: [{ model: Product, as: 'product', attributes: ['product_name'] }]
    });
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found!" });
    }

    // Old PHP get_batch_raw_material(id, 'Raw Material'): only raw material lines are shown
    const details = await RecipeDetail.findAll({
      where: { ing_id: recipe.id },
      attributes: DETAIL_ATTRIBUTES,
      include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['rm_name', 'material_type'], where: { material_type: 'Raw Material' } }]
    });
    const variations = await RecipeVariation.findAll({ where: { ing_id: recipe.id }, order: [['id', 'ASC']] });
    const masterData = await getMasterOptions(recipe, details, variations);

    return res.status(200).json({ action: getAction(req), recipe, details, variations, ...masterData });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Recipe failed!";
    next(error, req, res);
  }
};
