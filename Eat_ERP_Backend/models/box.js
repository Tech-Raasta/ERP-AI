import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { round } from '../lib/common.js';

import Product from './product.js';
import Category from './category.js';

const Box = sequelize.define('box_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  box_name: {
    type: DataTypes.STRING,
    unique: true,
    validate: {
      notEmpty: { msg: 'Box Name is required' }
    }
  },
  barcode: {
    type: DataTypes.STRING,
    validate: {
      notEmpty: { msg: 'Barcode is required' }
    }
  },
  grams: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true
    }
  },
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
  amount: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true
    }
  },
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
      notEmpty: { msg: 'HSN Code is required' }
    }
  },
  hsn_name: DataTypes.STRING,
  short_name: {
    type: DataTypes.STRING,
    validate: {
      notEmpty: { msg: 'Short Name is required' }
    }
  },
  category_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true,
    //   isNumeric: true
    // }
  },
  tax_percentage: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true
    }
  },
  // Old PHP form never enforced ASIN (rule is commented out in validations.js)
  asin: DataTypes.STRING,
  sku_code: {
    type: DataTypes.STRING,
    validate: {
      notEmpty: { msg: 'SKU Code is required' }
    }
  },
  ing_variation_id: DataTypes.DOUBLE,
  control_unit: DataTypes.STRING,
  product_id: DataTypes.INTEGER,
  product_name: DataTypes.STRING,
  product_qty: DataTypes.DOUBLE,
  variation_qty: DataTypes.DOUBLE,
  box_length: DataTypes.DOUBLE,
  box_breadth: DataTypes.DOUBLE,
  box_height: DataTypes.DOUBLE,
  volumetric_weight: DataTypes.DOUBLE,
  product_weight: DataTypes.DOUBLE,
  shipping_charges: DataTypes.DOUBLE,
  total_weight: DataTypes.DOUBLE,
  moq_inventory: {
    type: DataTypes.DOUBLE,
    defaultValue: 100
  },
  moq_production: {
    type: DataTypes.DOUBLE,
    defaultValue: 100
  }
},
{
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

Box.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Box.belongsTo(Category, { foreignKey: "category_id", as: "category" });

// Same fields as old PHP Box_model::save_data. Other box_master columns (product_id, ing_variation_id,
// dimensions, ...) are maintained elsewhere and must not be touched here.
// grams / amount are not read from the request: they are totals of the box items (see setTotals).
Box.prototype.getRequestData = async function(req) {
  const body = req.body;
  const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';

  this.box_name = text(body.box_name);
  this.barcode = text(body.barcode);
  this.short_name = text(body.short_name);
  this.asin = text(body.asin);
  this.sku_code = text(body.sku_code);
  this.hsn_code = text(body.hsn_code);
  this.hsn_name = text(body.hsn_name);
  this.rate = (body.rate) ? round(+body.rate, 2) : 0;
  this.cost = (body.cost) ? round(+body.cost, 2) : 0;
  this.category_id = (body.category_id) ? +body.category_id : 0;
  this.tax_percentage = (body.tax_percentage) ? round(+body.tax_percentage, 2) : 0;
  this.moq_inventory = (body.moq_inventory) ? +body.moq_inventory : 0;
  this.moq_production = (body.moq_production) ? +body.moq_production : 0;
  if (body.status) {
    this.status = body.status;
  }
  this.remarks = text(body.remarks);
}

// Old PHP form: total grams = sum(qty * product grams), total amount = sum(qty * product rate)
Box.prototype.setTotals = function(items) {
  let grams = 0;
  let amount = 0;
  for (const item of items) {
    grams += item.qty * item.grams;
    amount += item.amount;
  }
  this.grams = round(grams, 2);
  this.amount = round(amount, 2);
}

Box.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // Old PHP availability checks compare against every box, whatever its status
    const others = { id: { [Op.ne]: (this.id ? this.id : 0) } };
    let count = await Box.count({ where: { ...others, box_name: this.box_name }});
    if (count > 0) {
      return { errors : { box_name: { message: `Box Name (${this.box_name}) already exist` } } }
    }

    count = await Box.count({ where: { ...others, barcode: this.barcode }});
    if (count > 0) {
      return { errors : { barcode: { message: `Barcode (${this.barcode}) already in use` } } }
    }

    count = await Box.count({ where: { ...others, sku_code: this.sku_code }});
    if (count > 0) {
      return { errors : { sku_code: { message: `SKU Code (${this.sku_code}) already in use` } } }
    }

    if (!this.category_id) {
      return { errors : { category_id: { message: `Category is required` } } }
    }
    // A deleted category can stay on a box that already has it, but can't be newly chosen
    const categoryCondition = (this.isNewRecord || this.changed('category_id'))
      ? { ...Category.activeCondition, id: this.category_id }
      : { id: this.category_id };
    count = await Category.count({ where: categoryCondition });
    if (count === 0) {
      return { errors : { category_id: { message: `Category does not exist` } } }
    }

    return null;
  } catch (error) {
    return error;
  }
}

// module.exports = Product;
export default Box;
