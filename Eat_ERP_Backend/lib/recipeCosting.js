import { round } from './common.js';

// Recipe Master costing, same formulas and rounding as the old PHP form (eat_erp/js/ingredients.js)
// and the PHP rate update queries (Ingredients_master_model::set_products).

const num = (value) => {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
};

// rate including tax
const taxedRate = (rate, taxPer) => num(rate) + (num(rate) * num(taxPer) / 100);

// Raw material lines: percent of total qty, cost = percent * taxed rate / 100
export const costDetails = (details) => {
  const totalKgs = round(details.reduce((sum, detail) => sum + num(detail.qty_per_batch), 0), 4);

  let totalPercent = 0;
  let totalCost = 0;
  const lines = details.map((detail) => {
    const percent = totalKgs ? round((num(detail.qty_per_batch) / totalKgs) * 100, 2) : 0;
    const cost = round((percent * taxedRate(detail.rate, detail.tax_per)) / 100, 2);
    totalPercent += percent;
    totalCost += cost;
    return { ...detail, percent, cost };
  });

  return {
    lines,
    total_kgs: totalKgs,
    total_percent: Math.round(totalPercent),
    total_cost: round(totalCost, 2)
  };
};

export const costPerGram = (totalCost, processLoss) => round((num(totalCost) * (1 + (num(processLoss) / 100))) / 1000, 4);

// Packaging cost = qty * taxed rate (4 decimals)
export const packagingCost = (qty, rate, taxPer) => round(num(qty) * taxedRate(rate, taxPer), 4);

// Variation cost: Grams -> qty * cost per gram, Piece -> qty * grams per unit * cost per gram
export const variationCost = (controlUnit, variationQty, gramsPerUnit, cpg) => (
  controlUnit === 'Grams'
    ? round(num(variationQty) * num(cpg), 2)
    : round(num(variationQty) * num(gramsPerUnit) * num(cpg), 2)
);

export const variationTotal = (variation) => round(
  num(variation.variation_cost) + num(variation.labour) + num(variation.primary_cost) +
  num(variation.secondary_cost) + num(variation.other), 2
);

// Box values written for each variation (PHP save_data)
export const variationBoxValues = (controlUnit, variationQty, gramsPerUnit, productRate, mrp) => {
  let grams;
  let productQty;
  let boxProductRate;
  let amount;

  if (controlUnit === 'Grams') {
    grams = round(num(variationQty), 2);
    productQty = 1;
    boxProductRate = round(num(mrp), 2);
    amount = round(num(mrp), 2);
  } else {
    grams = round(num(variationQty), 2) * round(num(gramsPerUnit), 2);
    boxProductRate = round(num(productRate), 2);
    amount = round(num(variationQty), 2) * round(num(productRate), 2);
    productQty = round(num(variationQty), 2);
  }

  return {
    grams: round(grams, 2),
    product_qty: round(productQty, 2),
    box_product_rate: round(boxProductRate, 0),
    amount: round(amount, 0)
  };
};
