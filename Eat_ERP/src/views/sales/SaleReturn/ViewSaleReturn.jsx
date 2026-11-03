import React, { useState, useEffect } from 'react'
import { AdaptableCard } from 'components/shared'
import Loading from 'components/shared/Loading'
import StickyFooter from 'components/shared/StickyFooter'
import Button from 'components/ui/Buttons'
import Table from 'components/ui/Table'
import Input from 'components/ui/Input'
import NumberFormat from 'react-number-format'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiSalesReturnApprove, apiSalesReturnGetSingle, apiSalesReturnReceipt, apiSalesReturnReject } from 'services/SalesReturnService'
import { formatDate } from '../Sales/Sales'
import { openPrintout } from '../Sales/salesFiles'

const { Tr, Th, Td, THead, TBody } = Table

// Sales Return view (old PHP distributor_in_details read-only, approve / reject, receipt).

const Amount = ({ value }) => <NumberFormat value={value || 0} displayType="text" thousandSeparator decimalScale={2} fixedDecimalScale />

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

// Return lines store cgst_amt / tax_amt / total_amt; exchange lines cgst_amount / tax_amount / total_amount
const LinesTable = ({ title, items, amountKeys }) => {
    const sum = (key) => items.reduce((total, item) => total + (+item[key] || 0), 0)
    return (
        <AdaptableCard className="card-shadow mb-4">
            <h5 className="mb-4">{title}</h5>
            <div className="overflow-x-auto">
                <Table compact className="border">
                    <THead>
                        <Tr>
                            <Th>Type</Th>
                            <Th>Item</Th>
                            <Th className="text-right">Qty</Th>
                            <Th className="text-right">Rate (In Rs)</Th>
                            <Th className="text-right">Sell Rate (In Rs)</Th>
                            <Th className="text-right">Amount (In Rs)</Th>
                            <Th className="text-right">CGST (In Rs)</Th>
                            <Th className="text-right">SGST (In Rs)</Th>
                            <Th className="text-right">IGST (In Rs)</Th>
                            <Th className="text-right">Tax (In Rs)</Th>
                            <Th className="text-right">Total Amount (In Rs)</Th>
                            <Th>Batch</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {items.length === 0 ? (
                            <Tr><Td colSpan={12} className="text-center">No items</Td></Tr>
                        ) : items.map((item) => (
                            <Tr key={item.id}>
                                <Td>{item.type}</Td>
                                <Td>{item.item_name}</Td>
                                <Td className="text-right">{item.qty}</Td>
                                <Td className="text-right"><Amount value={item.rate} /></Td>
                                <Td className="text-right"><Amount value={item.sell_rate} /></Td>
                                <Td className="text-right"><Amount value={item.amount} /></Td>
                                <Td className="text-right"><Amount value={item[amountKeys.cgst]} /></Td>
                                <Td className="text-right"><Amount value={item[amountKeys.sgst]} /></Td>
                                <Td className="text-right"><Amount value={item[amountKeys.igst]} /></Td>
                                <Td className="text-right"><Amount value={item[amountKeys.tax]} /></Td>
                                <Td className="text-right"><Amount value={item[amountKeys.total]} /></Td>
                                <Td>{item.batch_name}</Td>
                            </Tr>
                        ))}
                        {items.length ? (
                            <Tr className="font-semibold">
                                <Td colSpan={5} className="text-right">Total</Td>
                                <Td className="text-right"><Amount value={sum('amount')} /></Td>
                                <Td className="text-right"><Amount value={sum(amountKeys.cgst)} /></Td>
                                <Td className="text-right"><Amount value={sum(amountKeys.sgst)} /></Td>
                                <Td className="text-right"><Amount value={sum(amountKeys.igst)} /></Td>
                                <Td className="text-right"><Amount value={sum(amountKeys.tax)} /></Td>
                                <Td className="text-right"><Amount value={sum(amountKeys.total)} /></Td>
                                <Td></Td>
                            </Tr>
                        ) : null}
                    </TBody>
                </Table>
            </div>
        </AdaptableCard>
    )
}

const RETURN_KEYS = { cgst: 'cgst_amt', sgst: 'sgst_amt', igst: 'igst_amt', tax: 'tax_amt', total: 'total_amt' }
const EXCHANGE_KEYS = { cgst: 'cgst_amount', sgst: 'sgst_amount', igst: 'igst_amount', tax: 'tax_amount', total: 'total_amount' }

const ViewSaleReturn = () => {
    const { returnid } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [record, setRecord] = useState(null)
    const [items, setItems] = useState([])
    const [exchangeItems, setExchangeItems] = useState([])
    const [linked, setLinked] = useState([])
    const [pendingEditId, setPendingEditId] = useState(null)
    const [permissions, setPermissions] = useState({ submit: false })
    const [remarks, setRemarks] = useState('')
    const [remarksError, setRemarksError] = useState('')
    const [working, setWorking] = useState('')

    const showRequestError = (error) => {
        if (!error || !error.response) return
        const errors = error.response.data && error.response.data.error && error.response.data.error.errors
        notify(errors ? Object.values(errors).map((item) => item.message).join(', ') : error.response.data['message'], 'danger')
    }

    useEffect(() => {
        setLoading(true)
        apiSalesReturnGetSingle(returnid)
            .then((res) => {
                setRecord(res.data.salesReturn)
                setItems(res.data.items || [])
                setExchangeItems(res.data.exchangeItems || [])
                setLinked(res.data.linked || [])
                setPendingEditId(res.data.pendingEditId)
                setPermissions(res.data.permissions || { submit: false })
                setRemarks(res.data.salesReturn && res.data.salesReturn.remarks ? res.data.salesReturn.remarks : '')
            })
            .catch(showRequestError)
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [returnid])

    // Old PHP printed the receipt right after approval; the window is opened on the click so it is not blocked
    const authorise = (kind) => {
        if (kind === 'reject' && !remarks.trim()) {
            setRemarksError('Remarks is required to reject')
            return
        }
        setRemarksError('')
        setWorking(kind)
        const printWindow = kind === 'approve' ? window.open('', '_blank') : null
        const request = kind === 'approve' ? apiSalesReturnApprove(record.id, remarks) : apiSalesReturnReject(record.id, remarks)
        request
            .then((res) => {
                notify(res.data['message'], 'success')
                if (res.data['warning']) notify(res.data['warning'], 'warning')
                if (printWindow) {
                    if (res.data['print']) {
                        apiSalesReturnReceipt(res.data['id'])
                            .then((receipt) => {
                                printWindow.document.open()
                                printWindow.document.write(receipt.data['html'])
                                printWindow.document.close()
                            })
                            .catch(() => printWindow.close())
                    } else {
                        printWindow.close()
                    }
                }
                navigate('/transaction/sales-return')
            })
            .catch((error) => {
                if (printWindow) printWindow.close()
                setWorking('')
                const errors = error && error.response && error.response.data && error.response.data.error && error.response.data.error.errors
                if (errors && errors.remarks) setRemarksError(errors.remarks.message)
                showRequestError(error)
            })
    }

    const hasPendingCopy = record && pendingEditId && +pendingEditId !== +record.id
    const expiredEntry = linked.find((row) => row.distributor_in_type === 'expired')
    const exchangeEntry = linked.find((row) => row.distributor_in_type === 'exchanged')

    return (
        <Loading loading={loading}>
            {record ? (
                <>
                    <AdaptableCard className="card-shadow mb-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3>Sales Return {record.sales_return_no ? `- ${record.sales_return_no}` : ''}</h3>
                            <span className="font-semibold">{record.status}</span>
                        </div>
                        {hasPendingCopy ? (
                            <div className="mb-4 p-3 rounded bg-amber-50 text-amber-700 dark:bg-gray-700 dark:text-amber-300">
                                A change to this return is pending for approval.{' '}
                                <Link className="underline" to={`/transaction/sales-return/view/${pendingEditId}`}>View pending copy</Link>
                            </div>
                        ) : null}
                        {record.ref_id ? (
                            <div className="mb-4 p-3 rounded bg-indigo-50 text-indigo-700 dark:bg-gray-700 dark:text-indigo-300">
                                {record.status === 'Deleted' ? 'This is a delete request for ' : 'This is a pending change of '}
                                <Link className="underline" to={`/transaction/sales-return/view/${record.ref_id}`}>return #{record.ref_id}</Link>
                            </div>
                        ) : null}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6">
                            <Field label="Date Of Processing">{formatDate(record.date_of_processing)}</Field>
                            <Field label="Distributor">{record.distributor_name}</Field>
                            <Field label="Depot">{record.depot_name}</Field>
                            <Field label="Sales Representative">{record.sales_rep_name}</Field>
                            <Field label="Sales Type">{record.sales_type}</Field>
                            <Field label="Invoice No.">{record.sales_type === 'Invoice' ? record.invoice_nos : ''}</Field>
                            <Field label="Order No">{record.order_no}</Field>
                            <Field label="Discount (%)">{record.discount}</Field>
                            <Field label="Billing State">{record.state}</Field>
                            <Field label="Stock Expired?">{record.is_expired === 'yes' ? 'Yes' : 'No'}</Field>
                            <Field label="Exchange?">{record.is_exchanged === 'yes' ? 'Yes' : 'No'}</Field>
                            <Field label="Due Date">{formatDate(record.due_date)}</Field>
                            <Field label="Sales Return Date">{formatDate(record.sales_return_date)}</Field>
                            {expiredEntry ? (
                                <Field label="Expiry write-off">
                                    {expiredEntry.voucher_no || 'Voucher on approval'} ({expiredEntry.status}) - <Amount value={expiredEntry.final_amount} />
                                </Field>
                            ) : null}
                            {exchangeEntry ? (
                                <Field label="Exchange sale">
                                    <Link className="text-indigo-600" to={`/transaction/sales/view/${exchangeEntry.id}`}>#{exchangeEntry.id}</Link>
                                    {' '}({exchangeEntry.status}{exchangeEntry.delivery_status ? ` / ${exchangeEntry.delivery_status}` : ''})
                                </Field>
                            ) : null}
                        </div>
                    </AdaptableCard>

                    <LinesTable title="Stock In" items={items} amountKeys={RETURN_KEYS} />
                    {record.is_exchanged === 'yes' ? (
                        <LinesTable title="Stock Out (Exchange)" items={exchangeItems} amountKeys={EXCHANGE_KEYS} />
                    ) : null}

                    <AdaptableCard className="card-shadow mb-4">
                        <h5 className="mb-4">Amounts</h5>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6">
                            <Field label="Taxable Amount (In Rs)"><Amount value={record.amount} /></Field>
                            <Field label="CGST (In Rs)"><Amount value={record.cgst_amount} /></Field>
                            <Field label="SGST (In Rs)"><Amount value={record.sgst_amount} /></Field>
                            <Field label="IGST (In Rs)"><Amount value={record.igst_amount} /></Field>
                            <Field label="Tax Amount (In Rs)"><Amount value={record.tax_amount} /></Field>
                            <Field label="Round Off"><Amount value={record.round_off_amount} /></Field>
                            <Field label="Return Amount (In Rs)"><Amount value={record.final_amount} /></Field>
                            <Field label="Cost Amount (In Rs)"><Amount value={record.final_cost_amount} /></Field>
                            {record.is_exchanged === 'yes' ? (
                                <Field label="Exchange Amount (In Rs)">
                                    <Amount value={exchangeItems.reduce((sum, item) => sum + (+item.total_amount || 0), 0)} />
                                </Field>
                            ) : null}
                            <Field label="Credit / Debit Note">{record.credit_debit_note_id ? record.credit_debit_note : ''}</Field>
                        </div>
                    </AdaptableCard>

                    <AdaptableCard className="card-shadow mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6">
                            <Field label="Remarks">{record.remarks}</Field>
                            <Field label="Created By">{record.created_by_name && record.created_by_name.trim()}</Field>
                            <Field label="Created On">{formatDate(record.created_on)}</Field>
                            <Field label="Modified By">{record.modified_by_name && record.modified_by_name.trim()}</Field>
                            <Field label="Modified On">{formatDate(record.modified_on)}</Field>
                            <Field label="Approved By">{record.approved_by_name && record.approved_by_name.trim()}</Field>
                            <Field label="Approved On">{formatDate(record.approved_on)}</Field>
                            {record.status === 'Rejected' ? (
                                <>
                                    <Field label="Rejected By">{record.rejected_by_name && record.rejected_by_name.trim()}</Field>
                                    <Field label="Rejected On">{formatDate(record.rejected_on)}</Field>
                                </>
                            ) : null}
                        </div>
                    </AdaptableCard>

                    {permissions.approve ? (
                        <AdaptableCard className="card-shadow mb-4">
                            <h5 className="mb-2">Authorise</h5>
                            {record.status === 'Deleted' ? (
                                <div className="mb-3 text-red-600 font-semibold">
                                    Note : If clicked on approve button this entry will be deleted permanently
                                    {record.ref_id ? ` (return #${record.ref_id} will be cancelled)` : ''}
                                </div>
                            ) : null}
                            <div className="text-xs text-gray-500 mb-1">Remarks (required to reject)</div>
                            <Input textArea value={remarks} invalid={!!remarksError} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks" />
                            {remarksError ? <div className="text-red-500 text-sm mt-1">{remarksError}</div> : null}
                        </AdaptableCard>
                    ) : null}
                </>
            ) : (
                !loading && <AdaptableCard className="card-shadow">Sales return not found.</AdaptableCard>
            )}
            <StickyFooter
                className="-mx-8 px-8 flex items-center justify-end py-4"
                stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
            >
                <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => navigate('/transaction/sales-return')}>Back</Button>
                {record ? (
                    <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => openPrintout(() => apiSalesReturnReceipt(record.id), showRequestError)}>
                        Print Receipt
                    </Button>
                ) : null}
                {record && (permissions.submit || hasPendingCopy) ? (
                    <Button
                        size="sm"
                        className="ltr:mr-3 rtl:ml-3"
                        variant="solid"
                        type="button"
                        onClick={() => navigate(`/transaction/sales-return/edit-sales-return/${pendingEditId || record.id}`)}
                    >
                        {hasPendingCopy ? 'Edit Pending Change' : 'Edit'}
                    </Button>
                ) : null}
                {record && permissions.approve ? (
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
        </Loading>
    )
}

export default ViewSaleReturn
