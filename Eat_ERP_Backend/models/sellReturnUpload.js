var fs = require('fs');

const { Schema, model } = require("mongoose");
const ExcelJS = require('exceljs');

const { uploadFileToS3Bucket } = require('../lib/s3bucket');
const { round, getUploadPath, getTemplatePath, getReportPath, isValidDate } = require('../lib/common');

const { State } = require("./state");
const Depot = require("./depot");
const Distributor = require("./distributor");
const Product = require("./product");
const Sell = require('./sell');
const SellReturn = require('./sellReturn');
const SellReturnUploadDetail = require('./sellReturnUploadDetail');

const sellReturnUploadSchema = Schema({
  sellReturnUploadDate: {
    type: Date,
    required: true
  },
  uploadedFile: {
    type: String,
    // required: true
  },
  errorFile: {
    type: String,
    // required: true
  },
  checkFile: {
    type: String,
    // required: true
  },
  isFreezed: {
    type: Boolean,
    default: false
  },
  remarks: {
    type: String,
    // required: true
  },
  status: {
    type: String,
    required: true
  },
  isDeleted: {
    type: Boolean
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  refId: {
    type: Schema.Types.ObjectId,
    ref: 'SellReturnUpload'
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

sellReturnUploadSchema.methods.getRequestData = function (req) {
  try {
    this.sellReturnUploadDate = new Date().toISOString().substring(0, 10);
    this.uploadedFile = '';
    this.checkFile = '';

    return null;
  } catch (error) {
    return error;
  }
}

sellReturnUploadSchema.statics.getUploadFormat = async function () {
  try {
    const template = getTemplatePath() + 'Sell_returns_upload_format.xlsx';

    if (!fs.existsSync(template)) {
      return 'Template not found.';
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(template);
    const worksheet1 = workbook.getWorksheet(1);
    const worksheet2 = workbook.getWorksheet(2);

    let row = 2;
    const depots = await Depot.find({ status: 'Approved' }).select('depotName').sort({ depotName: 1 });
    for (const depot of depots) {
      worksheet2.getCell(`A${row++}`).value = depot.depotName;
    }

    row = 2;
    const distributors = await Distributor.find({ status: 'Approved' }).select('distributorName').sort({ distributorName: 1 });
    for (const distributor of distributors) {
      worksheet2.getCell(`C${row++}`).value = distributor.distributorName;
    }

    row = 2;
    const products = await Product.find({ status: 'Approved' }).select('productName').sort({ productName: 1 });
    for (const product of products) {
      worksheet2.getCell(`E${row++}`).value = product.productName;
    }

    for (row = 5; row <= 110; row++) {
      if (depots) {
        worksheet1.getCell(`B${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$A$2:$A$' + (depots.length + 1)]
        };
      }
      if (distributors) {
        worksheet1.getCell(`C${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$C$2:$C$' + (distributors.length + 1)]
        };
      }
      if (products) {
        worksheet1.getCell(`F${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$E$2:$E$' + (products.length + 1)]
        };
      }

      worksheet1.getCell(`K${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Sheet2!$G$2:$G$3']
      };
    }

    worksheet2.state = 'hidden';

    const fileName = `Sell_returns_upload_format_${Date.now()}.xlsx`;
    const filePath = getReportPath() + fileName;
    await workbook.xlsx.writeFile(filePath);

    const fileKey = `reports/${fileName}`;
    const fileUrl = await uploadFileToS3Bucket(filePath, fileKey);

    return fileUrl;
  } catch (error) {
    return error;
  }
}

sellReturnUploadSchema.methods.uploadFileData = async function (req) {
  try {
    const workbook = new ExcelJS.Workbook();
    const filePath = `${getUploadPath()}/${req.file.filename}`;
    const checkFile = `Check-${Date.now()}-${this._id}.xlsx`;
    const checkFilePath = `${getUploadPath()}/${checkFile}`;

    let fileKey = '';
    let fileUrl = '';

    if (!fs.existsSync(filePath)) {
      this.remarks = 'File No Found.';
      this.status = 'Failed';
      return 'File not found.';
    }

    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);

    if (worksheet.getCell('A4').value.trim().toUpperCase() !== 'SELL RETURN DATE' ||
      worksheet.getCell('B4').value.trim().toUpperCase() !== 'DEPOT' ||
      worksheet.getCell('C4').value.trim().toUpperCase() !== 'DISTRIBUTOR NAME' ||
      worksheet.getCell('D4').value.trim().toUpperCase() !== 'PO NO' ||
      worksheet.getCell('E4').value.trim().toUpperCase() !== 'INVOICE NO' ||
      worksheet.getCell('F4').value.trim().toUpperCase() !== 'SKU NAME' ||
      worksheet.getCell('G4').value.trim().toUpperCase() !== 'QTY' ||
      worksheet.getCell('H4').value.trim().toUpperCase() !== 'SELL RATE' ||
      worksheet.getCell('I4').value.trim().toUpperCase() !== 'DISCOUNT %' ||
      worksheet.getCell('J4').value.trim().toUpperCase() !== 'TOTAL REALISATION VALUE' ||
      worksheet.getCell('K4').value.trim().toUpperCase() !== 'IS EXPIRED' ||
      worksheet.getCell('L4').value.trim().toUpperCase() !== 'REMARKS') {
      this.remarks = 'File Format does not match.';
      this.status = 'Failed';

      fileKey = `uploads/sellReturns/${req.file.filename}`;
      fileUrl = await uploadFileToS3Bucket(filePath, fileKey);
      this.uploadedFile = req.file.filename;

      return 'File Format does not match.';
    }

    worksheet.getCell('Q4').value = "Status";
    worksheet.getCell('R4').value = "Error Remark";

    const sellReturnUploadDetails = [];
    const errorOrderNos = [];
    let successCount = 0;
    let failCount = 0;
    const rowsCount = worksheet.rowCount;

    for (let rowNum = 5; rowNum <= rowsCount; rowNum++) {
      // console.log(rowNum);
      const error = [];
      const sellReturnDate = worksheet.getCell(`A${rowNum}`).value;
      const depotName = worksheet.getCell(`B${rowNum}`).text.trim();
      const distributorName = worksheet.getCell(`C${rowNum}`).text.trim();
      let orderNo = worksheet.getCell(`D${rowNum}`).text.trim();
      let invoiceNo = worksheet.getCell(`E${rowNum}`).text.trim();
      const productName = worksheet.getCell(`F${rowNum}`).text.trim();
      let quantity = worksheet.getCell(`G${rowNum}`).text.trim();
      let sellRate = worksheet.getCell(`H${rowNum}`).text.trim();
      let discount = worksheet.getCell(`I${rowNum}`).text.trim();
      let totalOrderValue = worksheet.getCell(`J${rowNum}`).text.trim();
      const isExpired = worksheet.getCell(`K${rowNum}`).text.trim();
      const remarks = worksheet.getCell(`L${rowNum}`).text;

      if (!sellReturnDate) {
        continue;
      }

      quantity = quantity ? parseFloat(quantity) : 0;
      sellRate = sellRate ? parseFloat(sellRate) : 0;
      discount = discount ? parseFloat(discount) : 0;
      totalOrderValue = totalOrderValue ? parseFloat(totalOrderValue) : 0;

      if (!isValidDate(sellReturnDate)) {
        error.push('SellReturn date should be in d-m-Y format.');
      }

      let depot = null;
      let depotState = '';
      if (depotName) {
        const depotObj = await Depot.findOne({ depotName }).lean();
        if (depotObj && depotObj.state && depotObj.state.stateName) {
          depot = depotObj._id.toString();
          depotState = depotObj.state.stateName;
        }
      }
      if (!depot) {
        error.push('Depot not found.');
      }

      if (!orderNo && !invoiceNo && !productName) {
        error.push('PO no, Invoice no or Sku details required.');
      }

      let sellType = 'Invoice';
      let sellId = null;
      let distributor = null;
      let distributorState = '';
      let sellReturnState = '';
      let taxType = 'Intra';
      let sellReturnItems = [];

      let totalAmount = 0;
      let costAmount = 0;
      let shippingCharges = 0;
      let sellReturnItemValue = 0;
      // let sellReturnTotalAmount = 0;

      if (productName) {
        if (distributorName) {
          const distributorObj = await Distributor.findOne({ distributorName }).lean();
          if (distributorObj && distributorObj.state && distributorObj.state.stateName) {
            distributor = distributorObj._id.toString();
            distributorState = distributorObj.state.stateName;
            sellReturnState = distributorObj.state;
          }
        }
        if (!distributor) {
          error.push('Distributor not found.');
        }

        if (distributorState === depotState) {
          taxType = "Intra";
        } else {
          taxType = "Inter"
        }

        if (!quantity || quantity <= 0) {
          error.push('Quantity should be greater than zero.');
          quantity = 0;
        }
        if (!sellRate || sellRate <= 0) {
          // error.push('SellReturn Rate should be greater than zero.');
          sellRate = 0;
        }
        if (!discount || discount <= 0) {
          // error.push('Discount should be greater than zero.');
          discount = 0;
        }
        if (!totalOrderValue || totalOrderValue <= 0) {
          // error.push('Total Order Value should be greater than zero.');
          totalOrderValue = 0;
        }
        if (sellRate === 0 && discount === 0 && totalOrderValue === 0) {
          error.push('Please enter SellReturn Rate, Discount % Or Total Realisation Value.');
        }

        if (productName) {
          const product = await Product.findOne({ productName }).lean();

          if (product) {
            totalAmount = quantity * product.mrp;
            costAmount = quantity * product.costWithoutGst;

            if (!totalOrderValue) {
              if (discount) {
                sellRate = round(product.mrp - ((product.mrp * discount) / 100), 2);
                // sellRate = round((sellRate / (100 + product.taxPercentage)) * 100, 2); // will be calculated in sell
              }

              sellReturnItemValue = quantity * sellRate;
            }

            const sellReturnItem = {
              productId: product._id,
              productName: product.productName,
              description: product.description,
              hsnCode: product.hsnCode,
              hsnName: product.hsnName,
              grams: product.grams,
              quantity: quantity,
              mrp: product.mrp,
              taxPercentage: product.taxPercentage,
              sellRate: sellRate,
              totalAmount: totalAmount,
              costWithoutGst: product.costWithoutGst,
              costAmount: costAmount,
              rowNum: rowNum
            }

            sellReturnItems.push(sellReturnItem);
            sellType = 'Adhoc';
          } else {
            error.push('SKU not found.');
          }
        }
      } else {
        let sell = null;
        if (invoiceNo) {
          sell = await Sell.findOne({ invoiceNo: invoiceNo }).lean();

          if (!sell) {
            error.push(`Invoice no ${invoiceNo} details not found.`);
          }
        } else if (orderNo) {
          sell = await Sell.findOne({ orderNo: orderNo }).lean();

          if (!sell) {
            error.push(`Order no ${orderNo} details not found.`);
          }
        }

        if (sell) {
          sellId = sell._id;
          sellType = 'Invoice';
          orderNo = sell.orderNo;
          invoiceNo = sell.invoiceNo;
          distributor = sell.distributor;
          discount = sell.discount;
          sellReturnState = sell.sellState;
          taxType = sell.taxType;
          sellReturnItems = sell.sellItems.map(sellItem => {
            return {
              rowNum: rowNum,
              ...sellItem
            };
          });

          costAmount = sell.costAmount;
          shippingCharges = sell.shippingCharges;
          totalOrderValue = sell.invoiceAmount;
          sellReturnItemValue = sell.totalAmount;

          totalAmount = 0;

          totalAmount = sell.sellItems.reduce((totalAmount, sellItem) => {
            return totalAmount + (sellItem.quantity * sellItem.mrp);
          }, 0);
        }
      }

      if (!orderNo) {
        error.push('Order No not found.');
      } else {
        const sellReturnCount = await SellReturn.countDocuments({ orderNo: orderNo, status: { $nin: ['Rejected', 'InActive'] } });
        if (sellReturnCount) {
          error.push('Order No already exist.');
        } else {
          const sellReturnUploadDetailCount = await SellReturnUploadDetail.countDocuments({ orderNo: orderNo, status: 'Pending for approval' });
          if (sellReturnUploadDetailCount) {
            error.push('Order No already exist.');
          }
        }
      }

      // console.log(error);

      if (error.length > 0 || errorOrderNos.indexOf(orderNo) !== -1) {
        worksheet.getCell(`Q${rowNum}`).value = 'Not Uploaded';
        worksheet.getCell(`R${rowNum}`).value = error.join(' ');

        if (errorOrderNos.indexOf(orderNo) === -1) {
          errorOrderNos.push(orderNo);
        }

        failCount = failCount + 1;

        continue;
      }

      let sellReturnUploadDetail = null;
      let sellReturnUploadDetailIndex = -1;
      if (orderNo) {
        sellReturnUploadDetailIndex = sellReturnUploadDetails.findIndex(sellReturnUploadDetail => {
          // return sellReturnUploadDetail.sellReturnDate === sellReturnDate && 
          //         sellReturnUploadDetail.depot.toString().trim().toUpperCase() === depot.toString().trim().toUpperCase() && 
          //         sellReturnUploadDetail.distributor.toString().trim().toUpperCase() === distributor.toString().trim().toUpperCase() && 
          //         sellReturnUploadDetail.orderNo.trim().toUpperCase() === orderNo.trim().toUpperCase() && 
          //         sellReturnUploadDetail.invoiceNo.trim().toUpperCase() === invoiceNo.trim().toUpperCase();

          return sellReturnUploadDetail.orderNo.trim().toUpperCase() === orderNo.trim().toUpperCase();
        });

        if (sellReturnUploadDetailIndex !== -1) {
          sellReturnUploadDetail = sellReturnUploadDetails[sellReturnUploadDetailIndex];
        }
      }

      if (sellReturnUploadDetail) {
        sellReturnUploadDetail.sellReturnItems = sellReturnUploadDetail.sellReturnItems.concat(sellReturnItems);
        sellReturnUploadDetail.rows.push(rowNum);
        sellReturnUploadDetail.sellReturnAmount = sellReturnUploadDetail.sellReturnAmount + totalAmount;
        sellReturnUploadDetail.totalAmount = sellReturnUploadDetail.totalAmount + totalAmount;
        sellReturnUploadDetail.costAmount = sellReturnUploadDetail.costAmount + costAmount;

        // --------- totalOrderValue is Total Invoice Value ------------
        if (!totalOrderValue) {
          sellReturnUploadDetail.totalOrderValue = sellReturnUploadDetail.totalOrderValue + sellReturnItemValue;
        }

        sellReturnUploadDetails[sellReturnUploadDetailIndex] = sellReturnUploadDetail;
      } else {
        sellReturnUploadDetail = {
          sellReturnDate: sellReturnDate,
          depot: depot,
          distributor: distributor,
          sellType: sellType,
          orderNo: orderNo,
          invoiceNo: invoiceNo,
          sell: sellId,
          isExpired: (isExpired) ? true : false,
          sellReturnAmount: totalAmount,
          discount: discount,
          sellReturnState: sellReturnState,
          taxType: taxType,
          sellReturnItems: sellReturnItems,
          totalAmount: totalAmount,
          costAmount: costAmount,
          shippingCharges: shippingCharges,
          sellReturnUpload: this._id,
          remarks: remarks,
          totalOrderValue: (totalOrderValue) ? totalOrderValue : sellReturnItemValue,
          rows: [rowNum]
        }

        sellReturnUploadDetails.push(sellReturnUploadDetail);
      }

      // console.log(sellReturnUploadDetail);
    }

    // if (failCount > 0) {
    //   await workbook.xlsx.writeFile(errorFilePath);
    // }

    // console.log(sellReturnUploadDetails);

    for (const sellReturnUploadDetail of sellReturnUploadDetails) {
      const rows = sellReturnUploadDetail.rows;
      if (errorOrderNos.indexOf(sellReturnUploadDetail.orderNo) !== -1) {
        for (let i = 0; i < rows.length; i++) {
          worksheet.getCell(`Q${rows[i]}`).value = 'Not Uploaded';
        }
        continue;
      }

      const discountAmount = sellReturnUploadDetail.totalAmount -
        sellReturnUploadDetail.totalOrderValue +
        sellReturnUploadDetail.shippingCharges;
      sellReturnUploadDetail.discount = round((discountAmount / sellReturnUploadDetail.totalAmount) * 100, 2);

      const sellReturnUploadDetailFinal = new SellReturnUploadDetail({
        sellReturnDate: sellReturnUploadDetail.sellReturnDate,
        depot: sellReturnUploadDetail.depot,
        distributor: sellReturnUploadDetail.distributor,
        sellType: sellReturnUploadDetail.sellType,
        orderNo: sellReturnUploadDetail.orderNo,
        invoiceNo: sellReturnUploadDetail.invoiceNo,
        sell: sellReturnUploadDetail.sell,
        isExpired: sellReturnUploadDetail.isExpired,
        sellReturnAmount: sellReturnUploadDetail.sellReturnAmount,
        roundOffAmount: 0,
        discount: sellReturnUploadDetail.discount,
        sellReturnState: sellReturnUploadDetail.sellReturnState,
        taxType: sellReturnUploadDetail.taxType,
        sellReturnItems: [],
        amount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        taxAmount: 0,
        totalAmount: sellReturnUploadDetail.totalAmount,
        costAmount: sellReturnUploadDetail.costAmount,
        shippingCharges: sellReturnUploadDetail.shippingCharges,
        sellReturnUpload: sellReturnUploadDetail.sellReturnUpload,
        remarks: sellReturnUploadDetail.remarks,
        status: 'Pending',
        createdBy: req.userData.userId,
        updatedBy: req.userData.userId
      });

      const sellReturnItemsFinal = sellReturnUploadDetail.sellReturnItems.map(sellReturnItem => {
        return {
          productId: sellReturnItem.productId,
          productName: sellReturnItem.productName,
          description: sellReturnItem.description,
          hsnCode: sellReturnItem.hsnCode,
          hsnName: sellReturnItem.hsnName,
          grams: sellReturnItem.grams,
          quantity: sellReturnItem.quantity,
          mrp: sellReturnItem.mrp,
          taxPercentage: sellReturnItem.taxPercentage,
          // sellRate: sellReturnItem.sellRate,
          totalAmount: sellReturnItem.totalAmount,
          costWithoutGst: sellReturnItem.costWithoutGst,
          costAmount: sellReturnItem.costAmount
        };
      });

      sellReturnUploadDetailFinal.sellReturnItems = sellReturnItemsFinal;

      // console.log(sellReturnUploadDetailFinal);

      await sellReturnUploadDetailFinal.setSellReturnAmountDetails();

      // console.log(sellReturnUploadDetailFinal);

      await sellReturnUploadDetailFinal.save();

      for (let i = 0; i < rows.length; i++) {
        worksheet.getCell(`M${rows[i]}`).value = sellReturnUploadDetailFinal.sellReturnItems[i].cgstAmount;
        worksheet.getCell(`N${rows[i]}`).value = sellReturnUploadDetailFinal.sellReturnItems[i].sgstAmount;
        worksheet.getCell(`O${rows[i]}`).value = sellReturnUploadDetailFinal.sellReturnItems[i].igstAmount;
        worksheet.getCell(`P${rows[i]}`).value = sellReturnUploadDetailFinal.sellReturnItems[i].taxableAmount;
        worksheet.getCell(`Q${rows[i]}`).value = 'Uploaded';
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

    this.remarks = `Records uploaded - ${successCount}. Records failed - ${failCount}.`;


    fileKey = `uploads/sellReturns/${req.file.filename}`;
    fileUrl = await uploadFileToS3Bucket(filePath, fileKey);
    this.uploadedFile = req.file.filename;

    fileKey = `uploads/sellReturns/${checkFile}`;
    fileUrl = await uploadFileToS3Bucket(checkFilePath, fileKey);
    this.checkFile = checkFile;

    return null;
  } catch (error) {
    console.log(error);
    return error;
  }
}

sellReturnUploadSchema.methods.approve = function (req) {
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

sellReturnUploadSchema.methods.reject = function (req) {
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

sellReturnUploadSchema.methods.validateData = async function () {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ sellReturnUploadName: this.sellReturnUploadName, _id: { $ne: this._id } });
    // if (count > 0) {
    //   return { errors : { sellReturnUploadName: { message: `Two sellReturnUploads cannot share the same sellReturnUploadName (${this.sellReturnUploadName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sellReturnUploadName: { message: `Two sellReturnUploads cannot share the same asin (${this.asin})` } } }
    //   }
    // }

    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sellReturnUploadName: { message: `Two sellReturnUploads cannot share the same skuCode (${this.skuCode})` } } }
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

module.exports = model("SellReturnUpload", sellReturnUploadSchema);
