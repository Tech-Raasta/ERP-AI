import ApiService from './ApiService'

export async function apiProductionReport(data) {
    return ApiService.fetchData({
        url: `/reports/production`,
        method: 'POST',
        data,
    })
}

// The Reports screen: the reports this role can see
export async function apiReportCatalog() {
    return ApiService.fetchData({ url: '/reports/catalog', method: 'GET' })
}

// A report's definition and the lists for its filters
export async function apiReportOptions(key) {
    return ApiService.fetchData({ url: `/reports/options/${key}`, method: 'GET' })
}

// First rows and totals, for the screen
export async function apiReportPreview(key, data) {
    return ApiService.fetchData({ url: `/reports/preview/${key}`, method: 'POST', data })
}

// The whole report as an Excel file
export async function apiReportDownload(key, data) {
    return ApiService.fetchData({ url: `/reports/download/${key}`, method: 'POST', data, responseType: 'blob' })
}
