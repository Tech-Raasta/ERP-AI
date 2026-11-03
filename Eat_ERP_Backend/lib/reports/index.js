import production from './production.js';
import accounts from './accounts.js';
import ledgers from './ledgers.js';
import sales from './sales.js';
import stock from './stock.js';

// Every report on the Reports screen. Adding one means adding a definition: the screen, filters, preview, Excel and
// access all follow from it.

export const REPORTS = [...sales, ...stock, ...production, ...accounts, ...ledgers];
export const GROUPS = ['Sales', 'Accounting', 'Stock', 'Production', 'Other'];

export const findReport = (key) => REPORTS.find((report) => report.key === key) || null;
