import { Op, where } from 'sequelize';
import axios from 'axios';
import dotenv from 'dotenv';
import EasyEcomKey from '../models/easyEcomKey.js';
import ProductionTransfer from '../models/productionTransfer.js';
import { addDays } from './common.js';
import EasyEcomInventory from '../models/easyEcomInventory.js';
dotenv.config();


class EasyEcomApi {
    constructor(location_key) {
        this.location_key = location_key;
    }

    async getToken() {
        const easyEcomKey = await EasyEcomKey.findOne({ 
            where: { 
                location_key: this.location_key, 
                expires_in: { [Op.gt]: new Date().toISOString() } 
            } 
        });
        
        if (easyEcomKey) return easyEcomKey;

        if (!easyEcomKey) {
            const response = await this.authenticate();
            
            if (response.data && response.data.data && response.data.data.token && response.data.data.token.jwt_token) {
                // const expires_in = response.data.data.token.expires_in ? parseInt(response.data.data.token.expires_in) : 0;

                const easyEcomKey = new EasyEcomKey({
                    location_key: this.location_key,
                    jwt_token: response.data.data.token.jwt_token,
                    token_type: response.data.data.token.token_type,
                    expires_in: addDays(new Date().toISOString(), 90)
                });

                await easyEcomKey.save();

                return easyEcomKey;
            } else {
                throw response;
            }
        }
    }

    // async getSkuDetailsFromRequest(req) {
    //     const items = req.body.items;
    //     const skus = [];
    //     const productionTransfers = [];
    //     for (const item of items) {
    //         const productionTransfer = await ProductionTransfer.findByPk(item.id, { include: ['production', 'box']});

    //         if (!productionTransfer) {
    //             // return { errors : { [item.id]: { message: `Production Transfer does not exist` } } }
    //             return { message: `Production Transfer does not exist` }
    //         }
    //         if (productionTransfer.status.trim().toUpperCase() !== 'APPROVED') {
    //             // return { errors : { [item.id]: { message: `Production Transfer is not approved` } } }
    //             return { message: `Production Transfer is not approved` }
    //         }
    //         if (productionTransfer.uploaded_to_easyecom) {
    //             // return { errors : { [item.id]: { message: `Production Transfer is already uploaded to Easy Ecom` } } }
    //             return { message: `Production Transfer is already uploaded to Easy Ecom` }
    //         }
    //         if (!productionTransfer.box || !productionTransfer.box.sku_code) {
    //             // return { errors : { [item.id]: { message: `Production Transfer item sku code not found` } } }
    //             return { message: `Production Transfer item sku code not found` }
    //         }
    //         if (!productionTransfer.production || !productionTransfer.production.batch_id_as_per_fssai) {
    //             // return { errors : { [item.id]: { message: `Production Transfer item batch code not found` } } }
    //             return { message: `Production Transfer item batch code not found` }
    //         }

    //         productionTransfer.uploaded = 1;
    //         productionTransfer.uploaded_qty = item.uploaded_qty;
    //         productionTransfer.uploaded_on = new Date().toISOString();

    //         skus.push({
    //             sku: productionTransfer.box.sku_code,
    //             quantity: productionTransfer.uploaded_qty,
    //             batchCode: productionTransfer.production.batch_id_as_per_fssai
    //         });
            
    //         productionTransfers.push(productionTransfer);
    //     }

    //     return {skus, productionTransfers};
    // }

    // Get SKU Details from request and update inventory in bulk with batch code
    async getSkuDetailsFromRequest(req) {
        const items = req.body.items;
        const skus = [];
        const easyEcomInventory = [];
        for (const item of items) {
            const productionTransfer = await EasyEcomInventory.findOne({ where: { id: item.id }, include: ['box'] });

            if (productionTransfer && productionTransfer.box && productionTransfer.box.sku_code) {
                productionTransfer.date_of_synced = new Date().toISOString();
                productionTransfer.date_of_synced_by = req.userData.userId;
                productionTransfer.synced_qty = item.synced_qty;
                skus.push({
                    sku: productionTransfer.box.sku_code,
                    quantity: productionTransfer.synced_qty
                });
                
                easyEcomInventory.push(productionTransfer);
            }


        }

        return {skus, easyEcomInventory};
    }

    // async bulkInventoryUpdateWithBatchCode(skus) {
    //     // try {
    //         const tokenDetails = await this.getToken();
    //         const headers = {
    //             'x-api-key': process.env.EASYECOMAPI_X_API_KEY,
    //             'Authorization': 'Bearer ' + tokenDetails.jwt_token
    //         };
    //         const uri = process.env.EASYECOMAPI_URI + 'inventory/bulkInventoryUpdateWithBatchCodeAndExpiry';

    //         const requestPayload = { skus: skus };

    //         const response = await axios.post(uri, requestPayload, {
    //             headers: headers
    //         });
    
    //         if (response && response.status === 200 && response.data && response.data.code === 200) {
    //             return response;
    //         } else {
    //             throw response.data.message;
    //         }
    //     // } catch (error) {
    //     //     return error;
    //     // }
    // }

    // Update inventory in bulk on EasyEcom
    async bulkInventoryUpdate(skus) {
        const tokenDetails = await this.getToken();
        const headers = {
            'x-api-key': process.env.EASYECOMAPI_X_API_KEY,
            'Authorization': 'Bearer ' + tokenDetails.jwt_token
        };
        const uri = process.env.EASYECOMAPI_URI + 'inventory/bulkInventoryUpdate';

        const requestPayload = { skus: skus };

        const response = await axios.post(uri, requestPayload, {
            headers: headers
        });
        
        console.log('Bulk Inventory Update Response:', response);
        if (response && response.status === 200 && response.data && response.data.code === 200) {
            return response;
        } else {
            throw response.data.message;
        }
    }

    async getOrders (startDate, endDate, nextUrl) {
        // try {
            const tokenDetails = await this.getToken();
            const headers = {
                'x-api-key': process.env.EASYECOMAPI_X_API_KEY,
                'Authorization': 'Bearer ' + tokenDetails.jwt_token
            };
            let uri = process.env.EASYECOMAPI_URI + 'orders/V2/getAllOrders?start_date=' + startDate + '&end_date=' + endDate;

            // let uri = process.env.EASYECOMAPI_URI + 'orders/V2/getAllOrders?updated_before=' + endDate + '&updated_after=' + startDate;

            if (nextUrl) {
                uri = process.env.EASYECOMAPI_URI + nextUrl;
            }

            uri = uri + '&limit=250';
            // uri = uri + '&limit=250&marketplaceId=26';

            const response = await axios.get(uri, {
                headers: headers
            });
    
            if (response && response.status === 200 && response.data && response.data.code === 200) {
                return response.data.data;
            } else {
                throw response.data.message;
            }
        // } catch (error) {
        //     return error;
        // }
    }

    static async getOrderDetails() {
        let eInvoiceGstinDetail = await EasyEcomApiGstinDetail.findOne({ where: { gstin: gstin } });

        if (eInvoiceGstinDetail) return eInvoiceGstinDetail;

        const tokenDetails = await this.getToken();
        
        const headers = {
            client_id: process.env.EINVOICE_CLIENTID,
            client_secret: process.env.EINVOICE_CLIENTSECRET,
            Gstin: process.env.EINVOICE_GSTIN,
            user_name: process.env.EINVOICE_USERNAME,
            jwt_token: tokenDetails.jwt_token
        };

        const sek = tokenDetails.sek;

        const uri = process.env.EASYECOMAPI_URI + 'eivital/v1.04/Master/gstin/' + gstin;

        const response = await axios.get(uri, {
            headers: headers
        });

        if (response.status === 200) {
            // console.log("Call is success");

            const decodedData = this.decrypt(sek, response.data.Data, null, tokenDetails.jwt_token);
            const gstinDetails = JSON.parse(decodedData);

            // console.log(`GstinDetails: ${gstinDetails}`);

            if (gstinDetails) {
                eInvoiceGstinDetail = new EasyEcomApiGstinDetail({ gstin: gstin });
                eInvoiceGstinDetail.getRequestData(gstinDetails);
                await eInvoiceGstinDetail.save();

                return eInvoiceGstinDetail;
            } else {
                return null;
            }
        } else {
            // const errorResponse = response.data;
            const err = response.statusText;
            // console.log(`error Response: ${errorResponse} reason: ${err}`);

            throw err;
        }
    }

    static async getIrnDetailsByInvoiceNo(sale) {
        let eInvoiceIrnDetail = await EasyEcomApiIrnDetail.findOne({ where: { saleId: sale.id } });

        if (eInvoiceIrnDetail) return eInvoiceIrnDetail;

        const tokenDetails = await this.getToken();
        
        const headers = {
            client_id: process.env.EINVOICE_CLIENTID,
            client_secret: process.env.EINVOICE_CLIENTSECRET,
            Gstin: process.env.EINVOICE_GSTIN,
            user_name: process.env.EINVOICE_USERNAME,
            jwt_token: tokenDetails.jwt_token
        };

        const sek = tokenDetails.sek;

        const invoiceDate = getFormattedDate(new Date(sale.invoiceDate));

        const uri = process.env.EASYECOMAPI_URI + 'eicore/v1.03/Invoice/irnbydocdetails?doctype=INV&docnum=' + sale.invoiceNo + '&docdate=' + invoiceDate;

        const response = await axios.get(uri, {
            headers: headers
        });

        if (response.data.Status === 1) {
            // console.log("Call is success");

            const decodedData = this.decrypt(sek, response.data.Data, null, tokenDetails.jwt_token);
            const irnDetails = JSON.parse(decodedData);

            // console.log(`IrnDetails: ${irnDetails}`);

            if (irnDetails) {
                eInvoiceIrnDetail = new EasyEcomApiIrnDetail({ saleId: sale.id });
                eInvoiceIrnDetail.getRequestData(irnDetails);
                await eInvoiceIrnDetail.save();

                return eInvoiceIrnDetail;
            } else {
                return null;
            }
        }
        //  else {
        //     if (response.data && response.data.ErrorDetails) {
        //         const errorResponse = response.data.ErrorDetails[0];
        //         const err = errorResponse.ErrorMessage;
        //         console.log(`error Response: ${JSON.stringify(errorResponse)} reason: ${err}`);
    
        //         throw err;
        //     } else {
        //         throw 'Something went wrong.'
        //     }
        // }
    }

    async authenticate() {
        try {
            const uri = process.env.EASYECOMAPI_URI + 'access/token';
            const email = process.env.EASYECOMAPI_EMAIL;
            const password = process.env.EASYECOMAPI_PASSWORD;
            // const location_key = process.env.EASYECOMAPI_LOCATIONKEY;

            // EASYECOMAPI_LOCATIONKEY=ee41972946129

            const data = {
                email: email,
                password: password,
                location_key: this.location_key
            }

            const response = await axios.post(uri, data);
            if (response.status === 200) {
                return response;
            } else {
                // const errorResponse = response.data;
                const err = response.statusText;
                // console.log(`error Response: ${errorResponse} reason: ${err}`);

                return err;
            }
        } catch (ex) {
            // console.log(ex.toString());

            return ex;
        }
    }
}

export default EasyEcomApi;