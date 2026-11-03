import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiGetDepot() {
    return ApiService.fetchData({
        url: `/production/getDepotList`,
        method: 'GET',
    }).then(data => {
        return data.data
    })
}


export async function apiGetMasterData() {
    return ApiService.fetchData({
        url: `/production/getMasterData`,
        method: 'GET',
    }).then(data => {
        return data.data
    })
}

export async function apiProduction(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production`,
        method: 'POST',
        data,
    })
}

export async function apiProductionEdit(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiGetAllProduction(data, pagination) {
    // console.log(data);
    const { pageIndex, pageSize, status, query } = pagination;
    return ApiService.fetchData({
        url: `/production?depot_id=${data}&status=${status}&pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiGetProductionStock(data) {
    return ApiService.fetchData({
        url: `/production/getProductionStock/${data.manufacturer_id}/${data.product_id}`,
        method: 'GET',
    }).then(data => {
        return data.data
    })
}


export async function apiGetProductionStockEdit(data) {
    return ApiService.fetchData({
        url: `/production/getManufacturerTotalStock/${data.manufacturer_id}/${data.product_id}`,
        method: 'GET',
    }).then(data => {
        return data.data
    })
}

// Request Packaging Material

export async function apiPackagingGetMasterData() {
    return ApiService.fetchData({
        url: `/packaging/getMasterData`,
        method: 'GET',
    }).then(data => {
        return data.data
    })
}

export async function apiPackagingMaterialStock(raw_material_id, depot_id) {
    return ApiService.fetchData({
        url: `/production/getPackagingMaterialStock/${raw_material_id}/${depot_id}`,
        method: 'GET',
    }).then(data => {
        return data.data
    })
}

export async function apiGetAllPackaging(data, pagination) {
    // console.log(data);
    const { pageIndex, pageSize, status, query } = pagination;
    return ApiService.fetchData({
        url: `/packaging?depot_id=${data}&status=${status}&pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}`,
        method: 'GET',
    }).then(data => data.data)
}


export async function apiGetPackaging(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/packaging/getBatchQty/${id}`,
        method: 'GET',
    }).then(data => data.data)
}


export async function apiPackaging(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/packaging`,
        method: 'POST',
        data,
    })
}

export async function apiPackagingEdit(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/packaging/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiPackagingDelete(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/packaging/${id}`,
        method: 'DELETE',
    })
}


// Production Manager -  Allocation Qty

export async function apiProductionAllocationList(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/getAllocations/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiProductionAllocatePut(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/allocate/${id}`,
        method: 'PUT',
        data,
    })
}

// Production Manager -  Check Qty

export async function apiProductionCheckQtyList(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/getBatchQty/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiProductionCheckQtyRequest(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/setBatchQty/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiPackagingCheckQtyRequest(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/packaging/setBatchQty/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiProductionCheckQtyPut(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/updateBatchQty/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiProductionCheckQtyApprove(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/approveBatchQty/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiProductionCheckQtyReject(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/rejectBatchQty/${id}`,
        method: 'PUT',
        data,
    })
}

// Production Manager -  Allocation Qty

export async function apiProductionTransferList(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/getTransfers/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiProductionTransferPut(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/transfer/${id}`,
        method: 'PUT',
        data,
    }).then(res=>res).catch(err=>err)
}


// Production Manager -  Return Balance Material

export async function apiGetProductionReturnDetails(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/getReturns/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiPutProductionReturn(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/return/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiPutPackagingReturn(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/packaging/return/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiPutProductionRetain(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/retain/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiPutProductionWastage(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/waste/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiProductionSubmit(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/submit/${id}`,
        method: 'PUT',
    })
}

export async function apiProductionWorkInProgress(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/workInProgress/${id}`,
        method: 'PUT',
    })
}

export async function apiProductionAllocationPending(data,id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/allocationPending/${id}`,
        method: 'PUT',
        data
    })
}



export async function apiProductionDelete(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/${id}`,
        method: 'DELETE',
    })
}

export async function apiProductionApprove(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/approve/${id}`,
        method: 'PUT',
    })
}

export async function apiProductionReject(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/reject/${id}`,
        method: 'PUT',
    })
}


// Production Floor Manager - Production Transfer

export async function apiProductionTransferDelete(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production_transfer/${id}`,
        method: 'DELETE',
    })
}

export async function apiProductionTransferApprove(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production_transfer/approve/${id}`,
        method: 'PUT',
    })
}

export async function apiProductionTransferReject(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production_transfer/reject/${id}`,
        method: 'PUT',
    })
}

// Store Manager

export async function apiGetStoreDepot() {
    return ApiService.fetchData({
        url: `/store_manager/getDepotList`,
        method: 'GET',
    }).then(data => {
        return data.data
    })
}

export async function apiGetAllStore(data, pagination) {
    // console.log(data);
    const { pageIndex, pageSize, status, query } = pagination;
    return ApiService.fetchData({
        url: `/store_manager?depot_id=${data}&status=${status}&pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiGetStore(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_manager/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiGetPackagingStore(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_packaging_manager/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiGetReturnStore(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/getReturns/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiGetReturnPackagingStore(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/packaging/getReturns/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiStoreManagerReceive(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_manager/receive/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiStoreManagerReceivePackaging(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_packaging_manager/receive/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiStoreManagerCancel(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_manager/cancelReceive/${id}`,
        method: 'PUT',
    })
}

export async function apiStoreManagerCancelPackaging(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_packaging_manager/cancelReceive/${id}`,
        method: 'PUT',
    })
}

export async function apiGetBarcodeStock(data) {
    // console.log(data);
    const { id, barcode } = data
    return ApiService.fetchData({
        url: `/store_manager/getBarcodeStock/${id}/${barcode}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiStoreManagerBarcodeStockReturn(data) {
    // console.log(data);
    const { id, barcode } = data
    return ApiService.fetchData({
        url: `/store_manager/checkBarcode/${id}/${barcode}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiStoreManagerPackagingBarcodeStockReturn(data) {
    // console.log(data);
    const { id, barcode } = data
    return ApiService.fetchData({
        url: `/store_packaging_manager/checkBarcode/${id}/${barcode}`,
        method: 'GET',
    }).then(data => data.data)
}


export async function apiStoreManagerEdit(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_manager/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiPutTransfer(data, id) {
    // console.log(data);
    return BaseService.put(`/store_manager/transfer/${id}`, data, {
        // headers: {
        //     'Content-Type': 'multipart/form-data'
        // }
    }).then(data => { return data }).catch(data => { return data })
}

export async function apiPutTransferPackaging(data, id) {
    // console.log(data);
    return BaseService.put(`/store_packaging_manager/transfer/${id}`, data, {
        // headers: {
        //     'Content-Type': 'multipart/form-data'
        // }
    }).then(data => { return data }).catch(data => { return data })
}


// Store Manager - get Assemble List

export async function apiStoreManagerCheckQtyList(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_manager/getBatchRawMaterial/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiStoreManagerPackagingCheckQtyList(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_packaging_manager/getBatchRawMaterial/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiStoreManagerGetRawMaterialStock(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_manager/getRawMaterialStock/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiStoreManagerGetPackagingStock(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_packaging_manager/getRawMaterialStock/${id}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiStoreManagerGetRawMaterialBarcodeStock(data) {
    const {id, barcode} = data
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_manager/getRawMaterialBarcodeStock/${id}/${barcode}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiStoreManagerGetPackagingBarcodeStock(data) {
    const {id, barcode} = data
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_packaging_manager/getRawMaterialBarcodeStock/${id}/${barcode}`,
        method: 'GET',
    }).then(data => data.data)
}

export async function apiStoreManagerAssembleRawMaterial(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_manager/assembleRawMaterial/${id}`,
        method: 'PUT',
        data,
    })
}

export async function apiStoreManagerAssemblePackaging(data, id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/store_packaging_manager/assembleRawMaterial/${id}`,
        method: 'PUT',
        data,
    })
}


// Store Manager - Receive Transfer

export async function apiProductionTransferReceiveList(id) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production_transfer/${id}`,
        method: 'GET',
    }).then(data => data.data)
}


export async function apiSyncProductionTransfer(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production_transfer/sync`,
        method: 'POST',
        data
    }).then(data => data.data)
}


// Track Barcode

export async function apiProductionTrackBarcode(barcode) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production/trackBarcode/${barcode}`,
        method: 'GET',
    }).then(data => data.data)
}