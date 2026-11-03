import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

import RawMaterial from './rawMaterial.js';

const BatchRawMaterial = sequelize.define('batch_raw_material', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  batch_processing_id: {
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
  batch_qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  barcode: {
    type: DataTypes.STRING
  },
  expiry_date: {
    type: DataTypes.DATEONLY
  },
  transfer: DataTypes.TINYINT,
  waste: DataTypes.TINYINT,
  retain: DataTypes.TINYINT,
  return: DataTypes.TINYINT,
  raw_material_request_id: DataTypes.INTEGER
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// BatchRawMaterial.belongsTo(PurchaseOrder, { foreignKey: "purchase_order_id", as: "PurchaseOrder" });
BatchRawMaterial.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "RawMaterial" });
// BatchRawMaterial.hasMany(RawMaterialInItem, { foreignKey: "po_item_id", as: "rawMaterialInItems" });

BatchRawMaterial.prototype.setProductionRawMaterial = function(productionRawMaterial) {
  // try {
    // this.batch_processing_id = productionRawMaterial.batch_processing_id;
    this.raw_material_id = productionRawMaterial.raw_material_id;
    this.batch_qty = productionRawMaterial.batch_qty;
    this.qty = productionRawMaterial.qty;
    this.barcode = productionRawMaterial.barcode;
    this.expiry_date = productionRawMaterial.expiry_date;
  // } catch (error) {
  //   return error;
  // }
}

BatchRawMaterial.prototype.setProductionReturn = function(productionReturn) {
  // try {
    // this.batch_processing_id = productionReturn.batch_processing_id;
    this.raw_material_id = productionReturn.raw_material_id;
    this.batch_qty = productionReturn.batch_qty ? (productionReturn.batch_qty * -1) : (productionReturn.qty * -1);
    this.qty = productionReturn.qty * -1;
    this.barcode = productionReturn.barcode;
    this.expiry_date = productionReturn.expiry_date;
  // } catch (error) {
  //   return error;
  // }
}

// BatchRawMaterial.prototype.setItemAmount = async function() {
//   // try {
//     const rawMaterial = await RawMaterial.findByPk(this.item_id);
//     if(rawMaterial) {
//       this.hsn_code = rawMaterial.hsn_code;
//       this.tax_per = rawMaterial.tax_per;
//     }

//     const item = calculateItemAmount(this.qty, this.rate, this.tax_per, this.tax_type);

//     this.amount = item.amount;
//     this.cgst_amt = item.cgst_amt;
//     this.sgst_amt = item.sgst_amt;
//     this.igst_amt = item.igst_amt;
//     this.tax_amt = item.tax_amt;
//     this.total_amt = item.total_amt;
//     // this.old_po_rate = productionRawMaterial.old_po_rate;
//   // } catch (error) {
//   //   return error;
//   // }
// }

BatchRawMaterial.prototype.validateData = async function() {
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

export default BatchRawMaterial;