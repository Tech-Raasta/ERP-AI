const { Schema, model } = require("mongoose");
const { sellItemSchema } = require("./sellItem");
const { stateSchema, State } = require("./state");
const { countrySchema, Country } = require("./country");
const Product = require("./product");
const { consigneeSchema } = require('./consignee');
const { round } = require('../lib/common');

const sellUploadDetailSchema = Schema({
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
    required: true
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

sellUploadDetailSchema.methods.setSellAmountDetails = async function() {
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

sellUploadDetailSchema.methods.validateData = async function() {
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

sellUploadDetailSchema.methods.getSellDetails = function() {
  try {
    const sellItems = this.sellUploadDetails.map(sellUploadDetail => {
      return {
        productId: sellUploadDetail.productId,
        productName: sellUploadDetail.productName,
        description: sellUploadDetail.description,
        hsnCode: sellUploadDetail.hsnCode,
        hsnName: sellUploadDetail.hsnName,
        grams: sellUploadDetail.grams,
        quantity: sellUploadDetail.quantity,
        mrp: sellUploadDetail.mrp,
        taxPercentage: sellUploadDetail.taxPercentage,
        sellRate: sellUploadDetail.sellRate,
        amount: sellUploadDetail.amount,
        discountAmount: sellUploadDetail.discountAmount,
        taxableAmount: sellUploadDetail.taxableAmount,
        cgst: sellUploadDetail.cgst,
        sgst: sellUploadDetail.sgst,
        igst: sellUploadDetail.igst,
        cgstAmount: sellUploadDetail.cgstAmount,
        sgstAmount: sellUploadDetail.sgstAmount,
        igstAmount: sellUploadDetail.igstAmount,
        taxAmount: sellUploadDetail.taxAmount,
        totalAmount: sellUploadDetail.totalAmount,
        costWithoutGst: sellUploadDetail.costWithoutGst,
        costAmount: sellUploadDetail.costAmount
      }
    });

    const updatedObj = {
      sellDate: this.sellDate,
      dateOfProcessing: this.dateOfProcessing,
      depot: this.depot,
      distributor: this.distributor,
      orderNo: this.orderNo,
      orderDate: this.orderDate,
      dueDate: this.dueDate,
      invoiceNo: this.invoiceNo,
      invoiceDate: this.invoiceDate,
      sellAmount: this.sellAmount,
      roundOffAmount: this.roundOffAmount,
      invoiceAmount: this.invoiceAmount,
      name: this.name,
      address: this.address,
      city: this.city,
      pincode: this.pincode,
      state: this.state,
      country: this.country,
      mobileNo: this.mobileNo,
      discount: this.discount,
      gstNo: this.gstNo,
      uniqueRefNo: this.uniqueRefNo,
      sellState: this.sellState,
      taxType: this.taxType,
      sellItems: sellItems,
      amount: this.amount,
      cgstAmount: this.cgstAmount,
      sgstAmount: this.sgstAmount,
      igstAmount: this.igstAmount,
      taxAmount: this.taxAmount,
      totalAmount: this.totalAmount,
      costAmount: this.costAmount,
      shippingCharges: this.shippingCharges,
      shippingSameAsBilling: this.shippingSameAsBilling,
      deliveryStatus: this.deliveryStatus,
      dispatchDetails: this.dispatchDetails,
      consignee: this.consignee,
      basisOfSells: this.basisOfSells,
      refInvoiceNo: this.refInvoiceNo,
      refInvoiceDetails: this.refInvoiceDetails,
      refInvoiceDate: this.refInvoiceDate,
      emailFrom: this.emailFrom,
      emailApprovedBy: this.emailApprovedBy,
      emailDate: this.emailDate,
      sellUpload: this.sellUpload,
      status: this.status,
      isDeleted: this.isDeleted,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      remarks: this.remarks
    };

    return updatedObj;

    // // let sell = await Sell.findOneAndUpdate({ depotTransfer: this._id }, updatedObj, {});
    // let sell = await Sell.findOne({ depotTransfer: this._id });
    // if (!sell) {
    //   sell = await new Sell();
    // }
    
    // if (this.depotOut.state._id.toString() === this.depotIn.state._id.toString()) {
    //   return null;
    // }

    // sell.sellDate = this.depotTransferDate;
    // sell.dateOfProcessing = this.depotTransferDate;
    // sell.depot = this.depotOut;
    // sell.sellAmount = this.totalAmount;
    // sell.roundOffAmount = this.roundOffAmount;
    // sell.invoiceAmount = this.invoiceAmount;
    // sell.sellState = this.sellState;
    // sell.discount = 0;
    // sell.taxType = this.taxType;
    // sell.amount = this.amount;
    // sell.cgstAmount = this.cgstAmount;
    // sell.sgstAmount = this.sgstAmount;
    // sell.igstAmount = this.igstAmount;
    // sell.taxAmount = this.taxAmount;
    // sell.totalAmount = this.totalAmount;
    // sell.costAmount = this.costAmount;
    // sell.shippingCharges = 0;
    // sell.shippingSameAsBilling = true;
    // sell.isDepotTransfer = true;
    // sell.depotTransfer = this._id;
    // sell.status = this.status;
    // sell.isDeleted = this.isDeleted;
    // sell.createdBy = this.createdBy;
    // sell.updatedBy = this.updatedBy;

    // sell.sellItems = this.sellUploadDetails.map(sellUploadDetail => {
    //   return {
    //     productId: sellUploadDetail.productId,
    //     quantity: (sellUploadDetail.quantity) ? sellUploadDetail.quantity : 0,
    //     costWithoutGst: (sellUploadDetail.costWithoutGst) ? sellUploadDetail.costWithoutGst : 0,
    //     mrp: (sellUploadDetail.mrp) ? sellUploadDetail.mrp : 0
    //   }
    // });

    // // console.log(sell.sellItems);

    // let error = await sell.setSellAmountDetails();
    // // console.log(error);
    // if (error) {
    //   return error;
    // }

    // return sell;
  } catch (error) {
    return error;
  }
}

module.exports = model("SellUploadDetail", sellUploadDetailSchema);
