import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import { MdImportExport, MdVisibility } from 'react-icons/md'
import { Link } from 'react-router-dom'
import { HiPlusCircle, HiPrinter, HiSearch } from 'react-icons/hi'
import NumberFormat from 'react-number-format'
import { apiSampleGet, apiSampleVoucher } from 'services/SampleExpiryService'
import { formatDate } from '../Sales/Sales'
import { openPrintout } from '../Sales/salesFiles'
import { exportToExcel } from 'react-easy-export'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

const { TabNav, TabList, TabContent } = Tabs

// Sample / Expiry (old PHP Sample_out list). Opens on Delivery Pending like the old list.

const TABS = [
    { value: 'approved', label: 'Approved' },
    { value: 'pending', label: 'Pending' },
    { value: 'pending_for_approval', label: 'Approval Pending' },
    { value: 'pending_for_delivery', label: 'Delivery Pending' },
    { value: 'gp_issued', label: 'GP Issued' },
    { value: 'delivered_not_complete', label: 'InComplete' },
    { value: 'inactive', label: 'Cancelled' },
]

const showError = (error) => {
    if (error && error.response) {
        toast.push(
            <Notification title="Error" type="danger" closable>
                {error.response.data['message']}
            </Notification>
        )
    }
}

const toExportRows = (rows) => rows.map((row, index) => ({
    'Sr. No.': index + 1,
    'Date Of Processing': formatDate(row.date_of_processing),
    'Voucher No': row.voucher_no,
    'Distributor Name': row.distributor_name,
    'Location': row.location,
    'Amount (In Rs)': row.final_amount,
    'Delivery Status': row.delivery_status,
}))

const SampleExpiry = () => {
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
        status: 'pending_for_delivery',
    })
    const [statusCount, setStatusCount] = useState({})
    const [action, setAction] = useState({ insert: false })
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

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
    }

    const columns = useMemo(() => (
        [
            {
                header: 'Sr. No.',
                enableSorting: false,
                cell: (props) => props.row.index + 1 + tableData.pageSize * (tableData.pageIndex - 1),
                width: 60,
            },
            {
                header: 'Date Of Processing',
                accessorKey: 'date_of_processing',
                cell: (props) => formatDate(props.row.original.date_of_processing),
            },
            {
                header: 'Voucher No',
                accessorKey: 'voucher_no',
            },
            {
                header: 'Distributor Name',
                accessorKey: 'distributor_name',
            },
            {
                header: 'Location',
                accessorKey: 'location',
                enableSorting: false,
            },
            {
                header: 'Amount (In Rs)',
                accessorKey: 'final_amount',
                cell: (props) => (
                    <NumberFormat
                        displayType="text"
                        value={props.row.original.final_amount || 0}
                        thousandSeparator
                        decimalScale={2}
                        fixedDecimalScale
                    />
                ),
            },
            {
                header: 'Delivery Status',
                accessorKey: 'delivery_status',
            },
            {
                // Old PHP list actions: view the voucher; issue the gate pass from Delivery Pending
                header: 'Action',
                enableSorting: false,
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <div className="flex gap-2">
                            {row.voucher_no ? (
                                <Button
                                    size="xs"
                                    title="Print Voucher"
                                    icon={<HiPrinter />}
                                    onClick={() => openPrintout(() => apiSampleVoucher(row.id), showError)}
                                />
                            ) : null}
                            {action.update && row.status === 'Approved' && row.delivery_status === 'Pending' ? (
                                <Link to={`/transaction/sample-expiry/dispatch/${row.id}`}>
                                    <Button size="xs" variant="twoTone">Issue GP</Button>
                                </Link>
                            ) : null}
                            {action.update && row.status === 'Approved' && row.delivery_status === 'GP Issued' ? (
                                <Link to={`/transaction/sample-expiry/view/${row.id}`}>
                                    <Button size="xs" variant="twoTone">Update Delivery</Button>
                                </Link>
                            ) : null}
                        </div>
                    )
                },
            },
            {
                header: 'View',
                width: 60,
                enableSorting: false,
                cell: (props) => (
                    <Link to={`/transaction/sample-expiry/view/${props.row.original.id}`}>
                        <Button shape="circle" size="sm" variant="twoTone" icon={<MdVisibility />} />
                    </Link>
                ),
            },
        ]
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [tableData.pageIndex, tableData.pageSize, action])

    const handlePaginationChange = (pageIndex) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageIndex } }))
    }

    const handleSelectChange = (pageSize) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageSize } }))
    }

    const handleSort = ({ order, key }) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ sort: { order, key } },
        }))
    }

    useEffect(() => {
        setLoading(true)
        apiSampleGet(tableData).then((data) => {
            if (data.data) {
                setData(data.data['rows'])
                setStatusCount(data.data['statusCount'])
                setAction(data.data['action'] || { insert: false })
                setTableData((prevData) => ({
                    ...prevData,
                    ...{ total: data.data['total'] },
                }))
            }
            setLoading(false)
        }).catch((error) => {
            showError(error)
            setLoading(false)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableData.pageIndex, tableData.sort, tableData.pageSize, tableData.query, tableData.status])

    const downloadAll = () => {
        apiSampleGet({
            ...tableData,
            pageIndex: 1,
            pageSize: 'all',
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    toExportRows(data.data['rows']),
                    `sample-expiry-${new Date().toLocaleString()}.xls`
                )
            }
        }).catch(showError)
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-2">
                <h3 className="mb-4 lg:mb-0 ">Sample / Expiry</h3>
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
                        {action.insert ? (
                            <Link to="/transaction/sample-expiry/add-sample-expiry" className="mr-4">
                                <Button size="sm" variant="solid" icon={<HiPlusCircle />}>
                                    <span>Add Sample / Expiry</span>
                                </Button>
                            </Link>
                        ) : null}
                        <Button
                            size="sm"
                            variant="solid"
                            className="mr-4"
                            color="emerald-600"
                            icon={<MdImportExport />}
                            onClick={() => {
                                exportToExcel(
                                    toExportRows(data),
                                    `sample-expiry-${new Date().toLocaleString()}.xls`
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
                            onClick={downloadAll}
                            disabled={!data.length > 0}
                        >
                            <span>Download All</span>
                        </Button>
                    </div>
                </div>
            </div>
            <Tabs defaultValue="pending_for_delivery" onChange={(tabValue) => { tabChanges(tabValue) }}>
                <TabList className="justify-end flex-wrap">
                    {TABS.map((tab) => (
                        <TabNav key={tab.value} value={tab.value}>
                            {tab.label} {`(${statusCount[tab.value] || 0})`}
                        </TabNav>
                    ))}
                </TabList>
                <div className="p-4">
                    {TABS.map((tab) => (
                        <TabContent key={tab.value} value={tab.value}></TabContent>
                    ))}
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

export default SampleExpiry
