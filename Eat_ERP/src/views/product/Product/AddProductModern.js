import React from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import AsyncSelect from 'react-select/async'
import { Link, useParams } from 'react-router-dom'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'

const colourOptions = [
    { value: 'ocean', label: 'Ocean', color: '#00B8D9', isFixed: true },
    { value: 'blue', label: 'Blue', color: '#0052CC', isDisabled: true },
    { value: 'purple', label: 'Purple', color: '#5243AA' },
    { value: 'red', label: 'Red', color: '#FF5630', isFixed: true },
    { value: 'orange', label: 'Orange', color: '#FF8B00' },
    { value: 'yellow', label: 'Yellow', color: '#FFC400' },
    { value: 'green', label: 'Green', color: '#36B37E' },
    { value: 'forest', label: 'Forest', color: '#00875A' },
    { value: 'slate', label: 'Slate', color: '#253858' },
    { value: 'silver', label: 'Silver', color: '#666666' },
];

const filterColors = (inputValue) => {
    return colourOptions.filter((i) =>
        i.label.toLowerCase().includes(inputValue.toLowerCase())
    )
}

const loadOptions = (inputValue, callback) => {
    setTimeout(() => {
        callback(filterColors(inputValue))
    }, 1000)
}

const checkActive = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'inactive' }
]

const validationSchema = Yup.object().shape({
    productName: Yup.string().required('Product Name Is Required'),
    barcode: Yup.string().required('Barcode Is Required'),
    hsnCode: Yup.string().required('HSN Code Is Required'),
    hsnName: Yup.string().required('HSN Name Is Required'),
    shortName: Yup.string().required('HSN Name Is Required'),
    category: Yup.string().required('Category Is Required'),
    disclosedGrams: Yup.number().required('Disclosed Grams Is Required'),
    avgGrams: Yup.number().required('Average Grams Is Required'),
    rate: Yup.number().required('Rate Is Required'),
    anticipatedWastage: Yup.number().required('Anticipated Wastage Is Required'),
    cost: Yup.number().required('Cost Is Required'),
    tax: Yup.number().required('Tax Is Required'),
    status: Yup.string().required('Status Is Required'),
    remark: Yup.string().required('Remark Is Required')
})



const AddProductModern = () => {
    const productId = useParams();
    console.log(productId.productid);
    return (
        <>
            <Formik
                enableReinitialize
                initialValues={{
                    productName: '',
                    barcode: '',
                    hsnCode: '',
                    hsnName: '',
                    shortName: '',
                    category: '',
                    disclosedGrams: '',
                    avgGrams: '',
                    rate: '',
                    anticipatedWastage: '',
                    cost: '',
                    tax: '',
                    status: '',
                    remark: ''
                }}
                validationSchema={validationSchema}
                onSubmit={(values, { setSubmitting }) => {
                    console.log('values', values)
                    setTimeout(() => {
                        alert(JSON.stringify(values, null, 2))
                        setSubmitting(false)
                    }, 400)
                }}
            >
                {({ values, touched, errors, resetForm }) => (
                    <Form autoComplete='off' >

                        <FormContainer>

                            <div className='mb-4 md:w-11/12 m-auto'>
                                <div className="flex items-center justify-between mb-4">
                                    <h3> {productId.productid ? 'Edit' : 'Add'} New Product</h3>
                                </div>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <AdaptableCard className="card-shadow col-span-1">
                                        <h5 className='mb-'>Product Imformation</h5>
                                        <p className="mb-6">{productId.productid ? 'Edit' : 'Add'} basic details of product</p>
                                        <FormItem
                                            asterisk
                                            label="Product Name"
                                            invalid={errors.productName && touched.productName}
                                            errorMessage={errors.productName}
                                        >
                                            <Field
                                                type="text"
                                                name="productName"
                                                placeholder="Product Name"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Short Name"
                                            invalid={errors.shortName && touched.shortName}
                                            errorMessage={errors.shortName}
                                        >
                                            <Field
                                                type="text"
                                                name="shortName"
                                                placeholder="Short Name"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            label="Barcode"
                                            invalid={errors.barcode && touched.barcode}
                                            errorMessage={errors.barcode}
                                        >
                                            <Field
                                                type="text"
                                                name="barcode"
                                                placeholder="Barcode"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Category"
                                            invalid={errors.category && touched.category}
                                            errorMessage={errors.category}
                                        >
                                            <Field name="category">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={colourOptions}
                                                        value={colourOptions.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.category
                                                        )}
                                                        onChange={(option) =>
                                                            form.setFieldValue(
                                                                field.name,
                                                                option?.value
                                                            )
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="HSN Code"
                                            invalid={errors.hsnCode && touched.hsnCode}
                                            errorMessage={errors.hsnCode}
                                        >
                                            <Field
                                                type="text"
                                                name="hsnCode"
                                                placeholder="HSN Code"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="HSN Name"
                                            invalid={errors.hsnName && touched.hsnName}
                                            errorMessage={errors.hsnName}
                                        >
                                            <Field
                                                type="text"
                                                name="hsnName"
                                                placeholder="HSN Name"
                                                component={Input}
                                            />
                                        </FormItem>
                                    </AdaptableCard>
                                    <AdaptableCard className="card-shadow col-span-1">
                                        <h5>Product Costing</h5>
                                        <p className="mb-6">{productId.productid ? 'Edit' : 'Add'} product selling amount as per grams</p>
                                        <FormItem
                                            asterisk
                                            label="Disclosed Grams"
                                            invalid={errors.disclosedGrams && touched.disclosedGrams}
                                            errorMessage={errors.disclosedGrams}
                                        >
                                            <Field
                                                type="number"
                                                name="disclosedGrams"
                                                placeholder="Disclosed Grams"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Avg Grams In Bar"
                                            invalid={errors.avgGrams && touched.avgGrams}
                                            errorMessage={errors.avgGrams}
                                        >
                                            <Field
                                                type="number"
                                                name="avgGrams"
                                                placeholder="Avg Grams In Bar"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Rate (In Rs)"
                                            invalid={errors.rate && touched.rate}
                                            errorMessage={errors.rate}
                                        >
                                            <Field
                                                type="number"
                                                name="rate"
                                                placeholder="Rate (In Rs)"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Anticipated Wastage (In %)"
                                            invalid={errors.anticipatedWastage && touched.anticipatedWastage}
                                            errorMessage={errors.anticipatedWastage}
                                        >
                                            <Field
                                                type="number"
                                                name="anticipatedWastage"
                                                placeholder="Anticipated Wastage (In %)"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Cost"
                                            invalid={errors.cost && touched.cost}
                                            errorMessage={errors.cost}
                                        >
                                            <Field
                                                type="number"
                                                name="cost"
                                                placeholder="Cost"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Tax"
                                            invalid={errors.tax && touched.tax}
                                            errorMessage={errors.tax}
                                        >
                                            <Field
                                                type="number"
                                                name="tax"
                                                placeholder="Tax"
                                                component={Input}
                                            />
                                        </FormItem>
                                    </AdaptableCard>
                                    <AdaptableCard className="card-shadow col-span-1">
                                        <h5>Other Information</h5>
                                        <p className="mb-6">{productId.productid ? 'Edit' : 'Add'} final product status</p>
                                        <FormItem
                                            asterisk
                                            label="Status"
                                            invalid={errors.status && touched.status}
                                            errorMessage={errors.status}
                                        >
                                            <Field name="status">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={checkActive}
                                                        value={checkActive.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.status
                                                        )}
                                                        onChange={(option) =>
                                                            form.setFieldValue(
                                                                field.name,
                                                                option?.value
                                                            )
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            label="Remark"
                                            invalid={errors.remark && touched.remark}
                                            errorMessage={errors.remark}
                                        >
                                            <Field
                                                name="remark"
                                            >
                                                {({ field, form }) => {
                                                    return (
                                                        <Input
                                                            type="text"
                                                            name={field.name}
                                                            value={field.value}
                                                            onChange={(option) =>
                                                                form.setFieldValue(
                                                                    field.name,
                                                                    option.target.value
                                                                )
                                                            }
                                                            textArea
                                                        />
                                                    )
                                                }}
                                            </Field>
                                        </FormItem>

                                    </AdaptableCard>
                                </div>
                            </div>
                            <StickyFooter
                                className="-mx-1 md:-mx-1 px-8 flex items-center justify-between py-4"
                                stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                            >
                                <div></div>
                                <div className="md:flex items-center">

                                    <Link to="/product/product" replace={true} >
                                        <Button size="sm" className="ltr:mr-3 rtl:ml-3">
                                            Back
                                        </Button>
                                    </Link>
                                    <Button size="sm" variant="solid">
                                        Submit For Approval
                                    </Button>
                                </div>
                            </StickyFooter>
                        </FormContainer>
                    </Form>
                )}
            </Formik>
        </>
    )
}

export default AddProductModern
