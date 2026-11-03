import ApiService from './ApiService'

// Credit Debit Note (Transaction -> Bank, old PHP Credit_debit_note)

export async function apiCreditDebitNotesGet({ pageIndex, pageSize, query, status }) {
    return ApiService.fetchData({
        url: '/credit_debit_note',
        method: 'GET',
        params: { pageIndex: pageIndex - 1, pageSize, query, status },
    })
}

export async function apiCreditDebitNoteMasterData() {
    return ApiService.fetchData({ url: '/credit_debit_note/master', method: 'GET' })
}

// Outstanding and approved invoice nos of a distributor; id / ref_id: this note (and the one it changes) are left out
export async function apiCreditDebitNoteDistributor(distributorId, id, refId) {
    return ApiService.fetchData({
        url: '/credit_debit_note/distributor',
        method: 'GET',
        params: { distributor_id: distributorId, id: id || 0, ref_id: refId || 0 },
    })
}

export async function apiCreditDebitNoteGetSingle(id) {
    return ApiService.fetchData({ url: `/credit_debit_note/${id}`, method: 'GET' })
}

export async function apiCreditDebitNotePost(data) {
    return ApiService.fetchData({ url: '/credit_debit_note', method: 'POST', data })
}

export async function apiCreditDebitNoteUpdate(id, data) {
    return ApiService.fetchData({ url: `/credit_debit_note/${id}`, method: 'PUT', data })
}

export async function apiCreditDebitNoteDelete(id, remarks) {
    return ApiService.fetchData({ url: `/credit_debit_note/${id}`, method: 'DELETE', data: { remarks } })
}

export async function apiCreditDebitNoteApprove(id, remarks) {
    return ApiService.fetchData({ url: `/credit_debit_note/approve/${id}`, method: 'PUT', data: { remarks } })
}

export async function apiCreditDebitNoteReject(id, remarks) {
    return ApiService.fetchData({ url: `/credit_debit_note/reject/${id}`, method: 'PUT', data: { remarks } })
}

// The approved note (printable HTML)
export async function apiCreditDebitNotePrint(id) {
    return ApiService.fetchData({ url: `/credit_debit_note/print/${id}`, method: 'GET' })
}
