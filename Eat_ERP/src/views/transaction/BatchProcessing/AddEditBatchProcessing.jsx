import React, { useEffect, useRef, useState } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import DatePicker from 'components/ui/DatePicker'
import Dialog from 'components/ui/Dialog'
import Button from 'components/ui/Buttons'
import Loading from 'components/shared/Loading'
import StickyFooter from 'components/shared/StickyFooter'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import Table from 'components/ui/Table'
import { Field, Form, Formik, getIn } from 'formik'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { HiOutlineTrash, HiPlusCircle } from 'react-icons/hi'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiBatchNoPost,
    apiBatchProcessingApprove,
    apiBatchProcessingBarcodes,
    apiBatchProcessingDelete,
    apiBatchProcessingGetSingle,
    apiBatchProcessingMasterData,
    apiBatchProcessingPost,
    apiBatchProcessingPrint,
    apiBatchProcessingRecipe,
    apiBatchProcessingReject,
    apiBatchProcessingUpdate,
} from 'services/BatchProcessingService'

const { Tr, Th, Td, THead, TBody } = Table

// Batch Processing add / edit (old PHP batch_processing_details.php). Choosing the product and No. of Batches fills the
// recipe's materials and boxes; the output and wastage figures follow as the actuals are typed. Approval posts the
// stock and prints the receipt. Entries from the Production screens open read only.

const LIST = '/transaction/batch-processing'
const NOT_AVAILABLE = { value: 'NA', label: 'Not Available' }

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
const round = (value, decimals = 2) => Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
const text = (value) => (value === null || value === undefined ? '' : String(value))
const blank = (value) => !text(value).trim()

let nextKey = 0
const withKey = (row) => ({ ...row, key: ++nextKey })
const emptyMaterial = () => withKey({ raw_material_id: '', rm_name: '', batch_qty: '', qty: '', barcode: '', added: true })
const emptyPackaging = () => withKey({ raw_material_id: '', rm_name: '', qty: '', added: true })

const initialValues = () => ({
    batch_no_id: '',
    date_of_processing: toDateString(new Date()),
    depot_id: '',
    product_id: '',
    no_of_batch: '',
    raw_materials: [emptyMaterial()],
    variations: [],
    packaging: 0,
    packaging_materials: [],
    qty_in_bar: '',
    actual_wastage: '',
    actual_water_loss: '',
    remarks: '',
})

// Old PHP get_wastage (the server works the same figures out when saving)
const calculate = (values, product) => {
    const totalQty = values.raw_materials.reduce((sum, row) => sum + num(row.qty), 0)
    const qtyInBar = num(values.qty_in_bar)
    const actualWastage = num(values.actual_wastage)
    const actualWaterLoss = num(values.actual_water_loss)
    const gramsInBar = product ? num(product.avg_grams) : 0
    const anticipatedWastage = product ? num(product.anticipated_wastage) : 0
    const anticipatedWaterLoss = product ? num(product.anticipated_water_loss) : 0
    const outputKg = totalQty - (totalQty * (anticipatedWastage + anticipatedWaterLoss)) / 100
    const outputBars = gramsInBar ? (outputKg * 1000) / gramsInBar : 0
    const differenceInBars = outputBars - qtyInBar
    const totalWastage = (differenceInBars * gramsInBar) / 1000 + actualWastage + actualWaterLoss
    return {
        total_kg: round(totalQty),
        anticipated_wastage: round(anticipatedWastage),
        anticipated_water_loss: round(anticipatedWaterLoss),
        anticipated_output_in_kg: round(outputKg),
        anticipated_grams: round(gramsInBar),
        anticipated_output_in_bars: round(outputBars),
        avg_grams: round(qtyInBar ? (outputKg * 1000) / qtyInBar : 0),
        difference_in_bars: round(differenceInBars),
        total_wastage: round(totalWastage),
        actual_wastage_percent: round(totalQty ? (totalWastage / totalQty) * 100 : 0),
    }
}

// Old PHP validations.js form_batch_processing_details. It listed the barcode as required, but never checked it (the
// searchable box did not count as visible), and the entries saved in PHP have none, so it stays optional here.
const validate = (record) => (values) => {
    const errors = {}
    if (!values.batch_no_id) errors.batch_no_id = 'Batch No Is Required'
    if (!values.date_of_processing) errors.date_of_processing = 'Date Of Processing Is Required'
    else if (values.date_of_processing > toDateString(new Date())) errors.date_of_processing = 'Date Of Processing Cannot Be In The Future'
    if (!values.depot_id) errors.depot_id = 'Depot Is Required'
    if (!values.product_id) errors.product_id = 'Product Is Required'
    if (blank(values.no_of_batch)) errors.no_of_batch = 'No. Of Batches Is Required'
    else if (num(values.no_of_batch) <= 0) errors.no_of_batch = 'No. Of Batches Should Be Greater Than Zero'
    if (!values.raw_materials.length) errors.raw_materials = 'Please add atleast one raw material.'
    else if (values.raw_materials.some((row) => !row.raw_material_id || blank(row.qty) || num(row.qty) < 0)) {
        errors.raw_materials = 'Select the raw material and enter its actual qty on every row.'
    }
    if (values.packaging && values.packaging_materials.some((row) => !row.raw_material_id || blank(row.qty) || num(row.qty) < 0)) {
        errors.packaging_materials = 'Select the packaging material and enter its qty on every row.'
    }
    if (blank(values.qty_in_bar)) errors.qty_in_bar = 'Qty In Bar Is Required'
    else if (num(values.qty_in_bar) < 0) errors.qty_in_bar = 'Qty In Bar Cannot Be Negative'
    if (blank(values.actual_wastage)) errors.actual_wastage = 'Actual Wastage Is Required'
    else if (num(values.actual_wastage) < 0) errors.actual_wastage = 'Actual Wastage Cannot Be Negative'
    if (num(values.actual_water_loss) < 0) errors.actual_water_loss = 'Actual Water Loss Cannot Be Negative'
    if (record && record.status === 'Approved' && blank(values.remarks)) errors.remarks = 'Give The Reason For Changing This Approved Entry'
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

const Figure = ({ label, value }) => (
    <FormItem label={label}>
        <Input value={text(value)} disabled />
    </FormItem>
)

const AddEditBatchProcessing = () => {
    const { batchid } = useParams()
    const navigate = useNavigate()
    const formRef = useRef()
    const lastBatches = useRef('')
    const [loading, setLoading] = useState(true)
    const [formValues, setFormValues] = useState(initialValues())
    const [record, setRecord] = useState(null)
    const [production, setProduction] = useState(false)
    const [pendingCopyId, setPendingCopyId] = useState(null)
    const [permissions, setPermissions] = useState({ submit: true, delete: false, approve: false })
    const [master, setMaster] = useState({ batchNos: [], depots: [], products: [], rawMaterials: [], action: {} })
    const [barcodes, setBarcodes] = useState({})
    const [serverErrors, setServerErrors] = useState({})
    const [busy, setBusy] = useState(false)
    const [confirm, setConfirm] = useState(null)
    const [batchNoDialog, setBatchNoDialog] = useState(null)

    const loadBarcodes = (rows) => {
        const ids = [...new Set(rows.map((row) => +row.raw_material_id).filter(Boolean))].filter((id) => !barcodes[id])
        if (!ids.length) return
        apiBatchProcessingBarcodes(ids)
            .then((res) => {
                const found = res.data['barcodes'] || {}
                setBarcodes((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, found[id] || []])) }))
            })
            .catch(() => {})
    }

    useEffect(() => {
        const requests = [apiBatchProcessingMasterData()]
        if (batchid) requests.push(apiBatchProcessingGetSingle(batchid))
        Promise.all(requests)
            .then(([masterRes, single]) => {
                setMaster(masterRes.data)
                if (!single) {
                    setPermissions({ submit: !!(masterRes.data['action'] || {}).insert, delete: false, approve: false })
                    return
                }
                const { batch, rawMaterials, packagingMaterials, variations, permissions: allowed, production: fromProduction, pendingCopyId: copyId } = single.data
                setRecord(batch)
                setProduction(fromProduction)
                setPendingCopyId(copyId)
                setPermissions(allowed)
                lastBatches.current = text(batch.no_of_batch)
                const rows = rawMaterials.map((row) => withKey({
                    raw_material_id: row.raw_material_id,
                    rm_name: row.rm_name,
                    batch_qty: text(row.batch_qty),
                    qty: text(row.qty),
                    barcode: text(row.barcode),
                }))
                setFormValues({
                    batch_no_id: batch.batch_no_id || '',
                    date_of_processing: batch.date_of_processing || '',
                    depot_id: batch.depot_id || '',
                    product_id: batch.product_id || '',
                    no_of_batch: text(batch.no_of_batch),
                    raw_materials: rows,
                    variations: variations.map((row) => withKey({ ...row, qty: text(row.qty) })),
                    packaging: +batch.packaging === 1 ? 1 : 0,
                    packaging_materials: packagingMaterials.map((row) => withKey({ raw_material_id: row.raw_material_id, rm_name: row.rm_name, qty: text(row.qty) })),
                    qty_in_bar: text(batch.qty_in_bar),
                    actual_wastage: text(batch.actual_wastage),
                    actual_water_loss: text(batch.actual_water_loss),
                    // A change or deletion of an approved entry needs its own reason
                    remarks: batch.status === 'Approved' ? '' : text(batch.remarks),
                })
                if (allowed.submit) loadBarcodes(rows)
            })
            .catch((error) => showMessage(error && error.response ? error.response.data['message'] : 'Fetching batch processing entry failed'))
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batchid])

    const editable = !record || permissions.submit
    const pendingApproval = record && (record.status === 'Pending' || record.status === 'Deleted')

    // Old PHP get_raw_material + get_variations. A product without a recipe keeps the rows there are. Box quantities
    // survive a change of No. of Batches (PHP cleared them).
    const applyRecipe = (productId, noOfBatch) => {
        if (!productId) return
        apiBatchProcessingRecipe(productId)
            .then((res) => {
                const { rawMaterials, packagingMaterials, variations } = res.data
                const form = formRef.current
                const batches = num(noOfBatch)
                if (rawMaterials.length) {
                    const rows = rawMaterials.map((row) => {
                        const qty = text(round(batches * num(row.qty_per_batch), 4))
                        return withKey({ raw_material_id: row.rm_id, rm_name: row.rm_name, batch_qty: qty, qty, barcode: '' })
                    })
                    form.setFieldValue('raw_materials', rows)
                    loadBarcodes(rows)
                }
                if (packagingMaterials.length) {
                    form.setFieldValue('packaging', 1)
                    form.setFieldValue('packaging_materials', packagingMaterials.map((row) => withKey({
                        raw_material_id: row.rm_id,
                        rm_name: row.rm_name,
                        qty: text(round(batches * num(row.qty_per_batch), 4)),
                    })))
                }
                if (variations.length) {
                    const typed = Object.fromEntries(form.values.variations.map((row) => [row.box_id, row.qty]))
                    form.setFieldValue('variations', variations.map((row) => withKey({ ...row, qty: text(typed[row.box_id]) })))
                }
            })
            .catch((error) => showMessage(error && error.response ? error.response.data['message'] : 'Fetching the recipe failed'))
    }

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
        const request = record ? apiBatchProcessingUpdate(record.id, values) : apiBatchProcessingPost(values)
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

    // Approve, then print the receipt (as PHP did). The window is opened on the click so popup blockers allow it.
    const approve = () => {
        const remarks = formRef.current.values.remarks
        const win = window.open('', '_blank')
        if (win) win.document.write('<p style="font-family:sans-serif">Approving...</p>')
        setBusy(true)
        apiBatchProcessingApprove(record.id, remarks)
            .then(async (res) => {
                showMessage(res.data['message'], 'success')
                if (res.data['print'] && win) {
                    const printout = await apiBatchProcessingPrint(res.data['id'])
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
        const request = type === 'reject' ? apiBatchProcessingReject(record.id, values.remarks) : apiBatchProcessingDelete(record.id, values.remarks)
        setBusy(true)
        request
            .then((res) => {
                showMessage(res.data['message'], 'success')
                navigate(LIST)
            })
            .catch((error) => handleError(error, values))
            .finally(() => setBusy(false))
    }

    const saveBatchNo = () => {
        apiBatchNoPost({ batch_no: batchNoDialog.batch_no, date_of_processing: batchNoDialog.date })
            .then((res) => {
                const added = res.data['batchNo']
                setMaster((prev) => ({ ...prev, batchNos: [added, ...prev.batchNos] }))
                formRef.current.setFieldValue('batch_no_id', added.id)
                setBatchNoDialog(null)
                showMessage(res.data['message'], 'success')
            })
            .catch((error) => {
                const errors = error && error.response && error.response.data.error && error.response.data.error.errors
                showMessage(errors ? Object.values(errors)[0].message : (error && error.response ? error.response.data['message'] : 'Adding batch no failed'))
            })
    }

    const withRecord = (options, id, label) => (id && !options.some((option) => String(option.value) === String(id)) ? [{ value: id, label: label || `#${id}` }, ...options] : options)
    const batchNoOptions = withRecord(master.batchNos.map((row) => ({ value: row.id, label: row.batch_no })), record && record.batch_no_id, record && record.batch_no)
    const depotOptions = withRecord(master.depots.map((row) => ({ value: row.id, label: row.depot_name })), record && record.depot_id, record && record.depot_name)
    const productOptions = withRecord(master.products.map((row) => ({ value: row.id, label: row.product_name })), record && record.product_id, record && record.product_name)
    const materialOptions = (type) => master.rawMaterials.filter((row) => row.material_type === type).map((row) => ({ value: row.id, label: row.rm_name }))
    const rawOptions = materialOptions('Raw Material')
    const packagingOptions = materialOptions('Packaging Material')
    const title = !record ? 'Add Batch Processing Entry' : `Batch Processing Entry ${text(record.batch_no || record.batch_id_as_per_fssai)} (${record.status})`

    return (
        <Loading loading={loading}>
            <Formik innerRef={formRef} initialValues={formValues} enableReinitialize validate={validate(record)} onSubmit={onSubmit}>
                {({ values, errors, touched, isSubmitting, setFieldValue, submitCount, isValid }) => {
                    const form = { values, errors, touched, submitCount }
                    const fe = (name) => fieldFeedback(form, name, serverErrors)
                    const selectValue = (options, value) => options.filter((option) => String(option.value) === String(value))
                    const select = (name, label, options, onChange) => (
                        <FormItem asterisk label={label} invalid={fe(name).invalid} errorMessage={fe(name).errorMessage}>
                            <Select
                                placeholder="Select"
                                isDisabled={!editable}
                                options={options}
                                value={selectValue(options, values[name])}
                                onChange={(option) => (onChange ? onChange(option) : setFieldValue(name, option ? option.value : ''))}
                            />
                        </FormItem>
                    )
                    const setRow = (list, key, change) => setFieldValue(list, values[list].map((row) => (row.key === key ? { ...row, ...change } : row)))
                    const removeRow = (list, key) => setFieldValue(list, values[list].filter((row) => row.key !== key))
                    const rowOption = (options, row) => withRecord(options, row.raw_material_id, row.rm_name)

                    const product = master.products.find((row) => String(row.id) === String(values.product_id))
                        || (record && {
                            avg_grams: record.product_avg_grams,
                            anticipated_wastage: record.product_anticipated_wastage,
                            anticipated_water_loss: record.product_anticipated_water_loss,
                        })
                    // What was saved stays on an entry that cannot be changed
                    const figures = editable ? calculate(values, product) : record || {}
                    const groupError = (name) => (submitCount > 0 && errors[name]) || (serverErrors[name] && serverErrors[name].message)

                    return (
                        <Form>
                            <SubmitErrorNotice submitCount={submitCount} isValid={isValid} />
                            <FormContainer>
                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-2">{title}</h5>
                                    {production ? (
                                        <p className="mb-2 text-amber-600">
                                            This entry comes from the Production screens and can only be viewed here. Change it in Production.
                                        </p>
                                    ) : null}
                                    {record && record.ref_id && pendingApproval ? (
                                        <p className="mb-2 text-amber-600">
                                            This is a {record.status === 'Deleted' ? 'deletion' : 'change'} of an approved entry, waiting for approval.
                                        </p>
                                    ) : null}
                                    {pendingCopyId ? (
                                        <p className="mb-2 text-amber-600">
                                            A change of this entry is waiting for approval.{' '}
                                            <Link className="underline" to={`${LIST}/edit/${pendingCopyId}`}>Open it</Link>
                                        </p>
                                    ) : null}
                                    {record && record.status === 'Deleted' && permissions.approve ? (
                                        <p className="mb-2 text-red-600">If you approve, this entry will be deleted and its stock taken back.</p>
                                    ) : null}
                                    <div className="grid md:grid-cols-3 gap-4 mt-2">
                                        <div>
                                            {select('batch_no_id', 'Batch No', batchNoOptions)}
                                            {editable && master.action && master.action.insert ? (
                                                <button
                                                    type="button"
                                                    className="text-indigo-600 text-sm -mt-5 mb-4 inline-flex items-center gap-1"
                                                    onClick={() => setBatchNoDialog({ batch_no: '', date: toDateString(new Date()) })}
                                                >
                                                    <HiPlusCircle /> Add Batch No
                                                </button>
                                            ) : null}
                                        </div>
                                        <FormItem asterisk label="Date Of Processing" invalid={fe('date_of_processing').invalid} errorMessage={fe('date_of_processing').errorMessage}>
                                            <DatePicker
                                                inputFormat="DD/MM/YYYY"
                                                placeholder="Date Of Processing"
                                                maxDate={new Date()}
                                                disabled={!editable}
                                                value={parseDate(values.date_of_processing)}
                                                onChange={(date) => setFieldValue('date_of_processing', date ? toDateString(new Date(date)) : '')}
                                            />
                                        </FormItem>
                                        {select('depot_id', 'Depot', depotOptions)}
                                        {select('product_id', 'Product', productOptions, (option) => {
                                            const id = option ? option.value : ''
                                            setFieldValue('product_id', id)
                                            applyRecipe(id, values.no_of_batch)
                                        })}
                                        <FormItem asterisk label="No. Of Batches" invalid={fe('no_of_batch').invalid} errorMessage={fe('no_of_batch').errorMessage}>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="any"
                                                placeholder="No. Of Batches"
                                                disabled={!editable}
                                                value={values.no_of_batch}
                                                onChange={(e) => setFieldValue('no_of_batch', e.target.value)}
                                                onBlur={() => {
                                                    // PHP refilled the recipe on every blur, wiping the actual quantities even if nothing changed
                                                    if (text(values.no_of_batch) === lastBatches.current) return
                                                    lastBatches.current = text(values.no_of_batch)
                                                    applyRecipe(values.product_id, values.no_of_batch)
                                                }}
                                            />
                                        </FormItem>
                                    </div>
                                </AdaptableCard>

                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-2">Raw Materials</h5>
                                    {groupError('raw_materials') ? <p className="mb-2 text-red-600">{groupError('raw_materials')}</p> : null}
                                    <div className="overflow-x-auto">
                                        <Table compact className="border">
                                            <THead>
                                                <Tr>
                                                    <Th style={{ minWidth: 260 }}>Raw Material</Th>
                                                    <Th style={{ width: 150 }}>Batch Qty (In Kg)</Th>
                                                    <Th style={{ width: 150 }}>Actual Qty (In Kg)</Th>
                                                    <Th style={{ width: 240 }}>Barcode</Th>
                                                    {editable ? <Th style={{ width: 60 }} /> : null}
                                                </Tr>
                                            </THead>
                                            <TBody>
                                                {values.raw_materials.map((row) => {
                                                    const options = rowOption(rawOptions, row)
                                                    const codes = (barcodes[row.raw_material_id] || []).map((value) => ({ value, label: value }))
                                                    const barcodeOptions = [NOT_AVAILABLE, ...withRecord(codes, row.barcode === 'NA' ? '' : row.barcode, row.barcode)]
                                                    const differs = !blank(row.batch_qty) && num(row.batch_qty) !== num(row.qty)
                                                    return (
                                                        <Tr key={row.key} className={differs ? 'bg-blue-50 dark:bg-gray-700' : ''}>
                                                            <Td>
                                                                <Select
                                                                    size="sm"
                                                                    placeholder="Select"
                                                                    menuPortalTarget={document.body}
                                                                    isDisabled={!editable || !row.added}
                                                                    options={options}
                                                                    value={selectValue(options, row.raw_material_id)}
                                                                    onChange={(option) => {
                                                                        setRow('raw_materials', row.key, { raw_material_id: option ? option.value : '', rm_name: option ? option.label : '', barcode: '' })
                                                                        if (option) loadBarcodes([{ raw_material_id: option.value }])
                                                                    }}
                                                                />
                                                            </Td>
                                                            <Td>{row.batch_qty}</Td>
                                                            <Td>
                                                                <Input
                                                                    size="sm"
                                                                    type="number"
                                                                    min="0"
                                                                    step="any"
                                                                    disabled={!editable}
                                                                    value={row.qty}
                                                                    onChange={(e) => setRow('raw_materials', row.key, { qty: e.target.value })}
                                                                />
                                                            </Td>
                                                            <Td>
                                                                <Select
                                                                    size="sm"
                                                                    placeholder="Select"
                                                                    isClearable
                                                                    menuPortalTarget={document.body}
                                                                    isDisabled={!editable}
                                                                    options={barcodeOptions}
                                                                    value={selectValue(barcodeOptions, row.barcode)}
                                                                    onChange={(option) => setRow('raw_materials', row.key, { barcode: option ? option.value : '' })}
                                                                />
                                                            </Td>
                                                            {editable ? (
                                                                <Td className="text-center">
                                                                    {row.added ? (
                                                                        <button type="button" className="text-red-600 text-lg inline-flex" title="Remove" onClick={() => removeRow('raw_materials', row.key)}>
                                                                            <HiOutlineTrash />
                                                                        </button>
                                                                    ) : null}
                                                                </Td>
                                                            ) : null}
                                                        </Tr>
                                                    )
                                                })}
                                            </TBody>
                                        </Table>
                                    </div>
                                    {editable ? (
                                        <Button size="xs" className="mt-3" type="button" icon={<HiPlusCircle />} onClick={() => setFieldValue('raw_materials', [...values.raw_materials, emptyMaterial()])}>
                                            Add Raw Material
                                        </Button>
                                    ) : null}
                                </AdaptableCard>

                                {values.variations.length ? (
                                    <AdaptableCard className="mb-4 card-shadow" divider>
                                        <h5 className="mb-2">Boxes</h5>
                                        {groupError('variations') ? <p className="mb-2 text-red-600">{groupError('variations')}</p> : null}
                                        <div className="overflow-x-auto">
                                            <Table compact className="border">
                                                <THead>
                                                    <Tr>
                                                        <Th>Box Name</Th>
                                                        <Th style={{ width: 200 }}>Qty</Th>
                                                    </Tr>
                                                </THead>
                                                <TBody>
                                                    {values.variations.map((row) => (
                                                        <Tr key={row.key}>
                                                            <Td>{row.box_name}</Td>
                                                            <Td>
                                                                <Input
                                                                    size="sm"
                                                                    type="number"
                                                                    min="0"
                                                                    step="any"
                                                                    disabled={!editable}
                                                                    value={row.qty}
                                                                    onChange={(e) => setRow('variations', row.key, { qty: e.target.value })}
                                                                />
                                                            </Td>
                                                        </Tr>
                                                    ))}
                                                </TBody>
                                            </Table>
                                        </div>
                                    </AdaptableCard>
                                ) : null}

                                {values.packaging ? (
                                    <AdaptableCard className="mb-4 card-shadow" divider>
                                        <h5 className="mb-2">Packaging Materials</h5>
                                        {groupError('packaging_materials') ? <p className="mb-2 text-red-600">{groupError('packaging_materials')}</p> : null}
                                        <div className="overflow-x-auto">
                                            <Table compact className="border">
                                                <THead>
                                                    <Tr>
                                                        <Th style={{ minWidth: 260 }}>Packaging Material</Th>
                                                        <Th style={{ width: 200 }}>Qty</Th>
                                                        {editable ? <Th style={{ width: 60 }} /> : null}
                                                    </Tr>
                                                </THead>
                                                <TBody>
                                                    {values.packaging_materials.map((row) => {
                                                        const options = rowOption(packagingOptions, row)
                                                        return (
                                                            <Tr key={row.key}>
                                                                <Td>
                                                                    <Select
                                                                        size="sm"
                                                                        placeholder="Select"
                                                                        menuPortalTarget={document.body}
                                                                        isDisabled={!editable}
                                                                        options={options}
                                                                        value={selectValue(options, row.raw_material_id)}
                                                                        onChange={(option) => setRow('packaging_materials', row.key, { raw_material_id: option ? option.value : '', rm_name: option ? option.label : '' })}
                                                                    />
                                                                </Td>
                                                                <Td>
                                                                    <Input
                                                                        size="sm"
                                                                        type="number"
                                                                        min="0"
                                                                        step="any"
                                                                        disabled={!editable}
                                                                        value={row.qty}
                                                                        onChange={(e) => setRow('packaging_materials', row.key, { qty: e.target.value })}
                                                                    />
                                                                </Td>
                                                                {editable ? (
                                                                    <Td className="text-center">
                                                                        <button type="button" className="text-red-600 text-lg inline-flex" title="Remove" onClick={() => removeRow('packaging_materials', row.key)}>
                                                                            <HiOutlineTrash />
                                                                        </button>
                                                                    </Td>
                                                                ) : null}
                                                            </Tr>
                                                        )
                                                    })}
                                                </TBody>
                                            </Table>
                                        </div>
                                        {editable ? (
                                            <Button size="xs" className="mt-3" type="button" icon={<HiPlusCircle />} onClick={() => setFieldValue('packaging_materials', [...values.packaging_materials, emptyPackaging()])}>
                                                Add Packaging Material
                                            </Button>
                                        ) : null}
                                    </AdaptableCard>
                                ) : null}

                                <AdaptableCard className="mb-4 card-shadow" divider>
                                    <h5 className="mb-4">Output And Wastage</h5>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <Figure label="Total (In Kg)" value={figures.total_kg} />
                                        <Figure label="Anticipated Wastage (In %)" value={figures.anticipated_wastage} />
                                        <Figure label="Anticipated Water Loss (In %)" value={figures.anticipated_water_loss} />
                                        <Figure label="Anticipated Output (In Kg)" value={figures.anticipated_output_in_kg} />
                                        <Figure label="Anticipated Grams" value={figures.anticipated_grams} />
                                        <Figure label="Anticipated Output (In Bars)" value={figures.anticipated_output_in_bars} />
                                        <FormItem asterisk label="Qty In Bar" invalid={fe('qty_in_bar').invalid} errorMessage={fe('qty_in_bar').errorMessage}>
                                            <Field name="qty_in_bar" as={Input} type="number" min="0" step="any" placeholder="Qty In Bar" disabled={!editable} />
                                        </FormItem>
                                        <Figure label="Actual Grams In Bar" value={figures.avg_grams} />
                                        <Figure label="Difference In Bars" value={figures.difference_in_bars} />
                                        <FormItem asterisk label="Actual Wastage (In Kg)" invalid={fe('actual_wastage').invalid} errorMessage={fe('actual_wastage').errorMessage}>
                                            <Field name="actual_wastage" as={Input} type="number" min="0" step="any" placeholder="Actual Wastage" disabled={!editable} />
                                        </FormItem>
                                        <FormItem label="Actual Water Loss (In Kg)" invalid={fe('actual_water_loss').invalid} errorMessage={fe('actual_water_loss').errorMessage}>
                                            <Field name="actual_water_loss" as={Input} type="number" min="0" step="any" placeholder="Actual Water Loss" disabled={!editable} />
                                        </FormItem>
                                        <Figure label="Total Wastage (In Kg)" value={figures.total_wastage} />
                                        <Figure label="Actual % Wastage / Output" value={figures.actual_wastage_percent} />
                                    </div>
                                </AdaptableCard>

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
                                title={confirm === 'reject' ? 'Reject Entry' : 'Delete Entry'}
                                onClose={() => setConfirm(null)}
                                onRequestClose={() => setConfirm(null)}
                                onCancel={() => setConfirm(null)}
                                onConfirm={runConfirmed}
                            >
                                <p>
                                    {confirm === 'reject'
                                        ? 'Reject this entry? Give the reason in Remarks.'
                                        : record && record.status === 'Approved'
                                            ? 'This entry is approved, so its deletion goes for approval. Give the reason in Remarks.'
                                            : 'Delete this entry?'}
                                </p>
                            </ConfirmDialog>
                            <Dialog isOpen={batchNoDialog !== null} onClose={() => setBatchNoDialog(null)} onRequestClose={() => setBatchNoDialog(null)}>
                                {batchNoDialog ? (
                                    <FormContainer>
                                        <h5 className="mb-4">Add Batch No</h5>
                                        <FormItem asterisk label="Date">
                                            <DatePicker
                                                inputFormat="DD/MM/YYYY"
                                                value={parseDate(batchNoDialog.date)}
                                                onChange={(date) => setBatchNoDialog((prev) => ({ ...prev, date: date ? toDateString(new Date(date)) : '' }))}
                                            />
                                        </FormItem>
                                        <FormItem asterisk label="Batch No">
                                            <Input
                                                placeholder="Batch No"
                                                value={batchNoDialog.batch_no}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                    setBatchNoDialog((prev) => ({ ...prev, batch_no: value }))
                                                }}
                                            />
                                        </FormItem>
                                        <div className="text-right">
                                            <Button size="sm" className="ltr:mr-3" type="button" onClick={() => setBatchNoDialog(null)}>Close</Button>
                                            <Button size="sm" variant="solid" type="button" onClick={saveBatchNo}>Save</Button>
                                        </div>
                                    </FormContainer>
                                ) : null}
                            </Dialog>
                        </Form>
                    )
                }}
            </Formik>
        </Loading>
    )
}

export default AddEditBatchProcessing
