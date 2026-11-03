const { connection } = require("mongoose");
const SellReturn = require("../models/sellReturn");
const Series = require("../models/series");
const Sell = require("../models/sell");
const Sample = require("../models/sample");
const Product = require("../models/product");
const Stock = require("../models/stock");

exports.getMasterData = async (req, res, next) => {
  try {
    const masterData = await SellReturn.getMasterData(null);

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

exports.createSellReturn = async (req, res, next) => {
  try {
    const sellReturn = new SellReturn({
      status: 'Pending',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    let error = await sellReturn.getRequestData(req);
    // console.log(error);
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        // error: JSON.stringify(error, Object.getOwnPropertyNames(error))
        error: error
      });
    }

    error = await sellReturn.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await sellReturn.save();

    return res.status(201).json({
      message: "Sell Return added successfully",
      sellReturn: sellReturn
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a Sell Return failed!"
    // });

    res.statusCode = 500;
    res.message = "Creating a Sale Return failed!";
    next(error, req, res);
  }
};

exports.updateSellReturn = async (req, res, next) => {
  try {
    let sellReturn = await SellReturn.findById(req.params.id);

    if (!sellReturn) {
      return res.status(404).json({
        message: "Sell Return not found!"
      });
    }

    if (sellReturn.status.trim().toUpperCase() === 'APPROVED') {
      const refSellReturn = await SellReturn.findOne({ refId: req.params.id });

      if (refSellReturn) {
        sellReturn = refSellReturn;
      } else {
        const obj = JSON.parse(JSON.stringify(sellReturn));
        delete obj._id;

        sellReturn = new SellReturn({
          // status: 'Pending',
          // refId: req.params.id,
          // updatedBy: req.userData.userId,
          ...obj
        });
      }

      sellReturn.status = 'Pending';
      sellReturn.refId = req.params.id;
      sellReturn.updatedBy = req.userData.userId;
    } else if (sellReturn.status.trim().toUpperCase() === 'REJECTED') {
      sellReturn.status = 'Pending';
    }

    let error = await sellReturn.getRequestData(req);
    // console.log(sellReturn);
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    error = await sellReturn.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await sellReturn.save();
    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Udpating Sell Return Failed!"
    // });

    res.statusCode = 500;
    res.message = "Updating Sale Return failed!";
    next(error, req, res);
  }
};

exports.approveSellReturn = async (req, res, next) => {
  let session;

  try {
    let sellReturn = await SellReturn.findById(req.params.id);

    if (!sellReturn) {
      return res.status(404).json({
        message: "Sell Return not found!"
      });
    }

    if (sellReturn.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({
        message: `You can't approve this Sell Return.`,
        error: {
          errors: {
            sellReturnDate: { message: `You can't approve this Sell Return.` }
          }
        }
      });
    }

    if (sellReturn.status.trim().toUpperCase() !== 'PENDING') {
      return res.status(422).json({
        message: `Sell Return status should be pending.`,
        error: {
          errors: {
            sellReturnDate: { message: `Sell Return status should be pending.` }
          }
        }
      });
    }

    let message = await Stock.checkStock('Sell Return', sellReturn);
    if (message instanceof Error) throw message;
    if (message) {
      return res.status(422).json({
        message: message,
        error: {
          errors: {
            sellReturnDate: { message: message }
          }
        }
      });
    }

    let error = sellReturn.approve(req);
    if (error) {
      throw error;
    }

    // console.log(error);
    // sellReturn.approvedBy = req.userData.userId;
    // sellReturn.approvedAt = new Date().toISOString();

    // const error = await sellReturn.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
    session = await connection.startSession();
    session.startTransaction();

    if (!sellReturn.sellReturnNo) {
      const series = await Series.getSeries(req, 'Sell Return');
      sellReturn.getSellReturnNo(series.count);
      await series.save({ session });
    }

    if (!sellReturn.refId) {
      await sellReturn.save({ session });
    } else {
      const obj = JSON.parse(JSON.stringify(sellReturn));
      delete obj._id;
      obj.refId = null;

      const refId = sellReturn.refId;

      await sellReturn.deleteOne({ session });

      sellReturn = await SellReturn.findByIdAndUpdate(refId, obj, { session: session, new: true });

      // originalSellReturn = await SellReturn.findById(sellReturn.refId);
      // originalSellReturn.overwrite(sellReturn);
      // originalSellReturn.refId = null;
      // originalSellReturn.sellReturnState = sellReturn.sellReturnState;
      // // console.log(originalSellReturn);
      // await originalSellReturn.save({ session });
    }

    // -------------- Setting Sample For Expired Stock Start ------------------
    if (sellReturn.isExpired) {
      const sampleUpdatedObj = sellReturn.getSampleDetails();
      // console.log(sampleUpdatedObj);
      const sample = await Sample
        .findOneAndUpdate(
          { sellReturn: sellReturn._id },
          sampleUpdatedObj,
          { session: session, upsert: true, new: true }
        );
      // console.log('Sample - ' + sample);

      message = await Stock.checkStock('Expired', sample);
      if (message instanceof Error) throw message;
      if (message) {
        return res.status(422).json({
          message: message,
          error: {
            errors: {
              sellReturnDate: { message: message }
            }
          }
        });
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
        await series.save({ session });
      }

      sample.remarks = `Sell Return entry ${sellReturn._id} changed. ${sample.remarks}`;

      // console.log(sample);

      await sample.save({ session });

      await Stock.deleteMany({ stockType: 'Expired', sample: sample._id.toString() }, { session });
      error = await Stock.setStockDetails('Expired', sample, session, req);
      if (error) throw error;

      error = await Product.setStock('Expired', sample, session);
      if (error instanceof Error) throw error;
    } else {
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
    }
    // -------------- Setting Sample For Expired Stock End ------------------

    await Stock.deleteMany({ stockType: 'Sell Return', sellReturn: sellReturn._id.toString() }, { session });
    error = await Stock.setStockDetails('Sell Return', sellReturn, session, req);
    if (error) throw error;

    error = await Product.setStock('Sell Return', sellReturn, session);
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
    //   message: "Approving Sell Return failed! Error - " + (error.message ? error.message : '')
    // });

    res.statusCode = 500;
    res.message = "Approving Sell Return failed!";
    next(error, req, res);
  }
};

exports.rejectSellReturn = async (req, res, next) => {
  try {
    let sellReturn = await SellReturn.findById(req.params.id);

    if (!sellReturn) {
      return res.status(404).json({
        message: "Sell Return not found!"
      });
    }

    if (sellReturn.updatedBy.toString() === req.userData.userId) {
      return res.status(422).json({
        message: `You can't reject this Sell Return.`,
        error: {
          errors: {
            sellReturnDate: { message: `You can't reject this Sell Return.` }
          }
        }
      });
    }

    if (sellReturn.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({
        message: `Sell Return already approved.`,
        error: {
          errors: {
            sellReturnDate: { message: `Sell Return already approved.` }
          }
        }
      });
    }

    const error = sellReturn.reject(req);
    if (error) {
      throw error;
    } else {
      await sellReturn.save();

      res.status(200).json({ message: "Reject successful!" });
    }
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Sell Return failed!"
    // });

    res.statusCode = 500;
    res.message = "Rejecting Sell Return failed!";
    next(error, req, res);
  }
};

exports.getSellReturns = async (req, res, next) => {
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
    const data = await SellReturn.aggregate().sortByCount("status");
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

    const sellReturns = await SellReturn
      .find(cond)
      .sort('-updatedAt')
      .skip(pageSize * (currentPage - 1))
      .limit(pageSize)
      .populate('distributor depot')
      .lean();

    res.status(200).json({
      message: "Sell Returns fetched successfully!",
      statusCount: statusCount,
      maxSellReturns: totalCount,
      sellReturns: sellReturns
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Fetching Sell Returns failed!"
    // });

    res.statusCode = 500;
    res.message = "Fetching Sell Returns failed!";
    next(error, req, res);
  }

  // const sellReturnQuery = SellReturn.find();
  // let fetchedSellReturns;
  // if (pageSize && currentPage) {
  //   sellReturnQuery.skip(pageSize * (currentPage - 1)).limit(pageSize);
  // }
  // sellReturnQuery
  //   .then(documents => {
  //     fetchedSellReturns = documents;
  //     return SellReturn.count();
  //   })
  //   .then(count => {
  //     res.status(200).json({
  //       message: "SellReturns fetched successfully!",
  //       sellReturns: fetchedSellReturns,
  //       maxSellReturns: count
  //     });
  //   })
  //   .catch(error => {
  //     res.status(500).json({
  //       message: "Fetching SellReturns failed!"
  //     });
  //   });
};

exports.getSellReturn = async (req, res, next) => {
  try {
    const sellReturn = await SellReturn.findById(req.params.id);
    if (!sellReturn) {
      return res.status(404).json({ message: "Sell Return not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    if (sellReturn.isFreezed) {
      if (sellReturn.status.trim().toUpperCase() !== 'APPROVED' &&
        sellReturn.status.trim().toUpperCase() !== 'INACTIVE') {
        if (roleDetails.update) {
          action.update = true;
        }
        if (roleDetails.delete) {
          action.delete = true;
        }
      }
    } else {
      if (sellReturn.updatedBy.toString() === req.userData.userId ||
        roleDetails.approve === false ||
        sellReturn.status.trim().toUpperCase() !== 'PENDING') {
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

    const masterData = await SellReturn.getMasterData(sellReturn);

    if (masterData instanceof Error) {
      throw masterData;
    }

    return res.status(200).json({ action, sellReturn, masterData });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Sell Return failed!"
    // });

    res.statusCode = 500;
    res.message = "Fetching Sell Return failed!";
    next(error, req, res);
  }
};

exports.deleteSellReturn = async (req, res, next) => {
  try {
    let sellReturn = await SellReturn.findById(req.params.id);

    if (!sellReturn) {
      return res.status(404).json({
        message: "Sell Return not found!"
      });
    }

    // console.log(sellReturn);

    // let error = await sellReturn.getRequestData(req);
    // console.log(sellReturn);
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // error = await sellReturn.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    if (sellReturn.status.trim().toUpperCase() === 'APPROVED') {
      const refSellReturn = await SellReturn.findOne({ refId: req.params.id });

      if (refSellReturn) {
        // console.log('refSellReturn');
        refSellReturn.status = 'Pending';
        refSellReturn.isDeleted = true;
        refSellReturn.remarks = req.body.remarks;
        refSellReturn.refId = req.params.id;
        refSellReturn.updatedBy = req.userData.userId;

        // console.log(refSellReturn);
        await refSellReturn.save();
      } else {
        const obj = JSON.parse(JSON.stringify(sellReturn));
        delete obj._id;

        const newSellReturn = new SellReturn({
          ...obj
        });

        newSellReturn.status = 'Pending';
        newSellReturn.isDeleted = true;
        newSellReturn.remarks = req.body.remarks;
        newSellReturn.refId = req.params.id;
        newSellReturn.updatedBy = req.userData.userId;

        await newSellReturn.save();
      }
    } else {
      const result = await sellReturn.deleteOne();
    }

    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // console.log(error);

    // res.status(500).json({
    //   message: "Deleting Sell Return failed!"
    // });

    res.statusCode = 500;
    res.message = "Deleting Sell Return failed!";
    next(error, req, res);
  }
};

exports.getInvoiceNos = async (req, res, next) => {
  try {
    // console.log('distributor - ' + req.params.distributor);
    const sells = await Sell.find({ status: 'Approved', distributor: req.params.distributor }).select('invoiceNo');
    if (!sells) {
      return res.status(404).json({ message: "Invoice Nos not found!" });
    }

    return res.status(200).json({ sells });
  } catch (error) {
    // console.log(error);

    // res.status(500).json({
    //   message: "Fetching Invoice Nos failed!"
    // });

    res.statusCode = 500;
    res.message = "Fetching Invoice Nos failed!";
    next(error, req, res);
  }
};

exports.getInvoiceDetails = async (req, res, next) => {
  try {
    // console.log('distributor - ' + req.params.distributor);
    const sell = await Sell.findOne({ status: 'Approved', _id: req.params.sellId })
      .populate({
        path: 'sellItems',
        populate: { path: 'productId', model: Product, select: { productName: 1 } }
      });
    if (!sell) {
      return res.status(404).json({ message: "Invoice Details not found!" });
    }

    return res.status(200).json({ sell });
  } catch (error) {
    // console.log(error);

    // res.status(500).json({
    //   message: "Fetching Invoice Details failed!"
    // });

    res.statusCode = 500;
    res.message = "Fetching Invoice Details failed!";
    next(error, req, res);
  }
};

exports.updateSellReturnFromSells = async (req, res, next) => {
  let session;

  try {
    const sellReturns = await SellReturn.find({ status: 'Approved' });
    for (const sellReturn of sellReturns) {
      // sellReturn = await SellReturn.findById(sellReturn._id.toString());
      await sellReturn.updateSellReturnFromSells();

      let message = await Stock.checkStock('Sell Return', sellReturn);
      if (message instanceof Error) throw message;
      if (message) {
        return res.status(422).json({
          message: message,
          error: {
            errors: {
              sellReturnDate: { message: message, sellReturn: sellReturn }
            }
          }
        });
      }

      // try {
      session = await connection.startSession();
      session.startTransaction();

      await sellReturn.save({ session });

      // -------------- Setting Sample For Expired Stock Start ------------------
      if (sellReturn.isExpired) {
        const sampleUpdatedObj = sellReturn.getSampleDetails();
        // console.log(sampleUpdatedObj);
        const sample = await Sample
          .findOneAndUpdate(
            { sellReturn: sellReturn._id },
            sampleUpdatedObj,
            { session: session, upsert: true, new: true }
          );
        // console.log('Sample - ' + sample);

        message = await Stock.checkStock('Expired', sample);
        if (message instanceof Error) throw message;
        if (message) {
          return res.status(422).json({
            message: message,
            error: {
              errors: {
                sellReturnDate: { message: message, sample: sample }
              }
            }
          });
        }

        // error = sample.approve(req);
        // if (error) {
        //   throw error;
        // }

        error = await sample.setSampleAmountDetails();
        // console.log(error);
        if (error) {
          throw error;
        }

        // if (!sample.sampleNo) {
        //   const series = await Series.getSeries(req, 'Sample');
        //   sample.getSampleNo(series.count);
        //   await series.save({ session });
        // }

        sample.remarks = `Sell Return entry ${sellReturn._id} changed. ${sample.remarks}`;

        // console.log(sample);

        await sample.save({ session });

        await Stock.deleteMany({ stockType: 'Expired', sample: sample._id.toString() }, { session });
        error = await Stock.setStockDetails('Expired', sample, session, req);
        if (error) throw error;

        error = await Product.setStock('Expired', sample, session);
        if (error instanceof Error) throw error;
      } else {
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
      }
      // -------------- Setting Sample For Expired Stock End ------------------

      await Stock.deleteMany({ stockType: 'Sell Return', sellReturn: sellReturn._id.toString() }, { session });
      error = await Stock.setStockDetails('Sell Return', sellReturn, session, req);
      if (error) throw error;

      error = await Product.setStock('Sell Return', sellReturn, session);
      if (error instanceof Error) throw error;

      await session.commitTransaction();

      // } catch (error) { 
      //     await session.abortTransaction();
      // }

    }

    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // console.log(error);

    if (session) {
      await session.abortTransaction();
    }

    // res.status(500).json({
    //   message: "Updating Sell Return failed! Error - " + (error.message ? error.message : '')
    // });

    res.statusCode = 500;
    res.message = "Updating Sell Return failed!";
    next(error, req, res);
  }
};
