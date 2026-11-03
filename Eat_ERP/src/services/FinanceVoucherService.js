import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiFinanceVoucherGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/finance_voucher?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
    })
}

export async function apiFinanceVoucherGetSingle(data) {
    return ApiService.fetchData({
        url: `/finance_voucher/${data}`,
        method: 'GET',
    })
}

export async function apiFinanceVoucherGetMaasterData() {
    return ApiService.fetchData({
        url: `/finance_voucher/getMasterData`,
        method: 'GET',
    })
}

export async function apiFinanceVoucherVendorPos(data) {
    return ApiService.fetchData({
        url: `/finance_voucher/getVendorPos/${data}`,
        method: 'GET',
    })
    // return BaseService.get(`/finance_voucher/getVendorPos/${data}`).then(data => data).catch(data => data)
}

export async function apiFinanceVoucherPoDetails(data) {
    return ApiService.fetchData({
        url: `/finance_voucher/getPoDetails/${data}`,
        method: 'GET',
    })
}

export async function apiFinanceVoucherPost(data) {
    return BaseService.post(`/finance_voucher`, data, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => { return data }).catch(data => { return data })
}

export async function apiFinanceVoucherUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/finance_voucher/${id}`, values, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => { return data }).catch(data => { return data })
}

export async function apiFinanceVoucherApprovalUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/finance_voucher/check/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiFinanceVoucherApprovalReject(data) {
    const { id, values } = data;
    return BaseService.put(`/finance_voucher/rejectGrn/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiFinanceVoucherApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/finance_voucher/approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiFinanceVoucherReject(data) {
    const { id, values } = data;
    return BaseService.put(`/finance_voucher/reject/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiFinanceVoucherDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/finance_voucher/${data}`,
        method: 'DELETE',
    })
}
