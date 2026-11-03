import dotenv from 'dotenv';
dotenv.config();

import Shopify from 'shopify-api-node';
import sendEmail from './email.js';

export const getShopifyOrderNo = (order_no) => {
  if (order_no.indexOf('#') === -1) {
    if (order_no.indexOf('ZOP') === -1) {
      order_no = '#'+order_no;
    } else {
      order_no = order_no.substring(0, 3) + '#' + order_no.substring(3);
    }
  }
  return order_no;
};

export const getOrder = async (name) => {
  try {
    name = getShopifyOrderNo(name);
    let params = { status: 'any', name: name };

    let shopify = new Shopify({
      shopName: process.env.SHOPIFYSHOPNAME,
      accessToken: process.env.SHOPIFYACCESSTOKEN
    });
    let orders = await shopify.order.list(params);

    let order = {};
    if (orders.length > 0) order = orders[0];
    
    return order;

    // const orders = await shopify.order.list({ limit: 5, created_at_min: '2023-04-18T01:01:01' });
    // console.log(orders);

  } catch (error) {
    // console.log(error);
    // res.status(500).json({ error });
    return error;
  }
};

export const getShopifyOrderDistributor = async (order_no) => {
  try {
    const order = await getOrder(order_no);
    if (order instanceof Error) return order;

    let tags = order.tags ? order.tags : '';
    let payment_gateway_names = order.payment_gateway_names ? order.payment_gateway_names : [];
    let gateway = '';
    if (payment_gateway_names.length > 0) {
      gateway = payment_gateway_names[0];
    }
    let financial_status = order.financial_status ? order.financial_status : '';

    let distributor_id = 0;
    if(tags.trim().toUpperCase().indexOf('SAMPLE') !== -1){
        distributor_id = 1947;
        gateway = 'Sample';
    } else if(tags.trim().toUpperCase().indexOf('DPANDA') !== -1){
        distributor_id = 1896;
        gateway = 'Dpanda';
    } else if(tags.trim().toUpperCase().indexOf('BILLING') !== -1 || tags.trim().toUpperCase().indexOf('BETTER_SHOP') !== -1){
        distributor_id = 1897;
        gateway = 'Blling';
    } else if(tags.trim().toUpperCase().indexOf('BUYKARO') !== -1){
        distributor_id = 1907;
        gateway = 'BuyKaro';
    } else if(tags.trim().toUpperCase().indexOf('GROWFITTER') !== -1){
        distributor_id = 1893;
        gateway = 'GROWFITTER';
    } else if(tags.trim().toUpperCase().indexOf('BOB_COD_CONVERTED_TO_NEW_PREPAID_ORDER') !== -1){
        distributor_id = 1825;
        gateway = 'Razorpay Secure';
    } else if(tags.trim().toUpperCase().indexOf('ZOP') !== -1){
        distributor_id = 1942;
        gateway = 'ZOP - Shiprocket';
    } else if(tags.trim().toUpperCase().indexOf('ONDC') !== -1 || tags.trim().toUpperCase().trim().toUpperCase() === 'ONDC'){
        distributor_id = 1979;
        gateway = 'ONDC - Shiprocket';
    } else if(tags.trim().toUpperCase().indexOf('BOB_') !== -1 && tags.trim().toUpperCase().trim().toUpperCase() === 'PAID'){
        distributor_id = 1825;
        gateway = 'Razorpay Secure';
    } else if(tags.trim().toUpperCase().indexOf('ONDC') !== -1 && tags.trim().toUpperCase().indexOf('PAYTM') !== -1){
        distributor_id = 1915;
        gateway = 'ONDC - Paytm';
    } else if(tags.trim().toUpperCase().indexOf('ONDC') !== -1 && tags.trim().toUpperCase().indexOf('AIRPAY') !== -1){
        distributor_id = 1916;
        gateway = 'ONDC - Airpay';
    } else if(tags.trim().toUpperCase().indexOf('ONDC') !== -1 && tags.trim().toUpperCase().indexOf('PHONEPE') !== -1){
        distributor_id = 1917;
        gateway = 'ONDC - PhonePay';
    } else if(tags.trim().toUpperCase().indexOf('ONDC') !== -1 && tags.trim().toUpperCase().indexOf('MYSTORE') !== -1){
        distributor_id = 1924;
        gateway = 'ONDC - Mystore';
    } else if(tags.trim().toUpperCase().indexOf('ONDC') !== -1 && tags.trim().toUpperCase().indexOf('NOBROKERHOOD') !== -1){
        distributor_id = 1932;
        gateway = 'ONDC - Nobrokerhood';
    } else if(tags.trim().toUpperCase().indexOf('ONDC') !== -1 && tags.trim().toUpperCase().indexOf('QADDOO') !== -1){
        distributor_id = 1925;
        gateway = 'ONDC - Qaddoo';
    } else if(tags.trim().toUpperCase().indexOf('ONDC') !== -1 && tags.trim().toUpperCase().indexOf('JAGRAN') !== -1){
        distributor_id = 1938;
        gateway = 'ONDC - Jagran';
    } else if(gateway.trim().toUpperCase() === 'CRED'){
        distributor_id = 1728;
    } else if(gateway.trim().toUpperCase().indexOf('PLUXEE') !== -1){
        distributor_id = 1826;
    } else if(gateway.trim().toUpperCase() === 'PAYTM' || gateway.trim().toUpperCase() === 'PAYTM PAYMENT GATEWAY'){
        distributor_id = 1824;
    } else if(gateway.trim().toUpperCase() === 'RAZORPAY SECURE'){
        distributor_id = 1825;
    } else if(gateway.trim().toUpperCase() === 'STEPSETGO'){
        distributor_id = 1880;
    } else if(gateway.trim().toUpperCase() === 'CASH_ON_DELIVERY' || gateway.trim().toUpperCase().indexOf('CASH ON DELIVERY') !== -1 || tags.trim().toUpperCase().indexOf('COD') !== -1 || (tags.trim().toUpperCase().indexOf('BOB_') !== -1 && financial_status.trim().toUpperCase() === 'PENDING')) {
        distributor_id = 1751;
    } else if(tags.trim().toUpperCase().indexOf('GOKWIK') !== -1){
        distributor_id = 1943;
    } else if(tags.trim().toUpperCase().indexOf('SWISH') !== -1 || gateway.trim().toUpperCase() === 'SWISHCLUB'){
        distributor_id = 1978;
    } else {
        // $distributor_id = 626;
        distributor_id = 0;
    }

    return distributor_id;
  } catch (error) {
    // console.log(error);
    // res.status(500).json({ error });
    return error;
  }
};

export const getOrders = async (created_at_min) => {
  try {
    const shopify = new Shopify({
      shopName: process.env.SHOPIFYSHOPNAME,
      accessToken: process.env.SHOPIFYACCESSTOKEN
    });


    // shopify.on('callLimits', (limits) => console.log('callLimits - ', limits));

    // shopify.on('callGraphqlLimits', (limits) => console.log('callGraphqlLimitsl - ', imits));

    // const page_info = 'eattestapi';

    // return shopify.order
    //   .list({ limit: 5, created_at_min: created_at_min })
    //   // .list({ limit: 250, since_id: 5471225774240 })
    //   // .list({ limit: 5, created_at_min: '2023-04-18T01:01:01', created_at_max: '2023-04-19T01:01:01' })
    //   .then((orders) => {
    //     // console.log(orders);


    //     // res.status(200).json({ orders });
    //     return orders;
    //   })
    //   .catch((err) => {
    //     console.error(err);
    //     // res.status(500).json({ err });
    //     return err;
    //   });

    // let params = { limit: 2, created_at_min: created_at_min, status: 'any' };
    // let params = { limit: 2 };
    let params = { created_at_min: created_at_min, status: 'any' };
    // let i = 0;
    const orders = [];
    do {
      const fetchedOrders = await shopify.order.list(params);
  
      // console.log(fetchedOrders);

      orders.push(...fetchedOrders);
      
      // if (i > 5) {
      //   break;
      // }

      // console.log(i);
      // console.log(fetchedOrders.nextPageParameters);

      // i++;
      params = fetchedOrders.nextPageParameters;
    } while (params !== undefined);

    return orders;

    // const orders = await shopify.order.list({ limit: 5, created_at_min: '2023-04-18T01:01:01' });
    // console.log(orders);

  } catch (error) {
    console.log(error);
    // res.status(500).json({ error });
    return error;
  }
};

export const sendOrderEmail = function (errorOrders) {
  try {
    const subject = `Shopify Process Order Errors ${ new Date().toLocaleDateString() }`;
    const text = errorOrders.map(errorOrder => {
      return `Order No: ${errorOrder.orderNo} - 
              Order Date: ${errorOrder.orderDate} - 
              Remarks: ${errorOrder.remarks}`;
    }).join(' <br/> ');
    const tbody = errorOrders.map(errorOrder => {
      return `<tr>
                <td style="width: 100px;">${errorOrder.orderNo}</td>
                <td style="width: 100px; text-align: center;">${errorOrder.orderDate}</td>
                <td style="width: 600px; text-align: center;">${errorOrder.remarks}</td>
              </tr>`;
    }).join('');

    const html = `
    <html>
    <head>
    <style>
    table, th, td {
      border: 1px solid black;
      border-collapse: collapse;
    }
    </style>
    </head>
    <body>
    <p>Shopify Process Order Errors ${ new Date().toLocaleDateString() }</p>
    <table>
    <thead>
    <tr>
    <th>Order No</th>
    <th>Order Date</th>
    <th>Remarks</th>
    </tr>
    </thead>
    <tbody>
    ${tbody}
    </tbody>
    </table>
    <br/>
    <br/>
    Regards,
    <br/>
    <br/>
    Wyn ERP
    </body>
    </html>
    `;

    // console.log(html);

    const mailOptions = {
      from: 'Wyn ERP <technology@raastaconsulting.com>',
      to: 'imp@wynwellness.in',
      cc: 'aditya.belose@wynwellness.in',
      bcc: 'technology@raastaconsulting.com',
      // to: 'technology@raastaconsulting.com',
      // cc: 'technology@raastaconsulting.com',
      // bcc: 'technology@raastaconsulting.com',
      // cc: 'dhaval.maru@otbconsulting.co.in',
      // bcc: 'rishit.sanghvi@eatanytime.in',
      subject: subject,
      text: text,
      html: html
    };

    sendEmail(mailOptions)
      .then(result => {
        // console.log(result);
        // return res.status(200).json({ result: result });
        return true;
      })
      .catch(err => {
        // console.log(err);
        // const error = new Error(err);
        // error.httpStatusCode = 500;
        // return next(error);

        return err;
      });
  } catch (err) {
    // console.log(err);
    // const error = new Error(err);
    // error.httpStatusCode = 500;
    // return next(error);

    return err;
  }
}

export const sendOrderFetchingFailedEmail = function (error) {
  try {
    const subject = `Shopify Process Order Failed ${ new Date().toLocaleDateString() }`;
    const text = `Reason : ${error.message}`;

    const html = `
    <html>
    <body>
    <p>Shopify Process Order Failed ${ new Date().toLocaleDateString() }</p>
    <p>Reason : ${error.message}</p>
    <br/>
    <br/>
    Regards,
    <br/>
    <br/>
    Wyn ERP
    </body>
    </html>
    `;

    // console.log(html);

    const mailOptions = {
      from: 'Wyn ERP <technology@raastaconsulting.com>',
      to: 'imp@wynwellness.in',
      cc: 'aditya.belose@wynwellness.in',
      bcc: 'technology@raastaconsulting.com',
      // to: 'technology@raastaconsulting.com',
      // cc: 'technology@raastaconsulting.com',
      // bcc: 'technology@raastaconsulting.com',
      // cc: 'dhaval.maru@otbconsulting.co.in',
      // bcc: 'rishit.sanghvi@eatanytime.in',
      subject: subject,
      text: text,
      html: html
    };

    sendEmail(mailOptions)
      .then(result => {
        // console.log(result);
        // return res.status(200).json({ result: result });
        return true;
      })
      .catch(err => {
        // console.log(err);
        // const error = new Error(err);
        // error.httpStatusCode = 500;
        // return next(error);

        return err;
      });
  } catch (err) {
    // console.log(err);
    // const error = new Error(err);
    // error.httpStatusCode = 500;
    // return next(error);

    return err;
  }
}