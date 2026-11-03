import { DataTypes, Op } from 'sequelize';
import moment from 'moment/moment.js';

import sequelize from '../lib/database.js';
import { calculateTransactionAmount } from '../lib/common.js';
import sendEmail from '../lib/email.js';

import Depot from './depot.js';
import Vendor from './vendor.js';
import RawMaterial from './rawMaterial.js';
import PaymentVoucherItem from './paymentVoucherItem.js';
// import PaymentVoucherOtherCharge from './paymentVoucherOtherCharge.js';
import PurchaseOrder from './purchaseOrder.js';
import RawMaterialIn from './rawMaterialIn.js';
import RawMaterialInItem from './rawMaterialInItem.js';
import User from './user.js';
import PurchaseOrderItem from './purchaseOrderItem.js';
import VendorPaymentItem from './vendorPaymentItem.js';
import ExpenseCategory from './expenseCategory.js';

const PaymentVoucher = sequelize.define('payment_voucher_detail', {
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
      notNull: true
    }
  },
  vendor_state: DataTypes.STRING,
  default_state: DataTypes.STRING,
  depot_state: DataTypes.STRING,
  depot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  requestor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  tds_per: DataTypes.DOUBLE,
  total_payable: DataTypes.DOUBLE,
  final_amount: DataTypes.DOUBLE,
  voucher_no: DataTypes.STRING,
  invoice_date: DataTypes.DATEONLY,
  invoice_no: DataTypes.STRING,
  type_use: DataTypes.STRING,
  type: DataTypes.STRING,
  po_no: DataTypes.STRING,
  attached: DataTypes.STRING,
  tdsamount: DataTypes.DOUBLE,
  po_id: DataTypes.INTEGER,
  po_status: DataTypes.STRING,
  other_charges_amount: DataTypes.DOUBLE,
  other_charges: DataTypes.STRING,
  po_previous_state: DataTypes.STRING,
  vendor_name: DataTypes.STRING,
  gst_in: DataTypes.STRING,
  tax_type: DataTypes.STRING,
  pay_immediately: DataTypes.TINYINT,
  raw_material_in_id: DataTypes.INTEGER,
  doc_document: DataTypes.STRING,
  document_name: DataTypes.STRING,
  is_paid: DataTypes.TINYINT,
  status: DataTypes.STRING,
  remark: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  round_off_amount: DataTypes.DOUBLE,
  paid_amount: DataTypes.DOUBLE,
  is_advance: DataTypes.TINYINT,
  partial_po: DataTypes.TINYINT,
  is_closed: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  payment_type: {
    type: DataTypes.VIRTUAL,
    get() {
      let type = 'notDue';
      if (this.pay_immediately) {
        type = 'immediate';
      } else if (new Date(this.date_of_processing) <= new Date()) {
        type = 'due';
      }
      return type;
    },
    set(value) {
      throw new Error('Do not try to set the `payment_type` value!');
    }
  },
  exp_cat_id: DataTypes.INTEGER,
  exp_cat_name: DataTypes.STRING
}, 
{ 
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

PaymentVoucher.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
PaymentVoucher.belongsTo(Vendor, { foreignKey: "vendor_id", as: "vendor" });
PaymentVoucher.belongsTo(PurchaseOrder, { foreignKey: "po_id", as: "purchase_order" });
PaymentVoucherItem.belongsTo(PaymentVoucher, { foreignKey: "payment_voucher_id", as: "payment_voucher" });
PaymentVoucher.hasMany(PaymentVoucherItem, { foreignKey: "payment_voucher_id", as: "paymentVoucherItems", onDelete: 'CASCADE' });
PaymentVoucher.hasMany(VendorPaymentItem, { foreignKey: "payment_voucher_id", as: "vendorPaymentItems", onDelete: 'CASCADE' });
PaymentVoucher.belongsTo(User, { foreignKey: "requestor_id", as: "requested_by_user" });
PaymentVoucher.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
PaymentVoucher.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
PaymentVoucher.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });
PaymentVoucher.belongsTo(ExpenseCategory, { foreignKey: "exp_cat_id", as: "expense_category" });

export const getPaymentVoucherMasterData = async function(paymentVoucher, req) {
  // try {
    let purchaseOrderCond = { where: {
      [Op.and]: [
        {status: 'Approved'}, 
        {po_status: {[Op.or]: [{[Op.notIn] : ['Raw Material IN', 'Closed', 'Advance']}, {[Op.is]: null}]}}
      ]
    } };
    let depotCond = { where: {status: 'Approved', id: {[Op.in]: req.userData.depotIds}} };
    let vendorCond = { where: {status: 'Approved'} };
    let expenseCategoryCond = { where: {status: 'Approved'} };

    if (paymentVoucher) {
      if (paymentVoucher.po_id) {
        purchaseOrderCond = { where: {[Op.or]: [
          { id: paymentVoucher.po_id }, 
          {[Op.and]: [
            { status: 'Approved' }, 
            { po_status: {[Op.or]: [{[Op.notIn] : ['Raw Material IN', 'Closed', 'Advance']}, {[Op.is]: null}]} },
            { vendor_id: paymentVoucher.vendor_id }
          ]}
        ]} };
      }
      if (paymentVoucher.depot_id) {
        depotCond = { where: {[Op.or]: [{ status: 'Approved', id: {[Op.in]: req.userData.depotIds} }, { id: paymentVoucher.depot_id }]} };
      }
      if (paymentVoucher.vendor_id) {
        vendorCond = { where: {[Op.or]: [{ status: 'Approved' }, { id: paymentVoucher.vendor_id }]} };
      }

      if (paymentVoucher.exp_cat_id) {
        expenseCategoryCond = { where: {[Op.or]: [{ status: 'Approved' }, { id: paymentVoucher.exp_cat_id }]} };
      }
    }

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'state'] });
    const vendors = await Vendor.findAll({ ...vendorCond, attributes: ['id', 'vendor_name', 'state', 'gst_number', 'payment_due_days'] });
    const purchaseOrders = await PurchaseOrder.findAll({ ...purchaseOrderCond, attributes: ['id', 'po_no'] });
    const expenseCategories = await ExpenseCategory.findAll({ ...expenseCategoryCond, attributes: ['id', 'category'], order: [['id', 'DESC']] });
    
    return { depots, vendors, purchaseOrders, expenseCategories };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getRawMaterialInData = async function(raw_material_in_id) {
  // try {
    const rawMaterialIn = await RawMaterialIn.findByPk(raw_material_in_id, { 
      include: [{ 
          model: RawMaterialInItem, 
          as: "rawMaterialInItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name", "hsn_code"]}] 
        }, 
        "rawMaterialInOtherCharges", 
        { 
          model: Vendor, 
          as: "vendor", 
          attributes: ["id", "vendor_name", "address", "city", "pincode", "state", "country", "gst_number"] 
        }, 
        { 
          model: Depot, 
          as: "depot", 
          attributes: ["id", "depot_name", "address", "city", "pincode", "state", "country", "gst_no"] 
        }, 
        { 
          model: User, 
          as: "created_by_user", 
          attributes: ["id", "first_name", "last_name"] 
        }, 
        { 
          model: User, 
          as: "modified_by_user", 
          attributes: ["id", "first_name", "last_name"] 
        },
        { 
          model: User, 
          as: "approved_by_user", 
          attributes: ["id", "first_name", "last_name"] 
        }
      ] 
    });
    
    return rawMaterialIn;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getVendorPurchaseOrders = async function(vendor_id) {
  // try {
    let purchaseOrderCond = { where: {
      [Op.and]: [
        {status: 'Approved'},
        {vendor_id: vendor_id}, 
        {po_status: {[Op.or]: [{[Op.notIn] : ['Raw Material IN', 'Closed', 'Advance']}, {[Op.is]: null}]}}
      ]
    } };
    
    const purchaseOrders = await PurchaseOrder.findAll({ ...purchaseOrderCond, attributes: ['id', 'po_no'] });
    
    return { purchaseOrders };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getPurchaseOrderDetails = async function(po_id, raw_material_in_id) {
  // try {
    const purchaseOrder = await PurchaseOrder.findByPk(po_id, { 
      include: [
        { 
          model: PurchaseOrderItem, 
          as: "purchaseOrderItems", 
          include: [
            { model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"] },
            // { 
            //   model: RawMaterialInItem, 
            //   as: "rawMaterialInItems", 
            //   attributes: ['po_item_id', 'qty'], 
            //   // attributes: ['po_item_id', [sequelize.fn('sum', sequelize.col('purchaseOrderItems.rawMaterialInItems.qty')), 'total_in_qty']] 
            //   // where: { [Op.or]: { raw_material_in_id: { [Op.is]: null }, raw_material_in_id: { [Op.ne]: raw_material_in_id } } }
            // }
          ],
          
          // attributes: ['id'],
          // group: ['purchaseOrderItems.id', 'purchaseOrderItems.raw_material', 'purchaseOrderItems.rawMaterialInItems.po_item_id']
        }, 
        "purchaseOrderOtherCharges"
      ]
    });

    return { purchaseOrder };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const mailPaymnentRejection = async function(id) {
  // try {
    const rawMaterialIn = await getRawMaterialInData(id);

    if (rawMaterialIn) {
      let subject = 'Rejected Payment For GRN ' + rawMaterialIn.raw_material_in_no;
      let message = '<html>' +
                  '<head>' +
                      '<style>' +
                          'td { padding: 5px; width: 100px; }' +
                      '</style>' +
                  '</head>' +
                  '<body>' +
                      '<h3>Wholesome Habits Private Limited</h3>' +
                      '<h4>Payment For GRN is rejected for following reason, Please Resubmit</h4>' +
                      '<br/><br/>' +
                      '<p>Reason - ' + rawMaterialIn.remarks.replace("'", "") + '</p>' +
                      '<p>Vendor - ' + rawMaterialIn.vendor.vendor_name.replace("'", "") + '</p>' +
                      '<p>GRN No - ' + rawMaterialIn.raw_material_in_no.replace("'", "") + '</p>' +
                      '<p>Invoice No - ' + rawMaterialIn.invoice_no.replace("'", "") + '</p>' +
                      '<p>Invoice Date - ' + moment(rawMaterialIn.invoice_date).format('DD/MM/YYYY') + '</p>' +
                      '<p>Total Amount - ' + rawMaterialIn.final_amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' }) + '</p>' +
                      '<br/><br/>' +
                      'Regards,' +
                      '<br/><br/>' +
                      'CS' +
                  '</body>' +
                  '</html>';

      // let from_email = 'cs@eatanytime.in';
      // let from_email_sender = 'EAT MIS';

      // // let to_email = "dhaval.maru@otbconsulting.co.in";
      // // let cc="prasad.bhisale@otbconsulting.co.in";
      // // let bcc="prasad.bhisale@otbconsulting.co.in";
      
      // let to_email = "prasad.bhisale@otbconsulting.co.in";
      // let cc = 'prasad.bhisale@otbconsulting.co.in';
      // let bcc = 'prasad.bhisale@otbconsulting.co.in';

      // // let to_email = "vaishabh.patle@eatanytime.in";
      // // let cc = 'rishit.sanghvi@eatanytime.in, dhaval.maru@otbconsulting.co.in';
      // // let bcc = 'prasad.bhisale@otbconsulting.co.in';

      // // sleep(2);

      // attachment = paymentFile;
      // // echo $attachment.'<br/><br/>';
      // // echo $message;
      // // echo '<br/><br/>';

      // // mailSent = send_email_new(from_email,  from_email_sender, to_email, subject, message, bcc, cc, attachment);
      
      const mailOptions = {
          from: 'EAT MIS <cs@eatanytime.in>',
          to: 'product1@eatanytime.in, product@eatanytime.in, prachi.sanghvi@eatanytime.in',
          cc: 'vaishabh.patle@eatanytime.in, accounts@eatanytime.in, dhaval.maru@otbconsulting.co.in',
          bcc: 'technology@otbconsulting.co.in',
          // to: 'technology@raastaconsulting.com',
          // cc: 'technology@raastaconsulting.com',
          // bcc: 'technology@raastaconsulting.com',
          // cc: 'dhaval.maru@otbconsulting.co.in',
          // bcc: 'rishit.sanghvi@eatanytime.in',
          subject: subject,
          text: message,
          html: message,
          // attachments: [{ path: paymentFile }]
      };

      // result = await sendEmail(mailOptions);

      return sendEmail(mailOptions);

      // sendEmail(mailOptions)
      //     .then(result => {
      //         // console.log(result);
      //         // return res.status(200).json({ result: result });
      //         return result;
      //         // return true;
      //     })
      //     .catch(err => {
      //         // console.log(err);
      //         // const error = new Error(err);
      //         // error.httpStatusCode = 500;
      //         // return next(error);

      //         return err;
      //     });

      // // echo $mailSent;
      // // echo '<br/><br/>';

      // if ($mailSent == 1) {
      //     // echo 'Mail sent successfully.';
      //     // echo '<br/><br/>';
      //     $this->session->set_flashdata('success', 'Mail sent successfully.');
      //     // $this->session->keep_flashdata('success');
      // } else {
      //     // echo 'Mail sending failed.';
      //     // echo '<br/><br/>';
      //     $this->session->set_flashdata('error', 'Mail sending failed.');
      //     // $this->session->keep_flashdata('error');
      // }
      

      // if($mailSent==1){
      //     $sql = "update vendor_payment_details set mail_sent = '1' where id = '".$id."'";
      //     $this->db->query($sql);

      //     $logarray['table_id']=$this->session->userdata('session_id');
      //     $logarray['module_name']='Vendor_Payment';
      //     $logarray['cnt_name']='Vendor_Payment';
      //     $logarray['action']='Vendor Payment File sent.';
      //     $this->user_access_log_model->insertAccessLog($logarray);
      // }
    }

    // return result;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const mailPaymnentVoucherRejection = async function(id) {
  // try {
    const paymentVoucher = await PaymentVoucher.findByPk(id);

    if (paymentVoucher) {
      let subject = 'Expense Voucher rejected For Vendor - ' + paymentVoucher.vendor_name;
      if (paymentVoucher.is_advance) {
        subject = 'Advance Payment Voucher rejected For Vendor - ' + paymentVoucher.vendor_name;
      }
      
      let message = '<html>' +
                  '<head>' +
                      '<style>' +
                          'td { padding: 5px; width: 100px; }' +
                      '</style>' +
                  '</head>' +
                  '<body>' +
                      '<h3>Wholesome Habits Private Limited</h3>' +
                      '<h4>' + subject.replace("'", "") + ' for following reason, Please Resubmit</h4>' +
                      '<br/><br/>' +
                      '<p>Reason - ' + paymentVoucher.remark.replace("'", "") + '</p>' +
                      '<p>Vendor - ' + paymentVoucher.vendor_name.replace("'", "") + '</p>' +
                      '<p>Invoice No - ' + paymentVoucher.invoice_no.replace("'", "") + '</p>' +
                      '<p>Invoice Date - ' + moment(paymentVoucher.invoice_date).format('DD/MM/YYYY') + '</p>' +
                      '<p>Total Amount - ' + paymentVoucher.total_payable.toLocaleString('en-US', { style: 'currency', currency: 'INR' }) + '</p>' +
                      '<br/><br/>' +
                      'Regards,' +
                      '<br/><br/>' +
                      'CS' +
                  '</body>' +
                  '</html>';

      // let from_email = 'cs@eatanytime.in';
      // let from_email_sender = 'EAT MIS';

      // // let to_email = "dhaval.maru@otbconsulting.co.in";
      // // let cc="prasad.bhisale@otbconsulting.co.in";
      // // let bcc="prasad.bhisale@otbconsulting.co.in";
      
      // let to_email = "prasad.bhisale@otbconsulting.co.in";
      // let cc = 'prasad.bhisale@otbconsulting.co.in';
      // let bcc = 'prasad.bhisale@otbconsulting.co.in';

      // // let to_email = "vaishabh.patle@eatanytime.in";
      // // let cc = 'rishit.sanghvi@eatanytime.in, dhaval.maru@otbconsulting.co.in';
      // // let bcc = 'prasad.bhisale@otbconsulting.co.in';

      // // sleep(2);

      // attachment = paymentFile;
      // // echo $attachment.'<br/><br/>';
      // // echo $message;
      // // echo '<br/><br/>';

      // // mailSent = send_email_new(from_email,  from_email_sender, to_email, subject, message, bcc, cc, attachment);
      
      const mailOptions = {
          from: 'EAT MIS <cs@eatanytime.in>',
          to: 'product1@eatanytime.in, product@eatanytime.in, prachi.sanghvi@eatanytime.in',
          cc: 'vaishabh.patle@eatanytime.in, accounts@eatanytime.in, dhaval.maru@otbconsulting.co.in',
          bcc: 'technology@otbconsulting.co.in',
          // to: 'saurabh.mhatre@otbconsulting.co.in',
          // cc: 'prasad.bhisale@otbconsulting.co.in',
          // bcc: 'technology@raastaconsulting.com',
          // cc: 'dhaval.maru@otbconsulting.co.in',
          // bcc: 'rishit.sanghvi@eatanytime.in',
          subject: subject,
          text: message,
          html: message,
          // attachments: [{ path: paymentFile }]
      };

      // result = await sendEmail(mailOptions);

      return sendEmail(mailOptions);
    }

    // return result;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

PaymentVoucher.prototype.setRawMaterialInData = function(rawMaterialIn) {
  this.date_of_processing = rawMaterialIn.payment_due_date;
  this.vendor_state = rawMaterialIn.vendor.state;
  this.default_state = rawMaterialIn.depot.state;
  this.depot_state = rawMaterialIn.depot.state;
  this.depot_id = rawMaterialIn.depot_id;
  this.vendor_id = rawMaterialIn.vendor_id;
  // this.requestor_id = rawMaterialIn.approved_by;
  this.final_amount = rawMaterialIn.total_amt;
  this.tds_per = rawMaterialIn.tds_per;
  this.tdsamount = rawMaterialIn.tds_amt;
  this.round_off_amount = rawMaterialIn.round_off_amt;
  this.total_payable = rawMaterialIn.final_amount;
  // this.status = 'Pending';
  // this.created_by = rawMaterialIn.approved_by;
  // this.modified_by = rawMaterialIn.approved_by;
  this.voucher_no = null;
  this.invoice_date = rawMaterialIn.invoice_date;
  this.invoice_no = rawMaterialIn.invoice_no;
  this.type_use = '';
  this.type = 'Purchase';
  this.po_no = rawMaterialIn.purchase_order.po_no;
  this.attached = 'yes';
  this.remark = rawMaterialIn.remarks;
  this.po_id = rawMaterialIn.purchase_order_id;
  this.po_previous_state = this.po_status;
  this.po_status = rawMaterialIn.purchase_order.po_status;
  this.other_charges_amount = 0;
  this.other_charges = '';
  this.vendor_name = rawMaterialIn.vendor.vendor_name;
  this.gst_in = rawMaterialIn.vendor.gst_number;
  this.tax_type = rawMaterialIn.tax_type;
  this.pay_immediately = rawMaterialIn.pay_immediately;
  this.raw_material_in_id = rawMaterialIn.id;
  this.doc_document = rawMaterialIn.doc_document;
  this.document_name = rawMaterialIn.document_name;
  this.partial_po = rawMaterialIn.partial_po;
}

PaymentVoucher.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;
    const files = req.files ? req.files : null;

    this.type = body.type ? body.type : 'Expense';
    this.date_of_processing = body.date_of_processing ? body.date_of_processing : null;
    this.pay_immediately = (body.pay_immediately.toString().trim().toUpperCase() === 'TRUE') ? 1 : 0;
    this.depot_id = body.depot_id ? +body.depot_id : null;
    this.vendor_id = body.vendor_id ? +body.vendor_id : null;
    this.invoice_date = body.invoice_date ? body.invoice_date : null;
    this.invoice_no = body.invoice_no ? body.invoice_no.trim() : null;
    this.po_no = body.po_no ? body.po_no : null;
    this.po_id = body.po_id ? body.po_id : null;
    this.final_amount = body.final_amount ? +body.final_amount : 0;
    this.tds_per = body.tds_per ? +body.tds_per : 0;
    this.tdsamount = body.tdsamount ? +body.tdsamount : 0;
    this.round_off_amount = body.round_off_amount ? +body.round_off_amount : 0;
    this.total_payable = body.total_payable ? +body.total_payable : 0;
    this.exp_cat_id = body.exp_cat_id ? body.exp_cat_id : null;
    this.exp_cat_name = body.exp_cat_name ? body.exp_cat_name : null;

    // this.ref_id = body.ref_id ? +body.ref_id : null;
    // this.status = body.status;
    this.remark = body.remark ? body.remark.trim() : '';

    if (this.type.trim().toUpperCase() === 'PURCHASE') {
      if (!this.raw_material_in_id && this.po_id) {
        this.is_advance = 1;
      }
    }
    
    if (files && files.doc_document && files.doc_document.length > 0) {
      if(this.doc_document) {
        this.doc_document = this.doc_document.toString() + ' | ' + files.doc_document.map(doc => doc.path).join(' | ');
      } else {
        this.doc_document = files.doc_document.map(doc => doc.path).join(' | ');
      }
      if(this.document_name) {
        this.document_name = this.document_name.toString() + ' | ' + files.doc_document.map(doc => doc.filename).join(' | ');
      } else {
        this.document_name = files.doc_document.map(doc => doc.filename).join(' | ');
      }
    }
    
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

PaymentVoucher.prototype.setTaxType = async function() {
  const depot = await Depot.findByPk(this.depot_id);
  const vendor = await Vendor.findByPk(this.vendor_id);
  
  let taxType = 'Intra';
  if (depot.state.trim().toUpperCase() === vendor.state.trim().toUpperCase()) {
  // if (this.default_state.trim().toUpperCase() === vendor.state.trim().toUpperCase()) {
    taxType = "Intra";
  } else {
    taxType = "Inter"
  }

  if (this.po_id) {
    const purchaseOrder = await PurchaseOrder.findByPk(this.po_id);
    this.po_no = purchaseOrder.po_no;
    this.po_status = purchaseOrder.po_status;
  }
  
  this.depot_state = depot.state;
  this.default_state = depot.state;
  this.vendor_state = vendor.state;
  this.vendor_name = vendor.vendor_name;
  this.gst_in = vendor.gst_number;
  this.tax_type = taxType;

  return taxType;
}

PaymentVoucher.prototype.getPaymentVoucherItems = function(body) {
  // try {
    const paymentVoucherItems = [];
    if (body.paymentVoucherItems) {
      let postedPaymentVoucherItems = body.paymentVoucherItems;
      if (typeof body.paymentVoucherItems === 'string') {
        postedPaymentVoucherItems = JSON.parse(body.paymentVoucherItems);
      }
      for (const postedPaymentVoucherItem of postedPaymentVoucherItems) {
        const po_item_id = (postedPaymentVoucherItem.po_item_id) ? +postedPaymentVoucherItem.po_item_id : null;
        const type = (postedPaymentVoucherItem.type) ? postedPaymentVoucherItem.type : null;
        const particular_id = (postedPaymentVoucherItem.particular_id) ? +postedPaymentVoucherItem.particular_id : null;
        const particulars = (postedPaymentVoucherItem.particulars) ? postedPaymentVoucherItem.particulars : '';
        const qty = (postedPaymentVoucherItem.qty) ? +postedPaymentVoucherItem.qty : 0;
        const rate = (postedPaymentVoucherItem.rate) ? +postedPaymentVoucherItem.rate : 0;
        const discount = (postedPaymentVoucherItem.discount) ? +postedPaymentVoucherItem.discount : 0;
        // const tax_type = (this.tax_type) ? this.tax_type : 'Intra';
        const tax_per = (postedPaymentVoucherItem.tax_per) ? +postedPaymentVoucherItem.tax_per : 0;
        
        const paymentVoucherItem = {
          payment_voucher_id: this.id,
          po_item_id: po_item_id,
          type: type,
          particular_id: particular_id,
          particulars: particulars,
          qty: qty,
          rate: rate,
          discount: discount,
          tax_per: tax_per
        };

        paymentVoucherItems.push(paymentVoucherItem);
      }
    }
    
    return paymentVoucherItems;
  // } catch (error) {
  //   return error;
  // }
}

PaymentVoucher.prototype.setTransactionAmount = function(paymentVoucherItems) {
  // try {
    const transaction = calculateTransactionAmount(paymentVoucherItems, this.tds_per, this.round_off_amount);

    // this.amount = transaction.amount;
    // this.cgst_amount = transaction.cgst_amount;
    // this.sgst_amount = transaction.sgst_amount;
    // this.igst_amount = transaction.igst_amount;
    // this.tax_amount = transaction.tax_amount;

    this.final_amount = transaction.total_amount;
    // this.tds_per = rawMaterialIn.tds_per;
    this.tdsamount = transaction.tds_amount;
    this.round_off_amount = transaction.round_off_amount;
    this.total_payable = transaction.final_amount;
  // } catch (error) {
  //   return error;
  // }
}

PaymentVoucher.prototype.check = function(req) {
  // try {
    // if (this.isDeleted) {
    // if (this.status === "Deleted") {
    //   this.status = "InActive";
    // } else {
    //   this.status = "Approved";
    // }

    this.status = "Pending";

    // if (this.type.toString().toUpperCase() === 'PURCHASE') {
      if (req.body.date_of_processing) {
        this.date_of_processing = req.body.date_of_processing ? req.body.date_of_processing : null;
      }
      if (req.body.invoice_no) {
        this.invoice_no = req.body.invoice_no ? req.body.invoice_no.trim() : 0;
      }
      if (req.body.invoice_date) {
        this.invoice_date = req.body.invoice_date ? req.body.invoice_date : null;
      }
      
      this.tds_per = req.body.tds_per ? +req.body.tds_per : 0;
      this.tdsamount = req.body.tdsamount ? +req.body.tdsamount : 0;
      this.round_off_amount = req.body.round_off_amount ? +req.body.round_off_amount : 0;
      this.final_amount = req.body.final_amount ? +req.body.final_amount : 0;
      this.total_payable = req.body.total_payable ? +req.body.total_payable : 0;
    // }
    
    if (req && req.body && req.body.remark) {
      this.remark = req.body.remark;
    } else {
      this.remark = '';
    }
    this.modified_by = req.userData.userId;

    return null;
  // } catch (error) {
  //   return error;
  // }
}

PaymentVoucher.prototype.approve = function(req) {
  // try {
    // if (this.isDeleted) {
    if (this.status === "Deleted") {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    // if (this.type.toString().toUpperCase() === 'PURCHASE') {
      if (req.body.invoice_no) {
        this.invoice_no = req.body.invoice_no ? req.body.invoice_no.trim() : 0;
      }
      if (req.body.invoice_date) {
        this.invoice_date = req.body.invoice_date ? req.body.invoice_date : 0;
      }

      this.tds_per = req.body.tds_per ? +req.body.tds_per : 0;
      this.tdsamount = req.body.tdsamount ? +req.body.tdsamount : 0;
      this.round_off_amount = req.body.round_off_amount ? +req.body.round_off_amount : 0;
      this.final_amount = req.body.final_amount ? +req.body.final_amount : 0;
      this.total_payable = req.body.total_payable ? +req.body.total_payable : 0;
    // }
    
    if (req && req.body && req.body.remark) {
      this.remark = req.body.remark;
    } else {
      this.remark = '';
    }
    this.approved_by = req.userData.userId;
    this.approved_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

PaymentVoucher.prototype.reject = function(req) {
  // try {
    this.status = "Rejected";
    if (req && req.body && req.body.remark) {
      this.remark = req.body.remark;
    } else {
      this.remark = '';
    }
    this.rejected_by = req.userData.userId;
    this.rejected_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

PaymentVoucher.prototype.getPaymentVoucherNo = function(series) {
  // try {
    if (this.voucher_no) {
      return this.voucher_no;
    }
  
    // const orderDate = this.order_date ? new Date(this.order_date) : new Date();
    // const financialYear = calculateFiscalYearForDate(orderDate);
    // // const monthName = getMonthName(orderDate.getMonth());

    // const paymentVoucherNo = 'WHPL/' + financialYear + '/' + series;
    const paymentVoucherNo = 'WHPL/Payment_Voucher/' + series;
    
    this.voucher_no = paymentVoucherNo;

    return paymentVoucherNo;
  // } catch (error) {
  //   return error;
  // }
}

PaymentVoucher.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    if (this.vendor_id) {
      count = await Vendor.count({ where: { id: this.vendor_id }});
      if (count === 0) {
        return { errors : { vendor_id: { message: `Vendor does not exist` } } };
      }
    }
    if (this.depot_id) {
      count = await Depot.count({ where: { id: this.depot_id }});
      if (count === 0) {
        return { errors : { depot_id: { message: `Depot does not exist` } } };
      }
    }
    
    if (this.po_id) {
      count = await PurchaseOrder.count({ where: { id: this.po_id }});
      if (count === 0) {
        return { errors : { depot_id: { message: `Purchase Order does not exist` } } };
      }

      count = await PaymentVoucher.count({ where: { 
        po_id: this.po_id, 
        partial_po: 0,
        id: {[Op.or]: [{[Op.is]: null}, {[Op.ne] : this.id}]},
        status: {[Op.and]: [{[Op.ne]: 'InActive'}, {[Op.ne] : 'Deleted'}, {[Op.ne] : 'Rejected'}]}
      }});
      if (count > 0) {
        return { errors : { po_id: { message: `Purchase Order already imported.` } } };
      }
    }
    if (this.invoice_no) {
      count = await PaymentVoucher.count({ where: { 
        vendor_id: this.vendor_id, 
        invoice_no: this.invoice_no, 
        id: {[Op.or]: [{[Op.is]: null}, {[Op.ne] : this.id}, {[Op.ne] : (this.ref_id ? this.ref_id : this.id)}]},
        status: {[Op.and]: [{[Op.ne]: 'InActive'}, {[Op.ne] : 'Deleted'}, {[Op.ne] : 'Rejected'}]}
      }});
      if (count > 0) {
        return { errors : { invoice_no: { message: `Invoice already imported.` } } };
      }
    }

    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default PaymentVoucher;