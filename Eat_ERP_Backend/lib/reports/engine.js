import ExcelJS from 'exceljs';
import { QueryTypes } from 'sequelize';
import sequelize from '../database.js';

// The report engine. A report is a definition (lib/reports/*.js):
//   { key, name, group, repId, description, filters, run(ctx) }
// run returns { sheets: [{ name, columns, rows, footer }], title } and the engine does the rest: filter checks, access,
// the on-screen preview and the Excel file. PHP built each report by hand (40,000 lines), kept the whole workbook in
// memory and wrote amounts as text, which Excel cannot add up.
//
// Column: { key, header, type: 'text' | 'number' | 'money' | 'date', total: true, width }
// Filters: dateRange (fromDate, toDate), date (date), distributor, depot, select, checkbox

const COMPANY = 'Wholesome Habits Private Limited';
const PREVIEW_ROWS = 200;
const QUERY_SECONDS = 180;
const MAX_RUNNING = 3;
const EXCEL_ROW_LIMIT = 1000000;

// Every report query stops itself rather than holding the database
export const query = (sql, replacements = {}) => sequelize.query(
  sql.trim().replace(/^select\b/i, `select /*+ MAX_EXECUTION_TIME(${QUERY_SECONDS * 1000}) */`),
  { replacements, type: QueryTypes.SELECT }
);

export const pad = (value) => String(value).padStart(2, '0');
export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const toDateText = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  return String(value).substring(0, 10);
};
// 2026-04-01 -> 01/04/2026
export const dmy = (value) => {
  const text = toDateText(value);
  return DATE.test(text) ? text.split('-').reverse().join('/') : text;
};
export const roundTo = (value, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.round((+value || 0) * factor) / factor;
};

export class ReportError extends Error {}

// Errors go back keyed by filter, as the forms expect (see controllers/reports.js)
export const readFilters = (definition, body = {}) => {
  const values = {};
  const errors = {};
  (definition.filters || []).forEach((filter) => {
    const value = body[filter.name];
    if (filter.type === 'dateRange') {
      const { fromDate, toDate } = body;
      if (!DATE.test(fromDate || '')) errors.fromDate = { message: 'From date is required.' };
      if (!DATE.test(toDate || '')) errors.toDate = { message: 'To date is required.' };
      if (!errors.fromDate && !errors.toDate && fromDate > toDate) errors.toDate = { message: 'To date cannot be before from date.' };
      values.fromDate = fromDate;
      values.toDate = toDate;
    } else if (filter.type === 'date') {
      if (!DATE.test(value || '')) errors[filter.name] = { message: `${filter.label} is required.` };
      values[filter.name] = value;
    } else if (filter.type === 'checkbox') {
      values[filter.name] = !!value;
    } else if (filter.type === 'multiselect') {
      values[filter.name] = (Array.isArray(value) ? value : []).map(Number).filter(Boolean);
      if (filter.required && !values[filter.name].length) errors[filter.name] = { message: `Select at least one ${filter.label.toLowerCase()}.` };
    } else {
      const present = value !== undefined && value !== null && value !== '';
      if (filter.required && !present) errors[filter.name] = { message: `${filter.label} is required.` };
      if (filter.type === 'select' && present && filter.options && !filter.options.some((option) => String(option.value) === String(value))) {
        errors[filter.name] = { message: `${filter.label} is not valid.` };
      }
      values[filter.name] = present ? value : null;
    }
  });
  return { values, errors };
};

// A depot-limited report only sees the user's depots; a depot filter can only narrow them
export const limitDepots = (ctx) => {
  const chosen = +ctx.filters.depot_id || 0;
  if (chosen && !ctx.depotIds.includes(chosen)) throw new ReportError('You do not have access to this depot.');
  return chosen ? [chosen] : ctx.depotIds;
};

const cellValue = (column, value) => {
  if (value === null || value === undefined || value === '') return null;
  if (column.type === 'number' || column.type === 'money') {
    const number = Number(value);
    return Number.isNaN(number) ? value : roundTo(number, column.decimals === undefined ? 2 : column.decimals);
  }
  if (column.type === 'date') return dmy(value);
  return typeof value === 'string' ? value : String(value);
};

const totalsOf = (sheet) => {
  const columns = sheet.columns.filter((column) => column.total);
  if (!columns.length) return null;
  const totals = {};
  columns.forEach((column) => {
    totals[column.key] = roundTo(sheet.rows.reduce((sum, row) => sum + (+row[column.key] || 0), 0), column.decimals === undefined ? 2 : column.decimals);
  });
  return totals;
};

const titleLines = (definition, ctx, result) => {
  const { fromDate, toDate, date } = ctx.filters;
  const period = fromDate ? `${dmy(fromDate)} to ${dmy(toDate)}` : date ? `As on ${dmy(date)}` : '';
  return [COMPANY, result.title || definition.name, ...(result.subtitle ? [result.subtitle] : []), ...(period ? [period] : [])];
};

// ---------- Preview (on screen) ----------

export const preview = (definition, ctx, result) => ({
  title: titleLines(definition, ctx, result),
  sheets: result.sheets.map((sheet) => ({
    name: sheet.name,
    columns: sheet.columns.map(({ key, header, type, decimals }) => ({ key, header, type: type || 'text', decimals })),
    total: sheet.rows.length,
    shown: Math.min(sheet.rows.length, PREVIEW_ROWS),
    rows: sheet.rows.slice(0, PREVIEW_ROWS).map((row) => Object.fromEntries(sheet.columns.map((column) => [column.key, cellValue(column, row[column.key])]))),
    totals: totalsOf(sheet),
    footer: sheet.footer || null
  }))
});

// ---------- Excel, written to the response as it is built ----------

export const writeExcel = async (definition, ctx, result, stream) => {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true, useSharedStrings: false });
  const lines = titleLines(definition, ctx, result);
  for (const sheet of result.sheets) {
    const worksheet = workbook.addWorksheet((sheet.name || 'Report').substring(0, 31));
    worksheet.columns = sheet.columns.map((column) => ({
      key: column.key,
      width: column.width || (column.type === 'number' || column.type === 'money' ? 15 : column.type === 'date' ? 12 : 24)
    }));
    lines.forEach((line, index) => {
      const row = worksheet.addRow([line]);
      row.font = { bold: index < 2, size: index === 0 ? 13 : 11 };
      row.commit();
    });
    worksheet.addRow([]).commit();

    const header = worksheet.addRow(sheet.columns.map((column) => column.header));
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245478' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    header.commit();

    const formats = sheet.columns.map((column) => (column.type === 'money' ? '#,##0.00' : column.type === 'number' ? '#,##0.##' : null));
    for (const source of sheet.rows) {
      const row = worksheet.addRow(sheet.columns.map((column) => cellValue(column, source[column.key])));
      formats.forEach((format, index) => {
        if (format) row.getCell(index + 1).numFmt = format;
      });
      row.commit();
    }

    const totals = totalsOf(sheet);
    if (totals) {
      const row = worksheet.addRow(sheet.columns.map((column, index) => (column.total ? totals[column.key] : index === 0 ? 'Total' : null)));
      row.font = { bold: true };
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      });
      row.commit();
    }
    (sheet.footer || []).forEach((item) => {
      const row = worksheet.addRow(sheet.columns.map((column, index) => (index === 0 ? item.label : column.key === item.key ? item.value : null)));
      row.font = { bold: true };
      row.commit();
    });
    await worksheet.commit();
  }
  await workbook.commit();
};

export const rowCount = (result) => result.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
export const checkSize = (result) => {
  const largest = Math.max(...result.sheets.map((sheet) => sheet.rows.length));
  if (largest > EXCEL_ROW_LIMIT) throw new ReportError(`This report has ${largest.toLocaleString('en-IN')} rows, more than Excel can open. Choose a shorter period.`);
};

// A few heavy reports at once, so one person's year-long export cannot slow everyone's ERP
let running = 0;
export const withSlot = async (work) => {
  if (running >= MAX_RUNNING) throw new ReportError('Several reports are running. Please try again in a minute.');
  running += 1;
  try {
    return await work();
  } finally {
    running -= 1;
  }
};

export const fileName = (definition) => {
  const now = new Date();
  const stamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `${definition.name.replace(/[^a-zA-Z0-9]+/g, '_')}_${stamp}.xlsx`;
};
