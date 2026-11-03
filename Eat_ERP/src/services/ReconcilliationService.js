import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiReconcilliationList(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/raw_material_recon?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiReconcilliationGetSingle(data) {
    return ApiService.fetchData({
        url: `/raw_material_recon/${data}`,
        method: 'GET',
    })
}


export async function apiReconcilliationMasterData() {
    return ApiService.fetchData({
        url: `/raw_material_recon/getMasterData`,
        method: 'GET',
    })
}

export async function apiReconcilliationBarcodeData(id, depotId, barcode) {
    return ApiService.fetchData({
        url: `/raw_material_recon/getBarcodeStock/${id}/${depotId}/${barcode}`,
        method: 'GET',
    })
}

export async function apiReconcilliationGetBarcodes(itemId) {
    return ApiService.fetchData({
        url: `/raw_material_recon/getBarcodes/${itemId}`,
        method: 'GET',
    })
}

export async function apiReconcilliationPost(data) {
    return ApiService.fetchData({
        url: `/raw_material_recon`,
        method: 'POST',
        data
    })
}

export async function apiReconcilliationUpdate(id, data) {
    return ApiService.fetchData({
        url: `/raw_material_recon/${id}`,
        method: 'PUT',
        data
    })
}

export async function apiReconcilliationApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_recon/approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiReconcilliationReject(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_recon/reject/${id}`, values).then(data => { return data }).catch(data => { return data })
}
