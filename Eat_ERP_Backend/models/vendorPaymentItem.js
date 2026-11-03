import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

// import VendorPayment from './vendorPayment.js';
import Vendor from './vendor.js';
import PaymentVoucher from './paymentVoucher.js';

const VendorPaymentItem = sequelize.define('vendor_payment_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  vendor_payment_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  transaction_type: {
    type: DataTypes.STRING,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  beneficiary_name: {
    type: DataTypes.STRING,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  vendor_payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  vendor_amount: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  vendor_payment_amount: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  is_approved: DataTypes.TINYINT,
  narration: DataTypes.STRING,
  vendor_code: DataTypes.STRING,
  bank_acc_no: DataTypes.STRING,
  ifsc_code: DataTypes.STRING,
  bank_name: DataTypes.STRING,
  bank_branch_name: DataTypes.STRING,
  bank_email:DataTypes.STRING,
  payment_voucher_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  vendor_name: DataTypes.STRING,
  invoice_no: DataTypes.STRING,
  invoice_date: DataTypes.DATEONLY,
  payment_remarks: DataTypes.STRING
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// VendorPaymentItem.belongsTo(VendorPayment, { foreignKey: "vendor_payment_id", as: "VendorPayment" });
VendorPaymentItem.belongsTo(Vendor, { foreignKey: "vendor_id", as: "vendor" });
// VendorPaymentItem.hasMany(PaymentVoucher, { foreignKey: "payment_voucher_id", as: "paymentVouchers" });

VendorPaymentItem.prototype.getRequestData = function(vendorPaymentItem) {
  // try {
    // this.vendor_payment_id = vendorPaymentItem.vendor_payment_id;
    this.vendor_id = vendorPaymentItem.vendor_id;
    this.transaction_type = 'N';
    this.vendor_payment_date = vendorPaymentItem.vendor_payment_date;
    this.vendor_amount = vendorPaymentItem.vendor_amount;
    this.vendor_payment_amount = vendorPaymentItem.vendor_payment_amount;
    this.is_approved = vendorPaymentItem.is_approved;
    this.narration = vendorPaymentItem.narration;
    this.payment_voucher_id = vendorPaymentItem.payment_voucher_id;
    this.vendor_name = vendorPaymentItem.vendor_name;
    this.invoice_no = vendorPaymentItem.invoice_no;
    this.invoice_date = vendorPaymentItem.invoice_date;
    this.payment_remarks = vendorPaymentItem.payment_remarks;
  // } catch (error) {
  //   return error;
  // }
}

VendorPaymentItem.prototype.setItemDetails = async function() {
  // try {
    const vendor = await Vendor.findByPk(this.vendor_id);
    if(vendor) {
      this.vendor_name = vendor.vendor_name;
      this.beneficiary_name = vendor.bank_acc_name;
      this.vendor_code = vendor.vendor_code;
      this.bank_acc_no = vendor.bank_acc_no;
      this.ifsc_code = vendor.ifsc_code;
      this.bank_name = vendor.bank_name;
      this.bank_branch_name = vendor.bank_branch_name;
      this.bank_email = vendor.bank_email;

      if (vendor.bank_name && vendor.bank_name.trim().toUpperCase() === 'HDFC BANK') {
        this.transaction_type = "I";
      }
    }
  // } catch (error) {
  //   return error;
  // }
}

VendorPaymentItem.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    count = await Vendor.count({ where: { id: this.vendor_id }});
    if (count === 0) {
      return { errors : { item_id: { message: `Vendor does not exist` } } };
    }
    count = await PaymentVoucher.count({ where: { id: this.payment_voucher_id }});
    if (count === 0) {
      return { errors : { item_id: { message: `Finance Voucher does not exist` } } };
    }

    const paymentVoucher = await PaymentVoucher.findByPk(this.payment_voucher_id);
    let paid_amount = 0;
    if (paymentVoucher && paymentVoucher.paid_amount) {
      paid_amount = paymentVoucher.paid_amount;
    }
    if ((this.vendor_payment_amount + paid_amount) > this.vendor_amount) {
      return { errors : { item_id: { message: `Payment amount cannot be greater than total amount` } } };
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default VendorPaymentItem;