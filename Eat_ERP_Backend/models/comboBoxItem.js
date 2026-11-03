import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { round } from '../lib/common.js';
import Product from './product.js';
import Box from './box.js';

// import ComboBox from './comboBox.js';

const ComboBoxItem = sequelize.define('combo_box_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  combo_box_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  // 'Bar' = product_master item, 'Box' = box_master item
  type: {
    type: DataTypes.STRING,
    validate: {
      notEmpty: true,
      isIn: [['Bar', 'Box']]
    }
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  qty: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  grams: {
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
  amount: {
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  // Old PHP also stores the item id split by type (0 for the other type)
  product_id: DataTypes.INTEGER,
  box_id: DataTypes.INTEGER
},
{
  timestamps: false,
  freezeTableName: true
});

// ComboBoxItem.belongsTo(ComboBox, { foreignKey: "combo_box_id", as: "ComboBox" });

ComboBoxItem.belongsTo(Product, { foreignKey: "product_id", as: "product" });
ComboBoxItem.belongsTo(Box, { foreignKey: "item_id", as: "box" });

// Old PHP combo form: grams and rate come from the selected bar (product) or box, amount = qty * rate
ComboBoxItem.prototype.setFromItem = function(type, record, qty) {
  this.type = type;
  this.item_id = record.id;
  this.product_id = type === 'Bar' ? record.id : 0;
  this.box_id = type === 'Box' ? record.id : 0;
  this.qty = round(qty, 2);
  this.grams = round(record.grams ? +record.grams : 0, 2);
  this.rate = round(record.rate ? +record.rate : 0, 2);
  this.amount = round(this.qty * this.rate, 2);
}

export default ComboBoxItem;
