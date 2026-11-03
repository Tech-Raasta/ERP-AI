import React, { useEffect, useState, useRef } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import AsyncSelect from 'react-select/async'
import Upload from 'components/ui/Upload'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'
import { apiVendorApprove, apiVendorDelete, apiVendorGetSingle, apiVendorMasterData, apiVendorPost, apiVendorReject, apiVendorUpdate } from 'services/VendorService'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
// import debounce from 'lodash/debounce'
import { HiMinus } from 'react-icons/hi'
import { saveAs } from 'file-saver'
import { useSelector } from 'react-redux'
import appConfig from 'configs/app.config'


// const MIN_UPLOAD = 1
const MAX_UPLOAD = 1

const validationSchema = Yup.object().shape({
    vendor_code: '',
    vendor_name: Yup.string().required('Vendor Name Is Required'),
    mobile: Yup.string().required('Mobile Number is Required').matches("[0-9]{10}", 'Please Enter Valid Mobile Number').length(10, 'Please Enter Valid Mobile Number'),
    state: Yup.string().required('State Is Required'),
    bank_acc_name: Yup.string().required('Beneficiary Name Is Required'),
    bank_acc_no: Yup.string().required('Bank Account No. Is Required'),
    c_bank_acc_no: Yup.string().required('Confirm Bank Account No. Required').oneOf([Yup.ref('bank_acc_no')], 'Enter Same Bank Account'),
    bank_name: Yup.string().required('Bank Name Is Required'),
    bank_branch_name: '',
    ifsc_code: Yup.string().required('IFSC Code Is Required'),
    payment_due_days: Yup.number().required('Payment Due Days Id Required'),
    bank_email: Yup.string().required('Payment Notification Email Id Required'),
    contactPersons: Yup.array().of(
        Yup.object().shape({
            contact_person: Yup.string().required('Name Is Required'),
            email_id: Yup.string().required('Email Is Required').email('Enter valid email'),
            mobile: Yup.string().required('Mobile Number is Required').matches("[0-9]{10}", 'Please Enter Valid Mobile Number').length(10, 'Please Enter Valid Mobile Number'),
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

const AddEditVendor = () => {
    const [masterOption, setMasterOption] = useState({
        cities: [],
        countries: [],
        pincodes: [],
        states: [],
        vendorTypes: [],
        vendorBanks: []
    });
    const [loading, setLoading] = useState(false)
    const [vendorData, setVendorData] = useState(
        {
            vendor_code: '',
            vendor_name: '',
            mobile: '',
            type_id: '',
            address: '',
            city: '',
            pincode: '',
            state: '',
            country: '',
            tin_number: '',
            cst_number: '',
            gst_number: '',
            bank_acc_name: '',
            bank_acc_no: '',
            c_bank_acc_no: '',
            bank_name: '',
            bank_branch_name: '',
            ifsc_code: '',
            bank_email: '',
            bank_document: [],
            gst_document: [],
            pan_document: [],
            msme_document: [],
            payment_due_days: '',
            bank_document_name: null,
            gst_document_name: null,
            pan_document_name: null,
            msme_document_name: null,
            bank_document_download: null,
            gst_document_download: null,
            pan_document_download: null,
            msme_document_download: null,
            contactPersons: [],
            remarks: '',
        }
    )
    const navigate = useNavigate()
    const vendorId = useParams();
    const [actionBtn, setActionBtn] = useState({
        approve: false,
        delete: false,
        update: false
    })
    const formRef = useRef();
    const [userCheck, setUserCheck] = useState(true);
    console.log("Add Vendor.js Loading....")
    const userInfo = useSelector((state) => state.auth.user)
    useEffect(() => {
        const promiseOptions = () => {
            if (vendorId.vendorid) {
                setLoading(true);
                apiVendorGetSingle(vendorId.vendorid).then(data => {
                    if (data.status === 200) {
                        // const userData = deepParseJson(localStorage.getItem('admin'));

                        if (userInfo.userId == 439 || userInfo.userId == 449 || userInfo.userId == 466 || userInfo.userId == 509) {
                            setUserCheck(false);
                        }
                        // console.log(data.data['action'])
                        const { cities, countries, pincodes, states, vendorTypes, vendorBanks } = data.data.masterData;
                        setActionBtn({
                            approve: data.data['action']['approve'],
                            update: data.data['action']['update'],
                            delete: data.data['action']['delete']
                        })
                        setMasterOption(
                            {
                                cities: cities.map(data => {
                                    return {
                                        value: data.city_name,
                                        label: data.city_name,
                                        state_id: data.state_id
                                    }
                                }),
                                countries: countries.map(data => {
                                    return {
                                        value: data.country_name,
                                        label: data.country_name,
                                        id: data.id
                                    }
                                }),
                                pincodes: pincodes.map(data => {
                                    return {
                                        value: data.pincode,
                                        label: data.pincode,
                                        state_id: data.state_id
                                    }
                                }),
                                states: states.map(data => {
                                    return {
                                        value: data.state_name,
                                        label: data.state_name,
                                        country_id: data.country_id,
                                        id: data.id
                                    }
                                }),
                                vendorTypes: vendorTypes.map(data => {
                                    return {
                                        value: data.id,
                                        label: data.vendor_type
                                    }
                                }),
                                vendorBanks: vendorBanks.map(data => {
                                    return {
                                        value: data.bank_name,
                                        label: data.bank_name
                                    }
                                })

                            }
                        )
                        setVendorData({
                            vendor_code: data.data['vendor'].vendor_code,
                            vendor_name: data.data['vendor'].vendor_name,
                            mobile: data.data['vendor'].mobile,
                            type_id: data.data['vendor'].type_id,
                            address: data.data['vendor'].address,
                            city: data.data['vendor'].city,
                            pincode: data.data['vendor'].pincode != null || data.data['vendor'].pincode != '' ? parseInt(data.data['vendor'].pincode) : '',
                            state: data.data['vendor'].state,
                            country: data.data['vendor'].country,
                            tin_number: data.data['vendor'].tin_number,
                            cst_number: data.data['vendor'].cst_number,
                            gst_number: data.data['vendor'].gst_number,
                            bank_acc_name: data.data['vendor'].bank_acc_name,
                            bank_acc_no: data.data['vendor'].bank_acc_no,
                            c_bank_acc_no: data.data['vendor'].bank_acc_no,
                            bank_name: data.data['vendor'].bank_name,
                            bank_branch_name: data.data['vendor'].bank_branch_name,
                            ifsc_code: data.data['vendor'].ifsc_code,
                            bank_email: data.data['vendor'].bank_email,
                            bank_document: [],
                            gst_document: [],
                            pan_document: [],
                            msme_document: [],
                            payment_due_days: data.data['vendor'].payment_due_days != null ? data.data['vendor'].payment_due_days : 0,
                            bank_document_download: data.data['vendor'].bank_document,
                            gst_document_download: data.data['vendor'].gst_document,
                            pan_document_download: data.data['vendor'].pan_document,
                            msme_document_download: data.data['vendor'].msme_document,
                            bank_document_name: data.data['vendor'].bank_document_name,
                            gst_document_name: data.data['vendor'].gst_document_name,
                            pan_document_name: data.data['vendor'].pan_document_name,
                            msme_document_name: data.data['vendor'].msme_document_name,
                            contactPersons: data.data['vendor'].contactPersons,
                            remarks: data.data['vendor'].remarks,
                        })
                        setLoading(false);
                    }
                });
            } else {
                apiVendorMasterData().then(data => {
                    if (data.status === 200) {
                        const { cities, countries, pincodes, states, vendorTypes, vendorBanks } = data.data.masterData;
                        setMasterOption(
                            {
                                cities: cities.map(data => {
                                    return {
                                        value: data.city_name,
                                        label: data.city_name,
                                        state_id: data.state_id
                                    }
                                }),
                                countries: countries.map(data => {
                                    return {
                                        value: data.country_name,
                                        label: data.country_name,
                                        id: data.id
                                    }
                                }),
                                pincodes: pincodes.map(data => {
                                    return {
                                        value: data.pincode,
                                        label: data.pincode,
                                        state_id: data.state_id
                                    }
                                }),
                                states: states.map(data => {
                                    return {
                                        value: data.state_name,
                                        label: data.state_name,
                                        country_id: data.country_id,
                                        id: data.id
                                    }
                                }),
                                vendorTypes: vendorTypes.map(data => {
                                    return {
                                        value: data.id,
                                        label: data.vendor_type
                                    }
                                }),
                                vendorBanks: vendorBanks.map(data => {
                                    return {
                                        value: data.bank_name,
                                        label: data.bank_name
                                    }
                                })

                            }
                        )
                        setLoading(false);
                    }
                }).catch(error => {
                    if (error.response.status === 401) {
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {error.response.data['message']}
                            </Notification>
                        )
                    }
                    setLoading(false)
                })
            }

            return true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        promiseOptions()
        // if (masterOption) {
        //     setLoading(true)
        // }
        // eslint-disable-next-line react-hooks/exhaustive-deps

    }, []);


    const filterPincode = (inputValue) => {
        return masterOption.pincodes.filter((data) =>
            // data.value.toString().includes(inputValue.toString())
            data.value.toString().startsWith(inputValue.toString())
        )
    }

    const loadOptions = (inputValue, callback) => {
        setTimeout(() => {
            callback(filterPincode(inputValue))
        }, 1000)
    }

    const beforeUpload = (file, fileList) => {
        let valid = true

        const allowedFileType = ['image/jpeg', 'image/png', 'application/pdf']
        const MAX_FILE_SIZE = 25000000

        if (fileList.length >= MAX_UPLOAD) {
            return `You can only upload ${MAX_UPLOAD} file(s)`
        }

        if (file) {
            for (const f of file) {
                if (!allowedFileType.includes(f.type)) {
                    valid = 'Please upload a .jpeg or .png file or .pdf!'
                }

                if (f.size >= MAX_FILE_SIZE) {
                    valid = 'Upload image cannot more then 2MB!'
                }
            }
        }

        return valid
    }

    const deleteVendor = () => {
        // console.log(formRef.current)
        apiVendorDelete(vendorId.vendorid).then(data => {
            console.log(data);
            if (data.status === 200) {
                formRef.current.setSubmitting(false)
                toast.push(
                    <Notification
                        title='Success'
                        type='success'
                        closable
                    >
                        {data.data['message']}
                    </Notification>
                )
                formRef.current.resetForm();
                navigate('/product/vendor')
            } else if (data.response.status === 404) {
                toast.push(
                    <Notification
                        title='Error'
                        type='danger'
                        closable
                    >
                        {data.response.data['message']}

                    </Notification>
                )
            }
        }).catch(error => {
            // let errorData = error.response['data']['error']['errors'];
            toast.push(
                <Notification
                    title='Error'
                    type='danger'
                    closable
                >
                    {error.response.data['message']}

                </Notification>
            )
        })
    }

    const rejectVendor = () => {
        // console.log(formRef)
        const values = formRef.current.values
        apiVendorReject({ values, ...{ id: vendorId.vendorid } }).then(data => {
            console.log(data);
            if (data.status === 200) {
                formRef.current.setSubmitting(false)
                toast.push(
                    <Notification
                        title='Success'
                        type='success'
                        closable
                    >
                        {data.data['message']}
                    </Notification>
                )
                formRef.current.resetForm();
                navigate('/product/vendor')
            }
        }).catch(error => {
            let errorData = error.response['data']['error']['errors'];
            if (error.response.status === 422) {
                for (const errMsg in errorData) {
                    formRef.current.setFieldError(errMsg, errorData[errMsg]['message'])
                    toast.push(
                        <Notification
                            title='Error'
                            type='danger'
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
                        title='Error'
                        type='danger'
                        closable
                    >
                        {error.response.data['message']}

                    </Notification>
                )
            }
        })
    }

    const download = (url) => {
        saveAs(`${appConfig.uploadUrl}vendors/` + url)
    }

    const changeCity = (option) => {
        console.log(option)
        masterOption.states.forEach((el, index) => {
            if (el.id == option.state_id) {
                formRef.current.setFieldValue('state', el.value)
                console.log(el, index)
                masterOption.countries.forEach((ele, index) => {
                    if (ele.id == el.country_id) {
                        formRef.current.setFieldValue('country', ele.value)
                    }
                })
            }
        })
    }

    return (
        <>
            <Formik
                enableReinitialize={true}
                innerRef={formRef}
                initialValues={
                    {
                        vendor_code: vendorData.vendor_code,
                        vendor_name: vendorData.vendor_name,
                        mobile: vendorData.mobile,
                        type_id: vendorData.type_id,
                        address: vendorData.address,
                        city: vendorData.city,
                        pincode: vendorData.pincode,
                        state: vendorData.state,
                        country: vendorData.country,
                        tin_number: vendorData.tin_number,
                        cst_number: vendorData.cst_number,
                        gst_number: vendorData.gst_number,
                        bank_acc_name: vendorData.bank_acc_name,
                        bank_acc_no: vendorData.bank_acc_no,
                        c_bank_acc_no: vendorData.bank_acc_no ? vendorData.bank_acc_no : '',
                        bank_name: vendorData.bank_name,
                        bank_branch_name: vendorData.bank_branch_name,
                        ifsc_code: vendorData.ifsc_code,
                        bank_email: vendorData.bank_email,
                        bank_document: [],
                        gst_document: [],
                        pan_document: [],
                        msme_document: [],
                        payment_due_days: vendorData.payment_due_days,
                        bank_document_name: vendorData.bank_document_name,
                        gst_document_name: vendorData.gst_document_name,
                        pan_document_name: vendorData.pan_document_name,
                        msme_document_name: vendorData.msme_document_name,
                        bank_document_download: vendorData.bank_document_download,
                        gst_document_download: vendorData.gst_document_download,
                        pan_document_download: vendorData.pan_document_download,
                        msme_document_download: vendorData.msme_document_download,
                        contactPersons: vendorData.contactPersons == [] ? [] : vendorData.contactPersons,
                        remarks: vendorData.remarks,
                    }
                }
                validationSchema={validationSchema}
                onSubmit={(values, actions) => {
                    const formData = new FormData();
                    for (const i in values) {
                        console.log(i)
                        if (i === 'contactPersons') {
                            formData.append(i, JSON.stringify(values[i]))
                        } else {
                            formData.append(i, values[i])
                        }
                    }
                    formData.append('bank_document', values.bank_document[0])
                    formData.append('gst_document', values.gst_document[0])
                    formData.append('msme_document', values.msme_document[0])
                    formData.append('pan_document', values.pan_document[0])
                    console.log(formData)
                    if (vendorId.vendorid) {
                        // console.log(values)
                        if (actionBtn.approve) {
                            apiVendorApprove({ values: formData, ...{ id: vendorId.vendorid } }).then(data => {
                                console.log(data);
                                if (data.status === 200) {
                                    actions.setSubmitting(false)
                                    toast.push(
                                        <Notification
                                            title='Success'
                                            type='success'
                                            closable
                                        >
                                            {data.data['message']}
                                        </Notification>
                                    )
                                    actions.resetForm();
                                    navigate('/product/vendor')
                                }
                            }).catch(error => {
                                actions.setSubmitting(false)
                                let errorData = error.response['data']['error']['errors'];
                                if (error.response.status === 422) {
                                    for (const errMsg in errorData) {
                                        actions.setFieldError(errMsg, errorData[errMsg]['message'])
                                        toast.push(
                                            <Notification
                                                title='Error'
                                                type='danger'
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
                                            title='Error'
                                            type='danger'
                                            closable
                                        >
                                            {error.response.data['message']}

                                        </Notification>
                                    )
                                }
                            })
                        } else {
                            apiVendorUpdate({ values: formData, ...{ id: vendorId.vendorid } }).then(data => {
                                console.log(data);
                                actions.setSubmitting(false)
                                if (data.status === 200) {
                                    toast.push(
                                        <Notification
                                            title='Success'
                                            type='success'
                                            closable
                                        >
                                            {data.data['message']}
                                        </Notification>
                                    )
                                    actions.resetForm();
                                    navigate('/product/vendor')
                                } else if (data.response.status === 422) {
                                    let errorData = data.response['data']['error']['errors'];
                                    for (const errMsg in errorData) {
                                        actions.setFieldError(errMsg, errorData[errMsg]['message'])
                                        toast.push(
                                            <Notification
                                                title='Error'
                                                type='danger'
                                                closable
                                            >
                                                {errorData[errMsg]['message']}

                                            </Notification>
                                        )
                                    }
                                } else if (data.response.status === 500) {
                                    toast.push(
                                        <Notification
                                            title='Error'
                                            type='danger'
                                            closable
                                        >
                                            {data.response.data['message']}

                                        </Notification>
                                    )
                                }
                            }).catch(error => {
                                actions.setSubmitting(false)
                                let errorData = error.response['data']['error']['errors'];
                                console.log(errorData)
                                if (error.response.status === 422) {
                                    for (const errMsg in errorData) {
                                        actions.setFieldError(errMsg, errorData[errMsg]['message'])
                                        toast.push(
                                            <Notification
                                                title='Error'
                                                type='danger'
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
                                            title='Error'
                                            type='danger'
                                            closable
                                        >
                                            {error.response.data['message']}

                                        </Notification>
                                    )
                                }
                            })
                        }
                    } else {
                        console.log(formData)
                        apiVendorPost(formData).then(data => {
                            actions.setSubmitting(false)
                            if (data.status === 201) {
                                console.log(data);
                                actions.resetForm();
                                toast.push(
                                    <Notification
                                        title='Success'
                                        type='success'
                                        closable
                                    >
                                        {data.data['message']}
                                    </Notification>
                                )
                                navigate('/product/vendor')
                            } else if (data.response.status === 422) {
                                let errorData = data.response['data']['error']['errors'];
                                errorData.map(err => {
                                    // console.log(err);
                                    actions.setFieldError(err.path, err.message)
                                    toast.push(
                                        <Notification
                                            title='Error'
                                            type='danger'
                                            closable
                                        >
                                            {err.message}

                                        </Notification>
                                    )
                                })

                            }
                        }).catch(error => {
                            let errorData = error.response['data']['error']['errors'];
                            actions.setSubmitting(false)
                            if (error.response.status === 422) {
                                errorData.map(err => {
                                    // console.log(err);
                                    actions.setFieldError(err.path, err.message)
                                    toast.push(
                                        <Notification
                                            title='Error'
                                            type='danger'
                                            closable
                                        >
                                            {err.message}

                                        </Notification>
                                    )
                                })

                            } else if (error.response.status === 500) {
                                console.log(errorData)
                                toast.push(
                                    <Notification
                                        title='Error'
                                        type='danger'
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
                {({ values, touched, errors, isSubmitting }) => {
                    const contactPersons = values.contactPersons
                    return (
                        <Form autoComplete='off' autoSave='off'>
                            <FormContainer layout='horizontal' labelWidth={120} size='sm'>
                                <div className="mb-4 md:w-full m-auto">
                                    <AdaptableCard className="card-shadow">
                                        <h5 className='mb-2'>{vendorId.vendorid ? 'Edit' : 'Add New'} Vendor</h5>
                                        {/* <p className="mb-6">{vendorId.vendorid ? 'Edit' : 'Add'} basic details of vendor</p> */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 ">
                                            <FormItem
                                                label="Vendor Code"
                                                invalid={errors.vendor_code && touched.vendor_code}
                                                errorMessage={errors.vendor_code}

                                            >
                                                <Field
                                                    type="text"
                                                    name="vendor_code"
                                                    placeholder="Vendor Code"
                                                    component={Input}
                                                    disabled={+true}
                                                />
                                            </FormItem>
                                            <FormItem
                                                asterisk
                                                label="Vendor Name"
                                                invalid={errors.vendor_name && touched.vendor_name}
                                                errorMessage={errors.vendor_name}
                                            >
                                                <Field
                                                    type="text"
                                                    name="vendor_name"
                                                    placeholder="Vendor Name"
                                                    component={Input}

                                                />
                                            </FormItem>
                                            <FormItem
                                                asterisk
                                                label="Mobile Number"
                                                invalid={errors.mobile && touched.mobile}
                                                errorMessage={errors.mobile}

                                            >
                                                <Field
                                                    type="tel"
                                                    name="mobile"
                                                    placeholder="Mobile Number"
                                                    component={Input}
                                                />
                                            </FormItem>
                                            <FormItem
                                                label="Vendor Type"
                                                invalid={errors.type_id && touched.type_id}
                                                errorMessage={errors.type_id}
                                            >
                                                <Field name="type_id">
                                                    {({ field, form }) => (
                                                        <Select
                                                            field={field}
                                                            form={form}
                                                            options={masterOption.vendorTypes}
                                                            // onFocus={onFocus}
                                                            isLoading={loading}
                                                            value={masterOption.vendorTypes.filter(
                                                                (option) => option.value === values.type_id
                                                            )}
                                                            onChange={(option) => {
                                                                return form.setFieldValue(
                                                                    field.name,
                                                                    option?.value
                                                                )
                                                            }}
                                                        />
                                                    )}
                                                </Field>
                                            </FormItem>
                                            <FormItem
                                                label="Address"
                                                invalid={errors.address && touched.address}
                                                errorMessage={errors.address}

                                            >
                                                <Field
                                                    type="text"
                                                    name="address"
                                                    placeholder="Address"
                                                    component={Input}
                                                />
                                            </FormItem>
                                            <FormItem
                                                label="City"
                                                invalid={errors.city && touched.city}
                                                errorMessage={errors.city}
                                            >
                                                <Field name="city">
                                                    {({ field, form }) => (
                                                        <Select
                                                            field={field}
                                                            form={form}
                                                            options={masterOption.cities}
                                                            // onFocus={onFocus}
                                                            isLoading={loading}
                                                            value={masterOption.cities.filter(
                                                                (option) => option.value === values.city
                                                            )}
                                                            onChange={(option) => {
                                                                changeCity(option)
                                                                return form.setFieldValue(
                                                                    field.name,
                                                                    option?.value
                                                                )
                                                            }}
                                                        />
                                                    )}
                                                </Field>
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
                                                            loadOptions={loadOptions}
                                                            // onFocus={onFocus}
                                                            isLoading={loading}
                                                            value={masterOption.pincodes.filter(
                                                                (option) => option.value === values.pincode
                                                            )}
                                                            onChange={(option) => {
                                                                return form.setFieldValue(
                                                                    field.name,
                                                                    option?.value
                                                                )
                                                            }}
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
                                                <Field name="state">
                                                    {({ field, form }) => (
                                                        <Select
                                                            field={field}
                                                            form={form}
                                                            options={masterOption.states}
                                                            // onFocus={onFocus}
                                                            isLoading={loading}
                                                            value={masterOption.states.filter(
                                                                (option) => option.value === values.state
                                                            )}
                                                            onChange={(option) => {
                                                                return form.setFieldValue(
                                                                    field.name,
                                                                    option?.value
                                                                )
                                                            }}
                                                        />
                                                    )}
                                                </Field>
                                            </FormItem>
                                            <FormItem
                                                label="Country"
                                                invalid={errors.country && touched.country}
                                                errorMessage={errors.country}
                                            >
                                                <Field name="country">
                                                    {({ field, form }) => (
                                                        <Select
                                                            field={field}
                                                            form={form}
                                                            options={masterOption.countries}
                                                            // onFocus={onFocus}
                                                            isLoading={loading}
                                                            value={masterOption.countries.filter(
                                                                (option) => option.value === values.country
                                                            )}
                                                            onChange={(option) => {
                                                                return form.setFieldValue(
                                                                    field.name,
                                                                    option?.value
                                                                )
                                                            }}
                                                        />
                                                    )}
                                                </Field>
                                            </FormItem>
                                        </div>
                                        {/* <h5>Bank Information</h5>
                                        <p className="mb-6">{vendorId.vendorid ? 'Edit' : 'Add'} vendors GST and bank details</p> */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                            <FormItem
                                                label="TIN Number"
                                                invalid={errors.tin_number && touched.tin_number}
                                                errorMessage={errors.tin_number}
                                            >
                                                <Field
                                                    type="tel"
                                                    name="tin_number"
                                                    placeholder="TIN Number"
                                                    component={Input}
                                                />
                                            </FormItem>
                                            <FormItem
                                                label="CST Number"
                                                invalid={errors.cst_number && touched.cst_number}
                                                errorMessage={errors.cst_number}
                                            >
                                                <Field
                                                    type="tel"
                                                    name="cst_number"
                                                    placeholder="CST Number"
                                                    component={Input}
                                                />
                                            </FormItem>
                                            <FormItem
                                                label="GST Number"
                                                invalid={errors.gst_number && touched.gst_number}
                                                errorMessage={errors.gst_number}
                                            >
                                                <Field
                                                    type="tel"
                                                    name="gst_number"
                                                    placeholder="GST Number"
                                                    component={Input}
                                                    autocomplete="off"
                                                />
                                            </FormItem>
                                            <FormItem
                                                asterisk
                                                label="Beneficiary Name"
                                                invalid={errors.bank_acc_name && touched.bank_acc_name}
                                                errorMessage={errors.bank_acc_name}
                                            >
                                                <Field
                                                    type="text"
                                                    name="bank_acc_name"
                                                    placeholder="Beneficiary Name"
                                                    component={Input}
                                                    disabled={vendorId.vendorid && userCheck ? true : false}
                                                />
                                            </FormItem>
                                            <FormItem
                                                asterisk
                                                label="Beneficiary A/C No"
                                                invalid={errors.bank_acc_no && touched.bank_acc_no}
                                                errorMessage={errors.bank_acc_no}
                                            >
                                                <Field
                                                    type="password"
                                                    autoComplete={'off'}
                                                    name="bank_acc_no"
                                                    placeholder="Beneficiary A/C No"
                                                    component={Input}
                                                    disabled={vendorId.vendorid && userCheck ? true : false}
                                                    autocomplete="new-password"
                                                    autoCorrect={'false'}
                                                />
                                            </FormItem>
                                            <FormItem
                                                asterisk
                                                label="Confirm Beneficiary A/C No"
                                                invalid={errors.c_bank_acc_no && touched.c_bank_acc_no}
                                                errorMessage={errors.c_bank_acc_no}
                                            >
                                                <Field
                                                    type="text"
                                                    name="c_bank_acc_no"
                                                    placeholder="Confirm Beneficiary A/C No"
                                                    component={Input}
                                                    disabled={vendorId.vendorid && userCheck ? true : false}
                                                    autocomplete="new-password"
                                                />
                                            </FormItem>
                                            <FormItem
                                                asterisk
                                                label="Bank Name"
                                                invalid={errors.bank_name && touched.bank_name}
                                                errorMessage={errors.bank_name}
                                            >
                                                <Field name="bank_name">
                                                    {({ field, form }) => (
                                                        <Select
                                                            field={field}
                                                            form={form}
                                                            options={masterOption.vendorBanks}
                                                            // onFocus={onFocus}
                                                            isLoading={loading}
                                                            value={masterOption.vendorBanks.filter(
                                                                (option) => option.value === values.bank_name
                                                            )}
                                                            onChange={(option) => {
                                                                return form.setFieldValue(
                                                                    field.name,
                                                                    option?.value
                                                                )
                                                            }}
                                                            isDisabled={vendorId.vendorid && userCheck ? true : false}
                                                        />
                                                    )}
                                                </Field>
                                            </FormItem>
                                            <FormItem
                                                label="Bank Branch Name"
                                                invalid={errors.bank_branch_name && touched.bank_branch_name}
                                                errorMessage={errors.bank_branch_name}
                                            >
                                                <Field
                                                    type="text"
                                                    name="bank_branch_name"
                                                    placeholder="Bank Branch Name"
                                                    component={Input}
                                                    disabled={vendorId.vendorid && userCheck ? true : false}
                                                    autocomplete="new-password"
                                                />
                                            </FormItem>
                                            <FormItem
                                                asterisk
                                                label="IFSC Code"
                                                invalid={errors.ifsc_code && touched.ifsc_code}
                                                errorMessage={errors.ifsc_code}
                                            >
                                                <Field
                                                    type="text"
                                                    name="ifsc_code"
                                                    placeholder="IFSC Code"
                                                    component={Input}
                                                    disabled={vendorId.vendorid && userCheck ? true : false}
                                                    autocomplete="new-password"
                                                />
                                            </FormItem>
                                            <FormItem
                                                asterisk
                                                label="Payment Notification Email Id"
                                                invalid={errors.bank_email && touched.bank_email}
                                                errorMessage={errors.bank_email}
                                            >
                                                <Field
                                                    type="email"
                                                    name="bank_email"
                                                    placeholder="Payment Notification Email Id"
                                                    component={Input}
                                                    // disabled={vendorId.vendorid && userCheck ? true : false}
                                                    autocomplete="new-password"
                                                />
                                            </FormItem>
                                            <FormItem
                                                asterisk
                                                label="Payment Due Days"
                                                invalid={errors.payment_due_days && touched.payment_due_days}
                                                errorMessage={errors.payment_due_days}
                                            >
                                                <Field
                                                    type="number"
                                                    suffix={'Days'}
                                                    name="payment_due_days"
                                                    placeholder="Payment Due Days"
                                                    component={Input}

                                                />
                                            </FormItem>
                                        </div>
                                        {/* <h5 className="mb-6 mt-4">Bank Document Upload</h5> */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                            <div>

                                                <FormItem
                                                    label="Cancelled Cheque / Bank Information"
                                                    invalid={Boolean(
                                                        errors.bank_document && touched.bank_document
                                                    )}
                                                    errorMessage={errors.bank_document}
                                                >
                                                    <Field name="bank_document" >
                                                        {({ field, form }) => (
                                                            <div className=' overflow-hidden'>
                                                                <div>
                                                                    <Upload
                                                                        beforeUpload={beforeUpload}
                                                                        fileList={values.bank_document}
                                                                        onChange={(files) =>
                                                                            form.setFieldValue(field.name, files)
                                                                        }
                                                                        onFileRemove={(files) =>
                                                                            form.setFieldValue(field.name, files)
                                                                        }
                                                                        accept='image/jpeg, image/png, application/pdf'
                                                                    />
                                                                </div>
                                                                <Button type="button" variant="solid" color="green-600" className={(vendorData.bank_document_name == null || vendorData.bank_document_name == '' ? "hidden" : 'visible') + " absolute left-[80px] top-0"} onClick={() => download(vendorData.bank_document_name)}>{vendorData.bank_document_name != null && vendorData.bank_document_name != '' ? vendorData.bank_document_name.substr(0, 15) + '...' + vendorData.bank_document_name.substr(-7) : ''} </Button>
                                                            </div>
                                                        )}
                                                    </Field>
                                                </FormItem>
                                            </div>
                                            <div>

                                                <FormItem
                                                    label="GST Certificate"
                                                    invalid={Boolean(
                                                        errors.gst_document && touched.gst_document
                                                    )}
                                                    errorMessage={errors.gst_document}
                                                >
                                                    <Field name="gst_document">
                                                        {({ field, form }) => (
                                                            <div className=' overflow-hidden'>
                                                                <div>
                                                                    <Upload
                                                                        beforeUpload={beforeUpload}
                                                                        fileList={values.gst_document}
                                                                        onChange={(files) =>
                                                                            form.setFieldValue(field.name, files)
                                                                        }
                                                                        onFileRemove={(files) =>
                                                                            form.setFieldValue(field.name, files)
                                                                        }
                                                                        accept='image/jpeg, image/png, application/pdf'
                                                                    />
                                                                </div>
                                                                <Button type="button" variant="solid" color="green-600" className={(vendorData.gst_document_name == null || vendorData.gst_document_name == '' ? "hidden" : 'visible') + " absolute left-[80px] top-0"} onClick={() => download(vendorData.gst_document_name)}>{vendorData.gst_document_name != null && vendorData.gst_document_name != '' ? vendorData.gst_document_name.substr(0, 15) + '...' + vendorData.gst_document_name.substr(-7) : ''} </Button>
                                                            </div>
                                                        )}
                                                    </Field>
                                                </FormItem>
                                            </div>
                                            <div>

                                                <FormItem
                                                    label="Pan Details"
                                                    invalid={Boolean(
                                                        errors.pan_document && touched.pan_document
                                                    )}
                                                    errorMessage={errors.pan_document}
                                                >
                                                    <Field name="pan_document">
                                                        {({ field, form }) => (
                                                            <div className=' overflow-hidden'>
                                                                <div>
                                                                    <Upload
                                                                        beforeUpload={beforeUpload}
                                                                        fileList={values.pan_document}
                                                                        onChange={(files) =>
                                                                            form.setFieldValue(field.name, files)
                                                                        }
                                                                        onFileRemove={(files) =>
                                                                            form.setFieldValue(field.name, files)
                                                                        }
                                                                        accept='image/jpeg, image/png, application/pdf'
                                                                    />
                                                                </div>
                                                                <Button type="button" variant="solid" color="green-600" className={(vendorData.pan_document_name == null || vendorData.pan_document_name == '' ? "hidden" : 'visible') + " absolute left-[80px] top-0"} onClick={() => download(vendorData.pan_document_name != null ? vendorData.pan_document_name : '')}>{vendorData.pan_document_name != null && vendorData.pan_document_name != '' ? vendorData.pan_document_name.substr(0, 15) + '...' + vendorData.pan_document_name.substr(-7) : ''} </Button>
                                                            </div>
                                                        )}
                                                    </Field>
                                                </FormItem>
                                            </div>
                                            <div>

                                                <FormItem
                                                    label="MSME (If Applicable)"
                                                    invalid={Boolean(
                                                        errors.msme_document && touched.msme_document
                                                    )}
                                                    errorMessage={errors.msme_document}
                                                >
                                                    <Field name="msme_document">
                                                        {({ field, form }) => (
                                                            <div className=' overflow-hidden'>
                                                                <div>

                                                                    <Upload
                                                                        beforeUpload={beforeUpload}
                                                                        fileList={values.msme_document}
                                                                        onChange={(files) =>
                                                                            form.setFieldValue(field.name, files)
                                                                        }
                                                                        onFileRemove={(files) =>
                                                                            form.setFieldValue(field.name, files)
                                                                        }
                                                                        accept='image/jpeg, image/png, application/pdf'
                                                                    />
                                                                </div>
                                                                <Button type="button" variant="solid" color="green-600" className={(vendorData.msme_document_name == null || vendorData.msme_document_name == '' ? "hidden" : 'visible') + " absolute left-[80px] top-0"} onClick={() => download(vendorData.msme_document_name)}>{vendorData.msme_document_name != null && vendorData.msme_document_name != '' ? vendorData.msme_document_name.substr(0, 15) + '...' + vendorData.msme_document_name.substr(-7) : ''} </Button>
                                                            </div>
                                                        )}
                                                    </Field>
                                                </FormItem>
                                            </div>

                                        </div>
                                        <h5 className='mb-2'>Contact Persons</h5>
                                        {/* <p className="mb-6">{vendorId.vendorid ? 'Edit' : 'Add'} vendors contact persons</p> */}
                                        <div className="grid grid-cols-1 gap-x-8 gap-y-2 mb-6">
                                            <FieldArray name="contactPersons">
                                                {({ form, remove, push }) => (
                                                    <div>
                                                        {contactPersons && contactPersons.length > 0 ? contactPersons.map((contactPerson, index) => {
                                                            const contact_person =
                                                                fieldFeedback(
                                                                    form,
                                                                    `contactPersons[${index}].contact_person`
                                                                )
                                                            const email_id =
                                                                fieldFeedback(
                                                                    form,
                                                                    `contactPersons[${index}].email_id`
                                                                )
                                                            const mobile =
                                                                fieldFeedback(
                                                                    form,
                                                                    `contactPersons[${index}].mobile`
                                                                )

                                                            return (
                                                                <div key={index}>
                                                                    <FormItem
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
                                                                            component={Input}
                                                                        />
                                                                    </FormItem>
                                                                    <Button
                                                                        shape="circle"
                                                                        size="sm"
                                                                        icon={<HiMinus />}
                                                                        onClick={() => remove(index)}
                                                                    />
                                                                </div>
                                                            )
                                                        }) : null}
                                                        <div>
                                                            <Button
                                                                type="button"
                                                                className="ltr:mr-2 rtl:ml-2"
                                                                onClick={() => {
                                                                    push({
                                                                        contact_person: '',
                                                                        email_id: '',
                                                                        mobile: '',
                                                                    })
                                                                }}
                                                            >
                                                                Add a Person
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </FieldArray>
                                        </div>
                                        {/* <h5>Other Information</h5>
                                        <p className="mb-6">{vendorId.vendorid ? 'Edit' : 'Add'} final vendor remark</p> */}
                                        <div className="grid grid-cols-3 gap-x-8 gap-y-2">
                                            <FormItem
                                                label="Remark"
                                                invalid={errors.remarks && touched.remarks}
                                                errorMessage={errors.remarks}
                                            >
                                                <Field
                                                    name="remarks"
                                                >
                                                    {({ field, form }) => {
                                                        return (
                                                            <Input
                                                                type="text"
                                                                field={field}
                                                                form={form}
                                                                // name={field.name}
                                                                value={field.value}
                                                                onChange={(option) =>
                                                                    form.setFieldValue(
                                                                        field.name,
                                                                        option.target.value
                                                                    )
                                                                }
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
                                <div>
                                    <Button size="sm" type="submit" variant="solid" color="emerald-600" className={'ltr:mr-6 rtl:ml-6 ' + (actionBtn.approve ? '' : 'hidden')} disabled={isSubmitting}>
                                        Approve
                                    </Button>
                                    <Button size="sm" type="button" variant='solid' color='red-600' onClick={() => rejectVendor()} disabled={isSubmitting} className={'ltr:mr-3 rtl:ml-3 ' + (actionBtn.approve ? '' : 'hidden')}>
                                        Reject
                                    </Button>
                                </div>
                                <div className="md:flex items-center">
                                    <Button size="sm" type="submit" className={'ltr:mr-3 rtl:ml-3 ' + (actionBtn.approve ? 'hidden' : '')} variant="solid" disabled={isSubmitting}>
                                        Submit For Approval
                                    </Button>
                                    <Button size="sm" type="button" variant='solid' color='red-600' onClick={() => deleteVendor()} disabled={isSubmitting} className={'ltr:mr-3 rtl:ml-3 ' + (actionBtn.delete ? '' : 'hidden')}>
                                        Delete
                                    </Button>
                                    <Button size="sm" type="button" onClick={() => navigate('/product/vendor')}>
                                        Back
                                    </Button>
                                </div>
                            </StickyFooter>
                        </Form>)
                }}
            </Formik>
        </>
    )
}

export default AddEditVendor
