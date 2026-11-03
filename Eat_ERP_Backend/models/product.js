import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { round } from '../lib/common.js';

import Category from './category.js';
// import Recipe from './recipe.js';

const Product = sequelize.define('product_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  product_name: {
    type: DataTypes.STRING,
    unique: true,
    validate: {
      notEmpty: { msg: 'Product Name is required' }
    }
  },
  barcode: DataTypes.STRING,
  grams: { 
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true
    }
  },
  avg_grams: DataTypes.NUMBER,
  rate: { 
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true
    }
  },
  cost: { 
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true
    }
  },
  tax: DataTypes.STRING,
  anticipated_wastage: DataTypes.NUMBER,
  status: {
    type: DataTypes.STRING,
    validate: {
      isIn: [['Approved', 'InActive']]
    }
  },
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  hsn_code: { 
    type: DataTypes.STRING,
    validate: {
      notEmpty: true
    }
  },
  hsn_name: DataTypes.STRING,
  short_name: { 
    type: DataTypes.STRING,
    validate: {
      notEmpty: true
    }
  },
  merchandiser: DataTypes.TINYINT,
  category_id: { 
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true
    }
  },
  tax_percentage: { 
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true
    }
  },
  anticipated_water_loss: DataTypes.NUMBER
}, 
{
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

// Product.belongsTo(Recipe, { foreignKey: "product_id", as: "recipe" });

Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Product.prototype.getRequestData = async function(req) {
  this.product_name = req.body.product_name ? req.body.product_name.toString().trim() : '';
  this.short_name = req.body.short_name ? req.body.short_name.toString().trim() : '';
  this.hsn_code = req.body.hsn_code ? req.body.hsn_code.toString().trim() : '';
  this.hsn_name = req.body.hsn_name ? req.body.hsn_name.toString().trim() : '';
  this.barcode = req.body.barcode ? req.body.barcode.toString().trim() : '';
  // Old PHP stored these with format_number(value, 2)
  this.grams = (req.body.grams) ? round(+req.body.grams, 2) : 0;
  this.avg_grams = (req.body.avg_grams) ? round(+req.body.avg_grams, 2) : 0;
  this.rate = (req.body.rate) ? round(+req.body.rate, 2) : 0;
  this.cost = (req.body.cost) ? round(+req.body.cost, 2) : 0;
  this.anticipated_wastage = (req.body.anticipated_wastage) ? round(+req.body.anticipated_wastage, 2) : 0;
  // Not on the product form - only overwrite when sent
  if (req.body.anticipated_water_loss !== undefined) {
    this.anticipated_water_loss = (req.body.anticipated_water_loss) ? round(+req.body.anticipated_water_loss, 2) : 0;
  }
  this.category_id = (req.body.category_id) ? +req.body.category_id: 0;
  this.tax_percentage = (req.body.tax_percentage) ? +req.body.tax_percentage : 0;
  if (req.body.status) {
    this.status = req.body.status;
  }
  this.remarks = req.body.remarks ? req.body.remarks.toString().trim() : '';
}

// Old PHP copied these product fields onto every box of the product (box_master)
Product.prototype.getBoxSyncData = function() {
  return {
    barcode: this.barcode,
    hsn_code: this.hsn_code,
    hsn_name: this.hsn_name,
    short_name: this.short_name,
    category_id: this.category_id,
    tax_percentage: this.tax_percentage
  };
}

Product.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // Same rule as old PHP check_product_availablity: name must be unique among active products
    let count = await Product.count({ where: { product_name: this.product_name, status: 'Approved', id: { [Op.ne]: (this.id ? this.id : 0) } }});
    if (count > 0) {
      return { errors : { product_name: { message: `Product Name (${this.product_name}) already exist` } } }
    }

    // if (this.asin) {
    //   count = await Product.count({ where: { asin: this.asin, id: { [Op.ne]: this.id } }});
    //   if (count > 0) {
    //     return { errors : { asin: { message: `Two products cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.count({ where: { asin: this.skuCode, id: { [Op.ne]: this.id } }});
    //   if (count > 0) {
    //     return { errors : { skuCode: { message: `Two products cannot share the same sku code (${this.skuCode})` } } }
    //   }
    // }

    // for (const skuDetail of this.skuDetails) {
    //   if (skuDetail.skuName) {
    //     count = await Product.count({ product_name: skuDetail.skuName, id: { $ne: this.id } });
    //     if (count > 0) {
    //       return { errors : { skuName: { message: `Two products cannot share the same sku name (${skuDetail.skuName})` } } }
    //     }
    //     count = await models.Product.countDocuments({ 'skuDetails.skuName': skuDetail.skuName, id: { $ne: this.id } });
    //     if (count > 0) {
    //       return { errors : { skuName: { message: `Two products cannot share the same sku name (${skuDetail.skuName})` } } }
    //     }
    //   }

    //   if (skuDetail.skuCode) {
    //     count = await models.Product.countDocuments({ skuCode: skuDetail.skuCode, id: { $ne: this.id } });
    //     if (count > 0) {
    //       return { errors : { skuCode: { message: `Two products cannot share the same skuCode (${skuDetail.skuCode})` } } }
    //     }
    //     count = await models.Product.countDocuments({ 'skuDetails.skuCode': skuDetail.skuCode, id: { $ne: this.id } });
    //     if (count > 0) {
    //       return { errors : { skuCode: { message: `Two products cannot share the same skuCode (${skuDetail.skuCode})` } } }
    //     }
    //   }
      
    //   if (skuDetail.asin) {
    //     count = await models.Product.countDocuments({ asin: skuDetail.asin, id: { $ne: this.id } });
    //     if (count > 0) {
    //       return { errors : { asin: { message: `Two products cannot share the same asin (${skuDetail.asin})` } } }
    //     }
    //     count = await models.Product.countDocuments({ 'skuDetails.asin': skuDetail.asin, id: { $ne: this.id } });
    //     if (count > 0) {
    //       return { errors : { asin: { message: `Two products cannot share the same asin (${skuDetail.asin})` } } }
    //     }
    //   }
    // }

    if (!this.category_id) {
      return { errors : { category_id: { message: `Category is required` } } }
    }
    // A deleted category can stay on a product that already has it, but can't be newly chosen
    const categoryCondition = (this.isNewRecord || this.changed('category_id'))
      ? { ...Category.activeCondition, id: this.category_id }
      : { id: this.category_id };
    count = await Category.count({ where: categoryCondition });
    if (count === 0) {
      return { errors : { category_id: { message: `Category does not exist` } } }
    }

    // if (!this.category || !this.category.categoryName) {
    //   return { errors : { category: { message: `Category does not exist` } } }
    // }

    return null;
  } catch (error) {
    return error;
  }
}

// module.exports = Product;
export default Product;