import ApiService from './ApiService'
import BaseService from './BaseService';

export async function apiProductionPlanningGet(data) {
    const { pageIndex, pageSize, query, sort, status } = data;
    return ApiService.fetchData({
        url: `/production_planning?pageSize=${pageSize}&pageIndex=${pageIndex - 1}&query=${query}&key=${sort["key"]}&order=${sort["order"]}&status=${status}`,
        method: 'GET',
        data,
    })
}

export async function apiProductionPlanningGetAll() {
    return ApiService.fetchData({
        url: `/production_planning`,
        method: 'GET',
    })
}

export async function apiProductionPlanningGetSingle(data) {
    return ApiService.fetchData({
        url: `/production_planning/${data}`,
        method: 'GET',
    })
}

export async function apiProductionPlanningGetProductRaws(data) {
    return ApiService.fetchData({
        url: `/production_planning/getProductRawMaterials`,
        method: 'POST',
        data
    })
}

export async function apiProductionPlanningMasterData() {
    return ApiService.fetchData({
        url: `/production_planning/getMasterData`,
        method: 'GET',
    })
}

export async function apiProductionPlanningSendMail(id) {
    return ApiService.fetchData({
        url: `/production_planning/emailProductionPlanning/${id}`,
        method: 'GET',
    })
}

export async function apiProductionPlanningPost(data) {
    // console.log(data);

    return BaseService.post('/production_planning', data).then(data => {
        return data
    }).catch(data => {
        return data
    })
}

export async function apiProductionPlanningUpdate(data) {
    const { id, values } = data;
    return BaseService.put(`/production_planning/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiProductionPlanningApprove(data) {
    const { id, values } = data;
    return BaseService.put(`/production_planning/approve/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiProductionPlanningReject(data) {
    const { id, values } = data;
    return BaseService.put(`/production_planning/reject/${id}`, values).then(data => { return data }).catch(data => { return data })
}

export async function apiProductionPlanningDelete(data) {
    // console.log(data);
    return ApiService.fetchData({
        url: `/production_planning/${data}`,
        method: 'DELETE',
    })
}
