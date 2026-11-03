import React, { useEffect, useState, useRef } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import DatePicker from 'components/ui/DatePicker'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import { Field, Form, FieldArray, Formik, getIn } from 'formik'
import { useNavigate, useParams } from 'react-router-dom'
import * as Yup from 'yup'
import Table from 'components/ui/Table'
import { HiMinus } from 'react-icons/hi'
import NumberFormat from 'react-number-format'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiRawMaterialInOutApprove,
    apiRawMaterialInOutDelete,
    apiRawMaterialInOutGetBarcodes,
    apiRawMaterialInOutGetSingle,
    apiRawMaterialInOutMasterData,
    apiRawMaterialInOutPost,
    apiRawMaterialInOutReject,
    apiRawMaterialInOutUpdate,
} from 'services/RawMaterialInOutService'

const { Tr, Th, Td, THead, TBody } = Table

const validationSchema = Yup.object().shape({
    date_of_processing: Yup.string().required('Order Date Is Required').nullable(),
    depot_id: Yup.string().required('Depot Is Required'),
    type: Yup.string().required('Vendor Is Required'),
    rawMaterialInOutItems: Yup.array().of(
        Yup.object()
            .shape({
                type: Yup.string().required(' '),
                raw_material_id: Yup.string().required(' '),
                qty: Yup.number().required(' ').moreThan(0, 'Qty cannot be negative or 0').typeError(' ').test(
                        'qty-less-than-stock',
                        'Stock Cannot be negative.',
                        function (value) {
                            const { totalStock, type } = this.parent;
                            if(type === 'Stock OUT'){
                                if(value > totalStock){
                                    return false;
                                }else{
                                    return true;
                                }
                            }else{
                                return true; // skip validation for Box and Combo Box
                            }
                        }
                    ),
                barcode: Yup.string().required(' ').typeError(' '),
            }).required('Details Is Required')
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

const rmTypeOption = [
    {label:'Damage', value:'Damage'},
    {label:'Stock Expiry', value:'Stock Expiry'},
    {label:'Adjustment', value:'Adjustment'},
    {label:'Waste', value:'Waste'},
    {label:'Other', value:'Other'},
]

const stockTypeOption = [
    {label:'Stock IN', value:'Stock IN'},
    {label:'Stock OUT', value:'Stock OUT'},
]

const AddEditRawMaterialInOut = () => {
    const [rawMaterialInOutData, setRawMaterialInOutData] = useState({
        date_of_processing: '', //YYYY-MM-DD
        depot_id: '',
        type: '',
        rawMaterialInOutItems: [
            {
                type: '',
                raw_material_id: '',
                qty: '',
                barcode: '',
                totalStock: '',
                expiry_date:'',
            },
        ],
        remarks: '',
    })
    const [actionBtn, setActionBtn] = useState({
        approve: false,
        delete: false,
        update: false,
    })
    const [masterOption, setMasterOption] = useState({
        depots: [],
        rawMaterials: [],
        barcodes: [],
    })
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const rawMaterialInOutId = useParams()
    const formRef = useRef()

    const deleteRawMaterialInOut = () => {
        apiRawMaterialInOutDelete(rawMaterialInOutId.rmInOutid)
            .then((data) => {
                console.log(data)
                if (data.status === 200) {
                    formRef.current.setSubmitting(false)
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    formRef.current.resetForm()
                    navigate('/transaction/raw-material-in-out')
                }
            })
            .catch((error) => {
                let errorData = error.response['data']['error']['errors']
                if (error.response.status === 422) {
                    for (const errMsg in errorData) {
                        formRef.current.setFieldError(
                            errMsg,
                            errorData[errMsg]['message']
                        )
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {errorData[errMsg]['message']}
                            </Notification>
                        )
                    }
                } else if (error.response.status === 500) {
                    console.log(errorData)
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                }
            })
    }
    const rejectRawMaterialInOut = () => {
        apiRawMaterialInOutReject({
            values: formRef.current.values,
            ...{ id: rawMaterialInOutId.rmInOutid },
        })
            .then((data) => {
                console.log(data)
                if (data.status === 200) {
                    formRef.current.setSubmitting(false)
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    formRef.current.resetForm()
                    navigate('/transaction/raw-material-in-out')
                }
            })
            .catch((error) => {
                let errorData = error.response['data']['error']['errors']
                if (error.response.status === 422) {
                    for (const errMsg in errorData) {
                        formRef.current.setFieldError(
                            errMsg,
                            errorData[errMsg]['message']
                        )
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {errorData[errMsg]['message']}
                            </Notification>
                        )
                    }
                } else if (error.response.status === 500) {
                    console.log(errorData)
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                }
            })
    }

    const getBarcode = (value, index)=>{
        // console.log(value)
        const form = formRef.current;
        
        apiRawMaterialInOutGetBarcodes(value, form.values.depot_id ? form.values.depot_id : 0).then(data=>{
            let bCodes = data.data['barcodes'];
            const totalStock = data.data['totalStock'];
            setMasterOption(prev=>{
                console.log('prev.barcodes.length', prev.barcodes.length)
                console.log('prev.barcodes', prev.barcodes)
                return {
                    ...prev,
                    barcodes: prev.barcodes.length > 0 ? prev.barcodes.map((value, indx)=>{
                        // console.log('masterData.barcodes', value)
                        if(index === indx){
                            return bCodes.map(val=>({label:val.barcode, value:val.barcode, expiry_date: val.expiry_date}))
                        }else{
                            return value
                        }
                    }) : [bCodes.map(val=>({label:val.barcode, value:val.barcode, expiry_date:val.expiry_date}))]
                }
            })
            form.setFieldValue(`rawMaterialInOutItems[${index}].totalStock`, totalStock);
        })
    }

    function changeDepot(){
        setTimeout(()=>{
            if(formRef.current.values.rawMaterialInOutItems.length > 0){
                formRef.current.values.rawMaterialInOutItems.forEach((value, index)=>{
                    if( value.type !== '' && (value.raw_material_id !== '' || value.raw_material_id !== null)){
                        getBarcode(value.raw_material_id, index)
                    }
                })
            }
        },100)
    }

    useEffect(() => {
        const fetchData = () => {
            if (rawMaterialInOutId.rmInOutid) {
                setLoading(true)
                apiRawMaterialInOutGetSingle(rawMaterialInOutId.rmInOutid)
                    .then((data) => {
                        if (data.status === 200) {
                            // console.log(data.data['action'])
                            setActionBtn({
                                approve: data.data['action']['approve'],
                                update: data.data['action']['update'],
                                delete: data.data['action']['delete'],
                            })
                            setRawMaterialInOutData({
                                date_of_processing: new Date(data.data['rawMaterialInOut'].date_of_processing),
                                depot_id: data.data['rawMaterialInOut'].depot_id,
                                type: data.data['rawMaterialInOut'].type,
                                rawMaterialInOutItems: data.data['rawMaterialInOut'].rawMaterialInOutItems.map((value, index) => {
                                    return {
                                        type: value.type,
                                        raw_material_id: value.raw_material_id,
                                        qty: value.qty,
                                        totalStock: value.totalStock,
                                        barcode: value.barcode,
                                    }
                                }),
                                remarks: data.data['rawMaterialInOut'].remarks,
                            })

                            const bdata = data.data['rawMaterialInOutItemBarcodes'].map((bvalue, index)=>bvalue.map((bval)=>({ label:bval.barcode, value:bval.barcode, expiry_date:bval.expiry_date,})))
                            // console.log(data.data['masterData'])
                            setMasterOption({
                                depots: data.data['masterData'].depots.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.depot_name,
                                            state: value.state,
                                        }
                                    }
                                ),
                                rawMaterials: data.data[
                                    'masterData'
                                ].rawMaterials.map((value) => {
                                    return {
                                        value: value.id,
                                        label: value.rm_name,
                                        rate: value.rate,
                                    }
                                }),
                                barcodes: bdata
                            })
                            setLoading(false)
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
                        setLoading(false)
                    })
            } else {
                setLoading(true)
                apiRawMaterialInOutMasterData()
                    .then((data) => {
                        if (data.status === 200) {
                            setMasterOption({
                                depots: data.data['masterData'].depots.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.depot_name,
                                            state: value.state,
                                        }
                                    }
                                ),
                                rawMaterials: data.data['masterData'].rawMaterials.map((value) => {
                                    return {
                                        value: value.id,
                                        label: value.rm_name,
                                        rate: value.rate,
                                    }
                                }),
                                barcodes:[]
                            })
                            setLoading(false)
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
            }
            return true
        }
        fetchData()
    }, [])
    return (
        <Formik
            enableReinitialize={true}
            // initialValues={{
            //     date_of_processing: rawMaterialInOutData.date_of_processing === '' ? new Date() : new Date(rawMaterialInOutData.date_of_processing),
            //     depot_id: rawMaterialInOutData.depot_id,
            //     type: rawMaterialInOutData.type,
            //     rawMaterialInOutItems: rawMaterialInOutData.rawMaterialInOutItems.length > 0? rawMaterialInOutData.rawMaterialInOutItems : [],
            //     remarks: rawMaterialInOutData.remarks,
            // }}
            initialValues={rawMaterialInOutData}
            innerRef={formRef}
            validationSchema={validationSchema}
            onSubmit={(values, actions) => {
                console.log(values)
                // setSubmitting(false)
                if (rawMaterialInOutId.rmInOutid) {
                    // console.log(values)
                    if (actionBtn.approve) {
                        apiRawMaterialInOutApprove({
                            values,
                            ...{ id: rawMaterialInOutId.rmInOutid },
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
                                    navigate('/transaction/raw-material-in-out')
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
                        apiRawMaterialInOutUpdate({
                            values,
                            ...{ id: rawMaterialInOutId.rmInOutid },
                        })
                            .then((data) => {
                                console.log(data)
                                if (data.status === 200 || data.status === 201) {
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
                                    navigate('/transaction/raw-material-in-out')
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
                    }
                } else {
                    console.log(values)
                    apiRawMaterialInOutPost(values)
                        .then((data) => {
                            if (data.status === 201 || data.status === 200) {
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
                                );
                                actions.setSubmitting(false);
                                navigate('/transaction/raw-material-in-out')
                            }
                            actions.setSubmitting(false)

                        })
                        .catch((error) => {
                            const errorData = error.response['data']['error']['errors'];
                            console.log("error",error);
                            actions.setSubmitting(false)
                            if (error.response.status === 422) {
                                errorData.map((err) => {
                                    // console.log(err);
                                    if(err.error){
                                        actions.setFieldError(`rawMaterialInOutItems[${err.index}].qty`, err.message)
                                        // toast.push(
                                        //     <Notification
                                        //         title="Error"
                                        //         type="danger"
                                        //         closable
                                        //     >
                                        //         {formRef.current.values.rawMaterialInOutItems[err.index].name}{" "}{err.message}
                                        //     </Notification>
                                        // )
                                    }
                                    return true
                                })
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
            {({ values, touched, errors, resetForm, isSubmitting }) => {
                const rawMaterialInOutItems = values.rawMaterialInOutItems;
                return (
                    <Form autoComplete="off" autoSave="off">
                        <AdaptableCard className="card-shadow mb-2">
                            <h5 className="mb-6">
                                {' '}
                                {rawMaterialInOutId.rmInOutid ? 'Edit' : 'Add'}{' '}
                                Raw Material In/Out
                            </h5>
                            {/* <p className="mb-6">{rawMaterialInOutId.rmInOutid ? 'Edit' : 'Add'} basic details of Purchase</p> */}
                            <FormContainer layout="horizontal" size="sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                    <FormItem
                                        asterisk
                                        label="Date"
                                        invalid={
                                            errors.date_of_processing &&
                                            touched.date_of_processing
                                        }
                                        errorMessage={errors.date_of_processing}
                                    >
                                        <Field
                                            autoComplete="off"
                                            autoSave="off"
                                            name="date_of_processing"
                                        >
                                            {({ field, form }) => (
                                                <DatePicker
                                                    inputFormat="DD-MM-YYYY"
                                                    // inputtable
                                                    // inputtableBlurClose={false}
                                                    field={field}
                                                    placeholder="Order Date"
                                                    form={form}
                                                    maxDate={new Date()}
                                                    value={values.date_of_processing}
                                                    onChange={(option) => {
                                                        let date = new Date(option)
                                                        return form.setFieldValue(field.name, `${date.getFullYear()}-${date.getMonth() < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1}-${date.getDate() < 10 ? '0' + date.getDate() : date.getDate()}`)
                                                    }}
                                                    disabled={actionBtn.approve}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Depot"
                                        invalid={
                                            errors.depot_id && touched.depot_id
                                        }
                                        errorMessage={errors.depot_id}
                                    >
                                        <Field name="depot_id">
                                            {({ field, form }) => (
                                                <Select
                                                    field={field}
                                                    form={form}
                                                    options={masterOption.depots}
                                                    // onFocus={onFocus}
                                                    isLoading={loading}
                                                    value={masterOption.depots.filter((option) => option.value === values.depot_id)}
                                                    onChange={(option) => {form.setFieldValue(field.name, option?.value); changeDepot()}}
                                                    isDisabled={actionBtn.approve}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Raw Material IN/OUT Type"
                                        invalid={
                                            errors.type && touched.type
                                        }
                                        errorMessage={errors.type}
                                    >
                                        <Field name="type">
                                            {({ field, form }) => (
                                                <Select
                                                    field={field}
                                                    form={form}
                                                    options={rmTypeOption}
                                                    value={rmTypeOption.filter((option) => option.value === values.type)}
                                                    onChange={(option) => form.setFieldValue(field.name, option?.value)}
                                                    isDisabled={actionBtn.approve}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                </div>
                                {/* <h5>Items Imformation</h5>
                                <p className="mb-6">{rawMaterialInOutId.rmInOutid ? 'Edit' : 'Add'} details of Items for purchase order</p> */}
                                <Table compact className="border mb-6">
                                    <THead>
                                        <Tr>
                                            <Th>Stock In/Out*</Th>
                                            <Th>Item*</Th>
                                            <Th>Qty In Kg*</Th>
                                            <Th>Available Stock</Th>
                                            <Th>Barcode</Th>
                                            <Th className={ actionBtn.approve ? 'hidden' : 'visible'}>Action</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        <FieldArray name="rawMaterialInOutItems">
                                            {({ form, remove, push }) => (
                                                <>
                                                    {rawMaterialInOutItems && rawMaterialInOutItems.length > 0 ? rawMaterialInOutItems.map(
                                                        (_, index) => {
                                                            const type = fieldFeedback(form, `rawMaterialInOutItems[${index}].type`)
                                                            const raw_material_id = fieldFeedback(form, `rawMaterialInOutItems[${index}].raw_material_id`)
                                                            const barcode = fieldFeedback(form, `rawMaterialInOutItems[${index}].barcode`)
                                                            const qty = fieldFeedback(form, `rawMaterialInOutItems[${index}].qty`)
                                                            const totalStock = fieldFeedback(form, `rawMaterialInOutItems[${index}].totalStock`)
                                                                  return (
                                                                      <Tr key={index}
                                                                      >
                                                                        <Td width="180">
                                                                            <FormItem
                                                                                className="mb-0 custom-text-left"
                                                                                invalid={type.invalid}
                                                                                layout="vertical"
                                                                                errorMessage={type.errorMessage}
                                                                            >
                                                                                <Field name={`rawMaterialInOutItems[${index}].type`}>
                                                                                    {({field, form,}) =>(
                                                                                        <Select
                                                                                            className="custom-text-left text-left"
                                                                                            field={field}
                                                                                            form={form}
                                                                                            options={stockTypeOption}
                                                                                            isLoading={loading}
                                                                                            value={stockTypeOption.filter((option) => option.value === values.rawMaterialInOutItems[index].type )}
                                                                                            onChange={(option, field) =>  form.setFieldValue(field.name, option.value)}
                                                                                            isDisabled={actionBtn.approve}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="350">
                                                                            <FormItem
                                                                                className="mb-0 custom-text-left"
                                                                                invalid={raw_material_id.invalid}
                                                                                layout="vertical"
                                                                                errorMessage={raw_material_id.errorMessage}
                                                                            >
                                                                                <Field name={`rawMaterialInOutItems[${index}].raw_material_id`}>
                                                                                    {({field, form,}) =>(
                                                                                        <Select
                                                                                            className="custom-text-left text-left"
                                                                                            field={field}
                                                                                            form={form}
                                                                                            options={masterOption.rawMaterials}
                                                                                            isLoading={loading}
                                                                                            value={masterOption.rawMaterials.filter((option) => option.value === values.rawMaterialInOutItems[index].raw_material_id )}
                                                                                            onChange={(option, field) =>  {
                                                                                                form.setFieldValue(field.name, option.value)
                                                                                                form.setFieldValue(`rawMaterialInOutItems[${index}].expiry_date`, option.expiry_date)
                                                                                                getBarcode(option.value, index)
                                                                                            }}
                                                                                            isDisabled={actionBtn.approve}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="180" style={{paddingBottom: qty.invalid ? "25px" : "0px"}}>
                                                                            <FormItem
                                                                                className="mb-0"
                                                                                invalid={qty.invalid}
                                                                                layout="vertical"
                                                                                errorMessage={qty.errorMessage}
                                                                            >
                                                                                <Field
                                                                                    invalid={qty.invalid}
                                                                                    placeholder="Quantity"
                                                                                    name={`rawMaterialInOutItems[${index}].qty`}
                                                                                    type="number"
                                                                                    onWheel={(e) =>e.target.blur()}
                                                                                    component={Input}
                                                                                    disabled={actionBtn.approve}
                                                                                />
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="70" className='text-center'>{rawMaterialInOutItems[index].totalStock ? rawMaterialInOutItems[index].totalStock : 0}</Td>
                                                                        <Td width="280">
                                                                            <FormItem
                                                                                className="mb-0 custom-text-left"
                                                                                invalid={barcode.invalid}
                                                                                layout="vertical"
                                                                                errorMessage={barcode.errorMessage}
                                                                            >
                                                                                <Field name={`rawMaterialInOutItems[${index}].barcode`}>
                                                                                    {({field, form,}) =>(
                                                                                        <Select
                                                                                            className="custom-text-left text-left"
                                                                                            field={field}
                                                                                            form={form}
                                                                                            options={masterOption.barcodes.length > 0 ? masterOption.barcodes[index]: []}
                                                                                            isLoading={loading}
                                                                                            value={masterOption.barcodes[index] ? masterOption.barcodes[index].filter((option) => option.value === values.rawMaterialInOutItems[index].barcode) : values.rawMaterialInOutItems[index].barcode}
                                                                                            onChange={(option, field) =>  form.setFieldValue(field.name, option.value)}
                                                                                            isDisabled={actionBtn.approve}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td
                                                                            width="80"
                                                                            className={
                                                                                actionBtn.approve
                                                                                    ? 'hidden'
                                                                                    : 'visible'
                                                                            }
                                                                        >
                                                                            <Button
                                                                                shape="circle"
                                                                                size="sm"
                                                                                type="button"
                                                                                icon={
                                                                                    <HiMinus />
                                                                                }
                                                                                onClick={() =>{
                                                                                    remove(index)
                                                                                    setMasterOption(prev=>({...prev, barcodes: prev.barcodes.filter((_, indx)=> index != indx)}))
                                                                                }}
                                                                                disabled={ index == 0 ? true : false}
                                                                            />
                                                                        </Td>
                                                                    </Tr>
                                                                  )
                                                              }
                                                          )
                                                        : null}
                                                    <Tr
                                                        className={
                                                            actionBtn.approve
                                                                ? 'hidden'
                                                                : 'visible'
                                                        }
                                                    >
                                                        <Td
                                                            colSpan="11"
                                                            className="custom-text-left"
                                                        >
                                                            <Button
                                                                type="button"
                                                                className="ltr:mr-2 rtl:ml-2"
                                                                onClick={() => {
                                                                    push({
                                                                        type:'',
                                                                        raw_material_id:'',
                                                                        qty:'',
                                                                        barcode:'',
                                                                        expiry_date: ''
                                                                    })
                                                                    setMasterOption(prev =>({...prev, barcodes:[...prev.barcodes, []]}))
                                                                }}
                                                            >
                                                                Add Item
                                                            </Button>
                                                        </Td>
                                                    </Tr>
                                                </>
                                            )}
                                        </FieldArray>
                                    </TBody>
                                </Table>

                                {/* <h5>Other Information</h5>
                                <p className="mb-6">{rawMaterialInOutId.rmInOutid ? 'Edit' : 'Add'} final Raw Material In/Out remark</p> */}

                                <div className="grid grid-cols-3 gap-x-8 gap-y-2">
                                    <FormItem
                                        label="Remark"
                                        invalid={
                                            errors.remarks && touched.remarks
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
                                                        onChange={(option) =>
                                                            form.setFieldValue(
                                                                field.name,
                                                                option.target
                                                                    .value
                                                            )
                                                        }
                                                    />
                                                )
                                            }}
                                        </Field>
                                    </FormItem>
                                </div>
                                {
                                    actionBtn.approve && rawMaterialInOutData.status === 'deleted'?
                                    (
                                        <p className='text-red-500 '>Note : <i>If clicked on </i><strong>Approve </strong><i>button this entry will be deleted permanently</i> </p>
                                    ):null
                                }
                            </FormContainer>
                        </AdaptableCard>
                        <StickyFooter
                            className="-mx-1 md:-mx-1 px-8 flex items-center justify-between py-4"
                            stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        >
                            <div>
                                <Button
                                    size="sm"
                                    type="submit"
                                    variant="solid"
                                    color="emerald-600"
                                    className={
                                        'ltr:mr-6 rtl:ml-6 ' +
                                        (actionBtn.approve ? '' : 'hidden')
                                    }
                                    disabled={isSubmitting}
                                >
                                    Approve
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    variant="solid"
                                    color="red-600"
                                    onClick={() => rejectRawMaterialInOut()}
                                    disabled={isSubmitting}
                                    className={
                                        'ltr:mr-3 rtl:ml-3 ' +
                                        (actionBtn.approve ? '' : 'hidden')
                                    }
                                >
                                    Reject
                                </Button>
                            </div>
                            <div className="md:flex items-center">
                                <Button
                                    size="sm"
                                    type="submit"
                                    className={
                                        'ltr:mr-3 rtl:ml-3 ' +
                                        (actionBtn.approve ? 'hidden' : '')
                                    }
                                    variant="solid"
                                    disabled={isSubmitting}
                                >
                                    Submit For Approval
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    variant="solid"
                                    color="red-600"
                                    onClick={() => deleteRawMaterialInOut()}
                                    disabled={isSubmitting}
                                    className={
                                        'ltr:mr-3 rtl:ml-3 ' +
                                        (actionBtn.delete ? '' : 'hidden')
                                    }
                                >
                                    Delete
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                        navigate('/transaction/raw-material-in-out')
                                    }
                                >
                                    Back
                                </Button>
                            </div>
                        </StickyFooter>
                    </Form>
                )
            }}
        </Formik>
    )
}

export default AddEditRawMaterialInOut
