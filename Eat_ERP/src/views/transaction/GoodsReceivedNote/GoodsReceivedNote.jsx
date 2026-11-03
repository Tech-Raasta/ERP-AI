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
import { MdCreate, MdImportExport } from 'react-icons/md'
import { BiBookOpen } from 'react-icons/bi'
import { HiSearch } from 'react-icons/hi'
import { exportToExcel } from 'react-easy-export'
import NumberFormat from 'react-number-format'
import Tooltip from 'components/ui/Tooltip'
import { apiGRNGet } from 'services/GRNService'

import DownloadGRN from './DownloadGRN'

const { TabNav, TabList, TabContent } = Tabs

const GoodsReceivedNote = () => {
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
        status: 'inProcess',
    })

    const [statusCount, setStatusCount] = useState({
        inProcess: 0,
        pending: 0,
        resubmit: 0,
        rejected: 0,
        inActive: 0,
        approved: 0,
    })

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
        localStorage.setItem('invoiceProcessing', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:1, status: tab }))
    }

    const navigate = useNavigate()
    const inputRef = useRef(null)

    const debounceFn = debounce(handleDebounceFn, 1000)

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
                header: 'Date Of Receipt',
                accessorKey: 'date_of_receipt',
                cell: (props) => {
                    let a = new Date(props.row.original.date_of_receipt)
                    return `${
                        a.getDate() < 10 ? '0' + a.getDate() : a.getDate()
                    }-${
                        a.getMonth() + 1 < 10
                            ? '0' + (a.getMonth() + 1)
                            : a.getMonth() + 1
                    }-${a.getFullYear()}`
                },
                width: 100,
            },
            {
                header: 'PO No.',
                cell: (props) => {
                    return props.row.original.po_no === null ||
                        props.row.original.po_no === ''
                        ? ''
                        : props.row.original.po_no
                },
                width: 180,
            },
            {
                header: 'Vendor Name',
                cell: (props) => {
                    return props.row.original.vendor_name === null ||
                        props.row.original.vendor_name === ''
                        ? ''
                        : props.row.original.vendor_name
                },
            },
            {
                header: 'Depot Name',
                cell: (props) => {
                    return props.row.original.depot_name === null ||
                        props.row.original.depot_name === ''
                        ? ''
                        : props.row.original.depot_name
                },
            },
            {
                header: 'Items',
                cell: (props) => {
                    return props.row.original.rm_in_item_names === null ||
                        props.row.original.rm_in_item_names === ''
                        ? ''
                        : props.row.original.rm_in_item_names
                },
            },
            {
                header: 'Amount',
                cell: (props) => {
                    return props.row.original.final_amount === null ||
                        props.row.original.final_amount === '' ? (
                        ''
                    ) : (
                        <NumberFormat
                            displayType="text"
                            prefix={'₹'}
                            thousandsGroupStyle={'lakh'}
                            decimalScale={2}
                            value={props.row.original.final_amount}
                            allowLeadingZeros
                            thousandSeparator=","
                        />
                    )
                },
                width: 100,
            },
            {
                header: 'Status',
                accessorKey: 'grn_status',
                width: 90,
            },
            {
                header: 'Action',
                width: 120,
                cell: (props) => (
                    <>
                        <div
                            className={
                                tableData.status == 'approved'
                                    ? 'hidden'
                                    : 'visible inline'
                            }
                        >
                            <Tooltip title="Edit GRN">
                                <Link to={`/transaction/goods-received-note/edit-goods-received-note/${props.row.original.id}`}>
                                    <Button
                                        shape="circle"
                                        size="sm"
                                        variant="twoTone"
                                        icon={<MdCreate />}
                                        className="text-sm mr-3"
                                    />
                                </Link>
                            </Tooltip>
                        </div>
                        {/* <div className="hidden"> */}
                        {tableData.status == 'approved' ? (
                            <>
                                <DownloadGRN grnId={props.row.original.id} />
                                <Tooltip title="View Invoice Processing">
                                    <Link to={`/transaction/goods-received-note/view-goods-received-note/${props.row.original.id}`}>
                                        <Button
                                            shape="circle"
                                            size="sm"
                                            variant="twoTone"
                                            icon={<BiBookOpen />}
                                            color="blue-600"
                                            className="text-sm mr-3"
                                        />
                                    </Link>
                                </Tooltip>
                            </>
                        ) : (
                            ''
                        )}
                        {/* </div> */}
                    </>
                ),
            },
        ],
        [tableData.pageIndex, tableData.pageSize, tableData.status]
    )

    const handlePaginationChange = (pageIndex) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageIndex } }))
        localStorage.setItem('invoiceProcessing', JSON.stringify({ pageSize:tableData.pageSize, pageIndex, status: tableData.status }))
    }

    const handleSelectChange = (pageSize) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageSize } }))
        localStorage.setItem('invoiceProcessing', JSON.stringify({ pageSize, pageIndex:tableData.pageIndex, status: tableData.status }))
    }

    const handleSort = ({ order, key }) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ sort: { order, key } },
        }))
    }

    console.log('GRN.js Loading....')

    // useEffect(() => {
        
    // }, []);

    const getInvoiceData = (data)=>{
        apiGRNGet(data)
            .then((data) => {
                console.log(data.data)
                if (data.data) {
                    setStatusCount({
                        inProcess: data.data['statusCount'].inProcess,
                        pending: data.data['statusCount'].pending,
                        resubmit: data.data['statusCount'].resubmit,
                        rejected: data.data['statusCount'].rejected,
                        inActive: data.data['statusCount'].inActive,
                        approved: data.data['statusCount'].approved,
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
        const fetchData = () => {
            setLoading(true)
            if (localStorage.getItem('invoiceProcessing')){
                let data = JSON.parse(localStorage.getItem('invoiceProcessing')) 
                // console.log(data.status)
                setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
                getInvoiceData({...tableData, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status})
            }else{
                getInvoiceData(tableData)
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
        apiGRNGet({
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
                        `invoice-processing-${new Date().toLocaleString()}.xls`
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
                <h3 className="mb-4 lg:mb-0 ">Invoice Processing</h3>
                <div className="flex flex-row lg:flex-row lg:items-center">
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52 mr-4"
                        onChange={handleChange}
                        prefix={<HiSearch className="text-lg" />}
                    />
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
                                    `invoice-processing-${new Date().toLocaleString()}.xls`
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
                defaultValue={localStorage.getItem('invoiceProcessing') === null ? 'inProcess' : JSON.parse(localStorage.getItem('invoiceProcessing')).status}
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
            >
                <TabList className="justify-end">
                    <TabNav value="inProcess">
                        Rate Pending {`(${statusCount.inProcess})`}
                    </TabNav>
                    <TabNav value="resubmit">
                        Resubmit {`(${statusCount.resubmit})`}
                    </TabNav>
                    <TabNav value="pending">
                        Pending Approval {`(${statusCount.pending})`}
                    </TabNav>
                    <TabNav value="rejected">
                        Rejected {`(${statusCount.rejected})`}
                    </TabNav>
                    <TabNav value="inActive">
                        Cancelled {`(${statusCount.inActive})`}
                    </TabNav>
                    <TabNav value="approved">
                        Approved {`(${statusCount.approved})`}
                    </TabNav>
                </TabList>
                <div className="p-1">
                    <TabContent value="inProcess"></TabContent>
                    <TabContent value="resubmit"></TabContent>
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

export default GoodsReceivedNote
