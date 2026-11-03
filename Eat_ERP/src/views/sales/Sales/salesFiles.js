import appConfig from 'configs/app.config'

// Sales documents: new uploads are stored as 'sales/<file>' on the Node server;
// older ones were saved by the PHP app (bare file names or 'uploads/...' paths) and still live there.
const PHP_BASE_URL = 'https://erp.eatanytime.in/eat_erp/'

export const deliveryProofUrl = (value) => (
    value && value.toString().startsWith('sales/')
        ? appConfig.uploadUrl + value
        : `${PHP_BASE_URL}assets/uploads/delivery_proof/${value}`
)

export const dispatchProofUrl = (value) => (
    value && value.toString().startsWith('sales/')
        ? appConfig.uploadUrl + value
        : `${PHP_BASE_URL}assets/uploads/dispatch_proof/${value}`
)

// Sales store 'sales/...', Sample / Expiry 'sample_out/...'; PHP stored 'uploads/...'
export const receivableDocUrl = (value) => (
    value && /^(sales|sample_out)\//.test(value.toString()) ? appConfig.uploadUrl + value : PHP_BASE_URL + value
)

// Printouts come back as HTML (old PHP printed from the browser too). The window is opened before the
// request so popup blockers allow it; it is closed again if the request fails.
export const openPrintout = (request, onError) => {
    const win = window.open('', '_blank')
    if (win) {
        win.document.write('<p style="font-family:sans-serif">Loading...</p>')
    }
    request()
        .then((res) => {
            if (!win) return
            win.document.open()
            win.document.write(res.data['html'])
            win.document.close()
        })
        .catch((error) => {
            if (win) win.close()
            onError(error)
        })
}
