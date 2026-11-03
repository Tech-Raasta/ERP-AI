import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiPaymentUploads(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/payment_upload?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
        data,
    })
}

export async function apiPaymentUploadsMasterData() {
    return ApiService.fetchData({
        url: `/payment_upload/getMasterData`,
        method: 'GET',
    })
}

export async function apiPaymentUploadsSummary(data) {
    return ApiService.fetchData({
        url: `/payment_upload/summary`,
        method: 'POST',
        data,
    })
}

export async function apiPaymentUploadDownload() {
    return ApiService.fetchData({
        url: `/payment_upload/getPaymentUploadFormat`,
        method: 'GET',
    })
}

export async function apiPaymentUploadPost(data) {

    return BaseService.post('/payment_upload', data, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => {
        return data
    }).catch(data => {
        return data
    })
}

export async function apiPaymentUploadGeneratePaymentSlip(id) {
    return ApiService.fetchData({
        url: `/payment_upload/payment_slip/${id}`,
        method: 'GET',
    })
}

export async function apiPaymentUploadGenerateCreditDebitNote(id) {
    return ApiService.fetchData({
        url: `/payment_upload/credit_debit_note/${id}`,
        method: 'GET',
    })
}

export async function apiPaymentUpload(id) {
    return ApiService.fetchData({
        url: `/payment_upload/${id}`,
        method: 'GET',
    })
}

export async function apiPaymentUploadApprove(id) {
    return BaseService.put(`/payment_upload/approve/${id}`).then(data => { return data }).catch(data => { return data })
}

export async function apiPaymentUploadReject(id) {
    return BaseService.put(`/payment_upload/reject/${id}`).then(data => { return data }).catch(data => { return data })
}

export async function apiPaymentUploadDelete(id) {
    // console.log(id);
    return ApiService.fetchData({
        url: `/payment_upload/${id}`,
        method: 'DELETE',
    })
}
