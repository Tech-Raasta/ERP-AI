import ApiService from './ApiService'

// End of Month Sales (old PHP Freezed)

export async function apiEndOfMonthSalesGet(year) {
    return ApiService.fetchData({ url: '/end_of_month_sales', method: 'GET', params: { year } })
}

export async function apiEndOfMonthSalesFreeze(year, month) {
    return ApiService.fetchData({ url: '/end_of_month_sales/freeze', method: 'POST', data: { year, month } })
}

export async function apiEndOfMonthSalesReport(year, month) {
    return ApiService.fetchData({ url: '/end_of_month_sales/report', method: 'POST', data: { year, month } })
}

// The report file itself (admin only, so it goes through the API rather than a public link)
export async function apiEndOfMonthSalesDownload(year, month) {
    return ApiService.fetchData({ url: '/end_of_month_sales/report', method: 'GET', params: { year, month }, responseType: 'blob' })
}
