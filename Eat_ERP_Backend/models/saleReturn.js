import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateTransactionAmount, round, calculateFiscalYearForDate } from '../lib/common.js';

import Depot from './depot.js';
import Distributor from './distributor.js';
import SaleReturnItem from './saleReturnItem.js';
import User from './user.js';
import State from './state.js';
import Country from './country.js';
import Product from './product.js';
import Box from './box.js';
import ComboBox from './comboBox.js';
import ComboBoxItem from './comboBoxItem.js';
import SaleReturnItemProduct from './saleReturnItemProduct.js';

const SaleReturn = sequelize.define('distributor_in', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  date_of_processing: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true,
      // isValidDate: true
    }
  },
  depot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  distributor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  sales_rep_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  amount: {
    type: DataTypes.DOUBLE,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  tax: DataTypes.STRING,
  // tax_per: DataTypes.DOUBLE,
  tax_amount: DataTypes.DOUBLE,
  final_amount: DataTypes.DOUBLE,
  due_date: DataTypes.DATEONLY,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  ref_id: DataTypes.INTEGER,
  is_expired: DataTypes.STRING(50),
  is_exchanged: DataTypes.STRING(50),
  final_cost_amount: DataTypes.DOUBLE,
  sales_return_no: DataTypes.STRING,
  cgst: DataTypes.DOUBLE,
  sgst: DataTypes.DOUBLE,
  igst: DataTypes.DOUBLE,
  cgst_amount: DataTypes.DOUBLE,
  sgst_amount: DataTypes.DOUBLE,
  igst_amount: DataTypes.DOUBLE,
  freezed: DataTypes.TINYINT,
  round_off_amount: DataTypes.DOUBLE,
  sales_type: DataTypes.STRING,
  invoice_nos: DataTypes.STRING,
  modified_approved_date: DataTypes.DATEONLY,
  discount: DataTypes.DOUBLE,
  order_no: DataTypes.STRING(100),
  sales_return_date: DataTypes.DATEONLY,
  fc_id: DataTypes.STRING,
  file_id: DataTypes.INTEGER,
  shipping_charges: DataTypes.DOUBLE,
  sales_return_amount: DataTypes.DOUBLE,
  tax_type: DataTypes.STRING
}, 
{ 
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

SaleReturn.belongsTo(Distributor, { foreignKey: "distributor_id", as: "distributor" });
SaleReturn.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
SaleReturnItem.belongsTo(SaleReturn, { foreignKey: "distributor_in_id", as: "saleReturn" });
SaleReturnItem.belongsTo(Box, { foreignKey: "item_id", as: "box" });
SaleReturn.hasMany(SaleReturnItem, { foreignKey: "distributor_in_id", as: "saleReturnItems", onDelete: 'CASCADE' });
SaleReturn.hasMany(SaleReturnItemProduct, { foreignKey: "distributor_in_id", as: "saleReturnItemProducts", onDelete: 'CASCADE' });
SaleReturn.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
SaleReturn.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
SaleReturn.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });


SaleReturn.prototype.setTransactionAmount = function(items) {
  // try {
    const transaction = calculateTransactionAmount(items, 0, this.round_off_amount);

    this.amount = transaction.amount;
    this.cgst_amount = transaction.cgst_amount;
    this.sgst_amount = transaction.sgst_amount;
    this.igst_amount = transaction.igst_amount;
    this.tax_amount = transaction.tax_amount;
    this.final_amount = transaction.total_amount;
    // this.tds_amount = transaction.tds_amount;
    // this.round_off_amount = transaction.round_off_amount;

    const saleReturnAmount = round(this.shipping_charges + this.final_amount, 2);
    this.sales_return_amount = round(saleReturnAmount, 0);
    this.round_off_amount = round(this.sales_return_amount - saleReturnAmount, 2);
  // } catch (error) {
  //   return error;
  // }
}

SaleReturn.prototype.getSaleReturnNo = function(series) {
  try {
    if (this.sales_return_no) {
      return this.sales_return_no;
    }
  
    const sales_return_date = this.sales_return_date ? new Date(this.sales_return_date) : new Date();
    const financialYear = calculateFiscalYearForDate(sales_return_date);
    // const monthName = getMonthName(sales_return_date.getMonth());

    const sales_return_no = 'WHPL' + '/' + financialYear + '-SR/' + series;
    
    this.sales_return_no = sales_return_no;
    this.sales_return_date = sales_return_date.toISOString().substring(0, 10);

    return sales_return_no;
  } catch (error) {
    return error;
  }
}

SaleReturn.getMasterData = async function(sale) {
  try {
    let depotCond = { status: 'Approved' };
    let distributorCond = { status: 'Approved' };
    let stateCond = { status: 'Approved' };
    let countryCond = { status: 'Approved' };
    let productCond = { status: 'Approved' };

    if (sale) {
      if (sale.depot) {
        depotCond = { $or: [{ status: 'Approved' }, { _id: sale.depot }] };
      }
      if (sale.distributor) {
        distributorCond = { $or: [{ status: 'Approved' }, { _id: sale.distributor }] };
      }
      if (sale.state && sale.state._id) {
        stateCond = { $or: [{ status: 'Approved' }, { _id: sale.state._id }] };
      }
      if (sale.country && sale.country._id) {
        countryCond = { $or: [{ status: 'Approved' }, { _id: sale.country._id }] };
      }
      // if (sale.saleReturnItems) {
      //   productCond = { $or: [{ status: 'Approved' }, { _id: sale.saleReturnItems[0].productId }] };
      // }
    }

    const depots = await Depot.find(depotCond).select('_id depotName state');
    const distributors = await Distributor.find(distributorCond).select('_id distributorName state class discount consignees');
    const states = await State.find(stateCond).select('_id stateName stateCode country');
    const countries = await Country.find(countryCond).select('_id countryName countryCode');
    const products = await Product.find(productCond).select('_id productName description hsnCode grams costWithoutGst taxPercentage mrp');

    return { depots, distributors, states, countries, products };
  } catch (error) {
    // console.log('Error', error);
    return error;
  }
}

SaleReturn.prototype.getRequestData = async function(req) {
  try {
    this.saleDate = (req.body.saleDate) ? req.body.saleDate : '';
    this.name = req.body.name;
    this.address = req.body.address;
    this.city = req.body.city;
    this.pincode = req.body.pincode;

    if (req.body.state) {
      this.state = await State.findById(req.body.state).select('_id stateName stateCode country');
    }
    if (req.body.country) {
      this.country = await Country.findById(req.body.country).select('_id countryName countryCode');
    }
    
    this.mobileNo = req.body.mobileNo;
    this.discount = (req.body.discount) ? +req.body.discount : 0;
    this.gstNo = req.body.gstNo;
    this.uniqueRefNo = req.body.uniqueRefNo;
    this.shippingCharges = (req.body.shippingCharges) ? req.body.shippingCharges : 0;
    this.dueDate = (req.body.dueDate) ? req.body.dueDate : null;
    // this.shippingSameAsBilling = (req.body.shippingSameAsBilling) ? req.body.shippingSameAsBilling : null;
    this.shippingSameAsBilling = req.body.shippingSameAsBilling;
    // this.consignee = req.body.consignee;
    this.basisOfSaleReturns = req.body.basisOfSaleReturns;
    this.orderNo = req.body.orderNo;
    this.orderDate = (req.body.orderDate) ? req.body.orderDate : null;
    this.refInvoiceNo = req.body.refInvoiceNo;
    this.refInvoiceDetails = req.body.refInvoiceDetails;
    this.refInvoiceDate = (req.body.refInvoiceDate) ? req.body.refInvoiceDate : null;
    this.emailFrom = req.body.emailFrom;
    this.emailApprovedBy = req.body.emailApprovedBy;
    this.emailDate = (req.body.emailDate) ? req.body.emailDate : null;
    this.remarks = req.body.remarks;

    let depotState = '';
    if (req.body.depot) {
      const depot = await Depot.findById(req.body.depot);
      if (depot && depot.state && depot.state.stateName) {
        this.depot = req.body.depot;
        depotState = depot.state.stateName;
      }
    } else {
      this.depot = null;
    }

    let saleState = {};
    let distributorState = '';
    this.consignee = null;
    if (req.body.distributor) {
      const distributor = await Distributor.findById(req.body.distributor);
      if (distributor) {
        this.distributor = req.body.distributor;

        if (distributor.class && distributor.class.trim().toUpperCase() === 'DIRECT') {
          if (this.state && this.state.stateName) {
            distributorState = this.state.stateName;
            saleState = this.state;
          }
        } else if (!this.shippingSameAsBilling && req.body.consignee) {
          if (distributor.consignees) {
            const consignee = distributor.consignees.filter(consignee => consignee._id.toString() === req.body.consignee);
            if (consignee && consignee.length > 0) {
              this.consignee = consignee[0];
              distributorState = consignee[0].state.stateName;
              saleState = consignee[0].state;
            }
          }
        } else if (distributor.state && distributor.state.stateName) {
          distributorState = distributor.state.stateName;
          saleState = distributor.state;
        }
      }
    } else {
      this.distributor = null;
    }
    
    this.saleState = saleState;
    
    let tax_type = 'Intra';
    if (distributorState === depotState) {
      tax_type = "Intra";
    } else {
      tax_type = "Inter"
    }

    this.tax_type = tax_type;

    const saleReturnItems = [];
    for (const postedSaleReturnItem of req.body.saleReturnItems) {
      const productId = (postedSaleReturnItem.productId) ? postedSaleReturnItem.productId : null;
      const grams = (postedSaleReturnItem.grams) ? +postedSaleReturnItem.grams : null;
      const quantity = (postedSaleReturnItem.quantity) ? +postedSaleReturnItem.quantity : 0;
      const costWithoutGst = (postedSaleReturnItem.costWithoutGst) ? +postedSaleReturnItem.costWithoutGst : null;
      const mrp = (postedSaleReturnItem.mrp) ? +postedSaleReturnItem.mrp : null;
      const taxPercentage = (postedSaleReturnItem.taxPercentage) ? +postedSaleReturnItem.taxPercentage : null;

      const saleReturnItem = {
        productId: productId,
        grams: grams,
        quantity: quantity,
        mrp: mrp,
        taxPercentage: taxPercentage,
        costWithoutGst: costWithoutGst
      };
      
      saleReturnItems.push(saleReturnItem);
    }

    this.saleReturnItems = saleReturnItems;

    const error = await this.setSaleReturnAmountDetails();
    if (error) {
      return error;
    }
  
    // const saleReturnItems = [];
    // let saleReturnAmount = 0;
    // let saleCgstAmount = 0;
    // let saleSgstAmount = 0;
    // let saleIgstAmount = 0;
    // let saleTaxAmount = 0;
    // let saleTotalAmount = 0;
    // let saleCostAmount = 0;
  
    // for (const postedSaleReturnItem of req.body.saleReturnItems) {
    //   const product = await Product
    //                           .findById(postedSaleReturnItem.productId)
    //                           .select('_id productName description hsnCode grams costWithoutGst taxPercentage mrp');
  
    //   if (product) {
    //     const productId = product._id;
    //     const productName = product.productName;
    //     const hsnCode = product.hsnCode;
    //     const hsnName = product.hsnName;
    //     const grams = (postedSaleReturnItem.grams) ? +postedSaleReturnItem.grams : ((product.grams) ? +product.grams : 0);
    //     const quantity = (postedSaleReturnItem.quantity) ? +postedSaleReturnItem.quantity : 0;
    //     const costWithoutGst = (postedSaleReturnItem.costWithoutGst) ? +postedSaleReturnItem.costWithoutGst : ((product.costWithoutGst) ? +product.costWithoutGst : 0);
    //     const costAmount = round(quantity * costWithoutGst, 2);
    //     const mrp = (postedSaleReturnItem.mrp) ? +postedSaleReturnItem.mrp : ((product.mrp) ? +product.mrp : 0);
    //     const taxPercentage = (postedSaleReturnItem.taxPercentage) ? +postedSaleReturnItem.taxPercentage : ((product.taxPercentage) ? +product.taxPercentage : 0);

    //     if (!this.discount) this.discount = 0;
    //     const saleRate = round(mrp - ((mrp * this.discount)/100), 2);
  
    //     let amount = round(quantity * saleRate, 2);
    //     let cgst = 0;
    //     let sgst = 0;
    //     let igst = 0;
    //     let cgstAmount = 0;
    //     let sgstAmount = 0;
    //     let igstAmount = 0;
    //     let taxAmount = 0;
    //     let totalAmount = 0;
        
    //     if (tax_type === 'Intra') {
    //       cgst = round((taxPercentage / 2), 2);
    //       sgst = round((taxPercentage / 2), 2);
    
    //       cgstAmount = round(((amount * cgst) / 100), 2);
    //       sgstAmount = round(((amount * sgst) / 100), 2);
    //     } else {
    //       igst = round(taxPercentage, 2);
    //       igstAmount = round(((amount * igst) /100), 2);
    //     }
    
    //     taxAmount = round(cgstAmount + sgstAmount + igstAmount, 2);
    //     totalAmount = round(amount + taxAmount, 2);
    
    //     saleReturnAmount = saleReturnAmount + amount;
    //     saleCgstAmount = saleCgstAmount + cgstAmount;
    //     saleSgstAmount = saleSgstAmount + sgstAmount;
    //     saleIgstAmount = saleIgstAmount + igstAmount;
    //     saleTaxAmount = saleTaxAmount + taxAmount;
    //     saleTotalAmount = saleTotalAmount + totalAmount;
    //     saleCostAmount = saleCostAmount + costAmount;
  
    //     const saleReturnItem = {
    //       productId: productId,
    //       productName: productName,
    //       hsnCode: hsnCode,
    //       hsnName: hsnName,
    //       grams: grams,
    //       quantity: quantity,
    //       mrp: mrp,
    //       taxPercentage: taxPercentage,
    //       saleRate: saleRate,
    //       amount: amount,
    //       discountAmount: 0,
    //       taxableAmount: amount,
    //       cgst: cgst,
    //       sgst: sgst,
    //       igst: igst,
    //       cgstAmount: cgstAmount,
    //       sgstAmount: sgstAmount,
    //       igstAmount: igstAmount,
    //       taxAmount: taxAmount,
    //       totalAmount: totalAmount,
    //       costWithoutGst: costWithoutGst,
    //       costAmount: costAmount
    //     };
        
    //     saleReturnItems.push(saleReturnItem);
    //   }
    // }
  
    // this.amount = saleReturnAmount;
    // this.cgstAmount = saleCgstAmount;
    // this.sgstAmount = saleSgstAmount;
    // this.igstAmount = saleIgstAmount;
    // this.taxAmount = saleTaxAmount;
    // this.totalAmount = saleTotalAmount;
    // this.costAmount = saleCostAmount;
    
    // this.saleReturnAmount = round(this.shippingCharges + saleTotalAmount, 2);
    // this.sales_return_amount = round(this.saleReturnAmount, 0)
    // this.round_off_amount = round(this.sales_return_amount - this.saleReturnAmount, 2);
  
    // this.saleReturnItems = saleReturnItems;

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

SaleReturn.prototype.getSaleReturnItemProducts = async function(finalSaleReturnItems) {
  // try {
    const finalSaleReturnItemProducts = [];

    for (const finalSaleReturnItem of finalSaleReturnItems) {
      if(finalSaleReturnItem['type']=="Box" || finalSaleReturnItem['type']=="Bar"){
        const saleReturnItemProduct = {...finalSaleReturnItem.dataValues};
        delete saleReturnItemProduct.id;
        // const finalSaleReturnItemProduct = new SaleReturnItemProduct({...saleReturnItemProduct});
        // finalSaleReturnItemProducts.push(finalSaleReturnItemProduct);
        finalSaleReturnItemProducts.push(saleReturnItemProduct);
      } else {
        // const distributor_in_id = finalSaleReturnItem['distributor_in_id'];
        const combo_box_id = finalSaleReturnItem['item_id'];
        const combo_box_qty = isNaN(finalSaleReturnItem['qty']) ? 0 : finalSaleReturnItem['qty'];
        const combo_box_amt = isNaN(finalSaleReturnItem['total_amt']) ? 0 : finalSaleReturnItem['total_amt'];
        const tax_type = finalSaleReturnItem['tax_type'];

        const saleReturnItemProducts = [];
        const saleReturnItemProduct = {
          distributor_in_id: this.id,
          type: 'Box',
          item_id: 0,
          qty: combo_box_qty,
          sell_rate: 0,
          grams: 0,
          rate: 0,
          discount: 0,
          discount_amt: 0,
          amount: 0,
          cgst_amt: 0,
          sgst_amt: 0,
          igst_amt: 0,
          tax_amt: 0,
          total_amt: 0,
          margin_per: 0,
          promo_margin: 0,
          gst: 'Yes',
          tax_percentage: 0,
          tax_type: tax_type,
          combo_box_id: combo_box_id,
          batch_no: 182,
          batch_qty: 0,
          cost_rate: 0,
          cost_amount: 0
        };
        let total_amount = 0;
        const comboBox = await ComboBox.findOne({ 
          where: { id: combo_box_id }, 
          include: [{model: ComboBoxItem, as: 'comboBoxItems', attributes: ['combo_box_id', 'type', 'item_id', 'qty', 'rate', 'grams']}] 
        });
        for (const comboBoxItem of comboBox.comboBoxItems) {
          saleReturnItemProduct.type = comboBoxItem.type ? comboBoxItem.type : 'Box';
          saleReturnItemProduct.item_id = comboBoxItem.item_id ? comboBoxItem.item_id : 0;
          saleReturnItemProduct.qty = comboBoxItem.qty ? round(parseFloat(comboBoxItem.qty) * parseFloat(combo_box_qty), 2) : combo_box_qty;
          saleReturnItemProduct.sell_rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
          saleReturnItemProduct.grams = comboBoxItem.grams ? parseFloat(comboBoxItem.grams) : 0;
          saleReturnItemProduct.rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
          saleReturnItemProduct.gst = comboBox.gst ? comboBox.gst : 'No';
          saleReturnItemProduct.tax_percentage = comboBox.gst && comboBox.gst === 'Yes' ? parseFloat(comboBox.gst_rate) : 0;

          if (saleReturnItemProduct.type.trim().toUpperCase() === "BOX") {
            const box = await Box.findByPk(saleReturnItemProduct.item_id);
            if (box) {
              saleReturnItemProduct.type = 'Box';
              saleReturnItemProduct.item_id = box.id ? box.id : 0;
              saleReturnItemProduct.sell_rate = box.rate ? parseFloat(box.rate) : 0;
              saleReturnItemProduct.grams = box.grams ? parseFloat(box.grams) : 0;
              saleReturnItemProduct.rate = box.rate ? parseFloat(box.rate) : 0;
              if (saleReturnItemProduct.gst.trim().toUpperCase() === 'NO') {
                saleReturnItemProduct.tax_percentage = box.tax_percentage ? parseFloat(box.tax_percentage) : saleReturnItemProduct.tax_percentage;
              }
            } else {
              const product = await Product.findByPk(saleReturnItemProduct.item_id);
              if (box) {
                saleReturnItemProduct.type = 'Bar';
                saleReturnItemProduct.item_id = product.id ? product.id : 0;
                saleReturnItemProduct.sell_rate = product.rate ? parseFloat(product.rate) : 0;
                saleReturnItemProduct.grams = product.grams ? parseFloat(product.grams) : 0;
                saleReturnItemProduct.rate = product.rate ? parseFloat(product.rate) : 0;
                if (saleReturnItemProduct.gst.trim().toUpperCase() === 'NO') {
                  saleReturnItemProduct.tax_percentage = product.tax_percentage ? parseFloat(product.tax_percentage) : saleReturnItemProduct.tax_percentage;
                }
              }
            }
          }

          const item_amount = round(saleReturnItemProduct.qty * saleReturnItemProduct.rate, 2);
          total_amount = total_amount + item_amount;

          saleReturnItemProducts.push({...saleReturnItemProduct});
        }
        
        let disc_per = 0;
        if (total_amount != 0) {
          disc_per = round(((total_amount - combo_box_amt)/total_amount)*100, 2);
        }

        for (const saleReturnItemProduct of saleReturnItemProducts) {
          saleReturnItemProduct.discount = disc_per;
          // saleReturnItemProduct.setItemAmount();
          finalSaleReturnItemProducts.push(saleReturnItemProduct);
          // const finalSaleReturnItemProduct = new SaleReturnItemProduct({...saleReturnItemProduct});
          // finalSaleReturnItemProduct.discount = disc_per;
          // finalSaleReturnItemProduct.setItemAmount();
          // finalSaleReturnItemProducts.push({...finalSaleReturnItemProduct});
        }
      }
    }
    
    return finalSaleReturnItemProducts;
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

SaleReturn.prototype.setSaleReturnAmountDetails = async function() {
  try {
    let tax_type = this.tax_type;

    const saleReturnItems = [];
    let saleReturnAmount = 0;
    let saleCgstAmount = 0;
    let saleSgstAmount = 0;
    let saleIgstAmount = 0;
    let saleTaxAmount = 0;
    let saleTotalAmount = 0;
    let saleCostAmount = 0;
  
    // let tax_type = 'Intra';
    // if (this.saleState._id.toString() === this.depot.state._id.toString()) {
    //   tax_type = "Intra";
    // } else {
    //   tax_type = "Inter"
    // }

    for (const saleReturnItem of this.saleReturnItems) {
      const product = await Product
                              .findById(saleReturnItem.productId)
                              .select('_id productName description hsnCode hsnName grams costWithoutGst taxPercentage mrp');
      
      if (product) {
        const productId = product._id;
        const productName = product.productName;
        const description = product.description;
        const hsnCode = product.hsnCode;
        const hsnName = product.hsnName;
        const grams = (saleReturnItem.grams) ? +saleReturnItem.grams : ((product.grams) ? +product.grams : 0);
        const quantity = (saleReturnItem.quantity) ? +saleReturnItem.quantity : 0;
        const costWithoutGst = (saleReturnItem.costWithoutGst) ? +saleReturnItem.costWithoutGst : ((product.costWithoutGst) ? +product.costWithoutGst : 0);
        const costAmount = round(quantity * costWithoutGst, 2);
        const mrp = (saleReturnItem.mrp) ? +saleReturnItem.mrp : ((product.mrp) ? +product.mrp : 0);
        const taxPercentage = (saleReturnItem.taxPercentage) ? +saleReturnItem.taxPercentage : ((product.taxPercentage) ? +product.taxPercentage : 0);
        let saleRate = (saleReturnItem.saleRate) ? +saleReturnItem.saleRate : 0;

        if (!this.discount) this.discount = 0;

        if (!saleRate) {
          saleRate = mrp - ((mrp * this.discount)/100);
          saleRate = round((saleRate / (100 + taxPercentage)) * 100, 2);
        }

        let amount = round(quantity * saleRate, 2);
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        let taxAmount = 0;
        let totalAmount = 0;
        
        if (tax_type === 'Intra') {
          cgst = round((taxPercentage / 2), 2);
          sgst = round((taxPercentage / 2), 2);
    
          cgstAmount = round(((amount * cgst) / 100), 2);
          sgstAmount = round(((amount * sgst) / 100), 2);
        } else {
          igst = round(taxPercentage, 2);
          igstAmount = round(((amount * igst) /100), 2);
        }
    
        taxAmount = round(cgstAmount + sgstAmount + igstAmount, 2);
        totalAmount = round(amount + taxAmount, 2);
    
        saleReturnAmount = saleReturnAmount + amount;
        saleCgstAmount = saleCgstAmount + cgstAmount;
        saleSgstAmount = saleSgstAmount + sgstAmount;
        saleIgstAmount = saleIgstAmount + igstAmount;
        saleTaxAmount = saleTaxAmount + taxAmount;
        saleTotalAmount = saleTotalAmount + totalAmount;
        saleCostAmount = saleCostAmount + costAmount;

        saleReturnItem.productId = productId;
        saleReturnItem.productName = productName;
        saleReturnItem.description = description;
        saleReturnItem.hsnCode = hsnCode;
        saleReturnItem.hsnName = hsnName;
        saleReturnItem.grams = grams;
        saleReturnItem.quantity = quantity;
        saleReturnItem.mrp = mrp;
        saleReturnItem.taxPercentage = taxPercentage;
        saleReturnItem.saleRate = saleRate;
        saleReturnItem.amount = amount;
        saleReturnItem.discountAmount = 0;
        saleReturnItem.taxableAmount = amount;
        saleReturnItem.cgst = cgst;
        saleReturnItem.sgst = sgst;
        saleReturnItem.igst = igst;
        saleReturnItem.cgstAmount = cgstAmount;
        saleReturnItem.sgstAmount = sgstAmount;
        saleReturnItem.igstAmount = igstAmount;
        saleReturnItem.taxAmount = taxAmount;
        saleReturnItem.totalAmount = totalAmount;
        saleReturnItem.costWithoutGst = costWithoutGst;
        saleReturnItem.costAmount = costAmount;
  
        // const saleReturnItem = {
        //   productId: productId,
        //   productName: productName,
        //   description: description,
        //   hsnCode: hsnCode,
        //   hsnName: hsnName,
        //   grams: grams,
        //   quantity: quantity,
        //   mrp: mrp,
        //   taxPercentage: taxPercentage,
        //   saleRate: saleRate,
        //   amount: amount,
        //   discountAmount: 0,
        //   taxableAmount: amount,
        //   cgst: cgst,
        //   sgst: sgst,
        //   igst: igst,
        //   cgstAmount: cgstAmount,
        //   sgstAmount: sgstAmount,
        //   igstAmount: igstAmount,
        //   taxAmount: taxAmount,
        //   totalAmount: totalAmount,
        //   costWithoutGst: costWithoutGst,
        //   costAmount: costAmount
        // };
        
        saleReturnItems.push(saleReturnItem);
      }
    }
  
    this.amount = saleReturnAmount;
    this.cgstAmount = saleCgstAmount;
    this.sgstAmount = saleSgstAmount;
    this.igstAmount = saleIgstAmount;
    this.taxAmount = saleTaxAmount;
    this.totalAmount = saleTotalAmount;
    this.costAmount = saleCostAmount;
    
    this.saleReturnAmount = round(this.shippingCharges + saleTotalAmount, 2);
    this.sales_return_amount = round(this.saleReturnAmount, 0)
    this.round_off_amount = round(this.sales_return_amount - this.saleReturnAmount, 2);
  
    this.saleReturnItems = saleReturnItems;

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

SaleReturn.prototype.approve = function(req) {
  try {
    if (this.isDeleted) {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.approvedBy = req.userData.userId;
    this.approvedAt = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

SaleReturn.prototype.reject = function(req) {
  try {
    this.status = "Rejected";
    this.remarks = req.body.remarks;
    this.rejectedBy = req.userData.userId;
    this.rejectedAt = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

SaleReturn.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ saleName: this.saleName, _id: { $ne: this._id } });
    // if (count > 0) {
    //   return { errors : { saleName: { message: `Two sales cannot share the same saleName (${this.saleName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { saleName: { message: `Two sales cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { saleName: { message: `Two sales cannot share the same skuCode (${this.skuCode})` } } }
    //   }
    // }

    // if (this.category) {
    //   count = await Category.countDocuments({ _id: this.category });
    //   if (count === 0) {
    //     return { errors : { category: { message: `Category does not exist` } } }
    //   }
    // }

    return null;
  } catch (error) {
    return error;
  }
}

export default SaleReturn;
