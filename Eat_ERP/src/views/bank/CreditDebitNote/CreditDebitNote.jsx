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
import { MdImportExport } from 'react-icons/md'
import { exportToExcel } from 'react-easy-export'
import NumberFormat from 'react-number-format'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiCreditDebitNotePrint, apiCreditDebitNotesGet } from 'services/CreditDebitNoteService'
import { openPrintout } from 'views/sales/Sales/salesFiles'
import { formatDate } from 'views/sales/Sales/Sales'

const { TabNav, TabList } = Tabs

// Credit Debit Note (old PHP Credit_debit_note list): credit / debit notes and expense vouchers (and reversals).
// Tabs: Approved / Pending / Rejected / InActive / All. Ledger balance adjustments are not listed (as in PHP).

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

const CreditDebitNote = () => {
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
        apiCreditDebitNotesGet(tableData)
            .then((res) => {
                if (request !== latestRequest.current) return
                setData(res.data['rows'] || [])
                setStatusCount(res.data['statusCount'] || {})
                setAction(res.data['action'] || { insert: false })
                setTableData((prev) => (prev.total === res.data['total'] ? prev : { ...prev, total: res.data['total'] }))
            })
            .catch((error) => {
                if (request === latestRequest.current) showError(error, 'Fetching credit / debit notes failed')
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
            header: 'Date Of Transaction',
            enableSorting: false,
            cell: (props) => formatDate(props.row.original.date_of_transaction),
            width: 110,
        },
        
        { header: 'Ref No', enableSorting: false, accessorKey: 'ref_no', width: 150 },
        { header: 'Distributor Name', enableSorting: false, accessorKey: 'distributor_name' },
        {
            header: 'Transaction',
            enableSorting: false,
            width: 150,
            cell: (props) => {
                const row = props.row.original
                return (
                    <div>
                        {row.transaction}
                        {row.source ? <div className="text-xs text-gray-500">From {row.source.type} #{row.source.id}</div> : null}
                    </div>
                )
            },
        },
        ...(tableData.status === 'all' || tableData.status === 'pending'
            ? [{ header: 'Status', enableSorting: false, accessorKey: 'status', width: 90 }]
            : []),
        {
            header: 'Amount (In Rs)',
            enableSorting: false,
            width: 120,
            cell: (props) => <div className="text-right"><Amount value={props.row.original.amount} /></div>,
        },
        { header: 'Remarks', enableSorting: false, accessorKey: 'remarks' },
        {
            header: 'Print',
            enableSorting: false,
            width: 60,
            cell: (props) => (props.row.original.ref_no ? (
                <Button
                    type="button"
                    title="Print note"
                    shape="circle"
                    size="sm"
                    color="blue-600"
                    variant="twoTone"
                    icon={<HiPrinter />}
                    className="text-sm"
                    onClick={() => openPrintout(() => apiCreditDebitNotePrint(props.row.original.id), (error) => showError(error, 'Printing failed'))}
                />
            ) : null),
        },
        {
            header: 'Edit',
            enableSorting: false,
            width: 60,
            cell: (props) => (
                <Link to={`/transaction/credit-debit-note/edit/${props.row.original.id}`} className="text-lg inline-flex" title="Open">
                    <Button
                        shape="circle"
                        size="sm"
                        variant="twoTone"
                        icon={<HiPencil />}
                        className="text-sm"
                    />
                </Link>
            ),
        },
    ], [tableData.pageIndex, tableData.pageSize, tableData.status])

    const download = () => exportToExcel(
        data.map((row, index) => ({
            'Sr. No.': index + 1 + tableData.pageSize * (tableData.pageIndex - 1),
            'Date Of Transaction': formatDate(row.date_of_transaction),
            'Ref No': row.ref_no,
            'Distributor Name': row.distributor_name,
            Transaction: row.transaction,
            Type: row.distributor_type,
            'Invoice No': row.invoice_no,
            Status: row.status,
            'Amount (In Rs)': row.amount,
            Remarks: row.remarks,
        })),
        `credit-debit-note-${new Date().toLocaleString()}.xls`
    )

    return (
        <AdaptableCard className="h-full card-shadow" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">Credit Debit Note</h3>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <Input
                        size="sm"
                        className="lg:w-64"
                        placeholder="Search"
                        prefix={<HiSearch className="text-lg" />}
                        onChange={(e) => debounceFn(e.target.value)}
                    />
                    {action.insert ? (
                        <Link to="/transaction/credit-debit-note/add">
                            <Button size="sm" variant="solid" icon={<HiPlusCircle />}>Add Credit Debit Note</Button>
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

export default CreditDebitNote
