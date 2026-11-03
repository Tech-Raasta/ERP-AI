import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

// import ProductionPlanning from './productionPlanning.js';
import RawMaterial from './rawMaterial.js';
import Vendor from './vendor.js';
import Depot from './depot.js';

const ProductionPlanningItem = sequelize.define('production_planning_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  production_planning_id: {
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
  hsn_code: DataTypes.STRING,
  item_desc: DataTypes.STRING,
  required_qty: DataTypes.DOUBLE,
  available_qty: DataTypes.DOUBLE,
  difference_qty: DataTypes.DOUBLE,
  qty: {
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
  tax_per: DataTypes.DOUBLE,
  amount: DataTypes.DOUBLE,
  cgst_amt: DataTypes.DOUBLE,
  sgst_amt: DataTypes.DOUBLE,
  igst_amt: DataTypes.DOUBLE,
  tax_amt: DataTypes.DOUBLE,
  total_amt: DataTypes.DOUBLE,
  old_po_rate: DataTypes.DOUBLE,
  tax_type: DataTypes.STRING,
  vendor_id: DataTypes.INTEGER,
  depot_id: DataTypes.INTEGER,
  vendor_name: DataTypes.STRING,
  depot_name: DataTypes.STRING,
  draft_po: DataTypes.TINYINT,
  po_status: DataTypes.STRING
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// ProductionPlanningItem.belongsTo(ProductionPlanning, { foreignKey: "production_planning_id", as: "ProductionPlanning" });
// ProductionPlanningItem.belongsTo(RawMaterial, { foreignKey: "item_id", as: "raw_material" });
// ProductionPlanningItem.hasMany(RawMaterialInItem, { foreignKey: "po_item_id", as: "rawMaterialInItems" });

ProductionPlanningItem.prototype.getRequestData = function(productionPlanningItem) {
  // try {
    // this.production_planning_id = productionPlanningItem.production_planning_id;
    this.item_id = productionPlanningItem.item_id;
    this.item_desc = productionPlanningItem.item_desc;
    // this.hsn_code = productionPlanningItem.hsn_code;
    this.qty = productionPlanningItem.qty;
    this.rate = productionPlanningItem.rate;
    // this.tax_per = productionPlanningItem.tax_per;
    // this.amount = productionPlanningItem.amount;
    // this.cgst_amt = productionPlanningItem.cgst_amt;
    // this.sgst_amt = productionPlanningItem.sgst_amt;
    // this.igst_amt = productionPlanningItem.igst_amt;
    // this.tax_amt = productionPlanningItem.tax_amt;
    // this.total_amt = productionPlanningItem.total_amt;
    this.old_po_rate = productionPlanningItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

ProductionPlanningItem.prototype.setItemAmount = async function() {
  // try {
    const rawMaterial = await RawMaterial.findByPk(this.item_id);
    if(rawMaterial) {
      this.item_name = rawMaterial.rm_name;
      this.hsn_code = rawMaterial.hsn_code;
      this.tax_per = rawMaterial.tax_per;
    }

    const vendor = await Vendor.findByPk(this.vendor_id);
    const depot = await Depot.findByPk(this.depot_id);

    let taxType = 'Intra';
    if (depot.state.trim().toUpperCase() === vendor.state.trim().toUpperCase()) {
      taxType = "Intra";
    } else {
      taxType = "Inter"
    }
    
    this.tax_type = taxType;

    this.vendor_name = vendor && vendor.vendor_name ? vendor.vendor_name : '';
    this.depot_name = depot && depot.depot_name ? depot.depot_name : '';

    //   return taxType;

    const item = calculateItemAmount(this.qty, this.rate, this.tax_per, this.tax_type);

    this.amount = item.amount;
    this.cgst_amt = item.cgst_amt;
    this.sgst_amt = item.sgst_amt;
    this.igst_amt = item.igst_amt;
    this.tax_amt = item.tax_amt;
    this.total_amt = item.total_amt;
    // this.old_po_rate = productionPlanningItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

ProductionPlanningItem.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    count = await RawMaterial.count({ where: { id: this.item_id }});
    if (count === 0) {
      return { errors : { item_id: { message: `Raw Material does not exist` } } };
    }
    
    if (this.draft_po || this.vendor_id) {
      count = await Vendor.count({ where: { id: this.vendor_id }});
      if (count === 0) {
        return { errors : { vendor_id: { message: `Vendor does not exist` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default ProductionPlanningItem;