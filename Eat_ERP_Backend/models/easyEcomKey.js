import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

const EasyEcomKey = sequelize.define('easy_ecom_key', {
  location_key: DataTypes.STRING, 
  jwt_token: {
    type: DataTypes.STRING, 
    allowNull: false, 
    // trim: true,
    // unique: true
  },
  token_type: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  expires_in: {
    type: DataTypes.DATE
  },
  remarks: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  status: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  createdBy: {
    type: DataTypes.INTEGER, 
    // references: 'User'
  },
  updatedBy: {
    type: DataTypes.INTEGER, 
    // references: 'User'
  }
}, 
{
  timestamps: true,
  freezeTableName: true
});

// (async () => {
//   await EasyEcomKey.sync({ force: true });
//   console.log('The table for the EasyEcomKey model was just (re)created!');
//   // Code here
// })();

export default EasyEcomKey;