const { Schema, model, models } = require("mongoose");
const Grn = require('./grn');
const DepotTransfer = require('./depotTransfer');
const Sample = require('./sample');
const Sell = require('./sell');
const SellReturn = require('./sellReturn');
const SellUpload = require('./sellUpload');
const SellUploadDetail = require('./sellUploadDetail');
const SellReturnUpload = require('./sellReturnUpload');
const SellReturnUploadDetail = require('./sellReturnUploadDetail');
const StockReconciliation = require('./stockReconciliation');

const freezeSchema = Schema({
  financialYear: {
    type: String,
    required: true,
    trim: true,
    minlength: 7,
    maxlength: 7,
    validate: {
      validator: function(v) {
        return /\d{4}-\d{2}/.test(v);
      },
      message: props => `${props.value} is not a valid financial year!`
    }
  },
  month: {
    type: String,
    required: true,
    trim: true,
    enum: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  report: {
    type: String,
    // required: true
  },
  remarks: {
    type: String,
    // required: true
  },
  status: {
    type: String,
    // required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

freezeSchema.methods.getRequestData = function(req) {
  try {
    this.financialYear = req.body.financialYear;
    this.month = req.body.month;
    // this.remarks = req.body.remarks;
  } catch (error) {
    return error;
  }
}

freezeSchema.methods.setMonthDate = function(req) {
  try {
    const year = this.financialYear.substring(0, 4);
    const monthArray = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthArray.findIndex(month => month === this.month);
    
    // console.log(this.year);
    // console.log(this.month);
    // console.log(month);

    // const startDate = new Date(`${year}-${this.month}-01`);
    const startDate = new Date(year, month, 1, 0, 0, 0, 0);

    // console.log(startDate);

    if (startDate.getMonth() < 3) {
      startDate.setFullYear(startDate.getFullYear() + 1);
    }

    // console.log(startDate);
    // console.log(startDate.toDateString());
    // console.log(startDate.toISOString());
    // console.log(startDate.toString());
    // console.log(startDate.toLocaleDateString());
    // console.log(startDate.toLocaleString());
    // console.log(startDate.toLocaleTimeString());
    // console.log(startDate.toTimeString());
    // console.log(startDate.toUTCString());

    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), 28, 23, 59, 59, 999);

    // console.log(startDate);
    // console.log(endDate);
    // console.log(startDate.getMonth());
    if (startDate.getMonth() === 0 || startDate.getMonth() === 2 || startDate.getMonth() === 4 || 
        startDate.getMonth() === 6 || startDate.getMonth() === 7 || startDate.getMonth() === 9 || 
        startDate.getMonth() === 11) {
          endDate.setDate(31);
          // console.log(31);
    } else if (startDate.getMonth() === 1) {
      if (startDate.getFullYear() % 4 === 0) {
        endDate.setDate(29);
        // console.log(29);
      } else {
        endDate.setDate(28);
        // console.log(28);
      }
    } else {
      endDate.setDate(30);
      // console.log(30);
    }
    // console.log(endDate);
    // console.log(endDate.toString());

    this.startDate = startDate;
    this.endDate = endDate;
  } catch (error) {
    return error;
  }
}

freezeSchema.methods.freezeData = async function(session) {
  try {
    await Grn.updateMany({ grnDate: { $gte: this.startDate, $lte: this.endDate }, status: 'Approved' }, 
                          { isFreezed: 1 }, 
                          { session: session });
    await DepotTransfer.updateMany({ 
                                    depotTransferDate: { $gte: this.startDate, $lte: this.endDate }, 
                                    status: 'Approved' 
                                  }, 
                                  { isFreezed: 1 }, 
                                  { session: session });
    await Sample.updateMany({ sampleDate: { $gte: this.startDate, $lte: this.endDate }, status: 'Approved' }, 
                            { isFreezed: 1 }, 
                            { session: session });
    await Sell.updateMany({ invoiceDate: { $gte: this.startDate, $lte: this.endDate }, status: 'Approved' }, 
                          { isFreezed: 1 }, 
                          { session: session });
    await SellReturn.updateMany({ 
                                  sellReturnDate: { $gte: this.startDate, $lte: this.endDate }, 
                                  status: 'Approved' 
                                }, 
                                { isFreezed: 1 }, 
                                { session: session });
    await SellUpload.updateMany({ 
                                  sellUploadDate: { $gte: this.startDate, $lte: this.endDate }, 
                                  status: 'Approved' 
                                }, 
                                { isFreezed: 1 }, 
                                { session: session });
    await SellUploadDetail.updateMany({ sellDate: { $gte: this.startDate, $lte: this.endDate } }, 
                                      { isFreezed: 1 }, 
                                      { session: session });
    
    const sellUploads = await SellUploadDetail.distinct('sellUpload', { sellDate: { $gte: this.startDate, $lte: this.endDate } });
    await SellUpload.updateMany({ 
                                  _id: { $in: sellUploads },
                                  status: { $nin: ['Approved', 'InActive'] }
                                }, 
                                { isFreezed: 1, status: 'Failed', remarks: 'Sell Date is freezed.' }, 
                                { session: session });
    await SellUpload.updateMany({ 
                                  _id: { $in: sellUploads },
                                  isFreezed: { $ne: 1 }
                                }, 
                                { isFreezed: 1 }, 
                                { session: session });
                                
    await SellReturnUpload.updateMany({ 
                                        sellReturnUploadDate: { $gte: this.startDate, $lte: this.endDate }, 
                                        status: 'Approved' 
                                      }, 
                                      { isFreezed: 1 }, 
                                      { session: session });
    await SellReturnUploadDetail.updateMany({ sellReturnDate: { $gte: this.startDate, $lte: this.endDate } }, 
                                            { isFreezed: 1 }, 
                                            { session: session });
                                            
    const sellReturnUploads = await SellReturnUploadDetail.distinct('sellReturnUpload', { sellReturnDate: { $gte: this.startDate, $lte: this.endDate } });
    await SellReturnUpload.updateMany({ 
                                  _id: { $in: sellReturnUploads },
                                  status: { $nin: ['Approved', 'InActive'] }
                                }, 
                                { isFreezed: 1, status: 'Failed', remarks: 'Sell Return Date is freezed.' }, 
                                { session: session });
    await SellReturnUpload.updateMany({ 
                                  _id: { $in: sellReturnUploads },
                                  isFreezed: { $ne: 1 }
                                }, 
                                { isFreezed: 1 }, 
                                { session: session });
                                
    await StockReconciliation.updateMany({ 
                                          stockReconciliationDate: { $gte: this.startDate, $lte: this.endDate }, 
                                          status: 'Approved' 
                                        }, 
                                        { isFreezed: 1 }, 
                                        { session: session });
  } catch (error) {
    return error;
  }
}

freezeSchema.methods.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let message = '';
    // if (this.financialYear.length != 7) {
    //   message = `Financial Year (${this.financialYear}) length should be 7.`;
    // }

    let count = await models.Freeze.countDocuments({ financialYear: this.financialYear, month: this.month, _id: { $ne: this._id } });
    if (count > 0) {
      message = `Financial Year (${this.financialYear}) and Month (${this.month}) is already freezed.`;
    }

    if (message) {
      return { errors : { financialYear: { message: message } } }
    }

    return null;
  } catch (error) {
    console.log(error);
    return error;
  }
}

module.exports = model("Freeze", freezeSchema);
