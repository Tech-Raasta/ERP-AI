import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
// import { calculateItemAmount } from '../lib/common.js';

// import PurchaseOrder from './purchaseOrder.js';
// import RawMaterial from './rawMaterial.js';
import Box from './box.js';
import RecipeVariation from './recipeVariation.js';
import { round } from '../lib/common.js';
// import RawMaterialInItem from './rawMaterialInItem.js';
// import Production from './production.js';

const ProductionAllocation = sequelize.define('production_allocation', {
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
  box_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  variation_qty: DataTypes.DOUBLE,
  qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  grams: DataTypes.DOUBLE,
  total_kg: DataTypes.DOUBLE,
  primary_packaging_id: DataTypes.INTEGER,
  primary_qty: DataTypes.DOUBLE,
  primary_packaging_qty: DataTypes.DOUBLE,
  secondary_packaging_id: DataTypes.INTEGER,
  secondary_qty: DataTypes.DOUBLE,
  secondary_packaging_qty: DataTypes.DOUBLE,
  depot_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  doc_document: {
    type: DataTypes.STRING
  },
  document_name: {
    type: DataTypes.STRING
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// ProductionAllocation.belongsTo(Production, { foreignKey: "production_id", as: "Production" });
ProductionAllocation.belongsTo(Box, { foreignKey: "box_id", as: "box" });
// ProductionAllocation.hasMany(RawMaterialInItem, { foreignKey: "po_item_id", as: "rawMaterialInItems" });

ProductionAllocation.prototype.getRequestData = function(productionAllocation) {
  // try {
    // this.production_id = productionAllocation.production_id;
    this.box_id = productionAllocation.box_id;
    // this.depot_id = productionAllocation.depot_id;
    this.qty = productionAllocation.qty;
    this.grams = productionAllocation.grams;
    this.total_kg = productionAllocation.total_kg;
    // this.doc_document = productionAllocation.doc_document;
    // this.document_name = productionAllocation.document_name;
  // } catch (error) {
  //   return error;
  // }
}

ProductionAllocation.prototype.setVariationDetails = async function() {
    const recipeVariation = await RecipeVariation.findOne({ where: { box_id: this.box_id } });
    
    if (recipeVariation) {
      this.variation_qty = recipeVariation.variation_qty ? recipeVariation.variation_qty : 0;
      this.primary_packaging_id = recipeVariation.primary_packaging_id ? recipeVariation.primary_packaging_id : null;
      this.primary_qty = recipeVariation.primary_qty ? recipeVariation.primary_qty : 0;
      // this.primary_packaging_qty = recipeVariation.primary_packaging_qty ? recipeVariation.primary_packaging_qty : 0;
      this.secondary_packaging_id = recipeVariation.secondary_packaging_id ? recipeVariation.secondary_packaging_id : null;
      this.secondary_qty = recipeVariation.secondary_qty ? recipeVariation.secondary_qty : 0;
      // this.secondary_packaging_qty = recipeVariation.secondary_packaging_qty ? recipeVariation.secondary_packaging_qty : 0;
    }

    // this.primary_packaging_qty = round(this.qty * this.primary_qty, 4);
    // this.secondary_packaging_qty = round(this.qty * this.secondary_qty, 4);
    this.primary_packaging_qty = 0;
    this.secondary_packaging_qty = 0;

    const box = await Box.findByPk(this.box_id);
    if (box) {
      this.grams = box.grams ? box.grams : 0;
      this.total_kg = ((this.grams * this.qty) / 1000);
    }
}

ProductionAllocation.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    count = await Box.count({ where: { id: this.box_id }});
    if (count === 0) {
      return { errors : { box_id: { message: `Box does not exist` } } };
    }

    // const box = await Box.findByPk(this.box_id);
    // if (!box) {
    //   return { errors : { box_id: { message: `Box does not exist` } } };
    // } else {
    //   this.grams = box.grams;
    //   this.total_grams = this.qty * this.grams;
    // }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default ProductionAllocation;