import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

// import PurchaseOrder from './purchaseOrder.js';
// import RawMaterial from './rawMaterial.js';

const PurchaseOrderOtherCharge = sequelize.define('purchase_order_other_charges', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  purchase_order_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  item_id: {
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
  old_po_rate: DataTypes.DOUBLE,
  tax_type: DataTypes.STRING
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// PurchaseOrderOtherCharge.belongsTo(PurchaseOrder, { foreignKey: "purchase_order_id", as: "PurchaseOrder" });
// PurchaseOrderOtherCharge.belongsTo(RawMaterial, { foreignKey: "item_id", as: "RawMaterial" });

PurchaseOrderOtherCharge.prototype.getRequestData = function(purchaseOrderOtherCharge) {
  // try {
    // this.purchase_order_id = purchaseOrderOtherCharge.purchase_order_id;
    // this.item_id = purchaseOrderOtherCharge.item_id;
    this.item_desc = purchaseOrderOtherCharge.item_desc;
    // this.hsn_code = purchaseOrderOtherCharge.hsn_code;
    // this.qty = purchaseOrderOtherCharge.qty;
    // this.rate = purchaseOrderOtherCharge.rate;
    this.tax_per = purchaseOrderOtherCharge.tax_per;
    this.amount = purchaseOrderOtherCharge.amount;
    // this.cgst_amt = purchaseOrderOtherCharge.cgst_amt;
    // this.sgst_amt = purchaseOrderOtherCharge.sgst_amt;
    // this.igst_amt = purchaseOrderOtherCharge.igst_amt;
    // this.tax_amt = purchaseOrderOtherCharge.tax_amt;
    // this.total_amt = purchaseOrderOtherCharge.total_amt;
    this.old_po_rate = purchaseOrderOtherCharge.old_po_rate;
    // this.tax_type = purchaseOrderOtherCharge.tax_type;
  // } catch (error) {
  //   return error;
  // }
}

PurchaseOrderOtherCharge.prototype.setItemAmount = function() {
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
    // this.old_po_rate = purchaseOrderOtherCharge.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

PurchaseOrderOtherCharge.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = 0;
    // count = await RawMaterial.count({ where: { id: this.item_id }});
    // if (count === 0) {
    //   return { errors : { item_id: { message: `Raw Material does not exist` } } };
    // }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default PurchaseOrderOtherCharge;