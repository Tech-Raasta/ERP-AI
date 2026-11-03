import React, { useEffect, useState, useRef } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import DatePicker from 'components/ui/DatePicker'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import Checkbox from 'components/ui/Checkbox'
import { Field, Form, FieldArray, Formik, getIn } from 'formik'
import { useNavigate, useParams } from 'react-router-dom'
import * as Yup from 'yup'
import Table from 'components/ui/Table'
import { HiMinus } from 'react-icons/hi'
import Upload from 'components/ui/Upload'
import Dialog from 'components/ui/Dialog'
import '../PurchaseOrder/AddEditPurchaseOrder.css'
import NumberFormat from 'react-number-format'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiRawMaterialQtyInGetSingle } from 'services/RawMaterialQtyInService'
import Loading from 'components/shared/Loading'
import {
    apiGRNApprove,
    apiGRNDelete,
    apiGRNReject,
    apiGRNUpdate,
} from 'services/GRNService'
import './GRN.css'

import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import ViewImages from '../FinanceVoucher/ViewImages'
import DeleteDocument from '../RawMaterialQtyIn/DeleteDocument'
import appConfig from 'configs/app.config'

const { Tr, Th, Td, THead, TBody } = Table

const validationSchema = Yup.object().shape({
    invoice_date: Yup.string().required('Invoice Date Is Required').nullable(),
    invoice_no: Yup.string().required('Invoice Number Is Required').nullable(),
    vendor_id: Yup.string().required('Vendor Is Required'),
    depot_id: Yup.string().required('Depot Is Required'),
    purchase_order_id: Yup.string().required('PO Is Required'),
    grn_qty_date: Yup.string().required('GRN Qty Date Is Required').nullable(),
    payment_due_date: Yup.string()
        .required('Payment Due Date Is Required')
        .nullable(),
    rawMaterialInItems: Yup.array().of(
        Yup.object()
            .shape({
                // quantity: Yup.string().required('Quantity Is Required'),
                rate: Yup.string().required(' '),
            })
            .required('Details is Required')
    ),
    rawMaterialInOtherCharges: Yup.array().of(
        Yup.object().shape({
            item_desc: Yup.string().required(' '),
            amount: Yup.number().required(' ').moreThan(0, ' '),
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

const MAX_UPLOAD = 10

const beforeUpload = (file, fileList) => {
    let valid = true

    const allowedFileType = ['image/jpeg', 'image/png', 'application/pdf']
    const MAX_FILE_SIZE = 2000000

    if (fileList.length >= MAX_UPLOAD) {
        return `You can only upload ${MAX_UPLOAD} file(s)`
    }

    if (file) {
        for (const f of file) {
            if (!allowedFileType.includes(f.type)) {
                valid = 'Please upload a .jpeg or .png file!'
            }

            if (f.size >= MAX_FILE_SIZE) {
                valid = 'Upload image cannot more then 500kb!'
            }
        }
    }

    return valid
}

const AddEditGoodsReceivedNote = () => {
    const [grnData, setGrnData] = useState({
        invoice_date: '', //YYYY-MM-DD
        invoice_no: '',
        vendor_id: '',
        depot_id: '',
        purchase_order_id: '',
        gate_pass_no: '',
        doc_document: [],
        document_name: [],
        grn_qty_date: '',
        partial_po: '',
        payment_due_date: '',
        pay_immediately: true,
        rawMaterialInItems: [],
        rawMaterialInOtherCharges: [],
        po_amt: 0,
        po_tax_amt: 0,
        po_total_amt: 0,
        amt: 0,
        tax_amt: 0,
        total_amt: 0,
        tds_per: 0,
        tds_amt: 0,
        round_off_amt: 0,
        final_amount: 0,
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
        purchaseOrders: [],
        rawMaterials: [],
    })
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const grnId = useParams()
    const formRef = useRef()
    const [isOpenDoc, setIsOpenDoc] = useState(false)

    const [isDeleteOpen, setIsDeleteOpen] = useState(false)

    const openDoc = () => {
        setIsOpenDoc(true)
    }

    const closeDoc = (e) => {
        console.log('onDialogClose', e)
        setIsOpenDoc(false)
    }

    const closeOpenedDoc = (childData)=>{
        if(childData.hasOwnProperty('documents')){
            setGrnData(prev=>({...prev, document_name: childData.documents != null ? childData.documents.split(' | ') : []}))
        }
        setIsDeleteOpen(childData.isOpen)
    }

    const deleteGRN = async () => {
        console.log('Delete GRN')
        await apiGRNDelete({
            values: formRef.current.values,
            ...{ id: grnId.grnid },
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
                    navigate('/transaction/goods-received-note')
                } else if (data.response.status === 422) {
                    let errorData = data.response['data']['error']['errors']
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
                } else if (data.response.status === 500) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {data.response.data['message']}
                        </Notification>
                    )
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

    const rejectGRN = async () => {
        console.log('Reject GRN')
        await apiGRNReject({
            values: formRef.current.values,
            ...{ id: grnId.grnid },
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
                    navigate('/transaction/goods-received-note')
                } else if (data.response.status === 422) {
                    let errorData = data.response['data']['error']['errors']
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
                } else if (data.response.status === 500) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {data.response.data['message']}
                        </Notification>
                    )
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

    console.log('AddEditGoodsReceivedNote.js Loading....')

    useEffect(() => {
        setLoading(true)
        const fetchData = async () => {
            await apiRawMaterialQtyInGetSingle(grnId.grnid)
                .then((data) => {
                    console.log(data)
                    if (data.status === 200) {
                        const {
                            purchaseOrders,
                            depots,
                            vendors,
                            rawMaterials,
                        } = data.data.masterData
                        const pData = data.data.rawMaterialIn
                        const puData = data.data.purchaseOrder
                        // const calcData = [
                        //     ...data.data.rawMaterialIn.rawMaterialInItems,
                        // ]
                        setActionBtn({
                            update: data.data.action['update'],
                            delete: data.data.action['delete'],
                            approve: data.data.action['approve'],
                        })
                        setMasterOption({
                            purchaseOrders: purchaseOrders.map((data) => {
                                return {
                                    value: data.id,
                                    label: data.po_no,
                                }
                            }),
                            depots: depots.map((data) => {
                                return {
                                    value: data.id,
                                    label: data.depot_name,
                                    state: data.state,
                                }
                            }),
                            vendors: vendors.map((data) => {
                                return {
                                    value: data.id,
                                    label: data.vendor_name,
                                    state: data.state,
                                }
                            }),
                            rawMaterials: rawMaterials.map((data) => {
                                return {
                                    value: data.id,
                                    label: data.rm_name,
                                    country_id: data.rate,
                                }
                            }),
                        })

                        setGrnData({
                            date_of_receipt: new Date(pData.date_of_receipt),
                            vendor_id:
                                pData.vendor_id != null ? pData.vendor_id : '',
                            purchase_order_id:
                                pData.purchase_order_id != null
                                    ? pData.purchase_order_id
                                    : '',
                            invoice_no:
                                pData.invoice_no != null
                                    ? pData.invoice_no
                                    : '',
                            invoice_date:
                                pData.invoice_date != null
                                    ? new Date(pData.invoice_date)
                                    : '',
                            depot_id:
                                pData.depot_id != null ? pData.depot_id : '',
                            gate_pass_no:
                                pData.gate_pass_no != null
                                    ? pData.gate_pass_no
                                    : '',
                            doc_document: [],
                            document_name:
                                pData.document_name != null
                                    ? pData.document_name.split(' | ')
                                    : [],
                            grn_qty_date: new Date(pData.date_of_receipt),
                            partial_po:
                                pData.partial_po != null &&
                                pData.partial_po == 1
                                    ? 1
                                    : 0,
                            payment_due_date: new Date(pData.payment_due_date),
                            pay_immediately:
                                pData.pay_immediately == null ||
                                pData.pay_immediately == 0
                                    ? false
                                    : true,
                            rawMaterialInItems: pData.rawMaterialInItems.map(
                                (value) => {
                                    return {
                                        id: value.id,
                                        raw_material_name:
                                            value.raw_material['rm_name'] !=
                                            null
                                                ? value.raw_material['rm_name']
                                                : '',
                                        item_desc:
                                            value.item_desc != null
                                                ? value.item_desc
                                                : '',
                                        po_qty:
                                            value.po_quantity != null
                                                ? value.po_quantity
                                                : 0,
                                        po_rate:
                                            value.po_rate != null
                                                ? value.po_rate
                                                : 0,
                                        po_amount:
                                            value.po_amount != null
                                                ? value.po_amount
                                                : 0,
                                        po_gst:
                                            value.po_tax_amt != null
                                                ? value.po_tax_amt
                                                : 0,
                                        po_total_amount:
                                            value.po_total_amt != null
                                                ? value.po_total_amt
                                                : 0,
                                        discount:
                                            value.discount == null
                                                ? 0
                                                : value.discount,
                                        rin_qty:
                                            value.qty != null ? value.qty : 0,
                                        rate:
                                            value.rate != null ? value.rate : 0,
                                        rin_gst_rate:
                                            value.tax_per != null
                                                ? value.tax_per
                                                : 0,
                                        rin_amount:
                                            value.amount != null
                                                ? value.amount
                                                : 0,
                                        rin_gst:
                                            value.tax_amt != null
                                                ? value.tax_amt
                                                : 0,
                                        rin_total_amount:
                                            value.total_amt != null
                                                ? value.total_amt
                                                : 0,
                                    }
                                }
                            ),
                            rawMaterialInOtherCharges:
                                pData.rawMaterialInOtherCharges.map((value) => {
                                    return {
                                        id: value.id,
                                        po_item_id:
                                            value.po_item_id != null
                                                ? value.po_item_id
                                                : '',
                                        item_desc:
                                            value.item_desc != null
                                                ? value.item_desc
                                                : '',
                                        po_amount:
                                            value.po_amount != null
                                                ? value.po_amount
                                                : 0,
                                        po_tax_amt:
                                            value.po_tax_amt != null
                                                ? value.po_tax_amt
                                                : 0,
                                        po_total_amt:
                                            value.po_total_amt != null
                                                ? value.po_total_amt
                                                : 0,
                                        tax_per:
                                            value.tax_per != null
                                                ? value.tax_per
                                                : 0,
                                        amount:
                                            value.amount != null
                                                ? value.amount
                                                : 0,
                                        gst:
                                            value.tax_amt != null
                                                ? value.tax_amt
                                                : 0,
                                        total_amount:
                                            value.total_amt != null
                                                ? value.total_amt
                                                : 0,
                                    }
                                }),
                            po_amt: puData.amount != null ? puData.amount : 0,
                            po_tax_amt:
                                puData.tax_amount != null
                                    ? puData.tax_amount
                                    : 0,
                            po_total_amt:
                                puData.total_amount != null
                                    ? puData.total_amount
                                    : 0,
                            amt: pData.amt != null ? pData.amt : 0,
                            tax_amt: pData.tax_amt != null ? pData.tax_amt : 0,
                            total_amt:
                                pData.total_amt != null ? pData.total_amt : 0,
                            tds_per: pData.tds_per != null ? pData.tds_per : 0,
                            tds_amt: pData.tds_amt != null ? pData.tds_amt : 0,
                            round_off_amt:
                                pData.round_off_amt != null
                                    ? pData.round_off_amt
                                    : 0,
                            final_amount:
                                pData.final_amount != null
                                    ? pData.final_amount
                                    : 0,
                            remarks: pData.remarks != null ? pData.remarks : '',
                        })
                        // formRef.current.setFieldValue('pratial_po', pData.partial_po == 1 ? 'yes' : 'no')
                        console.log(formRef.current)
                    } else if (data.response.status === 422) {
                        console.log(data.response.status)
                    }
                    setLoading(false)
                })
                .catch((error) => {
                    console.log(error)
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

        fetchData()
    }, [])

    const roundOffTotal = (tds_per) => {
        const amount = formRef.current.values['amt']
        const tds_amount = (parseFloat(amount) * parseFloat(tds_per)) / 100
        const total_amount = parseFloat(formRef.current.values.total_amt)
        formRef.current.setFieldValue('tds_amt', tds_amount)
        const roundOff =
            Math.round(
                (Math.round(total_amount - tds_amount) -
                    Math.round((total_amount - tds_amount) * 100) / 100) *
                    100
            ) / 100
        const net_amount = total_amount - tds_amount + roundOff
        formRef.current.setFieldValue('round_off_amt', roundOff)
        formRef.current.setFieldValue('final_amount', Math.round(net_amount))
    }

    const calcTDSTotal = (e) => {
        const tds_per = parseFloat(e.target.value)
        setTimeout(() => {
            roundOffTotal(isNaN(tds_per) ? 0 : tds_per)
        }, 100)
    }

    const calcRound = (e) => {
        const roundOff = parseFloat(e.target.value)
        const tds_amount = parseFloat(
            formRef.current.values.tds_amt != '' ||
                !isNaN(formRef.current.values.tds_amt)
                ? formRef.current.values.tds_amt
                : 0
        )
        const net_amount =
            formRef.current.values.total_amt -
            tds_amount +
            (isNaN(roundOff) ? 0 : roundOff)
        formRef.current.setFieldValue('final_amount', Math.round(net_amount))
    }

    const calcTotalOther = (e, index) => {
        let tax_per =
            e.target.name == `rawMaterialInOtherCharges[${index}].gst`
                ? e.target.value != ''
                    ? e.target.value
                    : 0
                : formRef.current.values.rawMaterialInOtherCharges[index]
                      .tax_per
        let amount =
            e.target.name == `rawMaterialInOtherCharges[${index}].amount`
                ? e.target.value != ''
                    ? e.target.value
                    : 0
                : formRef.current.values.rawMaterialInOtherCharges[index].amount
        let tax_amt = 0
        let total_amt = 0

        tax_amt = (parseFloat(amount) * parseFloat(tax_per)) / 100
        total_amt = parseFloat(tax_amt) + parseFloat(amount)
        // console.log(tax_amt, total_amt)
        console.log(tax_per, amount)
        formRef.current.setFieldValue(
            `rawMaterialInOtherCharges[${index}].gst`,
            isNaN(parseFloat(tax_amt)) ? 0 : parseFloat(tax_amt)
        )
        formRef.current.setFieldValue(
            `rawMaterialInOtherCharges[${index}].total_amount`,
            isNaN(parseFloat(total_amt)) ? 0 : parseFloat(total_amt)
        )
        setTimeout(() => {
            calculateAllTotal(formRef.current.values)
        }, 100)
    }

    const calculateAllTotal = (rawMaterial) => {
        let allAmount = {
            amt: 0,
            tax_amt: 0,
            total_amt: 0,
        }
        rawMaterial.rawMaterialInItems.forEach((value) => {
            console.log(value)
            allAmount.amt += parseFloat(value.rin_amount)
            allAmount.tax_amt += parseFloat(value.rin_gst)
            allAmount.total_amt += parseFloat(value.rin_total_amount)
        })
        if (rawMaterial.rawMaterialInOtherCharges.length > 0) {
            rawMaterial.rawMaterialInOtherCharges.forEach((value) => {
                console.log(value)
                allAmount.amt += parseFloat(value.amount)
                allAmount.tax_amt += parseFloat(value.gst)
                allAmount.total_amt += parseFloat(value.total_amount)
            })
        }
        formRef.current.setFieldValue(
            'amt',
            !isNaN(allAmount.amt) ? allAmount.amt : 0
        )
        formRef.current.setFieldValue(
            'tax_amt',
            !isNaN(allAmount.tax_amt) ? allAmount.tax_amt : 0
        )
        formRef.current.setFieldValue(
            'total_amt',
            !isNaN(allAmount.total_amt) ? allAmount.total_amt : 0
        )
        const tds_per = parseFloat(
            formRef.current.values['tds_per'] != null
                ? formRef.current.values['tds_per']
                : 0
        )
        setTimeout(() => {
            roundOffTotal(tds_per)
        }, 100)
    }

    const calcTotal = (e, index) => {
        let val = parseFloat(e.target.value)
        let discount_rate = 0
        let new_rate = 0
        let total = 0
        discount_rate =
            (parseFloat(
                e.target.name == `rawMaterialInItems[${index}].rate`
                    ? !isNaN(val)
                        ? val
                        : 0
                    : formRef.current.values.rawMaterialInItems[index].rate
            ) *
                parseFloat(
                    e.target.name == `rawMaterialInItems[${index}].discount`
                        ? !isNaN(val)
                            ? val
                            : 0
                        : formRef.current.values.rawMaterialInItems[index]
                              .discount
                )) /
            100
        new_rate =
            parseFloat(
                e.target.name == `rawMaterialInItems[${index}].rate`
                    ? !isNaN(val)
                        ? val
                        : 0
                    : formRef.current.values.rawMaterialInItems[index].rate
            ) - parseFloat(discount_rate)
        total =
            parseFloat(
                formRef.current.values.rawMaterialInItems[index].rin_qty
            ) * parseFloat(new_rate)
        formRef.current.setFieldValue(
            `rawMaterialInItems[${index}].rin_amount`,
            total != '' || total != null ? total : 0
        )
        let gst =
            (total *
                parseFloat(
                    formRef.current.values.rawMaterialInItems[index]
                        .rin_gst_rate
                )) /
            100
        let totalAmt = total + gst

        formRef.current.setFieldValue(
            `rawMaterialInItems[${index}].rin_gst`,
            gst != '' || gst != null ? gst : 0
        )
        formRef.current.setFieldValue(
            `rawMaterialInItems[${index}].rin_total_amount`,
            totalAmt != '' || totalAmt != null ? totalAmt : 0
        )
        setTimeout(() => {
            calculateAllTotal(formRef.current.values)
        }, 100)
    }

    const changeDiscount = (e, index) => {
        // console.log(index, e.target.name, e.target.value)
        formRef.current.setFieldValue(e.target.name, e.target.value)
        calcTotal(e, index)
    }
    const changeRate = (e, index) => {
        // console.log(index, e.target.name, e.target.value)
        formRef.current.setFieldValue(e.target.name, e.target.value)
        calcTotal(e, index)
        // console.log(formRef);
    }

    const changeOtherRate = (e, index) => {
        // console.log(index, e.target.name, e.target.value)
        formRef.current.setFieldValue(e.target.name, e.target.value)
        setTimeout(() => {
            calcTotalOther(e, index)
        }, 100)
    }
    const changeOtherAmount = (e, index) => {
        // console.log(index, e.target.name, e.target.value)
        formRef.current.setFieldValue(e.target.name, e.target.value)
        setTimeout(() => {
            calcTotalOther(e, index)
        }, 100)
    }

    const changeRoundOffTotal = (e) => {
        console.log(e.target.name, e.target.value)
        formRef.current.setFieldValue(e.target.name, e.target.value)
        calcRound(e)
    }

    const changeTDSTotal = (e) => {
        console.log(e.target.name, e.target.value)
        formRef.current.setFieldValue(e.target.name, e.target.value)
        calcTDSTotal(e)
    }

    // const download = async (url) => {
    //     saveAs(
    //         'https://erp.eatanytime.in/assets/uploads/raw_material_in/' + url,
    //         url
    //     )
    // }

    const download = async (urls) => {
        const zip = new JSZip()
        if (urls.length > 1) {
            const promises = urls.map(async (value) => {
                const res = await fetch(
                    `${appConfig.uploadUrl}raw_material_in/${value}`
                )
                const blob = await res.blob()
                return { value, blob }
            })

            const res = await Promise.all(promises)

            console.log(res)

            res.forEach((data) => {
                zip.file(data.value, data.blob)
            })

            zip.generateAsync({ type: 'blob' }).then(function (content) {
                saveAs(content, 'invoice-processing-files.zip')
            })
        } else {
            urls.forEach((value, index) => {
                saveAs(
                    `${appConfig.uploadUrl}raw_material_in/${value}`,
                    value
                )
            })
        }
    }

    const changePartial = (e) => {
        console.log(e.target)
        formRef.current.setFieldValue(e.target.name, e.target.value)
    }

    return (
        <>
            <Formik
                enableReinitialize={true}
                initialValues={{
                    invoice_date: grnData.invoice_date,
                    vendor_id: grnData.vendor_id,
                    invoice_no: grnData.invoice_no,
                    depot_id: grnData.depot_id,
                    purchase_order_id: grnData.purchase_order_id,
                    gate_pass_no: grnData.gate_pass_no,
                    doc_document: [],
                    document_name: grnData.document_name,
                    grn_qty_date: grnData.grn_qty_date,
                    partial_po: grnData.partial_po,
                    payment_due_date: grnData.payment_due_date,
                    pay_immediately: grnData.pay_immediately,
                    rawMaterialInItems: grnData.rawMaterialInItems,
                    rawMaterialInOtherCharges:
                        grnData.rawMaterialInOtherCharges,
                    po_amt: grnData.po_amt,
                    po_tax_amt: grnData.po_tax_amt,
                    po_total_amt: grnData.po_total_amt,
                    amt:
                        grnData.amt == '' || grnData.amt == null
                            ? 0
                            : grnData.amt,
                    tax_amt:
                        grnData.tax_amt == '' || grnData.tax_amt == null
                            ? 0
                            : grnData.tax_amt,
                    total_amt:
                        grnData.total_amt == '' || grnData.total_amt == null
                            ? 0
                            : grnData.total_amt,
                    tds_per:
                        grnData.tds_per == '' || grnData.tds_per == null
                            ? 0
                            : grnData.tds_per,
                    tds_amt:
                        grnData.tds_amt == '' || grnData.tds_amt == null
                            ? 0
                            : grnData.tds_amt,
                    round_off_amt:
                        grnData.round_off_amt == '' ||
                        grnData.round_off_amt == null
                            ? 0
                            : grnData.round_off_amt,
                    final_amount:
                        grnData.final_amount == '' ||
                        grnData.final_amount == null
                            ? 0
                            : grnData.final_amount,
                    remarks: grnData.remarks,
                }}
                innerRef={formRef}
                validationSchema={validationSchema}
                onSubmit={async (values, actions) => {
                    const formData = new FormData()
                    for (const i in values) {
                        // console.log(i)
                        if (i === 'rawMaterialInItems') {
                            formData.append(i, JSON.stringify(values[i]))
                        } else if (i === 'rawMaterialInOtherCharges') {
                            formData.append(i, JSON.stringify(values[i]))
                        } else if (i === 'doc_document') {
                            for (const val of values[i]) {
                                formData.append('doc_document', val)
                            }
                        } else {
                            formData.append(i, values[i])
                        }
                    }
                    // formData.append('partial_po', false)

                    // console.log(formData);

                    if (grnId.grnid) {
                        // console.log(values)
                        if (actionBtn.approve) {
                            await apiGRNApprove({
                                values: formData,
                                ...{ id: grnId.grnid },
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
                                        navigate(
                                            '/transaction/goods-received-note'
                                        )
                                    } else if (data.response.status === 422) {
                                        let errorData =
                                            data.response['data']['error'][
                                                'errors'
                                            ]
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
                                                    {
                                                        errorData[errMsg][
                                                            'message'
                                                        ]
                                                    }
                                                </Notification>
                                            )
                                        }
                                    } else if (data.response.status === 500) {
                                        toast.push(
                                            <Notification
                                                title="Error"
                                                type="danger"
                                                closable
                                            >
                                                {data.response.data['message']}
                                            </Notification>
                                        )
                                    }
                                })
                                .catch((error) => {
                                    let errorData =
                                        error.response['data']['error'][
                                            'errors'
                                        ]
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
                                                    {
                                                        errorData[errMsg][
                                                            'message'
                                                        ]
                                                    }
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
                            await apiGRNUpdate({
                                values: formData,
                                ...{ id: grnId.grnid },
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
                                        navigate(
                                            '/transaction/goods-received-note'
                                        )
                                    } else if (data.response.status === 422) {
                                        let errorData =
                                            data.response['data']['error'][
                                                'errors'
                                            ]
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
                                                    {
                                                        errorData[errMsg][
                                                            'message'
                                                        ]
                                                    }
                                                </Notification>
                                            )
                                        }
                                    } else if (data.response.status === 500) {
                                        toast.push(
                                            <Notification
                                                title="Error"
                                                type="danger"
                                                closable
                                            >
                                                {data.response.data['message']}
                                            </Notification>
                                        )
                                    }
                                })
                                .catch((error) => {
                                    let errorData =
                                        error.response['data']['error'][
                                            'errors'
                                        ]
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
                                                    {
                                                        errorData[errMsg][
                                                            'message'
                                                        ]
                                                    }
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
                    }
                    // setTimeout(() => {
                    //     alert(JSON.stringify(values, null, 2))
                    //     resetForm()
                    // }, 400)
                }}
            >
                {({ values, touched, errors, resetForm, isSubmitting }) => {
                    const rawMaterialInItems = values.rawMaterialInItems
                    const rawMaterialInOtherCharges =
                        values.rawMaterialInOtherCharges
                    return (
                        <Form autoComplete="off" autoSave="off">
                            <AdaptableCard className="card-shadow mb-4">
                                <h5 className="mb-6">
                                    {' '}
                                    {grnId.grnid ? 'Edit' : 'Add'} Invoice
                                    Processing
                                </h5>
                                {/* <p className="mb-6">{grnId.grnid ? 'Edit' : 'Add'} basic details of Purchase</p> */}
                                <Loading loading={loading}></Loading>
                                <FormContainer
                                    layout="horizontal"
                                    size="sm"
                                    className={loading ? 'hidden' : 'visible'}
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-3">
                                        <FormItem
                                            asterisk
                                            label="Invoice Date"
                                            invalid={
                                                errors.invoice_date &&
                                                touched.invoice_date
                                            }
                                            errorMessage={errors.invoice_date}
                                        >
                                            <Field
                                                autoComplete="off"
                                                name="invoice_date"
                                            >
                                                {({ field, form }) => (
                                                    <DatePicker
                                                        inputFormat="DD-MM-YYYY"
                                                        // inputtable
                                                        // inputtableBlurClose={false}
                                                        field={field}
                                                        placeholder="Invoice Date"
                                                        form={form}
                                                        value={
                                                            values.invoice_date
                                                        }
                                                        onChange={(option) => {
                                                            let date = new Date(
                                                                option
                                                            )
                                                            return form.setFieldValue(
                                                                field.name,
                                                                date.toDateString()
                                                            )
                                                        }}
                                                        disabled={
                                                            actionBtn.approve
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            label="Invoice No."
                                            asterisk
                                            invalid={
                                                errors.invoice_no &&
                                                touched.invoice_no
                                            }
                                            errorMessage={errors.invoice_no}
                                        >
                                            <Field
                                                type="text"
                                                name="invoice_no"
                                                placeholder="Invoice No."
                                                component={Input}
                                                disabled={actionBtn.approve}
                                            />
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="GRN Qty Date"
                                            invalid={
                                                errors.grn_qty_date &&
                                                touched.grn_qty_date
                                            }
                                            errorMessage={errors.grn_qty_date}
                                        >
                                            <Field
                                                autoComplete="off"
                                                name="grn_qty_date"
                                            >
                                                {({ field, form }) => (
                                                    <DatePicker
                                                        inputFormat="DD-MM-YYYY"
                                                        // inputtable
                                                        // inputtableBlurClose={false}
                                                        field={field}
                                                        placeholder="GRN Qty Date"
                                                        form={form}
                                                        value={
                                                            values.grn_qty_date
                                                        }
                                                        onChange={(option) => {
                                                            return form.setFieldValue(
                                                                field.name,
                                                                option
                                                            )
                                                        }}
                                                        disabled={
                                                            true ||
                                                            actionBtn.approve
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-3">
                                        <FormItem
                                            asterisk
                                            label="Vendor"
                                            invalid={
                                                errors.vendor_id &&
                                                touched.vendor_id
                                            }
                                            errorMessage={errors.vendor_id}
                                        >
                                            <Field name="vendor_id">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={
                                                            masterOption.vendors
                                                        }
                                                        // onFocus={onFocus}
                                                        isLoading={loading}
                                                        value={masterOption.vendors.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.vendor_id
                                                        )}
                                                        onChange={(option) => {
                                                            return form.setFieldValue(
                                                                field.name,
                                                                option?.value
                                                            )
                                                        }}
                                                        isDisabled={true}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="PO"
                                            invalid={
                                                errors.purchase_order_id &&
                                                touched.purchase_order_id
                                            }
                                            errorMessage={
                                                errors.purchase_order_id
                                            }
                                        >
                                            <Field name="purchase_order_id">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={
                                                            masterOption.purchaseOrders
                                                        }
                                                        // onFocus={onFocus}
                                                        isLoading={loading}
                                                        value={masterOption.purchaseOrders.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.purchase_order_id
                                                        )}
                                                        onChange={(option) => {
                                                            return form.setFieldValue(
                                                                field.name,
                                                                option?.value
                                                            )
                                                        }}
                                                        isDisabled={true}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Depot"
                                            invalid={
                                                errors.depot_id &&
                                                touched.depot_id
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
                                                        // onFocus={onFocus}
                                                        isLoading={loading}
                                                        value={masterOption.depots.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.depot_id
                                                        )}
                                                        onChange={(option) => {
                                                            return form.setFieldValue(
                                                                field.name,
                                                                option?.value
                                                            )
                                                        }}
                                                        isDisabled={true}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-3">
                                        <div>
                                            <FormItem
                                                label="Gate Pass No."
                                                invalid={
                                                    errors.gate_pass_no &&
                                                    touched.gate_pass_no
                                                }
                                                errorMessage={
                                                    errors.gate_pass_no
                                                }
                                            >
                                                <Field
                                                    type="text"
                                                    name="gate_pass_no"
                                                    placeholder="Gate Pass No."
                                                    component={Input}
                                                    disabled={actionBtn.approve}
                                                />
                                            </FormItem>
                                        </div>
                                        <div>
                                            <FormItem
                                                asterisk
                                                label="Partial PO"
                                                invalid={
                                                    errors.partial_po &&
                                                    touched.partial_po
                                                }
                                                errorMessage={errors.partial_po}
                                            >
                                                <div className="flex gap-3">
                                                    <label className="inline-flex gap-1">
                                                        <input
                                                            type="radio"
                                                            className="radio text-amber-600"
                                                            name="partial_po"
                                                            value={1}
                                                            disabled={
                                                                actionBtn.approve
                                                            }
                                                            checked={
                                                                values.partial_po ==
                                                                1
                                                                    ? true
                                                                    : false
                                                            }
                                                            onChange={(e) =>
                                                                changePartial(e)
                                                            }
                                                        />
                                                        Yes
                                                    </label>
                                                    <label className="inline-flex gap-1">
                                                        <input
                                                            type="radio"
                                                            className="radio text-amber-600"
                                                            name="partial_po"
                                                            value={0}
                                                            checked={
                                                                values.partial_po ==
                                                                0
                                                                    ? true
                                                                    : false
                                                            }
                                                            onChange={(e) =>
                                                                changePartial(e)
                                                            }
                                                            disabled={
                                                                actionBtn.approve
                                                            }
                                                        />
                                                        No
                                                    </label>
                                                </div>
                                            </FormItem>
                                        </div>
                                        <div>
                                            <FormItem
                                                label="Files"
                                                invalid={Boolean(
                                                    errors.doc_document &&
                                                        touched.doc_document
                                                )}
                                                errorMessage={
                                                    errors.doc_document
                                                }
                                            >
                                                <Field name="doc_document">
                                                    {({ field, form }) => (
                                                        <div className="relative">
                                                            <div>
                                                                <Upload
                                                                    beforeUpload={
                                                                        beforeUpload
                                                                    }
                                                                    fileList={
                                                                        values.doc_document
                                                                    }
                                                                    onChange={(
                                                                        files
                                                                    ) =>
                                                                        form.setFieldValue(
                                                                            field.name,
                                                                            files
                                                                        )
                                                                    }
                                                                    onFileRemove={(
                                                                        files
                                                                    ) =>
                                                                        form.setFieldValue(
                                                                            field.name,
                                                                            files
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        actionBtn.approve
                                                                    }
                                                                    multiple
                                                                />
                                                            </div>
                                                            <div className="absolute left-[80px] top-0">
                                                                <div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="solid"
                                                                        color="green-600"
                                                                        className={
                                                                            grnData.document_name ==
                                                                                null ||
                                                                            grnData.document_name ==
                                                                                ''
                                                                                ? 'hidden'
                                                                                : 'visible mr-2'
                                                                        }
                                                                        onClick={() =>
                                                                            download(
                                                                                grnData.document_name
                                                                            )
                                                                        }
                                                                    >
                                                                        Download
                                                                        All
                                                                    </Button>
                                                                    <Button
                                                                        variant="solid"
                                                                        color="blue-600"
                                                                        type="button"
                                                                        className={
                                                                            grnData.document_name ==
                                                                                null ||
                                                                            grnData.document_name ==
                                                                                ''
                                                                                ? 'hidden'
                                                                                : 'visible mr-2'
                                                                        }
                                                                        onClick={() =>
                                                                            openDoc()
                                                                        }
                                                                    >
                                                                        View
                                                                    </Button>
                                                                    {
                                                                        grnId.grnid ?(<Button
                                                                        variant="solid"
                                                                        color="rose-600"
                                                                        type="button"
                                                                        className={
                                                                            grnData.document_name ==
                                                                                null ||
                                                                            grnData.document_name ==
                                                                                ''
                                                                                ? 'hidden'
                                                                                : 'visible'
                                                                        }
                                                                        onClick={() =>
                                                                            setIsDeleteOpen(true)
                                                                        }
                                                                    >
                                                                        Delete
                                                                    </Button>)
                                                                    :null
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Field>
                                            </FormItem>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-3">
                                        <FormItem
                                            asterisk
                                            label="Payment Due Date"
                                            invalid={
                                                errors.payment_due_date &&
                                                touched.payment_due_date
                                            }
                                            errorMessage={
                                                errors.payment_due_date
                                            }
                                        >
                                            <Field
                                                autoComplete="off"
                                                name="payment_due_date"
                                            >
                                                {({ field, form }) => (
                                                    <DatePicker
                                                        inputFormat="DD-MM-YYYY"
                                                        // inputtable
                                                        // inputtableBlurClose={false}
                                                        field={field}
                                                        placeholder="Payment Due Date"
                                                        form={form}
                                                        value={
                                                            values.payment_due_date
                                                        }
                                                        onChange={(option) => {
                                                            let date = new Date(
                                                                option
                                                            )
                                                            return form.setFieldValue(
                                                                field.name,
                                                                date.toDateString()
                                                            )
                                                        }}
                                                        disabled={
                                                            actionBtn.approve
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Pay Immediately"
                                            invalid={
                                                errors.pay_immediately &&
                                                touched.pay_immediately
                                            }
                                            errorMessage={
                                                errors.pay_immediately
                                            }
                                        >
                                            <Field
                                                name="pay_immediately"
                                                component={Checkbox}
                                                disabled={actionBtn.approve}
                                                className={
                                                    actionBtn.approve
                                                        ? 'changeColor'
                                                        : ''
                                                }
                                            />
                                        </FormItem>
                                    </div>
                                    {/* <h5>Items Imformation</h5>
                                    <p className="mb-6">{grnId.grnid ? 'Edit' : 'Add'} details of Items for purchase order</p> */}
                                    <Table
                                        compact
                                        className="border mb-6"
                                        hoverable={false}
                                    >
                                        <THead>
                                            <Tr>
                                                <Th rowSpan="2">Items*</Th>
                                                <Th rowSpan="2">
                                                    Item Description*
                                                </Th>
                                                <Th colSpan="5">As Per PO</Th>
                                                <Th rowSpan="2">Discount</Th>
                                                <Th colSpan="6">As Per RIN*</Th>
                                                {/* <Th rowSpan="2">Action</Th> */}
                                            </Tr>
                                            <Tr>
                                                <Th>Qty In Kg*</Th>
                                                <Th>Rate</Th>
                                                <Th>Amount</Th>
                                                <Th>GST</Th>
                                                <Th>Total Amount</Th>
                                                <Th>Qty In Kg*</Th>
                                                <Th>Rate*</Th>
                                                <Th>GST Rate</Th>
                                                <Th>Amount</Th>
                                                <Th>GST</Th>
                                                <Th>Total Amount</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="rawMaterialInItems">
                                                {({ form, remove, push }) => (
                                                    <>
                                                        {rawMaterialInItems &&
                                                        rawMaterialInItems.length >
                                                            0 ? (
                                                            rawMaterialInItems.map(
                                                                (
                                                                    item_detail,
                                                                    index
                                                                ) => {
                                                                    const rate =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `rawMaterialInItems[${index}].rate`
                                                                        )

                                                                    const discount =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `rawMaterialInItems[${index}].discount`
                                                                        )

                                                                    return (
                                                                        <Tr
                                                                            key={
                                                                                index
                                                                            }
                                                                        >
                                                                            <Td width="250">
                                                                                {
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .raw_material_name
                                                                                }
                                                                            </Td>
                                                                            <Td>
                                                                                {
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .item_desc
                                                                                }
                                                                            </Td>
                                                                            <Td>
                                                                                <p>
                                                                                    <NumberFormat
                                                                                        displayType="text"
                                                                                        //   prefix={
                                                                                        //       '₹'
                                                                                        //   }
                                                                                        thousandsGroupStyle={
                                                                                            'lakh'
                                                                                        }
                                                                                        decimalScale={
                                                                                            2
                                                                                        }
                                                                                        value={
                                                                                            rawMaterialInItems[
                                                                                                index
                                                                                            ]
                                                                                                .po_qty
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
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
                                                                                        value={
                                                                                            rawMaterialInItems[
                                                                                                index
                                                                                            ]
                                                                                                .po_rate
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
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
                                                                                        value={
                                                                                            rawMaterialInItems[
                                                                                                index
                                                                                            ]
                                                                                                .po_amount
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
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
                                                                                        value={
                                                                                            rawMaterialInItems[
                                                                                                index
                                                                                            ]
                                                                                                .po_gst
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
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
                                                                                        value={
                                                                                            rawMaterialInItems[
                                                                                                index
                                                                                            ]
                                                                                                .po_total_amount
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
                                                                            </Td>
                                                                            <Td width="95">
                                                                                <FormItem
                                                                                    className="mb-0"
                                                                                    invalid={
                                                                                        discount.invalid
                                                                                    }
                                                                                    layout="vertical"
                                                                                    errorMessage={
                                                                                        discount.errorMessage
                                                                                    }
                                                                                >
                                                                                    <Field
                                                                                        invalid={
                                                                                            discount.invalid
                                                                                        }
                                                                                        placeholder="Discount"
                                                                                        name={`rawMaterialInItems[${index}].discount`}
                                                                                        type="number"
                                                                                        component={
                                                                                            Input
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) => {
                                                                                            changeDiscount(
                                                                                                e,
                                                                                                index
                                                                                            )
                                                                                        }}
                                                                                        suffix="%"
                                                                                        disabled={
                                                                                            actionBtn.approve
                                                                                        }
                                                                                    />
                                                                                </FormItem>
                                                                            </Td>
                                                                            <Td
                                                                                className={
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .po_qty !=
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .rin_qty
                                                                                        ? 'bg-red-200'
                                                                                        : ' bg-white'
                                                                                }
                                                                            >
                                                                                <p>
                                                                                    <NumberFormat
                                                                                        displayType="text"
                                                                                        //   prefix={
                                                                                        //       '₹'
                                                                                        //   }
                                                                                        thousandsGroupStyle={
                                                                                            'lakh'
                                                                                        }
                                                                                        decimalScale={
                                                                                            2
                                                                                        }
                                                                                        value={
                                                                                            rawMaterialInItems[
                                                                                                index
                                                                                            ]
                                                                                                .rin_qty
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
                                                                            </Td>
                                                                            <Td
                                                                                width="120"
                                                                                className={
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .po_rate !=
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .rate
                                                                                        ? 'bg-red-200'
                                                                                        : ' bg-white'
                                                                                }
                                                                            >
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
                                                                                        placeholder="Rate"
                                                                                        name={`rawMaterialInItems[${index}].rate`}
                                                                                        type="number"
                                                                                        component={
                                                                                            Input
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) => {
                                                                                            changeRate(
                                                                                                e,
                                                                                                index
                                                                                            )
                                                                                        }}
                                                                                        prefix="₹"
                                                                                        disabled={
                                                                                            actionBtn.approve
                                                                                        }
                                                                                    />
                                                                                </FormItem>
                                                                            </Td>
                                                                            <Td width="90">
                                                                                <p>
                                                                                    <NumberFormat
                                                                                        displayType="text"
                                                                                        suffix={
                                                                                            '%'
                                                                                        }
                                                                                        decimalScale={
                                                                                            2
                                                                                        }
                                                                                        value={
                                                                                            rawMaterialInItems[
                                                                                                index
                                                                                            ]
                                                                                                .rin_gst_rate
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                    />
                                                                                </p>
                                                                            </Td>
                                                                            <Td
                                                                                width="120"
                                                                                className={
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .po_amount !=
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .rin_amount
                                                                                        ? 'bg-red-200'
                                                                                        : ' bg-white'
                                                                                }
                                                                            >
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
                                                                                        value={
                                                                                            rawMaterialInItems[
                                                                                                index
                                                                                            ]
                                                                                                .rin_amount
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
                                                                            </Td>
                                                                            <Td
                                                                                className={
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .po_gst !=
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .rin_gst
                                                                                        ? 'bg-red-200'
                                                                                        : ' bg-white'
                                                                                }
                                                                            >
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
                                                                                        value={
                                                                                            rawMaterialInItems[
                                                                                                index
                                                                                            ]
                                                                                                .rin_gst
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
                                                                            </Td>
                                                                            <Td
                                                                                className={
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .po_total_amount !=
                                                                                    rawMaterialInItems[
                                                                                        index
                                                                                    ]
                                                                                        .rin_total_amount
                                                                                        ? 'bg-red-200'
                                                                                        : ' bg-white'
                                                                                }
                                                                            >
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
                                                                                        value={
                                                                                            rawMaterialInItems[
                                                                                                index
                                                                                            ]
                                                                                                .rin_total_amount
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
                                                                            </Td>
                                                                        </Tr>
                                                                    )
                                                                }
                                                            )
                                                        ) : (
                                                            <Tr>
                                                                <Td
                                                                    colSpan="14"
                                                                    className="p-2 text-center"
                                                                >
                                                                    No Record
                                                                    Found
                                                                </Td>
                                                            </Tr>
                                                        )}
                                                    </>
                                                )}
                                            </FieldArray>
                                            <FieldArray name="rawMaterialInOtherCharges">
                                                {({ form, remove, push }) => (
                                                    <>
                                                        {rawMaterialInOtherCharges &&
                                                        rawMaterialInOtherCharges.length >
                                                            0
                                                            ? rawMaterialInOtherCharges.map(
                                                                  (
                                                                      item_detail,
                                                                      index
                                                                  ) => {
                                                                      const tax_per =
                                                                          fieldFeedback(
                                                                              form,
                                                                              `rawMaterialInOtherCharges[${index}].tax_per`
                                                                          )
                                                                      const amount =
                                                                          fieldFeedback(
                                                                              form,
                                                                              `rawMaterialInOtherCharges[${index}].amount`
                                                                          )
                                                                      const item_desc =
                                                                          fieldFeedback(
                                                                              form,
                                                                              `rawMaterialInOtherCharges[${index}].item_desc`
                                                                          )

                                                                      return (
                                                                          <Tr
                                                                              key={
                                                                                  index
                                                                              }
                                                                          >
                                                                              {/* <Td colSpan="2" className="custom-text-left">Other Charges</Td> */}
                                                                              <Td colSpan="4">
                                                                                  <FormItem
                                                                                      className="mb-0"
                                                                                      invalid={
                                                                                          item_desc.invalid
                                                                                      }
                                                                                      layout="vertical"
                                                                                      errorMessage={
                                                                                          item_desc.errorMessage
                                                                                      }
                                                                                  >
                                                                                      <Field
                                                                                          invalid={
                                                                                              item_desc.invalid
                                                                                          }
                                                                                          placeholder="Other Description"
                                                                                          name={`rawMaterialInOtherCharges[${index}].item_desc`}
                                                                                          type="text"
                                                                                          component={
                                                                                              Input
                                                                                          }
                                                                                          disabled={
                                                                                              actionBtn.approve
                                                                                          }
                                                                                      />
                                                                                  </FormItem>
                                                                              </Td>
                                                                              <Td>
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
                                                                                      value={
                                                                                          rawMaterialInOtherCharges[
                                                                                              index
                                                                                          ]
                                                                                              .po_amount !=
                                                                                          null
                                                                                              ? rawMaterialInOtherCharges[
                                                                                                    index
                                                                                                ]
                                                                                                    .po_amount
                                                                                              : 0
                                                                                      }
                                                                                      allowLeadingZeros
                                                                                      thousandSeparator=","
                                                                                  />
                                                                              </Td>
                                                                              <Td>
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
                                                                                      value={
                                                                                          rawMaterialInOtherCharges[
                                                                                              index
                                                                                          ]
                                                                                              .po_tax_amt !=
                                                                                          null
                                                                                              ? rawMaterialInOtherCharges[
                                                                                                    index
                                                                                                ]
                                                                                                    .po_tax_amt
                                                                                              : 0
                                                                                      }
                                                                                      allowLeadingZeros
                                                                                      thousandSeparator=","
                                                                                  />
                                                                              </Td>
                                                                              <Td>
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
                                                                                      value={
                                                                                          rawMaterialInOtherCharges[
                                                                                              index
                                                                                          ]
                                                                                              .po_total_amt !=
                                                                                          null
                                                                                              ? rawMaterialInOtherCharges[
                                                                                                    index
                                                                                                ]
                                                                                                    .po_total_amt
                                                                                              : 0
                                                                                      }
                                                                                      allowLeadingZeros
                                                                                      thousandSeparator=","
                                                                                  />
                                                                              </Td>
                                                                              <Td
                                                                                  colSpan={
                                                                                      3
                                                                                  }
                                                                              ></Td>
                                                                              <Td>
                                                                                  <FormItem
                                                                                      className="mb-0"
                                                                                      invalid={
                                                                                          tax_per.invalid
                                                                                      }
                                                                                      layout="vertical"
                                                                                      errorMessage={
                                                                                          tax_per.errorMessage
                                                                                      }
                                                                                  >
                                                                                      <Field
                                                                                          invalid={
                                                                                              tax_per.invalid
                                                                                          }
                                                                                          placeholder="GST Rate"
                                                                                          name={`rawMaterialInOtherCharges[${index}].tax_per`}
                                                                                          type="number"
                                                                                          component={
                                                                                              Input
                                                                                          }
                                                                                          onChange={(
                                                                                              e
                                                                                          ) =>
                                                                                              changeOtherRate(
                                                                                                  e,
                                                                                                  index
                                                                                              )
                                                                                          }
                                                                                          suffix="%"
                                                                                          disabled={
                                                                                              actionBtn.approve
                                                                                          }
                                                                                      />
                                                                                  </FormItem>
                                                                              </Td>
                                                                              <Td
                                                                                  className={
                                                                                      rawMaterialInOtherCharges[
                                                                                          index
                                                                                      ]
                                                                                          .po_amount !=
                                                                                      rawMaterialInOtherCharges[
                                                                                          index
                                                                                      ]
                                                                                          .amount
                                                                                          ? 'bg-red-200'
                                                                                          : 'bg-white'
                                                                                  }
                                                                              >
                                                                                  <FormItem
                                                                                      className="mb-0"
                                                                                      invalid={
                                                                                          amount.invalid
                                                                                      }
                                                                                      layout="vertical"
                                                                                      errorMessage={
                                                                                          amount.errorMessage
                                                                                      }
                                                                                  >
                                                                                      <Field
                                                                                          invalid={
                                                                                              amount.invalid
                                                                                          }
                                                                                          placeholder="Amount"
                                                                                          name={`rawMaterialInOtherCharges[${index}].amount`}
                                                                                          type="number"
                                                                                          component={
                                                                                              Input
                                                                                          }
                                                                                          onChange={(
                                                                                              e
                                                                                          ) =>
                                                                                              changeOtherAmount(
                                                                                                  e,
                                                                                                  index
                                                                                              )
                                                                                          }
                                                                                          prefix="₹"
                                                                                          disabled={
                                                                                              actionBtn.approve
                                                                                          }
                                                                                      />
                                                                                  </FormItem>
                                                                              </Td>
                                                                              <Td
                                                                                  className={
                                                                                      rawMaterialInOtherCharges[
                                                                                          index
                                                                                      ]
                                                                                          .po_tax_amt !=
                                                                                      rawMaterialInOtherCharges[
                                                                                          index
                                                                                      ]
                                                                                          .gst
                                                                                          ? 'bg-red-200'
                                                                                          : 'bg-white'
                                                                                  }
                                                                              >
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
                                                                                          value={
                                                                                              rawMaterialInOtherCharges[
                                                                                                  index
                                                                                              ]
                                                                                                  .gst
                                                                                          }
                                                                                          allowLeadingZeros
                                                                                          thousandSeparator=","
                                                                                      />
                                                                                  </p>
                                                                              </Td>
                                                                              <Td
                                                                                  className={
                                                                                      rawMaterialInOtherCharges[
                                                                                          index
                                                                                      ]
                                                                                          .po_total_amt !=
                                                                                      rawMaterialInOtherCharges[
                                                                                          index
                                                                                      ]
                                                                                          .total_amount
                                                                                          ? 'bg-red-200'
                                                                                          : 'bg-white'
                                                                                  }
                                                                              >
                                                                                  <div className="flex gap-x-2 justify-between items-center">
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
                                                                                              value={
                                                                                                  rawMaterialInOtherCharges[
                                                                                                      index
                                                                                                  ]
                                                                                                      .total_amount
                                                                                              }
                                                                                              allowLeadingZeros
                                                                                              thousandSeparator=","
                                                                                          />
                                                                                      </p>
                                                                                      <Button
                                                                                          shape="circle"
                                                                                          size="sm"
                                                                                          icon={
                                                                                              <HiMinus />
                                                                                          }
                                                                                          onClick={() =>
                                                                                              remove(
                                                                                                  index
                                                                                              )
                                                                                          }
                                                                                          className={
                                                                                              index >
                                                                                              0
                                                                                                  ? 'visible'
                                                                                                  : 'hidden'
                                                                                          }
                                                                                      />
                                                                                  </div>
                                                                              </Td>
                                                                          </Tr>
                                                                      )
                                                                  }
                                                              )
                                                            : ''}
                                                        <Tr
                                                            className={
                                                                actionBtn.approve
                                                                    ? 'hidden'
                                                                    : 'visible'
                                                            }
                                                        >
                                                            <Td
                                                                colSpan="14"
                                                                className="custom-text-left"
                                                            >
                                                                <Button
                                                                    type="button"
                                                                    className="ltr:mr-2 rtl:ml-2"
                                                                    onClick={() => {
                                                                        push({
                                                                            item_desc:
                                                                                '',
                                                                            po_amount: 0,
                                                                            po_tax_amt: 0,
                                                                            po_total_amt: 0,
                                                                            tax_per: 0,
                                                                            amount: 0,
                                                                            gst: '',
                                                                            total_amount:
                                                                                '',
                                                                        })
                                                                    }}
                                                                >
                                                                    Add Other
                                                                    Charges
                                                                </Button>
                                                            </Td>
                                                        </Tr>
                                                    </>
                                                )}
                                            </FieldArray>
                                            <Tr>
                                                <Td
                                                    colSpan="4"
                                                    className="custom-text-left"
                                                >
                                                    Total Amount :
                                                </Td>
                                                <Td>
                                                    <NumberFormat
                                                        displayType="text"
                                                        prefix={'₹'}
                                                        thousandsGroupStyle={
                                                            'lakh'
                                                        }
                                                        decimalScale={2}
                                                        value={
                                                            values.po_amt !=
                                                            null
                                                                ? values.po_amt
                                                                : 0
                                                        }
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </Td>
                                                <Td>
                                                    <NumberFormat
                                                        displayType="text"
                                                        prefix={'₹'}
                                                        thousandsGroupStyle={
                                                            'lakh'
                                                        }
                                                        decimalScale={2}
                                                        value={
                                                            values.po_tax_amt !=
                                                            null
                                                                ? values.po_tax_amt
                                                                : 0
                                                        }
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </Td>
                                                <Td>
                                                    <NumberFormat
                                                        displayType="text"
                                                        prefix={'₹'}
                                                        thousandsGroupStyle={
                                                            'lakh'
                                                        }
                                                        decimalScale={2}
                                                        value={
                                                            values.po_total_amt !=
                                                            null
                                                                ? values.po_total_amt
                                                                : 0
                                                        }
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </Td>
                                                <Td colSpan="4"></Td>
                                                <Td
                                                    className={
                                                        values.po_amt !=
                                                        values.amt
                                                            ? 'bg-red-200'
                                                            : 'bg-white'
                                                    }
                                                >
                                                    <NumberFormat
                                                        displayType="text"
                                                        prefix={'₹'}
                                                        thousandsGroupStyle={
                                                            'lakh'
                                                        }
                                                        decimalScale={2}
                                                        value={
                                                            values.amt != null
                                                                ? values.amt
                                                                : 0
                                                        }
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </Td>
                                                <Td
                                                    className={
                                                        values.po_tax_amt !=
                                                        values.tax_amt
                                                            ? 'bg-red-200'
                                                            : 'bg-white'
                                                    }
                                                >
                                                    <NumberFormat
                                                        displayType="text"
                                                        prefix={'₹'}
                                                        thousandsGroupStyle={
                                                            'lakh'
                                                        }
                                                        decimalScale={2}
                                                        value={
                                                            values.tax_amt !=
                                                            null
                                                                ? values.tax_amt
                                                                : 0
                                                        }
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </Td>
                                                <Td
                                                    className={
                                                        values.po_total_amt !=
                                                        values.total_amt
                                                            ? 'bg-red-200'
                                                            : 'bg-white'
                                                    }
                                                >
                                                    <NumberFormat
                                                        displayType="text"
                                                        prefix={'₹'}
                                                        thousandsGroupStyle={
                                                            'lakh'
                                                        }
                                                        decimalScale={2}
                                                        value={
                                                            values.total_amt !=
                                                            null
                                                                ? values.total_amt
                                                                : 0
                                                        }
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </Td>
                                            </Tr>
                                            <Tr>
                                                <Td colSpan="11"></Td>
                                                <Td>TDS</Td>
                                                <Td width="100">
                                                    <FormItem
                                                        className="mb-0"
                                                        layout="vertical"
                                                        invalid={
                                                            errors.tds_per &&
                                                            touched.tds_per
                                                        }
                                                        errorMessage={
                                                            errors.tds_per
                                                        }
                                                    >
                                                        <Field
                                                            placeholder="TDS"
                                                            name="tds_per"
                                                            type="number"
                                                            component={Input}
                                                            suffix="%"
                                                            disabled={
                                                                actionBtn.approve
                                                            }
                                                        >
                                                            {({
                                                                field,
                                                                form,
                                                            }) => (
                                                                <Input
                                                                    placeholder="TDS"
                                                                    type="number"
                                                                    form={form}
                                                                    field={
                                                                        field
                                                                    }
                                                                    onChange={(
                                                                        option
                                                                    ) => {
                                                                        changeTDSTotal(
                                                                            option
                                                                        )
                                                                    }}
                                                                    disabled={
                                                                        actionBtn.approve
                                                                    }
                                                                />
                                                            )}
                                                        </Field>
                                                    </FormItem>
                                                </Td>
                                                <Td>
                                                    <NumberFormat
                                                        displayType="text"
                                                        prefix={'₹'}
                                                        thousandsGroupStyle={
                                                            'lakh'
                                                        }
                                                        decimalScale={2}
                                                        value={
                                                            values.tds_amt !=
                                                            null
                                                                ? values.tds_amt
                                                                : 0
                                                        }
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </Td>
                                            </Tr>
                                            <Tr>
                                                <Td
                                                    colSpan="13"
                                                    className="custom-text-left"
                                                >
                                                    Round Off Amount
                                                </Td>
                                                <Td>
                                                    {/* <NumberFormat
                                                        displayType="text"
                                                        prefix={'₹'}
                                                        thousandsGroupStyle={'lakh'}
                                                        decimalScale={2}
                                                        value={roundOffTotoal(
                                                            values
                                                        )}
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    /> */}
                                                    <FormItem
                                                        className="mb-0"
                                                        layout="vertical"
                                                        invalid={
                                                            errors.round_off_amt &&
                                                            touched.round_off_amt
                                                        }
                                                        errorMessage={
                                                            errors.round_off_amt
                                                        }
                                                    >
                                                        <Field name="round_off_amt">
                                                            {({
                                                                field,
                                                                form,
                                                            }) => (
                                                                <Input
                                                                    placeholder="Round Off Amount"
                                                                    type="number"
                                                                    prefix="₹"
                                                                    form={form}
                                                                    field={
                                                                        field
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) => {
                                                                        changeRoundOffTotal(
                                                                            e
                                                                        )
                                                                    }}
                                                                    disabled={
                                                                        actionBtn.approve
                                                                    }
                                                                />
                                                            )}
                                                        </Field>
                                                    </FormItem>
                                                </Td>
                                            </Tr>
                                            <Tr>
                                                <Td
                                                    colSpan="13"
                                                    className="custom-text-left"
                                                >
                                                    Final Amount
                                                </Td>
                                                <Td>
                                                    <NumberFormat
                                                        displayType="text"
                                                        prefix={'₹'}
                                                        thousandsGroupStyle={
                                                            'lakh'
                                                        }
                                                        decimalScale={2}
                                                        value={
                                                            values.final_amount !=
                                                            null
                                                                ? values.final_amount
                                                                : 0
                                                        }
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </Td>
                                            </Tr>
                                        </TBody>
                                    </Table>
                                    {/* <h5>Other Information</h5>
                                    <p className="mb-6">{grnId.grnid ? 'Edit' : 'Add'} final Purchase Order remark</p> */}
                                    <div className="grid grid-cols-3 gap-x-8 gap-y-2">
                                        <FormItem
                                            label="Remark"
                                            invalid={
                                                errors.remarks &&
                                                touched.remarks
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
                                                            onChange={(
                                                                option
                                                            ) =>
                                                                form.setFieldValue(
                                                                    field.name,
                                                                    option
                                                                        .target
                                                                        .value
                                                                )
                                                            }
                                                        />
                                                    )
                                                }}
                                            </Field>
                                        </FormItem>
                                    </div>
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
                                        onClick={() => rejectGRN()}
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
                                        onClick={() => deleteGRN()}
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
                                            navigate(
                                                '/transaction/goods-received-note'
                                            )
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
                isOpen={isOpenDoc}
                onClose={closeDoc}
                onRequestClose={closeDoc}
                contentClassName="pb-0 pt-0 px-0 mt-8 mb-8"
                width={1200}
                height={`90vh`}
            >
                <div className="flex flex-col h-full justify-between">
                    <div className="overflow-y-auto">
                        {grnData.document_name.length > 0
                            ? grnData.document_name.map((value, index) => (
                                  <ViewImages
                                      url={`${appConfig.uploadUrl}raw_material_in/${value}`}
                                      name={value}
                                      key={index}
                                  ></ViewImages>
                              ))
                            : ''}
                    </div>
                </div>
            </Dialog>
            <DeleteDocument id={grnId.grnid} documents={grnData.document_name} isOpen={isDeleteOpen} setIsDocumentOpen={closeOpenedDoc}/>
        </>
    )
}

export default AddEditGoodsReceivedNote
