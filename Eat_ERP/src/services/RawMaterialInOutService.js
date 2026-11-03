import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiRawMaterialInOutGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/raw_material_in_out?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiRawMaterialInOutGetAll() {
    return ApiService.fetchData({
        url: `/raw_material_in_out`,
        method: 'GET',
    })
}

export async function apiRawMaterialInOutGetSingle(data) {
    return ApiService.fetchData({
        url: `/raw_material_in_out/${data}`,
        method: 'GET',
    })
}

export async function apiRawMaterialInOutGetBarcodes(data, depotId) {
    return ApiService.fetchData({
        url: `/raw_material_in_out/getBarcodes/${data}/${depotId}`,
        method: 'GET',
    })
}


export async function apiRawMaterialInOutMasterData() {
    return ApiService.fetchData({
        url: `/raw_material_in_out/getMasterData`,
        method: 'GET',
    })
}


export async function apiRawMaterialInOutPost(data) {
    // console.log(data);
    return BaseService.post('/raw_material_in_out', data).then(data => data).catch(data => data)
}

export async function apiRawMaterialInOutUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_in_out/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiRawMaterialInOutApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_in_out/approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiRawMaterialInOutReject(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_in_out/reject/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiRawMaterialInOutDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/raw_material_in_out/${data}`,
        method: 'DELETE',
    })
}
