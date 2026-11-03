import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiGetEzycomInventory(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/easyEcomInventory?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
    })
}

export async function apiGetEzycomInventoryByID(id) {
    return ApiService.fetchData({
        url: `/easyEcomInventory/${id}`,
        method: 'GET',
    })
}

// export async function apiGetEzycomInventory() {
//     return ApiService.fetchData({
//         url: `/easyEcomApis/getInventoryWithBarcode`,
//         method: 'GET',
//     })
// }

export async function apiPostEzycomInventory(data) {
    return ApiService.fetchData({
        url: `/easyEcomInventory`,
        method: 'POST',
        data
    })
}