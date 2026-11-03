import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import RawMaterial from './rawMaterial.js';
import Box from './box.js';

const RecipeVariation = sequelize.define('ingredients_variations', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  ing_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  variation_qty: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  variation_cost: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  labour: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  other: DataTypes.NUMBER,
  total: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  asin: DataTypes.STRING,
  sku_code: DataTypes.STRING,
  mrp: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  primary_packaging_id: DataTypes.INTEGER,
  primary_qty: DataTypes.NUMBER,
  primary_rate: DataTypes.NUMBER,
  primary_tax_per: DataTypes.NUMBER,
  primary_cost: DataTypes.NUMBER,
  secondary_packaging_id: DataTypes.INTEGER,
  secondary_qty: DataTypes.NUMBER,
  secondary_rate: DataTypes.NUMBER,
  secondary_tax_per: DataTypes.NUMBER,
  secondary_cost: DataTypes.NUMBER,
  box_id: DataTypes.INTEGER,
  box_status: DataTypes.STRING,
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

RecipeVariation.belongsTo(Box, { foreignKey: "box_id", as: "box" });
RecipeVariation.belongsTo(RawMaterial, { foreignKey: "primary_packaging_id", as: "primaryPackaging" });
RecipeVariation.belongsTo(RawMaterial, { foreignKey: "secondary_packaging_id", as: "secondaryPackaging" });

// Rows are built and costed by controllers/recipes.js (same fields as old PHP save_data)

export default RecipeVariation;