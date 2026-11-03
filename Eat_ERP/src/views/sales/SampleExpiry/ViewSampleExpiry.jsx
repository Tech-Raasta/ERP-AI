import React, { useState, useEffect } from 'react'
import { AdaptableCard } from 'components/shared'
import Loading from 'components/shared/Loading'
import StickyFooter from 'components/shared/StickyFooter'
import Button from 'components/ui/Buttons'
import Table from 'components/ui/Table'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Dialog from 'components/ui/Dialog'
import { FormItem } from 'components/ui'
import NumberFormat from 'react-number-format'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiSampleApprove,
    apiSampleDelivery,
    apiSampleGatePass,
    apiSampleGetSingle,
    apiSampleReject,
    apiSampleVoucher,
} from 'services/SampleExpiryService'
import { formatDate } from '../Sales/Sales'
import { openPrintout, receivableDocUrl } from '../Sales/salesFiles'

const { Tr, Th, Td, THead, TBody } = Table

// Sample / Expiry view (old PHP sample_out_details read-only, approve / reject, list delivery actions).

const DELIVERY_OPTIONS = [
    { value: 'Delivered Not Complete', label: 'Delivered' },
    { value: 'Pending', label: 'Return To HO' },
]
const STATUS_OPTIONS = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' },
]

const Amount = ({ value }) => (
    <NumberFormat value={value || 0} displayType="text" thousandSeparator decimalScale={2} fixedDecimalScale />
)

const Field = ({ label, children }) => (
    <div className="mb-3">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-semibold text-gray-800 dark:text-gray-100 break-words">
            {children === null || children === undefined || children === '' ? '-' : children}
        </div>
    </div>
)

const notify = (message, type) => {
    toast.push(
        <Notification title={{ success: 'Success', warning: 'Notice' }[type] || 'Error'} type={type} closable>
            {message}
        </Notification>
    )
}

const ViewSampleExpiry = () => {
    const { sampleid } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [sale, setSale] = useState(null)
    const [items, setItems] = useState([])
    const [pendingEditId, setPendingEditId] = useState(null)
    const [permissions, setPermissions] = useState({ submit: false })
    const [action, setAction] = useState({})
    const [remarks, setRemarks] = useState('')
    const [remarksError, setRemarksError] = useState('')
    const [working, setWorking] = useState('')
    const [deliveryOpen, setDeliveryOpen] = useState(false)
    const [delivery, setDelivery] = useState({ delivery_status: '', status: 'Approved' })
    const [deliveryError, setDeliveryError] = useState('')

    const showRequestError = (error) => {
        if (!error || !error.response) return
        const errors = error.response.data && error.response.data.error && error.response.data.error.errors
        notify(errors ? Object.values(errors).map((item) => item.message).join(', ') : error.response.data['message'], 'danger')
    }

    useEffect(() => {
        setLoading(true)
        apiSampleGetSingle(sampleid)
            .then((res) => {
                setSale(res.data.sale)
                setItems(res.data.items || [])
                setPendingEditId(res.data.pendingEditId)
                setPermissions(res.data.permissions || { submit: false })
                setAction(res.data.action || {})
                setRemarks(res.data.sale && res.data.sale.remarks ? res.data.sale.remarks : '')
            })
            .catch(showRequestError)
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sampleid])

    // Old PHP opened the voucher for printing right after approval; the window is opened on the click so it is not blocked
    const authorise = (kind) => {
        if (kind === 'reject' && !remarks.trim()) {
            setRemarksError('Remarks is required to reject')
            return
        }
        setRemarksError('')
        setWorking(kind)
        const printWindow = kind === 'approve' ? window.open('', '_blank') : null
        const request = kind === 'approve' ? apiSampleApprove(sale.id, remarks) : apiSampleReject(sale.id, remarks)
        request
            .then((res) => {
                notify(res.data['message'], 'success')
                if (printWindow) {
                    if (res.data['print']) {
                        apiSampleVoucher(res.data['id'])
                            .then((voucher) => {
                                printWindow.document.open()
                                printWindow.document.write(voucher.data['html'])
                                printWindow.document.close()
                            })
                            .catch(() => printWindow.close())
                    } else {
                        printWindow.close()
                    }
                }
                navigate('/transaction/sample-expiry')
            })
            .catch((error) => {
                if (printWindow) printWindow.close()
                setWorking('')
                const errors = error && error.response && error.response.data && error.response.data.error && error.response.data.error.errors
                if (errors && errors.remarks) setRemarksError(errors.remarks.message)
                showRequestError(error)
            })
    }

    const saveDelivery = () => {
        if (!delivery.delivery_status) {
            setDeliveryError('Delivery Status is required')
            return
        }
        setDeliveryError('')
        setWorking('delivery')
        apiSampleDelivery(sale.id, delivery)
            .then((res) => {
                notify(res.data['message'], 'success')
                navigate('/transaction/sample-expiry')
            })
            .catch((error) => {
                setWorking('')
                showRequestError(error)
            })
    }

    const approved = sale && sale.status === 'Approved'
    const canIssueGatePass = approved && sale.delivery_status === 'Pending' && action.update
    const canUpdateDelivery = approved && sale.delivery_status === 'GP Issued' && action.update
    const hasPendingCopy = sale && pendingEditId && +pendingEditId !== +sale.id
    const total = items.reduce((sum, item) => sum + (+item.amount || 0), 0)

    return (
        <Loading loading={loading}>
            {sale ? (
                <>
                    <AdaptableCard className="card-shadow mb-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3>Sample / Expiry {sale.voucher_no ? `- ${sale.voucher_no}` : ''}</h3>
                            <span className="font-semibold">{sale.status}{sale.delivery_status ? ` / ${sale.delivery_status}` : ''}</span>
                        </div>
                        {permissions.poMessage ? (
                            <div className="mb-4 p-3 rounded bg-red-50 text-red-600 dark:bg-gray-700 dark:text-red-400">Note : {permissions.poMessage}</div>
                        ) : null}
                        {hasPendingCopy ? (
                            <div className="mb-4 p-3 rounded bg-amber-50 text-amber-700 dark:bg-gray-700 dark:text-amber-300">
                                A change to this entry is pending for approval.{' '}
                                <Link className="underline" to={`/transaction/sample-expiry/view/${pendingEditId}`}>View pending copy</Link>
                            </div>
                        ) : null}
                        {sale.ref_id ? (
                            <div className="mb-4 p-3 rounded bg-indigo-50 text-indigo-700 dark:bg-gray-700 dark:text-indigo-300">
                                {sale.status === 'Deleted' ? 'This is a delete request for ' : 'This is a pending change of '}
                                <Link className="underline" to={`/transaction/sample-expiry/view/${sale.ref_id}`}>entry #{sale.ref_id}</Link>
                            </div>
                        ) : null}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6">
                            <Field label="Date Of Processing">{formatDate(sale.date_of_processing)}</Field>
                            <Field label="Depot">{sale.depot_name}</Field>
                            <Field label="Distributor">{sale.expiry ? 'Product Expired' : sale.distributor_name}</Field>
                            <Field label="Sales Representative">{sale.sales_rep_name}</Field>
                            <Field label="Expiry">{sale.expiry ? 'Yes' : 'No'}</Field>
                            <Field label="Type">{sale.sample_type}</Field>
                            {sale.sample_type === 'Gifting' ? <Field label="Gifting Remarks">{sale.gifting_remarks}</Field> : null}
                            {sale.sample_type === 'Promoter' ? <Field label="Promoter">{sale.promoter_name}</Field> : null}
                            {sale.sample_type === 'Blogger' ? (
                                <>
                                    <Field label="Blogger Name">{sale.blogger_name}</Field>
                                    <Field label="Blogger Address">{sale.blogger_address}</Field>
                                    <Field label="Blogger Phone No">{sale.blogger_phone_no}</Field>
                                    <Field label="Blogger Email Id">{sale.blogger_email_id}</Field>
                                </>
                            ) : null}
                            <Field label="Voucher No">{sale.voucher_no}</Field>
                            <Field label="Gate Pass No">{sale.gate_pass_no}</Field>
                            <Field label="Discount (%)">{sale.discount}</Field>
                            <Field label="Due Date">{formatDate(sale.due_date)}</Field>
                            <Field label="Supplier Ref">{sale.supplier_ref}</Field>
                            <Field label="Dispatch Doc No">{sale.despatch_doc_no}</Field>
                            <Field label="Dispatch Through">{sale.despatch_through}</Field>
                            <Field label="Destination">{sale.destination}</Field>
                            <Field label="Delivery Person">{sale.delivery_person}</Field>
                            <Field label="Gate Pass Date">{formatDate(sale.gatepass_date)}</Field>
                            <Field label="Delivery Date">{formatDate(sale.delivery_date)}</Field>
                            <Field label="Receivable Document">
                                {sale.receivable_doc ? (
                                    <a href={receivableDocUrl(sale.receivable_doc)} target="_blank" rel="noreferrer" className="text-indigo-600">Download</a>
                                ) : null}
                            </Field>
                        </div>
                    </AdaptableCard>

                    <AdaptableCard className="card-shadow mb-4">
                        <h5 className="mb-4">Items</h5>
                        <div className="overflow-x-auto">
                            <Table compact className="border">
                                <THead>
                                    <Tr>
                                        <Th>Type</Th>
                                        <Th>Item</Th>
                                        <Th className="text-right">Qty</Th>
                                        <Th className="text-right">Rate</Th>
                                        <Th className="text-right">Sell Rate</Th>
                                        <Th className="text-right">Amount</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {items.length === 0 ? (
                                        <Tr><Td colSpan={6} className="text-center">No items</Td></Tr>
                                    ) : items.map((item) => (
                                        <Tr key={item.id}>
                                            <Td>{item.type}</Td>
                                            <Td>{item.item_name}</Td>
                                            <Td className="text-right">{item.qty}</Td>
                                            <Td className="text-right"><Amount value={item.rate} /></Td>
                                            <Td className="text-right"><Amount value={item.sell_rate} /></Td>
                                            <Td className="text-right"><Amount value={item.amount} /></Td>
                                        </Tr>
                                    ))}
                                    <Tr>
                                        <Td colSpan={5} className="text-right font-bold">Total</Td>
                                        <Td className="text-right font-bold"><Amount value={sale.final_amount || total} /></Td>
                                    </Tr>
                                </TBody>
                            </Table>
                        </div>
                    </AdaptableCard>

                    <AdaptableCard className="card-shadow mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6">
                            <Field label="Remarks">{sale.remarks}</Field>
                            <Field label="Modified By">{sale.modified_by_name && sale.modified_by_name.trim()}</Field>
                            <Field label="Approved By">{sale.approved_by_name && sale.approved_by_name.trim()}</Field>
                            <Field label="Approved On">{formatDate(sale.approved_on)}</Field>
                        </div>
                    </AdaptableCard>

                    {permissions.approve ? (
                        <AdaptableCard className="card-shadow mb-4">
                            <h5 className="mb-2">Authorise</h5>
                            {sale.status === 'Deleted' ? (
                                <div className="mb-3 text-red-600 font-semibold">
                                    Note : If clicked on approve button this entry will be deleted permanently
                                    {sale.ref_id ? ` (entry #${sale.ref_id} will be cancelled)` : ''}
                                </div>
                            ) : null}
                            <div className="text-xs text-gray-500 mb-1">Remarks (required to reject)</div>
                            <Input textArea value={remarks} invalid={!!remarksError} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks" />
                            {remarksError ? <div className="text-red-500 text-sm mt-1">{remarksError}</div> : null}
                        </AdaptableCard>
                    ) : null}
                </>
            ) : (
                !loading && <AdaptableCard className="card-shadow">Entry not found.</AdaptableCard>
            )}
            <StickyFooter
                className="-mx-8 px-8 flex items-center justify-end py-4"
                stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
            >
                <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => navigate('/transaction/sample-expiry')}>
                    Back
                </Button>
                {sale && sale.voucher_no ? (
                    <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => openPrintout(() => apiSampleVoucher(sale.id), showRequestError)}>
                        Print Voucher
                    </Button>
                ) : null}
                {sale && sale.delivery_sales_rep_id ? (
                    <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => openPrintout(() => apiSampleGatePass(sale.id), showRequestError)}>
                        Print Gate Pass
                    </Button>
                ) : null}
                {canIssueGatePass ? (
                    <Button size="sm" className="ltr:mr-3 rtl:ml-3" variant="solid" type="button" onClick={() => navigate(`/transaction/sample-expiry/dispatch/${sale.id}`)}>
                        Issue Gate Pass
                    </Button>
                ) : null}
                {canUpdateDelivery ? (
                    <Button
                        size="sm"
                        className="ltr:mr-3 rtl:ml-3"
                        variant="solid"
                        type="button"
                        onClick={() => {
                            setDelivery({ delivery_status: '', status: 'Approved' })
                            setDeliveryError('')
                            setDeliveryOpen(true)
                        }}
                    >
                        Update Delivery
                    </Button>
                ) : null}
                {sale && (permissions.submit || hasPendingCopy) ? (
                    <Button
                        size="sm"
                        className="ltr:mr-3 rtl:ml-3"
                        variant="solid"
                        type="button"
                        onClick={() => navigate(`/transaction/sample-expiry/edit-sample-expiry/${pendingEditId || sale.id}`)}
                    >
                        {hasPendingCopy ? 'Edit Pending Change' : 'Edit'}
                    </Button>
                ) : null}
                {sale && permissions.approve ? (
                    <>
                        <Button size="sm" className="ltr:mr-3 rtl:ml-3" variant="solid" color="red-600" type="button" loading={working === 'reject'} disabled={!!working} onClick={() => authorise('reject')}>
                            Reject
                        </Button>
                        <Button size="sm" variant="solid" color="emerald-600" type="button" loading={working === 'approve'} disabled={!!working} onClick={() => authorise('approve')}>
                            Approve
                        </Button>
                    </>
                ) : null}
            </StickyFooter>
            <Dialog
                isOpen={deliveryOpen}
                shouldCloseOnOverlayClick={false}
                onClose={() => setDeliveryOpen(false)}
                onRequestClose={() => setDeliveryOpen(false)}
                contentClassName="my-8"
            >
                <h5 className="mb-4">Select Delivery Status</h5>
                <FormItem asterisk label="Delivery Status" invalid={!!deliveryError} errorMessage={deliveryError}>
                    <Select
                        options={DELIVERY_OPTIONS}
                        value={DELIVERY_OPTIONS.filter((option) => option.value === delivery.delivery_status)}
                        menuPortalTarget={document.body}
                        style={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        onChange={(option) => setDelivery({ ...delivery, delivery_status: option ? option.value : '' })}
                    />
                </FormItem>
                <FormItem asterisk label="Status" extra={delivery.status === 'InActive' ? 'InActive cancels this entry' : null}>
                    <Select
                        options={STATUS_OPTIONS}
                        value={STATUS_OPTIONS.filter((option) => option.value === delivery.status)}
                        menuPortalTarget={document.body}
                        style={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        onChange={(option) => setDelivery({ ...delivery, status: option ? option.value : 'Approved' })}
                    />
                </FormItem>
                <div className="text-right mt-6">
                    <Button size="sm" className="ltr:mr-2 rtl:ml-2" type="button" onClick={() => setDeliveryOpen(false)}>
                        Close
                    </Button>
                    <Button size="sm" variant="solid" type="button" loading={working === 'delivery'} onClick={saveDelivery}>
                        Save
                    </Button>
                </div>
            </Dialog>
        </Loading>
    )
}

export default ViewSampleExpiry
