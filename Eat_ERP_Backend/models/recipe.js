import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

import Product from './product.js';
import RecipeDetail from './recipeDetail.js';
import RecipeVariation from './recipeVariation.js';

// Recipe Master (old PHP Ingredients_master / table ingredients_master)
const Recipe = sequelize.define('ingredients_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    validate: {
      notNull: { msg: 'Product is required' }
    }
  },
  total_batch_in_grams: DataTypes.NUMBER,
  per_bar: DataTypes.NUMBER,
  total_batch_bar: DataTypes.NUMBER,
  packaging: DataTypes.TINYINT,
  control_unit: {
    type: DataTypes.STRING,
    validate: {
      isIn: { args: [['Piece', 'Grams']], msg: 'Control Unit must be Piece or Grams' }
    }
  },
  grams_per_unit: DataTypes.NUMBER,
  process_loss: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: { msg: 'Process Loss is required' }
    }
  },
  cost_per_gram: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  total_kgs: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  total_percent: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  total_cost: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_date: DataTypes.DATE,
  updated_by: DataTypes.INTEGER,
  updated_date: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  ref_id: DataTypes.INTEGER
},
{
  timestamps: true,
  createdAt: 'created_date',
  updatedAt: 'updated_date',
  freezeTableName: true
});

Recipe.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Recipe.hasMany(RecipeDetail, { foreignKey: "ing_id", as: "recipeDetails" });
Recipe.hasMany(RecipeVariation, { foreignKey: "ing_id", as: "recipeVariations" });

// Header fields of old PHP Ingredients_master_model::save_data.
// Costs (cost_per_gram, total_kgs, total_percent, total_cost) are calculated by the controller.
Recipe.prototype.getRequestData = function(req) {
  const body = req.body;
  const num = (value) => (value !== undefined && value !== null && value !== '' && !isNaN(+value)) ? +value : null;

  // Product cannot be changed once the recipe exists (old PHP form locks it on edit)
  if (this.isNewRecord) {
    this.product_id = body.product_id ? +body.product_id : null;
  }
  this.control_unit = body.control_unit ? body.control_unit.toString().trim() : '';
  // Old PHP form: Grams always means 100 grams per unit (field hidden)
  this.grams_per_unit = this.control_unit === 'Grams' ? 100 : num(body.grams_per_unit);
  this.process_loss = num(body.process_loss);
  this.remarks = body.remarks ? body.remarks.toString().trim() : '';
}

Recipe.prototype.validateData = async function() {
  const error = await this.validate().then(() => null, error => error);
  if (error) {
    return error;
  }

  if (this.control_unit === 'Piece' && !(this.grams_per_unit > 0)) {
    return { errors : { grams_per_unit: { message: `Grams Per Unit is required` } } };
  }

  // Old PHP check_product_id_availablity: one Approved recipe per product
  const count = await Recipe.count({ where: { product_id: this.product_id, status: 'Approved', id: { [Op.ne]: (this.id ? this.id : 0) } }});
  if (count > 0) {
    return { errors : { product_id: { message: `Recipe For Selected Product already exist` } } };
  }

  return null;
}

export default Recipe;
