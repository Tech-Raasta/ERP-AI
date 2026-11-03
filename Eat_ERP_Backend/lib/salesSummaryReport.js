import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { QueryTypes } from 'sequelize';
import sequelize from './database.js';

// Sales summary report of a month (old PHP Export_model::generate_sales_summary_report), generated from
// End of Month Sales. Fills the Sale_Invoice_Summary.xlsm template:
//   SALES SUMMARY          - one row per invoice (B2C invoices of a distributor grouped into one row)
//   SALES DETAILED         - one row per invoice, amounts split by tax rate from the invoice items
//   SALES SUMMARY DETAILED - the summary rows followed by the detailed rows negated, so the two net to zero
// The SUMMARY / RECON sheets and the template macro work off these sheets.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE = path.join(__dirname, '..', 'assets', 'templates', 'Sale_Invoice_Summary.xlsm');

const select = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

const DIRECT_NAME = `case when upper(trim(A.class))='DIRECT' then case when (A.client_name is not null and A.client_name<>'' and A.gstin is not null and A.gstin<>'') then A.client_name when A.state_code=A.depot_state_code then concat(A.prefix,' Direct-Local') else concat(A.prefix,' OOS-',A.state_code,'_',A.state) end else A.distributor_name end as distributor_name`;
const DIRECT_STATE_CODE = `case when upper(trim(A.class))='DIRECT' then case when A.state_code is not null and A.state_code<>'' then A.state_code else A.dist_state_code end else A.dist_state_code end as state_code`;
const DIRECT_STATE = `case when upper(trim(A.class))='DIRECT' then case when A.state is not null and A.state<>'' then A.state else A.dist_state end else A.dist_state end as state`;
const WEEK_OF_MONTH = `WEEK(A.invoice_date,1)-WEEK(STR_TO_DATE(concat(YEAR(A.invoice_date),'-',MONTH(A.invoice_date),'-',1),'%Y-%m-%d'),1)+1 as dweek`;
const SALE_JOINS = `from distributor_out C
  left join depot_master D on (C.depot_id=D.id)
  left join distributor_master F on (C.distributor_id=F.id)
  left join distributor_type_master L on (F.type_id=L.id)
  left join sales_rep_master H on (C.sales_rep_id=H.id)
  left join location_master K on (F.location_id=K.id)
  left join area_master M on (F.area_id=M.id)
  left join zone_master O on (F.zone_id=O.id)`;
// Sales of the month, without the two internal distributors (1, 189) and samples
// Only the items of the month's sales are totalled, not the whole items table
const MONTH_ITEMS = `distributor_out_id in (select id from distributor_out where invoice_date>=:fromDate and invoice_date<=:toDate)`;
const SALE_FILTER = `C.depot_id in (:depotIds) and C.invoice_date>=:fromDate and C.invoice_date<=:toDate and
  (C.distributor_id!='1' and C.distributor_id!='189') and (F.class!='sample' or F.class is null)`;

// Old PHP get_distributor_out_summary: approved invoices, B2C invoices (no GST number) grouped per distributor
const getSummary = (replacements) => select(
  `select group_concat(distinct C.id) as id, group_concat(distinct C.id) as distributor_out_id, group_concat(distinct C.invoice_no) as invoice_no,
     group_concat(distinct C.invoice_date) as invoice_date, group_concat(distinct C.dweek) as dweek, group_concat(distinct C.depot_name) as depot_name,
     sum(C.amount) as amount, sum(C.tax_amount) as tax_amount, sum(C.igst_amount) as igst_amount, sum(C.final_amount) as final_amount,
     sum(C.invoice_amount) as invoice_amount, sum(C.amt_exc_tax_0) as amt_exc_tax_0,
     sum(C.amt_exc_tax_5) as amt_exc_tax_5, sum(C.cgst_amt_5) as cgst_amt_5, sum(C.igst_amt_5) as igst_amt_5,
     sum(C.amt_exc_tax_12) as amt_exc_tax_12, sum(C.cgst_amt_12) as cgst_amt_12, sum(C.igst_amt_12) as igst_amt_12,
     sum(C.amt_exc_tax_18) as amt_exc_tax_18, sum(C.cgst_amt_18) as cgst_amt_18, sum(C.igst_amt_18) as igst_amt_18,
     C.depot_state, C.distributor_name, C.distributor_type, C.state, C.state_code, group_concat(distinct C.dist_gst_no) as dist_gst_no,
     C.for_gst, C.dist_zone, C.area, C.distributor_city, C.location, C.sales_rep_name, group_concat(distinct C.due_date) as due_date,
     group_concat(distinct C.order_no) as order_no, group_concat(distinct C.order_date) as order_date, group_concat(distinct C.remarks) as remarks,
     C.status, group_concat(distinct C.mobile_no) as mobile_no from
   (select A.id, A.invoice_no, A.invoice_date, A.amount, A.tax_amount, A.igst_amount, A.final_amount, A.invoice_amount,
      B.total_amt_0 as amt_exc_tax_0, (B.total_amt_5-B.cgst_amt_5-B.sgst_amt_5-B.igst_amt_5) as amt_exc_tax_5,
      (B.total_amt_12-B.cgst_amt_12-B.sgst_amt_12-B.igst_amt_12) as amt_exc_tax_12, (B.total_amt_18-B.cgst_amt_18-B.sgst_amt_18-B.igst_amt_18) as amt_exc_tax_18,
      B.cgst_amt_5, B.cgst_amt_12, B.cgst_amt_18, B.igst_amt_5, B.igst_amt_12, B.igst_amt_18,
      A.depot_name, A.depot_state, ${DIRECT_NAME}, ${DIRECT_STATE_CODE}, ${DIRECT_STATE}, A.distributor_type, A.dist_gst_no,
      case when A.dist_gst_no is null then '' when A.dist_gst_no='' then '' else A.invoice_no end as for_gst,
      A.dist_zone, A.area, A.distributor_city, A.location, A.sales_rep_name, A.due_date, A.order_no, A.order_date, A.remarks, A.status, A.mobile_no,
      ${WEEK_OF_MONTH} from
     (select C.id, C.invoice_no, C.invoice_date, C.status, C.amount, C.tax_amount, C.igst_amount, C.final_amount, C.invoice_amount, C.client_name,
        C.state, C.state_code, C.due_date, C.order_no, C.order_date, C.remarks, C.mobile_no, C.gstin, D.depot_name, D.state as depot_state,
        D.state_code as depot_state_code, F.distributor_name, F.city as distributor_city, F.class, F.state as dist_state, F.state_code as dist_state_code, F.prefix,
        case when upper(trim(F.class))='DIRECT' then case when C.gstin is not null and C.gstin<>'' then C.gstin else F.gst_number end else F.gst_number end as dist_gst_no,
        L.distributor_type, H.sales_rep_name, K.location, M.area, O.zone as dist_zone
      ${SALE_JOINS}
      where C.status='Approved' and ${SALE_FILTER}) A
     left join
     (select B.distributor_out_id,
        sum(case when B.tax_percentage=5 then B.cgst_amt else 0 end) as cgst_amt_5, sum(case when B.tax_percentage=12 then B.cgst_amt else 0 end) as cgst_amt_12,
        sum(case when B.tax_percentage=18 then B.cgst_amt else 0 end) as cgst_amt_18, sum(case when B.tax_percentage=5 then B.sgst_amt else 0 end) as sgst_amt_5,
        sum(case when B.tax_percentage=12 then B.sgst_amt else 0 end) as sgst_amt_12, sum(case when B.tax_percentage=18 then B.sgst_amt else 0 end) as sgst_amt_18,
        sum(case when B.tax_percentage=5 then B.igst_amt else 0 end) as igst_amt_5, sum(case when B.tax_percentage=12 then B.igst_amt else 0 end) as igst_amt_12,
        sum(case when B.tax_percentage=18 then B.igst_amt else 0 end) as igst_amt_18, sum(case when B.tax_percentage=5 then B.total_amt else 0 end) as total_amt_5,
        sum(case when B.tax_percentage=12 then B.total_amt else 0 end) as total_amt_12, sum(case when B.tax_percentage=18 then B.total_amt else 0 end) as total_amt_18,
        sum(case when B.tax_percentage=0 then B.total_amt else 0 end) as total_amt_0
      from distributor_out_items B where B.${MONTH_ITEMS} group by B.distributor_out_id) B on (A.id=B.distributor_out_id)) C
   group by C.depot_state, C.distributor_name, C.distributor_type, C.state, C.state_code, C.for_gst, C.dist_zone, C.area, C.distributor_city,
     C.location, C.sales_rep_name, C.status
   order by C.for_gst`,
  replacements
);

// Old PHP get_distributor_out_details: approved and cancelled invoices, one row per invoice and tax rate.
// PHP had no order on the outer query; ordered here so an invoice's tax rates always come together.
const getDetails = (replacements) => select(
  `select A.id, A.invoice_no, A.invoice_date, A.amount, A.tax_amount, A.igst_amount, A.final_amount, A.invoice_amount, A.depot_name, A.depot_state,
     ${DIRECT_NAME}, ${DIRECT_STATE_CODE}, ${DIRECT_STATE}, A.distributor_type,
     case when upper(trim(A.class))='DIRECT' then case when A.gstin is not null and A.gstin<>'' then A.gstin else A.dist_gst_no end else A.dist_gst_no end as dist_gst_no,
     A.dist_zone, A.area, A.distributor_city, A.location, A.sales_rep_name, A.due_date, A.order_no, A.order_date, A.remarks, A.status, A.mobile_no,
     ${WEEK_OF_MONTH}, B.distributor_out_id, B.tax_percentage, B.cgst_amt, B.sgst_amt, B.igst_amt, B.amt_exc_tax, B.total_amt from
   (select C.*, D.depot_name, D.state as depot_state, D.state_code as depot_state_code, F.distributor_name, F.city as distributor_city, F.class,
      F.state as dist_state, F.state_code as dist_state_code, F.gst_number as dist_gst_no, F.prefix,
      L.distributor_type, H.sales_rep_name, K.location, M.area, O.zone as dist_zone
    ${SALE_JOINS}
    where (C.status='Approved' or C.status='InActive') and ${SALE_FILTER}) A
   left join
   (select distributor_out_id, tax_percentage, sum(cgst_amt) as cgst_amt, sum(sgst_amt) as sgst_amt, sum(igst_amt) as igst_amt,
      sum(total_amt)-(sum(cgst_amt)+sum(sgst_amt)+sum(igst_amt)) as amt_exc_tax, sum(total_amt) as total_amt
    from distributor_out_items where ${MONTH_ITEMS} group by distributor_out_id, tax_percentage) B on (A.id=B.distributor_out_id)
   order by A.invoice_date desc, A.id, B.tax_percentage`,
  replacements
);

const pad = (value) => String(value).padStart(2, '0');
const num = (value) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};
// PHP round(): halves away from zero
const phpRound = (value, precision = 0) => {
  const factor = Math.pow(10, precision);
  return Math.sign(value) * Math.round(Math.abs(value) * factor) / factor;
};
const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
// PHP date("d-m-Y", strtotime(...)); the template formulas read these back with DATEVALUE
const dmy = (value) => {
  if (!value) return '';
  const text = value instanceof Date ? ymd(value) : String(value).substring(0, 10);
  const [year, month, day] = text.split('-');
  return day ? `${day}-${month}-${year}` : text;
};
// PhpSpreadsheet's default value binder: numeric text becomes a number (unless it has a leading zero)
const bind = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return ymd(value);
  if (typeof value === 'number') return value;
  const text = String(value);
  if (/^[-+]?(\d+\.?\d*|\d*\.?\d+)([Ee][-+]?[0-2]?\d{1,3})?$/.test(text) && !(text.length > 1 && text[0] === '0' && text[1] !== '.')) {
    return Number(text);
  }
  return text;
};
const str = (value) => (value === null || value === undefined ? '' : String(value));
const formula = (text) => ({ formula: text });
const statusOf = (status) => (status === 'InActive' ? 'Cancelled' : status);

const AMOUNT_COLUMNS = ['I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'];

const dateCells = (cells, r, date) => {
  cells.A = formula(`TEXT(DATEVALUE(D${r}),"mmmm")`);
  cells.B = formula(`CONCATENATE("Q"&ROUNDUP(MONTH(DATEVALUE(D${r}))/3,0))`);
  cells.C = formula(`YEAR(DATEVALUE(D${r}))`);
  cells.D = date;
  cells.E = date;
  cells.G = 'SALES';
};

// CGST / SGST / IGST totals: formulas over the rate columns, or 0 when the invoice has no such tax
const taxTotals = (cells, r, row, sign) => {
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (row.tax_amount !== null && row.tax_amount !== undefined && row.tax_amount !== '') {
    const tax = num(row.tax_amount) * sign;
    if (!num(row.igst_amount)) {
      cgst = phpRound(tax / 2, 2);
      sgst = tax - cgst;
    } else {
      igst = tax;
    }
  }
  cells.Q = cgst !== 0 ? formula(`N${r}+O${r}+P${r}`) : 0;
  cells.U = sgst !== 0 ? formula(`R${r}+S${r}+T${r}`) : 0;
  cells.Y = igst !== 0 ? formula(`V${r}+W${r}+X${r}`) : 0;
};

const partyCells = (cells, row) => {
  cells.AD = bind(row.distributor_name);
  cells.AE = bind(row.distributor_type);
  cells.AF = bind(row.state_code);
  cells.AG = bind(row.state);
  cells.AH = bind(row.dist_gst_no);
  cells.AI = bind(row.dist_zone);
  cells.AJ = bind(row.area);
  cells.AK = bind(row.distributor_city);
  cells.AL = bind(row.location);
  cells.AM = bind(row.sales_rep_name);
};

const orderCells = (cells, row) => {
  cells.AN = bind(row.due_date);
  cells.AO = row.order_no === null || row.order_no === undefined ? null : String(row.order_no);
  cells.AP = bind(row.order_date);
};

// One summary row. recon: the copy on SALES SUMMARY DETAILED, which also shows the depot of grouped rows.
const summaryCells = (row, r, toDate, recon) => {
  const cells = {};
  const single = !str(row.distributor_out_id).includes(',');
  dateCells(cells, r, single ? dmy(row.invoice_date) : dmy(toDate));
  if (single) {
    cells.F = bind(row.dweek);
    cells.H = bind(row.invoice_no);
  }
  const status = statusOf(row.status);
  if (status === 'Cancelled') {
    AMOUNT_COLUMNS.forEach((column) => { cells[column] = 0; });
  } else {
    cells.I = num(row.amt_exc_tax_0);
    cells.J = num(row.amt_exc_tax_5);
    cells.K = num(row.amt_exc_tax_12);
    cells.L = num(row.amt_exc_tax_18);
    cells.M = formula(`(I${r}+J${r}+K${r}+L${r})`);
    if (num(row.cgst_amt_5)) cells.N = cells.R = formula(`ROUND(J${r}*2.5%,2)`);
    if (num(row.cgst_amt_12)) cells.O = cells.S = formula(`ROUND(K${r}*6%,2)`);
    if (num(row.cgst_amt_18)) cells.P = cells.T = formula(`ROUND(L${r}*9%,2)`);
    if (num(row.igst_amt_5)) cells.V = formula(`ROUND(J${r}*5%,2)`);
    if (num(row.igst_amt_12)) cells.W = formula(`ROUND(K${r}*12%,2)`);
    if (num(row.igst_amt_18)) cells.X = formula(`ROUND(L${r}*18%,2)`);
    taxTotals(cells, r, row, 1);
    if (recon) cells.AC = bind(row.depot_name);
    cells.Z = formula(`Q${r}+U${r}+Y${r}`);
    cells.AB = phpRound(num(row.invoice_amount));
    cells.AA = formula(`ROUND(AB${r}-(+M${r}+Q${r}+U${r}+Y${r}),2)`);
    partyCells(cells, row);
    if (single) orderCells(cells, row);
  }
  cells.AS = status;
  if (single) {
    if (!recon) cells.AC = bind(row.depot_name);
    cells.AQ = bind(row.remarks);
    cells.AR = bind(row.id);
    cells.AT = bind(row.mobile_no);
  }
  cells.AU = `${str(row.depot_state)} - ${str(row.state)}`;
  if (recon) cells.AV = 'Summary';
  return cells;
};

// One detailed row: an invoice with each of its tax rates applied in turn (sign -1 on SALES SUMMARY DETAILED)
const detailCells = (rows, r, sign, recon) => {
  const cells = {};
  rows.forEach((row) => {
    dateCells(cells, r, dmy(row.invoice_date));
    cells.F = bind(row.dweek);
    cells.H = bind(row.invoice_no);
    const status = statusOf(row.status);
    if (status === 'Cancelled') {
      AMOUNT_COLUMNS.forEach((column) => { cells[column] = 0; });
    } else {
      const rate = num(row.tax_percentage);
      const amount = num(row.amt_exc_tax) * sign;
      const column = { 5: 'J', 12: 'K', 18: 'L' }[rate] || 'I';
      // PHP overwrote column I when an invoice had more than one other rate (0%, 28%, ...); added up here
      cells[column] = column === 'I' && typeof cells.I === 'number' ? cells.I + amount : amount;
      cells.M = formula(`(I${r}+J${r}+K${r}+L${r})`);
      if (num(row.cgst_amt) !== 0) {
        if (rate / 2 === 2.5) cells.N = cells.R = formula(`ROUND(J${r}*2.5%,2)`);
        if (rate / 2 === 6) cells.O = cells.S = formula(`ROUND(K${r}*6%,2)`);
        if (rate / 2 === 9) cells.P = cells.T = formula(`ROUND(L${r}*9%,2)`);
      } else {
        if (rate === 5) cells.V = formula(`ROUND(J${r}*5%,2)`);
        if (rate === 12) cells.W = formula(`ROUND(K${r}*12%,2)`);
        if (rate === 18) cells.X = formula(`ROUND(L${r}*18%,2)`);
      }
      taxTotals(cells, r, row, sign);
      cells.AC = bind(row.depot_name);
      cells.Z = formula(`Q${r}+U${r}+Y${r}`);
      cells.AB = phpRound(num(row.invoice_amount)) * sign;
      // PHP built this formula with the last row number of SALES DETAILED on the negated rows; fixed to its own row
      cells.AA = formula(`ROUND(AB${r}-(+M${r}+Q${r}+U${r}+Y${r}),2)`);
      partyCells(cells, row);
      orderCells(cells, row);
    }
    cells.AQ = bind(row.remarks);
    cells.AR = bind(row.id);
    cells.AS = status;
    cells.AT = bind(row.mobile_no);
    cells.AU = `${str(row.depot_state)} - ${str(row.state)}`;
    if (recon) cells.AV = 'Details';
  });
  return cells;
};

// Invoice rows grouped per sale, in query order
const groupDetails = (rows) => {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.id)) groups.set(row.id, []);
    groups.get(row.id).push(row);
  });
  return [...groups.values()];
};

const writeRow = (sheet, r, cells) => {
  Object.entries(cells).forEach(([column, value]) => {
    if (value !== null && value !== undefined) sheet.getCell(`${column}${r}`).value = value;
  });
};

const THIN = { style: 'thin' };
const styleRange = (sheet, lastColumn, lastRow) => {
  const last = sheet.getColumn(lastColumn).number;
  for (let r = 8; r <= lastRow; r++) {
    for (let c = 1; c <= last; c++) {
      const cell = sheet.getCell(r, c);
      // Copy the style so cells sharing a template style are not changed together
      const style = { ...cell.style, border: { top: THIN, left: THIN, bottom: THIN, right: THIN } };
      if (r === 8) style.font = { ...(cell.style.font || {}), bold: true };
      cell.style = style;
    }
  }
};

// ExcelJS drops the template's VBA project; put it back so the file still opens as a macro workbook
const restoreMacros = async (buffer, templateBuffer) => {
  const template = await JSZip.loadAsync(templateBuffer);
  const vba = template.file('xl/vbaProject.bin');
  if (!vba) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  zip.file('xl/vbaProject.bin', await vba.async('nodebuffer'));

  let types = await zip.file('[Content_Types].xml').async('string');
  types = types.replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml', 'application/vnd.ms-excel.sheet.macroEnabled.main+xml');
  if (!types.includes('/xl/vbaProject.bin')) {
    types = types.replace('</Types>', '<Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>');
  }
  zip.file('[Content_Types].xml', types);

  let rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  if (!rels.includes('vbaProject.bin')) {
    rels = rels.replace('</Relationships>', '<Relationship Id="rIdVbaProject" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>');
  }
  zip.file('xl/_rels/workbook.xml.rels', rels);

  // The VBA modules are tied to the workbook and sheets by codeName, which ExcelJS does not keep
  const templateWorkbook = await template.file('xl/workbook.xml').async('string');
  const workbookCode = (templateWorkbook.match(/<workbookPr[^>]*codeName="([^"]+)"/) || [])[1];
  let workbook = await zip.file('xl/workbook.xml').async('string');
  if (workbookCode && !/<workbookPr[^>]*codeName=/.test(workbook)) {
    workbook = workbook.replace('<workbookPr', `<workbookPr codeName="${workbookCode}"`);
    zip.file('xl/workbook.xml', workbook);
  }
  const sheetFiles = async (pkg, workbookXml) => {
    const relsXml = await pkg.file('xl/_rels/workbook.xml.rels').async('string');
    const targets = {};
    for (const match of relsXml.matchAll(/<Relationship [^>]*>/g)) {
      const id = (match[0].match(/Id="([^"]+)"/) || [])[1];
      const target = (match[0].match(/Target="([^"]+)"/) || [])[1];
      if (id && target) targets[id] = 'xl/' + target.replace(/^\/?xl\//, '').replace(/^\//, '');
    }
    const files = {};
    for (const match of workbookXml.matchAll(/<sheet [^>]*>/g)) {
      const name = (match[0].match(/name="([^"]+)"/) || [])[1];
      const id = (match[0].match(/r:id="([^"]+)"/) || [])[1];
      if (name && targets[id]) files[name] = targets[id];
    }
    return files;
  };
  const templateSheets = await sheetFiles(template, templateWorkbook);
  const outputSheets = await sheetFiles(zip, workbook);
  for (const [name, file] of Object.entries(templateSheets)) {
    const code = ((await template.file(file).async('string')).match(/<sheetPr[^>]*codeName="([^"]+)"/) || [])[1];
    const target = outputSheets[name] && zip.file(outputSheets[name]);
    if (!code || !target) continue;
    let xml = await target.async('string');
    if (/<sheetPr[^>]*codeName=/.test(xml)) continue;
    xml = /<sheetPr[\s>/]/.test(xml)
      ? xml.replace(/<sheetPr/, `<sheetPr codeName="${code}"`)
      : xml.replace(/(<worksheet[^>]*>)/, `$1<sheetPr codeName="${code}"/>`);
    zip.file(outputSheets[name], xml);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

// fromDate / toDate: 'YYYY-MM-DD'. Returns the .xlsm file contents.
export const buildSalesSummaryReport = async ({ fromDate, toDate, depotIds }) => {
  const replacements = { fromDate, toDate, depotIds };
  const [summary, details] = await Promise.all([getSummary(replacements), getDetails(replacements)]);
  const invoices = groupDetails(details);

  const templateBuffer = await fs.promises.readFile(TEMPLATE);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);
  workbook.calcProperties.fullCalcOnLoad = true;

  const summarySheet = workbook.getWorksheet('SALES SUMMARY');
  const detailSheet = workbook.getWorksheet('SALES DETAILED');
  const reconSheet = workbook.getWorksheet('SALES SUMMARY DETAILED');
  [summarySheet, detailSheet, reconSheet].forEach((sheet) => {
    sheet.getCell('B5').value = dmy(fromDate);
    sheet.getCell('E5').value = dmy(toDate);
  });

  summary.forEach((row, index) => writeRow(summarySheet, 9 + index, summaryCells(row, 9 + index, toDate, false)));
  if (summary.length) styleRange(summarySheet, 'AU', 8 + summary.length);

  invoices.forEach((rows, index) => writeRow(detailSheet, 9 + index, detailCells(rows, 9 + index, 1, false)));
  if (invoices.length) styleRange(detailSheet, 'AU', 8 + invoices.length);

  summary.forEach((row, index) => writeRow(reconSheet, 9 + index, summaryCells(row, 9 + index, toDate, true)));
  invoices.forEach((rows, index) => {
    const r = 9 + summary.length + index;
    writeRow(reconSheet, r, detailCells(rows, r, -1, true));
  });
  if (summary.length + invoices.length) styleRange(reconSheet, 'AV', 8 + summary.length + invoices.length);

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: await restoreMacros(Buffer.from(buffer), templateBuffer),
    summaryRows: summary.length,
    detailRows: invoices.length
  };
};
