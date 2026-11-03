import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

import RawMaterial from './rawMaterial.js';
import RawMaterialInItemWeight from './rawMaterialInItemWeight.js';

const PackagingReturn = sequelize.define('packaging_return', {
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
  raw_material_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  expiry_date: {
    type: DataTypes.DATEONLY
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// PackagingReturn.belongsTo(Packaging, { foreignKey: "packaging_id", as: "packaging" });
PackagingReturn.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "rawMaterial" });

PackagingReturn.prototype.setReturnData = function(packagingReturn) {
  // try {
    this.packaging_id = packagingReturn.packaging_id;
    this.raw_material_id = packagingReturn.raw_material_id ? +packagingReturn.raw_material_id : null;
    this.qty = packagingReturn.qty ? +packagingReturn.qty : null;
    this.barcode = packagingReturn.barcode;
    this.expiry_date = packagingReturn.expiry_date ? packagingReturn.expiry_date : null;
  // } catch (error) {
  //   return error;
  // }
}

PackagingReturn.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    
    if (!this.raw_material_id) {
      const rawMaterialInItemWeight = await RawMaterialInItemWeight.findOne({ where: { barcode: this.barcode } });
      if (!rawMaterialInItemWeight) {
        return { errors : { barcode: { message: `Barcode does not exists` } } };
      } else {
        this.raw_material_id = rawMaterialInItemWeight.raw_material_id;
        this.expiry_date = rawMaterialInItemWeight.expiry_date;
      }
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

export default PackagingReturn;