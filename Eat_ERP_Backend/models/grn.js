const { Schema, model } = require("mongoose");
const Depot = require("./depot");
const Vendor = require("./vendor");
const PurchaseOrder = require("./purchaseOrder");
const Product = require("./product");
const { grnItemSchema } = require("./grnItem");
const { calculateFiscalYearForDate, getMonthName, round } = require('../lib/common');

const grnSchema = Schema({
  grnDate: {
    type: Date,
    required: true
  },
  vendor: {
    type: Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  purchaseOrder: {
    type: Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true
  },
  depot: {
    type: Schema.Types.ObjectId,
    ref: 'Depot',
    required: true
  },
  grnNo: {
    type: String,
    default: ''
  },
  gatePassNo: {
    type: String,
    default: ''
  },
  coaPath: {
    type: String
  },
  grnItems: {
    type: [grnItemSchema],
    required: true,
  },
  taxType: {
    type: String,
    default: 'Intra'
    // required: true
  },
  amountPo: {
    type: Number,
    // required: true
  },
  cgstAmountPo: {
    type: Number,
    // required: true
  },
  sgstAmountPo: {
    type: Number,
    // required: true
  },
  igstAmountPo: {
    type: Number,
    // required: true
  },
  taxAmountPo: {
    type: Number,
    // required: true
  },
  totalAmountPo: {
    type: Number,
    // required: true
  },
  otherChargesDescriptionPo: {
    type: String,
    // required: true
  },
  otherChargesAmountPo: {
    type: Number,
    // required: true
  },
  poAmount: {
    type: Number,
    // required: true
  },
  amount: {
    type: Number,
    // required: true
  },
  cgstAmount: {
    type: Number,
    // required: true
  },
  sgstAmount: {
    type: Number,
    // required: true
  },
  igstAmount: {
    type: Number,
    // required: true
  },
  taxAmount: {
    type: Number,
    // required: true
  },
  totalAmount: {
    type: Number,
    // required: true
  },
  otherChargesDescription: {
    type: String,
    // required: true
  },
  otherChargesAmount: {
    type: Number,
    // required: true
  },
  grnAmount: {
    type: Number,
    // required: true
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
    ref: 'Grn'
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

grnSchema.statics.getMasterData = async function(grn) {
  try {
    let depotCond = { status: 'Approved' };
    let vendorCond = { status: 'Approved' };
    let productCond = { status: 'Approved' };

    if (grn) {
      if (grn.depot) {
        depotCond = { $or: [{ status: 'Approved' }, { _id: grn.depot }] };
      }
      if (grn.vendor) {
        vendorCond = { $or: [{ status: 'Approved' }, { _id: grn.vendor }] };
      }
      // if (grn.sellItems) {
      //   productCond = { $or: [{ status: 'Approved' }, { _id: grn.sellItems[0].productId }] };
      // }
    }

    const depots = await Depot.find(depotCond).select('_id depotName state');
    const vendors = await Vendor.find(vendorCond).select('_id vendorName state');
    const products = await Product.find(productCond).select('_id productName description hsnCode hsnName grams costWithoutGst taxPercentage mrp oldPoRate');

    return { depots, vendors, products };
  } catch (error) {
    // console.log('Error', error);
    return error;
  }
}

grnSchema.methods.getRequestData = async function(req) {
  try {
    this.grnDate = (req.body.grnDate) ? req.body.grnDate : '';
    this.gatePassNo = req.body.gatePassNo;
    // this.otherChargesDescriptionPo = req.body.otherChargesDescriptionPo;
    this.otherChargesAmountPo = (req.body.otherChargesAmountPo) ? +req.body.otherChargesAmountPo : 0;
    // this.otherChargesDescription = req.body.otherChargesDescription;
    this.otherChargesAmount = (req.body.otherChargesAmount) ? +req.body.otherChargesAmount : 0;
    this.remarks = req.body.remarks;
  
    let vendorState = '';
    if (req.body.vendor) {
      const vendor = await Vendor.findById(req.body.vendor);
      if (vendor && vendor.state && vendor.state.stateName) {
        this.vendor = req.body.vendor;
        vendorState = vendor.state.stateName;
      }
    } else {
      this.vendor = null;
    }
  
    let depotState = '';
    if (req.body.depot) {
      const depot = await Depot.findById(req.body.depot);
      if (depot && depot.state && depot.state.stateName) {
        this.depot = req.body.depot;
        depotState = depot.state.stateName;
      }
    } else {
      this.depot = null;
    }

    if (req.body.purchaseOrder) {
      const purchaseOrder = await PurchaseOrder.findById(req.body.purchaseOrder);
      if (purchaseOrder) {
        this.purchaseOrder = req.body.purchaseOrder;
      }
    }
  
    let taxType = 'Intra';
    if (vendorState === depotState) {
      taxType = "Intra";
    } else {
      taxType = "Inter"
    }
    
    this.taxType = taxType;
  
    const grnItems = [];
    let poAmount = 0;
    let poCgstAmount = 0;
    let poSgstAmount = 0;
    let poIgstAmount = 0;
    let poTaxAmount = 0;
    let poTotalAmount = 0;
    let grnAmount = 0;
    let grnCgstAmount = 0;
    let grnSgstAmount = 0;
    let grnIgstAmount = 0;
    let grnTaxAmount = 0;
    let grnTotalAmount = 0;
  
    for (const postedGrnItem of req.body.grnItems) {
      const product = await Product
                              .findById(postedGrnItem.productId)
                              .select('_id productName description hsnCode hsnName grams costWithoutGst taxPercentage');
  
      if (product) {
        const productId = product._id;
        const productName = product.productName;
        const description = product.description;
        const hsnCode = product.hsnCode;
        const hsnName = product.hsnName;
        const grams = product.grams;
        const quantityPo = (postedGrnItem.quantityPo) ? +postedGrnItem.quantityPo : 0;
        const ratePo = (postedGrnItem.ratePo) ? +postedGrnItem.ratePo : 0;
        const taxPercentage = (product.taxPercentage) ? +product.taxPercentage : 0;
        const quantity = (postedGrnItem.quantity) ? +postedGrnItem.quantity : 0;
        const rate = (postedGrnItem.rate) ? +postedGrnItem.rate : 0;
  
        let amountPo = round(quantityPo * ratePo, 2);
        let cgstPo = 0;
        let sgstPo = 0;
        let igstPo = 0;
        let cgstAmountPo = 0;
        let sgstAmountPo = 0;
        let igstAmountPo = 0;
        let taxAmountPo = 0;
        let totalAmountPo = 0;
        
        if (taxType === 'Intra') {
          cgstPo = round((taxPercentage / 2), 2);
          sgstPo = round((taxPercentage / 2), 2);
    
          cgstAmountPo = round(((amountPo * cgstPo) / 100), 2);
          sgstAmountPo = round(((amountPo * sgstPo) / 100), 2);
        } else {
          igstPo = round(taxPercentage, 2);
          igstAmountPo = round(((amountPo * igstPo) /100), 2);
        }
    
        taxAmountPo = round(cgstAmountPo + sgstAmountPo + igstAmountPo, 2);
        totalAmountPo = round(amountPo + taxAmountPo, 2);
    
        poAmount = poAmount + amountPo;
        poCgstAmount = poCgstAmount + cgstAmountPo;
        poSgstAmount = poSgstAmount + sgstAmountPo;
        poIgstAmount = poIgstAmount + igstAmountPo;
        poTaxAmount = poTaxAmount + taxAmountPo;
        poTotalAmount = poTotalAmount + totalAmountPo;
  
        let amount = round(quantity * rate, 2);
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        let taxAmount = 0;
        let totalAmount = 0;
        
        if (taxType === 'Intra') {
          cgst = round((taxPercentage / 2), 2);
          sgst = round((taxPercentage / 2), 2);
    
          cgstAmount = round(((amount * cgst) / 100), 2);
          sgstAmount = round(((amount * sgst) / 100), 2);
        } else {
          igst = round(taxPercentage, 2);
          igstAmount = round(((amount * igst) /100), 2);
        }
    
        taxAmount = round(cgstAmount + sgstAmount + igstAmount, 2);
        totalAmount = round(amount + taxAmount, 2);
    
        grnAmount = grnAmount + amount;
        grnCgstAmount = grnCgstAmount + cgstAmount;
        grnSgstAmount = grnSgstAmount + sgstAmount;
        grnIgstAmount = grnIgstAmount + igstAmount;
        grnTaxAmount = grnTaxAmount + taxAmount;
        grnTotalAmount = grnTotalAmount + totalAmount;
  
        const grnItem = {
          productId: productId,
          productName: productName,
          description: description,
          hsnCode: hsnCode,
          hsnName: hsnName,
          grams: grams,
          quantityPo: quantityPo,
          ratePo: ratePo,
          taxPercentagePo: taxPercentage,
          amountPo: amountPo,
          cgstPo: cgstPo,
          sgstPo: sgstPo,
          igstPo: igstPo,
          cgstAmountPo: cgstAmountPo,
          sgstAmountPo: sgstAmountPo,
          igstAmountPo: igstAmountPo,
          taxAmountPo: taxAmountPo,
          totalAmountPo: totalAmountPo,
          quantity: quantity,
          rate: rate,
          taxPercentage: taxPercentage,
          amount: amount,
          cgst: cgst,
          sgst: sgst,
          igst: igst,
          cgstAmount: cgstAmount,
          sgstAmount: sgstAmount,
          igstAmount: igstAmount,
          taxAmount: taxAmount,
          totalAmount: totalAmount
        };
        
        grnItems.push(grnItem);
      }
    }
    
    this.amountPo = poAmount;
    this.cgstAmountPo = poCgstAmount;
    this.sgstAmountPo = poSgstAmount;
    this.igstAmountPo = poIgstAmount;
    this.taxAmountPo = poTaxAmount;
    this.totalAmountPo = poTotalAmount;
    this.poAmount = round(this.otherChargesAmountPo + poTotalAmount, 2);

    this.amount = grnAmount;
    this.cgstAmount = grnCgstAmount;
    this.sgstAmount = grnSgstAmount;
    this.igstAmount = grnIgstAmount;
    this.taxAmount = grnTaxAmount;
    this.totalAmount = grnTotalAmount;
    this.grnAmount = round(this.otherChargesAmount + grnTotalAmount, 2);
  
    this.grnItems = grnItems;

    return null;
  } catch (error) {
    return error;
  }
}

grnSchema.methods.approve = function(req) {
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

grnSchema.methods.reject = function(req) {
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

grnSchema.methods.getGrnNo = function(series) {
  try {
    if (this.grnNo) {
      return this.grnNo;
    }
  
    const grnDate = this.grnDate ? new Date(this.grnDate) : new Date();
    const financialYear = calculateFiscalYearForDate(grnDate);
    const monthName = getMonthName(grnDate.getMonth());

    const grnNo = 'WYN' + '/GRN/' + financialYear + '/' + monthName + '/' + series;
    
    this.grnNo = grnNo;

    return grnNo;
  } catch (error) {
    return error;
  }
}

grnSchema.methods.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    return null;
  } catch (error) {
    return error;
  }
}

// grnSchema.statics.setPurchaseOrderItems = async function(purchaseOrder) {
//   try {
//     const grns = await this.find({ purchaseOrder: purchaseOrder }).aggregate([
//       { $group: { _id: null, maxBalance: { $max: '$balance' }}},
//       { $project: { _id: 0, maxBalance: 1 }}
//     ]);
//   } catch (error) {
//     return error;
//   }
// }

module.exports = model("Grn", grnSchema);
