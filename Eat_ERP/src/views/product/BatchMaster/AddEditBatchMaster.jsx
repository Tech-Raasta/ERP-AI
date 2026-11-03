import React, { useEffect, useState } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import DatePicker from 'components/ui/DatePicker'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiBatchMasterGetSingle,
    apiBatchMasterPost,
    apiBatchMasterUpdate,
} from 'services/BatchMasterService'

// Old PHP batch_master_details form shows: Date, Batch No, Status (edit only), Remarks.
// Production and the documents table are hidden on that form, so they are not shown or sent here
// (the backend keeps their current values).

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' }
]

const validationSchema = Yup.object().shape({
    date_of_processing: Yup.string().required('Date Is Required'),
    batch_no: Yup.string().trim().required('Batch No Is Required'),
    status: Yup.string().required('Status Is Required'),
})

const toDateString = (date) => {
    const pad = (value) => (value < 10 ? `0${value}` : `${value}`)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const emptyBatch = {
    date_of_processing: toDateString(new Date()),
    batch_no: '',
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

const AddEditBatchMaster = () => {
    const [loading, setLoading] = useState(false)
    const [batchData, setBatchData] = useState(emptyBatch)
    const [canSave, setCanSave] = useState(true)
    const navigate = useNavigate()
    const { batchmasterid } = useParams()

    useEffect(() => {
        if (!batchmasterid) {
            return
        }
        setLoading(true)
        apiBatchMasterGetSingle(batchmasterid).then((data) => {
            if (data.status === 200) {
                const batch = data.data['batchMaster']
                setCanSave(data.data['action']['update'])
                setBatchData({
                    // Old PHP shows today's date when the batch has none
                    date_of_processing: batch.date_of_processing || toDateString(new Date()),
                    batch_no: batch.batch_no || '',
                    status: batch.status === 'InActive' ? 'InActive' : 'Approved',
                    remarks: batch.remarks || '',
                })
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error.response) {
                showError(error.response.data['message'])
                if (error.response.status === 404) {
                    navigate('/product/batch-master')
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batchmasterid])

    const onSubmit = (values, actions) => {
        const request = batchmasterid
            ? apiBatchMasterUpdate({ values, id: batchmasterid })
            : apiBatchMasterPost(values)

        request.then((data) => {
            actions.setSubmitting(false)
            if (data.status === 200 || data.status === 201) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                actions.resetForm()
                navigate('/product/batch-master')
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

    return (
        <Formik
            enableReinitialize={true}
            initialValues={batchData}
            validationSchema={validationSchema}
            onSubmit={onSubmit}
        >
            {({ touched, errors, isSubmitting }) => (
                <Form autoComplete="off">
                    <FormContainer layout="horizontal" labelWidth={120} size="sm">
                        <div className="mb-4 md:w-full m-auto">
                            <AdaptableCard className="card-shadow">
                                <h5 className="mb-2">{batchmasterid ? 'Edit' : 'Add New'} Batch No</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                    <FormItem
                                        asterisk
                                        label="Date"
                                        invalid={errors.date_of_processing && touched.date_of_processing}
                                        errorMessage={errors.date_of_processing}
                                    >
                                        <Field name="date_of_processing">
                                            {({ field, form }) => (
                                                <DatePicker
                                                    inputFormat="DD/MM/YYYY"
                                                    field={field}
                                                    form={form}
                                                    placeholder="Date"
                                                    value={field.value ? new Date(field.value) : null}
                                                    onChange={(date) => form.setFieldValue(field.name, date ? toDateString(new Date(date)) : '')}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Batch No"
                                        invalid={errors.batch_no && touched.batch_no}
                                        errorMessage={errors.batch_no}
                                    >
                                        <Field type="text" name="batch_no" placeholder="Batch No" component={Input} />
                                    </FormItem>
                                    {batchmasterid ? (
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
                                </div>
                                <FormItem
                                    label="Remarks"
                                    invalid={errors.remarks && touched.remarks}
                                    errorMessage={errors.remarks}
                                >
                                    <Field name="remarks" placeholder="Remarks" textArea component={Input} />
                                </FormItem>
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
                            <Button size="sm" type="button" onClick={() => navigate('/product/batch-master')}>
                                Cancel
                            </Button>
                        </div>
                    </StickyFooter>
                </Form>
            )}
        </Formik>
    )
}

export default AddEditBatchMaster
