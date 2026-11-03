const { connection } = require("mongoose");
const StockReconciliation = require("../models/stockReconciliation");
// const Series = require("../models/series");
// const Sell = require("../models/sell");
const Stock = require("../models/stock");
const Product = require("../models/product");

exports.getMasterData = async (req, res, next) => {
  try {
    const masterData = await StockReconciliation.getMasterData(null);

    if (masterData instanceof Error) {
      throw masterData;
    }
  
    return res.status(200).json({ masterData });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Master Data failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

exports.createStockReconciliation = async (req, res, next) => {
  try {
    const stockReconciliation = new StockReconciliation({
      status: 'Pending',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    let error = await stockReconciliation.getRequestData(req);
    if (error instanceof Error) throw error;
    // console.log(stockReconciliation);

    error = await stockReconciliation.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await stockReconciliation.save();

    return res.status(201).json({
      message: "Stock Reconciliation added successfully",
      stockReconciliation: stockReconciliation
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a Stock Reconciliation failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Creating a Stock Reconciliation failed!";
    next(error, req, res);
  }
};

exports.updateStockReconciliation = async (req, res, next) => {
  try {
    let stockReconciliation = await StockReconciliation.findById(req.params.id);

    if (!stockReconciliation) {
      return res.status(404).json({
        message: "Stock Reconciliation not found!"
      });
    }

    if (stockReconciliation.status.trim().toUpperCase() === 'APPROVED') {
      const refStockReconciliation = await StockReconciliation.findOne({ refId: req.params.id });

      if (refStockReconciliation) {
        stockReconciliation = refStockReconciliation;
      } else {
        const obj = JSON.parse(JSON.stringify(stockReconciliation));
        delete obj._id;
        
        stockReconciliation = new StockReconciliation({
          // status: 'Pending',
          // refId: req.params.id,
          // updatedBy: req.userData.userId,
          ...obj
        });
      }

      stockReconciliation.status = 'Pending';
      stockReconciliation.refId = req.params.id;
      stockReconciliation.updatedBy = req.userData.userId;
    } else if (stockReconciliation.status.trim().toUpperCase() === 'REJECTED') {
      stockReconciliation.status = 'Pending';
    }

    await stockReconciliation.getRequestData(req);

    const error = await stockReconciliation.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await stockReconciliation.save();
    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Udpating Stock Reconciliation Failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Updating Stock Reconciliation failed!";
    next(error, req, res);
  }
};

exports.approveStockReconciliation = async (req, res, next) => {
  let session;

  try {
    let stockReconciliation = await StockReconciliation.findById(req.params.id);

    if (!stockReconciliation) {
      return res.status(404).json({
        message: "Stock Reconciliation not found!"
      });
    }

    if (stockReconciliation.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't approve this Stock Reconciliation.`, 
        error : { 
          errors : { 
            stockReconciliationDate: { message: `You can't approve this Stock Reconciliation.` } 
          } 
        }
      });
    }

    if (stockReconciliation.status.trim().toUpperCase() !== 'PENDING') {
      return res.status(422).json({ 
        message: `Stock Reconciliation status should be pending.`, 
        error : { 
          errors : { 
            stockReconciliationDate: { message: `Stock Reconciliation status should be pending.` } 
          } 
        }
      });
    }

    const message = await Stock.checkStock('Stock Reconciliation', stockReconciliation);
    if (message instanceof Error) throw message;
    if (message) {
      return res.status(422).json({ 
        message: message, 
        error : { 
          errors : { 
            stockReconciliationDate: { message: message } 
          } 
        }
      });
    }

    let error = stockReconciliation.approve(req);
    if (error) {
      throw error;
    }

    // console.log(error);
    // stockReconciliation.approvedBy = req.userData.userId;
    // stockReconciliation.approvedAt = new Date().toISOString();

    // const error = await stockReconciliation.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
      session = await connection.startSession();
      session.startTransaction();

      // if (!stockReconciliation.stockReconciliationNo) {
      //   const series = await Series.getSeries(req, 'Stock Reconciliation');
      //   stockReconciliation.getStockReconciliationNo(series.count);
      //   await series.save({- session });
      // }
      
      if (!stockReconciliation.refId) {
        await stockReconciliation.save({ session });
      } else {
        const obj = JSON.parse(JSON.stringify(stockReconciliation));
        delete obj._id;
        obj.refId = null;
        
        const refId = stockReconciliation.refId;

        await stockReconciliation.deleteOne({ session });

        stockReconciliation = await StockReconciliation.findByIdAndUpdate(refId, obj, { session : session, new: true });

        // console.log(stockReconciliation);

        // originalStockReconciliation = await StockReconciliation.findById(stockReconciliation.refId);
        // originalStockReconciliation.overwrite(stockReconciliation);
        // originalStockReconciliation.refId = null;
        // await originalStockReconciliation.save({ session });
      }

      await Stock.deleteMany({ 
        stockType: 'Stock Reconciliation', 
        stockReconciliation: stockReconciliation._id.toString() 
      }, { session });
      error = await Stock.setStockDetails('Stock Reconciliation', stockReconciliation, session, req);
      if (error) throw error;
          
      error = await Product.setStock('Stock Reconciliation', stockReconciliation, session);
      if (error instanceof Error) throw error;

      await session.commitTransaction();
         
    // } catch (error) { 
    //     await session.abortTransaction();
    // }
    
    res.status(200).json({ message: "Approve successful!" });
  } catch (error) {
    // console.log(error);

    if (session) {
      await session.abortTransaction();
    }

    // res.status(500).json({
    //   message: "Approving Stock Reconciliation failed! Error - " + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Stock Reconciliation failed!";
    next(error, req, res);
  }
};

exports.rejectStockReconciliation = async (req, res, next) => {
  try {
    let stockReconciliation = await StockReconciliation.findById(req.params.id);

    if (!stockReconciliation) {
      return res.status(404).json({
        message: "Stock Reconciliation not found!"
      });
    }

    if (stockReconciliation.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't reject this Stock Reconciliation.`, 
        error : { 
          errors : { 
            stockReconciliationDate: { message: `You can't reject this Stock Reconciliation.` } 
          } 
        }
      });
    }

    if (stockReconciliation.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Stock Reconciliation already approved.`, 
        error : { 
          errors : { 
            stockReconciliationDate: { message: `Stock Reconciliation already approved.` } 
          } 
        }
      });
    }

    const error = stockReconciliation.reject(req);
    if (error) {
      throw error;
    } else {
      await stockReconciliation.save();
      
      res.status(200).json({ message: "Reject successful!" });
    }
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Stock Reconciliation failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Stock Reconciliation failed!";
    next(error, req, res);
  }
};

exports.getStockReconciliations = async (req, res, next) => {
  const status = req.query.status;
  const pageSize = +req.query.pagesize;
  const currentPage = +req.query.page;

  let totalCount = 0;
  const statusCount = {
    pending: 0,
    approved: 0,
    rejected: 0,
    inActive: 0
  };

  try {
    const data = await StockReconciliation.aggregate().sortByCount("status");
    // console.log(data);
    for (const item of data) {
      if (item._id === "Pending") {
        statusCount.pending = statusCount.pending + parseInt(item.count);
        totalCount = parseInt(item.count);
      }
      else if (item._id === "Approved") {
        statusCount.approved = statusCount.approved + parseInt(item.count);
        totalCount = parseInt(item.count);
      }
      else if (item._id === "Rejected") {
        statusCount.rejected = statusCount.rejected + parseInt(item.count);
        totalCount = parseInt(item.count);
      }
      else if (item._id === "InActive") {
        statusCount.inActive = statusCount.inActive + parseInt(item.count);
        totalCount = parseInt(item.count);
      }
    }

    let cond = {};
    if (status) {
      cond = { status: status };
    }

    const stockReconciliations = await StockReconciliation
                                  .find(cond)
                                  .sort('-updatedAt')
                                  .skip(pageSize * (currentPage - 1))
                                  .limit(pageSize)
                                  .select('-stockReconciliationItems')
                                  .populate('depot', 'depotName')
                                  .lean();

    res.status(200).json({
      message: "Stock Reconciliations fetched successfully!",
      statusCount: statusCount,
      maxStockReconciliations: totalCount,
      stockReconciliations: stockReconciliations
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching Stock Reconciliations failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Stock Reconciliations failed!";
    next(error, req, res);
  }
};

exports.getStockReconciliation = async (req, res, next) => {
  try {
    const stockReconciliation = await StockReconciliation.findById(req.params.id);
    if (!stockReconciliation) {
      return res.status(404).json({ message: "Stock Reconciliation not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    if (stockReconciliation.isFreezed) {
      if (stockReconciliation.status.trim().toUpperCase() !== 'APPROVED' && 
          stockReconciliation.status.trim().toUpperCase() !== 'INACTIVE') {
            if (roleDetails.update) {
              action.update = true;
            }
            if (roleDetails.delete) {
              action.delete = true;
            }
      }
    } else {
      if (stockReconciliation.updatedBy.toString() === req.userData.userId || 
          roleDetails.approve === false || 
          stockReconciliation.status.trim().toUpperCase() !== 'PENDING') 
      {
        if (roleDetails.update) {
          action.update = true;
        }
        if (roleDetails.delete) {
          action.delete = true;
        }
      } else if (roleDetails.approve === true) {
        action.approve = true;
      }
    }

    const masterData = await StockReconciliation.getMasterData(stockReconciliation);

    if (masterData instanceof Error) {
      throw masterData;
    }
  
    return res.status(200).json({ action, stockReconciliation, masterData });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Stock Reconciliation failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Stock Reconciliation failed!";
    next(error, req, res);
  }
};

exports.deleteStockReconciliation = async (req, res, next) => {
  try {
    let stockReconciliation = await StockReconciliation.findById(req.params.id);

    if (!stockReconciliation) {
      return res.status(404).json({
        message: "Stock Reconciliation not found!"
      });
    }

    // console.log(stockReconciliation);

    // stockReconciliation.getRequestData();
    // const error = await stockReconciliation.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }
    
    if (stockReconciliation.status.trim().toUpperCase() === 'APPROVED') {
      const refStockReconciliation = await StockReconciliation.findOne({ refId: req.params.id });
      
      if (refStockReconciliation) {
        // console.log('refStockReconciliation');
        refStockReconciliation.status = 'Pending';
        refStockReconciliation.isDeleted = true;
        refStockReconciliation.remarks = req.body.remarks;
        refStockReconciliation.refId = req.params.id;
        refStockReconciliation.updatedBy = req.userData.userId;

        // console.log(refStockReconciliation);
        await refStockReconciliation.save();
      } else {
        const obj = JSON.parse(JSON.stringify(stockReconciliation));
        delete obj._id;
        
        const newStockReconciliation = new StockReconciliation({
          ...obj
        });

        newStockReconciliation.status = 'Pending';
        newStockReconciliation.isDeleted = true;
        newStockReconciliation.remarks = req.body.remarks;
        newStockReconciliation.refId = req.params.id;
        newStockReconciliation.updatedBy = req.userData.userId;

        await newStockReconciliation.save();
      }
    } else {
      const result = await stockReconciliation.deleteOne();
    }

    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // console.log(error);

    // res.status(500).json({
    //   message: "Deleting Stock Reconciliation failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting Stock Reconciliation failed!";
    next(error, req, res);
  }
};

exports.getDepotStock = async (req, res, next) => {
  try {
    const stock = await Stock.getDepotStock(req);
    if (!stock) {
      return res.status(404).json({ message: "Stock Details not found!" });
    }

    return res.status(200).json({ stock });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Stock Reconciliation failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Stock Reconciliation failed!";
    next(error, req, res);
  }
};