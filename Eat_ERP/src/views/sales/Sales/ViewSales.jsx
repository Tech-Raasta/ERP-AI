import React, { useState, useEffect } from 'react'
import { AdaptableCard } from 'components/shared'
import Loading from 'components/shared/Loading'
import StickyFooter from 'components/shared/StickyFooter'
import Button from 'components/ui/Buttons'
import Table from 'components/ui/Table'
import NumberFormat from 'react-number-format'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Dialog from 'components/ui/Dialog'
import DatePicker from 'components/ui/DatePicker'
import { FormItem } from 'components/ui'
import {
    apiSalesApprove,
    apiSalesDelivery,
    apiSalesGatePass,
    apiSalesGetSingle,
    apiSalesInvoice,
    apiSalesReject,
} from 'services/SalesService'
import { formatDate, distributorLabel } from './Sales'
import { deliveryProofUrl, dispatchProofUrl, openPrintout, receivableDocUrl } from './salesFiles'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

const { Tr, Th, Td, THead, TBody } = Table

// Sales view (old PHP distributor_out_details, read-only). Edit opens the form (or its pending change);
// approvers approve / reject entries waiting for approval here. Phase 4: print invoice / gate pass,
// issue the gate pass and record the delivery (old PHP list actions on Delivery Pending / GP Issued).

const DELIVERY_OPTIONS = [
    { value: 'Delivered Not Complete', label: 'Delivered' },
    { value: 'Pending', label: 'Return To HO' },
]
const pad = (value) => (value < 10 ? `0${value}` : `${value}`)
const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const Amount = ({ value }) => (
    <NumberFormat
        value={value || 0}
        displayType="text"
        thousandSeparator
        decimalScale={2}
        fixedDecimalScale
    />
)

const Field = ({ label, children }) => (
    <div className="mb-3">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-semibold text-gray-800 dark:text-gray-100 break-words">
            {children === null || children === undefined || children === '' ? '-' : children}
        </div>
    </div>
)

const ViewSales = () => {
    const { saleid } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [sale, setSale] = useState(null)
    const [items, setItems] = useState([])
    const [pendingEditId, setPendingEditId] = useState(null)
    const [permissions, setPermissions] = useState({ submit: false })
    const [remarks, setRemarks] = useState('')
    const [remarksError, setRemarksError] = useState('')
    const [working, setWorking] = useState('')
    const [action, setAction] = useState({})
    const [deliveryOpen, setDeliveryOpen] = useState(false)
    const [delivery, setDelivery] = useState({ delivery_status: '', delivery_date: '', person_receiving: '', file: null })
    const [deliveryErrors, setDeliveryErrors] = useState({})

    const notify = (message, type) => {
        toast.push(
            <Notification title={{ success: 'Success', warning: 'Notice' }[type] || 'Error'} type={type} closable>
                {message}
            </Notification>
        )
    }

    // Old PHP Approve / Reject buttons on the sale form; reject needs remarks
    const authorise = (action) => {
        if (action === 'reject' && !remarks.trim()) {
            setRemarksError('Remarks is required to reject')
            return
        }
        setRemarksError('')
        setWorking(action)
        const request = action === 'approve' ? apiSalesApprove(sale.id, remarks) : apiSalesReject(sale.id, remarks)
        request
            .then((res) => {
                notify(res.data['message'], 'success')
                if (res.data['warning']) {
                    notify(res.data['warning'], 'warning')
                }
                navigate('/transaction/sales')
            })
            .catch((error) => {
                setWorking('')
                if (!error || !error.response) return
                const errors = error.response.data && error.response.data.error && error.response.data.error.errors
                if (errors && errors.remarks) {
                    setRemarksError(errors.remarks.message)
                }
                notify(errors ? Object.values(errors).map((item) => item.message).join(', ') : error.response.data['message'], 'danger')
            })
    }

    const showRequestError = (error) => {
        if (!error || !error.response) return
        const errors = error.response.data && error.response.data.error && error.response.data.error.errors
        notify(errors ? Object.values(errors).map((item) => item.message).join(', ') : error.response.data['message'], 'danger')
    }

    // Old PHP GP Issued popup: Delivered needs the delivery date and the proof of delivery
    const saveDelivery = () => {
        const errors = {}
        if (!delivery.delivery_status) errors.delivery_status = 'Delivery Status is required'
        if (delivery.delivery_status === 'Delivered Not Complete') {
            if (!delivery.delivery_date) errors.delivery_date = 'Delivery Date is required'
            if (!delivery.file) errors.file = 'Proof of Delivery is required'
        }
        setDeliveryErrors(errors)
        if (Object.keys(errors).length) return

        const formData = new FormData()
        formData.append('delivery_status', delivery.delivery_status)
        formData.append('delivery_date', delivery.delivery_date)
        formData.append('person_receiving', delivery.person_receiving)
        if (delivery.file) formData.append('proof_of_delivery', delivery.file)
        setWorking('delivery')
        apiSalesDelivery(sale.id, formData)
            .then((res) => {
                notify(res.data['message'], 'success')
                navigate('/transaction/sales')
            })
            .catch((error) => {
                setWorking('')
                showRequestError(error)
            })
    }

    useEffect(() => {
        setLoading(true)
        apiSalesGetSingle(saleid).then((res) => {
            if (res.data) {
                setSale(res.data.sale)
                setItems(res.data.items || [])
                setPendingEditId(res.data.pendingEditId)
                setPermissions(res.data.permissions || { submit: false })
                setAction(res.data.action || {})
                setRemarks(res.data.sale && res.data.sale.remarks ? res.data.sale.remarks : '')
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error && error.response) {
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {error.response.data['message']}
                    </Notification>
                )
            }
        })
    }, [saleid])

    const approved = sale && sale.status === 'Approved'
    const canPrintInvoice = approved && !!sale.invoice_no
    const canIssueGatePass = approved && sale.delivery_status === 'Pending' && action.update
    const canUpdateDelivery = approved && sale.delivery_status === 'GP Issued' && action.update

    const igst = sale && sale.depot_state && sale.state
        && sale.depot_state.toString().trim().toUpperCase() !== sale.state.toString().trim().toUpperCase()

    return (
        <Loading loading={loading}>
            {sale ? (
                <>
                    <AdaptableCard className="card-shadow mb-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3>Sales {sale.invoice_no ? `- ${sale.invoice_no}` : ''}</h3>
                            <span className="font-semibold">
                                {sale.status}{sale.delivery_status ? ` / ${sale.delivery_status}` : ''}
                            </span>
                        </div>
                        {permissions.poMessage ? (
                            <div className="mb-4 p-3 rounded bg-red-50 text-red-600 dark:bg-gray-700 dark:text-red-400">
                                Note : {permissions.poMessage}
                            </div>
                        ) : null}
                        {pendingEditId && +pendingEditId !== +sale.id ? (
                            <div className="mb-4 p-3 rounded bg-amber-50 text-amber-700 dark:bg-gray-700 dark:text-amber-300">
                                An edit of this sale is pending for approval.{' '}
                                <Link className="underline" to={`/transaction/sales/view/${pendingEditId}`}>
                                    View pending copy
                                </Link>
                            </div>
                        ) : null}
                        {sale.ref_id ? (
                            <div className="mb-4 p-3 rounded bg-indigo-50 text-indigo-700 dark:bg-gray-700 dark:text-indigo-300">
                                This is a pending edit of{' '}
                                <Link className="underline" to={`/transaction/sales/view/${sale.ref_id}`}>
                                    sale #{sale.ref_id}
                                </Link>
                            </div>
                        ) : null}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6">
                            <Field label="Date Of Processing">{formatDate(sale.date_of_processing)}</Field>
                            <Field label="Depot">{sale.depot_name}</Field>
                            <Field label="Distributor">{distributorLabel(sale)}</Field>
                            <Field label="Sales Representative">{sale.sales_rep_name}</Field>
                            <Field label="Invoice No">{sale.invoice_no}</Field>
                            <Field label="Invoice Date">{formatDate(sale.invoice_date)}</Field>
                            <Field label="Voucher No">{sale.voucher_no}</Field>
                            <Field label="Gate Pass No">{sale.gate_pass_no}</Field>
                            <Field label="PO No">{sale.order_no}</Field>
                            <Field label="PO Date">{formatDate(sale.order_date)}</Field>
                            <Field label="Due Date">{formatDate(sale.due_date)}</Field>
                            <Field label="Basis Of Sales">{sale.basis_of_sales}</Field>
                            <Field label="Location">{sale.location}</Field>
                            <Field label="State">{sale.state}</Field>
                            <Field label="GSTIN">{sale.gstin}</Field>
                            <Field label="Tracking Id">{sale.tracking_id}</Field>
                            <Field label="Address">{sale.address}</Field>
                            <Field label="Shipping Address">{sale.shipping_address}</Field>
                            <Field label="Transport Type">{sale.transport_type}</Field>
                            <Field label="Vehicle Number">{sale.vehicle_number}</Field>
                            <Field label="Despatch Through">{sale.despatch_through}</Field>
                            <Field label="Despatch Doc No">{sale.despatch_doc_no}</Field>
                            <Field label="Destination">{sale.destination}</Field>
                            <Field label="Delivery Person">{sale.delivery_person}</Field>
                            <Field label="Gate Pass Date">{formatDate(sale.gatepass_date)}</Field>
                            <Field label="Date Of Dispatch">{formatDate(sale.date_of_dispatch)}</Field>
                            <Field label="Proof Of Dispatch">
                                {sale.proof_of_dispatch ? (
                                    <a href={dispatchProofUrl(sale.proof_of_dispatch)} target="_blank" rel="noreferrer" className="text-indigo-600">
                                        View
                                    </a>
                                ) : null}
                            </Field>
                            <Field label="Delivery Date">{formatDate(sale.delivery_date)}</Field>
                            <Field label="Person Receiving">{sale.person_receiving}</Field>
                            <Field label="Receivable Document">
                                {sale.receivable_doc ? (
                                    <a
                                        href={receivableDocUrl(sale.receivable_doc)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-indigo-600"
                                    >
                                        Download
                                    </a>
                                ) : null}
                            </Field>
                            <Field label="Proof Of Delivery">
                                {sale.proof_of_delivery ? (
                                    <a
                                        href={deliveryProofUrl(sale.proof_of_delivery)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-indigo-600"
                                    >
                                        View
                                    </a>
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
                                        <Th className="text-right">Sell Rate</Th>
                                        <Th className="text-right">Grams</Th>
                                        <Th className="text-right">Rate</Th>
                                        <Th className="text-right">Amount</Th>
                                        <Th className="text-right">Disc %</Th>
                                        <Th className="text-right">Disc Amt</Th>
                                        {igst ? (
                                            <Th className="text-right">IGST Amt</Th>
                                        ) : (
                                            <>
                                                <Th className="text-right">CGST Amt</Th>
                                                <Th className="text-right">SGST Amt</Th>
                                            </>
                                        )}
                                        <Th className="text-right">Tax Amt</Th>
                                        <Th className="text-right">Total Amt</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {items.length === 0 ? (
                                        <Tr>
                                            <Td colSpan={igst ? 12 : 13} className="text-center">No items</Td>
                                        </Tr>
                                    ) : items.map((item) => (
                                        <Tr key={item.id}>
                                            <Td>{item.type}</Td>
                                            <Td>{item.item_name}</Td>
                                            <Td className="text-right">{item.qty}</Td>
                                            <Td className="text-right"><Amount value={item.sell_rate} /></Td>
                                            <Td className="text-right">{item.grams}</Td>
                                            <Td className="text-right"><Amount value={item.rate} /></Td>
                                            <Td className="text-right"><Amount value={item.amount} /></Td>
                                            <Td className="text-right">{item.discount}</Td>
                                            <Td className="text-right"><Amount value={item.discount_amt} /></Td>
                                            {igst ? (
                                                <Td className="text-right"><Amount value={item.igst_amt} /></Td>
                                            ) : (
                                                <>
                                                    <Td className="text-right"><Amount value={item.cgst_amt} /></Td>
                                                    <Td className="text-right"><Amount value={item.sgst_amt} /></Td>
                                                </>
                                            )}
                                            <Td className="text-right"><Amount value={item.tax_amt} /></Td>
                                            <Td className="text-right"><Amount value={item.total_amt} /></Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        </div>

                        <div className="flex justify-end mt-4">
                            <div className="w-full md:w-1/3">
                                <div className="flex justify-between py-1"><span>Amount</span><Amount value={sale.amount} /></div>
                                <div className="flex justify-between py-1"><span>Discount</span><Amount value={sale.discount} /></div>
                                {igst ? (
                                    <div className="flex justify-between py-1"><span>IGST</span><Amount value={sale.igst_amount} /></div>
                                ) : (
                                    <>
                                        <div className="flex justify-between py-1"><span>CGST</span><Amount value={sale.cgst_amount} /></div>
                                        <div className="flex justify-between py-1"><span>SGST</span><Amount value={sale.sgst_amount} /></div>
                                    </>
                                )}
                                <div className="flex justify-between py-1"><span>Tax Amount</span><Amount value={sale.tax_amount} /></div>
                                <div className="flex justify-between py-1"><span>Shipping Charges</span><Amount value={sale.shipping_charges} /></div>
                                <div className="flex justify-between py-1"><span>Round Off</span><Amount value={sale.round_off_amount} /></div>
                                <div className="flex justify-between py-1 font-bold border-t"><span>Invoice Amount</span><Amount value={sale.invoice_amount} /></div>
                            </div>
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
                                    {sale.ref_id ? ` (sale #${sale.ref_id} will be cancelled)` : ''}
                                </div>
                            ) : null}
                            {sale.ref_id && sale.status !== 'Deleted' ? (
                                <div className="mb-3 text-gray-600 dark:text-gray-300">
                                    Approving replaces{' '}
                                    <Link className="underline" to={`/transaction/sales/view/${sale.ref_id}`}>sale #{sale.ref_id}</Link>
                                    {' '}with this entry.
                                </div>
                            ) : null}
                            <div className="text-xs text-gray-500 mb-1">Remarks (required to reject)</div>
                            <Input
                                textArea
                                value={remarks}
                                invalid={!!remarksError}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Remarks"
                            />
                            {remarksError ? <div className="text-red-500 text-sm mt-1">{remarksError}</div> : null}
                        </AdaptableCard>
                    ) : null}
                </>
            ) : (
                !loading && <AdaptableCard className="card-shadow">Sale not found.</AdaptableCard>
            )}
            <StickyFooter
                className="-mx-8 px-8 flex items-center justify-end py-4"
                stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
            >
                <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => navigate('/transaction/sales')}>
                    Back
                </Button>
                {canPrintInvoice ? (
                    <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => openPrintout(() => apiSalesInvoice(sale.id), showRequestError)}>
                        Print Invoice
                    </Button>
                ) : null}
                {sale && sale.gate_pass_no ? (
                    <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => openPrintout(() => apiSalesGatePass(sale.id), showRequestError)}>
                        Print Gate Pass
                    </Button>
                ) : null}
                {canIssueGatePass ? (
                    <Button size="sm" className="ltr:mr-3 rtl:ml-3" variant="solid" type="button" onClick={() => navigate(`/transaction/sales/dispatch/${sale.id}`)}>
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
                            setDelivery({ delivery_status: '', delivery_date: '', person_receiving: '', file: null })
                            setDeliveryErrors({})
                            setDeliveryOpen(true)
                        }}
                    >
                        Update Delivery
                    </Button>
                ) : null}
                {sale && (permissions.submit || (pendingEditId && +pendingEditId !== +sale.id)) ? (
                    <Button
                        size="sm"
                        variant="solid"
                        type="button"
                        onClick={() => navigate(`/transaction/sales/edit-sales/${pendingEditId || sale.id}`)}
                    >
                        {pendingEditId && +pendingEditId !== +sale.id ? 'Edit Pending Change' : 'Edit'}
                    </Button>
                ) : null}
                {sale && permissions.approve ? (
                    <>
                        <Button
                            size="sm"
                            className="ltr:ml-3 rtl:mr-3"
                            variant="solid"
                            color="red-600"
                            type="button"
                            loading={working === 'reject'}
                            disabled={!!working}
                            onClick={() => authorise('reject')}
                        >
                            Reject
                        </Button>
                        <Button
                            size="sm"
                            className="ltr:ml-3 rtl:mr-3"
                            variant="solid"
                            color="emerald-600"
                            type="button"
                            loading={working === 'approve'}
                            disabled={!!working}
                            onClick={() => authorise('approve')}
                        >
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
                <FormItem asterisk label="Delivery Status" invalid={!!deliveryErrors.delivery_status} errorMessage={deliveryErrors.delivery_status}>
                    <Select
                        options={DELIVERY_OPTIONS}
                        value={DELIVERY_OPTIONS.filter((option) => option.value === delivery.delivery_status)}
                        menuPortalTarget={document.body}
                        style={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        onChange={(option) => setDelivery({ ...delivery, delivery_status: option ? option.value : '' })}
                    />
                </FormItem>
                {delivery.delivery_status === 'Delivered Not Complete' ? (
                    <>
                        <FormItem asterisk label="Delivery Date" invalid={!!deliveryErrors.delivery_date} errorMessage={deliveryErrors.delivery_date}>
                            <DatePicker
                                inputFormat="DD/MM/YYYY"
                                maxDate={new Date()}
                                value={delivery.delivery_date ? new Date(`${delivery.delivery_date}T00:00:00`) : null}
                                onChange={(date) => setDelivery({ ...delivery, delivery_date: date ? toDateString(new Date(date)) : '' })}
                            />
                        </FormItem>
                        <FormItem label="Person Receiving">
                            <Input
                                value={delivery.person_receiving}
                                placeholder="Person Receiving"
                                onChange={(e) => setDelivery({ ...delivery, person_receiving: e.target.value })}
                            />
                        </FormItem>
                        <FormItem asterisk label="Proof of Delivery" invalid={!!deliveryErrors.file} errorMessage={deliveryErrors.file}>
                            <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                                className="text-sm"
                                onChange={(e) => setDelivery({ ...delivery, file: e.target.files && e.target.files[0] ? e.target.files[0] : null })}
                            />
                        </FormItem>
                    </>
                ) : null}
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

export default ViewSales
