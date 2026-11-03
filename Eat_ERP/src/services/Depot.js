import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiDepotGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/depot?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
    })
}

export async function apiDepotGetAll() {
    return ApiService.fetchData({
        url: `/depot?pageSize=all`,
        method: 'GET',
    })
}

export async function apiDepotGetSingle(data) {
    return ApiService.fetchData({
        url: `/depot/${data}`,
        method: 'GET',
    })
}

export async function apiDepotMasterData() {
    return ApiService.fetchData({
        url: `/depot/getMasterData`,
        method: 'GET',
    })
}

export async function apiDepotPost(data) {
    return BaseService.post('/depot', data)
        .then(data => { return data })
        .catch(data => { return data })
}

export async function apiDepotUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/depot/${id}`, values)
        .then(data => { return data })
        .catch(data => { return data })
}
