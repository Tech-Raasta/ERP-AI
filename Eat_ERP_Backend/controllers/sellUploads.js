const { connection } = require("mongoose");
const SellUpload = require("../models/sellUpload");
const SellUploadDetail = require("../models/sellUploadDetail");
const Sell = require("../models/sell");
const Series = require("../models/series");
const Stock = require("../models/stock");
const Product = require("../models/product");

exports.createSellUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ message: "Please upload an Excel file." });
    }

    // console.log(req.file);

    const sellUpload = new SellUpload({
      status: 'Uploading',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    sellUpload.getRequestData(req);

    // console.log(sellUpload);

    const error = await sellUpload.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await sellUpload.save();

    res.status(201).json({
      message: "Sell Upload added successfully",
      sellUpload: sellUpload
    });

    // console.log('Uploading File data.');
    await sellUpload.uploadFileData(req);

    await sellUpload.save();
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a Sell Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Creating a Sale Upload failed!";
    next(error, req, res);
  }
};

exports.getSellUploadFormat = async (req, res, next) => {
  try {
    const fileUrl = await SellUpload.getUploadFormat();

    // const fileName = `Sells_upload_format_${Date.now()}.xlsx`;
    // const workbook = await SellUpload.getUploadFormat();
    // if (workbook instanceof Error) {
    //   throw workbook;
    // }
    // res.setHeader(
    //   "Content-Type",
    //   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    // );
    // res.setHeader(
    //   "Content-Disposition",
    //   "attachment; filename=" + fileName
    // );
    // return workbook.xlsx.write(res).then(function () {
    //   res.status(200).end();
    // });
  
    return res.status(200).json({ fileUrl });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Sell Upload Format failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Upload Format failed!";
    next(error, req, res);
  }
};

exports.getSellUpload = async (req, res, next) => {
  try {
    const sellUpload = await SellUpload.findById(req.params.id);
    if (!sellUpload) {
      return res.status(404).json({ message: "Sell Upload not found!" });
    }

    // await sellUpload.uploadFileData(req);

    // await sellUpload.save();

    // await SellUpload.getUploadFormat();

    // const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // if (sellUpload.updatedBy.toString() === req.userData.userId || 
    //     roleDetails.approve === false || 
    //     sellUpload.status.trim().toUpperCase() === 'APPROVED' || 
    //     sellUpload.status.trim().toUpperCase() === 'INACTIVE') 
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

    // const masterData = await SellUpload.getMasterData(sellUpload);

    // if (masterData instanceof Error) {
    //   throw masterData;
    // }
  
    return res.status(200).json({ action, sellUpload });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Sell Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Upload failed!";
    next(error, req, res);
  }
};

exports.getSellUploadDetails = async (req, res, next) => {
  try {
    
    const sellUploadDetails = await SellUploadDetail.find({ sellUpload: req.params.id });

    if (!sellUploadDetails) {
      return res.status(404).json({ message: "Sell Upload Details not found!" });
    }

    return res.status(200).json({ sellUploadDetails });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching SellUploads failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Uploads failed!";
    next(error, req, res);
  }
};

exports.approveSellUpload = async (req, res, next) => {
  let session;

  try {
    let sellUpload = await SellUpload.findById(req.params.id);

    if (!sellUpload) {
      return res.status(404).json({
        message: "Sell Upload not found!"
      });
    }

    if (sellUpload.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't approve this Sell Upload.`, 
        error : { 
          errors : { 
            sellUploadDate: { message: `You can't approve this Sell Upload.` } 
          } 
        }
      });
    }

    if (sellUpload.status.trim().toUpperCase() !== 'PENDING FOR APPROVAL') {
      return res.status(422).json({ 
        message: `Sell Upload status should be pending for approval.`, 
        error : { 
          errors : { 
            sellUpload: { message: `Sell Upload status should be pending for approval.` } 
          } 
        }
      });
    }

    let error = sellUpload.approve(req);
    if (error) {
      throw error;
    }

    // console.log(error);
    // sellUpload.approvedBy = req.userData.userId;
    // sellUpload.approvedAt = new Date().toISOString();

    // const error = await sellUpload.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
      session = await connection.startSession();
      session.startTransaction();

      if (!sellUpload.refId) {
        await sellUpload.save({ session });
        
        const sellUploadDetails = await SellUploadDetail.find({ sellUpload: sellUpload._id }).lean();

        for (const sellUploadDetail of sellUploadDetails) {
          const sell = new Sell(sellUploadDetail);
          
          const message = await Stock.checkStock('Sell', sell);
          if (message instanceof Error) throw message;
          if (message) {
            if (session) {
              await session.abortTransaction();
            }
            return res.status(422).json({ 
              message: message, 
              error : { 
                errors : { 
                  sellUpload: { message: message } 
                } 
              }
            });
          }
            
          error = sell.approve(req);
          if (error) {
            throw error;
          }

          // error = await sell.setSellAmountDetails();
          // // console.log(error);
          // if (error) {
          //   throw error;
          // }
          
          if (!sell.invoiceNo) {
            sell.invoiceDate = sell.sellDate;
            const series = await Series.getSeries(req, 'Sell');
            sell.getInvoiceNo(series.count);
            // await series.save({ session });
            await series.save();
          }

          // sell.remarks = `Sell Upload entry ${sellUpload._id} changed. ${sell.remarks}`;
          
          // console.log(sell);

          await sell.save({ session });

          await Stock.deleteMany({ stockType: 'Sell', sell: sell._id.toString() }, { session });
          error = await Stock.setStockDetails('Sell', sell, session, req);
          if (error) throw error;
          
          error = await Product.setStock('Sell', sell, session);
          if (error instanceof Error) throw error;

          // await sellUploadDetail.deleteOne({ session });
        }

        await SellUploadDetail.deleteMany({ sellUpload: sellUpload._id }, { session });
      } else {
        const obj = JSON.parse(JSON.stringify(sellUpload));
        delete obj._id;
        obj.refId = null;
        
        const refId = sellUpload.refId;

        await sellUpload.deleteOne({session });

        sellUpload = await SellUpload.findByIdAndUpdate(refId, obj, { session : session, new: true });

        await Sell.updateMany({ sellUpload: sellUpload._id }, 
                              { "$set": 
                                { 
                                  status: sellUpload.status, 
                                  updatedBy: sellUpload.updatedBy, 
                                  approvedBy: sellUpload.approvedBy, 
                                  approvedAt: sellUpload.approvedAt, 
                                  remarks: `Sell Upload entry ${sellUpload._id} changed. `
                                }
                              }, { session: session });

        const sells = await Sell.find({ sellUpload: sellUpload._id }).lean();

        for (const sell of sells) {
          await Stock.deleteMany({ stockType: 'Sell', sell: sell._id.toString() }, { session });
          error = await Stock.setStockDetails('Sell', sell, session, req);
          if (error) throw error;
          
          error = await Product.setStock('Sell', sell, session);
          if (error instanceof Error) throw error;
        }

        // console.log(sellUpload);

        // originalSellUpload = await SellUpload.findById(sellUpload.refId);
        // originalSellUpload.overwrite(sellUpload);
        // originalSellUpload.refId = null;
        // await originalSellUpload.save({ session });
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
    //   message: "Approving Sell Upload failed! Error - " + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Sale Upload failed!";
    next(error, req, res);
  }
};

exports.rejectSellUpload = async (req, res, next) => {
  let session;

  try {
    let sellUpload = await SellUpload.findById(req.params.id);

    if (!sellUpload) {
      return res.status(404).json({
        message: "Sell Upload not found!"
      });
    }

    if (sellUpload.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't reject this Sell Upload.`, 
        error : { 
          errors : { 
            sellUploadDate: { message: `You can't reject this Sell Upload.` } 
          } 
        }
      });
    }

    if (sellUpload.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Sell Upload already approved.`, 
        error : { 
          errors : { 
            sellUploadDate: { message: `Sell Upload already approved.` } 
          } 
        }
      });
    }

    const error = sellUpload.reject(req);
    if (error) {
      throw error;
    } else {
      session = await connection.startSession();
      session.startTransaction();

      // console.log(sellUpload);

      await SellUploadDetail.deleteMany({ sellUpload: sellUpload._id }, { session });

      await sellUpload.save({ session });

      await session.commitTransaction();
      
      res.status(200).json({ message: "Reject successful!" });
    }
  } catch (error) {
    // console.log(error);

    if (session) {
      await session.abortTransaction();
    }

    // res.status(500).json({
    //   message: "Rejecting Sell Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Sale Upload failed!";
    next(error, req, res);
  }
};

exports.getSellUploads = async (req, res, next) => {
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
    const data = await SellUpload.aggregate().sortByCount("status");
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

    const sellUploads = await SellUpload.find(cond).sort('-updatedAt')
                              // .populate('distributor depot')
                              .skip(pageSize * (currentPage - 1))
                              .limit(pageSize)
                              .lean();

    res.status(200).json({
      message: "Sell Uploads fetched successfully!",
      statusCount: statusCount,
      maxSellUploads: totalCount,
      sellUploads: sellUploads
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching SellUploads failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Uploads failed!";
    next(error, req, res);
  }
};

exports.deleteSellUpload = async (req, res, next) => {
  try {
    let sellUpload = await SellUpload.findById(req.params.id);

    if (!sellUpload) {
      return res.status(404).json({
        message: "Sell Upload not found!"
      });
    }

    // console.log(sellUpload);

    // sellUpload.getRequestData();
    // const error = await sellUpload.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }
    
    if (sellUpload.status.trim().toUpperCase() === 'APPROVED') {
      const refSellUpload = await SellUpload.findOne({ refId: req.params.id });
      
      if (refSellUpload) {
        // console.log('refSellUpload');
        refSellUpload.status = 'Pending for approval';
        refSellUpload.isDeleted = true;
        refSellUpload.remarks = req.body.remarks;
        refSellUpload.refId = req.params.id;
        refSellUpload.updatedBy = req.userData.userId;

        // console.log(refSellUpload);
        await refSellUpload.save();
      } else {
        const obj = JSON.parse(JSON.stringify(sellUpload));
        delete obj._id;
        
        const newSellUpload = new SellUpload({
          ...obj
        });

        newSellUpload.status = 'Pending for approval';
        newSellUpload.isDeleted = true;
        newSellUpload.remarks = req.body.remarks;
        newSellUpload.refId = req.params.id;
        newSellUpload.updatedBy = req.userData.userId;

        await newSellUpload.save();
      }
    } else {
      session = await connection.startSession();
      session.startTransaction();

      // console.log(sellUpload);

      await SellUploadDetail.deleteMany({ sellUpload: sellUpload._id }, { session });

      await sellUpload.deleteOne({ session });

      await session.commitTransaction();
    }

    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // console.log(error);

    if (session) {
      await session.abortTransaction();
    }

    // res.status(500).json({
    //   message: "Deleting Sell Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting Sale Upload failed!";
    next(error, req, res);
  }
};

exports.getS3SignedUploadUrl = async (req, res, next) => {
  try {
    const url = await SellUpload.getS3SignedUploadUrl();

    res.send(url);
  } catch (error) {
    // res.send(error);
    // res.status(500).json({
    //   message: "Fetching S3 Signed URL failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching S3 Signed URL failed!";
    next(error, req, res);
  }
}

// exports.updateSellUpload = async (req, res, next) => {
//   try {
//     let sellUpload = await SellUpload.findById(req.params.id);

//     if (!sellUpload) {
//       return res.status(404).json({
//         message: "Sell Upload not found!"
//       });
//     }

//     if (sellUpload.status.trim().toUpperCase() === 'APPROVED') {
//       const refSellUpload = await SellUpload.findOne({ refId: req.params.id });

//       if (refSellUpload) {
//         sellUpload = refSellUpload;
//       } else {
//         const obj = JSON.parse(JSON.stringify(sellUpload));
//         delete obj._id;
        
//         sellUpload = new SellUpload({
//           // status: 'Pending',
//           // refId: req.params.id,
//           // updatedBy: req.userData.userId,
//           ...obj
//         });
//       }
      
//       sellUpload.status = 'Pending';
//       sellUpload.refId = req.params.id;
//       sellUpload.updatedBy = req.userData.userId;
//     } else if (sellUpload.status.trim().toUpperCase() === 'REJECTED') {
//       sellUpload.status = 'Pending';
//     }

//     await sellUpload.getRequestData(req);

//     const error = await sellUpload.validateData();
//     if (error) {
//       return res.status(422).json({
//         message: "Invalid inputs passed, please check your data.",
//         error: error
//       });
//     }

//     await sellUpload.save();
//     res.status(200).json({ message: "Update successful!" });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({
//       message: "Udpating Sell Upload Failed!"
//     });
//   }
// };

// exports.getSellUpload = async (req, res, next) => {
//   try {
//     const sellUpload = await SellUpload.findById(req.params.id);
//     if (!sellUpload) {
//       return res.status(404).json({ message: "Sell Upload not found!" });
//     }

//     const roleDetails = req.userData.roleDetails;

//     // console.log(roleDetails);

//     const action = {
//       update: false,
//       delete: false,
//       approve: false
//     };

//     if (sellUpload.updatedBy.toString() === req.userData.userId || 
//         roleDetails.approve === false || 
//         sellUpload.status.trim().toUpperCase() === 'APPROVED' || 
//         sellUpload.status.trim().toUpperCase() === 'INACTIVE') 
//     {
//       if (roleDetails.update) {
//         action.update = true;
//       }
//       if (roleDetails.delete) {
//         action.delete = true;
//       }
//     } else if (roleDetails.approve === true) {
//       action.approve = true;
//     }

//     const masterData = await SellUpload.getMasterData(sellUpload);

//     if (masterData instanceof Error) {
//       throw masterData;
//     }
  
//     return res.status(200).json({ action, sellUpload, masterData });
//   } catch (error) {
//     res.status(500).json({
//       message: "Fetching Sell Upload failed!"
//     });
//   }
// };