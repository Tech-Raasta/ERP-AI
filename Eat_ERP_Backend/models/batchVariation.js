import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

import RawMaterial from './rawMaterial.js';
import Box from './box.js';

const BatchVariation = sequelize.define('batch_variations', {
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
  box_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  variation_qty: {
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
  primary_packaging_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  primary_qty: {
    type: DataTypes.DOUBLE
  },
  primary_packaging_qty: {
    type: DataTypes.DOUBLE
  },
  secondary_packaging_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  secondary_qty: {
    type: DataTypes.DOUBLE
  },
  secondary_packaging_qty: {
    type: DataTypes.DOUBLE
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

BatchVariation.belongsTo(Box, { foreignKey: "box_id", as: "box" });
BatchVariation.belongsTo(RawMaterial, { foreignKey: "primary_packaging_id", as: "primaryPackaging" });
BatchVariation.belongsTo(RawMaterial, { foreignKey: "secondary_packaging_id", as: "secondaryPackaging" });

BatchVariation.prototype.getRequestData = function(productionAllocation) {
  // try {
    this.box_id = productionAllocation.box_id;
    this.variation_qty = productionAllocation.variation_qty;
    this.qty = productionAllocation.qty;
    this.primary_packaging_id = productionAllocation.primary_packaging_id;
    this.primary_qty = productionAllocation.primary_qty;
    this.primary_packaging_qty = productionAllocation.primary_packaging_qty;
    this.secondary_packaging_id = productionAllocation.secondary_packaging_id;
    this.secondary_qty = productionAllocation.secondary_qty;
    this.secondary_packaging_qty = productionAllocation.secondary_packaging_qty;
  // } catch (error) {
  //   return error;
  // }
}

BatchVariation.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    count = await Box.count({ where: { id: this.box_id }});
    if (count === 0) {
      return { errors : { item_id: { message: `Box does not exist` } } };
    }
    count = await RawMaterial.count({ where: { id: this.primary_packaging_id }});
    if (count === 0) {
      return { errors : { item_id: { message: `Primary Packaging does not exist` } } };
    }
    count = await RawMaterial.count({ where: { id: this.secondary_packaging_id }});
    if (count === 0) {
      return { errors : { item_id: { message: `Secondary Packaging does not exist` } } };
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default BatchVariation;