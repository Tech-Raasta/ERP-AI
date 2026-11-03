import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import Product from './product.js';
import { calculateItemAmount, round } from '../lib/common.js';

const SalesUploadSaleItems = sequelize.define('sales_upload_sale_items', {
  saleId: {
    type: DataTypes.INTEGER, 
    // references: 'Sale',
    // allowNull: false
  },
  productId: {
    type: DataTypes.INTEGER, 
    // references: 'Product',
    allowNull: false
  },
  productName: {
    type: DataTypes.STRING, 
    // allowNull: false, 
    // trim: true
  },
  shortName: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  description: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  categoryId: {
    type: DataTypes.INTEGER, 
    // allowNull: false
  },
  categoryName: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  hsnCode: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  // hsnName: {
  //   type: DataTypes.STRING, 
  //   // allowNull: false
  // },
  grams: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  costWithoutGst: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  costWithGst: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  quantity: {
    type: DataTypes.DOUBLE,
    min: 1,
    allowNull: false,
    defaultValue: 0
  },
  mrp: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  discount: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  taxPercentage: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  saleRate: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0
  },
  amount: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  discountAmount: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  taxableAmount: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  cgst: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  sgst: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  igst: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  cgstAmount: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  sgstAmount: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  igstAmount: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  taxAmount: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  totalAmount: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  totalGrams: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  totalCostWithoutGst: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  totalCostWithGst: {
    type: DataTypes.DOUBLE,
    // allowNull: false
    defaultValue: 0
  },
  taxType: {
    type: DataTypes.STRING,
    defaultValue: 'Intra'
  },
  comboBoxId: DataTypes.INTEGER,
  saleItemId: DataTypes.INTEGER
}, 
{
  timestamps: true,
  freezeTableName: true
});

SalesUploadSaleItems.belongsTo(Product, {foreignKey: 'productId', as: 'product'});

// (async () => {
//   await SalesUploadSaleItems.sync({ force: true });
//   console.log('The table for the Sale Item Product model was just (re)created!');
//   // Code here
// })();

SalesUploadSaleItems.prototype.getRequestData = function(saleUploadItemProduct) {
  // try {
    // this.saleId = saleUploadItemProduct.saleId;
    this.productId = saleUploadItemProduct.productId;
    // this.description = saleUploadItemProduct.description;
    // this.hsnCode = saleUploadItemProduct.hsnCode;
    this.quantity = saleUploadItemProduct.quantity;
    this.discount = saleUploadItemProduct.discount;
    this.saleRate = saleUploadItemProduct.saleRate;
    // this.taxPercentage = saleUploadItemProduct.taxPercentage;
    // this.amount = saleUploadItemProduct.amount;
    // this.cgstAmount = saleUploadItemProduct.cgstAmount;
    // this.sgstAmount = saleUploadItemProduct.sgstAmount;
    // this.igstAmount = saleUploadItemProduct.igstAmount;
    // this.taxAmount = saleUploadItemProduct.taxAmount;
    // this.totalAmount = saleUploadItemProduct.totalAmount;
  // } catch (error) {
  //   return error;
  // }
}

SalesUploadSaleItems.prototype.setItemAmount = async function() {
  // try {
    // const product = await Product.findByPk(this.productId, {include: 'category'});
    const product = await Product.findByPk(this.productId);
    if(product) {
      this.productName = product.productName;
      this.shortName = product.shortName;
      this.description = product.description;
      this.categoryId = product.categoryId;
      // this.categoryName = ((product.category && product.category.categoryName) ? product.category.categoryName : '');
      this.categoryName = product.categoryName;
      this.hsnCode = product.hsnCode;
      this.mrp = product.mrp;
      this.grams = product.grams;
      this.taxPercentage = product.taxPercentage;
      this.costWithoutGst = product.costWithoutGst;
      this.costWithGst = product.costWithGst;
    }

    this.totalGrams = round(this.quantity * this.grams, 4);
    this.totalCostWithoutGst = round(this.quantity * this.costWithoutGst, 4);
    this.totalCostWithGst = round(this.quantity * this.costWithGst, 4);

    const quantity = this.quantity ? this.quantity : 0;
    const mrp  = this.mrp ? this.mrp : 0;
    const taxPercentage  = this.taxPercentage ? this.taxPercentage : 0;
    const taxType  = this.taxType ? this.taxType : 0;
    // const discount  = this.discount ? this.discount : 0;
    let saleRate = this.saleRate ? this.saleRate : 0;
    
    // const discoutRate = round((mrp * discount)/100, 2);

    // saleRate = round(mrp - discoutRate, 2);
    // saleRate = round((saleRate / (100 + taxPercentage)) * 100, 2);
    
    const item = calculateItemAmount(quantity, saleRate, taxPercentage, taxType);

    this.amount = item.amount;
    // this.discountAmount = round(quantity * discoutRate, 4);
    this.taxableAmount = item.amount;
    this.cgst = item.cgst;
    this.sgst = item.sgst;
    this.igst = item.igst;
    this.cgstAmount = item.cgstAmount;
    this.sgstAmount = item.sgstAmount;
    this.igstAmount = item.igstAmount;
    this.taxAmount = item.taxAmount;
    this.totalAmount = item.totalAmount;
    // this.old_po_rate = saleUploadItemProduct.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

SalesUploadSaleItems.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = await Product.count({ where: { id: this.productId } });
    if (count === 0) {
      return { errors : { productName: { message: `Product (${this.productName}) does not found` } } }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default SalesUploadSaleItems