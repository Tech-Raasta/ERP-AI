import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

// import PurchaseOrder from './purchaseOrder.js';
import RawMaterial from './rawMaterial.js';
import RawMaterialInItem from './rawMaterialInItem.js';

const PurchaseOrderItem = sequelize.define('purchase_order_items', {
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
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  item_name: DataTypes.STRING,
  hsn_code: DataTypes.STRING,
  item_desc: DataTypes.STRING,
  qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  rate: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  tax_per: DataTypes.DOUBLE,
  amount: DataTypes.DOUBLE,
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

// PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: "purchase_order_id", as: "PurchaseOrder" });
// PurchaseOrderItem.belongsTo(RawMaterial, { foreignKey: "item_id", as: "RawMaterial" });
PurchaseOrderItem.hasMany(RawMaterialInItem, { foreignKey: "po_item_id", as: "rawMaterialInItems" });

PurchaseOrderItem.prototype.getRequestData = function(purchaseOrderItem) {
  // try {
    // this.purchase_order_id = purchaseOrderItem.purchase_order_id;
    this.item_id = purchaseOrderItem.item_id;
    this.item_desc = purchaseOrderItem.item_desc;
    // this.hsn_code = purchaseOrderItem.hsn_code;
    this.qty = purchaseOrderItem.qty;
    this.rate = purchaseOrderItem.rate;
    // this.tax_per = purchaseOrderItem.tax_per;
    // this.amount = purchaseOrderItem.amount;
    // this.cgst_amt = purchaseOrderItem.cgst_amt;
    // this.sgst_amt = purchaseOrderItem.sgst_amt;
    // this.igst_amt = purchaseOrderItem.igst_amt;
    // this.tax_amt = purchaseOrderItem.tax_amt;
    // this.total_amt = purchaseOrderItem.total_amt;
    this.old_po_rate = purchaseOrderItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

PurchaseOrderItem.prototype.setItemAmount = async function() {
  // try {
    const rawMaterial = await RawMaterial.findByPk(this.item_id);
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
    // this.old_po_rate = purchaseOrderItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

PurchaseOrderItem.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    count = await RawMaterial.count({ where: { id: this.item_id }});
    if (count === 0) {
      return { errors : { item_id: { message: `Raw Material does not exist` } } };
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default PurchaseOrderItem;