import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

// import RawMaterialInOut from './rawMaterialInOut.js';
import RawMaterial from './rawMaterial.js';

const RawMaterialInOutItem = sequelize.define('raw_material_in_out_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  raw_material_in_out_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  type: {
    type: DataTypes.STRING
  },
  raw_material_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  rm_name: DataTypes.STRING,
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
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

RawMaterialInOutItem.belongsTo(RawMaterialInOutItem, { foreignKey: "raw_material_in_out_id", as: "rawMaterialInOut" });
RawMaterialInOutItem.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "raw_material" });

// RawMaterialInOutItem.prototype.setProductionRawMaterial = function(productionRawMaterial) {
//   // try {
//     // this.raw_material_in_out_id = productionRawMaterial.raw_material_in_out_id;
//     this.type = 'Stock OUT';
//     this.raw_material_id = productionRawMaterial.raw_material_id;
//     this.qty = productionRawMaterial.qty;
//     this.barcode = productionRawMaterial.barcode;
//     this.expiry_date = productionRawMaterial.expiry_date;
//   // } catch (error) {
//   //   return error;
//   // }
// }

RawMaterialInOutItem.prototype.setProductionReturn = function(productionReturn) {
  // try {
    // this.raw_material_in_out_id = productionReturn.raw_material_in_out_id;
    this.type = 'Stock OUT';
    this.raw_material_id = productionReturn.raw_material_id;
    this.qty = productionReturn.qty;
    this.barcode = productionReturn.barcode;
    this.expiry_date = productionReturn.expiry_date;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInOutItem.prototype.setRawMaterialReconItemData = function(rawMaterialReconItem) {
  // try {
    // this.raw_material_in_out_id = rawMaterialReconItem.raw_material_in_out_id;
    if (rawMaterialReconItem.difference_qty < 0) {
      this.type = 'Stock OUT';
      this.qty = rawMaterialReconItem.qty * -1;
    } else {
      this.type = 'Stock IN';
      this.qty = rawMaterialReconItem.qty;
    }
    
    this.raw_material_id = rawMaterialReconItem.raw_material_id;
    this.rm_name = rawMaterialReconItem.rm_name;
    this.barcode = rawMaterialReconItem.barcode;
    this.expiry_date = rawMaterialReconItem.expiry_date;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInOutItem.prototype.getRequestData = function(rawMaterialInOutItem) {
  // try {
    // this.raw_material_in_out_id = rawMaterialInOutItem.raw_material_in_out_id;
    this.type = rawMaterialInOutItem.type;
    this.raw_material_id = rawMaterialInOutItem.raw_material_id;
    // this.item_desc = rawMaterialInOutItem.item_desc;
    // this.hsn_code = rawMaterialInOutItem.hsn_code;
    this.qty = rawMaterialInOutItem.qty;
    this.barcode = rawMaterialInOutItem.barcode;
    this.expiry_date = rawMaterialInOutItem.expiry_date;
    // this.rate = rawMaterialInOutItem.rate;
    // this.tax_per = rawMaterialInOutItem.tax_per;
    // this.amount = rawMaterialInOutItem.amount;
    // this.cgst_amt = rawMaterialInOutItem.cgst_amt;
    // this.sgst_amt = rawMaterialInOutItem.sgst_amt;
    // this.igst_amt = rawMaterialInOutItem.igst_amt;
    // this.tax_amt = rawMaterialInOutItem.tax_amt;
    // this.total_amt = rawMaterialInOutItem.total_amt;
    // this.old_po_rate = rawMaterialInOutItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInOutItem.prototype.setItemDetails = async function() {
  // try {
    const rawMaterial = await RawMaterial.findByPk(this.raw_material_id);
    if(rawMaterial) {
      this.rm_name = rawMaterial.rm_name;
    }
  // } catch (error) {
  //   return error;
  // }
}

// RawMaterialInOutItem.prototype.setItemAmount = async function() {
//   // try {
//     const rawMaterial = await RawMaterial.findByPk(this.raw_material_id);
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
//     // this.old_po_rate = rawMaterialInOutItem.old_po_rate;
//   // } catch (error) {
//   //   return error;
//   // }
// }

RawMaterialInOutItem.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;

    count = await RawMaterial.count({ where: { id: this.raw_material_id }});
    if (count === 0) {
    return { errors : { raw_material_id: { message: `Raw Material does not exist` } } };
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default RawMaterialInOutItem;