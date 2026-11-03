import React, { useState, useRef, useEffect } from 'react'
import { AdaptableCard } from 'components/shared'
import NumberFormat from 'react-number-format'
import '../FinanceVoucher/AddEditFinanceVoucher.css'
import Button from 'components/ui/Buttons'
import Loading from 'components/shared/Loading'
import Moment from 'react-moment'
import { apiRawMaterialQtyInGetSingle } from 'services/RawMaterialQtyInService'
import StickyFooter from 'components/shared/StickyFooter'
import { useNavigate, useParams } from 'react-router-dom'

import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

const ViewGRN = () => {
    const [loading, setLoading] = useState(false)
    const [grnData, setGrnData] = useState({
        raw_material_in_no: '',
        invoice_date: '',
        po_no: '',
        order_date: '',
        vendor: {
            vendor_name: '',
            address: '',
            city: '',
            pincode: '',
            state: '',
            gst_number: '',
        },
        depot: {
            depot_name: '',
            address: '',
            city: '',
            pincode: '',
            state: '',
        },
        rawMaterialInItems: [
            {
                raw_material_name: '',
                hsn_code: '',
                po_qty: '',
                po_rate: '',
                po_amount: '',
                po_gst: '',
                po_total_amount: '',
                discount: '',
                rin_qty: '',
                rate: '',
                rin_gst_rate: '',
                rin_amount: '',
                rin_gst: '',
                rin_total_amount: '',
            },
        ],
        rawMaterialInOtherCharges: [
            {
                item_desc: '',
                po_amount: 0,
                po_tax_amt: 0,
                po_total_amt: 0,
                amount: 0,
                tax_amt: 0,
                total_amt: 0,
            },
        ],
        po_amount: 0,
        po_tax_amount: 0,
        final_amount_po: 0,
        amount: 0,
        tax_amount: 0,
        final_amount: 0,
        remarks: '',
        created_by: '',
        modified_by: '',
        approved_by: '',
        created_on: '',
        modified_on: '',
        approved_on: '',
    })

    const navigate = useNavigate()
    const grnId = useParams()
    useEffect(() => {
        setLoading(true)
        if (grnId.grnid) {
            const fetchData = async () => {
                await apiRawMaterialQtyInGetSingle(grnId.grnid)
                    .then((data) => {
                        // console.log(data)
                        if (data.status === 200) {
                            const pData = data.data.rawMaterialIn
                            const puData = data.data.purchaseOrder
                            setGrnData({
                                raw_material_in_no: pData.raw_material_in_no,
                                invoice_date: pData.invoice_date,
                                po_no: data.data['purchaseOrder'].po_no,
                                order_date:
                                    data.data['purchaseOrder'].order_date,
                                vendor: {
                                    vendor_name: pData.vendor.vendor_name,
                                    address: pData.vendor.address,
                                    city: pData.vendor.city,
                                    pincode: pData.vendor.pincode,
                                    state: pData.vendor.state,
                                    gst_number: pData.vendor.gst_number,
                                },
                                depot: {
                                    depot_name: pData.depot.depot_name,
                                    address: pData.depot.address,
                                    city: pData.depot.city,
                                    pincode: pData.depot.pincode,
                                    state: pData.depot.state,
                                },
                                rawMaterialInItems:
                                    pData.rawMaterialInItems.map((value) => {
                                        return {
                                            raw_material_name:
                                                value.raw_material['rm_name'],
                                            hsn_code: value.hsn_code,
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
                                                value.qty != null
                                                    ? value.qty
                                                    : 0,
                                            rate:
                                                value.rate != null
                                                    ? value.rate
                                                    : 0,
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
                                    }),
                                rawMaterialInOtherCharges:
                                    pData.rawMaterialInOtherCharges.map(
                                        (value) => {
                                            return {
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
                                                amount:
                                                    value.amount != null
                                                        ? value.amount
                                                        : 0,
                                                tax_amt:
                                                    value.tax_amt != null
                                                        ? value.tax_amt
                                                        : 0,
                                                total_amt:
                                                    value.total_amt != null
                                                        ? value.total_amt
                                                        : 0,
                                            }
                                        }
                                    ),
                                po_amount:
                                    puData.amount != null ? puData.amount : 0,
                                po_tax_amount:
                                    puData.tax_amount != null
                                        ? puData.tax_amount
                                        : 0,
                                final_amount_po:
                                    puData.total_amount != null
                                        ? puData.total_amount
                                        : 0,

                                amount: pData.amt != null ? pData.amt : 0,
                                tax_amount:
                                    pData.tax_amt != null ? pData.tax_amt : 0,
                                final_amount:
                                    pData.total_amt != null
                                        ? pData.total_amt
                                        : 0,

                                remarks: pData.remarks,
                                created_by:
                                    pData.created_by_user.first_name != null
                                        ? pData.created_by_user.first_name +
                                          ' ' +
                                          (pData.created_by_user.last_name !=
                                          null
                                              ? pData.created_by_user.last_name
                                              : '')
                                        : '',
                                modified_by:
                                    pData.modified_by_user.first_name != null
                                        ? pData.modified_by_user.first_name +
                                          ' ' +
                                          (pData.modified_by_user.last_name !=
                                          null
                                              ? pData.modified_by_user.last_name
                                              : '')
                                        : '',
                                approved_by:
                                    pData.approved_by_user.first_name != null
                                        ? pData.approved_by_user.first_name +
                                          ' ' +
                                          (pData.approved_by_user.last_name !=
                                          null
                                              ? pData.approved_by_user.last_name
                                              : '')
                                        : '',
                                created_on:
                                    pData.created_on != null
                                        ? pData.created_on
                                        : '',
                                modified_on:
                                    pData.modified_on != null
                                        ? pData.modified_on
                                        : '',
                                approved_on:
                                    pData.approved_on != null
                                        ? pData.approved_on
                                        : '',
                            })
                            setLoading(false)
                        } else if (data.response.status === 422) {
                            console.log(data.response.status)
                            setLoading(false)
                        }
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
                        setLoading(false)
                    })
            }

            fetchData()
        } else {
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Something Went Wrong
                </Notification>
            )
            setLoading(false)
        }
    }, [])

    return (
        <>
            <Loading loading={loading}></Loading>
            <AdaptableCard
                className={`card-shadow mb-3 ${loading ? 'hidden' : 'visible'}`}
            >
                <div className="flex justify-center items-start align-top">
                    <table
                        className="border table font-normal text-black text-md leading-6"
                        id="tableGRN"
                        style={{ verticalAlign: 'top' }}
                    >
                        <tbody>
                            <tr>
                                <td colSpan={13}>
                                    <div className="flex justify-between items-center">
                                        <img
                                            src="/img/logo/logo.png"
                                            width={300}
                                            alt=""
                                        />
                                        <h1>
                                            <b>Raw Material In Note</b>
                                        </h1>
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
                                <td colSpan={3} rowSpan={2}>
                                    <p>
                                        <b>Wholesome Habits Pvt Ltd</b>
                                    </p>
                                    <p>Unit No. 30,31,35,36,37 Samhita Complex, Bldg No. 13,<br />Off Andheri-Kurla, Saki Naka, Andheri East,<br />Mumbai, Maharashtra 400072 India<br />+91 8268000456 <br /><b>GSTIN:</b> 27AABCW7811R1ZN<br /> <u>cs@eatanytime.in</u> </p>
                                </td>
                                <td colSpan={5}>
                                    <div className="w-full">
                                        <p>
                                            <b>RIN No.</b>
                                        </p>
                                        <p>{grnData.raw_material_in_no}</p>
                                    </div>
                                </td>
                                <td colSpan={5}>
                                    <p>
                                        <b>Dated</b>
                                    </p>
                                    <p>
                                        <Moment format="DD-MM-YYYY">
                                            {grnData.invoice_date}
                                        </Moment>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={5}>
                                    <p>
                                        <b>P.O. No.</b>
                                    </p>
                                    <p>{grnData.po_no}</p>
                                </td>
                                <td colSpan={5}>
                                    <p>
                                        <b>Dated</b>
                                    </p>
                                    <p>
                                        <Moment format="DD-MM-YYYY">
                                            {grnData.order_date}
                                        </Moment>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={3}>
                                    <p>
                                        <b>Vendor</b>
                                    </p>
                                    <p>
                                        {grnData.vendor.vendor_name}
                                        <br />
                                        {grnData.vendor.address}
                                        <br />
                                        {grnData.vendor.city +
                                            ' ' +
                                            grnData.vendor.pincode +
                                            ' ' +
                                            grnData.vendor.state}
                                        <br />
                                        <b>GSTIN:</b>{' '}
                                        {grnData.vendor.gst_number}
                                    </p>
                                </td>
                                <td colSpan={10}>
                                    <p>
                                        <b>Ship To</b>
                                    </p>
                                    <p>
                                        {grnData.depot.depot_name} <br />
                                        {grnData.depot.address}
                                        <br />
                                        {grnData.depot.city +
                                            ' ' +
                                            grnData.depot.pincode +
                                            ' ' +
                                            grnData.depot.state}
                                    </p>
                                </td>
                            </tr>
                            <tr className="text-center font-semibold">
                                <td rowSpan={2}>
                                    <b>Sr. No.</b>
                                </td>
                                <td rowSpan={2} width={300}>
                                    <b>Item</b>
                                </td>
                                <td rowSpan={2}>
                                    <b>HSN Code</b>
                                </td>
                                <td colSpan={5}>
                                    <b>As Per PO</b>
                                </td>
                                <td colSpan={5}>
                                    <b>As Per RIN</b>
                                </td>
                            </tr>
                            <tr className="text-center font-semibold">
                                {/* As Per PO */}
                                <td>
                                    <b>Qty</b>
                                </td>
                                <td>
                                    <b>Rate</b>
                                </td>
                                <td>
                                    <b>Amount</b>
                                </td>
                                <td>
                                    <b>GST</b>
                                </td>
                                <td>
                                    <b>Total</b>
                                </td>
                                {/* As Per RIN */}
                                <td>
                                    <b>Qty</b>
                                </td>
                                <td>
                                    <b>Rate</b>
                                </td>
                                <td>
                                    <b>Amount</b>
                                </td>
                                <td>
                                    <b>GST</b>
                                </td>
                                <td>
                                    <b>Total</b>
                                </td>
                            </tr>
                            {/* Loop Through this <tr> */}
                            {grnData.rawMaterialInItems.map((value, index) => (
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td> {value.raw_material_name} </td>
                                    <td>{value.hsn_code}</td>
                                    <td>{value.po_qty}</td>
                                    <td width={80}>
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
                                    <td width={140}>
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
                                    <td width={140}>
                                        <NumberFormat
                                            displayType="text"
                                            prefix={'₹'}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={value.po_gst}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                    <td width={140}>
                                        <NumberFormat
                                            displayType="text"
                                            prefix={'₹'}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={value.po_total_amount}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                    <td>
                                        <span
                                            className={
                                                value.po_qty != value.rin_qty
                                                    ? 'text-red-600'
                                                    : ' text-black'
                                            }
                                        >
                                            {value.rin_qty}
                                        </span>
                                    </td>
                                    <td width={80}>
                                        <NumberFormat
                                            className={
                                                value.po_rate != value.rate
                                                    ? 'text-red-600'
                                                    : ' text-black'
                                            }
                                            displayType="text"
                                            prefix={'₹'}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={value.rate}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                    <td width={140}>
                                        <NumberFormat
                                            className={
                                                value.po_amount !=
                                                value.rin_amount
                                                    ? 'text-red-600'
                                                    : ' text-black'
                                            }
                                            displayType="text"
                                            prefix={'₹'}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={value.rin_amount}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                    <td width={140}>
                                        <NumberFormat
                                            className={
                                                value.po_gst != value.rin_gst
                                                    ? 'text-red-600'
                                                    : ' text-black'
                                            }
                                            displayType="text"
                                            prefix={'₹'}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={value.rin_gst}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                    <td width={140}>
                                        <NumberFormat
                                            className={
                                                value.po_total_amount !=
                                                value.rin_total_amount
                                                    ? 'text-red-600'
                                                    : ' text-black'
                                            }
                                            displayType="text"
                                            prefix={'₹'}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={value.rin_total_amount}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                </tr>
                            ))}
                            {grnData.rawMaterialInOtherCharges.map(
                                (value, index) => (
                                    <tr key={index}>
                                        <td colSpan={5}> {value.item_desc} </td>
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
                                        <td colSpan={2}></td>
                                        <td>
                                            <NumberFormat
                                                className={
                                                    value.po_amount !=
                                                    value.amount
                                                        ? 'text-red-600'
                                                        : ' text-black'
                                                }
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
                                                className={
                                                    value.po_tax_amt !=
                                                    value.tax_amt
                                                        ? 'text-red-600'
                                                        : ' text-black'
                                                }
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
                                                className={
                                                    value.po_total_amt !=
                                                    value.total_amt
                                                        ? 'text-red-600'
                                                        : ' text-black'
                                                }
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
                            {/* <tr>
                                <td colSpan={7}>
                                    <p>
                                        <b>Other Charges</b>
                                    </p>
                                </td>
                                <td>{grnData.otherCharges}</td>
                                <td colSpan={4}></td>
                                <td>{grnData.otherCharges_po}</td>
                            </tr> */}
                            <tr>
                                <td colSpan={5}>
                                    <p>
                                        <b>Total</b>
                                    </p>
                                </td>
                                <td>
                                    <NumberFormat
                                        displayType="text"
                                        prefix={'₹'}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={grnData.po_amount}
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
                                        value={grnData.po_tax_amount}
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
                                        value={grnData.final_amount_po}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                                <td colSpan={2}></td>
                                <td>
                                    <NumberFormat
                                        className={
                                            grnData.po_amount != grnData.amount
                                                ? 'text-red-600'
                                                : ' text-black'
                                        }
                                        displayType="text"
                                        prefix={'₹'}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={grnData.amount}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                                <td>
                                    <NumberFormat
                                        className={
                                            grnData.po_tax_amount !=
                                            grnData.tax_amount
                                                ? 'text-red-600'
                                                : ' text-black'
                                        }
                                        displayType="text"
                                        prefix={'₹'}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={grnData.tax_amount}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                                <td>
                                    <NumberFormat
                                        className={
                                            grnData.final_amount_po !=
                                            grnData.final_amount
                                                ? 'text-red-600'
                                                : ' text-black'
                                        }
                                        displayType="text"
                                        prefix={'₹'}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={grnData.final_amount}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={5}>
                                    <p>
                                        <b>Remarks:</b> {grnData.remarks}
                                    </p>
                                </td>
                                <td colSpan={8}>
                                    <div className="flex flex-col justify-center items-center">
                                        <p className="mb-2">
                                            For Wholesome Habits Pvt. Ltd.
                                        </p>
                                        <img
                                            src="/img/others/stamp.jpg"
                                            width={150}
                                            alt=""
                                            className="mb-2"
                                        />
                                        <p>Authorised Signatory</p>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={13}>
                                    <div className="text-center">
                                        <p className="grid grid-cols-3 gap-2 text-left">
                                            <span>
                                                <b>Created By:</b>{' '}
                                                {grnData.created_by}
                                            </span>
                                            <span>
                                                <b>Modify By:</b>{' '}
                                                {grnData.modified_by}
                                            </span>
                                            <span>
                                                <b>Approved By:</b>{' '}
                                                {grnData.approved_by}
                                            </span>
                                            <span>
                                                <b>Created On:</b>{' '}
                                                <span
                                                    className={
                                                        grnData.created_on ===
                                                        ''
                                                            ? 'hidden'
                                                            : 'visible'
                                                    }
                                                >
                                                    <Moment format="DD-MM-YYYY hh:mm A">
                                                        {grnData.created_on ===
                                                        ''
                                                            ? new Date()
                                                            : new Date(
                                                                  grnData.created_on
                                                              ).toLocaleString(
                                                                  'en-US',
                                                                  {
                                                                      timeZone:
                                                                          'UTC',
                                                                  }
                                                              )}
                                                    </Moment>
                                                </span>
                                            </span>
                                            <span>
                                                <b>Modify On:</b>{' '}
                                                <span
                                                    className={
                                                        grnData.modified_on ===
                                                        ''
                                                            ? 'hidden'
                                                            : 'visible'
                                                    }
                                                >
                                                    <Moment format="DD-MM-YYYY hh:mm A">
                                                        {grnData.modified_on ===
                                                        ''
                                                            ? new Date()
                                                            : new Date(
                                                                  grnData.modified_on
                                                              ).toLocaleString(
                                                                  'en-US',
                                                                  {
                                                                      timeZone:
                                                                          'UTC',
                                                                  }
                                                              )}
                                                    </Moment>
                                                </span>
                                            </span>
                                            <span>
                                                <b>Approved On:</b>{' '}
                                                <span
                                                    className={
                                                        grnData.approved_on ===
                                                        ''
                                                            ? 'hidden'
                                                            : 'visible'
                                                    }
                                                >
                                                    <Moment format="DD-MM-YYYY hh:mm A">
                                                        {grnData.approved_on ===
                                                        ''
                                                            ? new Date()
                                                            : new Date(
                                                                  grnData.approved_on
                                                              ).toLocaleString(
                                                                  'en-US',
                                                                  {
                                                                      timeZone:
                                                                          'UTC',
                                                                  }
                                                              )}
                                                    </Moment>
                                                </span>
                                            </span>
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </AdaptableCard>
            <StickyFooter
                className="-mx-1 md:-mx-1 px-8 flex items-center justify-between py-4"
                stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            >
                <div></div>
                <Button
                    size="sm"
                    onClick={() => navigate('/transaction/goods-received-note')}
                >
                    Back
                </Button>
            </StickyFooter>
        </>
    )
}

export default React.memo(ViewGRN)
