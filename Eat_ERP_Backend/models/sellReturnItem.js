const { Schema, model, models } = require("mongoose");

const sellReturnItemSchema = Schema({
  // sellReturnId: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'SellReturn',
  //   required: true
  // },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    trim: true,
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
  quantity: {
    type: Number,
    min: 1,
    required: true
  },
  mrp: {
    type: Number,
    required: true
  },
  taxPercentage: {
    type: Number,
    required: true
  },
  sellRate: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    required: true
  },
  taxableAmount: {
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
  },
  costWithoutGst: {
    type: Number,
    required: true
  },
  costAmount: {
    type: Number,
    required: true
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

exports.sellReturnItemSchema = sellReturnItemSchema;
exports.SellReturnItem = model("SellReturnItem", sellReturnItemSchema);