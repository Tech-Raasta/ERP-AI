import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiDepotTransferUploads(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/depot_transfer_upload?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
        data,
    })
}

export async function apiDepotTransferUploadDownload() {
    return ApiService.fetchData({
        url: `/depot_transfer_upload/getDepotTransferUploadFormat`,
        method: 'GET',
    })
}

export async function apiDepotTransferUploadPost(data) {

    return BaseService.post('/depot_transfer_upload', data, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }).then(data => {
        return data
    }).catch(data => {
        return data
    })
}

export async function apiDepotTransferUploadApprove(id) {
    return BaseService.put(`/depot_transfer_upload/approve/${id}`).then(data => { return data }).catch(data => { return data })
}

export async function apiDepotTransferUploadReject(id) {
    return BaseService.put(`/depot_transfer_upload/reject/${id}`).then(data => { return data }).catch(data => { return data })
}

export async function apiDepotTransferUploadDelete(id) {
    // console.log(id);
    return ApiService.fetchData({
        url: `/depot_transfer_upload/${id}`,
        method: 'DELETE',
    })
}
