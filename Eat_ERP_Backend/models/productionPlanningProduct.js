import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
// import { calculateItemAmount } from '../lib/common.js';

// import ProductionPlanning from './productionPlanning.js';
import Product from './product.js';

const ProductionPlanningProduct = sequelize.define('production_planning_products', {
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
  type: DataTypes.STRING,
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  product_name: DataTypes.STRING,
  no_of_batch: DataTypes.DOUBLE,
  requested_kg: DataTypes.DOUBLE
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// ProductionPlanningProduct.belongsTo(ProductionPlanning, { foreignKey: "production_planning_id", as: "ProductionPlanning" });
// ProductionPlanningProduct.belongsTo(Product, { foreignKey: "product_id", as: "Product" });

ProductionPlanningProduct.prototype.getRequestData = function(productionPlanningProduct) {
  // try {
    // this.production_planning_id = productionPlanningProduct.production_planning_id;
    this.product_id = productionPlanningProduct.product_id;
    this.product_name = productionPlanningProduct.product_name;
    this.qty = productionPlanningProduct.qty;
  // } catch (error) {
  //   return error;
  // }
}

ProductionPlanningProduct.prototype.setItemAmount = async function() {
  // try {
    const product = await Product.findByPk(this.product_id);
    if(product) {
      this.product_name = product.short_name;
    }

    // const item = calculateItemAmount(this.qty, this.rate, this.tax_per, this.tax_type);

    // this.amount = item.amount;
    // this.cgst_amt = item.cgst_amt;
    // this.sgst_amt = item.sgst_amt;
    // this.igst_amt = item.igst_amt;
    // this.tax_amt = item.tax_amt;
    // this.total_amt = item.total_amt;
    // this.old_po_rate = productionPlanningProduct.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

ProductionPlanningProduct.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    count = await Product.count({ where: { id: this.product_id }});
    if (count === 0) {
      return { errors : { product_id: { message: `Product does not exist` } } };
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default ProductionPlanningProduct;