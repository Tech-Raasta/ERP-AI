import { QueryTypes } from 'sequelize';

// Sales (old PHP Distributor_out) amount calculations.
// Line formulas are the old form's get_amount / get_total (distributor_out_details.php);
// the frontend (views/sales/Sales/salesCalc.js) uses the same formulas.

export const round = (value, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.round((+value || 0) * factor) / factor;
};

// Intra-state (CGST + SGST) when the depot and the billing state match, else IGST
export const getTaxType = (depotState, state) => (
  (depotState || '').toString().trim().toUpperCase() === (state || '').toString().trim().toUpperCase() ? 'Intra' : 'Inter'
);

// Sell rate (before tax) from the MRP rate and a discount %
export const sellRateFromDiscount = (rate, discount, taxPer) => (
  round(((+rate || 0) - (((+rate || 0) * (+discount || 0)) / 100)) / (100 + (+taxPer || 0)) * 100, 4)
);

// One item line from qty, rate, sell rate and tax %
export const calculateLine = (line, taxType) => {
  const qty = +line.qty || 0;
  const rate = +line.rate || 0;
  const sellRate = +line.sell_rate || 0;
  const taxPer = +line.tax_per || 0;

  const cgst = taxType === 'Intra' ? taxPer / 2 : 0;
  const sgst = taxType === 'Intra' ? taxPer / 2 : 0;
  const igst = taxType === 'Intra' ? 0 : taxPer;

  const amount = qty * sellRate;
  const cgstAmt = round(amount * cgst / 100);
  const sgstAmt = round(amount * sgst / 100);
  const igstAmt = round(amount * igst / 100);
  const taxAmt = round(cgstAmt + sgstAmt + igstAmt);
  const totalAmt = round(taxAmt + amount);

  return {
    tax_type: taxType,
    amount: round(amount),
    cgst_amt: cgstAmt,
    sgst_amt: sgstAmt,
    igst_amt: igstAmt,
    tax_amt: taxAmt,
    total_amt: totalAmt,
    disc_amt: round(round(qty * rate) - totalAmt)
  };
};

// Header totals; invoice amount is rounded to the rupee (old PHP get_total)
export const calculateTotals = (lines, shippingCharges) => {
  const sum = (key) => round(lines.reduce((total, line) => total + (+line[key] || 0), 0));
  const finalAmount = sum('total_amt');
  const invoice = finalAmount + (+shippingCharges || 0);
  return {
    amount: sum('amount'),
    cgst_amount: sum('cgst_amt'),
    sgst_amount: sum('sgst_amt'),
    igst_amount: sum('igst_amt'),
    tax_amount: sum('tax_amt'),
    final_amount: finalAmount,
    round_off_amount: round(Math.round(invoice) - round(invoice)),
    invoice_amount: Math.round(invoice)
  };
};

// Old PHP set_distributor_out_items: distributor_out_items holds Bar / Box lines as entered,
// and every Combo Box line exploded into its items, with the combo discount spread over them.
export const setDistributorOutItems = async (sequelize, distributorOutId, transaction) => {
  const select = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
  const insert = (row) => sequelize.query(
    `insert into distributor_out_items (distributor_out_id, type, item_id, qty, sell_rate, grams, rate, amount, cgst_amt,
       sgst_amt, igst_amt, tax_amt, total_amt, margin_per, promo_margin, tax_percentage, discount, discount_amt, tax_type, combo_box_id)
     values (:distributor_out_id, :type, :item_id, :qty, :sell_rate, :grams, :rate, :amount, :cgst_amt,
       :sgst_amt, :igst_amt, :tax_amt, :total_amt, :margin_per, :promo_margin, :tax_percentage, :discount, :discount_amt, :tax_type, :combo_box_id)`,
    { replacements: row, transaction }
  );

  await sequelize.query(`delete from distributor_out_items where distributor_out_id = :id`, { replacements: { id: distributorOutId }, transaction });

  const saleItems = await select(`select * from distributor_out_sale_items where distributor_out_id = :id order by id`, { id: distributorOutId });
  for (const saleItem of saleItems) {
    if (saleItem.type === 'Box' || saleItem.type === 'Bar') {
      await insert({
        distributor_out_id: distributorOutId,
        type: saleItem.type,
        item_id: saleItem.item_id,
        qty: saleItem.qty,
        sell_rate: saleItem.sell_rate,
        grams: saleItem.grams,
        rate: saleItem.rate,
        amount: saleItem.amount,
        cgst_amt: saleItem.cgst_amt,
        sgst_amt: saleItem.sgst_amt,
        igst_amt: saleItem.igst_amt,
        tax_amt: saleItem.tax_amt,
        total_amt: saleItem.total_amt,
        margin_per: saleItem.margin_per,
        promo_margin: saleItem.promo_margin,
        tax_percentage: saleItem.tax_percentage,
        discount: saleItem.discount,
        discount_amt: saleItem.discount_amt,
        tax_type: saleItem.tax_type,
        combo_box_id: saleItem.combo_box_id || 0
      });
      continue;
    }

    const comboBoxId = saleItem.item_id;
    const comboQty = +saleItem.qty || 0;
    const comboAmt = +saleItem.total_amt || 0;
    const taxType = saleItem.tax_type;

    // MRP value of the combo contents
    const totals = await select(
      `select sum(:comboQty * ifnull(A.qty, 0) * ifnull(case when A.type = 'Box' then B.rate else C.rate end, 0)) as total_amount
       from combo_box_items A
       left join box_master B on (A.item_id = B.id)
       left join product_master C on (A.item_id = C.id)
       where A.combo_box_id = :comboBoxId`,
      { comboQty, comboBoxId }
    );
    const totalAmount = totals.length ? (+totals[0].total_amount || 0) : 0;
    const discPer = totalAmount !== 0 ? round(((totalAmount - comboAmt) / totalAmount) * 100) : 0;

    const contents = await select(
      `select A.type, A.item_id, A.qty,
         case when A.type = 'Box' then B.grams else C.grams end as item_grams,
         case when A.type = 'Box' then B.rate else C.rate end as item_rate,
         case when D.gst = 'Yes' then D.gst_rate when A.type = 'Box' then B.tax_percentage else C.tax_percentage end as item_tax_per
       from combo_box_items A
       left join box_master B on (A.item_id = B.id)
       left join product_master C on (A.item_id = C.id)
       left join combo_box_master D on (A.combo_box_id = D.id)
       where A.combo_box_id = :comboBoxId`,
      { comboBoxId }
    );
    for (const content of contents) {
      const itemQty = (+content.qty || 0) * comboQty;
      const itemRate = +content.item_rate || 0;
      const itemTaxPer = +content.item_tax_per || 0;
      const sellRate = round(((itemRate - ((itemRate * discPer) / 100)) / (100 + itemTaxPer)) * 100, 4);

      const cgst = taxType === 'Intra' ? itemTaxPer / 2 : 0;
      const sgst = taxType === 'Intra' ? itemTaxPer / 2 : 0;
      const igst = taxType === 'Intra' ? 0 : itemTaxPer;
      const cgstAmt = round(itemQty * ((sellRate * cgst) / 100));
      const sgstAmt = round(itemQty * ((sellRate * sgst) / 100));
      const igstAmt = round(itemQty * ((sellRate * igst) / 100));
      const taxAmt = round(cgstAmt + sgstAmt + igstAmt);
      const amount = round(itemQty * sellRate);
      const totalAmt = round(amount + taxAmt);

      await insert({
        distributor_out_id: distributorOutId,
        type: content.type,
        item_id: content.item_id,
        qty: itemQty,
        sell_rate: sellRate,
        grams: +content.item_grams || 0,
        rate: itemRate,
        amount,
        cgst_amt: cgstAmt,
        sgst_amt: sgstAmt,
        igst_amt: igstAmt,
        tax_amt: taxAmt,
        total_amt: totalAmt,
        margin_per: round(saleItem.margin_per),
        promo_margin: round(saleItem.promo_margin),
        tax_percentage: round(itemTaxPer),
        discount: discPer,
        discount_amt: round(itemQty * itemRate - totalAmt),
        tax_type: taxType,
        combo_box_id: comboBoxId
      });
    }
  }
};
