import React, { useEffect, useState } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import NumberFormat from 'react-number-format'
import StickyFooter from 'components/shared/StickyFooter'
import Button from 'components/ui/Buttons'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import './AddEditFinanceVoucher.css'
import {
    apiFinanceVoucherApprovalReject,
    apiFinanceVoucherApprovalUpdate,
    apiFinanceVoucherApprove,
    apiFinanceVoucherGetSingle,
    apiFinanceVoucherReject,
} from 'services/FinanceVoucherService'
import { useNavigate, useParams } from 'react-router-dom'
import Moment from 'react-moment'
import Loading from 'components/shared/Loading'
import { Input } from 'components/ui'
import ShowImages from './ShowImages'
import DatePicker from 'components/ui/DatePicker'
const AddEditFinanceVoucher = () => {
    const financeVoucherId = useParams()
    const navigate = useNavigate()
    const [documents, setDocuments] = useState([])
    const [pVoucherData, setPVoucherData] = useState({
        id: 0,
        date_of_processing: new Date(),
        purchase_order: '',
        vendor_state: '',
        default_state: '',
        vendor_id: 0,
        requestor_id: 0,
        tds_per: 0,
        total_payable: 0,
        final_amount: 0,
        voucher_no: 0,
        invoice_date: new Date(),
        invoice_no: '',
        type_use: '',
        type: '',
        po_no: '',
        attached: '',
        tdsamount: 0,
        po_id: 0,
        po_status: '',
        other_charges_amount: 0,
        other_charges: '',
        po_previous_state: '',
        vendor_name: '',
        gst_in: '',
        tax_type: '',
        pay_immediately: 0,
        raw_material_in_id: 0,
        requested_by_user: '',
        status: '',
        remark: '',
    })
    const [voucherData, setVoucherData] = useState({
        id: '',
        date_of_receipt: new Date(),
        purchase_order_id: '',
        depot_id: '',
        vendor_id: '',
        tax_type: '',
        amt: '',
        cgst_amt: '',
        sgst_amt: '',
        igst_amt: '',
        tax_amt: '',
        total_amt: '',
        round_off_amt: '',
        final_amount: '',
        gate_pass_no: '',
        raw_material_in_no: '',
        doc_document: '',
        document_name: '',
        partial_po: '',
        invoice_date: '',
        payment_due_date: '',
        pay_immediately: '',
        invoice_no: '',
        status: '',
        remarks: '',
        created_by: '',
        modified_by: '',
        approved_by: '',
        approved_on: '',
        rejected_by: '',
        rejected_on: '',
        ref_id: '',
        created_on: '',
        modified_on: '',
        rawMaterialInItems: [
            {
                id: '',
                raw_material_in_id: '',
                raw_material_id: '',
                hsn_code: '',
                item_desc: '',
                discount: '',
                qty: '',
                rate: '',
                tax_per: '',
                amount: '',
                cgst_amt: '',
                sgst_amt: '',
                igst_amt: '',
                tax_amt: '',
                total_amt: '',
                po_quantity: '',
                po_rate: '',
                po_amount: '',
                po_cgst_amt: '',
                po_sgst_amt: '',
                po_igst_amt: '',
                po_tax_amt: '',
                po_total_amt: '',
                no_of_boxes: '',
                gross_weight: '',
                difference: '',
                po_item_id: '',
                tax_type: '',
                raw_material: {
                    id: '',
                    rm_name: '',
                    hsn_code: '',
                },
            },
        ],
        rawMaterialInOtherCharges: [
            {
                amount: '',
                cgst_amt: '',
                difference: '',
                gross_weight: '',
                hsn_code: '',
                id: '',
                igst_amt: '',
                item_desc: '',
                no_of_boxes: '',
                po_amount: '',
                po_cgst_amt: '',
                po_igst_amt: '',
                po_item_id: '',
                po_quantity: '',
                po_rate: '',
                po_sgst_amt: '',
                po_tax_amt: '',
                po_total_amt: '',
                qty: '',
                rate: '',
                raw_material_id: '',
                raw_material_in_id: '',
                sgst_amt: '',
                tax_amt: '',
                tax_per: '',
                tax_type: '',
                total_amt: '',
            },
        ],
        vendor: {
            id: '',
            vendor_name: '',
            address: '',
            city: '',
            pincode: '',
            state: '',
            country: '',
            gst_number: '',
        },
        depot: {
            id: 2,
            depot_name: '',
            address: '',
            city: '',
            pincode: '',
            state: '',
            country: '',
            gst_no: '',
        },
        created_by_user: {
            id: '',
            first_name: '',
            last_name: '',
        },
        modified_by_user: {
            id: '',
            first_name: '',
            last_name: '',
        },
        approved_by_user: {
            id: '',
            first_name: '',
            last_name: '',
        },
    })
    const [tds, setTds] = useState(0)
    const [grossAmount, setGrossAmount] = useState(0)
    const [roundOff, setRoundOff] = useState(0)
    const [loading, setLoading] = useState(false)
    const [invoiceNo, setInvoiceNo] = useState('')
    const [dateOfProcessing, setDateOfProcessing] = useState('')
    const [invoiceDate, setInvoiceDate] = useState('')
    const [remark, setRemark] = useState('')

    const [actionBtn, setActionBtn] = useState({
        approve: false,
        delete: false,
        update: false,
    })

    const update = () => {
        // console.log(financeVoucherId)
        const values = {
            tds_per: tds,
            tdsamount: pVoucherData.tdsamount,
            round_off_amount: roundOff,
            total_payable: pVoucherData.total_payable,
            final_amount: voucherData.total_amt,
            invoice_no: invoiceNo,
            invoice_date: new Date(invoiceDate).toDateString(),
            date_of_processing: new Date(dateOfProcessing).toDateString(),
            remark,
        }
        console.log(grossAmount, voucherData.total_amt)
        if (grossAmount == voucherData.total_amt) {
            apiFinanceVoucherApprovalUpdate({
                values,
                ...{ id: financeVoucherId.voucherid },
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
                        navigate('/transaction/finance-voucher')
                    } else if (data.response.status === 422) {
                        let errorData = data.response['data']['error']['errors']
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
                            <Notification title="Error" type="danger" closable>
                                {error.response.data['message']}
                            </Notification>
                        )
                    }
                })
        } else {
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Total Amount Does Not Match With Requestor Amount
                </Notification>
            )
        }
        return true
    }

    const reject = () => {
        console.log(financeVoucherId)
        if (remark.trim() === '') {
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Please Provide Reason For Rejection
                </Notification>
            )
        } else {
            const values = {
                tds_per: tds,
                tdsamount: pVoucherData.tdsamount,
                round_off_amount: roundOff,
                total_payable: pVoucherData.total_payable,
                final_amount: voucherData.total_amt,
                invoice_no: invoiceNo,
                invoice_date: new Date(invoiceDate).toDateString(),
                date_of_processing: new Date(dateOfProcessing).toDateString(),
                remark,
            }
            apiFinanceVoucherApprovalReject({
                values,
                ...{ id: financeVoucherId.voucherid },
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
                        navigate('/transaction/finance-voucher')
                    } else if (data.response.status === 422) {
                        let errorData = data.response['data']['error']['errors']
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
                            <Notification title="Error" type="danger" closable>
                                {error.response.data['message']}
                            </Notification>
                        )
                    }
                })
            return true
        }
    }

    const approved = () => {
        console.log(financeVoucherId)
        const values = {
            tds_per: tds,
            tdsamount: pVoucherData.tdsamount,
            round_off_amount: roundOff,
            total_payable: pVoucherData.total_payable,
            final_amount: voucherData.total_amt,
            invoice_no: invoiceNo,
            invoice_date: new Date(invoiceDate).toDateString(),
            date_of_processing: new Date(dateOfProcessing).toDateString(),
            remark,
        }
        apiFinanceVoucherApprove({
            values,
            ...{ id: financeVoucherId.voucherid },
        })
            .then((data) => {
                console.log(data)
                if (data.status === 200) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    navigate('/transaction/finance-voucher')
                } else if (data.response.status === 422) {
                    let errorData = data.response['data']['error']['errors']
                    for (const errMsg in errorData) {
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
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {errorData[errMsg]['message']}
                            </Notification>
                        )
                    }
                } else if (error.response.status === 500) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                }
            })
        return true
    }

    const rejected = () => {
        const values = {
            tds_per: tds,
            tdsamount: pVoucherData.tdsamount,
            round_off_amount: roundOff,
            total_payable: pVoucherData.total_payable,
            final_amount: voucherData.total_amt,
            invoice_no: invoiceNo,
            invoice_date: new Date(invoiceDate).toDateString(),
            date_of_processing: new Date(dateOfProcessing).toDateString(),
            remark,
        }
        apiFinanceVoucherReject({
            values,
            ...{ id: financeVoucherId.voucherid },
        })
            .then((data) => {
                console.log(data)
                if (data.status === 200) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    navigate('/transaction/finance-voucher')
                } else if (data.response.status === 422) {
                    let errorData = data.response['data']['error']['errors']
                    for (const errMsg in errorData) {
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
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {errorData[errMsg]['message']}
                            </Notification>
                        )
                    }
                } else if (error.response.status === 500) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                }
            })
        return true
    }

    console.log('AddEditFinanceVoucher.js Loading....')
    useEffect(() => {
        setLoading(true)
        const fetchData = () => {
            apiFinanceVoucherGetSingle(financeVoucherId.voucherid)
                .then((data) => {
                    if (data.status === 200) {
                        console.log(data.data)
                        let docDocument = []
                        setVoucherData(data.data.rawMaterialIn)
                        setActionBtn({
                            approve: data.data['action'].approve,
                            update: data.data['action'].update,
                            delete: data.data['action'].delete,
                        })
                        setPVoucherData(data.data.paymentVoucher)
                        setInvoiceNo(data.data['paymentVoucher'].invoice_no)
                        setRemark(data.data['paymentVoucher'].remark)
                        setDateOfProcessing(
                            new Date(
                                data.data['paymentVoucher'].date_of_processing
                            )
                        )
                        setInvoiceDate(
                            new Date(data.data['paymentVoucher'].invoice_date)
                        )
                        docDocument = data.data.rawMaterialIn.document_name != null ? data.data.rawMaterialIn.document_name.split(' | '): [];
                        setDocuments(docDocument)
                        console.log(data.data.rawMaterialIn.round_off_amt)
                        setRoundOff(data.data.rawMaterialIn.round_off_amt)
                        setTds(
                            data.data.paymentVoucher.tds_per == null
                                ? 0
                                : data.data.paymentVoucher.tds_per
                        )
                    } else if (data.response.status === 500) {
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {data.response.data['message']}
                            </Notification>
                        )
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

    const calcTDS = (e) => {
        const tds_per = parseFloat(e.target.value)
        setTds(isNaN(tds_per) ? 0 : tds_per)
        const amount = voucherData.amt
        const tds_amount =
            (parseFloat(amount) * (isNaN(tds_per) ? 0 : tds_per)) / 100

        setPVoucherData((prev) => {
            return { ...prev, tdsamount: isNaN(tds_amount) ? 0 : tds_amount }
        })
        const roundOff =
            Math.round(
                (Math.round(voucherData.total_amt - tds_amount) -
                    Math.round((voucherData.total_amt - tds_amount) * 100) /
                        100) *
                    100
            ) / 100
        setRoundOff(roundOff)
        const net_amount = voucherData.total_amt - tds_amount + roundOff
        setPVoucherData((prev) => {
            return {
                ...prev,
                total_payable: isNaN(net_amount) ? 0 : Math.round(net_amount),
            }
        })
    }
    const calcRoundOff = (e) => {
        const roundOff = parseFloat(e.target.value)
        setRoundOff(isNaN(e.target.value) ? 0 : e.target.value)
        const tds_amount = parseFloat(pVoucherData.tdsamount)
        // console.log(tds_amount)
        // console.log(roundOff)
        const net_amount = voucherData.total_amt - tds_amount + roundOff
        // gross_amt - tds_amt + roundOff
        setPVoucherData((prev) => {
            return {
                ...prev,
                total_payable: isNaN(net_amount) ? 0 : Math.round(net_amount),
            }
        })
    }

    const changeGross = (e) => {
        setGrossAmount(e.target.value)
        const amount = voucherData.amt
        const tds_amount = (parseFloat(amount) * tds) / 100
        setPVoucherData((prev) => {
            return { ...prev, tdsamount: isNaN(tds_amount) ? 0 : tds_amount }
        })
        const roundOff =
            Math.round(
                (Math.round(
                    (isNaN(e.target.value) ? 0 : e.target.value) - tds_amount
                ) -
                    Math.round(
                        ((isNaN(e.target.value) ? 0 : e.target.value) -
                            tds_amount) *
                            100
                    ) /
                        100) *
                    100
            ) / 100
        setRoundOff(roundOff)
        const net_amount =
            (isNaN(e.target.value) ? 0 : e.target.value) - tds_amount + roundOff
        setPVoucherData((prev) => {
            return {
                ...prev,
                total_payable: isNaN(net_amount) ? 0 : Math.round(net_amount),
            }
        })
    }

    return (
        <>
            <AdaptableCard className="card-shadow mb-3">
                <Loading loading={loading}></Loading>
                <div
                    className={
                        loading
                            ? 'hidden'
                            : 'visible grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-2'
                    }
                >
                    <div className=" overflow-x-auto">
                        <table className="table font-normal">
                            <tbody>
                                <tr>
                                    <td colSpan={8}>
                                        <div className="flex justify-between items-center">
                                            <img
                                                src="/img/logo/logo.png"
                                                width={300}
                                                alt=""
                                            />
                                            <h3>
                                                <b>Invoice Details</b>
                                            </h3>
                                            <img
                                                src="/img/logo/eatetg.png"
                                                width={70}
                                                alt=""
                                                className="mr-3"
                                            />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4}>
                                        <h6>Requestor Name</h6>
                                        <p>
                                            {pVoucherData.requested_by_user !=
                                            null
                                                ? pVoucherData
                                                      .requested_by_user[
                                                      'first_name'
                                                  ] != null
                                                    ? pVoucherData
                                                          .requested_by_user[
                                                          'last_name'
                                                      ] != null
                                                        ? pVoucherData
                                                              .requested_by_user[
                                                              'first_name'
                                                          ] +
                                                          ' ' +
                                                          pVoucherData
                                                              .requested_by_user[
                                                              'last_name'
                                                          ]
                                                        : pVoucherData
                                                              .requested_by_user[
                                                              'first_name'
                                                          ]
                                                    : ''
                                                : ''}
                                        </p>
                                    </td>
                                    <td colSpan={4}>
                                        <h6>Checked By</h6>
                                        <p>
                                            {pVoucherData.modified_by_user !=
                                            null
                                                ? pVoucherData.modified_by_user[
                                                      'first_name'
                                                  ] != null
                                                    ? pVoucherData
                                                          .modified_by_user[
                                                          'last_name'
                                                      ] != null
                                                        ? pVoucherData
                                                              .modified_by_user[
                                                              'first_name'
                                                          ] +
                                                          ' ' +
                                                          pVoucherData
                                                              .modified_by_user[
                                                              'last_name'
                                                          ]
                                                        : pVoucherData
                                                              .modified_by_user[
                                                              'first_name'
                                                          ]
                                                    : ''
                                                : ''}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4} rowSpan={2}>
                                        <h6>Vendor</h6>
                                        <p>
                                            {voucherData.vendor.vendor_name}
                                            <br />
                                            {voucherData.vendor.address +
                                                ','}{' '}
                                            <br />
                                            {voucherData.vendor.city +
                                                ', ' +
                                                voucherData.vendor.state +
                                                ', ' +
                                                voucherData.vendor.pincode}{' '}
                                            <br />
                                        </p>
                                    </td>
                                    <td colSpan={4}>
                                        <h6>GSTIN:</h6>
                                        <p>{voucherData.vendor.gst_number}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4}>
                                        <h6>Payment Due Date:</h6>
                                        <DatePicker
                                            inputFormat="DD-MM-YYYY"
                                            placeholder="Payment Due Date"
                                            value={dateOfProcessing}
                                            className="mb-0"
                                            size="sm"
                                            onChange={(value) => {
                                                setDateOfProcessing(value)
                                            }}
                                            clearable={false}
                                        />
                                        {/* <p>
                                            <Moment format="DD-MM-YYYY">
                                                {
                                                    pVoucherData.date_of_processing
                                                }
                                            </Moment>
                                        </p> */}
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4}>
                                        <h6>P.O. No.</h6>
                                        <p>{pVoucherData.po_no}</p>
                                    </td>
                                    <td colSpan={4}>
                                        <h6>Dated</h6>
                                        <p
                                            className={
                                                pVoucherData.purchase_order !=
                                                null
                                                    ? pVoucherData
                                                          .purchase_order[
                                                          'order_date'
                                                      ] != null &&
                                                      pVoucherData
                                                          .purchase_order[
                                                          'order_date'
                                                      ] != ''
                                                        ? 'visible'
                                                        : 'hidden'
                                                    : 'hidden'
                                            }
                                        >
                                            <Moment format="DD-MM-YYYY">
                                                {pVoucherData.purchase_order !=
                                                null
                                                    ? pVoucherData
                                                          .purchase_order[
                                                          'order_date'
                                                      ] != null
                                                        ? pVoucherData
                                                              .purchase_order[
                                                              'order_date'
                                                          ]
                                                        : ''
                                                    : ''}
                                            </Moment>
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4}>
                                        <div className="w-full">
                                            <h6>GRN No.</h6>
                                            <p>
                                                {voucherData.raw_material_in_no}
                                            </p>
                                        </div>
                                    </td>
                                    <td colSpan={4}>
                                        <h6>Dated</h6>
                                        <p>
                                            <Moment format="DD-MM-YYYY">
                                                {voucherData.date_of_receipt}
                                            </Moment>
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4}>
                                        <h6>Invoice No.</h6>
                                        <Input
                                            type="text"
                                            placeholder="Invoice No."
                                            layout="vertical"
                                            className="mb-0"
                                            size="sm"
                                            value={invoiceNo}
                                            onChange={(e) => {
                                                setInvoiceNo(e.target.value)
                                            }}
                                        />
                                    </td>
                                    <td colSpan={4}>
                                        <h6>Dated</h6>
                                        <DatePicker
                                            inputFormat="DD-MM-YYYY"
                                            placeholder="Invoice Date"
                                            value={invoiceDate}
                                            className="mb-0"
                                            size="sm"
                                            onChange={(value) => {
                                                setInvoiceDate(value)
                                            }}
                                            clearable={false}
                                        />
                                    </td>
                                </tr>
                                <tr className="text-center font-semibold bg-orange-100">
                                    <td colSpan={8}>As Per PO</td>
                                </tr>
                                <tr className="text-center font-semibold">
                                    <td>Sr. No.</td>
                                    <td width={300}>Item</td>
                                    <td>Discount</td>
                                    <td>Qty</td>
                                    <td>Rate</td>
                                    <td>Amount</td>
                                    <td>GST</td>
                                    <td>Total</td>
                                </tr>
                                {/* Loop Through this <tr> */}
                                {voucherData.rawMaterialInItems.map(
                                    (value, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>
                                                {value.raw_material.rm_name}
                                            </td>
                                            <td>0%</td>
                                            <td>{value.po_quantity}</td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.po_rate}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.po_amount}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.po_tax_amt}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.po_total_amt}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                        </tr>
                                    )
                                )}

                                <tr
                                    className={`${
                                        voucherData.rawMaterialInOtherCharges
                                            .length > 0
                                            ? 'visible'
                                            : 'hidden'
                                    }`}
                                >
                                    <td colSpan={8}>
                                        <b>Other Charges As Per PO</b>
                                    </td>
                                    {/* <td>{voucherData.othe}</td> */}
                                    {/* <td colSpan={5}></td> */}
                                    {/* <td>{voucherData.round_off_amt}</td> */}
                                </tr>

                                {voucherData.rawMaterialInOtherCharges.map(
                                    (value, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td colSpan={4}>
                                                {value.item_desc}
                                            </td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.po_amount}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.po_tax_amt}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.po_total_amt}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                        </tr>
                                    )
                                )}
                                <tr>
                                    <td
                                        colSpan={8}
                                        style={{
                                            border: 'none',
                                            borderTop: '1px solid #333',
                                        }}
                                    >
                                        <p className="m-3"></p>
                                    </td>
                                </tr>
                                <tr className="text-center font-semibold bg-orange-100">
                                    <td colSpan={8}>As Per GRN</td>
                                </tr>
                                <tr className="text-center font-semibold">
                                    <td>Sr. No.</td>
                                    <td width={300}>Item</td>
                                    <td>Discount</td>
                                    <td>Qty</td>
                                    <td>Rate</td>
                                    <td>Amount</td>
                                    <td>GST</td>
                                    <td>Total</td>
                                </tr>

                                {voucherData.rawMaterialInItems.map(
                                    (value, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>
                                                {value.raw_material.rm_name}
                                            </td>
                                            <td
                                                className={
                                                    value.discount > 0
                                                        ? 'bg-rose-200'
                                                        : ' bg-white'
                                                }
                                            >
                                                {value.discount == null
                                                    ? 0 + '%'
                                                    : value.discount + '%'}
                                            </td>
                                            <td
                                                className={
                                                    value.po_quantity !==
                                                    value.qty
                                                        ? 'bg-rose-200'
                                                        : ' bg-white'
                                                }
                                            >
                                                {value.qty}
                                            </td>
                                            <td
                                                className={
                                                    value.po_rate !== value.rate
                                                        ? 'bg-rose-200'
                                                        : ' bg-white'
                                                }
                                            >
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.rate}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                            <td
                                                className={
                                                    value.po_amount !==
                                                    value.amount
                                                        ? 'bg-rose-200'
                                                        : ' bg-white'
                                                }
                                            >
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.amount}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                            <td
                                                className={
                                                    value.po_tax_amt !==
                                                    value.tax_amt
                                                        ? 'bg-rose-200'
                                                        : ' bg-white'
                                                }
                                            >
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.tax_amt}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                            <td
                                                className={
                                                    value.po_total_amt !==
                                                    value.total_amt
                                                        ? 'bg-rose-200'
                                                        : ' bg-white'
                                                }
                                            >
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.total_amt}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                        </tr>
                                    )
                                )}
                                {/* Loop Through this </tr> */}
                                <tr
                                    className={`${
                                        voucherData.rawMaterialInOtherCharges
                                            .length > 0
                                            ? 'visible'
                                            : 'hidden'
                                    }`}
                                >
                                    <td colSpan={8}>
                                        <b>Other Charges As Per GRN</b>
                                    </td>
                                    {/* <td>{voucherData.othe}</td> */}
                                    {/* <td colSpan={5}></td> */}
                                    {/* <td>{voucherData.round_off_amt}</td> */}
                                </tr>
                                {voucherData.rawMaterialInOtherCharges.map(
                                    (value, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td colSpan={4}>
                                                {value.item_desc}
                                            </td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.amount}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.tax_amt}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'₹'}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={value.total_amt}
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                        </tr>
                                    )
                                )}
                                <tr>
                                    <td
                                        colSpan={8}
                                        style={{
                                            border: 'none',
                                            borderTop: '1px solid #333',
                                        }}
                                    >
                                        <p className="m-3"></p>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4}>
                                        <b>Summary</b>
                                    </td>
                                    <td
                                        colSpan={4}
                                        rowSpan={8}
                                        style={{
                                            borderRight: 'none',
                                            borderTop: 'none',
                                            borderBottom: 'none',
                                        }}
                                    ></td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>Total : </td>
                                    <td colSpan={2}>
                                        <NumberFormat
                                            displayType="text"
                                            prefix={'₹'}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={voucherData.amt}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>GST Amount : </td>
                                    <td colSpan={2}>
                                        <NumberFormat
                                            displayType="text"
                                            prefix={'₹'}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={voucherData.tax_amt}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>Gross Amount : </td>
                                    <td colSpan={2}>
                                        {actionBtn.approve ? (
                                            <NumberFormat
                                                displayType="text"
                                                prefix={'₹'}
                                                thousandsGroupStyle={'lakh'}
                                                decimalScale={2}
                                                value={voucherData.total_amt}
                                                allowLeadingZeros
                                                thousandSeparator=","
                                            />
                                        ) : (
                                            <Input
                                                type="number"
                                                placeholder="Gross Amount"
                                                layout="vertical"
                                                className="mb-0"
                                                size="sm"
                                                prefix="₹"
                                                value={grossAmount}
                                                onChange={(e) => changeGross(e)}
                                            />
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>TDS % : </td>
                                    <td colSpan={2}>
                                        <Input
                                            type="number"
                                            placeholder="TDS %"
                                            layout="vertical"
                                            className="mb-0"
                                            size="sm"
                                            suffix="%"
                                            value={tds}
                                            onChange={(e) => {
                                                calcTDS(e)
                                            }}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>TDS Amount : </td>
                                    <td colSpan={2}>
                                        <NumberFormat
                                            displayType="text"
                                            prefix={'₹'}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={pVoucherData.tdsamount}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2}>Round Off Amount : </td>
                                    <td colSpan={2}>
                                        <Input
                                            type="number"
                                            placeholder="TDS %"
                                            layout="vertical"
                                            className="mb-0"
                                            size="sm"
                                            prefix="₹"
                                            value={roundOff}
                                            onChange={(e) => {
                                                calcRoundOff(e)
                                            }}
                                        />
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: 'none' }}>
                                    <td
                                        colSpan={2}
                                        style={{
                                            borderBottom: '1px solid #333',
                                        }}
                                    >
                                        Net Amount :{' '}
                                    </td>
                                    <td
                                        colSpan={2}
                                        style={{
                                            borderBottom: '1px solid #333',
                                        }}
                                    >
                                        <NumberFormat
                                            displayType="text"
                                            prefix={'₹'}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={pVoucherData.total_payable}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div>
                            <p className="text-black mt-6 mb-1 ml-1">
                                <b>Remarks</b>
                            </p>
                            <Input
                                textArea
                                placeholder="Remarks"
                                className="mb-0"
                                size="sm"
                                value={remark}
                                onChange={(e) => {
                                    setRemark(e.target.value)
                                }}
                            />
                        </div>
                    </div>
                    <div className="border h-[1150px] overflow-y-auto w-full">
                        {documents && documents.length > 0
                            ? documents.map((value, index) => (
                                  <div key={index} className="border-1 mb-1">
                                      <ShowImages url={value} />
                                  </div>
                              ))
                            : ''}
                    </div>
                </div>
            </AdaptableCard>
            <StickyFooter
                className="-mx-1 md:-mx-1 px-8 flex items-center justify-between py-4"
                stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            >
                <div>
                    {actionBtn.update ? (
                        <>
                            <Button
                                size="sm"
                                type="button"
                                onClick={() => update()}
                                className="ltr:mr-6 rtl:ml-6"
                                variant="solid"
                            >
                                Submit for Approval
                            </Button>
                            <Button
                                size="sm"
                                type="button"
                                color="rose-600"
                                onClick={() => reject()}
                                className="ltr:mr-6 rtl:ml-6"
                                variant="solid"
                            >
                                Reject
                            </Button>
                        </>
                    ) : (
                        ''
                    )}
                    {actionBtn.approve ? (
                        <>
                            <Button
                                size="sm"
                                type="button"
                                onClick={() => approved()}
                                className="ltr:mr-6 rtl:ml-6"
                                variant="solid"
                                color="emerald-600"
                            >
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                type="button"
                                variant="solid"
                                onClick={() => rejected()}
                                color="red-600"
                                className="ltr:mr-3 rtl:ml-3"
                            >
                                Reject
                            </Button>
                        </>
                    ) : (
                        ''
                    )}
                </div>
                <Button
                    size="sm"
                    type="button"
                    onClick={() => navigate('/transaction/finance-voucher')}
                >
                    Back
                </Button>
            </StickyFooter>
        </>
    )
}

export default AddEditFinanceVoucher
