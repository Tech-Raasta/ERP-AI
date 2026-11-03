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
import '../PurchaseOrder/AddEditPurchaseOrder.css'
import NumberFormat from 'react-number-format'
import Upload from 'components/ui/Upload'
import toast from 'components/ui/toast'
import Checkbox from 'components/ui/Checkbox'
import Notification from 'components/ui/Notification'
import {
    apiFinanceVoucherApprove,
    apiFinanceVoucherGetMaasterData,
    apiFinanceVoucherGetSingle,
    apiFinanceVoucherPoDetails,
    apiFinanceVoucherPost,
    apiFinanceVoucherReject,
    apiFinanceVoucherUpdate,
    apiFinanceVoucherVendorPos,
    apiFinanceVoucherApprovalReject,
} from 'services/FinanceVoucherService'
import { saveAs } from 'file-saver'
import Moment from 'react-moment'
import JSZip from 'jszip'
import Dialog from 'components/ui/Dialog'
import ViewImages from './ViewImages'
import appConfig from 'configs/app.config'

const { Tr, Th, Td, THead, TBody } = Table

const validationSchema = Yup.object().shape({
    invoice_date: Yup.string().required('Invoice Date Is Required').nullable(),
    type: Yup.string().required('Payment Type Is Required'),
    vendor_id: Yup.string().required('Vendor Is Required'),
    depot_id: Yup.string().required('Depot Is Required'),
    invoice_no: Yup.string().required('Invoice No Is Required'),
    po_id: Yup.string().test((value, context) => {
        const { path } = context
        if (context.parent.type === 'Purchase') {
            if (value == undefined || value == "") {
                return context.createError({
                    path,
                    message: 'PO No Is Required',
                })
            } else {
                return true
            }
        } else {
            return true
        }
    }),
    po_no: Yup.string().test((value, context) => {
        const { path } = context
        if (context.parent.type === 'Expense') {
            if (value == undefined) {
                return context.createError({
                    path,
                    message: 'PO No Is Required',
                })
            } else {
                return true
            }
        } else {
            return true
        }
    }),
    date_of_processing: Yup.string().required('Payment Due Date Is Required'),
    paymentVoucherItems: Yup.array().of(
        Yup.object()
            .shape({
                particulars: Yup.string().required(' '),
                qty: Yup.number().required(' '),
                rate: Yup.number().required(' '),
                tax_per: Yup.number().required(' '),
                discount: Yup.number().required(' '),
            })
            .required('Details is Required')
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

const paymentType = [
    { value: 'Purchase', label: 'Purchase' },
    { value: 'Expense', label: 'Expense' },
]

const AddFinanceVoucher = () => {
    const [financeVoucherData, setFinanceVoucherData] = useState({
        invoice_date: new Date(), //YYYY-MM-DD
        vendor_id: '',
        type: '',
        depot_id: '',
        invoice_no: '',
        po_id: '',
        po_no: '',
        doc_document: [],
        document_name: [],
        date_of_processing: new Date(),
        pay_immediately: '',
        paymentVoucherItems: [],
        total_payable: '',
        round_off_amount: '',
        tds_per: '',
        tdsamount: '',
        final_amount: '',
        requested_by_user: '',
        created_on: '',
        remark: '',
        is_advance:0,
        exp_cat_id:'',
        exp_cat_name:''
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
        expenseCategories:[]
    })
    // let pOrders = []
    const [loading, setLoading] = useState(false)
    const financeVoucherId = useParams()
    const navigate = useNavigate()
    const formRef = useRef()

    const [isOpenDoc, setIsOpenDoc] = useState(false)

    const openDoc = () => {
        setIsOpenDoc(true)
    }

    const closeDoc = (e) => {
        console.log('onDialogClose', e)
        setIsOpenDoc(false)
    }

    const deleteFinanceVoucher = () => {
        if (formRef.current.values.remark.trim() === '') {
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Please Provide Reason For Rejection!!!
                </Notification>
            )
            formRef.current.setFieldError(
                'remark',
                'Please Provide Reason For Rejection'
            )
        } else {
            apiFinanceVoucherApprovalReject({
                values: formRef.current.values,
                ...{ id: financeVoucherId.financeid },
            })
                .then((data) => {
                    console.log(data)
                    if (data.status === 200) {
                        formRef.current.setSubmitting(false)
                        toast.push(
                            <Notification
                                title="Success"
                                type="success"
                                closable
                            >
                                {data.data['message']}
                            </Notification>
                        )
                        formRef.current.resetForm()
                        navigate('/transaction/finance-voucher')
                    } else if (data.response.status === 422) {
                        let errorData = data.response['data']['error']['errors']
                        for (const errMsg in errorData) {
                            formRef.current.setFieldError(
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
                            <Notification title="Error" type="danger" closable>
                                {error.response.data['message']}
                            </Notification>
                        )
                    }
                })
        }
    }

    const rejectFinanceVoucher = () => {
        apiFinanceVoucherReject({
            values: formRef.current.values,
            ...{ id: financeVoucherId.financeid },
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
                    navigate('/transaction/finance-voucher')
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

    const countTotal = () => {
        let total = 0
        let final_amount = 0
        formRef.current.values.paymentVoucherItems.map((value) => {
            if (value.total_amt > 0) {
                total += value.total_amt
            }
            return total
        })
        let amount = 0
        const tds_per = parseFloat(
            formRef.current.values['tds_per'] != null &&
                formRef.current.values['tds_per'] != ''
                ? formRef.current.values['tds_per']
                : 0
        )
        formRef.current.values.paymentVoucherItems.forEach((value) => {
            amount += value != null && value.amount != '' ? value.amount : 0
        })

        const tds_amount =
            (parseFloat(amount) * (isNaN(tds_per) ? 0 : tds_per)) / 100
        final_amount = total - (isNaN(tds_amount) ? 0 : tds_amount)
        let round =
            Math.round((Math.round(final_amount) - final_amount) * 100) / 100
        // Math.round(
        //     ( -
        //         Math.round((total - tds_amount) * 100) / 100) *
        //         100
        // ) / 100
        formRef.current.setFieldValue('tdsamount', tds_amount)
        formRef.current.setFieldValue('final_amount', total)
        formRef.current.setFieldValue('round_off_amount', round)
        formRef.current.setFieldValue('total_payable', Math.round(final_amount))
    }

    const handleTotal = (index) => {
        let amount = 0
        let tax_amount = 0
        let total_amount = 0
        let qty = parseFloat(
            formRef.current.values.paymentVoucherItems[index].qty != ''
                ? formRef.current.values.paymentVoucherItems[index].qty
                : 0
        )
        let rate = parseFloat(
            formRef.current.values.paymentVoucherItems[index].rate != ''
                ? formRef.current.values.paymentVoucherItems[index].rate
                : 0
        )
        let tax_per = parseFloat(
            formRef.current.values.paymentVoucherItems[index].tax_per != ''
                ? formRef.current.values.paymentVoucherItems[index].tax_per
                : 0
        )
        // let amt = parseFloat(
        //     formRef.current.values.paymentVoucherItems[index].amount != ''
        //         ? formRef.current.values.paymentVoucherItems[index].amount
        //         : 0)
        amount = (isNaN(qty) ? 0 : qty) * (isNaN(rate) ? 0 : rate)
        tax_amount = (parseFloat(amount) * (isNaN(tax_per) ? 0 : tax_per)) / 100
        total_amount = amount + tax_amount
        formRef.current.setFieldValue(
            `paymentVoucherItems[${index}].amount`,
            isNaN(amount) ? 0 : amount
        )
        formRef.current.setFieldValue(
            `paymentVoucherItems[${index}].tax_amt`,
            isNaN(tax_amount) ? 0 : tax_amount
        )
        formRef.current.setFieldValue(
            `paymentVoucherItems[${index}].total_amt`,
            isNaN(total_amount) ? 0 : total_amount
        )
        setTimeout(() => {
            countTotal()
        }, 100)
    }

    const calcTotal = (e, index) => {
        let val = parseFloat(e.target.value)
        let discount_rate = 0
        let new_rate = 0
        let total = 0
        discount_rate =
            (parseFloat(
                e.target.name == `paymentVoucherItems[${index}].rate`
                    ? !isNaN(val)
                        ? val
                        : 0
                    : formRef.current.values.paymentVoucherItems[index].rate
            ) *
                parseFloat(
                    e.target.name == `paymentVoucherItems[${index}].discount`
                        ? !isNaN(val)
                            ? val
                            : 0
                        : formRef.current.values.paymentVoucherItems[index]
                            .discount
                )) /
            100
        new_rate =
            parseFloat(
                e.target.name == `paymentVoucherItems[${index}].rate`
                    ? !isNaN(val)
                        ? val
                        : 0
                    : formRef.current.values.paymentVoucherItems[index].rate
            ) - parseFloat(discount_rate)
        total =
            parseFloat(
                e.target.name == `paymentVoucherItems[${index}].qty`
                    ? !isNaN(val)
                        ? val
                        : 0
                    : formRef.current.values.paymentVoucherItems[index].qty
            ) * parseFloat(new_rate)
        formRef.current.setFieldValue(
            `paymentVoucherItems[${index}].amount`,
            total != '' || total != null ? total : 0
        )
        let gst =
            (total *
                parseFloat(
                    formRef.current.values.paymentVoucherItems[index].tax_per
                )) /
            100
        let totalAmt = total + gst

        formRef.current.setFieldValue(
            `paymentVoucherItems[${index}].tax_amt`,
            gst != '' || gst != null ? gst : 0
        )
        formRef.current.setFieldValue(
            `paymentVoucherItems[${index}].total_amt`,
            totalAmt != '' || totalAmt != null ? totalAmt : 0
        )
        setTimeout(() => {
            countTotal()
        }, 100)
    }

    const handleQty = (e, index) => {
        let qty = parseFloat(e.target.value)
        formRef.current.setFieldValue(e.target.name, isNaN(qty) ? 0 : qty)
        setTimeout(() => {
            calcTotal(e, index)
        }, 100)
    }

    const handleRate = (e, index) => {
        let rate = parseFloat(e.target.value)
        formRef.current.setFieldValue(e.target.name, isNaN(rate) ? 0 : rate)
        // setTimeout(() => {
        //     handleTotal(index)
        // }, 100)
        setTimeout(() => {
            calcTotal(e, index)
        }, 100)
    }

    const handleGST = (e, index) => {
        // console.log(e)
        let gst = parseFloat(e.target.value)
        formRef.current.setFieldValue(e.target.name, isNaN(gst) ? 0 : gst)
        // setTimeout(() => {
        //     handleTotal(index)
        // }, 100)
        let amount = 0
        let tax_amount = 0
        let total_amount = 0
        let amt = parseFloat(
            formRef.current.values.paymentVoucherItems[index].amount != ''
                ? formRef.current.values.paymentVoucherItems[index].amount
                : 0
        )
        amount = isNaN(amt) ? 0 : amt
        tax_amount = (parseFloat(amount) * (isNaN(gst) ? 0 : gst)) / 100
        total_amount = amount + tax_amount
        formRef.current.setFieldValue(
            `paymentVoucherItems[${index}].amount`,
            isNaN(amount) ? 0 : amount
        )
        formRef.current.setFieldValue(
            `paymentVoucherItems[${index}].tax_amt`,
            isNaN(tax_amount) ? 0 : tax_amount
        )
        formRef.current.setFieldValue(
            `paymentVoucherItems[${index}].total_amt`,
            isNaN(total_amount) ? 0 : total_amount
        )
        setTimeout(() => {
            countTotal()
        }, 100)
    }

    const handleDiscount = (e, index) => {
        // console.log(e)
        let discount = parseFloat(e.target.value)
        formRef.current.setFieldValue(
            e.target.name,
            isNaN(discount) ? 0 : discount
        )
        setTimeout(() => {
            calcTotal(e, index)
        }, 100)
    }

    const calcTDS = (e) => {
        console.log(formRef.current.values)
        const tds_per = parseFloat(e.target.value)
        let amount = 0
        let final_amount = parseFloat(formRef.current.values.final_amount)
        formRef.current.values.paymentVoucherItems.forEach((value) => {
            amount += value.amount != '' || value != null ? value.amount : 0
        })
        const tds_amount =
            (parseFloat(amount) * (isNaN(tds_per) ? 0 : tds_per)) / 100
        formRef.current.setFieldValue('tds_per', isNaN(tds_per) ? 0 : tds_per)
        formRef.current.setFieldValue(
            'tdsamount',
            isNaN(tds_amount) ? 0 : tds_amount
        )
        const roundOff =
            Math.round(
                (Math.round(final_amount - tds_amount) -
                    Math.round((final_amount - tds_amount) * 100) / 100) *
                100
            ) / 100
        const net_amount = final_amount - tds_amount + roundOff
        formRef.current.setFieldValue(
            'round_off_amount',
            isNaN(roundOff) ? 0 : roundOff
        )
        formRef.current.setFieldValue(
            'total_payable',
            isNaN(net_amount) ? 0 : net_amount
        )
    }

    const calcRound = (e) => {
        const roundOff = parseFloat(e.target.value)
        formRef.current.setFieldValue(
            'round_off_amount',
            isNaN(roundOff) ? 0 : roundOff
        )
        const tds_amount = parseFloat(
            formRef.current.values.tdsamount != ''
                ? formRef.current.values.tdsamount
                : 0
        )
        const net_amount =
            formRef.current.values.final_amount -
            tds_amount +
            (isNaN(roundOff) ? 0 : roundOff)
        formRef.current.setFieldValue('total_payable', net_amount)
    }

    // const download = (url) => {
    //     saveAs(
    //         'https://erp.eatanytime.in/assets/uploads/finance_voucher/' + url,
    //         url
    //     )
    // }

    const download = async (urls) => {
        const zip = new JSZip()
        if (urls.length > 1) {
            const promises = urls.map(async (value) => {
                const res = await fetch(
                    `${appConfig.uploadUrl}finance_voucher/${value}`
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
                saveAs(content, 'finance-voucher-files.zip')
            })
        } else {
            urls.forEach((value, index) => {
                saveAs(
                    `${appConfig.uploadUrl}finance_voucher/${value}`,
                    value
                )
            })
        }
    }

    console.log('AddFinanceVoucher.js Loading....')

    const [checkLength, setCheckLength] = useState(1)

    useEffect(() => {
        const fetchData = () => {
            setLoading(true)
            if (financeVoucherId.financeid) {
                apiFinanceVoucherGetSingle(financeVoucherId.financeid)
                    .then((data) => {
                        if (data.status === 200) {
                            // console.log(data.data['paymentVoucher'])
                            console.log(formRef.current)
                            setActionBtn({
                                approve: data.data['action']['approve'],
                                update: data.data['action']['update'],
                                delete: data.data['action']['delete'],
                            })
                            setMasterOption({
                                vendors: data.data['masterData'].vendors.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.vendor_name,
                                            payment_due_days:
                                                value.payment_due_days,
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
                                purchaseOrders: data.data['masterData'].purchaseOrders.map((data) => {
                                    return {
                                        value: data.id,
                                        label: data.po_no,
                                    }
                                }),
                                expenseCategories: data.data['masterData'].expenseCategories.map((data) => {
                                    return {
                                        value:data.id,
                                        label:data.category
                                    }
                                })
                            })
                            // pOrders = []
                            // console.log(
                            //     data.data['paymentVoucher'].document_name.split(
                            //         '|'
                            //     )
                            // )
                            setFinanceVoucherData({
                                invoice_date: data.data['paymentVoucher'].invoice_date != null && data.data['paymentVoucher'].invoice_date != '' ? data.data['paymentVoucher'].invoice_date : new Date().toDateString(),
                                type: data.data['paymentVoucher'].type != null ? data.data['paymentVoucher'].type : '',
                                invoice_no: data.data['paymentVoucher'].invoice_no != null && data.data['paymentVoucher'].invoice_no != '' ? data.data['paymentVoucher'].invoice_no : '',
                                po_id: data.data['paymentVoucher'].po_id != null && data.data['paymentVoucher'].po_id != '' ? data.data['paymentVoucher'].po_id : '',
                                po_no: data.data['paymentVoucher'].po_no != null && data.data['paymentVoucher'].po_no != '' ? data.data['paymentVoucher'].po_no : '',
                                date_of_processing: data.data['paymentVoucher'].date_of_processing != null && data.data['paymentVoucher'].date_of_processing != '' ? data.data['paymentVoucher'].date_of_processing : new Date().toDateString(),
                                pay_immediately: data.data['paymentVoucher'].date_of_processing != null && data.data['paymentVoucher'].pay_immediately == 1 ? true : false,
                                vendor_id: data.data['paymentVoucher'].vendor_id != null && data.data['paymentVoucher'].vendor_id != '' ? data.data['paymentVoucher'].vendor_id : '',
                                depot_id: data.data['paymentVoucher'].depot_id != null && data.data['paymentVoucher'].depot_id != '' ? data.data['paymentVoucher'].depot_id : '',
                                document_name: data.data['paymentVoucher'].document_name != null ? data.data['paymentVoucher'].document_name.split(' | ') : [],
                                round_off_amount: data.data['paymentVoucher'].round_off_amount != null && data.data['paymentVoucher'].round_off_amount != '' ? data.data['paymentVoucher'].round_off_amount : '',
                                paymentVoucherItems: data.data['paymentVoucher'].paymentVoucherItems.length > 0 ? data.data['paymentVoucher'].paymentVoucherItems.map(
                                    (value, index) => {
                                        return {
                                            po_item_id: value.po_item_id != null ? value.po_item_id : '',
                                            particular_id: value.particular_id != null ? value.particular_id : '',
                                            particulars: value.particulars != null && value.particulars != '' ? value.particulars : '',
                                            qty: value.qty != null && value.qty != '' ? value.qty : 0,
                                            rate: value.rate != null && value.rate != '' ? value.rate : 0,
                                            tax_per: value.tax_per != null && value.tax_per != '' ? value.tax_per : 0,
                                            discount: value.discount != null && value.discount != '' ? value.discount : 0,
                                            amount: value.amount != null && value.amount != '' ? value.amount : 0,
                                            tax_amt: value.tax_amt != null && value.tax_amt != '' ? value.tax_amt : 0,
                                            total_amt: value.total_amt != null && value.total_amt != '' ? value.total_amt : 0,
                                            type: value.type != null && value.type != '' ? value.type : 'other',
                                        }
                                    }
                                ) : [],
                                total_payable: data.data['paymentVoucher'].total_payable != null && data.data['paymentVoucher'].total_payable != '' ? data.data['paymentVoucher'].total_payable : 0,
                                round_off_amount: data.data['paymentVoucher'].round_off_amount != null && data.data['paymentVoucher'].round_off_amount != '' ? data.data['paymentVoucher'].round_off_amount : 0,
                                tds_per: data.data['paymentVoucher'].tds_per != null && data.data['paymentVoucher'].tds_per != '' ? data.data['paymentVoucher'].tds_per : 0,
                                tdsamount: data.data['paymentVoucher'].tdsamount != null && data.data['paymentVoucher'].tdsamount != '' ? data.data['paymentVoucher'].tdsamount : 0,
                                final_amount: data.data['paymentVoucher'].final_amount != null && data.data['paymentVoucher'].final_amount != '' ? data.data['paymentVoucher'].final_amount : 0,
                                remark: data.data['paymentVoucher'].remark != null && data.data['paymentVoucher'].remark != '' ? data.data['paymentVoucher'].remark : '',
                                requested_by_user: data.data['paymentVoucher'].requested_by_user != null ? data.data['paymentVoucher'].requested_by_user['first_name'] != null ? data.data['paymentVoucher'].requested_by_user['last_name'] != null ? data.data['paymentVoucher'].requested_by_user['first_name'] + ' ' + data.data['paymentVoucher'].requested_by_user['last_name'] : data.data['paymentVoucher'].requested_by_user['first_name'] : '' : '',
                                created_on: data.data['paymentVoucher'].created_on != null ? data.data['paymentVoucher'].created_on : '',
                                is_advance: data.data['paymentVoucher'].is_advance != null ? data.data['paymentVoucher'].is_advance : 0,
                                exp_cat_id: data.data['paymentVoucher'].exp_cat_id != null && data.data['paymentVoucher'].exp_cat_id != '' ? data.data['paymentVoucher'].exp_cat_id : '',
                                exp_cat_name: data.data['paymentVoucher'].exp_cat_name != null ? data.data['paymentVoucher'].exp_cat_name : '',
                            })
                            // console.log(data.data['masterData'])

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
                apiFinanceVoucherGetMaasterData()
                    .then((data) => {
                        if (data.status === 200) {
                            console.log(data.data['masterData'])
                            setMasterOption({
                                vendors: data.data['masterData'].vendors.map(
                                    (value) => {
                                        return {
                                            value: value.id,
                                            label: value.vendor_name,
                                            payment_due_days:
                                                value.payment_due_days,
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
                                purchaseOrders: data.data['masterData']
                                    .purchaseOrders
                                    ? data.data['masterData'].purchaseOrders
                                    : [],
                                expenseCategories: data.data['masterData'].expenseCategories.map((data) => {
                                    return {
                                        value:data.id,
                                        label:data.category
                                    }
                                })
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
            }
            return true
        }
        fetchData()
    }, [])

    const changePurchaseType = (option) => {
        const date = new Date()
        console.log(option)
        formRef.current.setFieldValue('type', option.value)
        if (option.value === 'Expense') {
            formRef.current.setFieldValue(
                'date_of_processing',
                date.toDateString()
            )
            formRef.current.setFieldValue('paymentVoucherItems', [
                {
                    po_item_id: '',
                    particular_id: '',
                    particulars: '',
                    qty: '',
                    rate: '',
                    tax_per: 0,
                    discount: 0,
                    amount: '',
                    tax_amt: '',
                    total_amt: '',
                    type: 'other',
                },
            ])
        } else {
            formRef.current.setFieldValue('paymentVoucherItems', [])
        }
    }

    const handleChangeVendor = (option) => {
        // console.log(option)
        const curentDate = new Date().getTime()
        const dueDate =
            curentDate +
            (option.payment_due_days != null ? option.payment_due_days : 0) *
            24 *
            60 *
            60 *
            1000
        const finalDate = new Date(dueDate)
        formRef.current.setFieldValue(
            'date_of_processing',
            finalDate.toDateString()
        )

        apiFinanceVoucherVendorPos(option.value).then((data) => {
            if (data.status == 200) {
                setLoading(true)
                console.log(option)
                const { purchaseOrders } = data.data['purchaseOrders']
                console.log(data.data['purchaseOrders'])
                // pOrders = []
                formRef.current.setFieldValue('po_id', '')
                // if (purchaseOrders.length > 0) {
                setMasterOption((prev) => {
                    return {
                        ...prev,
                        purchaseOrders: purchaseOrders.map((data) => {
                            return {
                                value: data.id,
                                label: data.po_no,
                            }
                        }),
                    }
                })
                // }
                setLoading(false)
            }
        })
    }

    const changeVendor = (option) => {
        formRef.current.setFieldValue('vendor_id', option.value)
        handleChangeVendor(option)
    }

    const changePurchaseOrder = (option) => {
        formRef.current.setFieldValue('po_id', option.value)
        apiFinanceVoucherPoDetails(option.value)
            .then((data) => {
                if (data.status === 200) {
                    console.log(data.data)
                    const { purchaseOrder } = data.data
                    // console.log(purchaseOrder.purchaseOrderItems)
                    // console.log(purchaseOrder['depot_id'])
                    let itemData = []
                    if (purchaseOrder.purchaseOrderItems.length > 0) {
                        purchaseOrder.purchaseOrderItems.map((value) => {
                            itemData.push({
                                po_item_id: value.id != null ? value.id : '',
                                particular_id:
                                    value.item_id != null ? value.item_id : '',
                                particulars:
                                    value.raw_material.rm_name != null
                                        ? value.raw_material.rm_name
                                        : '',
                                qty: value.qty != null ? value.qty : 0,
                                rate: value.rate != null ? value.rate : 0,
                                tax_per:
                                    value.tax_per != null ? value.tax_per : 0,
                                discount: 0,
                                amount: value.amount != null ? value.amount : 0,
                                tax_amt:
                                    value.tax_amt != null ? value.tax_amt : 0,
                                total_amt:
                                    value.total_amt != null
                                        ? value.total_amt
                                        : 0,
                                type: 'item',
                            })
                        })
                    }
                    if (purchaseOrder.purchaseOrderOtherCharges.length > 0) {
                        purchaseOrder.purchaseOrderOtherCharges.map((value) => {
                            itemData.push({
                                po_item_id: value.id != null ? value.id : '',
                                particular_id:
                                    value.item_id != null ? value.item_id : '',
                                particulars:
                                    value.item_desc != null
                                        ? value.item_desc
                                        : '',
                                qty: 1,
                                rate: value.amount != null ? value.amount : 0,
                                tax_per:
                                    value.tax_per != null ? value.tax_per : 0,
                                discount: 0,
                                amount: value.amount != null ? value.amount : 0,
                                tax_amt:
                                    value.tax_amt != null ? value.tax_amt : 0,
                                total_amt:
                                    value.total_amt != null
                                        ? value.total_amt
                                        : 0,
                                type: 'other',
                            })
                        })
                    }
                    setCheckLength(itemData.length)
                    formRef.current.setFieldValue(
                        'paymentVoucherItems',
                        itemData
                    )
                    formRef.current.setFieldValue(
                        'total_payable',
                        purchaseOrder.total_amount
                    )
                    formRef.current.setFieldValue(
                        'round_off_amount',
                        purchaseOrder.round_off_amount
                    )
                    formRef.current.setFieldValue(
                        'final_amount',
                        purchaseOrder.po_amount
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

    return (
        <>
            <Formik
                enableReinitialize={true}
                initialValues={financeVoucherData}
                innerRef={formRef}
                validationSchema={validationSchema}
                onSubmit={(values, actions) => {
                    console.log(values)
                    const formData = new FormData()
                    for (const i in values) {
                        // console.log(i)
                        if (i === 'paymentVoucherItems') {
                            formData.append(i, JSON.stringify(values[i]))
                        } else if (i === 'doc_document') {
                            for (const val of values[i]) {
                                formData.append('doc_document', val)
                            }
                        } else if (i === 'invoice_date') {
                            formData.append(
                                i,
                                JSON.stringify(
                                    new Date(values[i]).toDateString()
                                )
                            )
                        } else if (i === 'date_of_processing') {
                            formData.append(
                                i,
                                JSON.stringify(
                                    new Date(values[i]).toDateString()
                                )
                            )
                        } else {
                            formData.append(i, values[i])
                        }
                    }
                    // setSubmitting(false)
                    if (financeVoucherId.financeid) {
                        if (actionBtn.approve) {
                            apiFinanceVoucherApprove({
                                values,
                                ...{ id: financeVoucherId.financeid },
                            })
                                .then((data) => {
                                    console.log(data)
                                    actions.setSubmitting(false)
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
                                        navigate('/transaction/finance-voucher')
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
                                    actions.setSubmitting(false)
                                })
                        } else {
                            apiFinanceVoucherUpdate({
                                values: formData,
                                ...{ id: financeVoucherId.financeid },
                            })
                                .then((data) => {
                                    actions.setSubmitting(false)
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
                                        navigate('/transaction/finance-voucher')
                                    } else if (data.response.status === 404) {
                                        toast.push(
                                            <Notification
                                                title="Error"
                                                type="danger"
                                                closable
                                            >
                                                {data.response.data['message']}
                                            </Notification>
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
                                    actions.setSubmitting(false)
                                })
                        }
                        // console.log(values)
                    } else {
                        console.log(values)
                        apiFinanceVoucherPost(formData)
                            .then((data) => {
                                actions.setSubmitting(false)
                                if (data.status === 201) {
                                    console.log(data)
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
                                    navigate('/transaction/finance-voucher')
                                } else if (data.response.status === 422) {
                                    let errorData =
                                        data.response['data']['error']['errors']
                                    for (const errMsg in errorData) {
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
                                console.log(error)
                                actions.setSubmitting(false)
                                let errorData =
                                    error.response['data']['error']['errors']
                                if (error.response.status === 422) {
                                    for (const errMsg in errorData) {
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
                                // if (error.response.status === 422) {
                                //     errorData.map((err) => {
                                //         // console.log(err);
                                //         actions.setFieldError(err.path, err.message)
                                //         toast.push(
                                //             <Notification
                                //                 title="Error"
                                //                 type="danger"
                                //                 closable
                                //             >
                                //                 {err.message}
                                //             </Notification>
                                //         )
                                //         return true
                                //     })
                                // } else if (error.response.status === 500) {
                                //     console.log(errorData)
                                //     toast.push(
                                //         <Notification
                                //             title="Error"
                                //             type="danger"
                                //             closable
                                //         >
                                //             {error.response.data['message']}
                                //         </Notification>
                                //     )
                                // }
                            })
                    }
                }}
            >
                {({
                    values,
                    touched,
                    errors,
                    resetForm,
                    isSubmitting,
                    setFieldValue,
                }) => {
                    const paymentVoucherItems = values.paymentVoucherItems
                    return (
                        <Form autoComplete="off" autoSave="off">
                            <AdaptableCard className="card-shadow mb-2">
                                <h5 className="mb-6">
                                    {' '}
                                    {financeVoucherId.financeid
                                        ? 'Edit'
                                        : 'Add'}{' '} {financeVoucherData.is_advance == 1 ? "Advance" : '' }
                                    Finance Voucher
                                </h5>
                                <FormContainer layout="horizontal" size="sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        <FormItem
                                            asterisk
                                            label="Purchase"
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
                                                        options={paymentType}
                                                        // onFocus={onFocus}
                                                        isLoading={loading}
                                                        value={paymentType.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.type
                                                        )}
                                                        onChange={(option) => {
                                                            changePurchaseType(
                                                                option
                                                            )
                                                        }}
                                                        isDisabled={
                                                            actionBtn.approve
                                                        }
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
                                                        onChange={(option) =>
                                                            changeVendor(option)
                                                        }
                                                        isDisabled={
                                                            actionBtn.approve
                                                        }
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
                                                        isDisabled={
                                                            actionBtn.approve
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
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
                                                            new Date(
                                                                values.invoice_date
                                                            )
                                                        }
                                                        onChange={(option) => {
                                                            // let date = new Date(
                                                            //     option
                                                            // )
                                                            return form.setFieldValue(
                                                                field.name,
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
                                        <div>
                                            <FormItem
                                                asterisk
                                                label="Invoice No."
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
                                        </div>
                                        <div>
                                            <div
                                                className={values.type !== 'Purchase' ? 'hidden' : 'visible'}
                                            >
                                                <FormItem
                                                    asterisk
                                                    label="PO No."
                                                    invalid={errors.po_id && touched.po_id}
                                                    errorMessage={errors.po_id}
                                                >
                                                    <Field name="po_id">
                                                        {({ field, form }) => (
                                                            <Select
                                                                field={field}
                                                                form={form}
                                                                options={masterOption.purchaseOrders}
                                                                // onFocus={onFocus}
                                                                isLoading={loading}
                                                                value={masterOption.purchaseOrders.filter((option) => option.value === values.po_id)}
                                                                onChange={(option) => {changePurchaseOrder(option)}}
                                                                isDisabled={actionBtn.approve}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                            </div>
                                            <div
                                                className={ values.type !== 'Expense' ? 'hidden' : 'visible' }
                                            >
                                                <FormItem
                                                    asterisk
                                                    label="PO No."
                                                    invalid={
                                                        errors.po_no &&
                                                        touched.po_no
                                                    }
                                                    errorMessage={errors.po_no}
                                                >
                                                    <Field
                                                        type="text"
                                                        name="po_no"
                                                        placeholder="PO No."
                                                        component={Input}
                                                        disabled={
                                                            actionBtn.approve
                                                        }
                                                    />
                                                </FormItem>
                                            </div>
                                            <div
                                                className={
                                                    values.type !== ''
                                                        ? 'hidden'
                                                        : 'visible'
                                                }
                                            ></div>
                                        </div>
                                        {/* Expense Category */}
                                        <FormItem
                                            asterisk
                                            label="Expense Category"
                                            invalid={
                                                errors.exp_cat_id &&
                                                touched.exp_cat_id
                                            }
                                            errorMessage={errors.exp_cat_id}
                                        >
                                            <Field name="exp_cat_id">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={
                                                            masterOption.expenseCategories
                                                        }
                                                        // onFocus={onFocus}
                                                        isLoading={loading}
                                                        value={masterOption.expenseCategories.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.exp_cat_id
                                                        )}
                                                        onChange={(option) => {
                                                            console.log(option)
                                                            form.setFieldValue(
                                                                field.name,
                                                                option?.value
                                                            );
                                                            form.setFieldValue(
                                                                'exp_cat_name',
                                                                option?.label
                                                            )
                                                        }}
                                                        isDisabled={
                                                            actionBtn.approve
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Payment Due Date"
                                            invalid={
                                                errors.date_of_processing &&
                                                touched.date_of_processing
                                            }
                                            errorMessage={
                                                errors.date_of_processing
                                            }
                                        >
                                            <Field
                                                autoComplete="off"
                                                name="date_of_processing"
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
                                                            new Date(
                                                                values.date_of_processing
                                                            )
                                                        }
                                                        onChange={(option) => {
                                                            return form.setFieldValue(
                                                                field.name,
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
                                        <div>
                                            <FormItem
                                                label="Files"
                                                invalid={
                                                    errors.doc_document &&
                                                    touched.doc_document
                                                }
                                                errorMessage={
                                                    errors.doc_document
                                                }
                                            >
                                                <Field name="doc_document">
                                                    {({ field, form }) => (
                                                        <div className="relative">
                                                            <div>
                                                                <Upload
                                                                    beforeUpload={beforeUpload}
                                                                    fileList={values.doc_document}
                                                                    onChange={(files) => form.setFieldValue(field.name, files)}
                                                                    onFileRemove={(files) =>form.setFieldValue(field.name, files)}
                                                                    disabled={actionBtn.approve}
                                                                    multiple
                                                                />
                                                            </div>
                                                            <div
                                                                className={'absolute left-[80px] top-0 ' + (financeVoucherData.document_name.length > 0 ? 'visible': 'hidden')}
                                                            >
                                                                <Button
                                                                    type="button"
                                                                    variant="solid"
                                                                    color="green-600"
                                                                    className={ financeVoucherData.document_name == null || financeVoucherData.document_name == '' ? 'hidden' : 'visible mr-2'}
                                                                    onClick={() => download(financeVoucherData.document_name)}
                                                                >
                                                                    Download All
                                                                </Button>
                                                                <Button
                                                                    variant="solid"
                                                                    color="blue-600"
                                                                    type="button"
                                                                    className={financeVoucherData.document_name == null || financeVoucherData.document_name == '' ? 'hidden' : 'visible'}
                                                                    onClick={() =>openDoc()}
                                                                >
                                                                    View
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Field>
                                            </FormItem>
                                        </div>

                                    </div>
                                    <Table compact className="border mb-6">
                                        <THead>
                                            <Tr>
                                                <Th>Items*</Th>
                                                <Th>Qty In Kg*</Th>
                                                <Th>Rate</Th>
                                                <Th>GST Rate</Th>
                                                <Th>Discount</Th>
                                                <Th>Amount</Th>
                                                <Th>GST</Th>
                                                <Th>Total Amount</Th>
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
                                            <FieldArray name="paymentVoucherItems">
                                                {({ form, remove, push }) => (
                                                    <>
                                                        {paymentVoucherItems &&
                                                            paymentVoucherItems.length >
                                                            0
                                                            ? paymentVoucherItems.map(
                                                                (
                                                                    item_detail,
                                                                    index
                                                                ) => {
                                                                    const particulars =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `paymentVoucherItems[${index}].particulars`
                                                                        )
                                                                    const tax_per =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `paymentVoucherItems[${index}].tax_per`
                                                                        )
                                                                    const qty =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `paymentVoucherItems[${index}].qty`
                                                                        )
                                                                    const rate =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `paymentVoucherItems[${index}].rate`
                                                                        )
                                                                    const discount =
                                                                        fieldFeedback(
                                                                            form,
                                                                            `paymentVoucherItems[${index}].discount`
                                                                        )
                                                                    return (
                                                                        <Tr
                                                                            key={
                                                                                index
                                                                            }
                                                                        >
                                                                            <Td width="350">
                                                                                <FormItem
                                                                                    className="mb-0"
                                                                                    invalid={
                                                                                        particulars.invalid
                                                                                    }
                                                                                    layout="vertical"
                                                                                    errorMessage={
                                                                                        particulars.errorMessage
                                                                                    }
                                                                                >
                                                                                    <Field
                                                                                        invalid={
                                                                                            particulars.invalid
                                                                                        }
                                                                                        placeholder="Item Name"
                                                                                        name={`paymentVoucherItems[${index}].particulars`}
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
                                                                                        placeholder="Quantity"
                                                                                        name={`paymentVoucherItems[${index}].qty`}
                                                                                        type="number"
                                                                                        onWheel={(
                                                                                            e
                                                                                        ) =>
                                                                                            e.target.blur()
                                                                                        }
                                                                                        component={
                                                                                            Input
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) => {
                                                                                            handleQty(
                                                                                                e,
                                                                                                index
                                                                                            )
                                                                                        }}
                                                                                        disabled={
                                                                                            actionBtn.approve
                                                                                        }
                                                                                    />
                                                                                </FormItem>
                                                                            </Td>
                                                                            <Td width="120">
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
                                                                                        name={`paymentVoucherItems[${index}].rate`}
                                                                                        type="number"
                                                                                        onWheel={(
                                                                                            e
                                                                                        ) =>
                                                                                            e.target.blur()
                                                                                        }
                                                                                        component={
                                                                                            Input
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) => {
                                                                                            handleRate(
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
                                                                            <Td width="100">
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
                                                                                        name={`paymentVoucherItems[${index}].tax_per`}
                                                                                        type="number"
                                                                                        onWheel={(
                                                                                            e
                                                                                        ) =>
                                                                                            e.target.blur()
                                                                                        }
                                                                                        component={
                                                                                            Input
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) => {
                                                                                            handleGST(
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
                                                                            <Td width="100">
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
                                                                                        name={`paymentVoucherItems[${index}].discount`}
                                                                                        type="number"
                                                                                        onWheel={(
                                                                                            e
                                                                                        ) =>
                                                                                            e.target.blur()
                                                                                        }
                                                                                        component={
                                                                                            Input
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) => {
                                                                                            handleDiscount(
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
                                                                            <Td width="150">
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
                                                                                            paymentVoucherItems[
                                                                                                index
                                                                                            ]
                                                                                                .amount !=
                                                                                                '' ||
                                                                                                paymentVoucherItems[
                                                                                                    index
                                                                                                ]
                                                                                                    .amount !=
                                                                                                null
                                                                                                ? paymentVoucherItems[
                                                                                                    index
                                                                                                ]
                                                                                                    .amount
                                                                                                : 0
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
                                                                            </Td>
                                                                            <Td width="150">
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
                                                                                            paymentVoucherItems[
                                                                                                index
                                                                                            ]
                                                                                                .tax_amt !=
                                                                                                '' ||
                                                                                                paymentVoucherItems[
                                                                                                    index
                                                                                                ]
                                                                                                    .tax_amt !=
                                                                                                null
                                                                                                ? paymentVoucherItems[
                                                                                                    index
                                                                                                ]
                                                                                                    .tax_amt
                                                                                                : 0
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
                                                                            </Td>
                                                                            <Td width="150">
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
                                                                                            paymentVoucherItems[
                                                                                                index
                                                                                            ]
                                                                                                .total_amt !=
                                                                                                '' ||
                                                                                                paymentVoucherItems[
                                                                                                    index
                                                                                                ]
                                                                                                    .total_amt !=
                                                                                                null
                                                                                                ? paymentVoucherItems[
                                                                                                    index
                                                                                                ]
                                                                                                    .total_amt
                                                                                                : 0
                                                                                        }
                                                                                        allowLeadingZeros
                                                                                        thousandSeparator=","
                                                                                    />
                                                                                </p>
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
                                                                                    icon={
                                                                                        <HiMinus />
                                                                                    }
                                                                                    onClick={() =>
                                                                                        remove(
                                                                                            index
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        index ==
                                                                                            0 ||
                                                                                            values.type ===
                                                                                            'purchase'
                                                                                            ? true
                                                                                            : false
                                                                                    }
                                                                                />
                                                                            </Td>
                                                                        </Tr>
                                                                    )
                                                                }
                                                            )
                                                            : null}
                                                        <Tr
                                                            className={
                                                                actionBtn.approve ||
                                                                    values.type ===
                                                                    'purchase'
                                                                    ? 'hidden'
                                                                    : 'visible'
                                                            }
                                                        >
                                                            <Td
                                                                colSpan="8"
                                                                className="custom-text-left"
                                                            >
                                                                <Button
                                                                    type="button"
                                                                    className="ltr:mr-2 rtl:ml-2"
                                                                    onClick={() => {
                                                                        push({
                                                                            po_item_id:
                                                                                '',
                                                                            particular_id:
                                                                                '',
                                                                            particulars:
                                                                                '',
                                                                            qty: '',
                                                                            rate: '',
                                                                            tax_per: 0,
                                                                            discount: 0,
                                                                            amount: '',
                                                                            tax_amt:
                                                                                '',
                                                                            total_amt:
                                                                                '',
                                                                            type: 'other',
                                                                        })
                                                                    }}
                                                                >
                                                                    Add Item
                                                                </Button>
                                                            </Td>
                                                        </Tr>
                                                        <Tr>
                                                            <Td colSpan="5"></Td>
                                                            <Td colSpan="2">
                                                                Total Amount
                                                            </Td>
                                                            <Td>
                                                                <NumberFormat
                                                                    displayType="text"
                                                                    prefix={'₹'}
                                                                    thousandsGroupStyle={
                                                                        'lakh'
                                                                    }
                                                                    decimalScale={
                                                                        2
                                                                    }
                                                                    value={
                                                                        values.final_amount !=
                                                                            '' ||
                                                                            values.final_amount !=
                                                                            null
                                                                            ? values.final_amount
                                                                            : 0
                                                                    }
                                                                    allowLeadingZeros
                                                                    thousandSeparator=","
                                                                />
                                                            </Td>
                                                            <Td
                                                                className={
                                                                    actionBtn.approve
                                                                        ? 'hidden'
                                                                        : 'visible'
                                                                }
                                                            ></Td>
                                                        </Tr>
                                                        <Tr>
                                                            <Td colSpan="5"></Td>
                                                            <Td colSpan="1">
                                                                TDS(%)
                                                            </Td>
                                                            <Td>
                                                                <FormItem
                                                                    className="mb-0"
                                                                    invalid={
                                                                        errors.tds_per &&
                                                                        touched.tds_per
                                                                    }
                                                                    layout="vertical"
                                                                    errorMessage={
                                                                        errors.tds_per
                                                                    }
                                                                >
                                                                    <Field name="tds_per">
                                                                        {({
                                                                            form,
                                                                            field,
                                                                        }) => (
                                                                            <Input
                                                                                type="number"
                                                                                placeholder="TDS %"
                                                                                layout="vertical"
                                                                                className="mb-0"
                                                                                size="sm"
                                                                                suffix="%"
                                                                                value={
                                                                                    values.tds_per
                                                                                }
                                                                                onWheel={(
                                                                                    e
                                                                                ) =>
                                                                                    e.target.blur()
                                                                                }
                                                                                onChange={(
                                                                                    e
                                                                                ) => {
                                                                                    calcTDS(
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
                                                            <Td>
                                                                <NumberFormat
                                                                    displayType="text"
                                                                    prefix={'₹'}
                                                                    thousandsGroupStyle={
                                                                        'lakh'
                                                                    }
                                                                    decimalScale={
                                                                        2
                                                                    }
                                                                    value={
                                                                        values.tdsamount !=
                                                                            '' ||
                                                                            values.tdsamount !=
                                                                            null
                                                                            ? values.tdsamount
                                                                            : 0
                                                                    }
                                                                    allowLeadingZeros
                                                                    thousandSeparator=","
                                                                />
                                                            </Td>
                                                            <Td
                                                                className={
                                                                    actionBtn.approve
                                                                        ? 'hidden'
                                                                        : 'visible'
                                                                }
                                                            ></Td>
                                                        </Tr>
                                                        <Tr>
                                                            <Td colSpan="5"></Td>
                                                            <Td colSpan="2">
                                                                Round Off Amount
                                                            </Td>
                                                            <Td>
                                                                <FormItem
                                                                    className="mb-0"
                                                                    invalid={
                                                                        errors.round_off_amount &&
                                                                        touched.round_off_amount
                                                                    }
                                                                    layout="vertical"
                                                                    errorMessage={
                                                                        errors.round_off_amount
                                                                    }
                                                                >
                                                                    <Field name="round_off_amount">
                                                                        {({
                                                                            form,
                                                                            field,
                                                                        }) => (
                                                                            <Input
                                                                                type="number"
                                                                                placeholder="Round Off"
                                                                                layout="vertical"
                                                                                className="mb-0"
                                                                                size="sm"
                                                                                prefix="₹"
                                                                                value={
                                                                                    values.round_off_amount !=
                                                                                        '' ||
                                                                                        values.round_off_amount !=
                                                                                        null
                                                                                        ? values.round_off_amount
                                                                                        : 0
                                                                                }
                                                                                onWheel={(
                                                                                    e
                                                                                ) =>
                                                                                    e.target.blur()
                                                                                }
                                                                                onChange={(
                                                                                    e
                                                                                ) => {
                                                                                    calcRound(
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
                                                            <Td
                                                                className={
                                                                    actionBtn.approve
                                                                        ? 'hidden'
                                                                        : 'visible'
                                                                }
                                                            ></Td>
                                                        </Tr>
                                                        <Tr>
                                                            <Td colSpan="5"></Td>
                                                            <Td colSpan="2">
                                                                Final Amount
                                                            </Td>
                                                            <Td>
                                                                <NumberFormat
                                                                    displayType="text"
                                                                    prefix={'₹'}
                                                                    thousandsGroupStyle={
                                                                        'lakh'
                                                                    }
                                                                    decimalScale={
                                                                        2
                                                                    }
                                                                    value={
                                                                        values.total_payable !=
                                                                            '' ||
                                                                            values.total_payable !=
                                                                            null
                                                                            ? values.total_payable
                                                                            : 0
                                                                    }
                                                                    allowLeadingZeros
                                                                    thousandSeparator=","
                                                                />
                                                            </Td>
                                                            <Td
                                                                className={
                                                                    actionBtn.approve
                                                                        ? 'hidden'
                                                                        : 'visible'
                                                                }
                                                            ></Td>
                                                        </Tr>
                                                    </>
                                                )}
                                            </FieldArray>
                                        </TBody>
                                    </Table>
                                    <div className="grid grid-cols-3 gap-x-8 gap-y-2">
                                        <FormItem
                                            label="Remark"
                                            invalid={
                                                errors.remark && touched.remark
                                            }
                                            errorMessage={errors.remark}
                                        >
                                            <Field name="remark">
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
                                        <div>
                                            <p className="mt-1">
                                                <b>Requested By : </b>
                                                {
                                                    financeVoucherData.requested_by_user
                                                }
                                            </p>
                                        </div>
                                        <div>
                                            <p className="mt-1">
                                                <b>Requested On : </b>
                                                <Moment
                                                    format="DD-MM-YYYY"
                                                    className={
                                                        financeVoucherData.created_on ===
                                                            ''
                                                            ? 'hidden'
                                                            : 'visible'
                                                    }
                                                >
                                                    {
                                                        financeVoucherData.created_on
                                                    }
                                                </Moment>
                                            </p>
                                        </div>
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
                                        disabled={isSubmitting}
                                        onClick={() => rejectFinanceVoucher()}
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
                                        onClick={() => deleteFinanceVoucher()}
                                        disabled={isSubmitting}
                                        className={
                                            'ltr:mr-3 rtl:ml-3 ' +
                                            (actionBtn.delete ? '' : 'hidden')
                                        }
                                    >
                                        Reject
                                    </Button>
                                    <Button
                                        size="sm"
                                        type="button"
                                        onClick={() =>
                                            navigate(
                                                '/transaction/finance-voucher'
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
            {isOpenDoc && (<Dialog
                isOpen={isOpenDoc}
                onClose={closeDoc}
                onRequestClose={closeDoc}
                contentClassName="pb-0 pt-0 px-0 mt-8 mb-8"
                width={1200}
                height={`90vh`}
            >
                <div className="flex flex-col h-full justify-between">
                    <div className="overflow-y-auto">
                        {financeVoucherData.document_name.length > 0
                            ? financeVoucherData.document_name.map(
                                (value, index) => (
                                    <ViewImages
                                        url={`${appConfig.uploadUrl}finance_voucher/${value}`}
                                        name={value}
                                        key={index}
                                    ></ViewImages>
                                )
                            )
                            : ''}
                    </div>
                </div>
            </Dialog>)}
        </>
    )
}

export default AddFinanceVoucher
