import { DataTypes } from "sequelize";
import sequelize from "../lib/database.js";
import Product from "./product.js";
import { round } from "../lib/common.js";
import Distributor from "./distributor.js";
import Depot from "./depot.js";
import Box from "./box.js";
import User from "./user.js";
import SalesUploadItem from "./salesUploadItem.js";


const SalesUploadDetail = sequelize.define('sales_upload_details', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  file_id: DataTypes.INTEGER,
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
  },
  amount: {
    type: DataTypes.DOUBLE,
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
  ref_id: DataTypes.INTEGER,
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
  unique_ref_no: DataTypes.STRING,
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

SalesUploadDetail.belongsTo(Distributor, { foreignKey: "distributor_id", as: "distributor" });
SalesUploadDetail.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
SalesUploadItem.belongsTo(SalesUploadDetail, { foreignKey: "distributor_out_id", as: "sale" });
SalesUploadItem.belongsTo(Box, { foreignKey: "item_id", as: "box" });
SalesUploadDetail.hasMany(SalesUploadItem, { foreignKey: "distributor_out_id", as: "saleItems", onDelete: 'CASCADE' });
SalesUploadDetail.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
SalesUploadDetail.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
SalesUploadDetail.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });


SalesUploadDetail.prototype.setSellAmountDetails = async function() {
  try {
    let taxType = this.taxType;

    const sellItems = [];
    let sellAmount = 0;
    let sellCgstAmount = 0;
    let sellSgstAmount = 0;
    let sellIgstAmount = 0;
    let sellTaxAmount = 0;
    let sellTotalAmount = 0;
    let sellCostAmount = 0;

    for (const sellItem of this.sellItems) {
      const product = await Product.findById(sellItem.productId).select('id productName description hsnCode hsnName grams costWithoutGst taxPercentage mrp');
      
      if (product) {
        const productId = product.id;
        const productName = product.productName;
        const description = product.description;
        const hsnCode = product.hsnCode;
        const hsnName = product.hsnName;
        const grams = (sellItem.grams) ? +sellItem.grams : ((product.grams) ? +product.grams : 0);
        const quantity = (sellItem.quantity) ? +sellItem.quantity : 0;
        const costWithoutGst = (sellItem.costWithoutGst) ? +sellItem.costWithoutGst : ((product.costWithoutGst) ? +product.costWithoutGst : 0);
        const costAmount = round(quantity * costWithoutGst, 2);
        const mrp = (sellItem.mrp) ? +sellItem.mrp : ((product.mrp) ? +product.mrp : 0);
        const taxPercentage = (sellItem.taxPercentage) ? +sellItem.taxPercentage : ((product.taxPercentage) ? +product.taxPercentage : 0);
        let sellRate = (sellItem.sellRate) ? +sellItem.sellRate : 0;

        if (!this.discount) this.discount = 0;
        
        if (!sellRate) {
          sellRate = mrp - ((mrp * this.discount)/100);
          sellRate = round((sellRate / (100 + taxPercentage)) * 100, 2);
        }

        let amount = round(quantity * sellRate, 2);
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        let taxAmount = 0;
        let totalAmount = 0;
        
        if (taxType === 'Intra') {
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
    
        sellAmount = sellAmount + amount;
        sellCgstAmount = sellCgstAmount + cgstAmount;
        sellSgstAmount = sellSgstAmount + sgstAmount;
        sellIgstAmount = sellIgstAmount + igstAmount;
        sellTaxAmount = sellTaxAmount + taxAmount;
        sellTotalAmount = sellTotalAmount + totalAmount;
        sellCostAmount = sellCostAmount + costAmount;

        sellItem.productId = productId;
        sellItem.productName = productName;
        sellItem.description = description;
        sellItem.hsnCode = hsnCode;
        sellItem.hsnName = hsnName;
        sellItem.grams = grams;
        sellItem.quantity = quantity;
        sellItem.mrp = mrp;
        sellItem.taxPercentage = taxPercentage;
        sellItem.sellRate = sellRate;
        sellItem.amount = amount;
        sellItem.discountAmount = 0;
        sellItem.taxableAmount = amount;
        sellItem.cgst = cgst;
        sellItem.sgst = sgst;
        sellItem.igst = igst;
        sellItem.cgstAmount = cgstAmount;
        sellItem.sgstAmount = sgstAmount;
        sellItem.igstAmount = igstAmount;
        sellItem.taxAmount = taxAmount;
        sellItem.totalAmount = totalAmount;
        sellItem.costWithoutGst = costWithoutGst;
        sellItem.costAmount = costAmount;
        
        sellItems.push(sellItem);
      }
    }
  
    this.amount = sellAmount;
    this.cgstAmount = sellCgstAmount;
    this.sgstAmount = sellSgstAmount;
    this.igstAmount = sellIgstAmount;
    this.taxAmount = sellTaxAmount;
    this.totalAmount = sellTotalAmount;
    this.costAmount = sellCostAmount;
    
    this.sellAmount = round(this.shippingCharges + sellTotalAmount, 2);
    this.invoiceAmount = round(this.sellAmount, 0)
    this.roundOffAmount = round(this.invoiceAmount - this.sellAmount, 2);
  
    this.sellItems = sellItems;

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

SalesUploadDetail.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }
    return null;
  } catch (error) {
    return error;
  }
}

SalesUploadDetail.prototype.getSellDetails = function() {
  try {
    const sellItems = this.sellUploadDetails.map(sellUploadDetail => {
      return {
        productId: sellUploadDetail.productId,
        productName: sellUploadDetail.productName,
        description: sellUploadDetail.description,
        hsnCode: sellUploadDetail.hsnCode,
        hsnName: sellUploadDetail.hsnName,
        grams: sellUploadDetail.grams,
        quantity: sellUploadDetail.quantity,
        mrp: sellUploadDetail.mrp,
        taxPercentage: sellUploadDetail.taxPercentage,
        sellRate: sellUploadDetail.sellRate,
        amount: sellUploadDetail.amount,
        discountAmount: sellUploadDetail.discountAmount,
        taxableAmount: sellUploadDetail.taxableAmount,
        cgst: sellUploadDetail.cgst,
        sgst: sellUploadDetail.sgst,
        igst: sellUploadDetail.igst,
        cgstAmount: sellUploadDetail.cgstAmount,
        sgstAmount: sellUploadDetail.sgstAmount,
        igstAmount: sellUploadDetail.igstAmount,
        taxAmount: sellUploadDetail.taxAmount,
        totalAmount: sellUploadDetail.totalAmount,
        costWithoutGst: sellUploadDetail.costWithoutGst,
        costAmount: sellUploadDetail.costAmount
      }
    });

    const updatedObj = {
      sellDate: this.sellDate,
      dateOfProcessing: this.dateOfProcessing,
      depot: this.depot,
      distributor: this.distributor,
      orderNo: this.orderNo,
      orderDate: this.orderDate,
      dueDate: this.dueDate,
      invoiceNo: this.invoiceNo,
      invoiceDate: this.invoiceDate,
      sellAmount: this.sellAmount,
      roundOffAmount: this.roundOffAmount,
      invoiceAmount: this.invoiceAmount,
      name: this.name,
      address: this.address,
      city: this.city,
      pincode: this.pincode,
      state: this.state,
      country: this.country,
      mobileNo: this.mobileNo,
      discount: this.discount,
      gstNo: this.gstNo,
      uniqueRefNo: this.uniqueRefNo,
      sellState: this.sellState,
      taxType: this.taxType,
      sellItems: sellItems,
      amount: this.amount,
      cgstAmount: this.cgstAmount,
      sgstAmount: this.sgstAmount,
      igstAmount: this.igstAmount,
      taxAmount: this.taxAmount,
      totalAmount: this.totalAmount,
      costAmount: this.costAmount,
      shippingCharges: this.shippingCharges,
      shippingSameAsBilling: this.shippingSameAsBilling,
      deliveryStatus: this.deliveryStatus,
      dispatchDetails: this.dispatchDetails,
      consignee: this.consignee,
      basisOfSells: this.basisOfSells,
      refInvoiceNo: this.refInvoiceNo,
      refInvoiceDetails: this.refInvoiceDetails,
      refInvoiceDate: this.refInvoiceDate,
      emailFrom: this.emailFrom,
      emailApprovedBy: this.emailApprovedBy,
      emailDate: this.emailDate,
      sellUpload: this.sellUpload,
      status: this.status,
      isDeleted: this.isDeleted,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      remarks: this.remarks
    };

    return updatedObj;
  } catch (error) {
    return error;
  }
}

export default SalesUploadDetail;