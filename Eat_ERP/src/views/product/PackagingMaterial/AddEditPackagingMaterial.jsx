import React, { useEffect, useState } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

import {
    apiRawMaterialGetSingle,
    apiRawMaterialPost,
    apiRawMaterialUpdate,
} from 'services/RawMaterialService'
import Select from 'components/ui/Select'

const validationSchema = Yup.object().shape({
    rm_name: Yup.string().required('Packaging Material Name Is Required'),
    hsn_code: Yup.string().required('HSN Code Is Required'),
    rate: Yup.number().required('Rate Is Required'),
    tax_per: Yup.number().required('Tax Is Required'),
    shelf_life: Yup.number().required('Shelf Life Is Required'),
})

const packagingType = [
    { value: 'Primary', label: 'Primary' },
    { value: 'Secondary', label: 'Secondary' },
    { value: 'Tertiary', label: 'Tertiary' },
]

const checkActive = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'Inactive' }
]

const AddEditPackagingMaterial = () => {
    const [rawMaterialData, setRawMaterialData] = useState({
        rm_name: '',
        hsn_code: '',
        rate: '',
        tax_per: '',
        shelf_life: '',
        standard_quantity: '',
        material_type: 'Packaging Material',
        packaging_type: '',
        status:'',
        remarks: '',
    })
    const navigate = useNavigate()
    const packagingMaterialId = useParams()

    console.log('Add Packaging Material.js Loading....')
    useEffect(() => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (packagingMaterialId.packagingiaterialid) {
            function fetchData() {
                apiRawMaterialGetSingle(packagingMaterialId.packagingiaterialid)
                    .then((data) => {
                        if (data.status === 200) {
                            // console.log(data.data['product'])
                            let rawMaterial = data.data['rawMaterial']
                            setRawMaterialData({
                                rm_name: rawMaterial.rm_name,
                                hsn_code: rawMaterial.hsn_code,
                                rate: rawMaterial.rate,
                                tax_per: rawMaterial.tax_per,
                                shelf_life: rawMaterial.shelf_life,
                                standard_quantity:
                                    rawMaterial.standard_quantity,
                                material_type: 'Packaging Material',
                                packaging_type: rawMaterial.packaging_type,
                                status: rawMaterial.status,
                                remarks: rawMaterial.remarks,
                            })
                        }
                    })
                    .catch((error) => {
                        if (error.response.status === 401) {
                            toast.push(
                                <Notification
                                    title="Error"
                                    type="danger"
                                    closable
                                >
                                    {error.response.data['message']}
                                </Notification>
                            )
                        }
                    })
                return true
            }
            fetchData()
        }
    }, [])

    return (
        <>
            <Formik
                enableReinitialize={true}
                initialValues={rawMaterialData}
                validationSchema={validationSchema}
                onSubmit={(values, actions) => {
                    if (packagingMaterialId.packagingiaterialid) {
                        // console.log(values)
                        apiRawMaterialUpdate({
                            values,
                            ...{ id: packagingMaterialId.packagingiaterialid },
                        })
                            .then((data) => {
                                console.log(data)
                                if (data.status === 200) {
                                    actions.setSubmitting(false)
                                    toast.push(
                                        <Notification
                                            title="Success"
                                            type="success"
                                            closable
                                        >
                                            {data.data['message']}
                                        </Notification>
                                    )
                                    actions.resetForm()
                                    navigate('/product/packaging-material')
                                }
                            })
                            .catch((error) => {
                                let errorData =
                                    error.response['data']['error']['errors']
                                if (error.response.status === 422) {
                                    for (const errMsg in errorData) {
                                        actions.setFieldError(
                                            errMsg,
                                            errorData[errMsg]['message']
                                        )
                                        toast.push(
                                            <Notification
                                                title="Error"
                                                type="danger"
                                                closable
                                            >
                                                {errorData[errMsg]['message']}
                                            </Notification>
                                        )
                                    }
                                } else if (error.response.status === 500) {
                                    console.log(errorData)
                                    toast.push(
                                        <Notification
                                            title="Error"
                                            type="danger"
                                            closable
                                        >
                                            {error.response.data['message']}
                                        </Notification>
                                    )
                                }
                            })
                    } else {
                        apiRawMaterialPost(values)
                            .then((data) => {
                                if (data.status === 201) {
                                    console.log(data)
                                    actions.setSubmitting(false)
                                    actions.resetForm()
                                    toast.push(
                                        <Notification
                                            title="Success"
                                            type="success"
                                            closable
                                        >
                                            {data.data['message']}
                                        </Notification>
                                    )
                                    navigate('/product/packaging-material')
                                }
                            })
                            .catch((error) => {
                                let errorData =
                                    error.response['data']['error']['errors']
                                actions.setSubmitting(false)
                                if (error.response.status === 422) {
                                    for (const errMsg in errorData) {
                                        actions.setFieldError(
                                            errMsg,
                                            errorData[errMsg]['message']
                                        )
                                        toast.push(
                                            <Notification
                                                title="Error"
                                                type="danger"
                                                closable
                                            >
                                                {errorData[errMsg]['message']}
                                            </Notification>
                                        )
                                    }
                                } else if (error.response.status === 500) {
                                    console.log(errorData)
                                    toast.push(
                                        <Notification
                                            title="Error"
                                            type="danger"
                                            closable
                                        >
                                            {error.response.data['message']}
                                        </Notification>
                                    )
                                }
                            })
                    }
                }}
            >
                {({ values, touched, errors, isSubmitting }) => (
                    <Form autoComplete="off" autoSave="off">
                        <FormContainer layout="horizontal" labelWidth={120}>
                            <div className="mb-4 md:w-full m-auto">
                                <AdaptableCard className="card-shadow">
                                    {/* <h5>Product Imformation</h5> */}
                                    <h5 className="mb-6">
                                        {packagingMaterialId.packagingiaterialid
                                            ? 'Edit'
                                            : 'Add New'}{' '}
                                        Packaging Material Imformation
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 ">
                                        <FormItem
                                            asterisk
                                            label="Packaging Material Name"
                                            invalid={
                                                errors.rm_name &&
                                                touched.rm_name
                                            }
                                            errorMessage={errors.rm_name}
                                        >
                                            <Field
                                                type="text"
                                                name="rm_name"
                                                placeholder="Packaging Material Name"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            label="HSN Code"
                                            invalid={
                                                errors.hsn_code &&
                                                touched.hsn_code
                                            }
                                            errorMessage={errors.hsn_code}
                                        >
                                            <Field
                                                asterisk
                                                type="text"
                                                name="hsn_code"
                                                placeholder="HSN Code"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Rate (In Rs)"
                                            invalid={
                                                errors.rate && touched.rate
                                            }
                                            errorMessage={errors.rate}
                                        >
                                            <Field
                                                type="number"
                                                name="rate"
                                                placeholder="Rate (In Rs)"
                                                prefix="₹"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Tax %"
                                            invalid={
                                                errors.tax_per &&
                                                touched.tax_per
                                            }
                                            errorMessage={errors.tax_per}
                                        >
                                            <Field
                                                type="number"
                                                name="tax_per"
                                                placeholder="Tax %"
                                                suffix="%"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Shelf Life"
                                            invalid={
                                                errors.shelf_life &&
                                                touched.shelf_life
                                            }
                                            errorMessage={errors.shelf_life}
                                        >
                                            <Field
                                                type="number"
                                                name="shelf_life"
                                                suffix="Days"
                                                placeholder="Shelf Life"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <FormItem
                                            label="Standard Quantity"
                                            invalid={
                                                errors.standard_quantity &&
                                                touched.standard_quantity
                                            }
                                            errorMessage={
                                                errors.standard_quantity
                                            }
                                        >
                                            <Field
                                                type="number"
                                                name="standard_quantity"
                                                placeholder="Standard Quantity"
                                                component={Input}
                                            />
                                        </FormItem>
                                        <div>
                                            <FormItem
                                                asterisk
                                                label="Packaging Type"
                                                invalid={
                                                    errors.packaging_type &&
                                                    touched.packaging_type
                                                }
                                                errorMessage={
                                                    errors.packaging_type
                                                }
                                            >
                                                <Field name="packaging_type">
                                                    {({ field, form }) => (
                                                        <Select
                                                            className="justify-items-start align-top items-start"
                                                            field={field}
                                                            form={form}
                                                            options={
                                                                packagingType
                                                            }
                                                            value={packagingType.filter(
                                                                (option) =>
                                                                    option.value ===
                                                                    values.packaging_type
                                                            )}
                                                            onChange={(
                                                                option
                                                            ) =>
                                                                form.setFieldValue(
                                                                    field.name,
                                                                    option?.value
                                                                )
                                                            }
                                                        />
                                                    )}
                                                </Field>
                                            </FormItem>
                                        </div>
                                        <div>
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
                                        </div>
                                        <FormItem
                                            label="Remark"
                                            invalid={
                                                errors.remarks &&
                                                touched.remarks
                                            }
                                            errorMessage={errors.remarks}
                                        >
                                            <Field name="remarks">
                                                {({ field, form }) => {
                                                    return (
                                                        <Input
                                                            type="text"
                                                            field={field}
                                                            form={form}
                                                            // name={field.name}
                                                            value={field.value}
                                                            onChange={(
                                                                option
                                                            ) =>
                                                                form.setFieldValue(
                                                                    field.name,
                                                                    option
                                                                        .target
                                                                        .value
                                                                )
                                                            }
                                                            textArea
                                                        />
                                                    )
                                                }}
                                            </Field>
                                        </FormItem>
                                    </div>
                                </AdaptableCard>
                            </div>
                        </FormContainer>
                        <StickyFooter
                            className="-mx-1 md:-mx-1 px-8 flex items-center justify-between py-4"
                            stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        >
                            <div></div>
                            <div className="md:flex items-center">
                                <Button
                                    size="sm"
                                    type="submit"
                                    className="ltr:mr-3 rtl:ml-3"
                                    variant="solid"
                                    disabled={isSubmitting}
                                >
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() =>
                                        navigate('/product/packaging-material')
                                    }
                                >
                                    Back
                                </Button>
                            </div>
                        </StickyFooter>
                    </Form>
                )}
            </Formik>
        </>
    )
}

export default AddEditPackagingMaterial
