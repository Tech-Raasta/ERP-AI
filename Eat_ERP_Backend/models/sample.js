const { Schema, model } = require("mongoose");
const { sampleItemSchema } = require("./sampleItem");
const Depot = require("./depot");
const Distributor = require("./distributor");
const Product = require("./product");
const { calculateFiscalYearForDate, round } = require('../lib/common');

const sampleSchema = Schema({
  sampleDate: {
    type: Date,
    required: true
  },
  dateOfProcessing: {
    type: Date,
    // required: true
    default: new Date().toISOString().substring(0, 10)
  },
  isExpired: {
    type: Boolean,
    default: false,
    // required: true
  },
  depot: {
    type: Schema.Types.ObjectId,
    ref: 'Depot',
    required: true
  },
  distributor: {
    type: Schema.Types.ObjectId,
    ref: 'Distributor',
    // required: true
  },
  dueDate: {
    type: Date,
    // required: true,
    default: new Date().toISOString().substring(0, 10)
  },
  sampleNo: {
    type: String,
    // required: true
  },
  sampleAmount: {
    type: Number,
    // required: true
  },
  sampleType: {
    type: String,
    enum: ['Gifting', 'Blogger']
  },
  sampleDetails: {
    giftingRemarks: {
      type: String
    },
    bloggerName: {
      type: String
    },
    bloggerAddress: {
      type: String
    },
    bloggerMobileNo: {
      type: String
    },
    bloggerEmailId: {
      type: String
    }
  },
  sampleItems: {
    type: [sampleItemSchema],
    required: true,
  },
  amount: {
    type: Number,
    required: true
  },
  cgstAmount: {
    type: Number,
    required: true
  },
  sgstAmount: {
    type: Number,
    required: true
  },
  igstAmount: {
    type: Number,
    required: true
  },
  taxAmount: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  costAmount: {
    type: Number,
    required: true
  },
  shippingCharges: {
    type: Number,
    // required: true
  },
  deliveryStatus: {
    type: String,
    // enum: ['Pending', 'Delivered'],
    default: 'Pending',
  },
  dispatchDetails: {
    dispatchThrough: {
      type: String,
      // required: true
    },
    dispatchDocNo: {
      type: String,
      // required: true
    },
    dispatchDate: {
      type: Date,
      // required: true
    },
    deliveryDate: {
      type: Date,
      // required: true
    },
  },
  isSellReturn: {
    type: Boolean,
    default: false
  },
  sellReturn : {
    type: Schema.Types.ObjectId,
    ref: 'SellReturn'
  },
  isFreezed: {
    type: Boolean,
    default: false
  },
  remarks: {
    type: String,
    // required: true
  },
  status: {
    type: String,
    required: true
  },
  isDeleted: {
    type: Boolean
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  refId: {
    type: Schema.Types.ObjectId,
    ref: 'Sample'
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

sampleSchema.statics.getMasterData = async function(sample) {
  try {
    let depotCond = { status: 'Approved' };
    let distributorCond = { status: 'Approved', class: { '$ne': 'Sample' } };
    let productCond = { status: 'Approved' };

    if (sample) {
      if (sample.depot) {
        depotCond = { $or: [{ status: 'Approved' }, { _id: sample.depot }] };
      }
      if (sample.distributor) {
        distributorCond = { $or: [{ status: 'Approved', class: { '$ne': 'Sample' } }, { _id: sample.distributor }] };
      }
      // if (sample.sampleItems) {
      //   productCond = { $or: [{ status: 'Approved' }, { _id: sample.sampleItems[0].productId }] };
      // }
    }

    const depots = await Depot.find(depotCond).select('_id depotName state');
    const distributors = await Distributor.find(distributorCond).select('_id distributorName state class');
    const products = await Product.find(productCond).select('_id productName description hsnCode grams costWithoutGst taxPercentage mrp');

    return { depots, distributors, products };
  } catch (error) {
    // console.log('Error', error);
    return error;
  }
}

sampleSchema.methods.getRequestData = async function(req) {
  try {
    this.sampleDate = (req.body.sampleDate) ? req.body.sampleDate : '';
    this.isExpired = req.body.isExpired;
    this.sampleType = req.body.sampleType;
    this.sampleDetails = req.body.sampleDetails;
    this.shippingCharges = (req.body.shippingCharges) ? req.body.shippingCharges : 0;
    this.dueDate = (req.body.dueDate) ? req.body.dueDate : null;
    this.deliveryStatus = req.body.deliveryStatus;
    this.dispatchDetails = req.body.dispatchDetails;
    this.remarks = req.body.remarks;

    if (req.body.depot) {
      const depot = await Depot.findById(req.body.depot);
      if (depot && depot.state && depot.state.stateName) {
        this.depot = req.body.depot;
      }
    } else {
      this.depot = null;
    }

    if (req.body.distributor) {
      const distributor = await Distributor.findById(req.body.distributor);
      if (distributor) {
        this.distributor = req.body.distributor;
      }
    } else {
      this.distributor = null;
    }
    
    const sampleItems = [];
    for (const postedSampleItem of req.body.sampleItems) {
      const productId = (postedSampleItem.productId) ? postedSampleItem.productId : null;
      const quantity = (postedSampleItem.quantity) ? +postedSampleItem.quantity : 0;
      const sellRate = (postedSampleItem.sellRate) ? +postedSampleItem.sellRate : 0;

      const sampleItem = {
        productId: productId,
        quantity: quantity,
        sellRate: sellRate
      };
      
      sampleItems.push(sampleItem);
    }

    this.sampleItems = sampleItems;

    const error = await this.setSampleAmountDetails();
    if (error) {
      return error;
    }

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

sampleSchema.methods.setSampleAmountDetails = async function(req) {
  try {
    const sampleItems = [];
    let sampleAmount = 0;
    let sampleCgstAmount = 0;
    let sampleSgstAmount = 0;
    let sampleIgstAmount = 0;
    let sampleTaxAmount = 0;
    let sampleTotalAmount = 0;
    let sampleCostAmount = 0;
  
    for (const sampleItem of this.sampleItems) {
      const product = await Product
                              .findById(sampleItem.productId)
                              .select('_id productName description hsnCode hsnName grams costWithoutGst taxPercentage mrp');
      
      if (product) {
        const productId = product._id;
        const productName = product.productName;
        const description = product.description;
        const hsnCode = product.hsnCode;
        const hsnName = product.hsnName;
        const grams = (product.grams) ? +product.grams : 0;
        const quantity = (sampleItem.quantity) ? +sampleItem.quantity : 0;
        const costWithoutGst = (product.costWithoutGst) ? +product.costWithoutGst : 0;
        const costAmount = round(quantity * costWithoutGst, 2);
        const mrp = (sampleItem.sellRate) ? +sampleItem.sellRate : ((product.mrp) ? +product.mrp : 0);
        const taxPercentage = 0;

        const sellRate = mrp;

        let amount = round(quantity * sellRate, 2);
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        let taxAmount = 0;
        let totalAmount = round(amount + taxAmount, 2);
        
        sampleAmount = sampleAmount + amount;
        sampleCgstAmount = sampleCgstAmount + cgstAmount;
        sampleSgstAmount = sampleSgstAmount + sgstAmount;
        sampleIgstAmount = sampleIgstAmount + igstAmount;
        sampleTaxAmount = sampleTaxAmount + taxAmount;
        sampleTotalAmount = sampleTotalAmount + totalAmount;
        sampleCostAmount = sampleCostAmount + costAmount;

        sampleItem.productId = productId;
        sampleItem.productName = productName;
        sampleItem.description = description;
        sampleItem.hsnCode = hsnCode;
        sampleItem.hsnName = hsnName;
        sampleItem.grams = grams;
        sampleItem.quantity = quantity;
        sampleItem.mrp = mrp;
        sampleItem.taxPercentage = taxPercentage;
        sampleItem.sellRate = sellRate;
        sampleItem.amount = amount;
        sampleItem.discountAmount = 0;
        sampleItem.taxableAmount = amount;
        sampleItem.cgst = cgst;
        sampleItem.sgst = sgst;
        sampleItem.igst = igst;
        sampleItem.cgstAmount = cgstAmount;
        sampleItem.sgstAmount = sgstAmount;
        sampleItem.igstAmount = igstAmount;
        sampleItem.taxAmount = taxAmount;
        sampleItem.totalAmount = totalAmount;
        sampleItem.costWithoutGst = costWithoutGst;
        sampleItem.costAmount = costAmount;
        
        sampleItems.push(sampleItem);
      }
    }
  
    this.amount = sampleAmount;
    this.cgstAmount = sampleCgstAmount;
    this.sgstAmount = sampleSgstAmount;
    this.igstAmount = sampleIgstAmount;
    this.taxAmount = sampleTaxAmount;
    this.totalAmount = sampleTotalAmount;
    this.costAmount = sampleCostAmount;
    
    this.sampleAmount = round(this.shippingCharges + sampleTotalAmount, 2);
  
    this.sampleItems = sampleItems;

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

sampleSchema.methods.approve = function(req) {
  try {
    if (this.isDeleted) {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    this.remarks = req.body.remarks;
    this.approvedBy = req.userData.userId;
    this.approvedAt = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

sampleSchema.methods.reject = function(req) {
  try {
    this.status = "Rejected";
    this.remarks = req.body.remarks;
    this.rejectedBy = req.userData.userId;
    this.rejectedAt = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

sampleSchema.methods.getSampleNo = function(series) {
  try {
    if (this.sampleNo) {
      return this.sampleNo;
    }
  
    const sampleDate = this.sampleDate ? new Date(this.sampleDate) : new Date();
    const financialYear = calculateFiscalYearForDate(sampleDate);
    // const monthName = getMonthName(sampleDate.getMonth());

    const sampleNo = 'WYN' + '/Sample/' + financialYear + '/' + series;
    
    this.sampleNo = sampleNo;
    this.sampleDate = sampleDate.toISOString().substring(0, 10);

    return sampleNo;
  } catch (error) {
    return error;
  }
}

sampleSchema.methods.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ sampleName: this.sampleName, _id: { $ne: this._id } });
    // if (count > 0) {
    //   return { errors : { sampleName: { message: `Two samples cannot share the same sampleName (${this.sampleName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sampleName: { message: `Two samples cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sampleName: { message: `Two samples cannot share the same skuCode (${this.skuCode})` } } }
    //   }
    // }

    // if (this.category) {
    //   count = await Category.countDocuments({ _id: this.category });
    //   if (count === 0) {
    //     return { errors : { category: { message: `Category does not exist` } } }
    //   }
    // }

    return null;
  } catch (error) {
    return error;
  }
}

module.exports = model("Sample", sampleSchema);
