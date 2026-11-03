import { DataTypes, Op } from 'sequelize';
import path from 'path';
import fs from "fs";
import moment from 'moment/moment.js';
import sequelize from '../lib/database.js';
import { round, createPath, getReportPath } from '../lib/common.js';

import VendorPaymentItem from './vendorPaymentItem.js';
import PaymentVoucher from './paymentVoucher.js';
import User from './user.js';
import sendEmail from '../lib/email.js';

const VendorPayment = sequelize.define('vendor_payment_details', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  payment_type: {
    type: DataTypes.STRING,
    validate: {
      isIn: [['Online', 'Manual']],
    }
  },
  transaction_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  vendor_names: DataTypes.STRING,
  invoice_nos: DataTypes.STRING,
  total_amount: DataTypes.DOUBLE,
  approved_amount: DataTypes.DOUBLE,
  payment_file: DataTypes.STRING,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  ref_id: DataTypes.INTEGER,
  mail_sent: DataTypes.TINYINT
}, 
{ 
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

VendorPayment.hasMany(VendorPaymentItem, { foreignKey: "vendor_payment_id", as: "vendorPaymentItems", onDelete: 'CASCADE' });
VendorPayment.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
VendorPayment.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
VendorPayment.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });

VendorPayment.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.payment_type = body.payment_type ? body.payment_type.trim() : '';
    this.transaction_date = body.transaction_date ? body.transaction_date : null;
    this.total_amount = body.total_amount ? +body.total_amount : null;
    this.approved_amount = body.approved_amount ? +body.approved_amount : null;
    // this.ref_id = body.ref_id ? +body.ref_id : null;
    // this.status = body.status;
    this.remarks = body.remarks ? body.remarks.trim() : '';
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

VendorPayment.prototype.getVendorPaymentItems = function(body) {
  // try {
    const vendorPaymentItems = [];
    if (body.vendorPaymentItems) {
      for (const postedVendorPaymentItem of body.vendorPaymentItems) {
        const id = (postedVendorPaymentItem.id) ? +postedVendorPaymentItem.id : null;
        const vendor_id = (postedVendorPaymentItem.vendor_id) ? +postedVendorPaymentItem.vendor_id : null;
        const vendor_name = (postedVendorPaymentItem.vendor_name) ? postedVendorPaymentItem.vendor_name : '';
        const invoice_no = (postedVendorPaymentItem.invoice_no) ? postedVendorPaymentItem.invoice_no : '';
        const invoice_date = (postedVendorPaymentItem.invoice_date) ? postedVendorPaymentItem.invoice_date : '';
        const vendor_payment_date = (postedVendorPaymentItem.vendor_payment_date) ? postedVendorPaymentItem.vendor_payment_date : null;
        const vendor_amount = (postedVendorPaymentItem.vendor_amount) ? +postedVendorPaymentItem.vendor_amount : null;
        const vendor_payment_amount = (postedVendorPaymentItem.vendor_payment_amount) ? +postedVendorPaymentItem.vendor_payment_amount : null;
        const is_checked = (postedVendorPaymentItem.is_checked && postedVendorPaymentItem.is_checked === true) ? 1 : 0;
        const is_approved = (postedVendorPaymentItem.is_approved && postedVendorPaymentItem.is_approved === true) ? 1 : 0;
        const narration = (postedVendorPaymentItem.narration) ? postedVendorPaymentItem.narration : '';
        const payment_voucher_id = (postedVendorPaymentItem.payment_voucher_id) ? +postedVendorPaymentItem.payment_voucher_id : null;
        const payment_remarks = (postedVendorPaymentItem.payment_remarks) ? postedVendorPaymentItem.payment_remarks : '';
        
        if (is_checked) {
          const vendorPaymentItem = {
            id: id,
            // purchase_order_id: this.id,
            vendor_id: vendor_id,
            vendor_payment_date: vendor_payment_date,
            vendor_amount: vendor_amount,
            vendor_payment_amount: vendor_payment_amount,
            is_approved: is_approved,
            narration: narration,
            payment_voucher_id: payment_voucher_id,
            vendor_name: vendor_name,
            invoice_no: invoice_no,
            invoice_date: invoice_date,
            payment_remarks: payment_remarks
          };
  
          vendorPaymentItems.push(vendorPaymentItem);
        }
      }
    }
    
    return vendorPaymentItems;
  // } catch (error) {
  //   return error;
  // }
}

VendorPayment.prototype.approve = function(req) {
  // try {
    // if (this.isDeleted) {
    if (this.status === "Deleted") {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.approved_by = req.userData.userId;
    this.approved_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

VendorPayment.prototype.reject = function(req) {
  // try {
    this.status = "Rejected";
    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.rejected_by = req.userData.userId;
    this.rejected_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

VendorPayment.prototype.getVendorPaymentNo = function(series) {
  // try {
    if (this.voucher_no) {
      return this.voucher_no;
    }
  
    // const orderDate = this.order_date ? new Date(this.order_date) : new Date();
    // const financialYear = calculateFiscalYearForDate(orderDate);
    // // const monthName = getMonthName(orderDate.getMonth());

    // const vendorPaymentNo = 'WHPL/' + financialYear + '/' + series;
    const vendorPaymentNo = 'WHPL/Payment_Voucher/' + series;
    
    this.voucher_no = vendorPaymentNo;

    return vendorPaymentNo;
  // } catch (error) {
  //   return error;
  // }
}

VendorPayment.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = 0;
    // // if (this.depot_id) {
    // //   count = await Depot.count({ where: { id: this.depot_id }});
    // //   if (count === 0) {
    // //     return { errors : { depot_id: { message: `Depot not exist` } } };
    // //   }
    // // }
    // if (this.vendor_id) {
    //   count = await Vendor.count({ where: { id: this.vendor_id }});
    //   if (count === 0) {
    //     return { errors : { vendor_id: { message: `Vendor does not exist` } } };
    //   }
    // }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

VendorPayment.prototype.setTransactionAmount = function(vendorPaymentItems) {
  // try {
    let total_amount = 0;
    let approved_amount = 0;
    const beneficiary_names = [];
    const vendor_names = [];
    const invoice_nos = [];

    for (const vendorPaymentItem of vendorPaymentItems) {
      total_amount = total_amount + vendorPaymentItem.vendor_payment_amount;
      if (vendorPaymentItem.is_approved) {
        approved_amount = approved_amount + vendorPaymentItem.vendor_payment_amount;
      }
      beneficiary_names.push(vendorPaymentItem.beneficiary_name);
      vendor_names.push(vendorPaymentItem.vendor_name);
      invoice_nos.push(vendorPaymentItem.invoice_no);
    }

    // this.vendor_names = beneficiary_names.join(', ');
    this.vendor_names = vendor_names.join(', ');
    this.invoice_nos = invoice_nos.join(', ');
    this.total_amount = total_amount;
    this.approved_amount = approved_amount;
  // } catch (error) {
  //   return error;
  // }
}

export const getVendorPaymentsData = async function(req) {
  let status = 'Immediate';
  let pageSize = null;
  let pageIndex = null;
  let query = '';
  let sort = { key: 'modified_on', order: 'desc' };

  if (req.query) {
    status = req.query.status ? req.query.status : 'Immediate';
    if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
      pageSize = 'ALL';
    } else {
      pageSize = req.query.pageSize ? +req.query.pageSize : 10;
    }
    pageIndex = req.query.pageIndex ? +req.query.pageIndex : null;
    query = req.query.query ? req.query.query : '';
    sort = { key: req.query.key ? req.query.key : 'modified_on', order: req.query.order ? req.query.order : 'desc' };
  }

  // let totalCount = 0;
  let  count = 0;
  const statusCount = {
    immediate: 0,
    due: 0,
    notDue: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    inActive: 0,
    immediateAmt: 0,
    dueAmt: 0,
    notDueAmt: 0,
    totalPayableCnt: 0,
    totalPayableAmt: 0
  };
  let data = await VendorPayment.findAll(
    { 
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']], 
      group:['status'], 
      raw: true
    }
  );
  // console.log(data);
  for (const item of data) {
    // console.log(item.status);
    // console.log(item.count);
    if (item.status === "Pending" || item.status === "Deleted") {
      statusCount.pending = statusCount.pending + parseInt(item.count);
      // totalCount = parseInt(item.count);
    }
    else if (item.status === "Approved") {
      statusCount.approved = statusCount.approved + parseInt(item.count);
      // totalCount = parseInt(item.count);
    }
    else if (item.status === "Rejected") {
      statusCount.rejected = statusCount.rejected + parseInt(item.count);
      // totalCount = parseInt(item.count);
    }
    else if (item.status === "InActive") {
      statusCount.inActive = statusCount.inActive + parseInt(item.count);
      // totalCount = parseInt(item.count);
    }
  }
  
  data = await PaymentVoucher.findAll(
    { 
      where: { 
        status: 'Approved', 
        date_of_processing: {[Op.ne]: null}, 
        is_closed: 0, 
        [Op.or]: [
          {total_payable: {[Op.gt]: sequelize.col('paid_amount')}}, 
          {paid_amount: {[Op.is]: null}}
        ]
      },
      attributes: [
        'pay_immediately', 
        'date_of_processing', 
        [sequelize.fn('COUNT', sequelize.col('status')), 'count'], 
        [sequelize.fn('SUM', sequelize.literal('IFNULL(total_payable,0) - IFNULL(paid_amount, 0)')), 'total_amt']
      ], 
      group:['pay_immediately', 'date_of_processing'], 
      raw: true
    }
  );
  // console.log(data);
  for (const item of data) {
    // console.log(item.status);
    // console.log(item.count);
    if (item.pay_immediately) {
      statusCount.immediate = statusCount.immediate + parseInt(item.count);
      statusCount.immediateAmt = statusCount.immediateAmt + parseFloat(item.total_amt);
      // totalCount = parseInt(item.count);
    }
    else if (new Date(item.date_of_processing) <= new Date()) {
      statusCount.due = statusCount.due + parseInt(item.count);
      statusCount.dueAmt = statusCount.dueAmt + parseFloat(item.total_amt);
      // totalCount = parseInt(item.count);
    }
    else {
      statusCount.notDue = statusCount.notDue + parseInt(item.count);
      statusCount.notDueAmt = statusCount.notDueAmt + parseFloat(item.total_amt);
      // totalCount = parseInt(item.count);
    }
    
    statusCount.totalPayableCnt = statusCount.totalPayableCnt + 1;
    statusCount.totalPayableAmt = statusCount.totalPayableAmt + parseFloat(item.total_amt);
  }
  
  let rows = [];
  if (
    status.trim().toUpperCase() === 'PENDING' || 
    status.trim().toUpperCase() === 'APPROVED' || 
    status.trim().toUpperCase() === 'REJECTED' || 
    status.trim().toUpperCase() === 'INACTIVE'
    ) {
    let condition = {};
    let statusCondition = { status: 'Pending' };
    if (status) {
      if (status.trim().toUpperCase() === 'PENDING') {
        statusCondition = { status: {[Op.or] : ['Pending', 'Deleted']} };
        count = statusCount.pending;
      } else if (status.trim().toUpperCase() === 'APPROVED') {
        statusCondition = { status: 'Approved' };
        count = statusCount.approved;
      } else if (status.trim().toUpperCase() === 'REJECTED') {
        statusCondition = { status: 'Rejected' };
        count = statusCount.rejected;
      } else if (status.trim().toUpperCase() === 'INACTIVE') {
        statusCondition = { status: 'InActive' };
        count = statusCount.inActive;
      } else {
        statusCondition = { status: status };
      }
    }
    if (query) {
      condition['where'] = {
        [Op.and]: [
          {[Op.or]: [
            { 'transaction_date': {[Op.like]: `%${query}%` } }, 
            { 'vendor_names': {[Op.like]: `%${query}%` } }, 
            { 'payment_type': {[Op.like]: `%${query}%` } }, 
            { 'total_amount': {[Op.like]: `%${query}%` } }
            // Sequelize.literal("`depot`.`depot_name` LIKE '%"+query+"%'"), 
            // Sequelize.literal("`vendor`.`vendor_name` LIKE '%"+query+"%'")
          ]},
          statusCondition
        ]
      };
    } else {
      condition['where'] = statusCondition;
    }

    let order = [['modified_on', 'DESC']];
    if (sort) {
      if (sort.key) {
        order = [[sort.key, (sort.order ? sort.order : 'ASC')]];
      }
    }
    condition['order'] = order;

    if (pageSize.toString().trim().toUpperCase() === 'ALL') {
      //Do Nothing
    } else {
      if (pageIndex) {
        condition['offset'] = (pageIndex * pageSize);
      }
      
      if (pageSize) {
        condition['limit'] = pageSize;
      }
    }

    condition['include'] = [
      { model: User, as: 'modified_by_user', attributes: ['id', 'first_name', 'last_name'] },
      "vendorPaymentItems"
    ];

    rows = await VendorPayment.findAll(condition);
  } else {
    let condition = {};
    let statusCondition = { 
      status: 'Approved', 
      date_of_processing: {[Op.ne]: null}, 
      is_closed: 0, 
      [Op.or]: [
        {total_payable: {[Op.gt]: sequelize.col('paid_amount')}}, 
        {paid_amount: {[Op.is]: null}}
      ]
    };
    if (status) {
      if (status.trim().toUpperCase() === 'IMMEDIATE') {
        statusCondition = { ...statusCondition, pay_immediately: 1 };
        count = statusCount.immediate;
      } else if (status.trim().toUpperCase() === 'DUE') {
        statusCondition = { ...statusCondition, pay_immediately: {[Op.ne]: 1}, date_of_processing: { [Op.lte]: new Date() } };
        count = statusCount.due;
      } else if (status.trim().toUpperCase() === 'NOTDUE') {
        statusCondition = { ...statusCondition, pay_immediately: {[Op.ne]: 1}, date_of_processing: { [Op.gt]: new Date() } };
        count = statusCount.due;
      } else {
        statusCondition = { ...statusCondition };
        count = statusCount.totalPayableCnt;
      }
    }
    
    if (query) {
      condition['where'] = {
        [Op.and]: [
          {[Op.or]: [
            { 'date_of_processing': { [Op.like]: `%${query}%` } }, 
            { 'vendor_name': { [Op.like]: `%${query}%` } }, 
            { 'final_amount': { [Op.like]: `%${query}%` } }
            // Sequelize.literal("`depot`.`depot_name` LIKE '%"+query+"%'"), 
            // Sequelize.literal("`vendor`.`vendor_name` LIKE '%"+query+"%'")
          ]},
          statusCondition
        ]
      };
    } else {
      condition['where'] = statusCondition;
    }

    let order = [['modified_on', 'DESC']];
    if (sort) {
      if (sort.key) {
        order = [[sort.key, (sort.order ? sort.order : 'ASC')]];
      }
    }
    condition['order'] = order;

    if (pageSize.toString().trim().toUpperCase() === 'ALL') {
      //Do Nothing
    } else {
      if (pageIndex) {
        condition['offset'] = (pageIndex * pageSize);
      }
      
      if (pageSize) {
        condition['limit'] = pageSize;
      }
    }

    condition['include'] = [
      { model: User, as: 'modified_by_user', attributes: ['id', 'first_name', 'last_name'] }
    ];

    rows = await PaymentVoucher.findAll(condition);
  }

  return { count, statusCount, rows};
}

export const getVendorPaymentFile = async function(id) {
  // try {
    let paymentFile = '';

    const vendorPayment = await VendorPayment.findByPk(id, {
      include: [{ 
        model: VendorPaymentItem, 
        as: "vendorPaymentItems" 
      }]
    });

    if (vendorPayment) {
      if (vendorPayment.payment_file) {
        paymentFile = vendorPayment.payment_file;
      } else {
        const reportPath = path.join(getReportPath(), "vendor_payments");
        createPath(reportPath);
        const date = moment().format('DD-MM-YYYY_HH-m-s');
        const fileName = 'Vendor_Payment_'+ vendorPayment.id.toString() +'_' + date + '.txt';
        const filePath = path.join(reportPath, fileName);
        const contentArr = [];
        for (const vendorPaymentItem of vendorPayment.vendorPaymentItems) {
          if(vendorPaymentItem.is_approved === 1) {
            let ifsc_code = '';
            if (vendorPaymentItem.ifsc_code && vendorPaymentItem.ifsc_code !== 'null') {
              ifsc_code = vendorPaymentItem.ifsc_code;
            }

            const content = vendorPaymentItem.transaction_type + "," + 
                            ((vendorPaymentItem.vendor_code && vendorPaymentItem.vendor_code !== 'null') ? vendorPaymentItem.vendor_code : '') + "," + 
                            ((vendorPaymentItem.bank_acc_no && vendorPaymentItem.bank_acc_no !== 'null') ? vendorPaymentItem.bank_acc_no : '') + "," + 
                            round(vendorPaymentItem.vendor_payment_amount, 2).toFixed(2) + "," + 
                            ((vendorPaymentItem.beneficiary_name && vendorPaymentItem.beneficiary_name !== 'null') ? vendorPaymentItem.beneficiary_name : '') + ",,,,,,,,," + 
                            ((vendorPaymentItem.narration && vendorPaymentItem.narration !== 'null') ? vendorPaymentItem.narration : '') + ",,,,,,,,," + 
                            moment(vendorPayment.transaction_date).format('DD/MM/YYYY') + ",," + 
                            ifsc_code + "," + 
                            ((vendorPaymentItem.bank_name) ? '' : '') + "," + 
                            ((vendorPaymentItem.bank_branch_name && vendorPaymentItem.bank_branch_name !== 'null') ? vendorPaymentItem.bank_branch_name : '') + "," + 
                            ((vendorPaymentItem.bank_email && vendorPaymentItem.bank_email !== 'null') ? vendorPaymentItem.bank_email : '');
            contentArr.push(content);
          }
        }

        fs.appendFile(filePath, contentArr.join('\n'), function (err, file) {
          if (err) throw err;
          // console.log('Saved!');
        });

        paymentFile = fileName;
      }
    }

    return paymentFile;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const mailVendorPaymentFile = async function(id) {
  // try {
    let paymentFile = '';
    let result = '';

    const vendorPayment = await VendorPayment.findByPk(id, {
      include: [{ 
        model: VendorPaymentItem, 
        as: "vendorPaymentItems" 
      }]
    });

    if (vendorPayment) {
      if (vendorPayment.payment_file) {
        const reportPath = path.join(getReportPath(), "vendor_payments");
        paymentFile = path.join(reportPath, vendorPayment.payment_file);
      }
      
      let tr = '';
      for (const vendorPaymentItem of vendorPayment.vendorPaymentItems) {
        if(vendorPaymentItem.is_approved === 1) {
          let color = 'none';
          if (vendorPaymentItem.vendor_payment_amount && vendorPaymentItem.vendor_payment_amount >= 200000) {
            color = 'red';
          } else if (vendorPaymentItem.vendor_payment_amount && vendorPaymentItem.vendor_payment_amount >= 50000) {
            color = '#FFBF00';
          }

          tr = tr + '<tr>' +
                      '<td>' + ((vendorPaymentItem.transaction_type == "I") ? "HDFC Transfer" : "NEFT") + '</td>' +
                      '<td>' + vendorPaymentItem.vendor_name + '</td>' +
                      '<td>' + moment(vendorPayment.transaction_date).format('DD/MM/YYYY') + '</td>' +
                      '<td style="background-color: ' + color + '">' + vendorPaymentItem.vendor_payment_amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' }) + '</td>' +
                      '<td>' + vendorPaymentItem.narration + '</td>' +
                    '</tr>';
        }
      }

      if (paymentFile != '') {
        let report_date = new Date(vendorPayment.transaction_date).toLocaleDateString("en-US");
        let subject = 'Vendor Payment Details ' + report_date;
        let message = '<html>' +
                    '<head>' +
                        '<style>' +
                            'td { padding: 5px; width: 100px; }' +
                        '</style>' +
                    '</head>' +
                    '<body>' +
                        '<h3>Wholesome Habits Private Limited</h3>' +
                        '<h4>Vendor Payment Details</h4>' +
                        '<p>Transaction Date - ' + report_date + '</p>' +
                        '<p>Total Amount - ' + vendorPayment.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' }) + '</p>' +
                        '<p>Approved Amount - ' + vendorPayment.approved_amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' }) + '</p>' +
                        '<p>PFA</p>' +
                        '<br/><br/>' +
                        '<table class="body_table" border="1px" style="border-collapse: collapse;">' +
                        '<thead>' +
                            '<tr>' +
                                '<th>Transaction Type</th>' +
                                '<th>Vendor Name</th>' +
                                '<th>Payment Date</th>' +
                                '<th>Payment Amount</th>' +
                                '<th>Narration</th>' +
                            '</tr>' +
                        '</thead>' +
                        '<tbody>' +
                            tr +
                        '</tbody>' +
                        '</table>' +
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
            to: 'vaishabh.patle@eatanytime.in, hardik.khandelwal@etgworld.com',
            cc: 'rishit.sanghvi@eatanytime.in, dhaval.maru@otbconsulting.co.in',
            bcc: 'technology@otbconsulting.co.in',
            // to: 'technology@raastaconsulting.com',
            // cc: 'technology@raastaconsulting.com',
            // bcc: 'technology@raastaconsulting.com',
            // cc: 'dhaval.maru@otbconsulting.co.in',
            // bcc: 'rishit.sanghvi@eatanytime.in',
            subject: subject,
            text: message,
            html: message,
            attachments: [{ path: paymentFile }]
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
    }

    // return result;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

// VendorPayment.prototype.setRawMaterialIn = function() {
//   // try {
//     this.po_status = 'Raw Material In';
//   // } catch (error) {
//   //   return error;
//   // }
// }

// VendorPayment.prototype.OpenPo = function() {
//   // try {
//     this.po_status = 'Open';
//   // } catch (error) {
//   //   return error;
//   // }
// }

export default VendorPayment;