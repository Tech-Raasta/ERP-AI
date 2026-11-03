import ApiService from './ApiService'

// The home page for the signed-in user: their name, role and depots, the work waiting for them, and (for roles with
// the Dashboard section) the business figures
export async function apiHome() {
    return ApiService.fetchData({ url: '/home', method: 'GET' })
}
