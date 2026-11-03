import React from 'react'
import UploadFileList from './UploadFileList'
import {
    apiSalesUploadApprove,
    apiSalesUploadFormat,
    apiSalesUploadGet,
    apiSalesUploadInvoices,
    apiSalesUploadPost,
    apiSalesUploadProcess,
    apiSalesUploadReject,
} from 'services/SalesUploadService'

// Sales Upload (old PHP Sales_upload): an Excel of orders becomes pending orders; approving the file turns them into
// approved sales with invoices; Get Invoices prints them.

const API = {
    get: apiSalesUploadGet,
    format: apiSalesUploadFormat,
    post: apiSalesUploadPost,
    process: apiSalesUploadProcess,
    approve: apiSalesUploadApprove,
    reject: apiSalesUploadReject,
}

const LABELS = {
    title: 'Sales Upload',
    formatFile: 'sales_upload_format.xlsx',
    uploadHelp: 'Use the Download Format file. Rows with the same PO No make one order; an order is uploaded only when all its rows are correct. Rows that fail are listed in the error file.',
    approveConfirm: 'Its orders become approved sales with invoice numbers and ledger entries.',
    rejectConfirm: 'Its orders will not become sales.',
}

const PRINTS = [{ label: 'Get Invoices', request: apiSalesUploadInvoices }]

const SalesUpload = () => <UploadFileList api={API} labels={LABELS} prints={PRINTS} />

export default SalesUpload
