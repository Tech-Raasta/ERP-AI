import React, { useEffect, useMemo, useRef, useState } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import Tabs from 'components/ui/Tabs'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Dialog from 'components/ui/Dialog'
import Dropdown from 'components/ui/Dropdown'
import debounce from 'lodash/debounce'
import { saveAs } from 'file-saver'
import { Link } from 'react-router-dom'
import { HiDownload, HiMail, HiPencil, HiSearch, HiUpload } from 'react-icons/hi'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiAttendanceDownload, apiAttendanceGet, apiAttendanceMail, apiAttendanceUpload } from 'services/AttendanceService'

const { TabNav, TabList } = Tabs

// Eat Attendance list (old PHP emp_list.php): each employee's month. Employees see their own and their team's.

const TABS = [
    { value: '', count: 'all', label: 'All' },
    { value: 'Pending', count: 'Pending', label: 'Pending' },
    { value: 'Pending For Approval', count: 'Pending For Approval', label: 'Pending For Approval' },
    { value: 'Approved', count: 'Approved', label: 'Approved' },
    { value: 'Rejected', count: 'Rejected', label: 'Rejected' },
]
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOWNLOADS = [
    { kind: 'approved', label: 'Approved Attendance' },
    { kind: 'summary', label: 'Approved Summary' },
    { kind: 'system', label: 'Attendance As Recorded' },
]

const showMessage = (message, type = 'danger') => {
    toast.push(
        <Notification title={type === 'success' ? 'Success' : 'Error'} type={type} closable>
            {message}
        </Notification>
    )
}
const errorText = async (error, fallback) => {
    const response = error && error.response
    if (!response) return fallback
    const data = response.data instanceof Blob ? JSON.parse(await response.data.text()) : response.data
    return (data && data.message) || fallback
}

const statusClass = {
    Approved: 'text-emerald-600',
    Rejected: 'text-red-600',
    'Pending For Approval': 'text-amber-600',
}

const Attendance = () => {
    const today = new Date()
    const years = useMemo(() => Array.from({ length: 10 }, (_, index) => today.getFullYear() - index).map((value) => ({ value, label: String(value) })), []) // eslint-disable-line react-hooks/exhaustive-deps
    const monthOptions = MONTHS.map((label, index) => ({ value: index + 1, label }))
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusCount, setStatusCount] = useState({})
    const [permissions, setPermissions] = useState({ upload: false, approve: false, download: false })
    const [tableData, setTableData] = useState({
        total: 0, pageIndex: 1, pageSize: 25, query: '', sort: { order: '', key: '' },
        status: '', year: today.getFullYear(), month: today.getMonth() + 1,
    })
    const [uploadOpen, setUploadOpen] = useState(false)
    const [file, setFile] = useState(null)
    const [busy, setBusy] = useState(false)
    const [uploadResult, setUploadResult] = useState(null)
    const [confirmMail, setConfirmMail] = useState(false)
    const latestRequest = useRef(0)

    const load = () => {
        const request = ++latestRequest.current
        setLoading(true)
        apiAttendanceGet(tableData)
            .then((res) => {
                if (request !== latestRequest.current) return
                setData(res.data['rows'] || [])
                setStatusCount(res.data['statusCount'] || {})
                setPermissions(res.data['permissions'] || {})
                setTableData((prev) => (prev.total === res.data['total'] ? prev : { ...prev, total: res.data['total'] }))
            })
            .catch(async (error) => {
                if (request === latestRequest.current) showMessage(await errorText(error, 'Fetching attendance failed'))
            })
            .finally(() => {
                if (request === latestRequest.current) setLoading(false)
            })
    }

    // tableData.total is set from the answer, so it is not a reason to load again
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [tableData.pageIndex, tableData.pageSize, tableData.query, tableData.status, tableData.year, tableData.month])

    const debounceFn = useMemo(() => debounce((value) => {
        setTableData((prev) => ({ ...prev, query: value, pageIndex: 1 }))
    }, 500), [])

    const setPeriod = (change) => setTableData((prev) => ({ ...prev, ...change, pageIndex: 1 }))

    const columns = useMemo(() => [
        { header: 'Sr. No.', enableSorting: false, width: 60, cell: (props) => props.row.index + 1 + tableData.pageSize * (tableData.pageIndex - 1) },
        { header: 'Employee Code', enableSorting: false, accessorKey: 'emp_no', width: 130 },
        {
            header: 'Open',
            enableSorting: false,
            width: 60,
            cell: (props) => (
                <Link
                    to={`/attendance/employee/${encodeURIComponent(props.row.original.emp_no)}/${tableData.year}/${tableData.month}`}
                    className="text-indigo-600 text-lg inline-flex"
                    title="Open"
                >
                    <HiPencil />
                </Link>
            ),
        },
        { header: 'Employee Name', enableSorting: false, accessorKey: 'emp_name' },
        { header: 'Department', enableSorting: false, accessorKey: 'department' },
        { header: 'Total Count', enableSorting: false, accessorKey: 'total_days', width: 90 },
        { header: 'Holiday', enableSorting: false, accessorKey: 'no_of_holiday', width: 80 },
        { header: 'Weekly Off', enableSorting: false, accessorKey: 'weekly_off', width: 80 },
        { header: 'Leaves', enableSorting: false, accessorKey: 'no_of_leave', width: 70 },
        {
            header: 'Status',
            enableSorting: false,
            width: 160,
            cell: (props) => <span className={statusClass[props.row.original.status] || ''}>{props.row.original.status}</span>,
        },
    ], [tableData.pageIndex, tableData.pageSize, tableData.year, tableData.month])

    const download = (kind) => {
        apiAttendanceDownload(kind, { year: tableData.year, month: tableData.month })
            .then((res) => {
                const name = (res.headers['content-disposition'] || '').match(/filename="([^"]+)"/)
                saveAs(res.data, name ? name[1] : 'Attendance.xlsx')
            })
            .catch(async (error) => showMessage(await errorText(error, 'Download failed')))
    }

    const upload = () => {
        const form = new FormData()
        form.append('upload', file)
        setBusy(true)
        apiAttendanceUpload(form)
            .then((res) => {
                setUploadResult(res.data)
                setFile(null)
                load()
            })
            .catch(async (error) => showMessage(await errorText(error, 'Upload failed')))
            .finally(() => setBusy(false))
    }

    const sendMail = () => {
        setConfirmMail(false)
        setBusy(true)
        apiAttendanceMail({ year: tableData.year, month: tableData.month })
            .then((res) => showMessage(res.data['message'], 'success'))
            .catch(async (error) => showMessage(await errorText(error, 'Sending mail failed')))
            .finally(() => setBusy(false))
    }

    const closeUpload = () => {
        setUploadOpen(false)
        setFile(null)
        setUploadResult(null)
    }

    return (
        <AdaptableCard className="h-full card-shadow" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">Eat Attendance</h3>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <Input size="sm" className="lg:w-56" placeholder="Search employee" prefix={<HiSearch className="text-lg" />} onChange={(e) => debounceFn(e.target.value)} />
                    <div className="w-36">
                        <Select size="sm" options={monthOptions} value={monthOptions.filter((option) => option.value === tableData.month)} onChange={(option) => setPeriod({ month: option.value })} />
                    </div>
                    <div className="w-24">
                        <Select size="sm" options={years} value={years.filter((option) => option.value === tableData.year)} onChange={(option) => setPeriod({ year: option.value })} />
                    </div>
                    {permissions.upload ? <Button size="sm" variant="solid" icon={<HiUpload />} onClick={() => setUploadOpen(true)}>Upload</Button> : null}
                    {permissions.approve ? <Button size="sm" icon={<HiMail />} disabled={busy} onClick={() => setConfirmMail(true)}>Send Mail</Button> : null}
                    {permissions.download ? (
                        <Dropdown renderTitle={<Button size="sm" variant="solid" color="emerald-600" icon={<HiDownload />}>Download</Button>} placement="bottom-end">
                            {DOWNLOADS.map(({ kind, label }) => <Dropdown.Item key={kind} onClick={() => download(kind)}>{label}</Dropdown.Item>)}
                        </Dropdown>
                    ) : null}
                </div>
            </div>
            <Tabs value={tableData.status} onChange={(status) => setPeriod({ status })}>
                <TabList className="justify-end flex-wrap mb-4">
                    {TABS.map((tab) => (
                        <TabNav key={tab.label} value={tab.value}>{tab.label} {`(${statusCount[tab.count] || 0})`}</TabNav>
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
            <Dialog isOpen={uploadOpen} onClose={closeUpload} onRequestClose={closeUpload}>
                <h5 className="mb-2">Upload Attendance</h5>
                <p className="mb-4 text-gray-500">Choose the Keka attendance file (.xlsx). Days already corrected or approved keep their corrections.</p>
                {uploadResult ? (
                    <div className="mb-4">
                        <p className="text-emerald-600">{uploadResult.message}</p>
                        {(uploadResult.errors || []).map((line) => <p key={line} className="text-sm text-red-600">{line}</p>)}
                    </div>
                ) : (
                    <input className="mb-4 block" type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files[0] || null)} />
                )}
                <div className="text-right">
                    <Button size="sm" className="ltr:mr-3" onClick={closeUpload}>Close</Button>
                    {uploadResult ? null : <Button size="sm" variant="solid" loading={busy} disabled={!file} onClick={upload}>Upload</Button>}
                </div>
            </Dialog>
            <ConfirmDialog
                isOpen={confirmMail}
                closable={false}
                type="warning"
                title="Send Attendance Mail"
                onClose={() => setConfirmMail(false)}
                onRequestClose={() => setConfirmMail(false)}
                onCancel={() => setConfirmMail(false)}
                onConfirm={sendMail}
            >
                <p>Mail {MONTHS[tableData.month - 1]} {tableData.year} attendance to every employee and their manager?</p>
            </ConfirmDialog>
        </AdaptableCard>
    )
}

export default Attendance
