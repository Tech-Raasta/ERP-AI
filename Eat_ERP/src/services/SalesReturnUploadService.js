import ApiService from './ApiService'

// Sales Return Upload (old PHP Sales_return_upload)

export async function apiSalesReturnUploadGet({ pageIndex, pageSize, query, sort }) {
    return ApiService.fetchData({
        url: '/sales_return_upload',
        method: 'GET',
        params: {
            pageIndex: pageIndex - 1,
            pageSize,
            query,
            key: sort && sort.key,
            order: sort && sort.order,
        },
    })
}

// The upload format with its drop-down lists, as a file
export async function apiSalesReturnUploadFormat() {
    return ApiService.fetchData({ url: '/sales_return_upload/format', method: 'GET', responseType: 'blob' })
}

// Uploads the file and reads its rows straight away
export async function apiSalesReturnUploadPost(file) {
    const data = new FormData()
    data.append('upload', file)
    return ApiService.fetchData({ url: '/sales_return_upload', method: 'POST', data, headers: { 'Content-Type': 'multipart/form-data' } })
}

// Reads the rows of a file that is still marked Uploading
export async function apiSalesReturnUploadProcess(id) {
    return ApiService.fetchData({ url: `/sales_return_upload/process/${id}`, method: 'POST' })
}

export async function apiSalesReturnUploadApprove(id) {
    return ApiService.fetchData({ url: `/sales_return_upload/approve/${id}`, method: 'PUT' })
}

export async function apiSalesReturnUploadReject(id) {
    return ApiService.fetchData({ url: `/sales_return_upload/reject/${id}`, method: 'PUT' })
}

// Sales return receipts of an approved file (printable HTML)
export async function apiSalesReturnUploadReceipts(id) {
    return ApiService.fetchData({ url: `/sales_return_upload/receipts/${id}`, method: 'GET' })
}
