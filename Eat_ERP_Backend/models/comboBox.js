import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { round } from '../lib/common.js';

import ComboBoxItem from './comboBoxItem.js';
import Category from './category.js';
import Box from './box.js';

const ComboBox = sequelize.define('combo_box_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  combo_box_name: {
    type: DataTypes.STRING,
    unique: true,
    validate: {
      notEmpty: { msg: 'Combo Box Name is required' }
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
  // Shown as "MRP" on the form
  rate: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true,
      min: { args: [1], msg: 'MRP must be at least 1' }
    }
  },
  // Hidden on the old PHP form (saved as null when empty)
  cost: {
    type: DataTypes.NUMBER,
    validate: {
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
  hsn: {
    type: DataTypes.STRING,
    validate: {
      isIn: {
        args: [['Yes', 'No']],
        msg: "HSN must be Yes or No"
      }
    }
  },
  hsn_code: {
    type: DataTypes.STRING,
    validate: {
      requiredWhenHsn(value) {
        if (!value && this.hsn === 'Yes') {
          throw new Error("HSN Code is required when HSN is Yes");
        }
      }
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
  // Hidden on the old PHP form (saved as null when empty)
  tax_percentage: {
    type: DataTypes.NUMBER,
    validate: {
      isNumeric: true
    }
  },
  asin: {
    type: DataTypes.STRING,
    validate: {
      notEmpty: { msg: 'ASIN is required' }
    }
  },
  sku_code: {
    type: DataTypes.STRING,
    validate: {
      notEmpty: { msg: 'SKU Code is required' }
    }
  },
  gst: {
    type: DataTypes.STRING,
    validate: {
      isIn: {
        args: [['Yes', 'No']],
        msg: "GST must be Yes or No"
      }
    }
  },
  gst_rate: {
    type: DataTypes.NUMBER,
    validate: {
      requiredWhenGst(value) {
        if (!value && this.gst === 'Yes') {
          throw new Error("GST Rate is required when GST is Yes");
        }
      }
    }
  }
},
{
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

ComboBox.hasMany(ComboBoxItem, { foreignKey: "combo_box_id", targetKey: "id", as: "comboBoxItems", onDelete: 'CASCADE' });
ComboBox.belongsTo(Category, { foreignKey: "category_id", as: "category" });

// Same fields as old PHP Combo_box_model::save_data.
// grams / amount are not read from the request: they are totals of the combo items (see setTotals).
// cost, hsn_name, category_id and tax_percentage are hidden on the old PHP form, so they keep their
// current value unless the request sends them (empty means null, as in PHP).
ComboBox.prototype.getRequestData = async function(req) {
  const body = req.body;
  const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';

  this.combo_box_name = text(body.combo_box_name);
  this.barcode = text(body.barcode);
  this.short_name = text(body.short_name);
  this.asin = text(body.asin);
  this.sku_code = text(body.sku_code);
  this.gst = text(body.gst) || 'No';
  this.gst_rate = (body.gst_rate) ? round(+body.gst_rate, 2) : 0;
  this.hsn = text(body.hsn) || 'No';
  this.hsn_code = text(body.hsn_code);
  this.rate = (body.rate) ? round(+body.rate, 2) : 0;
  if (body.hsn_name !== undefined) {
    this.hsn_name = text(body.hsn_name);
  }
  if (body.cost !== undefined) {
    this.cost = (body.cost !== '' && body.cost !== null) ? round(+body.cost, 2) : null;
  }
  if (body.category_id !== undefined) {
    this.category_id = (body.category_id) ? +body.category_id : null;
  }
  if (body.tax_percentage !== undefined) {
    this.tax_percentage = (body.tax_percentage !== '' && body.tax_percentage !== null) ? round(+body.tax_percentage, 2) : null;
  }
  if (body.status) {
    this.status = body.status;
  }
  this.remarks = text(body.remarks);
}

// Old PHP form: total grams = sum(qty * item grams), total amount = sum(qty * item rate)
ComboBox.prototype.setTotals = function(items) {
  let grams = 0;
  let amount = 0;
  for (const item of items) {
    grams += item.qty * item.grams;
    amount += item.amount;
  }
  this.grams = round(grams, 2);
  this.amount = round(amount, 2);
}

ComboBox.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // Old PHP availability checks only compare against Approved combo boxes
    const others = { status: 'Approved', id: { [Op.ne]: (this.id ? this.id : 0) } };
    let count = await ComboBox.count({ where: { ...others, combo_box_name: this.combo_box_name }});
    if (count > 0) {
      return { errors : { combo_box_name: { message: `Combo Box Name (${this.combo_box_name}) already exist` } } }
    }

    count = await ComboBox.count({ where: { ...others, barcode: this.barcode }});
    if (count > 0) {
      return { errors : { barcode: { message: `Barcode (${this.barcode}) already in use` } } }
    }

    count = await ComboBox.count({ where: { ...others, sku_code: this.sku_code }});
    if (count > 0) {
      return { errors : { sku_code: { message: `SKU Code (${this.sku_code}) already in use` } } }
    }

    // ASIN must also not be used by an active box
    count = await ComboBox.count({ where: { ...others, asin: this.asin }});
    if (count === 0) {
      count = await Box.count({ where: { status: 'Approved', asin: this.asin }});
    }
    if (count > 0) {
      return { errors : { asin: { message: `ASIN (${this.asin}) already in use` } } }
    }

    // Category is optional (hidden on the old PHP form), but a newly chosen one must be active
    if (this.category_id && (this.isNewRecord || this.changed('category_id'))) {
      count = await Category.count({ where: { ...Category.activeCondition, id: this.category_id } });
      if (count === 0) {
        return { errors : { category_id: { message: `Category does not exist` } } }
      }
    }

    return null;
  } catch (error) {
    return error;
  }
}

// module.exports = Product;
export default ComboBox;
