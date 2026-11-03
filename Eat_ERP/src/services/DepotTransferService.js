import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiDepotTransferGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/depot_transfer?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiDepotTransferGetAll() {
    return ApiService.fetchData({
        url: `/depot_transfer`,
        method: 'GET',
    })
}

export async function apiDepotTransferGetSingle(data) {
    return ApiService.fetchData({
        url: `/depot_transfer/${data}`,
        method: 'GET',
    })
}

export async function apiDepotTransferGetBarcodes(id, type) {
    return ApiService.fetchData({
        url: `/depot_transfer/getBarcodes/${type}/${id}`,
        method: 'GET',
    }).then(data=>data.data)
}

export async function apiDepotTransferGetStockQuantity(depot_id, item_id) {
    return ApiService.fetchData({
        url: `/depot_transfer/getRawMaterialStock/${depot_id ?depot_id : 0}/${item_id}`,
        method: 'GET',
    }).then(data=>data.data)
}


export async function apiDepotTransferMasterData() {
    return ApiService.fetchData({
        url: `/depot_transfer/getMasterData`,
        method: 'GET',
    })
}


export async function apiDepotTransferPost(data) {
    // console.log(data);
    return BaseService.post('/depot_transfer', data).then(data => data).catch(data => data)
}

export async function apiDepotTransferUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/depot_transfer/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiDepotTransferApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/depot_transfer/approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiDepotTransferReject(data) {
    const { id, values } = data;
    return BaseService.put(`/depot_transfer/reject/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiDepotTransferDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/depot_transfer/${data}`,
        method: 'DELETE',
    })
}
