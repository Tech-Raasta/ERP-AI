import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

import RawMaterial from './rawMaterial.js';
import RawMaterialInItemWeight from './rawMaterialInItemWeight.js';

const ProductionWaste = sequelize.define('production_waste', {
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

// ProductionWaste.belongsTo(Production, { foreignKey: "production_id", as: "production" });
ProductionWaste.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "rawMaterial" });

ProductionWaste.prototype.setWasteData = function(productionWaste) {
  // try {
    this.production_id = productionWaste.production_id;
    this.raw_material_id = productionWaste.raw_material_id ? +productionWaste.raw_material_id : null;
    this.qty = productionWaste.qty ? +productionWaste.qty : null;
    this.barcode = productionWaste.barcode;
    this.expiry_date = productionWaste.expiry_date ? productionWaste.expiry_date : null;
  // } catch (error) {
  //   return error;
  // }
}

ProductionWaste.prototype.validateData = async function() {
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

export default ProductionWaste;