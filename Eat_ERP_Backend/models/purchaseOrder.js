import { DataTypes, Op, fn, col } from 'sequelize';
import path from 'path';
import sequelize from '../lib/database.js';
import html_to_pdf from 'html-pdf-node';
import moment from 'moment/moment.js';
import { calculateFiscalYearForDate, calculateTransactionAmount, createPath, getReportPath, getBaseUrl, getDateString } from '../lib/common.js';

import Depot from './depot.js';
import Vendor from './vendor.js';
import RawMaterial from './rawMaterial.js';
import PurchaseOrderItem from './purchaseOrderItem.js';
import PurchaseOrderOtherCharge from './purchaseOrderOtherCharge.js';
import User from './user.js';
import sendEmail from '../lib/email.js';
// import BatchProcessing from './batchProcessing.js';
// import BatchRawMaterial from './batchRawMaterial.js';
// import DepotTransfer from './depotTransfer.js';
// import DepotTransferItem from './depotTransferItem.js';

const PurchaseOrder = sequelize.define('purchase_order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  order_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
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
  delivery_date: {
    type: DataTypes.DATEONLY,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  tax_type: DataTypes.STRING,
  amount: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  cgst_amount: DataTypes.DOUBLE,
  sgst_amount: DataTypes.DOUBLE,
  igst_amount: DataTypes.DOUBLE,
  tax_amount: DataTypes.DOUBLE,
  total_amount: DataTypes.DOUBLE,
  round_off_amount: DataTypes.DOUBLE,
  po_amount: DataTypes.DOUBLE,
  po_no: DataTypes.STRING,
  po_status: DataTypes.STRING,
  is_advance: DataTypes.TINYINT,
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
  depot_name: DataTypes.STRING,
  vendor_name: DataTypes.STRING,
  po_item_names: DataTypes.STRING,
  production_planning_id: DataTypes.INTEGER
}, 
{ 
  timestamps: false,
  // createdAt: 'created_on',
  // updatedAt: 'modified_on',
  freezeTableName: true
});

PurchaseOrder.belongsTo(Vendor, { foreignKey: "vendor_id", as: "vendor" });
PurchaseOrder.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: "purchase_order_id", as: "purchase_order" });
PurchaseOrderOtherCharge.belongsTo(PurchaseOrder, { foreignKey: "purchase_order_id", as: "purchase_order" });
PurchaseOrderItem.belongsTo(RawMaterial, { foreignKey: "item_id", as: "raw_material" });
PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: "purchase_order_id", as: "purchaseOrderItems", onDelete: 'CASCADE' });
PurchaseOrder.hasMany(PurchaseOrderOtherCharge, { foreignKey: "purchase_order_id", as: "purchaseOrderOtherCharges", onDelete: 'CASCADE' });
RawMaterial.hasMany(PurchaseOrderItem, { foreignKey: "item_id", as: "purchaseOrderItems" });
PurchaseOrder.belongsToMany(RawMaterial, { through : PurchaseOrderItem, as: "raw_material", foreignKey: 'purchase_order_id' });
RawMaterial.belongsToMany(PurchaseOrder, { through : PurchaseOrderItem, as: "purchase_order", foreignKey: 'item_id' });
PurchaseOrder.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
PurchaseOrder.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
PurchaseOrder.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });

export const getPurchaseOrderMasterData = async function(purchaseOrder, req) {
  // try {
    let depotCond = { where: {status: 'Approved', type: {[Op.in]: ['Manufacturer', 'Depot']}, id: {[Op.in]: req.userData.depotIds}} };
    let vendorCond = { where: {status: 'Approved'} };
    let rawMaterialCond = { where: {status: 'Approved'} };

    if (purchaseOrder) {
      if (purchaseOrder.depot_id) {
        depotCond = { where: {[Op.or]: [{ status: 'Approved', id: {[Op.in]: req.userData.depotIds} }, { id: purchaseOrder.depot_id }]} };
      }
      if (purchaseOrder.vendor_id) {
        vendorCond = { where: {[Op.or]: [{ status: 'Approved' }, { id: purchaseOrder.vendor_id }]} };
      }
      if (purchaseOrder.purchaseOrderItems && purchaseOrder.purchaseOrderItems.length > 0) {
        const rawMaterialIds = purchaseOrder.purchaseOrderItems.map(purchaseOrderItem => purchaseOrderItem.item_id);
        rawMaterialCond = { where: {[Op.or]: [
          { status: 'Approved' }, 
          { id: { [Op.isIn]: rawMaterialIds } }
        ]} };
      }
    }

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'state'] });
    const vendors = await Vendor.findAll({ ...vendorCond, attributes: ['id', 'vendor_name', 'state'] });
    const rawMaterials = await RawMaterial.findAll({ ...rawMaterialCond, attributes: ['id', 'rm_name', 'rate'] });
    
    return { depots, vendors, rawMaterials };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getPurchaseOrder = async function(id) {
  // try {
    // console.log('generatePdf');

    const purchaseOrder = await PurchaseOrder.findByPk(id, { 
      include: [
        { 
          model: PurchaseOrderItem, 
          as: "purchaseOrderItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ['id', 'rm_name'] }]
        }, 
        "purchaseOrderOtherCharges", 
        { model: Vendor, as: "vendor", attributes: ['id', 'vendor_name', 'vendor_code', 'address', 'city', 'pincode', 'state', 'country', 'gst_number', 'payment_due_days'] },
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });

    const reportPath = path.join(getReportPath(), "purchase_orders");
    createPath(reportPath);
    const fileName = purchaseOrder.po_no.replace(/\//g, '_') + '.pdf';
    const filePath = path.join(reportPath, fileName);

    // console.log(fileName);

    let options = { format: 'A4', path: filePath, scale: 0.8 };
    // Example of options with args //
    // let options = { format: 'A4', args: ['--no-sandbox', '--disable-setuid-sandbox'] };

    const baseUrl = getBaseUrl();

    const poItems = purchaseOrder.purchaseOrderItems.map((purchaseOrderItem, index) => {
      return `<tr>
          <td class="text-center">${index + 1}</td>
          <td>${purchaseOrderItem.raw_material.rm_name}</td>
          <td class="text-right">${purchaseOrderItem.qty}</td>
          <td class="text-right"><span>${purchaseOrderItem.rate.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
          <td class="text-right"><span>${purchaseOrderItem.amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
          <td class="text-right"><span>${purchaseOrderItem.tax_amt.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
          <td class="text-right"><span>${purchaseOrderItem.total_amt.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
      </tr>`;
    }).join('');

    const poOtherCharges = purchaseOrder.purchaseOrderOtherCharges.map((purchaseOrderOtherCharge, index) => {
      return `<tr>
          <td colspan="4">${purchaseOrderOtherCharge.item_desc}</td>
          <td class="text-right"><span>${purchaseOrderOtherCharge.amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
          <td class="text-right"><span>${purchaseOrderOtherCharge.tax_amt.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
          <td class="text-right"><span>${purchaseOrderOtherCharge.total_amt.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
      </tr>`;
    }).join('');

    let message = `<html>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
        
        <style>
          table.table tr:last-child {
              border-bottom: 1px solid #333;
              vertical-align: top;
          }
          
          /* table.table td:not(:last-child) {
              border-right: 1px solid #333;
          } */
          
          table.table td {
              border-left: 1px solid #333;
              border-top: 1px solid #333;
          }
          
          table.table td:last-child {
              border-right: 1px solid #333;
          }
          table.table td {
              padding: 7px 10px;
              vertical-align: top;
              margin: 0;
          }
        </style> 
      </head> 
      <body>
        <div class="d-flex justify-content-center">
          <table class="border table font-normal text-black text-sm leading-6" style="vertical-align: top; margin: 20px;">
              <tbody>
                  <tr>
                      <td colspan="7">
                          <div class="d-flex justify-content-between align-items-center">
                              <img src="${baseUrl}assets/images/logo.png" width="180" alt="" />
                              <h2><b>Purchase Order</b></h2>
                              <img src="${baseUrl}assets/images/eatetg.png" width="60" alt="" class="mr-3" />
                          </div>
                      </td>
                  </tr>
                  <tr>
                      <td colspan="3">
                          <p><b>Wholesome Habits Pvt Ltd</b></p>
                          <p>
                              Ark Industrial Estate 104, 1st Floor, Gamdevi, <br />
                              Makwana Road, Marol, Andheri East, <br />
                              Mumbai 400059 Maharashtra India <br />
                              +91 8268000456 <br />
                              <b>GSTIN:</b> 27AABCW7811R1ZN <br />
                              <u>cs@eatanytime.in</u>
                          </p>
                      </td>
                      <td colspan="2">
                          <div class="w-full">
                              <p><b>P.O. No.</b></p>
                              <p>${purchaseOrder.po_no}</p>
                          </div>
                      </td>
                      <td colspan="2">
                          <p><b>Dated</b></p>
                          <p>${moment(purchaseOrder.order_date).format('DD-MM-YYYY')}</p>
                      </td>
                  </tr>
                  <tr>
                      <td colspan="3">
                          <p><b>Vendor</b></p>
                          <p>
                              ${purchaseOrder.vendor.vendor_name}<br />
                              ${purchaseOrder.vendor.address}<br />
                              ${purchaseOrder.vendor.city} ${purchaseOrder.vendor.pincode} ${purchaseOrder.vendor.state}<br />
                              <b>GSTIN:</b> ${purchaseOrder.vendor.gst_number}
                          </p>
                      </td>
                      <td colspan="4">
                          <p><b>Ship To</b></p>
                          <p>
                            ${purchaseOrder.depot.depot_name}<br />
                            ${purchaseOrder.depot.address}<br />
                            ${purchaseOrder.depot.city} ${purchaseOrder.depot.pincode} ${purchaseOrder.depot.state}
                          </p>
                      </td>
                  </tr>
                  <tr class="text-center font-semibold">
                      <td width="80"><b>Sr. No.</b></td>
                      <td width="300"><b>Item</b></td>
                      <td><b>Quantity</b></td>
                      <td><b>Rate</b></td>
                      <td><b>Amount</b></td>
                      <td><b>GST</b></td>
                      <td><b>Total Amount</b></td>
                  </tr>
                  ${poItems}
                  ${poOtherCharges}
                  <tr>
                      <td colspan="4"><b>Sub Total</b></td>
                      <td class="text-right"><span>${purchaseOrder.amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
                      <td class="text-right"><span>${purchaseOrder.tax_amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
                      <td class="text-right"><span>${purchaseOrder.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
                  </tr>
                  <tr>
                      <td colspan="6"><b>Round Off Amount</b></td>
                      <td class="text-right"><span>${purchaseOrder.round_off_amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
                  </tr>
                  <tr>
                      <td colspan="6"><b>TOTAL</b></td>
                      <td class="text-right"><span>${purchaseOrder.po_amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}</span></td>
                  </tr>
                  <tr>
                      <td colspan="7"><b>Remarks:</b></td>
                  </tr>
                  <tr>
                      <td colspan="4">
                          <p>
                              1. Please send two copies of your invoice<br />
                              2. Enter this order in accordance with the price, terms, delivery method, and specifications listed above.<br />
                              3. Please notify us immediately if you are unable to ship as specified.<br />
                              4. Wholesome Habits Pvt Ltd, B-505, Veena sur, Mahavir Nagar, Kandivali-West, Mumbai - 67 <br />
                              +91 8268000456<br />
                          </p>
                      </td>
                      <td colspan="3">
                          <div class="d-flex flex-column justify-content-center align-items-center">
                              <p class="mb-2">For Wholesome Habits Pvt. Ltd.</p>
                              <img src="${baseUrl}assets/images/stamp.jpg" width="150" alt="" class="mb-2" />
                              <p>Authorised Signatory</p>
                          </div>
                      </td>
                  </tr>
              </tbody>
          </table>
        </div>
      </body>
    </html>`;

    // let file = { content: "<h1>Welcome to html-pdf-node</h1>" };
    let file = { content: message };
    // or //
    // let file = { url: "https://example.com" };
    html_to_pdf.generatePdf(file, options).then(pdfBuffer => {
      // console.log("PDF Buffer:-", pdfBuffer);
    });

    return {fileName, filePath};
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const mailPurchaseOrder = async function(id) {
  // try {
    const {fileName, filePath} = await getPurchaseOrder(id);
    let result = '';

    // const reportPath = path.join(getReportPath(), "purchase_orders");
    // paymentFile = path.join(reportPath, vendorPayment.payment_file);

    const purchaseOrder = await PurchaseOrder.findByPk(id, { 
      include: [
        { 
          model: PurchaseOrderItem, 
          as: "purchaseOrderItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ['id', 'rm_name'] }]
        }, 
        "purchaseOrderOtherCharges", 
        { model: Vendor, as: "vendor", attributes: ['id', 'vendor_name', 'vendor_code', 'address', 'city', 'pincode', 'state', 'country', 'gst_number', 'payment_due_days', 'email_id', 'bank_email'] },
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });

    if (purchaseOrder) {
      if (filePath != '') {
        // let order_date = new Date(purchaseOrder.order_date).toLocaleDateString("en-US");
        let order_date = moment(purchaseOrder.order_date).format('DD-MM-YYYY');
        let subject = 'Purchase Order from Wholesome Habits Pvt Ltd - ' + purchaseOrder.po_no;
        const message = `<html><head></head><body>Dear ${purchaseOrder.vendor.vendor_name},<br /><br />
                        Please find our purchase order attached to this email.
                        <br /><br />Thank you<br />Team eatanytime
                        <br /><br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-----------------   Purchase Order Summary  -------------------<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Purchase Order No. : ${purchaseOrder.po_no}<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Purchase Order Date: ${order_date}<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Total: Rs ${purchaseOrder.po_amount.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}<br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--------------------------------------------------------------------------
                        </body></html>`;

        // let from_email = 'cs@eatanytime.in';
        // let from_email_sender = 'EAT MIS';

        let to_email = 'product@eatanytime.in';

        if (purchaseOrder.vendor.email_id) {
          to_email = to_email + ', ' + purchaseOrder.vendor.email_id;
        }
        if (purchaseOrder.vendor.bank_email) {
          to_email = to_email + ', ' + purchaseOrder.vendor.bank_email;
        }

        const mailOptions = {
            from: 'EAT MIS <cs@eatanytime.in>',
            to: to_email,
            cc: 'prachi.sanghvi@eatanytime.in, dhaval.maru@otbconsulting.co.in',
            bcc: 'technology@otbconsulting.co.in',
            // to: 'prasad.bhisale@raastaconsulting.com',
            // cc: 'technology@raastaconsulting.com',
            // bcc: 'technology@raastaconsulting.com',
            // cc: 'dhaval.maru@otbconsulting.co.in',
            // bcc: 'rishit.sanghvi@eatanytime.in',
            subject: subject,
            text: message,
            html: message,
            attachments: [{ filename: fileName, path: filePath }]
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

PurchaseOrder.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.order_date = body.order_date ? new Date(body.order_date).toISOString() : null;
    this.depot_id = body.depot_id ? +body.depot_id : null;
    this.vendor_id = body.vendor_id ? +body.vendor_id : null;
    this.amount = body.amount ? +body.amount : 0;
    // this.delivery_date = body.delivery_date ? body.delivery_date : null;
    // this.ref_id = body.ref_id ? +body.ref_id : null;
    // this.status = body.status;
    this.remarks = body.remarks ? body.remarks.trim() : '';
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

PurchaseOrder.prototype.setTaxType = async function() {
  const depot = await Depot.findByPk(this.depot_id);
  const vendor = await Vendor.findByPk(this.vendor_id);
  
  let taxType = 'Intra';
  if (depot.state.trim().toUpperCase() === vendor.state.trim().toUpperCase()) {
    taxType = "Intra";
  } else {
    taxType = "Inter"
  }
  
  this.tax_type = taxType;

  this.depot_name = depot && depot.depot_name ? depot.depot_name : '';
  this.vendor_name = vendor && vendor.vendor_name ? vendor.vendor_name : '';

  return taxType;
}

PurchaseOrder.prototype.getPurchaseOrderItems = function(body) {
  // try {
    const purchaseOrderItems = [];
    if (body.purchaseOrderItems) {
      for (const postedPurchaseOrderItem of body.purchaseOrderItems) {
        const item_id = (postedPurchaseOrderItem.item_id) ? +postedPurchaseOrderItem.item_id : null;
        const item_desc = (postedPurchaseOrderItem.item_desc) ? postedPurchaseOrderItem.item_desc : '';
        const qty = (postedPurchaseOrderItem.qty) ? +postedPurchaseOrderItem.qty : 0;
        const rate = (postedPurchaseOrderItem.rate) ? +postedPurchaseOrderItem.rate : 0;
        // const tax_type = (this.tax_type) ? this.tax_type : 'Intra';
        const old_po_rate = (postedPurchaseOrderItem.old_po_rate) ? +postedPurchaseOrderItem.old_po_rate : 0;
  
        const purchaseOrderItem = {
          purchase_order_id: this.id,
          item_id: item_id,
          item_desc: item_desc,
          qty: qty,
          rate: rate,
          old_po_rate: old_po_rate
        };

        purchaseOrderItems.push(purchaseOrderItem);
      }
    }
    
    return purchaseOrderItems;
  // } catch (error) {
  //   return error;
  // }
}

PurchaseOrder.prototype.getPurchaseOrderOtherCharges = function(body) {
  // try {
    const purchaseOrderOtherCharges = [];
    if (body.purchaseOrderOtherCharges) {
      for (const postedPurchaseOrderOtherCharge of body.purchaseOrderOtherCharges) {
        // const item_id = (postedPurchaseOrderOtherCharge.item_id) ? +postedPurchaseOrderOtherCharge.item_id : null;
        const item_desc = (postedPurchaseOrderOtherCharge.item_desc) ? postedPurchaseOrderOtherCharge.item_desc : '';
        // const qty = (postedPurchaseOrderOtherCharge.qty) ? +postedPurchaseOrderOtherCharge.qty : null;
        // const rate = (postedPurchaseOrderOtherCharge.rate) ? +postedPurchaseOrderOtherCharge.rate : null;
        const amount = (postedPurchaseOrderOtherCharge.amount) ? +postedPurchaseOrderOtherCharge.amount : 0;
        const tax_per = (postedPurchaseOrderOtherCharge.tax_per) ? +postedPurchaseOrderOtherCharge.tax_per : 0;
        // const tax_type = (this.tax_type) ? this.tax_type : 'Intra';
        // const old_po_rate = (postedPurchaseOrderOtherCharge.old_po_rate) ? +postedPurchaseOrderOtherCharge.old_po_rate : null;
  
        const purchaseOrderOtherCharge = {
          purchase_order_id: this.id,
          // item_id: item_id,
          item_desc: item_desc,
          // qty: qty,
          // rate: rate,
          amount: amount,
          tax_per: tax_per,
          // old_po_rate: old_po_rate
        };

        purchaseOrderOtherCharges.push(purchaseOrderOtherCharge);
      }
    }
    
    return purchaseOrderOtherCharges;
  // } catch (error) {
  //   return error;
  // }
}

PurchaseOrder.prototype.setTransactionAmount = function(purchaseOrderItems, purchaseOrderOtherCharges) {
  // try {
    const items = purchaseOrderItems.concat(purchaseOrderOtherCharges);

    const transaction = calculateTransactionAmount(items, 0, 0);

    this.amount = transaction.amount;
    this.cgst_amount = transaction.cgst_amount;
    this.sgst_amount = transaction.sgst_amount;
    this.igst_amount = transaction.igst_amount;
    this.tax_amount = transaction.tax_amount;
    this.total_amount = transaction.total_amount;
    this.round_off_amount = transaction.round_off_amount;
    this.po_amount = transaction.final_amount;

    this.po_item_names = items.map(item => item.item_name).join(',');
  // } catch (error) {
  //   return error;
  // }
}

PurchaseOrder.prototype.setRawMaterialIn = function() {
  // try {
    if (this.po_status.trim().toUpperCase() === 'ADVANCE' || this.is_advance === 1) {
      this.po_status = 'Closed';
    } else {
      this.po_status = 'Raw Material In';
    }
  // } catch (error) {
  //   return error;
  // }
}

PurchaseOrder.prototype.OpenPo = function() {
  // try {
    if (this.is_advance === 1) {
      this.po_status = 'Advance';
    } else if (!this.po_status || this.po_status.trim().toUpperCase() !== 'ADVANCE') {
      this.po_status = 'Open';
    }
  // } catch (error) {
  //   return error;
  // }
}

PurchaseOrder.prototype.approve = function(req) {
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

PurchaseOrder.prototype.reject = function(req) {
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

PurchaseOrder.prototype.getPurchaseOrderNo = function(series) {
  // try {
    if (this.po_no) {
      return this.po_no;
    }
  
    const orderDate = this.order_date ? new Date(this.order_date) : new Date();
    const financialYear = calculateFiscalYearForDate(orderDate);
    // const monthName = getMonthName(orderDate.getMonth());

    const purchaseOrderNo = 'WHPL/' + financialYear + '/' + series;
    
    this.po_no = purchaseOrderNo;

    return purchaseOrderNo;
  // } catch (error) {
  //   return error;
  // }
}

PurchaseOrder.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    if (this.depot_id) {
      count = await Depot.count({ where: { id: this.depot_id }});
      if (count === 0) {
        return { errors : { depot_id: { message: `Depot not exist` } } };
      }
    }
    if (this.vendor_id) {
      count = await Vendor.count({ where: { id: this.vendor_id }});
      if (count === 0) {
        return { errors : { vendor_id: { message: `Vendor does not exist` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export const getOldPurchaseOrderRate = async function(rawMaterialId) {
  // const rawMaterial = await RawMaterial.findByPk(rawMaterialId);
  // if (!rawMaterial) {
  //   return res.status(404).json({ message: "Raw Material not found!" });
  // }

  // const rawMaterial = await RawMaterial.findByPk(rawMaterialId, { include: PurchaseOrder });

  // const rawMaterial = await PurchaseOrder.findByPk(2346, { include: 'purchaseOrderItems' });
  // const rawMaterial = await PurchaseOrder.findByPk(2346, { include: { all: true, nested: true }});
  // const rawMaterial = await PurchaseOrder.findByPk(2346, { include: [
  //   { model: PurchaseOrderItem, as: 'purchaseOrderItems', include: [{ model: RawMaterial, as: 'raw_material' }]}] });

  const rawMaterial = await RawMaterial.findByPk(rawMaterialId, { 
    include: [
      { 
        model: PurchaseOrder, 
        as: 'purchase_order', 
        attributes: ["id", "order_date", "vendor_id"], 
        include: { model: PurchaseOrderItem, as: 'purchaseOrderItems', attributes: ["purchase_order_id", "rate"] },
        where: { status: 'Approved' }, 
        required: false
      },
      // { model: PurchaseOrderItem, as: 'purchaseOrderItems', attributes: ["purchase_order_id", "rate"] }
    ], 
    order: [[{ model: PurchaseOrder, as: 'purchase_order'}, 'order_date', 'DESC' ]],
    raw: false
  });

  let oldPoRate = 0;
  let vendorId = 0;
  if (rawMaterial && rawMaterial.purchase_order && rawMaterial.purchase_order.length > 0) {
    vendorId = rawMaterial.purchase_order[0].vendor_id;
    if (rawMaterial.purchase_order[0].purchase_order_items) {
      oldPoRate = rawMaterial.purchase_order[0].purchase_order_items.rate;
    }
  }

  // delete rawMaterial.purchase_order;
  // if (rawMaterial.purchaseOrderItems.length > 0) {
  //   rawMaterial.old
  // }

  return {rawMaterial, oldPoRate, vendorId};
}



function getTable(purchaseOrders) {
  let table = '';
  let th = '';
  let tr = '';
  let srNo = 0;

  th = `<thead><tr>
          <th style="width: 10%;">SR No</th>
          <th style="width: 10%;">Order Date</th>
          <th style="width: 20%;">Vendor Name</th>
          <th style="width: 20%;">Depot Name</th>
          <th style="width: 10%;">Amount</th>
        </tr><thead>`;
  for (const purchaseOrder of purchaseOrders) {
    tr += `<tr>
            <td style="text-align: center;">${++srNo}</td>
            <td>${moment(purchaseOrder.order_date).format('DD-MM-YYYY')}</td>
            <td>${purchaseOrder.vendor.vendor_name}</td>
            <td>${purchaseOrder.depot.depot_name}</td>
            <td style="text-align: center;">${purchaseOrder.po_amount}</td>
          </tr>`;
  }

  table = `<table class="body_table" border="1px" style="border-collapse: collapse;">
            ${th}
            <tbody>${tr}</tbody>
          </table>`;

  return table;
}

export const sendPurchaseOrderDetails = async function(tables) {
  // let from_email = 'cs@eatanytime.in';
  // let from_email_sender = 'EAT MIS';

  // let date = new Date().toLocaleDateString();
  let date = moment().format('DD/MM/YYYY');
  let subject = 'Purchase Order Details ' + date;

  let message = `<html>
              <head>
                  <style>
                      h3{
                          font-size: 15px;
                          font-family: sans-serif;
                          margin-bottom: 15px;
                      }
                      h4{
                          font-size: 13px;
                          font-family: sans-serif;
                          margin-top: 0;
                      }
                      .body_table{
                          cellspacing:0;
                          font-family:sans-serif
                      }
                      .body_table thead tr{
                          background-color:#cfffff;
                      }
                      .body_table thead tr td {
                          width: 40%;
                          font-weight: bold;
                          padding: 10px;
                          text-align: center;
                      }
                      .body_table tbody tr td{
                          padding: 10px;
                      }
                      .body_table tbody tr td:not(:first-child){
                          text-align:center;
                      }
                      .body_table tbody tr td:last-child{
                          font-weight:bold;
                      }
                  </style>
              </head>
              <body>
                  <!-- <h3>Wholesome Habits Private Limited</h3> -->
                  
                  ${tables}

                  Regards,
                  <br/><br/>
                  CS
              </body>
              </html>`;
  

  const mailOptions = {
    from: 'EAT MIS <cs@eatanytime.in>',
    to: 'lakshya.ajmera@eatanytime.in, product@eatanytime.in, product1@eatanytime.in, prachi.sanghvi@eatanytime.in',
    cc: 'rishit.sanghvi@eatanytime.in, dhaval.maru@otbconsulting.co.in',
    bcc: 'prasad.bhisale@otbconsulting.co.in',
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
}

PurchaseOrder.mailPurchaseOrderDetails = async function() {
  const curDate = getDateString(new Date());

  const purchaseOrders = await PurchaseOrder.findAll({ 
    where: {
      [Op.or]: [
        { status: 'Pending' },
        { created_on: { [Op.gte]: curDate } },
        { approved_on: { [Op.gte]: curDate } }
      ]
    },
    include: [
      { 
        model: PurchaseOrderItem, 
        as: "purchaseOrderItems", 
        include: [{ model: RawMaterial, as: "raw_material", attributes: ['id', 'rm_name'] }]
      },
      { model: Vendor, as: "vendor", attributes: ['id', 'vendor_name', 'address', 'city', 'pincode', 'state', 'country'] }, 
      { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
      // { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
      // { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
      // { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
    ], 
    order: [['order_date', 'ASC']]
  });

  const poGenerated = [];
  const pendingApproval = [];
  const rejected = [];
  const approved = [];
  if (purchaseOrders) {
    for (const purchaseOrder of purchaseOrders) {
      // const orderDate = new Date(purchaseOrder.order_date);
      const createdOn = getDateString(new Date(purchaseOrder.created_on));

      if (createdOn === curDate) {
        poGenerated.push(purchaseOrder);
      }
      
      // if ((purchaseOrder.status.trim().toUpperCase() === 'PENDING') && (orderDate < new Date(curDate))) {
      if (purchaseOrder.status.trim().toUpperCase() === 'PENDING') {
        pendingApproval.push(purchaseOrder);
      } else if (purchaseOrder.status.trim().toUpperCase() === 'REJECTED' || purchaseOrder.status.trim().toUpperCase() === 'INACTIVE') {
        rejected.push(purchaseOrder);
      } else if (purchaseOrder.status.trim().toUpperCase() === 'APPROVED') {
        approved.push(purchaseOrder);
      }
    }
  }

  let tables = ``;
  if (poGenerated.length > 0) {
    const table = getTable(poGenerated);
    tables += `<h4>Generated Today</h4>${table}<br/><br/>`;
  }
  if (pendingApproval.length > 0) {
    const table = getTable(pendingApproval);
    tables += `<h4>Pending Approval</h4>${table}<br/><br/>`;
  }
  if (rejected.length > 0) {
    const table = getTable(rejected);
    tables += `<h4>Rejected Today</h4>${table}<br/><br/>`;
  }
  if (approved.length > 0) {
    const table = getTable(approved);
    tables += `<h4>Approved Today</h4>${table}<br/><br/>`;
  }

  if (tables !== '') {
    sendPurchaseOrderDetails(tables);
  }

  return tables;
}

// purchaseOrderSchema.methods.setOldPoRate = async function(req, session) {
//   try {
//     for (const purchaseOrderItem of this.purchaseOrderItems) {
//       await Product.findOneAndUpdate({ _id: purchaseOrderItem.productId.toString() }, {
//         oldPoRate: purchaseOrderItem.rate,
//         oldPoRateDate: this.purchaseOrderDate
//       }, { session: session });

//       // const product = await Product.findOne({ _id: purchaseOrderItem.productId.toString(), oldPoRateDate : { $lte : this.purchaseOrderDate } });
//       // const product = await Product.findOne({ _id: purchaseOrderItem.productId.toString() });

//       // console.log(product);

//       // if (product) {
//       //   product.oldPoRate = purchaseOrderItem.rate;
//       //   product.oldPoRateDate = this.purchaseOrderDate;

//       //   console.log(product);

//       //   await product.save({ session });
//       // } else {
//       //   console.log('Product Not Found.');
//       // }
//     }

//     return null;
//   } catch (error) {
//     return error;
//   }
// }

export default PurchaseOrder;