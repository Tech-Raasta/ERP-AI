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
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

import {
    apiRawMaterialGetSingle,
    apiRawMaterialPost,
    apiRawMaterialUpdate,
} from 'services/RawMaterialService'

// Old PHP asset form: name, HSN code, rate, tax %, status, remarks (no packaging type)

const MATERIAL_TYPE = 'Asset'

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' },
]

const numberRule = (label) => Yup.number()
    .typeError(`${label} must be a number`)
    .required(`${label} Is Required`)
    .min(0, `${label} cannot be negative`)

const validationSchema = Yup.object().shape({
    rm_name: Yup.string().trim().required('Asset Name Is Required'),
    hsn_code: Yup.string().trim().required('HSN Code Is Required'),
    rate: numberRule('Rate'),
    tax_per: numberRule('Tax'),
    status: Yup.string().required('Status Is Required'),
})

const emptyAsset = {
    rm_name: '',
    hsn_code: '',
    rate: '',
    tax_per: '',
    status: 'Approved',
    remarks: '',
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
        actions.setFieldError(err.path, err.message)
        showError(err.message)
    })
}

const AddEditAsset = () => {
    const [assetData, setAssetData] = useState(emptyAsset)
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const { assetid } = useParams()

    useEffect(() => {
        if (!assetid) {
            return
        }
        setLoading(true)
        apiRawMaterialGetSingle(assetid).then((data) => {
            if (data.status === 200) {
                const asset = data.data['rawMaterial']
                if (asset.material_type !== MATERIAL_TYPE) {
                    showError('This record is not an asset')
                    navigate('/product/asset')
                    return
                }
                const fields = {}
                for (const key in emptyAsset) {
                    fields[key] = asset[key] !== null && asset[key] !== undefined ? asset[key].toString() : ''
                }
                fields.status = asset.status === 'InActive' ? 'InActive' : 'Approved'
                setAssetData(fields)
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error.response) {
                showError(error.response.data['message'])
                if (error.response.status === 404) {
                    navigate('/product/asset')
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assetid])

    const onSubmit = (values, actions) => {
        const payload = { ...values, material_type: MATERIAL_TYPE, packaging_type: '' }
        const request = assetid
            ? apiRawMaterialUpdate({ values: payload, id: assetid })
            : apiRawMaterialPost(payload)

        request.then((data) => {
            actions.setSubmitting(false)
            if (data.status === 200 || data.status === 201) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {assetid ? 'Asset updated successfully' : 'Asset added successfully'}
                    </Notification>
                )
                actions.resetForm()
                navigate('/product/asset')
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

    const textField = (name, label, errors, touched, props = {}) => (
        <FormItem
            asterisk
            label={label}
            invalid={errors[name] && touched[name]}
            errorMessage={errors[name]}
        >
            <Field type="text" name={name} placeholder={label} component={Input} {...props} />
        </FormItem>
    )

    return (
        <Formik
            enableReinitialize={true}
            initialValues={assetData}
            validationSchema={validationSchema}
            onSubmit={onSubmit}
        >
            {({ touched, errors, isSubmitting }) => (
                <Form autoComplete="off">
                    <FormContainer layout="horizontal" labelWidth={120}>
                        <div className="mb-4 md:w-full m-auto">
                            <AdaptableCard className="card-shadow">
                                <h5 className="mb-6">{assetid ? 'Edit' : 'Add New'} Asset</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                    {textField('rm_name', 'Asset Name', errors, touched)}
                                    {textField('hsn_code', 'HSN Code', errors, touched)}
                                    {textField('rate', 'Rate (In Rs)', errors, touched, { type: 'number', prefix: '₹' })}
                                    {textField('tax_per', 'Tax %', errors, touched, { type: 'number', suffix: '%' })}
                                    {assetid ? (
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
                                                        options={statusOptions}
                                                        isLoading={loading}
                                                        value={statusOptions.filter((option) => option.value === field.value)}
                                                        onChange={(option) => form.setFieldValue(field.name, option ? option.value : '')}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                    ) : null}
                                    <FormItem
                                        label="Remarks"
                                        invalid={errors.remarks && touched.remarks}
                                        errorMessage={errors.remarks}
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
                                className="ltr:mr-3 rtl:ml-3"
                                disabled={isSubmitting || loading}
                            >
                                Save
                            </Button>
                            <Button size="sm" type="button" onClick={() => navigate('/product/asset')}>
                                Cancel
                            </Button>
                        </div>
                    </StickyFooter>
                </Form>
            )}
        </Formik>
    )
}

export default AddEditAsset
