const { connection } = require("mongoose");
const Grn = require("../models/grn");
const Product = require("../models/product");
const Series = require("../models/series");
const PurchaseOrder = require("../models/purchaseOrder");
const Stock = require("../models/stock");

exports.getMasterData = async (req, res, next) => {
  try {
    const masterData = await Grn.getMasterData(null);

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

exports.createGrn = async (req, res, next) => {
  try {
    const grn = new Grn({
      status: 'Pending',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    await grn.getRequestData(req);

    // console.log(grn);

    const error = await grn.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await grn.save();

    return res.status(201).json({
      message: "Grn added successfully",
      grn: grn
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a Grn failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Creating a Grn failed!";
    next(error, req, res);
  }
};

exports.updateGrn = async (req, res, next) => {
  try {
    let grn = await Grn.findById(req.params.id);

    if (!grn) {
      return res.status(404).json({
        message: "Grn not found!"
      });
    }

    if (grn.status.trim().toUpperCase() === 'APPROVED') {
      const refGrn = await Grn.findOne({ refId: req.params.id });

      if (refGrn) {
        grn = refGrn;
      } else {
        const obj = JSON.parse(JSON.stringify(grn));
        delete obj._id;
        
        grn = new Grn({
          // status: 'Pending',
          // refId: req.params.id,
          // updatedBy: req.userData.userId,
          ...obj
        });
      }

      grn.status = 'Pending';
      grn.refId = req.params.id;
      grn.updatedBy = req.userData.userId;
    } else if (grn.status.trim().toUpperCase() === 'REJECTED') {
      grn.status = 'Pending';
    }

    await grn.getRequestData(req);

    const error = await grn.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await grn.save();
    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Udpating Grn Failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Udpating Grn failed!";
    next(error, req, res);
  }
};

exports.approveGrn = async (req, res, next) => {
  let session;

  try {
    let grn = await Grn.findById(req.params.id);

    if (!grn) {
      return res.status(404).json({
        message: "Grn not found!"
      });
    }

    if (grn.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't approve this Grn.`, 
        error : { 
          errors : { 
            grnDate: { message: `You can't approve this Grn.` } 
          } 
        }
      });
    }

    if (grn.status.trim().toUpperCase() !== 'PENDING') {
      return res.status(422).json({ 
        message: `Grn status should be pending.`, 
        error : { 
          errors : { 
            grnDate: { message: `Grn status should be pending.` } 
          } 
        }
      });
    }

    const message = await Stock.checkStock('Grn', grn);
    if (message instanceof Error) throw message;
    if (message) {
      return res.status(422).json({ 
        message: message, 
        error : { 
          errors : { 
            grnDate: { message: message } 
          } 
        }
      });
    }

    let error = grn.approve(req);
    if (error) {
      throw error;
    }

    // console.log(error);
    // grn.approvedBy = req.userData.userId;
    // grn.approvedAt = new Date().toISOString();

    // const error = await grn.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
      session = await connection.startSession();
      session.startTransaction();

      if (!grn.grnNo) {
        const series = await Series.getSeries(req, 'Grn');
        grn.getGrnNo(series.count);
        await series.save({ session });
      }
      
      if (!grn.refId) {
        await grn.save({ session });
      } else {
        const obj = JSON.parse(JSON.stringify(grn));
        delete obj._id;
        obj.refId = null;

        const refId = grn.refId;
        await grn.deleteOne({ session });

        grn = await Grn.findByIdAndUpdate(refId, obj, { session: session, new: true });

        // originalGrn = await Grn.findById(grn.refId);
        // originalGrn.overwrite(grn);
        // originalGrn.refId = null;
        // await originalGrn.save({ session });
      }

      let poStatus = 'Open';
      if (grn.status === 'Approved') {
        poStatus = 'Closed';
      }
      await PurchaseOrder.findByIdAndUpdate(
        grn.purchaseOrder, 
        { poStatus: poStatus, updatedBy: req.userData.userId },
        { session }
      );

      await Stock.deleteMany({ stockType: 'Grn', grn: grn._id.toString() }, { session });
      error = await Stock.setStockDetails('Grn', grn, session, req);
      if (error) throw error;

      error = await Product.setStock('Grn', grn, session);
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
    //   message: "Approving Grn failed! Error - " + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Grn failed!";
    next(error, req, res);
  }
};

exports.rejectGrn = async (req, res, next) => {
  try {
    let grn = await Grn.findById(req.params.id);

    if (!grn) {
      return res.status(404).json({
        message: "Grn not found!"
      });
    }

    if (grn.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't reject this Grn.`, 
        error : { 
          errors : { 
            grnDate: { message: `You can't reject this Grn.` } 
          } 
        }
      });
    }

    if (grn.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Grn already approved.`, 
        error : { 
          errors : { 
            grnDate: { message: `Grn already approved.` } 
          } 
        }
      });
    }

    const error = grn.reject(req);
    if (error) {
      throw error;
    } else {
      await grn.save();
      
      res.status(200).json({ message: "Reject successful!" });
    }
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Grn failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Grn failed!";
    next(error, req, res);
  }
};

exports.getGrns = async (req, res, next) => {
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
    const data = await Grn.aggregate().sortByCount("status");
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

    const grns = await Grn
                        .find(cond)
                        .sort('-updatedAt')
                        .skip(pageSize * (currentPage - 1))
                        .limit(pageSize)
                        .populate('vendor depot purchaseOrder')
                        .lean();

    const grn = await Grn.findById('644774106d219476422cf3bf');

    res.status(200).json({
      message: "Grns fetched successfully!",
      statusCount: statusCount,
      maxGrns: totalCount,
      grns: grns
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Grns failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Grns failed!";
    next(error, req, res);
  }
};

exports.getGrn = async (req, res, next) => {
  try {
    const grn = await Grn.findById(req.params.id)
                          .populate({
                                      path: 'grnItems',			
                                      populate: { path: 'productId', model: Product, select: { productName: 1 } }
                                    });
    if (!grn) {
      return res.status(404).json({ message: "Grn not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    if (grn.isFreezed) {
      if (grn.status.trim().toUpperCase() !== 'APPROVED' && 
          grn.status.trim().toUpperCase() !== 'INACTIVE') {
            if (roleDetails.update) {
              action.update = true;
            }
            if (roleDetails.delete) {
              action.delete = true;
            }
      }
    } else {
      if (grn.updatedBy.toString() === req.userData.userId || 
          roleDetails.approve === false || 
          grn.status.trim().toUpperCase() !== 'PENDING') 
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

    const products = await Product
                            .find({ $or: [{status: 'Approved'}, {_id: req.params.id}] })
                            .select('_id productName description hsnCode costWithoutGst taxPercentage');

    const masterData = await Grn.getMasterData(grn);

    if (masterData instanceof Error) {
      throw masterData;
    }
  
    return res.status(200).json({ action, grn, products, masterData });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching Grn failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Grn failed!";
    next(error, req, res);
  }
};

exports.getGrnDetails = async (req, res, next) => {
  try {
    const grn = await Grn
                                .findById(req.params.id)
                                .populate('vendor depot purchaseOrder')
                                .populate('createdBy updatedBy approvedBy', 'userName')
                                .lean();
    if (!grn) {
      return res.status(404).json({ message: "Grn not found!" });
    }

    return res.status(200).json({ grn });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching Grn failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Grn failed!";
    next(error, req, res);
  }
};

exports.getPurchaseOrders = async (req, res, next) => {
  try {
    const purchaseOrders = await PurchaseOrder
      .find({ status: 'Approved', vendor: req.params.vendorId })
      .select('_id purchaseOrderNo');

    res.status(200).json({
      message: "Purchase Orders fetched successfully!",
      purchaseOrders: purchaseOrders
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Purchase Orders failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Purchase Orders failed!";
    next(error, req, res);
  }
};

exports.getPurchaseOrder = async (req, res, next) => {
  try {
    const purchaseOrder = await PurchaseOrder
                                  .findById(req.params.id)
                                  .populate({
                                              path: 'purchaseOrderItems',			
                                              populate: { 
                                                path: 'productId', 
                                                model: Product, 
                                                select: { productName: 1 } 
                                              }
                                            });

    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase Order not found!" });
    }
    
    const masterData = await PurchaseOrder.getMasterData(purchaseOrder);

    if (masterData instanceof Error) {
      throw masterData;
    }
  
    return res.status(200).json({ purchaseOrder, masterData });
  } catch (error) {
    // console.log(error);

    // res.status(500).json({
    //   message: "Fetching Purchase Order failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Purchase Order failed!";
    next(error, req, res);
  }
};

exports.deleteGrn = async (req, res, next) => {
  try {
    let grn = await Grn.findById(req.params.id);

    if (!grn) {
      return res.status(404).json({
        message: "Grn not found!"
      });
    }

    // console.log(grn);

    // grn.getRequestData();
    // const error = await grn.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }
    
    if (grn.status.trim().toUpperCase() === 'APPROVED') {
      const refGrn = await Grn.findOne({ refId: req.params.id });
      
      if (refGrn) {
        // console.log('refGrn');
        refGrn.status = 'Pending';
        refGrn.isDeleted = true;
        refGrn.remarks = req.body.remarks;
        refGrn.refId = req.params.id;
        refGrn.updatedBy = req.userData.userId;

        // console.log(refGrn);
        await refGrn.save();
      } else {
        const obj = JSON.parse(JSON.stringify(grn));
        delete obj._id;
        
        const newGrn = new Grn({
          ...obj
        });

        newGrn.status = 'Pending';
        newGrn.isDeleted = true;
        newGrn.remarks = req.body.remarks;
        newGrn.refId = req.params.id;
        newGrn.updatedBy = req.userData.userId;

        await newGrn.save();
      }
    } else {
      const result = await grn.deleteOne();
    }

    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // console.log(error);

    // res.status(500).json({
    //   message: "Deleting Grn failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting Grn failed!";
    next(error, req, res);
  }
};