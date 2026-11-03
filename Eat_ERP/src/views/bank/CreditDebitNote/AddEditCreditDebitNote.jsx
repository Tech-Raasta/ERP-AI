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
import { Field, Form, Formik, getIn } from 'formik'
import { useNavigate, useParams } from 'react-router-dom'
import NumberFormat from 'react-number-format'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiCreditDebitNoteApprove,
    apiCreditDebitNoteDelete,
    apiCreditDebitNoteDistributor,
    apiCreditDebitNoteGetSingle,
    apiCreditDebitNoteMasterData,
    apiCreditDebitNotePost,
    apiCreditDebitNotePrint,
    apiCreditDebitNoteReject,
    apiCreditDebitNoteUpdate,
} from 'services/CreditDebitNoteService'

// Credit Debit Note add / edit (old PHP credit_debit_note_details.php). Tax on the amount: CGST + SGST for a
// Maharashtra distributor (state code 27), else IGST. Approval gives the Ref No and prints the note.

const LIST = '/transaction/credit-debit-note'
const DISTRIBUTOR_TYPES = ['Promotion', 'Invoice']
const HOME_STATE_CODE = '27'

const pad = (value) => (value < 10 ? `0${value}` : `${value}`)
const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const parseDate = (value) => {
    if (!value) return null
    const [year, month, day] = value.toString().substring(0, 10).split('-').map(Number)
    return year ? new Date(year, month - 1, day) : null
}
const num = (value) => {
    const parsed = parseFloat(String(value === null || value === undefined ? '' : value).replace(/,/g, ''))
    return isNaN(parsed) ? 0 : parsed
}
const round2 = (value) => Math.round(value * 100) / 100
const text = (value) => (value === null || value === undefined ? '' : String(value))

const initialValues = () => ({
    date_of_transaction: toDateString(new Date()),
    distributor_type: 'Promotion',
    distributor_id: '',
    transaction: '',
    exp_category_id: '',
    invoice_no: '',
    amount_without_tax: '',
    tax: '',
    remarks: '',
})

// Tax split as the server works it out
const taxOf = (values, distributor) => {
    const amount = num(values.amount_without_tax)
    const tax = num(values.tax)
    const home = distributor && text(distributor.state_code) === HOME_STATE_CODE
    const cgst = home ? round2((tax / 2) * amount / 100) : 0
    const igst = home ? 0 : round2(tax * amount / 100)
    return { home, cgst, sgst: cgst, igst, total: round2(amount + cgst * 2 + igst) }
}

// Old PHP validations.js form_credit_debit_note_details
const validate = (record) => (values) => {
    const errors = {}
    if (!values.date_of_transaction) errors.date_of_transaction = 'Date Of Transaction Is Required'
    else if (values.date_of_transaction > toDateString(new Date())) errors.date_of_transaction = 'Date Of Transaction Cannot Be In The Future'
    if (!values.distributor_type) errors.distributor_type = 'Distributor Type Is Required'
    if (!values.distributor_id) errors.distributor_id = 'Distributor Is Required'
    if (!values.transaction) errors.transaction = 'Transaction Is Required'
    if (!values.exp_category_id) errors.exp_category_id = 'Expense Category Is Required'
    if (values.distributor_type === 'Invoice' && !values.invoice_no) errors.invoice_no = 'Invoice No Is Required'
    const amount = text(values.amount_without_tax).replace(/,/g, '')
    if (!amount) errors.amount_without_tax = 'Amount Is Required'
    else if (isNaN(Number(amount)) || Number(amount) <= 0) errors.amount_without_tax = 'Amount Should Be Greater Than Zero'
    const tax = text(values.tax).replace(/,/g, '')
    if (tax && (isNaN(Number(tax)) || Number(tax) < 0 || Number(tax) > 100)) errors.tax = 'Tax Should Be Between 0 And 100'
    if (!text(values.remarks).trim()) {
        errors.remarks = record && record.status === 'Approved' ? 'Give The Reason For Changing This Approved Note' : 'Remarks Is Required'
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
        invalid: (typeof error === 'string' && (!!touch || form.submitCount > 0)) || !!server,
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

const AddEditCreditDebitNote = () => {
    const { noteid } = useParams()
    const navigate = useNavigate()
    const formRef = useRef()
    const [loading, setLoading] = useState(true)
    const [formValues, setFormValues] = useState(initialValues())
    const [record, setRecord] = useState(null)
    const [changeOf, setChangeOf] = useState(null)
    const [source, setSource] = useState(null)
    const [permissions, setPermissions] = useState({ submit: true, delete: false, approve: false })
    const [master, setMaster] = useState({ distributors: [], categories: [], transactions: [] })
    const [details, setDetails] = useState({ outstanding: null, invoices: [] })
    const [serverErrors, setServerErrors] = useState({})
    const [busy, setBusy] = useState(false)
    const [confirm, setConfirm] = useState(null)
    const detailsRequest = useRef(0)

    const loadDetails = (distributorId, current) => {
        const request = ++detailsRequest.current
        setDetails({ outstanding: null, invoices: [] })
        if (!distributorId) return
        const own = current || record
        apiCreditDebitNoteDistributor(distributorId, own ? own.id : 0, own ? own.ref_id : 0)
            .then((res) => {
                if (request === detailsRequest.current) setDetails(res.data)
            })
            .catch(() => {})
    }

    useEffect(() => {
        const requests = [apiCreditDebitNoteMasterData()]
        if (noteid) requests.push(apiCreditDebitNoteGetSingle(noteid))
        Promise.all(requests)
            .then(([masterRes, single]) => {
                setMaster(masterRes.data)
                if (!single) {
                    setPermissions({ submit: !!(masterRes.data['action'] || {}).insert, delete: false, approve: false })
                    return
                }
                const { note, permissions: allowed, changeOf: original, source: from } = single.data
                setRecord(note)
                setChangeOf(original)
                setSource(from)
                setPermissions(allowed)
                setFormValues({
                    date_of_transaction: note.date_of_transaction || '',
                    distributor_type: note.distributor_type || 'Promotion',
                    distributor_id: note.distributor_id || '',
                    transaction: note.transaction || '',
                    exp_category_id: note.exp_category_id || '',
                    invoice_no: note.invoice_no || '',
                    amount_without_tax: text(note.amount_without_tax !== null ? note.amount_without_tax : note.amount),
                    tax: text(note.tax),
                    // A change or deletion of an approved note needs its own reason
                    remarks: note.status === 'Approved' ? '' : text(note.remarks),
                })
                loadDetails(note.distributor_id, note)
            })
            .catch((error) => showMessage(error && error.response ? error.response.data['message'] : 'Fetching credit / debit note failed'))
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [noteid])

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
        const request = record ? apiCreditDebitNoteUpdate(record.id, values) : apiCreditDebitNotePost(values)
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

    // Approve, then print the note (PHP printed it straight away). The window is opened on the click so popup
    // blockers allow it.
    const approve = () => {
        const remarks = formRef.current.values.remarks
        const win = window.open('', '_blank')
        if (win) win.document.write('<p style="font-family:sans-serif">Approving...</p>')
        setBusy(true)
        apiCreditDebitNoteApprove(record.id, remarks)
            .then(async (res) => {
                showMessage(res.data['message'], 'success')
                if (res.data['print'] && win) {
                    const printout = await apiCreditDebitNotePrint(res.data['id'])
                    win.document.open()
                    win.document.write(printout.data['html'])
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
        const request = type === 'reject' ? apiCreditDebitNoteReject(record.id, values.remarks) : apiCreditDebitNoteDelete(record.id, values.remarks)
        setBusy(true)
        request
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate(LIST)
            })
            .catch((error) => handleError(error, values))
            .finally(() => setBusy(false))
    }

    const distributorOptions = master.distributors.map((row) => ({ value: row.id, label: row.distributor_name }))
    const categoryOptions = master.categories.map((row) => ({ value: row.id, label: row.category }))
    const transactionOptions = master.transactions.map((value) => ({ value, label: value }))
    const typeOptions = DISTRIBUTOR_TYPES.map((value) => ({ value, label: value }))
    const title = !record ? 'Add Credit Debit Note' : `${record.transaction || 'Credit Debit Note'}${record.ref_no ? ` ${record.ref_no}` : ''} (${record.status})`

    return (
        <Loading loading={loading}>
            <Formik innerRef={formRef} initialValues={formValues} enableReinitialize validate={validate(record)} onSubmit={onSubmit}>
                {({ values, errors, touched, isSubmitting, setFieldValue, submitCount, isValid }) => {
                    const form = { values, errors, touched, submitCount }
                    const fe = (name) => fieldFeedback(form, name, serverErrors)
                    const distributor = master.distributors.find((row) => String(row.id) === String(values.distributor_id))
                    const tax = taxOf(values, distributor)
                    const invoiceOptions = details.invoices.map((value) => ({ value, label: value }))
                    if (values.invoice_no && !invoiceOptions.some((option) => option.value === values.invoice_no)) {
                        invoiceOptions.unshift({ value: values.invoice_no, label: values.invoice_no })
                    }
                    const selectValue = (options, value) => options.filter((option) => String(option.value) === String(value))
                    const select = (name, label, options, onChange, extra = {}) => (
                        <FormItem asterisk label={label} invalid={fe(name).invalid} errorMessage={fe(name).errorMessage}>
                            <Select
                                placeholder="Select"
                                isDisabled={!editable}
                                options={options}
                                value={selectValue(options, values[name])}
                                onChange={(option) => (onChange ? onChange(option) : setFieldValue(name, option ? option.value : ''))}
                                {...extra}
                            />
                        </FormItem>
                    )

                    return (
                        <Form>
                            <SubmitErrorNotice submitCount={submitCount} isValid={isValid} />
                            <FormContainer>
                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-2">{title}</h5>
                                    {changeOf ? (
                                        <p className="mb-2 text-amber-600">
                                            This is a {record.status === 'Deleted' ? 'deletion' : 'change'} of approved note {changeOf}, waiting for approval.
                                        </p>
                                    ) : null}
                                    {source ? (
                                        <p className="mb-2 text-gray-500">
                                            Made by the system for {source.type} #{source.id}. Approving that {source.type.toLowerCase()} again redoes this note.
                                        </p>
                                    ) : null}
                                    {record && +record.freezed === 1 ? <p className="mb-2 text-gray-500">This note is in a freezed month and cannot be changed.</p> : null}
                                    <div className="grid md:grid-cols-3 gap-4 mt-2">
                                        <FormItem asterisk label="Date Of Transaction" invalid={fe('date_of_transaction').invalid} errorMessage={fe('date_of_transaction').errorMessage}>
                                            <DatePicker
                                                inputFormat="DD/MM/YYYY"
                                                placeholder="Date Of Transaction"
                                                maxDate={new Date()}
                                                disabled={!editable}
                                                value={parseDate(values.date_of_transaction)}
                                                onChange={(date) => setFieldValue('date_of_transaction', date ? toDateString(new Date(date)) : '')}
                                            />
                                        </FormItem>
                                        {select('distributor_type', 'Distributor Type', typeOptions, (option) => {
                                            const type = option ? option.value : ''
                                            setFieldValue('distributor_type', type)
                                            // PHP: an invoice note starts at 5% tax, a promotion note without
                                            if (type === 'Invoice') {
                                                if (!text(values.tax)) setFieldValue('tax', '5')
                                            } else {
                                                setFieldValue('invoice_no', '')
                                                setFieldValue('tax', '')
                                            }
                                        })}
                                        {select('distributor_id', 'Distributor', distributorOptions, (option) => {
                                            const id = option ? option.value : ''
                                            setFieldValue('distributor_id', id)
                                            setFieldValue('invoice_no', '')
                                            loadDetails(id)
                                        })}
                                        <FormItem label="Total Outstanding (In Rs)">
                                            <div className="pt-2 font-semibold">
                                                {values.distributor_id ? (details.outstanding === null ? '...' : <Amount value={details.outstanding} />) : ''}
                                            </div>
                                        </FormItem>
                                        {select('transaction', 'Transaction', transactionOptions)}
                                        {select('exp_category_id', 'Expense Category', categoryOptions)}
                                        {values.distributor_type === 'Invoice'
                                            ? select('invoice_no', 'Invoice No', invoiceOptions, null, { isDisabled: !editable || !values.distributor_id })
                                            : null}
                                    </div>
                                </AdaptableCard>

                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-4">Amount</h5>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <FormItem asterisk label="Amount (In Rs)" invalid={fe('amount_without_tax').invalid} errorMessage={fe('amount_without_tax').errorMessage}>
                                            <Field name="amount_without_tax" as={Input} type="number" step="0.01" min="0" placeholder="Amount before tax" disabled={!editable} />
                                        </FormItem>
                                        <FormItem label="Tax (In %)" invalid={fe('tax').invalid} errorMessage={fe('tax').errorMessage}>
                                            <Field name="tax" as={Input} type="number" step="0.01" min="0" max="100" placeholder="Tax %" disabled={!editable} />
                                        </FormItem>
                                        <div />
                                        {tax.home ? (
                                            <>
                                                <FormItem label="CGST (In Rs)"><div className="pt-2"><Amount value={tax.cgst} /></div></FormItem>
                                                <FormItem label="SGST (In Rs)"><div className="pt-2"><Amount value={tax.sgst} /></div></FormItem>
                                            </>
                                        ) : (
                                            <FormItem label="IGST (In Rs)"><div className="pt-2"><Amount value={tax.igst} /></div></FormItem>
                                        )}
                                        <FormItem label="Total Amount (In Rs)"><div className="pt-2 font-semibold"><Amount value={tax.total} /></div></FormItem>
                                    </div>
                                    {!values.distributor_id ? <p className="text-sm text-gray-500">Select the distributor to see the GST split.</p> : null}
                                </AdaptableCard>

                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <FormItem
                                        asterisk
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
                                title={confirm === 'reject' ? 'Reject Note' : 'Delete Note'}
                                onClose={() => setConfirm(null)}
                                onRequestClose={() => setConfirm(null)}
                                onCancel={() => setConfirm(null)}
                                onConfirm={runConfirmed}
                            >
                                <p>
                                    {confirm === 'reject'
                                        ? 'Reject this note? Give the reason in Remarks.'
                                        : record && record.status === 'Approved'
                                            ? 'This note is approved, so its deletion goes for approval. Give the reason in Remarks.'
                                            : 'Delete this note?'}
                                </p>
                            </ConfirmDialog>
                        </Form>
                    )
                }}
            </Formik>
        </Loading>
    )
}

export default AddEditCreditDebitNote
