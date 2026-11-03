import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiVendorPaymentGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/vendor_payment?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiVendorPaymentGetSingle(data) {
    return ApiService.fetchData({
        url: `/vendor_payment/${data}`,
        method: 'GET',
    })
}

export async function apiAddVendorPayment() {
    return ApiService.fetchData({
        url: `/vendor_payment/addVendorPayment`,
        method: 'GET',
    })
}

export async function apiVendorPaymentGetSingleEdit(data) {
    return ApiService.fetchData({
        url: `/vendor_payment/editVendorPayment/${data}`,
        method: 'GET',
    })
}

// export async function apiVendorPaymentEditUpdate(data) {
//     const { id, values } = data;
//     return BaseService.put(`/vendor_payment/updateVendorPayment/${id}`, values).then(data => { return data }).catch(data => { return data })
// }

export async function apiVendorPaymentPost(data) {
    return BaseService.post(`/vendor_payment`, data).then(data => { return data }).catch(data => { return data })
}

export async function apiVendorPaymentUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/vendor_payment/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiVendorPaymentApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/vendor_payment/approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiVendorPaymentReject(data) {
    const { id, values } = data
    return BaseService.put(`/vendor_payment/reject/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiVendorPaymentDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/vendor_payment/${data}`,
        method: 'DELETE',
    })
}
