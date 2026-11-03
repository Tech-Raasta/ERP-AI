import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { round } from '../lib/common.js';

import Box from './box.js';
import Product from './product.js';

const BoxProduct = sequelize.define('box_product', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  box_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  product_id: {
    type: DataTypes.INTEGER,
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
  grams: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  rate: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  amount: {
    type: DataTypes.DOUBLE,
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

// box_product.box_id points to box_master (not combo_box_master)
BoxProduct.belongsTo(Box, { foreignKey: "box_id", as: "Box" });
BoxProduct.belongsTo(Product, { foreignKey: "product_id", as: "product" });

// Old PHP box form: grams and rate come from the product, amount = qty * rate
BoxProduct.prototype.setFromProduct = function(product, qty) {
  this.product_id = product.id;
  this.qty = round(qty, 2);
  this.grams = round(product.grams ? +product.grams : 0, 2);
  this.rate = round(product.rate ? +product.rate : 0, 2);
  this.amount = round(this.qty * this.rate, 2);
}

export default BoxProduct;
