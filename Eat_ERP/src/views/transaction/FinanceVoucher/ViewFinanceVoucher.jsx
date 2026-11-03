import React, { useState, useRef, useEffect } from 'react'
import { AdaptableCard } from 'components/shared'
import NumberFormat from 'react-number-format'
import './AddEditFinanceVoucher.css'
import Button from 'components/ui/Buttons'
import Checkbox from 'components/ui/Checkbox'
import Moment from 'react-moment'
import StickyFooter from 'components/shared/StickyFooter'
import { useNavigate, useParams } from 'react-router-dom'
import ReactToPrint from 'react-to-print'
import Loading from 'components/shared/Loading'
import { apiFinanceVoucherGetSingle } from 'services/FinanceVoucherService'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import ViewImages from './ViewImages'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

const ViewFinanceVoucher = () => {
    const [loading, setLoading] = useState(false)
    const [financeVoucher, setFinanceVoucher] = useState({
        type: '',
        req_name: '',
        party_name: '',
        po_no: '',
        po_date: '',
        grn_no: '',
        grn_date: '',
        paymentVoucher_no: '',
        paymentVoucher_date: '',
        gstin: '',
        amount: '',
        attached_doc: '',
        document_name: '',
        doc_document: '',
        is_advance: '',
        invoice_no: '',
        invoice_date: '',
        payment_due_date: '',
        pay_immediately: '',
        paymentVoucherItems: [
            {
                particular: '',
                qty: '',
                rate: '',
                amount: '',
                discount: '',
                tax_per: '',
                tax_total: '',
                total_amount: '',
            },
        ],
        total: '',
        invoice_amount: '',
        tds_per: '',
        tds_amount: '',
        round_off_amount: '',
        total_payable: '',
        prepared_by: '',
        checked_by: '',
        verified_by: '',
        approved_by: '',
        prepared_on: '',
        checked_on: '',
        verified_on: '',
        approved_on: '',
        remarks: '',
        gate_pass_no: '',
        inward_date: '',
        erp_inward_date: '',
        entry_by: '',
        grnRemarks: '',
    })

    const navigate = useNavigate()
    const componentRef = useRef()
    const financeId = useParams()

    const [numPages, setNumPages] = useState(null)
    const [pageNumber, setPageNumber] = useState(1)

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages)
    }

    const goToPrevPage = () => setPageNumber((prevPage) => prevPage - 1)
    const goToNextPage = () => setPageNumber((prevPage) => prevPage + 1)

    useEffect(() => {
        setLoading(true)
        if (financeId.voucherid) {
            const fetchData = async () => {
                await apiFinanceVoucherGetSingle(financeId.voucherid)
                    .then((data) => {
                        if (data.status === 200) {
                            // console.log(data)
                            const pVoucherData = data.data['paymentVoucher']
                            const rawMaterialData = data.data['rawMaterialIn']

                            setFinanceVoucher({
                                type:
                                    pVoucherData.type != null
                                        ? pVoucherData.type
                                        : '',
                                req_name:
                                    pVoucherData.requested_by_user != null
                                        ? pVoucherData.requested_by_user[
                                              'first_name'
                                          ] != null
                                            ? pVoucherData.requested_by_user[
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
                                        : '',
                                party_name:
                                    pVoucherData.vendor_name != null
                                        ? pVoucherData.vendor_name
                                        : '',
                                po_no:
                                    pVoucherData.purchase_order != null
                                        ? pVoucherData.purchase_order[
                                              'po_no'
                                          ] != null
                                            ? pVoucherData.purchase_order[
                                                  'po_no'
                                              ]
                                            : ''
                                        : '',
                                po_date:
                                    pVoucherData.purchase_order != null
                                        ? pVoucherData.purchase_order[
                                              'order_date'
                                          ] != null
                                            ? pVoucherData.purchase_order[
                                                  'order_date'
                                              ]
                                            : ''
                                        : '',
                                grn_no:
                                    rawMaterialData != null
                                        ? rawMaterialData.raw_material_in_no !=
                                          null
                                            ? rawMaterialData.raw_material_in_no
                                            : ''
                                        : '',
                                grn_date:
                                    rawMaterialData != null
                                        ? rawMaterialData.date_of_receipt !=
                                          null
                                            ? rawMaterialData.date_of_receipt
                                            : ''
                                        : '',
                                paymentVoucher_no:
                                    pVoucherData.voucher_no != null
                                        ? pVoucherData.voucher_no
                                        : '',
                                paymentVoucher_date:
                                    pVoucherData.created_on != null
                                        ? pVoucherData.created_on
                                        : '',
                                gstin:
                                    pVoucherData.gst_in != null
                                        ? pVoucherData.gst_in
                                        : '',
                                amount:
                                    pVoucherData.total_payable != null
                                        ? pVoucherData.total_payable
                                        : 0,
                                attached_doc:
                                    pVoucherData.document_name != null &&
                                    pVoucherData.document_name != ''
                                        ? 'Yes'
                                        : 'No',
                                document_name:
                                    pVoucherData.document_name != null
                                        ? pVoucherData.document_name.split(
                                              ' | '
                                          )
                                        : [],
                                doc_document:
                                    pVoucherData.doc_document != null
                                        ? pVoucherData.doc_document.split(' | ')
                                        : [],
                                invoice_no:
                                    pVoucherData.invoice_no != null
                                        ? pVoucherData.invoice_no
                                        : '',
                                invoice_date:
                                    pVoucherData.invoice_date != null
                                        ? pVoucherData.invoice_date
                                        : '',
                                is_advance:
                                    pVoucherData.is_advance != null
                                        ? pVoucherData.is_advance
                                        : 0,
                                payment_due_date:
                                    pVoucherData.date_of_processing != null
                                        ? pVoucherData.date_of_processing
                                        : '',
                                pay_immediately:
                                    pVoucherData.pay_immediately != null &&
                                    pVoucherData.pay_immediately == 1
                                        ? 'Yes'
                                        : 'No',
                                paymentVoucherItems:
                                    pVoucherData.paymentVoucherItems.map(
                                        (value) => {
                                            return {
                                                particular:
                                                    value.particulars != null
                                                        ? value.particulars
                                                        : '',
                                                qty:
                                                    value.qty != null
                                                        ? value.qty
                                                        : 0,
                                                rate:
                                                    value.rate != null
                                                        ? value.rate
                                                        : 0,
                                                discount:
                                                    value.discount != null
                                                        ? value.discount
                                                        : 0,
                                                amount:
                                                    value.amount != null
                                                        ? value.amount
                                                        : 0,
                                                tax_per:
                                                    value.tax_per != null
                                                        ? value.tax_per
                                                        : 0,
                                                tax_total:
                                                    value.tax_amt != null
                                                        ? value.tax_amt
                                                        : 0,
                                                total_amount:
                                                    value.total_amt != null
                                                        ? value.total_amt
                                                        : 0,
                                            }
                                        }
                                    ),
                                total:
                                    pVoucherData.final_amount != null
                                        ? pVoucherData.final_amount
                                        : 0,
                                invoice_amount:
                                    pVoucherData.final_amount != null
                                        ? pVoucherData.final_amount
                                        : 0,
                                tds_per:
                                    pVoucherData.tds_per != null
                                        ? pVoucherData.tds_per
                                        : 0,
                                tds_amount:
                                    pVoucherData.tdsamount != null
                                        ? pVoucherData.tdsamount
                                        : 0,
                                round_off_amount:
                                    pVoucherData.round_off_amount != null
                                        ? pVoucherData.round_off_amount
                                        : 0,
                                total_payable:
                                    pVoucherData.total_payable != null
                                        ? pVoucherData.total_payable
                                        : 0,
                                prepared_by:
                                    rawMaterialData != null
                                        ? rawMaterialData.modified_by_user !=
                                          null
                                            ? rawMaterialData.modified_by_user[
                                                  'first_name'
                                              ] != null
                                                ? rawMaterialData
                                                      .modified_by_user[
                                                      'last_name'
                                                  ] != null
                                                    ? rawMaterialData
                                                          .modified_by_user[
                                                          'first_name'
                                                      ] +
                                                      ' ' +
                                                      rawMaterialData
                                                          .modified_by_user[
                                                          'last_name'
                                                      ]
                                                    : rawMaterialData
                                                          .modified_by_user[
                                                          'first_name'
                                                      ]
                                                : ''
                                            : ''
                                        : pVoucherData.created_by_user != null
                                        ? pVoucherData.created_by_user[
                                              'first_name'
                                          ] != null
                                            ? pVoucherData.created_by_user[
                                                  'last_name'
                                              ] != null
                                                ? pVoucherData.created_by_user[
                                                      'first_name'
                                                  ] +
                                                  ' ' +
                                                  pVoucherData.created_by_user[
                                                      'last_name'
                                                  ]
                                                : pVoucherData.created_by_user[
                                                      'first_name'
                                                  ]
                                            : ''
                                        : '',
                                checked_by:
                                    pVoucherData.requested_by_user != null
                                        ? pVoucherData.requested_by_user[
                                              'first_name'
                                          ] != null
                                            ? pVoucherData.requested_by_user[
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
                                        : '',
                                verified_by:
                                    pVoucherData.modified_by_user != null
                                        ? pVoucherData.modified_by_user[
                                              'first_name'
                                          ] != null
                                            ? pVoucherData.modified_by_user[
                                                  'last_name'
                                              ] != null
                                                ? pVoucherData.modified_by_user[
                                                      'first_name'
                                                  ] +
                                                  ' ' +
                                                  pVoucherData.modified_by_user[
                                                      'last_name'
                                                  ]
                                                : pVoucherData.modified_by_user[
                                                      'first_name'
                                                  ]
                                            : ''
                                        : '',
                                approved_by:
                                    pVoucherData.approved_by_user != null
                                        ? pVoucherData.approved_by_user[
                                              'first_name'
                                          ] != null
                                            ? pVoucherData.approved_by_user[
                                                  'last_name'
                                              ] != null
                                                ? pVoucherData.approved_by_user[
                                                      'first_name'
                                                  ] +
                                                  ' ' +
                                                  pVoucherData.approved_by_user[
                                                      'last_name'
                                                  ]
                                                : pVoucherData.approved_by_user[
                                                      'first_name'
                                                  ]
                                            : ''
                                        : '',
                                prepared_on:
                                    rawMaterialData != null
                                        ? rawMaterialData.modified_on != null
                                            ? rawMaterialData.modified_on
                                            : ''
                                        : pVoucherData.created_on != null
                                        ? pVoucherData.created_on
                                        : '',
                                checked_on:
                                    pVoucherData.created_on != null
                                        ? pVoucherData.created_on
                                        : '',
                                verified_on:
                                    pVoucherData.modified_on != null
                                        ? pVoucherData.modified_on
                                        : '',
                                approved_on:
                                    pVoucherData.approved_on != null
                                        ? pVoucherData.approved_on
                                        : '',
                                remarks:
                                    pVoucherData.remark != null
                                        ? pVoucherData.remark
                                        : '',
                                gate_pass_no:
                                    rawMaterialData != null
                                        ? rawMaterialData.gate_pass_no != null
                                            ? rawMaterialData.gate_pass_no
                                            : ''
                                        : '',
                                inward_date:
                                    rawMaterialData != null
                                        ? rawMaterialData.date_of_receipt !=
                                          null
                                            ? rawMaterialData.date_of_receipt
                                            : ''
                                        : '',
                                erp_inward_date:
                                    rawMaterialData != null
                                        ? rawMaterialData.created_on != null
                                            ? rawMaterialData.created_on
                                            : ''
                                        : '',
                                entry_by:
                                    rawMaterialData != null
                                        ? rawMaterialData.created_by_user !=
                                          null
                                            ? rawMaterialData.created_by_user[
                                                  'first_name'
                                              ] != null
                                                ? rawMaterialData
                                                      .created_by_user[
                                                      'last_name'
                                                  ] != null
                                                    ? rawMaterialData
                                                          .created_by_user[
                                                          'first_name'
                                                      ] +
                                                      ' ' +
                                                      rawMaterialData
                                                          .created_by_user[
                                                          'last_name'
                                                      ]
                                                    : rawMaterialData
                                                          .created_by_user[
                                                          'first_name'
                                                      ]
                                                : ''
                                            : ''
                                        : '',
                                grnRemarks:
                                    rawMaterialData != null
                                        ? rawMaterialData.remarks != null
                                            ? rawMaterialData.remarks
                                            : ''
                                        : '',
                            })
                            setLoading(false)
                        } else if (data.response.status === 422) {
                            console.log(data.response.status)
                            toast.push(
                                <Notification
                                    title="Error"
                                    type="danger"
                                    closable
                                >
                                    {data.response.data['message']}
                                </Notification>
                            )
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
                className={`card-shadow mb-3 flex justify-center ${
                    loading ? 'hidden' : 'visible'
                } overflow-x-auto`}
            >
                <div
                    className="flex flex-col justify-center items-center align-top gap-6"
                    id="financePrint"
                    ref={componentRef}
                >
                    <table className="border table font-normal text-black text-xs leading-6 viewFinance">
                        <tbody>
                            <tr>
                                <td colSpan={10}>
                                    <div className="flex justify-between">
                                        <img
                                            src="/img/logo/logo.png"
                                            width={300}
                                            alt=""
                                        />
                                        <h1 className=" flex items-center">
                                            <b>
                                                {financeVoucher.is_advance ? 'Advance' : ''}{' '} Payment Voucher
                                            </b>
                                        </h1>
                                        <img
                                            src="/img/logo/eatetg.png"
                                            width={90}
                                            alt=""
                                            style={{ marginRight: '12px' }}
                                        />
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={3}>
                                    <div className="flex align-middle">
                                        <Checkbox
                                            checked={
                                                financeVoucher.type.toLowerCase() ==
                                                'purchase'
                                                    ? true
                                                    : false
                                            }
                                            readOnly
                                        >
                                            <span style={{ marginLeft: '5px' }}>
                                                <b>Purchase</b>
                                            </span>
                                        </Checkbox>
                                    </div>
                                </td>
                                <td colSpan={4}>
                                    <div className="flex align-middle">
                                        <Checkbox checked={false} readOnly>
                                            <span style={{ marginLeft: '5px' }}>
                                                <b>Fixed Asset</b>
                                            </span>
                                        </Checkbox>
                                    </div>
                                </td>
                                <td colSpan={3}>
                                    <div className="flex align-middle">
                                        <Checkbox
                                            checked={
                                                financeVoucher.type.toLowerCase() ==
                                                'expense'
                                                    ? true
                                                    : false
                                            }
                                            readOnly
                                        >
                                            <span style={{ marginLeft: '5px' }}>
                                                <b>Expense</b>
                                            </span>
                                        </Checkbox>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td
                                    colSpan={10}
                                    style={{ background: '#ececec' }}
                                >
                                    <p className="text-center">
                                        <b>To be filled by requestor</b>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>Party Name</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p>{financeVoucher.party_name}</p>
                                </td>
                                <td colSpan={2}>
                                    <p>
                                        <b>Requestor Name</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p>{financeVoucher.req_name}</p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>P.O. No #:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p>{financeVoucher.po_no}</p>
                                </td>
                                <td colSpan={2}>
                                    <p>
                                        <b>P.O. Date:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p
                                        className={
                                            financeVoucher.po_date === ''
                                                ? 'hidden'
                                                : 'visible'
                                        }
                                    >
                                        <Moment format="DD-MM-YYYY">
                                            {financeVoucher.po_date === ''
                                                ? new Date()
                                                : financeVoucher.po_date}
                                        </Moment>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>GRN No:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p>{financeVoucher.grn_no}</p>
                                </td>
                                <td colSpan={2}>
                                    <p>
                                        <b>GRN Date:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p
                                        className={
                                            financeVoucher.grn_date === ''
                                                ? 'hidden'
                                                : 'visible'
                                        }
                                    >
                                        <Moment format="DD-MM-YYYY">
                                            {financeVoucher.po_date === ''
                                                ? new Date()
                                                : financeVoucher.po_date}
                                        </Moment>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>Payment Voucher No:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p>{financeVoucher.paymentVoucher_no}</p>
                                </td>
                                <td colSpan={2}>
                                    <p>
                                        <b>Payment Voucher Date:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p
                                        className={
                                            financeVoucher.paymentVoucher_date ===
                                            ''
                                                ? 'hidden'
                                                : 'visible'
                                        }
                                    >
                                        <Moment format="DD-MM-YYYY">
                                            {financeVoucher.paymentVoucher_date ===
                                            ''
                                                ? new Date()
                                                : financeVoucher.paymentVoucher_date}
                                        </Moment>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>GSTIN</b>
                                    </p>
                                </td>
                                <td colSpan={8}>
                                    <p>{financeVoucher.gstin}</p>
                                </td>
                                {/* <td colSpan={2}>
                                    <p>
                                        <b>P.O.No #:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p>
                                        {financeVoucher.order_date
                                            ? financeVoucher.order_date
                                            : 'NA'}
                                    </p>
                                </td> */}
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>Amount</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p>
                                        <NumberFormat
                                            displayType="text"
                                            prefix={'Rs. '}
                                            thousandsGroupStyle={'lakh'}
                                            decimalScale={2}
                                            value={financeVoucher.amount}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </p>
                                </td>
                                <td colSpan={2}>
                                    <p>
                                        <b>Attached(Y/N):</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p>{financeVoucher.attached_doc}</p>
                                </td>
                            </tr>
                            <tr>
                                <td
                                    colSpan={10}
                                    style={{ background: '#ececec' }}
                                >
                                    <p className="text-center">
                                        <b>
                                            Accounts ( To be filled by
                                            Accountant )
                                        </b>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>Invoice No:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p>{financeVoucher.invoice_no}</p>
                                </td>
                                <td colSpan={2}>
                                    <p>
                                        <b>Invoice Date:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p
                                        className={
                                            financeVoucher.invoice_date === ''
                                                ? 'hidden'
                                                : 'visible'
                                        }
                                    >
                                        <Moment format="DD-MM-YYYY">
                                            {financeVoucher.invoice_date === ''
                                                ? new Date()
                                                : financeVoucher.invoice_date}
                                        </Moment>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>Payment Due Date:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    <p
                                        className={
                                            financeVoucher.paymentVoucher_date ===
                                            ''
                                                ? 'hidden'
                                                : 'visible'
                                        }
                                    >
                                        <Moment format="DD-MM-YYYY">
                                            {financeVoucher.payment_due_date ===
                                            ''
                                                ? new Date()
                                                : financeVoucher.payment_due_date}
                                        </Moment>
                                    </p>
                                </td>
                                <td colSpan={2}>
                                    <p>
                                        <b>Pay Immediately:</b>
                                    </p>
                                </td>
                                <td colSpan={3}>
                                    {/* if yes then text will be red */}
                                    <p
                                        className={
                                            financeVoucher.pay_immediately ===
                                            'Yes'
                                                ? 'text-rose-600'
                                                : ''
                                        }
                                    >
                                        {' '}
                                        {financeVoucher.pay_immediately}
                                    </p>
                                </td>
                            </tr>
                            <tr style={{ background: '#ececec' }}>
                                <td colSpan={10}>
                                    <p className="text-center"></p>
                                </td>
                            </tr>
                            <tr className="text-center font-semibold">
                                <td width={80}>
                                    <b>Sr. No.</b>
                                </td>
                                <td width={200} colSpan={2}>
                                    <b>Particular</b>
                                </td>
                                <td width={80}>
                                    <b>Qty</b>
                                </td>
                                <td width={120}>
                                    <b>Rate</b>
                                </td>
                                <td width={120}>
                                    <b>Amount</b>
                                </td>
                                <td width={80}>
                                    <b>Discount(%)</b>
                                </td>
                                <td width={80}>
                                    <b>Tax(%)</b>
                                </td>
                                <td width={120}>
                                    <b>GST</b>
                                </td>
                                <td width={150}>
                                    <b>Total Amount</b>
                                </td>
                            </tr>
                            {/* Loop Through this <tr> */}
                            {financeVoucher.paymentVoucherItems.map(
                                (value, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td colSpan={2}>{value.particular}</td>
                                        <td>{value.qty}</td>
                                        <td>
                                            <NumberFormat
                                                displayType="text"
                                                prefix={'Rs. '}
                                                thousandsGroupStyle={'lakh'}
                                                decimalScale={2}
                                                value={value.rate}
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
                                                value={value.amount}
                                                allowLeadingZeros
                                                thousandSeparator=","
                                            />
                                        </td>
                                        <td>
                                            <NumberFormat
                                                displayType="text"
                                                suffix={'%'}
                                                thousandsGroupStyle={'lakh'}
                                                decimalScale={2}
                                                value={value.discount}
                                                allowLeadingZeros
                                                thousandSeparator=","
                                            />
                                        </td>
                                        <td>
                                            <NumberFormat
                                                displayType="text"
                                                suffix={'%'}
                                                thousandsGroupStyle={'lakh'}
                                                decimalScale={2}
                                                value={value.tax_per}
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
                                                value={value.tax_total}
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
                                                value={value.total_amount}
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
                                <td>{financeVoucher.otherCharges}</td>
                                <td colSpan={4}></td>
                                <td>{financeVoucher.otherCharges_po}</td>
                            </tr> */}
                            <tr style={{ background: '#ececec' }}>
                                <td></td>
                                <td colSpan={8}>
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
                                        value={financeVoucher.total}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={7} rowSpan={4}>
                                    <p>
                                        <b>Remarks:</b> {financeVoucher.remarks}
                                    </p>
                                </td>
                                <td colSpan={2}>
                                    <p className="mb-2">
                                        <b>Invoice Amount</b>
                                    </p>
                                </td>
                                <td>
                                    <NumberFormat
                                        displayType="text"
                                        prefix={'Rs. '}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={financeVoucher.invoice_amount}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>(-) TDS {financeVoucher.tds_per} %</p>
                                </td>
                                <td>
                                    <NumberFormat
                                        displayType="text"
                                        prefix={'Rs. '}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={financeVoucher.tds_amount}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>Round Off Amount</b>
                                    </p>
                                </td>
                                <td>
                                    <p>{financeVoucher.round_off_amount}</p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={2}>
                                    <p>
                                        <b>Total Payable</b>
                                    </p>
                                </td>
                                <td>
                                    <NumberFormat
                                        displayType="text"
                                        prefix={'Rs. '}
                                        thousandsGroupStyle={'lakh'}
                                        decimalScale={2}
                                        value={financeVoucher.total_payable}
                                        allowLeadingZeros
                                        thousandSeparator=","
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <table className="border table font-normal text-black text-xs leading-6 viewFinance">
                        <tbody>
                            <tr style={{ background: '#ececec' }}>
                                <td colSpan={5}>
                                    <p className="text-center">
                                        <b>Prepared By</b>
                                    </p>
                                </td>
                                <td colSpan={5}>
                                    <p className="text-center">
                                        <b>Checked By</b>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={5}>
                                    <div className="grid grid-cols-2 gap-1 items-stretch">
                                        <p>
                                            <b>Name:</b>{' '}
                                            {financeVoucher.prepared_by}
                                        </p>
                                        <p>
                                            <b>Date: </b>
                                            <span
                                                className={
                                                    financeVoucher.prepared_on ===
                                                    ''
                                                        ? 'hidden'
                                                        : 'visible'
                                                }
                                            >
                                                <Moment format="DD-MM-YYYY hh:mm A">
                                                    {financeVoucher.prepared_on ===
                                                    ''
                                                        ? new Date()
                                                        : new Date(
                                                              financeVoucher.prepared_on
                                                          ).toLocaleString(
                                                              'en-US',
                                                              {
                                                                  timeZone:
                                                                      'UTC',
                                                              }
                                                          )}
                                                </Moment>
                                            </span>
                                        </p>
                                    </div>
                                </td>
                                <td colSpan={5}>
                                    <div className="grid grid-cols-2 gap-1 items-stretch">
                                        <p>
                                            <b>Name:</b>{' '}
                                            {financeVoucher.checked_by}
                                        </p>
                                        <p>
                                            <b>Date: </b>
                                            <span
                                                className={
                                                    financeVoucher.checked_on ===
                                                    ''
                                                        ? 'hidden'
                                                        : 'visible'
                                                }
                                            >
                                                <Moment format="DD-MM-YYYY hh:mm A">
                                                    {financeVoucher.checked_on ===
                                                    ''
                                                        ? new Date()
                                                        : new Date(
                                                              financeVoucher.checked_on
                                                          ).toLocaleString(
                                                              'en-US',
                                                              {
                                                                  timeZone:
                                                                      'UTC',
                                                              }
                                                          )}
                                                </Moment>
                                            </span>
                                        </p>
                                    </div>
                                </td>
                            </tr>
                            <tr style={{ background: '#ececec' }}>
                                <td colSpan={5}>
                                    <p className="text-center">
                                        <b>Verified By</b>
                                    </p>
                                </td>
                                <td colSpan={5}>
                                    <p className="text-center">
                                        <b>Approved By</b>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={5}>
                                    <div className="grid grid-cols-2 gap-1 items-stretch">
                                        <p>
                                            <b>Name:</b>{' '}
                                            {financeVoucher.verified_by}
                                        </p>
                                        <p>
                                            <b>Date: </b>
                                            <span
                                                className={
                                                    financeVoucher.verified_on ===
                                                    ''
                                                        ? 'hidden'
                                                        : 'visible'
                                                }
                                            >
                                                <Moment format="DD-MM-YYYY hh:mm A">
                                                    {financeVoucher.verified_on ===
                                                    ''
                                                        ? new Date()
                                                        : new Date(
                                                              financeVoucher.verified_on
                                                          ).toLocaleString(
                                                              'en-US',
                                                              {
                                                                  timeZone:
                                                                      'UTC',
                                                              }
                                                          )}
                                                </Moment>
                                            </span>
                                        </p>
                                    </div>
                                </td>
                                <td colSpan={5}>
                                    <div className="grid grid-cols-2 gap-1 items-stretch">
                                        <p>
                                            <b>Name:</b>{' '}
                                            {financeVoucher.approved_by}
                                        </p>
                                        <p>
                                            <b>Date: </b>
                                            <span
                                                className={
                                                    financeVoucher.approved_on ===
                                                    ''
                                                        ? 'hidden'
                                                        : 'visible'
                                                }
                                            >
                                                <Moment format="DD-MM-YYYY hh:mm A">
                                                    {financeVoucher.approved_on ===
                                                    ''
                                                        ? new Date()
                                                        : new Date(
                                                              financeVoucher.approved_on
                                                          ).toLocaleString(
                                                              'en-US',
                                                              {
                                                                  timeZone:
                                                                      'UTC',
                                                              }
                                                          )}
                                                </Moment>
                                            </span>
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <table className="border table font-normal text-black text-xs leading-6 viewFinance">
                        <tbody>
                            <tr style={{ background: '#ececec' }}>
                                <td colSpan={5} className="w-[50%]">
                                    <p className="text-center">
                                        <b>HOD Approved</b>
                                    </p>
                                </td>
                                <td colSpan={5} className="w-[50%]">
                                    <p className="text-center">
                                        <b>HOD Approval For Payment</b>
                                    </p>
                                </td>
                            </tr>
                            <tr style={{ height: '100px' }}>
                                <td colSpan={5} className="w-[50%]"></td>
                                <td colSpan={5} className="w-[50%]"></td>
                            </tr>
                        </tbody>
                    </table>
                    <table className="border table font-normal text-black text-xs leading-6 viewFinance">
                        <tbody>
                            <tr>
                                <td colSpan={4}>
                                    <p>Journal Voucher No:- </p>
                                </td>
                                <td colSpan={2}>
                                    <p>Payment Date:- </p>
                                </td>
                                <td colSpan={4}>
                                    <p>Payment Voucher No:- </p>
                                </td>
                            </tr>
                            <tr style={{ background: '#ececec' }}>
                                <td colSpan={10}>
                                    <p className="text-center">
                                        <b>Payment Details</b>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={5}>
                                    <p className="text-center">
                                        <b>Payment Mode</b>
                                    </p>
                                </td>
                                <td colSpan={5}>
                                    <p className="text-center">
                                        <b>Cheque No</b>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={5}>
                                    <div className="flex items-center justify-center">
                                        <div className="flex align-middle">
                                            <Checkbox checked={false} readOnly>
                                                <span
                                                    style={{
                                                        marginLeft: '5px',
                                                    }}
                                                >
                                                    Online
                                                </span>
                                            </Checkbox>
                                        </div>
                                        <div className="flex align-middle">
                                            <Checkbox checked={false} readOnly>
                                                <span
                                                    style={{
                                                        marginLeft: '5px',
                                                    }}
                                                >
                                                    Cheque
                                                </span>
                                            </Checkbox>
                                        </div>
                                    </div>
                                </td>
                                <td colSpan={5}></td>
                            </tr>
                        </tbody>
                    </table>
                    <table className="border table font-normal text-black text-xs leading-6 viewFinance">
                        <tbody>
                            <tr>
                                <td>
                                    <p>
                                        <b> Gate Pass No:- </b>
                                        <span>
                                            {financeVoucher.gate_pass_no}
                                        </span>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <p>
                                        <b> Inward Date:- </b>
                                        <span
                                            className={
                                                financeVoucher.inward_date ===
                                                ''
                                                    ? 'hidden'
                                                    : 'visible'
                                            }
                                        >
                                            <Moment format="DD-MM-YYYY hh:mm A">
                                                {financeVoucher.inward_date ===
                                                ''
                                                    ? new Date()
                                                    : new Date(
                                                          financeVoucher.inward_date
                                                      ).toLocaleString(
                                                          'en-US',
                                                          {
                                                              timeZone: 'UTC',
                                                          }
                                                      )}
                                            </Moment>
                                        </span>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <p>
                                        <b> ERP Inward Date:- </b>
                                        <span
                                            className={
                                                financeVoucher.erp_inward_date ===
                                                ''
                                                    ? 'hidden'
                                                    : 'visible'
                                            }
                                        >
                                            <Moment format="DD-MM-YYYY hh:mm A">
                                                {financeVoucher.erp_inward_date ===
                                                ''
                                                    ? new Date()
                                                    : new Date(
                                                          financeVoucher.erp_inward_date
                                                      ).toLocaleString(
                                                          'en-US',
                                                          {
                                                              timeZone: 'UTC',
                                                          }
                                                      )}
                                            </Moment>
                                        </span>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <p>
                                        <b> Entry By:- </b>
                                        <span>{financeVoucher.entry_by}</span>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <p>
                                        <b> Remarks:- </b>
                                        <span>{financeVoucher.grnRemarks}</span>
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    {/* <div className="page-break">
                        <span> </span>
                    </div> */}
                    <div id="documents">
                        {financeVoucher.doc_document &&
                        financeVoucher.doc_document.length > 0
                            ? financeVoucher.doc_document.map(
                                  (value, index) => {
                                      let file = value
                                      if (
                                          value.indexOf('public_html/') !== -1
                                      ) {
                                          file = value.substr(
                                              value.indexOf('public_html/') + 12
                                          )
                                          //   console.log(file)
                                      }
                                      return (
                                          <div
                                              key={index}
                                              className="border-1 mb-1"
                                          >
                                              {value.includes('.pdf') ? (
                                                  <div>
                                                      <Document
                                                          file={`https://erp.eatanytime.in/${file}`}
                                                          onLoadSuccess={
                                                              onDocumentLoadSuccess
                                                          }
                                                      >
                                                          {Array.from(
                                                              {
                                                                  length: numPages,
                                                              },
                                                              (_, index) => (
                                                                  <>
                                                                      <div className="page-break">
                                                                          <span>
                                                                              {' '}
                                                                          </span>
                                                                      </div>
                                                                      <Page
                                                                          pageNumber={
                                                                              index +
                                                                              1
                                                                          }
                                                                          key={
                                                                              index
                                                                          }
                                                                          className={
                                                                              'pdfPageWidth'
                                                                          }
                                                                      />
                                                                  </>
                                                              )
                                                          )}
                                                      </Document>
                                                  </div>
                                              ) : (
                                                  <>
                                                      <div className="page-break">
                                                          <span> </span>
                                                      </div>
                                                      <ViewImages
                                                          url={`https://erp.eatanytime.in/${file}`}
                                                          name={
                                                              financeVoucher
                                                                  .document_name[
                                                                  index
                                                              ]
                                                          }
                                                      />
                                                  </>
                                              )}
                                          </div>
                                      )
                                  }
                              )
                            : ''}
                    </div>
                </div>
            </AdaptableCard>
            <StickyFooter
                className="-mx-1 md:-mx-1 px-8 flex items-center justify-between py-4"
                stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            >
                <div></div>
                <div className="md:flex items-center">
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
                        onClick={() => navigate('/transaction/finance-voucher')}
                    >
                        Back
                    </Button>
                </div>
            </StickyFooter>
        </>
    )
}

export default ViewFinanceVoucher
