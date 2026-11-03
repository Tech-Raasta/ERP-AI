import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

import RawMaterial from './rawMaterial.js';

const RecipeDetail = sequelize.define('ingredients_details', {
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
  rm_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  rm_name: {
    type: DataTypes.STRING,
    // validate: {
    //   notEmpty: true
    // }
  },
  qty_per_batch: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  percent: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  rate: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  tax_per: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  cost: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

RecipeDetail.belongsTo(RawMaterial, { foreignKey: "rm_id", as: "rawMaterial" });

RecipeDetail.prototype.getRequestData = async function(recipeDetail) {
  try {
    this.ing_id = recipeDetail.ing_id;
    this.rm_id = recipeDetail.rm_id;
    this.qty_per_batch = recipeDetail.qty_per_batch;
    this.percent = recipeDetail.percent;
    this.rate = recipeDetail.rate;
    this.tax_per = recipeDetail.tax_per;
    this.cost = recipeDetail.cost;
  } catch (error) {
    return error;
  }
}

RecipeDetail.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await RecipeDetail.count({ where: { vendor_type: this.vendor_type, id: { [Op.ne]: this.id } }});
    // if (count > 0) {
    //   return { errors : { vendor_type: { message: `(${this.vendor_type}) already exist.` } } };
    // }

    return null;
  } catch (error) {
    return error;
  }
}

export default RecipeDetail;