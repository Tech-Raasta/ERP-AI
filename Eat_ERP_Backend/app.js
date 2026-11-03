import path from "path";
import express from "express";
import logger from "./lib/logger.js";

import categoryRoutes from "./routes/categories.js";
import expenseCategoryRoutes from "./routes/expenseCategories.js";
import productRoutes from "./routes/products.js";
import boxRoutes from "./routes/boxes.js";
import comboBoxRoutes from "./routes/comboBoxes.js";
import attendanceRoutes from "./routes/attendance.js";
import batchMasterRoutes from "./routes/batchMasters.js";
import batchProcessingRoutes from "./routes/batchProcessing.js";
import recipeRoutes from "./routes/recipes.js";
import salesRepRoutes from "./routes/salesReps.js";
import rawMaterialRoutes from "./routes/rawMaterials.js";
// import countriesRoutes from "./routes/countries.js";
// import statesRoutes from "./routes/states.js";
import pincodesRoutes from "./routes/pincodes.js";
import depotRoutes from "./routes/depots.js";
import distributorsRoutes from "./routes/distributors.js";
import distributorTypeRoutes from "./routes/distributorTypes.js";
import zoneRoutes from "./routes/zones.js";
import areaRoutes from "./routes/areas.js";
import locationRoutes from "./routes/locations.js";
import cityRoutes from "./routes/cities.js";
import salesRoutes from "./routes/sales.js";
import sampleRoutes from "./routes/sampleOuts.js";
import salesReturnRoutes from "./routes/salesReturns.js";
import endOfMonthSalesRoutes from "./routes/endOfMonthSales.js";
// import userRolesRoutes from "./routes/userRoles.js";
import purchaseOrderRoutes from "./routes/purchaseOrders.js";
import productionPlanningRoutes from "./routes/productionPlanning.js";
import requisitionRoutes from "./routes/requisition.js";
import productionRoutes from "./routes/productions.js";
import productionTransferRoutes from "./routes/productionTransfers.js";
import packagingRoutes from "./routes/packaging.js";
import storeManagerRoutes from "./routes/storeManager.js";
import storePackagingManagerRoutes from "./routes/storePackagingManager.js";
import rawMaterialReconRoutes from "./routes/rawMaterialRecon.js";
// import grnsRoutes from "./routes/grns.js";
import rawMaterialInRoutes from "./routes/rawMaterialIns.js";
import rawMaterialInOutRoutes from "./routes/rawMaterialInOuts.js";
import paymentVoucherRoutes from "./routes/paymentVouchers.js";
import vendorPaymentRoutes from "./routes/vendorPayments.js";
import vendorTypeRoutes from "./routes/vendorTypes.js";
import vendorRoutes from "./routes/vendors.js";
import depotTransferRoutes from "./routes/depotTransfers.js";
import saleUploadRoutes from "./routes/saleUpload.js";
import salesReturnUploadRoutes from "./routes/salesReturnUploads.js";
import paymentRoutes from "./routes/payments.js";
import creditDebitNoteRoutes from "./routes/creditDebitNotes.js";
import oldPaymentUploadRoutes from "./routes/oldPaymentUploads.js";
import userRoleRoutes from "./routes/userRoleMaster.js";
// import postsRoutes from "./routes/posts.js";
import userRoutes from "./routes/users.js";
// import sectionsRoutes from "./routes/sections.js";
// import sellsRoutes from "./routes/sells.js";
// import sellReturnsRoutes from "./routes/sellReturns.js";
// import stockReconciliationsRoutes from "./routes/stockReconciliations.js";
// import samplesRoutes from "./routes/samples.js";
// import sellReturnUploadsRoutes from "./routes/sellReturnUploads.js";
// import sellDeliveryUploadsRoutes from "./routes/sellDeliveryUploads.js";
import reportsRoutes from "./routes/reports.js";
// import dashboardRoutes from "./routes/dashboard.js";
// import freezesRoutes from "./routes/freezes.js";
import sellingPartnerApiRoutes from "./routes/sellingPartnerApis.js";
import easyEcomApiRoutes from "./routes/easyEcomApis.js";
// import easyEcomInventoryRoutes from "./routes/easyEcomInventory.js";
// import shopifyApisRoutes from "./routes/shopifyApis.js";
import error from "./middleware/error.js";
import homeRoutes from "./routes/home.js";
import homeDashboardRoutes from "./routes/homeDashboard.js";

import depotTransferUploadRoutes from "./routes/depotTransferUpload.js";
import paymentUploadRoutes from "./routes/paymentUploads.js";

const app = express();

// throw new Error('Something failed during startup!');

// const p = Promise.reject('Something failed miserably!');
// p.then(() => console.log('done!'));

const __dirname = path.resolve();

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json({limit: '2500mb'}));
app.use(express.urlencoded({ extended: true, limit: '2500mb' }));
// app.use("/images", express.static(path.join(__dirname, "images")));
// app.use("/erp", express.static(path.join(__dirname, "erp")));
app.use("/static", express.static(path.join(__dirname, "static")));
app.use("/img", express.static(path.join(__dirname, "img")));
app.use("/log", express.static(path.join(__dirname, "log")));
app.use("/assets", express.static(path.join(__dirname, "assets")));
// app.use("/", express.static(path.join(__dirname, "angular")));

// The ERP pages (FRONTEND_URL, ALLOWED_ORIGINS, and the development server) may send the session cookie; any other
// caller gets the old open answer without cookies, so outside tools keep working
const originOf = (url) => { try { return new URL(url).origin; } catch (e) { return null; } };
const allowedOrigins = [
  originOf(process.env.FRONTEND_URL),
  ...String(process.env.ALLOWED_ORIGINS || '').split(',').map((item) => originOf(item.trim())),
  'http://localhost:3000',
].filter(Boolean);
app.set('allowedOrigins', allowedOrigins);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS"
  );
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;

  logger.info(`[${timestamp}] ${method} ${url} - IP: ${ip}`);

  // Log response when finished
  res.on('finish', () => {
    const statusCode = res.statusCode;
    logger.info(`[${timestamp}] ${method} ${url} - Status: ${statusCode}`);
  });

  next();
});

app.use("/api/category", categoryRoutes);
app.use("/api/expense_category", expenseCategoryRoutes);
app.use("/api/product", productRoutes);
app.use("/api/box", boxRoutes);
app.use("/api/combo_box", comboBoxRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/batch_master", batchMasterRoutes);
app.use("/api/batch_processing", batchProcessingRoutes);
app.use("/api/recipe", recipeRoutes);
app.use("/api/sales_rep", salesRepRoutes);
app.use("/api/distributor", distributorsRoutes);
app.use("/api/distributor_type", distributorTypeRoutes);
app.use("/api/zone", zoneRoutes);
app.use("/api/area", areaRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/city_master", cityRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/sample_out", sampleRoutes);
app.use("/api/sales_return", salesReturnRoutes);
app.use("/api/end_of_month_sales", endOfMonthSalesRoutes);
app.use("/api/pincode", pincodesRoutes);
app.use("/api/raw_material", rawMaterialRoutes);
app.use("/api/vendor_type", vendorTypeRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/depot", depotRoutes);
app.use("/api/purchase_order", purchaseOrderRoutes);
app.use("/api/production_planning", productionPlanningRoutes);
app.use("/api/requisition", requisitionRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/production_transfer", productionTransferRoutes);
app.use("/api/packaging", packagingRoutes);
app.use("/api/store_manager", storeManagerRoutes);
app.use("/api/store_packaging_manager", storePackagingManagerRoutes);
app.use("/api/raw_material_in", rawMaterialInRoutes);
app.use("/api/raw_material_in_out", rawMaterialInOutRoutes);
app.use("/api/raw_material_recon", rawMaterialReconRoutes);
app.use("/api/finance_voucher", paymentVoucherRoutes);
app.use("/api/vendor_payment", vendorPaymentRoutes);
app.use("/api/depot_transfer", depotTransferRoutes);
app.use("/api/sale_upload", saleUploadRoutes);
app.use("/api/sales_return_upload", salesReturnUploadRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/credit_debit_note", creditDebitNoteRoutes);
app.use("/api/old_payment_upload", oldPaymentUploadRoutes);
app.use("/api/user_roles", userRoleRoutes);
app.use("/api/user", userRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/home", homeDashboardRoutes);
// app.use("/api/sections", sectionsRoutes);
// app.use("/api/userRoles", userRolesRoutes);
// app.use("/api/dashboard", dashboardRoutes);
app.use("/api/sellingPartnerApis", sellingPartnerApiRoutes);
app.use("/api/easyEcomApis", easyEcomApiRoutes);
// app.use("/api/easyEcomInventory", easyEcomInventoryRoutes);
app.use("/api/depot_transfer_upload", depotTransferUploadRoutes);
app.use("/api/payment_upload", paymentUploadRoutes);

app.get('/api/testOutput', (req, res, next) => {
  res.status(200).json({
    'Test': 'Testing ERP API',
    'App Environment': app.get('env'),
    'Database': process.env.DATABASE,
    'Database Host': process.env.HOST,
  });
});

// An API address that does not exist answers in JSON, not with the web page below
app.use("/api", (req, res) => {
  res.status(404).json({ message: "This feature is not available on the server." });
});

app.get("*", (req, res, next) => {
  // console.log('Frontend');
  res.sendFile(
    path.join(__dirname, "erp", "index.html")
    // path.join(__dirname, "erp", "index.html")
  );
});

// app.use((req, res, next) => {
//   res.sendFile(path.join(__dirname, "angular", "index.html"));
// });

app.use("/", homeRoutes);

app.use(error);

// module.exports = app;
export default app;