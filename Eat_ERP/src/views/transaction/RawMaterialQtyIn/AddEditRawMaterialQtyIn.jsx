import React, { useState, useRef, useEffect } from 'react'
import { FormItem, FormContainer } from 'components/ui'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import DatePicker from 'components/ui/DatePicker'
import Button from 'components/ui/Buttons'
import Upload from 'components/ui/Upload'
import StickyFooter from 'components/shared/StickyFooter'
import { Field, Form, FieldArray, Formik, getIn } from 'formik'
import { useNavigate, useParams } from 'react-router-dom'
import * as Yup from 'yup'
import Table from 'components/ui/Table'
import '../PurchaseOrder/AddEditPurchaseOrder.css'
import Dialog from 'components/ui/Dialog'
import Loading from 'components/shared/Loading'
import ItemBoxWeight from './ItemBoxWeight'
import Notification from 'components/ui/Notification'
import toast from 'components/ui/toast'
import CreatePrintMultiple from './CreatePrintMultiple'
import {
    apiRawMaterialQtyInGetSingle,
    apiRawMaterialQtyInMasterData,
    apiRawMaterialQtyInPendingApprove,
    apiRawMaterialQtyInPoDetails,
    apiRawMaterialQtyInPost,
    apiRawMaterialQtyInReject,
    apiRawMaterialQtyInUpdate,
    apiRawMaterialQtyInVendorPos,
} from 'services/RawMaterialQtyInService'

import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import ViewImages from '../FinanceVoucher/ViewImages'
import DeleteDocument from './DeleteDocument'
import appConfig from 'configs/app.config'

// import classNames from 'classnames'
// import Segment from 'components/ui/Segment'
// import { HiCheckCircle } from 'react-icons/hi'


const { Tr, Th, Td, THead, TBody } = Table

const validationSchema = Yup.object().shape({
    date_of_receipt: Yup.string().required('Date Is Required').nullable(),
    vendor_id: Yup.string().required('Vendor Is Required'),
    depot_id: Yup.string().required('Depot Is Required'),
    purchase_order_id: Yup.string().required('Purchase Order Is Required'),
    gate_pass_no: Yup.string().required('Gate Pass No. Is Required'),
    rawMaterialInItems: Yup.array().of(
        Yup.object().shape({
            no_of_boxes: Yup.number().required(' '),
            itemWeights: Yup.array().required(' '),
            // qty: Yup.number().required(' ').moreThan(0, ' '),
            qty: Yup.number()
                .required(' ')
                .test((value, context) => {
                    const { path } = context
                    // console.log()
                    if (context.parent.no_of_boxes > 0) {
                        if (value > 0) {
                            return true
                        } else {
                            return context.createError({
                                path,
                                message: ' ',
                            })
                        }
                    } else {
                        return true
                    }
                }),
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
    const MAX_FILE_SIZE = 25000000

    if (fileList.length >= MAX_UPLOAD) {
        return `You can only upload ${MAX_UPLOAD} file(s)`
    }

    if (file) {
        for (const f of file) {
            if (!allowedFileType.includes(f.type)) {
                valid = 'Please upload a .jpeg or .png file!'
            }

            if (f.size >= MAX_FILE_SIZE) {
                valid = 'Upload image cannot more then 25MB!'
            }
        }
    }

    return valid
}

const AddEditRawMaterialQtyIn = () => {
    const [dialogIsOpen, setIsOpen] = useState(false)
    const [dialogIsOpen2, setIsOpen2] = useState(false)
    const [dialogData, setDialogData] = useState({
        boxes: [],
        index: '',
    })
    const [rawMaterialQtyIn, setRawMaterialQtyIn] = useState({
        date_of_receipt: new Date(), //YYYY-MM-DD
        invoice_no: '',
        vendor_id: '',
        depot_id: '',
        purchase_order_id: '',
        gate_pass_no: '',
        doc_document: [],
        document_name: '',
        rawMaterialInItems: [],
        remarks: '',
    })
    const [rawMaterialInQtys, setRawMaterialInQtys] = useState([])
    const [actionBtn, setActionBtn] = useState({
        approve: false,
        delete: false,
        update: false,
    })
    const [masterOption, setMasterOption] = useState({
        vendors: [],
        depots: [],
        rawMaterials: [],
        purchaseOrders: [],
    })
    // const [printCodeIndex, setPrintCodeIndex] = useState()
    const [loading, setLoading] = useState(false)
    const [componentLoading, setComponentLoading] = useState(false)
    const navigate = useNavigate()
    const rmQtyInId = useParams()
    const formRef = useRef()

    const [isDeleteOpen, setIsDeleteOpen] = useState(false)

    const deletePurchaseOrder = () => {
        console.log('Delete Purchase Order')
    }
    const rejectGRN = async () => {
        console.log('Reject GRN');
        if(formRef.current.values.remarks == ''){
            formRef.current.setFieldError('remarks', 'Remarks is required to reject GRN')
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Remarks is required to reject GRN
                </Notification>
            )
        }else{

            await apiRawMaterialQtyInReject({values: formRef.current.values,...{ id: rmQtyInId.rmqtyinid },}).then((data) => {
                console.log(data)
                if (data.status === 200) {
                    formRef.current.setSubmitting(false)
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    formRef.current.resetForm()
                    navigate('/transaction/raw-material-qty-in')
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
    }

    const [isOpenDoc, setIsOpenDoc] = useState(false)

    const openDoc = () => {
        setIsOpenDoc(true)
    }

    const closeDoc = (e) => {
        console.log('onDialogClose', e)
        setIsOpenDoc(false)
    }

    const closeOpenedDoc = (childData)=>{
        if(childData.hasOwnProperty('documents')){
            setRawMaterialQtyIn(prev=>({...prev, document_name: childData.documents != null ? childData.documents.split(' | ') : []}))
        }
        setIsDeleteOpen(childData.isOpen)
    }

    const openDialog = (boxes, index, form) => {
        // setDialogData({ boxes, index, form })
        if (parseInt(boxes) > 0) {
            // console.log(formRef.current.values)
            if (
                formRef.current.values.rawMaterialInItems[index].itemWeights
                    .length > 0 &&
                formRef.current.values.rawMaterialInItems[index].itemWeights[0]
                    .gross_weight != ''
            ) {
                console.log('Has Value...')
                if (
                    formRef.current.values.rawMaterialInItems[index].itemWeights
                        .length == parseInt(boxes)
                ) {
                    addRemoveRow(index, false, parseInt(boxes), form)
                } else {
                    addRemoveRow(index, true, parseInt(boxes), form)
                }
            } else {
                console.log('Has No Value...')
                setDialogData({ boxes: addRows(parseInt(boxes)), index, form })
                // console.log(dialogData)
                form.setFieldValue(
                    `rawMaterialInItems[${index}].itemWeights`,
                    dialogData.boxes
                )
            }
            setIsOpen(true)
        } else {
            setDialogData({ boxes: [] })
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Please Add No. Of Boxes
                </Notification>
            )
        }
        // console.log(form.values.rawMaterialInItems[index].itemWeights)
    }

    // const onDialogOk = (e) => {
    //     setIsOpen1(false)
    //     // setIsOpen3(true)
    // }

    const getData = (childData) => {
        console.log(childData)
        if (childData.cancel) {
            formRef.current.setFieldValue(
                `rawMaterialInItems[${childData.index}].itemWeights`,
                childData.item_box_weight
            )
            // formRef.current.setFieldValue(
            //     `rawMaterialInItems[${childData.index}].qty`,
            //     childData.total
            // )

            // generateBarcode(childData.index)
        } else {
            formRef.current.setFieldValue(
                `rawMaterialInItems[${childData.index}].itemWeights`,
                childData.item_box_weight
            )
            formRef.current.setFieldValue(
                `rawMaterialInItems[${childData.index}].qty`,
                childData.total
            )
            console.log(formRef.current.values)
            // generateBarcode(childData.index)
        }
        setIsOpen(false)
        // setIsOpen1(true)
    }

    const addRemoveRow = (index, isInputChange, boxes, form) => {
        if (!isInputChange) {
            setDialogData({
                boxes: formRef.current.values.rawMaterialInItems[index]
                    .itemWeights,
                index,
                form,
            })
        } else {
            if (
                boxes !== undefined &&
                formRef.current.values.rawMaterialInItems[index].itemWeights
                    .length < boxes
            ) {
                let count =
                    boxes -
                    formRef.current.values.rawMaterialInItems[index].itemWeights
                        .length
                let tempData = addRows(count)
                console.log(tempData)
                setDialogData({
                    boxes: formRef.current.values.rawMaterialInItems[
                        index
                    ].itemWeights.concat(tempData),
                    index,
                    form,
                })
                console.log(dialogData)
                formRef.current.setFieldValue(
                    `rawMaterialInItems[${index}].itemWeights`,
                    dialogData.boxes
                )
            } else if (
                boxes !== undefined &&
                formRef.current.values.rawMaterialInItems[index].itemWeights
                    .length > boxes
            ) {
                let box_items =
                    formRef.current.values.rawMaterialInItems[index].itemWeights
                let count =
                    formRef.current.values.rawMaterialInItems[index].itemWeights
                        .length - boxes
                for (let i = 0; i < count; i++) {
                    box_items.pop()
                }
                // console.log(box_items)
                setDialogData({
                    boxes: box_items,
                    index,
                    form,
                })
                formRef.current.setFieldValue(
                    `rawMaterialInItems[${index}].itemWeights`,
                    dialogData.boxes
                )
                // console.log(dialogData)
            }
        }
    }

    const addRows = (count) => {
        let tempData = []
        for (let i = 0; i < count; i++) {
            tempData.push({
                id: i,
                gross_weight: '',
                net_weight: '',
                expiry_date: '',
                barcode: '',
            })
        }
        return tempData
    }

    const [changeDetails, setChangeDetails] = useState(false)
    useEffect(() => {
        console.log('value Changed')
        const fetchData = () => {
            setComponentLoading(true)
            if (rmQtyInId.rmqtyinid) {
                apiRawMaterialQtyInGetSingle(rmQtyInId.rmqtyinid)
                    .then((data) => {
                        if (data.status === 200) {
                            const {
                                purchaseOrders,
                                depots,
                                vendors,
                                rawMaterials,
                            } = data.data.masterData
                            const pData = data.data.rawMaterialIn
                            const { rawMaterialInQtys } = data.data
                            setRawMaterialInQtys(rawMaterialInQtys)
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
                            });

                            setRawMaterialQtyIn({
                                date_of_receipt:
                                    pData.date_of_receipt != null
                                        ? pData.date_of_receipt
                                        : '',
                                vendor_id:
                                    pData.vendor_id != null
                                        ? pData.vendor_id
                                        : '',
                                depot_id:
                                    pData.depot_id != null
                                        ? pData.depot_id
                                        : '',
                                purchase_order_id:
                                    pData.purchase_order_id != null
                                        ? pData.purchase_order_id
                                        : '',
                                gate_pass_no:
                                    pData.gate_pass_no != null
                                        ? pData.gate_pass_no
                                        : '',
                                doc_document: [],
                                document_name:
                                    pData.document_name != null
                                        ? pData.document_name.split(' | ')
                                        : [],
                                rawMaterialInItems:
                                    pData.rawMaterialInItems.map((value) => {
                                        return {
                                            po_item_id: value.po_item_id,
                                            raw_material_id:
                                                value.raw_material['id'],
                                            raw_material_name:
                                                value.raw_material['rm_name'] !=
                                                null
                                                    ? value.raw_material[
                                                          'rm_name'
                                                      ]
                                                    : '',
                                            po_quantity:
                                                value.po_quantity != null
                                                    ? value.po_quantity
                                                    : 0,
                                            no_of_boxes:
                                                value.no_of_boxes != null
                                                    ? value.no_of_boxes
                                                    : 0,
                                            qty:
                                                value.qty != null
                                                    ? value.qty
                                                    : 0,
                                            itemWeights:
                                                value.rawMaterialInItemWeights.map(
                                                    (value) => {
                                                        return {
                                                            gross_weight:
                                                                value.gross_weight !=
                                                                null
                                                                    ? value.gross_weight
                                                                    : 0,
                                                            net_weight:
                                                                value.net_weight !=
                                                                null
                                                                    ? value.net_weight
                                                                    : 0,
                                                            expiry_date:
                                                                value.expiry_date !=
                                                                null
                                                                    ? value.expiry_date
                                                                    : '',
                                                            barcode:
                                                                value.barcode !=
                                                                null
                                                                    ? value.barcode
                                                                    : '',
                                                        }
                                                    }
                                                ),
                                            barcode:
                                                value.rawMaterialInItemWeights.map(
                                                    (v) => v.barcode
                                                ),
                                        }
                                    }),
                                remarks:
                                    pData.remarks != null ? pData.remarks : '',
                            });
                        } else if (data.response.status === 422) {
                            console.log(data.response.status)
                        }
                        setComponentLoading(false)
                    })
                    .catch((error) => {
                        console.log(error)
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
                        setComponentLoading(false)
                    })
            } else {
                apiRawMaterialQtyInMasterData()
                    .then((data) => {
                        if (data.status === 200) {
                            const { depots, vendors, rawMaterials } =
                                data.data.masterData
                            setMasterOption({
                                purchaseOrders: [],
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
                        }
                        setComponentLoading(false)
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
                        setComponentLoading(false)
                    })
            }
            return true
        }
        fetchData()
    }, [changeDetails])

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
                saveAs(content, 'grn-files.zip')
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

    const handleVendorChange = (option) => {
        // console.log(option)
        changeVendor(option.value)
    }

    const changeVendor = async (id) => {
        setLoading(true)
        if (!rmQtyInId.rmqtyinid) {
            await apiRawMaterialQtyInVendorPos(id).then((data) => {
                if (data.status === 200) {
                    const { purchaseOrders } = data.data.purchaseOrders
                    // console.log(purchaseOrders)
                    setMasterOption((props) => {
                        return {
                            ...props,
                            purchaseOrders: purchaseOrders.map((data) => {
                                return {
                                    value: data.id,
                                    label: data.po_no,
                                }
                            }),
                        }
                    })
                    setLoading(false)
                }
            })
        } else {
            setLoading(false)
        }
    }

    const handlePurchaseOrderChange = (option) => {
        // console.log(option)
        changePurchaseOrder(option.value)
    }

    const changePurchaseOrder = async (id) => {
        await apiRawMaterialQtyInPoDetails(id)
            .then((data) => {
                if (data.status === 200) {
                    console.log(data.data)
                    const { purchaseOrder, rawMaterialInQtys } = data.data
                    // console.log(purchaseOrder.purchaseOrderItems)
                    setRawMaterialInQtys(rawMaterialInQtys)
                    formRef.current.setFieldValue(
                        'depot_id',
                        purchaseOrder['depot_id']
                    )
                    // console.log(purchaseOrder['depot_id'])
                    formRef.current.setFieldValue(
                        'rawMaterialInItems',
                        purchaseOrder.purchaseOrderItems.map((value) => {
                            return {
                                po_item_id: value.id,
                                raw_material_id: value.raw_material['id'],
                                raw_material_name: `${
                                    value.raw_material['rm_name']
                                } ${
                                    value.item_desc != null &&
                                    value.item_desc != ''
                                        ? `- ${value.item_desc}`
                                        : ''
                                }`,
                                po_quantity: value.qty != null ? value.qty : 0,
                                no_of_boxes: 0,
                                qty: 0,
                                itemWeights: [],
                                barcode: [],
                            }
                        })
                    )
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
                console.log(error)
            })
    }

    const handleChangeNoOfBoxes = (index) => {
        formRef.current.setFieldValue(`rawMaterialInItems[${index}].qty`, 0)
    }

    const onDialogClose = (e) => {
        // console.log('onDialogClose', e)
        setIsOpen2(false)
    }

    const onDialogOk2 = async (e) => {
        handleSubmit(1)
    }

    const onDialogClose1 = async (e) => {
        handleSubmit(0)
    }

    const handleSubmit = async (partialCheck) => {
        const formData = new FormData()
        const values = formRef.current.values
        console.log('Dont Print Barcode')
        for (const i in values) {
            // console.log(i)
            if (i === 'rawMaterialInItems') {
                console.log(values.rawMaterialInItems)
                formData.append(i, JSON.stringify(values[i]))
            } else if (i === 'doc_document') {
                for (const val of values[i]) {
                    formData.append('doc_document', val)
                }
            } else {
                formData.append(i, values[i])
            }
        }
        formData.append('partial_po', partialCheck)
        // for (const pair of formData.entries()) {
        //     console.log(pair[0], pair[1])
        // }
        setComponentLoading(true)
        if (rmQtyInId.rmqtyinid) {
            if(actionBtn.approve){
                await apiRawMaterialQtyInPendingApprove({values: {},...{ id: rmQtyInId.rmqtyinid },}).then((data)=>{
                    if (data.status === 200) {
                        // console.log(data.data.rawMaterialIn.id)
                        formRef.current.setSubmitting(false)
                        toast.push(
                            <Notification title="Success" type="success" closable>
                                {data.data['message']}
                            </Notification>
                        )
                        navigate('/transaction/raw-material-qty-in');
                    } else if (data.response.status === 500) {
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {data.response.data['message']}
                            </Notification>
                        )
                    }
                }).catch((error)=>{
                    console.log(error);
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                });
            }else{
                await apiRawMaterialQtyInUpdate({
                    values: formData,
                    ...{ id: rmQtyInId.rmqtyinid },
                }).then((data) => {
                    if (data.status === 200) {
                        formRef.current.setSubmitting(false)
                        console.log(data.data)
                        toast.push(
                            <Notification title="Success" type="success" closable>
                                {data.data['message']}
                            </Notification>
                        )
                        formRef.current.resetForm()
                        setRawMaterialQtyIn({
                            date_of_receipt: new Date(
                                data.data.rawMaterialIn.date_of_receipt
                            ),
                            vendor_id: data.data.rawMaterialIn.vendor_id,
                            depot_id: data.data.rawMaterialIn.depot_id,
                            purchase_order_id:
                                data.data.rawMaterialIn.purchase_order_id,
                            gate_pass_no: data.data.rawMaterialIn.gate_pass_no,
                            doc_document: [],
                            document_name:
                                data.data.rawMaterialIn.document_name != null
                                    ? data.data.rawMaterialIn.document_name.split(
                                          ' | '
                                      )
                                    : [],
                            rawMaterialInItems:
                                data.data.rawMaterialIn.rawMaterialInItems.map(
                                    (value) => {
                                        return {
                                            po_item_id: value.po_item_id,
                                            raw_material_id:
                                                value.raw_material['id'],
                                            raw_material_name:
                                                value.raw_material['rm_name'],
                                            po_quantity: value.po_quantity,
                                            no_of_boxes: value.no_of_boxes,
                                            qty: value.qty,
                                            itemWeights:
                                                value.rawMaterialInItemWeights.map(
                                                    (value) => {
                                                        return {
                                                            gross_weight:
                                                                value.gross_weight,
                                                            net_weight:
                                                                value.net_weight,
                                                            expiry_date:
                                                                value.expiry_date,
                                                            barcode: value.barcode,
                                                        }
                                                    }
                                                ),
                                            barcode:
                                                value.rawMaterialInItemWeights.map(
                                                    (v) => v.barcode
                                                ),
                                        }
                                    }
                                ),
                            remarks: data.data.rawMaterialIn.remarks,
                        })
                        // navigate(
                        //     '/transaction/raw-material-qty-in/edit-raw-material-qty-in/' +
                        //         data.data.rawMaterialIn.id
                        // )
                        // window.location.reload()
                        // setTimeout(() => {
                        //     navigate(
                        //         '/transaction/raw-material-qty-in/edit-raw-material-qty-in/' +
                        //             data.data.rawMaterialIn.id
                        //     )
                        // }, 2000)
                    } else if (data.status === 201) {
                        formRef.current.setSubmitting(false)
                        toast.push(
                            <Notification title="Success" type="success" closable>
                                {data.data['message']}
                            </Notification>
                        )
                        formRef.current.resetForm()
                        setTimeout(() => {
                            navigate(
                                '/transaction/raw-material-qty-in/edit-raw-material-qty-in/' +
                                    data.data.rawMaterialIn.id,
                                { replace: true }
                            )
                        }, 2000)
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
                    setIsOpen2(false)
                    setComponentLoading(false)
                })
            }
        } else {
            await apiRawMaterialQtyInPost(formData).then((data) => {
                console.log(data)
                if (data.status === 200) {
                    // console.log(data.data.rawMaterialIn.id)
                    formRef.current.setSubmitting(false)
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    formRef.current.resetForm()
                    setTimeout(() => {
                        navigate(
                            '/transaction/raw-material-qty-in/edit-raw-material-qty-in/' +
                                data.data.rawMaterialIn.id,
                            { replace: true }
                        )
                        setChangeDetails(true)
                    }, 2000)
                } else if (data.status === 201) {
                    formRef.current.setSubmitting(false)
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    formRef.current.resetForm()
                    setTimeout(() => {
                        navigate(
                            '/transaction/raw-material-qty-in/edit-raw-material-qty-in/' +
                                data.data.rawMaterialIn.id,
                            { replace: true }
                        )
                        setChangeDetails(true)
                    }, 2000)
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
                setIsOpen2(false)
                setComponentLoading(false)
            })
        }
    }

    console.log('AddEditRawMaterialQtyIn.js')
    return (
        <>
            <Formik
                enableReinitialize={true}
                initialValues={{
                    date_of_receipt: new Date(rawMaterialQtyIn.date_of_receipt),
                    vendor_id: rawMaterialQtyIn.vendor_id,
                    depot_id: rawMaterialQtyIn.depot_id,
                    purchase_order_id: rawMaterialQtyIn.purchase_order_id,
                    gate_pass_no: rawMaterialQtyIn.gate_pass_no,
                    doc_document:
                        rawMaterialQtyIn.doc_document == []
                            ? []
                            : rawMaterialQtyIn.doc_document,
                    document_name: rawMaterialQtyIn.document_name,
                    rawMaterialInItems:
                        rawMaterialQtyIn.rawMaterialInItems == []
                            ? []
                            : rawMaterialQtyIn.rawMaterialInItems,
                    remarks: rawMaterialQtyIn.remarks,
                }}
                innerRef={formRef}
                validationSchema={validationSchema}
                onSubmit={(values, { resetForm, setSubmitting }) => {
                    console.log(values)
                    setSubmitting(false)
                    // if()
                    const checkPopup = values.rawMaterialInItems.some(
                        (rawMaterialInItem) => {
                            if (rawMaterialInQtys.length > 0) {
                                return rawMaterialInQtys.some(
                                    (rawMaterialInQty) => {
                                        const total_in_qty =
                                            rawMaterialInQty.total_in_qty +
                                            rawMaterialInItem.qty
                                        if (
                                            rawMaterialInItem.po_item_id ===
                                                rawMaterialInQty.po_item_id &&
                                            rawMaterialInItem.po_quantity >
                                                total_in_qty
                                        ) {
                                            return rawMaterialInItem
                                        }
                                    }
                                )
                            } else {
                                return (
                                    rawMaterialInItem.po_quantity >
                                    rawMaterialInItem.qty
                                )
                            }
                        }
                    )

                    const checkBoxCount = values.rawMaterialInItems.some(
                        (box) => box.no_of_boxes > 0
                    )
                    if(actionBtn.approve){
                        handleSubmit(0)
                    }else{
                        if (checkBoxCount) {
                            if (checkPopup) {
                                setIsOpen2(true)
                            } else {
                                handleSubmit(0)
                            }
                        } else {
                            toast.push(
                                <Notification title="Error" type="danger" closable>
                                    Please Add At Least One Quantity
                                </Notification>
                            )
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
                    return (
                        <Form autoComplete="off" autoSave="off">
                            <AdaptableCard className="card-shadow mb-4">
                                <h5 className="mb-6">
                                    {' '}
                                    {rmQtyInId.rmqtyinid ? 'Edit' : 'Add'} Goods
                                    Received Note
                                </h5>
                                {/* <p className="mb-6">{purchaseId.purchaseid ? 'Edit' : 'Add'} basic details of Purchase</p> */}
                                <Loading loading={componentLoading}></Loading>
                                <FormContainer
                                    layout="horizontal"
                                    size="sm"
                                    className={
                                        componentLoading ? 'hidden' : 'visible'
                                    }
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-3">
                                        <FormItem
                                            asterisk
                                            label="Date"
                                            invalid={
                                                errors.date_of_receipt &&
                                                touched.date_of_receipt
                                            }
                                            errorMessage={
                                                errors.date_of_receipt
                                            }
                                        >
                                            <Field
                                                autoComplete="off"
                                                name="date_of_receipt"
                                            >
                                                {({ field, form }) => (
                                                    <DatePicker
                                                        inputFormat="DD-MM-YYYY"
                                                        // inputtable
                                                        // inputtableBlurClose={false}
                                                        field={field}
                                                        placeholder="Date"
                                                        maxDate={new Date()}
                                                        form={form}
                                                        value={
                                                            values.date_of_receipt
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
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
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
                                                            handleVendorChange(
                                                                option
                                                            )
                                                            return form.setFieldValue(
                                                                field.name,
                                                                option?.value
                                                            )
                                                        }}
                                                        isDisabled={
                                                            rmQtyInId.rmqtyinid
                                                                ? true
                                                                : false
                                                        }
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
                                                            handlePurchaseOrderChange(
                                                                option
                                                            )
                                                            return form.setFieldValue(
                                                                field.name,
                                                                option?.value
                                                            )
                                                        }}
                                                        isDisabled={
                                                            rmQtyInId.rmqtyinid
                                                                ? true
                                                                : false
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <div>
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
                                                            onChange={(
                                                                option
                                                            ) => {
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
                                        <div>
                                            <FormItem
                                                asterisk
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
                                                    name="gate_pass_no"
                                                    type="text"
                                                    placeholder="Gate Pass No."
                                                    component={Input}
                                                />
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
                                                                    multiple={
                                                                        true
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="absolute left-[80px] top-0">
                                                                <div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="solid"
                                                                        color="green-600"
                                                                        className={
                                                                            rawMaterialQtyIn.document_name ==
                                                                                null ||
                                                                            rawMaterialQtyIn.document_name ==
                                                                                ''
                                                                                ? 'hidden'
                                                                                : 'visible mr-2'
                                                                        }
                                                                        onClick={() =>
                                                                            download(
                                                                                rawMaterialQtyIn.document_name
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
                                                                            rawMaterialQtyIn.document_name ==
                                                                                null ||
                                                                            rawMaterialQtyIn.document_name ==
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
                                                                        rmQtyInId.rmqtyinid ?(<Button
                                                                        variant="solid"
                                                                        color="rose-600"
                                                                        type="button"
                                                                        className={
                                                                            rawMaterialQtyIn.document_name ==
                                                                                null ||
                                                                            rawMaterialQtyIn.document_name ==
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
                                    {/* <h5>Items Imformation</h5>
                                <p className="mb-6">{purchaseId.purchaseid ? 'Edit' : 'Add'} details of Items for purchase order</p> */}
                                    <Table compact className="border mb-6">
                                        <THead>
                                            <Tr>
                                                <Th>Sr. No.</Th>
                                                <Th>Items*</Th>
                                                <Th>Qty In Kg(As Per PO)</Th>
                                                <Th>No. Of Boxes*</Th>
                                                <Th>Net Weight</Th>
                                                <Th>Action</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="rawMaterialInItems">
                                                {({
                                                    field,
                                                    form,
                                                    remove,
                                                    push,
                                                }) => (
                                                    <>
                                                        {rawMaterialInItems &&
                                                        rawMaterialInItems.length >
                                                            0
                                                            ? rawMaterialInItems.map(
                                                                  (
                                                                      item_detail,
                                                                      index
                                                                  ) => {
                                                                      const no_of_boxes =
                                                                          fieldFeedback(
                                                                              form,
                                                                              `rawMaterialInItems[${index}].no_of_boxes`
                                                                          )
                                                                      const qty =
                                                                          fieldFeedback(
                                                                              form,
                                                                              `rawMaterialInItems[${index}].qty`
                                                                          )

                                                                      return (
                                                                          <Tr
                                                                              key={
                                                                                  index
                                                                              }
                                                                          >
                                                                              <Td width="60">
                                                                                  {index +
                                                                                      1}
                                                                              </Td>
                                                                              <Td className="custom-text-left">
                                                                                  {rawMaterialInItems[
                                                                                      index
                                                                                  ]
                                                                                      .raw_material_name
                                                                                      ? rawMaterialInItems[
                                                                                            index
                                                                                        ]
                                                                                            .raw_material_name
                                                                                      : ''}
                                                                              </Td>
                                                                              <Td width="150">
                                                                                  {rawMaterialInItems[
                                                                                      index
                                                                                  ]
                                                                                      .po_quantity
                                                                                      ? rawMaterialInItems[
                                                                                            index
                                                                                        ]
                                                                                            .po_quantity
                                                                                      : ''}
                                                                              </Td>
                                                                              <Td width="200">
                                                                                  <FormItem
                                                                                      className="mb-0"
                                                                                      invalid={
                                                                                          no_of_boxes.invalid
                                                                                      }
                                                                                      layout="vertical"
                                                                                      errorMessage={
                                                                                          no_of_boxes.errorMessage
                                                                                      }
                                                                                  >
                                                                                      <Field
                                                                                          name={`rawMaterialInItems[${index}].no_of_boxes`}
                                                                                      >
                                                                                          {({
                                                                                              field,
                                                                                              form,
                                                                                          }) => (
                                                                                              <Input
                                                                                                  //   invalid={
                                                                                                  //       no_of_boxes.invalid
                                                                                                  //   }
                                                                                                  type="number"
                                                                                                  placeholder="No. Of Boxes"
                                                                                                  field={
                                                                                                      field
                                                                                                  }
                                                                                                  form={
                                                                                                      form
                                                                                                  }
                                                                                                  value={
                                                                                                      values
                                                                                                          .rawMaterialInItems[
                                                                                                          index
                                                                                                      ]
                                                                                                          .no_of_boxes
                                                                                                  }
                                                                                                  onChange={(
                                                                                                      e
                                                                                                  ) => {
                                                                                                      handleChangeNoOfBoxes(
                                                                                                          index
                                                                                                      )
                                                                                                      return form.setFieldValue(
                                                                                                          field.name,
                                                                                                          e
                                                                                                              .target
                                                                                                              .value
                                                                                                      )
                                                                                                  }}
                                                                                              />
                                                                                          )}
                                                                                      </Field>
                                                                                  </FormItem>
                                                                              </Td>
                                                                              <Td width="150">
                                                                                  <FormItem
                                                                                      className="mb-0"
                                                                                      invalid={
                                                                                          qty.invalid
                                                                                      }
                                                                                      errorMessage={
                                                                                          qty.errorMessage
                                                                                      }
                                                                                      layout="vertical"
                                                                                  >
                                                                                      <Field
                                                                                          invalid={
                                                                                              qty.invalid
                                                                                          }
                                                                                          placeholder="Net Weight"
                                                                                          name={`rawMaterialInItems[${index}].qty`}
                                                                                          type="text"
                                                                                          component={
                                                                                              Input
                                                                                          }
                                                                                          disabled={
                                                                                              +true
                                                                                          }
                                                                                      />
                                                                                  </FormItem>
                                                                                  {/* {rawMaterialInItems[
                                                                                      index
                                                                                  ]
                                                                                      .net_weight
                                                                                      ? rawMaterialInItems[
                                                                                            index
                                                                                        ]
                                                                                            .net_weight
                                                                                      : ''} */}
                                                                              </Td>
                                                                              <Td width="250">
                                                                                  <Button
                                                                                      shape="circle"
                                                                                      size="sm"
                                                                                      className="mr-2 mb-3 lg:mb-0"
                                                                                      variant="solid"
                                                                                      color="amber-600"
                                                                                      type="button"
                                                                                      key={
                                                                                          index
                                                                                      }
                                                                                      onClick={() =>
                                                                                          openDialog(
                                                                                              rawMaterialInItems[
                                                                                                  index
                                                                                              ]
                                                                                                  .no_of_boxes,
                                                                                              index,
                                                                                              form
                                                                                          )
                                                                                      }
                                                                                  >
                                                                                      Insert
                                                                                      Qty
                                                                                  </Button>
                                                                                  {rawMaterialInItems[
                                                                                      index
                                                                                  ]
                                                                                      .barcode
                                                                                      .length >
                                                                                  0 ? (
                                                                                      <CreatePrintMultiple
                                                                                          code={
                                                                                              rawMaterialInItems[
                                                                                                  index
                                                                                              ]
                                                                                          }
                                                                                      />
                                                                                  ) : (
                                                                                      ' '
                                                                                  )}
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
                                <p className="mb-6">{purchaseId.purchaseid ? 'Edit' : 'Add'} final Purchase Order remark</p> */}
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
                                            navigate(
                                                '/transaction/raw-material-qty-in'
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
                isOpen={dialogIsOpen}
                shouldCloseOnOverlayClick={false}
                shouldCloseOnEsc={false}
                closable={false}
                contentClassName={'insert_item_box'}
                width={800}
            >
                <ItemBoxWeight data={dialogData} getData={getData} />
            </Dialog>
            <Dialog
                isOpen={dialogIsOpen2}
                onClose={onDialogClose}
                onRequestClose={onDialogClose}
            >
                <h5 className="mb-4">Partial PO</h5>
                <p>Do you want to Keep PO open ?</p>
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="solid"
                        color="red-600"
                        type="button"
                        onClick={onDialogClose1}
                    >
                        No
                    </Button>
                    <Button
                        variant="solid"
                        color="emerald-600"
                        type="button"
                        onClick={onDialogOk2}
                    >
                        Yes
                    </Button>
                </div>
            </Dialog>
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
                        {rawMaterialQtyIn.document_name.length > 0
                            ? rawMaterialQtyIn.document_name.map(
                                  (value, index) => (
                                      <ViewImages
                                          url={`${appConfig.uploadUrl}raw_material_in/${value}`}
                                          name={value}
                                          key={index}
                                      ></ViewImages>
                                  )
                              )
                            : ''}
                    </div>
                </div>
            </Dialog>
            <DeleteDocument id={rmQtyInId.rmqtyinid} documents={rawMaterialQtyIn.document_name} isOpen={isDeleteOpen} setIsDocumentOpen={closeOpenedDoc}/>

        </>
    )
}

export default AddEditRawMaterialQtyIn
