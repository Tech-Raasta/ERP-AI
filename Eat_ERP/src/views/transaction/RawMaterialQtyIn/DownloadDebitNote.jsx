import React, { useState, useRef } from 'react'
import { AdaptableCard } from 'components/shared'
import NumberFormat from 'react-number-format'
import '../FinanceVoucher/AddEditFinanceVoucher.css'
import Button from 'components/ui/Buttons'
import jsPDF from 'jspdf'
import Tooltip from 'components/ui/Tooltip'
import { FaFilePdf } from 'react-icons/fa'
import Moment from 'react-moment'
import { apiRawMaterialQtyInGetSingle } from 'services/RawMaterialQtyInService'

const DownloadDebitNote = ({ grnId }) => {
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
        // created_by: '',
        // modified_by: '',
        // approved_by: '',
        // created_on: '',
        // modified_on: '',
        // approved_on: '',
    })
    const componentRef = useRef()
    const handleDownloadPDF = async () => {
        setLoading(true)

        await apiRawMaterialQtyInGetSingle(grnId).then((data) => {
            if (data.status === 200) {
                const pData = data.data.rawMaterialIn
                const puData = data.data.purchaseOrder
                setGrnData({
                    raw_material_in_no: pData.raw_material_in_no,
                    invoice_date: pData.invoice_date,
                    po_no: data.data['purchaseOrder'].po_no,
                    order_date: data.data['purchaseOrder'].order_date,
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
                    rawMaterialInItems: pData.rawMaterialInItems.map(
                        (value) => {
                            return {
                                raw_material_name:
                                    value.raw_material['rm_name'],
                                hsn_code: value.hsn_code,
                                po_qty: value.po_quantity != null ? value.po_quantity : 0,
                                po_rate: value.po_rate != null ? value.po_rate : 0,
                                po_amount: value.po_amount != null ? value.po_amount : 0,
                                po_gst: value.po_tax_amt != null ? value.po_tax_amt : 0,
                                po_total_amount: value.po_total_amt != null ? value.po_total_amt : 0,
                                discount: value.discount == null ? 0 : value.discount,
                                rin_qty: value.qty != null ? value.qty : 0,
                                rate: value.rate != null ? value.rate : 0,
                                rin_gst_rate: value.tax_per != null ? value.tax_per : 0,
                                rin_amount: value.amount != null ? value.amount : 0,
                                rin_gst: value.tax_amt != null ? value.tax_amt : 0,
                                rin_total_amount: value.total_amt != null ? value.total_amt : 0,
                            }
                        }
                    ),
                    rawMaterialInOtherCharges: pData.rawMaterialInOtherCharges.map((value) => {
                        return { 
                            item_desc: value.item_desc != null ? value.item_desc : '',
                            po_amount: value.po_amount != null ? value.po_amount : 0,
                            po_tax_amt: value.po_tax_amt != null ? value.po_tax_amt : 0,
                            po_total_amt: value.po_total_amt != null ? value.po_total_amt : 0,
                            amount: value.amount != null ? value.amount : 0,
                            tax_amt: value.tax_amt != null ? value.tax_amt : 0,
                            total_amt: value.total_amt != null ? value.total_amt : 0,
                            }
                        }),
                    po_amount: puData.amount != null ? puData.amount : 0,
                    po_tax_amount: puData.tax_amount != null ? puData.tax_amount : 0,
                    final_amount_po: puData.total_amount != null ? puData.total_amount : 0,
                    amount: pData.amt != null ? pData.amt : 0, 
                    tax_amount: pData.tax_amt != null ? pData.tax_amt : 0,
                    final_amount: pData.total_amt != null ? pData.total_amt : 0,
                    remarks: pData.remarks,
                    // created_by: pData.created_by_user.first_name != null ? pData.created_by_user.first_name + ' ' + (pData.created_by_user.last_name != null ? pData.created_by_user.last_name : '') : '',
                    // modified_by: pData.modified_by_user.first_name != null ? pData.modified_by_user.first_name + ' ' + (pData.modified_by_user.last_name != null ? pData.modified_by_user.last_name : '') : '',
                    // rejected_by: pData.rejected_by.first_name != null ? pData.rejected_by.first_name + ' ' + (pData.rejected_by.last_name != null ? pData.rejected_by.last_name : '') : '',
                    // created_on: pData.created_on != null ? pData.created_on : '',
                    // modified_on: pData.modified_on != null ? pData.modified_on : '',
                    // rejected_on: pData.rejected_on != null ? pData.rejected_on : '',
                })

                setTimeout(() => {
                    const input = componentRef.current
                    const pdf = new jsPDF('p', 'mm', 'a4', true)
                    pdf.html(input, {
                        callback: function (pdf) {
                            pdf.save(`Debit-Note_of_GRN-${puData.po_no}-${puData.order_date}-${pData.vendor.vendor_name}.pdf`)
                        },
                        x: 5,
                        y: 10,
                        width: 190,
                        windowWidth: 1200,
                    })
                    setLoading(false)
                }, 1000)
            } else if (data.response.status === 422) {
                console.log(data.response.status)
                setLoading(false)
            }
        }).catch((error) => {
            console.log(error);
            setLoading(false)
        })
    }
    return (
        <>
            <Tooltip title="Download Debit Note">
                <Button
                    shape="circle"
                    size="sm"
                    variant="twoTone"
                    color="red-600"
                    icon={<FaFilePdf />}
                    onClick={handleDownloadPDF}
                    className="text-sm mr-3"
                    loading={loading}
                />
            </Tooltip>
            <AdaptableCard className="card-shadow mb-3 hidden">
                <div
                    className="flex justify-center items-start align-top"
                    ref={componentRef}
                >
                    <table
                        className="border table font-normal text-black text-lg leading-6"
                        style={{ verticalAlign: 'top' }}
                    >
                        <tbody>
                            <tr>
                                <td colSpan={8}>
                                    <div className="flex justify-between items-center pb-2">
                                        <img
                                            src="/img/logo/logo.png"
                                            width={300}
                                            alt=""
                                        />
                                        <h1>
                                            <b>Debit Note</b>
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
                                <td colSpan={4} rowSpan={2}>
                                    <p>
                                        <b>Wholesome Habits Pvt Ltd</b>
                                    </p>
                                    <p>Unit No. 30,31,35,36,37 Samhita Complex, Bldg No. 13,<br />Off Andheri-Kurla, Saki Naka, Andheri East,<br />Mumbai, Maharashtra 400072 India<br />+91 8268000456 <br /><b>GSTIN:</b> 27AABCW7811R1ZN<br /> <u>cs@eatanytime.in</u> </p>
                                </td>
                                <td colSpan={2}>
                                    <p>
                                        <b>Dated</b>
                                    </p>
                                    <p>
                                        <Moment format="DD-MM-YYYY">
                                            {grnData.invoice_date}
                                        </Moment>
                                    </p>
                                </td>
                                <td colSpan={2}>
                                    <div className="w-full hidden">
                                        <p>
                                            <b>RIN No.</b>
                                        </p>
                                        <p>{grnData.raw_material_in_no}</p>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>P.O. No.</b>
                                    </p>
                                    <p>{grnData.po_no}</p>
                                </td>
                                <td colSpan={2}>
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
                                <td colSpan={4}>
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
                                <td colSpan={4}>
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
                                <td>
                                    <b>Sr. No.</b>
                                </td>
                                <td width={300}>
                                    <b>Item</b>
                                </td>
                                <td>
                                    <b>HSN Code</b>
                                </td>
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
                                    <td>
                                        <NumberFormat
                                            displayType="text"
                                            prefix={'Rs. '}
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
                                            prefix={'Rs. '}
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
                                            prefix={'Rs. '}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={value.po_gst}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </td>
                                    <td>
                                        <NumberFormat
                                            displayType="text"
                                            prefix={'Rs. '}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={value.po_total_amount}
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
                                                prefix={'Rs. '}
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
                                                prefix={'Rs. '}
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
                                                prefix={'Rs. '}
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
                                        prefix={'Rs. '}
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
                                        prefix={'Rs. '}
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
                                        prefix={'Rs. '}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={grnData.final_amount_po}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={4}>
                                    <p>
                                        <b>Remarks:</b> {grnData.remarks}
                                    </p>
                                </td>
                                <td colSpan={4}>
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
                            {/* <tr>
                                <td colSpan={8}>
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
                                                {grnData.created_on}
                                            </span>
                                            <span>
                                                <b>Modify On:</b>{' '}
                                                {grnData.modified_on}
                                            </span>
                                            <span>
                                                <b>Approved On:</b>{' '}
                                                {grnData.approved_on}
                                            </span>
                                        </p>
                                    </div>
                                </td>
                            </tr> */}
                        </tbody>
                    </table>
                </div>
            </AdaptableCard>
        </>
    )
}

export default React.memo(DownloadDebitNote)
