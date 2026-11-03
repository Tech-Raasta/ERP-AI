const { Schema, model, models } = require("mongoose");

const grnItemSchema = Schema({
  // grnId: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'Grn',
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
  // oldPoRate: {
  //   type: Number,
  //   // required: true
  // },
  // originalRate: {
  //   type: Number,
  //   required: true
  // },
  quantityPo: {
    type: Number,
    required: true,
    min: 1
  },
  ratePo: {
    type: Number,
    required: true
  },
  taxPercentagePo: {
    type: Number,
    required: true
  },
  amountPo: {
    type: Number,
    required: true
  },
  cgstPo: {
    type: Number,
    required: true
  },
  sgstPo: {
    type: Number,
    required: true
  },
  igstPo: {
    type: Number,
    required: true
  },
  cgstAmountPo: {
    type: Number,
    required: true
  },
  sgstAmountPo: {
    type: Number,
    required: true
  },
  igstAmountPo: {
    type: Number,
    required: true
  },
  taxAmountPo: {
    type: Number,
    required: true
  },
  totalAmountPo: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    min: 1,
    required: true
  },
  rate: {
    type: Number,
    required: true
  },
  taxPercentage: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  cgst: {
    type: Number,
    required: true
  },
  sgst: {
    type: Number,
    required: true
  },
  igst: {
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
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

// module.exports = model("Product", grnSchema);
exports.grnItemSchema = grnItemSchema;
exports.GrnItem = model("GrnItem", grnItemSchema);