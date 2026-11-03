import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { MdCreate, MdAdd, MdImportExport } from 'react-icons/md'
import { HiSearch } from 'react-icons/hi'
import {
    apiPurchaseOrderGet,
    apiPurchaseOrderSendMail,
} from 'services/PurchaseOrderService'
import { exportToExcel } from 'react-easy-export'
import NumberFormat from 'react-number-format'
import Tooltip from 'components/ui/Tooltip'
import { BiBookOpen, BiMailSend } from 'react-icons/bi'

const { TabNav, TabList, TabContent } = Tabs

const PurchaseOrder = () => {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)
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
        drafted:0,
        advance: 0,
        approved: 0,
        inActive: 0,
        open: 0,
        payment_pending: 0,
        pending: 0,
        rejected: 0,
    })

    const [loadStatus, setLoadStatus] = useState('pending')
    const location = useLocation()
    const navigate = useNavigate()
    const inputRef = useRef(null)

    const debounceFn = debounce(handleDebounceFn, 1000)

    const tabChanges = (tab) => {
        setLoadStatus(tab)
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
        localStorage.setItem('purchaseOrder', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:1, status: tab }))
    }

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
                header: 'Order Date',
                cell: (props) => {
                    let a = new Date(props.row.original.order_date)
                    return props.row.original.order_date === null
                        ? ''
                        : `${
                              a.getDate() < 10 ? '0' + a.getDate() : a.getDate()
                          }-${
                              a.getMonth() + 1 < 10
                                  ? '0' + (a.getMonth() + 1)
                                  : a.getMonth() + 1
                          }-${a.getFullYear()}`
                },
                accessorKey: 'order_date',
            },
            {
                header: 'Po. No.',
                accessorKey: 'po_no',
            },
            {
                header: 'Vendor Name',
                cell: (props) => {
                    return props.row.original.vendor_name === null
                        ? ''
                        : props.row.original.vendor_name
                },
            },
            {
                header: 'Depot Name',
                cell: (props) => {
                    return props.row.original.depot_name === null
                        ? ''
                        : props.row.original.depot_name
                },
            },
            {
                header: 'Items',
                cell: (props) => {
                    return props.row.original.po_item_names === null 
                        ? ''
                        : props.row.original.po_item_names
                },
            },
            {
                header: 'Amount',
                cell: (props) => {
                    return (
                        <NumberFormat
                            displayType="text"
                            prefix={'₹'}
                            thousandsGroupStyle={'lakh'}
                            decimalScale={2}
                            value={props.row.original.po_amount}
                            allowLeadingZeros
                            thousandSeparator=","
                        />
                    )
                },
            },
            {
                header: 'Action',
                width: 150,
                cell: (props) => (
                    <>
                        <Tooltip title="Edit Purchase Order">
                            <Link to={`/transaction/purchase-order/edit-purchase-order/${props.row.original.id}`}>
                                <Button
                                    shape="circle"
                                    size="sm"
                                    variant="twoTone"
                                    icon={<MdCreate />}
                                    className="text-sm mr-3"
                                />
                            </Link>
                        </Tooltip>
                        {tableData.status == 'pending' || tableData.status == 'drafted' ? (
                            ''
                        ) : (
                            <>
                                <Tooltip title="View Purchase Order">
                                    <Link to={`/transaction/purchase-order/view-purchase-order/${props.row.original.id}`}>
                                        <Button
                                            shape="circle"
                                            size="sm"
                                            variant="twoTone"
                                            color="blue-600"
                                            icon={<BiBookOpen />}
                                            className="text-sm mr-3"
                                            // loading={loading}
                                        />
                                    </Link>
                                </Tooltip>
                                <Tooltip title="Send Mail">
                                    <Button
                                        shape="circle"
                                        size="sm"
                                        variant="twoTone"
                                        color="violet-900"
                                        icon={<BiMailSend />}
                                        onClick={() =>
                                            sendMail(props.row.original.id)
                                        }
                                        className="text-sm"
                                        // loading={loading}
                                    />
                                </Tooltip>
                            </>
                        )}
                    </>
                ),
            },
        ],
        [tableData.pageIndex, tableData.pageSize, tableData.status]
    )

    const handlePaginationChange = (pageIndex) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageIndex } }))
        localStorage.setItem('purchaseOrder', JSON.stringify({ pageSize:tableData.pageSize, pageIndex, status: tableData.status }))
    }

    const handleSelectChange = (pageSize) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageSize } }))
        localStorage.setItem('purchaseOrder', JSON.stringify({ pageSize, pageIndex:tableData.pageIndex, status: tableData.status }))
    }

    const handleSort = ({ order, key }) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ sort: { order, key } },
        }))
    }

    console.log('PurchaseOrder.js Loading....')

    // useEffect(() => {
    //     if (localStorage.getItem('purchaseOrder')){
    //         let data = JSON.parse(localStorage.getItem('purchaseOrder')) 
    //         // console.log(data.status)
    //         setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
    //     }
    // }, []);

    const getPurchaseData = (data)=>{
        apiPurchaseOrderGet(data)
            .then((data) => {
                if (data.data) {
                    setStatusCount({
                        drafted:data.data['statusCount'].drafted,
                        advance: data.data['statusCount'].advance,
                        approved: data.data['statusCount'].approved,
                        inActive: data.data['statusCount'].inActive,
                        open: data.data['statusCount'].open,
                        payment_pending:
                            data.data['statusCount'].payment_pending,
                        pending: data.data['statusCount'].pending,
                        rejected: data.data['statusCount'].rejected,
                    })
                    setData(data.data['rows'])
                    setTableData((prevData) => ({
                        ...prevData,
                        ...{ total: data.data['total'] },
                    }))
                    setLoading(false)
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
                setLoading(false)
            })
    }

    useEffect(() => {
        // console.log(location)

        setLoading(true)
        const fetchData = () => {
            if (location.search != '') {
                let status = location.search.replace('?', '').split('=')[1]
                setLoadStatus(status)
                setTableData((prevData) => ({
                    ...prevData,
                    ...{ status: status },
                }))
                setTimeout(() => {
                    const updatedUrl =
                        window.location.protocol +
                        '//' +
                        window.location.host +
                        window.location.pathname
                    window.history.pushState(
                        { path: updatedUrl },
                        '',
                        updatedUrl
                    )
                    // window.history.replace({
                    //     search: queryParams,
                    // })
                    location.search = ''
                }, 500)
                console.log(location)
                console.log('only 1st time')
            }
            if (localStorage.getItem('purchaseOrder')){
                let data = JSON.parse(localStorage.getItem('purchaseOrder')) 
                // console.log(data.status)
                setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
                getPurchaseData({...tableData, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status})
            }else{
                getPurchaseData(tableData)
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

    const downloadAll = () => {
        apiPurchaseOrderGet({
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
                        `PO-${new Date().toLocaleString()}.xls`
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

    const sendMail = (id) => {
        apiPurchaseOrderSendMail(id)
            .then((data) => {
                if (data.status === 200) {
                    console.log(data)
                    toast.push(
                        <Notification title="Success" type="success" closable>
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
    }
    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-0">
                <h3 className="mb-4 lg:mb-0 ">Purchase Order</h3>
                <div className="flex flex-row lg:flex-row lg:items-center">
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52 mr-4"
                        onChange={handleChange}
                        prefix={<HiSearch className="text-lg" />}
                    />
                    <Link
                        to={'/transaction/purchase-order/add-purchase-order'}
                        className=" mr-4 inline-flex"
                    >
                        <Button size="sm" variant="solid" icon={<MdAdd />}>
                            <span>Add Purchase Order</span>
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
                                    `PO-${new Date().toLocaleString()}.xls`
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
                // value={loadStatus}
                defaultValue={localStorage.getItem('purchaseOrder') === null ? 'pending' : JSON.parse(localStorage.getItem('purchaseOrder')).status}
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
            >
                <TabList className="justify-end">
                    <TabNav value="drafted">
                        Drafted {`(${statusCount.drafted})`}
                    </TabNav>
                    <TabNav value="pending">
                        Pending Approval {`(${statusCount.pending})`}
                    </TabNav>
                    <TabNav value="open">Open {`(${statusCount.open})`}</TabNav>
                    <TabNav value="payment_pending">
                        Payment Pending {`(${statusCount.payment_pending})`}
                    </TabNav>
                    <TabNav value="advance">
                        Advance {`(${statusCount.advance})`}
                    </TabNav>
                    <TabNav value="rejected">
                        Rejected {`(${statusCount.rejected})`}
                    </TabNav>
                    <TabNav value="approved">
                        Approved {`(${statusCount.approved})`}
                    </TabNav>
                </TabList>
                <div className="p-1">
                    <TabContent value="drafted"></TabContent>
                    <TabContent value="pending"></TabContent>
                    <TabContent value="open"></TabContent>
                    <TabContent value="payment_pending"></TabContent>
                    <TabContent value="advance"></TabContent>
                    <TabContent value="rejected"></TabContent>
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

export default PurchaseOrder
