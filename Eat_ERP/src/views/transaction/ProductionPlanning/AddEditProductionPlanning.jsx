import React, { useEffect, useState, useRef } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import DatePicker from 'components/ui/DatePicker'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import { Field, Form, FieldArray, Formik, getIn } from 'formik'
import Checkbox from 'components/ui/Checkbox'
import { useNavigate, useParams } from 'react-router-dom'
import * as Yup from 'yup'
import Table from 'components/ui/Table'
import { HiMinus } from 'react-icons/hi'
import '../PurchaseOrder/AddEditPurchaseOrder.css'
import NumberFormat from 'react-number-format'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiProductionPlanningApprove,
    apiProductionPlanningDelete,
    apiProductionPlanningGetProductRaws,
    apiProductionPlanningGetSingle,
    apiProductionPlanningMasterData,
    apiProductionPlanningPost,
    apiProductionPlanningReject,
    apiProductionPlanningUpdate,
} from 'services/ProductionPlanningService'
import { debounce } from 'lodash'

const { Tr, Th, Td, THead, TBody } = Table

const validationSchema = Yup.object().shape({
    depot_id: Yup.string().required('Depot Is Required'),
    productionPlanningProducts: Yup.array().of(
        Yup.object()
        .shape({
            type: Yup.string().required(' '),
            product_id: Yup.number().required('Product is Required'),
            product_name: Yup.string().required(' '),
            no_of_batch: Yup.number().required(' ').moreThan(-1, ' ').typeError(' '),
            requested_kg: Yup.number().required(' ').moreThan(0, ' ').typeError(' '),
        })    
    ),
    productionPlanningItems: Yup.array().of(
        Yup.object().shape({
            qty: Yup.number().required(' ').typeError(' ').test((value, context)=>{
                const { path } = context;
                if(context.parent.draft_po){
                    if(value > 0){
                        return true
                    }else{
                        return context.createError({path, message: ' ',})
                    }
                }else{
                    if(value < 0){
                        return context.createError({path, message: ' ',})
                    }else{
                        return true
                    }
                }
            }),
            rate: Yup.number().required(' ').moreThan(0, ' ').typeError(' '),
            vendor_id: Yup.number().required('Vendor Is Required'),
            
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

const options = [
    { value: 'Essentials', label: 'Essesntials' },
    { value: 'Other', label: 'Non-Essentials' },
]

const AddEditProductionPlanning = () => {
    const [productionData, setProductionData] = useState({
        depot_id: '',
        productionPlanningProducts: [
            // {
            //     type:'',
            //     product_id:'',
            //     product_name:'',
            //     no_of_batch:'',
            //     requested_kg:'',
            // },
        ],
        productionPlanningItems: [
            // {
            //     item_id: '',
            //     item_name: '',
            //     item_desc: '',
            //     required_qty: '',
            //     available_qty: '',
            //     difference_qty: '',
            //     rate: '',
            //     old_po_rate: '',
            //     vendor_id: '',
            //     qty: '',
            //     draft_po: false,
            //     po_status: ''
            // }
        ],
        po_drafted : false
    })

    const [actionBtn, setActionBtn] = useState({
        approve: false,
        delete: false,
        update: false,
    })
    const [masterOption, setMasterOption] = useState({
        vendors: [],
        depots: [],
        products: [],
        nonEssentialProducts: [],
        recipes:[]
    })
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const peoductionId = useParams()
    const formRef = useRef()

    const deleteProductionPlanning = () => {
        apiProductionPlanningDelete(peoductionId.productionid)
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
                    navigate('/transaction/production-planning')
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
    const rejectProductionPlanning = () => {
        apiProductionPlanningReject({
            values: formRef.current.values,
            ...{ id: peoductionId.productionid },
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
                    navigate('/transaction/production-planning')
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

    const changeRequestedKg = (value, product_id, index)=>{
        let no_of_batch = isNaN(value) ? 0 : parseFloat(value);
        let total = 0;
        const data = masterOption.recipes.filter(value => value.product_id === product_id )
        console.log(data)
        if(data){
            total= data[0].total_kgs * no_of_batch
            console.log(total)
            formRef.current.setFieldValue(`productionPlanningProducts[${index}].requested_kg`, (Math.round(total * 10000))/10000)
        }
    }

    const checkProductMaterialsDebounce = ()=>{
        // console.log(formRef.current.values)
        apiProductionPlanningGetProductRaws(formRef.current.values).then(data=>{
            console.log(data.data['productionPlanningRawMaterials'])
            formRef.current.setFieldValue(`productionPlanningItems`, data.data['productionPlanningRawMaterials'].map((value, index) => {
                return {
                        item_id: value.item_id,
                        item_name: value.item_name,
                        item_desc: value.item_desc,
                        required_qty: value.required_qty,
                        available_qty: value.available_qty,
                        difference_qty: value.difference_qty,
                        rate: value.rate,
                        old_po_rate: value.old_po_rate,
                        vendor_id: value.vendor_id,
                        qty: value.qty,
                        draft_po: value.draft_po === 1 ? true : false,
                        po_status: value.po_status 
                    }
                }
            ))
        })
    }

    const checkProductMaterials = debounce(checkProductMaterialsDebounce, 1000)

    useEffect(() => {
        const fetchData = () => {
            if (peoductionId.productionid) {
                setLoading(true)
                apiProductionPlanningGetSingle(peoductionId.productionid)
                    .then((data) => {
                        if (data.status === 200) {
                            // console.log(data.data['action'])
                            setActionBtn({
                                approve: data.data['action']['approve'],
                                update: data.data['action']['update'],
                                delete: data.data['action']['delete'],
                            })
                            setProductionData({
                                depot_id: data.data['productionPlanning'].depot_id,
                                productionPlanningProducts: data.data['productionPlanning'].productionPlanningProducts.map((value, index) => {
                                    return  {
                                        type: value.type,
                                        product_id: value.product_id,
                                        product_name: value.product_name,
                                        no_of_batch: value.no_of_batch,
                                        requested_kg: value.requested_kg,
                                    }
                                }),
                                productionPlanningItems: data.data['productionPlanning'].productionPlanningItems ?
                                    data.data['productionPlanning'].productionPlanningItems.map(
                                        (value, index) => {
                                            return {
                                            item_id: value.item_id,
                                            item_name: value.item_name,
                                            item_desc: value.item_desc,
                                            required_qty: value.required_qty,
                                            available_qty: value.available_qty,
                                            difference_qty: value.difference_qty,
                                            rate: value.rate,
                                            old_po_rate: value.old_po_rate,
                                            vendor_id: value.vendor_id,
                                            qty: value.qty,
                                            draft_po: value.draft_po === 1 ? true : false,
                                            po_status: value.po_status 
                                        }
                                        }
                                    ) : [],
                                po_drafted:data.data['productionPlanning'].po_drafted === 1 ? true : false
                            })
                            // console.log(data.data['masterData'])
                            setMasterOption({
                                vendors: data.data['masterData'].vendors.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.vendor_name,
                                            state: value.state,
                                        }
                                    }
                                ),
                                depots: data.data['masterData'].depots.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.depot_name,
                                            state: value.state,
                                        }
                                    }
                                ),
                                products: data.data['masterData'].products.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.short_name,
                                            product_name: value.product_name,
                                        }
                                    }
                                ),
                                nonEssentialProducts: data.data['masterData'].nonEssentialProducts.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.short_name,
                                            product_name: value.product_name,
                                        }
                                    }
                                ),
                                recipes:data.data['masterData'].recipes,
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
                apiProductionPlanningMasterData()
                    .then((data) => {
                        if (data.status === 200) {
                            setMasterOption({
                                vendors: data.data['masterData'].vendors.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.vendor_name,
                                            state: value.state,
                                        }
                                    }
                                ),
                                depots: data.data['masterData'].depots.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.depot_name,
                                            state: value.state,
                                        }
                                    }
                                ),
                                products: data.data['masterData'].products.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.short_name,
                                            product_name: value.product_name,
                                        }
                                    }
                                ),
                                nonEssentialProducts: data.data['masterData'].nonEssentialProducts.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.short_name,
                                            product_name: value.product_name,
                                        }
                                    }
                                ),
                                recipes:data.data['masterData'].recipes,
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
            initialValues={{
                depot_id: productionData.depot_id,
                productionPlanningProducts: productionData.productionPlanningProducts ? productionData.productionPlanningProducts : [],
                productionPlanningItems: productionData.productionPlanningItems ? productionData.productionPlanningItems : []
            }}
            innerRef={formRef}
            validationSchema={validationSchema}
            onSubmit={(values, actions) => {
                console.log(values)
                // setSubmitting(false)
                if (peoductionId.productionid) {
                    // console.log(values)
                    if (actionBtn.approve) {
                        apiProductionPlanningApprove({
                            values,
                            ...{ id: peoductionId.productionid },
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
                                    navigate('/transaction/production-planning')
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
                        apiProductionPlanningUpdate({
                            values,
                            ...{ id: peoductionId.productionid },
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
                                    navigate('/transaction/production-planning')
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
                    apiProductionPlanningPost(values)
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
                                navigate('/transaction/production-planning')
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
                const productionPlanningProducts = values.productionPlanningProducts
                const productionPlanningItems = values.productionPlanningItems
                return (
                    <Form autoComplete="off" autoSave="off">
                        <AdaptableCard className="card-shadow mb-2">
                            <h5 className="mb-6">
                                {' '}
                                {peoductionId.productionid ? 'Edit' : 'Add'}{' '}
                                Production Planning
                            </h5>
                            {/* <p className="mb-6">{peoductionId.productionid ? 'Edit' : 'Add'} basic details of Purchase</p> */}
                            <FormContainer layout="horizontal" size="sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                    <FormItem
                                        layout="inline"
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
                                                    options={
                                                        masterOption.depots
                                                    }
                                                    className="w-[300px]"
                                                    // onFocus={onFocus}
                                                    isLoading={loading}
                                                    value={masterOption.depots.filter(
                                                        (option) =>
                                                            option.value ===
                                                            values.depot_id
                                                    )}
                                                    onChange={(option) => {
                                                        form.setFieldValue(field.name, option?.value)
                                                        if(values.productionPlanningProducts.length > 0) checkProductMaterials()
                                                    }}
                                                    isDisabled={actionBtn.approve || productionData.po_drafted}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                </div>
                                {/* <h5>Items Imformation</h5>
                                <p className="mb-6">{peoductionId.productionid ? 'Edit' : 'Add'} details of Items for purchase order</p> */}
                                <div className="mb-6 w-[100%] md:w-[800px]">
                                    <Table overflow="false" compact className="border">
                                        <THead>
                                            <Tr>
                                                <Th>Type</Th>
                                                <Th>Product</Th>
                                                <Th>Unit</Th>
                                                <Th>Kgs</Th>
                                                <Th
                                                    className={
                                                        actionBtn.approve
                                                            ? 'hidden'
                                                            : 'visible'
                                                    }
                                                >
                                                    Action
                                                </Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="productionPlanningProducts">
                                                {({ form, remove, push }) => (
                                                    <>
                                                        {productionPlanningProducts &&
                                                        productionPlanningProducts.length >
                                                            0
                                                            ? productionPlanningProducts.map(
                                                                (
                                                                    _,
                                                                    index
                                                                ) => {
                                                                    const type =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `productionPlanningProducts[${index}].type`
                                                                        )
                                                                    const product_id =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `productionPlanningProducts[${index}].product_id`
                                                                        )
                                                                    const no_of_batch =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `productionPlanningProducts[${index}].no_of_batch`
                                                                        )
                                                                    const requested_kg =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `productionPlanningProducts[${index}].requested_kg`
                                                                        )
                                                                    return (
                                                                        <Tr key={index}>
                                                                            <Td width="200">
                                                                                <FormItem
                                                                                    className="mb-0 custom-text-left"
                                                                                    invalid={
                                                                                        type.invalid
                                                                                    }
                                                                                    layout="vertical"
                                                                                    errorMessage={
                                                                                        type.errorMessage
                                                                                    }
                                                                                >
                                                                                    <Field
                                                                                        name={`productionPlanningProducts[${index}].type`}
                                                                                    >
                                                                                        {({
                                                                                            field,
                                                                                            form,
                                                                                        }) => (
                                                                                            <Select
                                                                                                className="custom-text-left text-left"
                                                                                                field={field}
                                                                                                form={form}
                                                                                                options={options}
                                                                                                // onFocus={onFocus}
                                                                                                isLoading={
                                                                                                    loading
                                                                                                }
                                                                                                value={options.filter((option) => option.value === values.productionPlanningProducts[index].type
                                                                                                )}
                                                                                                onChange={(option) =>{
                                                                                                    form.setFieldValue(field.name, option?.value)
                                                                                                    form.setFieldValue(`productionPlanningProducts[${index}].no_of_batch`, 0);
                                                                                                }
                                                                                                }
                                                                                                isDisabled={ actionBtn.approve || productionData.po_drafted}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                </FormItem>
                                                                            </Td>
                                                                            {
                                                                                values.productionPlanningProducts[index].type == 'Other' ?(
                                                                                    <Td>
                                                                                        <FormItem
                                                                                            className="mb-0 custom-text-left"
                                                                                            invalid={
                                                                                                product_id.invalid
                                                                                            }
                                                                                            layout="vertical"
                                                                                            errorMessage={
                                                                                                product_id.errorMessage
                                                                                            }
                                                                                        >
                                                                                            <Field name={`productionPlanningProducts[${index}].product_id`} >
                                                                                                {({ field, form}) => 
                                                                                                    (   
                                                                                                        <Select
                                                                                                            className="custom-text-left text-left"
                                                                                                            options={masterOption.nonEssentialProducts}
                                                                                                            field={field}
                                                                                                            form={form}
                                                                                                            isLoading={
                                                                                                                loading
                                                                                                            }
                                                                                                            value={masterOption.nonEssentialProducts.filter((option) => option.value === values.productionPlanningProducts[index].product_id
                                                                                                            )}
                                                                                                            onChange={(option) =>{
                                                                                                                console.log(option)
                                                                                                                form.setFieldValue(field.name, option?.value)
                                                                                                                form.setFieldValue(`productionPlanningProducts[${index}].product_name`, option?.product_name)
                                                                                                                changeRequestedKg(productionPlanningProducts[index].no_of_batch, productionPlanningProducts[index].product_id, index)
                                                                                                                checkProductMaterials()
                                                                                                            }}
                                                                                                            isDisabled={actionBtn.approve || productionData.po_drafted}
                                                                                                        />   
                                                                                                    )
                                                                                                }
                                                                                            </Field>
                                                                                        </FormItem>
                                                                                    </Td>
                                                                                ) : values.productionPlanningProducts[index].type == 'Essentials' ? (
                                                                                    <Td>
                                                                                        <FormItem
                                                                                            className="mb-0 custom-text-left"
                                                                                            invalid={
                                                                                                product_id.invalid
                                                                                            }
                                                                                            layout="vertical"
                                                                                            errorMessage={
                                                                                                product_id.errorMessage
                                                                                            }
                                                                                        >
                                                                                            <Field name={`productionPlanningProducts[${index}].product_id`} >
                                                                                                {({ field, form}) => 
                                                                                                    (   
                                                                                                        <Select
                                                                                                            className="custom-text-left text-left"
                                                                                                            options={masterOption.products}
                                                                                                            field={field}
                                                                                                            form={form}
                                                                                                            isLoading={
                                                                                                                loading
                                                                                                            }
                                                                                                            value={masterOption.products.filter((option) => option.value === values.productionPlanningProducts[index].product_id
                                                                                                            )}
                                                                                                            onChange={(option) =>{
                                                                                                                form.setFieldValue(field.name, option?.value)
                                                                                                                form.setFieldValue(`productionPlanningProducts[${index}].product_name`, option?.product_name)
                                                                                                                checkProductMaterials()
                                                                                                            }
                                                                                                            }
                                                                                                            isDisabled={ actionBtn.approve || productionData.po_drafted}
                                                                                                        />   
                                                                                                    )
                                                                                                }
                                                                                            </Field>
                                                                                        </FormItem>
                                                                                    </Td>
                                                                                ) : <Td>Please select type of product</Td>
                                                                            }
                                                                            {<Td width="100">
                                                                                <FormItem
                                                                                    className="mb-0"
                                                                                    invalid={
                                                                                        no_of_batch.invalid
                                                                                    }
                                                                                    layout="vertical"
                                                                                    errorMessage={
                                                                                        no_of_batch.errorMessage
                                                                                    }
                                                                                >
                                                                                    <Field
                                                                                        invalid={
                                                                                            no_of_batch.invalid
                                                                                        }
                                                                                        name={`productionPlanningProducts[${index}].no_of_batch`}
                                                                                        disabled={
                                                                                            actionBtn.approve
                                                                                        }
                                                                                    >
                                                                                        {({form,field,}) => (
                                                                                            <Input
                                                                                                invalid={no_of_batch.invalid}
                                                                                                field={field}
                                                                                                form={form}
                                                                                                placeholder="Unit"
                                                                                                type="number"
                                                                                                onWheel={(e) => e.target.blur()}
                                                                                                value={productionPlanningProducts[index].no_of_batch}
                                                                                                onChange={(e) => {
                                                                                                    changeRequestedKg(e.target.value, productionPlanningProducts[index].product_id, index)
                                                                                                    form.setFieldValue(field.name,parseFloat(e.target.value))
                                                                                                    checkProductMaterials()
                                                                                                }}
                                                                                                disabled={actionBtn.approve || productionPlanningProducts[index].type == 'Essentials' || productionData.po_drafted}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                </FormItem>
                                                                            </Td>}
                                                                            <Td width="100">
                                                                                <FormItem
                                                                                    className="mb-0"
                                                                                    invalid={
                                                                                        requested_kg.invalid
                                                                                    }
                                                                                    layout="vertical"
                                                                                    errorMessage={
                                                                                        requested_kg.errorMessage
                                                                                    }
                                                                                >
                                                                                    <Field
                                                                                        invalid={
                                                                                            requested_kg.invalid
                                                                                        }
                                                                                        name={`productionPlanningProducts[${index}].requested_kg`}
                                                                                        disabled={
                                                                                            actionBtn.approve
                                                                                        }
                                                                                    >
                                                                                        {({form,field,}) => (
                                                                                            <Input
                                                                                                invalid={requested_kg.invalid}
                                                                                                field={field}
                                                                                                form={form}
                                                                                                placeholder="KGS"
                                                                                                type="number"
                                                                                                onWheel={(e) => e.target.blur()}
                                                                                                value={productionPlanningProducts[index].requested_kg}
                                                                                                onChange={(e) => {
                                                                                                    form.setFieldValue(field.name,parseFloat(e.target.value))
                                                                                                    checkProductMaterials()
                                                                                                }}
                                                                                                disabled={actionBtn.approve || productionPlanningProducts[index].no_of_batch > 0 || productionData.po_drafted}
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
                                                                                    icon={<HiMinus />}
                                                                                    onClick={() => remove(index)}
                                                                                    disabled={ index == 0 ? true : false || productionData.po_drafted }
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
                                                                            product_id:'',
                                                                            product_name:'',
                                                                            no_of_batch:'',
                                                                            requested_kg:'',
                                                                        })
                                                                    }}
                                                                    disabled={productionData.po_drafted}
                                                                >
                                                                    Add Product
                                                                </Button>
                                                            </Td>
                                                        </Tr>
                                                    </>
                                                )}
                                            </FieldArray>
                                        </TBody>
                                    </Table>
                                </div>
                                <Table compact className="border mb-6">
                                    <THead>
                                        <Tr>
                                            <Th>Raw Material</Th>
                                            <Th>Required</Th>
                                            <Th>Available</Th>
                                            <Th>Difference</Th>
                                            <Th>Qty</Th>
                                            <Th>Old Rate</Th>
                                            <Th>Rate</Th>
                                            <Th>Draft PO</Th>
                                            <Th>Vendor</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        <FieldArray name="productionPlanningItems">
                                            {({ form, remove, push }) => (
                                                <>
                                                    {productionPlanningItems &&
                                                    productionPlanningItems.length >
                                                        0
                                                        ? productionPlanningItems.map(
                                                              (
                                                                  _,
                                                                  index
                                                              ) => {
                                                                  const qty = fieldFeedback( form, `productionPlanningItems[${index}].qty`)
                                                                  const rate = fieldFeedback( form, `productionPlanningItems[${index}].rate`)
                                                                  const draft_po = fieldFeedback(form, `productionPlanningItems[${index}].draft_po`)
                                                                  const vendor_id = fieldFeedback( form, `productionPlanningItems[${index}].vendor_id`)
                                                                  return (
                                                                    <Tr key={index}>
                                                                        <Td>{values.productionPlanningItems[index].item_name}</Td>
                                                                        <Td width="150">{values.productionPlanningItems[index].required_qty}</Td>
                                                                        <Td width="150">{values.productionPlanningItems[index].available_qty}</Td>
                                                                        <Td width="150">{values.productionPlanningItems[index].difference_qty}</Td>
                                                                        <Td width="100">
                                                                            <FormItem
                                                                                className="mb-0"
                                                                                invalid={
                                                                                    qty.invalid
                                                                                }
                                                                                layout="vertical"
                                                                                errorMessage={
                                                                                    qty.errorMessage
                                                                                }
                                                                            >
                                                                                <Field
                                                                                    invalid={
                                                                                        qty.invalid
                                                                                    }
                                                                                    name={`productionPlanningItems[${index}].qty`}
                                                                                    disabled={
                                                                                        actionBtn.approve
                                                                                    }
                                                                                >
                                                                                    {({form,field,}) => (
                                                                                        <Input
                                                                                            invalid={qty.invalid}
                                                                                            field={field}
                                                                                            form={form}
                                                                                            placeholder="Qty"
                                                                                            type="number"
                                                                                            onWheel={(e) => e.target.blur()}
                                                                                            value={productionPlanningItems[index].qty}
                                                                                            onChange={(e) => {
                                                                                                form.setFieldValue(field.name,parseFloat(e.target.value))
                                                                                            }}
                                                                                            disabled={actionBtn.approve}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="100">{values.productionPlanningItems[index].old_po_rate}</Td>
                                                                        <Td width="100">
                                                                            <FormItem
                                                                                className="mb-0"
                                                                                invalid={
                                                                                    rate.invalid
                                                                                }
                                                                                layout="vertical"
                                                                                errorMessage={
                                                                                    rate.errorMessage
                                                                                }
                                                                            >
                                                                                <Field
                                                                                    invalid={
                                                                                        rate.invalid
                                                                                    }
                                                                                    name={`productionPlanningItems[${index}].rate`}
                                                                                    disabled={
                                                                                        actionBtn.approve
                                                                                    }
                                                                                >
                                                                                    {({form,field,}) => (
                                                                                        <Input
                                                                                            invalid={rate.invalid}
                                                                                            field={field}
                                                                                            form={form}
                                                                                            placeholder="Rate"
                                                                                            type="number"
                                                                                            onWheel={(e) => e.target.blur()}
                                                                                            value={productionPlanningItems[index].rate}
                                                                                            onChange={(e) => {
                                                                                                form.setFieldValue(field.name,parseFloat(e.target.value))
                                                                                            }}
                                                                                            disabled={actionBtn.approve}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="90" className="text-center">
                                                                        {
                                                                            values.productionPlanningItems[index].po_status != ''? values.productionPlanningItems[index].po_status : (
                                                                                <FormItem
                                                                                    className="mb-0"
                                                                                    invalid={
                                                                                        draft_po.invalid
                                                                                    }
                                                                                    layout="vertical"
                                                                                    errorMessage={
                                                                                        draft_po.errorMessage
                                                                                    }
                                                                                >
                                                                                <Checkbox
                                                                                    name={`productionPlanningItems[${index}].draft_po`}
                                                                                    value={
                                                                                        values.productionPlanningItems[index].draft_po
                                                                                    }
                                                                                    checked={values.productionPlanningItems[index].draft_po
                                                                                    }
                                                                                    onChange={(e) => {
                                                                                        form.setFieldValue(`productionPlanningItems[${index}].draft_po`,e)
                                                                                    }}
                                                                                />
                                                                                </FormItem>
                                                                            )
                                                                        }
                                                                        </Td>
                                                                        <Td width="300">
                                                                            <FormItem
                                                                                className="mb-0 custom-text-left"
                                                                                invalid={
                                                                                    vendor_id.invalid
                                                                                }
                                                                                layout="vertical"
                                                                                errorMessage={
                                                                                    vendor_id.errorMessage
                                                                                }
                                                                            >
                                                                                <Field name={`productionPlanningItems[${index}].vendor_id`} >
                                                                                    {({ field, form}) =>
                                                                                        (
                                                                                            <Select
                                                                                                className="custom-text-left text-left"
                                                                                                field={field}
                                                                                                form={form}
                                                                                                options={masterOption.vendors}
                                                                                                isLoading={
                                                                                                    loading
                                                                                                }
                                                                                                value={masterOption.vendors.filter((option) => option.value === values.productionPlanningItems[index].vendor_id
                                                                                                )}
                                                                                                onChange={(option) =>{
                                                                                                    form.setFieldValue(field.name, option?.value)
                                                                                                }}
                                                                                                isDisabled={
                                                                                                    actionBtn.approve
                                                                                                }
                                                                                            />
                                                                                        )
                                                                                    }
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                    </Tr>
                                                                  )
                                                              }
                                                          )
                                                        : null}
                                                </>
                                            )}
                                        </FieldArray>
                                    </TBody>
                                </Table>
                                {/* <h5>Other Information</h5>
                                <p className="mb-6">{peoductionId.productionid ? 'Edit' : 'Add'} final Production Planning remark</p> */}
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
                                    onClick={() => rejectProductionPlanning()}
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
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    variant="solid"
                                    color="red-600"
                                    onClick={() => deleteProductionPlanning()}
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
                                        navigate('/transaction/production-planning')
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

export default AddEditProductionPlanning
