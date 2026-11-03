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
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiDepotTransferApprove,
    apiDepotTransferDelete,
    apiDepotTransferGetBarcodes,
    apiDepotTransferGetSingle,
    apiDepotTransferGetStockQuantity,
    apiDepotTransferMasterData,
    apiDepotTransferPost,
    apiDepotTransferReject,
    apiDepotTransferUpdate,
} from 'services/DepotTransferService'

const { Tr, Th, Td, THead, TBody } = Table

const validationSchema = Yup.object().shape({
    date_of_transfer: Yup.string().required('Order Date Is Required').nullable(),
    depot_out_id: Yup.string().required('Depot Out Is Required'),
    depot_in_id: Yup.string().required('Depot In Is Required'),
    depotTransferItems: Yup.array().of(
        Yup.object()
            .shape({
                type: Yup.string().required(' '),
                item_id: Yup.string().required(' '),
                qty: Yup.number().required(' ').moreThan(0, 'Qty cannot be negative or 0').typeError(' ').test(
                        'qty-less-than-stock',
                        'Quantity exceeds Stock qty',
                        function (value) {
                            const { stockQty, type } = this.parent;
                            if(type === 'Raw Material'){
                                if(value > stockQty){
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


const stockTypeOption = [
    {label:'Raw Material', value:'Raw Material'},
    {label:'Box', value:'Box'},
    {label:'Combo Box', value:'Combo Box'},
]

const AddEditDepotTransfer = () => {
    const [depotTransferData, setDepotTransferData] = useState({
        date_of_transfer: '', //YYYY-MM-DD
        depot_out_id: '',
        depot_in_id: '',
        chalan_no: '',
        depotTransferItems: [
            {
                type: '',
                item_id: '',
                qty: '',
                stockQty: '',
                barcode: '',
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
        boxes: [],
        combo_boxes: [],
        barcodes: [],
    })
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const depotTransferId = useParams()
    const formRef = useRef()

    const deleteDepotTransfer = () => {
        apiDepotTransferDelete(depotTransferId.dtid)
            .then((data) => {
                console.log(data)
                if (data.status === 200) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    formRef.current.resetForm()
                    navigate('/transaction/depot-transfer')
                }
                formRef.current.setSubmitting(false)
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
                formRef.current.setSubmitting(false)
            })
    }
    const rejectDepotTransfer = () => {
        apiDepotTransferReject({
            values: formRef.current.values,
            ...{ id: depotTransferId.dtid },
        })
            .then((data) => {
                console.log(data)
                if (data.status === 200) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    formRef.current.resetForm()
                    navigate('/transaction/depot-transfer')
                }
                formRef.current.setSubmitting(false)
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
                formRef.current.setSubmitting(false)
            })
    }

    const getBarcode = (value, index, type)=>{
        // console.log(value)
        const p1 = apiDepotTransferGetBarcodes(value, type); 
        const p2 = apiDepotTransferGetStockQuantity(formRef.current.values['depot_out_id'], value); 

        Promise.all([p1, p2]).then((values)=>{
            const bCodes = values[0]['barcodes'];
            const stock = values[1]['stock'];
            // console.log(bCodes, stock);
            if(type === 'Raw Material'){
                formRef.current.setFieldValue(`depotTransferItems[${index}].stockQty`, stock)
            }else{
                formRef.current.setFieldValue(`depotTransferItems[${index}].stockQty`, 0)
            }
            setMasterOption(prev=>{
                // console.log('prev.barcodes.length', prev.barcodes.length)
                // console.log('prev.barcodes', prev.barcodes)
                return {
                    ...prev,
                    barcodes: prev.barcodes.length > 0 ? prev.barcodes.map((value, indx)=>{
                        // console.log('masterData.barcodes', value)
                        if(index === indx){
                            if(type === 'Box'){
                                return bCodes.map(val=>({label:val.batch_id_as_per_fssai, value:val.batch_id_as_per_fssai, expiry_date: ''}));
                            }else if(type === 'Combo Box'){
                                return bCodes.map(val=>({label:val.batch_id_as_per_fssai, value:val.batch_id_as_per_fssai, expiry_date: ''}));
                            }else{
                                return bCodes.map(val=>({label:val.barcode, value:val.barcode, expiry_date: val.expiry_date}))
                            }
                        }else{
                            return value
                        }
                    }) : type ==="Box" || type ==="Combo Box" ? [bCodes.map(val=>({label:val.batch_id_as_per_fssai, value:val.batch_id_as_per_fssai, expiry_date:''}))] : [bCodes.map(val=>({label:val.barcode, value:val.barcode, expiry_date:val.expiry_date}))]
                }
            })
        })
    }

    function changeDepotOut(){
        setTimeout(()=>{
            if(formRef.current.values.depotTransferItems.length > 0){
                formRef.current.values.depotTransferItems.forEach((value, index)=>{
                    if( value.type !== '' && (value.item_id !== '' || value.item_id !== null)){
                        getBarcode(value.item_id, index, value.type)
                    }
                })
            }
        },100)
    }

    useEffect(() => {
        const fetchData = () => {
            if (depotTransferId.dtid) {
                setLoading(true)
                apiDepotTransferGetSingle(depotTransferId.dtid)
                    .then((data) => {
                        if (data.status === 200) {
                            // console.log(data.data['action'])
                            setActionBtn({
                                approve: data.data['action']['approve'],
                                update: data.data['action']['update'],
                                delete: data.data['action']['delete'],
                            })
                            setDepotTransferData({
                                date_of_transfer: new Date(data.data['depotTransfer'].date_of_transfer),
                                depot_out_id: data.data['depotTransfer'].depot_out_id,
                                depot_in_id: data.data['depotTransfer'].depot_in_id,
                                chalan_no: data.data['depotTransfer'].chalan_no,
                                depotTransferItems: data.data['depotTransfer'].depotTransferItems.map((value, index) => {
                                    return {
                                        type: value.type,
                                        item_id: value.item_id,
                                        qty: value.qty,
                                        stockQty: data.data['depotTransferItemStocks'][index],
                                        barcode: value.barcode,
                                    }
                                }),
                                remarks: data.data['depotTransfer'].remarks,
                            })

                            const bdata = data.data['depotTransferItemBarcodes'].map(
                                (bvalue, index)=> bvalue.map(
                                    (bval)=>( 
                                        data.data['depotTransfer'].depotTransferItems[index].type === 'Box' ? 
                                        { label:bval.batch_id_as_per_fssai, value:bval.batch_id_as_per_fssai, expiry_date:''} 
                                        : { label:bval.barcode, value:bval.barcode, expiry_date:bval.expiry_date,}
                                    )
                                )
                            )
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
                                rawMaterials: data.data['masterData'].rawMaterials.map((value) => {
                                    return {
                                        value: value.id,
                                        label: value.rm_name,
                                        rate: value.rate,
                                    }
                                }),
                                boxes: data.data['masterData'].boxes.map((value)=>{
                                    return {
                                        value:value.id,
                                        label:value.box_name,
                                        rate: value.rate,
                                    }
                                }),
                                combo_boxes: data.data['masterData'].combo_boxes.map((value)=>{
                                    return {
                                        value:value.id,
                                        label:value.combo_box_name,
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
                apiDepotTransferMasterData()
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
                                boxes: data.data['masterData'].boxes.map((value)=>{
                                    return {
                                        value:value.id,
                                        label:value.box_name,
                                        rate: value.rate,
                                    }
                                }),
                                combo_boxes: data.data['masterData'].combo_boxes.map((value)=>{
                                    return {
                                        value:value.id,
                                        label:value.combo_box_name,
                                        rate: value.rate,
                                    }
                                }),
                                barcodes:[]
                            })
                            setLoading(false)
                        }
                    })
                    .catch((error) => {
                        if (error.response.status === 401 || error.response.status === 500) {
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
            }
            return true
        }
        fetchData()
    }, [])
    return (
        <Formik
            enableReinitialize={true}
            // initialValues={{
            //     date_of_transfer: depotTransferData.date_of_transfer === '' ? new Date() : new Date(depotTransferData.date_of_transfer),
            //     depot_out_id: depotTransferData.depot_out_id,
            //     type: depotTransferData.type,
            //     depotTransferItems: depotTransferData.depotTransferItems.length > 0? depotTransferData.depotTransferItems : [],
            //     remarks: depotTransferData.remarks,
            // }}
            initialValues={depotTransferData}
            innerRef={formRef}
            validationSchema={validationSchema}
            onSubmit={(values, actions) => {
                console.log(values)
                // setSubmitting(false)
                if (depotTransferId.dtid) {
                    // console.log(values)
                    if (actionBtn.approve) {
                        apiDepotTransferApprove({
                            values,
                            ...{ id: depotTransferId.dtid },
                        })
                            .then((data) => {
                                console.log(data)
                                if (data.status === 200) {
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
                                    navigate('/transaction/depot-transfer')
                                }
                                actions.setSubmitting(false)
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
                                actions.setSubmitting(false)
                            })
                    } else {
                        apiDepotTransferUpdate({
                            values,
                            ...{ id: depotTransferId.dtid },
                        })
                            .then((data) => {
                                console.log(data)
                                if (data.status === 200 || data.status === 201) {
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
                                    navigate('/transaction/depot-transfer')
                                }
                                actions.setSubmitting(false)
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
                                actions.setSubmitting(false)
                            })
                    }
                } else {
                    console.log(values)
                    apiDepotTransferPost(values)
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
                                )
                                navigate('/transaction/depot-transfer')
                            }
                        })
                        .catch((error) => {
                            let errorData =
                                error.response['data']['error']['errors']
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
                const depotTransferItems = values.depotTransferItems;
                return (
                    <Form autoComplete="off" autoSave="off">
                        <AdaptableCard className="card-shadow mb-2">
                            <h5 className="mb-6">
                                {' '}
                                {depotTransferId.dtid ? 'Edit' : 'Add'}{' '}
                                Depot Transfer
                            </h5>
                            {/* <p className="mb-6">{depotTransferId.dtid ? 'Edit' : 'Add'} basic details of Purchase</p> */}
                            <FormContainer layout="horizontal" size="sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                    <FormItem
                                        asterisk
                                        label="Date"
                                        invalid={
                                            errors.date_of_transfer &&
                                            touched.date_of_transfer
                                        }
                                        errorMessage={errors.date_of_transfer}
                                    >
                                        <Field
                                            autoComplete="off"
                                            autoSave="off"
                                            name="date_of_transfer"
                                        >
                                            {({ field, form }) => (
                                                <DatePicker
                                                    inputFormat="DD-MM-YYYY"
                                                    // inputtable
                                                    // inputtableBlurClose={false}
                                                    field={field}
                                                    placeholder="Date Of Transfer"
                                                    form={form}
                                                    maxDate={new Date()}
                                                    value={values.date_of_transfer}
                                                    onChange={(option) => {
                                                        let date = new Date(
                                                            option
                                                        )
                                                        return form.setFieldValue(
                                                            field.name,
                                                            `${date.getFullYear()}-${
                                                                date.getMonth() <
                                                                10
                                                                    ? '0' +
                                                                      (date.getMonth() +
                                                                          1)
                                                                    : date.getMonth() +
                                                                      1
                                                            }-${
                                                                date.getDate() <
                                                                10
                                                                    ? '0' +
                                                                      date.getDate()
                                                                    : date.getDate()
                                                            }`
                                                        )
                                                    }}
                                                    disabled={actionBtn.approve}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Depot Out"
                                        invalid={
                                            errors.depot_out_id && touched.depot_out_id
                                        }
                                        errorMessage={errors.depot_out_id}
                                    >
                                        <Field name="depot_out_id">
                                            {({ field, form }) => (
                                                <Select
                                                    field={field}
                                                    form={form}
                                                    options={masterOption.depots}
                                                    // onFocus={onFocus}
                                                    isLoading={loading}
                                                    value={masterOption.depots.filter((option) => option.value === values.depot_out_id)}
                                                    onChange={(option) => {form.setFieldValue(field.name, option?.value); changeDepotOut();}}
                                                    isDisabled={actionBtn.approve}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Depot In"
                                        invalid={errors.depot_in_id && touched.depot_in_id}
                                        errorMessage={errors.depot_in_id}
                                    >
                                        <Field name="depot_in_id">
                                            {({ field, form }) => (
                                                <Select
                                                    field={field}
                                                    form={form}
                                                    options={masterOption.depots}
                                                    // onFocus={onFocus}
                                                    isLoading={loading}
                                                    value={masterOption.depots.filter((option) => option.value === values.depot_in_id)}
                                                    onChange={(option) => form.setFieldValue(field.name, option?.value)}
                                                    isDisabled={actionBtn.approve}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        label="Chalan No."
                                        invalid={errors.chalan_no && touched.chalan_no}
                                        errorMessage={errors.chalan_no}
                                    >
                                        <Field
                                            placeholder="Chalan No"
                                            name="chalan_no"
                                            type="string"
                                            component={Input}
                                            disabled={actionBtn.approve}
                                        />
                                    </FormItem>
                                    {/* <FormItem
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
                                    </FormItem> */}
                                </div>
                                {/* <h5>Items Imformation</h5>
                                <p className="mb-6">{depotTransferId.dtid ? 'Edit' : 'Add'} details of Items for purchase order</p> */}
                                <Table compact className="border mb-6">
                                    <THead>
                                        <Tr>
                                            <Th>Type*</Th>
                                            <Th>Item*</Th>
                                            <Th>Qty*</Th>
                                            <Th>Stock Qty</Th>
                                            <Th>Batch No./Barcode</Th>
                                            <Th className={ actionBtn.approve ? 'hidden' : 'visible'}>Action</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        <FieldArray name="depotTransferItems">
                                            {({ form, remove, push }) => (
                                                <>
                                                    {depotTransferItems && depotTransferItems.length > 0 ? depotTransferItems.map(
                                                        (_, index) => {
                                                            const type = fieldFeedback(form, `depotTransferItems[${index}].type`)
                                                            const item_id = fieldFeedback(form, `depotTransferItems[${index}].item_id`)
                                                            const barcode = fieldFeedback(form, `depotTransferItems[${index}].barcode`)
                                                            const qty = fieldFeedback(form, `depotTransferItems[${index}].qty`)
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
                                                                                <Field name={`depotTransferItems[${index}].type`}>
                                                                                    {({field, form,}) =>(
                                                                                        <Select
                                                                                            className="custom-text-left text-left"
                                                                                            field={field}
                                                                                            form={form}
                                                                                            options={stockTypeOption}
                                                                                            isLoading={loading}
                                                                                            value={stockTypeOption.filter((option) => option.value === values.depotTransferItems[index].type )}
                                                                                            onChange={(option, field) =>  form.setFieldValue(field.name, option.value)}
                                                                                            isDisabled={actionBtn.approve}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="450">
                                                                        {
                                                                            depotTransferItems[index].type === 'Raw Material' ? (
                                                                                <FormItem
                                                                                    className="mb-0 custom-text-left"
                                                                                    invalid={item_id.invalid}
                                                                                    layout="vertical"
                                                                                    errorMessage={item_id.errorMessage}
                                                                                >
                                                                                    <Field name={`depotTransferItems[${index}].item_id`}>
                                                                                        {({field, form,}) =>(
                                                                                            <Select
                                                                                                className="custom-text-left text-left"
                                                                                                field={field}
                                                                                                form={form}
                                                                                                options={masterOption.rawMaterials}
                                                                                                isLoading={loading}
                                                                                                value={masterOption.rawMaterials.filter((option) => option.value === values.depotTransferItems[index].item_id )}
                                                                                                onChange={(option, field) =>  {
                                                                                                    form.setFieldValue(field.name, option.value)
                                                                                                    form.setFieldValue(`depotTransferItems[${index}].expiry_date`, option.expiry_date)
                                                                                                    getBarcode(option.value, index, 'Raw Material')
                                                                                                }}
                                                                                                isDisabled={actionBtn.approve}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                </FormItem>
                                                                            ) : depotTransferItems[index].type === 'Box' ? (
                                                                                <FormItem
                                                                                    className="mb-0 custom-text-left"
                                                                                    invalid={item_id.invalid}
                                                                                    layout="vertical"
                                                                                    errorMessage={item_id.errorMessage}
                                                                                >
                                                                                    <Field name={`depotTransferItems[${index}].item_id`}>
                                                                                        {({field, form,}) =>(
                                                                                            <Select
                                                                                                className="custom-text-left text-left"
                                                                                                field={field}
                                                                                                form={form}
                                                                                                options={masterOption.boxes}
                                                                                                isLoading={loading}
                                                                                                value={masterOption.boxes.filter((option) => option.value === values.depotTransferItems[index].item_id )}
                                                                                                onChange={(option) =>  {
                                                                                                    form.setFieldValue(field.name, option.value)
                                                                                                    form.setFieldValue(`depotTransferItems[${index}].stockQty`, 0)
                                                                                                    getBarcode(option.value, index, 'Box')
                                                                                                }}
                                                                                                isDisabled={actionBtn.approve}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                </FormItem>
                                                                            ) : depotTransferItems[index].type === 'Combo Box' ? (
                                                                                <FormItem
                                                                                    className="mb-0 custom-text-left"
                                                                                    invalid={item_id.invalid}
                                                                                    layout="vertical"
                                                                                    errorMessage={item_id.errorMessage}
                                                                                >
                                                                                    <Field name={`depotTransferItems[${index}].item_id`}>
                                                                                        {({field, form,}) =>(
                                                                                            <Select
                                                                                                className="custom-text-left text-left"
                                                                                                field={field}
                                                                                                form={form}
                                                                                                options={masterOption.combo_boxes}
                                                                                                isLoading={loading}
                                                                                                value={masterOption.combo_boxes.filter((option) => option.value === values.depotTransferItems[index].item_id )}
                                                                                                onChange={(option, field) =>  {
                                                                                                    form.setFieldValue(field.name, option.value)
                                                                                                    form.setFieldValue(`depotTransferItems[${index}].stockQty`, 0)
                                                                                                    getBarcode(option.value, index, 'Combo Box')
                                                                                                }}
                                                                                                isDisabled={actionBtn.approve}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                </FormItem>
                                                                            ) : null
                                                                        }
                                                                                </Td>
                                                                        <Td width="150" style={{paddingBottom: qty.invalid ? "25px" : "0px"}}>
                                                                            <FormItem
                                                                                className="mb-0"
                                                                                invalid={qty.invalid}
                                                                                layout="vertical"
                                                                                errorMessage={qty.errorMessage}
                                                                            >
                                                                                {/* <Field
                                                                                    invalid={qty.invalid}
                                                                                    placeholder="Quantity"
                                                                                    name={`depotTransferItems[${index}].qty`}
                                                                                    type="number"
                                                                                    onWheel={(e) =>e.target.blur()}
                                                                                    component={Input}
                                                                                    disabled={actionBtn.approve}
                                                                                    onChange={(option) => {
                                                                                        form.setFieldValue(`depotTransferItems[${index}].qty`, option.target.value)
                                                                                        if(option.target.value > parseFloat(depotTransferItems[index].stockQty)){
                                                                                            console.log(option.target.value)
                                                                                            form.setFieldError(`depotTransferItems[${index}].qty`, 'Quantity cannot be greater than stock quantity')
                                                                                        }
                                                                                    }}
                                                                                /> */}

                                                                                <Field name={`depotTransferItems[${index}].qty`}>
                                                                                    {({ field, form }) => (
                                                                                        <Input
                                                                                            {...field}
                                                                                            invalid={qty.invalid}
                                                                                            placeholder="Quantity"
                                                                                            type="number"
                                                                                            onWheel={(e) => e.target.blur()}
                                                                                            disabled={actionBtn.approve}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="150">{depotTransferItems[index].stockQty}</Td>
                                                                        <Td width="200">
                                                                            <FormItem
                                                                                className="mb-0 custom-text-left"
                                                                                invalid={barcode.invalid}
                                                                                layout="vertical"
                                                                                errorMessage={barcode.errorMessage}
                                                                            >
                                                                                <Field name={`depotTransferItems[${index}].barcode`}>
                                                                                    {({field, form,}) =>(
                                                                                        <Select
                                                                                            className="custom-text-left text-left"
                                                                                            field={field}
                                                                                            form={form}
                                                                                            options={masterOption.barcodes.length > 0 ? masterOption.barcodes[index]: []}
                                                                                            isLoading={loading}
                                                                                            value={masterOption.barcodes[index] ? masterOption.barcodes[index].filter((option) => option.value === values.depotTransferItems[index].barcode) : values.depotTransferItems[index].barcode}
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
                                                            colSpan="10"
                                                            className="custom-text-left"
                                                        >
                                                            <Button
                                                                type="button"
                                                                className="ltr:mr-2 rtl:ml-2"
                                                                onClick={() => {
                                                                    push({
                                                                        type:'',
                                                                        item_id:'',
                                                                        qty:'',
                                                                        stockQty:'',
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
                                <p className="mb-6">{depotTransferId.dtid ? 'Edit' : 'Add'} final Depot Transfer remark</p> */}

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
                                    actionBtn.approve && depotTransferData.status === 'deleted'?
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
                                    onClick={() => rejectDepotTransfer()}
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
                                    onClick={() => deleteDepotTransfer()}
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
                                        navigate('/transaction/depot-transfer')
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

export default AddEditDepotTransfer
