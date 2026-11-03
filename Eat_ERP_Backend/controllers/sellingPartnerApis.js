
import sequelize from '../lib/database.js';
// import path from 'path';
// import fs from 'fs';
// import es from 'event-stream';

// import { downloadFileFromUrl } from "../lib/downloadFileFromUrl.js";
import { getDateString, getDateTimeString, round } from '../lib/common.js';
// import logger from '../lib/logger';
import {
  // testApi,
  downloadReport,
  // createReport,
  // getReport,
  // getReportDocument,
  getOrders,
  getOrder,
  getOrderItems,
  sendOrderFetchingFailedEmail,
  sendOrderEmail,
  getOrderBuyerInfo,
  // getOrder,
  // getOrderItems,
  // sendOrderEmail,
  // sendOrderFetchingFailedEmail
} from '../lib/sellingPartnerApi.js';

// import Pincode from "../models/pincode";
// import State from "../models/state";
// import Country from "../models/country";

// import AmazonReport from "../models/amazonReport.js";
import AmazonOrderFulfillmentCenter from "../models/amazonOrderFulfillmentCenter.js";
import Distributor from '../models/distributor.js';
import Sale from "../models/sale.js";
import Depot from "../models/depot.js";
import Product from "../models/product.js";
import { getSeries } from "../models/series.js";
import User from "../models/user.js";
// import Stock from "../models/stock.js";
import State from '../models/state.js';
import Pincode from '../models/pincode.js';
import Country from '../models/country.js';
import ComboBox from '../models/comboBox.js';
import Box from '../models/box.js';
import SaleItem from '../models/saleItem.js';
import ComboBoxItem from '../models/comboBoxItem.js';
import AccountLedgerEntry from '../models/accountLedgerEntry.js';
import SaleItemProduct from '../models/saleItemProduct1.js';

export const downloadFbaShipmentReport = async (req, res, next) => {
  try {
    const startDate = new Date();
    // const endDate = new Date();

    startDate.setDate(startDate.getDate() - 15);
    // endDate.setDate(endDate.getDate() - 15);

    // console.log(startDate);
    // console.log(endDate);

    // startDate = "2023-04-01T00:00:00.000Z";

    // startDate.setDate(startDate.getDate() - 24);

    const body = {
      reportType: "GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL",
      dataStartTime: startDate,
      // dataEndTime: endDate
    };

    const data = await downloadReport(body);

    if (data instanceof Error) {
      throw data;
    }

    // console.log(data);

    for (const order of data) {
      let amazonOrderFulfillmentCenter = await AmazonOrderFulfillmentCenter.findOne({ 
        where: {
          order_id: order["amazon-order-id"],
          order_item_id: order["amazon-order-item-id"]
        }
      });
      
      if (!amazonOrderFulfillmentCenter) {
        amazonOrderFulfillmentCenter = new AmazonOrderFulfillmentCenter({
          order_id: order["amazon-order-id"],
          order_item_id: order["amazon-order-item-id"],
          order_item_name: order["product-name"],
          fc_id: order["fulfillment-center-id"],
          remarks: 'This is system generated entry.',
          status: 'Approved',
          created_by: 148,
          modified_by: 148
        });
      } else {
        amazonOrderFulfillmentCenter.order_item_name = order["product-name"];
        amazonOrderFulfillmentCenter.fc_id = order["fulfillment-center-id"];
        amazonOrderFulfillmentCenter.remarks = 'This is system generated entry.';
        amazonOrderFulfillmentCenter.status = 'Approved';
        amazonOrderFulfillmentCenter.modified_by = 148;
      }
      
      await amazonOrderFulfillmentCenter.save();
    }

    if (res) {
      res.status(200).json({ data: data });
    } else {
      return { data: data };
    }
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating FBA Shipment Report Failed!"
    // });

    res.statusCode = 500;
    res.message = "Creating FBA Shipment Report failed!";
    next(error, req, res);
  }
};

export const getSpApiOrders = async (req, res, next) => {
  let t;

  try {
    const user = await User.findByPk(148);
    if (user) {
      req.userData = {
        email: user.email_id,
        userId: user.id,
        userRoleId: user.role_id,
        roleDetails: {}
      };
    } else {
      // errorOrders.push({
      //   'order_no': '',
      //   'order_date': '',
      //   'remarks': `User with id (148) not found in User Master.`
      // });

      throw new Error(`User with id (148) not found in User Master.`);
    }

    const distributorName = 'Amazon Direct';
    const distributor = await Distributor.findOne({ where: {distributor_Name: distributorName} });
    if (!distributor) {
      // errorOrders.push({
      //   'order_no': '',
      //   'order_date': '',
      //   'remarks': `Distributor (${distributorName}) not found in Distributor Master.`
      // });

      throw new Error(`Distributor (${distributorName}) not found in Distributor Master.`);
    }

    let lastUpdatedAfter = new Date();
    lastUpdatedAfter.setDate(lastUpdatedAfter.getDate() - 5);
    let NextToken = '';
    const orders = [];
    let apiCnt = 0;

    // lastUpdatedAfter = new Date('2024-08-23T00:00:00Z');

    do {
      let fetchedOrders = await getOrders(lastUpdatedAfter.toISOString(), NextToken);

      // console.log(lastUpdatedAfter);

      if (!fetchedOrders || fetchedOrders instanceof Error || !fetchedOrders.Orders) {
        throw fetchedOrders;
      }

      orders.push(...fetchedOrders.Orders);
      NextToken = fetchedOrders.NextToken ? fetchedOrders.NextToken : '';
      // NextToken = '';
      // apiCnt = apiCnt + 1;
    } while (NextToken !== '' && apiCnt <= 10);

    // return res.status(200).json(orders);
    
    const errorOrders = [];
    const uploadedOrders = [];

    // console.log('Total Orders - ', orders.length);

    for (const order of orders) {
      const AmazonOrderId = order.AmazonOrderId;
      const OrderStatus = order.OrderStatus;
      const FulfillmentChannel = order.FulfillmentChannel;
      const IsBusinessOrder = order.IsBusinessOrder;
      const IsReplacementOrder = order.IsReplacementOrder;

      let placeOrder = false;

      if (FulfillmentChannel.trim().toUpperCase() === 'AFN' && OrderStatus.trim().toUpperCase() === 'SHIPPED') {
        placeOrder = true;
      } else if (FulfillmentChannel.trim().toUpperCase() === 'MFN' &&
        (OrderStatus.trim().toUpperCase() === 'UNSHIPPED' ||
          OrderStatus.trim().toUpperCase() === 'SHIPPED')) {
        placeOrder = true;
      }

      if (placeOrder === false) {
        continue;
      }

      const saleCount = await Sale.count({ where: {order_no: AmazonOrderId} });
      if (saleCount > 0) {
        continue;
      }

      const orderData = {...order};
      // const orderData = await getOrder(AmazonOrderId);
      // if (!orderData || orderData instanceof Error) {
      //   errorOrders.push({
      //     'order_no': AmazonOrderId,
      //     'order_date': '',
      //     'remarks': `Order Details not found.`
      //   });
      //   continue;
      // }

      const PurchaseDate = orderData.PurchaseDate ? getDateString(new Date(orderData.PurchaseDate)) : '';
      if (!PurchaseDate) {
        errorOrders.push({
          'order_no': AmazonOrderId,
          'order_date': '',
          'remarks': `Purchase Date not found.`
        });
        continue;
      }

      const LastUpdateDate = orderData.LastUpdateDate ? getDateString(new Date(orderData.LastUpdateDate)) : '';
      if (!LastUpdateDate) {
        errorOrders.push({
          'order_no': AmazonOrderId,
          'order_date': PurchaseDate,
          'remarks': `Last Update Date not found.`
        });
        continue;
      }

      const OrderTotal = orderData.OrderTotal ? orderData.OrderTotal : null;
      let OrderTotalAmount = 0;
      if (OrderTotal) {
        OrderTotalAmount = OrderTotal.Amount ? parseFloat(OrderTotal.Amount) : 0;
      }
      // if (!OrderTotalAmount) {
      //   continue;
      // }

      
      if(FulfillmentChannel.trim().toUpperCase() !== 'MFN' && OrderTotalAmount <= 0 && IsReplacementOrder !== 'true'){
        continue;
      }

      const ShippingAddress = orderData.ShippingAddress ? orderData.ShippingAddress : null;

      if (!ShippingAddress) {
        errorOrders.push({
          'order_no': AmazonOrderId,
          'order_date': PurchaseDate,
          'remarks': `Shipping Address not found.`
        });
        continue;
      }

      let name = ShippingAddress.Name ? ShippingAddress.Name : '';
      let address = (ShippingAddress.AddressLine1 ? ShippingAddress.AddressLine1 : '') + ' ' +
        (ShippingAddress.AddressLine2 ? ShippingAddress.AddressLine2 : '') + ' ' +
        (ShippingAddress.AddressLine3 ? ShippingAddress.AddressLine3 : '');
      let city = ShippingAddress.City ? ShippingAddress.City : '';
      let pincode = ShippingAddress.PostalCode ? ShippingAddress.PostalCode : '';
      let state = ShippingAddress.StateOrRegion ? ShippingAddress.StateOrRegion : null;
      let country = ShippingAddress.County ? ShippingAddress.County : null;
      let mobileNo = ShippingAddress.Phone ? ShippingAddress.Phone : '';
      let stateCode = 27;

      if (state) {
        // state = '/^' + state + '$/i';
        state = await State.findOne({ where: {state_name: state} });
      }

      if (!state) {
        pincode = await Pincode.findOne({ where: {pincode: pincode} });
        if (pincode) {
          state = await State.findByPk(pincode.state_id);
          pincode = pincode.pincode;
        }
      }

      if (!state) {
        errorOrders.push({
          'order_no': AmazonOrderId,
          'order_date': PurchaseDate,
          'remarks': `Shipping Address Pincode (${ShippingAddress.PostalCode ? ShippingAddress.PostalCode : ''}) not found in Picode Master and 
                    State (${ShippingAddress.StateOrRegion ? ShippingAddress.StateOrRegion : ''}) not found in State Master.`
        });
        continue;
      } else {
        country = await Country.findByPk(state.country_id);
        stateCode = state.state_code;
      }

      if (IsBusinessOrder) {
        // if (orderData.BuyerTaxInformation && orderData.BuyerTaxInformation.BuyerLegalCompanyName) {
        //   name = orderData.BuyerTaxInformation.BuyerLegalCompanyName.trim();
        // }
        const OrderBuyerInfo = await getOrderBuyerInfo(AmazonOrderId);
        if (!OrderBuyerInfo || OrderBuyerInfo instanceof Error) {
          errorOrders.push({
            'order_no': AmazonOrderId,
            'order_date': '',
            'remarks': `Order Buyer Info not found.`
          });
          continue;
        }
        
        if (OrderBuyerInfo.BuyerTaxInfo && OrderBuyerInfo.BuyerTaxInfo.CompanyLegalName) {
          name = OrderBuyerInfo.BuyerTaxInfo.CompanyLegalName.trim();
        }
      }

      let totalOrderAmount = 0;
      let saleItemError = false;
      const saleItems = [];

      let orderItems = await getOrderItems(AmazonOrderId);
      if (!orderItems || orderItems instanceof Error || !orderItems.OrderItems) {
        errorOrders.push({
          'order_no': AmazonOrderId,
          'order_date': PurchaseDate,
          'remarks': `Order Items not found.`
        });
        continue;
      }
      orderItems = orderItems.OrderItems;
      for (const orderItem of orderItems) {
        const orderItemName = orderItem.SellerSKU ? orderItem.SellerSKU : '';
        const ASIN = orderItem.ASIN ? orderItem.ASIN : '';
        const OrderItemId = orderItem.OrderItemId ? orderItem.OrderItemId : '';
        const QuantityOrdered = orderItem.QuantityOrdered ? parseFloat(orderItem.QuantityOrdered) : 0;
        const QuantityShipped = orderItem.QuantityShipped ? parseFloat(orderItem.QuantityShipped) : 0;
        // const ItemPrice = orderItem.ItemPrice ? orderItem.ItemPrice : '';
        // const PromotionDiscount = orderItem.PromotionDiscount ? orderItem.PromotionDiscount : '';
        // const ItemAmount = ItemPrice.Amount ? ItemPrice.Amount : 0;
        // const PromotionDiscountAmount = PromotionDiscount.Amount ? PromotionDiscount.Amount : 0;

        let fulfillmentCenterId = '';
        let depotState = '';
        let depotId = '';
        let depot = '';
        let taxType = 'Intra';
        let quantity = QuantityOrdered;

        if (FulfillmentChannel.trim().toUpperCase() === 'AFN') {
          const amazonOrderFulfillmentCenter = await AmazonOrderFulfillmentCenter.findOne({
            where: {
              order_id: AmazonOrderId,
              order_item_id: OrderItemId
            }
          });
          if (amazonOrderFulfillmentCenter) {
            fulfillmentCenterId = amazonOrderFulfillmentCenter.fc_id;
            // depot = await Depot.findOne();
            if (fulfillmentCenterId) {
              depot = await Depot.findOne({
                where: {
                  depot_fc_id: fulfillmentCenterId
                }
              });

              if (!depot) {
                // Send mail to client about fulfillment center depot not found
                errorOrders.push({
                  'order_no': AmazonOrderId,
                  'order_date': PurchaseDate,
                  'remarks': `Depot for Fulfillment Center Code ${fulfillmentCenterId} not found in Depot Master.`
                });
                saleItemError = true;
                continue;
              }
            } else {
              // errorOrders.push({
              //   'order_no': AmazonOrderId,
              //   'order_date': PurchaseDate,
              //   'remarks': `Amazon Fulfillment Center not found for Order Item (${OrderItemId}).`
              // });
              saleItemError = true;
              continue;
            }
          } else {
            // errorOrders.push({
            //   'order_no': AmazonOrderId,
            //   'order_date': PurchaseDate,
            //   'remarks': `Amazon Fulfillment Center not found for Order Item (${OrderItemId}).`
            // });
            saleItemError = true;
            continue;
          }

          quantity = QuantityShipped;
        } else {
          // depot = await Depot.findOne();
          depot = await Depot.findByPk(2);

          if (!depot) {
            // Send mail to client about fulfillment center depot not found
            errorOrders.push({
              'order_no': AmazonOrderId,
              'order_date': PurchaseDate,
              'remarks': `Depot for id (2) not found in Depot Master.`
            });
            saleItemError = true;
            continue;
          }
        }

        if (!depot || depot === '') {
          depot = await Depot.findByPk(2);

          if (!depot) {
            // Send mail to client about fulfillment center depot not found
            errorOrders.push({
              'order_no': AmazonOrderId,
              'order_date': PurchaseDate,
              'remarks': `Depot for id (2) not found in Depot Master.`
            });
            saleItemError = true;
            continue;
          }
        }

        if (depot) {
          depotId = depot.id;
          depotState = depot.state;
        }

        if (state.state_name.trim().toUpperCase() !== depotState.trim().toUpperCase()) {
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
          fc_id: fulfillmentCenterId,
          depot_state: depotState,
          depot_id: depotId,
          tax_type: taxType,
          combo_box_id: 0,
          batch_no: 182,
          batch_qty: 0
        };

        const comboBox = await ComboBox.findOne({ 
          where: { asin: ASIN }, 
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
              saleItem.qty = comboBoxItem.qty ? (parseFloat(comboBoxItem.qty) * quantity) : 0;
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
          const box = await Box.findOne({ where: { asin: ASIN } });
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
              'order_no': AmazonOrderId,
              'order_date': PurchaseDate,
              'remarks': `ASIN (${ASIN}) for product (${orderItemName}) not found in Product Master.`
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

      const totalDiscountAmount = round(totalOrderAmount - OrderTotalAmount, 2);
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
          let order_no = AmazonOrderId;
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

          const sale = new Sale({
            date_of_processing: PurchaseDate,
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
            order_date: PurchaseDate,
            status: 'Pending',
            remarks: 'This is system generated entry.',
            modified_by: 148,
            modified_on: curDate,
            client_name: name,
            address: address,
            city: city,
            pincode: pincode,
            state: state.state_name,
            country: country.country_name,
            mobileNo: mobileNo,
            discount: discount,
            date_of_dispatch: curDate,
            delivery_status: 'Delivered',
            delivery_date: curDate,
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
            state_code: stateCode,
            round_off_amount: 0,
            invoice_amount: 0,
            invoice_date: LastUpdateDate,
            email_date_time: curDate,
            basis_of_sales: 'PO Number',
            email_from: '',
            email_approved_by: '',
            gstin: '',
            shipping_charges: 0,
            created_by: 148,
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
          //     'order_no': AmazonOrderId,
          //     'order_date': PurchaseDate,
          //     'remarks': message
          //   });
          //   continue;
          // }

          // error = sale.approve(req);
          // if (error) {
          //   throw error;
          // }

          sale.status = 'Approved';
          sale.approved_by = 148;
          sale.approved_on = curDate;

          t = await sequelize.transaction();

          let series = 1;
          if (!sale.invoiceNo) {
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

          const accountLedgerEntry1 = new AccountLedgerEntry({ ref_id: sale.id, voucher_id: series.series });
          const accountLedgerEntry2 = new AccountLedgerEntry({ ref_id: sale.id, voucher_id: series.series });
          const accountLedgerEntry3 = new AccountLedgerEntry({ ref_id: sale.id, voucher_id: series.series });
          
          await accountLedgerEntry1.setSaleData(sale);
          accountLedgerEntry2.SetTaxableData(sale);
          accountLedgerEntry3.SetTaxData(sale);
          
          await accountLedgerEntry1.save({ transaction: t });
          await accountLedgerEntry2.save({ transaction: t });
          await accountLedgerEntry3.save({ transaction: t });

          if (sale.shipping_charges) {
            const accountLedgerEntry4 = new AccountLedgerEntry({ ref_id: sale.id, voucher_id: series.series });
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
            'order_no': AmazonOrderId,
            'order_date': PurchaseDate,
            'remarks': 'Success'
          });
        } catch (error) {
          console.log(error);
          if (t) {
            await t.rollback();
          }

          errorOrders.push({
            'order_no': AmazonOrderId,
            'order_date': PurchaseDate,
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
        message: 'Amazon Orders fetched. ', 
        'Total No Of Orders': orders.length, 
        uploadedOrders: uploadedOrders, 
        errorOrders: errorOrders, orders: orders 
      });
    } else {
      logger.log({
        level: "info",
        message: "Amazon API Cron For Orders On - " + new Date().toLocaleString(),
        // stack: err.stack,
        metadata: { orders: orders.length, uploadedOrders: uploadedOrders.length, errorOrders: errorOrders.length }, // Put what you like as meta
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Downloading Amazon Orders Failed! Error - " + (error.message ? error.message : '')
    });

    sendOrderFetchingFailedEmail(error);

    res.statusCode = 500;
    res.message = "Downloading Amazon Orders failed!";
    next(error, req, res);
  }
};

export const getSpApiOrder = async (req, res, next) => {
  try {
    const data = await getOrder(req.params.orderId);

    if (data instanceof Error) {
      throw data;
    }

    if (res) {
      res.status(200).json({ data: data });
    } else {
      return { data: data };
    }
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Getting Order Failed!"
    // });

    res.statusCode = 500;
    res.message = "Getting Order failed!";
    next(error, req, res);
  }
};

export const getSpApiOrderItems = async (req, res, next) => {
  let t;

  try {
    let orderItems = await getOrderItems(req.params.orderId);

    return res.status(200).json(orderItems);
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Downloading Amazon Order Items Failed! Error - " + (error.message ? error.message : '')
    // });

    res.statusCode = 500;
    res.message = "Downloading Amazon Order Items failed!";
    next(error, req, res);
  }
};

export const downloadFbaReturnReport = async (req, res, next) => {
  try {
    const startDate = new Date();
    // const endDate = new Date();

    startDate.setDate(startDate.getDate() - 89);
    // endDate.setDate(endDate.getDate() - 15);

    // console.log(startDate);
    // console.log(endDate);

    // startDate = "2023-04-01T00:00:00.000Z";

    // startDate.setDate(startDate.getDate() - 24);

    const body = {
      reportType: "GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA",
      dataStartTime: startDate,
      // dataEndTime: endDate
    };

    const data = await downloadReport(body);

    if (data instanceof Error) {
      throw data;
    }

    console.log(data);

    if (res) {
      res.status(200).json({ data: data });
    } else {
      return { data: data };
    }
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating FBA Shipment Report Failed!"
    // });

    res.statusCode = 500;
    res.message = "Creating FBA Shipment Report failed!";
    next(error, req, res);
  }
};

// export const createFbaShipmentReport = async (req, res, next) => {
//   try {
//     const startDate = new Date();
//     startDate.setDate(startDate.getDate() - 24);

//     console.log(startDate);

//     // startDate = "2023-04-01T00:00:00.000Z";

//     const body = {
//       reportType: "GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL",
//       dataStartTime: startDate
//     };

//     const data = await createReport(body);

//     if (data instanceof Error) {
//       throw data;
//     }

//     if (data) {
//       const amazonReport = new AmazonReport({
//         report_id: data,
//         reportType: 'GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL'
//       });
//       await amazonReport.save();
//     }

//     if (res) {
//       res.status(200).json({ report_id: data });
//     } else {
//       return { report_id: data };
//     }
//   } catch (error) {
//     // console.log(error);
//     // res.status(500).json({
//     //   message: "Creating FBA Shipment Report Failed!"
//     // });

//     res.statusCode = 500;
//     res.message = "Creating FBA Shipment Report failed!";
//     next(error, req, res);
//   }
// };

// export const getFbaShipmentReport = async (req, res, next) => {
//   try {
//     const amazonReport = await AmazonReport
//       .findOne({ where: {reportType: 'GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL'}, order: [['updatedAt', 'desc']] });

//     console.log(amazonReport);

//     if (!amazonReport || !amazonReport.reportId) {
//       return res ? res.status(404).json({ message: "Amazon Report not found!" }) : { message: "Amazon Report not found!" };
//     }

//     const data = await getReport(amazonReport.reportId);

//     if (data instanceof Error) {
//       throw data;
//     }

//     if (data) {
//       amazonReport.report_type = data.reportType;
//       // amazonReport.processingEndTime = data.processingEndTime;
//       amazonReport.processing_status = data.processingStatus;
//       amazonReport.report_document_id = data.reportDocumentId;
//       amazonReport.to_date = data.dataEndTime;
//       // amazonReport.createdTime = data.createdTime;
//       // amazonReport.processingStartTime = data.processingStartTime;
//       amazonReport.from_date = data.dataStartTime;
//       amazonReport.url = '';

//       await amazonReport.save();
//     }

//     if (res) {
//       res.status(200).json({ amazonReport });
//     } else {
//       return { amazonReport };
//     }
//   } catch (error) {
//     // console.log(error);
//     // res.status(500).json({
//     //   message: "Getting FBA Shipment Report Failed!"
//     // });

//     res.statusCode = 500;
//     res.message = "Getting FBA Shipment Report failed!";
//     next(error, req, res);
//   }
// };

// export const getFbaShipmentReportDocument = async (req, res, next) => {
//   try {
//     const amazonReport = await AmazonReport
//       .findOne({ where: {reportType: 'GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL'}, order: [['updatedAt', 'desc']] });
    
//     console.log(amazonReport);

//     if (!amazonReport || !amazonReport.reportId || !amazonReport.processingStatus) {
//       return res ? res.status(404).json({ message: "Amazon Report not found!" }) : { message: "Amazon Report not found!" };
//     }

//     if (amazonReport.processingStatus.trim().toUpperCase() !== 'DONE') {
//       return res ? res.status(404).json({ message: "Amazon Report not yet finished processing!" }) : { message: "Amazon Report not yet finished processing!" };
//     }

//     const data = await getReportDocument(amazonReport.reportDocumentId);

//     if (data instanceof Error) {
//       throw data;
//     }

//     if (data) {
//       amazonReport.url = data;

//       await amazonReport.save();
//     }

//     if (res) {
//       res.status(200).json({ amazonReport });
//     } else {
//       return { amazonReport };
//     }
//   } catch (error) {
//     // console.log(error);
//     // res.status(500).json({
//     //   message: "Getting FBA Shipment Report Document Failed!"
//     // });

//     res.statusCode = 500;
//     res.message = "Getting FBA Shipment Report Document failed!";
//     next(error, req, res);
//   }
// };

// export const downloadFbaShipmentReportOld = async (req, res, next) => {
//   try {
//     const amazonReport = await AmazonReport
//       .findOne({ where: {reportType: 'GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL'}, order: [['updatedAt', 'desc']] });

//     console.log(amazonReport);

//     if (!amazonReport || !amazonReport.url) {
//       return res ? res.status(404).json({ message: "Amazon Report not found!" }) : { message: "Amazon Report not found!" };
//     }

//     const url = amazonReport.url;
//     const dest = path.join(getReportPath(), 'amazon', `${amazonReport.reportId}.txt`);
//     const downloadData = await downloadFileFromUrl(url, dest);

//     console.log(dest);

//     // console.log(downloadData);

//     if (!fs.existsSync(dest)) {
//       console.log('File Not Found.');
//       return res ? res.status(500).json({ 'error': 'File Not Found.' }) : { 'error': 'File Not Found.' };
//     }

//     let lineNumer = 0;
//     let error = '';
//     let data = [];

//     let s = fs.createReadStream(dest)
//       .pipe(es.split())
//       .pipe(es.mapSync(function (line) {
//         //pause the readstream
//         s.pause();
//         const lineData = line.split('\t');

//         if (lineData.length < 46) {
//           data.error = 'File Data not proper';
//           s.end();
//         }

//         if (lineNumer === 0) {
//           if (lineData[0].trim().toUpperCase() !== 'AMAZON-ORDER-ID' ||
//             lineData[4].trim().toUpperCase() !== 'AMAZON-ORDER-ITEM-ID' ||
//             lineData[45].trim().toUpperCase() !== 'FULFILLMENT-CENTER-ID') {
//             error = 'File format does not match';
//             s.end();
//           }
//         } else {
//           data.push({
//             order_id: lineData[0].trim(),
//             order_item_id: lineData[4].trim(),
//             order_item_name: lineData[14].trim(),
//             fc_id: lineData[45].trim()
//           });
//         }

//         lineNumer++;

//         // if (lineNumer === 5) {
//         //   s.end();
//         // }

//         s.resume();
//       })
//         .on('error', function (err) {
//           return res ? res.status(500).json({ 'error': err }) : { 'error': err };
//         })
//         .on('end', async function () {
//           if (error) {
//             return res ? res.status(404).json({ message: error }) : { message: error };
//           }

//           for (const order of data) {
//             let amazonOrderFulfillmentCenter = await AmazonOrderFulfillmentCenter.findOne({ 
//               where: {
//                 order_id: order.order_id,
//                 order_item_id: order.order_item_id
//               }
//             });
            
//             if (!amazonOrderFulfillmentCenter) {
//               amazonOrderFulfillmentCenter = new AmazonOrderFulfillmentCenter({
//                 // amazonReportId: amazonReport.id,
//                 order_id: order.order_id,
//                 order_item_id: order.order_item_id,
//                 order_item_name: order.order_item_name,
//                 fc_id: order.fc_id
//               });
//             }
            
//             await amazonOrderFulfillmentCenter.save();
//           }

//           if (res) {
//             res.status(200).json({ data: data });
//           } else {
//             return { data: data };
//           }
//         })
//       );
//   } catch (error) {
//     // console.log(error);
//     // res.status(500).json({
//     //   message: "Downloading FBA Shipment Report Failed!"
//     // });

//     res.statusCode = 500;
//     res.message = "Downloading FBA Shipment Report failed!";
//     next(error, req, res);
//   }
// };

// export const updateOrders = async (req, res, next) => {
//   try {
//     const lastUpdatedAfter = new Date();
//     lastUpdatedAfter.setDate(lastUpdatedAfter.getDate() - 60);
//     let orders = await getOrders(lastUpdatedAfter.toISOString());

//     if (!orders || orders instanceof Error || !orders.Orders) {
//       throw orders;
//     }

//     orders = orders.Orders;

//     const errorOrders = [];
//     const uploadedOrders = [];

//     // console.log('Total Orders - ', orders.length);

//     const user = await User.findByPk('640f00d9526a70584a21bcb8');
//     if (user) {
//       req.userData = {
//         email: user.email,
//         userId: user._id.toString(),
//         userRoleId: user.userRole.toString(),
//         roleDetails: {}
//       };
//     } else {
//       errorOrders.push({
//         'order_no': '',
//         'order_date': '',
//         'remarks': `User with id (640f00d9526a70584a21bcb8) not found in User Master.`
//       });

//       throw new Error(`User with id (640f00d9526a70584a21bcb8) not found in User Master.`);
//     }

//     const distributorName = 'Amazon Direct';
//     const distributor = await Distributor.findOne({ distributorName: distributorName });
//     if (!distributor) {
//       // errorOrders.push({
//       //   'order_no': '',
//       //   'order_date': '',
//       //   'remarks': `Distributor (${distributorName}) not found in Distributor Master.`
//       // });

//       throw new Error(`Distributor (${distributorName}) not found in Distributor Master.`);
//     }

//     for (const order of orders) {
//       const AmazonOrderId = order.AmazonOrderId;
//       const OrderStatus = order.OrderStatus;
//       const FulfillmentChannel = order.FulfillmentChannel;
//       const IsBusinessOrder = order.IsBusinessOrder;
//       // const IsReplacementOrder = order.IsReplacementOrder;

//       let placeOrder = false;

//       if (FulfillmentChannel.trim().toUpperCase() === 'AFN' && OrderStatus.trim().toUpperCase() === 'SHIPPED') {
//         placeOrder = true;
//       } else if (FulfillmentChannel.trim().toUpperCase() === 'MFN' &&
//         (OrderStatus.trim().toUpperCase() === 'UNSHIPPED' ||
//           OrderStatus.trim().toUpperCase() === 'SHIPPED')) {
//         placeOrder = true;
//       }

//       if (placeOrder === false) {
//         continue;
//       }

//       // const saleCount = await Sale.countDocuments({ order_no: AmazonOrderId });
//       // if (saleCount > 0) {
//       //   continue;
//       // }

//       const sale = await Sale.findOne({ order_no: AmazonOrderId });
//       if (!sale) {
//         continue;
//       }

//       const orderData = await getOrder(AmazonOrderId);
//       if (!orderData || orderData instanceof Error) {
//         errorOrders.push({
//           'order_no': AmazonOrderId,
//           'order_date': '',
//           'remarks': `Order Details not found.`
//         });
//         continue;
//       }

//       const PurchaseDate = orderData.PurchaseDate ? new Date(orderData.PurchaseDate).toISOString() : '';
//       if (!PurchaseDate) {
//         errorOrders.push({
//           'order_no': AmazonOrderId,
//           'order_date': '',
//           'remarks': `Purchase Date not found.`
//         });
//         continue;
//       }

//       const OrderTotal = orderData.OrderTotal ? orderData.OrderTotal : null;
//       let OrderTotalAmount = 0;
//       if (OrderTotal) {
//         OrderTotalAmount = OrderTotal.Amount ? OrderTotal.Amount : 0;
//       }
//       // if (!OrderTotalAmount) {
//       //   continue;
//       // }

//       const ShippingAddress = orderData.ShippingAddress ? orderData.ShippingAddress : null;

//       if (!ShippingAddress) {
//         errorOrders.push({
//           'order_no': AmazonOrderId,
//           'order_date': PurchaseDate,
//           'remarks': `Shipping Address not found.`
//         });
//         continue;
//       }

//       let name = ShippingAddress.Name ? ShippingAddress.Name : '';
//       let address = (ShippingAddress.AddressLine1 ? ShippingAddress.AddressLine1 : '') + ' ' +
//         (ShippingAddress.AddressLine2 ? ShippingAddress.AddressLine2 : '') + ' ' +
//         (ShippingAddress.AddressLine3 ? ShippingAddress.AddressLine3 : '');
//       let city = ShippingAddress.City ? ShippingAddress.City : '';
//       let pincode = ShippingAddress.PostalCode ? ShippingAddress.PostalCode : '';
//       let state = ShippingAddress.StateOrRegion ? ShippingAddress.StateOrRegion : null;
//       let country = ShippingAddress.County ? ShippingAddress.County : null;
//       let mobileNo = ShippingAddress.Phone ? ShippingAddress.Phone : '';

//       if (state) {
//         // state = '/^' + state + '$/i';
//         state = await State.findOne({ stateName: state });
//       }

//       if (!state) {
//         pincode = await Pincode.findOne({ pincode: pincode });
//         if (pincode) {
//           state = await State.findByPk(pincode.state.toString());
//           pincode = pincode.pincode;
//         }
//       }

//       if (!state) {
//         errorOrders.push({
//           'order_no': AmazonOrderId,
//           'order_date': PurchaseDate,
//           'remarks': `Shipping Address Pincode (${ShippingAddress.PostalCode ? ShippingAddress.PostalCode : ''}) not found in Picode Master and 
//                     State (${ShippingAddress.StateOrRegion ? ShippingAddress.StateOrRegion : ''}) not found in State Master.`
//         });
//         continue;
//       } else {
//         country = await Country.findByPk(state.country.toString());
//       }

//       if (IsBusinessOrder) {
//         if (orderData.BuyerTaxInformation && orderData.BuyerTaxInformation.BuyerLegalCompanyName) {
//           name = orderData.BuyerTaxInformation.BuyerLegalCompanyName.trim();
//         }
//       }

//       let totalOrderAmount = 0;
//       let saleItemError = false;
//       let uploadSale = false;
//       const saleItems = [];

//       let orderItems = await getOrderItems(AmazonOrderId);
//       if (!orderItems || orderItems instanceof Error || !orderItems.OrderItems) {
//         errorOrders.push({
//           'order_no': AmazonOrderId,
//           'order_date': PurchaseDate,
//           'remarks': `Order Items not found.`
//         });
//         continue;
//       }
//       orderItems = orderItems.OrderItems;
//       for (const orderItem of orderItems) {
//         const orderItemName = orderItem.SellerSKU ? orderItem.SellerSKU : '';
//         const ASIN = orderItem.ASIN ? orderItem.ASIN : '';
//         const OrderItemId = orderItem.OrderItemId ? orderItem.OrderItemId : '';
//         const QuantityOrdered = orderItem.QuantityOrdered ? orderItem.QuantityOrdered : '';
//         const QuantityShipped = orderItem.QuantityShipped ? orderItem.QuantityShipped : '';
//         // const ItemPrice = orderItem.ItemPrice ? orderItem.ItemPrice : '';
//         // const PromotionDiscount = orderItem.PromotionDiscount ? orderItem.PromotionDiscount : '';
//         // const ItemAmount = ItemPrice.Amount ? ItemPrice.Amount : 0;
//         // const PromotionDiscountAmount = PromotionDiscount.Amount ? PromotionDiscount.Amount : 0;

//         let fulfillmentCenterId = '';
//         let depot = '';
//         let taxType = 'Intra';
//         let quantity = QuantityOrdered;

//         if (FulfillmentChannel.trim().toUpperCase() === 'AFN') {
//           const amazonOrderFulfillmentCenter = await AmazonOrderFulfillmentCenter.findOne({
//             orderId: AmazonOrderId,
//             orderItemId: OrderItemId
//           });
//           if (amazonOrderFulfillmentCenter) {
//             // depot = await Depot.findOne();
//             if (amazonOrderFulfillmentCenter.fulfillmentCenterId) {
//               depot = await Depot.findOne({
//                 fulfilmentCenterCode: amazonOrderFulfillmentCenter.fulfillmentCenterId
//               });

//               // if (!depot) {
//               //   // Send mail to client about fulfillment center depot not found
//               //   errorOrders.push({
//               //     'order_no': AmazonOrderId,
//               //     'order_date': PurchaseDate,
//               //     'remarks': `Depot for Fulfillment Center Code ${amazonOrderFulfillmentCenter.fulfillmentCenterId} not found in Depot Master.`
//               //   });
//               //   saleItemError = true;
//               //   continue;
//               // }
//             } else {
//               // errorOrders.push({
//               //   'order_no': AmazonOrderId,
//               //   'order_date': PurchaseDate,
//               //   'remarks': `Amazon Fulfillment Center not found for Order Item (${OrderItemId}).`
//               // });
//               // saleItemError = true;
//               // continue;
//             }
//           } else {
//             // errorOrders.push({
//             //   'order_no': AmazonOrderId,
//             //   'order_date': PurchaseDate,
//             //   'remarks': `Amazon Fulfillment Center not found for Order Item (${OrderItemId}).`
//             // });
//             // saleItemError = true;
//             // continue;
//           }

//           quantity = QuantityShipped;
//         } else {
//           // depot = await Depot.findOne();
//           depot = await Depot.findByPk('645f62f04671c7201bd52e6b');

//           if (!depot) {
//             // Send mail to client about fulfillment center depot not found
//             errorOrders.push({
//               'order_no': AmazonOrderId,
//               'order_date': PurchaseDate,
//               'remarks': `Depot for id (645f62f04671c7201bd52e6b) not found in Depot Master.`
//             });
//             saleItemError = true;
//             continue;
//           }
//         }

//         if (!depot || depot === '') {
//           depot = await Depot.findByPk('649972a8ce4842a277d68f4f');

//           if (!depot) {
//             // Send mail to client about fulfillment center depot not found
//             errorOrders.push({
//               'order_no': AmazonOrderId,
//               'order_date': PurchaseDate,
//               'remarks': `Depot for id (649972a8ce4842a277d68f4f) not found in Depot Master.`
//             });
//             saleItemError = true;
//             continue;
//           }
//         }

//         if (state._id.toString() !== depot.state._id.toString()) {
//           taxType = 'Inter';
//         }

//         // const product = await Product.findOne();
//         const product = await Product.findOne({ 'skuDetails.asin': ASIN });
//         let skuDetails = null;

//         if (!product) {
//           errorOrders.push({
//             'order_no': AmazonOrderId,
//             'order_date': PurchaseDate,
//             'remarks': `ASIN (${ASIN}) for product (${orderItemName}) not found in Product Master.`
//           });
//           saleItemError = true;
//         } else {
//           skuDetails = product.skuDetails.find(skuDetail => skuDetail.asin.trim().toUpperCase() === ASIN.trim().toUpperCase());
//           if (!skuDetails) {
//             errorOrders.push({
//               'order_no': AmazonOrderId,
//               'order_date': PurchaseDate,
//               'remarks': `ASIN (${ASIN}) for product (${orderItemName}) not found in Product Master.`
//             });
//             saleItemError = true;
//           }
//         }

//         if (product && skuDetails) {
//           if (skuDetails.skuQuantity > 1) {
//             uploadSale = true;
//           }
//           quantity = skuDetails.skuQuantity * quantity;

//           const totalAmount = quantity * product.mrp;
//           const costAmount = quantity * product.costWithoutGst;
//           totalOrderAmount = totalOrderAmount + totalAmount;

//           saleItems.push({
//             productId: product._id,
//             productName: product.productName,
//             description: product.description,
//             hsnCode: product.hsnCode,
//             hsnName: product.hsnName,
//             grams: product.grams,
//             quantity: quantity,
//             mrp: product.mrp,
//             taxPercentage: product.taxPercentage,
//             saleRate: product.mrp,
//             totalAmount: totalAmount,
//             costWithoutGst: product.costWithoutGst,
//             costAmount: costAmount,
//             fulfillmentCenterId: fulfillmentCenterId,
//             depot: depot,
//             taxType: taxType,
//             createdBy: req.userData.userId,
//             updatedBy: req.userData.userId
//           });
//         } else {
//           errorOrders.push({
//             'order_no': AmazonOrderId,
//             'order_date': PurchaseDate,
//             'remarks': `ASIN (${ASIN}) for product (${orderItemName}) not found in Product Master.`
//           });
//           saleItemError = true;
//         }
//       }

//       if (saleItemError) {
//         continue;
//       }

//       if (!uploadSale) {
//         continue;
//       }

//       const totalDiscountAmount = totalOrderAmount - OrderTotalAmount;
//       let discount = 0;
//       if (totalOrderAmount != 0) {
//         discount = round((totalDiscountAmount / totalOrderAmount) * 100, 2);
//       }

//       const salesData = [];
//       for (const saleItem of saleItems) {
//         const index = salesData.findIndex(saleData => saleData.depot._id.toString() === saleItem.depot._id.toString());

//         if (index === -1) {
//           let order_no = AmazonOrderId;
//           if (salesData.length !== 0) {
//             order_no = order_no + '$' + salesData.length.toString();
//           }
//           salesData.push({
//             order_no: order_no,
//             depot: saleItem.depot,
//             fulfillmentCenterId: saleItem.fulfillmentCenterId,
//             taxType: saleItem.taxType,
//             saleItems: [saleItem]
//           });
//         } else {
//           salesData[index].saleItems.push(saleItem);
//         }
//       }

//       for (const saleData of salesData) {
//         let session;
//         try {
//           const finalSaleItems = saleData.saleItems.map(saleItem => {
//             return {
//               productId: saleItem.productId,
//               grams: saleItem.grams,
//               quantity: saleItem.quantity,
//               mrp: saleItem.mrp,
//               taxPercentage: saleItem.taxPercentage,
//               costWithoutGst: saleItem.costWithoutGst,
//               costAmount: saleItem.costAmount
//             };
//           });

//           const costAmount = finalSaleItems.reduce((costAmount, finalSaleItem) => {
//             return costAmount += finalSaleItem.costAmount;
//           }, 0);

//           // const sale = new Sale({
//           //   saleDate: PurchaseDate,
//           //   depot: saleData.depot._id.toString(),
//           //   distributor: distributor._id.toString(),
//           //   order_no: saleData.order_no,
//           //   order_date: PurchaseDate,
//           //   basisOfSales: 'PO Number',
//           //   saleAmount: OrderTotalAmount,
//           //   name: name,
//           //   address: address,
//           //   city: city,
//           //   pincode: pincode,
//           //   state: state,
//           //   country: country,
//           //   mobileNo: mobileNo,
//           //   discount: discount,
//           //   saleState: state,
//           //   taxType: saleData.taxType,
//           //   saleItems: finalSaleItems,
//           //   totalAmount: OrderTotalAmount,
//           //   costAmount: costAmount,
//           //   shippingCharges: 0,
//           //   shippingSameAsBilling: true,
//           //   status: 'Pending',
//           //   remarks: 'This is system generated entry.'
//           // });

//           sale.saleAmount = OrderTotalAmount;
//           sale.discount = discount;
//           sale.taxType = saleData.taxType;
//           sale.saleItems = finalSaleItems;
//           sale.totalAmount = OrderTotalAmount;
//           sale.costAmount = costAmount;

//           let error = await sale.setSaleAmountDetails();
//           if (error) {
//             throw error;
//           }

//           const message = await Stock.checkStock('Sale', sale);
//           if (message instanceof Error) throw message;
//           if (message) {
//             errorOrders.push({
//               'order_no': AmazonOrderId,
//               'order_date': PurchaseDate,
//               'remarks': message
//             });
//             continue;
//           }

//           error = sale.approve(req);
//           if (error) {
//             throw error;
//           }

//           session = await connection.startSession();
//           session.startTransaction();

//           if (!sale.invoiceNo) {
//             const series = await Series.getSeries(req, 'Sale');
//             sale.getInvoiceNo(series.count);
//             await series.save({ session });
//           }

//           await sale.save({ session });

//           // console.log(sale);

//           await Stock.deleteMany({ stockType: 'Sale', sale: sale._id.toString() }, { session });
//           error = await Stock.setStockDetails('Sale', sale, session, req);
//           if (error) throw error;

//           error = await Product.setStock('Sale', sale, session);
//           if (error instanceof Error) throw error;

//           await session.commitTransaction();

//           uploadedOrders.push({
//             'order_no': AmazonOrderId,
//             'order_date': PurchaseDate,
//             'remarks': 'Success'
//           });
//         } catch (error) {
//           console.log(error);
//           if (session) {
//             await session.abortTransaction();
//           }

//           errorOrders.push({
//             'order_no': AmazonOrderId,
//             'order_date': PurchaseDate,
//             'remarks': error.message
//           });
//         }
//       }
//     }

//     if (errorOrders.length > 0) {
//       sendOrderEmail(errorOrders);
//     }

//     // console.log('Success');
//     res.status(200).json({ message: 'Amazon Orders fetched. ', 'Total No Of Orders': orders.length });


//   } catch (error) {
//     // console.log(error);
//     // res.status(500).json({
//     //   message: "Downloading Amazon Orders Failed! Error - " + (error.message ? error.message : '')
//     // });

//     sendOrderFetchingFailedEmail(error);

//     res.statusCode = 500;
//     res.message = "Downloading Amazon Orders failed!";
//     next(error, req, res);
//   }
// };