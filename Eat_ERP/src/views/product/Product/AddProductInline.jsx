import React, { useEffect, useState } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'
import { apiProductGetSingle, apiProductMasterData, apiProductPost, apiProductUpdate } from 'services/ProductService'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' }
]

const numberRule = (label) => Yup.number()
    .typeError(`${label} must be a number`)
    .required(`${label} Is Required`)
    .min(0, `${label} cannot be negative`)

const validationSchema = Yup.object().shape({
    product_name: Yup.string().required('Product Name Is Required'),
    short_name: Yup.string().required('Short Name Is Required'),
    hsn_code: Yup.string().required('HSN Code Is Required'),
    hsn_name: Yup.string().required('HSN Name Is Required'),
    category_id: Yup.string().required('Category Is Required'),
    grams: numberRule('Disclosed Grams'),
    avg_grams: numberRule('Avg Grams In Bar'),
    rate: numberRule('Rate'),
    anticipated_wastage: numberRule('Anticipated Wastage'),
    cost: numberRule('Cost'),
    tax_percentage: numberRule('Tax'),
    status: Yup.string().required('Status Is Required'),
})

const emptyProduct = {
    product_name: '',
    short_name: '',
    hsn_code: '',
    hsn_name: '',
    barcode: '',
    category_id: '',
    grams: '',
    avg_grams: '',
    rate: '',
    anticipated_wastage: '',
    cost: '',
    tax_percentage: '',
    status: 'Approved',
    remarks: '',
}

const basicFields = [
    { name: 'product_name', label: 'Product Name', required: true },
    { name: 'short_name', label: 'Short Name', required: true },
    { name: 'hsn_code', label: 'HSN Code', required: true },
    { name: 'hsn_name', label: 'HSN Name', required: true },
    { name: 'barcode', label: 'Barcode' },
]

const costingFields = [
    { name: 'grams', label: 'Disclosed Grams' },
    { name: 'avg_grams', label: 'Avg Grams In Bar' },
    { name: 'rate', label: 'Rate (In Rs)' },
    { name: 'anticipated_wastage', label: 'Anticipated Wastage (In %)' },
    { name: 'cost', label: 'Cost (In Rs)' },
    { name: 'tax_percentage', label: 'Tax (In %)' },
]

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
        actions.setFieldError(err.path, err.message)
        showError(err.message)
    })
}

const AddProduct = () => {
    const [categoryOptions, setCategoryOptions] = useState([])
    const [loading, setLoading] = useState(false)
    const [productData, setProductData] = useState(emptyProduct)
    const [canSave, setCanSave] = useState(true)
    const navigate = useNavigate()
    const { productid } = useParams()

    useEffect(() => {
        setLoading(true)
        const request = productid ? apiProductGetSingle(productid) : apiProductMasterData()
        request.then((data) => {
            if (data.status === 200) {
                setCategoryOptions(data.data['categories'].map((cat) => ({
                    value: cat.id.toString(),
                    label: cat.category_name,
                })))
                if (productid) {
                    const product = data.data['product']
                    setCanSave(data.data['action']['update'])
                    const fields = {}
                    for (const key in emptyProduct) {
                        fields[key] = product[key] !== null && product[key] !== undefined ? product[key].toString() : ''
                    }
                    fields.status = product.status === 'InActive' ? 'InActive' : 'Approved'
                    setProductData(fields)
                }
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error.response) {
                showError(error.response.data['message'])
                if (error.response.status === 404) {
                    navigate('/product/product')
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productid])

    const onSubmit = (values, actions) => {
        const request = productid
            ? apiProductUpdate({ values, id: productid })
            : apiProductPost(values)

        request.then((data) => {
            actions.setSubmitting(false)
            if (data.status === 200 || data.status === 201) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                actions.resetForm()
                navigate('/product/product')
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

    const textField = (item, errors, touched, type = 'text') => (
        <FormItem
            key={item.name}
            asterisk={type === 'number' || item.required}
            label={item.label}
            invalid={errors[item.name] && touched[item.name]}
            errorMessage={errors[item.name]}
        >
            <Field type={type} name={item.name} placeholder={item.label} component={Input} />
        </FormItem>
    )

    return (
        <Formik
            enableReinitialize={true}
            initialValues={productData}
            validationSchema={validationSchema}
            onSubmit={onSubmit}
        >
            {({ touched, errors, isSubmitting }) => (
                <Form autoComplete="off">
                    <FormContainer layout="horizontal" labelWidth={120}>
                        <div className="mb-4 md:w-full m-auto">
                            <AdaptableCard className="card-shadow">
                                <h5>{productid ? 'Edit' : 'Add New'} Product</h5>
                                <p className="mb-6">Basic details of the product</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                    {basicFields.map((item) => textField(item, errors, touched))}
                                    <FormItem
                                        asterisk
                                        label="Category"
                                        invalid={errors.category_id && touched.category_id}
                                        errorMessage={errors.category_id}
                                    >
                                        {selectField('category_id', categoryOptions)}
                                    </FormItem>
                                </div>
                                <h5>Product Costing</h5>
                                <p className="mb-6">Selling amount as per grams</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                    {costingFields.map((item) => textField(item, errors, touched, 'number'))}
                                </div>
                                <h5>Other Information</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mt-4">
                                    {productid ? (
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
                            <Button size="sm" type="button" onClick={() => navigate('/product/product')}>
                                Cancel
                            </Button>
                        </div>
                    </StickyFooter>
                </Form>
            )}
        </Formik>
    )
}

export default AddProduct
