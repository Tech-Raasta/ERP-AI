const { connection } = require("mongoose");
const Sell = require("../models/sell");
const Product = require("../models/product");
const Stock = require("../models/stock");
const PurchaseOrder = require("../models/purchaseOrder");

exports.getData = async (req, res, next) => {
  try {
    // throw new Error('Test error middleware');

    dashboardData = {
      salesValue: 0,
      totalInventory: 0,
      shipmentInTransit: 0,
      openPos: 0,
      listOfOpenPos: []
    };

    let data = await Sell.aggregate([{ $match: { isDepotTransfer: false, status: 'Approved' } },
                                      { $group: { _id: null, amount: { $sum: "$invoiceAmount" } } }]);
    if (data && data.length > 0 && data[0].amount) {
      dashboardData.salesValue = data[0].amount;
    }

    data = await Stock.aggregate([{ $match: { status: 'Approved' } },
                                      { $group: { _id: null, quantity: { $sum: { $multiply: ["$stockQuantity", "$costWithoutGst"]} } } }]);
    if (data && data.length > 0 && data[0].quantity) {
      dashboardData.totalInventory = data[0].quantity;
    }
  
    data = await Sell.countDocuments({ isDepotTransfer: false, status: 'Approved', deliveryStatus: 'Pending' });
    if (data) {
      dashboardData.shipmentInTransit = data;
    }

    data = await PurchaseOrder.find({ status: 'Approved', poStatus: 'Open' });
    if (data) {
      dashboardData.openPos = data.length;
      dashboardData.listOfOpenPos = data;
    }

    return res.status(200).json({ dashboardData });
  } catch (error) {
    // console.log(error);

    // res.status(500).json({
    //   message: "Fetching Master Data failed!",
    //   // error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });

    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";

    // const err = {
    //   status: 500,
    //   msg: "Fetching Master Data failed!",
    //   ...error
    // }

    next(error, req, res);
  }
};