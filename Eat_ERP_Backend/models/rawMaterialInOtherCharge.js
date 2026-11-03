import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

// import RawMaterial from './rawMaterial.js';
import PurchaseOrderOtherCharge from './purchaseOrderOtherCharge.js';
import PaymentVoucherItem from './paymentVoucherItem.js';

const RawMaterialInOtherCharge = sequelize.define('raw_material_in_other_charges', {
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
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  hsn_code: DataTypes.STRING,
  item_desc: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  qty: {
    type: DataTypes.DOUBLE,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  rate: {
    type: DataTypes.DOUBLE,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  tax_per: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  amount: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
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
  no_of_boxes: DataTypes.DOUBLE,
  gross_weight: DataTypes.DOUBLE,
  difference: DataTypes.DOUBLE,
  po_item_id: DataTypes.INTEGER,
  tax_type: DataTypes.STRING
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// RawMaterialInOtherCharge.belongsTo(RawMaterialIn, { foreignKey: "raw_material_in_id", as: "RawMaterialIn" });
// RawMaterialInOtherCharge.belongsTo(RawMaterial, { foreignKey: "item_id", as: "RawMaterial" });

RawMaterialInOtherCharge.prototype.getRequestData = function(rawMaterialInOtherCharge) {
  // try {
    // this.raw_material_in_id = rawMaterialInOtherCharge.raw_material_in_id;
    this.po_item_id = rawMaterialInOtherCharge.po_item_id;
    // this.raw_material_id = rawMaterialInOtherCharge.raw_material_id;
    this.item_desc = rawMaterialInOtherCharge.item_desc;
    // this.hsn_code = rawMaterialInOtherCharge.hsn_code;
    // this.qty = rawMaterialInOtherCharge.qty;
    // this.rate = rawMaterialInOtherCharge.rate;
    this.tax_per = rawMaterialInOtherCharge.tax_per;
    this.amount = rawMaterialInOtherCharge.amount;
    // this.cgst_amt = rawMaterialInOtherCharge.cgst_amt;
    // this.sgst_amt = rawMaterialInOtherCharge.sgst_amt;
    // this.igst_amt = rawMaterialInOtherCharge.igst_amt;
    // this.tax_amt = rawMaterialInOtherCharge.tax_amt;
    // this.total_amt = rawMaterialInOtherCharge.total_amt;
    // this.no_of_boxes = rawMaterialInOtherCharge.no_of_boxes;
    // this.gross_weight = rawMaterialInOtherCharge.gross_weight;
    // this.difference = rawMaterialInOtherCharge.difference;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInOtherCharge.prototype.setPaymentVoucherItemDetails = async function() {
  // try {
    const paymentVoucherItem = await PaymentVoucherItem.findOne({ where: [ {po_item_id: this.po_item_id} ]});
    if(paymentVoucherItem) {
      this.item_desc = paymentVoucherItem.particulars;
      // this.hsn_code = paymentVoucherItem.hsn_code;
      // this.rate = paymentVoucherItem.rate;
      this.amount = paymentVoucherItem.amount;
      this.tax_per = paymentVoucherItem.tax_per;
      // this.discount = paymentVoucherItem.discount;
    }

    // const rawMaterial = await RawMaterial.findByPk(this.raw_material_id);
    // if(rawMaterial) {
    //   this.hsn_code = rawMaterial.hsn_code;
    //   this.tax_per = rawMaterial.tax_per;
    // }

    // const item = calculateItemAmount(this.qty, this.rate, this.tax_per, this.tax_type);
    const item = calculateItemAmount(1, this.amount, this.tax_per, this.tax_type);

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

RawMaterialInOtherCharge.prototype.setPoItemDetails = async function() {
  // try {
    const purchaseOrderOtherCharge = await PurchaseOrderOtherCharge.findByPk(this.po_item_id);
    if(purchaseOrderOtherCharge) {
      // this.item_desc = purchaseOrderOtherCharge.item_desc;
      // this.hsn_code = purchaseOrderOtherCharge.hsn_code;
      // this.rate = purchaseOrderOtherCharge.rate;
      // this.tax_per = purchaseOrderOtherCharge.tax_per;
      // this.po_quantity = purchaseOrderOtherCharge.qty;
      this.po_rate = purchaseOrderOtherCharge.rate;
      this.po_amount = purchaseOrderOtherCharge.amount;
      this.po_cgst_amt = purchaseOrderOtherCharge.cgst_amt;
      this.po_sgst_amt = purchaseOrderOtherCharge.sgst_amt;
      this.po_igst_amt = purchaseOrderOtherCharge.igst_amt;
      this.po_tax_amt = purchaseOrderOtherCharge.tax_amt;
      this.po_total_amt = purchaseOrderOtherCharge.total_amt;
    }

    const item = calculateItemAmount(1, this.amount, this.tax_per, this.tax_type);

    this.amount = item.amount;
    this.cgst_amt = item.cgst_amt;
    this.sgst_amt = item.sgst_amt;
    this.igst_amt = item.igst_amt;
    this.tax_amt = item.tax_amt;
    this.total_amt = item.total_amt;
    // this.old_po_rate = rawMaterialInOtherCharge.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInOtherCharge.prototype.setItemAmount = async function() {
  // try {
    // const rawMaterial = await RawMaterial.findByPk(this.item_id);
    // if(rawMaterial) {
    //   this.hsn_code = rawMaterial.hsn_code;
    //   this.tax_per = rawMaterial.tax_per;
    // }

    const item = calculateItemAmount(1, this.amount, this.tax_per, this.tax_type);

    this.amount = item.amount;
    this.cgst_amt = item.cgst_amt;
    this.sgst_amt = item.sgst_amt;
    this.igst_amt = item.igst_amt;
    this.tax_amt = item.tax_amt;
    this.total_amt = item.total_amt;
    // this.old_po_rate = rawMaterialInOtherCharge.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInOtherCharge.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    if (this.po_item_id) {
      count = await PurchaseOrderOtherCharge.count({ where: { id: this.po_item_id }});
      if (count === 0) {
        return { errors : { po_item_id: { message: `Purchase Order Other Charge Item does not exist` } } };
      }
    }
    
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default RawMaterialInOtherCharge;