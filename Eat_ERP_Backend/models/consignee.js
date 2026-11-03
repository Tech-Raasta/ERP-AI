const { Schema, model, models } = require("mongoose");
const { stateSchema } = require('./state');
const { countrySchema } = require('./country');

const consigneeSchema = Schema({
  name: {
    type: String,
    required: true
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
    required: true,
    unique: false
  },
  country: {
    type: countrySchema,
    // required: true,
    unique: false
  },
  gstNo: {
    type: String,
    // required: true
  }
});

// module.exports = model("Product", purchaseOrderSchema);
exports.consigneeSchema = consigneeSchema;
exports.Consignee = model("Consignee", consigneeSchema);