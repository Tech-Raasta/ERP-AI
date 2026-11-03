import fs from "fs";
import path from "path";

import { DataTypes, Op, Sequelize } from 'sequelize';
import sequelize from '../lib/database.js';
import { getReportPath, getTemplatePath, getUploadPath, round } from '../lib/common.js';
import ExcelJS from 'exceljs';
import Depot from './depot.js';
import Distributor from './distributor.js';
import State from './state.js';
import Product from './product.js';
import Box from './box.js';
import Production from './production.js';
import ComboBox from './comboBox.js';
import City from './city.js';
import SaleUploadDetail from "./saleUploadDetail.js";
import ComboBoxItem from "./comboBoxItem.js";
import Pincode from "./pincode.js";
import SaleUploadItem from "./saleUploadItem.js";
import Sale from "./sale.js";

const SaleUpload = sequelize.define('sales_upload_files', {
  upload_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  file_name: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  file_path: DataTypes.STRING,
  error_file_path: DataTypes.STRING,
  error_file_name: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  check_file_path: DataTypes.STRING,
  check_file_name: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  remarks: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  status: {
    type: DataTypes.STRING, 
    // allowNull: false
  },
  created_by: {
    type: DataTypes.INTEGER, 
    // references: 'User'
  },
  modified_by: {
    type: DataTypes.INTEGER, 
    // references: 'User'
  },
  approved_by: {
    type: DataTypes.INTEGER, 
    // references: 'User'
  },
  rejected_by: {
    type: DataTypes.INTEGER, 
    // references: 'User'
  },
  approved_on: {
    type: DataTypes.DATEONLY
  },
  rejected_on: {
    type: DataTypes.DATEONLY
  }
}, 
{
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

// (async () => {
//   await SaleUpload.sync({ force: true });
//   console.log('The table for the Sale Upload model was just (re)created!');
//   // Code here
// })();

SaleUpload.prototype.getRequestData = function(req) {
  try {
    // this.upload_date = (req.body.upload_date) ? req.body.upload_date : '';
    this.upload_date = new Date().toISOString().substring(0, 10);
    this.file_name = '';
    this.check_file_name = '';

    // console.log(req.file);

    // signedUrl = await signS3URL(req.file.filename, req.file.mimetype);

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

SaleUpload.getUploadFormat = async function(req) {
  try {
    const template = path.join(getTemplatePath(), 'Sales_upload_format.xlsx');

    if (!fs.existsSync(template)) {
      return 'Template not found.';
    }

    // console.log(template);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(template);
    const worksheet1 = workbook.getWorksheet(1);
    const worksheet2 = workbook.getWorksheet(2);

    let row = 2;
    const depots = await Depot.findAll({ where: {status: 'Approved', id: {[Op.in]: req.userData.depotIds}}, attributes: ['depot_name'], order: [['depot_name', 'asc']] });
    for (const depot of depots) {
      worksheet2.getCell(`A${ row++ }`).value = depot.depot_name;
    }

    row = 2;
    const distributors = await Distributor.findAll({ where: {status: 'Approved'}, attributes: ['distributor_name'], order: [['distributor_name', 'asc']] });
    for (const distributor of distributors) {
      worksheet2.getCell(`C${ row++ }`).value = distributor.distributor_name;
    }

    row = 2;
    // const states = await State.findAll({ where: {status: 'Approved'}, attributes: ['state_name'], order: [['state_name', 'asc']] });
    // for (const state of states) {
    //   worksheet2.getCell(`E${ row++ }`).value = state.state_name;
    // }
    const cities = await City.findAll({ where: {status: 1}, attributes: ['city_name'], order: [['city_name', 'asc']] });
    for (const city of cities) {
      worksheet2.getCell(`E${ row++ }`).value = city.city_name;
    }

    row = 2;
    const products = await Product.findAll({ where: {status: 'Approved'}, attributes: ['product_name'], order: [['product_name', 'asc']] });
    for (const product of products) {
      worksheet2.getCell(`I${ row++ }`).value = product.product_name;
    }
    // worksheet2.definedNames.add('Sheet2!$I$2:$I$' + row, "Bar");
    // worksheet2.getCell('$I$2:$I$' + row).name = 'Bar';

    row = 2;
    const boxes = await Box.findAll({ where: {status: 'Approved'}, attributes: ['box_name'], order: [['box_name', 'asc']] });
    for (const box of boxes) {
      worksheet2.getCell(`K${ row++ }`).value = box.box_name;
    }
    // worksheet2.definedNames.add('Sheet2!$I$2:$I$' + row, "Box");
    // worksheet2.getCell('$I$2:$I$' + row).name = 'Box';

    row = 2;
    const productions = await Production.findAll({ where: {status: 'Approved', batch_id_as_per_fssai: { [Op.not]: null }}, attributes: [Sequelize.fn('DISTINCT', Sequelize.col('batch_id_as_per_fssai')) ,'batch_id_as_per_fssai'], order: [['date_of_processing', 'asc']] });
    for (const production of productions) {
      worksheet2.getCell(`M${ row++ }`).value = production.batch_id_as_per_fssai;
    }
    // worksheet2.definedNames.add('Sheet2!$I$2:$I$' + row, "Batch_No");
    // worksheet2.getCell('$I$2:$I$' + row).name = 'Box';

    row = 2;
    const comboBoxes = await ComboBox.findAll({ where: {status: 'Approved'}, attributes: ['combo_box_name'], order: [['combo_box_name', 'asc']] });
    for (const comboBox of comboBoxes) {
      worksheet2.getCell(`O${ row++ }`).value = comboBox.combo_box_name;
    }
    // worksheet2.definedNames.add('Sheet2!$K$2:$K$' + row, "Combo_Box");
    // worksheet2.getCell('$K$2:$K$' + row).name = "Combo_Box";

    for (row = 4; row<=110; row++) {
      if (depots) {
        worksheet1.getCell(`B${ row }`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$A$2:$A$' + (depots.length + 1)]
        };
      }
      if (distributors) {
        worksheet1.getCell(`C${ row }`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$C$2:$C$' + (distributors.length + 1)]
        };
      }
      if (cities) {
        worksheet1.getCell(`F${ row }`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$E$2:$E$' + (cities.length + 1)]
        };
      }

      worksheet1.getCell(`J${ row }`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Sheet2!$G$2:$G$4']
      };

      worksheet1.getCell(`K${ row }`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`IF(J${ row }="", "", INDIRECT(J${ row }))`]
      };

      if (productions) {
        worksheet1.getCell(`T${ row }`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$M$2:$M$' + (productions.length + 1)]
        };
      }

      // if (products) {
      //   worksheet1.getCell(`K${ row }`).dataValidation = {
      //     type: 'list',
      //     allowBlank: true,
      //     formulae: ['Sheet2!$G$2:$G$' + (products.length + 1)]
      //   };
      // }
    }

    worksheet2.state = 'hidden';

    // return workbook;

    const fileName = `Sales_upload_format_${Date.now()}.xlsx`;
    const filePath = path.join(getReportPath(), fileName);
    await workbook.xlsx.writeFile(filePath);

    // return fileUrl;

    return fileName;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

// SaleUpload.getS3SignedUploadUrl = async () => {
//   try {
//     const key = `uploads/${Date.now()}.jpeg`;
//     // s3.getSignedUrl('putObject', {
//     //   Bucket: 'MUTHOOT-erp-resources',
//     //   ContentType: 'image/jpeg',
//     //   Expires: 5 * 60,
//     //   Key: key
//     // }, (err, url) => res.send({ key, url }));

//     // const signedUrl = await s3.getSignedUrl('putObject', {
//     //                                               Bucket: 'MUTHOOT-erp-resources',
//     //                                               ContentType: 'jpeg',
//     //                                               Expires: 5 * 60,
//     //                                               Key: key
//     //                                             });

//     signedUrl = await signS3URL(key, 'image/jpeg');
    
//     return { key, signedUrl };
//   } catch (error) {
//     return error;
//   }
// }

SaleUpload.prototype.uploadFileData = async function(req) {
  let t;

  // try {
    // console.log('Upload File Data');

    const uploadPath = path.join(getUploadPath(), 'sale_upload');
    
    if (!fs.existsSync(uploadPath)){
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    const fileName = req.files.doc_document[0].filename;
    const filePath = path.join(uploadPath, fileName);
    const check_file_name = `Check-${Date.now()}-${this.id}.xlsx`;
    const check_file_path = path.join(uploadPath, check_file_name);
    // const error_file_name = `Error-${Date.now()}-${this.id}'.xlsx`;
    // const error_file_namePath = `${getUploadPath()}/${error_file_name}`;
    // console.log(filePath);

    // let fileKey = '';
    // let fileUrl = '';

    if (!fs.existsSync(filePath)) {
      // console.log('File Not Found.');
      this.remarks = 'File Not Found.';
      this.status = 'Failed';
      return 'File not found.';
    }
    
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);

    if (worksheet.getCell('A4').value.trim().toUpperCase() !== 'CREATION DATE' || 
        worksheet.getCell('B4').value.trim().toUpperCase() !== 'DEPOT' || 
        worksheet.getCell('C4').value.trim().toUpperCase() !== 'DISTRIBUTOR NAME' ||
        worksheet.getCell('D4').value.trim().toUpperCase() !== 'NAME OF CUSTOMER' ||
        worksheet.getCell('E4').value.trim().toUpperCase() !== 'ADDRESS' ||
        worksheet.getCell('F4').value.trim().toUpperCase() !== 'CITY' ||
        worksheet.getCell('G4').value.trim().toUpperCase() !== 'PINCODE' ||
        worksheet.getCell('H4').value.trim().toUpperCase() !== 'MOBILE NO' ||
        worksheet.getCell('I4').value.trim().toUpperCase() !== 'PO NO' ||
        worksheet.getCell('J4').value.trim().toUpperCase() !== 'TYPE' ||
        worksheet.getCell('K4').value.trim().toUpperCase() !== 'SKU NAME' ||
        worksheet.getCell('L4').value.trim().toUpperCase() !== 'QTY' ||
        worksheet.getCell('M4').value.trim().toUpperCase() !== 'MRP' ||
        worksheet.getCell('N4').value.trim().toUpperCase() !== 'DISCOUNT %' ||
        worksheet.getCell('O4').value.trim().toUpperCase() !== 'TOTAL REALISATION VALUE' ||
        worksheet.getCell('P4').value.trim().toUpperCase() !== 'CGST' ||
        worksheet.getCell('Q4').value.trim().toUpperCase() !== 'SGST' ||
        worksheet.getCell('R4').value.trim().toUpperCase() !== 'IGST' ||
        worksheet.getCell('S4').value.trim().toUpperCase() !== 'NET SALES' ||
        worksheet.getCell('T4').value.trim().toUpperCase() !== 'BATCH NO' ||
        worksheet.getCell('U4').value.trim().toUpperCase() !== 'TRACK ID' ||
        worksheet.getCell('V4').value.trim().toUpperCase() !== 'REMARKS' ||
        worksheet.getCell('W4').value.trim().toUpperCase() !== 'DISPATCH THROUGH') {
          this.remarks = 'File Format does not match.';
          this.status = 'Failed';

          // fileKey = `uploads/sales/${fileName}`;
          // fileUrl = await uploadFileToS3Bucket(filePath, fileKey);
          this.file_name = fileName;
          
          return 'File Format does not match.';
    }

    worksheet.getCell('X4').value = "Error Remark";
    worksheet.getCell('Y4').value = "Status";

    // const rows1 = worksheet.getRow(1);
    // console.log(rows1.getCell(1).value);

    // const rowsCount1 = worksheet.lastRow;
    // console.log('Last Row - ' + rowsCount1);

    // const rows = worksheet.getColumn(1);
    // const rowsCount = rows['_worksheet']['_rows'].length;
    // console.log(rowsCount);

    // console.log(worksheet.rowCount);

    const saleUploadDetails = [];
    const errorOrderNos = [];
    let successCount = 0;
    let failCount = 0;
    const rowsCount = worksheet.rowCount;
    // console.log(rowsCount);

    for (let rowNum = 5; rowNum <= rowsCount; rowNum++) {
      // console.log(rowNum);
      const row = worksheet.getRow(rowNum);
      const error = [];
      const saleDate = row.getCell(1).value ? new Date(row.getCell(1).value).toISOString() : null;
      
      if (!saleDate) {
        continue;
      }

      const depot_name = row.getCell(2).text;
      const distributor_name = row.getCell(3).text;
      const client_name = row.getCell(4).text;
      const address = row.getCell(5).text;
      const city = row.getCell(6).text;
      const pincode = row.getCell(7).text;
      const mobile_no = row.getCell(8).text;
      const order_no = row.getCell(9).text;
      let sku_type = row.getCell(10).text;
      let sku_name = row.getCell(11).text;
      let sku_qty = row.getCell(12).text;
      let sku_mrp = row.getCell(13).text;
      let shipping_charges = 0;
      let sku_discount = row.getCell(14).text;
      let sku_value = row.getCell(15).text;
      let delivery_status = 'Delivered';
      const batch_no = row.getCell(20).text ? row.getCell(20).text : '';
      let tracking_id = row.getCell(21).text ? row.getCell(21).text : null;
      const remarks = row.getCell(22).text;
      const despatch_through = row.getCell(23).text;

      // console.log(row.getCell(2).text);

      sku_qty = sku_qty ? parseFloat(sku_qty) : 0;
      sku_mrp = sku_mrp ? parseFloat(sku_mrp) : 0;
      shipping_charges = shipping_charges ? parseFloat(shipping_charges) : 0;
      sku_discount = sku_discount ? parseFloat(sku_discount) : 0;
      sku_value = sku_value ? parseFloat(sku_value) : 0;

      let saleUploadDetail = null;
      let saleUploadDetailIndex = -1;
      if (order_no) {
        saleUploadDetailIndex = saleUploadDetails.findIndex(saleUploadDetail => {
          return (saleUploadDetail.order_no.trim().toUpperCase() === order_no.trim().toUpperCase() && saleUploadDetail.distributor_name.trim().toUpperCase() === distributor_name.trim().toUpperCase());
        });
        
        if (saleUploadDetailIndex !== -1) {
          saleUploadDetail = saleUploadDetails[saleUploadDetailIndex];
        }
      }
      
      // if (!isValidDate(saleDate)) {
      //   error.push('Sale date should be in d-m-Y format.');
      // }
      // if (shipmentDueDate && !isValidDate(shipmentDueDate)) {
      //   error.push('Shipment due date should be in d-m-Y format.');
      // }
      // if (dispatchDate && !isValidDate(dispatchDate)) {
      //   error.push('Dispatched date should be in d-m-Y format.');
      // }
      // if (deliveryDate && !isValidDate(deliveryDate)) {
      //   error.push('Delivery date should be in d-m-Y format.');
      // }

      // saleDate = saleDate ? new Date(saleDate).toISOString() : null;
      // shipmentDueDate = shipmentDueDate ? new Date(shipmentDueDate).toISOString() : null;
      // dispatchDate = dispatchDate ? new Date(dispatchDate).toISOString() : null;
      // deliveryDate = deliveryDate ? new Date(deliveryDate).toISOString() : null;

      // console.log(depot_name);
      // console.log(depot_name.result);

      let depot_id = null;
      let depot_state = '';
      if (depot_name) {
        const depotObj = await Depot.findOne({ where: {depot_name: depot_name}, id: {[Op.in]: req.userData.depotIds} });
        if (depotObj && depotObj.id) {
          depot_id = depotObj.id;
          depot_state = depotObj.state ? depotObj.state : '';
        }
      }
      if (!depot_id) {
        error.push('Depot not found.');
      }

      let distributor_id = null;
      let distributor_state = '';
      let distributor_class = '';
      let state = null;
      let country = null;
      if (distributor_name) {
        const distributorObj = await Distributor.findOne({ where: {distributor_name: distributor_name} });
        if (distributorObj && distributorObj.id) {
          distributor_id = distributorObj.id;
          distributor_state = distributorObj.state ? distributorObj.state : '';
          distributor_class = distributorObj.class ? distributorObj.class : '';
          state = await State.findOne({ where: { state_name: distributor_state }, include: 'country' });
        }
      }
      if (!distributor_id) {
        error.push('Distributor not found.');
      } 
      
      // if (distributor_class.trim().toUpperCase() !== 'DIRECT' && (client_name || address || city || pincode || mobile_no)) {
      //   error.push('Distributor is not direct. Customer name, address, city, pincode, state, mobile_no should be blank.')
      // }

      if (distributor_class.trim().toUpperCase() === 'DIRECT') {
        // if (!client_name) {
        //   error.push('Customer Name not found.');
        // }
        // if (!address) {
        //   error.push('Customer Address not found.');
        // }
        // if (!city) {
        //   error.push('Customer City not found.');
        // }
        if (!pincode) {
          error.push('Customer Pincode not found.');
        }

        if (pincode) {
          const objPincode = await Pincode.findOne({ where: {pincode: pincode}, include: {model: State, as: 'state', include: 'country'}});
          
          if (!objPincode) {
            error.push('Customer Pincode not found.');
          } else {
            state = objPincode.state;
          }
        }
        // if (state_name) {
        //   state = await State.findOne({ where: {state_name: state_name}, includes: 'country' });
        // }
        if (!state) {
          error.push('Customer State not found.');
        } else {
          distributor_state = state.state_name;
          country = state.country;
        }
      } else {
        delivery_status = 'Pending';
      }

      let tax_type = 'Intra';
      if (distributor_state.trim().toUpperCase() === depot_state.trim().toUpperCase()) {
        tax_type = "Intra";
      } else {
        tax_type = "Inter"
      }

      if (!order_no) {
        error.push('Order No not found.');
      } else {
        const saleCount = await Sale.count({ where: {order_no: order_no, status: { [Op.notIn]: ['Rejected', 'InActive'] }} });
        if (saleCount) {
          error.push('Order No already exist.');
        } else {
          const saleUploadDetailCount = await SaleUploadDetail.count({ where: {order_no: order_no, status: 'Pending'} });
          if (saleUploadDetailCount) {
            error.push('Order No already pending.');
          }
        }
      }

      if (tracking_id) {
        tracking_id = tracking_id.replace("'", "");
        const saleCount = await Sale.count({ where: {tracking_id: tracking_id, status: { [Op.notIn]: ['Rejected', 'InActive'] }} });
        if (saleCount) {
          error.push('Track ID already exist.');
        } else {
          const saleUploadDetailCount = await SaleUploadDetail.count({ where: {tracking_id: tracking_id, status: 'Pending'} });
          if (saleUploadDetailCount) {
            error.push('Track ID already pending.');
          }
        }
      }

      if (!sku_type) {
        error.push('Item Type should be Box Or Combo_Box.');
        sku_type = '';
      } else {
        // if (sku_type.trim().toUpperCase() !== 'BOX' && sku_type.trim().toUpperCase() !== 'COMBO_BOX' ) {
        //   error.push('Item Type should be Box Or Combo_Box.');
        //   sku_type = '';
        // }
      }
      if (!sku_qty || sku_qty <= 0) {
        error.push('Quantity should be greater than zero.');
        sku_qty = 0;
      }
      // if (!sku_mrp || sku_mrp <= 0) {
      //   error.push('MRP should be greater than zero.');
      //   sku_mrp = 0;
      // }
      // if (!discount || discount <= 0) {
      //   // error.push('Discount should be greater than zero.');
      //   discount = 0;
      // }
      if (!sku_value || sku_value <= 0) {
        error.push('Total Order Realisation Value should be greater than zero.');
        sku_value = 0;
      }
      // if (saleRate === 0 && discount === 0 && totalOrderValue === 0) {
      //   error.push('Please enter Sale Rate, Discount % Or Total Realisation Value.');
      // }

      const saleUploadItems = [];
      let saleUploadItem = null;
      // let totalAmount = 0;
      // // let costAmount = 0;
      // let saleUploadItemValue = 0;
      if (sku_type) {
        if (sku_type.trim().toUpperCase() === 'BOX') {
          const box = await Box.findOne({ where: {box_name: sku_name} });
          
          if (box) {
            const rate = box.rate ? box.rate : 0;
            const tax_percentage = box.tax_percentage ? box.tax_percentage : 0;
            let sell_rate = 0;
            let discount = 0;

            if (sku_qty > 0) sell_rate = sku_value / sku_qty;
            if (rate > 0)  discount = round(((rate - sell_rate) / rate) * 100, 4);
            sell_rate = round((sell_rate / (100 + tax_percentage)) * 100, 4);
            
            saleUploadItem = {
              type: 'Box',
              item_id: box.id,
              grams: box.grams,
              qty: sku_qty,
              rate: rate,
              tax_percentage: tax_percentage,
              discount: discount,
              tax_type: tax_type,
              sell_rate: sell_rate,
              total_amt: sku_value,
              batch_no: batch_no,
              rowNum: rowNum
            }
            saleUploadItems.push(saleUploadItem);
          } else {
            error.push('Product not found.');
          }
        } else if (sku_type.trim().toUpperCase() === 'BAR') {
          const product = await Product.findOne({ where: {product_name: sku_name} });
          
          if (product) {
            const rate = product.rate ? product.rate : 0;
            const tax_percentage = product.tax_percentage ? product.tax_percentage : 0;
            let sell_rate = 0;
            let discount = 0;

            if (sku_qty > 0) sell_rate = sku_value / sku_qty;
            if (rate > 0)  discount = round(((rate - sell_rate) / rate) * 100, 4);
            sell_rate = round((sell_rate / (100 + tax_percentage)) * 100, 4);
            
            saleUploadItem = {
              type: 'Bar',
              item_id: product.id,
              grams: product.grams,
              qty: sku_qty,
              rate: rate,
              tax_percentage: tax_percentage,
              discount: discount,
              tax_type: tax_type,
              sell_rate: sell_rate,
              total_amt: sku_value,
              batch_no: batch_no,
              rowNum: rowNum
            }
            saleUploadItems.push(saleUploadItem);
          } else {
            error.push('Product not found.');
          }
        } else if (sku_type.trim().toUpperCase() === 'COMBO_BOX') {
          const comboBox = await ComboBox.findOne({ where: {combo_box_name: sku_name}, 
            include: { model: ComboBoxItem, as: 'comboBoxItems', include: ['product', 'box'] } });
          
          if (comboBox) {
            if (comboBox.gst && comboBox.gst.trim().toUpperCase() === 'YES') {
              const rate = comboBox.rate ? comboBox.rate : 0;
              const tax_percentage = comboBox.gst_rate ? comboBox.gst_rate : 0;
              let sell_rate = 0;
              let discount = 0;

              if (sku_qty > 0) sell_rate = sku_value / sku_qty;
              if (rate > 0)  discount = round(((rate - sell_rate) / rate) * 100, 4);
              sell_rate = round((sell_rate / (100 + tax_percentage)) * 100, 4);
              
              saleUploadItem = {
                type: 'Combo Box',
                item_id: comboBox.id,
                combo_box_id: comboBox.id,
                grams: comboBox.grams,
                qty: sku_qty,
                rate: rate,
                tax_percentage: tax_percentage,
                discount: discount,
                tax_type: tax_type,
                sell_rate: sell_rate,
                total_amt: sku_value,
                batch_no: batch_no,
                rowNum: rowNum
              }
              saleUploadItems.push(saleUploadItem);
            } else {
              if (comboBox.comboBoxItems) {
                const comboBoxSaleItems = [];
                let comboBoxAmount = 0;
                let comboBoxDiscount = 0;

                for (const comboBoxItem of comboBox.comboBoxItems) {
                  let item_type = comboBoxItem.type;
                  let item_grams = comboBoxItem.grams;
                  let item_rate = comboBoxItem.rate;
                  let item_tax_percentage = comboBox.gst_rate;
                  let item_qty = comboBoxItem.qty * sku_qty;

                  if (comboBoxItem.type && comboBoxItem.type.trim().toUpperCase() === 'BAR' && comboBoxItem.product) {
                    item_type = 'Bar';
                    item_grams = comboBoxItem.product.grams ? +comboBoxItem.product.grams : 0;
                    item_rate = comboBoxItem.product.rate ? +comboBoxItem.product.rate : 0;
                    item_tax_percentage = comboBoxItem.product.tax_percentage ? +comboBoxItem.product.tax_percentage : 0;
                  } else {
                    item_type = 'Box';
                    item_grams = comboBoxItem.box.grams ? +comboBoxItem.box.grams : 0;
                    item_rate = comboBoxItem.box.rate ? +comboBoxItem.box.rate : 0;
                    item_tax_percentage = comboBoxItem.box.tax_percentage ? +comboBoxItem.box.tax_percentage : 0;
                  }

                  let item_amt = item_qty * item_rate;
                  comboBoxAmount = comboBoxAmount + item_amt;

                  saleUploadItem = {
                    type: item_type,
                    item_id: comboBoxItem.item_id,
                    combo_box_id: comboBox.id,
                    grams: item_grams,
                    qty: item_qty,
                    rate: item_rate,
                    tax_percentage: item_tax_percentage,
                    discount: sku_discount,
                    tax_type: tax_type,
                    sell_rate: item_rate,
                    total_amt: item_amt,
                    rowNum: rowNum
                  }

                  comboBoxSaleItems.push(saleUploadItem);
                }

                if (comboBoxAmount > 0) comboBoxDiscount = round(((comboBoxAmount - sku_value) / comboBoxAmount) * 100, 4);

                for (const comboBoxSaleItem of comboBoxSaleItems) {
                  let sell_rate = round((comboBoxSaleItem.sell_rate - ((comboBoxSaleItem.sell_rate * comboBoxDiscount) / 100)), 4);
                  sell_rate = round((sell_rate / (100 + comboBoxSaleItem.tax_percentage)) * 100, 4);
                  
                  comboBoxSaleItem.discount = comboBoxDiscount;
                  comboBoxSaleItem.sell_rate = sell_rate;
                  comboBoxSaleItem.total_amt = comboBoxSaleItem.qty * sell_rate;

                  saleUploadItems.push(comboBoxSaleItem);
                }
              }
            }
          } else {
            error.push('SKU code not found.');
          }
        } else {
          error.push('Item Type should be Box Or Combo_Box.');
        }
      } else {
        error.push('Item Type should be Box Or Combo_Box.');
      }
      
      // if (uniqueRefNo) {
      //   const saleCount = await Sale.count({ where: {uniqueRefNo: uniqueRefNo, status: { [Op.notIn]: ['Rejected', 'InActive'] }} });
      //   if (saleCount) {
      //     error.push('Track Id already exist.');
      //   } else {
      //     const saleUploadDetailCount = await SaleUploadDetail.count({ where: {uniqueRefNo: uniqueRefNo} });
      //     if (saleUploadDetailCount) {
      //       error.push('Track Id already exist.');
      //     }

      //     const saleUploadDetailFound = saleUploadDetails.find(saleUploadDetailCheck => {
      //       return saleUploadDetailCheck.order_no.trim().toUpperCase() !== order_no.trim().toUpperCase() && 
      //               saleUploadDetailCheck.uniqueRefNo.trim().toUpperCase() === uniqueRefNo.trim().toUpperCase();
      //     });

      //     // console.log(saleUploadDetailFound);
        
      //     if (saleUploadDetailFound) {
      //       error.push(`Track Id already assigned to Order No ${ saleUploadDetailFound.order_no }.`);
      //     }
      //   }
      // }

      // console.log(error);

      // if (!delivery_status) {
      //   error.push('Delivery Status should be Pending, Unshipped, Shipped, Delivered Or Canceled.');
      //   delivery_status = '';
      // } else {
      //   if (delivery_status.trim().toUpperCase() !== 'PENDING' && delivery_status.trim().toUpperCase() !== 'UNSHIPPED' && 
      //       delivery_status.trim().toUpperCase() !== 'SHIPPED' && delivery_status.trim().toUpperCase() !== 'DELIVERED' &&
      //       delivery_status.trim().toUpperCase() !== 'CANCELED') {
      //     error.push('Delivery Status should be Pending, Unshipped, Shipped, Delivered Or Canceled.');
      //     delivery_status = '';
      //   }
      // }

      if (error.length > 0 || errorOrderNos.indexOf(order_no) !== -1) {
        worksheet.getCell(`X${rowNum}`).value = 'Not Uploaded';
        worksheet.getCell(`Y${rowNum}`).value = error.join(' ');

        if (errorOrderNos.indexOf(order_no) === -1) {
          errorOrderNos.push(order_no);
        }

        failCount = failCount + 1;

        continue;
      }

      if (saleUploadDetail) {
        saleUploadDetail.saleUploadItems.push(...saleUploadItems);
        saleUploadDetail.rows.push(rowNum);
        // saleUploadDetail.shipping_charges = saleUploadDetail.shipping_charges + shipping_charges;
        // saleUploadDetail.saleAmount = saleUploadDetail.saleAmount + totalAmount;
        // saleUploadDetail.totalAmount = saleUploadDetail.totalAmount + totalAmount;
        // // saleUploadDetail.costAmount = saleUploadDetail.costAmount + costAmount;

        // if (!totalOrderValue) {
        //   saleUploadDetail.totalOrderValue = saleUploadDetail.totalOrderValue + saleUploadItemValue;
        // }

        saleUploadDetails[saleUploadDetailIndex] = saleUploadDetail;
      } else {
        saleUploadDetail = {
          date_of_processing: saleDate,
          depot_id: depot_id,
          distributor_id: distributor_id,
          distributor_name: distributor_name,
          order_no: order_no,
          // saleAmount: totalAmount,
          client_name: client_name,
          address: address,
          city: city,
          pincode: pincode,
          state: state ? state.state_name : null,
          state_code: state? state.state_code : null,
          country: country ? country.country_name : null,
          mobile_no: mobile_no,
          discount: 0,
          cgst: 1,
          sgst: 1,
          igst: 1,
          reverse_charge: 'no',
          shipping_address: 'yes',
          invoice_date: saleDate,
          // uniqueRefNo: uniqueRefNo,
          tax_type: tax_type,
          saleUploadItems: [...saleUploadItems],
          // totalAmount: totalAmount,
          // costAmount: costAmount,
          // shippingSameAsBilling: false,
          // shipping_charges: shipping_charges,
          due_date: new Date().toISOString(),
          delivery_status: delivery_status,
          despatch_through: despatch_through,
          date_of_dispatch: new Date().toISOString(),
          delivery_date: new Date().toISOString(),
          tracking_id: tracking_id,
          file_id: this.id,
          remarks: remarks,
          basis_of_sales: 'PO Number',
          status: 'Pending',
          invoice_no: '',
          tax_per: 1,
          created_by: req.userData.userId,
          modified_by: req.userData.userId,
          // totalOrderValue: (totalOrderValue) ? totalOrderValue : saleUploadItemValue,
          rows: [rowNum]
        }

        saleUploadDetails.push(saleUploadDetail);
      }

      // console.log(saleUploadDetail);
    }

    // if (failCount > 0) {
    //   await workbook.xlsx.writeFile(error_file_namePath);
    // }
    
    for (const saleUploadDetail of saleUploadDetails) {
      const rows = saleUploadDetail.rows;
      if (errorOrderNos.indexOf(saleUploadDetail.order_no) !== -1) {
        for (let i=0; i < rows.length; i++) {
          worksheet.getCell(`X${rows[i]}`).value = 'Not Uploaded';
        }
        continue;
      }


      // const discountAmount = saleUploadDetail.totalAmount - saleUploadDetail.totalOrderValue;
      // const discount = round((discountAmount / saleUploadDetail.totalAmount) * 100, 2);

      // const discountAmount = 0;
      // const discount = 0;
      
      // saleUploadDetail.discount = discount;


      const saleUploadDetailFinal = new SaleUploadDetail({
        ...saleUploadDetail
      });

      const saleUploadItemsFinal = [];
      for (const item of saleUploadDetail.saleUploadItems) {
        const saleUploadItemFinal = new SaleUploadItem({...item});
        await saleUploadItemFinal.setItemAmount();
        saleUploadItemsFinal.push(saleUploadItemFinal);

        const excel_row_no = item.rowNum;
        const excel_cgst_amt = worksheet.getCell(`P${excel_row_no}`).value;
        const excel_sgst_amt = worksheet.getCell(`Q${excel_row_no}`).value;
        const excel_igst_amt = worksheet.getCell(`R${excel_row_no}`).value;
        const excel_total_amt = worksheet.getCell(`S${excel_row_no}`).value;

        worksheet.getCell(`P${excel_row_no}`).value = excel_cgst_amt + saleUploadItemFinal.cgst_amt;
        worksheet.getCell(`Q${excel_row_no}`).value = excel_sgst_amt + saleUploadItemFinal.sgst_amt;
        worksheet.getCell(`R${excel_row_no}`).value = excel_igst_amt + saleUploadItemFinal.igst_amt;
        worksheet.getCell(`S${excel_row_no}`).value = excel_total_amt + saleUploadItemFinal.total_amt;
      }


      // const saleUploadDetailFinal = new SaleUploadDetail({
      //   saleDate: saleUploadDetail.saleDate,
      //   depot_id: saleUploadDetail.depot_id,
      //   distributor_id: saleUploadDetail.distributor_id,
      //   order_no: saleUploadDetail.order_no,
      //   saleAmount: saleUploadDetail.saleAmount,
      //   roundOffAmount: 0,
      //   invoiceAmount: 0,
      //   client_name: saleUploadDetail.client_name,
      //   address: saleUploadDetail.address,
      //   city: saleUploadDetail.city,
      //   pincode: saleUploadDetail.pincode,
      //   stateId: saleUploadDetail.stateId,
      //   state_name: saleUploadDetail.state_name,
      //   stateCode: saleUploadDetail.stateCode,
      //   countryId: saleUploadDetail.countryId,
      //   countryName: saleUploadDetail.countryName,
      //   mobile_no: saleUploadDetail.mobile_no,
      //   discount: saleUploadDetail.discount,
      //   // uniqueRefNo: saleUploadDetail.uniqueRefNo,
      //   saleStateId: saleUploadDetail.saleStateId,
      //   saleStateName: saleUploadDetail.saleStateName,
      //   saleStateCode: saleUploadDetail.saleStateCode,
      //   tax_type: saleUploadDetail.tax_type,
      //   // saleUploadItems: [],
      //   amount: 0,
      //   cgstAmount: 0,
      //   sgstAmount: 0,
      //   igstAmount: 0,
      //   taxAmount: 0,
      //   totalAmount: 0,
      //   // totalAmount: saleUploadDetail.totalAmount,
      //   // costAmount: saleUploadDetail.costAmount,
      //   shipping_charges: saleUploadDetail.shipping_charges,
      //   shippingSameAsBilling: saleUploadDetail.shippingSameAsBilling,
      //   delivery_status: saleUploadDetail.delivery_status,
      //   despatch_through: saleUploadDetail.despatch_through,
      //   tracking_id: saleUploadDetail.tracking_id,
      //   dispatchDate: saleUploadDetail.dispatchDate,
      //   deliveryDate: saleUploadDetail.deliveryDate,
      //   remarks: saleUploadDetail.remarks,
      //   file_id: saleUploadDetail.file_id,
      //   status: 'Pending',
      //   created_by: req.userData.userId,
      //   modified_by: req.userData.userId
      // });

      // const saleUploadItemsFinal = saleUploadDetail.saleUploadItems.map(saleUploadItem => {
      //   // const mrp = saleUploadItem.mrp ? saleUploadItem.mrp : 0;
      //   // const saleRate = round(mrp - ((mrp * (saleUploadItem.discount ? saleUploadItem.discount : discount)) / 100), 2);

      //   return {
      //     type: saleUploadItem.type,
      //     item_id: saleUploadItem.item_id,
      //     productId: saleUploadItem.productId,
      //     comboBoxId: saleUploadItem.comboBoxId,
      //     grams: saleUploadItem.grams,
      //     quantity: saleUploadItem.quantity,
      //     mrp: saleUploadItem.mrp,
      //     tax_percentage: saleUploadItem.tax_percentage,
      //     costWithoutGst: saleUploadItem.costWithoutGst,
      //     costWithGst: saleUploadItem.costWithGst,
      //     discount: (saleUploadItem.discount ? saleUploadItem.discount : discount),
      //     saleRate: saleUploadItem.saleRate,
      //     asin: saleUploadItem.asin,
      //     product_name: saleUploadItem.product_name
      //   };
      // });
      
      // const saleUploadItemsWithProducts = [];
      // const totalSaleItemProducts = [];
      // // const saleItems = [];

      // for(const item of saleUploadItemsFinal) {
      //   const saleUploadItem = SaleUploadItem.build({
      //     tax_type: saleUploadDetail.tax_type
      //   });
      //   saleUploadItem.getRequestData(item);
  
      //   await saleUploadItem.setItemAmount();
  
      //   // error = await saleUploadItem.validateData();
      //   // if (error) {
      //   //   return res.status(422).json({
      //   //     message: "Invalid inputs passed, please check your data.",
      //   //     error: error
      //   //   });
      //   // }

      //   const saleUploadItemProducts = await saleUploadItem.getProducts();
        
      //   // saleUploadItems.push(saleUploadItem);
      //   saleUploadItemsWithProducts.push({ saleUploadItem, saleUploadItemProducts });
      //   totalSaleItemProducts.push(...saleUploadItemProducts);
      // }
  
      const saleOtherCharges = [];
  
      // saleUploadDetailFinal.setTransactionAmount(saleItems, saleOtherCharges);
      // saleUploadDetailFinal.setTransactionAmount(totalSaleItemProducts, saleOtherCharges);
      saleUploadDetailFinal.setTransactionAmount(saleUploadItemsFinal, saleOtherCharges);
  
      t = await sequelize.transaction();
      
      await saleUploadDetailFinal.save({ transaction: t });

      for (const saleUploadItemFinal of saleUploadItemsFinal) {
        saleUploadItemFinal.distributor_out_id = saleUploadDetailFinal.id;
        await saleUploadItemFinal.save({ transaction: t });
      }
  
      // for(const saleUploadItemsWithProduct of saleUploadItemsWithProducts) {
      //   const saleUploadItem = saleUploadItemsWithProduct.saleUploadItem;
      //   const saleUploadItemProducts = saleUploadItemsWithProduct.saleUploadItemProducts;
  
      //   saleUploadItem.distributor_out_id = saleUploadDetailFinal.id;
      //   await saleUploadItem.save({ transaction: t });
  
      //   for (const saleUploadItemProduct of saleUploadItemProducts) {
      //     saleUploadItemProduct.distributor_out_id = saleUploadDetailFinal.id;
      //     saleUploadItemProduct.saleItemId = saleUploadItem.id;
      //     await saleUploadItemProduct.save({ transaction: t });
      //   }
      // }
  
      // for(const saleItem of saleItems) {
      //   saleItem.distributor_out_id = saleUploadDetailFinal.id;
      //   await saleItem.save({ transaction: t });
      // }
  
      // for(const saleOtherCharge of saleOtherCharges) {
      //   saleOtherCharge.distributor_out_id = saleUploadDetailFinal.id;
      //   await saleOtherCharge.save({ transaction: t });
      // }
  
      await t.commit();

      // saleUploadDetailFinal.saleItems = saleItemsFinal;

      // await saleUploadDetailFinal.setSaleAmountDetails();

      // await saleUploadDetailFinal.save();

      for (let i=0; i < rows.length; i++) {
        // worksheet.getCell(`W${rows[i]}`).value = saleUploadDetail.saleUploadItems[i].amount;
        // worksheet.getCell(`P${rows[i]}`).value = saleUploadDetail.saleUploadItems[i].cgst_amt;
        // worksheet.getCell(`Q${rows[i]}`).value = saleUploadDetail.saleUploadItems[i].sgst_amt;
        // worksheet.getCell(`R${rows[i]}`).value = saleUploadDetail.saleUploadItems[i].igst_amt;
        // worksheet.getCell(`S${rows[i]}`).value = saleUploadDetail.saleUploadItems[i].total_amt;
        worksheet.getCell(`X${rows[i]}`).value = 'Uploaded';
        successCount = successCount + 1;
      }
    }

    // if (successCount > 0) {
      await workbook.xlsx.writeFile(check_file_path);
    // }
    
    if (successCount === 0) {
      this.status = 'Failed';
    } else {
      this.status = 'Pending';
    }
    
    this.remarks = `Records uploaded - ${successCount} . Records failed - ${failCount}.`;
    
    // fileKey = `uploads/sales/${fileName}`;
    // fileUrl = await uploadFileToS3Bucket(filePath, fileKey);
    this.file_name = fileName;
    this.file_path = filePath

    // fileKey = `uploads/sales/${check_file_name}`;
    // fileUrl = await uploadFileToS3Bucket(check_file_path, fileKey);
    this.check_file_name = check_file_name;
    this.check_file_path = check_file_path;

    return null;
  // } catch (error) {
  //   console.log(error);
  //   return error;
  // }
}

SaleUpload.prototype.approve = function(req) {
  try {
    if (this.isDeleted) {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    // this.remarks = req.body.remarks;
    this.approved_by = req.userData.userId;
    this.approved_on = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

SaleUpload.prototype.reject = function(req) {
  try {
    this.status = "Rejected";
    // this.remarks = req.body.remarks;
    this.rejected_by = req.userData.userId;
    this.rejected_on = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

SaleUpload.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.count({ saleUploadName: this.saleUploadName, id: { [Op.ne]: this.id } });
    // if (count > 0) {
    //   return { errors : { saleUploadName: { message: `Two saleUploads cannot share the same saleUploadName (${this.saleUploadName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.count({ asin: this.asin, id: { [Op.ne]: this.id } });
    //   if (count > 0) {
    //     return { errors : { saleUploadName: { message: `Two saleUploads cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.product_name) {
    //   count = await Product.count({ product_name: this.product_name, id: { [Op.ne]: this.id } });
    //   if (count > 0) {
    //     return { errors : { saleUploadName: { message: `Two saleUploads cannot share the same product_name (${this.product_name})` } } }
    //   }
    // }

    // if (this.category) {
    //   count = await Category.count({ id: this.category });
    //   if (count === 0) {
    //     return { errors : { category: { message: `Category does not exist` } } }
    //   }
    // }

    return null;
  } catch (error) {
    return error;
  }
}

export default SaleUpload;
