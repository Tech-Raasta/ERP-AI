import React, { Suspense } from 'react'
import { Loading } from 'components/shared'
import { protectedRoutes, publicRoutes } from 'configs/routes.config'
import appConfig from 'configs/app.config'
import PageContainer from 'components/template/PageContainer'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import ProtectedRoute from 'components/route/ProtectedRoute'
import PublicRoute from 'components/route/PublicRoute'
import AuthorityGuard from 'components/route/AuthorityGuard'
import AppRoute from 'components/route/AppRoute'
import PageErrorBoundary from 'components/route/PageErrorBoundary'
import StatusPage from 'components/shared/StatusPage'
import { HiOutlineLockClosed, HiOutlineSearch } from 'react-icons/hi'
import { canOpen } from 'utils/navAccess'

const { authenticatedEntryPath } = appConfig

const NoAccessPage = () => (
    <StatusPage
        icon={<HiOutlineLockClosed />}
        title="No access"
        message="Your role does not have access to this page. Ask your administrator if you need it."
    />
)

const NotFoundPage = () => (
    <StatusPage
        icon={<HiOutlineSearch />}
        title="Page not found"
        message="This address does not match any page of the ERP. It may have moved; use the menu to find it."
    />
)

// Only the pages of the role's menu open; any other known page shows No access (old: silently back to Home)
const allowedRoute = (route, roleDetails) => canOpen(route, roleDetails)

const AllRoutes = (props) => {
    const userAuthority = useSelector((state) => state.auth.user.authority)
    let roleDetails = {
        home: 1,
        master: 1,
        product: 1,
        category: 1,
        vendor: 1,
        rawMaterial: 1,
        packagingMaterial: 1,
        transaction: 1,
        purchaseOrder: 1,
        goodsReceivedNote: 1,
        invoiceProcessing: 1,
        financeVoucher: 1,
        vendorPayment: 1,
        batchProcessing: 1
    }

    const userInfo = useSelector((state) => state.auth.user)

    // console.log(roleDetails)
    // No role flags (an old session, a failed sign-in) means Home only, never the built-in list above
    roleDetails = userInfo.roleDetails && typeof userInfo.roleDetails === 'object' ? userInfo.roleDetails : { home: 1 }
    return (
        <Routes>
            <Route path="/" element={<ProtectedRoute />}>
                <Route
                    path="/"
                    element={<Navigate replace to={authenticatedEntryPath} />}
                />
                {protectedRoutes.map((route, index) => (
                    <Route
                        key={route.key + index}
                        path={route.path}
                        element={
                            allowedRoute(route, roleDetails) ? (
                                <AuthorityGuard
                                    userAuthority={userAuthority}
                                    authority={route.authority}
                                >
                                    <PageContainer {...props} {...route.meta}>
                                        <PageErrorBoundary key={route.key}>
                                            <AppRoute
                                                routeKey={route.key}
                                                component={route.component}
                                                {...route.meta}
                                            />
                                        </PageErrorBoundary>
                                    </PageContainer>
                                </AuthorityGuard>
                            ) : (
                                <PageContainer {...props}>
                                    <NoAccessPage />
                                </PageContainer>
                            )
                        }
                    />
                ))}
                <Route path="*" element={<PageContainer {...props}><NotFoundPage /></PageContainer>} />
            </Route>
            <Route path="/" element={<PublicRoute />}>
                {publicRoutes.map((route) => (
                    <Route
                        key={route.path}
                        path={route.path}
                        element={
                            <AppRoute
                                routeKey={route.key}
                                component={route.component}
                                {...route.meta}
                            />
                        }
                    />
                ))}
            </Route>
        </Routes>
    )
}

const Views = (props) => {
    return (
        <Suspense fallback={<Loading loading={true} />}>
            <AllRoutes {...props} />
        </Suspense>
    )
}

export default Views
