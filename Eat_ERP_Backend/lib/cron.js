const cron = require("node-cron");
const ShopifyApiController = require("../controllers/shopifyApis");
const SellingPartnerApiController = require("../controllers/sellingPartnerApis");

// cron.schedule('* * * * *', () => {
//   console.log('running a task every minute');
// });

// Cron For Shopify Orders
cron.schedule('10 02 * * *', ShopifyApiController.getOrders);

// Cron For Amazon FBA Depot and Amazon Orders
cron.schedule('20 23 * * *', SellingPartnerApiController.createFbaShipmentReport);
cron.schedule('30 23 * * *', SellingPartnerApiController.getFbaShipmentReport);
cron.schedule('40 23 * * *', SellingPartnerApiController.getFbaShipmentReportDocument);
cron.schedule('50 23 * * *', SellingPartnerApiController.downloadFbaShipmentReport);
cron.schedule('59 23 * * *', SellingPartnerApiController.getOrders);