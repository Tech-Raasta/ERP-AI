import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
// import { calculateItemAmount } from '../lib/common.js';

// import PurchaseOrder from './purchaseOrder.js';
import RawMaterial from './rawMaterial.js';
// import RawMaterialInItem from './rawMaterialInItem.js';
// import Packaging from './packaging.js';

const PackagingItem = sequelize.define('packaging_item', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  packaging_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  raw_material_request_id: {
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
  fifo_not_followed: {
    type: DataTypes.TINYINT
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// PackagingItem.belongsTo(Packaging, { foreignKey: "packaging_id", as: "Packaging" });
PackagingItem.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "rawMaterial" });
// PackagingItem.hasMany(RawMaterialInItem, { foreignKey: "po_item_id", as: "rawMaterialInItems" });

PackagingItem.prototype.getRequestData = function(packagingItem) {
  // try {
    // this.packaging_id = packagingItem.packaging_id;
    this.raw_material_id = packagingItem.raw_material_id;
    this.batch_qty = packagingItem.batch_qty;
    this.qty = packagingItem.qty;
    this.barcode = packagingItem.barcode;
    this.expiry_date = packagingItem.expiry_date;
    this.fifo_not_followed = packagingItem.fifo_not_followed;
  // } catch (error) {
  //   return error;
  // }
}

// PackagingItem.prototype.setItemAmount = async function() {
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
//     // this.old_po_rate = packagingRawMaterial.old_po_rate;
//   // } catch (error) {
//   //   return error;
//   // }
// }

PackagingItem.prototype.validateData = async function() {
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

export default PackagingItem;