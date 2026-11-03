import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateTransactionAmount, round, calculateFiscalYearForDate } from '../lib/common.js';

import Depot from './depot.js';
import Distributor from './distributor.js';
import SaleItem from './saleItem.js';
import User from './user.js';
import State from './state.js';
import Country from './country.js';
import Product from './product.js';
import Box from './box.js';
import ComboBox from './comboBox.js';
import ComboBoxItem from './comboBoxItem.js';
import SaleItemProduct from './saleItemProduct1.js';

const Sale = sequelize.define('distributor_out', {
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
  invoice_no: DataTypes.STRING,
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
  tax_per: DataTypes.DOUBLE,
  tax_amount: DataTypes.DOUBLE,
  final_amount: DataTypes.DOUBLE,
  due_date: DataTypes.DATEONLY,
  order_no: DataTypes.STRING,
  order_date: DataTypes.DATEONLY,
  supplier_ref: DataTypes.STRING,
  despatch_doc_no: DataTypes.STRING,
  despatch_through: DataTypes.STRING,
  destination: DataTypes.STRING,
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
  voucher_no: DataTypes.STRING,
  gate_pass_no: DataTypes.STRING,
  client_name: DataTypes.STRING,
  address: DataTypes.STRING,
  city: DataTypes.STRING,
  pincode: DataTypes.STRING,
  state: DataTypes.STRING,
  country: DataTypes.STRING,
  mobile_no: DataTypes.STRING,
  discount: DataTypes.DOUBLE,
  sample_distributor_id: DataTypes.INTEGER,
  delivery_status: DataTypes.STRING,
  delivery_date: DataTypes.DATEONLY,
  delivery_sales_rep_id: DataTypes.INTEGER,
  receivable_doc: DataTypes.STRING,
  distributor_in_id: DataTypes.INTEGER,
  distributor_in_type: DataTypes.STRING,
  transport_type: DataTypes.STRING,
  vehicle_number: DataTypes.STRING,
  cgst: DataTypes.DOUBLE,
  sgst: DataTypes.DOUBLE,
  igst: DataTypes.DOUBLE,
  cgst_amount: DataTypes.DOUBLE,
  sgst_amount: DataTypes.DOUBLE,
  igst_amount: DataTypes.DOUBLE,
  reverse_charge: DataTypes.STRING,
  shipping_address: DataTypes.STRING,
  distributor_consignee_id: DataTypes.INTEGER,
  con_name: DataTypes.STRING,
  con_address: DataTypes.STRING,
  con_city: DataTypes.STRING,
  con_pincode: DataTypes.STRING,
  con_state: DataTypes.STRING,
  con_country: DataTypes.STRING,
  con_state_code: DataTypes.STRING,
  con_gst_number: DataTypes.STRING,
  state_code: DataTypes.STRING,
  sample_type: DataTypes.STRING,
  gifting_remarks: DataTypes.STRING,
  promoter_sales_rep_id: DataTypes.INTEGER,
  blogger_name: DataTypes.STRING,
  blogger_address: DataTypes.STRING,
  blogger_phone_no: DataTypes.STRING,
  blogger_email_id: DataTypes.STRING,
  round_off_amount: DataTypes.DOUBLE,
  invoice_amount: DataTypes.DOUBLE,
  invoice_date: DataTypes.DATEONLY,
  gatepass_date: DataTypes.DATEONLY,
  gpid: DataTypes.STRING,
  freezed: DataTypes.TINYINT,
  tracking_id: DataTypes.STRING,
  basis_of_sales: DataTypes.STRING,
  email_from: DataTypes.STRING,
  email_approved_by: DataTypes.STRING,
  email_date_time: DataTypes.STRING,
  distributor_po_id: DataTypes.INTEGER,
  comments: DataTypes.STRING,
  gstin: DataTypes.STRING,
  modified_approved_date: DataTypes.DATEONLY,
  proof_of_dispatch: DataTypes.STRING,
  date_of_dispatch: DataTypes.DATEONLY,
  person_receiving: DataTypes.STRING,
  proof_of_delivery: DataTypes.STRING,
  ref_invoice_no: DataTypes.STRING,
  ref_invoice_details: DataTypes.STRING,
  ref_invoice_date: DataTypes.DATEONLY,
  shipping_charges: DataTypes.DOUBLE,
  file_id: DataTypes.INTEGER,
  unique_ref_no: DataTypes.STRING,
  tax_type: DataTypes.STRING
}, 
{ 
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

Sale.belongsTo(Distributor, { foreignKey: "distributor_id", as: "distributor" });
Sale.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
SaleItem.belongsTo(Sale, { foreignKey: "distributor_out_id", as: "sale" });
SaleItem.belongsTo(Box, { foreignKey: "item_id", as: "box" });
Sale.hasMany(SaleItem, { foreignKey: "distributor_out_id", as: "saleItems", onDelete: 'CASCADE' });
Sale.hasMany(SaleItemProduct, { foreignKey: "distributor_out_id", as: "saleItemProducts", onDelete: 'CASCADE' });
Sale.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
Sale.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
Sale.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });


Sale.prototype.setTransactionAmount = function(items) {
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

    const saleAmount = round(this.shipping_charges + this.final_amount, 2);
    this.invoice_amount = round(saleAmount, 0);
    this.round_off_amount = round(this.invoice_amount - saleAmount, 2);
  // } catch (error) {
  //   return error;
  // }
}

Sale.prototype.getInvoiceNo = function(series) {
  try {
    if (this.invoice_no) {
      return this.invoice_no;
    }
  
    const invoice_date = this.invoice_date ? new Date(this.invoice_date) : new Date();
    const financialYear = calculateFiscalYearForDate(invoice_date);
    // const monthName = getMonthName(invoice_date.getMonth());

    const invoice_no = 'W' + '/' + financialYear + '/' + series;
    
    this.invoice_no = invoice_no;
    this.invoice_date = invoice_date.toISOString().substring(0, 10);

    return invoice_no;
  } catch (error) {
    return error;
  }
}

Sale.getMasterData = async function(sale) {
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
      // if (sale.saleItems) {
      //   productCond = { $or: [{ status: 'Approved' }, { _id: sale.saleItems[0].productId }] };
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

Sale.prototype.getRequestData = async function(req) {
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
    this.basisOfSales = req.body.basisOfSales;
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

    const saleItems = [];
    for (const postedSaleItem of req.body.saleItems) {
      const productId = (postedSaleItem.productId) ? postedSaleItem.productId : null;
      const grams = (postedSaleItem.grams) ? +postedSaleItem.grams : null;
      const quantity = (postedSaleItem.quantity) ? +postedSaleItem.quantity : 0;
      const costWithoutGst = (postedSaleItem.costWithoutGst) ? +postedSaleItem.costWithoutGst : null;
      const mrp = (postedSaleItem.mrp) ? +postedSaleItem.mrp : null;
      const taxPercentage = (postedSaleItem.taxPercentage) ? +postedSaleItem.taxPercentage : null;

      const saleItem = {
        productId: productId,
        grams: grams,
        quantity: quantity,
        mrp: mrp,
        taxPercentage: taxPercentage,
        costWithoutGst: costWithoutGst
      };
      
      saleItems.push(saleItem);
    }

    this.saleItems = saleItems;

    const error = await this.setSaleAmountDetails();
    if (error) {
      return error;
    }
  
    // const saleItems = [];
    // let saleAmount = 0;
    // let saleCgstAmount = 0;
    // let saleSgstAmount = 0;
    // let saleIgstAmount = 0;
    // let saleTaxAmount = 0;
    // let saleTotalAmount = 0;
    // let saleCostAmount = 0;
  
    // for (const postedSaleItem of req.body.saleItems) {
    //   const product = await Product
    //                           .findById(postedSaleItem.productId)
    //                           .select('_id productName description hsnCode grams costWithoutGst taxPercentage mrp');
  
    //   if (product) {
    //     const productId = product._id;
    //     const productName = product.productName;
    //     const hsnCode = product.hsnCode;
    //     const hsnName = product.hsnName;
    //     const grams = (postedSaleItem.grams) ? +postedSaleItem.grams : ((product.grams) ? +product.grams : 0);
    //     const quantity = (postedSaleItem.quantity) ? +postedSaleItem.quantity : 0;
    //     const costWithoutGst = (postedSaleItem.costWithoutGst) ? +postedSaleItem.costWithoutGst : ((product.costWithoutGst) ? +product.costWithoutGst : 0);
    //     const costAmount = round(quantity * costWithoutGst, 2);
    //     const mrp = (postedSaleItem.mrp) ? +postedSaleItem.mrp : ((product.mrp) ? +product.mrp : 0);
    //     const taxPercentage = (postedSaleItem.taxPercentage) ? +postedSaleItem.taxPercentage : ((product.taxPercentage) ? +product.taxPercentage : 0);

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
    
    //     saleAmount = saleAmount + amount;
    //     saleCgstAmount = saleCgstAmount + cgstAmount;
    //     saleSgstAmount = saleSgstAmount + sgstAmount;
    //     saleIgstAmount = saleIgstAmount + igstAmount;
    //     saleTaxAmount = saleTaxAmount + taxAmount;
    //     saleTotalAmount = saleTotalAmount + totalAmount;
    //     saleCostAmount = saleCostAmount + costAmount;
  
    //     const saleItem = {
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
        
    //     saleItems.push(saleItem);
    //   }
    // }
  
    // this.amount = saleAmount;
    // this.cgstAmount = saleCgstAmount;
    // this.sgstAmount = saleSgstAmount;
    // this.igstAmount = saleIgstAmount;
    // this.taxAmount = saleTaxAmount;
    // this.totalAmount = saleTotalAmount;
    // this.costAmount = saleCostAmount;
    
    // this.saleAmount = round(this.shippingCharges + saleTotalAmount, 2);
    // this.invoice_amount = round(this.saleAmount, 0)
    // this.round_off_amount = round(this.invoice_amount - this.saleAmount, 2);
  
    // this.saleItems = saleItems;

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

Sale.prototype.getSaleItemProducts = async function(finalSaleItems) {
  // try {
    const finalSaleItemProducts = [];

    for (const finalSaleItem of finalSaleItems) {
      if(finalSaleItem['type']=="Box" || finalSaleItem['type']=="Bar"){
        const saleItemProduct = {...finalSaleItem.dataValues};
        delete saleItemProduct.id;
        // const finalSaleItemProduct = new SaleItemProduct({...saleItemProduct});
        // finalSaleItemProducts.push(finalSaleItemProduct);
        finalSaleItemProducts.push(saleItemProduct);
      } else {
        // const distributor_out_id = finalSaleItem['distributor_out_id'];
        const combo_box_id = finalSaleItem['item_id'];
        const combo_box_qty = isNaN(finalSaleItem['qty']) ? 0 : parseFloat(finalSaleItem['qty']);
        const combo_box_amt = isNaN(finalSaleItem['total_amt']) ? 0 : parseFloat(finalSaleItem['total_amt']);
        const tax_type = finalSaleItem['tax_type'];

        const saleItemProducts = [];
        const saleItemProduct = {
          distributor_out_id: this.id,
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
          batch_qty: 0
        };
        let total_amount = 0;
        const comboBox = await ComboBox.findOne({ 
          where: { id: combo_box_id }, 
          include: [{model: ComboBoxItem, as: 'comboBoxItems', attributes: ['combo_box_id', 'type', 'item_id', 'qty', 'rate', 'grams']}] 
        });
        for (const comboBoxItem of comboBox.comboBoxItems) {
          saleItemProduct.type = comboBoxItem.type ? comboBoxItem.type : 'Box';
          saleItemProduct.item_id = comboBoxItem.item_id ? comboBoxItem.item_id : 0;
          saleItemProduct.qty = comboBoxItem.qty ? round(parseFloat(comboBoxItem.qty) * parseFloat(combo_box_qty), 2) : combo_box_qty;
          saleItemProduct.sell_rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
          saleItemProduct.grams = comboBoxItem.grams ? parseFloat(comboBoxItem.grams) : 0;
          saleItemProduct.rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
          saleItemProduct.gst = comboBox.gst ? comboBox.gst : 'No';
          saleItemProduct.tax_percentage = comboBox.gst && comboBox.gst === 'Yes' ? parseFloat(comboBox.gst_rate) : 0;

          if (saleItemProduct.type.trim().toUpperCase() === "BOX") {
            const box = await Box.findByPk(saleItemProduct.item_id);
            if (box) {
              saleItemProduct.type = 'Box';
              saleItemProduct.item_id = box.id ? box.id : 0;
              saleItemProduct.sell_rate = box.rate ? parseFloat(box.rate) : 0;
              saleItemProduct.grams = box.grams ? parseFloat(box.grams) : 0;
              saleItemProduct.rate = box.rate ? parseFloat(box.rate) : 0;
              if (saleItemProduct.gst.trim().toUpperCase() === 'NO') {
                saleItemProduct.tax_percentage = box.tax_percentage ? parseFloat(box.tax_percentage) : saleItemProduct.tax_percentage;
              }
            } else {
              const product = await Product.findByPk(saleItemProduct.item_id);
              if (box) {
                saleItemProduct.type = 'Bar';
                saleItemProduct.item_id = product.id ? product.id : 0;
                saleItemProduct.sell_rate = product.rate ? parseFloat(product.rate) : 0;
                saleItemProduct.grams = product.grams ? parseFloat(product.grams) : 0;
                saleItemProduct.rate = product.rate ? parseFloat(product.rate) : 0;
                if (saleItemProduct.gst.trim().toUpperCase() === 'NO') {
                  saleItemProduct.tax_percentage = product.tax_percentage ? parseFloat(product.tax_percentage) : saleItemProduct.tax_percentage;
                }
              }
            }
          }

          const item_amount = round(saleItemProduct.qty * saleItemProduct.rate, 2);
          total_amount = total_amount + item_amount;

          saleItemProducts.push({...saleItemProduct});
        }
        
        let disc_per = 0;
        if (total_amount != 0) {
          disc_per = round(((total_amount - combo_box_amt)/total_amount)*100, 2);
        }

        for (const saleItemProduct of saleItemProducts) {
          saleItemProduct.discount = disc_per;
          // saleItemProduct.setItemAmount();
          finalSaleItemProducts.push(saleItemProduct);
          // const finalSaleItemProduct = new SaleItemProduct({...saleItemProduct});
          // finalSaleItemProduct.discount = disc_per;
          // finalSaleItemProduct.setItemAmount();
          // finalSaleItemProducts.push({...finalSaleItemProduct});
        }
      }
    }
    
    return finalSaleItemProducts;
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

Sale.prototype.setSaleAmountDetails = async function() {
  try {
    let tax_type = this.tax_type;

    const saleItems = [];
    let saleAmount = 0;
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

    for (const saleItem of this.saleItems) {
      const product = await Product
                              .findById(saleItem.productId)
                              .select('_id productName description hsnCode hsnName grams costWithoutGst taxPercentage mrp');
      
      if (product) {
        const productId = product._id;
        const productName = product.productName;
        const description = product.description;
        const hsnCode = product.hsnCode;
        const hsnName = product.hsnName;
        const grams = (saleItem.grams) ? +saleItem.grams : ((product.grams) ? +product.grams : 0);
        const quantity = (saleItem.quantity) ? +saleItem.quantity : 0;
        const costWithoutGst = (saleItem.costWithoutGst) ? +saleItem.costWithoutGst : ((product.costWithoutGst) ? +product.costWithoutGst : 0);
        const costAmount = round(quantity * costWithoutGst, 2);
        const mrp = (saleItem.mrp) ? +saleItem.mrp : ((product.mrp) ? +product.mrp : 0);
        const taxPercentage = (saleItem.taxPercentage) ? +saleItem.taxPercentage : ((product.taxPercentage) ? +product.taxPercentage : 0);
        let saleRate = (saleItem.saleRate) ? +saleItem.saleRate : 0;

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
    
        saleAmount = saleAmount + amount;
        saleCgstAmount = saleCgstAmount + cgstAmount;
        saleSgstAmount = saleSgstAmount + sgstAmount;
        saleIgstAmount = saleIgstAmount + igstAmount;
        saleTaxAmount = saleTaxAmount + taxAmount;
        saleTotalAmount = saleTotalAmount + totalAmount;
        saleCostAmount = saleCostAmount + costAmount;

        saleItem.productId = productId;
        saleItem.productName = productName;
        saleItem.description = description;
        saleItem.hsnCode = hsnCode;
        saleItem.hsnName = hsnName;
        saleItem.grams = grams;
        saleItem.quantity = quantity;
        saleItem.mrp = mrp;
        saleItem.taxPercentage = taxPercentage;
        saleItem.saleRate = saleRate;
        saleItem.amount = amount;
        saleItem.discountAmount = 0;
        saleItem.taxableAmount = amount;
        saleItem.cgst = cgst;
        saleItem.sgst = sgst;
        saleItem.igst = igst;
        saleItem.cgstAmount = cgstAmount;
        saleItem.sgstAmount = sgstAmount;
        saleItem.igstAmount = igstAmount;
        saleItem.taxAmount = taxAmount;
        saleItem.totalAmount = totalAmount;
        saleItem.costWithoutGst = costWithoutGst;
        saleItem.costAmount = costAmount;
  
        // const saleItem = {
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
        
        saleItems.push(saleItem);
      }
    }
  
    this.amount = saleAmount;
    this.cgstAmount = saleCgstAmount;
    this.sgstAmount = saleSgstAmount;
    this.igstAmount = saleIgstAmount;
    this.taxAmount = saleTaxAmount;
    this.totalAmount = saleTotalAmount;
    this.costAmount = saleCostAmount;
    
    this.saleAmount = round(this.shippingCharges + saleTotalAmount, 2);
    this.invoice_amount = round(this.saleAmount, 0)
    this.round_off_amount = round(this.invoice_amount - this.saleAmount, 2);
  
    this.saleItems = saleItems;

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

Sale.prototype.approve = function(req) {
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

Sale.prototype.reject = function(req) {
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

Sale.prototype.validateData = async function() {
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

export default Sale;
