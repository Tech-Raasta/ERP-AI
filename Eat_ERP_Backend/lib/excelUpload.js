import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import multer from 'multer';

// Shared by the Excel uploads ported from the old PHP app (Sales Upload, Sales Return Upload)

const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

// Loads an .xlsx. Names over whole columns (the templates' SKU lists run to row 1048576) are cut down first:
// ExcelJS expands a name into every cell of its range and runs out of memory.
export const loadWorkbook = async (buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('xl/workbook.xml');
  if (entry) {
    const xml = await entry.async('string');
    const capped = xml.replace(/(<definedName[^>]*>)([^<]*)(<\/definedName>)/g, (all, open, range, close) => (
      open + range.replace(/\$(\d+)/g, (cell, row) => (+row > 100000 ? '$5000' : cell)) + close
    ));
    if (capped !== xml) zip.file('xl/workbook.xml', capped);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await zip.generateAsync({ type: 'nodebuffer' }));
  return workbook;
};

// Plain value of a cell (formula results, rich text, hyperlinks); dates stay Date
export const cellValue = (cell) => {
  let value = cell.value;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if (value.error) value = '';
    else if ('result' in value) value = value.result;
    else if (Array.isArray(value.richText)) value = value.richText.map((part) => part.text).join('');
    else if ('text' in value) value = value.text;
  }
  if (value instanceof Date) return value;
  return value === null || value === undefined ? '' : String(value).trim();
};

// True when none of the first `columns` cells of the row has a value
export const isEmptyRow = (row, columns) => {
  for (let column = 1; column <= columns; column++) {
    if (cellValue(row.getCell(column)) !== '') return false;
  }
  return true;
};

const isYmd = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const ymd = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// 'YYYY-MM-DD' from an Excel date (or its serial number), or text as dd-mm-yyyy / dd/mm/yyyy / yyyy-mm-dd; else null
export const parseDate = (value) => {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : ymd(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (/^\d+(\.\d+)?$/.test(value)) {
    const date = new Date(Math.round((+value - 25569) * 86400000));
    return ymd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  let match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match && isYmd(+match[3], +match[2], +match[1])) return ymd(+match[3], +match[2], +match[1]);
  match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match && isYmd(+match[1], +match[2], +match[3])) return ymd(+match[1], +match[2], +match[3]);
  return null;
};

// Looks each distinct key up once (per file)
export const cached = (lookup) => {
  const cache = new Map();
  return (key) => {
    if (!cache.has(key)) cache.set(key, lookup(key));
    return cache.get(key);
  };
};

// Drop-down list validation like the old PHP common_excel
export const listValidation = (formula) => ({
  type: 'list',
  allowBlank: false,
  showInputMessage: true,
  showErrorMessage: true,
  errorStyle: 'information',
  errorTitle: 'Input error',
  error: 'Value is not in list.',
  promptTitle: 'Pick from list',
  prompt: 'Please pick a value from the drop-down list.',
  formulae: [formula]
});

// Link to an upload's file: files saved here (folder = localDir) are served by this backend, old PHP ones
// (saved under /home/...) by the PHP server; anything else only when the file is here
export const uploadFileUrl = (req, { localDir, localPath, phpUrl }, folder, name) => {
  const file = path.basename(text(name));
  if (!file) return null;
  const local = `${req.protocol}://${req.get('host')}/${localDir}${encodeURIComponent(file)}`;
  if (text(folder) === localDir) return local;
  if (text(folder).startsWith('/')) return phpUrl + encodeURIComponent(file);
  return fs.existsSync(path.join(localPath, file)) ? local : null;
};

// Express middleware taking one .xlsx in field 'upload', saved as <time>_<name>.xlsx (old PHP upload_file).
// Browsers send .xlsx with varying mime types, so the extension is checked.
export const xlsxUpload = (dir, fallbackName) => {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const name = path.basename(file.originalname, path.extname(file.originalname))
          .replace(/ /g, '_')
          .replace(/[^A-Za-z0-9_-]/g, '');
        cb(null, `${Math.floor(Date.now() / 1000)}_${name || fallbackName}.xlsx`);
      }
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (path.extname(file.originalname).toLowerCase() !== '.xlsx') {
        return cb(new Error('Please upload a .xlsx file.'));
      }
      cb(null, true);
    }
  }).single('upload');
  return (req, res, next) => upload(req, res, (error) => {
    if (error) {
      return res.status(422).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'The file cannot be more than 25MB.' : error.message });
    }
    next();
  });
};
