import React, { useState, useRef, useEffect } from 'react'
import { AdaptableCard } from 'components/shared'
import NumberFormat from 'react-number-format'
import '../FinanceVoucher/AddEditFinanceVoucher.css'
import Button from 'components/ui/Buttons'
import jsPDF from 'jspdf'
import Moment from 'react-moment'
import { useNavigate, useParams } from 'react-router-dom'
import Loading from 'components/shared/Loading'
import {
    apiPurchaseOrderGetSingle,
    apiPurchaseOrderSendMail,
} from 'services/PurchaseOrderService'
import toast from 'components/ui/toast'
import ReactToPrint from 'react-to-print'
import Notification from 'components/ui/Notification'
import StickyFooter from 'components/shared/StickyFooter'

const ViewPurchaseOrder = ({ productId }) => {
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const componentRef = useRef()
    const purchaseId = useParams()
    const [purchaseData, setPurchseData] = useState({
        order_date: '', //YYYY-MM-DD
        po_no: '',
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
        purchaseOrderItems: [
            {
                rm_name: '',
                desc:'',
                qty: '',
                rate: '',
                amount: '',
                tax_amt: '',
                total_amt: '',
            },
        ],
        purchaseOrderOtherCharges: [],
        tdsamount: '',
        amount: '',
        tax_amount: '',
        total_amount: '',
        round_off_amount: '',
        po_amount: '',
        remarks: '',
        created_by: '',
        modified_by: '',
        approved_by: '',
        created_on: '',
        modified_on: '',
        approved_on: '',
    })

    const sendMail = () => {
        if (purchaseId.purchaseid) {
            apiPurchaseOrderSendMail(purchaseId.purchaseid)
                .then((data) => {
                    if (data.status === 200) {
                        console.log(data)
                        toast.push(
                            <Notification
                                title="Success"
                                type="success"
                                closable
                            >
                                {data.data['message']}
                            </Notification>
                        )
                    }
                })
                .catch((error) => {
                    if (error.response.status === 500) {
                        console.log(error)
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {error.response.data['message']}
                            </Notification>
                        )
                    } else if (error.response.status === 401) {
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
                    Something Went Wrong!!
                </Notification>
            )
        }
    }

    useEffect(() => {
        setLoading(true)
        if (purchaseId.purchaseid) {
            apiPurchaseOrderGetSingle(purchaseId.purchaseid)
                .then((data) => {
                    if (data.status === 200) {
                        // console.log(data.data['action'])
                        setPurchseData({
                            order_date:
                                data.data['purchaseOrder'].order_date != null
                                    ? data.data['purchaseOrder'].order_date
                                    : '',
                            po_no:
                                data.data['purchaseOrder'].po_no != null
                                    ? data.data['purchaseOrder'].po_no
                                    : 0,
                            tdsamount:
                                data.data['purchaseOrder'].tdsamount != null
                                    ? data.data['purchaseOrder'].tdsamount
                                    : 0,

                            amount:
                                data.data['purchaseOrder'].amount != null
                                    ? data.data['purchaseOrder'].amount
                                    : 0,
                            tax_amount:
                                data.data['purchaseOrder'].tax_amount != null
                                    ? data.data['purchaseOrder'].tax_amount
                                    : 0,
                            total_amount:
                                data.data['purchaseOrder'].total_amount != null
                                    ? data.data['purchaseOrder'].total_amount
                                    : 0,
                            round_off_amount:
                                data.data['purchaseOrder'].round_off_amount !=
                                null
                                    ? data.data['purchaseOrder']
                                          .round_off_amount
                                    : 0,
                            po_amount:
                                data.data['purchaseOrder'].po_amount != null
                                    ? data.data['purchaseOrder'].po_amount
                                    : 0,
                            purchaseOrderItems: data.data[
                                'purchaseOrder'
                            ].purchaseOrderItems.map((value, index) => {
                                return {
                                    rm_name:
                                        value.raw_material.rm_name != null
                                            ? value.raw_material.rm_name
                                            : '',
                                    desc: value.item_desc != null ? value.item_desc : '',
                                    qty: value.qty != null ? value.qty : 0,
                                    rate: value.rate != null ? value.rate : 0,
                                    amount:
                                        value.amount != null ? value.amount : 0,
                                    tax_amt:
                                        value.tax_amt != null
                                            ? value.tax_amt
                                            : 0,
                                    total_amt:
                                        value.total_amt != null
                                            ? value.total_amt
                                            : 0,
                                }
                            }),
                            purchaseOrderOtherCharges:
                                data.data['purchaseOrder']
                                    .purchaseOrderOtherCharges == []
                                    ? []
                                    : data.data[
                                          'purchaseOrder'
                                      ].purchaseOrderOtherCharges.map(
                                          (value, index) => {
                                              return {
                                                  item_desc:
                                                      value.item_desc != null
                                                          ? value.item_desc
                                                          : '',
                                                  tax_per:
                                                      value.tax_per != null
                                                          ? value.tax_per
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
                            vendor: {
                                vendor_name:
                                    data.data['purchaseOrder'].vendor
                                        .vendor_name,
                                address:
                                    data.data['purchaseOrder'].vendor.address,
                                city: data.data['purchaseOrder'].vendor.city,
                                pincode:
                                    data.data['purchaseOrder'].vendor.pincode,
                                state: data.data['purchaseOrder'].vendor.state,
                                gst_number:
                                    data.data['purchaseOrder'].vendor
                                        .gst_number,
                            },
                            depot: {
                                depot_name:
                                    data.data['purchaseOrder'].depot.depot_name,
                                address:
                                    data.data['purchaseOrder'].depot.address,
                                city: data.data['purchaseOrder'].depot.city,
                                pincode:
                                    data.data['purchaseOrder'].depot.pincode,
                                state: data.data['purchaseOrder'].depot.state,
                            },
                            remarks:
                                data.data['purchaseOrder'].remarks != null
                                    ? data.data['purchaseOrder'].remarks
                                    : '',
                            created_by:
                                data.data['purchaseOrder'].created_by_user
                                    .first_name != null
                                    ? data.data['purchaseOrder'].created_by_user
                                          .first_name +
                                      ' ' +
                                      (data.data['purchaseOrder']
                                          .created_by_user.last_name != null
                                          ? data.data['purchaseOrder']
                                                .created_by_user.last_name
                                          : '')
                                    : '',
                            modified_by:
                                data.data['purchaseOrder'].modified_by_user
                                    .first_name != null
                                    ? data.data['purchaseOrder']
                                          .modified_by_user.first_name +
                                      ' ' +
                                      (data.data['purchaseOrder']
                                          .modified_by_user.last_name != null
                                          ? data.data['purchaseOrder']
                                                .modified_by_user.last_name
                                          : '')
                                    : '',
                            approved_by:
                                data.data['purchaseOrder'].approved_by_user
                                    .first_name != null
                                    ? data.data['purchaseOrder']
                                          .approved_by_user.first_name +
                                      ' ' +
                                      (data.data['purchaseOrder']
                                          .approved_by_user.last_name != null
                                          ? data.data['purchaseOrder']
                                                .approved_by_user.last_name
                                          : '')
                                    : '',
                            created_on:
                                data.data['purchaseOrder'].created_on != null
                                    ? data.data['purchaseOrder'].created_on
                                    : '',
                            modified_on:
                                data.data['purchaseOrder'].modified_on != null
                                    ? data.data['purchaseOrder'].modified_on
                                    : '',
                            approved_on:
                                data.data['purchaseOrder'].approved_on != null
                                    ? data.data['purchaseOrder'].approved_on
                                    : '',
                        })
                        setLoading(false)
                    }
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
    }, [])

    const download = () => {
        const input = componentRef.current
        const pdf = new jsPDF('p', 'mm', 'a4', true)
        pdf.html(input, {
            callback: function (pdf) {
                pdf.save(
                    `PO-${purchaseData.po_no}-${purchaseData.vendor.vendor_name}.pdf`
                )
            },
            x: 10,
            y: 10,
            width: 190,
            windowWidth: 1200,
        })
    }
    return (
        <>
            <Loading loading={loading}></Loading>
            <AdaptableCard
                className={`card-shadow mb-3 flex justify-center ${
                    loading ? 'hidden' : 'visible'
                }`}
            >
                <div
                    className="flex justify-center items-start align-top"
                    id="mainPurchase"
                    ref={componentRef}
                >
                    <table
                        className="border table font-normal text-black text-sm leading-6"
                        id="tablePurchase"
                        style={{ verticalAlign: 'top' }}
                    >
                        <tbody>
                            <tr>
                                <td colSpan={8} style={{}}>
                                    <div className="flex justify-between items-center">
                                        <img
                                            src="/img/logo/logo.png"
                                            width={300}
                                            alt=""
                                        />
                                        <h1>
                                            <b>Purchase Order</b>
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
                                <td colSpan={4} style={{}}>
                                    <p>
                                        <b>Wholesome Habits Pvt Ltd</b>
                                    </p>
                                    {
                                        purchaseData.depot.state.toLowerCase() === 'gujarat' ? (
                                            <p> Gala No 1-C , Shed - C Rudra Pratap logistics,<br />ETG , NH-48 Kajipura,<br />Kheda, Gujarat 387120 India<br />+91 8268000456 <br /><b>GSTIN:</b> 24AABCW7811R1ZT<br /> <u>cs@eatanytime.in</u></p>
                                        ) : (
                                            <p>Unit No. 30,31,35,36,37 Samhita Complex, Bldg No. 13,<br />Off Andheri-Kurla, Saki Naka, Andheri East,<br />Mumbai, Maharashtra 400072 India<br />+91 8268000456 <br /><b>GSTIN:</b> 27AABCW7811R1ZN<br /> <u>cs@eatanytime.in</u> </p>
                                        )
                                    }
                                </td>
                                <td colSpan={2}>
                                    <div className="w-full">
                                        <p>
                                            <b>P.O. No.</b>
                                        </p>
                                        <p>{purchaseData.po_no}</p>
                                    </div>
                                </td>
                                <td colSpan={2}>
                                    <p>
                                        <b>Dated</b>
                                    </p>
                                    <p>
                                        <Moment format="DD-MM-YYYY">
                                            {purchaseData.order_date}
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
                                        {purchaseData.vendor.vendor_name}
                                        <br />
                                        {purchaseData.vendor.address}
                                        <br />
                                        {purchaseData.vendor.city +
                                            ' ' +
                                            purchaseData.vendor.pincode +
                                            ' ' +
                                            purchaseData.vendor.state}
                                        <br />
                                        <b>GSTIN:</b>{' '}
                                        {purchaseData.vendor.gst_number}
                                    </p>
                                </td>
                                <td colSpan={4}>
                                    <p>
                                        <b>Ship To</b>
                                    </p>
                                    <p>
                                        {purchaseData.depot.depot_name} <br />
                                        {purchaseData.depot.address}
                                        <br />
                                        {purchaseData.depot.city +
                                            ' ' +
                                            purchaseData.depot.pincode +
                                            ' ' +
                                            purchaseData.depot.state}
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
                                <td width={300}>
                                    <b>Description</b>
                                </td>
                                <td>
                                    <b>Quantity</b>
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
                                    <b>Total Amount</b>
                                </td>
                            </tr>
                            {/* Loop Through this <tr> */}
                            {purchaseData.purchaseOrderItems.map(
                                (value, index) => {
                                    return (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>{value.rm_name}</td>
                                            <td>{value.desc}</td>
                                            <td>{value.qty}</td>
                                            <td>
                                                <NumberFormat
                                                    displayType="text"
                                                    prefix={'Rs. '}
                                                    thousandsGroupStyle={'lakh'}
                                                    decimalScale={2}
                                                    value={
                                                        value.rate != null
                                                            ? value.rate
                                                            : 0
                                                    }
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
                                                    value={
                                                        value.amount != null
                                                            ? value.amount
                                                            : 0
                                                    }
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
                                                    value={
                                                        value.tax_amt != null
                                                            ? value.tax_amt
                                                            : 0
                                                    }
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
                                                    value={
                                                        value.total_amt != null
                                                            ? value.total_amt
                                                            : 0
                                                    }
                                                    allowLeadingZeros
                                                    thousandSeparator=","
                                                />
                                            </td>
                                        </tr>
                                    )
                                }
                            )}
                            {purchaseData.purchaseOrderOtherCharges.map(
                                (value, index) => (
                                    <tr key={index}>
                                        <td colSpan={4}>{value.item_desc}</td>
                                        <td>
                                            <NumberFormat
                                                displayType="text"
                                                prefix={'Rs. '}
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
                                                prefix={'Rs. '}
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
                                                prefix={'Rs. '}
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
                            <tr>
                                <td colSpan={5}>
                                    <b>Sub Total</b>
                                </td>
                                <td>
                                    <NumberFormat
                                        displayType="text"
                                        prefix={'Rs. '}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={purchaseData.amount}
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
                                        value={purchaseData.tax_amount}
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
                                        value={purchaseData.total_amount}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={7}>
                                    <b>Round Off Amount</b>
                                </td>
                                <td>
                                    <NumberFormat
                                        displayType="text"
                                        prefix={'Rs. '}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={purchaseData.round_off_amount}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={7}>
                                    <b>TOTAL</b>
                                </td>
                                <td>
                                    <NumberFormat
                                        displayType="text"
                                        prefix={'Rs. '}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={purchaseData.po_amount}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={8}>
                                    <b>Remarks:</b> {purchaseData.remarks}
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={4}>
                                    <p>
                                        1. Please send two copies of your
                                        invoice
                                        <br />
                                        2. Enter this order in accordance with
                                        the price, terms, delivery method, and
                                        specifications listed above.
                                        <br />
                                        3. Please notify us immediately if you
                                        are unable to ship as specified.
                                        <br />
                                        4. Wholesome Habits Pvt Ltd, B-505,
                                        Veena sur, Mahavir NagarKandivali-West,
                                        Mumbai - 67 <br />
                                        +91 8268000456
                                        <br />
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
                            <tr>
                                <td colSpan={8}>
                                    <div className="text-center">
                                        <p className="grid grid-cols-3 gap-2 text-left">
                                            <span>
                                                <b>Created By:</b>{' '}
                                                {purchaseData.created_by}
                                            </span>
                                            <span>
                                                <b>Modify By:</b>{' '}
                                                {purchaseData.modified_by}
                                            </span>
                                            <span>
                                                <b>Approved By:</b>{' '}
                                                {purchaseData.approved_by}
                                            </span>
                                            <span>
                                                <b>Created On:</b>{' '}
                                                <span
                                                    className={
                                                        purchaseData.created_on ===
                                                        ''
                                                            ? 'hidden'
                                                            : 'visible'
                                                    }
                                                >
                                                    <Moment format="DD-MM-YYYY hh:mm A">
                                                        {purchaseData.created_on ===
                                                        ''
                                                            ? new Date()
                                                            : new Date(
                                                                  purchaseData.created_on
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
                                                        purchaseData.modified_on ===
                                                        ''
                                                            ? 'hidden'
                                                            : 'visible'
                                                    }
                                                >
                                                    <Moment format="DD-MM-YYYY hh:mm A">
                                                        {purchaseData.modified_on ===
                                                        ''
                                                            ? new Date()
                                                            : new Date(
                                                                  purchaseData.modified_on
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
                                                        purchaseData.approved_on ===
                                                        ''
                                                            ? 'hidden'
                                                            : 'visible'
                                                    }
                                                >
                                                    <Moment format="DD-MM-YYYY hh:mm A">
                                                        {purchaseData.approved_on ===
                                                        ''
                                                            ? new Date()
                                                            : new Date(
                                                                  purchaseData.approved_on
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
                <div className="md:flex items-center">
                    <Button
                        shape="circle"
                        size="sm"
                        variant="twoTone"
                        color="violet-900"
                        onClick={() => sendMail()}
                        className="text-sm ltr:mr-3 rtl:ml-3"
                        loading={loading}
                    >
                        Send Mail
                    </Button>
                    <ReactToPrint
                        trigger={() => (
                            <Button
                                size="sm"
                                variant="solid"
                                color="blue-600"
                                type="button"
                                className="ltr:mr-3 rtl:ml-3"
                            >
                                Print
                            </Button>
                        )}
                        content={() => componentRef.current}
                    />
                    <Button
                        size="sm"
                        type="button"
                        variant="solid"
                        color="emerald-600"
                        className="ltr:mr-3 rtl:ml-3"
                        onClick={() => download()}
                    >
                        Download
                    </Button>
                    <Button
                        size="sm"
                        type="button"
                        onClick={() => navigate('/transaction/purchase-order')}
                    >
                        Back
                    </Button>
                </div>
            </StickyFooter>
        </>
    )
}

export default React.memo(ViewPurchaseOrder)
