const { Schema, model } = require("mongoose");
const Depot = require("./depot");
const Product = require("./product");
// const Sell = require("./sell");
// const { stateSchema, State } = require("./state");
// const { stockReconciliationItemSchema } = require("./stockReconciliationItem");
const { round } = require('../lib/common');

const stockReconciliationItemSchema = Schema({
  // stockReconciliationId: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'StockReconciliation',
  //   required: true
  // },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    // required: true
  },
  description: {
    type: String,
    // required: true
  },
  hsnCode: {
    type: String,
    // required: true
  },
  hsnName: {
    type: String,
    // required: true
  },
  grams: {
    type: Number,
    // required: true
  },
  stockQuantity: {
    type: Number,
    // required: true
  },
  physicalQuantity: {
    type: Number,
    min: 0,
    // required: true
  },
  difference: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    // min: 1,
    required: true
  },
  mrp: {
    type: Number,
    // required: true
  },
  taxPercentage: {
    type: Number,
    // required: true
  },
  sellRate: {
    type: Number,
    // required: true
  },
  amount: {
    type: Number,
    // required: true
  },
  discountAmount: {
    type: Number,
    // required: true
  },
  taxableAmount: {
    type: Number,
    // required: true
  },
  cgst: {
    type: Number,
    // required: true
  },
  sgst: {
    type: Number,
    // required: true
  },
  igst: {
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
  costWithoutGst: {
    type: Number,
    // required: true
  },
  costAmount: {
    type: Number,
    // required: true
  }
}, { timestamps: true });

const stockReconciliationSchema = Schema({
  stockReconciliationDate: {
    type: Date,
    required: true
  },
  depot: {
    type: Schema.Types.ObjectId,
    ref: 'Depot',
    required: true
  },
  stockReconciliationItems: {
    type: [stockReconciliationItemSchema],
    required: true,
  },
  taxType: {
    type: String,
    default: 'Intra'
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
  roundOffAmount: {
    type: Number,
    // required: true
  },
  invoiceAmount: {
    type: Number,
    // required: true
  },
  costAmount: {
    type: Number,
    required: true
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
    ref: 'StockReconciliation'
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

stockReconciliationSchema.statics.getMasterData = async function(stockReconciliation) {
  try {
    let depotCond = { status: 'Approved' };
    let productCond = { status: 'Approved' };

    if (stockReconciliation) {
      if (stockReconciliation.depot) {
        depotCond = { $or: [{ status: 'Approved' }, { _id: stockReconciliation.depot }] };
      }
      // if (stockReconciliation.sellItems) {
      //   productCond = { $or: [{ status: 'Approved' }, { _id: stockReconciliation.sellItems[0].productId }] };
      // }
    }

    const depots = await Depot.find(depotCond).select('_id depotName state');
    const products = await Product.find(productCond).select('_id productName description hsnCode grams costWithoutGst taxPercentage mrp oldPoRate');

    return { depots, products };
  } catch (error) {
    // console.log('Error', error);
    return error;
  }
}

stockReconciliationSchema.methods.getRequestData = async function(req) {
  try {
    this.stockReconciliationDate = (req.body.stockReconciliationDate) ? req.body.stockReconciliationDate : '';
    this.remarks = req.body.remarks;
  
    if (req.body.depot) {
      const depot = await Depot.findById(req.body.depot);
      if (depot) {
        this.depot = req.body.depot;
      }
    } else {
      this.depot = null;
    }
  
    let taxType = 'Intra';
    this.taxType = taxType;

    const stockReconciliationItems = [];
    let stockReconciliationAmount = 0;
    let stockReconciliationCgstAmount = 0;
    let stockReconciliationSgstAmount = 0;
    let stockReconciliationIgstAmount = 0;
    let stockReconciliationTaxAmount = 0;
    let stockReconciliationTotalAmount = 0;
    let stockReconciliationCostAmount = 0;
  
    for (const postedStockReconciliationItem of req.body.stockReconciliationItems) {
      const quantity = (postedStockReconciliationItem.difference) ? +postedStockReconciliationItem.difference : 0;

      if (!quantity) {
        continue;
      }

      const product = await Product
                              .findById(postedStockReconciliationItem.productId)
                              .select('_id productName description hsnCode hsnName grams costWithoutGst taxPercentage oldPoRate mrp');
  
      if (product) {
        const productId = product._id;
        const productName = product.productName;
        const description = product.description;
        const hsnCode = product.hsnCode;
        const hsnName = product.hsnName;
        const grams = product.grams;
        const mrp = product.mrp;
        const taxPercentage = product.taxPercentage;
        const stockQuantity = (postedStockReconciliationItem.stockQuantity) ? +postedStockReconciliationItem.stockQuantity : 0;
        const physicalQuantity = (postedStockReconciliationItem.physicalQuantity) ? +postedStockReconciliationItem.physicalQuantity : 0;
        const difference = (postedStockReconciliationItem.difference) ? +postedStockReconciliationItem.difference : 0;
        const costWithoutGst = (product.costWithoutGst) ? +product.costWithoutGst : 0;
        const costAmount = round(difference * costWithoutGst, 2);
        const sellRate = costWithoutGst;
  
        let amount = round(quantity * costWithoutGst, 2);
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
    
        stockReconciliationAmount = stockReconciliationAmount + amount;
        stockReconciliationCgstAmount = stockReconciliationCgstAmount + cgstAmount;
        stockReconciliationSgstAmount = stockReconciliationSgstAmount + sgstAmount;
        stockReconciliationIgstAmount = stockReconciliationIgstAmount + igstAmount;
        stockReconciliationTaxAmount = stockReconciliationTaxAmount + taxAmount;
        stockReconciliationTotalAmount = stockReconciliationTotalAmount + totalAmount;
        stockReconciliationCostAmount = stockReconciliationCostAmount + costAmount;
  
        const stockReconciliationItem = {
          productId: productId,
          productName: productName,
          description: description,
          hsnCode: hsnCode,
          hsnName: hsnName,
          grams: grams,
          mrp: mrp,
          taxPercentage: taxPercentage,
          stockQuantity: stockQuantity,
          physicalQuantity: physicalQuantity,
          difference: difference,
          quantity: quantity,
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
        
        stockReconciliationItems.push(stockReconciliationItem);
      }
    }
    
    this.taxType = taxType;
    this.amount = round(stockReconciliationAmount, 2);
    this.cgstAmount = round(stockReconciliationCgstAmount, 2);
    this.sgstAmount = round(stockReconciliationSgstAmount, 2);
    this.igstAmount = round(stockReconciliationIgstAmount, 2);
    this.taxAmount = round(stockReconciliationTaxAmount, 2);
    this.totalAmount = round(stockReconciliationTotalAmount, 2);
    this.costAmount = round(stockReconciliationCostAmount, 2);

    this.invoiceAmount = round(stockReconciliationTotalAmount, 0);
    this.roundOffAmount = round(this.invoiceAmount - stockReconciliationTotalAmount, 2);
    this.stockReconciliationItems = stockReconciliationItems;

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

stockReconciliationSchema.methods.approve = function(req) {
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

stockReconciliationSchema.methods.reject = function(req) {
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

// stockReconciliationSchema.methods.getStockReconciliationNo = function(series) {
//   try {
//     if (this.stockReconciliationNo) {
//       return this.stockReconciliationNo;
//     }
  
//     const stockReconciliationDate = this.stockReconciliationDate ? new Date(this.stockReconciliationDate) : new Date();
//     const financialYear = calculateFiscalYearForDate(stockReconciliationDate);
//     // const monthName = getMonthName(stockReconciliationDate.getMonth());

//     const stockReconciliationNo = 'WYN' + '/TRF/' + financialYear + '/' + series;
    
//     this.stockReconciliationNo = stockReconciliationNo;

//     return stockReconciliationNo;
//   } catch (error) {
//     return error;
//   }
// }

stockReconciliationSchema.methods.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ stockReconciliationName: this.stockReconciliationName, _id: { $ne: this._id } });
    // if (count > 0) {
    //   return { errors : { stockReconciliationName: { message: `Two stockReconciliations cannot share the same stockReconciliationName (${this.stockReconciliationName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { stockReconciliationName: { message: `Two stockReconciliations cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { stockReconciliationName: { message: `Two stockReconciliations cannot share the same skuCode (${this.skuCode})` } } }
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

module.exports = model("StockReconciliation", stockReconciliationSchema);
