import { getProductionReport } from "../models/report.js";
import { USER_ADMIN_ROLES } from "../models/user.js";
import { invalid, text, userDepotIds } from "./sales.js";
import { query, readFilters, preview, writeExcel, rowCount, checkSize, withSlot, fileName, ReportError } from "../lib/reports/engine.js";
import { GROUPS, findReport } from "../lib/reports/index.js";
import { reportAccess, canOpenScreen } from "../lib/reports/access.js";

export const production = async (req, res, next) => {
  try {
    if (!(await canOpenScreen(+req.userData.userRoleId, USER_ADMIN_ROLES.includes(+req.userData.userRoleId), 'production'))) {
      return res.status(401).json({ message: "You do not have access to this report." });
    }
    const {fileUrl, fileName} = await getProductionReport(req);

    return res.status(200).json({ fileUrl, fileName });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Sell Upload Format failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Stock Report failed!";
    next(error, req, res);
  }
};

// export const stock = async (req, res, next) => {
//   try {
//     const fileUrl = await Stock.getStockReport(req);

//     return res.status(200).json({ fileUrl });
//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Fetching Sell Upload Format failed!"
//     // });
    
//     res.statusCode = 500;
//     res.message = "Fetching Stock Report failed!";
//     next(error, req, res);
//   }
// };

// export const sale = async (req, res, next) => {
//   try {
//     let fileUrl = '';

//     if (req.body.sales || req.body.salesReturn || req.body.sampleAndExpired) {
//       fileUrl = await Report.getSellSkuReport(req);
//     } else {
//       fileUrl = await Report.getSellInvoiceReport(req);
//     }

//     return res.status(200).json({ fileUrl });
//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Fetching Sell Upload Format failed!"
//     // });
    
//     res.statusCode = 500;
//     res.message = "Fetching Sales Report failed!";
//     next(error, req, res);
//   }
// };

// export const summary = async (req, res, next) => {
//   try {
//     const data = await Report.getSellSummaryReport(req);

//     return res.status(200).json(data);
//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Fetching Sell Upload Format failed!"
//     // });
    
//     res.statusCode = 500;
//     res.message = "Fetching Sales Summary Report failed!";
//     next(error, req, res);
//   }
// };


// ---------- Reports screen (lib/reports) ----------

const accessOf = (req) => reportAccess(+req.userData.userRoleId, USER_ADMIN_ROLES.includes(+req.userData.userRoleId));
const allowedReports = async (req) => (await accessOf(req)).reports;

const contextOf = (req, definition, filters) => ({
  filters,
  depotIds: userDepotIds(req),
  userId: req.userData.userId
});

const openReport = async (req, res) => {
  const definition = findReport(text(req.params.key));
  if (!definition) {
    res.status(404).json({ message: "Report not found!" });
    return null;
  }
  if (!(await allowedReports(req)).includes(definition)) {
    res.status(401).json({ message: "You do not have access to this report." });
    return null;
  }
  const { values, errors } = readFilters(definition, req.body || {});
  if (Object.keys(errors).length) {
    invalid(res, errors);
    return null;
  }
  return { definition, ctx: contextOf(req, definition, values) };
};

const describe = ({ key, name, group, description, filters, fileOnly, downloadLabel }) => ({ key, name, group, description, filters: filters || [], fileOnly: !!fileOnly, downloadLabel });

export const catalog = async (req, res, next) => {
  try {
    const { reports, screens } = await accessOf(req);
    res.status(200).json({
      screens: screens.map((screen) => screen.key),
      groups: GROUPS.map((group) => ({ group, reports: reports.filter((report) => report.group === group).map(describe) })).filter((item) => item.reports.length)
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching reports failed!";
    next(error, req, res);
  }
};

// The lists a report's filters need
export const options = async (req, res, next) => {
  try {
    const definition = findReport(text(req.params.key));
    if (!definition) return res.status(404).json({ message: "Report not found!" });
    if (!(await allowedReports(req)).includes(definition)) {
      return res.status(401).json({ message: "You do not have access to this report." });
    }
    const types = new Set((definition.filters || []).map((filter) => filter.type));
    const depotIds = userDepotIds(req);
    const [distributors, depots, ledgers] = await Promise.all([
      types.has('distributor') ? query(`select id as value, distributor_name as label from distributor_master where status = 'Approved' order by distributor_name`) : [],
      types.has('depot') && depotIds.length
        ? query(`select id as value, depot_name as label from depot_master where status = 'Approved' and id in (:depotIds) order by depot_name`, { depotIds })
        : [],
      types.has('ledger') ? query(`select id as value, ledger_name as label from account_ledger_master where status = 'Approved' order by ledger_name`) : []
    ]);
    res.status(200).json({ distributors, depots, ledgers, report: describe(definition) });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching report filters failed!";
    next(error, req, res);
  }
};

export const previewReport = async (req, res, next) => {
  try {
    const opened = await openReport(req, res);
    if (!opened) return undefined;
    const result = await withSlot(() => opened.definition.run(opened.ctx));
    res.status(200).json(preview(opened.definition, opened.ctx, result));
  } catch (error) {
    if (error instanceof ReportError) return res.status(422).json({ message: error.message });
    if (error && error.parent && error.parent.errno === 3024) return res.status(422).json({ message: "This report took too long. Choose a shorter period." });
    res.statusCode = 500;
    res.message = "Running report failed!";
    next(error, req, res);
  }
  return undefined;
};

export const downloadReport = async (req, res, next) => {
  try {
    const opened = await openReport(req, res);
    if (!opened) return undefined;
    await withSlot(async () => {
      const result = await opened.definition.run(opened.ctx);
      if (result.sheets.length ? !rowCount(result) : !result.file) throw new ReportError('No data found for this report.');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      // A report with a file of its own (a macro workbook, the e-invoice JSON) sends that instead of Excel rows
      if (result.file) {
        res.setHeader('Content-Type', result.file.type);
        res.setHeader('Content-Disposition', `attachment; filename="${result.file.name}"`);
        res.end(result.file.content);
        return;
      }
      checkSize(result);
      // Nothing is sent until the data is ready, so a failure above is still a normal error
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName(opened.definition)}"`);
      await writeExcel(opened.definition, opened.ctx, result, res);
    });
  } catch (error) {
    if (res.headersSent) return res.destroy(error);
    if (error instanceof ReportError) return res.status(422).json({ message: error.message });
    if (error && error.parent && error.parent.errno === 3024) return res.status(422).json({ message: "This report took too long. Choose a shorter period." });
    res.statusCode = 500;
    res.message = "Downloading report failed!";
    next(error, req, res);
  }
  return undefined;
};
