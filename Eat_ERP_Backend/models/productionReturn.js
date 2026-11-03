import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

import RawMaterial from './rawMaterial.js';
import RawMaterialInItemWeight from './rawMaterialInItemWeight.js';

const ProductionReturn = sequelize.define('production_return', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  production_id: {
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

// ProductionReturn.belongsTo(Production, { foreignKey: "production_id", as: "production" });
ProductionReturn.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "rawMaterial" });

ProductionReturn.prototype.setReturnData = function(productionReturn) {
  // try {
    this.production_id = productionReturn.production_id;
    this.raw_material_id = productionReturn.raw_material_id ? +productionReturn.raw_material_id : null;
    this.qty = productionReturn.qty ? +productionReturn.qty : null;
    this.barcode = productionReturn.barcode;
    this.expiry_date = productionReturn.expiry_date ? productionReturn.expiry_date : null;
  // } catch (error) {
  //   return error;
  // }
}

ProductionReturn.prototype.validateData = async function() {
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

export default ProductionReturn;