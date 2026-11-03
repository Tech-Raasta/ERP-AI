import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiPurchaseOrderGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/purchase_order?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiPurchaseOrderGetAll() {
    return ApiService.fetchData({
        url: `/purchase_order`,
        method: 'GET',
    })
}

export async function apiPurchaseOrderGetSingle(data) {
    return ApiService.fetchData({
        url: `/purchase_order/${data}`,
        method: 'GET',
    })
}

export async function apiPurchaseOrderPoRate(rawMaterialid, depot_id) {
    return ApiService.fetchData({
        url: `/purchase_order/getOldPoRate/${rawMaterialid}/${depot_id ? depot_id : null}`,
        method: 'GET',
    })
}

export async function apiPurchaseOrderMasterData() {
    return ApiService.fetchData({
        url: `/purchase_order/getMasterData`,
        method: 'GET',
    })
}

export async function apiPurchaseOrderSendMail(id) {
    return ApiService.fetchData({
        url: `/purchase_order/emailPurchaseOrder/${id}`,
        method: 'GET',
    })
}

export async function apiPurchaseOrderPost(data) {
    // console.log(data);

    return BaseService.post('/purchase_order', data).then(data => {
        return data
    }).catch(data => {
        return data
    })
}

export async function apiPurchaseOrderUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/purchase_order/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiPurchaseOrderApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/purchase_order/approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiPurchaseOrderReject(data) {
    const { id, values } = data;
    return BaseService.put(`/purchase_order/reject/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiPurchaseOrderDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/purchase_order/${data}`,
        method: 'DELETE',
    })
}
