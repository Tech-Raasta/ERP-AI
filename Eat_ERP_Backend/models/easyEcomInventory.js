import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import Product from './product.js';
import Box from './box.js';
import User from './user.js';
import Production from './production.js';

const EasyEcomInventory = sequelize.define('easy_ecom_inventory', {
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  production_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
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
  synced_qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0,
  },
  grams: DataTypes.DOUBLE,
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'Unsynced'
  },
  date_of_transfer: DataTypes.DATE,
  date_of_synced: {
    type:DataTypes.DATE, 
    allowNull: true
  },
  date_of_synced_by: {
    type:DataTypes.INTEGER, 
    allowNull: true
  },
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

EasyEcomInventory.belongsTo(Production, { foreignKey: "production_id", as: "production" });
EasyEcomInventory.belongsTo(Product, { foreignKey: "product_id", as: "product" });
EasyEcomInventory.belongsTo(Box, { foreignKey: "box_id", as: "box" });
// const syncCheck = await EasyEcomInventory.sync({alter: true, force: false});
// console.log('EasyEcomInventory table synced:', syncCheck);



export default EasyEcomInventory;