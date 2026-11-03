// const { connection } = require("mongoose");
const SellDeliveryUpload = require("../models/sellDeliveryUpload");

exports.createSellDeliveryUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ message: "Please upload an Excel file." });
    }

    const sellDeliveryUpload = new SellDeliveryUpload({
      status: 'Uploading',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    sellDeliveryUpload.getRequestData(req);

    const error = await sellDeliveryUpload.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await sellDeliveryUpload.save();

    res.status(201).json({
      message: "Sales Delivery Upload added successfully",
      sellDeliveryUpload: sellDeliveryUpload
    });

    await sellDeliveryUpload.uploadFileData(req);

    await sellDeliveryUpload.save();
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a Sales Delivery Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Creating a Sales Delivery Upload failed!";
    next(error, req, res);
  }
};

exports.getSellDeliveryUploadFormat = async (req, res, next) => {
  try {
    const fileUrl = await SellDeliveryUpload.getUploadFormat();

    return res.status(200).json({ fileUrl });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Sales Delivery Upload Format failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sales Delivery Upload Format failed!";
    next(error, req, res);
  }
};

exports.getSellDeliveryUpload = async (req, res, next) => {
  try {
    const sellDeliveryUpload = await SellDeliveryUpload.findById(req.params.id);
    if (!sellDeliveryUpload) {
      return res.status(404).json({ message: "Sales Delivery Upload not found!" });
    }

    // await sellDeliveryUpload.uploadFileData(req);
    // await sellDeliveryUpload.save();

    // const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // if (sellDeliveryUpload.updatedBy.toString() === req.userData.userId || 
    //     roleDetails.approve === false || 
    //     sellDeliveryUpload.status.trim().toUpperCase() === 'APPROVED' || 
    //     sellDeliveryUpload.status.trim().toUpperCase() === 'INACTIVE') 
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

    // const masterData = await SellDeliveryUpload.getMasterData(sellDeliveryUpload);

    // if (masterData instanceof Error) {
    //   throw masterData;
    // }
  
    return res.status(200).json({ action, sellDeliveryUpload });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Sales Delivery Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sales Delivery Upload failed!";
    next(error, req, res);
  }
};

// exports.getSellDeliveryUploadDetails = async (req, res, next) => {
//   try {
    
//     const sellDeliveryUploadDetails = await SellDeliveryUploadDetail.find({ sellDeliveryUpload: req.params.id });

//     if (!sellDeliveryUploadDetails) {
//       return res.status(404).json({ message: "Sales Delivery Upload Details not found!" });
//     }

//     return res.status(200).json({ sellDeliveryUploadDetails });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({
//       message: "Fetching SellDeliveryUploads failed!"
//     });
//   }
// };

// exports.approveSellDeliveryUpload = async (req, res, next) => {
//   let session;

//   try {
//     let sellDeliveryUpload = await SellDeliveryUpload.findById(req.params.id);

//     if (!sellDeliveryUpload) {
//       return res.status(404).json({
//         message: "Sales Delivery Upload not found!"
//       });
//     }

//     if (sellDeliveryUpload.updatedBy.toString() === req.userData.userId) {
//       return res.status(422).json({ 
//         message: `You can't approve this Sales Delivery Upload.`, 
//         error : { 
//           errors : { 
//             sellDeliveryUploadDate: { message: `You can't approve this Sales Delivery Upload.` } 
//           } 
//         }
//       });
//     }

//     if (sellDeliveryUpload.status.trim().toUpperCase() !== 'PENDING FOR APPROVAL') {
//       return res.status(422).json({ 
//         message: `Sales Delivery Upload status should be pending for approval.`, 
//         error : { 
//           errors : { 
//             sellDeliveryUpload: { message: `Sales Delivery Upload status should be pending for approval.` } 
//           } 
//         }
//       });
//     }

//     let error = sellDeliveryUpload.approve(req);
//     if (error) {
//       throw error;
//     }

//     // console.log(error);
//     // sellDeliveryUpload.approvedBy = req.userData.userId;
//     // sellDeliveryUpload.approvedAt = new Date().toISOString();

//     // const error = await sellDeliveryUpload.validateData();
//     // if (error) {
//     //   return res.status(422).json({
//     //     message: "Invalid inputs passed, please check your data.",
//     //     error: error
//     //   });
//     // }

//     // try {
//       session = await connection.startSession();
//       session.startTransaction();
//       let message = '';

//       if (!sellDeliveryUpload.refId) {
//         await sellDeliveryUpload.save({ session });
        
//         const sellDeliveryUploadDetails = await SellDeliveryUploadDetail.find({ sellDeliveryUpload: sellDeliveryUpload._id }).lean();

//         for (const sellDeliveryUploadDetail of sellDeliveryUploadDetails) {
//           const sellReturn = new SellReturn(sellDeliveryUploadDetail);

//           message = await Stock.checkStock('Sales Delivery', sellReturn);
//           if (message instanceof Error) throw message;
//           if (message) {
//             throw message;
//             // return res.status(422).json({
//             //   message: message,
//             //   error: {
//             //     errors: {
//             //       sellReturnDate: { message: message }
//             //     }
//             //   }
//             // });
//           }
          
//           error = sellReturn.approve(req);
//           if (error) {
//             throw error;
//           }

//           // error = await sellReturn.setSellAmountDetails();
//           // // console.log(error);
//           // if (error) {
//           //   throw error;
//           // }
          
//           if (!sellReturn.sellReturnNo) {
//             const series = await Series.getSeries(req, 'Sales Delivery');
//             sellReturn.getSellReturnNo(series.count);
//             await series.save({ session });
//           }

//           // sellReturn.remarks = `Sales Delivery Upload entry ${sellDeliveryUpload._id} changed. ${sellReturn.remarks}`;
          
//           // console.log(sellReturn);

//           await sellReturn.save({ session });

//           await Stock.deleteMany({ stockType: 'Sales Delivery', sellReturn: sellReturn._id.toString() }, { session });
//           error = await Stock.setStockDetails('Sales Delivery', sellReturn, session, req);
//           if (error) throw error;

//           // await sellDeliveryUploadDetail.deleteOne({ session });

//           // -------------- Setting Sample For Expired Stock Start ------------------
//           if (sellReturn.isExpired) {
//             const sampleUpdatedObj = sellReturn.getSampleDetails();
//             // console.log(sampleUpdatedObj);
//             const sample = await Sample.findOneAndUpdate(
//               { sellReturn: sellReturn._id }, 
//               sampleUpdatedObj, 
//               { session : session, upsert: true, new: true }
//             );
//             // console.log('Sample - ' + sample);

//             message = await Stock.checkStock('Expired', sample);
//             if (message instanceof Error) throw message;
//             if (message) {
//               throw message;
//               // return res.status(422).json({
//               //   message: message,
//               //   error: {
//               //     errors: {
//               //       sellReturnDate: { message: message }
//               //     }
//               //   }
//               // });
//             }
            
//             error = sample.approve(req);
//             if (error) {
//               throw error;
//             }

//             error = await sample.setSampleAmountDetails();
//             // console.log(error);
//             if (error) {
//               throw error;
//             }
            
//             if (!sample.sampleNo) {
//               const series = await Series.getSeries(req, 'Sample');
//               sample.getSampleNo(series.count);
//               await series.save({ session });
//             }

//             sample.remarks = `Sales Delivery entry ${sellReturn._id} changed. ${sample.remarks}`;
            
//             // console.log(sample);

//             await sample.save({ session });

//             await Stock.deleteMany({ stockType: 'Expired', sample: sample._id.toString() }, { session });
//             error = await Stock.setStockDetails('Expired', sample, session, req);
//             if (error) throw error;
//           }
//           // -------------- Setting Sample For Expired Stock End ------------------
//         }

//         await SellDeliveryUploadDetail.deleteMany({ sellDeliveryUpload: sellDeliveryUpload._id }, { session });
//       } else {
//         const obj = JSON.parse(JSON.stringify(sellDeliveryUpload));
//         delete obj._id;
//         obj.refId = null;
        
//         const refId = sellDeliveryUpload.refId;

//         await sellDeliveryUpload.deleteOne({ session });

//         sellDeliveryUpload = await SellDeliveryUpload.findByIdAndUpdate(refId, obj, { session : session, new: true });

//         await SellReturn.updateMany({ sellDeliveryUpload: sellDeliveryUpload._id }, 
//                               { "$set": 
//                                 { 
//                                   status: sellDeliveryUpload.status, 
//                                   updatedBy: sellDeliveryUpload.updatedBy, 
//                                   approvedBy: sellDeliveryUpload.approvedBy, 
//                                   approvedAt: sellDeliveryUpload.approvedAt, 
//                                   remarks: `Sales Delivery Upload entry ${sellDeliveryUpload._id} changed. `
//                                 }
//                               }, { session: session });

//         const sellReturns = await SellReturn.find({ sellDeliveryUpload: sellDeliveryUpload._id }).lean();

//         for (const sellReturn of sellReturns) {
//           message = await Stock.checkStock('Sales Delivery', sellReturn);
//           if (message instanceof Error) throw message;
//           if (message) {
//             throw message;
//             // return res.status(422).json({
//             //   message: message,
//             //   error: {
//             //     errors: {
//             //       sellReturnDate: { message: message }
//             //     }
//             //   }
//             // });
//           }

//           const sample = await Sample.findOne({ sellReturn: sellReturn._id });
//           if (sample) {
//             sample.status = 'InActive';
//             sample.updatedBy = req.userData.userId;
//             sample.approvedBy = req.userData.userId;
//             sample.remarks = `Sales Delivery entry ${sellReturn._id} changed. ${sample.remarks}`;
//             await sample.save({ session });

//             await Stock.deleteMany({ stockType: 'Expired', sample: sample._id.toString() }, { session });
//             error = await Stock.setStockDetails('Expired', sample, session, req);
//             if (error) throw error;
//           }

//           await Stock.deleteMany({ stockType: 'Sales Delivery', sellReturn: sellReturn._id.toString() }, { session });
//           error = await Stock.setStockDetails('Sales Delivery', sellReturn, session, req);
//           if (error) throw error;
//         }

//         // console.log(sellDeliveryUpload);
//       }

//       await session.commitTransaction();
         
//     // } catch (error) { 
//     //     await session.abortTransaction();
//     // }
    
//     res.status(200).json({ message: "Approve successful!" });
//   } catch (error) {
//     console.log(error);

//     if (session) {
//       await session.abortTransaction();
//     }

//     res.status(500).json({
//       message: "Approving Sales Delivery Upload failed! Error - " + (error.message ? error.message : '')
//     });
//   }
// };

// exports.rejectSellDeliveryUpload = async (req, res, next) => {
//   let session;

//   try {
//     let sellDeliveryUpload = await SellDeliveryUpload.findById(req.params.id);

//     if (!sellDeliveryUpload) {
//       return res.status(404).json({
//         message: "Sales Delivery Upload not found!"
//       });
//     }

//     if (sellDeliveryUpload.updatedBy.toString() === req.userData.userId) {
//       return res.status(422).json({ 
//         message: `You can't reject this Sales Delivery Upload.`, 
//         error : { 
//           errors : { 
//             sellDeliveryUploadDate: { message: `You can't reject this Sales Delivery Upload.` } 
//           } 
//         }
//       });
//     }

//     if (sellDeliveryUpload.status.trim().toUpperCase() === 'APPROVED') {
//       return res.status(422).json({ 
//         message: `Sales Delivery Upload already approved.`, 
//         error : { 
//           errors : { 
//             sellDeliveryUploadDate: { message: `Sales Delivery Upload already approved.` } 
//           } 
//         }
//       });
//     }

//     const error = sellDeliveryUpload.reject(req);
//     if (error) {
//       throw error;
//     } else {
//       session = await connection.startSession();
//       session.startTransaction();

//       // console.log(sellDeliveryUpload);

//       await SellDeliveryUploadDetail.deleteMany({ sellDeliveryUpload: sellDeliveryUpload._id }, { session });

//       await sellDeliveryUpload.save({ session });

//       await session.commitTransaction();
      
//       res.status(200).json({ message: "Reject successful!" });
//     }
//   } catch (error) {
//     console.log(error);

//     if (session) {
//       await session.abortTransaction();
//     }

//     res.status(500).json({
//       message: "Rejecting Sales Delivery Upload failed!"
//     });
//   }
// };

exports.getSellDeliveryUploads = async (req, res, next) => {
  // const status = req.query.status;
  const pageSize = +req.query.pagesize;
  const currentPage = +req.query.page;

  // let totalCount = 0;
  // const statusCount = {
  //   pending: 0,
  //   approved: 0,
  //   rejected: 0,
  //   inActive: 0
  // };

  try {
    // const data = await SellDeliveryUpload.aggregate().sortByCount("status");
    // // console.log(data);
    // for (const item of data) {
    //   if (item._id === "Uploading" || item._id === "Failed" || item._id === "Pending for approval") {
    //     statusCount.pending = statusCount.pending + parseInt(item.count);
    //     totalCount = parseInt(item.count);
    //   }
    //   else if (item._id === "Approved") {
    //     statusCount.approved = statusCount.approved + parseInt(item.count);
    //     totalCount = parseInt(item.count);
    //   }
    //   else if (item._id === "Rejected") {
    //     statusCount.rejected = statusCount.rejected + parseInt(item.count);
    //     totalCount = parseInt(item.count);
    //   }
    //   else if (item._id === "InActive") {
    //     statusCount.inActive = statusCount.inActive + parseInt(item.count);
    //     totalCount = parseInt(item.count);
    //   }
    // }

    let cond = {};
    // if (status) {
    //   if (status.trim().toUpperCase() === 'PENDING') {
    //     cond = { status: { $in : ['Uploading', 'Failed', 'Pending for approval'] } };
    //   } else {
    //     cond = { status: status };
    //   }
    // }

    const totalCount = await SellDeliveryUpload.countDocuments();

    const sellDeliveryUploads = await SellDeliveryUpload.find(cond).sort('-updatedAt')
                              // .populate('distributor depot')
                              .skip(pageSize * (currentPage - 1))
                              .limit(pageSize)
                              .sort({ updatedAt: -1 })
                              .lean();

    res.status(200).json({
      message: "Sales Delivery Uploads fetched successfully!",
      // statusCount: statusCount,
      maxSellDeliveryUploads: totalCount,
      sellDeliveryUploads: sellDeliveryUploads
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching SellDeliveryUploads failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sales Delivery Uploads failed!";
    next(error, req, res);
  }
};

exports.deleteSellDeliveryUpload = async (req, res, next) => {
  try {
    let sellDeliveryUpload = await SellDeliveryUpload.findById(req.params.id);

    if (!sellDeliveryUpload) {
      return res.status(404).json({
        message: "Sales Delivery Upload not found!"
      });
    }

    if (sellDeliveryUpload.status.trim().toUpperCase() !== 'FAILED') {
      return res.status(404).json({
        message: "Sales Delivery Status should be Failed!"
      });
    }

    const error = await sellDeliveryUpload.deleteUploadedFiles();
    if (error instanceof Error) throw error;
    await sellDeliveryUpload.deleteOne();

    // console.log(sellDeliveryUpload);

    // if (sellDeliveryUpload.status.trim().toUpperCase() === 'APPROVED') {
    //   const refSellDeliveryUpload = await SellDeliveryUpload.findOne({ refId: req.params.id });
      
    //   if (refSellDeliveryUpload) {
    //     // console.log('refSellDeliveryUpload');
    //     refSellDeliveryUpload.status = 'Pending for approval';
    //     refSellDeliveryUpload.isDeleted = true;
    //     refSellDeliveryUpload.remarks = req.body.remarks;
    //     refSellDeliveryUpload.refId = req.params.id;
    //     refSellDeliveryUpload.updatedBy = req.userData.userId;

    //     // console.log(refSellDeliveryUpload);
    //     await refSellDeliveryUpload.save();
    //   } else {
    //     const obj = JSON.parse(JSON.stringify(sellDeliveryUpload));
    //     delete obj._id;
        
    //     const newSellDeliveryUpload = new SellDeliveryUpload({
    //       ...obj
    //     });

    //     newSellDeliveryUpload.status = 'Pending for approval';
    //     newSellDeliveryUpload.isDeleted = true;
    //     newSellDeliveryUpload.remarks = req.body.remarks;
    //     newSellDeliveryUpload.refId = req.params.id;
    //     newSellDeliveryUpload.updatedBy = req.userData.userId;

    //     await newSellDeliveryUpload.save();
    //   }
    // } else {
    //   session = await connection.startSession();
    //   session.startTransaction();

    //   // console.log(sellDeliveryUpload);

    //   await SellDeliveryUploadDetail.deleteMany({ sellDeliveryUpload: sellDeliveryUpload._id }, { session });

    //   await sellDeliveryUpload.deleteOne({ session });

    //   await session.commitTransaction();
    // }

    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // console.log(error);

    // if (session) {
    //   await session.abortTransaction();
    // }

    // res.status(500).json({
    //   message: "Deleting Sales Delivery Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting Sales Delivery Upload failed!";
    next(error, req, res);
  }
};