import React, { useEffect, useMemo, useState } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Radio from 'components/ui/Radio'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'
import Table from 'components/ui/Table'
import { HiMinus } from 'react-icons/hi'
import NumberFormat from 'react-number-format'
import { apiComboBoxGetSingle, apiComboBoxMasterData, apiComboBoxPost, apiComboBoxUpdate } from 'services/ComboBoxService'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

const { Tr, Th, Td, THead, TBody } = Table

// Layout follows the old PHP combo_box_details.php form. Combo Box Cost, HSN Name, Category and
// Tax are hidden on that form (never entered by the user), so they are not shown or sent here.

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' }
]

// 'Bar' = product, 'Box' = box (old PHP combo box item types)
const typeOptions = [
    { value: 'Bar', label: 'Bar' },
    { value: 'Box', label: 'Box' }
]

// Optional number: an empty input ('') means "not entered", not "not a number"
const optionalNumber = (label) => Yup.number()
    .transform((value, original) => (original === '' ? undefined : value))
    .typeError(`${label} must be a number`)
    .min(0, `${label} cannot be negative`)

// Same rules as the old PHP form (validations.js #form_combo_box_details, visible fields only)
const validationSchema = Yup.object().shape({
    combo_box_name: Yup.string().trim().required('Combo Box Name Is Required'),
    barcode: Yup.string().trim().required('Barcode Is Required'),
    short_name: Yup.string().trim().required('Short Name Is Required'),
    asin: Yup.string().trim().required('ASIN Is Required'),
    sku_code: Yup.string().trim().required('SKU Code Is Required'),
    gst: Yup.string().oneOf(['Yes', 'No']).required('GST Is Required'),
    gst_rate: optionalNumber('GST Rate').when('gst', {
        is: 'Yes',
        then: (schema) => schema.required('GST Rate Is Required').moreThan(0, 'GST Rate Is Required'),
    }),
    hsn: Yup.string().oneOf(['Yes', 'No']),
    hsn_code: Yup.string().when('hsn', {
        is: 'Yes',
        then: (schema) => schema.trim().required('HSN Code Is Required'),
    }),
    rate: Yup.number()
        .typeError('MRP must be a number')
        .required('MRP Is Required')
        .min(1, 'MRP must be at least 1'),
    status: Yup.string().required('Status Is Required'),
    items: Yup.array().of(Yup.object().shape({
        type: Yup.string().required('Type Is Required'),
        item_id: Yup.string().required('Item Is Required'),
        qty: Yup.number().typeError('Qty must be a number').required('Qty Is Required').moreThan(0, 'Qty must be greater than 0'),
    })).min(1, 'Please add atleast one product'),
})

const emptyItem = { type: '', item_id: '', qty: '' }

const emptyComboBox = {
    combo_box_name: '',
    barcode: '',
    short_name: '',
    asin: '',
    sku_code: '',
    gst: 'No',
    gst_rate: '',
    hsn: 'No',
    hsn_code: '',
    rate: '',
    status: 'Approved',
    remarks: '',
    items: [emptyItem],
}

const basicFields = [
    { name: 'combo_box_name', label: 'Combo Box Name', required: true },
    { name: 'barcode', label: 'Barcode', required: true },
    { name: 'short_name', label: 'Short Name', required: true },
    { name: 'asin', label: 'ASIN', required: true },
    { name: 'sku_code', label: 'SKU Code', required: true },
    { name: 'rate', label: 'MRP (In Rs)', placeholder: 'MRP', type: 'number', required: true },
]

// Same helper as the Purchase Order item table
const fieldFeedback = (form, name) => {
    const error = getIn(form.errors, name)
    const touch = getIn(form.touched, name)
    return {
        errorMessage: error || '',
        invalid: typeof touch === 'undefined' ? false : error && touch,
    }
}

const showError = (message) => {
    toast.push(
        <Notification title="Error" type="danger" closable>
            {message}
        </Notification>
    )
}

// Backend returns either a Sequelize ValidationError ({ errors: [{ path, message }] })
// or a custom error ({ errors: { field: { message } } })
const handleValidationErrors = (errorData, actions) => {
    const errors = errorData && errorData.errors ? errorData.errors : {}
    const list = Array.isArray(errors)
        ? errors.map((err) => ({ path: err.path, message: err.message }))
        : Object.keys(errors).map((key) => ({ path: key, message: errors[key].message }))

    list.forEach((err) => {
        if (err.path !== 'items') {
            actions.setFieldError(err.path, err.message)
        }
        showError(err.message)
    })
}

const moneyText = (value) => (
    <NumberFormat
        displayType="text"
        prefix={'₹'}
        thousandsGroupStyle={'lakh'}
        decimalScale={2}
        fixedDecimalScale
        value={value}
        thousandSeparator=","
    />
)

const numberText = (value) => (
    <NumberFormat
        displayType="text"
        decimalScale={2}
        fixedDecimalScale
        value={value}
        thousandSeparator=","
    />
)

const AddEditComboBox = () => {
    const [bars, setBars] = useState([])
    const [boxes, setBoxes] = useState([])
    const [loading, setLoading] = useState(false)
    const [comboBoxData, setComboBoxData] = useState(emptyComboBox)
    const [canSave, setCanSave] = useState(true)
    const navigate = useNavigate()
    const { comboboxid } = useParams()

    const itemOptions = useMemo(() => ({
        Bar: bars.map((bar) => ({ value: bar.id.toString(), label: bar.product_name })),
        Box: boxes.map((box) => ({ value: box.id.toString(), label: box.box_name })),
    }), [bars, boxes])

    const itemMap = useMemo(() => {
        const map = { Bar: {}, Box: {} }
        bars.forEach((bar) => { map.Bar[bar.id.toString()] = bar })
        boxes.forEach((box) => { map.Box[box.id.toString()] = box })
        return map
    }, [bars, boxes])

    // Old PHP form shows the bar list until "Box" is picked as the type
    const listType = (type) => (type === 'Box' ? 'Box' : 'Bar')

    useEffect(() => {
        setLoading(true)
        const request = comboboxid ? apiComboBoxGetSingle(comboboxid) : apiComboBoxMasterData()
        request.then((data) => {
            if (data.status === 200) {
                setBars(data.data['bars'])
                setBoxes(data.data['boxes'])
                if (comboboxid) {
                    const comboBox = data.data['comboBox']
                    setCanSave(data.data['action']['update'])
                    const fields = {}
                    for (const key in emptyComboBox) {
                        if (key !== 'items') {
                            fields[key] = comboBox[key] !== null && comboBox[key] !== undefined ? comboBox[key].toString() : ''
                        }
                    }
                    fields.status = comboBox.status === 'InActive' ? 'InActive' : 'Approved'
                    fields.gst = comboBox.gst === 'Yes' ? 'Yes' : 'No'
                    fields.hsn = comboBox.hsn === 'Yes' ? 'Yes' : 'No'
                    const items = data.data['items'].map((item) => ({
                        type: item.type === 'Box' ? 'Box' : 'Bar',
                        item_id: item.item_id.toString(),
                        qty: item.qty.toString(),
                    }))
                    fields.items = items.length ? items : [emptyItem]
                    setComboBoxData(fields)
                }
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error.response) {
                showError(error.response.data['message'])
                if (error.response.status === 404) {
                    navigate('/product/combo-box')
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comboboxid])

    // Old PHP form: grams / rate come from the selected bar or box, amount = qty * rate
    const lineDetails = (item) => {
        const record = itemMap[listType(item.type)][item.item_id]
        const qty = parseFloat(item.qty) || 0
        const grams = record ? parseFloat(record.grams) || 0 : 0
        const rate = record ? parseFloat(record.rate) || 0 : 0
        return { grams, rate, amount: qty * rate, totalGrams: qty * grams }
    }

    const onSubmit = (values, actions) => {
        const request = comboboxid
            ? apiComboBoxUpdate({ values, id: comboboxid })
            : apiComboBoxPost(values)

        request.then((data) => {
            actions.setSubmitting(false)
            if (data.status === 200 || data.status === 201) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                actions.resetForm()
                navigate('/product/combo-box')
            }
        }).catch((error) => {
            actions.setSubmitting(false)
            if (!error.response) {
                return
            }
            if (error.response.status === 422) {
                handleValidationErrors(error.response.data['error'], actions)
            } else {
                showError(error.response.data['message'])
            }
        })
    }

    const selectField = (name, options, onChange) => (
        <Field name={name}>
            {({ field, form }) => (
                <Select
                    field={field}
                    form={form}
                    options={options}
                    isLoading={loading}
                    placeholder="Select"
                    value={options.filter((option) => option.value === field.value)}
                    onChange={(option) => {
                        form.setFieldValue(field.name, option ? option.value : '')
                        if (onChange) {
                            onChange(form, option)
                        }
                    }}
                />
            )}
        </Field>
    )

    const radioField = (name) => (
        <Field name={name}>
            {({ field, form }) => (
                <Radio.Group value={field.value} onChange={(val) => form.setFieldValue(field.name, val)}>
                    <Radio value={'Yes'}>Yes</Radio>
                    <Radio value={'No'}>No</Radio>
                </Radio.Group>
            )}
        </Field>
    )

    const textField = (item, errors, touched) => (
        <FormItem
            key={item.name}
            asterisk={item.required}
            label={item.label}
            invalid={errors[item.name] && touched[item.name]}
            errorMessage={errors[item.name]}
        >
            <Field type={item.type || 'text'} name={item.name} placeholder={item.placeholder || item.label} component={Input} />
        </FormItem>
    )

    const readOnlyField = (label, value) => (
        <FormItem label={label}>
            <Input value={value} placeholder={label} readOnly />
        </FormItem>
    )

    return (
        <Formik
            enableReinitialize={true}
            initialValues={comboBoxData}
            validationSchema={validationSchema}
            onSubmit={onSubmit}
        >
            {({ values, touched, errors, isSubmitting }) => {
                const totals = values.items.reduce((sum, item) => {
                    const line = lineDetails(item)
                    return { grams: sum.grams + line.totalGrams, amount: sum.amount + line.amount }
                }, { grams: 0, amount: 0 })

                return (
                    <Form autoComplete="off">
                        <FormContainer layout="horizontal" labelWidth={120} size="sm">
                            <div className="mb-4 md:w-full m-auto">
                                <AdaptableCard className="card-shadow">
                                    <h5 className="mb-2">{comboboxid ? 'Edit' : 'Add New'} Combo Box</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        {basicFields.map((item) => textField(item, errors, touched))}
                                    </div>

                                    <Table compact className="border mb-6">
                                        <THead>
                                            <Tr>
                                                <Th>Type*</Th>
                                                <Th>Item*</Th>
                                                <Th>Qty*</Th>
                                                <Th>Grams</Th>
                                                <Th>Rate (In Rs)</Th>
                                                <Th>Amount (In Rs)</Th>
                                                <Th>Action</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="items">
                                                {({ remove, push }) => (
                                                    <>
                                                        {values.items.map((item, index) => {
                                                            const line = lineDetails(item)
                                                            const type = fieldFeedback({ errors, touched }, `items[${index}].type`)
                                                            const itemId = fieldFeedback({ errors, touched }, `items[${index}].item_id`)
                                                            const qty = fieldFeedback({ errors, touched }, `items[${index}].qty`)
                                                            return (
                                                                <Tr key={index}>
                                                                    <Td width="140">
                                                                        <FormItem
                                                                            className="mb-0 text-left"
                                                                            invalid={type.invalid}
                                                                            layout="vertical"
                                                                            errorMessage={type.errorMessage}
                                                                        >
                                                                            {selectField(`items[${index}].type`, typeOptions, (form, option) => {
                                                                                // A bar id is not a box id: clear the item when the list changes
                                                                                const newType = option ? option.value : ''
                                                                                if (listType(newType) !== listType(item.type)) {
                                                                                    form.setFieldValue(`items[${index}].item_id`, '')
                                                                                }
                                                                            })}
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td width="350">
                                                                        <FormItem
                                                                            className="mb-0 text-left"
                                                                            invalid={itemId.invalid}
                                                                            layout="vertical"
                                                                            errorMessage={itemId.errorMessage}
                                                                        >
                                                                            {selectField(`items[${index}].item_id`, itemOptions[listType(item.type)])}
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td width="120">
                                                                        <FormItem
                                                                            className="mb-0"
                                                                            invalid={qty.invalid}
                                                                            layout="vertical"
                                                                            errorMessage={qty.errorMessage}
                                                                        >
                                                                            <Field
                                                                                invalid={qty.invalid}
                                                                                placeholder="Qty"
                                                                                name={`items[${index}].qty`}
                                                                                type="number"
                                                                                onWheel={(e) => e.target.blur()}
                                                                                component={Input}
                                                                            />
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td width="120"><p>{numberText(line.grams)}</p></Td>
                                                                    <Td width="120"><p>{moneyText(line.rate)}</p></Td>
                                                                    <Td width="150"><p>{moneyText(line.amount)}</p></Td>
                                                                    <Td width="80">
                                                                        <Button
                                                                            shape="circle"
                                                                            size="sm"
                                                                            type="button"
                                                                            icon={<HiMinus />}
                                                                            onClick={() => remove(index)}
                                                                            disabled={values.items.length === 1}
                                                                        />
                                                                    </Td>
                                                                </Tr>
                                                            )
                                                        })}
                                                        <Tr>
                                                            <Td colSpan="7" className="text-left">
                                                                <Button
                                                                    type="button"
                                                                    className="ltr:mr-2 rtl:ml-2"
                                                                    onClick={() => push(emptyItem)}
                                                                >
                                                                    Add Item
                                                                </Button>
                                                                {typeof errors.items === 'string' ? (
                                                                    <span className="text-red-500">{errors.items}</span>
                                                                ) : null}
                                                            </Td>
                                                        </Tr>
                                                    </>
                                                )}
                                            </FieldArray>
                                        </TBody>
                                    </Table>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        {readOnlyField('Total Grams', totals.grams.toFixed(2))}
                                        {readOnlyField('Total Amount (In Rs)', totals.amount.toFixed(2))}
                                        {comboboxid ? (
                                            <FormItem
                                                asterisk
                                                label="Status"
                                                invalid={errors.status && touched.status}
                                                errorMessage={errors.status}
                                            >
                                                {selectField('status', statusOptions)}
                                            </FormItem>
                                        ) : null}
                                        <FormItem
                                            label="GST"
                                            invalid={errors.gst && touched.gst}
                                            errorMessage={errors.gst}
                                        >
                                            {radioField('gst')}
                                        </FormItem>
                                        {values.gst === 'Yes'
                                            ? textField({ name: 'gst_rate', label: 'GST Rate', type: 'number', required: true }, errors, touched)
                                            : null}
                                        <FormItem
                                            label="HSN"
                                            invalid={errors.hsn && touched.hsn}
                                            errorMessage={errors.hsn}
                                        >
                                            {radioField('hsn')}
                                        </FormItem>
                                        {values.hsn === 'Yes'
                                            ? textField({ name: 'hsn_code', label: 'HSN Code', required: true }, errors, touched)
                                            : null}
                                        <FormItem
                                            label="Remarks"
                                            invalid={errors.remarks && touched.remarks}
                                            errorMessage={errors.remarks}
                                        >
                                            <Field name="remarks" placeholder="Remarks" component={Input} />
                                        </FormItem>
                                    </div>
                                </AdaptableCard>
                            </div>
                        </FormContainer>
                        <StickyFooter
                            className="-mx-1 md:-mx-1 px-8 flex items-center justify-end py-4"
                            stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        >
                            <div className="md:flex items-center">
                                <Button
                                    size="sm"
                                    type="submit"
                                    variant="solid"
                                    className={'ltr:mr-3 rtl:ml-3 ' + (canSave ? '' : 'hidden')}
                                    disabled={isSubmitting || loading}
                                >
                                    Save
                                </Button>
                                <Button size="sm" type="button" onClick={() => navigate('/product/combo-box')}>
                                    Cancel
                                </Button>
                            </div>
                        </StickyFooter>
                    </Form>
                )
            }}
        </Formik>
    )
}

export default AddEditComboBox
