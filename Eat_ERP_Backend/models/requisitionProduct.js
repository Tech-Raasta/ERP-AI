import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
// import { calculateItemAmount } from '../lib/common.js';

// import Requisition from './requisition.js';
import Product from './product.js';
import Depot from './depot.js';

const RequisitionProduct = sequelize.define('requisition_products', {
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
  requested_kg: DataTypes.DOUBLE,
  allocations: DataTypes.TEXT,
  raise: DataTypes.TINYINT,
  production_status: DataTypes.STRING,
  manufacturer_id: DataTypes.INTEGER
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// RequisitionProduct.belongsTo(Requisition, { foreignKey: "requisition_id", as: "Requisition" });
// RequisitionProduct.belongsTo(Product, { foreignKey: "product_id", as: "Product" });

RequisitionProduct.prototype.getRequestData = function(requisitionProduct) {
  // try {
    // this.requisition_id = requisitionProduct.requisition_id;
    // this.product_id = requisitionProduct.product_id;
    // this.product_name = requisitionProduct.product_name;
    this.requested_kg = requisitionProduct.requested_kg;
    this.raise = requisitionProduct.raise;
    this.production_status = requisitionProduct.production_status;
    this.manufacturer_id = requisitionProduct.manufacturer_id;
  // } catch (error) {
  //   return error;
  // }
}

RequisitionProduct.prototype.setItemAmount = async function() {
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
    // this.old_po_rate = requisitionProduct.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

RequisitionProduct.prototype.validateData = async function() {
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

    if (this.raise) {
      count = await Depot.count({ where: { id: this.manufacturer_id }});
      if (count === 0) {
        return { errors : { product_id: { message: `Manufacturing Depot does not exist for product - ${this.product_name}` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default RequisitionProduct;