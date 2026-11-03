import React, { useEffect, useMemo, useState } from 'react'
import { AdaptableCard } from 'components/shared'
import Loading from 'components/shared/Loading'
import StickyFooter from 'components/shared/StickyFooter'
import { FormContainer, FormItem } from 'components/ui'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import DatePicker from 'components/ui/DatePicker'
import Table from 'components/ui/Table'
import { HiMinus, HiPlus } from 'react-icons/hi'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiSalesDispatch, apiSalesDispatchGet } from 'services/SalesService'
import { apiSampleDispatch, apiSampleDispatchGet } from 'services/SampleExpiryService'
import { distributorLabel, formatDate } from './Sales'

const { Tr, Th, Td, THead, TBody } = Table

// Issue gate pass (old PHP distributor_out_sku_details.php): pick the batches each item is sent from,
// the delivery person and tracking id. The sale moves from Delivery Pending to GP Issued.

const pad = (value) => (value < 10 ? `0${value}` : `${value}`)
const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const notify = (message, type = 'danger') => {
    toast.push(
        <Notification title={type === 'success' ? 'Success' : 'Error'} type={type} closable>
            {message}
        </Notification>
    )
}

// sample: Sample / Expiry (old PHP sample_out_sku_details.php) has no tracking id, dispatch date or proof
const DispatchSales = ({ sample = false }) => {
    const basePath = sample ? '/transaction/sample-expiry' : '/transaction/sales'
    const getDispatch = sample ? apiSampleDispatchGet : apiSalesDispatchGet
    const saveDispatch = sample ? apiSampleDispatch : apiSalesDispatch
    const { saleid } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [data, setData] = useState(null)
    const [form, setForm] = useState({ sales_rep_id: '', tracking_id: '', date_of_dispatch: toDateString(new Date()), file: null })
    // allocations[itemId] = [{ batch_id, qty }]
    const [allocations, setAllocations] = useState({})
    const [errors, setErrors] = useState({})

    useEffect(() => {
        getDispatch(saleid)
            .then((res) => {
                setData(res.data)
                const initial = {}
                res.data.items.forEach((item) => {
                    initial[item.id] = [{ batch_id: '', qty: item.qty }]
                })
                setAllocations(initial)
            })
            .catch((error) => {
                notify(error && error.response ? error.response.data['message'] : 'Loading failed')
                navigate(basePath)
            })
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saleid])

    const batchOptions = useMemo(() => (data ? data.batches.map((row) => ({ value: row.id, label: row.batch_no })) : []), [data])
    const personOptions = useMemo(() => (data ? data.deliveryPersons.map((row) => ({ value: row.id, label: row.sales_rep_name })) : []), [data])

    const setAllocation = (itemId, index, key, value) => {
        setAllocations((prev) => ({
            ...prev,
            [itemId]: prev[itemId].map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
        }))
    }

    // Old PHP "Copy": use the same batch split on every other line of the same item
    const copyToSameItems = (item) => {
        setAllocations((prev) => {
            const next = { ...prev }
            data.items.forEach((other) => {
                if (other.id !== item.id && other.type === item.type && other.item_id === item.item_id) {
                    next[other.id] = prev[item.id].map((row) => ({ ...row }))
                }
            })
            return next
        })
    }

    const validate = () => {
        const next = {}
        if (!form.sales_rep_id) next.sales_rep_id = 'Delivery Person is required'
        if (!sample && !form.tracking_id.trim()) next.tracking_id = 'Tracking Id is required'
        if (!sample && !form.date_of_dispatch) next.date_of_dispatch = 'Date of dispatch is required'
        data.items.forEach((item, index) => {
            const rows = allocations[item.id] || []
            if (!rows.length || rows.some((row) => !row.batch_id || !(+row.qty > 0))) {
                next[`batches[${index}]`] = 'Batch and qty are required'
            } else {
                const total = rows.reduce((sum, row) => sum + (+row.qty || 0), 0)
                if (Math.round(total * 100) !== Math.round((+item.qty || 0) * 100)) {
                    next[`batches[${index}]`] = 'Total no of qty does not match.'
                }
            }
        })
        setErrors(next)
        return Object.keys(next).length === 0
    }

    const onSave = () => {
        if (!validate()) return
        const formData = new FormData()
        formData.append('sales_rep_id', form.sales_rep_id)
        formData.append('tracking_id', form.tracking_id.trim())
        formData.append('date_of_dispatch', form.date_of_dispatch)
        formData.append('batches', JSON.stringify(data.items.map((item) => ({ id: item.id, allocations: allocations[item.id] }))))
        if (form.file) formData.append('proof_of_dispatch', form.file)

        setSaving(true)
        saveDispatch(saleid, formData)
            .then((res) => {
                notify(res.data['message'], 'success')
                navigate(`${basePath}/view/${saleid}`)
            })
            .catch((error) => {
                setSaving(false)
                if (!error || !error.response) return
                const serverErrors = error.response.data && error.response.data.error && error.response.data.error.errors
                if (serverErrors) {
                    const next = {}
                    Object.keys(serverErrors).forEach((key) => {
                        next[key] = serverErrors[key]['message']
                    })
                    setErrors(next)
                    notify(Object.values(next).join(', '))
                } else {
                    notify(error.response.data['message'])
                }
            })
    }

    const sale = data ? data.sale : null

    return (
        <Loading loading={loading}>
            {data ? (
                <>
                    <AdaptableCard className="card-shadow mb-4">
                        <h5 className="mb-4">Issue Gate Pass {sample ? (sale.voucher_no ? `- ${sale.voucher_no}` : '') : (sale.invoice_no ? `- ${sale.invoice_no}` : '')}</h5>
                        {!data.canDispatch ? (
                            <div className="mb-4 p-3 rounded bg-amber-50 text-amber-700 dark:bg-gray-700 dark:text-amber-300">
                                A gate pass can only be issued for an approved sale waiting for delivery
                                (this one is {sale.status}{sale.delivery_status ? ` / ${sale.delivery_status}` : ''}).
                            </div>
                        ) : null}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 mb-4 text-sm">
                            <div><span className="text-gray-500">Distributor: </span><span className="font-semibold">{distributorLabel(sale)}</span></div>
                            <div><span className="text-gray-500">Location: </span><span className="font-semibold">{sale.location || '-'}</span></div>
                            <div><span className="text-gray-500">{sample ? 'Date: ' : 'Invoice Date: '}</span><span className="font-semibold">{formatDate(sample ? sale.date_of_processing : sale.invoice_date)}</span></div>
                            <div><span className="text-gray-500">Depot: </span><span className="font-semibold">{sale.depot_name}</span></div>
                        </div>
                        <FormContainer layout="horizontal" size="sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2">
                                <FormItem asterisk label="Delivery Person" invalid={!!errors.sales_rep_id} errorMessage={errors.sales_rep_id}>
                                    <Select
                                        options={personOptions}
                                        value={personOptions.filter((option) => option.value === +form.sales_rep_id)}
                                        onChange={(option) => setForm({ ...form, sales_rep_id: option ? option.value : '' })}
                                        isDisabled={!data.canDispatch}
                                    />
                                </FormItem>
                                {!sample ? (<>
                                <FormItem asterisk label="Tracking Id" invalid={!!errors.tracking_id} errorMessage={errors.tracking_id}>
                                    <Input
                                        value={form.tracking_id}
                                        placeholder="Tracking Id"
                                        invalid={!!errors.tracking_id}
                                        onChange={(e) => setForm({ ...form, tracking_id: e.target.value })}
                                        disabled={!data.canDispatch}
                                    />
                                </FormItem>
                                <FormItem asterisk label="Date of dispatch" invalid={!!errors.date_of_dispatch} errorMessage={errors.date_of_dispatch}>
                                    <DatePicker
                                        inputFormat="DD/MM/YYYY"
                                        value={form.date_of_dispatch ? new Date(`${form.date_of_dispatch}T00:00:00`) : null}
                                        onChange={(date) => setForm({ ...form, date_of_dispatch: date ? toDateString(new Date(date)) : '' })}
                                        disabled={!data.canDispatch}
                                    />
                                </FormItem>
                                <FormItem label="Proof Of Dispatch">
                                    <input
                                        type="file"
                                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                                        className="text-sm"
                                        onChange={(e) => setForm({ ...form, file: e.target.files && e.target.files[0] ? e.target.files[0] : null })}
                                        disabled={!data.canDispatch}
                                    />
                                </FormItem>
                                </>) : null}
                            </div>
                        </FormContainer>
                    </AdaptableCard>

                    <AdaptableCard className="card-shadow mb-4">
                        <h5 className="mb-4">Batches</h5>
                        <div className="overflow-x-auto">
                            <Table compact className="border">
                                <THead>
                                    <Tr>
                                        <Th>Sr. No.</Th>
                                        <Th>Item Name</Th>
                                        <Th>Type</Th>
                                        <Th className="text-right">Qty</Th>
                                        <Th>Batch (Qty / Batch No)</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {data.items.map((item, index) => {
                                        const rows = allocations[item.id] || []
                                        const error = errors[`batches[${index}]`]
                                        const hasTwin = data.items.some((other) => other.id !== item.id && other.type === item.type && other.item_id === item.item_id)
                                        return (
                                            <Tr key={item.id}>
                                                <Td>{index + 1}</Td>
                                                <Td>{item.item_name}</Td>
                                                <Td>{item.type}</Td>
                                                <Td className="text-right">{item.qty}</Td>
                                                <Td style={{ minWidth: 380 }}>
                                                    {rows.map((row, rowIndex) => (
                                                        <div key={rowIndex} className="flex items-center gap-2 mb-1">
                                                            <Input
                                                                size="sm"
                                                                type="number"
                                                                className="w-24"
                                                                placeholder="Qty"
                                                                value={row.qty}
                                                                onWheel={(e) => e.target.blur()}
                                                                onChange={(e) => setAllocation(item.id, rowIndex, 'qty', e.target.value)}
                                                                disabled={!data.canDispatch}
                                                            />
                                                            <div className="w-48">
                                                                <Select
                                                                    size="sm"
                                                                    options={batchOptions}
                                                                    value={batchOptions.filter((option) => option.value === +row.batch_id)}
                                                                    menuPortalTarget={document.body}
                                                                    style={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                                                                    onChange={(option) => setAllocation(item.id, rowIndex, 'batch_id', option ? option.value : '')}
                                                                    isDisabled={!data.canDispatch}
                                                                />
                                                            </div>
                                                            {rows.length > 1 && data.canDispatch ? (
                                                                <Button
                                                                    type="button"
                                                                    shape="circle"
                                                                    size="xs"
                                                                    icon={<HiMinus />}
                                                                    onClick={() => setAllocations((prev) => ({ ...prev, [item.id]: prev[item.id].filter((_, i) => i !== rowIndex) }))}
                                                                />
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                    {data.canDispatch ? (
                                                        <div className="flex gap-2">
                                                            <Button
                                                                type="button"
                                                                size="xs"
                                                                variant="twoTone"
                                                                icon={<HiPlus />}
                                                                onClick={() => setAllocations((prev) => ({ ...prev, [item.id]: [...prev[item.id], { batch_id: '', qty: '' }] }))}
                                                            >
                                                                Add Batch
                                                            </Button>
                                                            {hasTwin ? (
                                                                <Button type="button" size="xs" onClick={() => copyToSameItems(item)}>
                                                                    Copy to same item
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                    ) : null}
                                                    {error ? <div className="text-red-500 text-sm mt-1">{error}</div> : null}
                                                </Td>
                                            </Tr>
                                        )
                                    })}
                                </TBody>
                            </Table>
                        </div>
                    </AdaptableCard>
                </>
            ) : null}
            <StickyFooter
                className="-mx-8 px-8 flex items-center justify-end py-4"
                stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
            >
                <Button size="sm" className="ltr:mr-3 rtl:ml-3" type="button" onClick={() => navigate(`${basePath}/view/${saleid}`)}>
                    Cancel
                </Button>
                {data && data.canDispatch ? (
                    <Button size="sm" variant="solid" type="button" loading={saving} onClick={onSave}>
                        Issue Gate Pass
                    </Button>
                ) : null}
            </StickyFooter>
        </Loading>
    )
}

export default DispatchSales
