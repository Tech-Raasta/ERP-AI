import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import DatePicker from 'components/ui/DatePicker'
import Radio from 'components/ui/Radio'
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
    apiSalesConsignees,
    apiSalesDelete,
    apiSalesGetSingle,
    apiSalesItemDetails,
    apiSalesMasterData,
    apiSalesPost,
    apiSalesUpdate,
} from 'services/SalesService'
import {
    calculateLine,
    calculateTotals,
    discountFromSellRate,
    getTaxType,
    round,
    sellRateFromDiscount,
} from './salesCalc'
import { receivableDocUrl } from './salesFiles'

const { DateTimepicker } = DatePicker
const { Tr, Th, Td, THead, TBody, TFoot } = Table

// Sales add / edit (old PHP distributor_out_details.php). Every save goes to Pending for approval;
// editing an Approved sale saves a pending copy that replaces it once approved (Phase 3).

const DELIVERY_STATUSES = ['Pending', 'GP Issued', 'Delivered Not Complete', 'Delivered', 'Cancelled']
const BASIS_OF_SALES = ['PO Number', 'Emails']

const pad = (value) => (value < 10 ? `0${value}` : `${value}`)
const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const toDateTimeString = (date) => `${toDateString(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`

// 'YYYY-MM-DD' as a local date; datetimes from the API come as ISO strings
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

const emptyItem = () => ({
    type: 'Box',
    item_id: '',
    qty: '',
    rate: '',
    disc_per: '',
    sell_rate: '',
    grams: '',
    tax_per: 0,
    sell_margin: 0,
    promo_margin: 0,
})

const initialValues = () => ({
    date_of_processing: toDateString(new Date()),
    depot_id: '',
    distributor_id: '',
    sales_rep_id: '',
    discount: '',
    client_name: '',
    address: '',
    city: '',
    pincode: '',
    state: '',
    state_code: '',
    country: '',
    mobile_no: '',
    gstin: '',
    unique_ref_no: '',
    items: [emptyItem()],
    shipping_charges: '',
    due_date: '',
    reverse_charge: 'no',
    shipping_address: 'yes',
    distributor_consignee_id: '',
    basis_of_sales: '',
    order_no: '',
    order_date: '',
    ref_invoice_no: '',
    ref_invoice_details: '',
    ref_invoice_date: '',
    email_from: '',
    email_approved_by: '',
    email_date_time: '',
    delivery_status: '',
    invoice_date: '',
    remarks: '',
    is_direct: false,
    is_approved: false,
})

const optionalNumber = () => Yup.number().transform((value, original) => (original === '' || original === null ? undefined : value)).typeError('Must be a number')
const requiredNumber = (label) => Yup.number()
    .transform((value, original) => (original === '' || original === null ? undefined : value))
    .typeError(`${label} must be a number`)
    .required(`${label} Is Required`)

const validationSchema = Yup.object().shape({
    date_of_processing: Yup.string().required('Date Is Required'),
    depot_id: Yup.string().required('Depot Is Required'),
    distributor_id: Yup.string().required('Distributor Is Required'),
    discount: optionalNumber().min(0, 'Discount cannot be negative').max(100, 'Discount cannot be more than 100%'),
    due_date: Yup.string().required('Due Date Is Required'),
    shipping_charges: optionalNumber().min(0, 'Shipping Charges cannot be negative'),
    distributor_consignee_id: Yup.string().when('shipping_address', {
        is: 'no',
        then: Yup.string().required('Shipping Address Is Required'),
    }),
    basis_of_sales: Yup.string().required('Basis of Sales Is Required'),
    order_no: Yup.string().when('basis_of_sales', {
        is: 'PO Number',
        then: Yup.string().trim().required('Order No Is Required'),
    }),
    email_from: Yup.string().when('basis_of_sales', {
        is: 'Emails',
        then: Yup.string().trim().email('Please enter a valid email').required('Email from Is Required'),
    }),
    email_date_time: Yup.string().when('basis_of_sales', {
        is: 'Emails',
        then: Yup.string().required('Date time of email Is Required'),
    }),
    state: Yup.string().when('is_direct', {
        is: true,
        then: Yup.string().trim().required('State Is Required'),
    }),
    mobile_no: Yup.string().when('is_direct', {
        is: true,
        then: Yup.string().matches(/^\d*$/, 'Please enter numbers only'),
    }),
    remarks: Yup.string().when('is_approved', {
        is: true,
        then: Yup.string().trim().required('Remarks Is Required'),
    }),
    items: Yup.array()
        .of(
            Yup.object().shape({
                type: Yup.string().required('Type Is Required'),
                item_id: Yup.string().required('Item Is Required'),
                qty: requiredNumber('Qty').moreThan(0, 'Qty must be more than 0'),
                disc_per: optionalNumber().min(0, 'Discount cannot be negative').max(100, 'Discount cannot be more than 100%'),
                sell_rate: requiredNumber('Sell Rate').min(0, 'Sell Rate cannot be negative'),
            })
        )
        .min(1, 'Please add atleast one item.'),
})

// Server errors (duplicate order no, freezed date, ...) stay on their field until that field is changed;
// Formik alone would drop them on the next keystroke anywhere in the form.
const fieldFeedback = (form, name, serverErrors = {}) => {
    const error = getIn(form.errors, name)
    const touch = getIn(form.touched, name)
    const server = serverErrors[name] && serverErrors[name].value === getIn(form.values, name) ? serverErrors[name].message : ''
    return {
        errorMessage: error || server || '',
        invalid: (typeof touch !== 'undefined' && error && touch) || !!server,
    }
}

// Old PHP checks that need data outside the field: billing state of a non-Direct distributor / consignee, zero total
const validateDerived = (values, billingState, finalAmount) => {
    const errors = {}
    if (values.distributor_id && !values.is_direct && !(billingState || '').toString().trim()) {
        errors.distributor_id = values.shipping_address === 'no'
            ? 'The selected shipping address has no state'
            : 'State is not set for this distributor (update it in the Distributor master)'
    }
    const itemsComplete = values.items.length > 0 && values.items.every((item) => item.item_id && +item.qty > 0 && item.sell_rate !== '')
    if (itemsComplete && !(+finalAmount)) {
        errors.total = 'Amount cannot be zero.'
    }
    return errors
}

// Says why nothing happened when Submit finds errors (they can be far down the item table)
const SubmitErrorNotice = ({ submitCount, isValid }) => {
    useEffect(() => {
        if (submitCount > 0 && !isValid) {
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Please correct the highlighted fields.
                </Notification>
            )
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

const Amount = ({ value }) => (
    <NumberFormat
        displayType="text"
        value={value || 0}
        thousandSeparator
        decimalScale={2}
        fixedDecimalScale
    />
)

const AddEditSales = () => {
    const { saleid } = useParams()
    const navigate = useNavigate()
    const formRef = useRef()
    const [loading, setLoading] = useState(true)
    const [formValues, setFormValues] = useState(initialValues())
    const [sale, setSale] = useState(null)
    const [permissions, setPermissions] = useState({ submit: true, delete: false })
    const [consignees, setConsignees] = useState([])
    const [confirmDelete, setConfirmDelete] = useState(false)
    // Old PHP "Upload Receivable" (shown once the sale left Pending): saving with it marks the sale Delivered
    const [receivableFile, setReceivableFile] = useState(null)
    const [serverErrors, setServerErrors] = useState({})
    const [master, setMaster] = useState({
        depots: [],
        distributors: [],
        boxes: [],
        comboBoxes: [],
        bars: [],
        cities: [],
        states: [],
    })
    // Names of inactive masters still used by the sale being edited
    const [extraOptions, setExtraOptions] = useState({ distributor: null, items: {} })

    const options = useMemo(() => {
        const distributors = master.distributors.map((row) => ({ value: row.id, label: row.distributor_name, data: row }))
        if (extraOptions.distributor && !distributors.some((option) => option.value === extraOptions.distributor.value)) {
            distributors.push(extraOptions.distributor)
        }
        const items = {
            Box: master.boxes.map((row) => ({ value: row.id, label: row.box_name })),
            'Combo Box': master.comboBoxes.map((row) => ({ value: row.id, label: row.combo_box_name })),
            Bar: master.bars.map((row) => ({ value: row.id, label: row.product_name })),
        }
        Object.keys(extraOptions.items).forEach((key) => {
            const [type, id] = key.split(':')
            if (items[type] && !items[type].some((option) => option.value === +id)) {
                items[type].push({ value: +id, label: extraOptions.items[key] })
            }
        })
        return {
            depots: master.depots.map((row) => ({ value: row.id, label: row.depot_name, data: row })),
            distributors,
            items,
            cities: master.cities.map((row) => ({ value: row.city_name, label: row.city_name, data: row })),
            states: master.states.map((row) => ({ value: row.state_name, label: row.state_name, data: row })),
            consignees: consignees.map((row) => ({ value: row.id, label: row.address, data: row })),
        }
    }, [master, extraOptions, consignees])

    const loadConsignees = (distributorId) => {
        if (!distributorId) {
            setConsignees([])
            return
        }
        apiSalesConsignees(distributorId)
            .then((res) => setConsignees(res.data['consignees'] || []))
            .catch(() => setConsignees([]))
    }

    useEffect(() => {
        const load = async () => {
            try {
                const masterRes = await apiSalesMasterData()
                setMaster(masterRes.data)

                if (!saleid) {
                    if (!masterRes.data.action || !masterRes.data.action.insert) {
                        showMessage('You do not have access to add sales.')
                        navigate('/transaction/sales')
                    }
                    return
                }

                const saleRes = await apiSalesGetSingle(saleid)
                const { sale: data, items, pendingEditId, permissions: salePermissions } = saleRes.data
                // Old PHP opened the pending copy of an approved sale instead of the sale itself
                if (pendingEditId && +pendingEditId !== +data.id) {
                    showMessage('This sale already has a change waiting for approval. Opening that entry.', 'warning')
                    navigate(`/transaction/sales/edit-sales/${pendingEditId}`, { replace: true })
                    return
                }
                if (!salePermissions || !salePermissions.submit) {
                    showMessage((salePermissions && salePermissions.poMessage) || 'You cannot edit this sale.')
                    navigate(`/transaction/sales/view/${data.id}`, { replace: true })
                    return
                }

                const extraItems = {}
                items.forEach((item) => {
                    extraItems[`${item.type}:${item.item_id}`] = item.item_name
                })
                setExtraOptions({
                    distributor: data.distributor_id ? { value: data.distributor_id, label: data.distributor_name, data } : null,
                    items: extraItems,
                })
                setSale(data)
                setPermissions(salePermissions)
                loadConsignees(data.distributor_id)

                const text = (value) => (value === null || value === undefined ? '' : value)
                setFormValues({
                    ...initialValues(),
                    date_of_processing: dateValue(data.date_of_processing),
                    depot_id: data.depot_id || '',
                    distributor_id: data.distributor_id || '',
                    sales_rep_id: data.sales_rep_id || '',
                    discount: text(data.discount),
                    client_name: text(data.client_name),
                    address: text(data.address),
                    city: text(data.city),
                    pincode: text(data.pincode),
                    state: text(data.state),
                    state_code: text(data.state_code),
                    country: text(data.country),
                    mobile_no: text(data.mobile_no),
                    gstin: text(data.gstin),
                    unique_ref_no: text(data.unique_ref_no),
                    items: items.length
                        ? items.map((item) => ({
                              type: item.type,
                              item_id: item.item_id,
                              qty: text(item.qty),
                              rate: text(item.rate),
                              disc_per: text(item.discount),
                              sell_rate: text(item.sell_rate),
                              grams: text(item.grams),
                              tax_per: +item.tax_percentage || 0,
                              sell_margin: +item.margin_per || 0,
                              promo_margin: +item.promo_margin || 0,
                          }))
                        : [emptyItem()],
                    shipping_charges: text(data.shipping_charges),
                    due_date: dateValue(data.due_date),
                    reverse_charge: data.reverse_charge === 'yes' ? 'yes' : 'no',
                    shipping_address: data.shipping_address === 'no' ? 'no' : 'yes',
                    distributor_consignee_id: data.shipping_address === 'no' ? data.distributor_consignee_id || '' : '',
                    // Old PHP selected PO Number whenever an order no was present
                    basis_of_sales: data.basis_of_sales === 'PO Number' || text(data.order_no) !== '' ? 'PO Number' : text(data.basis_of_sales),
                    order_no: text(data.order_no),
                    order_date: dateValue(data.order_date),
                    ref_invoice_no: text(data.ref_invoice_no),
                    ref_invoice_details: text(data.ref_invoice_details),
                    ref_invoice_date: dateValue(data.ref_invoice_date),
                    email_from: text(data.email_from),
                    email_approved_by: text(data.email_approved_by),
                    email_date_time: data.email_date_time ? toDateTimeString(parseDate(data.email_date_time)) : '',
                    delivery_status: text(data.delivery_status) || 'Pending',
                    invoice_date: dateValue(data.invoice_date),
                    remarks: text(data.remarks),
                    is_direct: (data.class || '').toString().trim().toUpperCase() === 'DIRECT',
                    is_approved: data.status === 'Approved',
                })
            } catch (error) {
                showMessage(error && error.response ? error.response.data['message'] : 'Loading sale failed')
                navigate('/transaction/sales')
            } finally {
                setLoading(false)
            }
        }
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saleid])

    const findDistributor = (id) => {
        const option = options.distributors.find((row) => row.value === +id)
        return option ? option.data : null
    }

    // Billing state: typed for Direct customers, else the consignee's (shipping elsewhere) or the distributor's
    const billingState = (values) => {
        if (values.is_direct) return values.state
        if (values.shipping_address === 'no') {
            const consignee = consignees.find((row) => row.id === +values.distributor_consignee_id)
            if (consignee) return consignee.con_state
        }
        const distributor = findDistributor(values.distributor_id)
        return distributor ? distributor.state : values.state
    }

    const depotState = (values) => {
        const depot = master.depots.find((row) => row.id === +values.depot_id)
        return depot ? depot.state : sale && +sale.depot_id === +values.depot_id ? sale.depot_state : ''
    }

    // Old PHP get_box_details / get_combo_box_details: rate, tax and the distributor's margin;
    // discount = item margin + header discount
    const refreshItem = async (index, type, itemId, distributorId, headerDiscount) => {
        if (!type || !itemId) return
        try {
            const res = await apiSalesItemDetails(type, itemId, distributorId)
            const details = res.data
            // Read the form as it is now: the bag captured before the request still holds the previous item,
            // which made every freshly picked item look stale and its rate / discount / sell rate never filled
            const form = formRef.current
            const current = form.values.items[index]
            if (!current || current.type !== type || +current.item_id !== +itemId) return
            const discPer = round((+details.inv_margin || 0) + (+headerDiscount || 0))
            form.setFieldValue(`items[${index}]`, {
                ...current,
                rate: details.rate,
                grams: details.grams,
                tax_per: details.tax_percentage,
                sell_margin: details.inv_margin,
                promo_margin: details.pro_margin,
                disc_per: discPer,
                sell_rate: sellRateFromDiscount(details.rate, discPer, details.tax_percentage),
            })
        } catch (error) {
            showMessage(error && error.response ? error.response.data['message'] : 'Fetching item details failed')
        }
    }

    const onDistributorChange = (option) => {
        const form = formRef.current
        const distributor = option ? option.data : null
        const direct = !!distributor && (distributor.class || '').toString().trim().toUpperCase() === 'DIRECT'
        const values = form.values

        // Old PHP get_distributor_details: discount = distributor sell out (640 keeps a typed discount, else 25)
        let discount = distributor ? distributor.sell_out : ''
        if (distributor && +distributor.id === 640) {
            discount = values.discount === '' ? 25 : values.discount
        }
        const creditPeriod = distributor && !isNaN(parseInt(distributor.credit_period)) ? parseInt(distributor.credit_period) : 1
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + creditPeriod)

        form.setValues({
            ...values,
            distributor_id: option ? option.value : '',
            sales_rep_id: distributor && distributor.sales_rep_id ? distributor.sales_rep_id : '',
            discount: discount === null || discount === undefined ? '' : discount,
            due_date: toDateString(dueDate),
            distributor_consignee_id: '',
            is_direct: direct,
            state: direct ? values.state : (distributor && distributor.state) || '',
            state_code: direct ? values.state_code : (distributor && distributor.state_code) || '',
        })
        loadConsignees(option ? option.value : '')
        values.items.forEach((item, index) => refreshItem(index, item.type, item.item_id, option ? option.value : '', discount))
    }

    // Old PHP #discount change: discount of every line = its item margin + header discount
    const onDiscountChange = (value) => {
        const form = formRef.current
        form.setFieldValue('discount', value)
        form.setFieldValue(
            'items',
            form.values.items.map((item) => {
                if (!item.item_id) return item
                const discPer = round((+item.sell_margin || 0) + (+value || 0))
                return { ...item, disc_per: discPer, sell_rate: sellRateFromDiscount(item.rate, discPer, item.tax_per) }
            })
        )
    }

    const onSubmit = (values, actions) => {
        setServerErrors({})
        const { is_direct, is_approved, ...payload } = values
        let data = payload
        if (saleid && receivableFile) {
            data = new FormData()
            data.append('payload', JSON.stringify(payload))
            data.append('receivable_doc_file', receivableFile)
        }
        const request = saleid ? apiSalesUpdate({ id: sale.id, values: data }) : apiSalesPost(payload)
        request
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate('/transaction/sales')
            })
            .catch((error) => {
                actions.setSubmitting(false)
                if (!error || !error.response) return
                const errors = error.response.data && error.response.data.error && error.response.data.error.errors
                if (error.response.status === 422 && errors) {
                    // Kept beside the field (with the value it was raised for) until that field changes
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
        apiSalesDelete(sale.id)
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate('/transaction/sales')
            })
            .catch((error) => {
                if (!error || !error.response) return
                const errors = error.response.data && error.response.data.error && error.response.data.error.errors
                if (errors) {
                    Object.keys(errors).forEach((key) => showMessage(errors[key]['message']))
                } else {
                    showMessage(error.response.data['message'])
                }
            })
    }

    const showDeliveryStatus = sale && sale.status !== 'Pending'

    return (
        <Loading loading={loading}>
            <Formik
                innerRef={formRef}
                initialValues={formValues}
                enableReinitialize
                validationSchema={validationSchema}
                validate={(formValues) => {
                    const state = billingState(formValues)
                    const formLines = formValues.items.map((item) => calculateLine(item, getTaxType(depotState(formValues), state)))
                    return validateDerived(formValues, state, calculateTotals(formLines, formValues.shipping_charges).final_amount)
                }}
                onSubmit={onSubmit}
            >
                {({ values, touched, errors, isSubmitting, setFieldValue, submitCount, isValid }) => {
                    const taxType = getTaxType(depotState(values), billingState(values))
                    const lines = values.items.map((item) => calculateLine(item, taxType))
                    const totals = calculateTotals(lines, values.shipping_charges)
                    const fe = (name) => fieldFeedback({ errors, touched, values }, name, serverErrors)
                    // Shown under the item table: no items, zero total (after a submit), and the same from the server
                    const serverListErrors = ['items', 'total']
                        .filter((key) => serverErrors[key] && serverErrors[key].value === getIn(values, key))
                        .map((key) => serverErrors[key].message)
                    const itemsError = [...new Set([
                        typeof errors.items === 'string' ? errors.items : '',
                        submitCount > 0 && typeof errors.total === 'string' ? errors.total : '',
                        ...serverListErrors,
                    ].filter(Boolean))].join(' ')
                    const dateField = (name, label, required, extra = {}) => (
                        <FormItem
                            asterisk={required}
                            label={label}
                            invalid={fe(name).invalid}
                            errorMessage={fe(name).errorMessage}
                        >
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
                    const textField = (name, label, required) => (
                        <FormItem
                            asterisk={required}
                            label={label}
                            invalid={fe(name).invalid}
                            errorMessage={fe(name).errorMessage}
                        >
                            <Field type="text" name={name} placeholder={label} component={Input} />
                        </FormItem>
                    )

                    return (
                        <Form autoComplete="off">
                            <SubmitErrorNotice submitCount={submitCount} isValid={isValid} />
                            <AdaptableCard className="card-shadow mb-2">
                                <div className="flex items-center justify-between mb-6">
                                    <h5>{saleid ? 'Edit' : 'Add'} Sales {sale && sale.invoice_no ? `- ${sale.invoice_no}` : ''}</h5>
                                    {sale ? (
                                        <span className="font-semibold">
                                            {sale.status}{sale.delivery_status ? ` / ${sale.delivery_status}` : ''}
                                        </span>
                                    ) : null}
                                </div>
                                {sale && sale.ref_id ? (
                                    <div className="mb-4 p-3 rounded bg-indigo-50 text-indigo-700 dark:bg-gray-700 dark:text-indigo-300">
                                        {sale.status === 'Deleted' ? 'This is a delete request for ' : 'This is a change waiting for approval to '}
                                        <Link className="underline" to={`/transaction/sales/view/${sale.ref_id}`}>
                                            sale #{sale.ref_id}
                                        </Link>
                                        . Approving it will replace that sale.
                                    </div>
                                ) : null}
                                {sale && sale.status === 'Approved' ? (
                                    <div className="mb-4 p-3 rounded bg-amber-50 text-amber-700 dark:bg-gray-700 dark:text-amber-300">
                                        This sale is approved. Your changes are saved as a copy and replace it only after approval.
                                    </div>
                                ) : null}

                                <FormContainer layout="horizontal" size="sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        {dateField('date_of_processing', 'Date', true, { maxDate: new Date() })}
                                        <FormItem
                                            asterisk
                                            label="Depot"
                                            invalid={fe('depot_id').invalid}
                                            errorMessage={fe('depot_id').errorMessage}
                                        >
                                            <Field name="depot_id">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={options.depots}
                                                        value={options.depots.filter((option) => option.value === +values.depot_id)}
                                                        onChange={(option) => form.setFieldValue(field.name, option ? option.value : '')}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Distributor"
                                            invalid={fe('distributor_id').invalid}
                                            errorMessage={fe('distributor_id').errorMessage}
                                        >
                                            <Field name="distributor_id">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={options.distributors}
                                                        value={options.distributors.filter((option) => option.value === +values.distributor_id)}
                                                        onChange={onDistributorChange}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            label="Discount (In %)"
                                            invalid={fe('discount').invalid}
                                            errorMessage={fe('discount').errorMessage}
                                        >
                                            <Field name="discount">
                                                {({ field }) => (
                                                    <Input
                                                        {...field}
                                                        type="number"
                                                        placeholder="Discount"
                                                        onWheel={(e) => e.target.blur()}
                                                        onChange={(e) => onDiscountChange(e.target.value)}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                    </div>

                                    {values.is_direct ? (
                                        <>
                                            <h6 className="mt-2 mb-4">Customer (Direct)</h6>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                                {textField('client_name', 'Name')}
                                                {textField('address', 'Address')}
                                                <FormItem label="City">
                                                    <Field name="city">
                                                        {({ field, form }) => (
                                                            <Select
                                                                field={field}
                                                                form={form}
                                                                isClearable
                                                                options={options.cities}
                                                                value={values.city ? [{ value: values.city, label: values.city }] : []}
                                                                onChange={(option) => {
                                                                    form.setFieldValue('city', option ? option.value : '')
                                                                    if (option) {
                                                                        form.setFieldValue('state', option.data.state_name || '')
                                                                        form.setFieldValue('state_code', option.data.state_code || '')
                                                                        form.setFieldValue('country', option.data.country_name || '')
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                                {textField('pincode', 'Pincode')}
                                                <FormItem
                                                    asterisk
                                                    label="State"
                                                    invalid={fe('state').invalid}
                                                    errorMessage={fe('state').errorMessage}
                                                >
                                                    <Field name="state">
                                                        {({ field, form }) => (
                                                            <Select
                                                                field={field}
                                                                form={form}
                                                                options={options.states}
                                                                value={values.state ? [{ value: values.state, label: values.state }] : []}
                                                                onChange={(option) => {
                                                                    form.setFieldValue('state', option ? option.value : '')
                                                                    form.setFieldValue('state_code', option ? option.data.state_code || '' : '')
                                                                }}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                                {textField('country', 'Country')}
                                                {textField('mobile_no', 'Mobile No')}
                                                {textField('gstin', 'GSTIN')}
                                                {textField('unique_ref_no', 'Unique Reference No')}
                                            </div>
                                        </>
                                    ) : null}

                                    <div className="mb-2 text-sm text-gray-500">
                                        Billing state: <span className="font-semibold">{billingState(values) || '-'}</span>
                                        {' '}({taxType === 'Intra' ? 'CGST + SGST' : 'IGST'})
                                    </div>
                                    <div className="overflow-x-auto mb-2">
                                        <Table compact className="border">
                                            <THead>
                                                <Tr>
                                                    <Th>Type*</Th>
                                                    <Th>Item*</Th>
                                                    <Th>Qty*</Th>
                                                    <Th>Rate (In Rs)</Th>
                                                    <Th>Discount (In %)*</Th>
                                                    <Th>Sell Rate (In Rs)*</Th>
                                                    <Th>Amount (In Rs)</Th>
                                                    <Th>CGST (In Rs)</Th>
                                                    <Th>SGST (In Rs)</Th>
                                                    <Th>IGST (In Rs)</Th>
                                                    <Th>Tax (In Rs)</Th>
                                                    <Th>Total Amount (In Rs)</Th>
                                                    <Th>Action</Th>
                                                </Tr>
                                            </THead>
                                            <FieldArray name="items">
                                                {({ form, remove, push }) => (
                                                    <>
                                                        <TBody>
                                                            {values.items.map((item, index) => {
                                                                const typeFb = fieldFeedback(form, `items[${index}].type`, serverErrors)
                                                                const itemFb = fieldFeedback(form, `items[${index}].item_id`, serverErrors)
                                                                const qtyFb = fieldFeedback(form, `items[${index}].qty`, serverErrors)
                                                                const sellRateFb = fieldFeedback(form, `items[${index}].sell_rate`, serverErrors)
                                                                const discFb = fieldFeedback(form, `items[${index}].disc_per`, serverErrors)
                                                                const typeOptions = [
                                                                    ...(item.type === 'Bar' ? [{ value: 'Bar', label: 'Bar' }] : []),
                                                                    { value: 'Box', label: 'Box' },
                                                                    { value: 'Combo Box', label: 'Combo Box' },
                                                                ]
                                                                const itemOptions = options.items[item.type] || []
                                                                const line = lines[index]
                                                                return (
                                                                    <Tr key={index}>
                                                                        <Td style={{ minWidth: 130 }}>
                                                                            <FormItem className="mb-0" layout="vertical" invalid={typeFb.invalid} errorMessage={typeFb.errorMessage}>
                                                                                <Select
                                                                                    options={typeOptions}
                                                                                    value={typeOptions.filter((option) => option.value === item.type)}
                                                                                    menuPortalTarget={document.body}
                                                                                    style={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                                                                                    onChange={(option) => setFieldValue(`items[${index}]`, { ...emptyItem(), type: option ? option.value : '', qty: item.qty })}
                                                                                />
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td style={{ minWidth: 260 }}>
                                                                            <FormItem className="mb-0" layout="vertical" invalid={itemFb.invalid} errorMessage={itemFb.errorMessage}>
                                                                                <Select
                                                                                    options={itemOptions}
                                                                                    value={itemOptions.filter((option) => option.value === +item.item_id)}
                                                                                    menuPortalTarget={document.body}
                                                                                    style={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                                                                                    onChange={(option) => {
                                                                                        const itemId = option ? option.value : ''
                                                                                        setFieldValue(`items[${index}].item_id`, itemId)
                                                                                        refreshItem(index, item.type, itemId, values.distributor_id, values.discount)
                                                                                    }}
                                                                                />
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td style={{ minWidth: 90 }}>
                                                                            <FormItem className="mb-0" layout="vertical" invalid={qtyFb.invalid} errorMessage={qtyFb.errorMessage}>
                                                                                <Field
                                                                                    name={`items[${index}].qty`}
                                                                                    type="number"
                                                                                    placeholder="Qty"
                                                                                    onWheel={(e) => e.target.blur()}
                                                                                    invalid={qtyFb.invalid}
                                                                                    component={Input}
                                                                                />
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td><Amount value={item.rate} /></Td>
                                                                        <Td style={{ minWidth: 90 }}>
                                                                            <FormItem className="mb-0" layout="vertical" invalid={discFb.invalid} errorMessage={discFb.errorMessage}>
                                                                                <Field name={`items[${index}].disc_per`}>
                                                                                    {({ field }) => (
                                                                                        <Input
                                                                                            {...field}
                                                                                            type="number"
                                                                                            placeholder="Discount"
                                                                                            invalid={discFb.invalid}
                                                                                            onWheel={(e) => e.target.blur()}
                                                                                            onBlur={(e) => {
                                                                                                field.onBlur(e)
                                                                                                setFieldValue(`items[${index}].sell_rate`, sellRateFromDiscount(item.rate, e.target.value, item.tax_per))
                                                                                            }}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td style={{ minWidth: 110 }}>
                                                                            <FormItem className="mb-0" layout="vertical" invalid={sellRateFb.invalid} errorMessage={sellRateFb.errorMessage}>
                                                                                <Field name={`items[${index}].sell_rate`}>
                                                                                    {({ field }) => (
                                                                                        <Input
                                                                                            {...field}
                                                                                            type="number"
                                                                                            placeholder="Sell Rate"
                                                                                            invalid={sellRateFb.invalid}
                                                                                            onWheel={(e) => e.target.blur()}
                                                                                            onBlur={(e) => {
                                                                                                field.onBlur(e)
                                                                                                setFieldValue(`items[${index}].disc_per`, discountFromSellRate(item.rate, e.target.value, item.tax_per))
                                                                                            }}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td><Amount value={line.amount} /></Td>
                                                                        <Td><Amount value={line.cgst_amt} /></Td>
                                                                        <Td><Amount value={line.sgst_amt} /></Td>
                                                                        <Td><Amount value={line.igst_amt} /></Td>
                                                                        <Td><Amount value={line.tax_amt} /></Td>
                                                                        <Td><Amount value={line.total_amt} /></Td>
                                                                        <Td>
                                                                            <Button
                                                                                type="button"
                                                                                shape="circle"
                                                                                size="sm"
                                                                                icon={<HiMinus />}
                                                                                onClick={() => remove(index)}
                                                                            />
                                                                        </Td>
                                                                    </Tr>
                                                                )
                                                            })}
                                                        </TBody>
                                                        <TFoot>
                                                            <Tr>
                                                                <Td colSpan={6}>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="twoTone"
                                                                        icon={<HiPlus />}
                                                                        onClick={() => push(emptyItem())}
                                                                    >
                                                                        Add Item
                                                                    </Button>
                                                                    {itemsError ? <span className="ml-4 text-red-500">{itemsError}</span> : null}
                                                                </Td>
                                                                <Td className="font-semibold"><Amount value={totals.amount} /></Td>
                                                                <Td className="font-semibold"><Amount value={totals.cgst_amount} /></Td>
                                                                <Td className="font-semibold"><Amount value={totals.sgst_amount} /></Td>
                                                                <Td className="font-semibold"><Amount value={totals.igst_amount} /></Td>
                                                                <Td className="font-semibold"><Amount value={totals.tax_amount} /></Td>
                                                                <Td className="font-semibold"><Amount value={totals.final_amount} /></Td>
                                                                <Td></Td>
                                                            </Tr>
                                                        </TFoot>
                                                    </>
                                                )}
                                            </FieldArray>
                                        </Table>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        <FormItem
                                            label="Shipping Charges"
                                            invalid={fe('shipping_charges').invalid}
                                            errorMessage={fe('shipping_charges').errorMessage}
                                        >
                                            <Field name="shipping_charges" type="number" placeholder="Shipping Charges" onWheel={(e) => e.target.blur()} component={Input} />
                                        </FormItem>
                                        <FormItem label="Round Off Amount (In Rs)">
                                            <div className="pt-2 font-semibold"><Amount value={totals.round_off_amount} /></div>
                                        </FormItem>
                                        <FormItem label="Invoice Amount (In Rs)">
                                            <div className="pt-2 font-bold text-lg"><Amount value={totals.invoice_amount} /></div>
                                        </FormItem>
                                        {dateField('due_date', 'Due Date', true)}
                                        <FormItem label="Reverse Charge" asterisk>
                                            <Field name="reverse_charge">
                                                {({ field, form }) => (
                                                    <Radio.Group value={field.value} onChange={(val) => form.setFieldValue(field.name, val)}>
                                                        <Radio value="yes">Yes</Radio>
                                                        <Radio value="no">No</Radio>
                                                    </Radio.Group>
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem label="Shipping Address Same As Billing" asterisk>
                                            <Field name="shipping_address">
                                                {({ field, form }) => (
                                                    <Radio.Group
                                                        value={field.value}
                                                        onChange={(val) => {
                                                            form.setFieldValue(field.name, val)
                                                            if (val === 'yes') form.setFieldValue('distributor_consignee_id', '')
                                                        }}
                                                    >
                                                        <Radio value="yes">Yes</Radio>
                                                        <Radio value="no">No</Radio>
                                                    </Radio.Group>
                                                )}
                                            </Field>
                                        </FormItem>
                                        {values.shipping_address === 'no' ? (
                                            <FormItem
                                                asterisk
                                                label="Shipping Address"
                                                invalid={fe('distributor_consignee_id').invalid}
                                                errorMessage={fe('distributor_consignee_id').errorMessage}
                                            >
                                                <Field name="distributor_consignee_id">
                                                    {({ field, form }) => (
                                                        <Select
                                                            field={field}
                                                            form={form}
                                                            options={options.consignees}
                                                            noOptionsMessage={() => 'No shipping addresses for this distributor'}
                                                            value={options.consignees.filter((option) => option.value === +values.distributor_consignee_id)}
                                                            onChange={(option) => form.setFieldValue(field.name, option ? option.value : '')}
                                                        />
                                                    )}
                                                </Field>
                                            </FormItem>
                                        ) : null}
                                        <FormItem
                                            asterisk
                                            label="Basis of Sales"
                                            invalid={fe('basis_of_sales').invalid}
                                            errorMessage={fe('basis_of_sales').errorMessage}
                                        >
                                            <Field name="basis_of_sales">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={BASIS_OF_SALES.map((value) => ({ value, label: value }))}
                                                        value={values.basis_of_sales ? [{ value: values.basis_of_sales, label: values.basis_of_sales }] : []}
                                                        onChange={(option) => form.setFieldValue(field.name, option ? option.value : '')}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                    </div>

                                    {values.basis_of_sales === 'PO Number' ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                            {textField('order_no', 'Order No', true)}
                                            {dateField('order_date', 'Order Date', false)}
                                            {textField('ref_invoice_no', 'Reference Invoice No')}
                                            {textField('ref_invoice_details', 'Reference Invoice Details')}
                                            {dateField('ref_invoice_date', 'Reference Invoice Date', false)}
                                        </div>
                                    ) : null}
                                    {values.basis_of_sales === 'Emails' ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                            {textField('email_from', 'Email from', true)}
                                            {textField('email_approved_by', 'Approved By')}
                                            <FormItem
                                                asterisk
                                                label="Date time of email"
                                                invalid={fe('email_date_time').invalid}
                                                errorMessage={fe('email_date_time').errorMessage}
                                            >
                                                <Field name="email_date_time">
                                                    {({ field, form }) => (
                                                        <DateTimepicker
                                                            field={field}
                                                            form={form}
                                                            amPm
                                                            placeholder="Date time of email"
                                                            inputFormat="DD/MM/YYYY hh:mm A"
                                                            value={field.value ? new Date(field.value.replace(' ', 'T')) : null}
                                                            onChange={(date) => form.setFieldValue(field.name, date ? toDateTimeString(new Date(date)) : '')}
                                                        />
                                                    )}
                                                </Field>
                                            </FormItem>
                                        </div>
                                    ) : null}

                                    {sale ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                            {showDeliveryStatus ? (
                                                <>
                                                    <FormItem label="Delivery Status">
                                                        <Field name="delivery_status">
                                                            {({ field, form }) => (
                                                                <Select
                                                                    field={field}
                                                                    form={form}
                                                                    options={DELIVERY_STATUSES.map((value) => ({ value, label: value }))}
                                                                    value={values.delivery_status ? [{ value: values.delivery_status, label: values.delivery_status }] : []}
                                                                    onChange={(option) => form.setFieldValue(field.name, option ? option.value : 'Pending')}
                                                                />
                                                            )}
                                                        </Field>
                                                    </FormItem>
                                                    <FormItem label="Delivery Date">
                                                        <div className="pt-2">{sale.delivery_date ? dateValue(sale.delivery_date).split('-').reverse().join('/') : '-'}</div>
                                                    </FormItem>
                                                    <FormItem label="Upload Receivable" extra={receivableFile ? 'The sale is marked Delivered when saved' : null}>
                                                        <div className="flex items-center gap-3 pt-1">
                                                            <input
                                                                type="file"
                                                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                                                                className="text-sm"
                                                                onChange={(e) => setReceivableFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                                                            />
                                                            {sale.receivable_doc ? (
                                                                <a href={receivableDocUrl(sale.receivable_doc)} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm">
                                                                    Current
                                                                </a>
                                                            ) : null}
                                                        </div>
                                                    </FormItem>
                                                </>
                                            ) : null}
                                            {dateField('invoice_date', 'Invoice Date', false, { maxDate: new Date() })}
                                        </div>
                                    ) : null}

                                    <FormItem
                                        asterisk={values.is_approved}
                                        label="Remarks"
                                        invalid={fe('remarks').invalid}
                                        errorMessage={fe('remarks').errorMessage}
                                    >
                                        <Field name="remarks" placeholder="Remarks" textArea component={Input} />
                                    </FormItem>
                                </FormContainer>
                            </AdaptableCard>

                            <StickyFooter
                                className="px-8 flex items-center justify-end py-4"
                                stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                            >
                                <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => navigate('/transaction/sales')}>
                                    Cancel
                                </Button>
                                {sale && permissions.delete ? (
                                    <Button
                                        size="sm"
                                        className="ltr:mr-3 rtl:ml-3"
                                        variant="solid"
                                        color="red-600"
                                        type="button"
                                        onClick={() => setConfirmDelete(true)}
                                    >
                                        Delete
                                    </Button>
                                ) : null}
                                <Button size="sm" variant="solid" loading={isSubmitting} type="submit">
                                    Submit For Approval
                                </Button>
                            </StickyFooter>
                        </Form>
                    )
                }}
            </Formik>
            <ConfirmDialog
                isOpen={confirmDelete}
                closable={false}
                type="danger"
                title="Delete Sale"
                onClose={() => setConfirmDelete(false)}
                onRequestClose={() => setConfirmDelete(false)}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={onDeleteConfirm}
                confirmButtonColor="red-600"
            >
                <p>
                    {sale && sale.status === 'Approved'
                        ? 'This sale is approved. A delete request will be sent for approval; the sale is cancelled once it is approved.'
                        : 'This entry will be cancelled. Continue?'}
                </p>
            </ConfirmDialog>
        </Loading>
    )
}

export default AddEditSales
