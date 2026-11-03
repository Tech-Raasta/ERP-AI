import React, { useEffect, useMemo, useState } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Radio from 'components/ui/Radio'
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
    apiDistributorGetSingle,
    apiDistributorMasterData,
    apiDistributorPost,
    apiDistributorUpdate,
} from 'services/DistributorService'

const { Tr, Th, Td, THead, TBody } = Table

// Old PHP distributor_details form (Distributor / Retailer).
// The route id is 'd_<id>' for a distributor or 's_<id>' for a pending sales rep retailer (saving converts it).

// Documents uploaded from the old PHP app live on the PHP server ('uploads/Distributor/...')
const PHP_BASE_URL = 'https://erp.eatanytime.in/eat_erp/'
const docUrl = (path) => (path.startsWith('uploads/') ? PHP_BASE_URL : appConfig.uploadUrl) + path

const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']

const classOptions = [
    { value: 'normal', label: 'Retailer' },
    { value: 'direct', label: 'Direct' },
    { value: 'super stockist', label: 'Distributor' },
    { value: 'sample', label: 'Sample' },
]

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' },
]

const tenDigits = /^\d{10}$/

const CONTACT_FIELDS = ['contact_person', 'email_id', 'mobile']
const CONSIGNEE_FIELDS = ['con_name', 'con_address', 'con_city', 'con_pincode', 'con_state', 'con_country', 'con_state_code', 'con_gst_number']
// A row counts as entered once any of its fields has a value
const isBlank = (row, fields) => fields.every((field) => !row || row[field] === undefined || row[field] === null || row[field].toString().trim() === '')

// Same rules as the old PHP form (validations.js #form_distributor_details)
const validationSchema = Yup.object().shape({
    distributor_name: Yup.string().trim().required('Distributor Name Is Required'),
    sell_out: Yup.number().typeError('Discount must be a number').required('Discount Is Required'),
    send_invoice: Yup.string().required('Generate Invoice Is Required'),
    credit_period: Yup.string().trim().required('Credit Period Is Required').matches(/^\d+$/, 'Credit Period must be in days'),
    d_email_id: Yup.string().trim().email('Please enter a valid email id'),
    pincode: Yup.string().trim().matches(/^\d*$/, 'Pincode must contain digits only'),
    d_mobile: Yup.string().trim().required('Mobile Is Required').matches(tenDigits, 'Mobile must be 10 digits'),
    class: Yup.string().required('Class Is Required'),
    state: Yup.string().trim().required('State Is Required'),
    state_code: Yup.string().trim().required('State Code Is Required'),
    type_id: Yup.string().required('Type Is Required'),
    zone_id: Yup.string().required('Zone Is Required'),
    area_id: Yup.string().required('Area Is Required'),
    location_id: Yup.string().when('class', {
        is: (value) => value === 'normal' || value === 'direct',
        then: (schema) => schema.required('Location Is Required'),
    }),
    prefix: Yup.string().when('class', {
        is: 'direct',
        then: (schema) => schema.trim().required('Prefix Is Required'),
    }),
    status: Yup.string().required('Status Is Required'),
    // Contacts are optional: a blank row is ignored, a row with any input needs person + mobile
    contacts: Yup.array().of(Yup.lazy((row) => (isBlank(row, CONTACT_FIELDS) ? Yup.object() : Yup.object().shape({
        contact_person: Yup.string().trim().required('Contact Person Is Required'),
        email_id: Yup.string().trim().email('Please enter a valid email id'),
        mobile: Yup.string().trim().required('Mobile Is Required').matches(tenDigits, 'Mobile must be 10 digits'),
    })))),
    // Consignees are optional: a blank new row is ignored; a new row with any input must be complete,
    // a saved row only needs a name
    consignees: Yup.array().of(Yup.lazy((row) => ((!row.id && isBlank(row, CONSIGNEE_FIELDS)) ? Yup.object() : Yup.object().shape({
        con_name: Yup.string().trim().required('Name Is Required'),
        con_address: Yup.string().trim().when('id', { is: (id) => !id, then: (schema) => schema.required('Address Is Required') }),
        con_state: Yup.string().trim().when('id', { is: (id) => !id, then: (schema) => schema.required('State Is Required') }),
        con_state_code: Yup.string().trim().when('id', { is: (id) => !id, then: (schema) => schema.required('State Code Is Required') }),
    })))),
    margins: Yup.array().of(Yup.object().shape({
        inv_margin: Yup.string().trim().matches(/^-?\d*\.?\d*$/, 'Must be a number'),
        pro_margin: Yup.string().trim().matches(/^-?\d*\.?\d*$/, 'Must be a number'),
    })),
})

const emptyContact = { contact_person: '', email_id: '', mobile: '' }
const emptyConsignee = { id: '', con_name: '', con_address: '', con_city: '', con_pincode: '', con_state: '', con_country: '', con_state_code: '', con_gst_number: '' }

const emptyDistributor = {
    d_id: '',
    distributor_name: '',
    address: '',
    city: '',
    pincode: '',
    state: '',
    country: '',
    state_code: '',
    gst_number: '',
    google_address: '',
    d_latitude: '',
    d_longitude: '',
    d_email_id: '',
    d_mobile: '',
    tin_number: '',
    cst_number: '',
    sell_out: '0',
    send_invoice: '',
    credit_period: '',
    class: '',
    type_id: '',
    zone_id: '',
    area_id: '',
    location_id: '',
    tally_name: '',
    marketplace: '',
    marketplace_id: '',
    prefix: '',
    master_distributor_id: '',
    doc_document: '',
    document_name: '',
    doc_file: [],
    beat_ids: [],
    status: 'Approved',
    remarks: '',
    margins: [],
    contacts: [emptyContact],
    consignees: [emptyConsignee],
}

const str = (value) => (value !== null && value !== undefined ? value.toString() : '')

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
        if (!['contacts', 'consignees', 'margins'].includes(err.path)) {
            actions.setFieldError(err.path, err.message)
        }
        showError(err.message)
    })
}

const beforeUpload = (file) => {
    if (file) {
        for (const f of file) {
            if (!ALLOWED_FILE_TYPES.includes(f.type)) {
                return 'Please upload an image or pdf file!'
            }
        }
    }
    return true
}

// Keep a saved value selectable even when it is not in the filtered / active list
const withCurrent = (options, value, label) => (
    value && !options.some((option) => option.value === value)
        ? [...options, { value, label: label || value }]
        : options
)

const AddEditDistributor = () => {
    const [master, setMaster] = useState({ types: [], zones: [], areas: [], locations: [], beatPlans: [], cities: [] })
    const [loading, setLoading] = useState(false)
    const [distributorData, setDistributorData] = useState(emptyDistributor)
    const [canSave, setCanSave] = useState(true)
    const navigate = useNavigate()
    const { distributorid } = useParams()

    const typeOptions = useMemo(() => master.types.map((type) => ({ value: str(type.id), label: type.distributor_type })), [master.types])
    const locationOptions = useMemo(() => master.locations.map((location) => ({ value: str(location.id), label: location.location })), [master.locations])
    const beatOptions = useMemo(() => master.beatPlans.map((beat) => ({ value: str(beat.id), label: `${beat.beat_id} - ${beat.beat_name}` })), [master.beatPlans])
    const cityOptions = useMemo(() => master.cities.map((city) => ({ value: city.city_name, label: city.city_name, city })), [master.cities])

    useEffect(() => {
        setLoading(true)
        const request = distributorid ? apiDistributorGetSingle(distributorid) : apiDistributorMasterData()
        request.then((data) => {
            if (data.status === 200) {
                const { types, zones, areas, locations, beatPlans, cities, margins } = data.data
                setMaster({ types, zones, areas, locations, beatPlans, cities })
                const marginRows = margins.map((margin) => ({
                    category_id: str(margin.category_id),
                    category_name: margin.category_name,
                    inv_margin: str(margin.inv_margin),
                    pro_margin: str(margin.pro_margin),
                }))
                if (distributorid) {
                    const distributor = data.data['distributor']
                    // Converting a pending sales rep retailer creates a distributor (insert permission)
                    const isPending = str(distributor.d_id).startsWith('s_')
                    setCanSave(isPending ? data.data['action']['insert'] : data.data['action']['update'])
                    const fields = { ...emptyDistributor }
                    for (const key in emptyDistributor) {
                        if (!['doc_file', 'beat_ids', 'margins', 'contacts', 'consignees'].includes(key)) {
                            fields[key] = str(distributor[key])
                        }
                    }
                    fields.d_email_id = str(distributor.email_id)
                    fields.d_mobile = str(distributor.mobile)
                    fields.d_latitude = str(distributor.latitude)
                    fields.d_longitude = str(distributor.longitude)
                    fields.sell_out = distributor.sell_out !== null && distributor.sell_out !== '' ? str(distributor.sell_out) : '0'
                    // Old PHP status select only has Active / InActive ('Pending' records are saved Active)
                    fields.status = distributor.status === 'InActive' ? 'InActive' : 'Approved'
                    fields.beat_ids = data.data['beatIds'].map(str)
                    fields.margins = marginRows
                    fields.contacts = data.data['contacts'].length
                        ? data.data['contacts'].map((contact) => ({ contact_person: str(contact.contact_person), email_id: str(contact.email_id), mobile: str(contact.mobile) }))
                        : [emptyContact]
                    fields.consignees = data.data['consignees'].length
                        ? data.data['consignees'].map((consignee) => {
                            const row = {}
                            for (const key in emptyConsignee) {
                                row[key] = str(consignee[key])
                            }
                            return row
                        })
                        : [emptyConsignee]
                    setDistributorData(fields)
                } else {
                    setDistributorData({ ...emptyDistributor, margins: marginRows })
                }
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error.response) {
                showError(error.response.data['message'])
                if (error.response.status === 404) {
                    navigate('/sales/distributor')
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [distributorid])

    const onSubmit = (values, actions) => {
        const formData = new FormData()
        const skip = ['doc_file', 'beat_ids', 'margins', 'contacts', 'consignees']
        for (const key in values) {
            if (!skip.includes(key)) {
                formData.append(key, values[key])
            }
        }
        formData.append('beat_ids', JSON.stringify(values.beat_ids))
        formData.append('margins', JSON.stringify(values.margins))
        // Blank contact / consignee rows are not sent (saved consignees are always kept)
        formData.append('contacts', JSON.stringify(values.contacts.filter((contact) => !isBlank(contact, CONTACT_FIELDS))))
        formData.append('consignees', JSON.stringify(values.consignees.filter((consignee) => consignee.id || !isBlank(consignee, CONSIGNEE_FIELDS))))
        if (values.doc_file && values.doc_file.length > 0) {
            formData.append('doc_file', values.doc_file[0])
        }

        // 'd_<id>' updates the distributor; a new record or a 's_<id>' pending retailer is created
        const isDistributor = values.d_id.startsWith('d_')
        const request = isDistributor
            ? apiDistributorUpdate({ values: formData, id: values.d_id.substring(2) })
            : apiDistributorPost(formData)

        request.then((data) => {
            actions.setSubmitting(false)
            if (data.status === 200 || data.status === 201) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                actions.resetForm()
                navigate('/sales/distributor')
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

    const selectField = (name, options, props = {}) => (
        <Field name={name}>
            {({ field, form }) => (
                <Select
                    field={field}
                    form={form}
                    options={options}
                    isLoading={loading}
                    placeholder="Select"
                    isClearable={props.isClearable}
                    value={options.filter((option) => option.value === field.value)}
                    onChange={(option) => {
                        form.setFieldValue(field.name, option ? option.value : '')
                        if (props.onSelect) {
                            props.onSelect(form, option)
                        }
                    }}
                    menuPortalTarget={props.portal ? document.body : undefined}
                    style={props.portal ? { menuPortal: (base) => ({ ...base, zIndex: 9999 }) } : undefined}
                />
            )}
        </Field>
    )

    const textField = (name, label, errors, touched, required = false, type = 'text') => (
        <FormItem
            key={name}
            asterisk={required}
            label={label}
            invalid={getError(errors, name) && getTouched(touched, name)}
            errorMessage={getError(errors, name)}
        >
            <Field type={type} name={name} placeholder={label} component={Input} />
        </FormItem>
    )

    const getError = (errors, name) => name.split(/[.[\]]+/).filter(Boolean).reduce((value, key) => (value ? value[key] : undefined), errors)
    const getTouched = (touched, name) => name.split(/[.[\]]+/).filter(Boolean).reduce((value, key) => (value ? value[key] : undefined), touched)

    const cellInput = (name, placeholder, errors, touched, width = 'w-40') => {
        const error = getError(errors, name)
        const touch = getTouched(touched, name)
        return (
            <div className={width}>
                <FormItem className="mb-0" layout="vertical" invalid={error && touch} errorMessage={error}>
                    <Field type="text" name={name} placeholder={placeholder} component={Input} />
                </FormItem>
            </div>
        )
    }

    // City lookup fills state, country and state code (old PHP city autocomplete)
    const cityField = (name, prefix = '', portal = false) => (
        <Field name={name}>
            {({ field, form }) => {
                const options = withCurrent(cityOptions, field.value)
                return (
                    <Select
                        field={field}
                        form={form}
                        options={options}
                        isLoading={loading}
                        isClearable
                        placeholder="City"
                        value={options.filter((option) => option.value === field.value)}
                        onChange={(option) => {
                            form.setFieldValue(field.name, option ? option.value : '')
                            if (option && option.city) {
                                form.setFieldValue(`${prefix}state`, str(option.city.state_name))
                                form.setFieldValue(`${prefix}country`, str(option.city.country_name))
                                form.setFieldValue(`${prefix}state_code`, str(option.city.state_code))
                            }
                        }}
                        menuPortalTarget={portal ? document.body : undefined}
                        style={portal ? { menuPortal: (base) => ({ ...base, zIndex: 9999 }) } : undefined}
                    />
                )
            }}
        </Field>
    )

    return (
        <Formik
            enableReinitialize={true}
            initialValues={distributorData}
            validationSchema={validationSchema}
            onSubmit={onSubmit}
        >
            {({ values, touched, errors, isSubmitting }) => {
                // Old PHP: Type -> Zones of that type -> Areas of that zone
                const zoneOptions = withCurrent(
                    master.zones.filter((zone) => str(zone.type_id) === values.type_id).map((zone) => ({ value: str(zone.id), label: zone.zone })),
                    values.zone_id,
                    (master.zones.find((zone) => str(zone.id) === values.zone_id) || {}).zone
                )
                const areaOptions = withCurrent(
                    master.areas.filter((area) => str(area.zone_id) === values.zone_id).map((area) => ({ value: str(area.id), label: area.area })),
                    values.area_id,
                    (master.areas.find((area) => str(area.id) === values.area_id) || {}).area
                )
                const locationRequired = values.class === 'normal' || values.class === 'direct'

                return (
                    <Form autoComplete="off">
                        <FormContainer layout="horizontal" labelWidth={120} size="sm">
                            <div className="mb-4 md:w-full m-auto">
                                <AdaptableCard className="card-shadow">
                                    <h5 className="mb-2">
                                        {values.d_id.startsWith('d_') ? 'Edit' : 'Add New'} Distributor / Retailer
                                        {values.d_id.startsWith('s_') ? ' (from Sales Representative)' : ''}
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        {textField('distributor_name', 'Distributor Name', errors, touched, true)}
                                        {textField('address', 'Address', errors, touched)}
                                        <FormItem label="City">{cityField('city')}</FormItem>
                                        {textField('pincode', 'Pincode', errors, touched)}
                                        {textField('state', 'State', errors, touched, true)}
                                        {textField('country', 'Country', errors, touched)}
                                        {textField('state_code', 'State Code', errors, touched, true)}
                                        {textField('gst_number', 'GST Number', errors, touched)}
                                        {textField('google_address', 'Google Address', errors, touched)}
                                        {textField('d_latitude', 'Latitude', errors, touched)}
                                        {textField('d_longitude', 'Longitude', errors, touched)}
                                        {textField('d_email_id', 'Email Id', errors, touched)}
                                        {textField('d_mobile', 'Mobile', errors, touched, true)}
                                        {textField('tin_number', 'Tin Number', errors, touched)}
                                        {textField('cst_number', 'Cst Number', errors, touched)}
                                        {textField('sell_out', 'Discount (In %)', errors, touched, true, 'number')}
                                        <FormItem
                                            asterisk
                                            label="Generate Invoice"
                                            invalid={errors.send_invoice && touched.send_invoice}
                                            errorMessage={errors.send_invoice}
                                        >
                                            <Field name="send_invoice">
                                                {({ field, form }) => (
                                                    <Radio.Group value={field.value} onChange={(val) => form.setFieldValue(field.name, val)}>
                                                        <Radio value={'1'}>Yes</Radio>
                                                        <Radio value={'0'}>No</Radio>
                                                    </Radio.Group>
                                                )}
                                            </Field>
                                        </FormItem>
                                        {textField('credit_period', 'Credit Period (In Days)', errors, touched, true)}
                                        <FormItem asterisk label="Class" invalid={errors.class && touched.class} errorMessage={errors.class}>
                                            {selectField('class', classOptions)}
                                        </FormItem>
                                        <FormItem asterisk label="Type" invalid={errors.type_id && touched.type_id} errorMessage={errors.type_id}>
                                            {selectField('type_id', typeOptions, {
                                                // Keep zone / area when they still belong to the chosen type
                                                // (a pending sales rep retailer arrives with zone and area but no type)
                                                onSelect: (form, option) => {
                                                    const zone = master.zones.find((item) => str(item.id) === values.zone_id)
                                                    if (!option || !zone || str(zone.type_id) !== option.value) {
                                                        form.setFieldValue('zone_id', '')
                                                        form.setFieldValue('area_id', '')
                                                    }
                                                },
                                            })}
                                        </FormItem>
                                        <FormItem asterisk label="Zone" invalid={errors.zone_id && touched.zone_id} errorMessage={errors.zone_id}>
                                            {selectField('zone_id', zoneOptions, {
                                                onSelect: (form, option) => {
                                                    const area = master.areas.find((item) => str(item.id) === values.area_id)
                                                    if (!option || !area || str(area.zone_id) !== option.value) {
                                                        form.setFieldValue('area_id', '')
                                                    }
                                                },
                                            })}
                                        </FormItem>
                                        <FormItem asterisk label="Area" invalid={errors.area_id && touched.area_id} errorMessage={errors.area_id}>
                                            {selectField('area_id', areaOptions)}
                                        </FormItem>
                                        <FormItem asterisk={locationRequired} label="Location" invalid={errors.location_id && touched.location_id} errorMessage={errors.location_id}>
                                            {selectField('location_id', withCurrent(locationOptions, values.location_id), { isClearable: true })}
                                        </FormItem>
                                        {textField('tally_name', 'Tally Name', errors, touched)}
                                        {textField('marketplace', 'Marketplace', errors, touched)}
                                        {textField('marketplace_id', 'Marketplace Id', errors, touched)}
                                        <FormItem
                                            asterisk={values.class === 'direct'}
                                            label="Prefix"
                                            invalid={errors.prefix && touched.prefix}
                                            errorMessage={errors.prefix}
                                            extra={<span className="text-xs text-gray-500">Don't use "Direct" or "OOS" in Prefix</span>}
                                        >
                                            <Field type="text" name="prefix" placeholder="Prefix" component={Input} />
                                        </FormItem>
                                        <FormItem label="Beat Plans">
                                            <Field name="beat_ids">
                                                {({ field, form }) => (
                                                    <Select
                                                        isMulti
                                                        field={field}
                                                        form={form}
                                                        options={beatOptions}
                                                        isLoading={loading}
                                                        placeholder="Select"
                                                        value={beatOptions.filter((option) => field.value.includes(option.value))}
                                                        onChange={(options) => form.setFieldValue(field.name, (options || []).map((option) => option.value))}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem label="Document">
                                            <Field name="doc_file">
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
                                            {values.doc_document ? (
                                                <a href={docUrl(values.doc_document)} target="_blank" rel="noreferrer" className="inline-flex items-center text-indigo-600 mt-1">
                                                    <MdDownload className="mr-1" />
                                                    {values.document_name || 'View'}
                                                </a>
                                            ) : null}
                                        </FormItem>
                                        <FormItem asterisk label="Status" invalid={errors.status && touched.status} errorMessage={errors.status}>
                                            {selectField('status', statusOptions)}
                                        </FormItem>
                                    </div>

                                    <h5 className="mb-2">Category Margins</h5>
                                    <Table compact className="border mb-6">
                                        <THead>
                                            <Tr>
                                                <Th>Category</Th>
                                                <Th>Invoice Margin (In %)</Th>
                                                <Th>Promotional Margin (In %)</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            {values.margins.map((margin, index) => (
                                                <Tr key={margin.category_id}>
                                                    <Td width="350" className="text-left">{margin.category_name}</Td>
                                                    <Td>{cellInput(`margins[${index}].inv_margin`, 'Invoice Margin', errors, touched)}</Td>
                                                    <Td>{cellInput(`margins[${index}].pro_margin`, 'Promotional Margin', errors, touched)}</Td>
                                                </Tr>
                                            ))}
                                        </TBody>
                                    </Table>

                                    <h5 className="mb-2">Contacts</h5>
                                    <Table compact className="border mb-6">
                                        <THead>
                                            <Tr>
                                                <Th>Contact Person*</Th>
                                                <Th>Email Id</Th>
                                                <Th>Mobile*</Th>
                                                <Th>Action</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="contacts">
                                                {({ remove, push }) => (
                                                    <>
                                                        {values.contacts.map((contact, index) => (
                                                            <Tr key={index} className="align-top">
                                                                <Td>{cellInput(`contacts[${index}].contact_person`, 'Contact Person', errors, touched, 'w-60')}</Td>
                                                                <Td>{cellInput(`contacts[${index}].email_id`, 'Email Id', errors, touched, 'w-60')}</Td>
                                                                <Td>{cellInput(`contacts[${index}].mobile`, 'Mobile', errors, touched)}</Td>
                                                                <Td width="80">
                                                                    <Button shape="circle" size="sm" type="button" icon={<HiMinus />} onClick={() => remove(index)} />
                                                                </Td>
                                                            </Tr>
                                                        ))}
                                                        <Tr>
                                                            <Td colSpan="4" className="text-left">
                                                                <Button type="button" onClick={() => push(emptyContact)}>Add Contact</Button>
                                                            </Td>
                                                        </Tr>
                                                    </>
                                                )}
                                            </FieldArray>
                                        </TBody>
                                    </Table>

                                    <h5 className="mb-2">Consignees</h5>
                                    <div className="overflow-x-auto mb-6">
                                        <Table compact className="border">
                                            <THead>
                                                <Tr>
                                                    <Th>Name*</Th>
                                                    <Th>Address*</Th>
                                                    <Th>City</Th>
                                                    <Th>Pincode</Th>
                                                    <Th>State*</Th>
                                                    <Th>Country</Th>
                                                    <Th>State Code*</Th>
                                                    <Th>GST Number</Th>
                                                    <Th>Action</Th>
                                                </Tr>
                                            </THead>
                                            <TBody>
                                                <FieldArray name="consignees">
                                                    {({ remove, push }) => (
                                                        <>
                                                            {values.consignees.map((consignee, index) => (
                                                                <Tr key={index} className="align-top">
                                                                    <Td>{cellInput(`consignees[${index}].con_name`, 'Name', errors, touched)}</Td>
                                                                    <Td>{cellInput(`consignees[${index}].con_address`, 'Address', errors, touched, 'w-56')}</Td>
                                                                    <Td><div className="w-44">{cityField(`consignees[${index}].con_city`, `consignees[${index}].con_`, true)}</div></Td>
                                                                    <Td>{cellInput(`consignees[${index}].con_pincode`, 'Pincode', errors, touched, 'w-28')}</Td>
                                                                    <Td>{cellInput(`consignees[${index}].con_state`, 'State', errors, touched, 'w-36')}</Td>
                                                                    <Td>{cellInput(`consignees[${index}].con_country`, 'Country', errors, touched, 'w-32')}</Td>
                                                                    <Td>{cellInput(`consignees[${index}].con_state_code`, 'State Code', errors, touched, 'w-24')}</Td>
                                                                    <Td>{cellInput(`consignees[${index}].con_gst_number`, 'GST Number', errors, touched, 'w-40')}</Td>
                                                                    <Td>
                                                                        {/* Old PHP: saved consignees are only updated, never removed */}
                                                                        {!consignee.id ? (
                                                                            <Button shape="circle" size="sm" type="button" icon={<HiMinus />} onClick={() => remove(index)} />
                                                                        ) : null}
                                                                    </Td>
                                                                </Tr>
                                                            ))}
                                                            <Tr>
                                                                <Td colSpan="9" className="text-left">
                                                                    <Button type="button" className="ltr:mr-2 rtl:ml-2" onClick={() => push(emptyConsignee)}>Add Consignee</Button>
                                                                    {typeof errors.consignees === 'string' ? (
                                                                        <span className="text-red-500">{errors.consignees}</span>
                                                                    ) : null}
                                                                </Td>
                                                            </Tr>
                                                        </>
                                                    )}
                                                </FieldArray>
                                            </TBody>
                                        </Table>
                                    </div>

                                    <FormItem label="Remarks" invalid={errors.remarks && touched.remarks} errorMessage={errors.remarks}>
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
                                <Button size="sm" type="button" onClick={() => navigate('/sales/distributor')}>
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

export default AddEditDistributor
