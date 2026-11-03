import React from 'react'
import UploadFileList from 'views/sales/SalesUpload/UploadFileList'
import {
    apiOldPaymentUploadApprove,
    apiOldPaymentUploadFormat,
    apiOldPaymentUploadGet,
    apiOldPaymentUploadNotes,
    apiOldPaymentUploadPost,
    apiOldPaymentUploadProcess,
    apiOldPaymentUploadReject,
    apiOldPaymentUploadSlips,
} from 'services/OldPaymentUploadService'

// Old Payment Upload (old PHP Payment_upload): the Normal format or a Paytm / Razorpay / Shiprocket / Sodexo settlement
// report becomes pending payments; approving the file turns them into approved payments. Marketplace settlements go
// in New Payment Upload.

const API = {
    get: apiOldPaymentUploadGet,
    format: apiOldPaymentUploadFormat,
    post: apiOldPaymentUploadPost,
    process: apiOldPaymentUploadProcess,
    approve: apiOldPaymentUploadApprove,
    reject: apiOldPaymentUploadReject,
}

const LABELS = {
    title: 'Old Payment Upload',
    formatFile: 'payment_upload_format.xlsx',
    uploadHelp: 'Normal files use the Download Format file; for the other types upload the settlement report as it is. Rows with the same date, bank, mode and NEFT No make one payment. If any row has an error nothing is uploaded; the error file lists the reasons.',
    approveConfirm: 'Its payments become approved payments.',
    rejectConfirm: 'Its payments will not be recorded.',
}

const PRINTS = [
    { label: 'Get Payment Slips', request: apiOldPaymentUploadSlips },
    { label: 'Get Credit Notes', request: apiOldPaymentUploadNotes },
]

const UPLOAD_TYPES = ['Normal', 'Paytm', 'Razorpay', 'Shiprocket', 'Sodexo']

const OldPaymentUpload = () => <UploadFileList api={API} labels={LABELS} prints={PRINTS} uploadTypes={UPLOAD_TYPES} />

export default OldPaymentUpload
