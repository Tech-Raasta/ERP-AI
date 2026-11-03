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
import './AddEditPurchaseOrder.css'
import NumberFormat from 'react-number-format'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiPurchaseOrderApprove,
    apiPurchaseOrderDelete,
    apiPurchaseOrderGetSingle,
    apiPurchaseOrderMasterData,
    apiPurchaseOrderPoRate,
    apiPurchaseOrderPost,
    apiPurchaseOrderReject,
    apiPurchaseOrderUpdate,
} from 'services/PurchaseOrderService'

const { Tr, Th, Td, THead, TBody } = Table

const validationSchema = Yup.object().shape({
    order_date: Yup.string().required('Order Date Is Required').nullable(),
    vendor_id: Yup.string().required('Vendor Is Required'),
    depot_id: Yup.string().required('Depot Is Required'),
    purchaseOrderItems: Yup.array().of(
        Yup.object()
            .shape({
                item_id: Yup.string().required(' '),
                qty: Yup.string().required(' ').nullable().typeError(' '),
                rate: Yup.string().required(' ').nullable().typeError(' '),
            })
            .required('Details is Required')
    ),
    purchaseOrderOtherCharges: Yup.array().of(
        Yup.object().shape({
            item_desc: Yup.string().required(' '),
            tax_per: Yup.number().required(' ').nullable().typeError(' '),
            amount: Yup.number().required(' ').nullable().typeError(' '),
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

const AddEditPurchaseOrder = () => {
    const [purchaseData, setPurchseData] = useState({
        order_date: '', //YYYY-MM-DD
        vendor_id: '',
        depot_id: '',
        purchaseOrderItems: [
            {
                item_id: '',
                item_desc: '',
                qty: '',
                old_po_rate: '',
                totalStock: '',
                rate: '',
                tax_per: '',
                amount: '',
                tax_amt: '',
                total_amt: '',
            },
        ],
        purchaseOrderOtherCharges: [],
        round_off_amount: '',
        remarks: '',
    })
    const [actionBtn, setActionBtn] = useState({
        approve: false,
        delete: false,
        update: false,
    })
    const [masterOption, setMasterOption] = useState({
        vendors: [],
        depots: [],
        rawMaterials: [],
    })
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const purchaseId = useParams()
    const formRef = useRef()

    const deletePurchaseOrder = () => {
        apiPurchaseOrderDelete(purchaseId.purchaseid)
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
                    navigate('/transaction/purchase-order')
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
    const rejectPurchaseOrder = () => {
        apiPurchaseOrderReject({
            values: formRef.current.values,
            ...{ id: purchaseId.purchaseid },
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
                    navigate('/transaction/purchase-order')
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

    const handleItemSelect = (option, field, index) => {
        const form = formRef.current
        console.log(option)
        form.setFieldValue(field.name, option?.value)
        form.setFieldValue(`purchaseOrderItems[${index}].rate`, option.rate)
        apiPurchaseOrderPoRate(option.value, form.values.depot_id).then((data) => {
            if (data.status === 200) {
                console.log(data);
                form.setFieldValue(
                    `purchaseOrderItems[${index}].tax_per`,
                    data.data['rawMaterial'].tax_per
                )
                // form.setFieldValue(
                //     `purchaseOrderItems[${index}].old_po_rate`,
                //     data.data['rawMaterial'].purchaseOrderItems[0].rate
                // )
                form.setFieldValue(
                    `purchaseOrderItems[${index}].old_po_rate`,
                    data.data['oldPoRate']
                )
                form.setFieldValue(
                    `purchaseOrderItems[${index}].totalStock`,
                    data.data['totalStock'] ? data.data['totalStock'] : 0  
                )
            } else {
                console.log(data)
            }
        }).catch((error) => {
            console.log(error)
        });
    };

    const handleStockCheck = (depot_id)=>{
        const form = formRef.current;
        if(form.values.purchaseOrderItems[0].item_id !== ''){
            
            form.values.purchaseOrderItems.forEach((item, index)=>{
                if(item.item_id !== ''){
                    apiPurchaseOrderPoRate(item.item_id, depot_id).then((data) => {
                        if (data.status === 200) {
                            console.log(data);
                            form.setFieldValue(
                                `purchaseOrderItems[${index}].tax_per`,
                                data.data['rawMaterial'].tax_per
                            )
                            form.setFieldValue(
                                `purchaseOrderItems[${index}].old_po_rate`,
                                data.data['oldPoRate']
                            )
                            form.setFieldValue(
                                `purchaseOrderItems[${index}].totalStock`,
                                data.data['totalStock'] ? data.data['totalStock'] : 0  
                            )
                        } else {
                            console.log(data)
                        }
                    }).catch((error) => {
                        console.log(error)
                    });
                }
            })
        }
        
    };
    const calculate = (values) => {
        let total = 0
        values.purchaseOrderItems.map((value) => {
            if (value.total_amt > 0) {
                total += value.total_amt
            }
            return total
        })
        return total
    }
    const handleTotal = (values) => {
        let total = calculate(values)
        if (values.purchaseOrderOtherCharges.length > 0) {
            values.purchaseOrderOtherCharges.map((value) => {
                if (value.total_amt > 0) {
                    total += value.total_amt
                }
                return total
            })
        }
        return total
    }

    const roundOffTotoal = (values) => {
        let total = handleTotal(values)
        return Math.round(total) - total
    }

    const finalAmount = (values) => Math.round(handleTotal(values))

    useEffect(() => {
        const fetchData = () => {
            if (purchaseId.purchaseid) {
                setLoading(true)
                apiPurchaseOrderGetSingle(purchaseId.purchaseid).then((data) => {
                    if (data.status === 200) {
                        // console.log(data.data['action'])
                        setActionBtn({
                            approve: data.data['action']['approve'],
                            update: data.data['action']['update'],
                            delete: data.data['action']['delete'],
                        })
                        setPurchseData({
                            order_date: new Date(data.data['purchaseOrder'].order_date),
                            vendor_id: data.data['purchaseOrder'].vendor_id,
                            depot_id: data.data['purchaseOrder'].depot_id,
                            round_off_amount:data.data['purchaseOrder'].round_off_amount,
                            purchaseOrderItems: data.data['purchaseOrder'].purchaseOrderItems.map((value, index) => {
                                return {
                                    item_id: value.item_id,
                                    item_desc: value.item_desc,
                                    qty: value.qty,
                                    rate: value.rate,
                                    tax_per: value.tax_per,
                                    amount: value.amount,
                                    tax_amt: value.tax_amt,
                                    total_amt: value.total_amt,
                                    old_po_rate: value.old_po_rate,
                                    totalStock:0
                                }
                            }),
                            purchaseOrderOtherCharges: data.data['purchaseOrder'].purchaseOrderOtherCharges == [] 
                                ? [
                                    {
                                        item_desc: '',
                                        tax_per: '',
                                        amount: '',
                                        tax_amt: '',
                                        total_amt: '',
                                    },
                                ]
                                : data.data['purchaseOrder'].purchaseOrderOtherCharges.map((value, index) => {
                                    return {
                                                item_desc:
                                                value.item_desc,
                                                tax_per: value.tax_per,
                                                amount: value.amount,
                                                tax_amt: value.tax_amt,
                                                total_amt: value.total_amt,
                                            }
                                }),

                            remarks: data.data['purchaseOrder'].remarks,
                            status: data.data['purchaseOrder'].status.toLowerCase(),
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
                            rawMaterials: data.data[
                                'masterData'
                            ].rawMaterials.map((value) => {
                                return {
                                    value: value.id,
                                    label: value.rm_name,
                                    rate: value.rate,
                                }
                            }),
                        })

                        setTimeout(() => {
                            formRef.current.values.purchaseOrderItems.forEach((value, index) => {
                                console.log("Edit Form Data", value);
                                apiPurchaseOrderPoRate(value.item_id, data.data['purchaseOrder'].depot_id).then((data) => {
                                    if (data.status === 200) {
                                        const totalStock = data.data['totalStock'] ? data.data['totalStock'] : 0 
                                        console.log('totalStock', totalStock);
                                        formRef.current.setFieldValue(`purchaseOrderItems[${index}].totalStock`, totalStock);
                                    }
                                }).catch((error) => {
                                    console.log(error)
                                });
                            })
                        }, 200);
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
                apiPurchaseOrderMasterData()
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
                                rawMaterials: data.data[
                                    'masterData'
                                ].rawMaterials.map((value) => {
                                    return {
                                        value: value.id,
                                        label: value.rm_name,
                                        rate: value.rate,
                                    }
                                }),
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
                order_date:
                    purchaseData.order_date === ''
                        ? new Date()
                        : new Date(purchaseData.order_date),
                vendor_id: purchaseData.vendor_id,
                depot_id: purchaseData.depot_id,
                purchaseOrderItems:
                    purchaseData.purchaseOrderItems == []
                        ? []
                        : purchaseData.purchaseOrderItems,
                purchaseOrderOtherCharges:
                    purchaseData.purchaseOrderOtherCharges == []
                        ? []
                        : purchaseData.purchaseOrderOtherCharges,
                remarks: purchaseData.remarks,
            }}
            innerRef={formRef}
            validationSchema={validationSchema}
            onSubmit={(values, actions) => {
                console.log(values)
                // setSubmitting(false)
                if (purchaseId.purchaseid) {
                    // console.log(values)
                    if (actionBtn.approve) {
                        apiPurchaseOrderApprove({
                            values,
                            ...{ id: purchaseId.purchaseid },
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
                                    navigate('/transaction/purchase-order')
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
                        apiPurchaseOrderUpdate({
                            values,
                            ...{ id: purchaseId.purchaseid },
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
                                    navigate('/transaction/purchase-order')
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
                    apiPurchaseOrderPost(values)
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
                                navigate('/transaction/purchase-order')
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
                const purchaseOrderItems = values.purchaseOrderItems
                const purchaseOrderOtherCharges =
                    values.purchaseOrderOtherCharges
                return (
                    <Form autoComplete="off" autoSave="off">
                        <AdaptableCard className="card-shadow mb-2">
                            <h5 className="mb-6">{purchaseId.purchaseid ? 'Edit' : 'Add'}{' '}Purchase Order</h5>
                            {/* <p className="mb-6">{purchaseId.purchaseid ? 'Edit' : 'Add'} basic details of Purchase</p> */}
                            <FormContainer layout="horizontal" size="sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                    <FormItem
                                        asterisk
                                        label="Date"
                                        invalid={errors.order_date && touched.order_date}
                                        errorMessage={errors.order_date}
                                    >
                                        <Field
                                            autoComplete="off"
                                            autoSave="off"
                                            name="order_date"
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
                                                    value={values.order_date}
                                                    onChange={(option) => {
                                                        let date = new Date(option)
                                                        return form.setFieldValue(field.name, `${date.getFullYear()}-${date.getMonth() < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1}-${date.getDate() < 10 ? '0' + date.getDate() : date.getDate() }`)
                                                    }}
                                                    disabled={actionBtn.approve}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Vendor"
                                        invalid={ errors.vendor_id && touched.vendor_id }
                                        errorMessage={errors.vendor_id}
                                    >
                                        <Field name="vendor_id">
                                            {({ field, form }) => (
                                                <Select
                                                    field={field}
                                                    form={form}
                                                    options={masterOption.vendors}
                                                    // onFocus={onFocus}
                                                    isLoading={loading}
                                                    value={masterOption.vendors.filter((option) => option.value === values.vendor_id )}
                                                    onChange={(option) => {return form.setFieldValue(field.name, option?.value)}}
                                                    isDisabled={actionBtn.approve}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <FormItem
                                        asterisk
                                        label="Depot"
                                        invalid={errors.depot_id && touched.depot_id}
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
                                                    // onFocus={onFocus}
                                                    isLoading={loading}
                                                    value={masterOption.depots.filter((option) => option.value === values.depot_id)}
                                                    onChange={(option) => { 
                                                        handleStockCheck(option.value);
                                                        form.setFieldValue(field.name, option?.value);
                                                    }}
                                                    isDisabled={actionBtn.approve}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                </div>
                                {/* <h5>Items Imformation</h5>
                                <p className="mb-6">{purchaseId.purchaseid ? 'Edit' : 'Add'} details of Items for purchase order</p> */}
                                <Table compact className="border mb-6">
                                    <THead>
                                        <Tr>
                                            <Th>Items*</Th>
                                            <Th>Item Description*</Th>
                                            <Th>Qty In Kg*</Th>
                                            <Th>Old PO Rate</Th>
                                            <Th>Available Stock</Th>
                                            <Th>Rate</Th>
                                            <Th>GST Rate</Th>
                                            <Th>Amount</Th>
                                            <Th>GST</Th>
                                            <Th>Total Amount</Th>
                                            <Th className={actionBtn.approve ? 'hidden' : 'visible'}>Action</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        <FieldArray name="purchaseOrderItems">
                                            {({ form, remove, push }) => (
                                                <>
                                                    {
                                                        purchaseOrderItems && purchaseOrderItems.length > 0 ? 
                                                            purchaseOrderItems.map((item_detail, index) => {
                                                                const item_id = fieldFeedback(form, `purchaseOrderItems[${index}].item_id`);
                                                                const item_desc = fieldFeedback(form, `purchaseOrderItems[${index}].item_desc`);
                                                                const qty = fieldFeedback(form, `purchaseOrderItems[${index}].qty`);
                                                                const rate = fieldFeedback(form, `purchaseOrderItems[${index}].rate`);
                                                                return (
                                                                    <Tr key={index}>
                                                                        <Td width="350">
                                                                            <FormItem 
                                                                                className="mb-0 custom-text-left"
                                                                                invalid={item_id.invalid}
                                                                                layout="vertical"
                                                                                errorMessage={item_id.errorMessage}
                                                                            >
                                                                                <Field name={`purchaseOrderItems[${index}].item_id`}>
                                                                                    {({field, form,}) => (
                                                                                        <Select
                                                                                            className="custom-text-left text-left"
                                                                                            field={field}
                                                                                            form={form}
                                                                                            options={masterOption.rawMaterials}
                                                                                            // onFocus={onFocus}
                                                                                            isLoading={loading}
                                                                                            value={masterOption.rawMaterials.filter((option) => option.value === values.purchaseOrderItems[index].item_id)}
                                                                                            onChange={(option, field) => handleItemSelect(option, field, index)}
                                                                                            isDisabled={actionBtn.approve}
                                                                                        />
                                                                                    )}
                                                                                </Field>
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="350">
                                                                            <FormItem 
                                                                                className="mb-0"
                                                                                invalid={item_desc.invalid}
                                                                                layout="vertical"
                                                                                errorMessage={item_desc.errorMessage}
                                                                            >
                                                                                <Field
                                                                                    invalid={item_desc.invalid}
                                                                                    placeholder="Item Description"
                                                                                    name={`purchaseOrderItems[${index}].item_desc`}
                                                                                    type="text"
                                                                                    component={Input}
                                                                                    disabled={actionBtn.approve}
                                                                                />
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="100">
                                                                            <FormItem
                                                                                className="mb-0"
                                                                                invalid={qty.invalid}
                                                                                layout="vertical"
                                                                                errorMessage={qty.errorMessage}
                                                                            >
                                                                                <Field
                                                                                    invalid={qty.invalid}
                                                                                    placeholder="Quantity"
                                                                                    name={`purchaseOrderItems[${index}].qty`}
                                                                                    type="number"
                                                                                    onWheel={(e) => e.target.blur()}
                                                                                    component={Input}
                                                                                    disabled={actionBtn.approve}
                                                                                />
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="100">
                                                                            <p>
                                                                                <NumberFormat 
                                                                                    displayType="text"
                                                                                    prefix={'₹'}
                                                                                    thousandsGroupStyle={'lakh'}
                                                                                    decimalScale={2}
                                                                                    value={purchaseOrderItems[index].old_po_rate}
                                                                                    allowLeadingZeros
                                                                                    thousandSeparator=","
                                                                                />
                                                                            </p>
                                                                        </Td>
                                                                        <Td width="100">
                                                                            <p>
                                                                            {purchaseOrderItems[index].totalStock}
                                                                            </p>
                                                                        </Td>
                                                                        <Td width="120">
                                                                            <FormItem
                                                                                className="mb-0"
                                                                                invalid={rate.invalid}
                                                                                layout="vertical"
                                                                                errorMessage={rate.errorMessage}
                                                                            >
                                                                                <Field
                                                                                    invalid={rate.invalid}
                                                                                    placeholder="Rate"
                                                                                    name={`purchaseOrderItems[${index}].rate`}
                                                                                    type="number"
                                                                                    onWheel={(e) => e.target.blur()}
                                                                                    component={Input}
                                                                                    prefix="₹"
                                                                                    disabled={actionBtn.approve}
                                                                                />
                                                                            </FormItem>
                                                                        </Td>
                                                                        <Td width="100">
                                                                            <p>
                                                                                <NumberFormat
                                                                                    displayType="text"
                                                                                    suffix={'%'}
                                                                                    decimalScale={2}
                                                                                    value={purchaseOrderItems[index].tax_per}
                                                                                    allowLeadingZeros
                                                                                />
                                                                            </p>
                                                                        </Td>
                                                                        <Td width="150">
                                                                            <p>
                                                                                <NumberFormat
                                                                                    displayType="text"
                                                                                    prefix={'₹'}
                                                                                    thousandsGroupStyle={'lakh'}
                                                                                    decimalScale={2}
                                                                                    value={(purchaseOrderItems[index].amount = parseFloat(purchaseOrderItems[index].qty) * parseFloat(purchaseOrderItems[index].rate))}
                                                                                    allowLeadingZeros
                                                                                    thousandSeparator=","
                                                                                />
                                                                            </p>
                                                                        </Td>
                                                                        <Td width="150">
                                                                            <p>
                                                                                <NumberFormat
                                                                                    displayType="text"
                                                                                    prefix={'₹'}
                                                                                    thousandsGroupStyle={'lakh'}
                                                                                    decimalScale={2}
                                                                                    value={(purchaseOrderItems[index].tax_amt = (parseFloat(purchaseOrderItems[index].amount) * parseFloat(purchaseOrderItems[index].tax_per)) / 100)}
                                                                                    allowLeadingZeros
                                                                                    thousandSeparator=","
                                                                                />
                                                                            </p>
                                                                        </Td>
                                                                        <Td width="150">
                                                                            <p>
                                                                                <NumberFormat
                                                                                    displayType="text"
                                                                                    prefix={'₹'}
                                                                                    thousandsGroupStyle={'lakh'}
                                                                                    decimalScale={2}
                                                                                    value={(purchaseOrderItems[index].total_amt = purchaseOrderItems[index].amount + purchaseOrderItems[index].tax_amt)}
                                                                                    allowLeadingZeros
                                                                                    thousandSeparator=","
                                                                                />
                                                                            </p>
                                                                        </Td>
                                                                        <Td
                                                                            width="80"
                                                                            className={actionBtn.approve ? 'hidden' : 'visible'}
                                                                        >
                                                                            <Button
                                                                                shape="circle"
                                                                                size="sm"
                                                                                type="button"
                                                                                icon={<HiMinus />}
                                                                                onClick={() => remove(index)}
                                                                                disabled={index == 0 ? true : false}
                                                                            />
                                                                        </Td>
                                                                    </Tr>
                                                                )
                                                            })
                                                            : null
                                                    }
                                                    <Tr className={actionBtn.approve ? 'hidden' : 'visible'}>
                                                        <Td colSpan="11" className="custom-text-left" >
                                                            <Button
                                                                type="button"
                                                                className="ltr:mr-2 rtl:ml-2"
                                                                onClick={() => {
                                                                    push({
                                                                        item_id: '',
                                                                        item_desc: '',
                                                                        qty: '',
                                                                        old_po_rate: '',
                                                                        rate: '',
                                                                        tax_per: '',
                                                                        amount: '',
                                                                        tax_amt: '',
                                                                        total_amt: '',
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
                                        <FieldArray name="purchaseOrderOtherCharges">
                                            {({ form, remove, push }) => (
                                                <>
                                                    {
                                                        purchaseOrderOtherCharges && purchaseOrderOtherCharges.length > 0 ? 
                                                        purchaseOrderOtherCharges.map((item_detail, index) => {
                                                            const tax_per = fieldFeedback(form, `purchaseOrderOtherCharges[${index}].tax_per`);
                                                            const amount = fieldFeedback(form, `purchaseOrderOtherCharges[${index}].amount`);
                                                            const item_desc = fieldFeedback(form, `purchaseOrderOtherCharges[${index}].item_desc`);
                                                            return (
                                                                <Tr key={index}>
                                                                    {/* <Td colSpan="2" className="custom-text-left">Other Charges</Td> */}
                                                                    <Td colSpan="3">
                                                                        <FormItem
                                                                            className="mb-0"
                                                                            invalid={item_desc.invalid}
                                                                            layout="vertical"
                                                                            errorMessage={item_desc.errorMessage}
                                                                        >
                                                                            <Field
                                                                                invalid={item_desc.invalid}
                                                                                placeholder="Other Description"
                                                                                name={`purchaseOrderOtherCharges[${index}].item_desc`}
                                                                                type="text"
                                                                                component={Input}
                                                                                disabled={actionBtn.approve}
                                                                            />
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td></Td>
                                                                    <Td></Td>
                                                                    <Td></Td>
                                                                    <Td>
                                                                        <FormItem
                                                                            className="mb-0"
                                                                            invalid={tax_per.invalid}
                                                                            layout="vertical"
                                                                            errorMessage={tax_per.errorMessage}
                                                                        >
                                                                            <Field
                                                                                invalid={tax_per.invalid}
                                                                                placeholder="GST Rate"
                                                                                name={`purchaseOrderOtherCharges[${index}].tax_per`}
                                                                                type="number"
                                                                                onWheel={(e) => e.target.blur()}
                                                                                component={Input}
                                                                                suffix="%"
                                                                                disabled={actionBtn.approve}
                                                                            />
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td>
                                                                        <FormItem
                                                                            className="mb-0"
                                                                            invalid={amount.invalid}
                                                                            layout="vertical"
                                                                            errorMessage={amount.errorMessage}
                                                                        >
                                                                            <Field
                                                                                invalid={amount.invalid}
                                                                                placeholder="Amount"
                                                                                name={`purchaseOrderOtherCharges[${index}].amount`}
                                                                                type="number"
                                                                                onWheel={(e) => e.target.blur()}
                                                                                component={Input}
                                                                                prefix="₹"
                                                                                disabled={actionBtn.approve}
                                                                            />
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td>
                                                                        <p>
                                                                            <NumberFormat
                                                                                displayType="text"
                                                                                prefix={
                                                                                    '₹'
                                                                                }
                                                                                thousandsGroupStyle={
                                                                                    'lakh'
                                                                                }
                                                                                decimalScale={
                                                                                    2
                                                                                }
                                                                                value={(purchaseOrderOtherCharges[index].tax_amt = (parseFloat(purchaseOrderOtherCharges[index].amount) * parseFloat(purchaseOrderOtherCharges[index].tax_per)) / 100)}
                                                                                allowLeadingZeros
                                                                                thousandSeparator=","
                                                                            />
                                                                        </p>
                                                                    </Td>
                                                                    <Td>
                                                                        <p>
                                                                            <NumberFormat
                                                                                displayType="text"
                                                                                prefix={'₹'}
                                                                                thousandsGroupStyle={'lakh'}
                                                                                decimalScale={2}
                                                                                value={(purchaseOrderOtherCharges[index].total_amt = parseFloat(purchaseOrderOtherCharges[index].tax_amt) + parseFloat(purchaseOrderOtherCharges[index].amount))}
                                                                                allowLeadingZeros
                                                                                thousandSeparator=","
                                                                            />
                                                                        </p>
                                                                    </Td>
                                                                    <Td className={actionBtn.approve ? 'hidden' : 'visible'}>
                                                                        <Button
                                                                            shape="circle"
                                                                            size="sm"
                                                                            type="button"
                                                                            icon={<HiMinus />}
                                                                            onClick={() =>remove(index)}
                                                                        />
                                                                    </Td>
                                                                </Tr>
                                                            )
                                                        })
                                                        : null
                                                    }
                                                    <Tr className={actionBtn.approve ? 'hidden' : 'visible'}>
                                                        <Td colSpan="11" className="custom-text-left" >
                                                            <Button
                                                                type="button"
                                                                className="ltr:mr-2 rtl:ml-2"
                                                                onClick={() => {
                                                                    push({
                                                                        item_desc: '',
                                                                        tax_per: '',
                                                                        amount: '',
                                                                        tax_amt: '',
                                                                        total_amt: '',
                                                                    })
                                                                }}
                                                            >
                                                                Add Other Charges
                                                            </Button>
                                                        </Td>
                                                    </Tr>
                                                    <Tr>
                                                        <Td colSpan="6"></Td>
                                                        <Td colSpan="3">Total Amount</Td>
                                                        <Td>
                                                            <NumberFormat
                                                                displayType="text"
                                                                prefix={'₹'}
                                                                thousandsGroupStyle={'lakh'}
                                                                decimalScale={2}
                                                                value={handleTotal(values)}
                                                                allowLeadingZeros
                                                                thousandSeparator=","
                                                            />
                                                        </Td>
                                                        <Td className={actionBtn.approve ? 'hidden' : 'visible'}></Td>
                                                    </Tr>
                                                    <Tr>
                                                        <Td colSpan="6"></Td>
                                                        <Td colSpan="3">
                                                            Round Off Amount
                                                        </Td>
                                                        <Td>
                                                            <NumberFormat
                                                                displayType="text"
                                                                prefix={'₹'}
                                                                thousandsGroupStyle={
                                                                    'lakh'
                                                                }
                                                                decimalScale={2}
                                                                value={roundOffTotoal(
                                                                    values
                                                                )}
                                                                allowLeadingZeros
                                                                thousandSeparator=","
                                                            />
                                                        </Td>
                                                        <Td className={actionBtn.approve ? 'hidden' : 'visible'}></Td>
                                                    </Tr>
                                                    <Tr>
                                                        <Td colSpan="6"></Td>
                                                        <Td colSpan="3">Final Amount</Td>
                                                        <Td>
                                                            <NumberFormat
                                                                displayType="text"
                                                                prefix={'₹'}
                                                                thousandsGroupStyle={'lakh'}
                                                                decimalScale={2}
                                                                value={finalAmount(values)}
                                                                allowLeadingZeros
                                                                thousandSeparator=","
                                                            />
                                                        </Td>
                                                        <Td className={ actionBtn.approve ? 'hidden' : 'visible'}></Td>
                                                    </Tr>
                                                </>
                                            )}
                                        </FieldArray>
                                    </TBody>
                                </Table>

                                {/* <h5>Other Information</h5>
                                <p className="mb-6">{purchaseId.purchaseid ? 'Edit' : 'Add'} final Purchase Order remark</p> */}

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
                                    actionBtn.approve && purchaseData.status === 'deleted'?
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
                                    onClick={() => rejectPurchaseOrder()}
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
                                    onClick={() => deletePurchaseOrder()}
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
                                        navigate('/transaction/purchase-order')
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

export default AddEditPurchaseOrder
