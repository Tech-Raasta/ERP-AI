import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import Depot from './depot.js';
import Box from './box.js';
import { round } from '../lib/common.js';

const RequisitionItem = sequelize.define('requisition_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  requisition_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  item_name: DataTypes.STRING,
  sales: DataTypes.DOUBLE,
  inventory: DataTypes.DOUBLE,
  difference: DataTypes.DOUBLE,
  moq_inventory: DataTypes.DOUBLE,
  moq_production: DataTypes.DOUBLE,
  raise_requisition_for: DataTypes.DOUBLE,
  // depot_id: DataTypes.INTEGER,
  // depot_name: DataTypes.STRING,
  raise: DataTypes.TINYINT,
  production_status: DataTypes.STRING,
  product_id: DataTypes.INTEGER,
  product_name: DataTypes.STRING,
  grams: DataTypes.DOUBLE,
  total_grams: {
    type: DataTypes.DOUBLE,
    defaultValue: 0
  },
  mrp: DataTypes.DOUBLE,
  unit_selling_price: DataTypes.DOUBLE
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// RequisitionItem.belongsTo(Requisition, { foreignKey: "requisition_id", as: "Requisition" });
// RequisitionItem.belongsTo(RawMaterial, { foreignKey: "item_id", as: "raw_material" });
// RequisitionItem.hasMany(RawMaterialInItem, { foreignKey: "po_item_id", as: "rawMaterialInItems" });

RequisitionItem.prototype.getRequestData = function(requisitionItem) {
  // try {
    // this.requisition_id = requisitionItem.requisition_id;
    this.item_id = requisitionItem.item_id;
    this.sales = requisitionItem.sales;
    this.inventory = requisitionItem.inventory;
    this.difference = requisitionItem.difference;
    this.moq_inventory = requisitionItem.moq_inventory;
    this.moq_production = requisitionItem.moq_production;
    this.raise_requisition_for = requisitionItem.raise_requisition_for;
    // this.depot_id = requisitionItem.depot_id;
    this.raise = requisitionItem.raise;
    this.production_status = requisitionItem.production_status;
  // } catch (error) {
  //   return error;
  // }
}

RequisitionItem.prototype.setDetails = async function() {
  // try {
    const box = await Box.findByPk(this.item_id);
    if(box) {
      this.item_name = box.box_name;
      this.moq_inventory = box.moq_inventory;
      this.moq_production = box.moq_production;
      this.product_id = box.product_id;
      this.product_name = box.product_name;
      this.grams = box.grams;
      this.total_grams = round(this.raise_requisition_for * box.grams, 4);
      this.mrp = box.rate;
      this.unit_selling_price = round((parseFloat(box.rate) / parseFloat(box.grams)), 2);
    }

    // const depot = await Depot.findByPk(this.depot_id);
    // this.depot_name = depot && depot.depot_name ? depot.depot_name : '';
  // } catch (error) {
  //   return error;
  // }
}

RequisitionItem.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    count = await Box.count({ where: { id: this.item_id }});
    if (count === 0) {
      return { errors : { item_id: { message: `Box does not exist` } } };
    }
    
    if (this.raise && !this.raise_requisition_for) {
      return { errors : { raise_requisition_for: { message: `Enter quantity to raise requisition` } } };
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default RequisitionItem;