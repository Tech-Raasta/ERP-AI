import { QueryTypes } from 'sequelize';

// Sales printouts (old PHP Tax_invoice_model::get_final_data + views/invoice/tax_invoice.php and gate_pass.php).
// PHP served these as HTML for the browser to print; so do we.

const select = (sequelize, sql, replacements, transaction) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const escapeHtml = (value) => (value === null || value === undefined ? '' : String(value))
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const toYmd = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).substring(0, 10);
};
// PHP date('d-M-y') / date('d-M-Y')
const formatDate = (value, fullYear = false) => {
  const ymd = toYmd(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [year, month, day] = ymd.split('-');
  return `${day}-${MONTHS[+month - 1]}-${fullYear ? year : year.substring(2)}`;
};

// Old PHP get_address
export const getAddress = (address, landmark, city, pincode, state, country) => {
  let text = '';
  if (address !== null && address !== undefined) text += `${address}, `;
  if (landmark !== null && landmark !== undefined) text += `${landmark}, `;
  if (city !== null && city !== undefined) text += `${city} `;
  if (pincode !== null && pincode !== undefined) text += `${pincode} `;
  if (state !== null && state !== undefined) text += `${state}, `;
  if (country !== null && country !== undefined) text += `${country},`;
  text = text.replace(', , , , ,', ',').replace(', , , ,', ',').replace(', , ,', ',').replace(', ,', ',');
  return text.includes(',') ? text.substring(0, text.length - 1) : text;
};

// Old PHP convert_number_to_words (Indian numbering: Thousand / Lakh / Crore)
const WORDS = {
  0: ' ', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine',
  10: 'Ten', 11: 'Eleven', 12: 'Twelve', 13: 'Thirteen', 14: 'Fourteen', 15: 'Fifteen', 16: 'Sixteen',
  17: 'Seventeen', 18: 'Eighteen', 19: 'Nineteen', 20: 'Twenty', 30: 'Thirty', 40: 'Forty', 50: 'Fifty',
  60: 'Sixty', 70: 'Seventy', 80: 'Eighty', 90: 'Ninety'
};
const DIGITS = ['', 'Hundred', 'Thousand', 'Lakh', 'Crore'];
export const numberToWords = (value, unit = 'Rupees') => {
  let number = +value || 0;
  const negative = number < 0;
  if (negative) number = -number;
  let no = Math.floor(number);
  const point = Math.round((number - no) * 100);
  const length = String(no).length;
  const parts = [];
  let i = 0;
  while (i < length) {
    const divider = i === 2 ? 10 : 100;
    const part = Math.floor(no % divider);
    no = Math.floor(no / divider);
    i += divider === 10 ? 1 : 2;
    if (part) {
      const counter = parts.length;
      const plural = counter && part > 9 ? 's' : '';
      const hundred = counter === 1 && parts[0] ? ' ' : '';
      parts.push(part < 21
        ? `${WORDS[part]} ${DIGITS[counter]}${plural} ${hundred}`
        : `${WORDS[Math.floor(part / 10) * 10]} ${WORDS[part % 10]} ${DIGITS[counter]}${plural} ${hundred}`);
    } else {
      parts.push('');
    }
  }
  let result = parts.reverse().join('');
  const points = point ? ` and ${numberToWords(point, 'Paise')}` : '';
  result = points ? `${result}${unit} ${points} ` : `${result}${unit} `;
  return negative ? `Negative ${result}` : result;
};

// Invoice data of one sale (old PHP get_final_data, tax invoice branch)
export const getInvoiceData = async (sequelize, id, transaction) => {
  const rows = await select(sequelize,
    `select A.*, B.distributor_name, B.class, B.send_invoice, B.state as distributor_state, B.state_code as distributor_state_code,
       B.gst_number, B.tin_number, B.address as distributor_address, B.city as distributor_city, B.pincode as distributor_pincode,
       B.country as distributor_country, D.depot_name, D.address as depot_address, D.city as depot_city, D.pincode as depot_pincode,
       D.state as depot_state, D.state_code as depot_state_code, D.country as depot_country, D.gst_no as depot_gst_no
     from distributor_out A
     left join distributor_master B on (A.distributor_id = B.id)
     left join depot_master D on (A.depot_id = D.id)
     where A.id = :id`,
    { id }, transaction
  );
  if (!rows.length) return null;
  const sale = rows[0];
  const direct = (sale.class || '').toString().trim().toUpperCase() === 'DIRECT';

  const data = {
    id: sale.id,
    class: sale.class,
    send_invoice: +sale.send_invoice === 1,
    invoice_no: sale.invoice_no,
    invoice_date: sale.invoice_date,
    date_of_processing: sale.date_of_processing,
    gate_pass_no: sale.gate_pass_no,
    voucher_no: sale.voucher_no,
    order_no: sale.order_no,
    transport_type: sale.transport_type,
    depot_name: sale.depot_name,
    depot_address: getAddress(sale.depot_address, null, sale.depot_city, sale.depot_pincode, sale.depot_state, sale.depot_country),
    depot_state: sale.depot_state,
    depot_state_code: sale.depot_state_code,
    depot_gst_no: sale.depot_gst_no,
    reverse_charge: sale.reverse_charge === 'yes' ? 'Yes' : 'No',
    gst_reverse_charge: sale.reverse_charge === 'yes' ? Math.round((+sale.tax_amount || 0) * 100) / 100 : 0,
    total_amount: Math.round((+sale.amount || 0) * 100) / 100,
    cgst_amount: sale.cgst_amount,
    sgst_amount: sale.sgst_amount,
    igst_amount: sale.igst_amount,
    shipping_charges: sale.shipping_charges || 0,
    round_off_amount: sale.round_off_amount,
    invoice_amount: sale.invoice_amount,
    total_amount_in_words: `${numberToWords(sale.invoice_amount)} Only`
  };

  // Billed to: the Direct customer typed on the sale, else the distributor
  if (direct) {
    data.distributor_name = sale.client_name;
    data.address = getAddress(sale.address, null, sale.city, sale.pincode, sale.state, sale.country);
    data.state = sale.state;
    data.state_code = sale.state_code;
    data.mobile_no = sale.mobile_no;
    data.gst_number = sale.con_gst_number || sale.gstin;
  } else {
    data.distributor_name = sale.distributor_name;
    data.address = getAddress(sale.distributor_address, null, sale.distributor_city, sale.distributor_pincode, sale.distributor_state, sale.distributor_country);
    data.state = sale.distributor_state;
    data.state_code = sale.distributor_state_code;
    data.gst_number = sale.gst_number;
  }

  // Shipped to: the consignee, or the billing party when shipping to the billing address
  if (sale.shipping_address !== 'no') {
    data.con_name = data.distributor_name;
    data.con_address = data.address;
    data.con_gst_number = sale.con_gst_number || data.gst_number;
  } else {
    data.con_name = sale.con_name;
    data.con_address = getAddress(sale.con_address, null, sale.con_city, sale.con_pincode, sale.con_state, sale.con_country);
    data.con_gst_number = sale.con_gst_number;
  }

  data.description = (await select(sequelize,
    `select A.qty, A.sell_rate, A.grams, A.rate, A.amount, A.cgst_amt, A.sgst_amt, A.igst_amt, A.total_amt, A.tax_percentage,
       case when A.type = 'Combo Box' then B.combo_box_name when A.type = 'Box' then C.box_name else D.product_name end as description,
       case when A.type = 'Combo Box' then B.hsn_code when A.type = 'Box' then C.hsn_code else D.hsn_code end as hsn_code
     from distributor_out_sale_items A
     left join combo_box_master B on (A.type = 'Combo Box' and A.item_id = B.id)
     left join box_master C on (A.type = 'Box' and A.item_id = C.id)
     left join product_master D on (A.type = 'Bar' and A.item_id = D.id)
     where A.distributor_out_id = :id order by A.id`,
    { id }, transaction
  )).map((item) => {
    const igstLine = !(+item.igst_amt);
    return {
      ...item,
      mrp: item.rate,
      rate: item.sell_rate,
      cgst_rate: igstLine ? (+item.tax_percentage || 0) / 2 : 0,
      sgst_rate: igstLine ? (+item.tax_percentage || 0) / 2 : 0,
      igst_rate: igstLine ? 0 : (+item.tax_percentage || 0)
    };
  });

  const combo = await select(sequelize,
    `select group_concat(B.combo_box_name) as combo_box_name
     from (select distinct combo_box_id from distributor_out_items where distributor_out_id = :id) A
     left join combo_box_master B on (A.combo_box_id = B.id)`,
    { id }, transaction
  );
  data.combo_box_name = combo.length ? combo[0].combo_box_name : null;

  data.tax_desc = await select(sequelize,
    `select tax_percentage, round(sum(ifnull(qty, 0) * ifnull(grams, 0)), 2) as total_grams,
       round(sum(cgst_amt), 2) as cgst_amt, round(sum(sgst_amt), 2) as sgst_amt, round(sum(igst_amt), 2) as igst_amt
     from distributor_out_items where distributor_out_id = :id
     group by tax_percentage order by tax_percentage`,
    { id }, transaction
  );
  return data;
};

const money = (value) => {
  const number = Math.round((+value || 0) * 100) / 100;
  return String(number);
};

const STYLE = `
  @media print { @page { size: portrait } .page-break { display: block; page-break-after: always; } .no-print { display: none; } }
  body { font-family: verdana; font-size: 8px; font-weight: 500; margin: 1px; line-height: 11px; }
  .inv { border-collapse: collapse; width: 100%; font-size: 8px; border: 1px solid #666; }
  .inv td { border: 1px solid #666; padding: 2px 4px; vertical-align: top; }
  .inv table td { border: none; }
  .grey { background: #ececec; }
  .r { text-align: right; } .c { text-align: center; } .b { font-weight: 900; }
  .lines { border-collapse: collapse; width: 100%; }
  .lines td { border-right: 1px solid #666 !important; }
  .lines .head td { border-bottom: 1px solid #666 !important; text-align: center; vertical-align: middle; }
  .amt { font-size: 10px; }
  .amt .cur { float: left; } .amt .val { float: right; }
  .gate_pass_details { font-family: verdana; font-size: 13px; line-height: normal; }
  .gate_pass_details table { border-collapse: collapse; border-color: #333; }
  .gate_pass_details td { padding: 5px; }
  .gate_pass_details h1 { margin: 0; font-size: 20px; padding: 10px; background: #f1f1f1; margin-bottom: 5px; }
  .gate_pass_details h2 { margin: 0; font-size: 16px; padding: 8px 0; text-align: center; }
  .print-bar { padding: 8px; text-align: right; font-size: 13px; }
`;

const page = (title, body) => `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body>
<div class="print-bar no-print"><button onclick="window.print()">Print</button></div>
${body}
</body></html>`;

const amountRow = (label, value, cls = '') => `
  <td class="amt ${cls}">${label}</td>
  <td class="amt ${cls}"><span class="cur">&#8377;</span><span class="val">${escapeHtml(value)}</span></td>`;

// One copy of the tax invoice; tick = 0 Accounts, 1 Retailer, 2 Acknowledgement (old PHP printed all three)
const invoiceCopy = (inv, tick, assetUrl) => {
  const e = escapeHtml;
  const checks = ['Accounts', 'Retailer', 'Acknowledgement'].map((label, index) => `
    <tr><td style="border:1px solid #666;width:20%">${index === tick ? '&#10004;' : '&nbsp;'}</td><td style="border:1px solid #666">${label}</td></tr>`).join('');

  const lines = inv.description.map((item, index) => `
    <tr>
      <td class="c">${index + 1}</td>
      <td>${e(item.description)}</td>
      <td class="r">${e(item.hsn_code)}</td>
      <td class="r">${e(item.grams)}gm</td>
      <td class="r">${e(item.qty)}</td>
      <td class="r">${e(item.mrp)}</td>
      <td class="r">${e(item.rate)}</td>
      <td class="r">${e(item.amount)}</td>
      <td class="r">0</td>
      <td class="r">${e(item.amount)}</td>
      <td class="r">${e(item.cgst_rate)}</td><td class="r">${e(item.cgst_amt)}</td>
      <td class="r">${e(item.sgst_rate)}</td><td class="r">${e(item.sgst_amt)}</td>
      <td class="r">${e(item.igst_rate)}</td><td class="r">${e(item.igst_amt)}</td>
      <td class="r" style="border-right:none !important">${e(item.total_amt)}</td>
    </tr>`).join('');

  let totalGrams = 0;
  let totCgst = 0;
  let totSgst = 0;
  let totIgst = 0;
  const taxRows = inv.tax_desc.map((tax) => {
    const cgstAmt = +tax.cgst_amt || 0;
    const sgstAmt = +tax.sgst_amt || 0;
    const igstAmt = +tax.igst_amt || 0;
    totalGrams += +tax.total_grams || 0;
    totCgst += cgstAmt;
    totSgst += sgstAmt;
    totIgst += igstAmt;
    const intra = cgstAmt > 0;
    return `<tr>
      <td class="c">${intra ? (+tax.tax_percentage) / 2 : 0}</td><td class="c">${money(cgstAmt)}</td>
      <td class="c">${intra ? (+tax.tax_percentage) / 2 : 0}</td><td class="c">${money(sgstAmt)}</td>
      <td class="c">${intra ? 0 : +tax.tax_percentage}</td><td class="c">${money(igstAmt)}</td>
      <td class="c">${money(cgstAmt + sgstAmt + igstAmt)}</td></tr>`;
  }).join('');
  const totGst = totCgst + totSgst + totIgst;

  return `
  <div>
    <center>
      <img src="${assetUrl}logo.png" alt="" style="width:150px" />
      <p style="font-size:12px;line-height:18px;margin:0 0 10px">
        REG. ADDRESS<br />Unit no 30,31,35,36,37 Samhita Complex, 13, Off Andheri-Kurla, Andheri East, Mumbai 400072 Maharashtra India
        <br />+91 8268000456<br />cs@eatanytime.in
      </p>
    </center>
    <table class="inv">
      <tr><td colspan="6" style="padding:0">
        <table width="100%"><tr>
          <td width="78%" class="c" style="color:#808080"><h1 style="margin:0;font-size:20px">Tax Invoice</h1></td>
          <td width="22%" style="padding:0"><table width="100%" style="border-collapse:collapse">${checks}</table></td>
        </tr></table>
      </td></tr>
      <tr><td colspan="6" style="padding:0">
        <table width="100%"><tr>
          <td width="50%"><table width="100%">
            <tr><td width="20%">Reverse Charge:</td><td width="20%">${e(inv.reverse_charge)}</td><td width="20%">Shipped From:</td><td width="40%" rowspan="2">${e(inv.depot_address)}</td></tr>
            <tr><td>Invoice No:</td><td>${e(inv.invoice_no)}</td></tr>
            <tr><td>Invoice Date:</td><td>${formatDate(inv.invoice_date)}</td><td>GST No:</td><td>${e(inv.depot_gst_no)}</td></tr>
            <tr><td>State:</td><td>${e(inv.depot_state)}</td><td>State Code:</td><td>${e(inv.depot_state_code)}</td></tr>
          </table></td>
          <td width="50%" style="border-left:1px solid #666"><table width="100%">
            <tr><td width="25%">Transporter Mode:</td><td>${e(inv.transport_type)}</td></tr>
            <tr><td>PO Number:</td><td>${e(inv.order_no)}</td></tr>
            <tr><td>Date of Supply:</td><td></td></tr>
            <tr><td>Place of Supply:</td><td>${e(inv.depot_state)}</td></tr>
          </table></td>
        </tr></table>
      </td></tr>
      <tr><td colspan="6" style="padding:0"><table width="100%"><tr>
        <td width="50%" class="c b" style="border-right:1px solid #666">Details of Receiver | Billed to:</td>
        <td width="50%" class="c b">Details of Consignee | Shipped to:</td>
      </tr></table></td></tr>
      <tr><td colspan="6" style="padding:0"><table width="100%"><tr>
        <td width="50%"><table width="100%">
          <tr><td width="20%">Name:</td><td colspan="3">${e(inv.distributor_name)}</td></tr>
          <tr><td>Address:</td><td colspan="3">${e(inv.address)}</td></tr>
          <tr><td>GSTIN:</td><td colspan="3">${e(inv.gst_number)}</td></tr>
          ${inv.mobile_no ? `<tr><td>Mobile No:</td><td colspan="3">${e(inv.mobile_no)}</td></tr>` : ''}
          <tr><td>State:</td><td width="20%">${e(inv.state)}</td><td width="20%">State Code:</td><td width="40%">${e(inv.state_code)}</td></tr>
        </table></td>
        <td width="50%" style="border-left:1px solid #666"><table width="100%">
          <tr><td width="20%">Name:</td><td colspan="3">${e(inv.con_name)}</td></tr>
          <tr><td>Address:</td><td colspan="3">${e(inv.con_address)}</td></tr>
          <tr><td>GSTIN:</td><td colspan="3">${e(inv.con_gst_number)}</td></tr>
          ${inv.mobile_no ? `<tr><td>Mobile No:</td><td colspan="3">${e(inv.mobile_no)}</td></tr>` : ''}
          <tr><td>State:</td><td width="20%">${e(inv.state)}</td><td width="20%">State Code:</td><td width="40%">${e(inv.state_code)}</td></tr>
        </table></td>
      </tr></table></td></tr>
      <tr><td colspan="6">&nbsp;</td></tr>
      <tr><td colspan="6" style="padding:0">
        <table class="lines">
          <tr class="head grey">
            <td width="20" rowspan="2">Sr No.</td><td rowspan="2">Name of Product / Service</td><td rowspan="2">HSN ACS</td>
            <td rowspan="2">UOM</td><td rowspan="2">Qty</td><td rowspan="2">MRP</td><td rowspan="2">Rate</td><td rowspan="2">Amount</td>
            <td rowspan="2">Less Discount</td><td rowspan="2">Taxable Value</td>
            <td colspan="2">CGST</td><td colspan="2">SGST</td><td colspan="2">IGST</td><td rowspan="2" style="border-right:none !important">Total</td>
          </tr>
          <tr class="head grey"><td>Rate</td><td>Amount</td><td>Rate</td><td>Amount</td><td>Rate</td><td>Amount</td></tr>
          ${lines}
        </table>
      </td></tr>
      <tr><td colspan="6"></td></tr>
      <tr>
        <td colspan="4" rowspan="4" style="width:50%"><p style="margin:5px;font-size:15px;line-height:18px">
          ${inv.combo_box_name ? `<span style="display:block;margin-bottom:5px">Products: ${e(inv.combo_box_name)}</span>` : ''}
          <span style="display:block">Amount in words: ${e(inv.total_amount_in_words)}</span>
        </p></td>
        ${amountRow('Total amount before Tax', inv.total_amount, 'b grey')}
      </tr>
      <tr>${amountRow('Add: CGST', inv.cgst_amount)}</tr>
      <tr>${amountRow('Add: SGST', inv.sgst_amount)}</tr>
      <tr>${amountRow('Add: IGST', inv.igst_amount)}</tr>
      <tr>
        <td colspan="4" rowspan="4" style="padding:0"><table width="100%" style="border-collapse:collapse">
          <tr class="grey b"><td colspan="2" class="c">CGST</td><td colspan="2" class="c">SGST</td><td colspan="2" class="c">IGST</td><td rowspan="2" class="c">Total Tax Value</td></tr>
          <tr class="grey b"><td class="c">Rate</td><td class="c">Amount</td><td class="c">Rate</td><td class="c">Amount</td><td class="c">Rate</td><td class="c">Amount</td></tr>
          ${taxRows}
          <tr class="grey b"><td class="c">Total</td><td class="c">&#8377; ${money(totCgst)}</td><td class="c">Total</td><td class="c">&#8377; ${money(totSgst)}</td>
            <td class="c">Total</td><td class="c">&#8377; ${money(totIgst)}</td><td class="c">&#8377; ${money(totGst)}</td></tr>
        </table></td>
        ${amountRow('Total Amount: GST', money(totGst), 'b grey')}
      </tr>
      <tr>${amountRow('Shipping Amount', inv.shipping_charges)}</tr>
      <tr>${amountRow('Round Off Amount', inv.round_off_amount)}</tr>
      <tr>${amountRow('Total Amount After Tax', inv.invoice_amount, 'b grey')}</tr>
      <tr>
        <td colspan="4" class="amt b">Total weight in Kg :- ${totalGrams / 1000}Kg</td>
        ${amountRow('GST Payable on Reverse Charge', inv.gst_reverse_charge, 'b')}
      </tr>
      <tr>
        <td colspan="4" style="padding:0"><table width="100%" cellpadding="5">
          <tr><td width="42%">Bank Name</td><td>: HDFC Bank</td></tr>
          <tr><td>Branch</td><td>: Kandivali(w)</td></tr>
          <tr><td>A/C No.</td><td>: 50200018195231</td></tr>
          <tr><td>IFSC Code</td><td>: HDFC0000288</td></tr>
        </table></td>
        <td colspan="2" class="c">For Wholsome Habits Pvt Ltd<br /><img src="${assetUrl}stamp.jpg" height="50" alt="" /><br />Authorised Signatory</td>
      </tr>
      <tr><td colspan="6"><p style="text-align:justify;margin:0">Declaration:<br />
        I /We hereby certify that Registration Certificate under Maharashtra VAT Act 2002(Act No. IX of 2005) (as amended by Maharashtra Ordinance no.1 of 2005 dated 09-03-2005) is in force on the date on which the sale of goods specified in this bill/cash Memorandum has been effected by Me/Us in the regular course of our business. It shall be accounted for in the turnover of sales while filing return and the due tax, if any Payable on the sales has been paid or shall be paid.
      </p></td></tr>
    </table>
    <p class="c" style="margin:3px 0 0">SUBJECT TO MUMBAI JURISDICTION<br />This is a Computer Generated Invoice</p>
  </div>`;
};

const invoiceCopies = (inv, assetUrl) => [0, 1, 2]
  .map((tick) => invoiceCopy(inv, tick, assetUrl))
  .join('<div class="page-break">&nbsp;</div>');

export const renderInvoice = (inv, assetUrl) => page(`Tax Invoice ${inv.invoice_no || ''}`, invoiceCopies(inv, assetUrl));

// Several invoices in one printout (old PHP generate_multiple_tax_invoice, used by Sales Upload)
export const renderInvoices = (invoices, assetUrl, title = 'Tax Invoices') => page(
  title,
  invoices.map((inv) => invoiceCopies(inv, assetUrl)).join('<div class="page-break">&nbsp;</div>')
);

// Gate pass data for a group of sales on one gate pass (old PHP get_final_data with $for_invoice = false)
export const getGatePassData = async (sequelize, ids, transaction) => {
  const skuDetails = await select(sequelize,
    `select AA.sku_name, AA.type, sum(AA.qty) as total_qty from
       (select A.*, case when A.type = 'Bar' then B.short_name else C.short_name end as sku_name
        from distributor_out_items A
        left join product_master B on (A.item_id = B.id and A.type = 'Bar')
        left join box_master C on (A.item_id = C.id and A.type = 'Box')
        where A.distributor_out_id in (:ids)) AA
     group by AA.sku_name, AA.type`,
    { ids }, transaction
  );
  const deliveryFor = await select(sequelize,
    `select A.*, datediff(curdate(), A.date_of_processing) as days, B.distributor_name, D.depot_name, S.sales_rep_name as delivery_person
     from distributor_out A
     left join distributor_master B on (A.distributor_id = B.id)
     left join depot_master D on (A.depot_id = D.id)
     left join sales_rep_master S on (A.delivery_sales_rep_id = S.id)
     where A.id in (:ids) order by A.id`,
    { ids }, transaction
  );
  const invoiceNos = deliveryFor.map((row) => row.invoice_no || '');

  // Other unpaid approved invoices of the same distributors
  const unpaid = `select AA.*, ifnull(BB.payment_amount, 0) as payment_amount,
        (round(AA.final_amount, 0) - ifnull(BB.payment_amount, 0)) as pending_amount from
      (select A.*, B.distributor_name from distributor_out A left join distributor_master B on (A.distributor_id = B.id)
        where A.status = 'Approved' and A.invoice_no is not null and A.invoice_no <> '' and A.invoice_no not in (:invoiceNos)
          and A.distributor_id in (select distinct distributor_id from distributor_out where id in (:ids))) AA
      left join
      (select B.distributor_id, B.invoice_no, round(B.payment_amount, 0) as payment_amount
        from payment_details A left join payment_details_items B on (A.id = B.payment_id) where A.status = 'Approved') BB
      on (AA.distributor_id = BB.distributor_id and AA.invoice_no = BB.invoice_no)`;
  const pendingPayments = await select(sequelize,
    `select DD.distributor_id, DD.distributor_name, DD.total_pending_amount, EE.invoice_date, EE.invoice_no, EE.invoice_amount, EE.voucher_no from
       (select CC.distributor_id, CC.distributor_name, sum(pending_amount) as total_pending_amount from (${unpaid}) CC
        group by CC.distributor_id, CC.distributor_name) DD
     left join
       (select CC.distributor_id, CC.distributor_name, CC.date_of_processing as invoice_date, CC.invoice_no,
          sum(CC.pending_amount) as invoice_amount, CC.voucher_no from (${unpaid}) CC where CC.pending_amount > 0
        group by CC.distributor_id, CC.distributor_name, CC.date_of_processing, CC.invoice_no, CC.voucher_no) EE
     on (DD.distributor_id = EE.distributor_id and DD.distributor_name = EE.distributor_name)
     order by DD.distributor_id, EE.invoice_date`,
    { ids, invoiceNos: invoiceNos.length ? invoiceNos : [''] }, transaction
  );

  // Batches picked at dispatch (distributor_out_items.batch_no holds batch_master ids)
  const batchRows = await select(sequelize,
    `select A.invoice_no, B.type, B.qty, B.batch_no, C.box_name, P.product_name, M.distributor_name
     from distributor_out A
     join distributor_out_items B on (A.id = B.distributor_out_id)
     left join box_master C on (B.type = 'Box' and B.item_id = C.id)
     left join product_master P on (B.type = 'Bar' and B.item_id = P.id)
     left join distributor_master M on (A.distributor_id = M.id)
     where A.id in (:ids) order by A.invoice_no, B.id`,
    { ids }, transaction
  );
  const batchIds = [...new Set(batchRows.flatMap((row) => String(row.batch_no || '').split(',').map((id) => parseInt(id)).filter((id) => id)))];
  const batches = batchIds.length
    ? await select(sequelize, `select id, batch_no from batch_master where id in (:batchIds)`, { batchIds }, transaction)
    : [];
  const batchName = Object.fromEntries(batches.map((batch) => [batch.id, batch.batch_no]));
  const skuBatchDetails = batchRows.map((row) => ({
    ...row,
    batch_names: String(row.batch_no || '').split(',').map((id) => batchName[parseInt(id)]).filter(Boolean).join(', ')
  }));

  return { skuDetails, deliveryFor, pendingPayments, skuBatchDetails };
};

// extraPages: already rendered pages (Sample / Expiry vouchers) printed after the batch details
export const renderGatePass = (gatePass, invoices, assetUrl, createdBy, extraPages = '') => {
  const e = escapeHtml;
  const first = gatePass.deliveryFor[0] || {};
  const docNo = (row) => (row.invoice_no && row.voucher_no ? row.voucher_no : row.invoice_no);

  let previousInvoice = null;
  const batchRows = gatePass.skuBatchDetails.map((row, index) => {
    let header = '';
    if (row.invoice_no !== previousInvoice) {
      header = `<tr><td colspan="6">Invoice - ${e(row.invoice_no)}</td></tr>`;
      previousInvoice = row.invoice_no;
    }
    return `${header}<tr><td>${index + 1}</td><td>${e(row.distributor_name)}</td>
      <td>${e(String((row.type === 'Bar' ? row.product_name : row.box_name) || '').replace(/,/g, ''))}</td>
      <td>${e(row.type)}</td><td align="right">${e(row.qty)}</td><td>${e(row.batch_names)}</td></tr>`;
  }).join('');

  const gatePassPage = gatePass.skuDetails.length ? `
  <div class="gate_pass_details">
    <div align="center" style="background:#f00"><strong><h1>Gate Pass</h1></strong></div>
    <div style="width:400px"><table cellspacing="0" border="1">
      <tr><td width="185">Gate Pass No</td><td width="189"><div align="right">${e(first.gate_pass_no)}</div></td></tr>
      <tr><td>Location</td><td><div align="right">${e(first.depot_name)}</div></td></tr>
      <tr><td>Date</td><td><div align="right">${formatDate(first.gatepass_date || new Date())}</div></td></tr>
      <tr><td>Delivery Person</td><td><div align="right">${e(first.delivery_person)}</div></td></tr>
      <tr><td>Created by</td><td><div align="right">${e(createdBy)}</div></td></tr>
    </table></div><br />
    <table cellspacing="0" border="1" width="100%">
      <tr><td align="center"><strong>Sr. No.</strong></td><td align="center"><strong>SKU Name</strong></td><td align="center"><strong>Type</strong></td><td align="center"><strong>Quantity</strong></td></tr>
      ${gatePass.skuDetails.map((sku, index) => `<tr><td>${index + 1}</td><td>${e(sku.sku_name)}</td><td>${e(sku.type)}</td><td align="right">${e(sku.total_qty)}</td></tr>`).join('')}
    </table><br />
    <h2>Delivery for</h2>
    <table cellspacing="0" border="1" width="100%">
      <tr><td align="center"><strong>Sr. No.</strong></td><td align="center"><strong>Distributor Name</strong></td><td align="center"><strong>Invoice Date</strong></td><td align="center"><strong>Invoice Number</strong></td><td align="center"><strong>Days from Invoice</strong></td></tr>
      ${gatePass.deliveryFor.map((row, index) => `<tr><td>${index + 1}</td><td>${e(row.distributor_name)}</td><td>${formatDate(row.date_of_processing, true)}</td><td>${e(docNo(row))}</td><td align="right">${e(row.days)}</td></tr>`).join('')}
    </table><br />
    <h2>Pending Payments</h2>
    <table cellspacing="0" border="1" width="100%">
      <tr><td align="center"><strong>Sr. No.</strong></td><td align="center"><strong>Distributor Name</strong></td><td align="center"><strong>Total Pending Amount</strong></td><td align="center"><strong>Invoice Date</strong></td><td align="center"><strong>Invoice Number</strong></td><td align="center"><strong>Invoice Amount</strong></td><td align="center"><strong>Invoice Handover</strong></td><td align="center"><strong>Payment/Invoice Return</strong></td></tr>
      ${gatePass.pendingPayments.map((row, index) => `<tr><td>${index + 1}</td><td>${e(row.distributor_name)}</td><td align="right">${e(row.total_pending_amount)}</td><td>${formatDate(row.invoice_date, true)}</td><td>${e(docNo(row))}</td><td align="right">${e(row.invoice_amount)}</td><td></td><td></td></tr>`).join('')}
    </table><br />
    <table cellspacing="0" border="0" width="100%">
      <tr><td width="53%"><strong>Removed By</strong></td><td><strong>Checked By</strong></td></tr>
      <tr><td>Name</td><td>Name</td></tr>
      <tr><td>Sign</td><td>Sign</td></tr>
    </table>
  </div>
  <div class="page-break">&nbsp;</div>` : '';

  const batchPage = gatePass.skuBatchDetails.length ? `
  <div class="gate_pass_details">
    <div align="center" style="background:#f00"><strong><h1>Batch No Details</h1></strong></div><br />
    <table cellspacing="0" border="1" width="100%">
      <tr><td align="center"><strong>Sr. No.</strong></td><td align="center"><strong>Distributor Name</strong></td><td align="center"><strong>SKU Name</strong></td><td align="center"><strong>Type</strong></td><td align="center"><strong>Quantity</strong></td><td align="center"><strong>Batch No</strong></td></tr>
      ${batchRows}
    </table>
  </div>
  <div class="page-break">&nbsp;</div>` : '';

  const invoicePages = invoices.map((inv) => invoiceCopies(inv, assetUrl)).join('<div class="page-break">&nbsp;</div>');
  return page(`Gate Pass ${first.gate_pass_no || ''}`, gatePassPage + batchPage + invoicePages + extraPages);
};

// ---------------------------------------------------------------------------------------------
// Sample / Expiry: Business Promotion Voucher with its gate pass slip (old PHP views/invoice/voucher.php)

// Old PHP format_money(x, 2): Indian grouping, two decimals
const formatMoney = (value) => (+value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDateTime = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// Voucher data (old PHP get_final_data, Sample branch): the receiving distributor is sample_distributor_id
export const getVoucherData = async (sequelize, id, transaction) => {
  const rows = await select(sequelize,
    `select A.*, B.distributor_name, B.address as distributor_address, B.city as distributor_city,
       B.pincode as distributor_pincode, B.state as distributor_state, B.country as distributor_country, S.sales_rep_name,
       concat(ifnull(U1.first_name, ''), ' ', ifnull(U1.last_name, '')) as created_by_name,
       concat(ifnull(U2.first_name, ''), ' ', ifnull(U2.last_name, '')) as modified_by_name,
       concat(ifnull(U3.first_name, ''), ' ', ifnull(U3.last_name, '')) as approved_by_name
     from distributor_out A
     left join distributor_master B on (ifnull(A.sample_distributor_id, A.distributor_id) = B.id)
     left join sales_rep_master S on (A.sales_rep_id = S.id)
     left join user_master U1 on (A.created_by = U1.id)
     left join user_master U2 on (A.modified_by = U2.id)
     left join user_master U3 on (A.approved_by = U3.id)
     where A.id = :id`,
    { id }, transaction
  );
  if (!rows.length) return null;
  const sale = rows[0];
  const description = await select(sequelize,
    `select A.qty, A.sell_rate as rate, A.grams, A.amount,
       case when A.type = 'Combo Box' then B.combo_box_name when A.type = 'Box' then C.box_name else D.product_name end as description
     from distributor_out_sale_items A
     left join combo_box_master B on (A.type = 'Combo Box' and A.item_id = B.id)
     left join box_master C on (A.type = 'Box' and A.item_id = C.id)
     left join product_master D on (A.type = 'Bar' and A.item_id = D.id)
     where A.distributor_out_id = :id order by A.id`,
    { id }, transaction
  );
  const total = Math.round((+sale.amount || 0) * 100) / 100;
  return {
    id: sale.id,
    voucher_no: sale.voucher_no,
    gate_pass_no: sale.gate_pass_no,
    date_of_processing: sale.date_of_processing,
    distributor_name: sale.distributor_name,
    address: getAddress(sale.distributor_address, null, sale.distributor_city, sale.distributor_pincode, sale.distributor_state, sale.distributor_country),
    sales_rep_name: sale.sales_rep_name,
    created_by: sale.created_by_name.trim(),
    modified_by: sale.modified_by_name.trim(),
    approved_by: sale.approved_by_name.trim(),
    created_on: sale.created_on,
    modified_on: sale.modified_on,
    approved_on: sale.approved_on,
    description,
    total_amount: total,
    // PHP spelled out invoice_amount, which samples never have ("Rupees Only"); the voucher total is what is meant
    total_amount_in_words: `${numberToWords(total)} Only`
  };
};

export const voucherPage = (v, assetUrl) => {
  const e = escapeHtml;
  const box = 'border-collapse:collapse;width:925px;max-width:100%;font-family:Arcon-Regular, OpenSans-Regular, Arcon, Verdana, Geneva, sans-serif;font-size:12px;font-weight:400;border:1px solid #666;line-height:normal';
  const cell = 'border-left:1px solid #666;border-right:1px solid #666;border-top:none;border-bottom:none';
  const lines = v.description.map((item, index) => `
    <tr valign="top"><td align="center" style="${cell}">${index + 1}</td><td style="${cell}">${e(item.description)}</td>
      <td align="right" style="${cell}">${e(item.grams)}</td><td align="right" style="${cell}">${formatMoney(item.qty)}</td>
      <td align="right" style="${cell}">${formatMoney(item.rate)}</td><td align="right" style="${cell}">${formatMoney(item.amount)}</td></tr>`).join('');
  const slipLines = v.description.map((item, index) => `
    <tr valign="top"><td align="center" style="${cell}">${index + 1}</td><td colspan="3" style="${cell}">${e(item.description)}</td>
      <td align="right" style="${cell}">${formatMoney(item.amount)}</td></tr>`).join('');
  const modified = formatDateTime(v.created_on) !== formatDateTime(v.modified_on);

  return `
  <div>
    <table cellspacing="0" cellpadding="5" border="1" style="${box}">
      <tr><td colspan="6" style="padding:0"><table width="100%" border="0"><tr>
        <td width="30%"><img src="${assetUrl}logo.png" alt="" height="50" /></td>
        <td width="70%" style="color:#808080"><h1 style="margin:0;font-size:22px">Business Promotion Voucher</h1></td>
      </tr></table></td></tr>
      <tr><td colspan="6" style="padding:0;border:0"><table width="100%" border="0" cellspacing="0" cellpadding="5" style="border-collapse:collapse">
        <tr style="border-bottom:1px solid #666">
          <td width="40%" rowspan="2"><span style="font-size:13px">Distributor Name</span><br />${e(v.distributor_name)}<br />${e(v.address)}</td>
          <td width="30%" style="border-left:1px solid #666;border-right:1px solid #666;border-bottom:1px solid #666">Voucher No.<br />${e(v.voucher_no)}</td>
          <td width="30%">Dated<br />${formatDate(v.date_of_processing)}</td>
        </tr>
        <tr>
          <td style="border-left:1px solid #666;border-right:1px solid #666">Relationship Manager<br />${e(v.sales_rep_name)}</td>
          <td>Prepare By<br />${e(v.created_by)}</td>
        </tr>
      </table></td></tr>
      <tr style="font-size:12px;font-weight:500"><td align="center">Sr. No.</td><td align="center">Description</td><td align="center">Weight (in Gram)</td>
        <td align="center">Quantity</td><td align="center">Rate</td><td align="center">Amount</td></tr>
      ${lines}
      <tr><td colspan="3"><span style="font-size:13px">Amount in Words: ${e(v.total_amount_in_words)}</span></td>
        <td colspan="2" align="right" style="font-size:13px">Total</td>
        <td><span style="float:left">&#8377;</span><span style="float:right">${formatMoney(v.total_amount)}</span></td></tr>
      <tr><td colspan="3">&nbsp;</td><td colspan="3" align="center" style="font-size:13px">For WholsomeHabits Pvt Ltd<br /><img src="${assetUrl}stamp.jpg" height="55" alt="" /><br />Authorised Signatory</td></tr>
    </table><br />

    <table cellspacing="0" cellpadding="5" border="1" style="${box}">
      <tr><td colspan="5" style="padding:0"><table width="100%" border="0"><tr>
        <td width="40%"><img src="${assetUrl}logo.png" alt="" height="50" /></td>
        <td width="60%" style="color:#808080"><h1 style="margin:0;font-size:22px">Gate Pass</h1></td>
      </tr></table></td></tr>
      <tr><td colspan="5" style="padding:0;border:0"><table width="100%" border="0" cellspacing="0" cellpadding="5" style="border-collapse:collapse">
        <tr style="border-bottom:1px solid #666">
          <td width="40%" rowspan="2"><span style="font-size:13px">Relationship Manager:</span><br />${e(v.sales_rep_name)}</td>
          <td width="60%" style="border-left:1px solid #666;border-bottom:1px solid #666">Gate Pass No.<br />${e(v.gate_pass_no)}</td>
        </tr>
        <tr><td style="border-left:1px solid #666">Gate Pass Date.<br />${formatDate(v.date_of_processing)}</td></tr>
      </table></td></tr>
      <tr style="font-size:12px;font-weight:500;border-top:1px solid #666"><td align="center">Sr. No.</td><td colspan="3" align="center">Description</td><td align="center">Amount</td></tr>
      ${slipLines}
      <tr><td>&nbsp;</td><td colspan="3" style="font-size:13px">Total</td>
        <td><span style="float:left">&#8377;</span><span style="float:right">${formatMoney(v.total_amount)}</span></td></tr>
      <tr><td colspan="5"><table width="100%"><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr>
        <tr><td align="center">Prepared By:</td><td align="center">Received By:</td></tr></table></td></tr>
    </table>

    <table border="0" style="border-collapse:collapse;margin-top:20px;font-size:12px;width:925px;max-width:100%">
      <tr><td align="center"><b>Created By:</b> ${e(v.created_by)} &nbsp;&nbsp;&nbsp;
        ${modified ? `<b>Modified By:</b> ${e(v.modified_by)} &nbsp;&nbsp;&nbsp;` : ''}
        <b>Approved By:</b> ${e(v.approved_by)}</td></tr>
      <tr><td align="center"><b>Created On:</b> ${formatDateTime(v.created_on)} &nbsp;&nbsp;&nbsp;
        ${modified ? `<b>Modified On:</b> ${formatDateTime(v.modified_on)} &nbsp;&nbsp;&nbsp;` : ''}
        <b>Approved On:</b> ${formatDateTime(v.approved_on)}</td></tr>
    </table>
  </div>`;
};

export const renderVoucher = (v, assetUrl) => page(`Business Promotion Voucher ${v.voucher_no || ''}`, voucherPage(v, assetUrl));
