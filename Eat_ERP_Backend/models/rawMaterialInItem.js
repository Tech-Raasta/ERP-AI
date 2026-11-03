import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

import RawMaterial from './rawMaterial.js';
import PurchaseOrderItem from './purchaseOrderItem.js';
// import RawMaterialInItemWeight from './rawMaterialInItemWeight.js';
import PaymentVoucherItem from './paymentVoucherItem.js';

const RawMaterialInItem = sequelize.define('raw_material_stock', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  raw_material_in_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  raw_material_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  item_name: DataTypes.STRING,
  hsn_code: DataTypes.STRING,
  item_desc: DataTypes.STRING,
  discount: DataTypes.DOUBLE,
  qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  rate: {
    type: DataTypes.DOUBLE,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  tax_per: DataTypes.DOUBLE,
  amount: DataTypes.DOUBLE,
  cgst_amt: DataTypes.DOUBLE,
  sgst_amt: DataTypes.DOUBLE,
  igst_amt: DataTypes.DOUBLE,
  tax_amt: DataTypes.DOUBLE,
  total_amt: DataTypes.DOUBLE,
  po_quantity: DataTypes.DOUBLE,
  po_rate: DataTypes.DOUBLE,
  po_amount: DataTypes.DOUBLE,
  po_cgst_amt: DataTypes.DOUBLE,
  po_sgst_amt: DataTypes.DOUBLE,
  po_igst_amt: DataTypes.DOUBLE,
  po_tax_amt: DataTypes.DOUBLE,
  po_total_amt: DataTypes.DOUBLE,
  no_of_boxes: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  gross_weight: DataTypes.DOUBLE,
  difference: DataTypes.DOUBLE,
  po_item_id: DataTypes.INTEGER,
  tax_type: DataTypes.STRING
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// RawMaterialInItem.hasMany(RawMaterialInItemWeight, { foreignKey: "raw_material_in_item_id", as: "rawMaterialInItemWeights", onDelete: 'CASCADE' });

RawMaterialInItem.prototype.getRequestData = function(rawMaterialInItem) {
  // try {
    // this.raw_material_in_id = rawMaterialInItem.raw_material_in_id;
    this.po_item_id = rawMaterialInItem.po_item_id;
    this.raw_material_id = rawMaterialInItem.raw_material_id;
    // this.item_name = rawMaterialInItem.item_name;
    // this.item_desc = rawMaterialInItem.item_desc;
    // this.hsn_code = rawMaterialInItem.hsn_code;
    this.qty = rawMaterialInItem.qty;
    // this.rate = rawMaterialInItem.rate;
    // this.tax_per = rawMaterialInItem.tax_per;
    // this.amount = rawMaterialInItem.amount;
    // this.cgst_amt = rawMaterialInItem.cgst_amt;
    // this.sgst_amt = rawMaterialInItem.sgst_amt;
    // this.igst_amt = rawMaterialInItem.igst_amt;
    // this.tax_amt = rawMaterialInItem.tax_amt;
    // this.total_amt = rawMaterialInItem.total_amt;
    this.no_of_boxes = rawMaterialInItem.no_of_boxes;
    // this.gross_weight = rawMaterialInItem.gross_weight;
    // this.difference = rawMaterialInItem.difference;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInItem.prototype.getRequestDataForRate = function(rawMaterialInItem) {
  // try {
    this.discount = rawMaterialInItem.discount;
    this.rate = rawMaterialInItem.rate;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInItem.prototype.setPaymentVoucherItemDetails = async function() {
  // try {
    const paymentVoucherItem = await PaymentVoucherItem.findOne({ where: [ {po_item_id: this.po_item_id} ]});
    if(paymentVoucherItem) {
      this.raw_material_id = paymentVoucherItem.particular_id;
      this.item_desc = paymentVoucherItem.particulars;
      // this.hsn_code = paymentVoucherItem.hsn_code;
      this.rate = paymentVoucherItem.rate;
      this.tax_per = paymentVoucherItem.tax_per;
      this.discount = paymentVoucherItem.discount;
    }

    // const rawMaterial = await RawMaterial.findByPk(this.raw_material_id);
    // if(rawMaterial) {
    //   this.hsn_code = rawMaterial.hsn_code;
    //   this.tax_per = rawMaterial.tax_per;
    // }

    let rate = this.rate;
    if (this.discount && this.discount > 0) {
      rate = rate - ((rate * this.discount) / 100);
    }

    const item = calculateItemAmount(this.qty, rate, this.tax_per, this.tax_type);

    this.amount = item.amount;
    this.cgst_amt = item.cgst_amt;
    this.sgst_amt = item.sgst_amt;
    this.igst_amt = item.igst_amt;
    this.tax_amt = item.tax_amt;
    this.total_amt = item.total_amt;
    // this.old_po_rate = rawMaterialInItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInItem.prototype.setPoItemDetails = async function() {
  // try {
    const purchaseOrderItem = await PurchaseOrderItem.findByPk(this.po_item_id);
    if(purchaseOrderItem) {
      this.item_name = purchaseOrderItem.item_name;
      this.item_desc = purchaseOrderItem.item_desc;
      this.hsn_code = purchaseOrderItem.hsn_code;
      this.rate = purchaseOrderItem.rate;
      this.tax_per = purchaseOrderItem.tax_per;
      this.po_quantity = purchaseOrderItem.qty;
      this.po_rate = purchaseOrderItem.rate;
      this.po_amount = purchaseOrderItem.amount;
      this.po_cgst_amt = purchaseOrderItem.cgst_amt;
      this.po_sgst_amt = purchaseOrderItem.sgst_amt;
      this.po_igst_amt = purchaseOrderItem.igst_amt;
      this.po_tax_amt = purchaseOrderItem.tax_amt;
      this.po_total_amt = purchaseOrderItem.total_amt;
    }

    const rawMaterial = await RawMaterial.findByPk(this.raw_material_id);
    if(rawMaterial) {
      this.item_name = rawMaterial.rm_name;
      this.hsn_code = rawMaterial.hsn_code;
      this.tax_per = rawMaterial.tax_per;
    }

    const item = calculateItemAmount(this.qty, this.rate, this.tax_per, this.tax_type);

    this.amount = item.amount;
    this.cgst_amt = item.cgst_amt;
    this.sgst_amt = item.sgst_amt;
    this.igst_amt = item.igst_amt;
    this.tax_amt = item.tax_amt;
    this.total_amt = item.total_amt;
    // this.old_po_rate = rawMaterialInItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInItem.prototype.setItemAmount = function() {
  // try {
    // const rawMaterial = await RawMaterial.findByPk(this.raw_material_id);
    // if(rawMaterial) {
    //   this.item_name = rawMaterial.item_name;
    //   this.hsn_code = rawMaterial.hsn_code;
    //   this.tax_per = rawMaterial.tax_per;
    // }

    let rate = this.rate;
    if (this.discount && this.discount > 0) {
      rate = rate - ((rate * this.discount) / 100);
    }

    const item = calculateItemAmount(this.qty, rate, this.tax_per, this.tax_type);

    this.amount = item.amount;
    this.cgst_amt = item.cgst_amt;
    this.sgst_amt = item.sgst_amt;
    this.igst_amt = item.igst_amt;
    this.tax_amt = item.tax_amt;
    this.total_amt = item.total_amt;
    // this.old_po_rate = rawMaterialInItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInItem.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    count = await PurchaseOrderItem.count({ where: { id: this.po_item_id }});
    if (count === 0) {
      return { errors : { po_item_id: { message: `Purchase Order Item does not exist` } } };
    }

    count = await RawMaterial.count({ where: { id: this.raw_material_id }});
    if (count === 0) {
      return { errors : { raw_material_id: { message: `Raw Material does not exist` } } };
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default RawMaterialInItem;