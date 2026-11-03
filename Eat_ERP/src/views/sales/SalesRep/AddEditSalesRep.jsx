import React, { useEffect, useState } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Radio from 'components/ui/Radio'
import DatePicker from 'components/ui/DatePicker'
import Upload from 'components/ui/Upload'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, FieldArray, Form, Formik } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'
import Table from 'components/ui/Table'
import { HiMinus } from 'react-icons/hi'
import { MdDownload } from 'react-icons/md'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import appConfig from 'configs/app.config'
import {
    apiSalesRepGetSingle,
    apiSalesRepMasterData,
    apiSalesRepPost,
    apiSalesRepUpdate,
} from 'services/SalesRepService'

const { Tr, Th, Td, THead, TBody } = Table

// Old PHP sales_rep_details form + templates/document (document rows)

// Documents uploaded from the old PHP app live on the PHP server ('uploads/Sales_Rep/...')
const PHP_BASE_URL = 'https://erp.eatanytime.in/eat_erp/'

// Same file types as the backend upload middleware (middleware/file.js)
const ALLOWED_FILE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' },
]

const typeOptions = [
    { value: 'Sales Representative', label: 'Sales Representative' },
    { value: 'Promoter', label: 'Promoter' },
    { value: 'Merchandizer', label: 'Merchandizer' },
]

// Same rules as the old PHP form (validations.js #form_sales_rep_details)
const validationSchema = Yup.object().shape({
    sales_rep_name: Yup.string().trim().required('Sales Representative Name Is Required'),
    pan_no: Yup.string().trim().required('Pan No Is Required'),
    email_id: Yup.string().trim().required('Email Id Is Required').email('Please enter a valid email id'),
    mobile: Yup.string().trim().required('Mobile Is Required').matches(/^\d{10}$/, 'Mobile must be 10 digits'),
    zone: Yup.string().required('Zone Is Required'),
    target_pm: Yup.number()
        .transform((value, original) => (original === '' ? undefined : value))
        .typeError('Target PM must be a number')
        .min(0, 'Target PM cannot be negative'),
    status: Yup.string().required('Status Is Required'),
})

const emptyDoc = {
    doc_ref_name: '',
    doc_description: '',
    doc_ref_no: '',
    doc_doi: '',
    doc_doe: '',
    doc_document: '',
    document_name: '',
    doc_type_id: '',
    doc_doc_id: '',
    file: [],
}

const emptySalesRep = {
    sales_rep_name: '',
    pan_no: '',
    email_id: '',
    mobile: '',
    kyc_done: '',
    teritory: '',
    target_pm: '',
    status: 'Approved',
    sr_type: '',
    zone: '',
    remarks: '',
    documents: [emptyDoc],
}

const str = (value) => (value !== null && value !== undefined ? value.toString() : '')

const toDateString = (date) => {
    const pad = (value) => (value < 10 ? `0${value}` : `${value}`)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const docUrl = (path) => (path.startsWith('uploads/') ? PHP_BASE_URL : appConfig.uploadUrl) + path

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

const beforeUpload = (file) => {
    if (file) {
        for (const f of file) {
            if (!ALLOWED_FILE_TYPES.includes(f.type)) {
                return 'Please upload an image, pdf, word or excel file!'
            }
        }
    }
    return true
}

const AddEditSalesRep = () => {
    const [zoneOptions, setZoneOptions] = useState([])
    const [loading, setLoading] = useState(false)
    const [salesRepData, setSalesRepData] = useState(emptySalesRep)
    const [canSave, setCanSave] = useState(true)
    const navigate = useNavigate()
    const { salesrepid } = useParams()

    useEffect(() => {
        setLoading(true)
        const request = salesrepid ? apiSalesRepGetSingle(salesrepid) : apiSalesRepMasterData()
        request.then((data) => {
            if (data.status === 200) {
                const zones = data.data['zones'].map((zone) => ({ value: zone.zone, label: zone.zone }))
                if (salesrepid) {
                    const salesRep = data.data['salesRep']
                    setCanSave(data.data['action']['update'])
                    // Keep the rep's current zone selectable even if it is no longer an active zone
                    if (salesRep.zone && !zones.some((zone) => zone.value === salesRep.zone)) {
                        zones.push({ value: salesRep.zone, label: salesRep.zone })
                    }
                    const documents = data.data['documents'].map((doc) => ({
                        doc_ref_name: str(doc.doc_ref_name),
                        doc_description: str(doc.doc_description),
                        doc_ref_no: str(doc.doc_ref_no),
                        doc_doi: str(doc.doc_doi),
                        doc_doe: str(doc.doc_doe),
                        doc_document: str(doc.doc_document),
                        document_name: str(doc.document_name),
                        doc_type_id: str(doc.doc_type_id),
                        doc_doc_id: str(doc.doc_doc_id),
                        file: [],
                    }))
                    const fields = {}
                    for (const key in emptySalesRep) {
                        if (key !== 'documents') {
                            fields[key] = str(salesRep[key])
                        }
                    }
                    fields.status = salesRep.status === 'InActive' ? 'InActive' : 'Approved'
                    fields.documents = documents.length ? documents : [emptyDoc]
                    setSalesRepData(fields)
                }
                setZoneOptions(zones)
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error.response) {
                showError(error.response.data['message'])
                if (error.response.status === 404) {
                    navigate('/sales/sales-rep')
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [salesrepid])

    const onSubmit = (values, actions) => {
        const formData = new FormData()
        for (const key in values) {
            if (key !== 'documents') {
                formData.append(key, values[key])
            }
        }
        formData.append('docs', JSON.stringify(values.documents.map(({ file, ...doc }) => doc)))
        values.documents.forEach((doc, index) => {
            if (doc.file && doc.file.length > 0) {
                formData.append(`doc_file_${index}`, doc.file[0])
            }
        })

        const request = salesrepid
            ? apiSalesRepUpdate({ values: formData, id: salesrepid })
            : apiSalesRepPost(formData)

        request.then((data) => {
            actions.setSubmitting(false)
            if (data.status === 200 || data.status === 201) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                actions.resetForm()
                navigate('/sales/sales-rep')
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

    const selectField = (name, options, placeholder = 'Select') => (
        <Field name={name}>
            {({ field, form }) => (
                <Select
                    field={field}
                    form={form}
                    options={options}
                    isLoading={loading}
                    placeholder={placeholder}
                    value={options.filter((option) => option.value === field.value)}
                    onChange={(option) => form.setFieldValue(field.name, option ? option.value : '')}
                />
            )}
        </Field>
    )

    const textField = (name, label, errors, touched, required = false, type = 'text') => (
        <FormItem
            asterisk={required}
            label={label}
            invalid={errors[name] && touched[name]}
            errorMessage={errors[name]}
        >
            <Field type={type} name={name} placeholder={label} component={Input} />
        </FormItem>
    )

    const dateCell = (name) => (
        <Field name={name}>
            {({ field, form }) => (
                <DatePicker
                    inputFormat="DD/MM/YYYY"
                    field={field}
                    form={form}
                    placeholder="Select date"
                    value={field.value ? new Date(field.value) : null}
                    onChange={(date) => form.setFieldValue(field.name, date ? toDateString(new Date(date)) : '')}
                />
            )}
        </Field>
    )

    return (
        <Formik
            enableReinitialize={true}
            initialValues={salesRepData}
            validationSchema={validationSchema}
            onSubmit={onSubmit}
        >
            {({ values, touched, errors, isSubmitting }) => (
                <Form autoComplete="off">
                    <FormContainer layout="horizontal" labelWidth={120} size="sm">
                        <div className="mb-4 md:w-full m-auto">
                            <AdaptableCard className="card-shadow">
                                <h5 className="mb-2">{salesrepid ? 'Edit' : 'Add New'} Sales Representative</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                    {textField('sales_rep_name', 'Sales Representative Name', errors, touched, true)}
                                    {textField('pan_no', 'Pan No', errors, touched, true)}
                                    {textField('email_id', 'Email Id', errors, touched, true)}
                                    {textField('mobile', 'Mobile', errors, touched, true)}
                                    <FormItem label="Kyc Done">
                                        <Field name="kyc_done">
                                            {({ field, form }) => (
                                                <Radio.Group value={field.value} onChange={(val) => form.setFieldValue(field.name, val)}>
                                                    <Radio value={'1'}>Yes</Radio>
                                                    <Radio value={'0'}>No</Radio>
                                                </Radio.Group>
                                            )}
                                        </Field>
                                    </FormItem>
                                    {textField('teritory', 'Territory', errors, touched)}
                                    {textField('target_pm', 'Target PM (In Rs)', errors, touched, false, 'number')}
                                    <FormItem
                                        asterisk
                                        label="Status"
                                        invalid={errors.status && touched.status}
                                        errorMessage={errors.status}
                                    >
                                        {selectField('status', statusOptions)}
                                    </FormItem>
                                    <FormItem
                                        label="Type"
                                        invalid={errors.sr_type && touched.sr_type}
                                        errorMessage={errors.sr_type}
                                    >
                                        {selectField('sr_type', typeOptions)}
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Zone"
                                        invalid={errors.zone && touched.zone}
                                        errorMessage={errors.zone}
                                    >
                                        {selectField('zone', zoneOptions)}
                                    </FormItem>
                                </div>
                                <FormItem
                                    label="Remarks"
                                    invalid={errors.remarks && touched.remarks}
                                    errorMessage={errors.remarks}
                                >
                                    <Field name="remarks" placeholder="Remarks" textArea component={Input} />
                                </FormItem>

                                <h5 className="mb-2">Documents</h5>
                                <div className="overflow-x-auto mb-6">
                                    <Table compact className="border">
                                        <THead>
                                            <Tr>
                                                <Th>Document Name</Th>
                                                <Th>Description</Th>
                                                <Th>Reference No</Th>
                                                <Th>Date of Issue</Th>
                                                <Th>Date of Expiry</Th>
                                                <Th>Upload File</Th>
                                                <Th>Current File</Th>
                                                <Th>Action</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="documents">
                                                {({ remove, push }) => (
                                                    <>
                                                        {values.documents.map((doc, index) => (
                                                            <Tr key={index} className="align-top">
                                                                <Td><div className="w-44"><Field type="text" name={`documents[${index}].doc_ref_name`} placeholder="Document Name" component={Input} /></div></Td>
                                                                <Td><div className="w-44"><Field type="text" name={`documents[${index}].doc_description`} placeholder="Description" component={Input} /></div></Td>
                                                                <Td><div className="w-36"><Field type="text" name={`documents[${index}].doc_ref_no`} placeholder="Reference No" component={Input} /></div></Td>
                                                                <Td><div className="w-40">{dateCell(`documents[${index}].doc_doi`)}</div></Td>
                                                                <Td><div className="w-40">{dateCell(`documents[${index}].doc_doe`)}</div></Td>
                                                                <Td>
                                                                    <div className="w-56">
                                                                        <Field name={`documents[${index}].file`}>
                                                                            {({ field, form }) => (
                                                                                <Upload
                                                                                    uploadLimit={1}
                                                                                    beforeUpload={beforeUpload}
                                                                                    fileList={field.value}
                                                                                    onChange={(files) => form.setFieldValue(field.name, files)}
                                                                                    onFileRemove={(files) => form.setFieldValue(field.name, files)}
                                                                                />
                                                                            )}
                                                                        </Field>
                                                                    </div>
                                                                </Td>
                                                                <Td>
                                                                    {doc.doc_document ? (
                                                                        <a href={docUrl(doc.doc_document)} target="_blank" rel="noreferrer" className="inline-flex items-center text-indigo-600 pt-2">
                                                                            <MdDownload className="mr-1" />
                                                                            {doc.document_name || 'View'}
                                                                        </a>
                                                                    ) : null}
                                                                </Td>
                                                                <Td>
                                                                    <Button
                                                                        shape="circle"
                                                                        size="sm"
                                                                        type="button"
                                                                        icon={<HiMinus />}
                                                                        onClick={() => remove(index)}
                                                                        disabled={values.documents.length === 1}
                                                                    />
                                                                </Td>
                                                            </Tr>
                                                        ))}
                                                        <Tr>
                                                            <Td colSpan="8" className="text-left">
                                                                <Button
                                                                    type="button"
                                                                    className="ltr:mr-2 rtl:ml-2"
                                                                    onClick={() => push(emptyDoc)}
                                                                >
                                                                    Add Document
                                                                </Button>
                                                                <span className="text-gray-500">Rows without a document name are not saved.</span>
                                                            </Td>
                                                        </Tr>
                                                    </>
                                                )}
                                            </FieldArray>
                                        </TBody>
                                    </Table>
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
                            <Button size="sm" type="button" onClick={() => navigate('/sales/sales-rep')}>
                                Cancel
                            </Button>
                        </div>
                    </StickyFooter>
                </Form>
            )}
        </Formik>
    )
}

export default AddEditSalesRep
