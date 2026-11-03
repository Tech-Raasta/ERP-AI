import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Checkbox from 'components/ui/Checkbox'
import Radio from 'components/ui/Radio'
import DatePicker from 'components/ui/DatePicker'
import Button from 'components/ui/Buttons'
import Loading from 'components/shared/Loading'
import StickyFooter from 'components/shared/StickyFooter'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import Table from 'components/ui/Table'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as Yup from 'yup'
import { HiMinus, HiPlus } from 'react-icons/hi'
import NumberFormat from 'react-number-format'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiSalesReturnDelete,
    apiSalesReturnGetSingle,
    apiSalesReturnInvoiceDetails,
    apiSalesReturnInvoices,
    apiSalesReturnItemDetails,
    apiSalesReturnMasterData,
    apiSalesReturnPost,
    apiSalesReturnUpdate,
} from 'services/SalesReturnService'
import { calculateLine, round, sellRateFor, taxTypeFor, totalsFor } from './salesReturnCalc'

const { Tr, Th, Td, THead, TBody, TFoot } = Table

// Sales Return add / edit (old PHP distributor_in_details.php). Lines are valued at MRP less (item margin + discount),
// before tax. Expired stock is also written off to 'Product Expired'; an exchange sends replacement goods as a sale.

const pad = (value) => (value < 10 ? `0${value}` : `${value}`)
const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const parseDate = (value) => {
    if (!value) return null
    const text = value.toString()
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const [year, month, day] = text.split('-')
        return new Date(+year, +month - 1, +day)
    }
    const date = new Date(text)
    return isNaN(date.getTime()) ? null : date
}
const dateValue = (value) => {
    const date = parseDate(value)
    return date ? toDateString(date) : ''
}
const dueDateFor = (creditPeriod) => {
    const date = new Date()
    date.setDate(date.getDate() + (isNaN(parseInt(creditPeriod)) ? 1 : parseInt(creditPeriod)))
    return toDateString(date)
}

const emptyItem = () => ({
    type: 'Box', item_id: '', qty: '', rate: '', sell_rate: '', cost_rate: '', grams: '', tax_per: 0, sell_margin: 0, promo_margin: 0, batch_no: '',
})

const initialValues = () => ({
    date_of_processing: toDateString(new Date()),
    distributor_id: '',
    depot_id: '',
    discount: '',
    sales_rep_id: '',
    sales_type: 'Adhoc',
    order_no: '',
    invoice_no: '',
    expired: false,
    exchanged: false,
    items: [emptyItem()],
    exchange_items: [emptyItem()],
    due_date: '',
    remarks: '',
})

const numberField = (label) => Yup.number()
    .transform((value, original) => (original === '' || original === null ? undefined : value))
    .typeError(`${label} must be a number`)

const lineSchema = Yup.object().shape({
    type: Yup.string().required('Type Is Required'),
    item_id: Yup.string().required('Item Is Required'),
    qty: numberField('Qty').required('Qty Is Required').moreThan(0, 'Qty must be more than 0'),
    sell_rate: numberField('Sell Rate').required('Sell Rate Is Required').min(0, 'Sell Rate cannot be negative'),
    batch_no: Yup.string().required('Batch Is Required'),
})

const validationSchema = Yup.object().shape({
    date_of_processing: Yup.string().required('Date Is Required'),
    distributor_id: Yup.string().required('Distributor Is Required'),
    depot_id: Yup.string().required('Depot Is Required'),
    sales_rep_id: Yup.string().required('Sales Representative Is Required'),
    discount: numberField('Discount').min(0, 'Discount cannot be negative').max(100, 'Discount cannot be more than 100%'),
    sales_type: Yup.string().required('Sales Type Is Required'),
    invoice_no: Yup.string().when('sales_type', { is: 'Invoice', then: Yup.string().required('Invoice No. Is Required') }),
    due_date: Yup.string().required('Due Date Is Required'),
    remarks: Yup.string().trim().required('Remarks Is Required'),
    items: Yup.array().of(lineSchema).min(1, 'Please add atleast one item.'),
    exchange_items: Yup.array().when('exchanged', {
        is: true,
        then: Yup.array().of(lineSchema).min(1, 'Please add atleast one exchange item.'),
        otherwise: Yup.array(),
    }),
})

// Server errors stay on their field until that field changes
const fieldFeedback = (form, name, serverErrors = {}) => {
    const error = getIn(form.errors, name)
    const touch = getIn(form.touched, name)
    const server = serverErrors[name] && serverErrors[name].value === getIn(form.values, name) ? serverErrors[name].message : ''
    return {
        errorMessage: typeof error === 'string' ? error : server || '',
        invalid: (typeof touch !== 'undefined' && typeof error === 'string' && touch) || !!server,
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

const AddEditSaleReturn = () => {
    const { returnid } = useParams()
    const navigate = useNavigate()
    const formRef = useRef()
    const [loading, setLoading] = useState(true)
    const [formValues, setFormValues] = useState(initialValues())
    const [record, setRecord] = useState(null)
    const [permissions, setPermissions] = useState({ submit: true, delete: false })
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [serverErrors, setServerErrors] = useState({})
    const [invoiceOptions, setInvoiceOptions] = useState([])
    const [invoiceState, setInvoiceState] = useState('')
    const [master, setMaster] = useState({ depots: [], distributors: [], salesReps: [], boxes: [], comboBoxes: [], bars: [], batches: [] })
    const [extraItems, setExtraItems] = useState({})

    const options = useMemo(() => {
        const items = {
            Box: master.boxes.map((row) => ({ value: row.id, label: row.box_name })),
            'Combo Box': master.comboBoxes.map((row) => ({ value: row.id, label: row.combo_box_name })),
            Bar: master.bars.map((row) => ({ value: row.id, label: row.product_name })),
        }
        Object.keys(extraItems).forEach((key) => {
            const [type, id] = key.split(':')
            if (items[type] && !items[type].some((option) => option.value === +id)) items[type].push({ value: +id, label: extraItems[key] })
        })
        return {
            depots: master.depots.map((row) => ({ value: row.id, label: row.depot_name, data: row })),
            distributors: master.distributors.map((row) => ({ value: row.id, label: row.distributor_name, data: row })),
            salesReps: master.salesReps.map((row) => ({ value: row.id, label: row.sales_rep_name })),
            batches: master.batches.map((row) => ({ value: row.id, label: row.batch_no })),
            items,
        }
    }, [master, extraItems])

    const loadInvoices = (distributorId) => {
        if (!distributorId) {
            setInvoiceOptions([])
            return
        }
        apiSalesReturnInvoices(distributorId)
            .then((res) => setInvoiceOptions((res.data['invoices'] || []).map((value) => ({ value, label: value }))))
            .catch(() => setInvoiceOptions([]))
    }

    useEffect(() => {
        const load = async () => {
            try {
                if (!returnid) {
                    const masterRes = await apiSalesReturnMasterData()
                    setMaster(masterRes.data)
                    if (!masterRes.data.action || !masterRes.data.action.insert) {
                        showMessage('You do not have access to add sales returns.')
                        navigate('/transaction/sales-return')
                    }
                    return
                }
                const res = await apiSalesReturnGetSingle(returnid)
                const { salesReturn: data, items, exchangeItems, pendingEditId, permissions: entryPermissions } = res.data
                if (pendingEditId && +pendingEditId !== +data.id) {
                    showMessage('This return already has a change waiting for approval. Opening that entry.', 'warning')
                    navigate(`/transaction/sales-return/edit-sales-return/${pendingEditId}`, { replace: true })
                    return
                }
                if (!entryPermissions || !entryPermissions.submit) {
                    showMessage('You cannot edit this sales return.')
                    navigate(`/transaction/sales-return/view/${data.id}`, { replace: true })
                    return
                }
                // Old PHP edit: batches within 9 months before the return date
                const masterRes = await apiSalesReturnMasterData(dateValue(data.date_of_processing))
                setMaster(masterRes.data)
                const extra = {}
                ;[...items, ...exchangeItems].forEach((item) => { extra[`${item.type}:${item.item_id}`] = item.item_name })
                setExtraItems(extra)
                setRecord(data)
                setPermissions(entryPermissions)
                if (data.sales_type === 'Invoice') {
                    loadInvoices(data.distributor_id)
                    setInvoiceState(data.invoice_state || '')
                }
                const text = (value) => (value === null || value === undefined ? '' : value)
                const toLine = (item, batchKey) => ({
                    type: item.type,
                    item_id: item.item_id,
                    qty: text(item.qty),
                    rate: text(item.rate),
                    sell_rate: text(item.sell_rate),
                    cost_rate: text(item.cost_rate),
                    grams: text(item.grams),
                    tax_per: +item.tax_percentage || 0,
                    sell_margin: +item.margin_per || 0,
                    promo_margin: +item.promo_margin || 0,
                    batch_no: item[batchKey] || '',
                })
                setFormValues({
                    ...initialValues(),
                    date_of_processing: dateValue(data.date_of_processing),
                    distributor_id: data.distributor_id || '',
                    depot_id: data.depot_id || '',
                    discount: text(data.discount),
                    sales_rep_id: data.sales_rep_id || '',
                    sales_type: data.sales_type === 'Invoice' ? 'Invoice' : 'Adhoc',
                    order_no: text(data.order_no),
                    invoice_no: text(data.invoice_nos),
                    expired: data.is_expired === 'yes',
                    exchanged: data.is_exchanged === 'yes',
                    items: items.length ? items.map((item) => toLine(item, 'batch_no')) : [emptyItem()],
                    exchange_items: exchangeItems.length ? exchangeItems.map((item) => toLine(item, 'batch_no_ex')) : [emptyItem()],
                    due_date: dateValue(data.due_date),
                    remarks: text(data.remarks),
                })
            } catch (error) {
                showMessage(error && error.response ? error.response.data['message'] : 'Loading failed')
                navigate('/transaction/sales-return')
            } finally {
                setLoading(false)
            }
        }
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [returnid])

    const findDistributor = (id) => master.distributors.find((row) => row.id === +id)
    const findDepot = (id) => master.depots.find((row) => row.id === +id)
    const billingState = (values) => {
        if (values.sales_type === 'Invoice' && invoiceState) return invoiceState
        const distributor = findDistributor(values.distributor_id)
        return distributor ? distributor.state : record ? record.distributor_state : ''
    }

    // Old PHP get_box_details etc.: MRP, cost, tax and the distributor's margins; sell rate from margin + discount
    const refreshItem = async (list, index, type, itemId, distributorId) => {
        if (!type || !itemId) return
        try {
            const res = await apiSalesReturnItemDetails(type, itemId, distributorId)
            const form = formRef.current
            const current = form.values[list][index]
            if (!current || current.type !== type || +current.item_id !== +itemId) return
            const d = res.data
            form.setFieldValue(`${list}[${index}]`, {
                ...current,
                rate: d.rate,
                cost_rate: d.cost,
                grams: d.grams,
                tax_per: d.tax_percentage,
                sell_margin: d.inv_margin,
                promo_margin: d.pro_margin,
                sell_rate: sellRateFor(d.rate, d.inv_margin, form.values.discount, d.tax_percentage),
            })
        } catch (error) {
            showMessage(error && error.response ? error.response.data['message'] : 'Fetching item details failed')
        }
    }

    const refreshAll = (values, distributorId) => {
        ;['items', ...(values.exchanged ? ['exchange_items'] : [])].forEach((list) => {
            values[list].forEach((item, index) => refreshItem(list, index, item.type, item.item_id, distributorId))
        })
    }

    // Old PHP get_distributor_details: discount = distributor sell out, due date from the credit period, margins refreshed
    const onDistributorChange = (option) => {
        const form = formRef.current
        const distributor = option ? option.data : null
        form.setValues({
            ...form.values,
            distributor_id: option ? option.value : '',
            discount: distributor && distributor.sell_out !== null ? distributor.sell_out : '',
            due_date: dueDateFor(distributor ? distributor.credit_period : null),
            invoice_no: '',
        })
        setInvoiceState('')
        if (form.values.sales_type === 'Invoice') loadInvoices(option ? option.value : '')
        refreshAll(form.values, option ? option.value : '')
    }

    const onDiscountChange = (value) => {
        const form = formRef.current
        form.setFieldValue('discount', value)
        ;['items', 'exchange_items'].forEach((list) => {
            form.setFieldValue(list, form.values[list].map((item) => (
                item.item_id ? { ...item, sell_rate: sellRateFor(item.rate, item.sell_margin, value, item.tax_per) } : item
            )))
        })
    }

    // Old PHP get_invoice_details: the invoice's lines (qty, batch), its discount and billing state
    const onInvoiceChange = async (option) => {
        const form = formRef.current
        const invoiceNo = option ? option.value : ''
        form.setFieldValue('invoice_no', invoiceNo)
        if (!invoiceNo) return
        try {
            const res = await apiSalesReturnInvoiceDetails(invoiceNo)
            const items = (res.data['items'] || []).map((item) => ({ ...emptyItem(), type: item.type, item_id: item.item_id, qty: item.qty, batch_no: item.batch_no || '' }))
            setInvoiceState(res.data['state'] || '')
            await form.setValues({ ...formRef.current.values, discount: res.data['discount'] || 0, items: items.length ? items : [emptyItem()] })
            const distributorId = formRef.current.values.distributor_id
            items.forEach((item, index) => refreshItem('items', index, item.type, item.item_id, distributorId))
        } catch (error) {
            showMessage(error && error.response ? error.response.data['message'] : 'Fetching invoice failed')
        }
    }

    const onSubmit = (values, actions) => {
        setServerErrors({})
        const payload = { ...values, exchange_items: values.exchanged ? values.exchange_items : [] }
        const request = returnid ? apiSalesReturnUpdate(record.id, payload) : apiSalesReturnPost(payload)
        request
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate('/transaction/sales-return')
            })
            .catch((error) => {
                actions.setSubmitting(false)
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
            })
    }

    const onDeleteConfirm = () => {
        setConfirmDelete(false)
        apiSalesReturnDelete(record.id)
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate('/transaction/sales-return')
            })
            .catch((error) => {
                if (!error || !error.response) return
                const errors = error.response.data && error.response.data.error && error.response.data.error.errors
                showMessage(errors ? Object.values(errors).map((item) => item.message).join(', ') : error.response.data['message'])
            })
    }

    return (
        <Loading loading={loading}>
            <Formik innerRef={formRef} initialValues={formValues} enableReinitialize validationSchema={validationSchema} onSubmit={onSubmit}>
                {({ values, touched, errors, isSubmitting, setFieldValue, submitCount, isValid }) => {
                    const depot = findDepot(values.depot_id)
                    const taxType = taxTypeFor(depot ? depot.state : record ? record.depot_state : '', billingState(values))
                    const fe = (name) => fieldFeedback({ errors, touched, values }, name, serverErrors)
                    const listError = (name) => {
                        const parts = [typeof errors[name] === 'string' ? errors[name] : '']
                        if (serverErrors[name] && serverErrors[name].value === values[name]) parts.push(serverErrors[name].message)
                        return [...new Set(parts.filter(Boolean))].join(' ')
                    }

                    const itemsTable = (list, title) => {
                        const lines = values[list].map((item) => calculateLine(item, taxType))
                        const totals = totalsFor(lines)
                        return (
                            <div className="mb-4">
                                <h6 className="mb-2">{title}</h6>
                                <div className="overflow-x-auto">
                                    <Table compact className="border">
                                        <THead>
                                            <Tr>
                                                <Th>Type*</Th>
                                                <Th>Item*</Th>
                                                <Th>Qty*</Th>
                                                <Th>Rate (In Rs)</Th>
                                                <Th>Sell Rate (In Rs)*</Th>
                                                <Th>Amount (In Rs)</Th>
                                                <Th>CGST</Th>
                                                <Th>SGST</Th>
                                                <Th>IGST</Th>
                                                <Th>Tax</Th>
                                                <Th>Total (In Rs)</Th>
                                                <Th>Batch*</Th>
                                                <Th>Action</Th>
                                            </Tr>
                                        </THead>
                                        <FieldArray name={list}>
                                            {({ form, remove, push }) => (
                                                <>
                                                    <TBody>
                                                        {values[list].map((item, index) => {
                                                            const fb = (key) => fieldFeedback(form, `${list}[${index}].${key}`, serverErrors)
                                                            const typeOptions = [
                                                                ...(item.type === 'Bar' ? [{ value: 'Bar', label: 'Bar' }] : []),
                                                                { value: 'Box', label: 'Box' },
                                                                { value: 'Combo Box', label: 'Combo Box' },
                                                            ]
                                                            const itemOptions = options.items[item.type] || []
                                                            const line = lines[index]
                                                            return (
                                                                <Tr key={index}>
                                                                    <Td style={{ minWidth: 120 }}>
                                                                        <FormItem className="mb-0" layout="vertical" invalid={fb('type').invalid} errorMessage={fb('type').errorMessage}>
                                                                            <Select
                                                                                {...portal}
                                                                                options={typeOptions}
                                                                                value={typeOptions.filter((option) => option.value === item.type)}
                                                                                onChange={(option) => setFieldValue(`${list}[${index}]`, { ...emptyItem(), type: option ? option.value : '', qty: item.qty, batch_no: item.batch_no })}
                                                                            />
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td style={{ minWidth: 240 }}>
                                                                        <FormItem className="mb-0" layout="vertical" invalid={fb('item_id').invalid} errorMessage={fb('item_id').errorMessage}>
                                                                            <Select
                                                                                {...portal}
                                                                                options={itemOptions}
                                                                                value={itemOptions.filter((option) => option.value === +item.item_id)}
                                                                                onChange={(option) => {
                                                                                    const itemId = option ? option.value : ''
                                                                                    setFieldValue(`${list}[${index}].item_id`, itemId)
                                                                                    refreshItem(list, index, item.type, itemId, values.distributor_id)
                                                                                }}
                                                                            />
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td style={{ minWidth: 90 }}>
                                                                        <FormItem className="mb-0" layout="vertical" invalid={fb('qty').invalid} errorMessage={fb('qty').errorMessage}>
                                                                            <Field name={`${list}[${index}].qty`} type="number" placeholder="Qty" onWheel={(e) => e.target.blur()} invalid={fb('qty').invalid} component={Input} />
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td><Amount value={item.rate} /></Td>
                                                                    <Td style={{ minWidth: 110 }}>
                                                                        <FormItem className="mb-0" layout="vertical" invalid={fb('sell_rate').invalid} errorMessage={fb('sell_rate').errorMessage}>
                                                                            <Field name={`${list}[${index}].sell_rate`} type="number" placeholder="Sell Rate" onWheel={(e) => e.target.blur()} invalid={fb('sell_rate').invalid} component={Input} />
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td><Amount value={line.amount} /></Td>
                                                                    <Td><Amount value={line.cgst_amt} /></Td>
                                                                    <Td><Amount value={line.sgst_amt} /></Td>
                                                                    <Td><Amount value={line.igst_amt} /></Td>
                                                                    <Td><Amount value={line.tax_amt} /></Td>
                                                                    <Td><Amount value={line.total_amt} /></Td>
                                                                    <Td style={{ minWidth: 140 }}>
                                                                        <FormItem className="mb-0" layout="vertical" invalid={fb('batch_no').invalid} errorMessage={fb('batch_no').errorMessage}>
                                                                            <Select
                                                                                {...portal}
                                                                                options={options.batches}
                                                                                value={options.batches.filter((option) => option.value === +item.batch_no)}
                                                                                onChange={(option) => setFieldValue(`${list}[${index}].batch_no`, option ? option.value : '')}
                                                                            />
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td>
                                                                        <Button type="button" shape="circle" size="sm" icon={<HiMinus />} onClick={() => remove(index)} />
                                                                    </Td>
                                                                </Tr>
                                                            )
                                                        })}
                                                    </TBody>
                                                    <TFoot>
                                                        <Tr>
                                                            <Td colSpan={5}>
                                                                <Button type="button" size="sm" variant="twoTone" icon={<HiPlus />} onClick={() => push(emptyItem())}>Add Item</Button>
                                                                {listError(list) ? <span className="ml-4 text-red-500">{listError(list)}</span> : null}
                                                            </Td>
                                                            <Td className="font-semibold"><Amount value={totals.amount} /></Td>
                                                            <Td className="font-semibold"><Amount value={totals.cgst_amount} /></Td>
                                                            <Td className="font-semibold"><Amount value={totals.sgst_amount} /></Td>
                                                            <Td className="font-semibold"><Amount value={totals.igst_amount} /></Td>
                                                            <Td className="font-semibold"><Amount value={totals.tax_amount} /></Td>
                                                            <Td className="font-semibold"><Amount value={totals.final_amount} /></Td>
                                                            <Td colSpan={2}></Td>
                                                        </Tr>
                                                    </TFoot>
                                                </>
                                            )}
                                        </FieldArray>
                                    </Table>
                                </div>
                            </div>
                        )
                    }

                    const returnTotals = totalsFor(values.items.map((item) => calculateLine(item, taxType)))
                    const exchangeTotals = values.exchanged ? totalsFor(values.exchange_items.map((item) => calculateLine(item, taxType))) : null
                    const costTotal = round(values.items.reduce((sum, item) => sum + (+item.qty || 0) * (+item.cost_rate || 0), 0))

                    const dateField = (name, label, extra = {}) => (
                        <FormItem asterisk label={label} invalid={fe(name).invalid} errorMessage={fe(name).errorMessage}>
                            <Field name={name}>
                                {({ field, form }) => (
                                    <DatePicker
                                        inputFormat="DD/MM/YYYY"
                                        field={field}
                                        form={form}
                                        placeholder={label}
                                        value={parseDate(field.value)}
                                        onChange={(date) => form.setFieldValue(field.name, date ? toDateString(new Date(date)) : '')}
                                        {...extra}
                                    />
                                )}
                            </Field>
                        </FormItem>
                    )
                    const selectField = (name, label, list, onChange) => (
                        <FormItem asterisk label={label} invalid={fe(name).invalid} errorMessage={fe(name).errorMessage}>
                            <Field name={name}>
                                {({ field, form }) => (
                                    <Select
                                        field={field}
                                        form={form}
                                        options={list}
                                        value={list.filter((option) => String(option.value) === String(values[name]))}
                                        onChange={(option) => (onChange ? onChange(option) : form.setFieldValue(field.name, option ? option.value : ''))}
                                    />
                                )}
                            </Field>
                        </FormItem>
                    )

                    return (
                        <Form autoComplete="off">
                            <SubmitErrorNotice submitCount={submitCount} isValid={isValid} />
                            <AdaptableCard className="card-shadow mb-2">
                                <div className="flex items-center justify-between mb-6">
                                    <h5>{returnid ? 'Edit' : 'Add'} Sales Return {record && record.sales_return_no ? `- ${record.sales_return_no}` : ''}</h5>
                                    {record ? <span className="font-semibold">{record.status}</span> : null}
                                </div>
                                {record && record.ref_id ? (
                                    <div className="mb-4 p-3 rounded bg-indigo-50 text-indigo-700 dark:bg-gray-700 dark:text-indigo-300">
                                        {record.status === 'Deleted' ? 'This is a delete request for ' : 'This is a change waiting for approval to '}
                                        <Link className="underline" to={`/transaction/sales-return/view/${record.ref_id}`}>return #{record.ref_id}</Link>
                                        . Approving it will replace that return.
                                    </div>
                                ) : null}
                                {record && record.status === 'Approved' ? (
                                    <div className="mb-4 p-3 rounded bg-amber-50 text-amber-700 dark:bg-gray-700 dark:text-amber-300">
                                        This return is approved. Your changes are saved as a copy and replace it only after approval.
                                    </div>
                                ) : null}
                                <FormContainer layout="horizontal" size="sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        {dateField('date_of_processing', 'Date', { maxDate: new Date() })}
                                        {selectField('distributor_id', 'Distributor', options.distributors, onDistributorChange)}
                                        {selectField('depot_id', 'Depot', options.depots)}
                                        <FormItem label="Discount (In %)" invalid={fe('discount').invalid} errorMessage={fe('discount').errorMessage}>
                                            <Field name="discount">
                                                {({ field }) => (
                                                    <Input {...field} type="number" placeholder="Discount" onWheel={(e) => e.target.blur()} onChange={(e) => onDiscountChange(e.target.value)} />
                                                )}
                                            </Field>
                                        </FormItem>
                                        {selectField('sales_rep_id', 'Sales Representative', options.salesReps)}
                                        <FormItem asterisk label="Sales Type" invalid={fe('sales_type').invalid} errorMessage={fe('sales_type').errorMessage}>
                                            <Radio.Group
                                                value={values.sales_type}
                                                onChange={(value) => {
                                                    setFieldValue('sales_type', value)
                                                    setFieldValue('invoice_no', '')
                                                    setInvoiceState('')
                                                    if (value === 'Invoice') loadInvoices(values.distributor_id)
                                                }}
                                            >
                                                <Radio value="Adhoc">Adhoc</Radio>
                                                <Radio value="Invoice">Invoice</Radio>
                                            </Radio.Group>
                                        </FormItem>
                                        <FormItem label="Order No">
                                            <Field type="text" name="order_no" placeholder="Order No" component={Input} />
                                        </FormItem>
                                        {values.sales_type === 'Invoice' ? (
                                            <FormItem
                                                asterisk
                                                label="Invoice No."
                                                invalid={fe('invoice_no').invalid}
                                                errorMessage={fe('invoice_no').errorMessage}
                                                extra="Picking an invoice loads its items"
                                            >
                                                <Select
                                                    options={invoiceOptions}
                                                    noOptionsMessage={() => (values.distributor_id ? 'No approved invoices for this distributor' : 'Select the distributor first')}
                                                    value={invoiceOptions.filter((option) => option.value === values.invoice_no)}
                                                    onChange={onInvoiceChange}
                                                />
                                            </FormItem>
                                        ) : null}
                                        <FormItem label="Is stock expired?">
                                            <Checkbox checked={!!values.expired} onChange={(checked) => setFieldValue('expired', checked)}>
                                                Write the stock off to 'Product Expired'
                                            </Checkbox>
                                        </FormItem>
                                        <FormItem label="Is there exchange of stock?">
                                            <Checkbox checked={!!values.exchanged} onChange={(checked) => setFieldValue('exchanged', checked)}>
                                                Send goods in exchange
                                            </Checkbox>
                                        </FormItem>
                                    </div>

                                    <div className="mb-2 text-sm text-gray-500">
                                        Billing state: <span className="font-semibold">{billingState(values) || '-'}</span> ({taxType === 'Intra' ? 'CGST + SGST' : 'IGST'})
                                    </div>
                                    {itemsTable('items', 'Stock In')}
                                    {values.exchanged ? itemsTable('exchange_items', 'Stock Out (Exchange)') : null}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        <FormItem label="Return Amount (In Rs)">
                                            <div className="pt-2 font-bold"><Amount value={returnTotals.final_amount} /></div>
                                        </FormItem>
                                        <FormItem label="Round Off">
                                            <div className="pt-2"><Amount value={returnTotals.round_off_amount} /></div>
                                        </FormItem>
                                        {values.expired ? (
                                            <FormItem label="Written off at cost (In Rs)">
                                                <div className="pt-2"><Amount value={costTotal} /></div>
                                            </FormItem>
                                        ) : null}
                                        {exchangeTotals ? (
                                            <FormItem label="Exchange Amount (In Rs)" extra={exchangeTotals.final_amount !== returnTotals.final_amount ? 'Differs from the return amount' : null}>
                                                <div className="pt-2 font-bold"><Amount value={exchangeTotals.final_amount} /></div>
                                            </FormItem>
                                        ) : null}
                                        {dateField('due_date', 'Due Date')}
                                    </div>
                                    <FormItem asterisk label="Remarks" invalid={fe('remarks').invalid} errorMessage={fe('remarks').errorMessage}>
                                        <Field name="remarks" placeholder="Remarks" textArea component={Input} />
                                    </FormItem>
                                </FormContainer>
                            </AdaptableCard>

                            <StickyFooter
                                className="px-8 flex items-center justify-end py-4"
                                stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                            >
                                <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => navigate('/transaction/sales-return')}>Cancel</Button>
                                {record && permissions.delete ? (
                                    <Button size="sm" className="ltr:mr-3 rtl:ml-3" variant="solid" color="red-600" type="button" onClick={() => setConfirmDelete(true)}>Delete</Button>
                                ) : null}
                                <Button size="sm" variant="solid" loading={isSubmitting} type="submit">Submit For Approval</Button>
                            </StickyFooter>
                        </Form>
                    )
                }}
            </Formik>
            <ConfirmDialog
                isOpen={confirmDelete}
                closable={false}
                type="danger"
                title="Delete Sales Return"
                onClose={() => setConfirmDelete(false)}
                onRequestClose={() => setConfirmDelete(false)}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={onDeleteConfirm}
                confirmButtonColor="red-600"
            >
                <p>
                    {record && record.status === 'Approved'
                        ? 'This return is approved. A delete request will be sent for approval; the return is cancelled once it is approved.'
                        : 'This return (and its expiry / exchange entries) will be cancelled. Continue?'}
                </p>
            </ConfirmDialog>
        </Loading>
    )
}

export default AddEditSaleReturn
