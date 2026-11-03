const { Schema, model } = require("mongoose");
const { sellReturnItemSchema } = require("./sellReturnItem");
const { stateSchema } = require("./state");
const Product = require("./product");
const { round } = require('../lib/common');

const sellReturnUploadDetailSchema = Schema({
  sellReturnDate: {
    type: Date,
    required: true
  },
  dateOfProcessing: {
    type: Date,
    // required: true
    default: new Date().toISOString().substring(0, 10)
  },
  sellReturnNo: {
    type: String,
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
    required: true
  },
  sellType: {
    type: String,
    // required: true,
    enum: ['Adhoc', 'Invoice']
  },
  orderNo: {
    type: String,
    // required: true
  },
  dueDate: {
    type: Date,
    // required: true,
    default: new Date().toISOString().substring(0, 10)
  },
  invoiceNo: {
    type: String,
    // required: true
  },
  sell : {
    type: Schema.Types.ObjectId,
    ref: 'Sell'
  },
  isExpired: {
    type: Boolean,
    // required: true
  },
  sellReturnAmount: {
    type: Number,
    // required: true
  },
  roundOffAmount: {
    type: Number,
    // required: true
  },
  sellReturnState: {
    type: stateSchema,
    required: true,
    unique: false
  },
  discount: {
    type: Number,
    // required: true
  },
  sellReturnItems: {
    type: [sellReturnItemSchema],
    required: true,
  },
  taxType: {
    type: String,
    default: 'Intra'
    // required: true
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
  sellReturnUpload: {
    type: Schema.Types.ObjectId,
    ref: 'SellReturnUpload'
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
    ref: 'SellReturn'
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

sellReturnUploadDetailSchema.methods.setSellReturnAmountDetails = async function() {
  try {
    let taxType = this.taxType;

    const sellReturnItems = [];
    let sellReturnAmount = 0;
    let sellReturnCgstAmount = 0;
    let sellReturnSgstAmount = 0;
    let sellReturnIgstAmount = 0;
    let sellReturnTaxAmount = 0;
    let sellReturnTotalAmount = 0;
    let sellReturnCostAmount = 0;
  
    for (const postedSellReturnItem of this.sellReturnItems) {
      const product = await Product
                              .findById(postedSellReturnItem.productId)
                              .select('_id productName description hsnCode grams costWithoutGst taxPercentage mrp');
  
      if (product) {
        const productId = product._id;
        const productName = product.productName;
        const hsnCode = product.hsnCode;
        const hsnName = product.hsnName;
        const grams = (postedSellReturnItem.grams) ? +postedSellReturnItem.grams : ((product.grams) ? +product.grams : 0);
        const quantity = (postedSellReturnItem.quantity) ? +postedSellReturnItem.quantity : 0;
        const costWithoutGst = (postedSellReturnItem.costWithoutGst) ? +postedSellReturnItem.costWithoutGst : ((product.costWithoutGst) ? +product.costWithoutGst : 0);
        const costAmount = round(quantity * costWithoutGst, 2);
        const mrp = (postedSellReturnItem.mrp) ? +postedSellReturnItem.mrp : ((product.mrp) ? +product.mrp : 0);
        const taxPercentage = (postedSellReturnItem.taxPercentage) ? +postedSellReturnItem.taxPercentage : ((product.taxPercentage) ? +product.taxPercentage : 0);
        let sellRate = (postedSellReturnItem.sellRate) ? +postedSellReturnItem.sellRate : 0;
        
        if (!sellRate) {
          sellRate = round(mrp - ((mrp * this.discount)/100), 2);
          sellRate = round((sellRate / (100 + taxPercentage)) * 100, 2);
        }
        
        let amount = round(quantity * sellRate, 2);
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
    
        sellReturnAmount = sellReturnAmount + amount;
        sellReturnCgstAmount = sellReturnCgstAmount + cgstAmount;
        sellReturnSgstAmount = sellReturnSgstAmount + sgstAmount;
        sellReturnIgstAmount = sellReturnIgstAmount + igstAmount;
        sellReturnTaxAmount = sellReturnTaxAmount + taxAmount;
        sellReturnTotalAmount = sellReturnTotalAmount + totalAmount;
        sellReturnCostAmount = sellReturnCostAmount + costAmount;
  
        const sellReturnItem = {
          productId: productId,
          productName: productName,
          hsnCode: hsnCode,
          hsnName: hsnName,
          grams: grams,
          quantity: quantity,
          mrp: mrp,
          taxPercentage: taxPercentage,
          sellRate: sellRate,
          amount: amount,
          discountAmount: 0,
          taxableAmount: amount,
          cgst: cgst,
          sgst: sgst,
          igst: igst,
          cgstAmount: cgstAmount,
          sgstAmount: sgstAmount,
          igstAmount: igstAmount,
          taxAmount: taxAmount,
          totalAmount: totalAmount,
          costWithoutGst: costWithoutGst,
          costAmount: costAmount
        };

        // console.log(sellReturnItem);
        
        sellReturnItems.push(sellReturnItem);
      }
    }
  
    this.amount = sellReturnAmount;
    this.cgstAmount = sellReturnCgstAmount;
    this.sgstAmount = sellReturnSgstAmount;
    this.igstAmount = sellReturnIgstAmount;
    this.taxAmount = sellReturnTaxAmount;
    this.totalAmount = sellReturnTotalAmount;
    this.costAmount = sellReturnCostAmount;
    
    // this.sellReturnAmount = round(sellReturnTotalAmount, 0);
    // this.roundOffAmount = round(this.sellReturnAmount - sellReturnTotalAmount, 2);
    this.sellReturnAmount = round(this.shippingCharges + sellReturnTotalAmount, 2);
    this.roundOffAmount = round(round(this.sellReturnAmount, 0) - this.sellReturnAmount, 2);
    this.sellReturnAmount = round(this.sellReturnAmount, 0);
  
    this.sellReturnItems = sellReturnItems;

    return null;
  } catch (error) {
    console.log(error);
    return error;
  }
}

sellReturnUploadDetailSchema.methods.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ sellReturnName: this.sellReturnName, _id: { $ne: this._id } });
    // if (count > 0) {
    //   return { errors : { sellReturnName: { message: `Two sellReturns cannot share the same sellReturnName (${this.sellReturnName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sellReturnName: { message: `Two sellReturns cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sellReturnName: { message: `Two sellReturns cannot share the same skuCode (${this.skuCode})` } } }
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

module.exports = model("SellReturnUploadDetail", sellReturnUploadDetailSchema);
