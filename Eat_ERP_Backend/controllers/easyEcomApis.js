import { Op, Sequelize } from "sequelize";
import sequelize from "../lib/database.js";

import EasyEcomApi from "../lib/easyEcomApi.js";
import { sendOrderEmail, sendOrderFetchingFailedEmail } from "../lib/sellingPartnerApi.js";
import Box from "../models/box.js";
import ComboBox from "../models/comboBox.js";
import ComboBoxItem from "../models/comboBoxItem.js";
import Country from "../models/country.js";
import Depot from "../models/depot.js";
import Distributor from "../models/distributor.js";
import Pincode from "../models/pincode.js";
import Product from "../models/product.js";
import Production from "../models/production.js";
import ProductionTransfer from "../models/productionTransfer.js";
import Sale from "../models/sale.js";
import SaleItem from "../models/saleItem.js";
import SaleReturn from "../models/saleReturn.js";
import State from "../models/state.js";
import User from "../models/user.js";
import { getDateString, getDateTimeString, isValidDate, round } from "../lib/common.js";
import { getSeries } from "../models/series.js";
import SaleItemProduct from "../models/saleItemProduct1.js";
import AccountLedgerEntry from "../models/accountLedgerEntry.js";
import { getOrder, getShopifyOrderDistributor, getShopifyOrderNo } from "../lib/shopifyApi.js";
import SaleReturnItem from "../models/saleReturnItem.js";
import SaleReturnItemProduct from "../models/saleReturnItemProduct.js";
import logger from '../lib/logger.js';

export const authentication = async (req, res, next) => {
  try {
    // const data = await callApi();

    const easyEcomApi = new EasyEcomApi('ee41972946129')
    const response = await easyEcomApi.getToken();

    if (response && !response.error) {
      if (res) {
        res.status(200).json({ 
          message: 'Easy Ecom Api authenticated successfully.',
          data: response 
        });
      } else {
        return { data: response };
      }
    } else {
      throw response;
    }
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Easy Ecom Api authentication Failed!"
    // });

    res.statusCode = 500;
    res.message = "Easy Ecom Api authentication failed!";
    next(error, req, res);
  }
};

export const getInventoryWithBarcode = async (req, res, next) => {
  try {
    const productionTransfers = await ProductionTransfer.findAll({ 
      where: { status: 'Approved', uploaded_to_easyecom: 0 }, 
      include: [
        { model: Box, as: 'box', attributes: ['id', 'box_name', 'sku_code'] },
        { model: Production, as: 'production', attributes: ['id', 'batch_id_as_per_fssai'] }
      ]
    });
    
    res.status(200).json({ 
      message: 'Production transfers fetched successfully.',
      productionTransfers: productionTransfers 
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Production transfers fetched successfully!"
    // });

    res.statusCode = 500;
    res.message = "Production transfers fetched successfully!";
    next(error, req, res);
  }
};

export const updateBulkInventoryWithBatchCode = async (req, res, next) => {
  try {
    const easyEcomApi = new EasyEcomApi('ee41972946129')
    const {skus, productionTransfers} = await easyEcomApi.getSkuDetailsFromRequest(req);
    if (skus.message) {
      return res.status(422).json({ 
        message: skus.message,
        data: skus 
      });
    }

    const response = await easyEcomApi.bulkInventoryUpdateWithBatchCode(skus);
    if (response instanceof Error) {
      return res.status(422).json({ 
        message: response.message,
        data: response.stack 
      });
    }

    for (const productionTransfer of productionTransfers``) {
      productionTransfer.save();
    }

    res.status(200).json({ 
      message: 'Bulk Inventory updated successfully.',
      data: response 
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Bulk Inventory updation failed!"
    // });

    res.statusCode = 500;
    res.message = "Bulk Inventory updation failed!";
    next(error, req, res);
  }
};

export const getAllOrdersBackup = async (req, res, next) => {
  let t;

  try {
    const user = await User.findByPk(421);
    if (user) {
      req.userData = {
        email: user.email_id,
        userId: user.id,
        userRoleId: user.role_id,
        roleDetails: {}
      };
    } else {
      throw new Error(`User with id (421) not found in User Master.`);
    }
    
    let nextUrl = '';
    const orders = [];
    let apiCnt = 0;

    let startDate = req.query.startDate ? req.query.startDate : '';
    let endDate = req.query.endDate ? req.query.endDate : '';

    if (!startDate) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 5);
    } else {
      startDate = new Date(startDate);
    }
    if (!endDate) {
      endDate = new Date();
    } else {
      endDate = new Date(endDate);
    }
    
    //startDate = new Date('2025-04-24T19:00:00Z');
    //endDate = new Date('2025-04-27T00:00:00Z');
    startDate = startDate.toISOString();
    endDate = endDate.toISOString();

    const easyEcomApi = new EasyEcomApi('ee41972946129');
    const errorOrders = [];
    const uploadedOrders = [];

    do {
      let fetchedOrders = await easyEcomApi.getOrders(startDate, endDate, nextUrl);
      if (!fetchedOrders || fetchedOrders instanceof Error || !fetchedOrders.orders) {
        throw fetchedOrders;
      }
      orders.push(...fetchedOrders.orders);
      nextUrl = fetchedOrders.nextUrl ? fetchedOrders.nextUrl : '';

      await new Promise(resolve => setTimeout(resolve, 500)); 
    } while (nextUrl !== '');
    

    for (const order of orders) {
      const marketplace = order.marketplace?.trim().toUpperCase();
      const marketplace_id = order.marketplace_id;
      if (!marketplace || marketplace.trim().toUpperCase().indexOf('MEESHO-API') !== -1 || marketplace.trim().toUpperCase().indexOf('OFFLINE') !== -1) {
        continue;
      }
      const reference_code = order.reference_code?.trim();
      let warehouse = order.company_name ? order.company_name : order.assigned_company_name ? order.assigned_company_name : '';
      let warehouse_id = order.warehouseId ? order.warehouseId : order.assigned_warehouse_id ? order.assigned_warehouse_id : 0;
      const order_status = order.order_status.trim().toUpperCase();
      const order_type = order.order_type;
      const IsBusinessOrder = (order_type === 'B2B') ? 1 : 0;
      const replacement_order = order.replacement_order;
      const courier = order.courier;
      const awb_number = order.awb_number && order.awb_number != null ? order.awb_number : '';
      const payment_mode = order.payment_mode;
      const buyer_gst = order.buyer_gst && order.buyer_gst != 'NA' && order.buyer_gst != '0' ? order.buyer_gst : '';
      const email = order.email;
      const billing_name = order.billing_name;
      let billing_address = (order.billing_address_1 ? order.billing_address_1 : '') + ' ' + (order.billing_address_2 ? order.billing_address_2 : '');
      const billing_city = order.billing_city;
      const billing_state = order.billing_state;
      const billing_state_code = order.billing_state_code;
      const billing_pin_code = order.billing_pin_code;
      const billing_country = order.billing_country && order.billing_country != null ? order.billing_country : (order.country ? order.country : '');
      const billing_mobile = order.billing_mobile;
      const total_tax = order.total_tax;
      const total_shipping_charge = order.total_shipping_charge;
      const total_discount = order.total_discount;
      const suborders = order.suborders;
      const shipping_status = order.shipping_status ? order.shipping_status?.trim().toUpperCase() : '';
      const delivery_status = (shipping_status === 'DELIVERED' || shipping_status === 'RTO DELIVERED') ? 'Delivered' : (order_status === 'SHIPPED' ? 'GP Issued' : 'Pendiing');
      const date_of_dispatch = order.manifest_date && order.manifest_date !== '0000-00-00 00:00:00' ? new Date(order.manifest_date).toISOString() : null;
      const delivery_date = order.delivery_date && order.delivery_date !== '0000-00-00 00:00:00' ? new Date(order.delivery_date).toISOString() : null;

      let placeOrder = false;
      if (order_status === 'ASSIGNED' || order_status === 'CONFIRMED' || 
          order_status === 'PRINTED' || order_status === 'MANIFEST SCANNED' || 
          order_status === 'READY TO DISPATCH' || order_status === 'SHIPPED' || 
          order_status === 'CANCELLED' || order_status === 'RETURNED') {
            placeOrder = true;
      }

      if (placeOrder === false) {
        continue;
      }

      let normalizedOrderNo = reference_code;

      if (marketplace.includes('SHOPIFY')) {
        const shopifyOrderNo = getShopifyOrderNo(reference_code);
        normalizedOrderNo = shopifyOrderNo ? shopifyOrderNo.replace("#","") : normalizedOrderNo;
      }   
      
      // More robust duplicate check using LIKE pattern to catch suffixed order numbers (e.g., ORDER123$1)
           
      // New Code By Saurabh
      const existingSales = await Sale.findAll({
        where: {
          order_no: {
            [Op.or]: [
              normalizedOrderNo,
              { [Op.like]: `${normalizedOrderNo}%` }
            ]
          }
        }
      });

      if (order_status === 'RETURNED') {
        const saleReturnExists = await SaleReturn.findOne({
          where: {
            order_no: {
              [Op.or]: [
                normalizedOrderNo,
                { [Op.like]: `${normalizedOrderNo}$%` }
              ]
            }
          }
        });

        if (saleReturnExists) {
          console.log(`Duplicate return skipped: ${normalizedOrderNo}`);
          continue; // already processed
        }
      } else if (order_status === 'CANCELLED') {
        if (existingSales.length > 0) {
          for (const sale of existingSales) {
            if (sale.status && sale.status.trim().toUpperCase() !== 'INACTIVE') {
              sale.status = 'InActive';
              await sale.save();
              await AccountLedgerEntry.update(
                { status: 'InActive' },
                { where: { ref_type: 'Distributor_Sales', ref_id: sale.id } }
              );
            }
          }
        }
        console.log(`Cancelled order deactivated: ${normalizedOrderNo}`);
        continue;
      } else {
        // if (existingSales.length > 0) {
        //   const sale = existingSales[0];
        //   if (sale.status !== 'InActive' && sale.delivery_status?.trim().toUpperCase() !== delivery_status.toUpperCase()) {
        //     sale.delivery_status = delivery_status;
        //     sale.date_of_dispatch = date_of_dispatch;
        //     sale.delivery_date = delivery_date;
        //     await sale.save();
        //   }
        //   console.log(`Duplicate order skipped: ${normalizedOrderNo}`);
        //   continue; // already exists
        // }
        const activeSale = existingSales.find(s => s.status?.trim().toUpperCase() !== 'INACTIVE');
        if (activeSale) {
          if (activeSale.delivery_status?.trim().toUpperCase() !== delivery_status.toUpperCase()) {
            activeSale.delivery_status = delivery_status;
            activeSale.date_of_dispatch = date_of_dispatch;
            activeSale.delivery_date = delivery_date;
            await activeSale.save();
          }
          console.log(`Duplicate active order skipped: ${normalizedOrderNo}`);
          continue;
        } else if (existingSales.length > 0) {
          console.log(`Only inactive versions exist for: ${normalizedOrderNo} — skipping reinsertion.`);
          continue;
        }
      }



      const orderData = {...order};
      let distributor = {};
      if (marketplace.trim().toUpperCase().indexOf('SHOPIFY') !== -1) {
        let distributor_id = await getShopifyOrderDistributor(reference_code);
        if (distributor_id instanceof Error) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }

        distributor = await Distributor.findByPk(distributor_id);
        if (!distributor) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }
      } else if((marketplace.trim().toUpperCase().indexOf('AMAZON') !== -1)) {
        distributor.id = '214';
      } else if((marketplace.trim().toUpperCase()=='FLIPKART_ADVANTAGE')) {
        distributor.id = '1381';
      } else {
        distributor = await Distributor.findOne({ where: {[Op.or]: [{marketplace: marketplace}, {marketplace_id: marketplace_id}]} });
        if (!distributor) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }
      }
      
      if ((warehouse && warehouse.trim().toUpperCase() === 'AMAZON_FBA_TNJX_AUTO') || (warehouse_id && warehouse_id.toString().trim().toUpperCase() === '205776')) {
        warehouse = 'Mumbai';
        warehouse_id = '205199';
      }

      const depot = await Depot.findOne({ where: {[Op.or]: [{warehouse: warehouse}, {warehouse_id: warehouse_id}]} });
      if (!depot) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order.order_date,
          'remarks': `Depot for Warehouse (${warehouse}) & Warehouse Id (${warehouse_id}) not found in Depot Master.`
        });
        continue;
      }

      const order_date = orderData.order_date ? getDateString(new Date(orderData.order_date)) : '';
      if (!order_date) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': '',
          'remarks': `Purchase Date not found.`
        });
        continue;
      }

      const invoice_date = orderData.invoice_date ? getDateString(new Date(orderData.invoice_date)) : '';
      if (!invoice_date) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order_date,
          'remarks': `Invoice Date not found.`
        });
        continue;
      }

      const total_amount = orderData.total_amount ? parseFloat(orderData.total_amount) : 0;
      if(total_amount < 0){
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order_date,
          'remarks': `Total amount is ${total_amount}.`
        });
        continue;
      }
      
      let name = order.customer_name ? order.customer_name : '';
      let address = (order.address_line_1 ? order.address_line_1 : '') + ' ' +
        (order.address_line_2 ? order.address_line_2 : '');
      let city = order.city ? order.city : '';
      let pincode = order.pin_code ? order.pin_code : '';
      let state = order.state ? order.state : null;
      let country = order.country ? order.country : null;
      let mobileNo = order.contact_num ? order.contact_num : billing_mobile ? billing_mobile : '';
      let state_code = order.state_code ? order.state_code : 27;

      let totalOrderAmount = 0;
      let saleItemError = false;
      const saleItems = [];
      
      const orderItems = order.suborders ? order.suborders : order.order_items;
      for (const orderItem of orderItems) {
        const productName = orderItem.productName ? orderItem.productName : '';
        const sku = orderItem.sku ? orderItem.sku : '';
        const QuantityOrdered = orderItem.suborder_quantity ? parseFloat(orderItem.suborder_quantity) : 0;
        
        let depotState = '';
        let depotId = '';
        let taxType = 'Intra';
        let quantity = QuantityOrdered;
        if (depot) {
          depotId = depot.id;
          depotState = depot.state;
        }
        
        if (state.trim().toUpperCase() !== depotState.trim().toUpperCase()) {
          taxType = 'Inter';
        }

        const saleItem = {
          distributor_out_id: 0,
          type: 'Box',
          item_id: 0,
          qty: quantity,
          sell_rate: 0,
          grams: 0,
          rate: 0,
          discount: 0,
          discount_amt: 0,
          amount: 0,
          cgst_amt: 0,
          sgst_amt: 0,
          igst_amt: 0,
          tax_amt: 0,
          total_amt: 0,
          margin_per: 0,
          promo_margin: 0,
          gst: 'No',
          tax_percentage: 0,
          // fc_id: fulfillmentCenterId,
          depot_state: depotState,
          depot_id: depotId,
          tax_type: taxType,
          combo_box_id: 0,
          batch_no: 182,
          batch_qty: 0
        };

        const comboBox = await ComboBox.findOne({ 
          where: { sku_code: sku }, 
          include: [{model: ComboBoxItem, as: 'comboBoxItems', attributes: ['combo_box_id', 'type', 'item_id', 'qty', 'rate', 'grams']}] 
        });
        if (comboBox) {
          saleItem.combo_box_id = comboBox.id ? comboBox.id : 0;

          if (comboBox.gst && comboBox.gst.trim().toUpperCase() === 'YES') {
            saleItem.type = 'Combo Box';
            saleItem.item_id = comboBox.id ? comboBox.id : 0;
            saleItem.qty = saleItem.qty;
            saleItem.sell_rate = comboBox.rate ? parseFloat(comboBox.rate) : 0;
            saleItem.grams = comboBox.grams ? parseFloat(comboBox.grams) : 0;
            saleItem.rate = comboBox.rate ? parseFloat(comboBox.rate) : 0;
            saleItem.gst = 'No';
            saleItem.tax_percentage = comboBox.gst_rate ? parseFloat(comboBox.gst_rate) : 0;

            saleItems.push({...saleItem});
          } else {
            for (const comboBoxItem of comboBox.comboBoxItems) {
              saleItem.type = comboBoxItem.type ? comboBoxItem.type : 'Box';
              saleItem.item_id = comboBoxItem.item_id ? comboBoxItem.item_id : 0;
              saleItem.qty = comboBoxItem.qty ? (parseFloat(comboBoxItem.qty) * quantity) : saleItem.qty;
              saleItem.sell_rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
              saleItem.grams = comboBoxItem.grams ? parseFloat(comboBoxItem.grams) : 0;
              saleItem.rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
              saleItem.gst = comboBox.gst ? comboBox.gst : 'No';
              saleItem.tax_percentage = comboBox.gst && comboBox.gst === 'Yes' ? parseFloat(comboBox.gst_rate) : 0;
  
              if (saleItem.type.trim().toUpperCase() === "BOX") {
                const box = await Box.findByPk(saleItem.item_id);
                if (box) {
                  saleItem.type = 'Box';
                  saleItem.item_id = box.id ? box.id : 0;
                  saleItem.qty = saleItem.qty;
                  saleItem.sell_rate = box.rate ? parseFloat(box.rate) : 0;
                  saleItem.grams = box.grams ? parseFloat(box.grams) : 0;
                  saleItem.rate = box.rate ? parseFloat(box.rate) : 0;
                  if (saleItem.gst.trim().toUpperCase() === 'NO') {
                    saleItem.tax_percentage = box.tax_percentage ? parseFloat(box.tax_percentage) : saleItem.tax_percentage;
                  }
                } else {
                  const product = await Product.findByPk(saleItem.item_id);
                  if (product) {
                    saleItem.type = 'Bar';
                    saleItem.item_id = product.id ? product.id : 0;
                    saleItem.qty = saleItem.qty;
                    saleItem.sell_rate = product.rate ? parseFloat(product.rate) : 0;
                    saleItem.grams = product.grams ? parseFloat(product.grams) : 0;
                    saleItem.rate = product.rate ? parseFloat(product.rate) : 0;
                    if (saleItem.gst.trim().toUpperCase() === 'NO') {
                      saleItem.tax_percentage = product.tax_percentage ? parseFloat(product.tax_percentage) : saleItem.tax_percentage;
                    }
                  }
                }
              }
  
              saleItems.push({...saleItem});
            }
          }
        } else {
          const box = await Box.findOne({ where: { sku_code: sku } });
          if (box) {
            saleItem.type = 'Box';
            saleItem.item_id = box.id ? box.id : 0;
            saleItem.qty = saleItem.qty;
            saleItem.sell_rate = box.rate ? parseFloat(box.rate) : 0;
            saleItem.grams = box.grams ? parseFloat(box.grams) : 0;
            saleItem.rate = box.rate ? parseFloat(box.rate) : 0;
            saleItem.gst = 'No';
            saleItem.tax_percentage = box.tax_percentage ? parseFloat(box.tax_percentage) : 0;

            saleItems.push({...saleItem});
          } else {
            errorOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': `sku (${sku}) for product (${productName}) not found in Product Master.`
            });
            saleItemError = true;
          }
        }
      }

      if (saleItemError) {
        continue;
      }

      for (let index = 0; index < saleItems.length; index++) {
        const totalAmt = round(saleItems[index].qty * saleItems[index].sell_rate, 2);
        totalOrderAmount = totalOrderAmount + totalAmt;

        saleItems[index].amount = totalAmt;
        saleItems[index].total_amt = totalAmt;
      }

      const totalDiscountAmount = round(totalOrderAmount - total_amount, 2);
      let discount = 0;
      if (totalOrderAmount != 0) {
        discount = round((totalDiscountAmount / totalOrderAmount) * 100, 2);
      }

      if (order_status.trim().toUpperCase() === 'RETURNED') {
        const salesReturnData = [];

        for (const saleReturnItem of saleItems) {
          saleReturnItem.discount = discount;
  
          const finalSaleReturnItem = new SaleReturnItem({
            distributor_in_id: 0
          });
  
          finalSaleReturnItem.getRequestData(saleReturnItem);
  
          await finalSaleReturnItem.setItemAmount();
          
          const index = salesReturnData.findIndex(saleReturnData => saleReturnData.depot_id === saleReturnItem.depot_id);
  
          if (index === -1) {
            let order_no = normalizedOrderNo;
            if (salesReturnData.length !== 0) {
              order_no = order_no + '$' + salesReturnData.length.toString();
            }
            salesReturnData.push({
              order_no: order_no,
              depot_id: saleReturnItem.depot_id,
              fc_id: saleReturnItem.fc_id,
              tax_type: saleReturnItem.tax_type,
              saleReturnItems: [finalSaleReturnItem]
            });
          } else {
            salesReturnData[index].saleReturnItems.push(finalSaleReturnItem);
          }
        }

        const sale = await Sale.findOne({ where: { order_no: reference_code } });
  
        for (const saleReturnData of salesReturnData) {
          try {
            const finalSaleReturnItems = saleReturnData.saleReturnItems;
            const curDate = getDateTimeString(new Date());
            const saleReturn = new SaleReturn({
              date_of_processing: invoice_date,
              invoice_nos: sale && sale.invoice_no ? sale.invoice_no : '',
              depot_id: saleReturnData.depot_id,
              distributor_id: distributor.id,
              amount: 0,
              tax: 'gst',
              cst: 1,
              tax_amount: 0,
              final_amount: totalOrderAmount,
              due_date: curDate,
              order_no: saleReturnData.order_no,
              status: 'Pending',
              remarks: 'This is system generated entry.',
              modified_by: 421,
              modified_on: curDate,
              discount: discount,
              cgst: 1,
              sgst: 1,
              igst: 1,
              cgst_amount: 0,
              sgst_amount: 0,
              igst_amount: 0,
              round_off_amount: 0,
              sales_return_amount: 0,
              sales_return_date: invoice_date,
              sales_type: sale && sale.invoice_no ? 'Invoice' : 'Adhoc',
              shipping_charges: 0,
              created_by: 421,
              created_on: curDate,
              tax_type: saleReturnData.tax_type
            });
  
            let error = await saleReturn.setTransactionAmount(finalSaleReturnItems);
            if (error) {
              throw error;
            }
            
            saleReturn.status = 'Approved';
            saleReturn.approved_by = 421;
            saleReturn.approved_on = curDate;
  
            t = await sequelize.transaction();
  
            let series = 1;
            if (!saleReturn.sales_return_no) {
              series = await getSeries(req, 'Sales_Return');
              saleReturn.getSaleReturnNo(series.series);
              await series.save({ transaction: t });
            }
            
            await saleReturn.save({ transaction: t });
  
            for(const finalSaleReturnItem of finalSaleReturnItems) {
              finalSaleReturnItem.distributor_in_id = saleReturn.id;
              await finalSaleReturnItem.save({ transaction: t });
            }
  
            const finalSaleReturnItemProducts = await saleReturn.getSaleReturnItemProducts(finalSaleReturnItems);
            for(const saleReturnItemProduct of finalSaleReturnItemProducts) {
              const finalSaleReturnItemProduct = new SaleReturnItemProduct({...saleReturnItemProduct});
              finalSaleReturnItemProduct.distributor_in_id = saleReturn.id;
              finalSaleReturnItemProduct.setItemAmount();
              await finalSaleReturnItemProduct.save({ transaction: t });
            }
  
            series = await getSeries(req, 'Account_Voucher');
            await series.save({ transaction: t });

            const accLedgerEntry = { 
              ref_type: 'Distributor_Sales_Return',
              ref_id: saleReturn.id, 
              type: 'Credit', 
              voucher_id: series.series,
              invoice_no: null,
              ref_date: saleReturn.sales_return_date ? saleReturn.sales_return_date : saleReturn.date_of_processing,
              amount: saleReturn.sales_return_amount
            };
            
            const accountLedgerEntry1 = new AccountLedgerEntry(accLedgerEntry);
            const accountLedgerEntry2 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Debit' });
            const accountLedgerEntry3 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Debit' });
            
            await accountLedgerEntry1.setMainEntryData(saleReturn);
            accountLedgerEntry2.SetTaxableData(saleReturn);
            accountLedgerEntry3.SetTaxData(saleReturn);
            
            await accountLedgerEntry1.save({ transaction: t });
            await accountLedgerEntry2.save({ transaction: t });
            await accountLedgerEntry3.save({ transaction: t });
  
            if (saleReturn.shipping_charges) {
              const accountLedgerEntry4 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
              accountLedgerEntry4.SetShippingData(saleReturn);
              await accountLedgerEntry4.save({ transaction: t });
            }
            
            await t.commit();
  
            uploadedOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': 'Success'
            });
          } catch (error) {
            console.log(error);
            if (t) {
              await t.rollback();
            }
  
            errorOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': error.message
            });
          }
        }
      }
      //  else {

        const salesData = [];
        for (const saleItem of saleItems) {
          saleItem.discount = discount;
  
          const finalSaleItem = new SaleItem({
            distributor_out_id: 0
          });
  
          finalSaleItem.getRequestData(saleItem);
  
          await finalSaleItem.setItemAmount();
          
          const index = salesData.findIndex(saleData => saleData.depot_id === saleItem.depot_id);
  
          if (index === -1) {
            let order_no = normalizedOrderNo;
            if (salesData.length !== 0) {
              order_no = order_no + '$' + salesData.length.toString();
            }
            
            salesData.push({
              order_no: order_no,
              depot_id: saleItem.depot_id,
              fc_id: saleItem.fc_id,
              tax_type: saleItem.tax_type,
              saleItems: [finalSaleItem]
            });
          } else {
            salesData[index].saleItems.push(finalSaleItem);
          }
        }
  
        for (const saleData of salesData) {
          try {
            // const finalSaleItems = saleData.saleItems.map(saleItem => {
            //   return {
            //     distributor_out_id: saleItem.distributor_out_id,
            //     type: saleItem.type,
            //     item_id: saleItem.item_id,
            //     grams: saleItem.grams,
            //     qty: saleItem.qty,
            //     rate: saleItem.rate,
            //     discount: saleItem.discount,
            //     sell_rate: saleItem.sell_rate,
            //     tax_percentage: saleItem.tax_percentage,
            //     amount: saleItem.amount,
            //     cgst_amt: saleItem.cgst_amt,
            //     sgst_amt: saleItem.sgst_amt,
            //     igst_amt: saleItem.igst_amt,
            //     tax_amt: saleItem.tax_amt,
            //     total_amt: saleItem.total_amt,
            //     batch_no: saleItem.batch_no,
            //     batch_qty: saleItem.qty,
            //     margin_per: saleItem.margin_per,
            //     promo_margin: saleItem.promo_margin,
            //     combo_box_id: saleItem.combo_box_id,
            //     discount_amt: saleItem.discount_amt
            //   };
            // });
  
            const finalSaleItems = saleData.saleItems;
  
            // const costAmount = finalSaleItems.reduce((costAmount, finalSaleItem) => {
            //   return costAmount += finalSaleItem.costAmount;
            // }, 0);
  
            const curDate = getDateTimeString(new Date());
  
            let con_name = '';
            let con_address = '';
            let con_city = '';
            let con_pincode = '';
            let con_state = '';
            let con_country = '';
            let con_state_code = '';
            let con_gst_number = '';
            if (state_code && billing_state_code && state && billing_state && pincode && billing_pin_code && state_code.trim().toUpperCase() !== billing_state_code.trim().toUpperCase() && state.trim().toUpperCase() !== billing_state.trim().toUpperCase() && pincode.trim().toUpperCase() !== billing_pin_code.trim().toUpperCase()) {
              con_name = name;
              con_address = address;
              con_city = city;
              con_pincode = pincode;
              con_state = state;
              con_country = country;
              con_state_code = state_code;
              con_gst_number = '';
            }
  
            let client_name = name;
            if (order_type.trim().toUpperCase() === 'B2B') {
              client_name = order.company_name ? order.company_name : billing_name ? billing_name : name;
            }
  
            const sale = new Sale({
              date_of_processing: order_date,
              invoice_no: '',
              depot_id: saleData.depot_id,
              distributor_id: distributor.id,
              amount: 0,
              tax: 'gst',
              tax_per: 1,
              tax_amount: 0,
              final_amount: totalOrderAmount,
              due_date: curDate,
              order_no: saleData.order_no,
              order_date: order_date,
              status: 'Pending',
              remarks: 'This is system generated entry.',
              modified_by: 421,
              modified_on: curDate,
              client_name: client_name,
              address: billing_address,
              city: billing_city,
              pincode: billing_pin_code,
              state: billing_state,
              country: billing_country,
              mobileNo: mobileNo,
              con_name: con_name,
              con_address: con_address,
              con_city: con_city,
              con_pincode: con_pincode,
              con_state: con_state,
              con_state_code: con_state_code,
              con_country: con_country,
              con_gst_number: con_gst_number,
              discount: discount,
              date_of_dispatch: date_of_dispatch,
              delivery_status: delivery_status,
              delivery_date: delivery_date,
              delivery_sales_rep_id: 104,
              transport_type: '',
              vehicle_number: '',
              cgst: 1,
              sgst: 1,
              igst: 1,
              cgst_amount: 0,
              sgst_amount: 0,
              igst_amount: 0,
              reverse_charge: 'no',
              shipping_address: 'yes',
              state_code: state_code,
              round_off_amount: 0,
              invoice_amount: 0,
              invoice_date: invoice_date,
              email_date_time: (orderData.order_date ? getDateTimeString(new Date(orderData.order_date)) : null),
              basis_of_sales: 'PO Number',
              email_from: '',
              email_approved_by: '',
              gstin: buyer_gst,
              shipping_charges: 0,
              despatch_through: courier,
              tracking_id: awb_number,
              created_by: 421,
              created_on: curDate,
              tax_type: saleData.tax_type
            });
  
            let error = await sale.setTransactionAmount(finalSaleItems);
            if (error) {
              throw error;
            }
  
            // const message = await Stock.checkStock('Sale', sale);
            // if (message instanceof Error) throw message;
            // if (message) {
            //   errorOrders.push({
            //     'order_no': reference_code,
            //     'order_date': order_date,
            //     'remarks': message
            //   });
            //   continue;
            // }
  
            // error = sale.approve(req);
            // if (error) {
            //   throw error;
            // }
  
            sale.status = 'Approved';
            sale.approved_by = 421;
            sale.approved_on = curDate;
  
            t = await sequelize.transaction();
  
            let series = 1;
            if (!sale.invoice_no) {
              series = await getSeries(req, 'Tax_Invoice');
              sale.getInvoiceNo(series.series);
              await series.save({ transaction: t });
            }
  
            await sale.save({ transaction: t });
  
            for(const finalSaleItem of finalSaleItems) {
              finalSaleItem.distributor_out_id = sale.id;
              await finalSaleItem.save({ transaction: t });
            }
  
            const finalSaleItemProducts = await sale.getSaleItemProducts(finalSaleItems);
            for(const saleItemProduct of finalSaleItemProducts) {
              const finalSaleItemProduct = new SaleItemProduct({...saleItemProduct});
              finalSaleItemProduct.distributor_out_id = sale.id;
              finalSaleItemProduct.setItemAmount();
              await finalSaleItemProduct.save({ transaction: t });
            }
  
            series = await getSeries(req, 'Account_Voucher');
            await series.save({ transaction: t });
  
            const accLedgerEntry = { 
              ref_type: 'Distributor_Sales',
              ref_id: sale.id, 
              type: 'Debit', 
              voucher_id: series.series, 
              invoice_no: sale.invoice_no,
              ref_date: sale.invoice_date ? sale.invoice_date : sale.date_of_processing,
              amount: sale.invoice_amount
            };
            
            const accountLedgerEntry1 = new AccountLedgerEntry(accLedgerEntry);
            const accountLedgerEntry2 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
            const accountLedgerEntry3 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
            
            await accountLedgerEntry1.setMainEntryData(sale);
            accountLedgerEntry2.SetTaxableData(sale);
            accountLedgerEntry3.SetTaxData(sale);
            
            await accountLedgerEntry1.save({ transaction: t });
            await accountLedgerEntry2.save({ transaction: t });
            await accountLedgerEntry3.save({ transaction: t });
  
            if (sale.shipping_charges) {
              const accountLedgerEntry4 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
              accountLedgerEntry4.SetShippingData(sale);
              await accountLedgerEntry4.save({ transaction: t });
            }
  
            // console.log(sale);
  
            // await Stock.deleteMany({ stockType: 'Sale', sale: sale.id }, { session });
            // error = await Stock.setStockDetails('Sale', sale, session, req);
            // if (error) throw error;
  
            // error = await Product.setStock('Sale', sale, session);
            // if (error instanceof Error) throw error;
  
            await t.commit();
  
            uploadedOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': 'Success'
            });
          } catch (error) {
            console.log(error);
            if (t) {
              await t.rollback();
            }
  
            errorOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': error.message
            });
          }
        }

      // }
    }

    if (errorOrders.length > 0) {
      sendOrderEmail(errorOrders);
    }

    // console.log('Success');
    if (res) {
      res.status(200).json({ 
        message: 'Easy Ecom Orders fetched. ', 
        'Total No Of Orders': orders.length, 
        'Uploaded Orders': uploadedOrders.length, 
        'Error Orders': errorOrders.length, 
        uploadedOrders: uploadedOrders, 
        errorOrders: errorOrders, 
        orders: orders 
      });
    } else {
      logger.log({
        level: "info",
        message: "Easy Ecom API Cron For Orders On - " + new Date().toLocaleString(),
        // stack: err.stack,
        metadata: { orders: orders.length, uploadedOrders: uploadedOrders.length, errorOrders: errorOrders.length }, // Put what you like as meta
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Downloading Easy Ecom Orders Failed! Error - " + (error.message ? error.message : '')
    });

    sendOrderFetchingFailedEmail(error);

    res.statusCode = 500;
    res.message = "Downloading Easy Ecom Orders failed!";
    next(error, req, res);
  }
};

export const getAllOrders = async (req, res, next) => {
  let t;

  try {
    const user = await User.findByPk(421);
    if (user) {
      req.userData = {
        email: user.email_id,
        userId: user.id,
        userRoleId: user.role_id,
        roleDetails: {}
      };
    } else {
      throw new Error(`User with id (421) not found in User Master.`);
    }
    
    let nextUrl = '';
    const orders = [];
    let apiCnt = 0;

    let startDate = req.query.startDate ? req.query.startDate : '';
    let endDate = req.query.endDate ? req.query.endDate : '';

    if (!startDate) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 5);
    } else {
      startDate = new Date(startDate);
    }
    if (!endDate) {
      endDate = new Date();
    } else {
      endDate = new Date(endDate);
    }
    
    //startDate = new Date('2025-04-24T19:00:00Z');
    //endDate = new Date('2025-04-27T00:00:00Z');
    startDate = startDate.toISOString();
    endDate = endDate.toISOString();

    const easyEcomApi = new EasyEcomApi('ee41972946129');
    const errorOrders = [];
    const uploadedOrders = [];

    do {
      let fetchedOrders = await easyEcomApi.getOrders(startDate, endDate, nextUrl);
      if (!fetchedOrders || fetchedOrders instanceof Error || !fetchedOrders.orders) {
        throw fetchedOrders;
      }
      orders.push(...fetchedOrders.orders);
      nextUrl = fetchedOrders.nextUrl ? fetchedOrders.nextUrl : '';

      await new Promise(resolve => setTimeout(resolve, 500)); 
    } while (nextUrl !== '');
    

    for (const order of orders) {
      const marketplace = order.marketplace?.trim().toUpperCase();
      const marketplace_id = order.marketplace_id;
      if (!marketplace || marketplace.trim().toUpperCase().indexOf('MEESHO-API') !== -1 || marketplace.trim().toUpperCase().indexOf('OFFLINE') !== -1) {
        continue;
      }
      const reference_code = order.reference_code?.trim();
      let warehouse = order.company_name ? order.company_name : order.assigned_company_name ? order.assigned_company_name : '';
      let warehouse_id = order.warehouseId ? order.warehouseId : order.assigned_warehouse_id ? order.assigned_warehouse_id : 0;
      const order_status = order.order_status.trim().toUpperCase();
      const order_type = order.order_type;
      const IsBusinessOrder = (order_type === 'B2B') ? 1 : 0;
      const replacement_order = order.replacement_order;
      const courier = order.courier;
      const awb_number = order.awb_number && order.awb_number != null ? order.awb_number : '';
      const payment_mode = order.payment_mode;
      const buyer_gst = order.buyer_gst && order.buyer_gst != 'NA' && order.buyer_gst != '0' ? order.buyer_gst : '';
      const email = order.email;
      const billing_name = order.billing_name;
      let billing_address = (order.billing_address_1 ? order.billing_address_1 : '') + ' ' + (order.billing_address_2 ? order.billing_address_2 : '');
      const billing_city = order.billing_city;
      const billing_state = order.billing_state;
      const billing_state_code = order.billing_state_code;
      const billing_pin_code = order.billing_pin_code;
      const billing_country = order.billing_country && order.billing_country != null ? order.billing_country : (order.country ? order.country : '');
      const billing_mobile = order.billing_mobile;
      const total_tax = order.total_tax;
      const total_shipping_charge = order.total_shipping_charge;
      const total_discount = order.total_discount;
      const suborders = order.suborders;
      const shipping_status = order.shipping_status ? order.shipping_status?.trim().toUpperCase() : '';
      const delivery_status = (shipping_status === 'DELIVERED' || shipping_status === 'RTO DELIVERED') ? 'Delivered' : (order_status === 'SHIPPED' ? 'GP Issued' : 'Pending');
      const date_of_dispatch = order.manifest_date && order.manifest_date !== '0000-00-00 00:00:00' ? new Date(order.manifest_date).toISOString() : null;
      const delivery_date = order.delivery_date && order.delivery_date !== '0000-00-00 00:00:00' ? new Date(order.delivery_date).toISOString() : null;

      let placeOrder = false;
      if (order_status === 'ASSIGNED' || order_status === 'CONFIRMED' || 
          order_status === 'PRINTED' || order_status === 'MANIFEST SCANNED' || 
          order_status === 'READY TO DISPATCH' || order_status === 'SHIPPED' || 
          order_status === 'CANCELLED' || order_status === 'RETURNED') {
            placeOrder = true;
      }

      if (placeOrder === false) {
        continue;
      }

      let normalizedOrderNo = reference_code;

      if (marketplace.includes('SHOPIFY')) {
        const shopifyOrderNo = getShopifyOrderNo(reference_code);
        normalizedOrderNo = shopifyOrderNo ? shopifyOrderNo.replace("#","") : normalizedOrderNo;
      }   
      
      // More robust duplicate check using LIKE pattern to catch suffixed order numbers (e.g., ORDER123$1)
           
      // New Code By Saurabh
      const existingSales = await Sale.findAll({
        where: {
          order_no: {
            [Op.or]: [
              normalizedOrderNo,
              { [Op.like]: `${normalizedOrderNo}%` }
            ]
          }
        }
      });

      if (order_status === 'RETURNED') {
        const saleReturnExists = await SaleReturn.findOne({
          where: {
            order_no: {
              [Op.or]: [
                normalizedOrderNo,
                { [Op.like]: `${normalizedOrderNo}$%` }
              ]
            }
          }
        });

        if (saleReturnExists) {
          console.log(`Duplicate return skipped: ${normalizedOrderNo}`);
          continue; // already processed
        }
      } else if (order_status === 'CANCELLED') {
        if (existingSales.length > 0) {
          for (const sale of existingSales) {
            if (sale.status && sale.status.trim().toUpperCase() !== 'INACTIVE') {
              sale.status = 'InActive';
              await sale.save();
              await AccountLedgerEntry.update(
                { status: 'InActive' },
                { where: { ref_type: 'Distributor_Sales', ref_id: sale.id } }
              );
            }
          }
        }
        console.log(`Cancelled order deactivated: ${normalizedOrderNo}`);
        continue;
      } else {
        // if (existingSales.length > 0) {
        //   const sale = existingSales[0];
        //   if (sale.status !== 'InActive' && sale.delivery_status?.trim().toUpperCase() !== delivery_status.toUpperCase()) {
        //     sale.delivery_status = delivery_status;
        //     sale.date_of_dispatch = date_of_dispatch;
        //     sale.delivery_date = delivery_date;
        //     await sale.save();
        //   }
        //   console.log(`Duplicate order skipped: ${normalizedOrderNo}`);
        //   continue; // already exists
        // }
        const activeSale = existingSales.find(s => s.status?.trim().toUpperCase() !== 'INACTIVE');
        if (activeSale) {
          if (activeSale.delivery_status?.trim().toUpperCase() !== delivery_status.toUpperCase()) {
            activeSale.delivery_status = delivery_status;
            activeSale.date_of_dispatch = date_of_dispatch;
            activeSale.delivery_date = delivery_date;
            await activeSale.save();
          }
          console.log(`Duplicate active order skipped: ${normalizedOrderNo}`);
          continue;
        } else if (existingSales.length > 0) {
          console.log(`Only inactive versions exist for: ${normalizedOrderNo} — skipping reinsertion.`);
          continue;
        }
      }



      const orderData = {...order};
      let distributor = {};
      if (marketplace.trim().toUpperCase().indexOf('SHOPIFY') !== -1) {
        let distributor_id = await getShopifyOrderDistributor(reference_code);
        if (distributor_id instanceof Error) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }

        distributor = await Distributor.findByPk(distributor_id);
        if (!distributor) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }
      } else if((marketplace.trim().toUpperCase().indexOf('AMAZON') !== -1)) {
        distributor.id = '214';
      } else if((marketplace.trim().toUpperCase()=='FLIPKART_ADVANTAGE')) {
        distributor.id = '1381';
      } else {

        // Old Code
        // distributor = await Distributor.findOne({ where: {[Op.or]: [{marketplace: marketplace}, {marketplace_id: marketplace_id}]} });
        
        // New Code By Saurabh 
        // Search Value of marketplace of marketplace_id from Comma-Separated string By marketplace or marketplace_id 
        distributor = await Distributor.findOne({
          where: {
            [Op.or]: [
              // marketplace search (case-insensitive, space-safe)
              Sequelize.where(
                Sequelize.fn(
                  "FIND_IN_SET",
                  Sequelize.fn("LOWER", marketplace),
                  Sequelize.fn(
                    "LOWER",
                    Sequelize.literal(`REPLACE(marketplace, ' ', '')`)
                  )
                ),
                { [Op.gt]: 0 }
              ),

              // marketplace_id search (space-safe, exact)
              Sequelize.where(
                Sequelize.fn(
                  "FIND_IN_SET",
                  marketplace_id.toString(),
                  Sequelize.literal(`REPLACE(marketplace_id, ' ', '')`)
                ),
                { [Op.gt]: 0 }
              )
            ]
          }
        });

        // New Code By Saurabh 


        if (!distributor) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }
      }
      
      if ((warehouse && warehouse.trim().toUpperCase() === 'AMAZON_FBA_TNJX_AUTO') || (warehouse_id && warehouse_id.toString().trim().toUpperCase() === '205776')) {
        warehouse = 'Mumbai';
        warehouse_id = '205199';
      }

      // Old Code
      // const depot = await Depot.findOne({ where: {[Op.or]: [{warehouse: warehouse}, {warehouse_id: warehouse_id}]} });

      // New Code By Saurabh

      // Search Value of warehouse of warehouse_id from Comma-Separated string By warehouse or warehouse_id
      const depot = await Depot.findOne({
        where: {
          [Op.or]: [
            // warehouse search (case-insensitive, space-safe)
            Sequelize.where(
              Sequelize.fn(
                "FIND_IN_SET",
                Sequelize.fn("LOWER", warehouse),
                Sequelize.fn(
                  "LOWER",
                  Sequelize.literal(`REPLACE(warehouse, ' ', '')`)
                )
              ),
              { [Op.gt]: 0 }
            ),

            // warehouse_id search (space-safe, exact)
            Sequelize.where(
              Sequelize.fn(
                "FIND_IN_SET",
                warehouse_id.toString(),
                Sequelize.literal(`REPLACE(warehouse_id, ' ', '')`)
              ),
              { [Op.gt]: 0 }
            )
          ]
        }
      });

      // New Code By Saurabh


      if (!depot) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order.order_date,
          'remarks': `Depot for Warehouse (${warehouse}) & Warehouse Id (${warehouse_id}) not found in Depot Master.`
        });
        continue;
      }

      const order_date = orderData.order_date ? getDateString(new Date(orderData.order_date)) : '';
      if (!order_date) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': '',
          'remarks': `Purchase Date not found.`
        });
        continue;
      }

      const invoice_date = orderData.invoice_date ? getDateString(new Date(orderData.invoice_date)) : '';
      if (!invoice_date) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order_date,
          'remarks': `Invoice Date not found.`
        });
        continue;
      }

      const total_amount = orderData.total_amount ? parseFloat(orderData.total_amount) : 0;
      if(total_amount < 0){
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order_date,
          'remarks': `Total amount is ${total_amount}.`
        });
        continue;
      }
      
      let name = order.customer_name ? order.customer_name : '';
      let address = (order.address_line_1 ? order.address_line_1 : '') + ' ' +
        (order.address_line_2 ? order.address_line_2 : '');
      let city = order.city ? order.city : '';
      let pincode = order.pin_code ? order.pin_code : '';
      let state = order.state ? order.state : null;
      let country = order.country ? order.country : null;
      let mobileNo = order.contact_num ? order.contact_num : billing_mobile ? billing_mobile : '';
      let state_code = order.state_code ? order.state_code : 27;

      let totalOrderAmount = 0;
      let saleItemError = false;
      const saleItems = [];
      
      const orderItems = order.suborders ? order.suborders : order.order_items;
      for (const orderItem of orderItems) {
        const productName = orderItem.productName ? orderItem.productName : '';
        const sku = orderItem.sku ? orderItem.sku : '';
        const QuantityOrdered = orderItem.suborder_quantity ? parseFloat(orderItem.suborder_quantity) : 0;
        
        let depotState = '';
        let depotId = '';
        let taxType = 'Intra';
        let quantity = QuantityOrdered;
        if (depot) {
          depotId = depot.id;
          depotState = depot.state;
        }
        
        if (state.trim().toUpperCase() !== depotState.trim().toUpperCase()) {
          taxType = 'Inter';
        }

        const saleItem = {
          distributor_out_id: 0,
          type: 'Box',
          item_id: 0,
          qty: quantity,
          sell_rate: 0,
          grams: 0,
          rate: 0,
          discount: 0,
          discount_amt: 0,
          amount: 0,
          cgst_amt: 0,
          sgst_amt: 0,
          igst_amt: 0,
          tax_amt: 0,
          total_amt: 0,
          margin_per: 0,
          promo_margin: 0,
          gst: 'No',
          tax_percentage: 0,
          // fc_id: fulfillmentCenterId,
          depot_state: depotState,
          depot_id: depotId,
          tax_type: taxType,
          combo_box_id: 0,
          batch_no: 182,
          batch_qty: 0
        };

        const comboBox = await ComboBox.findOne({ 
          where: { sku_code: sku }, 
          include: [{model: ComboBoxItem, as: 'comboBoxItems', attributes: ['combo_box_id', 'type', 'item_id', 'qty', 'rate', 'grams']}] 
        });
        if (comboBox) {
          saleItem.combo_box_id = comboBox.id ? comboBox.id : 0;

          if (comboBox.gst && comboBox.gst.trim().toUpperCase() === 'YES') {
            saleItem.type = 'Combo Box';
            saleItem.item_id = comboBox.id ? comboBox.id : 0;
            saleItem.qty = saleItem.qty;
            saleItem.sell_rate = comboBox.rate ? parseFloat(comboBox.rate) : 0;
            saleItem.grams = comboBox.grams ? parseFloat(comboBox.grams) : 0;
            saleItem.rate = comboBox.rate ? parseFloat(comboBox.rate) : 0;
            saleItem.gst = 'No';
            saleItem.tax_percentage = comboBox.gst_rate ? parseFloat(comboBox.gst_rate) : 0;

            saleItems.push({...saleItem});
          } else {
            for (const comboBoxItem of comboBox.comboBoxItems) {
              saleItem.type = comboBoxItem.type ? comboBoxItem.type : 'Box';
              saleItem.item_id = comboBoxItem.item_id ? comboBoxItem.item_id : 0;
              saleItem.qty = comboBoxItem.qty ? (parseFloat(comboBoxItem.qty) * quantity) : saleItem.qty;
              saleItem.sell_rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
              saleItem.grams = comboBoxItem.grams ? parseFloat(comboBoxItem.grams) : 0;
              saleItem.rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
              saleItem.gst = comboBox.gst ? comboBox.gst : 'No';
              saleItem.tax_percentage = comboBox.gst && comboBox.gst === 'Yes' ? parseFloat(comboBox.gst_rate) : 0;
  
              if (saleItem.type.trim().toUpperCase() === "BOX") {
                const box = await Box.findByPk(saleItem.item_id);
                if (box) {
                  saleItem.type = 'Box';
                  saleItem.item_id = box.id ? box.id : 0;
                  saleItem.qty = saleItem.qty;
                  saleItem.sell_rate = box.rate ? parseFloat(box.rate) : 0;
                  saleItem.grams = box.grams ? parseFloat(box.grams) : 0;
                  saleItem.rate = box.rate ? parseFloat(box.rate) : 0;
                  if (saleItem.gst.trim().toUpperCase() === 'NO') {
                    saleItem.tax_percentage = box.tax_percentage ? parseFloat(box.tax_percentage) : saleItem.tax_percentage;
                  }
                } else {
                  const product = await Product.findByPk(saleItem.item_id);
                  if (product) {
                    saleItem.type = 'Bar';
                    saleItem.item_id = product.id ? product.id : 0;
                    saleItem.qty = saleItem.qty;
                    saleItem.sell_rate = product.rate ? parseFloat(product.rate) : 0;
                    saleItem.grams = product.grams ? parseFloat(product.grams) : 0;
                    saleItem.rate = product.rate ? parseFloat(product.rate) : 0;
                    if (saleItem.gst.trim().toUpperCase() === 'NO') {
                      saleItem.tax_percentage = product.tax_percentage ? parseFloat(product.tax_percentage) : saleItem.tax_percentage;
                    }
                  }
                }
              }
  
              saleItems.push({...saleItem});
            }
          }
        } else {
          const box = await Box.findOne({ where: { sku_code: sku } });
          if (box) {
            saleItem.type = 'Box';
            saleItem.item_id = box.id ? box.id : 0;
            saleItem.qty = saleItem.qty;
            saleItem.sell_rate = box.rate ? parseFloat(box.rate) : 0;
            saleItem.grams = box.grams ? parseFloat(box.grams) : 0;
            saleItem.rate = box.rate ? parseFloat(box.rate) : 0;
            saleItem.gst = 'No';
            saleItem.tax_percentage = box.tax_percentage ? parseFloat(box.tax_percentage) : 0;

            saleItems.push({...saleItem});
          } else {
            errorOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': `sku (${sku}) for product (${productName}) not found in Product Master.`
            });
            saleItemError = true;
          }
        }
      }

      if (saleItemError) {
        continue;
      }

      for (let index = 0; index < saleItems.length; index++) {
        const totalAmt = round(saleItems[index].qty * saleItems[index].sell_rate, 2);
        totalOrderAmount = totalOrderAmount + totalAmt;

        saleItems[index].amount = totalAmt;
        saleItems[index].total_amt = totalAmt;
      }

      const totalDiscountAmount = round(totalOrderAmount - total_amount, 2);
      let discount = 0;
      if (totalOrderAmount != 0) {
        discount = round((totalDiscountAmount / totalOrderAmount) * 100, 2);
      }

      if (order_status.trim().toUpperCase() === 'RETURNED') {
        const salesReturnData = [];

        for (const saleReturnItem of saleItems) {
          saleReturnItem.discount = discount;
  
          const finalSaleReturnItem = new SaleReturnItem({
            distributor_in_id: 0
          });
  
          finalSaleReturnItem.getRequestData(saleReturnItem);
  
          await finalSaleReturnItem.setItemAmount();
          
          const index = salesReturnData.findIndex(saleReturnData => saleReturnData.depot_id === saleReturnItem.depot_id);
  
          if (index === -1) {
            let order_no = normalizedOrderNo;
            if (salesReturnData.length !== 0) {
              order_no = order_no + '$' + salesReturnData.length.toString();
            }
            salesReturnData.push({
              order_no: order_no,
              depot_id: saleReturnItem.depot_id,
              fc_id: saleReturnItem.fc_id,
              tax_type: saleReturnItem.tax_type,
              saleReturnItems: [finalSaleReturnItem]
            });
          } else {
            salesReturnData[index].saleReturnItems.push(finalSaleReturnItem);
          }
        }

        const sale = await Sale.findOne({ where: { order_no: reference_code } });
  
        for (const saleReturnData of salesReturnData) {
          try {
            const finalSaleReturnItems = saleReturnData.saleReturnItems;
            const curDate = getDateTimeString(new Date());
            const saleReturn = new SaleReturn({
              date_of_processing: invoice_date,
              invoice_nos: sale && sale.invoice_no ? sale.invoice_no : '',
              depot_id: saleReturnData.depot_id,
              distributor_id: distributor.id,
              amount: 0,
              tax: 'gst',
              cst: 1,
              tax_amount: 0,
              final_amount: totalOrderAmount,
              due_date: curDate,
              order_no: saleReturnData.order_no,
              status: 'Pending',
              remarks: 'This is system generated entry.',
              modified_by: 421,
              modified_on: curDate,
              discount: discount,
              cgst: 1,
              sgst: 1,
              igst: 1,
              cgst_amount: 0,
              sgst_amount: 0,
              igst_amount: 0,
              round_off_amount: 0,
              sales_return_amount: 0,
              sales_return_date: invoice_date,
              sales_type: sale && sale.invoice_no ? 'Invoice' : 'Adhoc',
              shipping_charges: 0,
              created_by: 421,
              created_on: curDate,
              tax_type: saleReturnData.tax_type
            });
  
            let error = await saleReturn.setTransactionAmount(finalSaleReturnItems);
            if (error) {
              throw error;
            }
            
            saleReturn.status = 'Approved';
            saleReturn.approved_by = 421;
            saleReturn.approved_on = curDate;
  
            t = await sequelize.transaction();
  
            let series = 1;
            if (!saleReturn.sales_return_no) {
              series = await getSeries(req, 'Sales_Return');
              saleReturn.getSaleReturnNo(series.series);
              await series.save({ transaction: t });
            }
            
            await saleReturn.save({ transaction: t });
  
            for(const finalSaleReturnItem of finalSaleReturnItems) {
              finalSaleReturnItem.distributor_in_id = saleReturn.id;
              await finalSaleReturnItem.save({ transaction: t });
            }
  
            const finalSaleReturnItemProducts = await saleReturn.getSaleReturnItemProducts(finalSaleReturnItems);
            for(const saleReturnItemProduct of finalSaleReturnItemProducts) {
              const finalSaleReturnItemProduct = new SaleReturnItemProduct({...saleReturnItemProduct});
              finalSaleReturnItemProduct.distributor_in_id = saleReturn.id;
              finalSaleReturnItemProduct.setItemAmount();
              await finalSaleReturnItemProduct.save({ transaction: t });
            }
  
            series = await getSeries(req, 'Account_Voucher');
            await series.save({ transaction: t });

            const accLedgerEntry = { 
              ref_type: 'Distributor_Sales_Return',
              ref_id: saleReturn.id, 
              type: 'Credit', 
              voucher_id: series.series,
              invoice_no: null,
              ref_date: saleReturn.sales_return_date ? saleReturn.sales_return_date : saleReturn.date_of_processing,
              amount: saleReturn.sales_return_amount
            };
            
            const accountLedgerEntry1 = new AccountLedgerEntry(accLedgerEntry);
            const accountLedgerEntry2 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Debit' });
            const accountLedgerEntry3 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Debit' });
            
            await accountLedgerEntry1.setMainEntryData(saleReturn);
            accountLedgerEntry2.SetTaxableData(saleReturn);
            accountLedgerEntry3.SetTaxData(saleReturn);
            
            await accountLedgerEntry1.save({ transaction: t });
            await accountLedgerEntry2.save({ transaction: t });
            await accountLedgerEntry3.save({ transaction: t });
  
            if (saleReturn.shipping_charges) {
              const accountLedgerEntry4 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
              accountLedgerEntry4.SetShippingData(saleReturn);
              await accountLedgerEntry4.save({ transaction: t });
            }
            
            await t.commit();
  
            uploadedOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': 'Success'
            });
          } catch (error) {
            console.log(error);
            if (t) {
              await t.rollback();
            }
  
            errorOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': error.message
            });
          }
        }
      }
      //  else {

        const salesData = [];
        for (const saleItem of saleItems) {
          saleItem.discount = discount;
  
          const finalSaleItem = new SaleItem({
            distributor_out_id: 0
          });
  
          finalSaleItem.getRequestData(saleItem);
  
          await finalSaleItem.setItemAmount();
          
          const index = salesData.findIndex(saleData => saleData.depot_id === saleItem.depot_id);
  
          if (index === -1) {
            let order_no = normalizedOrderNo;
            if (salesData.length !== 0) {
              order_no = order_no + '$' + salesData.length.toString();
            }
            
            salesData.push({
              order_no: order_no,
              depot_id: saleItem.depot_id,
              fc_id: saleItem.fc_id,
              tax_type: saleItem.tax_type,
              saleItems: [finalSaleItem]
            });
          } else {
            salesData[index].saleItems.push(finalSaleItem);
          }
        }
  
        for (const saleData of salesData) {
          try {
            // const finalSaleItems = saleData.saleItems.map(saleItem => {
            //   return {
            //     distributor_out_id: saleItem.distributor_out_id,
            //     type: saleItem.type,
            //     item_id: saleItem.item_id,
            //     grams: saleItem.grams,
            //     qty: saleItem.qty,
            //     rate: saleItem.rate,
            //     discount: saleItem.discount,
            //     sell_rate: saleItem.sell_rate,
            //     tax_percentage: saleItem.tax_percentage,
            //     amount: saleItem.amount,
            //     cgst_amt: saleItem.cgst_amt,
            //     sgst_amt: saleItem.sgst_amt,
            //     igst_amt: saleItem.igst_amt,
            //     tax_amt: saleItem.tax_amt,
            //     total_amt: saleItem.total_amt,
            //     batch_no: saleItem.batch_no,
            //     batch_qty: saleItem.qty,
            //     margin_per: saleItem.margin_per,
            //     promo_margin: saleItem.promo_margin,
            //     combo_box_id: saleItem.combo_box_id,
            //     discount_amt: saleItem.discount_amt
            //   };
            // });
  
            const finalSaleItems = saleData.saleItems;
  
            // const costAmount = finalSaleItems.reduce((costAmount, finalSaleItem) => {
            //   return costAmount += finalSaleItem.costAmount;
            // }, 0);
  
            const curDate = getDateTimeString(new Date());
  
            let con_name = '';
            let con_address = '';
            let con_city = '';
            let con_pincode = '';
            let con_state = '';
            let con_country = '';
            let con_state_code = '';
            let con_gst_number = '';
            if (state_code && billing_state_code && state && billing_state && pincode && billing_pin_code && state_code.trim().toUpperCase() !== billing_state_code.trim().toUpperCase() && state.trim().toUpperCase() !== billing_state.trim().toUpperCase() && pincode.trim().toUpperCase() !== billing_pin_code.trim().toUpperCase()) {
              con_name = name;
              con_address = address;
              con_city = city;
              con_pincode = pincode;
              con_state = state;
              con_country = country;
              con_state_code = state_code;
              con_gst_number = '';
            }
  
            let client_name = name;
            if (order_type.trim().toUpperCase() === 'B2B') {
              client_name = order.company_name ? order.company_name : billing_name ? billing_name : name;
            }
  
            const sale = new Sale({
              date_of_processing: order_date,
              invoice_no: '',
              depot_id: saleData.depot_id,
              distributor_id: distributor.id,
              amount: 0,
              tax: 'gst',
              tax_per: 1,
              tax_amount: 0,
              final_amount: totalOrderAmount,
              due_date: curDate,
              order_no: saleData.order_no,
              order_date: order_date,
              status: 'Pending',
              remarks: 'This is system generated entry.',
              modified_by: 421,
              modified_on: curDate,
              client_name: client_name,
              address: billing_address,
              city: billing_city,
              pincode: billing_pin_code,
              state: billing_state,
              country: billing_country,
              mobileNo: mobileNo,
              con_name: con_name,
              con_address: con_address,
              con_city: con_city,
              con_pincode: con_pincode,
              con_state: con_state,
              con_state_code: con_state_code,
              con_country: con_country,
              con_gst_number: con_gst_number,
              discount: discount,
              date_of_dispatch: date_of_dispatch,
              delivery_status: delivery_status,
              delivery_date: delivery_date,
              delivery_sales_rep_id: 104,
              transport_type: '',
              vehicle_number: '',
              cgst: 1,
              sgst: 1,
              igst: 1,
              cgst_amount: 0,
              sgst_amount: 0,
              igst_amount: 0,
              reverse_charge: 'no',
              shipping_address: 'yes',
              state_code: state_code,
              round_off_amount: 0,
              invoice_amount: 0,
              invoice_date: invoice_date,
              email_date_time: (orderData.order_date ? getDateTimeString(new Date(orderData.order_date)) : null),
              basis_of_sales: 'PO Number',
              email_from: '',
              email_approved_by: '',
              gstin: buyer_gst,
              shipping_charges: 0,
              despatch_through: courier,
              tracking_id: awb_number,
              created_by: 421,
              created_on: curDate,
              tax_type: saleData.tax_type
            });
  
            let error = await sale.setTransactionAmount(finalSaleItems);
            if (error) {
              throw error;
            }
  
            // const message = await Stock.checkStock('Sale', sale);
            // if (message instanceof Error) throw message;
            // if (message) {
            //   errorOrders.push({
            //     'order_no': reference_code,
            //     'order_date': order_date,
            //     'remarks': message
            //   });
            //   continue;
            // }
  
            // error = sale.approve(req);
            // if (error) {
            //   throw error;
            // }
  
            sale.status = 'Approved';
            sale.approved_by = 421;
            sale.approved_on = curDate;
  
            t = await sequelize.transaction();
  
            let series = 1;
            if (!sale.invoice_no) {
              series = await getSeries(req, 'Tax_Invoice');
              sale.getInvoiceNo(series.series);
              await series.save({ transaction: t });
            }
  
            await sale.save({ transaction: t });
  
            for(const finalSaleItem of finalSaleItems) {
              finalSaleItem.distributor_out_id = sale.id;
              await finalSaleItem.save({ transaction: t });
            }
  
            const finalSaleItemProducts = await sale.getSaleItemProducts(finalSaleItems);
            for(const saleItemProduct of finalSaleItemProducts) {
              const finalSaleItemProduct = new SaleItemProduct({...saleItemProduct});
              finalSaleItemProduct.distributor_out_id = sale.id;
              finalSaleItemProduct.setItemAmount();
              await finalSaleItemProduct.save({ transaction: t });
            }
  
            series = await getSeries(req, 'Account_Voucher');
            await series.save({ transaction: t });
  
            const accLedgerEntry = { 
              ref_type: 'Distributor_Sales',
              ref_id: sale.id, 
              type: 'Debit', 
              voucher_id: series.series, 
              invoice_no: sale.invoice_no,
              ref_date: sale.invoice_date ? sale.invoice_date : sale.date_of_processing,
              amount: sale.invoice_amount
            };
            
            const accountLedgerEntry1 = new AccountLedgerEntry(accLedgerEntry);
            const accountLedgerEntry2 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
            const accountLedgerEntry3 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
            
            await accountLedgerEntry1.setMainEntryData(sale);
            accountLedgerEntry2.SetTaxableData(sale);
            accountLedgerEntry3.SetTaxData(sale);
            
            await accountLedgerEntry1.save({ transaction: t });
            await accountLedgerEntry2.save({ transaction: t });
            await accountLedgerEntry3.save({ transaction: t });
  
            if (sale.shipping_charges) {
              const accountLedgerEntry4 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
              accountLedgerEntry4.SetShippingData(sale);
              await accountLedgerEntry4.save({ transaction: t });
            }
  
            // console.log(sale);
  
            // await Stock.deleteMany({ stockType: 'Sale', sale: sale.id }, { session });
            // error = await Stock.setStockDetails('Sale', sale, session, req);
            // if (error) throw error;
  
            // error = await Product.setStock('Sale', sale, session);
            // if (error instanceof Error) throw error;
  
            await t.commit();
  
            uploadedOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': 'Success'
            });
          } catch (error) {
            console.log(error);
            if (t) {
              await t.rollback();
            }
  
            errorOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': error.message
            });
          }
        }

      // }
    }

    if (errorOrders.length > 0) {
      sendOrderEmail(errorOrders);
    }

    // console.log('Success');
    if (res) {
      res.status(200).json({ 
        message: 'Easy Ecom Orders fetched. ', 
        'Total No Of Orders': orders.length, 
        'Uploaded Orders': uploadedOrders.length, 
        'Error Orders': errorOrders.length, 
        uploadedOrders: uploadedOrders, 
        errorOrders: errorOrders, 
        orders: orders 
      });
    } else {
      logger.log({
        level: "info",
        message: "Easy Ecom API Cron For Orders On - " + new Date().toLocaleString(),
        // stack: err.stack,
        metadata: { orders: orders.length, uploadedOrders: uploadedOrders.length, errorOrders: errorOrders.length }, // Put what you like as meta
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Downloading Easy Ecom Orders Failed! Error - " + (error.message ? error.message : '')
    });

    sendOrderFetchingFailedEmail(error);

    res.statusCode = 500;
    res.message = "Downloading Easy Ecom Orders failed!";
    next(error, req, res);
  }
};


export const getAllOrdersOnlySales = async (req, res, next) => {
  let t;

  try {
    const user = await User.findByPk(421);
    if (user) {
      req.userData = {
        email: user.email_id,
        userId: user.id,
        userRoleId: user.role_id,
        roleDetails: {}
      };
    } else {
      throw new Error(`User with id (421) not found in User Master.`);
    }
    
    let nextUrl = '';
    const orders = [];
    let apiCnt = 0;

    let startDate = req.query.startDate ? req.query.startDate : '';
    let endDate = req.query.endDate ? req.query.endDate : '';

    if (!startDate) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 5);
    } else {
      startDate = new Date(startDate);
    }
    if (!endDate) {
      endDate = new Date();
    } else {
      endDate = new Date(endDate);
    }
    
    //startDate = new Date('2025-04-24T19:00:00Z');
    //endDate = new Date('2025-04-27T00:00:00Z');
    startDate = startDate.toISOString();
    endDate = endDate.toISOString();

    const easyEcomApi = new EasyEcomApi('ee41972946129');
    const errorOrders = [];
    const uploadedOrders = [];

    do {
      let fetchedOrders = await easyEcomApi.getOrders(startDate, endDate, nextUrl);
      if (!fetchedOrders || fetchedOrders instanceof Error || !fetchedOrders.orders) {
        throw fetchedOrders;
      }
      orders.push(...fetchedOrders.orders);
      nextUrl = fetchedOrders.nextUrl ? fetchedOrders.nextUrl : '';

      await new Promise(resolve => setTimeout(resolve, 500)); 
    } while (nextUrl !== '');
    

    for (const order of orders) {
      const marketplace = order.marketplace?.trim().toUpperCase();
      const marketplace_id = order.marketplace_id;
      if (!marketplace || marketplace.trim().toUpperCase().indexOf('MEESHO-API') !== -1 || marketplace.trim().toUpperCase().indexOf('OFFLINE') !== -1) {
        continue;
      }
      const reference_code = order.reference_code?.trim();
      let warehouse = order.company_name ? order.company_name : order.assigned_company_name ? order.assigned_company_name : '';
      let warehouse_id = order.warehouseId ? order.warehouseId : order.assigned_warehouse_id ? order.assigned_warehouse_id : 0;
      const order_status = order.order_status.trim().toUpperCase();
      const order_type = order.order_type;
      const IsBusinessOrder = (order_type === 'B2B') ? 1 : 0;
      const replacement_order = order.replacement_order;
      const courier = order.courier;
      const awb_number = order.awb_number && order.awb_number != null ? order.awb_number : '';
      const payment_mode = order.payment_mode;
      const buyer_gst = order.buyer_gst && order.buyer_gst != 'NA' && order.buyer_gst != '0' ? order.buyer_gst : '';
      const email = order.email;
      const billing_name = order.billing_name;
      let billing_address = (order.billing_address_1 ? order.billing_address_1 : '') + ' ' + (order.billing_address_2 ? order.billing_address_2 : '');
      const billing_city = order.billing_city;
      const billing_state = order.billing_state;
      const billing_state_code = order.billing_state_code;
      const billing_pin_code = order.billing_pin_code;
      const billing_country = order.billing_country && order.billing_country != null ? order.billing_country : (order.country ? order.country : '');
      const billing_mobile = order.billing_mobile;
      const total_tax = order.total_tax;
      const total_shipping_charge = order.total_shipping_charge;
      const total_discount = order.total_discount;
      const suborders = order.suborders;
      const shipping_status = order.shipping_status ? order.shipping_status?.trim().toUpperCase() : '';
      const delivery_status = (shipping_status === 'DELIVERED' || shipping_status === 'RTO DELIVERED') ? 'Delivered' : (order_status === 'SHIPPED' ? 'GP Issued' : 'Pending');
      const date_of_dispatch = order.manifest_date && order.manifest_date !== '0000-00-00 00:00:00' ? new Date(order.manifest_date).toISOString() : null;
      const delivery_date = order.delivery_date && order.delivery_date !== '0000-00-00 00:00:00' ? new Date(order.delivery_date).toISOString() : null;

      let placeOrder = false;
      if (order_status === 'ASSIGNED' || order_status === 'CONFIRMED' || 
          order_status === 'PRINTED' || order_status === 'MANIFEST SCANNED' || 
          order_status === 'READY TO DISPATCH' || order_status === 'SHIPPED' || 
          order_status === 'CANCELLED') {
            placeOrder = true;
      }

      if (placeOrder === false) {
        continue;
      }

      let normalizedOrderNo = reference_code;

      if (marketplace.includes('SHOPIFY')) {
        const shopifyOrderNo = getShopifyOrderNo(reference_code);
        normalizedOrderNo = shopifyOrderNo ? shopifyOrderNo.replace("#","") : normalizedOrderNo;
      }   
      
      // More robust duplicate check using LIKE pattern to catch suffixed order numbers (e.g., ORDER123$1)
           
      // New Code By Saurabh
      const existingSales = await Sale.findAll({
        where: {
          order_no: {
            [Op.or]: [
              normalizedOrderNo,
              { [Op.like]: `${normalizedOrderNo}%` }
            ]
          }
        }
      });

      if (order_status === 'CANCELLED') {
        if (existingSales.length > 0) {
          for (const sale of existingSales) {
            if (sale.status && sale.status.trim().toUpperCase() !== 'INACTIVE') {
              sale.status = 'InActive';
              await sale.save();
              await AccountLedgerEntry.update(
                { status: 'InActive' },
                { where: { ref_type: 'Distributor_Sales', ref_id: sale.id } }
              );
            }
          }
        }
        console.log(`Cancelled order deactivated: ${normalizedOrderNo}`);
        continue;
      } else {
        // if (existingSales.length > 0) {
        //   const sale = existingSales[0];
        //   if (sale.status !== 'InActive' && sale.delivery_status?.trim().toUpperCase() !== delivery_status.toUpperCase()) {
        //     sale.delivery_status = delivery_status;
        //     sale.date_of_dispatch = date_of_dispatch;
        //     sale.delivery_date = delivery_date;
        //     await sale.save();
        //   }
        //   console.log(`Duplicate order skipped: ${normalizedOrderNo}`);
        //   continue; // already exists
        // }
        const activeSale = existingSales.find(s => s.status?.trim().toUpperCase() !== 'INACTIVE');
        if (activeSale) {
          if (activeSale.delivery_status?.trim().toUpperCase() !== delivery_status.toUpperCase()) {
            activeSale.delivery_status = delivery_status;
            activeSale.date_of_dispatch = date_of_dispatch;
            activeSale.delivery_date = delivery_date;
            await activeSale.save();
          }
          console.log(`Duplicate active order skipped: ${normalizedOrderNo}`);
          continue;
        } else if (existingSales.length > 0) {
          console.log(`Only inactive versions exist for: ${normalizedOrderNo} — skipping reinsertion.`);
          continue;
        }
      }



      const orderData = {...order};
      let distributor = {};
      if (marketplace.trim().toUpperCase().indexOf('SHOPIFY') !== -1) {
        let distributor_id = await getShopifyOrderDistributor(reference_code);
        if (distributor_id instanceof Error) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }

        distributor = await Distributor.findByPk(distributor_id);
        if (!distributor) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }
      } else if((marketplace.trim().toUpperCase().indexOf('AMAZON') !== -1)) {
        distributor.id = '214';
      } else if((marketplace.trim().toUpperCase()=='FLIPKART_ADVANTAGE')) {
        distributor.id = '1381';
      } else {

        // Old Code
        // distributor = await Distributor.findOne({ where: {[Op.or]: [{marketplace: marketplace}, {marketplace_id: marketplace_id}]} });
        
        // New Code By Saurabh 
        // Search Value of marketplace of marketplace_id from Comma-Separated string By marketplace or marketplace_id 
        distributor = await Distributor.findOne({
          where: {
            [Op.or]: [
              // marketplace search (case-insensitive, space-safe)
              Sequelize.where(
                Sequelize.fn(
                  "FIND_IN_SET",
                  Sequelize.fn("LOWER", marketplace),
                  Sequelize.fn(
                    "LOWER",
                    Sequelize.literal(`REPLACE(marketplace, ' ', '')`)
                  )
                ),
                { [Op.gt]: 0 }
              ),

              // marketplace_id search (space-safe, exact)
              Sequelize.where(
                Sequelize.fn(
                  "FIND_IN_SET",
                  marketplace_id.toString(),
                  Sequelize.literal(`REPLACE(marketplace_id, ' ', '')`)
                ),
                { [Op.gt]: 0 }
              )
            ]
          }
        });

        // New Code By Saurabh 


        if (!distributor) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }
      }
      
      if ((warehouse && warehouse.trim().toUpperCase() === 'AMAZON_FBA_TNJX_AUTO') || (warehouse_id && warehouse_id.toString().trim().toUpperCase() === '205776')) {
        warehouse = 'Mumbai';
        warehouse_id = '205199';
      }

      // Old Code
      // const depot = await Depot.findOne({ where: {[Op.or]: [{warehouse: warehouse}, {warehouse_id: warehouse_id}]} });

      // New Code By Saurabh

      // Search Value of warehouse of warehouse_id from Comma-Separated string By warehouse or warehouse_id
      const depot = await Depot.findOne({
        where: {
          [Op.or]: [
            // warehouse search (case-insensitive, space-safe)
            Sequelize.where(
              Sequelize.fn(
                "FIND_IN_SET",
                Sequelize.fn("LOWER", warehouse),
                Sequelize.fn(
                  "LOWER",
                  Sequelize.literal(`REPLACE(warehouse, ' ', '')`)
                )
              ),
              { [Op.gt]: 0 }
            ),

            // warehouse_id search (space-safe, exact)
            Sequelize.where(
              Sequelize.fn(
                "FIND_IN_SET",
                warehouse_id.toString(),
                Sequelize.literal(`REPLACE(warehouse_id, ' ', '')`)
              ),
              { [Op.gt]: 0 }
            )
          ]
        }
      });

      // New Code By Saurabh


      if (!depot) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order.order_date,
          'remarks': `Depot for Warehouse (${warehouse}) & Warehouse Id (${warehouse_id}) not found in Depot Master.`
        });
        continue;
      }

      const order_date = orderData.order_date ? getDateString(new Date(orderData.order_date)) : '';
      if (!order_date) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': '',
          'remarks': `Purchase Date not found.`
        });
        continue;
      }

      const invoice_date = orderData.invoice_date ? getDateString(new Date(orderData.invoice_date)) : '';
      if (!invoice_date) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order_date,
          'remarks': `Invoice Date not found.`
        });
        continue;
      }

      const total_amount = orderData.total_amount ? parseFloat(orderData.total_amount) : 0;
      if(total_amount < 0){
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order_date,
          'remarks': `Total amount is ${total_amount}.`
        });
        continue;
      }
      
      let name = order.customer_name ? order.customer_name : '';
      let address = (order.address_line_1 ? order.address_line_1 : '') + ' ' +
        (order.address_line_2 ? order.address_line_2 : '');
      let city = order.city ? order.city : '';
      let pincode = order.pin_code ? order.pin_code : '';
      let state = order.state ? order.state : null;
      let country = order.country ? order.country : null;
      let mobileNo = order.contact_num ? order.contact_num : billing_mobile ? billing_mobile : '';
      let state_code = order.state_code ? order.state_code : 27;

      let totalOrderAmount = 0;
      let saleItemError = false;
      const saleItems = [];
      
      const orderItems = order.suborders ? order.suborders : order.order_items;
      for (const orderItem of orderItems) {
        const productName = orderItem.productName ? orderItem.productName : '';
        const sku = orderItem.sku ? orderItem.sku : '';
        const QuantityOrdered = orderItem.suborder_quantity ? parseFloat(orderItem.suborder_quantity) : 0;
        
        let depotState = '';
        let depotId = '';
        let taxType = 'Intra';
        let quantity = QuantityOrdered;
        if (depot) {
          depotId = depot.id;
          depotState = depot.state;
        }
        
        if (state.trim().toUpperCase() !== depotState.trim().toUpperCase()) {
          taxType = 'Inter';
        }

        const saleItem = {
          distributor_out_id: 0,
          type: 'Box',
          item_id: 0,
          qty: quantity,
          sell_rate: 0,
          grams: 0,
          rate: 0,
          discount: 0,
          discount_amt: 0,
          amount: 0,
          cgst_amt: 0,
          sgst_amt: 0,
          igst_amt: 0,
          tax_amt: 0,
          total_amt: 0,
          margin_per: 0,
          promo_margin: 0,
          gst: 'No',
          tax_percentage: 0,
          // fc_id: fulfillmentCenterId,
          depot_state: depotState,
          depot_id: depotId,
          tax_type: taxType,
          combo_box_id: 0,
          batch_no: 182,
          batch_qty: 0
        };

        const comboBox = await ComboBox.findOne({ 
          where: { sku_code: sku }, 
          include: [{model: ComboBoxItem, as: 'comboBoxItems', attributes: ['combo_box_id', 'type', 'item_id', 'qty', 'rate', 'grams']}] 
        });
        if (comboBox) {
          saleItem.combo_box_id = comboBox.id ? comboBox.id : 0;

          if (comboBox.gst && comboBox.gst.trim().toUpperCase() === 'YES') {
            saleItem.type = 'Combo Box';
            saleItem.item_id = comboBox.id ? comboBox.id : 0;
            saleItem.qty = saleItem.qty;
            saleItem.sell_rate = comboBox.rate ? parseFloat(comboBox.rate) : 0;
            saleItem.grams = comboBox.grams ? parseFloat(comboBox.grams) : 0;
            saleItem.rate = comboBox.rate ? parseFloat(comboBox.rate) : 0;
            saleItem.gst = 'No';
            saleItem.tax_percentage = comboBox.gst_rate ? parseFloat(comboBox.gst_rate) : 0;

            saleItems.push({...saleItem});
          } else {
            for (const comboBoxItem of comboBox.comboBoxItems) {
              saleItem.type = comboBoxItem.type ? comboBoxItem.type : 'Box';
              saleItem.item_id = comboBoxItem.item_id ? comboBoxItem.item_id : 0;
              saleItem.qty = comboBoxItem.qty ? (parseFloat(comboBoxItem.qty) * quantity) : saleItem.qty;
              saleItem.sell_rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
              saleItem.grams = comboBoxItem.grams ? parseFloat(comboBoxItem.grams) : 0;
              saleItem.rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
              saleItem.gst = comboBox.gst ? comboBox.gst : 'No';
              saleItem.tax_percentage = comboBox.gst && comboBox.gst === 'Yes' ? parseFloat(comboBox.gst_rate) : 0;
  
              if (saleItem.type.trim().toUpperCase() === "BOX") {
                const box = await Box.findByPk(saleItem.item_id);
                if (box) {
                  saleItem.type = 'Box';
                  saleItem.item_id = box.id ? box.id : 0;
                  saleItem.qty = saleItem.qty;
                  saleItem.sell_rate = box.rate ? parseFloat(box.rate) : 0;
                  saleItem.grams = box.grams ? parseFloat(box.grams) : 0;
                  saleItem.rate = box.rate ? parseFloat(box.rate) : 0;
                  if (saleItem.gst.trim().toUpperCase() === 'NO') {
                    saleItem.tax_percentage = box.tax_percentage ? parseFloat(box.tax_percentage) : saleItem.tax_percentage;
                  }
                } else {
                  const product = await Product.findByPk(saleItem.item_id);
                  if (product) {
                    saleItem.type = 'Bar';
                    saleItem.item_id = product.id ? product.id : 0;
                    saleItem.qty = saleItem.qty;
                    saleItem.sell_rate = product.rate ? parseFloat(product.rate) : 0;
                    saleItem.grams = product.grams ? parseFloat(product.grams) : 0;
                    saleItem.rate = product.rate ? parseFloat(product.rate) : 0;
                    if (saleItem.gst.trim().toUpperCase() === 'NO') {
                      saleItem.tax_percentage = product.tax_percentage ? parseFloat(product.tax_percentage) : saleItem.tax_percentage;
                    }
                  }
                }
              }
  
              saleItems.push({...saleItem});
            }
          }
        } else {
          const box = await Box.findOne({ where: { sku_code: sku } });
          if (box) {
            saleItem.type = 'Box';
            saleItem.item_id = box.id ? box.id : 0;
            saleItem.qty = saleItem.qty;
            saleItem.sell_rate = box.rate ? parseFloat(box.rate) : 0;
            saleItem.grams = box.grams ? parseFloat(box.grams) : 0;
            saleItem.rate = box.rate ? parseFloat(box.rate) : 0;
            saleItem.gst = 'No';
            saleItem.tax_percentage = box.tax_percentage ? parseFloat(box.tax_percentage) : 0;

            saleItems.push({...saleItem});
          } else {
            errorOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': `sku (${sku}) for product (${productName}) not found in Product Master.`
            });
            saleItemError = true;
          }
        }
      }

      if (saleItemError) {
        continue;
      }

      for (let index = 0; index < saleItems.length; index++) {
        const totalAmt = round(saleItems[index].qty * saleItems[index].sell_rate, 2);
        totalOrderAmount = totalOrderAmount + totalAmt;

        saleItems[index].amount = totalAmt;
        saleItems[index].total_amt = totalAmt;
      }

      const totalDiscountAmount = round(totalOrderAmount - total_amount, 2);
      let discount = 0;
      if (totalOrderAmount != 0) {
        discount = round((totalDiscountAmount / totalOrderAmount) * 100, 2);
      }

      const salesData = [];
      for (const saleItem of saleItems) {
        saleItem.discount = discount;

        const finalSaleItem = new SaleItem({
          distributor_out_id: 0
        });

        finalSaleItem.getRequestData(saleItem);

        await finalSaleItem.setItemAmount();
        
        const index = salesData.findIndex(saleData => saleData.depot_id === saleItem.depot_id);

        if (index === -1) {
          let order_no = normalizedOrderNo;
          if (salesData.length !== 0) {
            order_no = order_no + '$' + salesData.length.toString();
          }
          
          salesData.push({
            order_no: order_no,
            depot_id: saleItem.depot_id,
            fc_id: saleItem.fc_id,
            tax_type: saleItem.tax_type,
            saleItems: [finalSaleItem]
          });
        } else {
          salesData[index].saleItems.push(finalSaleItem);
        }
      }

      for (const saleData of salesData) {
        try {
          // const finalSaleItems = saleData.saleItems.map(saleItem => {
          //   return {
          //     distributor_out_id: saleItem.distributor_out_id,
          //     type: saleItem.type,
          //     item_id: saleItem.item_id,
          //     grams: saleItem.grams,
          //     qty: saleItem.qty,
          //     rate: saleItem.rate,
          //     discount: saleItem.discount,
          //     sell_rate: saleItem.sell_rate,
          //     tax_percentage: saleItem.tax_percentage,
          //     amount: saleItem.amount,
          //     cgst_amt: saleItem.cgst_amt,
          //     sgst_amt: saleItem.sgst_amt,
          //     igst_amt: saleItem.igst_amt,
          //     tax_amt: saleItem.tax_amt,
          //     total_amt: saleItem.total_amt,
          //     batch_no: saleItem.batch_no,
          //     batch_qty: saleItem.qty,
          //     margin_per: saleItem.margin_per,
          //     promo_margin: saleItem.promo_margin,
          //     combo_box_id: saleItem.combo_box_id,
          //     discount_amt: saleItem.discount_amt
          //   };
          // });

          const finalSaleItems = saleData.saleItems;

          // const costAmount = finalSaleItems.reduce((costAmount, finalSaleItem) => {
          //   return costAmount += finalSaleItem.costAmount;
          // }, 0);

          const curDate = getDateTimeString(new Date());

          let con_name = '';
          let con_address = '';
          let con_city = '';
          let con_pincode = '';
          let con_state = '';
          let con_country = '';
          let con_state_code = '';
          let con_gst_number = '';
          if (state_code && billing_state_code && state && billing_state && pincode && billing_pin_code && state_code.trim().toUpperCase() !== billing_state_code.trim().toUpperCase() && state.trim().toUpperCase() !== billing_state.trim().toUpperCase() && pincode.trim().toUpperCase() !== billing_pin_code.trim().toUpperCase()) {
            con_name = name;
            con_address = address;
            con_city = city;
            con_pincode = pincode;
            con_state = state;
            con_country = country;
            con_state_code = state_code;
            con_gst_number = '';
          }

          let client_name = name;
          if (order_type.trim().toUpperCase() === 'B2B') {
            client_name = order.company_name ? order.company_name : billing_name ? billing_name : name;
          }

          const sale = new Sale({
            date_of_processing: order_date,
            invoice_no: '',
            depot_id: saleData.depot_id,
            distributor_id: distributor.id,
            amount: 0,
            tax: 'gst',
            tax_per: 1,
            tax_amount: 0,
            final_amount: totalOrderAmount,
            due_date: curDate,
            order_no: saleData.order_no,
            order_date: order_date,
            status: 'Pending',
            remarks: 'This is system generated entry.',
            modified_by: 421,
            modified_on: curDate,
            client_name: client_name,
            address: billing_address,
            city: billing_city,
            pincode: billing_pin_code,
            state: billing_state,
            country: billing_country,
            mobileNo: mobileNo,
            con_name: con_name,
            con_address: con_address,
            con_city: con_city,
            con_pincode: con_pincode,
            con_state: con_state,
            con_state_code: con_state_code,
            con_country: con_country,
            con_gst_number: con_gst_number,
            discount: discount,
            date_of_dispatch: date_of_dispatch,
            delivery_status: delivery_status,
            delivery_date: delivery_date,
            delivery_sales_rep_id: 104,
            transport_type: '',
            vehicle_number: '',
            cgst: 1,
            sgst: 1,
            igst: 1,
            cgst_amount: 0,
            sgst_amount: 0,
            igst_amount: 0,
            reverse_charge: 'no',
            shipping_address: 'yes',
            state_code: state_code,
            round_off_amount: 0,
            invoice_amount: 0,
            invoice_date: date_of_dispatch,
            email_date_time: (orderData.order_date ? getDateTimeString(new Date(orderData.order_date)) : null),
            basis_of_sales: 'PO Number',
            email_from: '',
            email_approved_by: '',
            gstin: buyer_gst,
            shipping_charges: 0,
            despatch_through: courier,
            tracking_id: awb_number,
            created_by: 421,
            created_on: curDate,
            tax_type: saleData.tax_type
          });

          let error = await sale.setTransactionAmount(finalSaleItems);
          if (error) {
            throw error;
          }

          // const message = await Stock.checkStock('Sale', sale);
          // if (message instanceof Error) throw message;
          // if (message) {
          //   errorOrders.push({
          //     'order_no': reference_code,
          //     'order_date': order_date,
          //     'remarks': message
          //   });
          //   continue;
          // }

          // error = sale.approve(req);
          // if (error) {
          //   throw error;
          // }

          sale.status = 'Approved';
          sale.approved_by = 421;
          sale.approved_on = curDate;

          t = await sequelize.transaction();

          let series = 1;
          if (!sale.invoice_no) {
            series = await getSeries(req, 'Tax_Invoice');
            sale.getInvoiceNo(series.series);
            await series.save({ transaction: t });
          }

          await sale.save({ transaction: t });

          for(const finalSaleItem of finalSaleItems) {
            finalSaleItem.distributor_out_id = sale.id;
            await finalSaleItem.save({ transaction: t });
          }

          const finalSaleItemProducts = await sale.getSaleItemProducts(finalSaleItems);
          for(const saleItemProduct of finalSaleItemProducts) {
            const finalSaleItemProduct = new SaleItemProduct({...saleItemProduct});
            finalSaleItemProduct.distributor_out_id = sale.id;
            finalSaleItemProduct.setItemAmount();
            await finalSaleItemProduct.save({ transaction: t });
          }

          series = await getSeries(req, 'Account_Voucher');
          await series.save({ transaction: t });

          const accLedgerEntry = { 
            ref_type: 'Distributor_Sales',
            ref_id: sale.id, 
            type: 'Debit', 
            voucher_id: series.series, 
            invoice_no: sale.invoice_no,
            ref_date: sale.invoice_date ? sale.invoice_date : sale.date_of_processing,
            amount: sale.invoice_amount
          };
          
          const accountLedgerEntry1 = new AccountLedgerEntry(accLedgerEntry);
          const accountLedgerEntry2 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
          const accountLedgerEntry3 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
          
          await accountLedgerEntry1.setMainEntryData(sale);
          accountLedgerEntry2.SetTaxableData(sale);
          accountLedgerEntry3.SetTaxData(sale);
          
          await accountLedgerEntry1.save({ transaction: t });
          await accountLedgerEntry2.save({ transaction: t });
          await accountLedgerEntry3.save({ transaction: t });

          if (sale.shipping_charges) {
            const accountLedgerEntry4 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
            accountLedgerEntry4.SetShippingData(sale);
            await accountLedgerEntry4.save({ transaction: t });
          }

          // console.log(sale);

          // await Stock.deleteMany({ stockType: 'Sale', sale: sale.id }, { session });
          // error = await Stock.setStockDetails('Sale', sale, session, req);
          // if (error) throw error;

          // error = await Product.setStock('Sale', sale, session);
          // if (error instanceof Error) throw error;

          await t.commit();

          uploadedOrders.push({
            'order_no': reference_code,
            'order_date': order_date,
            'remarks': 'Success'
          });
        } catch (error) {
          console.log(error);
          if (t) {
            await t.rollback();
          }

          errorOrders.push({
            'order_no': reference_code,
            'order_date': order_date,
            'remarks': error.message
          });
        }
      }
    }

    if (errorOrders.length > 0) {
      sendOrderEmail(errorOrders);
    }

    // console.log('Success');
    if (res) {
      res.status(200).json({ 
        message: 'Easy Ecom Orders fetched. ', 
        'Total No Of Orders': orders.length, 
        'Uploaded Orders': uploadedOrders.length, 
        'Error Orders': errorOrders.length, 
        uploadedOrders: uploadedOrders, 
        errorOrders: errorOrders, 
        orders: orders 
      });
    } else {
      logger.log({
        level: "info",
        message: "Easy Ecom API Cron For Orders On - " + new Date().toLocaleString(),
        // stack: err.stack,
        metadata: { orders: orders.length, uploadedOrders: uploadedOrders.length, errorOrders: errorOrders.length }, // Put what you like as meta
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Downloading Easy Ecom Orders Failed! Error - " + (error.message ? error.message : '')
    });

    sendOrderFetchingFailedEmail(error);

    res.statusCode = 500;
    res.message = "Downloading Easy Ecom Orders failed!";
    next(error, req, res);
  }
};

export const getAllOrdersOnlySalesReturn = async (req, res, next) => {
  let t;

  try {
    const user = await User.findByPk(421);
    if (user) {
      req.userData = {
        email: user.email_id,
        userId: user.id,
        userRoleId: user.role_id,
        roleDetails: {}
      };
    } else {
      throw new Error(`User with id (421) not found in User Master.`);
    }
    
    let nextUrl = '';
    const orders = [];
    let apiCnt = 0;

    let startDate = req.query.startDate ? req.query.startDate : '';
    let endDate = req.query.endDate ? req.query.endDate : '';

    if (!startDate) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 5);
    } else {
      startDate = new Date(startDate);
    }
    if (!endDate) {
      endDate = new Date();
    } else {
      endDate = new Date(endDate);
    }
    
    //startDate = new Date('2025-04-24T19:00:00Z');
    //endDate = new Date('2025-04-27T00:00:00Z');
    startDate = startDate.toISOString();
    endDate = endDate.toISOString();

    const easyEcomApi = new EasyEcomApi('ee41972946129');
    const errorOrders = [];
    const uploadedOrders = [];

    do {
      let fetchedOrders = await easyEcomApi.getOrdersByUpdatedDate(startDate, endDate, nextUrl);
      if (!fetchedOrders || fetchedOrders instanceof Error || !fetchedOrders.orders) {
        throw fetchedOrders;
      }
      orders.push(...fetchedOrders.orders);
      nextUrl = fetchedOrders.nextUrl ? fetchedOrders.nextUrl : '';

      await new Promise(resolve => setTimeout(resolve, 500)); 
    } while (nextUrl !== '');
    

    for (const order of orders) {
      const marketplace = order.marketplace?.trim().toUpperCase();
      const marketplace_id = order.marketplace_id;
      if (!marketplace || marketplace.trim().toUpperCase().indexOf('MEESHO-API') !== -1 || marketplace.trim().toUpperCase().indexOf('OFFLINE') !== -1) {
        continue;
      }
      const reference_code = order.reference_code?.trim();
      let warehouse = order.company_name ? order.company_name : order.assigned_company_name ? order.assigned_company_name : '';
      let warehouse_id = order.warehouseId ? order.warehouseId : order.assigned_warehouse_id ? order.assigned_warehouse_id : 0;
      const order_status = order.order_status.trim().toUpperCase();
      const order_type = order.order_type;
      const IsBusinessOrder = (order_type === 'B2B') ? 1 : 0;
      const replacement_order = order.replacement_order;
      const courier = order.courier;
      const awb_number = order.awb_number && order.awb_number != null ? order.awb_number : '';
      const payment_mode = order.payment_mode;
      const buyer_gst = order.buyer_gst && order.buyer_gst != 'NA' && order.buyer_gst != '0' ? order.buyer_gst : '';
      const email = order.email;
      const billing_name = order.billing_name;
      let billing_address = (order.billing_address_1 ? order.billing_address_1 : '') + ' ' + (order.billing_address_2 ? order.billing_address_2 : '');
      const billing_city = order.billing_city;
      const billing_state = order.billing_state;
      const billing_state_code = order.billing_state_code;
      const billing_pin_code = order.billing_pin_code;
      const billing_country = order.billing_country && order.billing_country != null ? order.billing_country : (order.country ? order.country : '');
      const billing_mobile = order.billing_mobile;
      const total_tax = order.total_tax;
      const total_shipping_charge = order.total_shipping_charge;
      const total_discount = order.total_discount;
      const suborders = order.suborders;
      const shipping_status = order.shipping_status ? order.shipping_status?.trim().toUpperCase() : '';
      const delivery_status = (shipping_status === 'DELIVERED' || shipping_status === 'RTO DELIVERED') ? 'Delivered' : (order_status === 'SHIPPED' ? 'GP Issued' : 'Pending');
      const date_of_dispatch = order.manifest_date && order.manifest_date !== '0000-00-00 00:00:00' ? new Date(order.manifest_date).toISOString() : null;
      const delivery_date = order.delivery_date && order.delivery_date !== '0000-00-00 00:00:00' ? new Date(order.delivery_date).toISOString() : null;

      let placeOrder = false;
      if (order_status === 'RETURNED') {
            placeOrder = true;
      }

      if (placeOrder === false) {
        continue;
      }

      let normalizedOrderNo = reference_code;

      if (marketplace.includes('SHOPIFY')) {
        const shopifyOrderNo = getShopifyOrderNo(reference_code);
        normalizedOrderNo = shopifyOrderNo ? shopifyOrderNo.replace("#","") : normalizedOrderNo;
      }   
      
      // More robust duplicate check using LIKE pattern to catch suffixed order numbers (e.g., ORDER123$1)
           
      // New Code By Saurabh

      if (order_status === 'RETURNED') {
        const saleReturnExists = await SaleReturn.findOne({
          where: {
            order_no: {
              [Op.or]: [
                normalizedOrderNo,
                { [Op.like]: `${normalizedOrderNo}$%` }
              ]
            }
          }
        });

        if (saleReturnExists) {
          console.log(`Duplicate return skipped: ${normalizedOrderNo}`);
          continue; // already processed
        }
      }



      const orderData = {...order};
      let distributor = {};
      if (marketplace.trim().toUpperCase().indexOf('SHOPIFY') !== -1) {
        let distributor_id = await getShopifyOrderDistributor(reference_code);
        if (distributor_id instanceof Error) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }

        distributor = await Distributor.findByPk(distributor_id);
        if (!distributor) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }
      } else if((marketplace.trim().toUpperCase().indexOf('AMAZON') !== -1)) {
        distributor.id = '214';
      } else if((marketplace.trim().toUpperCase()=='FLIPKART_ADVANTAGE')) {
        distributor.id = '1381';
      } else {

        // Old Code
        // distributor = await Distributor.findOne({ where: {[Op.or]: [{marketplace: marketplace}, {marketplace_id: marketplace_id}]} });
        
        // New Code By Saurabh 
        // Search Value of marketplace of marketplace_id from Comma-Separated string By marketplace or marketplace_id 
        distributor = await Distributor.findOne({
          where: {
            [Op.or]: [
              // marketplace search (case-insensitive, space-safe)
              Sequelize.where(
                Sequelize.fn(
                  "FIND_IN_SET",
                  Sequelize.fn("LOWER", marketplace),
                  Sequelize.fn(
                    "LOWER",
                    Sequelize.literal(`REPLACE(marketplace, ' ', '')`)
                  )
                ),
                { [Op.gt]: 0 }
              ),

              // marketplace_id search (space-safe, exact)
              Sequelize.where(
                Sequelize.fn(
                  "FIND_IN_SET",
                  marketplace_id.toString(),
                  Sequelize.literal(`REPLACE(marketplace_id, ' ', '')`)
                ),
                { [Op.gt]: 0 }
              )
            ]
          }
        });

        // New Code By Saurabh 


        if (!distributor) {
          errorOrders.push({
            'order_no': reference_code,
            'order_date': order.order_date,
            'remarks': `Distributor for Marketplace (${marketplace}) & Marketplace Id (${marketplace_id}) not found in Distributor Master.`
          });
          continue;
        }
      }
      
      if ((warehouse && warehouse.trim().toUpperCase() === 'AMAZON_FBA_TNJX_AUTO') || (warehouse_id && warehouse_id.toString().trim().toUpperCase() === '205776')) {
        warehouse = 'Mumbai';
        warehouse_id = '205199';
      }

      // Old Code
      // const depot = await Depot.findOne({ where: {[Op.or]: [{warehouse: warehouse}, {warehouse_id: warehouse_id}]} });

      // New Code By Saurabh

      // Search Value of warehouse of warehouse_id from Comma-Separated string By warehouse or warehouse_id
      const depot = await Depot.findOne({
        where: {
          [Op.or]: [
            // warehouse search (case-insensitive, space-safe)
            Sequelize.where(
              Sequelize.fn(
                "FIND_IN_SET",
                Sequelize.fn("LOWER", warehouse),
                Sequelize.fn(
                  "LOWER",
                  Sequelize.literal(`REPLACE(warehouse, ' ', '')`)
                )
              ),
              { [Op.gt]: 0 }
            ),

            // warehouse_id search (space-safe, exact)
            Sequelize.where(
              Sequelize.fn(
                "FIND_IN_SET",
                warehouse_id.toString(),
                Sequelize.literal(`REPLACE(warehouse_id, ' ', '')`)
              ),
              { [Op.gt]: 0 }
            )
          ]
        }
      });

      // New Code By Saurabh


      if (!depot) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order.order_date,
          'remarks': `Depot for Warehouse (${warehouse}) & Warehouse Id (${warehouse_id}) not found in Depot Master.`
        });
        continue;
      }

      const order_date = orderData.order_date ? getDateString(new Date(orderData.order_date)) : '';
      if (!order_date) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': '',
          'remarks': `Purchase Date not found.`
        });
        continue;
      }

      const invoice_date = orderData.invoice_date ? getDateString(new Date(orderData.invoice_date)) : '';
      if (!invoice_date) {
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order_date,
          'remarks': `Invoice Date not found.`
        });
        continue;
      }

      const total_amount = orderData.total_amount ? parseFloat(orderData.total_amount) : 0;
      if(total_amount < 0){
        errorOrders.push({
          'order_no': reference_code,
          'order_date': order_date,
          'remarks': `Total amount is ${total_amount}.`
        });
        continue;
      }
      
      let name = order.customer_name ? order.customer_name : '';
      let address = (order.address_line_1 ? order.address_line_1 : '') + ' ' +
        (order.address_line_2 ? order.address_line_2 : '');
      let city = order.city ? order.city : '';
      let pincode = order.pin_code ? order.pin_code : '';
      let state = order.state ? order.state : null;
      let country = order.country ? order.country : null;
      let mobileNo = order.contact_num ? order.contact_num : billing_mobile ? billing_mobile : '';
      let state_code = order.state_code ? order.state_code : 27;

      let totalOrderAmount = 0;
      let saleItemError = false;
      const saleItems = [];
      
      const orderItems = order.suborders ? order.suborders : order.order_items;
      for (const orderItem of orderItems) {
        const productName = orderItem.productName ? orderItem.productName : '';
        const sku = orderItem.sku ? orderItem.sku : '';
        const QuantityOrdered = orderItem.suborder_quantity ? parseFloat(orderItem.suborder_quantity) : 0;
        
        let depotState = '';
        let depotId = '';
        let taxType = 'Intra';
        let quantity = QuantityOrdered;
        if (depot) {
          depotId = depot.id;
          depotState = depot.state;
        }
        
        if (state.trim().toUpperCase() !== depotState.trim().toUpperCase()) {
          taxType = 'Inter';
        }

        const saleItem = {
          distributor_out_id: 0,
          type: 'Box',
          item_id: 0,
          qty: quantity,
          sell_rate: 0,
          grams: 0,
          rate: 0,
          discount: 0,
          discount_amt: 0,
          amount: 0,
          cgst_amt: 0,
          sgst_amt: 0,
          igst_amt: 0,
          tax_amt: 0,
          total_amt: 0,
          margin_per: 0,
          promo_margin: 0,
          gst: 'No',
          tax_percentage: 0,
          // fc_id: fulfillmentCenterId,
          depot_state: depotState,
          depot_id: depotId,
          tax_type: taxType,
          combo_box_id: 0,
          batch_no: 182,
          batch_qty: 0
        };

        const comboBox = await ComboBox.findOne({ 
          where: { sku_code: sku }, 
          include: [{model: ComboBoxItem, as: 'comboBoxItems', attributes: ['combo_box_id', 'type', 'item_id', 'qty', 'rate', 'grams']}] 
        });
        if (comboBox) {
          saleItem.combo_box_id = comboBox.id ? comboBox.id : 0;

          if (comboBox.gst && comboBox.gst.trim().toUpperCase() === 'YES') {
            saleItem.type = 'Combo Box';
            saleItem.item_id = comboBox.id ? comboBox.id : 0;
            saleItem.qty = saleItem.qty;
            saleItem.sell_rate = comboBox.rate ? parseFloat(comboBox.rate) : 0;
            saleItem.grams = comboBox.grams ? parseFloat(comboBox.grams) : 0;
            saleItem.rate = comboBox.rate ? parseFloat(comboBox.rate) : 0;
            saleItem.gst = 'No';
            saleItem.tax_percentage = comboBox.gst_rate ? parseFloat(comboBox.gst_rate) : 0;

            saleItems.push({...saleItem});
          } else {
            for (const comboBoxItem of comboBox.comboBoxItems) {
              saleItem.type = comboBoxItem.type ? comboBoxItem.type : 'Box';
              saleItem.item_id = comboBoxItem.item_id ? comboBoxItem.item_id : 0;
              saleItem.qty = comboBoxItem.qty ? (parseFloat(comboBoxItem.qty) * quantity) : saleItem.qty;
              saleItem.sell_rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
              saleItem.grams = comboBoxItem.grams ? parseFloat(comboBoxItem.grams) : 0;
              saleItem.rate = comboBoxItem.rate ? parseFloat(comboBoxItem.rate) : 0;
              saleItem.gst = comboBox.gst ? comboBox.gst : 'No';
              saleItem.tax_percentage = comboBox.gst && comboBox.gst === 'Yes' ? parseFloat(comboBox.gst_rate) : 0;
  
              if (saleItem.type.trim().toUpperCase() === "BOX") {
                const box = await Box.findByPk(saleItem.item_id);
                if (box) {
                  saleItem.type = 'Box';
                  saleItem.item_id = box.id ? box.id : 0;
                  saleItem.qty = saleItem.qty;
                  saleItem.sell_rate = box.rate ? parseFloat(box.rate) : 0;
                  saleItem.grams = box.grams ? parseFloat(box.grams) : 0;
                  saleItem.rate = box.rate ? parseFloat(box.rate) : 0;
                  if (saleItem.gst.trim().toUpperCase() === 'NO') {
                    saleItem.tax_percentage = box.tax_percentage ? parseFloat(box.tax_percentage) : saleItem.tax_percentage;
                  }
                } else {
                  const product = await Product.findByPk(saleItem.item_id);
                  if (product) {
                    saleItem.type = 'Bar';
                    saleItem.item_id = product.id ? product.id : 0;
                    saleItem.qty = saleItem.qty;
                    saleItem.sell_rate = product.rate ? parseFloat(product.rate) : 0;
                    saleItem.grams = product.grams ? parseFloat(product.grams) : 0;
                    saleItem.rate = product.rate ? parseFloat(product.rate) : 0;
                    if (saleItem.gst.trim().toUpperCase() === 'NO') {
                      saleItem.tax_percentage = product.tax_percentage ? parseFloat(product.tax_percentage) : saleItem.tax_percentage;
                    }
                  }
                }
              }
  
              saleItems.push({...saleItem});
            }
          }
        } else {
          const box = await Box.findOne({ where: { sku_code: sku } });
          if (box) {
            saleItem.type = 'Box';
            saleItem.item_id = box.id ? box.id : 0;
            saleItem.qty = saleItem.qty;
            saleItem.sell_rate = box.rate ? parseFloat(box.rate) : 0;
            saleItem.grams = box.grams ? parseFloat(box.grams) : 0;
            saleItem.rate = box.rate ? parseFloat(box.rate) : 0;
            saleItem.gst = 'No';
            saleItem.tax_percentage = box.tax_percentage ? parseFloat(box.tax_percentage) : 0;

            saleItems.push({...saleItem});
          } else {
            errorOrders.push({
              'order_no': reference_code,
              'order_date': order_date,
              'remarks': `sku (${sku}) for product (${productName}) not found in Product Master.`
            });
            saleItemError = true;
          }
        }
      }

      if (saleItemError) {
        continue;
      }

      for (let index = 0; index < saleItems.length; index++) {
        const totalAmt = round(saleItems[index].qty * saleItems[index].sell_rate, 2);
        totalOrderAmount = totalOrderAmount + totalAmt;

        saleItems[index].amount = totalAmt;
        saleItems[index].total_amt = totalAmt;
      }

      const totalDiscountAmount = round(totalOrderAmount - total_amount, 2);
      let discount = 0;
      if (totalOrderAmount != 0) {
        discount = round((totalDiscountAmount / totalOrderAmount) * 100, 2);
      }

      const salesReturnData = [];

      for (const saleReturnItem of saleItems) {
        saleReturnItem.discount = discount;

        const finalSaleReturnItem = new SaleReturnItem({
          distributor_in_id: 0
        });

        finalSaleReturnItem.getRequestData(saleReturnItem);

        await finalSaleReturnItem.setItemAmount();
        
        const index = salesReturnData.findIndex(saleReturnData => saleReturnData.depot_id === saleReturnItem.depot_id);

        if (index === -1) {
          let order_no = normalizedOrderNo;
          if (salesReturnData.length !== 0) {
            order_no = order_no + '$' + salesReturnData.length.toString();
          }
          salesReturnData.push({
            order_no: order_no,
            depot_id: saleReturnItem.depot_id,
            fc_id: saleReturnItem.fc_id,
            tax_type: saleReturnItem.tax_type,
            saleReturnItems: [finalSaleReturnItem]
          });
        } else {
          salesReturnData[index].saleReturnItems.push(finalSaleReturnItem);
        }
      }

      const sale = await Sale.findOne({ where: { order_no: normalizedOrderNo } });

      for (const saleReturnData of salesReturnData) {
        try {
          const finalSaleReturnItems = saleReturnData.saleReturnItems;
          const curDate = getDateTimeString(new Date());
          const saleReturn = new SaleReturn({
            date_of_processing: invoice_date,
            invoice_nos: sale && sale.invoice_no ? sale.invoice_no : '',
            depot_id: saleReturnData.depot_id,
            distributor_id: distributor.id,
            amount: 0,
            tax: 'gst',
            cst: 1,
            tax_amount: 0,
            final_amount: totalOrderAmount,
            due_date: curDate,
            order_no: saleReturnData.order_no,
            status: 'Pending',
            remarks: 'This is system generated entry.',
            modified_by: 421,
            modified_on: curDate,
            discount: discount,
            cgst: 1,
            sgst: 1,
            igst: 1,
            cgst_amount: 0,
            sgst_amount: 0,
            igst_amount: 0,
            round_off_amount: 0,
            sales_return_amount: 0,
            sales_return_date: invoice_date,
            sales_type: sale && sale.invoice_no ? 'Invoice' : 'Adhoc',
            shipping_charges: 0,
            created_by: 421,
            created_on: curDate,
            tax_type: saleReturnData.tax_type
          });

          let error = await saleReturn.setTransactionAmount(finalSaleReturnItems);
          if (error) {
            throw error;
          }
          
          saleReturn.status = 'Approved';
          saleReturn.approved_by = 421;
          saleReturn.approved_on = curDate;

          t = await sequelize.transaction();

          let series = 1;
          if (!saleReturn.sales_return_no) {
            series = await getSeries(req, 'Sales_Return');
            saleReturn.getSaleReturnNo(series.series);
            await series.save({ transaction: t });
          }
          
          await saleReturn.save({ transaction: t });

          for(const finalSaleReturnItem of finalSaleReturnItems) {
            finalSaleReturnItem.distributor_in_id = saleReturn.id;
            await finalSaleReturnItem.save({ transaction: t });
          }

          const finalSaleReturnItemProducts = await saleReturn.getSaleReturnItemProducts(finalSaleReturnItems);
          for(const saleReturnItemProduct of finalSaleReturnItemProducts) {
            const finalSaleReturnItemProduct = new SaleReturnItemProduct({...saleReturnItemProduct});
            finalSaleReturnItemProduct.distributor_in_id = saleReturn.id;
            finalSaleReturnItemProduct.setItemAmount();
            await finalSaleReturnItemProduct.save({ transaction: t });
          }

          series = await getSeries(req, 'Account_Voucher');
          await series.save({ transaction: t });

          const accLedgerEntry = { 
            ref_type: 'Distributor_Sales_Return',
            ref_id: saleReturn.id, 
            type: 'Credit', 
            voucher_id: series.series,
            invoice_no: null,
            ref_date: saleReturn.sales_return_date ? saleReturn.sales_return_date : saleReturn.date_of_processing,
            amount: saleReturn.sales_return_amount
          };
          
          const accountLedgerEntry1 = new AccountLedgerEntry(accLedgerEntry);
          const accountLedgerEntry2 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Debit' });
          const accountLedgerEntry3 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Debit' });
          
          await accountLedgerEntry1.setMainEntryData(saleReturn);
          accountLedgerEntry2.SetTaxableData(saleReturn);
          accountLedgerEntry3.SetTaxData(saleReturn);
          
          await accountLedgerEntry1.save({ transaction: t });
          await accountLedgerEntry2.save({ transaction: t });
          await accountLedgerEntry3.save({ transaction: t });

          if (saleReturn.shipping_charges) {
            const accountLedgerEntry4 = new AccountLedgerEntry({ ...accLedgerEntry, type: 'Credit' });
            accountLedgerEntry4.SetShippingData(saleReturn);
            await accountLedgerEntry4.save({ transaction: t });
          }
          
          await t.commit();

          uploadedOrders.push({
            'order_no': reference_code,
            'order_date': order_date,
            'remarks': 'Success'
          });
        } catch (error) {
          console.log(error);
          if (t) {
            await t.rollback();
          }

          errorOrders.push({
            'order_no': reference_code,
            'order_date': order_date,
            'remarks': error.message
          });
        }
      }
    }

    if (errorOrders.length > 0) {
      sendOrderEmail(errorOrders);
    }

    // console.log('Success');
    if (res) {
      res.status(200).json({ 
        message: 'Easy Ecom Orders fetched. ', 
        'Total No Of Orders': orders.length, 
        'Uploaded Orders': uploadedOrders.length, 
        'Error Orders': errorOrders.length, 
        uploadedOrders: uploadedOrders, 
        errorOrders: errorOrders, 
        orders: orders 
      });
    } else {
      logger.log({
        level: "info",
        message: "Easy Ecom API Cron For Orders On - " + new Date().toLocaleString(),
        // stack: err.stack,
        metadata: { orders: orders.length, uploadedOrders: uploadedOrders.length, errorOrders: errorOrders.length }, // Put what you like as meta
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Downloading Easy Ecom Orders Failed! Error - " + (error.message ? error.message : '')
    });

    sendOrderFetchingFailedEmail(error);

    res.statusCode = 500;
    res.message = "Downloading Easy Ecom Orders failed!";
    next(error, req, res);
  }
};



export const getShopifyOrder = async (req, res, next) => {
  let t;

  try {
    let name = req.params.name ? req.params.name : '';

    // if (name.indexOf('#') === -1) {
    //   if (name.indexOf('ZOP') === -1) {
    //     name = '#'+name;
    //   } else {
    //     name = name.substring(0, 3) + '#' + name.substring(3);
    //   }
    // }

    const fetchedOrder = await getOrder(name);

    if (fetchedOrder instanceof Error) throw fetchedOrder;

    return res.status(200).json(fetchedOrder);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Downloading Shpify Order Failed! Error - " + (error.message ? error.message : '')
    });

    // sendOrderFetchingFailedEmail(error);

    res.statusCode = 500;
    res.message = "Downloading Shpify Order failed!";
    next(error, req, res);
  }
};