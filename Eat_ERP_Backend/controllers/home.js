// const { Category } = require("../models/category");
// const Depot = require("../models/depot");
// const DepotTransfer = require("../models/depotTransfer");
// const Distributor = require("../models/distributor");
// const Grn = require("../models/grn");
// const Product = require("../models/product");
// const PurchaseOrder = require("../models/purchaseOrder");
// const Sample = require("../models/sample");
// const Sell = require("../models/sell");
// const SellReturn = require("../models/sellReturn");
// const SellReturnUpload = require("../models/sellReturnUpload");
// const SellUpload = require("../models/sellUpload");
// const Series = require("../models/series");
// const Stock = require("../models/stock");
// const StockReconciliation = require("../models/stockReconciliation");
// const User = require("../models/user");
// const UserRole = require("../models/userRole");
// const Vendor = require("../models/vendor");

export const getHome = async (req, res, next) => {
  try {
    res.status(200).json({ home: 'Home' });
  } catch (error) {
    console.log(error);
  }
};

// export default async (req, res, next) => {
//   try {
//     res.status(200).json({ home: 'Home' });
//   } catch (error) {
//     console.log(error);
//   }
// };

// exports.clearDb = async (req, res, next) => {
//   try {
//     await Category.deleteMany();
//     await Depot.deleteMany();
//     await DepotTransfer.deleteMany();
//     await Distributor.deleteMany();
//     await Grn.deleteMany();
//     await Product.deleteMany();
//     await PurchaseOrder.deleteMany();
//     await Sample.deleteMany();
//     await Sell.deleteMany();
//     await SellReturn.deleteMany();
//     await SellReturnUpload.deleteMany();
//     await SellUpload.deleteMany();
//     await Series.deleteMany();
//     await Stock.deleteMany();
//     await StockReconciliation.deleteMany();
//     await UserRole.deleteMany({ _id: { $ne: '643932d6ed25565081212811' }});
//     await Vendor.deleteMany();

//     res.status(200).json({ message: 'Database Cleared.' });
//   } catch (error) {
//     console.log(error);
//   }
// };