const { Schema, model } = require("mongoose");
const { sellItemSchema } = require("./sellItem");
const { stateSchema, State } = require("./state");
const { countrySchema, Country } = require("./country");
const Depot = require("./depot");
const Distributor = require("./distributor");
const Product = require("./product");
const { consigneeSchema } = require('./consignee');
const { calculateFiscalYearForDate, round } = require('../lib/common');

const sellSchema = Schema({
  sellDate: {
    type: Date,
    required: true
  },
  dateOfProcessing: {
    type: Date,
    // required: true
    default: new Date().toISOString().substring(0, 10)
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
  orderNo: {
    type: String,
    // required: true
  },
  orderDate: {
    type: Date,
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
  invoiceDate: {
    type: Date,
    // required: true
  },
  sellAmount: {
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
  name: {
    type: String,
    // required: true
  },
  address: {
    type: String,
    // required: true
  },
  city: {
    type: String,
    // required: true
  },
  pincode: {
    type: String,
    // required: true
  },
  state: {
    type: stateSchema,
    // required: true,
    unique: false
  },
  country: {
    type: countrySchema,
    // required: true,
    unique: false
  },
  mobileNo: {
    type: String,
    // required: true
  },
  discount: {
    type: Number,
    // required: true
  },
  gstNo: {
    type: String,
    // required: true
  },
  uniqueRefNo: {
    type: String,
    // required: true
  },
  sellState: {
    type: stateSchema,
    required: true,
    unique: false
  },
  taxType: {
    type: String,
    default: 'Intra'
    // required: true
  },
  sellItems: {
    type: [sellItemSchema],
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
  shippingSameAsBilling: {
    type: Boolean,
    required: true
  },
  consignee: {
    type: consigneeSchema,
    // required: true
  },
  basisOfSells: {
    type: String,
    // required: true,
    enum: ['PO Number', 'Email']
  },
  refInvoiceNo: {
    type: String,
    // required: true
  },
  refInvoiceDetails: {
    type: String,
    // required: true
  },
  refInvoiceDate: {
    type: Date,
    // required: true
  },
  emailFrom: {
    type: String,
    // required: true
  },
  emailApprovedBy: {
    type: String,
    // required: true
  },
  emailDate: {
    type: Date,
    // required: true
  },
  isDepotTransfer: {
    type: Boolean,
    default: false
  },
  depotTransfer : {
    type: Schema.Types.ObjectId,
    ref: 'DepotTransfer'
  },
  sellUpload: {
    type: Schema.Types.ObjectId,
    ref: 'SellUpload'
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
    ref: 'Sell'
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

sellSchema.statics.getMasterData = async function(sell) {
  try {
    let depotCond = { status: 'Approved' };
    let distributorCond = { status: 'Approved' };
    let stateCond = { status: 'Approved' };
    let countryCond = { status: 'Approved' };
    let productCond = { status: 'Approved' };

    if (sell) {
      if (sell.depot) {
        depotCond = { $or: [{ status: 'Approved' }, { _id: sell.depot }] };
      }
      if (sell.distributor) {
        distributorCond = { $or: [{ status: 'Approved' }, { _id: sell.distributor }] };
      }
      if (sell.state && sell.state._id) {
        stateCond = { $or: [{ status: 'Approved' }, { _id: sell.state._id }] };
      }
      if (sell.country && sell.country._id) {
        countryCond = { $or: [{ status: 'Approved' }, { _id: sell.country._id }] };
      }
      // if (sell.sellItems) {
      //   productCond = { $or: [{ status: 'Approved' }, { _id: sell.sellItems[0].productId }] };
      // }
    }

    const depots = await Depot.find(depotCond).select('_id depotName state');
    const distributors = await Distributor.find(distributorCond).select('_id distributorName state class discount consignees');
    const states = await State.find(stateCond).select('_id stateName stateCode country');
    const countries = await Country.find(countryCond).select('_id countryName countryCode');
    const products = await Product.find(productCond).select('_id productName description hsnCode grams costWithoutGst taxPercentage mrp');

    return { depots, distributors, states, countries, products };
  } catch (error) {
    // console.log('Error', error);
    return error;
  }
}

sellSchema.methods.getRequestData = async function(req) {
  try {
    this.sellDate = (req.body.sellDate) ? req.body.sellDate : '';
    this.name = req.body.name;
    this.address = req.body.address;
    this.city = req.body.city;
    this.pincode = req.body.pincode;

    if (req.body.state) {
      this.state = await State.findById(req.body.state).select('_id stateName stateCode country');
    }
    if (req.body.country) {
      this.country = await Country.findById(req.body.country).select('_id countryName countryCode');
    }
    
    this.mobileNo = req.body.mobileNo;
    this.discount = (req.body.discount) ? +req.body.discount : 0;
    this.gstNo = req.body.gstNo;
    this.uniqueRefNo = req.body.uniqueRefNo;
    this.shippingCharges = (req.body.shippingCharges) ? req.body.shippingCharges : 0;
    this.dueDate = (req.body.dueDate) ? req.body.dueDate : null;
    // this.shippingSameAsBilling = (req.body.shippingSameAsBilling) ? req.body.shippingSameAsBilling : null;
    this.shippingSameAsBilling = req.body.shippingSameAsBilling;
    // this.consignee = req.body.consignee;
    this.basisOfSells = req.body.basisOfSells;
    this.orderNo = req.body.orderNo;
    this.orderDate = (req.body.orderDate) ? req.body.orderDate : null;
    this.refInvoiceNo = req.body.refInvoiceNo;
    this.refInvoiceDetails = req.body.refInvoiceDetails;
    this.refInvoiceDate = (req.body.refInvoiceDate) ? req.body.refInvoiceDate : null;
    this.emailFrom = req.body.emailFrom;
    this.emailApprovedBy = req.body.emailApprovedBy;
    this.emailDate = (req.body.emailDate) ? req.body.emailDate : null;
    this.remarks = req.body.remarks;

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

    let sellState = {};
    let distributorState = '';
    this.consignee = null;
    if (req.body.distributor) {
      const distributor = await Distributor.findById(req.body.distributor);
      if (distributor) {
        this.distributor = req.body.distributor;

        if (distributor.class && distributor.class.trim().toUpperCase() === 'DIRECT') {
          if (this.state && this.state.stateName) {
            distributorState = this.state.stateName;
            sellState = this.state;
          }
        } else if (!this.shippingSameAsBilling && req.body.consignee) {
          if (distributor.consignees) {
            const consignee = distributor.consignees.filter(consignee => consignee._id.toString() === req.body.consignee);
            if (consignee && consignee.length > 0) {
              this.consignee = consignee[0];
              distributorState = consignee[0].state.stateName;
              sellState = consignee[0].state;
            }
          }
        } else if (distributor.state && distributor.state.stateName) {
          distributorState = distributor.state.stateName;
          sellState = distributor.state;
        }
      }
    } else {
      this.distributor = null;
    }
    
    this.sellState = sellState;
    
    let taxType = 'Intra';
    if (distributorState === depotState) {
      taxType = "Intra";
    } else {
      taxType = "Inter"
    }

    this.taxType = taxType;

    const sellItems = [];
    for (const postedSellItem of req.body.sellItems) {
      const productId = (postedSellItem.productId) ? postedSellItem.productId : null;
      const grams = (postedSellItem.grams) ? +postedSellItem.grams : null;
      const quantity = (postedSellItem.quantity) ? +postedSellItem.quantity : 0;
      const costWithoutGst = (postedSellItem.costWithoutGst) ? +postedSellItem.costWithoutGst : null;
      const mrp = (postedSellItem.mrp) ? +postedSellItem.mrp : null;
      const taxPercentage = (postedSellItem.taxPercentage) ? +postedSellItem.taxPercentage : null;

      const sellItem = {
        productId: productId,
        grams: grams,
        quantity: quantity,
        mrp: mrp,
        taxPercentage: taxPercentage,
        costWithoutGst: costWithoutGst
      };
      
      sellItems.push(sellItem);
    }

    this.sellItems = sellItems;

    const error = await this.setSellAmountDetails();
    if (error) {
      return error;
    }
  
    // const sellItems = [];
    // let sellAmount = 0;
    // let sellCgstAmount = 0;
    // let sellSgstAmount = 0;
    // let sellIgstAmount = 0;
    // let sellTaxAmount = 0;
    // let sellTotalAmount = 0;
    // let sellCostAmount = 0;
  
    // for (const postedSellItem of req.body.sellItems) {
    //   const product = await Product
    //                           .findById(postedSellItem.productId)
    //                           .select('_id productName description hsnCode grams costWithoutGst taxPercentage mrp');
  
    //   if (product) {
    //     const productId = product._id;
    //     const productName = product.productName;
    //     const hsnCode = product.hsnCode;
    //     const hsnName = product.hsnName;
    //     const grams = (postedSellItem.grams) ? +postedSellItem.grams : ((product.grams) ? +product.grams : 0);
    //     const quantity = (postedSellItem.quantity) ? +postedSellItem.quantity : 0;
    //     const costWithoutGst = (postedSellItem.costWithoutGst) ? +postedSellItem.costWithoutGst : ((product.costWithoutGst) ? +product.costWithoutGst : 0);
    //     const costAmount = round(quantity * costWithoutGst, 2);
    //     const mrp = (postedSellItem.mrp) ? +postedSellItem.mrp : ((product.mrp) ? +product.mrp : 0);
    //     const taxPercentage = (postedSellItem.taxPercentage) ? +postedSellItem.taxPercentage : ((product.taxPercentage) ? +product.taxPercentage : 0);

    //     if (!this.discount) this.discount = 0;
    //     const sellRate = round(mrp - ((mrp * this.discount)/100), 2);
  
    //     let amount = round(quantity * sellRate, 2);
    //     let cgst = 0;
    //     let sgst = 0;
    //     let igst = 0;
    //     let cgstAmount = 0;
    //     let sgstAmount = 0;
    //     let igstAmount = 0;
    //     let taxAmount = 0;
    //     let totalAmount = 0;
        
    //     if (taxType === 'Intra') {
    //       cgst = round((taxPercentage / 2), 2);
    //       sgst = round((taxPercentage / 2), 2);
    
    //       cgstAmount = round(((amount * cgst) / 100), 2);
    //       sgstAmount = round(((amount * sgst) / 100), 2);
    //     } else {
    //       igst = round(taxPercentage, 2);
    //       igstAmount = round(((amount * igst) /100), 2);
    //     }
    
    //     taxAmount = round(cgstAmount + sgstAmount + igstAmount, 2);
    //     totalAmount = round(amount + taxAmount, 2);
    
    //     sellAmount = sellAmount + amount;
    //     sellCgstAmount = sellCgstAmount + cgstAmount;
    //     sellSgstAmount = sellSgstAmount + sgstAmount;
    //     sellIgstAmount = sellIgstAmount + igstAmount;
    //     sellTaxAmount = sellTaxAmount + taxAmount;
    //     sellTotalAmount = sellTotalAmount + totalAmount;
    //     sellCostAmount = sellCostAmount + costAmount;
  
    //     const sellItem = {
    //       productId: productId,
    //       productName: productName,
    //       hsnCode: hsnCode,
    //       hsnName: hsnName,
    //       grams: grams,
    //       quantity: quantity,
    //       mrp: mrp,
    //       taxPercentage: taxPercentage,
    //       sellRate: sellRate,
    //       amount: amount,
    //       discountAmount: 0,
    //       taxableAmount: amount,
    //       cgst: cgst,
    //       sgst: sgst,
    //       igst: igst,
    //       cgstAmount: cgstAmount,
    //       sgstAmount: sgstAmount,
    //       igstAmount: igstAmount,
    //       taxAmount: taxAmount,
    //       totalAmount: totalAmount,
    //       costWithoutGst: costWithoutGst,
    //       costAmount: costAmount
    //     };
        
    //     sellItems.push(sellItem);
    //   }
    // }
  
    // this.amount = sellAmount;
    // this.cgstAmount = sellCgstAmount;
    // this.sgstAmount = sellSgstAmount;
    // this.igstAmount = sellIgstAmount;
    // this.taxAmount = sellTaxAmount;
    // this.totalAmount = sellTotalAmount;
    // this.costAmount = sellCostAmount;
    
    // this.sellAmount = round(this.shippingCharges + sellTotalAmount, 2);
    // this.invoiceAmount = round(this.sellAmount, 0)
    // this.roundOffAmount = round(this.invoiceAmount - this.sellAmount, 2);
  
    // this.sellItems = sellItems;

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

sellSchema.methods.setSellAmountDetails = async function() {
  try {
    let taxType = this.taxType;

    const sellItems = [];
    let sellAmount = 0;
    let sellCgstAmount = 0;
    let sellSgstAmount = 0;
    let sellIgstAmount = 0;
    let sellTaxAmount = 0;
    let sellTotalAmount = 0;
    let sellCostAmount = 0;
  
    // let taxType = 'Intra';
    // if (this.sellState._id.toString() === this.depot.state._id.toString()) {
    //   taxType = "Intra";
    // } else {
    //   taxType = "Inter"
    // }

    for (const sellItem of this.sellItems) {
      const product = await Product
                              .findById(sellItem.productId)
                              .select('_id productName description hsnCode hsnName grams costWithoutGst taxPercentage mrp');
      
      if (product) {
        const productId = product._id;
        const productName = product.productName;
        const description = product.description;
        const hsnCode = product.hsnCode;
        const hsnName = product.hsnName;
        const grams = (sellItem.grams) ? +sellItem.grams : ((product.grams) ? +product.grams : 0);
        const quantity = (sellItem.quantity) ? +sellItem.quantity : 0;
        const costWithoutGst = (sellItem.costWithoutGst) ? +sellItem.costWithoutGst : ((product.costWithoutGst) ? +product.costWithoutGst : 0);
        const costAmount = round(quantity * costWithoutGst, 2);
        const mrp = (sellItem.mrp) ? +sellItem.mrp : ((product.mrp) ? +product.mrp : 0);
        const taxPercentage = (sellItem.taxPercentage) ? +sellItem.taxPercentage : ((product.taxPercentage) ? +product.taxPercentage : 0);
        let sellRate = (sellItem.sellRate) ? +sellItem.sellRate : 0;

        if (!this.discount) this.discount = 0;

        if (!sellRate) {
          sellRate = mrp - ((mrp * this.discount)/100);
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
    
        sellAmount = sellAmount + amount;
        sellCgstAmount = sellCgstAmount + cgstAmount;
        sellSgstAmount = sellSgstAmount + sgstAmount;
        sellIgstAmount = sellIgstAmount + igstAmount;
        sellTaxAmount = sellTaxAmount + taxAmount;
        sellTotalAmount = sellTotalAmount + totalAmount;
        sellCostAmount = sellCostAmount + costAmount;

        sellItem.productId = productId;
        sellItem.productName = productName;
        sellItem.description = description;
        sellItem.hsnCode = hsnCode;
        sellItem.hsnName = hsnName;
        sellItem.grams = grams;
        sellItem.quantity = quantity;
        sellItem.mrp = mrp;
        sellItem.taxPercentage = taxPercentage;
        sellItem.sellRate = sellRate;
        sellItem.amount = amount;
        sellItem.discountAmount = 0;
        sellItem.taxableAmount = amount;
        sellItem.cgst = cgst;
        sellItem.sgst = sgst;
        sellItem.igst = igst;
        sellItem.cgstAmount = cgstAmount;
        sellItem.sgstAmount = sgstAmount;
        sellItem.igstAmount = igstAmount;
        sellItem.taxAmount = taxAmount;
        sellItem.totalAmount = totalAmount;
        sellItem.costWithoutGst = costWithoutGst;
        sellItem.costAmount = costAmount;
  
        // const sellItem = {
        //   productId: productId,
        //   productName: productName,
        //   description: description,
        //   hsnCode: hsnCode,
        //   hsnName: hsnName,
        //   grams: grams,
        //   quantity: quantity,
        //   mrp: mrp,
        //   taxPercentage: taxPercentage,
        //   sellRate: sellRate,
        //   amount: amount,
        //   discountAmount: 0,
        //   taxableAmount: amount,
        //   cgst: cgst,
        //   sgst: sgst,
        //   igst: igst,
        //   cgstAmount: cgstAmount,
        //   sgstAmount: sgstAmount,
        //   igstAmount: igstAmount,
        //   taxAmount: taxAmount,
        //   totalAmount: totalAmount,
        //   costWithoutGst: costWithoutGst,
        //   costAmount: costAmount
        // };
        
        sellItems.push(sellItem);
      }
    }
  
    this.amount = sellAmount;
    this.cgstAmount = sellCgstAmount;
    this.sgstAmount = sellSgstAmount;
    this.igstAmount = sellIgstAmount;
    this.taxAmount = sellTaxAmount;
    this.totalAmount = sellTotalAmount;
    this.costAmount = sellCostAmount;
    
    this.sellAmount = round(this.shippingCharges + sellTotalAmount, 2);
    this.invoiceAmount = round(this.sellAmount, 0)
    this.roundOffAmount = round(this.invoiceAmount - this.sellAmount, 2);
  
    this.sellItems = sellItems;

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

sellSchema.methods.approve = function(req) {
  try {
    if (this.isDeleted) {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.approvedBy = req.userData.userId;
    this.approvedAt = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

sellSchema.methods.reject = function(req) {
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

sellSchema.methods.getInvoiceNo = function(series) {
  try {
    if (this.invoiceNo) {
      return this.invoiceNo;
    }
  
    const invoiceDate = this.invoiceDate ? new Date(this.invoiceDate) : new Date();
    const financialYear = calculateFiscalYearForDate(invoiceDate);
    // const monthName = getMonthName(invoiceDate.getMonth());

    const invoiceNo = 'WYN' + '/' + financialYear + '/' + series;
    
    this.invoiceNo = invoiceNo;
    this.invoiceDate = invoiceDate.toISOString().substring(0, 10);

    return invoiceNo;
  } catch (error) {
    return error;
  }
}

sellSchema.methods.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ sellName: this.sellName, _id: { $ne: this._id } });
    // if (count > 0) {
    //   return { errors : { sellName: { message: `Two sells cannot share the same sellName (${this.sellName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sellName: { message: `Two sells cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sellName: { message: `Two sells cannot share the same skuCode (${this.skuCode})` } } }
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

module.exports = model("Sell", sellSchema);
