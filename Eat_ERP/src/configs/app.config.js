const appConfig = {
    apiPrefix: 'http://localhost:5000/api',
    // apiPrefix: 'https://erp.eatanytime.in/api',
    // apiPrefix: 'https://phpstack-1207426-6335616.cloudwaysapps.com/api',
    socketUrl: 'http://localhost:5000',
    // socketUrl: 'https://erp.eatanytime.in/',
    // socketUrl: 'https://phpstack-1207426-6335616.cloudwaysapps.com/',
    // uploadUrl:"https://erp.eatanytime.in/assets/uploads/",
    // reportUrl:"https://erp.eatanytime.in/assets/reports/",
    uploadUrl:"https://phpstack-1207426-6335616.cloudwaysapps.com/assets/uploads/",
    reportUrl:"https://phpstack-1207426-6335616.cloudwaysapps.com/assets/reports/",
    authenticatedEntryPath: '/home',
    unAuthenticatedEntryPath: '/sign-in',
    tourPath: '/',
    locale: 'en',
    enableMock: false,
}

export default appConfig
