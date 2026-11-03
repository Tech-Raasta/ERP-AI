const { connection } = require("mongoose");
const SellReturnUpload = require("../models/sellReturnUpload");
const SellReturnUploadDetail = require("../models/sellReturnUploadDetail");
const SellReturn = require("../models/sellReturn");
const Sample = require("../models/sample");
const Series = require("../models/series");
const Stock = require("../models/stock");
const Product = require("../models/product");

exports.createSellReturnUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ message: "Please upload an Excel file." });
    }

    const sellReturnUpload = new SellReturnUpload({
      status: 'Uploading',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    sellReturnUpload.getRequestData(req);

    const error = await sellReturnUpload.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await sellReturnUpload.save();

    res.status(201).json({
      message: "Sell Return Upload added successfully",
      sellReturnUpload: sellReturnUpload
    });

    await sellReturnUpload.uploadFileData(req);

    await sellReturnUpload.save();
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a Sell Return Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Creating a Sale Return Upload failed!";
    next(error, req, res);
  }
};

exports.getSellReturnUploadFormat = async (req, res, next) => {
  try {
    const fileUrl = await SellReturnUpload.getUploadFormat();

    return res.status(200).json({ fileUrl });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Sell Return Upload Format failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Return Upload Format failed!";
    next(error, req, res);
  }
};

exports.getSellReturnUpload = async (req, res, next) => {
  try {
    const sellReturnUpload = await SellReturnUpload.findById(req.params.id);
    if (!sellReturnUpload) {
      return res.status(404).json({ message: "Sell Return Upload not found!" });
    }

    // await sellReturnUpload.uploadFileData(req);
    // await sellReturnUpload.save();

    // const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // if (sellReturnUpload.updatedBy.toString() === req.userData.userId || 
    //     roleDetails.approve === false || 
    //     sellReturnUpload.status.trim().toUpperCase() === 'APPROVED' || 
    //     sellReturnUpload.status.trim().toUpperCase() === 'INACTIVE') 
    // {
    //   if (roleDetails.update) {
    //     action.update = true;
    //   }
    //   if (roleDetails.delete) {
    //     action.delete = true;
    //   }
    // } else if (roleDetails.approve === true) {
    //   action.approve = true;
    // }

    // const masterData = await SellReturnUpload.getMasterData(sellReturnUpload);

    // if (masterData instanceof Error) {
    //   throw masterData;
    // }
  
    return res.status(200).json({ action, sellReturnUpload });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Sell Return Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Return Upload failed!";
    next(error, req, res);
  }
};

exports.getSellReturnUploadDetails = async (req, res, next) => {
  try {
    
    const sellReturnUploadDetails = await SellReturnUploadDetail.find({ sellReturnUpload: req.params.id });

    if (!sellReturnUploadDetails) {
      return res.status(404).json({ message: "Sell Return Upload Details not found!" });
    }

    return res.status(200).json({ sellReturnUploadDetails });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching SellReturnUploads failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Return Uploads failed!";
    next(error, req, res);
  }
};

exports.approveSellReturnUpload = async (req, res, next) => {
  let session;

  try {
    let sellReturnUpload = await SellReturnUpload.findById(req.params.id);

    if (!sellReturnUpload) {
      return res.status(404).json({
        message: "Sell Return Upload not found!"
      });
    }

    if (sellReturnUpload.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't approve this Sell Return Upload.`, 
        error : { 
          errors : { 
            sellReturnUploadDate: { message: `You can't approve this Sell Return Upload.` } 
          } 
        }
      });
    }

    if (sellReturnUpload.status.trim().toUpperCase() !== 'PENDING FOR APPROVAL') {
      return res.status(422).json({ 
        message: `Sell Return Upload status should be pending for approval.`, 
        error : { 
          errors : { 
            sellReturnUpload: { message: `Sell Return Upload status should be pending for approval.` } 
          } 
        }
      });
    }

    let error = sellReturnUpload.approve(req);
    if (error) {
      throw error;
    }

    // console.log(error);
    // sellReturnUpload.approvedBy = req.userData.userId;
    // sellReturnUpload.approvedAt = new Date().toISOString();

    // const error = await sellReturnUpload.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
      session = await connection.startSession();
      session.startTransaction();
      let message = '';

      if (!sellReturnUpload.refId) {
        await sellReturnUpload.save({ session });
        
        const sellReturnUploadDetails = await SellReturnUploadDetail.find({ sellReturnUpload: sellReturnUpload._id }).lean();

        for (const sellReturnUploadDetail of sellReturnUploadDetails) {
          const sellReturn = new SellReturn(sellReturnUploadDetail);

          message = await Stock.checkStock('Sell Return', sellReturn);
          if (message instanceof Error) throw message;
          if (message) {
            throw message;
            // return res.status(422).json({
            //   message: message,
            //   error: {
            //     errors: {
            //       sellReturnDate: { message: message }
            //     }
            //   }
            // });
          }
          
          error = sellReturn.approve(req);
          if (error) {
            throw error;
          }

          // error = await sellReturn.setSellAmountDetails();
          // // console.log(error);
          // if (error) {
          //   throw error;
          // }
          
          if (!sellReturn.sellReturnNo) {
            const series = await Series.getSeries(req, 'Sell Return');
            sellReturn.getSellReturnNo(series.count);
            // await series.save({ session });
            await series.save();
          }

          // sellReturn.remarks = `Sell Return Upload entry ${sellReturnUpload._id} changed. ${sellReturn.remarks}`;
          
          // console.log(sellReturn);

          await sellReturn.save({ session });

          await Stock.deleteMany({ stockType: 'Sell Return', sellReturn: sellReturn._id.toString() }, { session });
          error = await Stock.setStockDetails('Sell Return', sellReturn, session, req);
          if (error) throw error;
          
          error = await Product.setStock('Sell Return', sellReturn, session);
          if (error instanceof Error) throw error;

          // await sellReturnUploadDetail.deleteOne({ session });

          // -------------- Setting Sample For Expired Stock Start ------------------
          if (sellReturn.isExpired) {
            const sampleUpdatedObj = sellReturn.getSampleDetails();
            // console.log(sampleUpdatedObj);
            const sample = await Sample.findOneAndUpdate(
              { sellReturn: sellReturn._id }, 
              sampleUpdatedObj, 
              { session : session, upsert: true, new: true }
            );
            // console.log('Sample - ' + sample);

            message = await Stock.checkStock('Expired', sample);
            if (message instanceof Error) throw message;
            if (message) {
              throw message;
              // return res.status(422).json({
              //   message: message,
              //   error: {
              //     errors: {
              //       sellReturnDate: { message: message }
              //     }
              //   }
              // });
            }
            
            error = sample.approve(req);
            if (error) {
              throw error;
            }

            error = await sample.setSampleAmountDetails();
            // console.log(error);
            if (error) {
              throw error;
            }
            
            if (!sample.sampleNo) {
              const series = await Series.getSeries(req, 'Sample');
              sample.getSampleNo(series.count);
              // await series.save({ session });
              await series.save();
            }

            sample.remarks = `Sell Return entry ${sellReturn._id} changed. ${sample.remarks}`;
            
            // console.log(sample);

            await sample.save({ session });

            await Stock.deleteMany({ stockType: 'Expired', sample: sample._id.toString() }, { session });
            error = await Stock.setStockDetails('Expired', sample, session, req);
            if (error) throw error;
          
            error = await Product.setStock('Expired', sample, session);
            if (error instanceof Error) throw error;
          }
          // -------------- Setting Sample For Expired Stock End ------------------
        }

        await SellReturnUploadDetail.deleteMany({ sellReturnUpload: sellReturnUpload._id }, { session });
      } else {
        const obj = JSON.parse(JSON.stringify(sellReturnUpload));
        delete obj._id;
        obj.refId = null;
        
        const refId = sellReturnUpload.refId;

        await sellReturnUpload.deleteOne({ session });

        sellReturnUpload = await SellReturnUpload.findByIdAndUpdate(refId, obj, { session : session, new: true });

        await SellReturn.updateMany({ sellReturnUpload: sellReturnUpload._id }, 
                              { "$set": 
                                { 
                                  status: sellReturnUpload.status, 
                                  updatedBy: sellReturnUpload.updatedBy, 
                                  approvedBy: sellReturnUpload.approvedBy, 
                                  approvedAt: sellReturnUpload.approvedAt, 
                                  remarks: `Sell Return Upload entry ${sellReturnUpload._id} changed. `
                                }
                              }, { session: session });

        const sellReturns = await SellReturn.find({ sellReturnUpload: sellReturnUpload._id }).lean();

        for (const sellReturn of sellReturns) {
          message = await Stock.checkStock('Sell Return', sellReturn);
          if (message instanceof Error) throw message;
          if (message) {
            throw message;
            // return res.status(422).json({
            //   message: message,
            //   error: {
            //     errors: {
            //       sellReturnDate: { message: message }
            //     }
            //   }
            // });
          }

          const sample = await Sample.findOne({ sellReturn: sellReturn._id });
          if (sample) {
            sample.status = 'InActive';
            sample.updatedBy = req.userData.userId;
            sample.approvedBy = req.userData.userId;
            sample.remarks = `Sell Return entry ${sellReturn._id} changed. ${sample.remarks}`;
            await sample.save({ session });

            await Stock.deleteMany({ stockType: 'Expired', sample: sample._id.toString() }, { session });
            error = await Stock.setStockDetails('Expired', sample, session, req);
            if (error) throw error;
          
            error = await Product.setStock('Expired', sample, session);
            if (error instanceof Error) throw error;
          }

          await Stock.deleteMany({ stockType: 'Sell Return', sellReturn: sellReturn._id.toString() }, { session });
          error = await Stock.setStockDetails('Sell Return', sellReturn, session, req);
          if (error) throw error;
          
          error = await Product.setStock('Sell Return', sellReturn, session);
          if (error instanceof Error) throw error;
        }

        // console.log(sellReturnUpload);
      }

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
    //   message: "Approving Sell Return Upload failed! Error - " + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Sale Return Upload failed!";
    next(error, req, res);
  }
};

exports.rejectSellReturnUpload = async (req, res, next) => {
  let session;

  try {
    let sellReturnUpload = await SellReturnUpload.findById(req.params.id);

    if (!sellReturnUpload) {
      return res.status(404).json({
        message: "Sell Return Upload not found!"
      });
    }

    if (sellReturnUpload.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't reject this Sell Return Upload.`, 
        error : { 
          errors : { 
            sellReturnUploadDate: { message: `You can't reject this Sell Return Upload.` } 
          } 
        }
      });
    }

    if (sellReturnUpload.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Sell Return Upload already approved.`, 
        error : { 
          errors : { 
            sellReturnUploadDate: { message: `Sell Return Upload already approved.` } 
          } 
        }
      });
    }

    const error = sellReturnUpload.reject(req);
    if (error) {
      throw error;
    } else {
      session = await connection.startSession();
      session.startTransaction();

      // console.log(sellReturnUpload);

      await SellReturnUploadDetail.deleteMany({ sellReturnUpload: sellReturnUpload._id }, { session });

      await sellReturnUpload.save({ session });

      await session.commitTransaction();
      
      res.status(200).json({ message: "Reject successful!" });
    }
  } catch (error) {
    // console.log(error);

    if (session) {
      await session.abortTransaction();
    }

    // res.status(500).json({
    //   message: "Rejecting Sell Return Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Sale Return Upload failed!";
    next(error, req, res);
  }
};

exports.getSellReturnUploads = async (req, res, next) => {
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
    const data = await SellReturnUpload.aggregate().sortByCount("status");
    // console.log(data);
    for (const item of data) {
      if (item._id === "Uploading" || item._id === "Failed" || item._id === "Pending for approval") {
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
      if (status.trim().toUpperCase() === 'PENDING') {
        cond = { status: { $in : ['Uploading', 'Failed', 'Pending for approval'] } };
      } else {
        cond = { status: status };
      }
    }

    const sellReturnUploads = await SellReturnUpload.find(cond).sort('-updatedAt')
                              // .populate('distributor depot')
                              .skip(pageSize * (currentPage - 1))
                              .limit(pageSize)
                              .sort({ updatedAt: -1 })
                              .lean();

    res.status(200).json({
      message: "Sell Return Uploads fetched successfully!",
      statusCount: statusCount,
      maxSellReturnUploads: totalCount,
      sellReturnUploads: sellReturnUploads
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching SellReturnUploads failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Return Uploads failed!";
    next(error, req, res);
  }
};

exports.deleteSellReturnUpload = async (req, res, next) => {
  try {
    let sellReturnUpload = await SellReturnUpload.findById(req.params.id);

    if (!sellReturnUpload) {
      return res.status(404).json({
        message: "Sell Return Upload not found!"
      });
    }

    // console.log(sellReturnUpload);

    // sellReturnUpload.getRequestData();
    // const error = await sellReturnUpload.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }
    
    if (sellReturnUpload.status.trim().toUpperCase() === 'APPROVED') {
      const refSellReturnUpload = await SellReturnUpload.findOne({ refId: req.params.id });
      
      if (refSellReturnUpload) {
        // console.log('refSellReturnUpload');
        refSellReturnUpload.status = 'Pending for approval';
        refSellReturnUpload.isDeleted = true;
        refSellReturnUpload.remarks = req.body.remarks;
        refSellReturnUpload.refId = req.params.id;
        refSellReturnUpload.updatedBy = req.userData.userId;

        // console.log(refSellReturnUpload);
        await refSellReturnUpload.save();
      } else {
        const obj = JSON.parse(JSON.stringify(sellReturnUpload));
        delete obj._id;
        
        const newSellReturnUpload = new SellReturnUpload({
          ...obj
        });

        newSellReturnUpload.status = 'Pending for approval';
        newSellReturnUpload.isDeleted = true;
        newSellReturnUpload.remarks = req.body.remarks;
        newSellReturnUpload.refId = req.params.id;
        newSellReturnUpload.updatedBy = req.userData.userId;

        await newSellReturnUpload.save();
      }
    } else {
      session = await connection.startSession();
      session.startTransaction();

      // console.log(sellReturnUpload);

      await SellReturnUploadDetail.deleteMany({ sellReturnUpload: sellReturnUpload._id }, { session });

      await sellReturnUpload.deleteOne({ session });

      await session.commitTransaction();
    }

    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // console.log(error);

    if (session) {
      await session.abortTransaction();
    }

    // res.status(500).json({
    //   message: "Deleting Sell Return Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting Sale Return Upload failed!";
    next(error, req, res);
  }
};