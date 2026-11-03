import path from 'path';
import { SellingPartner } from "amazon-sp-api";

import dotenv from 'dotenv';
dotenv.config();

import sendEmail from './email.js';
import { getReportPath } from "./common.js";

// const spClient = new SellingPartnerAPI({
//     region: 'eu',
//     refresh_token: config.get('SELLING_PARTNER_API_REFRESH_TOKEN'),
//     credentials: {
//         SELLING_PARTNER_APP_CLIENT_ID: config.get('SELLING_PARTNER_APP_CLIENT_ID'),
//         SELLING_PARTNER_APP_CLIENT_SECRET: config.get('SELLING_PARTNER_APP_CLIENT_SECRET'),
//         AWS_ACCESS_KEY_ID: config.get('AWS_ACCESS_KEY_ID'),
//         AWS_SECRET_ACCESS_KEY: config.get('AWS_SECRET_ACCESS_KEY'),
//         AWS_SELLING_PARTNER_ROLE: config.get('AWS_SELLING_PARTNER_ROLE')
//     }
// });

const spClient = new SellingPartner({
    region: "eu",
    refresh_token: process.env.SELLING_PARTNER_API_REFRESH_TOKEN,
    credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: process.env.SELLING_PARTNER_APP_CLIENT_ID,
        SELLING_PARTNER_APP_CLIENT_SECRET: process.env.SELLING_PARTNER_APP_CLIENT_SECRET,
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        // AWS_SELLING_PARTNER_ROLE: process.env.AWS_SELLING_PARTNER_ROLE
    },
    options: {
        auto_request_tokens: true
    }
});
// await spClient.refreshAccessToken();

// const spClient = new SellingPartner({
//     region: 'eu',
//     refresh_token: process.env.SELLING_PARTNER_API_REFRESH_TOKEN,
//     credentials: {
//         SELLING_PARTNER_APP_CLIENT_ID: process.env.SELLING_PARTNER_APP_CLIENT_ID,
//         SELLING_PARTNER_APP_CLIENT_SECRET: process.env.SELLING_PARTNER_APP_CLIENT_SECRET,
//         AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
//         AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
//         // AWS_SELLING_PARTNER_ROLE: process.env.AWS_SELLING_PARTNER_ROLE
//     }
// });

// const spClient = new SellingPartner({
//     region: 'eu',
//     refresh_token: process.env.SELLING_PARTNER_API_REFRESH_TOKEN,
//     access_token: process.env.ACCESS_TOKEN,
//     endpoints_versions: {"reports":"2021-06-30"},
//     credentials:{
//         SELLING_PARTNER_APP_CLIENT_ID: process.env.SELLING_PARTNER_APP_CLIENT_ID,
//         SELLING_PARTNER_APP_CLIENT_SECRET: process.env.SELLING_PARTNER_APP_CLIENT_SECRET
//     },
//     options:{
//         // credentials_path:'~/.amzspapi/credentials',
//         auto_request_tokens:true,
//         auto_request_throttled:true,
//         version_fallback:true,
//         use_sandbox:false,
//         only_grantless_operations:false,
//         // user_agent:'amazon-sp-api/<CLIENT_VERSION> (Language=Node.js/<NODE_VERSION>; Platform=<OS_PLATFORM>/<OS_RELEASE>)',
//         debug_log:false,
//         // timeouts: { response: 30000 },
//         // retry_remote_timeout: true,
//         // https_proxy_agent:<HttpsProxyAgent>
//     }
// });

export const testApi = async () => {
    try {
        // const spClient = new SellingPartner({
        //     region: "eu", // The region to use for the SP-API endpoints ("eu", "na" or "fe")
        //     refresh_token: process.env.SELLING_PARTNER_API_REFRESH_TOKEN // The refresh token of your app user
        // });
        // await spClient.refreshAccessToken();
        let res = await spClient.callAPI({
            operation: "getMarketplaceParticipations",
            endpoint: "sellers"
        });
        console.log(res);
        return res;
    } catch (e) {
        console.log(e);
    }
}

export const downloadReport = async (body) => {
    try {
        // const dest = path.join(getReportPath(), 'amazon', `testfile.json`);
        // await spClient.refreshAccessToken();
        let res = await spClient.downloadReport({
            body: {
                ...body,
                marketplaceIds: ["A21TJRUUN4KGV"]
            },
            version: "2021-06-30",
            interval: 10000,
            download: {
                json: true,
                // file: dest
            }
        });

        return res;
    } catch (error) {
        return error;
    }
}

// export const createReport = async (body) => {
//     try {
//         await spClient.refreshAccessToken();
//         const data = await spClient.callAPI({
//             operation: 'reports.createReport',
//             body: {
//                 ...body,
//                 marketplaceIds: ["A21TJRUUN4KGV"]
//             },
//             options: {
//                 version: '2021-06-30'
//             }
//         });

//         let reportId = '';
//         if (data.reportId) {
//             reportId = data.reportId;
//         }

//         return reportId;
//     } catch (error) {
//         return error;
//     }
// }

// export const getReport = async (reportId) => {
//     try {
//         const report = await spClient.callAPI({
//             operation: 'reports.getReport',
//             path: {
//                 reportId: reportId
//             },
//             options: {
//                 version: '2021-06-30'
//             }
//         });

//         const data = {
//             reportType: '',
//             processingEndTime: null,
//             processingStatus: '',
//             reportDocumentId: '',
//             reportId: reportId,
//             dataEndTime: null,
//             createdTime: null,
//             processingStartTime: null,
//             dataStartTime: null
//         };
//         if (report) {
//             data.reportType = report.reportType;
//             data.processingEndTime = report.processingEndTime ? new Date(report.processingEndTime).toISOString() : null;
//             data.processingStatus = report.processingStatus;
//             data.reportDocumentId = report.reportDocumentId;
//             data.dataEndTime = report.dataEndTime ? new Date(report.dataEndTime).toISOString() : null;
//             data.createdTime = report.createdTime ? new Date(report.createdTime).toISOString() : null;
//             data.processingStartTime = report.processingStartTime ? new Date(report.processingStartTime).toISOString() : null;
//             data.dataStartTime = report.dataStartTime ? new Date(report.dataStartTime).toISOString() : null;
//         }

//         return data;
//     } catch (error) {
//         return error;
//     }
// }

// export const getReportDocument = async (reportDocumentId) => {
//     try {
//         const report = await spClient.callAPI({
//             operation: 'reports.getReportDocument',
//             path: {
//                 reportDocumentId: reportDocumentId
//             },
//             options: {
//                 version: '2021-06-30'
//             }
//         });

//         let url = '';
//         if (report && report.url) {
//             url = report.url;
//         }

//         return url;
//     } catch (error) {
//         return error;
//     }
// }

export const getOrders = async (lastUpdatedAfter, NextToken) => {
    // try {
        let query = { NextToken: NextToken };

        if (NextToken === '') {
            query = {
                LastUpdatedAfter: lastUpdatedAfter,
                // LastUpdatedBefore: '2024-08-24T00:00:00Z',
                // CreatedAfter:'2023-04-18',
                MarketplaceIds: 'A21TJRUUN4KGV'
            }
        }

        const orders = await spClient.callAPI({
            operation: 'orders.getOrders',
            query: query,
            options: {
                version: 'v0'
            }
        });

        // console.log(orders);

        return orders;
    // } catch (error) {
    //     return error;
    // }
}

export const getOrder = async (orderId) => {
    try {
        await spClient.refreshAccessToken();

        const order = await spClient.callAPI({
            operation: 'orders.getOrder',
            path: {
                orderId: orderId
            },
            options: {
                version: 'v0'
            }
        });

        return order;
    } catch (error) {
        return error;
    }
}

export const getOrderBuyerInfo = async (orderId) => {
    try {
        const orderBuyerInfo = await spClient.callAPI({
            operation: 'orders.getOrderBuyerInfo',
            path: {
                orderId: orderId
            },
            options: {
                version: 'v0'
            }
        });

        return orderBuyerInfo;
    } catch (error) {
        return error;
    }
}

export const getOrderItems = async (orderId) => {
    try {
        const orderItems = await spClient.callAPI({
            operation: 'orders.getOrderItems',
            path: {
                orderId: orderId
            },
            options: {
                version: 'v0'
            }
        });

        return orderItems;
    } catch (error) {
        return error;
    }
}

export const sendOrderEmail = function (errorOrders) {
    try {
        const subject = `Easy Ecom Process Order Errors ${new Date().toLocaleDateString()}`;
        const summary = [... new Set(errorOrders.map(item => item.remarks))];

        // Old version
        // const text = errorOrders.map(errorOrder => {
        //     return `Order No: ${errorOrder.order_no} - 
        //         Order Date: ${errorOrder.order_date} - 
        //         Remarks: ${errorOrder.remarks}`;
        // }).join(' <br/> ');
        // const tbody = errorOrders.map(errorOrder => {
        //     return `<tr>
        //           <td style="width: 100px;">${errorOrder.order_no}</td>
        //           <td style="width: 100px; text-align: center;">${errorOrder.order_date}</td>
        //           <td style="width: 600px; text-align: center;">${errorOrder.remarks}</td>
        //         </tr>`;
        // }).join('');

        // New version - Only Summary
        const text = summary.map(remark => {
            return `Remarks: ${remark}`;
        }).join(' <br/> ');
        const tbody = summary.map(remark => {
            return `<tr>
                  <td style="width: 800px; text-align: center;">${remark}</td>
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
      <p>Easy Ecom Process Order Errors ${new Date().toLocaleDateString()}</p>
      <table>
      <thead>
      <tr>
      <th>Summary</th>
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
      EAT ERP
      </body>
      </html>
      `;

        // console.log(html);

        const mailOptions = {
            from: 'EAT ERP <orders@eatanytime.in>',
            to: 'priti.tripathi@eatanytime.in,operations@eatanytime.in,ops1@eatanytime.in,mis@eatanytime.in',
            cc: 'dhaval.maru@raastaconsulting.com,technology@raastaconsulting.com',
            // bcc: 'technology@raastaconsulting.com',
            // to: 'technology@raastaconsulting.com',
            // cc: 'technology@raastaconsulting.com',
            // bcc: 'technology@raastaconsulting.com',
            // cc: 'dhaval.maru@raastaconsulting.com',
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
                console.log(err);
                // const error = new Error(err);
                // error.httpStatusCode = 500;
                // return next(error);

                return err;
            });
    } catch (err) {
        console.log(err);
        // const error = new Error(err);
        // error.httpStatusCode = 500;
        // return next(error);

        return err;
    }
}

export const sendOrderFetchingFailedEmail = function (error) {
    try {
        const subject = `Easy Ecom Process Order Failed ${new Date().toLocaleDateString()}`;
        const text = `Reason : ${error.message}`;

        const html = `
      <html>
      <body>
      <p>Easy Ecom Process Order Failed ${new Date().toLocaleDateString()}</p>
      <p>Reason : ${error.message}</p>
      <br/>
      <br/>
      Regards,
      <br/>
      <br/>
      EAT ERP
      </body>
      </html>
      `;

        // console.log(html);

        const mailOptions = {
            from: 'EAT ERP <orders@eatanytime.in>',
            // to: 'priti.tripathi@eatanytime.in,operations@eatanytime.in',
            // cc: 'dhaval.maru@raastaconsulting.com',
            // bcc: 'technology@raastaconsulting.com',
            to: 'technology@raastaconsulting.com',
            cc: 'technology@raastaconsulting.com',
            bcc: 'technology@raastaconsulting.com',
            // cc: 'dhaval.maru@raastaconsulting.com',
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
                console.log(err);
                // const error = new Error(err);
                // error.httpStatusCode = 500;
                // return next(error);

                return err;
            });
    } catch (err) {
        console.log(err);
        // const error = new Error(err);
        // error.httpStatusCode = 500;
        // return next(error);

        return err;
    }
}

export const test = async (body) => {
    try {
        // let res1 = await spClient.callAPI({
        //   operation:'sellers.getMarketplaceParticipations'
        // });

        // let res1 = await spClient.callAPI({
        //   operation:'catalogItems.getCatalogItem',
        //   path:{
        //     asin:'B09JLRG5YJ'
        //   },
        //   query:{
        //     marketplaceIds:'A21TJRUUN4KGV'
        //   },
        //   options:{
        //     version:'2020-12-01'
        //   }
        // });

        // let res1 = await spClient.callAPI({
        //   operation:'orders.getOrders',
        //   query:{
        //     // LastUpdatedAfter:'2023-04-16',
        //     CreatedAfter:'2023-04-18',
        //     MarketplaceIds:'A21TJRUUN4KGV'
        //   },
        //   options:{
        //     version:'v0'
        //   }
        // });

        // console.log(res1);

        // res1 = await spClient.callAPI({
        //   operation:'orders.getOrderBuyerInfo',
        //   path: {
        //     orderId: '405-7332721-2001939'
        //   },
        //   options:{
        //     version:'v0'
        //   }
        // });

        // console.log(res1);

        // res1 = await spClient.callAPI({
        //   operation:'orders.getOrderAddress',
        //   path: {
        //     orderId: '405-7332721-2001939'
        //   },
        //   options:{
        //     version:'v0'
        //   }
        // });

        // console.log(res1);

        const data = {
            order: {},
            orderItems: [],
            report: {},
            reportDocument: {},
            fileData: [],
            error: ''
        };

        // data.order = await spClient.callAPI({
        //     operation: 'orders.getOrder',
        //     path: {
        //         orderId: '405-7332721-2001939'
        //     },
        //     options: {
        //         version: 'v0'
        //     }
        // });

        // console.log(data);

        // data.orderItems = await spClient.callAPI({
        //   operation:'orders.getOrderItems',
        //   path: {
        //     orderId: '405-7332721-2001939'
        //   },
        //   options:{
        //     version:'v0'
        //   }
        // });

        data.report = await spClient.callAPI({
            operation: 'reports.createReport',
            body: {
                ...body,
                marketplaceIds: ["A21TJRUUN4KGV"]
            },
            options: {
                version: '2021-06-30'
            }
        });

        let reportId = '';
        if (data.report && data.report.reportId) {
            reportId = data.report.reportId;
        }

        data.report = await spClient.callAPI({
            operation: 'reports.getReport',
            path: {
                reportId: reportId
            },
            options: {
                version: '2021-06-30'
            }
        });

        // data.reportDocument = await spClient.callAPI({
        //   operation:'reports.getReportDocument',
        //   path: {
        //     reportDocumentId: 'amzn1.spdoc.1.4.eu.81871ce4-1025-40df-b941-ddde371a05a2.T1KUP5ZQMWAMEC.2511'
        //   },
        //   options:{
        //     version:'2021-06-30'
        //   }
        // });

        return data;
    } catch (error) {
        console.log(error);
        return error;
    }
}