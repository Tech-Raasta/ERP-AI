import React from 'react'
import UploadFileList from '../SalesUpload/UploadFileList'
import {
    apiSalesReturnUploadApprove,
    apiSalesReturnUploadFormat,
    apiSalesReturnUploadGet,
    apiSalesReturnUploadPost,
    apiSalesReturnUploadProcess,
    apiSalesReturnUploadReceipts,
    apiSalesReturnUploadReject,
} from 'services/SalesReturnUploadService'

// Sales Return Upload (old PHP Sales_return_upload): an Excel of returns becomes pending returns; approving the file
// turns them into approved sales returns (expired goods written off); Print Receipts prints them.

const API = {
    get: apiSalesReturnUploadGet,
    format: apiSalesReturnUploadFormat,
    post: apiSalesReturnUploadPost,
    process: apiSalesReturnUploadProcess,
    approve: apiSalesReturnUploadApprove,
    reject: apiSalesReturnUploadReject,
}

const LABELS = {
    title: 'Sales Return Upload',
    formatFile: 'sales_return_upload_format.xlsx',
    uploadHelp: 'Use the Download Format file. Each row returns one SKU (Type, SKU Name, Qty, Batch No) or a whole approved sale by its Invoice No or PO No. If any row has an error nothing is uploaded; the error file lists the reasons.',
    approveConfirm: 'Its returns become approved sales returns with Sales Return Nos and ledger entries; expired goods are written off.',
    rejectConfirm: 'Its returns will not become sales returns.',
}

const PRINTS = [{ label: 'Print Receipts', request: apiSalesReturnUploadReceipts }]

const SalesReturnUpload = () => <UploadFileList api={API} labels={LABELS} prints={PRINTS} />

export default SalesReturnUpload
