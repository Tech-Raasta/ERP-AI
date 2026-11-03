import React, { useEffect, useState, useRef } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import AsyncSelect from 'react-select/async'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'
import { apiDepotGetSingle, apiDepotMasterData, apiDepotPost, apiDepotUpdate } from 'services/Depot'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { HiMinus } from 'react-icons/hi'

const mobileRule = Yup.string()
    .required('Mobile Number is Required')
    .matches(/^[0-9]{10}$/, 'Please Enter Valid Mobile Number')

const validationSchema = Yup.object().shape({
    depot_name: Yup.string().required('Depot Name Is Required'),
    depot_code: Yup.string().required('Depot Code Is Required').length(3, 'Depot Code must be 3 characters'),
    mobile: mobileRule,
    email_id: Yup.string().email('Enter valid email'),
    state: Yup.string().required('State Is Required'),
    type: Yup.string().required('Type Is Required'),
    status: Yup.string().required('Status Is Required'),
    contactPersons: Yup.array().of(
        Yup.object().shape({
            contact_person: Yup.string().required('Name Is Required'),
            email_id: Yup.string().nullable().email('Enter valid email'),
            mobile: mobileRule,
        })
    ),
})

const fieldFeedback = (form, name) => {
    const error = getIn(form.errors, name)
    const touch = getIn(form.touched, name)
    return {
        errorMessage: error || '',
        invalid: typeof touch === 'undefined' ? false : error && touch,
    }
}

const depotTypes = [
    { value: 'Depot', label: 'Depot' },
    { value: 'Manufacturer', label: 'Manufacturer' },
    { value: 'Sales', label: 'Sales' },
]

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' },
]

const emptyDepot = {
    depot_name: '',
    depot_code: '',
    address: '',
    city: '',
    pincode: '',
    state: '',
    state_code: '',
    country: '',
    email_id: '',
    mobile: '',
    type: '',
    gst_no: '',
    fssai_no: '',
    bank_acc_no: '',
    bank_name: '',
    ifsc_code: '',
    depot_fc_id: '',
    warehouse: '',
    warehouse_id: '',
    status: 'Approved',
    remarks: '',
    contactPersons: [{ contact_person: '', email_id: '', mobile: '' }],
}

const textFields = [
    { name: 'gst_no', label: 'GST No' },
    { name: 'fssai_no', label: 'FSSAI No' },
    { name: 'bank_acc_no', label: 'Bank Account No' },
    { name: 'bank_name', label: 'Bank Name' },
    { name: 'ifsc_code', label: 'IFSC Code' },
    { name: 'depot_fc_id', label: 'Fulfillment Center Code' },
    { name: 'warehouse', label: 'Warehouse' },
    { name: 'warehouse_id', label: 'Warehouse Id' },
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

const AddEditDepot = () => {
    const [masterOption, setMasterOption] = useState({
        cities: [],
        countries: [],
        pincodes: [],
        states: [],
    })
    const [loading, setLoading] = useState(false)
    const [depotData, setDepotData] = useState(emptyDepot)
    const [canSave, setCanSave] = useState(true)
    const navigate = useNavigate()
    const { depotid } = useParams()
    const formRef = useRef()

    const setMasterData = ({ cities, countries, pincodes, states }) => {
        setMasterOption({
            cities: cities.map((data) => ({
                value: data.city_name,
                label: data.city_name,
                state_id: data.state_id,
            })),
            countries: countries.map((data) => ({
                value: data.country_name,
                label: data.country_name,
                id: data.id,
            })),
            pincodes: pincodes.map((data) => ({
                value: data.pincode ? data.pincode.toString() : '',
                label: data.pincode ? data.pincode.toString() : '',
                state_id: data.state_id,
            })),
            states: states.map((data) => ({
                value: data.state_name,
                label: data.state_name,
                state_code: data.state_code,
                country_id: data.country_id,
                id: data.id,
            })),
        })
    }

    useEffect(() => {
        setLoading(true)
        const request = depotid ? apiDepotGetSingle(depotid) : apiDepotMasterData()
        request.then((data) => {
            if (data.status === 200) {
                setMasterData(data.data.masterData)
                if (depotid) {
                    const depot = data.data['depot']
                    setCanSave(data.data['action']['update'])
                    const fields = {}
                    for (const key in emptyDepot) {
                        fields[key] = depot[key] !== null && depot[key] !== undefined ? depot[key].toString() : ''
                    }
                    fields.status = depot.status === 'InActive' ? 'InActive' : 'Approved'
                    fields.contactPersons = depot.contactPersons && depot.contactPersons.length > 0
                        ? depot.contactPersons.map((c) => ({
                            contact_person: c.contact_person || '',
                            email_id: c.email_id || '',
                            mobile: c.mobile || '',
                        }))
                        : emptyDepot.contactPersons
                    setDepotData(fields)
                }
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error.response) {
                showError(error.response.data['message'])
                if (error.response.status === 401 || error.response.status === 404) {
                    navigate('/product/depot')
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [depotid])

    const loadPincodes = (inputValue, callback) => {
        callback(
            masterOption.pincodes
                .filter((data) => data.value.startsWith(inputValue.toString()))
                .slice(0, 50)
        )
    }

    const setStateFields = (state) => {
        formRef.current.setFieldValue('state', state ? state.value : '')
        formRef.current.setFieldValue('state_code', state && state.state_code ? state.state_code : '')
        if (state) {
            const country = masterOption.countries.find((c) => c.id === state.country_id)
            if (country) {
                formRef.current.setFieldValue('country', country.value)
            }
        }
    }

    const changeCity = (option) => {
        if (option) {
            setStateFields(masterOption.states.find((s) => s.id === option.state_id))
        }
    }

    const onSubmit = (values, actions) => {
        const payload = {
            ...values,
            contactPersons: values.contactPersons.filter((c) => c.contact_person),
        }
        const request = depotid
            ? apiDepotUpdate({ values: payload, id: depotid })
            : apiDepotPost(payload)

        request.then((data) => {
            actions.setSubmitting(false)
            if (data.status === 200 || data.status === 201) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                actions.resetForm()
                navigate('/product/depot')
            } else if (data.response) {
                if (data.response.status === 422) {
                    handleValidationErrors(data.response.data['error'], actions)
                } else {
                    showError(data.response.data['message'])
                }
            }
        })
    }

    const selectField = (name, options, onSelect) => (
        <Field name={name}>
            {({ field, form }) => (
                <Select
                    field={field}
                    form={form}
                    options={options}
                    isLoading={loading}
                    isClearable
                    value={options.filter((option) => option.value === field.value)}
                    onChange={(option) => {
                        if (onSelect) {
                            onSelect(option)
                        }
                        form.setFieldValue(field.name, option ? option.value : '')
                    }}
                />
            )}
        </Field>
    )

    return (
        <Formik
            enableReinitialize={true}
            innerRef={formRef}
            initialValues={depotData}
            validationSchema={validationSchema}
            onSubmit={onSubmit}
        >
            {({ values, touched, errors, isSubmitting }) => (
                <Form autoComplete="off">
                    <FormContainer layout="horizontal" labelWidth={120} size="sm">
                        <div className="mb-4 md:w-full m-auto">
                            <AdaptableCard className="card-shadow">
                                <h5 className="mb-2">{depotid ? 'Edit' : 'Add New'} Depot</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                    <FormItem
                                        asterisk
                                        label="Depot Name"
                                        invalid={errors.depot_name && touched.depot_name}
                                        errorMessage={errors.depot_name}
                                    >
                                        <Field type="text" name="depot_name" placeholder="Depot Name" component={Input} />
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Depot Code"
                                        invalid={errors.depot_code && touched.depot_code}
                                        errorMessage={errors.depot_code}
                                    >
                                        <Field type="text" name="depot_code" placeholder="Depot Code" maxLength={3} component={Input} />
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Type"
                                        invalid={errors.type && touched.type}
                                        errorMessage={errors.type}
                                    >
                                        {selectField('type', depotTypes)}
                                    </FormItem>
                                    <FormItem
                                        label="Address"
                                        invalid={errors.address && touched.address}
                                        errorMessage={errors.address}
                                    >
                                        <Field type="text" name="address" placeholder="Address" component={Input} />
                                    </FormItem>
                                    <FormItem
                                        label="City"
                                        invalid={errors.city && touched.city}
                                        errorMessage={errors.city}
                                    >
                                        {selectField('city', masterOption.cities, changeCity)}
                                    </FormItem>
                                    <FormItem
                                        label="Pincode"
                                        invalid={errors.pincode && touched.pincode}
                                        errorMessage={errors.pincode}
                                    >
                                        <Field name="pincode">
                                            {({ field, form }) => (
                                                <Select
                                                    field={field}
                                                    form={form}
                                                    loadOptions={loadPincodes}
                                                    isLoading={loading}
                                                    isClearable
                                                    value={field.value ? { value: field.value, label: field.value } : null}
                                                    onChange={(option) =>
                                                        form.setFieldValue(field.name, option ? option.value : '')
                                                    }
                                                    componentAs={AsyncSelect}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="State"
                                        invalid={errors.state && touched.state}
                                        errorMessage={errors.state}
                                    >
                                        {selectField('state', masterOption.states, setStateFields)}
                                    </FormItem>
                                    <FormItem
                                        label="Country"
                                        invalid={errors.country && touched.country}
                                        errorMessage={errors.country}
                                    >
                                        {selectField('country', masterOption.countries)}
                                    </FormItem>
                                    <FormItem
                                        label="Email Id"
                                        invalid={errors.email_id && touched.email_id}
                                        errorMessage={errors.email_id}
                                    >
                                        <Field type="email" name="email_id" placeholder="Email Id" component={Input} />
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Mobile"
                                        invalid={errors.mobile && touched.mobile}
                                        errorMessage={errors.mobile}
                                    >
                                        <Field type="tel" name="mobile" placeholder="Mobile" maxLength={10} component={Input} />
                                    </FormItem>
                                    {textFields.map((item) => (
                                        <FormItem
                                            key={item.name}
                                            label={item.label}
                                            invalid={errors[item.name] && touched[item.name]}
                                            errorMessage={errors[item.name]}
                                        >
                                            <Field type="text" name={item.name} placeholder={item.label} component={Input} />
                                        </FormItem>
                                    ))}
                                    {depotid ? (
                                        <FormItem
                                            asterisk
                                            label="Status"
                                            invalid={errors.status && touched.status}
                                            errorMessage={errors.status}
                                        >
                                            {selectField('status', statusOptions)}
                                        </FormItem>
                                    ) : null}
                                </div>

                                <h5 className="mb-2 mt-4">Contact Persons</h5>
                                <div className="grid grid-cols-1 gap-x-8 gap-y-2 mb-6">
                                    <FieldArray name="contactPersons">
                                        {({ form, remove, push }) => (
                                            <div>
                                                {values.contactPersons.map((contactPerson, index) => {
                                                    const contact_person = fieldFeedback(form, `contactPersons[${index}].contact_person`)
                                                    const email_id = fieldFeedback(form, `contactPersons[${index}].email_id`)
                                                    const mobile = fieldFeedback(form, `contactPersons[${index}].mobile`)

                                                    return (
                                                        <div key={index}>
                                                            <FormItem
                                                                asterisk
                                                                label="Contact Person"
                                                                invalid={contact_person.invalid}
                                                                errorMessage={contact_person.errorMessage}
                                                                layout="inline"
                                                            >
                                                                <Field
                                                                    invalid={contact_person.invalid}
                                                                    placeholder="Contact Person"
                                                                    name={`contactPersons[${index}].contact_person`}
                                                                    type="text"
                                                                    component={Input}
                                                                />
                                                            </FormItem>
                                                            <FormItem
                                                                label="Email Id"
                                                                invalid={email_id.invalid}
                                                                errorMessage={email_id.errorMessage}
                                                                layout="inline"
                                                            >
                                                                <Field
                                                                    invalid={email_id.invalid}
                                                                    placeholder="Email Id"
                                                                    name={`contactPersons[${index}].email_id`}
                                                                    type="text"
                                                                    component={Input}
                                                                />
                                                            </FormItem>
                                                            <FormItem
                                                                asterisk
                                                                label="Mobile"
                                                                invalid={mobile.invalid}
                                                                errorMessage={mobile.errorMessage}
                                                                layout="inline"
                                                            >
                                                                <Field
                                                                    invalid={mobile.invalid}
                                                                    placeholder="Mobile"
                                                                    name={`contactPersons[${index}].mobile`}
                                                                    type="text"
                                                                    maxLength={10}
                                                                    component={Input}
                                                                />
                                                            </FormItem>
                                                            <Button
                                                                type="button"
                                                                shape="circle"
                                                                size="sm"
                                                                icon={<HiMinus />}
                                                                onClick={() => remove(index)}
                                                                disabled={index === 0}
                                                            />
                                                        </div>
                                                    )
                                                })}
                                                <div>
                                                    <Button
                                                        type="button"
                                                        className="ltr:mr-2 rtl:ml-2"
                                                        onClick={() => push({ contact_person: '', email_id: '', mobile: '' })}
                                                    >
                                                        Add a Person
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </FieldArray>
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
                            <Button size="sm" type="button" onClick={() => navigate('/product/depot')}>
                                Cancel
                            </Button>
                        </div>
                    </StickyFooter>
                </Form>
            )}
        </Formik>
    )
}

export default AddEditDepot
