import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiRequisitionGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/requisition?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiRequisitionGetSingle(data) {
    return ApiService.fetchData({
        url: `/requisition/${data}`,
        method: 'GET',
    })
}


export async function apiRequisitionMasterData() {
    return ApiService.fetchData({
        url: `/requisition/getMasterData`,
        method: 'GET',
    })
}

export async function apiRequisitionGetItems(depoId) {
    return ApiService.fetchData({
        url: `/requisition/getRequisitionItems/${depoId}`,
        method: 'GET',
    })
}

export async function apiRequisitionGetItemStock(depoId, itemId) {
    return ApiService.fetchData({
        url: `/requisition/getItemStock/${depoId}/${itemId}`,
        method: 'GET',
    })
}

export async function apiRequisitionGetRaiseProduction(id, data) {
    return ApiService.fetchData({
        url: `/requisition/raiseProduction/${id}`,
        method: 'PUT',
        data
    })
}

export async function apiRequisitionPost(data) {
    return ApiService.fetchData({
        url: `/requisition`,
        method: 'POST',
        data
    })
}

export async function apiRequisitionUpdate(id, data) {
    return ApiService.fetchData({
        url: `/requisition/${id}`,
        method: 'PUT',
        data
    })
}

export async function apiRequisitionApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/requisition/approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiRequisitionReject(data) {
    const { id, values } = data;
    return BaseService.put(`/requisition/reject/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiRequisitionDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/requisition/${data}`,
        method: 'DELETE',
    })
}
