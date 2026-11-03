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
import { apiReconcilliationBarcodeData, apiReconcilliationGetBarcodes, apiReconcilliationMasterData } from 'services/ReconcilliationService'
import Dialog from 'components/ui/Dialog'
import Scanner from 'views/production/StoreManager/Scanner'

const { Tr, Th, Td, THead, TBody } = Table

const validationSchema = Yup.object().shape({
    date_of_processing: Yup.string().required('Order Date Is Required').nullable(),
    depot_id: Yup.string().required('Depot Is Required'),
    reconcilliationItems: Yup.array().of(
        Yup.object().shape({
                raw_material_id: Yup.string().required(' '),
                barcode: Yup.string().required(' ').typeError(' '),
                expiry_date:Yup.string().required(' ').nullable(),
                system_qty: Yup.number().required(' ').moreThan(0, ' ').typeError(' '),
                physical_qty: Yup.number().required(' ').moreThan(0, ' ').typeError(' '),
                difference_qty: Yup.number().required(' ').typeError(' '),
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

const AddEditReconcilliation = () => {
    const [reconcilliationData, setReconcilliationData] = useState({
        date_of_processing: '',
        depot_id: '',
        rawMaterialReconItems:[
            // {
            //   raw_material_id: '',
            //   barcode: '',
            //   expiry_date: '',
            //   system_qty: '',
            //   physical_qty: '',
            //   difference_qty: '',
            // }
        ],
        remarks:''
    })
    const [actionBtn, setActionBtn] = useState({
        approve: false,
        delete: false,
        update: false,
    })
    const [masterOption, setMasterOption] = useState({
        depots: [],
        rawMaterials: [],
        barcodes:[]
    })
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const reconcilliationId = useParams()
    const formRef = useRef()
    const [scannerIsOpen, setScannerIsOpen] = useState(false)

    const scannerClose = () => {
        setScannerIsOpen(false)
    }

    const onNewScanResult = (decodedText, decodedResult) => {
        // handle decoded results here
        setScannerIsOpen(false)
        addDataToRow(formRef.current.values['depot_id'], decodedText)
    }


    const addDataToRow = (depotId, barcode)=>{
        console.log(depotId, barcode)
    }

    const deleteReconcilliation = () => {
        apiRawMaterialInOutDelete(reconcilliationId.rid).then((data) => {
            console.log(data)
            if (data.status === 200) {
                formRef.current.setSubmitting(false)
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                formRef.current.resetForm()
                navigate('/transaction/reconcilliation')
            }
        }).catch((error) => {
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
    const rejectReconcilliation = () => {
        apiRawMaterialInOutReject({values: formRef.current.values, ...{ id: reconcilliationId.rid },}).then((data) => {
            console.log(data)
            if (data.status === 200) {
                formRef.current.setSubmitting(false)
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                formRef.current.resetForm()
                navigate('/transaction/reconcilliation')
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
        apiReconcilliationGetBarcodes(value).then(data=>{
            let bCodes = data.data['barcodes'];

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
        })
    }

    const getBarcodeStock = (barcode, index)=>{
        if(formRef.current.values['depot_id']){
            if(reconcilliationId.rid){
                apiReconcilliationBarcodeData(reconcilliationId.rid, formRef.current.values['depot_id'], barcode ).then(data=>{
                    if (data.status === 200) {
                        console.log(data);
                    }
                })
            }else{
                apiReconcilliationBarcodeData(0, formRef.current.values['depot_id'], barcode ).then(data=>{
                    if (data.status === 200) {
                        // console.log(data);
                    }
                }).catch(error=>{
                    // console.log('error', error)
                    if(error.response.status === 404){
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
        }else{

            toast.push(
                <Notification
                    title="Error"
                    type="danger"
                    closable
                >
                    Please Select Depot
                </Notification>
            )
        }
    }

    const getBarcodeData = ()=>{
        if(formRef.current.values['depot_id']){
            setScannerIsOpen(true)
        }else{

            toast.push(
                <Notification
                    title="Error"
                    type="danger"
                    closable
                >
                    Please Select Depot
                </Notification>
            )
        }
    }

    useEffect(() => {
        const fetchData = () => {
            if (reconcilliationId.rid) {
                setLoading(true)
                apiRawMaterialInOutGetSingle(reconcilliationId.rid).then((data) => {
                    if (data.status === 200) {
                        // console.log(data.data['action'])
                        setActionBtn({
                            approve: data.data['action']['approve'],
                            update: data.data['action']['update'],
                            delete: data.data['action']['delete'],
                        })
                        setReconcilliationData({
                            date_of_processing: new Date(data.data['rawMaterialInOut'].date_of_processing),
                            depot_id: data.data['rawMaterialInOut'].depot_id,
                            type: data.data['rawMaterialInOut'].type,
                            reconcilliationItems: data.data['rawMaterialInOut'].reconcilliationItems.map((value, index) => {
                                return {
                                    type: value.type,
                                    item_id: value.item_id,
                                    qty: value.qty,
                                    barcode: value.barcode,
                                }
                            }),
                            remarks: data.data['rawMaterialInOut'].remarks,
                        })

                        const bdata = data.data['rawMaterialInOutItemBarcodes'].map((bvalue, index)=>bvalue.map((bval)=>({ label:bval.barcode, value:bval.barcode, expiry_date:bval.expiry_date,})))
                        // console.log(data.data['masterData'])
                        setMasterOption({
                            depots: data.data['masterData'].depots.map((value) => {
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
                // setLoading(true)
                setLoading(false)
                apiReconcilliationMasterData().then((data) => {
                    if (data.status === 200) {
                        console.log(data)
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
                }).catch((error) => {
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
        <>
            <Formik
                enableReinitialize={true}
                initialValues={reconcilliationData}
                innerRef={formRef}
                validationSchema={validationSchema}
                onSubmit={(values, actions) => {
                    console.log(values)
                    // setSubmitting(false)
                    if (reconcilliationId.rid) {
                        // console.log(values)
                        if (actionBtn.approve) {
                            apiRawMaterialInOutApprove({values, ...{ id: reconcilliationId.rid },}).then((data) => {
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
                                    navigate('/transaction/reconcilliation')
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
                            apiRawMaterialInOutUpdate({values, ...{ id: reconcilliationId.rid },}).then((data) => {
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
                                    navigate('/transaction/reconcilliation')
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
                        apiRawMaterialInOutPost(values).then((data) => {
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
                                )
                                navigate('/transaction/reconcilliation')
                            }
                        })
                        .catch((error) => {
                            let errorData = error.response['data']['error']['errors']
                            actions.setSubmitting(false)
                            if (error.response.status === 422) {
                                errorData.map((err) => {
                                    // console.log(err);
                                    actions.setFieldError(err.path, err.message)
                                    toast.push(
                                        <Notification
                                            title="Error"
                                            type="danger"
                                            closable
                                        >
                                            {err.message}
                                        </Notification>
                                    )
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
                    const rawMaterialReconItems = values.rawMaterialReconItems;
                    return (
                        <Form autoComplete="off" autoSave="off">
                            <AdaptableCard className="card-shadow mb-2">
                                <h5 className="mb-6"> {reconcilliationId.rid ? 'Edit' : 'Add'} Reconcilliation </h5>
                                {/* <p className="mb-6">{reconcilliationId.rid ? 'Edit' : 'Add'} basic details of Purchase</p> */}
                                <FormContainer layout="horizontal" size="sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        <FormItem
                                            asterisk
                                            label="Date of processing"
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
                                                        placeholder="Date of processing"
                                                        form={form}
                                                        maxDate={new Date()}
                                                        value={values.date_of_processing}
                                                        onChange={(option) => {
                                                            let date = new Date(option)
                                                            return form.setFieldValue(field.name, `${date.getFullYear()}-${date.getMonth() < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1}-${ date.getDate() < 10 ? '0' + date.getDate() : date.getDate() }`)
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
                                                        onChange={(option) => form.setFieldValue(field.name, option?.value)}
                                                        isDisabled={actionBtn.approve}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <div>
                                            <Button type="button" variant="solid" color="emerald-500" onClick={()=>getBarcodeData()}>Start Scan</Button>
                                        </div>
                                    </div>
                                    {/* <h5>Items Imformation</h5>
                                    <p className="mb-6">{reconcilliationId.rid ? 'Edit' : 'Add'} details of Items for purchase order</p> */}
                                    <Table compact className="border mb-6">
                                        <THead>
                                            <Tr>
                                                <Th>Item*</Th>
                                                <Th>Barcode</Th>
                                                <Th>System Qty</Th>
                                                <Th>Physical Qty</Th>
                                                <Th className={ actionBtn.approve ? 'hidden' : 'visible'}>Action</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="rawMaterialReconItems">
                                                {({ form, remove, push }) => (
                                                    <>
                                                        {rawMaterialReconItems && rawMaterialReconItems.length > 0 ? rawMaterialReconItems.map(
                                                            (_, index) => {
                                                                const raw_material_id = fieldFeedback(form, `rawMaterialReconItems[${index}].raw_material_id`)
                                                                const barcode = fieldFeedback(form, `rawMaterialReconItems[${index}].barcode`)
                                                                const physical_qty = fieldFeedback(form, `rawMaterialReconItems[${index}].physical_qty`)
                                                                    return (
                                                                        <Tr key={index}>
                                                                            <Td width="350">
                                                                                <FormItem
                                                                                    className="mb-0 custom-text-left"
                                                                                    invalid={raw_material_id.invalid}
                                                                                    layout="vertical"
                                                                                    errorMessage={raw_material_id.errorMessage}
                                                                                >
                                                                                    <Field name={`rawMaterialReconItems[${index}].raw_material_id`}>
                                                                                        {({field, form,}) =>(
                                                                                            <Select
                                                                                                className="custom-text-left text-left"
                                                                                                field={field}
                                                                                                form={form}
                                                                                                options={masterOption.rawMaterials}
                                                                                                isLoading={loading}
                                                                                                value={masterOption.rawMaterials.filter((option) => option.value === values.rawMaterialReconItems[index].raw_material_id )}
                                                                                                onChange={(option, field) =>  {
                                                                                                    form.setFieldValue(field.name, option.value)
                                                                                                    getBarcode(option.value, index)
                                                                                                }}
                                                                                                isDisabled={actionBtn.approve}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                </FormItem>
                                                                            </Td>
                                                                            <Td width="350"> 
                                                                                <FormItem
                                                                                    className="mb-0 custom-text-left"
                                                                                    invalid={barcode.invalid}
                                                                                    layout="vertical"
                                                                                    errorMessage={barcode.errorMessage}
                                                                                >
                                                                                    <Field name={`rawMaterialReconItems[${index}].barcode`}>
                                                                                        {({field, form,}) =>(
                                                                                            <Select
                                                                                                className="custom-text-left text-left"
                                                                                                field={field}
                                                                                                form={form}
                                                                                                options={masterOption.barcodes.length > 0 ? masterOption.barcodes[index]: []}
                                                                                                isLoading={loading}
                                                                                                value={masterOption.barcodes[index] ? masterOption.barcodes[index].filter((option) => option.value === values.rawMaterialReconItems[index].barcode) : values.rawMaterialReconItems[index].barcode}
                                                                                                onChange={(option, field) =>  {
                                                                                                    form.setFieldValue(field.name, option.value)
                                                                                                    getBarcodeStock(option.value, index)
                                                                                                }}
                                                                                                isDisabled={actionBtn.approve}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                </FormItem>
                                                                            </Td>
                                                                            <Td width="100">
                                                                                {rawMaterialReconItems[index].system_qty}
                                                                            </Td>
                                                                            <Td width="180">
                                                                                <FormItem
                                                                                    className="mb-0"
                                                                                    invalid={physical_qty.invalid}
                                                                                    layout="vertical"
                                                                                    errorMessage={physical_qty.errorMessage}
                                                                                >
                                                                                    <Field
                                                                                        invalid={physical_qty.invalid}
                                                                                        placeholder="Quantity"
                                                                                        name={`rawMaterialReconItems[${index}].physical_qty`}
                                                                                        type="number"
                                                                                        onWheel={(e) =>e.target.blur()}
                                                                                        component={Input}
                                                                                        disabled={actionBtn.approve}
                                                                                    />
                                                                                </FormItem>
                                                                            </Td>
                                                                            <Td width="100">
                                                                                {rawMaterialReconItems[index].diff}
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
                                                            className={actionBtn.approve ? 'hidden' : 'visible'}
                                                        >
                                                            <Td
                                                                colSpan="10"
                                                                className="custom-text-left"
                                                            >
                                                                <Button
                                                                    type="button"
                                                                    className="ltr:mr-2 rtl:ml-2"
                                                                    onClick={() => {
                                                                        push({
                                                                            raw_material_id:'',
                                                                            barcode:'',
                                                                            expiry_date:'',
                                                                            system_qty:'',
                                                                            physical_qty:'',
                                                                            difference_qty: ''
                                                                        })
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
                                    <p className="mb-6">{reconcilliationId.rid ? 'Edit' : 'Add'} final Reconcilliation remark</p> */}

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
                                        actionBtn.approve && reconcilliationData.status === 'deleted'?
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
                                        onClick={() => rejectReconcilliation()}
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
                                        onClick={() => deleteReconcilliation()}
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
                                            navigate('/transaction/reconcilliation')
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
            <Dialog
                isOpen={scannerIsOpen}
                onClose={scannerClose}
                onRequestClose={scannerClose}
            >
                {scannerIsOpen ? (<Scanner qrCodeSuccessCallback={onNewScanResult} />): null}
            </Dialog>
        </>
    )
}

export default AddEditReconcilliation