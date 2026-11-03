import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { Link, useNavigate } from 'react-router-dom'
import { MdCreate, MdAdd, MdImportExport, MdFileDownload } from 'react-icons/md'
import { HiSearch } from 'react-icons/hi'
import { apiVendorPaymentGet } from 'services/VendorPaymentService'
import NumberFormat from 'react-number-format'
import Moment from 'react-moment'
import Tooltip from 'components/ui/Tooltip'
import { saveAs } from 'file-saver'
import { exportToExcel } from 'react-easy-export'
import { useSelector } from 'react-redux'
import appConfig from 'configs/app.config'

const { TabNav, TabList, TabContent } = Tabs

const VendorPayment = () => {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 10,
        query: '',
        sort: {
            order: '',
            key: '',
        },
        status: 'pending',
    })

    const [statusCount, setStatusCount] = useState({
        immediate: 0,
        due: 0,
        notDue: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        inActive: 0,
        immediateAmt: 0,
        dueAmt: 0,
        notDueAmt: 0,
        totalPayableAmt: 0,
    })

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
        localStorage.setItem('vendorPayment', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:1, status: tab }))
    }
    const navigate = useNavigate()
    const inputRef = useRef(null)

    const debounceFn = debounce(handleDebounceFn, 1000)
    const UserInfo = useSelector((state) => state.auth.user)

    function handleDebounceFn(val) {
        if (typeof val === 'string' && (val.length > 1 || val.length === 0)) {
            setTableData((prevData) => ({
                ...prevData,
                ...{ query: val, pageIndex: 1 },
            }))
        }
    }

    const handleChange = (e) => {
        debounceFn(e.target.value)
    }

    const columns = useMemo(
        () => [
            {
                header: 'Sr. No.',
                cell: (props) =>
                    props.row.index +
                    1 +
                    tableData.pageSize * (tableData.pageIndex - 1),
                width: 60,
            },
            {
                header:
                    tableData.status == 'immediate' ||
                    tableData.status == 'due' ||
                    tableData.status == 'notDue'
                        ? 'Due Date'
                        : 'Date Of Transaction',
                accessorKey: 'transaction_date',
                cell: (props) =>
                    tableData.status == 'immediate' ||
                    tableData.status == 'due' ||
                    tableData.status == 'notDue' ? (
                        <Moment format="DD-MM-YYYY">
                            {props.row.original.date_of_processing}
                        </Moment>
                    ) : (
                        <Moment format="DD-MM-YYYY">
                            {props.row.original.transaction_date}
                        </Moment>
                    ),
                width: 110,
            },
            {
                header: tableData.status == 'immediate' || tableData.status == 'due' || tableData.status == 'notDue' ? 'Invoice Date' : 'Payment Type',
                accessorKey: 'invoice_date',
                cell: (props) =>
                    tableData.status == 'immediate' ||
                    tableData.status == 'due' ||
                    tableData.status == 'notDue' ? (
                        <Moment format="DD-MM-YYYY">
                            {props.row.original.invoice_date}
                        </Moment>
                    ) : (
                        props.row.original.payment_type
                    ),
                width: 110,
            },
            {
                header: 'Invoice No',
                accessorKey:
                    tableData.status == 'immediate' ||
                    tableData.status == 'due' ||
                    tableData.status == 'notDue'
                        ? 'invoice_no'
                        : 'invoice_nos',
                cell: (props) => {
                    if (
                        tableData.status == 'immediate' ||
                        tableData.status == 'due' ||
                        tableData.status == 'notDue'
                    ) {
                        return props.row.original.invoice_no == null
                            ? ''
                            : props.row.original.invoice_no
                    } else {
                        return props.row.original.invoice_nos == null
                            ? ''
                            : props.row.original.invoice_nos
                    }
                },
                width: 150,
            },
            {
                header: 'Vendors',
                accessorKey: 'vendor_names',
                cell: (props) => {
                    return props.row.original.vendor_names
                        ? props.row.original.vendor_names
                        : props.row.original.vendor_name
                },
                width: 450,
            },
            {
                header: 'Total Amount',
                accessorKey: 'total_amount',
                cell: (props) => (
                    <NumberFormat
                        displayType="text"
                        prefix={'₹'}
                        thousandsGroupStyle={'lakh'}
                        decimalScale={2}
                        value={
                            props.row.original.total_amount ? props.row.original.total_amount : (props.row.original.total_payable - (props.row.original.paid_amount ? props.row.original.paid_amount : 0))
                        }
                        allowLeadingZeros
                        thousandSeparator=","
                    />
                ),
                width: 100,
            },
            {
                header: 'Action',
                width: 80,
                cell: (props) => (
                    <>
                        {tableData.status === 'immediate' ||
                        tableData.status === 'due' ||
                        tableData.status === 'notDue' ? (
                            ''
                        ) : UserInfo.userId !== props.row.original.modified_by ? (
                            <Link to={`/transaction/vendor-payment/approved-vendor-payment/${props.row.original.id}`}>
                                <Button
                                    shape="circle"
                                    size="sm"
                                    variant="twoTone"
                                    icon={<MdCreate />}
                                    className="mr-3"
                                />
                            </Link>
                        ): (
                            <Link to={`/transaction/vendor-payment/edit-vendor-payment/${props.row.original.id}`}>
                                <Button
                                    shape="circle"
                                    size="sm"
                                    variant="twoTone"
                                    icon={<MdCreate />}
                                    className="mr-3"
                                />
                            </Link>
                        )}
                        {tableData.status === 'approved' ? (
                            <Tooltip title="Download File">
                                <Button
                                    shape="circle"
                                    size="sm"
                                    variant="twoTone"
                                    color="blue-600"
                                    icon={<MdFileDownload />}
                                    onClick={() => {
                                        download(props.row.original)
                                    }}
                                    className={
                                        props.row.original.status === 'Approved'
                                            ? 'visible'
                                            : 'hidden'
                                    }
                                />
                            </Tooltip>
                        ) : (
                            ''
                        )}
                    </>
                ),
            },
        ],
        [tableData.pageIndex, tableData.pageSize, tableData.status]
    )

    const handlePaginationChange = (pageIndex) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageIndex } }))
        localStorage.setItem('vendorPayment', JSON.stringify({ pageSize:tableData.pageSize, pageIndex, status: tableData.status }))
    }

    const handleSelectChange = (pageSize) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageSize } }))
        localStorage.setItem('vendorPayment', JSON.stringify({ pageSize, pageIndex:tableData.pageIndex, status: tableData.status }))
    }

    const handleSort = ({ order, key }) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ sort: { order, key } },
        }))
    }

    console.log('Vendor Payments Loading....')

    const getVendorData = (data)=>{
        apiVendorPaymentGet(data)
        .then((data) => {
            // console.log(data)
            if (data.data) {
                setStatusCount(data.data['statusCount'])
                setData(data.data['rows'])
                setTableData((prevData) => ({
                    ...prevData,
                    ...{ total: data.data['total'] },
                }))
                setLoading(false)
            }
        })
        .catch((error) => {
            if (error.response.status === 401) {
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {error.response.data['message']}
                    </Notification>
                )
            } else if (error.response.status === 500) {
                console.log(error)
                setLoading(false)
            }
        })
    }

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            if (localStorage.getItem('vendorPayment')){
                let data = JSON.parse(localStorage.getItem('vendorPayment')) 
                // console.log(data.status)
                setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
                getVendorData({...tableData, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status})
            }else{

                getVendorData(tableData)
            }
            return true
        }
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        tableData.pageIndex,
        tableData.sort,
        tableData.pageSize,
        tableData.query,
        tableData.status,
    ])

    const download = async (url) => {
        console.log(url)
        if (url.payment_file != null) {
            saveAs(
                `${appConfig.reportUrl}vendor_payments/` +
                    url.payment_file,
                url.payment_file
            )
        }
    }

    const downloadAll = () => {
        apiVendorPaymentGet({
            total: 0,
            pageIndex: 1,
            pageSize: 'all',
            query: '',
            sort: {
                order: '',
                key: '',
            },
            status: tableData.status,
        })
            .then((data) => {
                if (data.data) {
                    exportToExcel(
                        data.data['rows'],
                        `finance-voucher-${new Date().toLocaleString()}.xls`
                    )
                }
            })
            .catch((error) => {
                if (error.response.status === 500) {
                    console.log(error)
                    setLoading(false)
                } else if (error.response.status === 401) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                }
            })
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-0">
                <h3 className="mb-0 lg:mb-0 ">Vendor Payment</h3>
                <div className="flex flex-row lg:flex-row lg:items-center gap-4">
                    <h4>
                        <span className="mr-2 text-gray-700">
                            Total Payable Amount :{' '}
                        </span>
                        <span className="text-rose-600">
                            <NumberFormat
                                displayType="text"
                                prefix={'₹'}
                                thousandsGroupStyle={'lakh'}
                                decimalScale={2}
                                value={statusCount.totalPayableAmt}
                                allowLeadingZeros
                                thousandSeparator=","
                            />
                        </span>
                    </h4>
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52"
                        onChange={handleChange}
                        prefix={<HiSearch className="text-lg" />}
                    />
                    <Link
                        to={'/transaction/vendor-payment/add-vendor-payment'}
                        className=" inline-flex"
                    >
                        <Button size="sm" variant="solid" icon={<MdAdd />}>
                            <span>Add Vendor Payment</span>
                        </Button>
                    </Link>
                    <div className=" inline-flex">
                        <Button
                            size="sm"
                            variant="solid"
                            className="mr-4"
                            color="emerald-600"
                            icon={<MdImportExport />}
                            onClick={() => {
                                exportToExcel(
                                    data,
                                    `finance-voucher-${new Date().toLocaleString()}.xls`
                                )
                            }}
                            disabled={!data.length > 0}
                        >
                            <span>Download</span>
                        </Button>
                        <Button
                            size="sm"
                            variant="solid"
                            color="emerald-600"
                            icon={<MdImportExport />}
                            onClick={() => {
                                downloadAll()
                            }}
                            disabled={!data.length > 0}
                        >
                            <span>Download All</span>
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs
                defaultValue={localStorage.getItem('vendorPayment') === null ? "pending" : JSON.parse(localStorage.getItem('vendorPayment')).status}
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
            >
                <TabList className="justify-between">
                    <div className="flex justify-start">
                        <TabNav value="immediate">
                            <p className=" relative pb-4">
                                <span>
                                    Immediate {`(${statusCount.immediate})`}
                                </span>
                                <NumberFormat
                                    className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-0"
                                    displayType="text"
                                    prefix={'₹'}
                                    thousandsGroupStyle={'lakh'}
                                    decimalScale={2}
                                    value={statusCount.immediateAmt}
                                    allowLeadingZeros
                                    thousandSeparator=","
                                />
                            </p>
                        </TabNav>
                        <TabNav value="due">
                            <p className=" relative pb-4">
                                <span>Due {`(${statusCount.due})`}</span>
                                <NumberFormat
                                    className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-0"
                                    displayType="text"
                                    prefix={'₹'}
                                    thousandsGroupStyle={'lakh'}
                                    decimalScale={2}
                                    value={statusCount.dueAmt}
                                    allowLeadingZeros
                                    thousandSeparator=","
                                />
                            </p>
                        </TabNav>
                        <TabNav value="notDue">
                            <p className=" relative pb-4">
                                <span>Not Due {`(${statusCount.notDue})`}</span>
                                <NumberFormat
                                    className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-0"
                                    displayType="text"
                                    prefix={'₹'}
                                    thousandsGroupStyle={'lakh'}
                                    decimalScale={2}
                                    value={statusCount.notDueAmt}
                                    allowLeadingZeros
                                    thousandSeparator=","
                                />
                            </p>
                        </TabNav>
                    </div>
                    <div className="flex justify-end">
                        <TabNav value="pending">
                            Pending Approval {`(${statusCount.pending})`}
                        </TabNav>
                        <TabNav value="rejected">
                            Rejected {`(${statusCount.rejected})`}
                        </TabNav>
                        <TabNav value="inactive">
                            Inactive {`(${statusCount.inActive})`}
                        </TabNav>
                        <TabNav value="approved">
                            Approved {`(${statusCount.approved})`}
                        </TabNav>
                    </div>
                </TabList>
                <div className="p-1">
                    <TabContent value="immediate"></TabContent>
                    <TabContent value="due"></TabContent>
                    <TabContent value="notDue"></TabContent>
                    <TabContent value="pending"></TabContent>
                    <TabContent value="rejected"></TabContent>
                    <TabContent value="inactive"></TabContent>
                    <TabContent value="approved"></TabContent>
                </div>
            </Tabs>
            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagingData={tableData}
                onPaginationChange={handlePaginationChange}
                onSelectChange={handleSelectChange}
                onSort={handleSort}
            />
        </AdaptableCard>
    )
}

export default VendorPayment
