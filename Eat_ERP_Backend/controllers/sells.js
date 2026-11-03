const { connection } = require("mongoose");
const Sell = require("../models/sell");
const Series = require("../models/series");
const Product = require("../models/product");
const Stock = require("../models/stock");

exports.getMasterData = async (req, res, next) => {
  try {
    const masterData = await Sell.getMasterData(null);

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

exports.createSell = async (req, res, next) => {
  try {
    const sell = new Sell({
      status: 'Pending',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    await sell.getRequestData(req);

    // console.log(sell);

    const error = await sell.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await sell.save();

    return res.status(201).json({
      message: "Sale added successfully",
      sell: sell
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a Sell failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Creating a Sale failed!";
    next(error, req, res);
  }
};

exports.updateSell = async (req, res, next) => {
  try {
    let sell = await Sell.findById(req.params.id);

    if (!sell) {
      return res.status(404).json({
        message: "Sale not found!"
      });
    }

    if (sell.status.trim().toUpperCase() === 'APPROVED') {
      const refSell = await Sell.findOne({ refId: req.params.id });

      if (refSell) {
        sell = refSell;
      } else {
        const obj = JSON.parse(JSON.stringify(sell));
        delete obj._id;
        
        sell = new Sell({
          // status: 'Pending',
          // refId: req.params.id,
          // updatedBy: req.userData.userId,
          ...obj
        });
      }
      
      sell.status = 'Pending';
      sell.refId = req.params.id;
      sell.updatedBy = req.userData.userId;
    } else if (sell.status.trim().toUpperCase() === 'REJECTED') {
      sell.status = 'Pending';
    }

    await sell.getRequestData(req);

    const error = await sell.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await sell.save();
    res.status(200).json({ message: "Update successful!", sell: sell });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Udpating Sell Failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Updating Sale failed!";
    next(error, req, res);
  }
};

exports.approveSell = async (req, res, next) => {
  let session;

  try {
    let sell = await Sell.findById(req.params.id);

    if (!sell) {
      return res.status(404).json({
        message: "Sale not found!"
      });
    }

    if (sell.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't approve this Sell.`, 
        error : { 
          errors : { 
            sellDate: { message: `You can't approve this Sell.` } 
          } 
        }
      });
    }

    if (sell.status.trim().toUpperCase() !== 'PENDING') {
      return res.status(422).json({ 
        message: `Sale status should be pending.`, 
        error : { 
          errors : { 
            sellDate: { message: `Sale status should be pending.` } 
          } 
        }
      });
    }

    const message = await Stock.checkStock('Sell', sell);
    if (message instanceof Error) throw message;
    if (message) {
      return res.status(422).json({ 
        message: message, 
        error : { 
          errors : { 
            sellDate: { message: message } 
          } 
        }
      });
    }

    let error = sell.approve(req);
    if (error) {
      throw error;
    }

    // console.log(error);
    // sell.approvedBy = req.userData.userId;
    // sell.approvedAt = new Date().toISOString();

    // const error = await sell.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
      session = await connection.startSession();
      session.startTransaction();

      if (!sell.invoiceNo) {
        const series = await Series.getSeries(req, 'Sell');
        sell.getInvoiceNo(series.count);
        await series.save({ session });
      }
      
      if (!sell.refId) {
        await sell.save({ session });
      } else {
        const obj = JSON.parse(JSON.stringify(sell));
        delete obj._id;
        obj.refId = null;

        const refId = sell.refId;

        await sell.deleteOne({ session });

        sell = await Sell.findByIdAndUpdate(refId, obj, { session: session, new: true });

        // originalSell = await Sell.findById(sell.refId);
        // originalSell.overwrite(sell);
        // originalSell.refId = null;
        // originalSell.sellState = sell.sellState;
        // // console.log(originalSell);
        // await originalSell.save({ session });
      }

      await Stock.deleteMany({ stockType: 'Sell', sell: sell._id.toString() }, { session });
      error = await Stock.setStockDetails('Sell', sell, session, req);
      if (error) throw error;
          
      error = await Product.setStock('Sell', sell, session);
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
    //   message: 'Approving Sell failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Sale failed!";
    next(error, req, res);
  }
};

exports.rejectSell = async (req, res, next) => {
  try {
    let sell = await Sell.findById(req.params.id);

    if (!sell) {
      return res.status(404).json({
        message: "Sale not found!"
      });
    }

    if (sell.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't reject this Sell.`, 
        error : { 
          errors : { 
            sellDate: { message: `You can't reject this Sell.` } 
          } 
        }
      });
    }

    if (sell.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Sale already approved.`, 
        error : { 
          errors : { 
            sellDate: { message: `Sale already approved.` } 
          } 
        }
      });
    }

    const error = sell.reject(req);
    if (error) {
      throw error;
    } else {
      await sell.save();
      
      res.status(200).json({ message: "Reject successful!" });
    }
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Sell failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Sale failed!";
    next(error, req, res);
  }
};

exports.getSells = async (req, res, next) => {
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
    const data = await Sell.aggregate([{ $match: { isDepotTransfer: false } }]).sortByCount("status");
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
      cond = { status: status, isDepotTransfer: false };
    }

    const sells = await Sell
                            .find(cond)
                            .sort('-updatedAt')
                            .skip(pageSize * (currentPage - 1))
                            .limit(pageSize)
                            .populate('distributor depot')
                            .lean();

    res.status(200).json({
      message: "Sales fetched successfully!",
      statusCount: statusCount,
      maxSells: totalCount,
      sells: sells
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching Sells failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sales failed!";
    next(error, req, res);
  }

  // const sellQuery = Sell.find();
  // let fetchedSells;
  // if (pageSize && currentPage) {
  //   sellQuery.skip(pageSize * (currentPage - 1)).limit(pageSize);
  // }
  // sellQuery
  //   .then(documents => {
  //     fetchedSells = documents;
  //     return Sell.count();
  //   })
  //   .then(count => {
  //     res.status(200).json({
  //       message: "Sales fetched successfully!",
  //       sells: fetchedSells,
  //       maxSells: count
  //     });
  //   })
  //   .catch(error => {
  //     res.status(500).json({
  //       message: "Fetching Sells failed!"
  //     });
  //   });
};

exports.getSell = async (req, res, next) => {
  try {
    const sell = await Sell.findById(req.params.id);
    if (!sell) {
      return res.status(404).json({ message: "Sale not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(sell.updatedBy.toString());
    // console.log(req.userData.userId);

    if (sell.isFreezed) {
      if (sell.status.trim().toUpperCase() !== 'APPROVED' && 
          sell.status.trim().toUpperCase() !== 'INACTIVE') {
            if (roleDetails.update) {
              action.update = true;
            }
            if (roleDetails.delete) {
              action.delete = true;
            }
      }
    } else {
      if (roleDetails.approve === false || 
          sell.status.trim().toUpperCase() !== 'PENDING' || 
          sell.updatedBy.toString() === req.userData.userId) 
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

    const masterData = await Sell.getMasterData(sell);

    if (masterData instanceof Error) {
      throw masterData;
    }
  
    return res.status(200).json({ action, sell, masterData });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching Sell failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale failed!";
    next(error, req, res);
  }
};

exports.deleteSell = async (req, res, next) => {
  try {
    let sell = await Sell.findById(req.params.id);

    if (!sell) {
      return res.status(404).json({
        message: "Sale not found!"
      });
    }

    // console.log(sell);

    // sell.getRequestData();
    // const error = await sell.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }
    
    if (sell.status.trim().toUpperCase() === 'APPROVED') {
      const refSell = await Sell.findOne({ refId: req.params.id });
      
      if (refSell) {
        // console.log('refSell');
        refSell.status = 'Pending';
        refSell.isDeleted = true;
        refSell.remarks = req.body.remarks;
        refSell.refId = req.params.id;
        refSell.updatedBy = req.userData.userId;

        // console.log(refSell);
        await refSell.save();
      } else {
        const obj = JSON.parse(JSON.stringify(sell));
        delete obj._id;
        
        const newSell = new Sell({
          ...obj
        });

        newSell.status = 'Pending';
        newSell.isDeleted = true;
        newSell.remarks = req.body.remarks;
        newSell.refId = req.params.id;
        newSell.updatedBy = req.userData.userId;

        await newSell.save();
      }
    } else {
      const result = await sell.deleteOne();
    }

    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // console.log(error);

    // res.status(500).json({
    //   message: "Deleting Sell failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting Sale failed!";
    next(error, req, res);
  }
};

exports.getSellInvoice = async (req, res, next) => {
  try {
    const sell = await Sell.findById(req.params.id).populate('depot distributor').lean();
    if (!sell) {
      return res.status(404).json({ message: "Sale not found!" });
    }

    return res.status(200).json({ sell });
  } catch (error) {
    // console.log(error);

    // res.status(500).json({
    //   message: "Fetching Sell failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale failed!";
    next(error, req, res);
  }
};