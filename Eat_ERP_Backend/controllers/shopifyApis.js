const { connection } = require("mongoose");

const { Pincode } = require("../models/pincode");
const { State } = require("../models/state");
const { Country } = require("../models/country");
const { round } = require('../lib/common');
const logger = require('../lib/logger');

const { getOrders, sendOrderEmail, sendOrderFetchingFailedEmail } = require('../lib/shopifyApi');
const Sell = require("../models/sell");
const Depot = require("../models/depot");
const Distributor = require("../models/distributor");
const Product = require("../models/product");
const Series = require("../models/series");
const User = require("../models/user");
const Stock = require("../models/stock");

exports.getOrders = async (req, res, next) => {
  try {
    // let created_at_min = new Date('2023-04-01');
    // created_at_min = new Date(new Date().setHours(6));
    // let created_at_min = new Date(new Date().setDate(1));
    let created_at_min = new Date();
    created_at_min.setDate(created_at_min.getDate() - 10);
    // console.log(created_at_min);
    // created_at_min.setDate(-1);

    created_at_min = created_at_min.toISOString().substring(0, 19);
    // console.log(created_at_min);

    // const orders = [];
    const orders = await getOrders(created_at_min);

    // if (!orders || orders instanceof Error || !orders.Orders) {
    //   throw orders;
    // }

    if (orders instanceof Error) {
      throw orders;
    }

    const errorOrders = [];
    const uploadedOrders = [];

    const depot = await Depot.findById('645f62f04671c7201bd52e6b');
    if (!depot) {
      throw new Error(`Depot with id (645f62f04671c7201bd52e6b) not found in Depot Master.`);
    }
    const user = await User.findById('640f00d9526a70584a21bcb8');
    if (user) {
      req.userData = { 
        email: user.email, 
        userId: user._id.toString(), 
        userRoleId: user.userRole.toString(), 
        roleDetails: {} 
      };
    } else {
      // errorOrders.push({
      //   'orderNo': '',
      //   'orderDate': '',
      //   'remarks': `User with id (640f00d9526a70584a21bcb8) not found in User Master.`
      // });

      throw new Error(`User with id (640f00d9526a70584a21bcb8) not found in User Master.`);
    }

    if (orders.length > 0) {
      orders.sort((a, b) => a.id - b.id);
    }

    for (const order of orders) {
      const shopifyOrderNo = order.name ? order.name : '';
      const financial_status = order.financial_status ? order.financial_status : '';

      if (shopifyOrderNo.trim().toUpperCase() === '#WYN1241' || 
        shopifyOrderNo.trim().toUpperCase() === '#WYN1155' || 
        shopifyOrderNo.trim().toUpperCase() === '#WYN1127') {
          // continue;
      } else if (financial_status.trim().toUpperCase() !== 'PAID' && financial_status.trim().toUpperCase() !== 'PENDING') {
        continue;
      }
      const sellCount = await Sell.countDocuments({ orderNo: shopifyOrderNo });
      if (sellCount > 0) {
        continue;
      }

      const created_at = order.created_at ? order.created_at : '';
      const billing_address = order.billing_address ? order.billing_address : {};
      const shipping_address = order.shipping_address ? order.shipping_address : {};
      const customer = order.customer ? order.customer : {};
      const gateway = order.gateway ? order.gateway : '';
      let checkout_id = order.checkout_id ? order.checkout_id : '';
      const total_price = order.total_price ? order.total_price : 0;
      const subtotal_price = order.subtotal_price ? order.subtotal_price : 0;
      const total_tax = order.total_tax ? order.total_tax : 0;
      const total_discounts = order.total_discounts ? order.total_discounts : 0;
      const total_line_items_price = order.total_line_items_price ? order.total_line_items_price : 0;

      if (gateway.trim().toUpperCase() === 'RAZORPAY SECURE' || 
      gateway.trim().toUpperCase() === 'PAYTM PAYMENT GATEWAY') {
        checkout_id = '';
      }

      let distributorName = '';
      if(gateway.trim().toUpperCase() =='CRED'){
        distributorName = 'Wyn Direct - CRED';
      } else if(gateway.trim().toUpperCase() == 'CASH_ON_DELIVERY' || 
                gateway.trim().toUpperCase().indexOf('CASH ON DELIVERY') !== -1){
        distributorName = 'Wyn Direct - COD';
      } else if(gateway.trim().toUpperCase() == 'PAY WITH SODEXO'){
        distributorName = 'Wyn Direct - SODEXO';
      } else if(gateway.trim().toUpperCase() == 'PAYTM' || 
      gateway.trim().toUpperCase() == 'PAYTM PAYMENT GATEWAY'){
        distributorName = 'Wyn Direct - PAYTM';
      } else if(gateway.trim().toUpperCase() == 'RAZORPAY SECURE'){
        distributorName = 'Wyn Direct - RAZORPAY';
      } else if(gateway.trim().toUpperCase() == 'STEPSETGO'){
        distributorName = 'Wyn Direct - STEPSETGO';
      } else {
        distributorName = 'Wyn Direct';
      }

      const distributor = await Distributor.findOne({ distributorName: distributorName });

      if (!distributor) {
        errorOrders.push({
          'orderNo': shopifyOrderNo,
          'orderDate': created_at,
          'remarks': `Distributor (${distributorName}) not found in Distributor Master.`
        });
        continue;
      }

      const deliveryStatus = 'delivered';
      const dueDate = created_at;
      const deliveryDate = created_at;
      const dateOfDispatch = created_at;

      const amount = subtotal_price - total_tax;
      const taxAmount = total_tax;
      const finalAmount = subtotal_price;
      let discount = 0;
      if (total_line_items_price && total_line_items_price!=0){
        discount = round((total_discounts * 100) / total_line_items_price, 2);
      }
      
      const shippingCharges = total_price - subtotal_price;
      const invoiceAmount = round(total_price, 0);
      const round_off_amount = invoiceAmount - total_price;

      const b_address1 = (billing_address && billing_address.address1) ? billing_address.address1 : '';
      const b_phone = (billing_address && billing_address.phone) ? billing_address.phone.trim().replace(' ', '') : '';
      const b_city = (billing_address && billing_address.city) ? billing_address.city : '';
      const b_zip = (billing_address && billing_address.zip) ? billing_address.zip : '';
      const b_province = (billing_address && billing_address.province) ? billing_address.province : '';
      const b_country = (billing_address && billing_address.country) ? billing_address.country : '';
      const b_address2 = (billing_address && billing_address.address2) ? billing_address.address2 : '';
      const b_name = (billing_address && billing_address.name) ? billing_address.name : '';

      const s_address1 = (shipping_address && shipping_address.address1) ? shipping_address.address1 : '';
      const s_phone = (shipping_address && shipping_address.phone) ? shipping_address.phone.trim().replace(' ', '') : '';
      const s_city = (shipping_address && shipping_address.city) ? shipping_address.city : '';
      const s_zip = (shipping_address && shipping_address.zip) ? shipping_address.zip : '';
      const s_province = (shipping_address && shipping_address.province) ? shipping_address.province : '';
      const s_country = (shipping_address && shipping_address.country) ? shipping_address.country : '';
      const s_address2 = (shipping_address && shipping_address.address2) ? shipping_address.address2 : '';
      const s_name = (shipping_address && shipping_address.name) ? shipping_address.name : '';

      let clientName = b_name;
      let address = b_address1 + ' ' + b_address2;
      let city = b_city;
      let pincode = b_zip;
      let state = b_province;
      let country = b_country;
      let mobileNo = b_phone;
      
      state = state.trim();
      state = state.replace(/Chhattisgarh/i, 'Chattisgarh');
      state = state.replace(/Tamilnadu/i, 'Tamil Nadu');
      state = state.replace(/Mh/i, 'Maharashtra');
      state = state.replace(/Hima/i, 'Himachal Pradesh');
      state = state.replace(/Andaman and Nicobar Islands/i, 'Andaman & Nicobar Islands');
      state = state.replace(/Puducherry/i, 'Pondicherry');
      state = state.replace(/Jammu and Kashmir/i, 'Jammu & Kashmir');
      state = state.replace(/Dadra and Nagar Haveli/i, 'Dadra & Nagar Haveli');
      state = state.replace(/Daman and Diu/i, 'Daman & Diu');

      if (state) {
        state = await State.findOne({ stateName: state });
      }

      if (!state) {
        pincode = await Pincode.findOne({ pincode: pincode });
        if (pincode) {
          state = await State.findById(pincode.state.toString());
          pincode = pincode.pincode;
        }
      }

      if (!state) {
        errorOrders.push({
          'orderNo': shopifyOrderNo,
          'orderDate': created_at,
          'remarks': `Pincode (${b_zip}) not found in Pincode Master. State (${b_province}) not found in State Master.`
        });
        continue;
      } else {
        country = await Country.findById(state.country.toString());
      }

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let taxType = 'Intra';

      if (state._id.toString() === depot.state._id.toString()) {
        cgstAmount = taxAmount / 2;
        sgstAmount = taxAmount / 2;
      } else {
        igstAmount = taxAmount;
        taxType = 'Inter';
      }

      let shippingAddress = 'yes';
      let consignee = null;
      if(b_address1.trim().toUpperCase() !== s_address1.trim().toUpperCase() || 
        b_address2.trim().toUpperCase() !== s_address2.trim().toUpperCase() || 
        b_phone.trim().toUpperCase() !== s_phone.trim().toUpperCase() || 
        b_city.trim().toUpperCase() !== s_city.trim().toUpperCase() || 
        b_zip.trim().toUpperCase() !== s_zip.trim().toUpperCase() || 
        b_province.trim().toUpperCase() !== s_province.trim().toUpperCase() || 
        b_country.trim().toUpperCase() !== s_country.trim().toUpperCase()) {
          shippingAddress = 'no';
          let conName = s_name;
          let conAddress = s_address1 + ' ' + s_address2;
          let conCity = s_city;
          let conPincode = s_zip;
          let conState = s_province;
          let conCountry = s_country;

          if (conState) {
            conState = await State.findOne({ stateName: conState });
          }
    
          if (!conState) {
            conPincode = await Pincode.findOne({ pincode: conPincode });
            if (conPincode) {
              state = await State.findById(conPincode.state.toString());
              conPincode = conPincode.pincode;
            }
          }
    
          if (!conState) {
            errorOrders.push({
              'orderNo': shopifyOrderNo,
              'orderDate': created_at,
              'remarks': `Pincode (${s_zip}) not found in Pincode Master. State (${s_province}) not found in State Master.`
            });
            continue;
          } else {
            conCountry = await Country.findById(conState.country.toString());
          }

          consignee = {
            name: conName,
            address: conAddress,
            city: conCity,
            pincode: conPincode,
            state: conState,
            country: conCountry,
            gstNo: ''
          };
      }

      let totalOrderAmount = 0;
      let sellItemError = false;
      const sellItems = [];

      const line_items = order.line_items ? order.line_items : [];
      if (!line_items || line_items instanceof Error || line_items.length === 0) {
        errorOrders.push({
          'orderNo': shopifyOrderNo,
          'orderDate': created_at,
          'remarks': `Order Items not found.`
        });
        continue;
      }
      for (const orderItem of line_items) {
        const orderItemName = orderItem.name ? orderItem.name.trim() : '';
        const sku = orderItem.sku ? orderItem.sku : '';
        let quantity = orderItem.quantity ? orderItem.quantity : 0;
        // const price = orderItem.price ? orderItem.price : 0;

        let product = null;
        let skuDetails = null;

        if (sku) {
          product = await Product.findOne({ 'skuDetails.skuCode': sku });
        } else {
          product = await Product.findOne( { "skuDetails.skuName" : { $regex : new RegExp(orderItemName, "i") } } );
        }
        // const product = await Product.findOne();
        if (!product) {
          errorOrders.push({
            'orderNo': shopifyOrderNo,
            'orderDate': created_at,
            'remarks': `Sku (${sku}) for product (${orderItemName}) not found in Product Master.`
          });
          sellItemError = true;
        } else {
          if (sku) {
            skuDetails = product.skuDetails.find(skuDetail => skuDetail.skuCode === sku);
          } else {
            skuDetails = product.skuDetails.find(
                skuDetail => skuDetail.skuName.trim().toUpperCase() === orderItemName.trim().toUpperCase()
              );
          }
          if (!skuDetails) {
            errorOrders.push({
              'orderNo': shopifyOrderNo,
              'orderDate': created_at,
              'remarks': `Sku (${sku}) for product (${orderItemName}) not found in Product Master.`
            });
            sellItemError = true;
          }
        }
        if (product && skuDetails) {
          quantity = skuDetails.skuQuantity * quantity;
          const totalAmount = quantity * product.mrp;
          const costAmount = quantity * product.costWithoutGst;
          totalOrderAmount = totalOrderAmount + totalAmount;

          sellItems.push({
            productId: product._id,
            productName: product.productName,
            description: product.description,
            hsnCode: product.hsnCode,
            hsnName: product.hsnName,
            grams: product.grams,
            quantity: quantity,
            mrp: product.mrp,
            taxPercentage: product.taxPercentage,
            // sellRate: product.mrp,
            totalAmount: totalAmount,
            costWithoutGst: product.costWithoutGst,
            costAmount: costAmount
          });
        }
      }

      // if (discount === 0) {
        if (finalAmount !== totalOrderAmount) {
          discount = round(((totalOrderAmount - finalAmount) * 100) / totalOrderAmount, 2);
        }
      // }

      if (sellItemError) {
        continue;
      }

      let session;
      try {
        const costAmount = sellItems.reduce((costAmount, finalSellItem) => {
          return costAmount += finalSellItem.costAmount;
        }, 0);

        const sell = new Sell({
          sellDate: created_at,
          depot: depot._id.toString(),
          distributor: distributor._id.toString(),
          orderNo: shopifyOrderNo,
          orderDate: created_at,
          basisOfSells: 'PO Number',
          sellAmount: total_price,
          name: clientName,
          address: address,
          city: city,
          pincode: pincode,
          state: state,
          country: country,
          mobileNo: mobileNo,
          discount: discount,
          sellState: state,
          taxType: taxType,
          sellItems: sellItems,
          totalAmount: finalAmount,
          costAmount: costAmount,
          shippingCharges: shippingCharges,
          shippingSameAsBilling: shippingAddress,
          consignee: consignee,
          invoiceDate: new Date(created_at).toISOString().substring(0, 10),
          dueDate: created_at,
          status: 'Pending',
          remarks: 'This is system generated entry.'
        });

        let error = await sell.setSellAmountDetails();
        if (error) {
          throw error;
        }

        error = await Stock.checkStock('Sell', sell);
        if (error instanceof Error) {
          throw error;
        }
        if (error) {
          errorOrders.push({
            'orderNo': shopifyOrderNo,
            'orderDate': created_at,
            'remarks': error
          });
          continue;
        }

        error = sell.approve(req);
        if (error) {
          throw error;
        }

        session = await connection.startSession();
        session.startTransaction();

        if (!sell.invoiceNo) {
          const series = await Series.getSeries(req, 'Sell');
          sell.getInvoiceNo(series.count);
          await series.save({ session });
        }
        
        await sell.save({ session });

        // console.log(sell);

        await Stock.deleteMany({ stockType: 'Sell', sell: sell._id.toString() }, { session });
        error = await Stock.setStockDetails('Sell', sell, session, req);
        if (error) throw error;
          
        error = await Product.setStock('Sell', sell, session);
        if (error instanceof Error) throw error;

        await session.commitTransaction();

        uploadedOrders.push({
          'orderNo': shopifyOrderNo,
          'orderDate': created_at,
          'remarks': 'Success'
        });
      } catch (error) {
        // console.log(error);
        if (session) {
          await session.abortTransaction();
        }

        errorOrders.push({
          'orderNo': shopifyOrderNo,
          'orderDate': created_at,
          'remarks': error.message
        });
      }
    }

    // console.log(orders.length);

    if (errorOrders.length > 0) {
      sendOrderEmail(errorOrders);
    }
    
    if (res) {
      res.status(200).json({ orders: orders, uploadedOrders: uploadedOrders, errorOrders: errorOrders });
    } else {
      logger.log({
        level: "info",
        message: "Shopify API Cron For Orders On - " + new Date().toLocaleString(),
        // stack: err.stack,
        metadata: { orders: orders.length, uploadedOrders: uploadedOrders.length, errorOrders: errorOrders.length }, // Put what you like as meta
      });
    }
  } catch (error) {
    // console.log(error);
    // res.status(500).json({ error });

    sendOrderFetchingFailedEmail(error);
    
    res.statusCode = 500;
    res.message = "Fetching Shopify Orders failed!";
    next(error, req, res);
  }
};

exports.updateOrders = async (req, res, next) => {
  try {
    let created_at_min = new Date('2023-04-01');
    // created_at_min = new Date(new Date().setHours(6));
    // let created_at_min = new Date(new Date().setDate(1));
    // let created_at_min = new Date();
    // created_at_min.setDate(created_at_min.getDate() - 2)
    // console.log(created_at_min);
    // created_at_min.setDate(-1);

    created_at_min = created_at_min.toISOString().substring(0, 19);
    // console.log(created_at_min);

    // const orders = [];
    const orders = await getOrders(created_at_min);
    const errorOrders = [];
    const uploadedOrders = [];

    const depot = await Depot.findById('645f62f04671c7201bd52e6b');
    if (!depot) {
      throw new Error(`Depot with id (645f62f04671c7201bd52e6b) not found in Depot Master.`);
    }
    const user = await User.findById('640f00d9526a70584a21bcb8');
    if (user) {
      req.userData = { 
        email: user.email, 
        userId: user._id.toString(), 
        userRoleId: user.userRole.toString(), 
        roleDetails: {} 
      };
    } else {
      // errorOrders.push({
      //   'orderNo': '',
      //   'orderDate': '',
      //   'remarks': `User with id (640f00d9526a70584a21bcb8) not found in User Master.`
      // });

      throw new Error(`User with id (640f00d9526a70584a21bcb8) not found in User Master.`);
    }

    if (orders.length > 0) {
      orders.sort((a, b) => a.id - b.id);
    }

    for (const order of orders) {
      const shopifyOrderNo = order.name ? order.name : '';
      const financial_status = order.financial_status ? order.financial_status : '';

      // if (shopifyOrderNo.trim().toUpperCase() === '#WYN1241' || 
      //   shopifyOrderNo.trim().toUpperCase() === '#WYN1155' || 
      //   shopifyOrderNo.trim().toUpperCase() === '#WYN1127') {
      //     // continue;
      // } else if (financial_status.trim().toUpperCase() !== 'PAID' && financial_status.trim().toUpperCase() !== 'PENDING') {
      //   continue;
      // }
      // const sellCount = await Sell.countDocuments({ orderNo: shopifyOrderNo });
      // if (sellCount > 0) {
      //   continue;
      // }

      const sell = await Sell.findOne({ orderNo: shopifyOrderNo });
      if (!sell) {
        continue;
      }

      const created_at = order.created_at ? order.created_at : '';
      const billing_address = order.billing_address ? order.billing_address : {};
      const shipping_address = order.shipping_address ? order.shipping_address : {};
      const customer = order.customer ? order.customer : {};
      const gateway = order.gateway ? order.gateway : '';
      let checkout_id = order.checkout_id ? order.checkout_id : '';
      const total_price = order.total_price ? order.total_price : 0;
      const subtotal_price = order.subtotal_price ? order.subtotal_price : 0;
      const total_tax = order.total_tax ? order.total_tax : 0;
      const total_discounts = order.total_discounts ? order.total_discounts : 0;
      const total_line_items_price = order.total_line_items_price ? order.total_line_items_price : 0;

      if (gateway.trim().toUpperCase() === 'RAZORPAY SECURE' || 
      gateway.trim().toUpperCase() === 'PAYTM PAYMENT GATEWAY') {
        checkout_id = '';
      }

      let distributorName = '';
      if(gateway.trim().toUpperCase() =='CRED'){
        distributorName = 'Wyn Direct - CRED';
      } else if(gateway.trim().toUpperCase() == 'CASH_ON_DELIVERY' || 
                gateway.trim().toUpperCase().indexOf('CASH ON DELIVERY') !== -1){
        distributorName = 'Wyn Direct - COD';
      } else if(gateway.trim().toUpperCase() == 'PAY WITH SODEXO'){
        distributorName = 'Wyn Direct - SODEXO';
      } else if(gateway.trim().toUpperCase() == 'PAYTM' || 
      gateway.trim().toUpperCase() == 'PAYTM PAYMENT GATEWAY'){
        distributorName = 'Wyn Direct - PAYTM';
      } else if(gateway.trim().toUpperCase() == 'RAZORPAY SECURE'){
        distributorName = 'Wyn Direct - RAZORPAY';
      } else if(gateway.trim().toUpperCase() == 'STEPSETGO'){
        distributorName = 'Wyn Direct - STEPSETGO';
      } else {
        distributorName = 'Wyn Direct';
      }

      const distributor = await Distributor.findOne({ distributorName: distributorName });

      if (!distributor) {
        errorOrders.push({
          'orderNo': shopifyOrderNo,
          'orderDate': created_at,
          'remarks': `Distributor (${distributorName}) not found in Distributor Master.`
        });
        continue;
      }

      const deliveryStatus = 'delivered';
      const dueDate = created_at;
      const deliveryDate = created_at;
      const dateOfDispatch = created_at;

      const amount = subtotal_price - total_tax;
      const taxAmount = total_tax;
      const finalAmount = subtotal_price;
      let discount = 0;
      if (total_line_items_price && total_line_items_price!=0){
        discount = round((total_discounts * 100) / total_line_items_price, 2);
      }
      
      const shippingCharges = total_price - subtotal_price;
      const invoiceAmount = round(total_price, 0);
      const round_off_amount = invoiceAmount - total_price;

      const b_address1 = (billing_address && billing_address.address1) ? billing_address.address1 : '';
      const b_phone = (billing_address && billing_address.phone) ? billing_address.phone.trim().replace(' ', '') : '';
      const b_city = (billing_address && billing_address.city) ? billing_address.city : '';
      const b_zip = (billing_address && billing_address.zip) ? billing_address.zip : '';
      const b_province = (billing_address && billing_address.province) ? billing_address.province : '';
      const b_country = (billing_address && billing_address.country) ? billing_address.country : '';
      const b_address2 = (billing_address && billing_address.address2) ? billing_address.address2 : '';
      const b_name = (billing_address && billing_address.name) ? billing_address.name : '';

      const s_address1 = (shipping_address && shipping_address.address1) ? shipping_address.address1 : '';
      const s_phone = (shipping_address && shipping_address.phone) ? shipping_address.phone.trim().replace(' ', '') : '';
      const s_city = (shipping_address && shipping_address.city) ? shipping_address.city : '';
      const s_zip = (shipping_address && shipping_address.zip) ? shipping_address.zip : '';
      const s_province = (shipping_address && shipping_address.province) ? shipping_address.province : '';
      const s_country = (shipping_address && shipping_address.country) ? shipping_address.country : '';
      const s_address2 = (shipping_address && shipping_address.address2) ? shipping_address.address2 : '';
      const s_name = (shipping_address && shipping_address.name) ? shipping_address.name : '';

      let clientName = b_name;
      let address = b_address1 + ' ' + b_address2;
      let city = b_city;
      let pincode = b_zip;
      let state = b_province;
      let country = b_country;
      let mobileNo = b_phone;
      
      state = state.trim();
      state = state.replace(/Chhattisgarh/i, 'Chattisgarh');
      state = state.replace(/Tamilnadu/i, 'Tamil Nadu');
      state = state.replace(/Mh/i, 'Maharashtra');
      state = state.replace(/Hima/i, 'Himachal Pradesh');
      state = state.replace(/Andaman and Nicobar Islands/i, 'Andaman & Nicobar Islands');
      state = state.replace(/Puducherry/i, 'Pondicherry');
      state = state.replace(/Jammu and Kashmir/i, 'Jammu & Kashmir');
      state = state.replace(/Dadra and Nagar Haveli/i, 'Dadra & Nagar Haveli');
      state = state.replace(/Daman and Diu/i, 'Daman & Diu');

      if (state) {
        state = await State.findOne({ stateName: state });
      }

      if (!state) {
        pincode = await Pincode.findOne({ pincode: pincode });
        if (pincode) {
          state = await State.findById(pincode.state.toString());
          pincode = pincode.pincode;
        }
      }

      if (!state) {
        errorOrders.push({
          'orderNo': shopifyOrderNo,
          'orderDate': created_at,
          'remarks': `Pincode (${b_zip}) not found in Pincode Master. State (${b_province}) not found in State Master.`
        });
        continue;
      } else {
        country = await Country.findById(state.country.toString());
      }

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let taxType = 'Intra';

      if (state._id.toString() === depot.state._id.toString()) {
        cgstAmount = taxAmount / 2;
        sgstAmount = taxAmount / 2;
      } else {
        igstAmount = taxAmount;
        taxType = 'Inter';
      }

      let shippingAddress = 'yes';
      let consignee = null;
      if(b_address1.trim().toUpperCase() !== s_address1.trim().toUpperCase() || 
        b_address2.trim().toUpperCase() !== s_address2.trim().toUpperCase() || 
        b_phone.trim().toUpperCase() !== s_phone.trim().toUpperCase() || 
        b_city.trim().toUpperCase() !== s_city.trim().toUpperCase() || 
        b_zip.trim().toUpperCase() !== s_zip.trim().toUpperCase() || 
        b_province.trim().toUpperCase() !== s_province.trim().toUpperCase() || 
        b_country.trim().toUpperCase() !== s_country.trim().toUpperCase()) {
          shippingAddress = 'no';
          let conName = s_name;
          let conAddress = s_address1 + ' ' + s_address2;
          let conCity = s_city;
          let conPincode = s_zip;
          let conState = s_province;
          let conCountry = s_country;

          if (conState) {
            conState = await State.findOne({ stateName: conState });
          }
    
          if (!conState) {
            conPincode = await Pincode.findOne({ pincode: conPincode });
            if (conPincode) {
              state = await State.findById(conPincode.state.toString());
              conPincode = conPincode.pincode;
            }
          }
    
          if (!conState) {
            errorOrders.push({
              'orderNo': shopifyOrderNo,
              'orderDate': created_at,
              'remarks': `Pincode (${s_zip}) not found in Pincode Master. State (${s_province}) not found in State Master.`
            });
            continue;
          } else {
            conCountry = await Country.findById(conState.country.toString());
          }

          consignee = {
            name: conName,
            address: conAddress,
            city: conCity,
            pincode: conPincode,
            state: conState,
            country: conCountry,
            gstNo: ''
          };
      }

      let totalOrderAmount = 0;
      let sellItemError = false;
      let uploadSell = false;
      const sellItems = [];

      const line_items = order.line_items ? order.line_items : [];
      if (!line_items || line_items instanceof Error || line_items.length === 0) {
        errorOrders.push({
          'orderNo': shopifyOrderNo,
          'orderDate': created_at,
          'remarks': `Order Items not found.`
        });
        continue;
      }
      for (const orderItem of line_items) {
        const orderItemName = orderItem.name ? orderItem.name.trim() : '';
        const sku = orderItem.sku ? orderItem.sku : '';
        let quantity = orderItem.quantity ? orderItem.quantity : 0;
        // const price = orderItem.price ? orderItem.price : 0;

        let product = null;
        let skuDetails = null;

        if (sku) {
          product = await Product.findOne({ 'skuDetails.skuCode': sku });
        } else {
          product = await Product.findOne( { "skuDetails.skuName" : { $regex : new RegExp(orderItemName, "i") } } );
        }
        // const product = await Product.findOne();
        if (!product) {
          errorOrders.push({
            'orderNo': shopifyOrderNo,
            'orderDate': created_at,
            'remarks': `Sku (${sku}) for product (${orderItemName}) not found in Product Master.`
          });
          sellItemError = true;
        } else {
          if (sku) {
            skuDetails = product.skuDetails.find(skuDetail => skuDetail.skuCode === sku);
          } else {
            skuDetails = product.skuDetails.find(
                skuDetail => skuDetail.skuName.trim().toUpperCase() === orderItemName.trim().toUpperCase()
              );
          }
          if (!skuDetails) {
            errorOrders.push({
              'orderNo': shopifyOrderNo,
              'orderDate': created_at,
              'remarks': `Sku (${sku}) for product (${orderItemName}) not found in Product Master.`
            });
            sellItemError = true;
          }
        }
        if (product && skuDetails) {
          if (skuDetails.skuQuantity > 1) {
            uploadSell = true;
          }
          quantity = skuDetails.skuQuantity * quantity;
          
          const totalAmount = quantity * product.mrp;
          const costAmount = quantity * product.costWithoutGst;
          totalOrderAmount = totalOrderAmount + totalAmount;

          sellItems.push({
            productId: product._id,
            productName: product.productName,
            description: product.description,
            hsnCode: product.hsnCode,
            hsnName: product.hsnName,
            grams: product.grams,
            quantity: quantity,
            mrp: product.mrp,
            taxPercentage: product.taxPercentage,
            // sellRate: product.mrp,
            totalAmount: totalAmount,
            costWithoutGst: product.costWithoutGst,
            costAmount: costAmount
          });
        }
      }

      // if (discount === 0) {
        if (finalAmount !== totalOrderAmount) {
          discount = round(((totalOrderAmount - finalAmount) * 100) / totalOrderAmount, 2);
        }
      // }

      if (sellItemError) {
        continue;
      }

      if (!uploadSell) {
        continue;
      }

      let session;
      try {
        const costAmount = sellItems.reduce((costAmount, finalSellItem) => {
          return costAmount += finalSellItem.costAmount;
        }, 0);

        // const sell = new Sell({
        //   sellDate: created_at,
        //   depot: depot._id.toString(),
        //   distributor: distributor._id.toString(),
        //   orderNo: shopifyOrderNo,
        //   orderDate: created_at,
        //   basisOfSells: 'PO Number',
        //   sellAmount: total_price,
        //   name: clientName,
        //   address: address,
        //   city: city,
        //   pincode: pincode,
        //   state: state,
        //   country: country,
        //   mobileNo: mobileNo,
        //   discount: discount,
        //   sellState: state,
        //   taxType: taxType,
        //   sellItems: sellItems,
        //   totalAmount: finalAmount,
        //   costAmount: costAmount,
        //   shippingCharges: shippingCharges,
        //   shippingSameAsBilling: shippingAddress,
        //   consignee: consignee,
        //   invoiceDate: new Date(created_at).toISOString().substring(0, 10),
        //   dueDate: created_at,
        //   remarks: 'This is system generated entry.'
        // });

        sell.sellAmount = total_price;
        sell.discount = discount;
        sell.sellItems = sellItems;
        sell.totalAmount = finalAmount;
        sell.costAmount = costAmount;
        sell.shippingCharges = shippingCharges;

        let error = await sell.setSellAmountDetails();
        if (error) {
          throw error;
        }

        error = await Stock.checkStock('Sell', sell);
        if (error instanceof Error) {
          throw error;
        }
        if (error) {
          errorOrders.push({
            'orderNo': shopifyOrderNo,
            'orderDate': created_at,
            'remarks': error
          });
          continue;
        }

        error = sell.approve(req);
        if (error) {
          throw error;
        }

        session = await connection.startSession();
        session.startTransaction();

        if (!sell.invoiceNo) {
          const series = await Series.getSeries(req, 'Sell');
          sell.getInvoiceNo(series.count);
          await series.save({ session });
        }
        
        await sell.save({ session });

        // console.log(sell);

        await Stock.deleteMany({ stockType: 'Sell', sell: sell._id.toString() }, { session });
        error = await Stock.setStockDetails('Sell', sell, session, req);
        if (error) throw error;
          
        error = await Product.setStock('Sell', sell, session);
        if (error instanceof Error) throw error;

        await session.commitTransaction();

        uploadedOrders.push({
          'orderNo': shopifyOrderNo,
          'orderDate': created_at,
          'remarks': 'Success'
        });
      } catch (error) {
        // console.log(error);
        if (session) {
          await session.abortTransaction();
        }

        errorOrders.push({
          'orderNo': shopifyOrderNo,
          'orderDate': created_at,
          'remarks': error.message
        });
      }
    }

    // console.log(orders.length);

    if (errorOrders.length > 0) {
      sendOrderEmail(errorOrders);
    }
    
    res.status(200).json({ orders: orders, uploadedOrders: uploadedOrders, errorOrders: errorOrders });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({ error });

    sendOrderFetchingFailedEmail(error);
    
    res.statusCode = 500;
    res.message = "Fetching Shopify Orders failed!";
    next(error, req, res);
  }
};