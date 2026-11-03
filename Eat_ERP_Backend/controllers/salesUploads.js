import SalesUpload from "../models/salesUpload.js";
import Sale from "../models/sale.js";
// import sellUploadDetail from "../models/sellUploadDetail.js";
import Series from "../models/series.js";
import Stock from "../models/stock.js";
import Product from "../models/product.js";
// const Sales = require("../models/sell");

export const createSalesUpload = async (req, res, next) => {
  try {
    if (!req.files) {
      return res.status(422).json({ message: "Please upload an Excel file." });
    }

    // console.log(req.file);

    const salesUpload = new SalesUpload({
      status: 'Uploading',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    salesUpload.getRequestData(req);

    console.log(salesUpload);

    const error = await salesUpload.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await salesUpload.save();

    res.status(201).json({
      message: "Sales Upload added successfully",
      salesUpload: salesUpload
    });

    // console.log('Uploading File data.');
    await salesUpload.uploadFileData(req);

    await salesUpload.save();
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a Sales Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Creating a Sale Upload failed!";
    next(error, req, res);
  }
};

export const getSalesUploadFormat = async (req, res, next) => {
  try {
    const fileUrl = await SalesUpload.getUploadFormat();

    // const fileName = `Saless_upload_format_${Date.now()}.xlsx`;
    // const workbook = await SalesUpload.getUploadFormat();
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
    //   message: "Fetching Sales Upload Format failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Upload Format failed!";
    next(error, req, res);
  }
};

export const getSalesUpload = async (req, res, next) => {
  try {
    const salesUpload = await SalesUpload.findById(req.params.id);
    if (!salesUpload) {
      return res.status(404).json({ message: "Sales Upload not found!" });
    }

    // await salesUpload.uploadFileData(req);

    // await salesUpload.save();

    // await SalesUpload.getUploadFormat();

    // const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // if (salesUpload.updatedBy.toString() === req.userData.userId || 
    //     roleDetails.approve === false || 
    //     salesUpload.status.trim().toUpperCase() === 'APPROVED' || 
    //     salesUpload.status.trim().toUpperCase() === 'INACTIVE') 
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

    // const masterData = await SalesUpload.getMasterData(salesUpload);

    // if (masterData instanceof Error) {
    //   throw masterData;
    // }
  
    return res.status(200).json({ action, salesUpload });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Sales Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Upload failed!";
    next(error, req, res);
  }
};

export const getSalesUploadDetails = async (req, res, next) => {
  try {
    
    const salesUploadDetails = await SalesUploadDetail.find({ salesUpload: req.params.id });

    if (!salesUploadDetails) {
      return res.status(404).json({ message: "Sales Upload Details not found!" });
    }

    return res.status(200).json({ salesUploadDetails });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching SalesUploads failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Uploads failed!";
    next(error, req, res);
  }
};

export const approveSalesUpload = async (req, res, next) => {
  let session;

  try {
    let salesUpload = await SalesUpload.findById(req.params.id);

    if (!salesUpload) {
      return res.status(404).json({
        message: "Sales Upload not found!"
      });
    }

    if (salesUpload.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't approve this Sales Upload.`, 
        error : { 
          errors : { 
            salesUploadDate: { message: `You can't approve this Sales Upload.` } 
          } 
        }
      });
    }

    if (salesUpload.status.trim().toUpperCase() !== 'PENDING FOR APPROVAL') {
      return res.status(422).json({ 
        message: `Sales Upload status should be pending for approval.`, 
        error : { 
          errors : { 
            salesUpload: { message: `Sales Upload status should be pending for approval.` } 
          } 
        }
      });
    }

    let error = salesUpload.approve(req);
    if (error) {
      throw error;
    }

    // console.log(error);
    // salesUpload.approvedBy = req.userData.userId;
    // salesUpload.approvedAt = new Date().toISOString();

    // const error = await salesUpload.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
      session = await connection.startSession();
      session.startTransaction();

      if (!salesUpload.refId) {
        await salesUpload.save({ session });
        
        const salesUploadDetails = await SalesUploadDetail.find({ salesUpload: salesUpload._id }).lean();

        for (const salesUploadDetail of salesUploadDetails) {
          const sell = new Sales(salesUploadDetail);
          
          const message = await Stock.checkStock('Sales', sell);
          if (message instanceof Error) throw message;
          if (message) {
            if (session) {
              await session.abortTransaction();
            }
            return res.status(422).json({ 
              message: message, 
              error : { 
                errors : { 
                  salesUpload: { message: message } 
                } 
              }
            });
          }
            
          error = sell.approve(req);
          if (error) {
            throw error;
          }

          // error = await sell.setSalesAmountDetails();
          // // console.log(error);
          // if (error) {
          //   throw error;
          // }
          
          if (!sell.invoiceNo) {
            sell.invoiceDate = sell.sellDate;
            const series = await Series.getSeries(req, 'Sales');
            sell.getInvoiceNo(series.count);
            // await series.save({ session });
            await series.save();
          }

          // sell.remarks = `Sales Upload entry ${salesUpload._id} changed. ${sell.remarks}`;
          
          // console.log(sell);

          await sell.save({ session });

          await Stock.deleteMany({ stockType: 'Sales', sell: sell._id.toString() }, { session });
          error = await Stock.setStockDetails('Sales', sell, session, req);
          if (error) throw error;
          
          error = await Product.setStock('Sales', sell, session);
          if (error instanceof Error) throw error;

          // await salesUploadDetail.deleteOne({ session });
        }

        await SalesUploadDetail.deleteMany({ salesUpload: salesUpload._id }, { session });
      } else {
        const obj = JSON.parse(JSON.stringify(salesUpload));
        delete obj._id;
        obj.refId = null;
        
        const refId = salesUpload.refId;

        await salesUpload.deleteOne({session });

        salesUpload = await SalesUpload.findByIdAndUpdate(refId, obj, { session : session, new: true });

        await Sales.updateMany({ salesUpload: salesUpload._id }, 
                              { "$set": 
                                { 
                                  status: salesUpload.status, 
                                  updatedBy: salesUpload.updatedBy, 
                                  approvedBy: salesUpload.approvedBy, 
                                  approvedAt: salesUpload.approvedAt, 
                                  remarks: `Sales Upload entry ${salesUpload._id} changed. `
                                }
                              }, { session: session });

        const sells = await Sales.find({ salesUpload: salesUpload._id }).lean();

        for (const sell of sells) {
          await Stock.deleteMany({ stockType: 'Sales', sell: sell._id.toString() }, { session });
          error = await Stock.setStockDetails('Sales', sell, session, req);
          if (error) throw error;
          
          error = await Product.setStock('Sales', sell, session);
          if (error instanceof Error) throw error;
        }

        // console.log(salesUpload);

        // originalSalesUpload = await SalesUpload.findById(salesUpload.refId);
        // originalSalesUpload.overwrite(salesUpload);
        // originalSalesUpload.refId = null;
        // await originalSalesUpload.save({ session });
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
    //   message: "Approving Sales Upload failed! Error - " + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Sale Upload failed!";
    next(error, req, res);
  }
};

export const rejectSalesUpload = async (req, res, next) => {
  let session;

  try {
    let salesUpload = await SalesUpload.findById(req.params.id);

    if (!salesUpload) {
      return res.status(404).json({
        message: "Sales Upload not found!"
      });
    }

    if (salesUpload.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't reject this Sales Upload.`, 
        error : { 
          errors : { 
            salesUploadDate: { message: `You can't reject this Sales Upload.` } 
          } 
        }
      });
    }

    if (salesUpload.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Sales Upload already approved.`, 
        error : { 
          errors : { 
            salesUploadDate: { message: `Sales Upload already approved.` } 
          } 
        }
      });
    }

    const error = salesUpload.reject(req);
    if (error) {
      throw error;
    } else {
      session = await connection.startSession();
      session.startTransaction();

      // console.log(salesUpload);

      await SalesUploadDetail.deleteMany({ salesUpload: salesUpload._id }, { session });

      await salesUpload.save({ session });

      await session.commitTransaction();
      
      res.status(200).json({ message: "Reject successful!" });
    }
  } catch (error) {
    // console.log(error);

    if (session) {
      await session.abortTransaction();
    }

    // res.status(500).json({
    //   message: "Rejecting Sales Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Sale Upload failed!";
    next(error, req, res);
  }
};

export const getSalesUploads = async (req, res, next) => {
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
    const data = await SalesUpload.aggregate().sortByCount("status");
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

    const salesUploads = await SalesUpload.find(cond).sort('-updatedAt')
                              // .populate('distributor depot')
                              .skip(pageSize * (currentPage - 1))
                              .limit(pageSize)
                              .lean();

    res.status(200).json({
      message: "Sales Uploads fetched successfully!",
      statusCount: statusCount,
      maxSalesUploads: totalCount,
      salesUploads: salesUploads
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching SalesUploads failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sale Uploads failed!";
    next(error, req, res);
  }
};

export const deleteSalesUpload = async (req, res, next) => {
  try {
    let salesUpload = await SalesUpload.findById(req.params.id);

    if (!salesUpload) {
      return res.status(404).json({
        message: "Sales Upload not found!"
      });
    }

    // console.log(salesUpload);

    // salesUpload.getRequestData();
    // const error = await salesUpload.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }
    
    if (salesUpload.status.trim().toUpperCase() === 'APPROVED') {
      const refSalesUpload = await SalesUpload.findOne({ refId: req.params.id });
      
      if (refSalesUpload) {
        // console.log('refSalesUpload');
        refSalesUpload.status = 'Pending for approval';
        refSalesUpload.isDeleted = true;
        refSalesUpload.remarks = req.body.remarks;
        refSalesUpload.refId = req.params.id;
        refSalesUpload.updatedBy = req.userData.userId;

        // console.log(refSalesUpload);
        await refSalesUpload.save();
      } else {
        const obj = JSON.parse(JSON.stringify(salesUpload));
        delete obj._id;
        
        const newSalesUpload = new SalesUpload({
          ...obj
        });

        newSalesUpload.status = 'Pending for approval';
        newSalesUpload.isDeleted = true;
        newSalesUpload.remarks = req.body.remarks;
        newSalesUpload.refId = req.params.id;
        newSalesUpload.updatedBy = req.userData.userId;

        await newSalesUpload.save();
      }
    } else {
      session = await connection.startSession();
      session.startTransaction();

      // console.log(salesUpload);

      await SalesUploadDetail.deleteMany({ salesUpload: salesUpload._id }, { session });

      await salesUpload.deleteOne({ session });

      await session.commitTransaction();
    }

    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // console.log(error);

    if (session) {
      await session.abortTransaction();
    }

    // res.status(500).json({
    //   message: "Deleting Sales Upload failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting Sale Upload failed!";
    next(error, req, res);
  }
};

export const getS3SignedUploadUrl = async (req, res, next) => {
  try {
    const url = await SalesUpload.getS3SignedUploadUrl();

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

// export const updateSalesUpload = async (req, res, next) => {
//   try {
//     let salesUpload = await SalesUpload.findById(req.params.id);

//     if (!salesUpload) {
//       return res.status(404).json({
//         message: "Sales Upload not found!"
//       });
//     }

//     if (salesUpload.status.trim().toUpperCase() === 'APPROVED') {
//       const refSalesUpload = await SalesUpload.findOne({ refId: req.params.id });

//       if (refSalesUpload) {
//         salesUpload = refSalesUpload;
//       } else {
//         const obj = JSON.parse(JSON.stringify(salesUpload));
//         delete obj._id;
        
//         salesUpload = new SalesUpload({
//           // status: 'Pending',
//           // refId: req.params.id,
//           // updatedBy: req.userData.userId,
//           ...obj
//         });
//       }
      
//       salesUpload.status = 'Pending';
//       salesUpload.refId = req.params.id;
//       salesUpload.updatedBy = req.userData.userId;
//     } else if (salesUpload.status.trim().toUpperCase() === 'REJECTED') {
//       salesUpload.status = 'Pending';
//     }

//     await salesUpload.getRequestData(req);

//     const error = await salesUpload.validateData();
//     if (error) {
//       return res.status(422).json({
//         message: "Invalid inputs passed, please check your data.",
//         error: error
//       });
//     }

//     await salesUpload.save();
//     res.status(200).json({ message: "Update successful!" });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({
//       message: "Udpating Sales Upload Failed!"
//     });
//   }
// };

// exports.getSalesUpload = async (req, res, next) => {
//   try {
//     const salesUpload = await SalesUpload.findById(req.params.id);
//     if (!salesUpload) {
//       return res.status(404).json({ message: "Sales Upload not found!" });
//     }

//     const roleDetails = req.userData.roleDetails;

//     // console.log(roleDetails);

//     const action = {
//       update: false,
//       delete: false,
//       approve: false
//     };

//     if (salesUpload.updatedBy.toString() === req.userData.userId || 
//         roleDetails.approve === false || 
//         salesUpload.status.trim().toUpperCase() === 'APPROVED' || 
//         salesUpload.status.trim().toUpperCase() === 'INACTIVE') 
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

//     const masterData = await SalesUpload.getMasterData(salesUpload);

//     if (masterData instanceof Error) {
//       throw masterData;
//     }
  
//     return res.status(200).json({ action, salesUpload, masterData });
//   } catch (error) {
//     res.status(500).json({
//       message: "Fetching Sales Upload failed!"
//     });
//   }
// };