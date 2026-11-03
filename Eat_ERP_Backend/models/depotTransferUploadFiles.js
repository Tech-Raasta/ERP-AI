import { DataTypes,Op } from 'sequelize';
import sequelize from '../lib/database.js';
import User from './user.js';
import Depot from './depot.js';
import Box from './box.js';
import ComboBox from './comboBox.js';

import ExcelJS from 'exceljs';
import fs from "fs";
import path from "path";
import { round, getTemplatePath, getReportPath, isValidDate, getUploadPath } from '../lib/common.js';
import ComboBoxItem from './comboBoxItem.js';

import DepotTransferUploadItem from './depotTransferUploadItem.js';
import DepotTransferUpload from './depotTransferUpload.js';
import BatchMaster from './batchMaster.js';

const DepotTransferUploadFiles = sequelize.define('depot_transfer_upload_files', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  upload_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  file_name: DataTypes.STRING,
  file_path: DataTypes.STRING,
  error_file_name: DataTypes.STRING,
  error_file_path: DataTypes.STRING,
  check_file_name: DataTypes.STRING,
  check_file_path: DataTypes.STRING,
  error_file_name: DataTypes.STRING,
  error_file_path: DataTypes.STRING,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_at: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_at: DataTypes.DATE,
  approved_by: DataTypes.INTEGER,
  approved_at: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_at: DataTypes.DATE,
},
{
  timestamps: true,
  freezeTableName: true,
  createdAt: 'created_at',
  updatedAt: 'modified_at',
});



DepotTransferUploadFiles.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
DepotTransferUploadFiles.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
DepotTransferUploadFiles.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });
DepotTransferUploadFiles.belongsTo(User, { foreignKey: "rejected_by", as: "rejected_by_user" });


DepotTransferUploadFiles.prototype.getRequestData = function(req) {
  try {
    this.upload_date = new Date().toISOString().substring(0, 10);
    this.file_name = '';
    this.check_file_name = '';
    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

DepotTransferUploadFiles.prototype.validateData = async function() {
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


DepotTransferUploadFiles.prototype.getUploadFormat = async function(req) {
  try {
    const template = path.join(getTemplatePath(), 'depot_transfer_upload_format.xlsx');

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
    const boxes = await Box.findAll({ where: {status: 'Approved'}, attributes: ['box_name'], order: [['box_name', 'asc']] });
    for (const box of boxes) {
      worksheet2.getCell(`E${ row++ }`).value = box.box_name;
    }

    row = 2;
    const comboBoxes = await ComboBox.findAll({ where: {status: 'Approved'}, attributes: ['combo_box_name'], order: [['combo_box_name', 'asc']] });
    for (const comboBox of comboBoxes) {
      worksheet2.getCell(`G${ row++ }`).value = comboBox.combo_box_name;
    }

    row = 2;
    const batchNos = await BatchMaster.findAll({ where: {status: 'Approved'}, attributes: ['batch_no'], order: [['batch_no', 'asc']] });
    for (const batchNo of batchNos) {
      worksheet2.getCell(`I${ row++ }`).value = batchNo.batch_no;
    }

    for (row = 4; row<=110; row++) {
      if (depots) {
        worksheet1.getCell(`B${ row }`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$A$2:$A$' + (depots.length + 1)]
        };
        worksheet1.getCell(`C${ row }`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$A$2:$A$' + (depots.length + 1)]
        };
      }

      worksheet1.getCell(`D${ row }`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Sheet2!$C$2:$C$3']
      };

      worksheet1.getCell(`E${ row }`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`IF(D${ row }="", "", INDIRECT(D${ row }))`]
      };

      worksheet1.getCell(`G${ row }`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['Sheet2!$I$2:$I$'+(batchNos.length + 1)]
      };

    }

    worksheet2.state = 'hidden';

    // return workbook;

    const fileName = `depot_transfer_upload_format_${Date.now()}.xlsx`;
    const filePath = path.join(getReportPath(), fileName);
    await workbook.xlsx.writeFile(filePath);

    // return fileUrl;

    return fileName;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

DepotTransferUploadFiles.prototype.uploadFileData = async function(req) {
  let t;
    const uploadPath = path.join(getUploadPath(), 'depot_transfer_upload');
    
    if (!fs.existsSync(uploadPath)){
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    const fileName = req.files.doc_document[0].filename;
    const filePath = path.join(uploadPath, fileName);
    const check_file_name = `Check-${Date.now()}-${this.id}.xlsx`;
    const check_file_path = path.join(uploadPath, check_file_name);
    const error_file_name = `Error-${Date.now()}-${this.id}.xlsx`;
    const error_file_path = path.join(uploadPath, error_file_name);

    if (!fs.existsSync(filePath)) {
      this.remarks = 'File Not Found.';
      this.status = 'Failed';
      return 'File not found.';
    }
    
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);

    if (worksheet.getCell('A4').value.trim().toUpperCase() !== 'CREATION DATE' || 
        worksheet.getCell('B4').value.trim().toUpperCase() !== 'DEPOT IN' || 
        worksheet.getCell('C4').value.trim().toUpperCase() !== 'DEPOT OUT' || 
        worksheet.getCell('D4').value.trim().toUpperCase() !== 'TYPE' ||
        worksheet.getCell('E4').value.trim().toUpperCase() !== 'SKU NAME' ||
        worksheet.getCell('F4').value.trim().toUpperCase() !== 'QTY' ||
        worksheet.getCell('G4').value.trim().toUpperCase() !== 'BATCH NO' ||
        worksheet.getCell('H4').value.trim().toUpperCase() !== 'REMARKS') {
          this.remarks = 'File Format does not match.';
          this.status = 'Failed';
          this.file_name = fileName;
          
          return 'File Format does not match.';
    }

    worksheet.getCell('I4').value = "Status";
    worksheet.getCell('J4').value = "Error Remark";

    const depotTransferUploadDetails = [];
    let successCount = 0;
    let failCount = 0;
    const rowsCount = worksheet.rowCount;

    for (let rowNum = 5; rowNum <= rowsCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const error = [];
      let dateOfProcessing = row.getCell(1).value;
      if (!dateOfProcessing) {
        error.push('Date of processing is required.');
      } else {
        try {
          dateOfProcessing = new Date(dateOfProcessing).toISOString();
        } catch (e) {
          error.push('Date of processing is invalid.');
        }
      }
      if (!dateOfProcessing) {
        continue;
      }

      const depot_in = row.getCell(2).text;
      const depot_out = row.getCell(3).text;
      let sku_type = row.getCell(4).text;
      let sku_name = row.getCell(5).text;
      let sku_qty = row.getCell(6).text;
      const batch_no = row.getCell(7).text ? row.getCell(7).text : '';
      const remarks = row.getCell(8).text;

      sku_qty = sku_qty ? parseFloat(sku_qty) : 0;

      let depotTransferUploadDetail = null;
      let depotTransferUploadDetailIndex = -1;

      let depot_in_id = null;
      let depot_out_id = null;
      if (depot_in) {
        const depotObj = await Depot.findOne({ where: {depot_name: depot_in}, id: {[Op.in]: req.userData.depotIds} });
        if (depotObj && depotObj.id) {
          depot_in_id = depotObj.id;
        }
      }
      if (!depot_in_id) {
        error.push('Depot in not found.');
      }

      if (depot_out) {
        const depotObj = await Depot.findOne({ where: {depot_name: depot_out}, id: {[Op.in]: req.userData.depotIds} });
        if (depotObj && depotObj.id) {
          depot_out_id = depotObj.id;
        }
      }
      if (!depot_out_id) {
        error.push('Depot out not found.');
      }

      depotTransferUploadDetailIndex = depotTransferUploadDetails.findIndex(depoTransferUpload => {
        return (depoTransferUpload.date_of_processing === dateOfProcessing && depoTransferUpload.depot_in_id == depot_in_id && depoTransferUpload.depot_out_id == depot_out_id);
      });
      
      if (depotTransferUploadDetailIndex !== -1) {
        depotTransferUploadDetail = depotTransferUploadDetails[depotTransferUploadDetailIndex];
      }

      if (!sku_type) {
        error.push('Type should be Box Or Combo_Box.');
        sku_type = '';
      }
      if (!sku_qty || sku_qty <= 0) {
        error.push('Quantity should be greater than zero.');
        sku_qty = 0;
      }

      const depotTransferUploadItems = [];
      let depotTransferUploadItem = null;

      if (sku_type) {
        if (sku_type.trim().toUpperCase() === 'BOX') {
          const box = await Box.findOne({ where: {box_name: sku_name} });
          if (box) {
            depotTransferUploadItem = {
              type: 'Box',
              box_id: box.id,
              box_name: box.box_name,
              qty: sku_qty,
              batch_no: batch_no,
              remarks,
              rowNum: rowNum
            }
            depotTransferUploadItems.push(depotTransferUploadItem);
          } else {
            error.push('Box not found.');
          }
        } else if (sku_type.trim().toUpperCase() === 'COMBO_BOX') {
          const comboBox = await ComboBox.findOne({ where: {combo_box_name: sku_name},  include: { model: ComboBoxItem, as: 'comboBoxItems', include: ['box'] } });
          if (comboBox) {
            if (comboBox.comboBoxItems) {
                for (const comboBoxItem of comboBox.comboBoxItems) {
                  let item_qty = comboBoxItem.qty * sku_qty;
                  if (comboBoxItem.type && comboBoxItem.type.trim().toUpperCase() === 'BOX'  && comboBoxItem.box ) {
                    depotTransferUploadItem = {
                      type: 'Box',
                      box_id: comboBoxItem.box.id,
                      box_name: comboBoxItem.box.box_name,
                      qty: item_qty,
                      batch_no: batch_no,
                      remarks,
                      combo_box_id:comboBox.id,
                      rowNum: rowNum
                    }
                    depotTransferUploadItems.push(depotTransferUploadItem);
                  }else{
                    error.push('Box not found in combo box.')
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

      if (error.length > 0) {
        worksheet.getCell(`I${rowNum}`).value = 'Not Uploaded';
        worksheet.getCell(`J${rowNum}`).value = error.join(' ');
        failCount = failCount + 1;
        continue;
      }

      if (depotTransferUploadDetail) {
        depotTransferUploadDetail.depotTransferUploadItems.push(...depotTransferUploadItems);
        depotTransferUploadDetail.rows.push(rowNum);
        depotTransferUploadDetails[depotTransferUploadDetailIndex] = depotTransferUploadDetail;
      } else {
        depotTransferUploadDetail = {
          date_of_processing: dateOfProcessing,
          file_id:this.id,
          depot_in_id,
          depot_out_id,
          depotTransferUploadItems: [...depotTransferUploadItems],
          status: 'Pending',
          created_by: req.userData.userId,
          modified_by: req.userData.userId,
          rows: [rowNum]
        }

        depotTransferUploadDetails.push(depotTransferUploadDetail);
      }

    }
    if (failCount < 1){

      for (const depotTransferUploadDetail of depotTransferUploadDetails) {
        const rows = depotTransferUploadDetail.rows;
  
        const depotTransferUploadDetailFinal = new  DepotTransferUpload({
          ...depotTransferUploadDetail
        });
  
        const depotTransferUploadItemsFinal = [];
        for (const item of depotTransferUploadDetail.depotTransferUploadItems) {
          const depotTransferUploadItemFinal = new DepotTransferUploadItem({...item});
          depotTransferUploadItemsFinal.push(depotTransferUploadItemFinal);
        }
    
        t = await sequelize.transaction();
        
        await depotTransferUploadDetailFinal.save({ transaction: t });
  
        for (const depotTransferUploadItemFinal of depotTransferUploadItemsFinal) {
          depotTransferUploadItemFinal.depot_transfer_upload_id = depotTransferUploadDetailFinal.id;
          await depotTransferUploadItemFinal.save({ transaction: t });
        }
    
        await t.commit();
  
        for (let i=0; i < rows.length; i++) {
          worksheet.getCell(`I${rows[i]}`).value = 'Uploaded';
          successCount = successCount + 1;
        }
      }
    }

    
    if (successCount === 0) {
      this.status = 'Failed';
      await workbook.xlsx.writeFile(error_file_path);
      this.error_file_name = error_file_name;
      this.error_file_path = error_file_path;
    } else {
      await workbook.xlsx.writeFile(check_file_path);
      this.check_file_name = check_file_name;
      this.check_file_path = check_file_path;
      this.status = 'Pending';
    }
    
    this.remarks = `Records uploaded - ${successCount} . Records failed - ${failCount}.`;
    
    this.file_name = fileName;
    this.file_path = filePath



    return null;
}

export default DepotTransferUploadFiles;
