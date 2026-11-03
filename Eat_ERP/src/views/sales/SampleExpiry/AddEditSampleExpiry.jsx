import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Checkbox from 'components/ui/Checkbox'
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
    apiSampleDelete,
    apiSampleGetSingle,
    apiSampleItemDetails,
    apiSampleMasterData,
    apiSamplePost,
    apiSampleUpdate,
} from 'services/SampleExpiryService'
import { receivableDocUrl } from '../Sales/salesFiles'

const { Tr, Th, Td, THead, TBody, TFoot } = Table

// Sample / Expiry add / edit (old PHP sample_out_details.php). Items are valued at cost less the discount, without tax.
// Every save goes to Pending for approval; editing an Approved entry saves a copy that replaces it once approved.

const SAMPLE_TYPES = ['Gifting', 'Promoter', 'Blogger']
const DELIVERY_STATUSES = ['Pending', 'GP Issued', 'Delivered Not Complete', 'Delivered', 'Cancelled']

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
const round2 = (value) => Math.round((+value || 0) * 100) / 100
const sellRateFor = (rate, discount) => round2((+rate || 0) - ((+rate || 0) * (+discount || 0)) / 100)

// Due date = today + the Sample distributor's credit period (old PHP get_distributor_details)
const defaultDueDate = (creditPeriod) => {
    const days = isNaN(parseInt(creditPeriod)) ? 1 : parseInt(creditPeriod)
    const date = new Date()
    date.setDate(date.getDate() + days)
    return toDateString(date)
}

const emptyItem = () => ({ type: 'Box', item_id: '', qty: '', rate: '', sell_rate: '', grams: '' })

const initialValues = () => ({
    expiry: false,
    date_of_processing: toDateString(new Date()),
    depot_id: '',
    sales_rep_id: '',
    sample_distributor_id: '',
    sample_type: '',
    gifting_remarks: '',
    promoter_sales_rep_id: '',
    blogger_name: '',
    blogger_address: '',
    blogger_phone_no: '',
    blogger_email_id: '',
    discount: '',
    items: [emptyItem()],
    due_date: '',
    supplier_ref: '',
    despatch_doc_no: '',
    despatch_through: '',
    destination: '',
    delivery_status: '',
    remarks: '',
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
    sales_rep_id: Yup.string().required('Sales Representative Is Required'),
    sample_distributor_id: Yup.string().when('expiry', {
        is: false,
        then: Yup.string().required('Distributor Is Required'),
    }),
    blogger_email_id: Yup.string().when('sample_type', {
        is: 'Blogger',
        then: Yup.string().trim().email('Please enter a valid email'),
    }),
    discount: optionalNumber().min(0, 'Discount cannot be negative').max(100, 'Discount cannot be more than 100%'),
    due_date: Yup.string().required('Due Date Is Required'),
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
                sell_rate: requiredNumber('Sell Rate').min(0, 'Sell Rate cannot be negative'),
            })
        )
        .min(1, 'Please add atleast one item.'),
})

// Server errors stay on their field until that field changes
const fieldFeedback = (form, name, serverErrors = {}) => {
    const error = getIn(form.errors, name)
    const touch = getIn(form.touched, name)
    const server = serverErrors[name] && serverErrors[name].value === getIn(form.values, name) ? serverErrors[name].message : ''
    return {
        errorMessage: error || server || '',
        invalid: (typeof touch !== 'undefined' && error && touch) || !!server,
    }
}

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
    <NumberFormat displayType="text" value={value || 0} thousandSeparator decimalScale={2} fixedDecimalScale />
)

const AddEditSampleExpiry = () => {
    const { sampleid } = useParams()
    const navigate = useNavigate()
    const formRef = useRef()
    const [loading, setLoading] = useState(true)
    const [formValues, setFormValues] = useState(initialValues())
    const [sale, setSale] = useState(null)
    const [permissions, setPermissions] = useState({ submit: true, delete: false })
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [receivableFile, setReceivableFile] = useState(null)
    const [serverErrors, setServerErrors] = useState({})
    const [master, setMaster] = useState({ depots: [], distributors: [], salesReps: [], promoters: [], boxes: [], comboBoxes: [], bars: [] })
    // Names of inactive masters still used by the entry being edited
    const [extraOptions, setExtraOptions] = useState({})

    const options = useMemo(() => {
        const withExtra = (list, key) => {
            const extra = extraOptions[key]
            return extra && !list.some((option) => option.value === extra.value) ? [...list, extra] : list
        }
        const items = {
            Box: master.boxes.map((row) => ({ value: row.id, label: row.box_name })),
            'Combo Box': master.comboBoxes.map((row) => ({ value: row.id, label: row.combo_box_name })),
            Bar: master.bars.map((row) => ({ value: row.id, label: row.product_name })),
        }
        Object.keys(extraOptions.items || {}).forEach((key) => {
            const [type, id] = key.split(':')
            if (items[type] && !items[type].some((option) => option.value === +id)) {
                items[type].push({ value: +id, label: extraOptions.items[key] })
            }
        })
        return {
            depots: master.depots.map((row) => ({ value: row.id, label: row.depot_name })),
            distributors: withExtra(master.distributors.map((row) => ({ value: row.id, label: row.distributor_name })), 'distributor'),
            salesReps: withExtra(master.salesReps.map((row) => ({ value: row.id, label: row.sales_rep_name })), 'salesRep'),
            promoters: withExtra(master.promoters.map((row) => ({ value: row.id, label: row.sales_rep_name })), 'promoter'),
            items,
        }
    }, [master, extraOptions])

    useEffect(() => {
        const load = async () => {
            try {
                const masterRes = await apiSampleMasterData()
                setMaster(masterRes.data)

                if (!sampleid) {
                    if (!masterRes.data.action || !masterRes.data.action.insert) {
                        showMessage('You do not have access to add Sample / Expiry.')
                        navigate('/transaction/sample-expiry')
                        return
                    }
                    setFormValues({ ...initialValues(), due_date: defaultDueDate(masterRes.data.sampleCreditPeriod) })
                    return
                }

                const res = await apiSampleGetSingle(sampleid)
                const { sale: data, items, pendingEditId, permissions: entryPermissions } = res.data
                if (pendingEditId && +pendingEditId !== +data.id) {
                    showMessage('This entry already has a change waiting for approval. Opening that entry.', 'warning')
                    navigate(`/transaction/sample-expiry/edit-sample-expiry/${pendingEditId}`, { replace: true })
                    return
                }
                if (!entryPermissions || !entryPermissions.submit) {
                    showMessage((entryPermissions && entryPermissions.poMessage) || 'You cannot edit this entry.')
                    navigate(`/transaction/sample-expiry/view/${data.id}`, { replace: true })
                    return
                }

                const extraItems = {}
                items.forEach((item) => {
                    extraItems[`${item.type}:${item.item_id}`] = item.item_name
                })
                setExtraOptions({
                    distributor: data.sample_distributor_id && !data.expiry ? { value: data.sample_distributor_id, label: data.distributor_name } : null,
                    salesRep: data.sales_rep_id ? { value: data.sales_rep_id, label: data.sales_rep_name } : null,
                    promoter: data.promoter_sales_rep_id ? { value: data.promoter_sales_rep_id, label: data.promoter_name } : null,
                    items: extraItems,
                })
                setSale(data)
                setPermissions(entryPermissions)

                const text = (value) => (value === null || value === undefined ? '' : value)
                setFormValues({
                    ...initialValues(),
                    expiry: !!data.expiry,
                    date_of_processing: dateValue(data.date_of_processing),
                    depot_id: data.depot_id || '',
                    sales_rep_id: data.sales_rep_id || '',
                    sample_distributor_id: data.expiry ? '' : data.sample_distributor_id || '',
                    sample_type: text(data.sample_type),
                    gifting_remarks: text(data.gifting_remarks),
                    promoter_sales_rep_id: data.promoter_sales_rep_id || '',
                    blogger_name: text(data.blogger_name),
                    blogger_address: text(data.blogger_address),
                    blogger_phone_no: text(data.blogger_phone_no),
                    blogger_email_id: text(data.blogger_email_id),
                    discount: text(data.discount),
                    items: items.length
                        ? items.map((item) => ({
                              type: item.type,
                              item_id: item.item_id,
                              qty: text(item.qty),
                              rate: text(item.rate),
                              sell_rate: text(item.sell_rate),
                              grams: text(item.grams),
                          }))
                        : [emptyItem()],
                    due_date: dateValue(data.due_date),
                    supplier_ref: text(data.supplier_ref),
                    despatch_doc_no: text(data.despatch_doc_no),
                    despatch_through: text(data.despatch_through),
                    destination: text(data.destination),
                    delivery_status: text(data.delivery_status) || 'Pending',
                    remarks: text(data.remarks),
                    is_approved: data.status === 'Approved',
                })
            } catch (error) {
                showMessage(error && error.response ? error.response.data['message'] : 'Loading failed')
                navigate('/transaction/sample-expiry')
            } finally {
                setLoading(false)
            }
        }
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sampleid])

    // Old PHP get_box_details / get_combo_box_details: cost (combo: rate) and grams; sell rate = cost less the discount
    const refreshItem = async (index, type, itemId) => {
        if (!type || !itemId) return
        try {
            const res = await apiSampleItemDetails(type, itemId)
            const form = formRef.current
            const current = form.values.items[index]
            if (!current || current.type !== type || +current.item_id !== +itemId) return
            form.setFieldValue(`items[${index}]`, {
                ...current,
                rate: res.data.rate,
                grams: res.data.grams,
                sell_rate: sellRateFor(res.data.rate, form.values.discount),
            })
        } catch (error) {
            showMessage(error && error.response ? error.response.data['message'] : 'Fetching item details failed')
        }
    }

    const onDiscountChange = (value) => {
        const form = formRef.current
        form.setFieldValue('discount', value)
        form.setFieldValue('items', form.values.items.map((item) => (item.item_id ? { ...item, sell_rate: sellRateFor(item.rate, value) } : item)))
    }

    const onSubmit = (values, actions) => {
        setServerErrors({})
        const { is_approved, ...payload } = values
        let data = payload
        if (sampleid && receivableFile) {
            data = new FormData()
            data.append('payload', JSON.stringify(payload))
            data.append('receivable_doc_file', receivableFile)
        }
        const request = sampleid ? apiSampleUpdate(sale.id, data) : apiSamplePost(payload)
        request
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate('/transaction/sample-expiry')
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
        apiSampleDelete(sale.id)
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate('/transaction/sample-expiry')
            })
            .catch((error) => {
                if (!error || !error.response) return
                const errors = error.response.data && error.response.data.error && error.response.data.error.errors
                showMessage(errors ? Object.values(errors).map((item) => item.message).join(', ') : error.response.data['message'])
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
                    // Old PHP: "Amount cannot be zero."
                    const complete = formValues.items.length > 0 && formValues.items.every((item) => item.item_id && +item.qty > 0 && item.sell_rate !== '')
                    const total = formValues.items.reduce((sum, item) => sum + round2((+item.qty || 0) * (+item.sell_rate || 0)), 0)
                    return complete && round2(total) === 0 ? { total: 'Amount cannot be zero.' } : {}
                }}
                onSubmit={onSubmit}
            >
                {({ values, touched, errors, isSubmitting, setFieldValue, submitCount, isValid }) => {
                    const lineAmounts = values.items.map((item) => round2((+item.qty || 0) * (+item.sell_rate || 0)))
                    const total = round2(lineAmounts.reduce((sum, amount) => sum + amount, 0))
                    const fe = (name) => fieldFeedback({ errors, touched, values }, name, serverErrors)
                    const serverListErrors = ['items', 'total']
                        .filter((key) => serverErrors[key] && serverErrors[key].value === getIn(values, key))
                        .map((key) => serverErrors[key].message)
                    const itemsError = [...new Set([
                        typeof errors.items === 'string' ? errors.items : '',
                        submitCount > 0 && typeof errors.total === 'string' ? errors.total : '',
                        ...serverListErrors,
                    ].filter(Boolean))].join(' ')

                    const dateField = (name, label, required, extra = {}) => (
                        <FormItem asterisk={required} label={label} invalid={fe(name).invalid} errorMessage={fe(name).errorMessage}>
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
                        <FormItem asterisk={required} label={label} invalid={fe(name).invalid} errorMessage={fe(name).errorMessage}>
                            <Field type="text" name={name} placeholder={label} component={Input} />
                        </FormItem>
                    )
                    const selectField = (name, label, list, required, onChange) => (
                        <FormItem asterisk={required} label={label} invalid={fe(name).invalid} errorMessage={fe(name).errorMessage}>
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
                                    <h5>{sampleid ? 'Edit' : 'Add'} Sample / Expiry {sale && sale.voucher_no ? `- ${sale.voucher_no}` : ''}</h5>
                                    {sale ? (
                                        <span className="font-semibold">{sale.status}{sale.delivery_status ? ` / ${sale.delivery_status}` : ''}</span>
                                    ) : null}
                                </div>
                                {sale && sale.ref_id ? (
                                    <div className="mb-4 p-3 rounded bg-indigo-50 text-indigo-700 dark:bg-gray-700 dark:text-indigo-300">
                                        {sale.status === 'Deleted' ? 'This is a delete request for ' : 'This is a change waiting for approval to '}
                                        <Link className="underline" to={`/transaction/sample-expiry/view/${sale.ref_id}`}>entry #{sale.ref_id}</Link>
                                        . Approving it will replace that entry.
                                    </div>
                                ) : null}
                                {sale && sale.status === 'Approved' ? (
                                    <div className="mb-4 p-3 rounded bg-amber-50 text-amber-700 dark:bg-gray-700 dark:text-amber-300">
                                        This entry is approved. Your changes are saved as a copy and replace it only after approval.
                                    </div>
                                ) : null}

                                <FormContainer layout="horizontal" size="sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        <FormItem label="Expiry">
                                            <Checkbox
                                                checked={!!values.expiry}
                                                onChange={(checked) => {
                                                    setFieldValue('expiry', checked)
                                                    if (checked) setFieldValue('sample_distributor_id', '')
                                                }}
                                            >
                                                Product expired (sent to 'Product Expired')
                                            </Checkbox>
                                        </FormItem>
                                        {dateField('date_of_processing', 'Date', true, { maxDate: new Date() })}
                                        {selectField('depot_id', 'Depot', options.depots, true)}
                                        {selectField('sales_rep_id', 'Sales Representative', options.salesReps, true)}
                                        {values.expiry ? (
                                            <FormItem label="Distributor">
                                                <div className="pt-2 font-semibold">Product Expired</div>
                                            </FormItem>
                                        ) : selectField('sample_distributor_id', 'Distributor', options.distributors, true)}
                                        {selectField('sample_type', 'Type', SAMPLE_TYPES.map((value) => ({ value, label: value })), false, (option) => setFieldValue('sample_type', option ? option.value : ''))}
                                        {values.sample_type === 'Gifting' ? textField('gifting_remarks', 'Gifting Remarks') : null}
                                        {values.sample_type === 'Promoter' ? selectField('promoter_sales_rep_id', 'Promoter Sales Representative', options.promoters, false) : null}
                                        {values.sample_type === 'Blogger' ? (
                                            <>
                                                {textField('blogger_name', 'Blogger Name')}
                                                {textField('blogger_address', 'Blogger Address')}
                                                {textField('blogger_phone_no', 'Blogger Phone No')}
                                                {textField('blogger_email_id', 'Blogger Email Id')}
                                            </>
                                        ) : null}
                                        <FormItem label="Discount (In %)" invalid={fe('discount').invalid} errorMessage={fe('discount').errorMessage}>
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

                                    <div className="overflow-x-auto mb-2">
                                        <Table compact className="border">
                                            <THead>
                                                <Tr>
                                                    <Th>Type*</Th>
                                                    <Th>Item*</Th>
                                                    <Th>Qty*</Th>
                                                    <Th>Rate (In Rs)</Th>
                                                    <Th>Sell Rate (In Rs)*</Th>
                                                    <Th>Amount (In Rs)</Th>
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
                                                                const typeOptions = [
                                                                    ...(item.type === 'Bar' ? [{ value: 'Bar', label: 'Bar' }] : []),
                                                                    { value: 'Box', label: 'Box' },
                                                                    { value: 'Combo Box', label: 'Combo Box' },
                                                                ]
                                                                const itemOptions = options.items[item.type] || []
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
                                                                                        refreshItem(index, item.type, itemId)
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
                                                                        <Td style={{ minWidth: 110 }}>
                                                                            <FormItem className="mb-0" layout="vertical" invalid={sellRateFb.invalid} errorMessage={sellRateFb.errorMessage}>
                                                                                <Field
                                                                                    name={`items[${index}].sell_rate`}
                                                                                    type="number"
                                                                                    placeholder="Sell Rate"
                                                                                    onWheel={(e) => e.target.blur()}
                                                                                    invalid={sellRateFb.invalid}
                                                                                    component={Input}
                                                                                />
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td><Amount value={lineAmounts[index]} /></Td>
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
                                                                    <Button type="button" size="sm" variant="twoTone" icon={<HiPlus />} onClick={() => push(emptyItem())}>
                                                                        Add Item
                                                                    </Button>
                                                                    {itemsError ? <span className="ml-4 text-red-500">{itemsError}</span> : null}
                                                                </Td>
                                                                <Td className="font-semibold"><Amount value={total} /></Td>
                                                                <Td></Td>
                                                            </Tr>
                                                        </TFoot>
                                                    </>
                                                )}
                                            </FieldArray>
                                        </Table>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        {dateField('due_date', 'Due Date', true)}
                                        {textField('supplier_ref', 'Supplier Ref')}
                                        {textField('despatch_doc_no', 'Dispatch Doc No')}
                                        {textField('despatch_through', 'Dispatch Through')}
                                        {textField('destination', 'Destination')}
                                        {showDeliveryStatus ? (
                                            <>
                                                {selectField('delivery_status', 'Delivery Status', DELIVERY_STATUSES.map((value) => ({ value, label: value })), false)}
                                                <FormItem label="Delivery Date">
                                                    <div className="pt-2">{sale.delivery_date ? dateValue(sale.delivery_date).split('-').reverse().join('/') : '-'}</div>
                                                </FormItem>
                                                <FormItem label="Upload Receivable" extra={receivableFile ? 'The entry is marked Delivered when saved' : null}>
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
                                    </div>

                                    <FormItem asterisk={values.is_approved} label="Remarks" invalid={fe('remarks').invalid} errorMessage={fe('remarks').errorMessage}>
                                        <Field name="remarks" placeholder="Remarks" textArea component={Input} />
                                    </FormItem>
                                </FormContainer>
                            </AdaptableCard>

                            <StickyFooter
                                className="px-8 flex items-center justify-end py-4"
                                stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                            >
                                <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => navigate('/transaction/sample-expiry')}>
                                    Cancel
                                </Button>
                                {sale && permissions.delete ? (
                                    <Button size="sm" className="ltr:mr-3 rtl:ml-3" variant="solid" color="red-600" type="button" onClick={() => setConfirmDelete(true)}>
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
                title="Delete Sample / Expiry"
                onClose={() => setConfirmDelete(false)}
                onRequestClose={() => setConfirmDelete(false)}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={onDeleteConfirm}
                confirmButtonColor="red-600"
            >
                <p>
                    {sale && sale.status === 'Approved'
                        ? 'This entry is approved. A delete request will be sent for approval; it is cancelled once approved.'
                        : 'This entry will be cancelled. Continue?'}
                </p>
            </ConfirmDialog>
        </Loading>
    )
}

export default AddEditSampleExpiry
