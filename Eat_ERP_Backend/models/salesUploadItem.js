import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import Product from './product.js';
import { calculateItemAmount, round } from '../lib/common.js';
import ComboBox from './comboBox.js';
import SalesUploadSaleItems from './salesUploadSaleItems.js';
// const SalesUploadSaleItems = require('./saleUploadItemProduct.model');

const SalesUploadItem = sequelize.define('sales_upload_items', {
  saleId: {
    type: DataTypes.INTEGER, 
    // references: 'Sale',
    // allowNull: false
  },
  itemType: {
    type: DataTypes.ENUM, 
    allowNull: false, 
    values: ['Box', 'Combo Box']
  },
  itemId: {
    type: DataTypes.INTEGER, 
    // references: 'Product', 
    allowNull: false
  },
  productId: {
    type: DataTypes.INTEGER, 
    // references: 'Product',
    allowNull: false
  },
  comboBoxId: {
    type: DataTypes.INTEGER, 
    // references: 'Product',
    // allowNull: false
  },
  itemName: {
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
  asin: DataTypes.STRING,
  skuCode: DataTypes.STRING,
  orderItemId: DataTypes.STRING
}, 
{
  timestamps: true,
  freezeTableName: true
});

SalesUploadItem.belongsTo(Product, {foreignKey: 'productId', as: 'product'});
SalesUploadItem.belongsTo(ComboBox, {foreignKey: 'comboBoxId', as: 'comboBox'});

// (async () => {
//   await SalesUploadItem.sync({ force: true });
//   console.log('The table for the Sale Upload Item model was just (re)created!');
//   // Code here
// })();

SalesUploadItem.prototype.getProducts = async function() {
  // try {
    const saleUploadItemProducts = [];
    
    if (this.itemType.trim().toUpperCase() === 'BOX') {
      const saleUploadItemProduct = new SalesUploadSaleItems({
        saleId: this.saleId,
        saleItemId: this.id,
        productId: this.productId,
        quantity: this.quantity,
        discount: this.discount,
        saleRate: this.saleRate,
        taxType: this.taxType
      });

      await saleUploadItemProduct.setItemAmount();

      saleUploadItemProducts.push(saleUploadItemProduct);
    } else {
      const comboBox = await ComboBox.findByPk(this.comboBoxId, { include: 'comboBoxItems' });

      if (comboBox) {
        // const mrp = comboBox.mrp;
        const saleRate = this.saleRate;
        let totalSaleRate = comboBox.comboBoxItems.reduce((totalSaleRate, item) => (totalSaleRate + (item.quantity * item.rate)), 0);
        
        const discount = round(saleRate / totalSaleRate * 100, 4);

        for (const comboBoxItem of comboBox.comboBoxItems) {
          const productSaleRate = round(comboBoxItem.rate * discount / 100, 4);

          const saleUploadItemProduct = new SalesUploadSaleItems({
            saleId: this.saleId,
            saleItemId: this.id,
            comboBoxId: comboBox.id,
            productId: comboBoxItem.productId,
            quantity: (this.quantity * comboBoxItem.quantity),
            discount: this.discount,
            saleRate: productSaleRate,
            taxType: this.taxType
          });
    
          await saleUploadItemProduct.setItemAmount();
    
          saleUploadItemProducts.push(saleUploadItemProduct);
        }
      }
    }

    return saleUploadItemProducts;
  // } catch (error) {
  //   return error;
  // }
}

SalesUploadItem.prototype.getRequestData = function(saleUploadItem) {
  // try {
    // this.saleId = saleUploadItem.saleId;
    this.itemType = saleUploadItem.itemType;
    this.itemId = saleUploadItem.itemId;
    this.productId = saleUploadItem.productId;
    this.comboBoxId = saleUploadItem.comboBoxId;
    this.itemName = saleUploadItem.itemName;
    this.shortName = saleUploadItem.shortName;
    // this.description = saleUploadItem.description;
    // this.hsnCode = saleUploadItem.hsnCode;
    this.quantity = saleUploadItem.quantity;
    this.discount = saleUploadItem.discount;
    this.saleRate = saleUploadItem.saleRate;
    // this.taxPercentage = saleUploadItem.taxPercentage;
    // this.amount = saleUploadItem.amount;
    // this.cgstAmount = saleUploadItem.cgstAmount;
    // this.sgstAmount = saleUploadItem.sgstAmount;
    // this.igstAmount = saleUploadItem.igstAmount;
    // this.taxAmount = saleUploadItem.taxAmount;
    // this.totalAmount = saleUploadItem.totalAmount;
    this.asin = saleUploadItem.asin;
    this.skuCode = saleUploadItem.skuCode;
    // this.orderItemId = saleUploadItem.orderItemId;
  // } catch (error) {
  //   return error;
  // }
}

SalesUploadItem.prototype.setItemAmount = async function() {
  // try {
    if (this.itemType.trim().toUpperCase() === 'BOX') {
      // const product = await Product.findByPk(this.productId, {include: 'category'});
      const product = await Product.findByPk(this.productId);
      if(product) {
        this.itemId = product.id;
        this.itemName = product.productName;
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
        this.skuCode = product.skuCode;
        this.asin = product.asin;
      }
    } else {
      const comboBox = await ComboBox.findByPk(this.comboBoxId);
      if(comboBox) {
        this.itemId = comboBox.id;
        this.itemName = comboBox.comboBoxName;
        this.shortName = comboBox.shortName;
        this.description = comboBox.description;
        // this.categoryId = comboBox.categoryId;
        // this.categoryName = ((comboBox.category && comboBox.category.categoryName) ? comboBox.category.categoryName : '');
        // this.categoryName = comboBox.categoryName;
        this.hsnCode = comboBox.hsnCode;
        this.mrp = comboBox.mrp;
        this.grams = comboBox.grams;
        this.taxPercentage = comboBox.taxPercentage;
        this.costWithoutGst = comboBox.costWithoutGst;
        this.costWithGst = comboBox.costWithGst;
        this.skuCode = comboBox.skuCode;
        this.asin = comboBox.asin;
      }
    }

    // const product = await Product.findByPk(this.productId, {include: 'category'});
    // if(product) {
    //   this.productName = product.productName;
    //   this.shortName = product.shortName;
    //   this.description = product.description;
    //   this.categoryId = product.categoryId;
    //   this.categoryName = ((product.category && product.category.categoryName) ? product.category.categoryName : '');
    //   this.hsnCode = product.hsnCode;
    //   this.mrp = product.mrp;
    //   this.grams = product.grams;
    //   this.taxPercentage = product.taxPercentage;
    //   this.costWithoutGst = product.costWithoutGst;
    //   this.costWithGst = product.costWithGst;
    // }

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
    // this.old_po_rate = saleUploadItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

SalesUploadItem.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    if (this.itemType.trim().toUpperCase() === 'BOX') {
      count = await Product.count({ where: { id: this.productId } });
      if (count === 0) {
        return { errors : { itemName: { message: `Box (${this.itemName}) does not found` } } }
      }
    } else {
      count = await ComboBox.count({ where: { id: this.comboBoxId } });
      if (count === 0) {
        return { errors : { itemName: { message: `Combo Box (${this.itemName}) does not found` } } }
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default SalesUploadItem;