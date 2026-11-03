import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

import RawMaterial from './rawMaterial.js';
import RawMaterialInItemWeight from './rawMaterialInItemWeight.js';

const ProductionRetain = sequelize.define('production_retain', {
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

// ProductionRetain.belongsTo(Production, { foreignKey: "production_id", as: "production" });
ProductionRetain.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "rawMaterial" });

ProductionRetain.prototype.setRetainData = function(productionRetain) {
  // try {
    this.production_id = productionRetain.production_id;
    this.raw_material_id = productionRetain.raw_material_id ? +productionRetain.raw_material_id : null;
    this.qty = productionRetain.qty ? +productionRetain.qty : null;
    this.barcode = productionRetain.barcode;
    this.expiry_date = productionRetain.expiry_date ? productionRetain.expiry_date : null;
  // } catch (error) {
  //   return error;
  // }
}

ProductionRetain.prototype.validateData = async function() {
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

export default ProductionRetain;