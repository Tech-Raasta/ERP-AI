import React, { useEffect, useMemo, useRef, useState } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import { Link } from 'react-router-dom'
import { HiPencil, HiPlusCircle, HiSearch } from 'react-icons/hi'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiUsersGet } from 'services/UserService'

const { TabNav, TabList } = Tabs

// User (old PHP User list). Tabs: Active / InActive / All

const TABS = [
    { value: 'approved', label: 'Active' },
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

const User = () => {
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
        status: 'approved',
    })
    const latestRequest = useRef(0)

    useEffect(() => {
        const request = ++latestRequest.current
        setLoading(true)
        apiUsersGet(tableData)
            .then((res) => {
                if (request !== latestRequest.current) return
                setData(res.data['rows'] || [])
                setStatusCount(res.data['statusCount'] || {})
                setAction(res.data['action'] || { insert: false })
                setTableData((prev) => (prev.total === res.data['total'] ? prev : { ...prev, total: res.data['total'] }))
            })
            .catch((error) => {
                if (request === latestRequest.current) showError(error, 'Fetching users failed')
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
        { header: 'Name', enableSorting: false, accessorKey: 'name' },
        { header: 'Email Id', enableSorting: false, accessorKey: 'email_id' },
        { header: 'Mobile No', enableSorting: false, accessorKey: 'mobile', width: 120 },
        { header: 'Employee Code', enableSorting: false, accessorKey: 'emp_code', width: 130 },
        { header: 'Role', enableSorting: false, accessorKey: 'role_name' },
        ...(tableData.status === 'all'
            ? [{
                header: 'Status',
                enableSorting: false,
                width: 90,
                cell: (props) => (props.row.original.status === 'Approved' ? 'Active' : props.row.original.status),
            }]
            : []),
        {
            header: 'Edit',
            enableSorting: false,
            width: 60,
            cell: (props) => (
                <Link to={`/user/user/edit/${props.row.original.id}`} title="Open">
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

    return (
        <AdaptableCard className="h-full card-shadow" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">User List</h3>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <Input
                        size="sm"
                        className="lg:w-64"
                        placeholder="Search"
                        prefix={<HiSearch className="text-lg" />}
                        onChange={(e) => debounceFn(e.target.value)}
                    />
                    {action.insert ? (
                        <Link to="/user/user/add">
                            <Button size="sm" variant="solid" icon={<HiPlusCircle />}>Add User</Button>
                        </Link>
                    ) : null}
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

export default User
