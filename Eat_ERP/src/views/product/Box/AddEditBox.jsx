import React, { useEffect, useMemo, useState } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'
import Table from 'components/ui/Table'
import { HiMinus } from 'react-icons/hi'
import NumberFormat from 'react-number-format'
import { apiBoxGetSingle, apiBoxMasterData, apiBoxPost, apiBoxUpdate } from 'services/BoxService'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

const { Tr, Th, Td, THead, TBody } = Table

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' }
]

const numberRule = (label) => Yup.number()
    .typeError(`${label} must be a number`)
    .required(`${label} Is Required`)
    .min(0, `${label} cannot be negative`)

// Optional number: an empty input ('') means "not entered", not "not a number"
const optionalNumber = (label) => Yup.number()
    .transform((value, original) => (original === '' ? undefined : value))
    .typeError(`${label} must be a number`)
    .min(0, `${label} cannot be negative`)

// Same required fields as the old PHP form (validations.js #form_box_details)
const validationSchema = Yup.object().shape({
    box_name: Yup.string().trim().required('Box Name Is Required'),
    barcode: Yup.string().trim().required('Barcode Is Required'),
    short_name: Yup.string().trim().required('Short Name Is Required'),
    sku_code: Yup.string().trim().required('SKU Code Is Required'),
    hsn_code: Yup.string().trim().required('HSN Code Is Required'),
    category_id: Yup.string().required('Category Is Required'),
    rate: numberRule('Box Rate'),
    cost: optionalNumber('Box Cost'),
    tax_percentage: numberRule('Tax'),
    moq_inventory: optionalNumber('MOQ Inventory'),
    moq_production: optionalNumber('MOQ Production'),
    status: Yup.string().required('Status Is Required'),
    items: Yup.array().of(Yup.object().shape({
        product_id: Yup.string().required('Product Is Required'),
        qty: Yup.number().typeError('Qty must be a number').required('Qty Is Required').moreThan(0, 'Qty must be greater than 0'),
    })).min(1, 'Add at least one product'),
})

const emptyItem = { product_id: '', qty: '' }

const emptyBox = {
    box_name: '',
    barcode: '',
    short_name: '',
    asin: '',
    sku_code: '',
    hsn_code: '',
    hsn_name: '',
    category_id: '',
    rate: '',
    cost: '',
    tax_percentage: '',
    moq_inventory: '100',
    moq_production: '100',
    status: 'Approved',
    remarks: '',
    items: [emptyItem],
}

const basicFields = [
    { name: 'box_name', label: 'Box Name', required: true },
    { name: 'barcode', label: 'Barcode', required: true },
    { name: 'short_name', label: 'Short Name', required: true },
    { name: 'asin', label: 'ASIN' },
    { name: 'sku_code', label: 'SKU Code', required: true },
]

const costingFields = [
    { name: 'rate', label: 'Box Rate (In Rs)', type: 'number', required: true },
    { name: 'cost', label: 'Box Cost (In Rs)', type: 'number' },
    { name: 'hsn_code', label: 'HSN Code', required: true },
    { name: 'hsn_name', label: 'HSN Name' },
    { name: 'tax_percentage', label: 'Tax (In %)', type: 'number', required: true },
    { name: 'moq_inventory', label: 'MOQ Inventory', type: 'number' },
    { name: 'moq_production', label: 'MOQ Production', type: 'number' },
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

const AddEditBox = () => {
    const [products, setProducts] = useState([])
    const [categoryOptions, setCategoryOptions] = useState([])
    const [loading, setLoading] = useState(false)
    const [boxData, setBoxData] = useState(emptyBox)
    const [canSave, setCanSave] = useState(true)
    const navigate = useNavigate()
    const { boxid } = useParams()

    const productOptions = useMemo(() => products.map((product) => ({
        value: product.id.toString(),
        label: product.product_name,
    })), [products])

    const productMap = useMemo(() => {
        const map = {}
        products.forEach((product) => { map[product.id.toString()] = product })
        return map
    }, [products])

    useEffect(() => {
        setLoading(true)
        const request = boxid ? apiBoxGetSingle(boxid) : apiBoxMasterData()
        request.then((data) => {
            if (data.status === 200) {
                setProducts(data.data['products'])
                setCategoryOptions(data.data['categories'].map((cat) => ({
                    value: cat.id.toString(),
                    label: cat.category_name,
                })))
                if (boxid) {
                    const box = data.data['box']
                    setCanSave(data.data['action']['update'])
                    const fields = {}
                    for (const key in emptyBox) {
                        if (key !== 'items') {
                            fields[key] = box[key] !== null && box[key] !== undefined ? box[key].toString() : ''
                        }
                    }
                    fields.status = box.status === 'InActive' ? 'InActive' : 'Approved'
                    const items = data.data['items'].map((item) => ({
                        product_id: item.product_id.toString(),
                        qty: item.qty.toString(),
                    }))
                    fields.items = items.length ? items : [emptyItem]
                    setBoxData(fields)
                }
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error.response) {
                showError(error.response.data['message'])
                if (error.response.status === 404) {
                    navigate('/product/box')
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boxid])

    // Old PHP form: grams / rate come from the product, amount = qty * rate
    const lineDetails = (item) => {
        const product = productMap[item.product_id]
        const qty = parseFloat(item.qty) || 0
        const grams = product ? parseFloat(product.grams) || 0 : 0
        const rate = product ? parseFloat(product.rate) || 0 : 0
        return { grams, rate, amount: qty * rate, totalGrams: qty * grams }
    }

    const onSubmit = (values, actions) => {
        const request = boxid
            ? apiBoxUpdate({ values, id: boxid })
            : apiBoxPost(values)

        request.then((data) => {
            actions.setSubmitting(false)
            if (data.status === 200 || data.status === 201) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                actions.resetForm()
                navigate('/product/box')
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

    const selectField = (name, options) => (
        <Field name={name}>
            {({ field, form }) => (
                <Select
                    field={field}
                    form={form}
                    options={options}
                    isLoading={loading}
                    value={options.filter((option) => option.value === field.value)}
                    onChange={(option) => form.setFieldValue(field.name, option ? option.value : '')}
                />
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
            <Field type={item.type || 'text'} name={item.name} placeholder={item.label} component={Input} />
        </FormItem>
    )

    return (
        <Formik
            enableReinitialize={true}
            initialValues={boxData}
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
                        <FormContainer layout="horizontal" labelWidth={120}>
                            <div className="mb-4 md:w-full m-auto">
                                <AdaptableCard className="card-shadow">
                                    <h5>{boxid ? 'Edit' : 'Add New'} Box</h5>
                                    <p className="mb-6">Basic details of the box</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        {basicFields.map((item) => textField(item, errors, touched))}
                                    </div>

                                    <h5>Products In Box</h5>
                                    <p className="mb-4">Grams and rate are taken from the product master</p>
                                    <Table compact className="border mb-6">
                                        <THead>
                                            <Tr>
                                                <Th>Product*</Th>
                                                <Th>Qty*</Th>
                                                <Th>Grams</Th>
                                                <Th>Rate</Th>
                                                <Th>Amount</Th>
                                                <Th>Action</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="items">
                                                {({ remove, push }) => (
                                                    <>
                                                        {values.items.map((item, index) => {
                                                            const line = lineDetails(item)
                                                            const product = fieldFeedback({ errors, touched }, `items[${index}].product_id`)
                                                            const qty = fieldFeedback({ errors, touched }, `items[${index}].qty`)
                                                            return (
                                                                <Tr key={index}>
                                                                    <Td width="350">
                                                                        <FormItem
                                                                            className="mb-0 text-left"
                                                                            invalid={product.invalid}
                                                                            layout="vertical"
                                                                            errorMessage={product.errorMessage}
                                                                        >
                                                                            {selectField(`items[${index}].product_id`, productOptions)}
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
                                                                    <Td width="120">
                                                                        <p>
                                                                            <NumberFormat
                                                                                displayType="text"
                                                                                decimalScale={2}
                                                                                fixedDecimalScale
                                                                                value={line.grams}
                                                                                thousandSeparator=","
                                                                            />
                                                                        </p>
                                                                    </Td>
                                                                    <Td width="120">
                                                                        <p>
                                                                            <NumberFormat
                                                                                displayType="text"
                                                                                prefix={'₹'}
                                                                                thousandsGroupStyle={'lakh'}
                                                                                decimalScale={2}
                                                                                fixedDecimalScale
                                                                                value={line.rate}
                                                                                thousandSeparator=","
                                                                            />
                                                                        </p>
                                                                    </Td>
                                                                    <Td width="150">
                                                                        <p>
                                                                            <NumberFormat
                                                                                displayType="text"
                                                                                prefix={'₹'}
                                                                                thousandsGroupStyle={'lakh'}
                                                                                decimalScale={2}
                                                                                fixedDecimalScale
                                                                                value={line.amount}
                                                                                thousandSeparator=","
                                                                            />
                                                                        </p>
                                                                    </Td>
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
                                                            <Td colSpan="6" className="text-left">
                                                                <Button
                                                                    type="button"
                                                                    className="ltr:mr-2 rtl:ml-2"
                                                                    onClick={() => push(emptyItem)}
                                                                >
                                                                    Add Product
                                                                </Button>
                                                                {typeof errors.items === 'string' ? (
                                                                    <span className="text-red-500">{errors.items}</span>
                                                                ) : null}
                                                            </Td>
                                                        </Tr>
                                                    </>
                                                )}
                                            </FieldArray>
                                            <Tr>
                                                <Td colSpan="2" className="text-left">Total Grams</Td>
                                                <Td>
                                                    <NumberFormat
                                                        displayType="text"
                                                        decimalScale={2}
                                                        fixedDecimalScale
                                                        value={totals.grams}
                                                        thousandSeparator=","
                                                    />
                                                </Td>
                                                <Td className="text-left">Total Amount</Td>
                                                <Td>
                                                    <NumberFormat
                                                        displayType="text"
                                                        prefix={'₹'}
                                                        thousandsGroupStyle={'lakh'}
                                                        decimalScale={2}
                                                        fixedDecimalScale
                                                        value={totals.amount}
                                                        thousandSeparator=","
                                                    />
                                                </Td>
                                                <Td></Td>
                                            </Tr>
                                        </TBody>
                                    </Table>

                                    <h5>Box Costing</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mt-4">
                                        {costingFields.map((item) => textField(item, errors, touched))}
                                        <FormItem
                                            asterisk
                                            label="Category"
                                            invalid={errors.category_id && touched.category_id}
                                            errorMessage={errors.category_id}
                                        >
                                            {selectField('category_id', categoryOptions)}
                                        </FormItem>
                                    </div>

                                    <h5>Other Information</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mt-4">
                                        {boxid ? (
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
                                            label="Remarks"
                                            invalid={errors.remarks && touched.remarks}
                                            errorMessage={errors.remarks}
                                            className="md:col-span-2"
                                        >
                                            <Field name="remarks" placeholder="Remarks" textArea component={Input} />
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
                                <Button size="sm" type="button" onClick={() => navigate('/product/box')}>
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

export default AddEditBox
