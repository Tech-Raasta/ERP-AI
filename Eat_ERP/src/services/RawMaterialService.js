import ApiService from './ApiService'

export async function apiRawMaterialGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/raw_material?materialType=raw_material&pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
        data,
    })
}

export async function apiPackagingMaterialGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/raw_material?materialType=packaging_material&pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
        data,
    })
}

export async function apiAssetGet(data) {
    const { pageIndex, pageSize, query, sort } = data;
    return ApiService.fetchData({
        url: `/raw_material?materialType=asset&pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}`,
        method: 'GET',
    })
}

export async function apiRawMaterialGetSingle(data) {
    return ApiService.fetchData({
        url: `/raw_material/${data}`,
        method: 'GET',
    })
}

export async function apiRawMaterialPost(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/raw_material`,
        method: 'POST',
        data,
    })
}
export async function apiRawMaterialUpdate(data) {
    const { id, values } = data;
    return ApiService.fetchData({
        url: `/raw_material/${id}`,
        method: 'PUT',
        data: values,
    })
}

export async function apiRawMaterialDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/raw_material/${data}`,
        method: 'DELETE',
    })
}
