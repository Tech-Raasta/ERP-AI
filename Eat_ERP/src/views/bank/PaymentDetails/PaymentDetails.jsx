import React, { useEffect, useMemo, useRef, useState } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import { Link } from 'react-router-dom'
import useStartTab from 'utils/hooks/useStartTab'
import { HiPencil, HiPlusCircle, HiPrinter, HiSearch } from 'react-icons/hi'
import { MdCreate, MdImportExport } from 'react-icons/md'
import { exportToExcel } from 'react-easy-export'
import NumberFormat from 'react-number-format'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiPaymentsGet, apiPaymentSlip } from 'services/PaymentService'
import { openPrintout } from 'views/sales/Sales/salesFiles'
import { formatDate } from 'views/sales/Sales/Sales'

const { TabNav, TabList } = Tabs

// Payment Details (old PHP Payment list): payments received from distributors, deposited in our bank.
// Tabs: Approved / Pending / Rejected / InActive / All

const TABS = [
    { value: 'approved', label: 'Approved' },
    { value: 'pending', label: 'Pending' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'inactive', label: 'InActive' },
    { value: 'all', label: 'All' },
]

const showError = (error, fallback) => {
    toast.push(
        <Notification title="Error" type="danger" closable>
            {error && error.response && error.response.data ? error.response.data['message'] : fallback}
        </Notification>
    )
}

const Amount = ({ value }) => <NumberFormat displayType="text" value={value || 0} thousandSeparator decimalScale={2} fixedDecimalScale />

const PaymentDetails = () => {
    const startTab = useStartTab(TABS, 'approved')
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusCount, setStatusCount] = useState({})
    const [action, setAction] = useState({ insert: false })
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 10,
        query: '',
        sort: { order: '', key: '' },
        status: startTab,
    })
    const latestRequest = useRef(0)

    useEffect(() => {
        const request = ++latestRequest.current
        setLoading(true)
        apiPaymentsGet(tableData)
            .then((res) => {
                if (request !== latestRequest.current) return
                setData(res.data['rows'] || [])
                setStatusCount(res.data['statusCount'] || {})
                setAction(res.data['action'] || { insert: false })
                setTableData((prev) => (prev.total === res.data['total'] ? prev : { ...prev, total: res.data['total'] }))
            })
            .catch((error) => {
                if (request === latestRequest.current) showError(error, 'Fetching payments failed')
            })
            .finally(() => {
                if (request === latestRequest.current) setLoading(false)
            })
        // tableData.total is set from the answer, so it is not a reason to load again
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableData.pageIndex, tableData.pageSize, tableData.query, tableData.status])

    const debounceFn = useMemo(() => debounce((value) => {
        if (typeof value === 'string' && (value.length > 1 || value.length === 0)) {
            setTableData((prev) => ({ ...prev, query: value, pageIndex: 1 }))
        }
    }, 1000), [])

    const columns = useMemo(() => [
        {
            header: 'Sr. No.',
            enableSorting: false,
            cell: (props) => props.row.index + 1 + tableData.pageSize * (tableData.pageIndex - 1),
            width: 60,
        },
        {
            header: 'Date Of Deposit',
            enableSorting: false,
            cell: (props) => formatDate(props.row.original.date_of_deposit),
            width: 110,
        },
        { header: 'Id', enableSorting: false, accessorKey: 'id', width: 70 },
        { header: 'Bank Name', enableSorting: false, accessorKey: 'b_name' },
        { header: 'Distributor Name', enableSorting: false, accessorKey: 'distributor_name' },
        {
            header: 'Mode',
            enableSorting: false,
            width: 90,
            cell: (props) => `${props.row.original.payment_mode || ''}${props.row.original.upload_type ? ` (${props.row.original.upload_type})` : ''}`,
        },
        ...(tableData.status === 'all' || tableData.status === 'pending'
            ? [{ header: 'Status', enableSorting: false, accessorKey: 'status', width: 90 }]
            : []),
        {
            header: 'Amount (In Rs)',
            enableSorting: false,
            width: 120,
            cell: (props) => <div className="text-right"><Amount value={props.row.original.total_amount} /></div>,
        },
        {
            header: 'Receipt',
            enableSorting: false,
            width: 70,
            cell: (props) => (props.row.original.status === 'Approved' ? (
                <Button
                    type="button"
                    title="Print receipt voucher"
                    variant="twoTone"
                    shape="circle"
                    size="sm"
                    color="blue-600"
                    icon={<HiPrinter />}
                    onClick={() => openPrintout(() => apiPaymentSlip(props.row.original.id), (error) => showError(error, 'Printing failed'))}
                />
            ) : null),
        },
        {
            header: 'Edit',
            enableSorting: false,
            width: 60,
            cell: (props) => (
                <Link to={`/transaction/payment-details/edit/${props.row.original.id}`} className="text-indigo-600 text-lg inline-flex" title="Open">
                    <Button
                        shape="circle"
                        size="sm"
                        variant="twoTone"
                        icon={<MdCreate />}
                        className="text-sm mr-3"
                    />
                </Link>
            ),
        },
    ], [tableData.pageIndex, tableData.pageSize, tableData.status])

    const download = () => exportToExcel(
        data.map((row, index) => ({
            'Sr. No.': index + 1 + tableData.pageSize * (tableData.pageIndex - 1),
            'Date Of Deposit': formatDate(row.date_of_deposit),
            Id: row.id,
            'Bank Name': row.b_name,
            'Distributor Name': row.distributor_name,
            Mode: row.payment_mode,
            Status: row.status,
            'Amount (In Rs)': row.total_amount,
        })),
        `payment-details-${new Date().toLocaleString()}.xls`
    )

    return (
        <AdaptableCard className="h-full card-shadow" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">Payment Details</h3>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <Input
                        size="sm"
                        className="lg:w-64"
                        placeholder="Search"
                        prefix={<HiSearch className="text-lg" />}
                        onChange={(e) => debounceFn(e.target.value)}
                    />
                    {action.insert ? (
                        <Link to="/transaction/payment-details/add">
                            <Button size="sm" variant="solid" icon={<HiPlusCircle />}>Add Payment</Button>
                        </Link>
                    ) : null}
                    <Button size="sm" variant="solid" color="emerald-600" icon={<MdImportExport />} onClick={download} disabled={!data.length}>
                        Download
                    </Button>
                </div>
            </div>
            <Tabs value={tableData.status} onChange={(status) => setTableData((prev) => ({ ...prev, status, pageIndex: 1 }))}>
                <TabList className="justify-end flex-wrap mb-4">
                    {TABS.map((tab) => (
                        <TabNav key={tab.value} value={tab.value}>
                            {tab.label} {`(${statusCount[tab.value] || 0})`}
                        </TabNav>
                    ))}
                </TabList>
            </Tabs>
            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagingData={tableData}
                onPaginationChange={(pageIndex) => setTableData((prev) => ({ ...prev, pageIndex }))}
                onSelectChange={(pageSize) => setTableData((prev) => ({ ...prev, pageSize, pageIndex: 1 }))}
                onSort={() => {}}
            />
        </AdaptableCard>
    )
}

export default PaymentDetails
