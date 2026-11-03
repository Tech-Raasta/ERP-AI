import React, { useEffect, useMemo, useRef, useState } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import { Link } from 'react-router-dom'
import { HiOutlineDuplicate, HiPencil, HiPlusCircle, HiSearch } from 'react-icons/hi'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiUserRolesGet } from 'services/UserRoleService'

// User Roles (old PHP User_roles list). Global roles (Admin and the other system roles) cannot be edited, only copied.

const showError = (error, fallback) => {
    toast.push(
        <Notification title="Error" type="danger" closable>
            {error && error.response && error.response.data ? error.response.data['message'] : fallback}
        </Notification>
    )
}

const UserRoles = () => {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [action, setAction] = useState({ insert: false })
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 25,
        query: '',
        sort: { order: '', key: '' },
    })
    const latestRequest = useRef(0)

    useEffect(() => {
        const request = ++latestRequest.current
        setLoading(true)
        apiUserRolesGet(tableData)
            .then((res) => {
                if (request !== latestRequest.current) return
                setData(res.data['rows'] || [])
                setAction(res.data['action'] || { insert: false })
                setTableData((prev) => (prev.total === res.data['total'] ? prev : { ...prev, total: res.data['total'] }))
            })
            .catch((error) => {
                if (request === latestRequest.current) showError(error, 'Fetching user roles failed')
            })
            .finally(() => {
                if (request === latestRequest.current) setLoading(false)
            })
        // tableData.total is set from the answer, so it is not a reason to load again
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableData.pageIndex, tableData.pageSize, tableData.query])

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
            header: 'Role',
            enableSorting: false,
            cell: (props) => (
                <span>
                    {props.row.original.role_name}
                    {props.row.original.global ? <span className="ml-2 text-xs text-gray-500">Global</span> : null}
                </span>
            ),
        },
        { header: 'Description', enableSorting: false, accessorKey: 'description' },
        { header: 'Created By', enableSorting: false, accessorKey: 'created_by_name' },
        { header: 'Active Users', enableSorting: false, accessorKey: 'active_users', width: 100 },
        {
            header: 'Status',
            enableSorting: false,
            width: 90,
            cell: (props) => (props.row.original.status === 'InActive' ? 'InActive' : 'Active'),
        },
        {
            header: 'Edit',
            enableSorting: false,
            width: 90,
            cell: (props) => (
                <div className="flex items-center gap-3 text-lg">
                    <Link to={`/user/user-roles/edit/${props.row.original.id}`} className=" inline-flex" title="Open">
                        <Button
                            shape="circle"
                            size="sm"
                            variant="twoTone"
                            icon={<HiPencil />}
                            className="text-sm"
                        />
                    </Link>
                    {action.insert ? (
                        <Link to={`/user/user-roles/copy/${props.row.original.id}`} className="inline-flex" title="Copy this role">
                            <Button
                                shape="circle"
                                size="sm"
                                variant="twoTone"
                                color="blue-600"
                                icon={<HiOutlineDuplicate />}
                                className="text-sm"
                            />
                        </Link>
                    ) : null}
                </div>
            ),
        },
    ], [tableData.pageIndex, tableData.pageSize, action])

    return (
        <AdaptableCard className="h-full card-shadow" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">User Role List</h3>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <Input
                        size="sm"
                        className="lg:w-64"
                        placeholder="Search"
                        prefix={<HiSearch className="text-lg" />}
                        onChange={(e) => debounceFn(e.target.value)}
                    />
                    {action.insert ? (
                        <Link to="/user/user-roles/add">
                            <Button size="sm" variant="solid" icon={<HiPlusCircle />}>Add User Role</Button>
                        </Link>
                    ) : null}
                </div>
            </div>
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

export default UserRoles
