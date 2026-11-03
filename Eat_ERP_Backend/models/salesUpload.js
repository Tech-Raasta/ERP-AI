import { DataTypes, Op, where } from 'sequelize';
import sequelize from '../lib/database.js';
import State from './state.js';
import Depot from './depot.js';
import Distributor from './distributor.js';
import Product from './product.js';
import Sale from './sale.js';
import { round, getTemplatePath, getReportPath, isValidDate, getUploadPath } from '../lib/common.js';
// const ExcelJS = require('exceljs');
// import {ExcelJS} from 'exceljs/dist/es5/exceljs.browser.js';
import ExcelJS from 'exceljs';
// var fs = require('fs');

import fs from "fs";
import SalesUploadDetail from './salesUploadDetail.js';
import ComboBox from './comboBox.js';

// import * as XLSX from 'xlsx';


// const { uploadFileToS3Bucket } = require('../lib/s3bucket');
// const SalesUploadDetail = require('./salesUploadDetail');
// const { Country } = require("./country");

const SalesUpload = sequelize.define('sales_upload_files', {
  upload_date: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  file_name: {
    type: DataTypes.STRING,
    // required: true
  },
  file_path: {
    type: DataTypes.STRING,
    // required: true
  },
  error_file_path: {
    type: DataTypes.STRING,
    // required: true
  },
  error_file_name: {
    type: DataTypes.STRING,
    // required: true
  },
  check_file_path: {
    type: DataTypes.STRING,
    // required: true
  },
  check_file_name: {
    type: DataTypes.STRING,
    // required: true
  },
  status: {
    type: DataTypes.STRING,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  remarks: {
    type: DataTypes.STRING,
    // required: true
  },
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  refid: DataTypes.INTEGER,
},{ 
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
 },);

SalesUpload.prototype.getRequestData = function(req) {
  try {
    // this.salesUploadDate = (req.body.salesUploadDate) ? req.body.salesUploadDate : '';
    this.upload_date = new Date().toISOString().substring(0, 10);
    // this.upload_date = '';
    // this.checkFile = '';

    // console.log(req.file);

    // signedUrl = await signS3URL(req.file.filename, req.file.mimetype);

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}


SalesUpload.prototype.getUploadFormat = async function() {
  try {
    const template = getTemplatePath() + 'Sales_upload_format.xlsx';

    if (!fs.existsSync(template)) {
      return 'Template not found.';
    }

    // console.log(template);

    // const workbook = new ExcelJS.Workbook();
    // await workbook.xlsx.readFile(template);
    // const worksheet1 = workbook.getWorksheet(1);
    // const worksheet2 = workbook.getWorksheet(2);

    // let row = 2;
    // const depots = await Depot.find({ status: 'Approved' }).select('depotName').sort({ depotName: 1 });
    // for (const depot of depots) {
    //   worksheet2.getCell(`A${ row++ }`).value = depot.depotName;
    // }

    // row = 2;
    // const distributors = await Distributor.find({ status: 'Approved' }).select('distributorName').sort({ distributorName: 1 });
    // for (const distributor of distributors) {
    //   worksheet2.getCell(`C${ row++ }`).value = distributor.distributorName;
    // }

    // row = 2;
    // const states = await State.find({ status: 'Approved' }).select('stateName').sort({ stateName: 1 });
    // for (const state of states) {
    //   worksheet2.getCell(`E${ row++ }`).value = state.stateName;
    // }

    // row = 2;
    // const products = await Product.find({ status: 'Approved' }).select('productName').sort({ productName: 1 });
    // for (const product of products) {
    //   worksheet2.getCell(`G${ row++ }`).value = product.productName;
    // }

    // for (row = 5; row<=110; row++) {
    //   if (depots) {
    //     worksheet1.getCell(`B${ row }`).dataValidation = {
    //       type: 'list',
    //       allowBlank: true,
    //       formulae: ['Sheet2!$A$2:$A$' + (depots.length + 1)]
    //     };
    //   }
    //   if (distributors) {
    //     worksheet1.getCell(`C${ row }`).dataValidation = {
    //       type: 'list',
    //       allowBlank: true,
    //       formulae: ['Sheet2!$C$2:$C$' + (distributors.length + 1)]
    //     };
    //   }
    //   if (states) {
    //     worksheet1.getCell(`H${ row }`).dataValidation = {
    //       type: 'list',
    //       allowBlank: true,
    //       formulae: ['Sheet2!$E$2:$E$' + (states.length + 1)]
    //     };
    //   }
    //   if (products) {
    //     worksheet1.getCell(`K${ row }`).dataValidation = {
    //       type: 'list',
    //       allowBlank: true,
    //       formulae: ['Sheet2!$G$2:$G$' + (products.length + 1)]
    //     };
    //   }
    // }

    // worksheet2.state = 'hidden';

    // // return workbook;

    

    // const fileName = `Sales_upload_format_${Date.now()}.xlsx`;
    // const filePath = getReportPath() + fileName;
    // await workbook.xlsx.writeFile(filePath);

    // const fileKey = `reports/${fileName}`;


    // fs.readFile(filePath, async (err, data) => {
    //   if(err) {
    //     console.log(err);
    //     return err;
    //   }
    //   const result = await uploadFileToS3Bucket(data, fileKey);

    //   console.log(result);
    // });

    // const fileUrl = `https://wyn-erp-resources.s3.ap-south-1.amazonaws.com/${fileKey}`;

    // console.log(fileUrl);

    return fileUrl;
  } catch (error) {
    // console.log(error);
    return error;
  }
}


SalesUpload.prototype.uploadFileData = async function(req) {
  try {
    // console.log('Upload File Data');
    const workbook = new ExcelJS.Workbook();
    const files = req.files ? req.files : null;
    console.log(req.files)
    const filePath = `${getUploadPath()}/sales_upload/${req.files.uploadFile[0].filename}`;
    const checkFile = `Check-${Date.now()}-${this.id}.xlsx`;
    const checkFilePath = `${getUploadPath()}/sales_upload/${checkFile}`;
    const errorFile = `Error-${Date.now()}-${this.id}'.xlsx`;
    const errorFilePath = `${getUploadPath()}/sales_upload/${errorFile}`;
    // console.log(filePath);
    if (files.uploadFile && files.uploadFile.length > 0) {
      this.file_path = (files.uploadFile && files.uploadFile.length > 0) ? files.uploadFile[0].path : this.uploadFile;
    }
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

          this.file_name = req.files.uploadFile[0].filename;
          
          return 'File Format does not match.';
    }

    worksheet.getCell('X4').value = "Status";
    worksheet.getCell('Y4').value = "Error Remark";

    const salesUploadDetails = [];
    const errorOrderNos = [];
    let successCount = 0;
    let failCount = 0;
    const rowsCount = worksheet.rowCount;

    for (let rowNum = 5; rowNum <= rowsCount; rowNum++) {
      // console.log(rowNum);
      const row = worksheet.getRow(rowNum);
      const error = [];
      const saleDate = row.getCell(1).value;
      if (!saleDate) {
        continue;
      }

      const depotName = row.getCell(2).text;
      const distributorName = row.getCell(3).text;
      const name = row.getCell(4).text;
      const address = row.getCell(5).text;
      const city = row.getCell(6).text;
      const pincode = row.getCell(7).text;
      const mobileNo = row.getCell(8).text;
      const PONo = row.getCell(9).text;
      const itemType = row.getCell(10).text;
      const skuName = row.getCell(11).text;
      let quantity = row.getCell(12).text;
      let saleRate = row.getCell(13).text;
      let discount = row.getCell(14).text;
      let totalOrderValue = row.getCell(15).text;
      const batchNo = row.getCell(20).text;
      const uniqueRefNo = row.getCell(21).text;
      const remarks = row.getCell(22).text;

      // console.log(row.getCell(2).text);

      quantity = quantity ? parseFloat(quantity) : 0;
      saleRate = saleRate ? parseFloat(saleRate) : 0;
      discount = discount ? parseFloat(discount) : 0;
      totalOrderValue = totalOrderValue ? parseFloat(totalOrderValue) : 0;


      let salesUploadDetail = null;
      let salesUploadDetailIndex = -1;
      if (orderNo) {
        salesUploadDetailIndex = salesUploadDetails.findIndex(salesUploadDetail => {
          return salesUploadDetail.order_no.trim().toUpperCase() === orderNo.trim().toUpperCase();
        });

        if (salesUploadDetailIndex !== -1) {
          salesUploadDetail = salesUploadDetails[salesUploadDetailIndex];
        }
      }


      if (!isValidDate(saleDate)) {
        error.push('Sell date should be in d-m-Y format.');
      }
      // console.log(depotName);
      // console.log(depotName.result);

      let depot = null;
      let depotState = '';
      if (depotName) {
        const depotObj = await Depot.findOne({ where : { depot_name: depotName } });
        if (depotObj && depotObj.state) {
          depot = depotObj.id.toString();
          depotState = depotObj.state;
        }
      }
      if (!depot) {
        error.push('Depot not found.');
      }

      let distributor = null;
      let distributorState = '';
      let distributorClass = '';
      let saleState = '';
      if (distributorName) {
        const distributorObj = await Distributor.findOne({ where : { distributor_name : distributorName } });
        if (distributorObj && distributorObj.state) {
          distributor = distributorObj.id.toString();
          distributorState = distributorObj.state;
          distributorClass = distributorObj.class;
          saleState = distributorObj.state;
        }
      }
      if (!distributor) {
        error.push('Distributor not found.');
      }

      if (distributorClass.trim().toUpperCase() !== 'DIRECT' && (name || address || city || pincode || stateName || mobileNo)) {
        error.push('Distributor is not direct. Customer name, address, city, pincode, state, mobileNo should be blank.')
      }

      let state = null;
      let country = null;
      if (distributorClass.trim().toUpperCase() === 'DIRECT') {
        if (!name) {
          error.push('Customer Name not found.');
        }
        if (!address) {
          error.push('Customer Address not found.');
        }
        if (!city) {
          error.push('Customer City not found.');
        }
        if (!pincode) {
          error.push('Customer Pincode not found.');
        }

        if (stateName) {
          state = await State.findOne({ where : { state_name: stateName }, include: 'country', attributes: ['id', 'state_name', 'state_code'] })
        }
        if (!state) {
          error.push('Customer State not found.');
        } else {
          distributorState = state.state_name;
          saleState = state;
          country = state.country;
        }
      }

      let taxType = 'Intra';
      if (distributorState === depotState) {
        taxType = "Intra";
      } else {
        taxType = "Inter"
      }

      if (!orderNo) {
        error.push('Order No not found.');
      } else {
        const saleCount = await Sale.countDocuments({ where : { order_no: orderNo, status: { [Op.notIn]: ['Rejected', 'InActive'] } }});
        if (saleCount) {
          error.push('Order No already exist.');
        } else {
          const salesUploadDetailCount = await SalesUploadDetail.countDocuments({where : { order_no: orderNo, status: 'Pending for approval' }});
          if (salesUploadDetailCount) {
            error.push('Order No already pending for approval.');
          }
        }
      }

      if (!quantity || quantity <= 0) {
        error.push('Quantity should be greater than zero.');
        quantity = 0;
      }
      if (!saleRate || saleRate <= 0) {
        // error.push('Sell Rate should be greater than zero.');
        saleRate = 0;
      }
      if (!discount || discount <= 0) {
        // error.push('Discount should be greater than zero.');
        discount = 0;
      }
      if (!totalOrderValue || totalOrderValue <= 0) {
        // error.push('Total Order Value should be greater than zero.');
        totalOrderValue = 0;
      }
      if (saleRate === 0 && discount === 0 && totalOrderValue === 0) {
        error.push('Please enter Sell Rate, Discount % Or Total Realisation Value.');
      }

      if (uniqueRefNo) {
        const saleCount = await Sale.countDocuments({ where : { unique_ref_no: uniqueRefNo, status: { [Op.notIn]: ['Rejected', 'InActive'] } }});
        if (saleCount) {
          error.push('Track Id already exist.');
        } else {
          const salesUploadDetailCount = await SalesUploadDetail.countDocuments({ where : { unique_ref_no: uniqueRefNo }});
          if (salesUploadDetailCount) {
            error.push('Track Id already exist.');
          }

          const salesUploadDetailFound = salesUploadDetails.find(salesUploadDetailCheck => {
            return salesUploadDetailCheck.order_no.trim().toUpperCase() !== orderNo.trim().toUpperCase() &&
              salesUploadDetailCheck.unique_ref_no.trim().toUpperCase() === uniqueRefNo.trim().toUpperCase();
          });

          // console.log(salesUploadDetailFound);

          if (salesUploadDetailFound) {
            error.push(`Track Id already assigned to Order No ${salesUploadDetailFound.order_no}.`);
          }
        }
      }

      console.log(error);

      if (error.length > 0 || errorOrderNos.indexOf(orderNo) !== -1) {
        worksheet.getCell(`V${rowNum}`).value = 'Not Uploaded';
        worksheet.getCell(`W${rowNum}`).value = error.join(' ');

        if (errorOrderNos.indexOf(orderNo) === -1) {
          errorOrderNos.push(orderNo);
        }

        failCount = failCount + 1;

        continue;
      }

      if (!itemType) {
        error.push('Item Type should be Box Or Combo_Box.');
        itemType = '';
      } else {
        if (itemType.trim().toUpperCase() !== 'BOX' && itemType.trim().toUpperCase() !== 'COMBO_BOX' ) {
          error.push('Item Type should be Box Or Combo_Box.');
          itemType = '';
        }
      }
      if (!quantity || quantity <= 0) {
        error.push('Quantity should be greater than zero.');
        quantity = 0;
      }
      if (!saleRate || saleRate <= 0) {
        error.push('Sale Rate should be greater than zero.');
        saleRate = 0;
      }
      // if (!discount || discount <= 0) {
      //   // error.push('Discount should be greater than zero.');
      //   discount = 0;
      // }
      // if (!totalOrderValue || totalOrderValue <= 0) {
      //   // error.push('Total Order Value should be greater than zero.');
      //   totalOrderValue = 0;
      // }
      // if (saleRate === 0 && discount === 0 && totalOrderValue === 0) {
      //   error.push('Please enter Sale Rate, Discount % Or Total Realisation Value.');
      // }

      let saleUploadItem = null;
      // let totalAmount = 0;
      // // let costAmount = 0;
      // let saleUploadItemValue = 0;
      if (itemType) {
        if (itemType.trim().toUpperCase() === 'BOX') {
          // const product = await Product.findOne({ where: {shortName: shortName} });
          const product = await Product.findOne({ where: {product_name: skuName} });
          
          if (product) {
            // const mrp = product.mrp ? parseFloat(product.mrp) : 0;
            // totalAmount = quantity * mrp;
            
            // if (!totalOrderValue) {
            //   if (discount) {
            //     saleRate = round(mrp - ((mrp * discount) / 100), 2);
            //     // saleRate = round((saleRate / (100 + product.taxPercentage)) * 100, 2); // will be calculated in sale
            //   } 

            //   saleUploadItemValue = quantity * saleRate;
            // }
            

            saleUploadItem = {
              itemType: 'Box',
              itemId: product.id,
              productId: product.id,
              comboBoxId: 0,
              itemName: product.product_name,
              shortName: product.short_name,
              categoryId: product.category_id,
              hsnCode: product.hsn_code,
              hsnName: product.hsn_name,
              grams: product.grams,
              quantity: quantity,
              mrp: product.rate,
              taxPercentage: product.tax_percentage,
              discount: discount,
              saleRate: saleRate,
              rowNum: rowNum
            }
          } else {
            error.push('SKU code not found.');
          }
        } else if (itemType.trim().toUpperCase() === 'COMBO_BOX') {
          // const comboBox = await ComboBox.findOne({ where: {shortName: shortName} });
          const comboBox = await ComboBox.findOne({ where: {combo_box_name: skuName} });
          
          if (comboBox) {
            // const mrp = comboBox.mrp ? parseFloat(comboBox.mrp) : 0;
            // totalAmount = quantity * mrp;
            
            // if (!totalOrderValue) {
            //   if (discount) {
            //     saleRate = round(mrp - ((mrp * discount) / 100), 2);
            //     // saleRate = round((saleRate / (100 + comboBox.taxPercentage)) * 100, 2); // will be calculated in sale
            //   } 

            //   saleUploadItemValue = quantity * saleRate;
            // }
            
            saleUploadItem = {
              itemType: 'Combo Box',
              itemId: comboBox.id,
              productId: 0,
              comboBoxId: comboBox.id,
              itemName: comboBox.combo_box_name,
              shortName: comboBox.short_name,
              categoryId: comboBox.category_id,
              hsnCode: comboBox.hsnCode,
              // hsnName: comboBox.hsnName,
              grams: comboBox.grams,
              quantity: quantity,
              mrp: comboBox.rate,
              taxPercentage: comboBox.tax_percentage,
              discount: discount,
              saleRate: saleRate,
              // totalAmount: totalAmount,
              costWithoutGst: comboBox.cost,
              costWithGst: comboBox.gst_cost,
              asin: comboBox.asin,
              skuCode: comboBox.sku_code,
              rowNum: rowNum
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
      //     const salesUploadDetailCount = await SalesUploadDetail.count({ where: {uniqueRefNo: uniqueRefNo} });
      //     if (salesUploadDetailCount) {
      //       error.push('Track Id already exist.');
      //     }

      //     const salesUploadDetailFound = salesUploadDetails.find(salesUploadDetailCheck => {
      //       return salesUploadDetailCheck.orderNo.trim().toUpperCase() !== orderNo.trim().toUpperCase() && 
      //               salesUploadDetailCheck.uniqueRefNo.trim().toUpperCase() === uniqueRefNo.trim().toUpperCase();
      //     });

      //     // console.log(salesUploadDetailFound);
        
      //     if (salesUploadDetailFound) {
      //       error.push(`Track Id already assigned to Order No ${ salesUploadDetailFound.orderNo }.`);
      //     }
      //   }
      // }

      // console.log(error);

      if (!deliveryStatus) {
        error.push('Delivery Status should be Pending, Unshipped, Shipped, Delivered Or Canceled.');
        deliveryStatus = '';
      } else {
        if (deliveryStatus.trim().toUpperCase() !== 'PENDING' && deliveryStatus.trim().toUpperCase() !== 'UNSHIPPED' && 
            deliveryStatus.trim().toUpperCase() !== 'SHIPPED' && deliveryStatus.trim().toUpperCase() !== 'DELIVERED' &&
            deliveryStatus.trim().toUpperCase() !== 'CANCELED') {
          error.push('Delivery Status should be Pending, Unshipped, Shipped, Delivered Or Canceled.');
          deliveryStatus = '';
        }
      }

      if (error.length > 0 || errorOrderNos.indexOf(orderNo) !== -1) {
        worksheet.getCell(`AB${rowNum}`).value = 'Not Uploaded';
        worksheet.getCell(`AC${rowNum}`).value = error.join(' ');

        if (errorOrderNos.indexOf(orderNo) === -1) {
          errorOrderNos.push(orderNo);
        }

        failCount = failCount + 1;

        continue;
      }

      if (salesUploadDetail) {
        salesUploadDetail.saleUploadItems.push(saleUploadItem);
        salesUploadDetail.rows.push(rowNum);
        salesUploadDetail.shippingCharges = salesUploadDetail.shippingCharges + shippingCharges;
        // salesUploadDetail.saleAmount = salesUploadDetail.saleAmount + totalAmount;
        // salesUploadDetail.totalAmount = salesUploadDetail.totalAmount + totalAmount;
        // // salesUploadDetail.costAmount = salesUploadDetail.costAmount + costAmount;

        // if (!totalOrderValue) {
        //   salesUploadDetail.totalOrderValue = salesUploadDetail.totalOrderValue + saleUploadItemValue;
        // }

        salesUploadDetails[salesUploadDetailIndex] = salesUploadDetail;
      } else {
        salesUploadDetail = {
          saleDate: saleDate,
          distributorName: distributorName,
          orderNo: orderNo,
          // saleAmount: totalAmount,
          name: name,
          address: address,
          city: city,
          pincode: pincode,
          stateId: state ? state.stateId : null,
          stateName: state ? state.stateName : null,
          stateCode: state ? state.stateCode : null,
          countryId: country ? country.countryId : null,
          countryName: country ? country.countryName : null,
          mobileNo: mobileNo,
          discount: discount,
          // uniqueRefNo: uniqueRefNo,
          saleStateId: saleState.id,
          saleStateName: saleState.stateName,
          saleStateCode: saleState.stateCode,
          taxType: taxType,
          saleUploadItems: [saleUploadItem],
          // totalAmount: totalAmount,
          // costAmount: costAmount,
          shippingSameAsBilling: false,
          shippingCharges: shippingCharges,
          dueDate: shipmentDueDate,
          deliveryStatus: deliveryStatus,
          dispatchThrough: dispatchThrough,
          awbNo: awbNo,
          dispatchDate: dispatchDate,
          deliveryDate: deliveryDate,
          saleUploadId: this.id,
          remarks: remarks,
          // totalOrderValue: (totalOrderValue) ? totalOrderValue : saleUploadItemValue,
          rows: [rowNum]
        }

        salesUploadDetails.push(salesUploadDetail);
      }

      // console.log(salesUploadDetail);
    }

    // if (failCount > 0) {
    //   await workbook.xlsx.writeFile(errorFilePath);
    // }
    
    for (const salesUploadDetail of salesUploadDetails) {
      const rows = salesUploadDetail.rows;
      if (errorOrderNos.indexOf(salesUploadDetail.orderNo) !== -1) {
        for (let i=0; i < rows.length; i++) {
          worksheet.getCell(`AB${rows[i]}`).value = 'Not Uploaded';
        }
        continue;
      }


      // const discountAmount = salesUploadDetail.totalAmount - salesUploadDetail.totalOrderValue;
      // const discount = round((discountAmount / salesUploadDetail.totalAmount) * 100, 2);

      // const discountAmount = 0;
      const discount = 0;
      
      // salesUploadDetail.discount = discount;

      const salesUploadDetailFinal = new SalesUploadDetail({
        saleDate: salesUploadDetail.date_of_processing,
        depotId: salesUploadDetail.depot_id,
        distributorId: salesUploadDetail.distributor_id,
        orderNo: salesUploadDetail.order_no,
        saleAmount: salesUploadDetail.amount,
        roundOffAmount: 0,
        invoiceAmount: 0,
        name: salesUploadDetail.name,
        address: salesUploadDetail.address,
        city: salesUploadDetail.city,
        pincode: salesUploadDetail.pincode,
        stateName: salesUploadDetail.state,
        stateCode: salesUploadDetail.state_code,
        countryName: salesUploadDetail.country,
        mobileNo: salesUploadDetail.mobile_no,
        discount: salesUploadDetail.discount,
        // uniqueRefNo: salesUploadDetail.uniqueRefNo,
        // saleStateId: salesUploadDetail.saleStateId,
        // saleStateName: salesUploadDetail.saleStateName,
        // saleStateCode: salesUploadDetail.saleStateCode,
        taxType: salesUploadDetail.taxType,
        // saleUploadItems: [],
        amount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        // totalAmount: salesUploadDetail.totalAmount,
        // costAmount: salesUploadDetail.costAmount,
        shippingCharges: salesUploadDetail.shippingCharges,
        shippingSameAsBilling: salesUploadDetail.shippingSameAsBilling,
        deliveryStatus: salesUploadDetail.deliveryStatus,
        dispatchThrough: salesUploadDetail.dispatchThrough,
        awbNo: salesUploadDetail.awbNo,
        dispatchDate: salesUploadDetail.dispatchDate,
        deliveryDate: salesUploadDetail.deliveryDate,
        remarks: salesUploadDetail.remarks,
        saleUploadId: salesUploadDetail.saleUploadId,
        status: 'Pending',
        createdBy: req.userData.userId,
        updatedBy: req.userData.userId
      });

      const saleUploadItemsFinal = salesUploadDetail.saleUploadItems.map(saleUploadItem => {
        // const mrp = saleUploadItem.mrp ? saleUploadItem.mrp : 0;
        // const saleRate = round(mrp - ((mrp * (saleUploadItem.discount ? saleUploadItem.discount : discount)) / 100), 2);

        return {
          itemType: saleUploadItem.itemType,
          itemId: saleUploadItem.itemId,
          productId: saleUploadItem.productId,
          comboBoxId: saleUploadItem.comboBoxId,
          grams: saleUploadItem.grams,
          quantity: saleUploadItem.quantity,
          mrp: saleUploadItem.mrp,
          taxPercentage: saleUploadItem.taxPercentage,
          costWithoutGst: saleUploadItem.costWithoutGst,
          costWithGst: saleUploadItem.costWithGst,
          discount: (saleUploadItem.discount ? saleUploadItem.discount : discount),
          saleRate: saleUploadItem.saleRate,
          asin: saleUploadItem.asin,
          skuCode: saleUploadItem.skuCode
        };
      });
      
      const saleUploadItemsWithProducts = [];
      const totalSaleItemProducts = [];
      // const saleItems = [];

      for(const item of saleUploadItemsFinal) {
        const saleUploadItem = SaleUploadItem.build({
          taxType: salesUploadDetail.taxType
        });
        saleUploadItem.getRequestData(item);
  
        await saleUploadItem.setItemAmount();
  
        // error = await saleUploadItem.validateData();
        // if (error) {
        //   return res.status(422).json({
        //     message: "Invalid inputs passed, please check your data.",
        //     error: error
        //   });
        // }

        const saleUploadItemProducts = await saleUploadItem.getProducts();
        
        // saleUploadItems.push(saleUploadItem);
        saleUploadItemsWithProducts.push({ saleUploadItem, saleUploadItemProducts });
        totalSaleItemProducts.push(...saleUploadItemProducts);
      }
  
      const saleOtherCharges = [];
  
      // salesUploadDetailFinal.setTransactionAmount(saleItems, saleOtherCharges);
      salesUploadDetailFinal.setTransactionAmount(totalSaleItemProducts, saleOtherCharges);
  
      t = await sequelize.transaction();
      
      await salesUploadDetailFinal.save({ transaction: t });
  
      for(const saleUploadItemsWithProduct of saleUploadItemsWithProducts) {
        const saleUploadItem = saleUploadItemsWithProduct.saleUploadItem;
        const saleUploadItemProducts = saleUploadItemsWithProduct.saleUploadItemProducts;
  
        saleUploadItem.saleId = salesUploadDetailFinal.id;
        await saleUploadItem.save({ transaction: t });
  
        for (const saleUploadItemProduct of saleUploadItemProducts) {
          saleUploadItemProduct.saleId = salesUploadDetailFinal.id;
          saleUploadItemProduct.saleItemId = saleUploadItem.id;
          await saleUploadItemProduct.save({ transaction: t });
        }
      }
  
      // for(const saleItem of saleItems) {
      //   saleItem.saleId = salesUploadDetailFinal.id;
      //   await saleItem.save({ transaction: t });
      // }
  
      // for(const saleOtherCharge of saleOtherCharges) {
      //   saleOtherCharge.saleId = salesUploadDetailFinal.id;
      //   await saleOtherCharge.save({ transaction: t });
      // }
  
      await t.commit();

      // salesUploadDetailFinal.saleItems = saleItemsFinal;

      // await salesUploadDetailFinal.setSaleAmountDetails();

      // await salesUploadDetailFinal.save();

      for (let i=0; i < rows.length; i++) {
        worksheet.getCell(`W${rows[i]}`).value = salesUploadDetail.saleUploadItems[i].amount;
        worksheet.getCell(`X${rows[i]}`).value = salesUploadDetail.saleUploadItems[i].cgstAmount;
        worksheet.getCell(`Y${rows[i]}`).value = salesUploadDetail.saleUploadItems[i].sgstAmount;
        worksheet.getCell(`Z${rows[i]}`).value = salesUploadDetail.saleUploadItems[i].igstAmount;
        worksheet.getCell(`AA${rows[i]}`).value = salesUploadDetail.saleUploadItems[i].totalAmount;
        worksheet.getCell(`AB${rows[i]}`).value = 'Uploaded';
        successCount = successCount + 1;
      }
    }

    // if (successCount > 0) {
      await workbook.xlsx.writeFile(checkFilePath);
    // }
    
    if (successCount === 0) {
      this.status = 'Failed';
    } else {
      this.status = 'Pending for approval';
    }
    
    this.remarks = `Records uploaded - ${successCount} . Records failed - ${failCount}.`;
    
    this.file_name = req.files.uploadFile[0].filename;
    this.check_file_name = checkFile;

    return null;
  } catch (error) {
    console.log(error);
    return error;
  }
}

SalesUpload.prototype.approve = function(req) {
  try {
    if (this.isDeleted) {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    // this.remarks = req.body.remarks;
    this.approvedBy = req.userData.userId;
    this.approvedAt = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

SalesUpload.prototype.reject = function(req) {
  try {
    this.status = "Rejected";
    // this.remarks = req.body.remarks;
    this.rejectedBy = req.userData.userId;
    this.rejectedAt = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

SalesUpload.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ salesUploadName: this.salesUploadName, id: { $ne: this.id } });
    // if (count > 0) {
    //   return { errors : { salesUploadName: { message: `Two salesUploads cannot share the same salesUploadName (${this.salesUploadName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, id: { $ne: this.id } });
    //   if (count > 0) {
    //     return { errors : { salesUploadName: { message: `Two salesUploads cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, id: { $ne: this.id } });
    //   if (count > 0) {
    //     return { errors : { salesUploadName: { message: `Two salesUploads cannot share the same skuCode (${this.skuCode})` } } }
    //   }
    // }

    // if (this.category) {
    //   count = await Category.countDocuments({ id: this.category });
    //   if (count === 0) {
    //     return { errors : { category: { message: `Category does not exist` } } }
    //   }
    // }

    return null;
  } catch (error) {
    return error;
  }
}

export default SalesUpload;
