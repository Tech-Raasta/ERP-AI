import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

// import PaymentVoucher from './paymentVoucher.js';
import RawMaterial from './rawMaterial.js';
import PurchaseOrderItem from './purchaseOrderItem.js';
import PurchaseOrderOtherCharge from './purchaseOrderOtherCharge.js';

const PaymentVoucherItem = sequelize.define('payment_voucher_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  payment_voucher_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  particulars: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  particular_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
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
  discount: DataTypes.DOUBLE,
  tax_per: DataTypes.DOUBLE,
  amount: DataTypes.DOUBLE,
  cgst_amt: DataTypes.DOUBLE,
  sgst_amt: DataTypes.DOUBLE,
  igst_amt: DataTypes.DOUBLE,
  tax_amt: DataTypes.DOUBLE,
  total_amt: DataTypes.DOUBLE,
  tax_type: DataTypes.STRING,
  po_item_id: DataTypes.INTEGER,
  type: DataTypes.STRING
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// PaymentVoucherItem.belongsTo(PaymentVoucher, { foreignKey: "payment_voucher_id", as: "PaymentVoucher" });
// PaymentVoucherItem.belongsTo(RawMaterial, { foreignKey: "particular_id", as: "RawMaterial" });


PaymentVoucherItem.prototype.setRawMaterialInItemData = async function(rawMaterialInItem) {
  // this.payment_voucher_id = null;
  
  this.po_item_id = rawMaterialInItem.po_item_id;
  this.type = rawMaterialInItem.type;

  if (rawMaterialInItem.raw_material && rawMaterialInItem.raw_material.rm_name) {
    this.particulars = rawMaterialInItem.raw_material.rm_name;
  } else {
    this.particulars = rawMaterialInItem.item_desc;
  }
  
  this.qty = rawMaterialInItem.qty;
  this.rate = rawMaterialInItem.rate;
  this.discount = rawMaterialInItem.discount;
  this.amount = rawMaterialInItem.amount;
  this.tax_per = rawMaterialInItem.tax_per;
  this.cgst_amt = rawMaterialInItem.cgst_amt;
  this.sgst_amt = rawMaterialInItem.sgst_amt;
  this.igst_amt = rawMaterialInItem.igst_amt;
  this.tax_amt = rawMaterialInItem.tax_amt;
  this.total_amt = rawMaterialInItem.total_amt;
  this.particular_id = rawMaterialInItem.raw_material_id;
  this.tax_type = rawMaterialInItem.tax_type;
}

PaymentVoucherItem.prototype.getRequestData = function(paymentVoucherItem) {
  // try {
    // this.payment_voucher_id = paymentVoucherItem.payment_voucher_id;
    // this.particular_id = paymentVoucherItem.particular_id;
    
    this.po_item_id = paymentVoucherItem.po_item_id;
    this.type = paymentVoucherItem.type;
    this.particular_id = paymentVoucherItem.particular_id;

    this.particulars = paymentVoucherItem.particulars;
    // this.hsn_code = paymentVoucherItem.hsn_code;
    this.qty = paymentVoucherItem.qty;
    this.rate = paymentVoucherItem.rate;
    this.discount = paymentVoucherItem.discount;
    this.tax_per = paymentVoucherItem.tax_per;
    // this.amount = paymentVoucherItem.amount;
    // this.cgst_amt = paymentVoucherItem.cgst_amt;
    // this.sgst_amt = paymentVoucherItem.sgst_amt;
    // this.igst_amt = paymentVoucherItem.igst_amt;
    // this.tax_amt = paymentVoucherItem.tax_amt;
    // this.total_amt = paymentVoucherItem.total_amt;
    // this.old_po_rate = paymentVoucherItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

PaymentVoucherItem.prototype.setItemAmount = async function() {
  // try {
    // const rawMaterial = await RawMaterial.findByPk(this.particular_id);
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
    // this.old_po_rate = paymentVoucherItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

PaymentVoucherItem.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // console.log(this);

    let count = 0;
    if(this.particular_id) {
      count = await RawMaterial.count({ where: { id: this.particular_id }});
      if (count === 0) {
        return { errors : { particulars: { message: `Raw Material does not exist` } } };
      }
    }
    if(this.po_item_id && this.type.trim().toUpperCase() === 'ITEM') {
      count = await PurchaseOrderItem.count({ where: { id: this.po_item_id }});
      if (count === 0) {
        return { errors : { particulars: { message: `Purchase Order Item does not exist` } } };
      }
    }
    if(this.po_item_id && this.type.trim().toUpperCase() === 'OTHER') {
      count = await PurchaseOrderOtherCharge.count({ where: { id: this.po_item_id }});
      if (count === 0) {
        return { errors : { particulars: { message: `Purchase Order Other Charge Item does not exist` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default PaymentVoucherItem;