import React, { useEffect, useRef, useState } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import DatePicker from 'components/ui/DatePicker'
import Button from 'components/ui/Buttons'
import Loading from 'components/shared/Loading'
import StickyFooter from 'components/shared/StickyFooter'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import Table from 'components/ui/Table'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import { useNavigate, useParams } from 'react-router-dom'
import { HiMinus, HiPlus } from 'react-icons/hi'
import NumberFormat from 'react-number-format'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiPaymentApprove,
    apiPaymentDelete,
    apiPaymentDistributorDetails,
    apiPaymentGetSingle,
    apiPaymentMasterData,
    apiPaymentPost,
    apiPaymentReject,
    apiPaymentSlip,
    apiPaymentUpdate,
} from 'services/PaymentService'

const { Tr, Th, Td, THead, TBody } = Table

// Payment Details add / edit (old PHP payment_details.php). Lines per distributor and invoice (or On Account).
// Cheque needs cheque no, bank and city; NEFT the NEFT no; Cash the note denominations matching the total.
// Lines with Credit Debit = Yes become credit / debit notes when the payment is approved.

const LIST = '/transaction/payment-details'
const MODES = ['Cash', 'Cheque', 'NEFT']
const NOTES = [2000, 1000, 500, 100, 50, 20, 10]
const ON_ACCOUNT = 'On Account'

const pad = (value) => (value < 10 ? `0${value}` : `${value}`)
const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const parseDate = (value) => {
    if (!value) return null
    const [year, month, day] = value.toString().substring(0, 10).split('-').map(Number)
    return year ? new Date(year, month - 1, day) : null
}
const num = (value) => {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? 0 : parsed
}
const round2 = (value) => Math.round(value * 100) / 100
const text = (value) => (value === null || value === undefined ? '' : String(value))

const blankItem = () => ({
    distributor_id: '', invoice_no: ON_ACCOUNT, ref_no: '', bank_name: '', bank_city: '', payment_amount: '',
    credit_debit: '', tax: '', narration: '',
    // From Payment Upload; kept as they are
    settlement_id: '', settlement_start_date: '', settlement_end_date: '', commission: '', gst: '', unique_ref_no: '',
})
const blankDenomination = () => ({
    ...Object.fromEntries(NOTES.map((note) => [`denomination_${note}`, ''])),
    denomination_other: '',
    denomination_other_amount: '',
})
const initialValues = () => ({
    date_of_deposit: toDateString(new Date()),
    bank_id: '',
    payment_mode: '',
    remarks: '',
    items: [blankItem()],
    denomination: blankDenomination(),
})

const totalOf = (items) => round2(items.reduce((sum, item) => sum + num(item.payment_amount), 0))
const cashOf = (denomination) => round2(
    NOTES.reduce((sum, note) => sum + num(denomination[`denomination_${note}`]) * note, 0) + num(denomination.denomination_other_amount)
)

// Old PHP validations.js form_payment_details + check_payment_details
const validate = (record) => (values) => {
    const errors = {}
    const set = (path, message) => {
        const keys = path.split('.')
        let node = errors
        keys.slice(0, -1).forEach((key, index) => {
            const nextIsIndex = /^\d+$/.test(keys[index + 1])
            node[key] = node[key] || (nextIsIndex ? [] : {})
            node = node[key]
        })
        node[keys[keys.length - 1]] = message
    }
    if (!values.date_of_deposit) set('date_of_deposit', 'Date Of Deposit Is Required')
    else if (values.date_of_deposit > toDateString(new Date())) set('date_of_deposit', 'Date Of Deposit Cannot Be In The Future')
    if (!values.bank_id) set('bank_id', 'Bank Is Required')
    if (!values.payment_mode) set('payment_mode', 'Payment Mode Is Required')
    if (record && record.status === 'Approved' && !text(values.remarks).trim()) {
        set('remarks', 'Give The Reason For Changing This Approved Payment')
    }
    if (!values.items.length) set('items_list', 'Please add atleast one item.')
    const refLabel = values.payment_mode === 'Cheque' ? 'Cheque No' : 'NEFT No'
    values.items.forEach((item, index) => {
        const at = (field) => `items.${index}.${field}`
        if (!item.distributor_id) set(at('distributor_id'), 'Distributor Is Required')
        if (values.payment_mode && values.payment_mode !== 'Cash' && !text(item.ref_no).trim()) set(at('ref_no'), `${refLabel} Is Required`)
        if (values.payment_mode === 'Cheque') {
            if (!text(item.bank_name).trim()) set(at('bank_name'), 'Bank Name Is Required')
            if (!text(item.bank_city).trim()) set(at('bank_city'), 'Bank City Is Required')
        }
        if (text(item.payment_amount) === '') set(at('payment_amount'), 'Amount Is Required')
        else if (isNaN(Number(item.payment_amount)) || Number(item.payment_amount) === 0) set(at('payment_amount'), 'Enter A Non Zero Amount')
        if (item.credit_debit === 'Yes') {
            if (!item.tax) set(at('tax'), 'Tax Is Required')
            if (!text(item.narration).trim()) set(at('narration'), 'Narration Is Required')
        }
    })
    if (values.payment_mode === 'Cash') {
        NOTES.forEach((note) => {
            const value = values.denomination[`denomination_${note}`]
            if (text(value) !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0)) set(`denomination.denomination_${note}`, 'Whole Number')
        })
        if (cashOf(values.denomination) !== totalOf(values.items)) set('denomination_total', 'Denomination And Total Amount Are Not The Same.')
    }
    return errors
}

// Server errors stay on their field until that field changes
const fieldFeedback = (form, name, serverErrors = {}) => {
    const error = getIn(form.errors, name)
    const touch = getIn(form.touched, name)
    const server = serverErrors[name] && serverErrors[name].value === getIn(form.values, name) ? serverErrors[name].message : ''
    return {
        errorMessage: typeof error === 'string' ? error : server || '',
        invalid: (typeof touch !== 'undefined' && typeof error === 'string' && (touch || form.submitCount > 0)) || !!server,
    }
}

const SubmitErrorNotice = ({ submitCount, isValid }) => {
    useEffect(() => {
        if (submitCount > 0 && !isValid) {
            toast.push(<Notification title="Error" type="danger" closable>Please correct the highlighted fields.</Notification>)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitCount])
    return null
}

const showMessage = (message, type = 'danger') => {
    toast.push(
        <Notification title={{ success: 'Success', warning: 'Notice' }[type] || 'Error'} type={type} closable>
            {message}
        </Notification>
    )
}

const Amount = ({ value }) => <NumberFormat displayType="text" value={value || 0} thousandSeparator decimalScale={2} fixedDecimalScale />
const portal = { menuPortalTarget: document.body, style: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) } }
const yesNo = [{ value: '', label: 'Select' }, { value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]

const AddEditPayment = () => {
    const { paymentid } = useParams()
    const navigate = useNavigate()
    const formRef = useRef()
    const [loading, setLoading] = useState(true)
    const [formValues, setFormValues] = useState(initialValues())
    const [record, setRecord] = useState(null)
    const [changeOf, setChangeOf] = useState(null)
    const [permissions, setPermissions] = useState({ submit: true, delete: false, approve: false })
    const [banks, setBanks] = useState([])
    const [distributors, setDistributors] = useState([])
    // Outstanding and open invoices per distributor: { [id]: { outstanding, invoices } }
    const [details, setDetails] = useState({})
    const requested = useRef(new Set())
    const [serverErrors, setServerErrors] = useState({})
    const [busy, setBusy] = useState(false)
    const [confirm, setConfirm] = useState(null)

    const loadDetails = (distributorId, current) => {
        if (!distributorId || requested.current.has(distributorId)) return
        requested.current.add(distributorId)
        const own = current || record
        apiPaymentDistributorDetails(distributorId, own ? own.id : 0, own ? own.ref_id : 0)
            .then((res) => setDetails((prev) => ({ ...prev, [distributorId]: res.data })))
            .catch(() => requested.current.delete(distributorId))
    }

    useEffect(() => {
        const requests = [apiPaymentMasterData()]
        if (paymentid) requests.push(apiPaymentGetSingle(paymentid))
        Promise.all(requests)
            .then(([master, single]) => {
                setBanks(master.data['banks'] || [])
                setDistributors(master.data['distributors'] || [])
                if (!single) {
                    setPermissions({ submit: !!(master.data['action'] || {}).insert, delete: false, approve: false })
                    return
                }
                const { payment, items, denomination, permissions: allowed, changeOf: original } = single.data
                setRecord(payment)
                setChangeOf(original)
                setPermissions(allowed)
                const denominationValues = blankDenomination()
                if (denomination) {
                    Object.keys(denominationValues).forEach((key) => {
                        denominationValues[key] = denomination[key] === null || denomination[key] === undefined ? '' : String(denomination[key])
                    })
                }
                setFormValues({
                    date_of_deposit: payment.date_of_deposit || '',
                    bank_id: payment.bank_id || '',
                    payment_mode: payment.payment_mode || '',
                    // A change or deletion of an approved entry needs its own reason
                    remarks: payment.status === 'Approved' ? '' : text(payment.remarks),
                    items: items.length ? items.map((item) => Object.fromEntries(
                        Object.keys(blankItem()).map((key) => [key, item[key] === null || item[key] === undefined ? '' : String(item[key])])
                    )).map((item) => ({ ...item, invoice_no: item.invoice_no || ON_ACCOUNT })) : [blankItem()],
                    denomination: denominationValues,
                })
                ;[...new Set(items.map((item) => item.distributor_id).filter(Boolean))].forEach((id) => loadDetails(id, payment))
            })
            .catch((error) => showMessage(error && error.response ? error.response.data['message'] : 'Fetching payment failed'))
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentid])

    const editable = !record || permissions.submit
    const pendingApproval = record && (record.status === 'Pending' || record.status === 'Deleted')

    const handleError = (error, values) => {
        if (!error || !error.response) return
        const errors = error.response.data && error.response.data.error && error.response.data.error.errors
        if (error.response.status === 422 && errors) {
            const next = {}
            Object.keys(errors).forEach((key) => {
                next[key] = { message: errors[key]['message'], value: getIn(values, key) }
                showMessage(errors[key]['message'])
            })
            setServerErrors(next)
        } else {
            showMessage(error.response.data['message'])
        }
    }

    const onSubmit = (values, actions) => {
        setServerErrors({})
        const payload = { ...values, denomination: values.payment_mode === 'Cash' ? values.denomination : null }
        const request = record ? apiPaymentUpdate(record.id, payload) : apiPaymentPost(payload)
        request
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate(LIST)
            })
            .catch((error) => {
                actions.setSubmitting(false)
                handleError(error, values)
            })
    }

    // Approve, then print the receipt voucher (PHP printed it straight away). The window is opened on the click
    // so popup blockers allow it.
    const approve = () => {
        const remarks = formRef.current.values.remarks
        const win = window.open('', '_blank')
        if (win) win.document.write('<p style="font-family:sans-serif">Approving...</p>')
        setBusy(true)
        apiPaymentApprove(record.id, remarks)
            .then(async (res) => {
                showMessage(res.data['message'], 'success')
                if (res.data['print'] && win) {
                    const slip = await apiPaymentSlip(res.data['id'])
                    win.document.open()
                    win.document.write(slip.data['html'])
                    win.document.close()
                } else if (win) {
                    win.close()
                }
                navigate(LIST)
            })
            .catch((error) => {
                if (win) win.close()
                handleError(error, formRef.current.values)
            })
            .finally(() => setBusy(false))
    }

    const runConfirmed = () => {
        const type = confirm
        setConfirm(null)
        const values = formRef.current.values
        const request = type === 'reject' ? apiPaymentReject(record.id, values.remarks) : apiPaymentDelete(record.id, values.remarks)
        setBusy(true)
        request
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate(LIST)
            })
            .catch((error) => handleError(error, values))
            .finally(() => setBusy(false))
    }

    const bankOptions = banks.map((bank) => ({ value: bank.id, label: `${bank.b_name}${bank.b_branch ? ` - ${bank.b_branch}` : ''}` }))
    const distributorOptions = distributors.map((row) => ({ value: row.id, label: row.distributor_name }))
    const modeOptions = MODES.map((mode) => ({ value: mode, label: mode }))
    const title = !record ? 'Add Payment' : `Payment ${record.id}${record.status ? ` (${record.status})` : ''}`

    return (
        <Loading loading={loading}>
            <Formik innerRef={formRef} initialValues={formValues} enableReinitialize validate={validate(record)} onSubmit={onSubmit}>
                {({ values, errors, touched, isSubmitting, setFieldValue, submitCount, isValid }) => {
                    const form = { values, errors, touched, submitCount }
                    const fe = (name) => fieldFeedback(form, name, serverErrors)
                    const total = totalOf(values.items)
                    const cash = cashOf(values.denomination)
                    const cheque = values.payment_mode === 'Cheque'
                    const showRef = values.payment_mode && values.payment_mode !== 'Cash'
                    const refLabel = cheque ? 'Cheque No' : 'NEFT No'
                    const selectValue = (options, value) => options.filter((option) => String(option.value) === String(value))

                    return (
                        <Form>
                            <SubmitErrorNotice submitCount={submitCount} isValid={isValid} />
                            <FormContainer>
                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-2">{title}</h5>
                                    {changeOf ? (
                                        <p className="mb-4 text-amber-600">
                                            This is a {record.status === 'Deleted' ? 'deletion' : 'change'} of approved payment {changeOf}, waiting for approval.
                                        </p>
                                    ) : null}
                                    {record && record.upload_type ? (
                                        <p className="mb-4 text-gray-500">Uploaded {record.upload_type} settlement{record.neft_no ? `, NEFT ${record.neft_no}` : ''}.</p>
                                    ) : null}
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <FormItem asterisk label="Date Of Deposit" invalid={fe('date_of_deposit').invalid} errorMessage={fe('date_of_deposit').errorMessage}>
                                            <DatePicker
                                                inputFormat="DD/MM/YYYY"
                                                placeholder="Date Of Deposit"
                                                maxDate={new Date()}
                                                disabled={!editable}
                                                value={parseDate(values.date_of_deposit)}
                                                onChange={(date) => setFieldValue('date_of_deposit', date ? toDateString(new Date(date)) : '')}
                                            />
                                        </FormItem>
                                        <FormItem asterisk label="Bank" invalid={fe('bank_id').invalid} errorMessage={fe('bank_id').errorMessage}>
                                            <Select
                                                placeholder="Select"
                                                isDisabled={!editable}
                                                options={bankOptions}
                                                value={selectValue(bankOptions, values.bank_id)}
                                                onChange={(option) => setFieldValue('bank_id', option ? option.value : '')}
                                            />
                                        </FormItem>
                                        <FormItem asterisk label="Payment Mode" invalid={fe('payment_mode').invalid} errorMessage={fe('payment_mode').errorMessage}>
                                            <Select
                                                placeholder="Select"
                                                isDisabled={!editable}
                                                options={modeOptions}
                                                value={selectValue(modeOptions, values.payment_mode)}
                                                onChange={(option) => setFieldValue('payment_mode', option ? option.value : '')}
                                            />
                                        </FormItem>
                                    </div>
                                </AdaptableCard>

                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-4">Payments</h5>
                                    {typeof errors.items_list === 'string' && submitCount > 0 ? <p className="text-red-600 mb-2">{errors.items_list}</p> : null}
                                    <FieldArray name="items">
                                        {({ push, remove }) => (
                                            <div className="overflow-x-auto">
                                                <Table compact className="border">
                                                    <THead>
                                                        <Tr>
                                                            <Th style={{ minWidth: 230 }}>Distributor Name *</Th>
                                                            <Th style={{ minWidth: 110 }}>Outstanding</Th>
                                                            <Th style={{ minWidth: 230 }}>Invoice No</Th>
                                                            {showRef ? <Th style={{ minWidth: 140 }}>{refLabel} *</Th> : null}
                                                            {cheque ? <Th style={{ minWidth: 150 }}>Bank Name *</Th> : null}
                                                            {cheque ? <Th style={{ minWidth: 130 }}>Bank City *</Th> : null}
                                                            <Th style={{ minWidth: 130 }}>Amount (In Rs) *</Th>
                                                            <Th style={{ minWidth: 100 }}>Credit Debit</Th>
                                                            <Th style={{ minWidth: 100 }}>Tax</Th>
                                                            <Th style={{ minWidth: 180 }}>Narration</Th>
                                                            {editable ? <Th /> : null}
                                                        </Tr>
                                                    </THead>
                                                    <TBody>
                                                        {values.items.map((item, index) => {
                                                            const at = (field) => `items.${index}.${field}`
                                                            const info = details[item.distributor_id]
                                                            const invoices = info ? info.invoices : []
                                                            const invoiceOptions = [
                                                                { value: ON_ACCOUNT, label: ON_ACCOUNT },
                                                                ...invoices.map((invoice) => ({
                                                                    value: invoice.invoice_no,
                                                                    label: `${invoice.invoice_no} (due Rs. ${num(invoice.balance).toLocaleString('en-IN')})`,
                                                                })),
                                                            ]
                                                            if (item.invoice_no && !invoiceOptions.some((option) => option.value === item.invoice_no)) {
                                                                invoiceOptions.push({ value: item.invoice_no, label: item.invoice_no })
                                                            }
                                                            const invoice = invoices.find((row) => row.invoice_no === item.invoice_no)
                                                            const input = (field, placeholder, extra = {}) => (
                                                                <FormItem className="mb-0" invalid={fe(at(field)).invalid} errorMessage={fe(at(field)).errorMessage}>
                                                                    <Field name={at(field)} as={Input} size="sm" placeholder={placeholder} disabled={!editable} {...extra} />
                                                                </FormItem>
                                                            )
                                                            const choice = (field) => (
                                                                <FormItem className="mb-0" invalid={fe(at(field)).invalid} errorMessage={fe(at(field)).errorMessage}>
                                                                    <Select
                                                                        size="sm"
                                                                        isDisabled={!editable}
                                                                        options={yesNo}
                                                                        value={selectValue(yesNo, item[field])}
                                                                        onChange={(option) => setFieldValue(at(field), option ? option.value : '')}
                                                                        {...portal}
                                                                    />
                                                                </FormItem>
                                                            )
                                                            return (
                                                                <Tr key={index} className="align-top">
                                                                    <Td>
                                                                        <FormItem className="mb-0" invalid={fe(at('distributor_id')).invalid} errorMessage={fe(at('distributor_id')).errorMessage}>
                                                                            <Select
                                                                                size="sm"
                                                                                placeholder="Select"
                                                                                isDisabled={!editable}
                                                                                options={distributorOptions}
                                                                                value={selectValue(distributorOptions, item.distributor_id)}
                                                                                onChange={(option) => {
                                                                                    const id = option ? option.value : ''
                                                                                    setFieldValue(at('distributor_id'), id)
                                                                                    setFieldValue(at('invoice_no'), ON_ACCOUNT)
                                                                                    loadDetails(id)
                                                                                }}
                                                                                {...portal}
                                                                            />
                                                                        </FormItem>
                                                                        {item.settlement_id ? <div className="text-xs text-gray-500 mt-1">Settlement {item.settlement_id}</div> : null}
                                                                    </Td>
                                                                    <Td className="text-right">
                                                                        {item.distributor_id ? (info ? <Amount value={info.outstanding} /> : '...') : ''}
                                                                    </Td>
                                                                    <Td>
                                                                        <FormItem className="mb-0" invalid={fe(at('invoice_no')).invalid} errorMessage={fe(at('invoice_no')).errorMessage}>
                                                                            <Select
                                                                                size="sm"
                                                                                isDisabled={!editable || !item.distributor_id}
                                                                                options={invoiceOptions}
                                                                                value={selectValue(invoiceOptions, item.invoice_no)}
                                                                                onChange={(option) => setFieldValue(at('invoice_no'), option ? option.value : ON_ACCOUNT)}
                                                                                {...portal}
                                                                            />
                                                                        </FormItem>
                                                                        {invoice && invoice.client_name ? <div className="text-xs text-gray-500 mt-1">{invoice.client_name}</div> : null}
                                                                    </Td>
                                                                    {showRef ? <Td>{input('ref_no', refLabel)}</Td> : null}
                                                                    {cheque ? <Td>{input('bank_name', 'Bank Name')}</Td> : null}
                                                                    {cheque ? <Td>{input('bank_city', 'Bank City')}</Td> : null}
                                                                    <Td>{input('payment_amount', 'Amount', { type: 'number', step: '0.01', className: 'text-right' })}</Td>
                                                                    <Td>{choice('credit_debit')}</Td>
                                                                    <Td>{choice('tax')}</Td>
                                                                    <Td>{input('narration', 'Narration')}</Td>
                                                                    {editable ? (
                                                                        <Td>
                                                                            <Button
                                                                                size="xs"
                                                                                type="button"
                                                                                shape="circle"
                                                                                icon={<HiMinus />}
                                                                                disabled={values.items.length === 1}
                                                                                onClick={() => remove(index)}
                                                                            />
                                                                        </Td>
                                                                    ) : null}
                                                                </Tr>
                                                            )
                                                        })}
                                                    </TBody>
                                                </Table>
                                                <div className="flex items-center justify-between mt-3">
                                                    {editable ? (
                                                        <Button size="sm" type="button" icon={<HiPlus />} onClick={() => push({ ...blankItem() })}>Add Line</Button>
                                                    ) : <span />}
                                                    <div className="font-semibold">Total Amount: Rs. <Amount value={total} /></div>
                                                </div>
                                            </div>
                                        )}
                                    </FieldArray>
                                </AdaptableCard>

                                {values.payment_mode === 'Cash' ? (
                                    <AdaptableCard className="mb-4 card-shadow" divider>
                                        <h5 className="mb-4">Cash Denomination</h5>
                                        <div className="overflow-x-auto">
                                            <Table compact className="border">
                                                <THead>
                                                    <Tr>
                                                        {NOTES.map((note) => <Th key={note} className="text-center">{note}</Th>)}
                                                        <Th>Others</Th>
                                                        <Th>Others Amount</Th>
                                                    </Tr>
                                                </THead>
                                                <TBody>
                                                    <Tr>
                                                        {NOTES.map((note) => {
                                                            const name = `denomination.denomination_${note}`
                                                            return (
                                                                <Td key={note} style={{ minWidth: 80 }}>
                                                                    <FormItem className="mb-0" invalid={fe(name).invalid} errorMessage={fe(name).errorMessage}>
                                                                        <Field name={name} as={Input} size="sm" type="number" min="0" step="1" disabled={!editable} />
                                                                    </FormItem>
                                                                </Td>
                                                            )
                                                        })}
                                                        <Td style={{ minWidth: 120 }}><Field name="denomination.denomination_other" as={Input} size="sm" disabled={!editable} /></Td>
                                                        <Td style={{ minWidth: 120 }}>
                                                            <Field name="denomination.denomination_other_amount" as={Input} size="sm" type="number" step="0.01" disabled={!editable} />
                                                        </Td>
                                                    </Tr>
                                                </TBody>
                                            </Table>
                                        </div>
                                        <p className={`mt-3 ${cash === total ? 'text-emerald-600' : 'text-red-600'}`}>
                                            Denomination total Rs. <Amount value={cash} /> {cash === total ? 'matches' : 'does not match'} the total amount Rs. <Amount value={total} />.
                                            {serverErrors.denomination ? ` ${serverErrors.denomination.message}` : ''}
                                        </p>
                                    </AdaptableCard>
                                ) : null}

                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <FormItem
                                        asterisk={!!record && record.status === 'Approved'}
                                        label={record && record.status === 'Approved' ? 'Remarks (reason for the change)' : 'Remarks'}
                                        invalid={fe('remarks').invalid}
                                        errorMessage={fe('remarks').errorMessage}
                                    >
                                        <Field name="remarks" as={Input} textArea placeholder="Remarks" disabled={!editable && !permissions.approve && !permissions.delete} />
                                    </FormItem>
                                    {record ? (
                                        <div className="text-sm text-gray-500">
                                            Created by {text(record.createdby).trim() || '-'}; last changed by {text(record.modifiedby).trim() || '-'}
                                            {record.approved_on ? `; approved by ${text(record.approvedby).trim() || '-'}` : ''}
                                        </div>
                                    ) : null}
                                </AdaptableCard>

                                <StickyFooter
                                    className="px-8 flex items-center justify-end py-4"
                                    stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                                >
                                    <Button size="sm" className="ltr:mr-3" type="button" onClick={() => navigate(LIST)}>Cancel</Button>
                                    {record && permissions.delete ? (
                                        <Button size="sm" className="ltr:mr-3" variant="solid" color="red-600" type="button" disabled={busy} onClick={() => setConfirm('delete')}>
                                            Delete
                                        </Button>
                                    ) : null}
                                    {pendingApproval && permissions.approve ? (
                                        <>
                                            <Button size="sm" className="ltr:mr-3" variant="solid" color="red-600" type="button" disabled={busy} onClick={() => setConfirm('reject')}>
                                                Reject
                                            </Button>
                                            <Button size="sm" className="ltr:mr-3" variant="solid" color="emerald-600" type="button" loading={busy} onClick={approve}>
                                                {record.status === 'Deleted' ? 'Approve Deletion' : 'Approve'}
                                            </Button>
                                        </>
                                    ) : null}
                                    {editable ? (
                                        <Button size="sm" variant="solid" type="submit" loading={isSubmitting} disabled={busy}>Submit For Approval</Button>
                                    ) : null}
                                </StickyFooter>
                            </FormContainer>
                            <ConfirmDialog
                                isOpen={confirm !== null}
                                closable={false}
                                type="danger"
                                title={confirm === 'reject' ? 'Reject Payment' : 'Delete Payment'}
                                onClose={() => setConfirm(null)}
                                onRequestClose={() => setConfirm(null)}
                                onCancel={() => setConfirm(null)}
                                onConfirm={runConfirmed}
                            >
                                <p>
                                    {confirm === 'reject'
                                        ? 'Reject this payment? Give the reason in Remarks.'
                                        : record && record.status === 'Approved'
                                            ? 'This payment is approved, so its deletion goes for approval. Give the reason in Remarks.'
                                            : 'Delete this payment?'}
                                </p>
                            </ConfirmDialog>
                        </Form>
                    )
                }}
            </Formik>
        </Loading>
    )
}

export default AddEditPayment
