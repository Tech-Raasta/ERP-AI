import ApiService from './ApiService'

// Eat Attendance (old PHP Eat_Attendence)

export async function apiAttendanceGet({ pageIndex, pageSize, query, status, year, month }) {
    return ApiService.fetchData({
        url: '/attendance',
        method: 'GET',
        params: { pageIndex: pageIndex - 1, pageSize, query, status, year, month },
    })
}

export async function apiAttendanceEmployee(empNo, year, month) {
    return ApiService.fetchData({ url: `/attendance/employee/${encodeURIComponent(empNo)}`, method: 'GET', params: { year, month } })
}

export async function apiAttendanceSave(empNo, data) {
    return ApiService.fetchData({ url: `/attendance/employee/${encodeURIComponent(empNo)}`, method: 'POST', data })
}

export async function apiAttendanceUpload(data) {
    return ApiService.fetchData({ url: '/attendance/upload', method: 'POST', data })
}

export async function apiAttendanceDownload(kind, data) {
    return ApiService.fetchData({ url: `/attendance/download/${kind}`, method: 'POST', data, responseType: 'blob' })
}

export async function apiAttendanceMail(data) {
    return ApiService.fetchData({ url: '/attendance/mail', method: 'POST', data })
}
