import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import { MdImportExport, MdVisibility } from 'react-icons/md'
import { Link } from 'react-router-dom'
import useStartTab from 'utils/hooks/useStartTab'
import { HiPlusCircle, HiPrinter, HiSearch } from 'react-icons/hi'
import NumberFormat from 'react-number-format'
import { apiSalesReturnGet, apiSalesReturnReceipt } from 'services/SalesReturnService'
import { formatDate } from '../Sales/Sales'
import { openPrintout } from '../Sales/salesFiles'
import { exportToExcel } from 'react-easy-export'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

const { TabNav, TabList, TabContent } = Tabs

// Sales Return (old PHP Distributor_in list). Pending also holds delete requests.

const TABS = [
    { value: 'approved', label: 'Approved' },
    { value: 'pending', label: 'Pending' },
    { value: 'rejected', label: 'Rejected' },
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
    'Sales Return No': row.sales_return_no,
    'Order No': row.order_no,
    'Depot': row.depot_name,
    'Distributor': row.distributor_name,
    'Amount (In Rs)': row.final_amount,
}))

const SaleReturn = () => {
    const startTab = useStartTab(TABS, 'approved')
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 10,
        query: '',
        sort: { order: '', key: '' },
        status: startTab,
    })
    const [statusCount, setStatusCount] = useState({})
    const [action, setAction] = useState({ insert: false })
    const inputRef = useRef(null)

    const debounceFn = debounce(handleDebounceFn, 1000)

    function handleDebounceFn(val) {
        if (typeof val === 'string' && (val.length > 1 || val.length === 0)) {
            setTableData((prevData) => ({ ...prevData, ...{ query: val, pageIndex: 1 } }))
        }
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
            { header: 'Sales Return No', accessorKey: 'sales_return_no' },
            { header: 'Order No', accessorKey: 'order_no' },
            { header: 'Depot', accessorKey: 'depot_name' },
            { header: 'Distributor', accessorKey: 'distributor_name' },
            {
                header: 'Amount (In Rs)',
                accessorKey: 'final_amount',
                cell: (props) => (
                    <NumberFormat displayType="text" value={props.row.original.final_amount || 0} thousandSeparator decimalScale={2} fixedDecimalScale />
                ),
            },
            {
                // Old PHP list: the Sales Return Receipt for every entry
                header: 'Receipt',
                width: 60,
                enableSorting: false,
                cell: (props) => (
                    <Button
                        size="xs"
                        title="Print Receipt"
                        icon={<HiPrinter />}
                        onClick={() => openPrintout(() => apiSalesReturnReceipt(props.row.original.id), showError)}
                    />
                ),
            },
            {
                header: 'View',
                width: 60,
                enableSorting: false,
                cell: (props) => (
                    <Link to={`/transaction/sales-return/view/${props.row.original.id}`}>
                        <Button shape="circle" size="sm" variant="twoTone" icon={<MdVisibility />} />
                    </Link>
                ),
            },
        ]
    ), [tableData.pageIndex, tableData.pageSize])

    useEffect(() => {
        setLoading(true)
        apiSalesReturnGet(tableData).then((res) => {
            if (res.data) {
                setData(res.data['rows'])
                setStatusCount(res.data['statusCount'])
                setAction(res.data['action'] || { insert: false })
                setTableData((prevData) => ({ ...prevData, ...{ total: res.data['total'] } }))
            }
            setLoading(false)
        }).catch((error) => {
            showError(error)
            setLoading(false)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableData.pageIndex, tableData.sort, tableData.pageSize, tableData.query, tableData.status])

    const downloadAll = () => {
        apiSalesReturnGet({ ...tableData, pageIndex: 1, pageSize: 'all' }).then((res) => {
            if (res.data) {
                exportToExcel(toExportRows(res.data['rows']), `sales-return-${new Date().toLocaleString()}.xls`)
            }
        }).catch(showError)
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-2">
                <h3 className="mb-4 lg:mb-0 ">Sales Return</h3>
                <div className="flex flex-row lg:flex-row lg:items-center">
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52 mr-4"
                        onChange={(e) => debounceFn(e.target.value)}
                        prefix={<HiSearch className="text-lg" />}
                    />
                    <div className=" inline-flex">
                        {action.insert ? (
                            <Link to="/transaction/sales-return/add-sales-return" className="mr-4">
                                <Button size="sm" variant="solid" icon={<HiPlusCircle />}>
                                    <span>Add Sales Return</span>
                                </Button>
                            </Link>
                        ) : null}
                        <Button
                            size="sm"
                            variant="solid"
                            className="mr-4"
                            color="emerald-600"
                            icon={<MdImportExport />}
                            onClick={() => exportToExcel(toExportRows(data), `sales-return-${new Date().toLocaleString()}.xls`)}
                            disabled={!data.length > 0}
                        >
                            <span>Download</span>
                        </Button>
                        <Button size="sm" variant="solid" color="emerald-600" icon={<MdImportExport />} onClick={downloadAll} disabled={!data.length > 0}>
                            <span>Download All</span>
                        </Button>
                    </div>
                </div>
            </div>
            <Tabs defaultValue={startTab} onChange={(tab) => setTableData((prevData) => ({ ...prevData, ...{ status: tab, pageIndex: 1 } }))}>
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
                onPaginationChange={(pageIndex) => setTableData((prevData) => ({ ...prevData, ...{ pageIndex } }))}
                onSelectChange={(pageSize) => setTableData((prevData) => ({ ...prevData, ...{ pageSize } }))}
                onSort={({ order, key }) => setTableData((prevData) => ({ ...prevData, ...{ sort: { order, key } } }))}
            />
        </AdaptableCard>
    )
}

export default SaleReturn
