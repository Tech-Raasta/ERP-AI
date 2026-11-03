import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiGRNGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/raw_material_in?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiGRNGetSingle(data) {
    return ApiService.fetchData({
        url: `/raw_material_in/${data}`,
        method: 'GET',
    })
}

export async function apiGRNUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_in/updateRate/${id}`, values, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => { return data }).catch(data => { return data })
}

export async function apiGRNApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_in/approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiGRNReject(data) {
    const { id, values } = data;
    return BaseService.put(`/raw_material_in/reject/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiGRNDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/raw_material_in/${data}`,
        method: 'DELETE',
    })
}
