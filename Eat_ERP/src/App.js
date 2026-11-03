import React from 'react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { PersistGate } from 'redux-persist/integration/react'
import store, { persistor } from './store'
import Theme from 'components/template/Theme'
import Layout from 'components/layout'
import SessionBoot from 'components/route/SessionBoot'
import history from './history'
import mockServer from './mock'
import appConfig from 'configs/app.config'
import './locales'
import { notifiedStatus, showError } from 'utils/apiError'

const environment = process.env.NODE_ENV

/**
 * Set enableMock(Default false) to true at configs/app.config.js
 * If you wish to enable mock api
 */
if (environment !== 'production' && appConfig.enableMock) {
    mockServer({ environment })
}

// A request no screen caught (no .catch) still tells the user why it failed. BaseService has already shown the
// failures it reports itself; the rest (validation, business rules) are shown here.
window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason
    if (!error || !error.isAxiosError || !error.response) return
    if (notifiedStatus(error.response.status) || error.response.status === 403) return
    if (error.response.data && error.response.data.message) showError(error.response.data.message)
})

function App() {
    return (
        <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
                <BrowserRouter history={history} basename='/erp'>
                    <Theme>
                        <SessionBoot>
                            <Layout />
                        </SessionBoot>
                    </Theme>
                </BrowserRouter>
            </PersistGate>
        </Provider>
    )
}

export default App
