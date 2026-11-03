import { DataTypes, Op, where } from 'sequelize';
import sequelize from '../lib/database.js';
import State from './state.js';
import Depot from './depot.js';
import Distributor from './distributor.js';
import Product from './product.js';
import Sale from './sale.js';
import { round, getTemplatePath, getReportPath, isValidDate, getUploadPath } from '../lib/common.js';
import ExcelJS from 'exceljs';

import fs from "fs";
import SalesUploadDetail from './salesUploadDetail.js';
import ComboBox from './comboBox.js';
import Pincode from './pincode.js';
import Box from './box.js';


const SalesUpload = sequelize.define('sales_upload_files', {
    upload_date: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notNull: true
        }
    },
    file_name: DataTypes.STRING,
    file_path: DataTypes.STRING,
    error_file_path: DataTypes.STRING,
    error_file_name: DataTypes.STRING,
    check_file_path: DataTypes.STRING,
    check_file_name: DataTypes.STRING,
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
    refid: DataTypes.INTEGER,
}, {
    timestamps: true,
    createdAt: 'created_on',
    updatedAt: 'modified_on',
},);

//Check And Update Uploaded File
SalesUpload.prototype.uploadFileData = async function (req) {
    try {
        const workbook = new ExcelJS.Workbook();
        const files = req.files ? req.files : null;
        console.log(req.files)
        const filePath = `${getUploadPath()}/sales_upload/${req.files.uploadFile[0].filename}`;
        const checkFile = `Check-${Date.now()}-${this.id}.xlsx`;
        const checkFilePath = `${getUploadPath()}/sales_upload/${checkFile}`;
        const errorFile = `Error-${Date.now()}-${this.id}'.xlsx`;
        const errorFilePath = `${getUploadPath()}/sales_upload/${errorFile}`; 
        
        if (files.uploadFile && files.uploadFile.length > 0) {
            this.file_path = (files.uploadFile && files.uploadFile.length > 0) ? files.uploadFile[0].path : this.uploadFile;
        }
        
        if (!fs.existsSync(filePath)) {
            // console.log('File Not Found.');
            this.remarks = 'File Not Found.';
            this.status = 'Failed';
            return 'File not found.';
        }
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);

        if (
            worksheet.getCell('A4').value.trim().toUpperCase() !== 'CREATION DATE' ||
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

        const rowsCount = worksheet.rowCount;

        const salesUploadDetails = [];
        const errorOrderNos = [];
        let successCount = 0;
        let failCount = 0;

        for (let rowNum = 5; rowNum <= rowsCount; rowNum++) {
            // console.log(rowNum);
            // Assigning variable to each rows
            const row = worksheet.getRow(rowNum);
            const error = [];

            // Assigning variable to each rows of columns
            const saleDate = row.getCell(1).value;
            if (!saleDate) continue;
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
            const trackId = row.getCell(21).text;
            const remarks = row.getCell(22).text;

            // console.log(row.getCell(2).text);

            quantity = quantity ? parseFloat(quantity) : 0;
            saleRate = saleRate ? parseFloat(saleRate) : 0;
            discount = discount ? parseFloat(discount) : 0;
            totalOrderValue = totalOrderValue ? parseFloat(totalOrderValue) : 0;

            // Checking Sale Date
            if(!isValidDate(saleDate)) error.push("Sale Date should be in d-m-y format");
            if(!quantity|| quantity <=0) error.push('Quantity should be greater than zero.')
            if(!saleRate|| saleRate <=0) error.push('Sale Rate should be greater than zero.')
            if(saleRate === 0 && discount === 0 && totalOrderValue === 0) error.push('Please enter Sell Rate, Discount % Or Total Realisation Value.')

            // Temporary variables
            let depotId, depotState, distributorId, distributorState, distributorClass, saleState, taxType = "Intra", saleUploadItem = null;

            let salesUploadDetail = null;
            let salesUploadDetailIndex = -1;
            if (PONo) {
                salesUploadDetailIndex = salesUploadDetails.findIndex(result => {
                return result.PONo.trim().toUpperCase() === PONo.trim().toUpperCase();
                });

                if (salesUploadDetailIndex !== -1) {
                salesUploadDetail = salesUploadDetails[salesUploadDetailIndex];
                }
            }

            // Check Depot is in database
            if(depotName){
                const data = await Depot.findOne({where:{depot_name : depotName}});
                depotId = data.id ? data.id.toString() : null;
                if(!depotId) error.push("Depot not found.")
                depotState = data.state ? data.state : null;
            }

            // Check Distributor is in database
            if(distributorName){
                const data = await Distributor.findOne({where : {distributor_name : distributorName}});
                distributorId = data.id ? data.id.toString() : null;
                if(!distributorId) error.push("Distributor not found.")
                distributorClass = data.class;
                saleState = data.state;
            }

            // Check Distributor Class is direct or not
            if(distributorClass.trim().toUpperCase() === "DIRECT"){
                if(!name) error.push('Customer Name not found.');
                if(!address) error.push('Customer Address not found.');
                if(!pincode) error.push('Customer pincode not found.');
                if(!name) error.push('Customer Name not found.');
                if(!name) error.push('Customer Name not found.');

                if(pincode){
                    const data = await Pincode.findOne({where:{pincode}})
                    const stateData = await State.findOne({where:{id: data.state_id}})
                    saleState = stateData.state_name;
                }
            }else if(distributorClass.trim().toUpperCase() !== "DIRECT" && (name || address || city || pincode || mobileNo)){
                error.push('Distributor is not direct. Customer name, address, city, pincode, mobileNo should be blank.')
            }

            // Check PO Number is in distributor out 
            if(PONo){
                const data = await Sale.findOne({where:{ order_no:PONo}})
                if(data) error.push('PO No already exist.');
            }

            // Check Track Id is in distributor out 
            if(trackId){
                const data = await Sale.findOne({where:{ tracking_id:trackId}})
                if(data) error.push('Track Id already exist.');
            }

            // Check depot state and distributor state are same of not  
            if(saleState === depotState)
                taxType = "Infra"
            else
                taxType = "Inter"

            // Checking Box type
            if(itemType){
                if (itemType.trim().toUpperCase() !== 'BOX' && itemType.trim().toUpperCase() !== 'COMBO_BOX' ){
                    error.push('Item Type should be Box Or Combo_Box.');
                }else if(itemType.trim().toUpperCase() === 'BOX'){
                    const box = await Box.findOne({ where: {box_name: skuName} });
                    if(box){
                        saleUploadItem = {
                            distributor_out_id : 0,
                            type: 'Box',
                            item_id: box.id,
                            qty:quantity,
                            sell_rate: saleRate,
                            grams: box.grams,
                            rate: box.rate,
                            amount: box.amount,
                            batch_no: batchNo
                        }
                    }else{
                        error.push('SKU Name not found.');
                    }
                }else if(itemType.trim().toUpperCase() === 'BOX'){
                    const comboBox = await Box.findOne({ where: {box_name: skuName} });
                    if(comboBox){
                        saleUploadItem = {
                            distributor_out_id : 0,
                            type: 'Combo Box',
                            item_id: comboBox.id,
                            qty:quantity,
                            sell_rate: saleRate,
                            grams: comboBox.grams,
                            rate: comboBox.rate,
                            amount: comboBox.amount,
                            batch_no: batchNo
                        }
                    }else{
                        error.push('SKU Name not found.');
                    }
                }
            }else{
                error.push('Item Type should be Box Or Combo_Box.');
            }

            // if(error.lengthv > 0 || errorOrderNos)


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