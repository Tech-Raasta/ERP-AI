import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount, round } from '../lib/common.js';

// import RawMaterialRecon from './rawMaterialRecon.js';
import RawMaterial from './rawMaterial.js';

const RawMaterialReconItem = sequelize.define('raw_material_recon_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  raw_material_recon_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  // type: {
  //   type: DataTypes.STRING
  // },
  raw_material_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  rm_name: DataTypes.STRING,
  system_qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  physical_qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  difference_qty: {
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

RawMaterialReconItem.belongsTo(RawMaterialReconItem, { foreignKey: "raw_material_recon_id", as: "rawMaterialRecon" });
RawMaterialReconItem.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "raw_material" });

RawMaterialReconItem.prototype.getRequestData = function(rawMaterialReconItem) {
  // try {
    // this.raw_material_recon_id = rawMaterialReconItem.raw_material_recon_id;
    // this.type = rawMaterialReconItem.type;
    this.raw_material_id = rawMaterialReconItem.raw_material_id;
    // this.item_desc = rawMaterialReconItem.item_desc;
    // this.hsn_code = rawMaterialReconItem.hsn_code;
    this.system_qty = rawMaterialReconItem.system_qty;
    this.physical_qty = rawMaterialReconItem.physical_qty;
    this.difference_qty = rawMaterialReconItem.difference_qty;
    this.barcode = rawMaterialReconItem.barcode;
    this.expiry_date = rawMaterialReconItem.expiry_date;
    // this.rate = rawMaterialReconItem.rate;
    // this.tax_per = rawMaterialReconItem.tax_per;
    // this.amount = rawMaterialReconItem.amount;
    // this.cgst_amt = rawMaterialReconItem.cgst_amt;
    // this.sgst_amt = rawMaterialReconItem.sgst_amt;
    // this.igst_amt = rawMaterialReconItem.igst_amt;
    // this.tax_amt = rawMaterialReconItem.tax_amt;
    // this.total_amt = rawMaterialReconItem.total_amt;
    // this.old_po_rate = rawMaterialReconItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialReconItem.prototype.setItemDetails = async function() {
  // try {
    const rawMaterial = await RawMaterial.findByPk(this.raw_material_id);
    if(rawMaterial) {
      this.rm_name = rawMaterial.rm_name;
    }

    this.difference_qty = round(this.physical_qty - this.system_qty, 4);
  // } catch (error) {
  //   return error;
  // }
}

// RawMaterialReconItem.prototype.setItemAmount = async function() {
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
//     // this.old_po_rate = rawMaterialReconItem.old_po_rate;
//   // } catch (error) {
//   //   return error;
//   // }
// }

RawMaterialReconItem.prototype.validateData = async function() {
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

// RawMaterialReconItem.prototype.setProductionRawMaterial = function(productionRawMaterial) {
//   // try {
//     // this.raw_material_recon_id = productionRawMaterial.raw_material_recon_id;
//     this.type = 'Stock OUT';
//     this.raw_material_id = productionRawMaterial.raw_material_id;
//     this.qty = productionRawMaterial.qty;
//     this.barcode = productionRawMaterial.barcode;
//     this.expiry_date = productionRawMaterial.expiry_date;
//   // } catch (error) {
//   //   return error;
//   // }
// }

// RawMaterialReconItem.prototype.setProductionReturn = function(productionReturn) {
//   // try {
//     // this.raw_material_recon_id = productionReturn.raw_material_recon_id;
//     // this.type = 'Stock OUT';
//     this.raw_material_id = productionReturn.raw_material_id;
//     this.barcode = productionReturn.barcode;
//     this.expiry_date = productionReturn.expiry_date;
//     this.system_qty = productionReturn.system_qty;
//     this.physical_qty = productionReturn.physical_qty;
//     this.difference_qty = productionReturn.difference_qty;
//   // } catch (error) {
//   //   return error;
//   // }
// }

export default RawMaterialReconItem;