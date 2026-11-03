const { connection } = require("mongoose");
const Sample = require("../models/sample");
const Series = require("../models/series");
const Stock = require("../models/stock");
const Product = require("../models/product");

exports.getMasterData = async (req, res, next) => {
  try {
    const masterData = await Sample.getMasterData(null);

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

exports.createSample = async (req, res, next) => {
  try {
    const sample = new Sample({
      status: 'Pending',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    await sample.getRequestData(req);

    // console.log(sample);

    const error = await sample.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await sample.save();

    return res.status(201).json({
      message: "Sample added successfully",
      sample: sample
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a Sample failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Creating a Sample failed!";
    next(error, req, res);
  }
};

exports.updateSample = async (req, res, next) => {
  try {
    let sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json({
        message: "Sample not found!"
      });
    }

    if (sample.status.trim().toUpperCase() === 'APPROVED') {
      const refSample = await Sample.findOne({ refId: req.params.id });

      if (refSample) {
        sample = refSample;
      } else {
        const obj = JSON.parse(JSON.stringify(sample));
        delete obj._id;
        
        sample = new Sample({
          // status: 'Pending',
          // refId: req.params.id,
          // updatedBy: req.userData.userId,
          ...obj
        });
      }
      
      sample.status = 'Pending';
      sample.refId = req.params.id;
      sample.updatedBy = req.userData.userId;
    } else if (sample.status.trim().toUpperCase() === 'REJECTED') {
      sample.status = 'Pending';
    }

    await sample.getRequestData(req);

    const error = await sample.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await sample.save();
    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Udpating Sample Failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Udpating Sample failed!";
    next(error, req, res);
  }
};

exports.approveSample = async (req, res, next) => {
  let session;

  try {
    let sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json({
        message: "Sample not found!"
      });
    }

    if (sample.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't approve this Sample.`, 
        error : { 
          errors : { 
            sampleDate: { message: `You can't approve this Sample.` } 
          } 
        }
      });
    }

    if (sample.status.trim().toUpperCase() !== 'PENDING') {
      return res.status(422).json({ 
        message: `Sample status should be pending.`, 
        error : { 
          errors : { 
            sampleDate: { message: `Sample status should be pending.` } 
          } 
        }
      });
    }

    const message = await Stock.checkStock(((sample.isExpired) ? 'Expired' : 'Sample'), sample);
    if (message instanceof Error) throw message;
    if (message) {
      return res.status(422).json({
        message: message,
        error: {
          errors: {
            sampleDate: { message: message }
          }
        }
      });
    }

    let error = sample.approve(req);
    if (error) {
      throw error;
    }

    // console.log(error);
    // sample.approvedBy = req.userData.userId;
    // sample.approvedAt = new Date().toISOString();

    // const error = await sample.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
      session = await connection.startSession();
      session.startTransaction();

      if (!sample.sampleNo) {
        const series = await Series.getSeries(req, 'Sample');
        sample.getSampleNo(series.count);
        await series.save({ session });
      }
      
      if (!sample.refId) {
        await sample.save({ session });
      } else {
        const obj = JSON.parse(JSON.stringify(sample));
        delete obj._id;
        obj.refId = null;

        const refId = sample.refId;
        await sample.deleteOne({ session });

        sample = await Sample.findByIdAndUpdate(refId, obj, { session: session, new: true });

        // originalSample = await Sample.findById(sample.refId);
        // originalSample.overwrite(sample);
        // originalSample.refId = null;
        // originalSample.sampleState = sample.sampleState;
        // // console.log(originalSample);
        // await originalSample.save({ session });
      }

      // console.log(sample);
      
      await Stock.deleteMany({ stockType: 'Sample', sample: sample._id.toString() }, { session });
      await Stock.deleteMany({ stockType: 'Expired', sample: sample._id.toString() }, { session });
      if (sample.isExpired) {
        error = await Stock.setStockDetails('Expired', sample, session, req);
        if (error) throw error;
            
        error = await Product.setStock('Expired', sample, session);
        if (error instanceof Error) throw error;
      } else {
        error = await Stock.setStockDetails('Sample', sample, session, req);
        if (error) throw error;
            
        error = await Product.setStock('Sample', sample, session);
        if (error instanceof Error) throw error;
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
    //   message: "Approving Sample failed! Error - " + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Sample failed!";
    next(error, req, res);
  }
};

exports.rejectSample = async (req, res, next) => {
  try {
    let sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json({
        message: "Sample not found!"
      });
    }

    if (sample.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't reject this Sample.`, 
        error : { 
          errors : { 
            sampleDate: { message: `You can't reject this Sample.` } 
          } 
        }
      });
    }

    if (sample.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Sample already approved.`, 
        error : { 
          errors : { sampleDate: { message: `Sample already approved.` } 
        } 
      }
    });
    }

    const error = sample.reject(req);
    if (error) {
      throw error;
    } else {
      await sample.save();
      
      res.status(200).json({ message: "Reject successful!" });
    }
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Sample failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Sample failed!";
    next(error, req, res);
  }
};

exports.getSamples = async (req, res, next) => {
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
    const data = await Sample.aggregate([{ $match: { isSellReturn: false } }]).sortByCount("status");
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
      cond = { status: status, isSellReturn: false };
    }

    const samples = await Sample
                              .find(cond)
                              .sort({ updatedAt: -1 })
                              .skip(pageSize * (currentPage - 1))
                              .limit(pageSize)
                              .populate('distributor depot', 'distributorName depotName')
                              .lean();

    res.status(200).json({
      message: "Samples fetched successfully!",
      statusCount: statusCount,
      maxSamples: totalCount,
      samples: samples
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching Samples failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Samples failed!";
    next(error, req, res);
  }

  // const sampleQuery = Sample.find();
  // let fetchedSamples;
  // if (pageSize && currentPage) {
  //   sampleQuery.skip(pageSize * (currentPage - 1)).limit(pageSize);
  // }
  // sampleQuery
  //   .then(documents => {
  //     fetchedSamples = documents;
  //     return Sample.count();
  //   })
  //   .then(count => {
  //     res.status(200).json({
  //       message: "Samples fetched successfully!",
  //       samples: fetchedSamples,
  //       maxSamples: count
  //     });
  //   })
  //   .catch(error => {
  //     res.status(500).json({
  //       message: "Fetching Samples failed!"
  //     });
  //   });
};

exports.getSample = async (req, res, next) => {
  try {
    const sample = await Sample.findById(req.params.id);
    if (!sample) {
      return res.status(404).json({ message: "Sample not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    if (sample.isFreezed) {
      if (sample.status.trim().toUpperCase() !== 'APPROVED' && 
          sample.status.trim().toUpperCase() !== 'INACTIVE') {
            if (roleDetails.update) {
              action.update = true;
            }
            if (roleDetails.delete) {
              action.delete = true;
            }
      }
    } else {
      if (sample.updatedBy.toString() === req.userData.userId || 
          roleDetails.approve === false || 
          sample.status.trim().toUpperCase() !== 'PENDING') 
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

    const masterData = await Sample.getMasterData(sample);

    if (masterData instanceof Error) {
      throw masterData;
    }
  
    return res.status(200).json({ action, sample, masterData });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Sample failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Sample failed!";
    next(error, req, res);
  }
};

exports.deleteSample = async (req, res, next) => {
  try {
    let sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json({
        message: "Sample not found!"
      });
    }

    // console.log(sample);

    // sample.getRequestData();
    // const error = await sample.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }
    
    if (sample.status.trim().toUpperCase() === 'APPROVED') {
      const refSample = await Sample.findOne({ refId: req.params.id });
      
      if (refSample) {
        // console.log('refSample');
        refSample.status = 'Pending';
        refSample.isDeleted = true;
        refSample.remarks = req.body.remarks;
        refSample.refId = req.params.id;
        refSample.updatedBy = req.userData.userId;

        // console.log(refSample);
        await refSample.save();
      } else {
        const obj = JSON.parse(JSON.stringify(sample));
        delete obj._id;
        
        const newSample = new Sample({
          ...obj
        });

        newSample.status = 'Pending';
        newSample.isDeleted = true;
        newSample.remarks = req.body.remarks;
        newSample.refId = req.params.id;
        newSample.updatedBy = req.userData.userId;

        await newSample.save();
      }
    } else {
      const result = await sample.deleteOne();
    }

    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // console.log(error);

    // res.status(500).json({
    //   message: "Deleting Sample failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting Sample failed!";
    next(error, req, res);
  }
};