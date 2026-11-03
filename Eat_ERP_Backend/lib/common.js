import fs from "fs";
import path from 'path';

const __dirname = path.resolve();

export const isValidDate = (date) => {
  return date && Object.prototype.toString.call(date) === "[object Date]" && !isNaN(date);
}

export const getIsoDateString = (strDate) => {
  let parts;
  if (strDate.indexOf('-') !== -1) {
    parts = strDate.split('-');
  } else {
    parts = strDate.split('/');
  }
  
  // Please pay attention to the month (parts[1]); JavaScript counts months from 0:
  // January - 0, February - 1, etc.
  const mydate = new Date(parts[2], parts[1] - 1, parts[0]); 
  // console.log(mydate.toDateString());

  return mydate.toISOString();
}

export const getDateString = (objDate) => {
  if (!isValidDate(objDate)) return null;
  const year = objDate.getFullYear();
  let month = objDate.getMonth() + 1;
  const date = objDate.getDate().toString().padStart(2,'0');

  month = month.toString().padStart(2,'0');

  return year + "-" + month + "-" + date;
}

export const getDateTimeString = (objDate) => {
  if (!isValidDate(objDate)) return null;
  const year = objDate.getFullYear();
  let month = objDate.getMonth() + 1;
  const date = objDate.getDate().toString().padStart(2,'0');
  const hours = objDate.getHours().toString().padStart(2,'0');
  const minutes = objDate.getMinutes().toString().padStart(2,'0');
  const seconds = objDate.getSeconds().toString().padStart(2,'0');

  month = month.toString().padStart(2,'0');

  return year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds;
}

export const addDays = (date, days) => {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString();
}

export const calculateFiscalYearForDate = inputDate => {
  let year = inputDate.getFullYear();
  let month = inputDate.getMonth();
  let fyStart = '';
  let fyEnd = '';
  let financial_year = '';

  if(month < 3){
      fyStart = year - 1;
      fyEnd = year;
  } else {
      fyStart = year;
      fyEnd = year + 1;
  }

  fyStart = fyStart.toString().slice(2);
  fyEnd = fyEnd.toString().slice(2);

  financial_year = fyStart + '-' + fyEnd;
  // console.log(financial_year);

  return financial_year;
}

export const getMonthName = month => {
  const monthName = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return monthName[month];
}

export const round = (num, decimalPlaces = 0) => {
  var p = Math.pow(10, decimalPlaces);
  var n = (num * p) * (1 + Number.EPSILON);
  return Math.round(n) / p;
}

export const validateEmail = (email) => {
  var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

export const calculateItemAmount = (quantity, rate, taxPercentage, taxType) => {
  let amount = round(quantity * rate, 2);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cgst_amt = 0;
  let sgst_amt = 0;
  let igst_amt = 0;
  let tax_amt = 0;
  let total_amt = 0;

  if (taxType === 'Intra') {
    cgst = round((taxPercentage / 2), 2);
    sgst = round((taxPercentage / 2), 2);

    cgst_amt = round(((amount * cgst) / 100), 2);
    sgst_amt = round(((amount * sgst) / 100), 2);
  } else {
    igst = round(taxPercentage, 2);
    igst_amt = round(((amount * igst) /100), 2);
  }

  tax_amt = round(cgst_amt + sgst_amt + igst_amt, 2);
  total_amt = round(amount + tax_amt, 2);

  return { amount, cgst, sgst, igst, cgst_amt, sgst_amt, igst_amt, tax_amt, total_amt };
}

export const calculateTransactionAmount = (items, tds_per, round_off_amount) => {
  let amount = 0;
  let cgst_amount = 0;
  let sgst_amount = 0;
  let igst_amount = 0;
  let tax_amount = 0;
  let total_amount = 0;
  let tds_amount = 0;
  let final_amount = 0;

  for(const item of items) {
    amount = round(amount + item.amount, 2);
    cgst_amount = round(cgst_amount + item.cgst_amt, 2);
    sgst_amount = round(sgst_amount + item.sgst_amt, 2);
    igst_amount = round(igst_amount + item.igst_amt, 2);
    tax_amount = round(tax_amount + item.tax_amt, 2);
    total_amount = round(total_amount + item.total_amt, 2);
  }
  tds_amount = round((amount * tds_per) / 100, 2);

  if(round_off_amount) {
    final_amount = round(total_amount - tds_amount + round_off_amount, 0);
  } else {
    final_amount = round(total_amount - tds_amount, 0);
    round_off_amount = round(final_amount - total_amount + tds_amount, 2);
  }

  return { amount, cgst_amount, sgst_amount, igst_amount, tax_amount, total_amount, tds_amount, round_off_amount, final_amount };
}

export const createPath = (newPath) => {
  if (!fs.existsSync(newPath)) {
    fs.mkdirSync(newPath, { recursive: true });
  }
}

export const getUploadPath = () => path.join(__dirname, "assets", "uploads");
export const getTemplatePath = () => path.join(__dirname, "assets", "templates");
export const getReportPath = () => path.join(__dirname, "assets", "reports");
export const getBaseUrl = () => 'http://localhost:5001/';
export const getReportUrl = () => path.join(getBaseUrl(), "assets", "reports");
