import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import ComboBox from './comboBox.js';

const DepotTransferCombo = sequelize.define('depot_transfer_combos', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  combo_box_id:{
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  depot_transfer_id:{
    type: DataTypes.INTEGER,
    // allowNull: true,
    // validate: {
    //   notNull: true
    // }
  },
  qty: {
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

DepotTransferCombo.belongsTo(ComboBox, { foreignKey: 'combo_box_id', as: 'comboBox' });


DepotTransferCombo.prototype.setDetails = function(items){
    this.combo_box_id = items.combo_box_id;
    this.depot_transfer_id = items.depot_transfer_id;
    this.qty = items.qty;
}



export default DepotTransferCombo;