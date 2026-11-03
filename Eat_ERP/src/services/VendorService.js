import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiVendorGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/vendors?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiVendorGetSingle(data) {
    return ApiService.fetchData({
        url: `/vendors/${data}`,
        method: 'GET',
    })
}

export async function apiVendorMasterData() {
    return ApiService.fetchData({
        url: `/vendors/getMasterData`,
        method: 'GET',
    })
}

export async function apiVendorPost(data) {
    // console.log(data);

    return BaseService.post('/vendors', data, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => {
        return data
    }).catch(data => {
        return data
    })
}

export async function apiVendorUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/vendors/${id}`, values, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => { return data }).catch(data => { return data })
}

export async function apiVendorApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/vendors/approve/${id}`, values, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => { return data }).catch(data => { return data })
}

export async function apiVendorReject(data) {
    const { id, values } = data;
    return BaseService.put(`/vendors/reject/${id}`, values, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => { return data }).catch(data => { return data })
}

export async function apiVendorDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/vendors/${data}`,
        method: 'DELETE',
    })
}
