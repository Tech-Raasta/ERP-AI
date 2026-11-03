import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiRawMaterialQtyInGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/raw_material_in?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiRawMaterialQtyInGetSingle(data) {
    return ApiService.fetchData({
        url: `/raw_material_in/${data}`,
        method: 'GET',
    })
}

export async function apiRawMaterialQtyInVendorPos(data) {
    return ApiService.fetchData({
        url: `/raw_material_in/getVendorPos/${data}`,
        method: 'GET',
    })
}
export async function apiRawMaterialQtyInPoDetails(data) {
    return ApiService.fetchData({
        url: `/raw_material_in/getPoDetails/${data}`,
        method: 'GET',
    })
}

export async function apiRawMaterialQtyInPoRate(data) {
    return ApiService.fetchData({
        url: `/raw_material_in/getOldPoRate/${data}`,
        method: 'GET',
    })
}

export async function apiRawMaterialQtyInMasterData() {
    return ApiService.fetchData({
        url: `/raw_material_in/getMasterData`,
        method: 'GET',
    })
}

export async function apiRawMaterialQtyInPost(data) {
    // console.log(data);

    return BaseService.post('/raw_material_in', data, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => {
        return data
    }).catch(data => {
        return data
    })
}

export async function apiRawMaterialQtyInUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_in/${id}`, values, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => { return data }).catch(data => { return data })
}

export async function apiRawMaterialQtyInApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_in/approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiRawMaterialQtyInPendingApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_in/grn_approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiRawMaterialQtyInReject(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_in/reject/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiRawMaterialQtyInDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/raw_material_in/${data}`,
        method: 'DELETE',
    })
}

export async function apiDeleteAttachment(id, data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/raw_material_in/deleteAttachment/${id}`,
        method: 'DELETE',
        data
    })
}
