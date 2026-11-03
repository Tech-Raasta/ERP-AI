import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount, round } from '../lib/common.js';

const SaleItemProduct = sequelize.define('distributor_out_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  distributor_out_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
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
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  sell_rate: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  grams: DataTypes.DOUBLE,
  rate: {
    type: DataTypes.DOUBLE,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  amount: DataTypes.DOUBLE,
  cgst_amt: DataTypes.DOUBLE,
  sgst_amt: DataTypes.DOUBLE,
  igst_amt: DataTypes.DOUBLE,
  tax_amt: DataTypes.DOUBLE,
  total_amt: DataTypes.DOUBLE,
  batch_no: DataTypes.STRING,
  batch_qty: DataTypes.STRING,
  margin_per: DataTypes.DOUBLE,
  tax_percentage: DataTypes.DOUBLE,
  promo_margin: DataTypes.DOUBLE,
  combo_box_id: DataTypes.INTEGER,
  discount: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  discount_amt: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  tax_type: {
    type: DataTypes.STRING,
    defaultValue: 'Intra'
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// SaleItem.belongsTo(Product, {foreignKey: 'item_id', as: 'product'});

// (async () => {
//   await SaleItemProduct.sync({ alter: true });
//   console.log('The table for the Sale Item model was just (re)created!');
//   // Code here
// })();

SaleItemProduct.prototype.getRequestData = function(saleItemProduct) {
  // try {
    // this.distributor_out_id = saleItemProduct.distributor_out_id;
    this.type = saleItemProduct.type;
    this.item_id = saleItemProduct.item_id;
    this.grams = saleItemProduct.grams;
    this.qty = saleItemProduct.qty;
    this.rate = saleItemProduct.rate;
    this.discount = saleItemProduct.discount;
    this.sell_rate = saleItemProduct.sell_rate;
    this.tax_percentage = saleItemProduct.tax_percentage;
    this.amount = saleItemProduct.amount;
    this.cgst_amt = saleItemProduct.cgst_amt;
    this.sgst_amt = saleItemProduct.sgst_amt;
    this.igst_amt = saleItemProduct.igst_amt;
    this.tax_amt = saleItemProduct.tax_amt;
    this.total_amt = saleItemProduct.total_amt;
    this.batch_no = saleItemProduct.batch_no;
    this.batch_qty = saleItemProduct.batch_qty;
    this.margin_per = saleItemProduct.margin_per;
    this.promo_margin = saleItemProduct.promo_margin;
    this.combo_box_id = saleItemProduct.combo_box_id;
    this.discount_amt = saleItemProduct.discount_amt;
    this.tax_type = saleItemProduct.tax_type;
  // } catch (error) {
  //   return error;
  // }
}

SaleItemProduct.prototype.setItemAmount = async function() {
  // try {
    // const product = await Product.findByPk(this.item_id, {include: 'category'});
    // if(product) {
    //   this.productName = product.productName;
    //   this.shortName = product.shortName;
    //   this.type = product.type;
    //   this.categoryId = product.categoryId;
    //   this.categoryName = ((product.category && product.category.categoryName) ? product.category.categoryName : '');
    //   this.grams = product.grams;
    //   this.rate = product.rate;
    //   this.grams = product.grams;
    //   this.tax_percentage = product.tax_percentage;
    //   this.costWithoutGst = product.costWithoutGst;
    //   this.costWithGst = product.costWithGst;
    // }

    // this.totalGrams = round(this.qty * this.grams, 4);
    // this.totalCostWithoutGst = round(this.qty * this.costWithoutGst, 4);
    // this.totalCostWithGst = round(this.qty * this.costWithGst, 4);

    const qty = this.qty ? this.qty : 0;
    const rate  = this.rate ? this.rate : 0;
    const tax_percentage  = this.tax_percentage ? this.tax_percentage : 0;
    const tax_type  = this.tax_type ? this.tax_type : 'Intra';
    const discount  = this.discount ? this.discount : 0;
    let sell_rate = this.sell_rate ? this.sell_rate : 0;
    
    const discoutRate = (rate * discount)/100;

    sell_rate = rate - discoutRate;
    sell_rate = round((sell_rate / (100 + tax_percentage)) * 100, 4);
    
    const item = calculateItemAmount(qty, sell_rate, tax_percentage, tax_type);

    this.sell_rate = sell_rate;
    this.amount = item.amount;
    this.discount_amt = round(qty * discoutRate, 2);
    // this.taxableAmount = item.amount;
    // this.cgst = item.cgst;
    // this.sgst = item.sgst;
    // this.igst = item.igst;
    this.cgst_amt = item.cgst_amt;
    this.sgst_amt = item.sgst_amt;
    this.igst_amt = item.igst_amt;
    this.tax_amt = item.tax_amt;
    this.total_amt = item.total_amt;
  // } catch (error) {
  //   return error;
  // }
}

SaleItemProduct.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.count({ where: { id: this.item_id } });
    // if (count === 0) {
    //   return { errors : { productName: { message: `Product (${this.productName}) does not found` } } }
    // }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default SaleItemProduct;