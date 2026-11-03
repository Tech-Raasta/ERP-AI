import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import { MdCreate, MdAdd, MdImportExport } from "react-icons/md"
import { Link } from 'react-router-dom'
import { HiSearch } from 'react-icons/hi'
import { apiSalesRepGet } from 'services/SalesRepService'
import { exportToExcel } from 'react-easy-export'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

const { TabNav, TabList, TabContent } = Tabs

// Old PHP Sales_rep list: tabs Sales Representative / Promoter / Merchandiser (Approved) and Inactive.
// Columns: Sr. No., Edit, Sales Representative Name, PAN No, Email Id, Mobile No, Target Per Month (In Rs)

const showError = (error) => {
    if (error && error.response) {
        toast.push(
            <Notification title="Error" type="danger" closable>
                {error.response.data['message']}
            </Notification>
        )
    }
}

const toFixed2 = (value) => (value !== null && value !== undefined && value !== '' ? Number(value).toFixed(2) : '')

const toExportRows = (rows) => rows.map((row, index) => ({
    'Sr. No.': index + 1,
    'Sales Representative Name': row.sales_rep_name,
    'PAN No': row.pan_no,
    'Email Id': row.email_id,
    'Mobile No': row.mobile,
    'Type': row.sr_type,
    'Zone': row.zone,
    'Territory': row.teritory,
    'KYC Done': row.kyc_done === '1' ? 'Yes' : (row.kyc_done === '0' ? 'No' : ''),
    'Target Per Month (In Rs)': toFixed2(row.target_pm),
    'Status': row.status === 'Approved' ? 'Active' : row.status,
}))

const SalesRep = () => {
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
        status: 'salesrep',
    })
    const [statusCount, setStatusCount] = useState({ salesrep: 0, promoter: 0, merchandiser: 0, inactive: 0 })
    const [action, setAction] = useState({ insert: false, update: false })
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
                header: 'Sales Representative Name',
                accessorKey: 'sales_rep_name',
            },
            {
                header: 'PAN No',
                accessorKey: 'pan_no',
                width: 130,
            },
            {
                header: 'Email Id',
                accessorKey: 'email_id',
            },
            {
                header: 'Mobile No',
                accessorKey: 'mobile',
                width: 120,
            },
            {
                header: 'Target Per Month (In Rs)',
                accessorKey: 'target_pm',
                width: 180,
                cell: (props) => toFixed2(props.row.original.target_pm),
            },
            {
                header: 'Edit',
                width: 60,
                enableSorting: false,
                cell: (props) => (
                    <Link to={`/sales/sales-rep/edit-sales-rep/${props.row.original.id}`}>
                        <Button
                            shape="circle"
                            size="sm"
                            variant="twoTone"
                            icon={<MdCreate />}
                        />
                    </Link>
                ),
            },
        ]
    ), [tableData.pageIndex, tableData.pageSize])

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
        apiSalesRepGet(tableData).then((data) => {
            if (data.data) {
                setData(data.data['rows'])
                setStatusCount(data.data['statusCount'])
                setAction(data.data['action'])
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
        apiSalesRepGet({
            ...tableData,
            pageIndex: 1,
            pageSize: 'all',
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    toExportRows(data.data['rows']),
                    `sales-representatives-${new Date().toLocaleString()}.xls`
                )
            }
        }).catch(showError)
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-2">
                <h3 className="mb-4 lg:mb-0 ">Sales Representative</h3>
                <div className="flex flex-row lg:flex-row lg:items-center">
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52 mr-4"
                        onChange={handleChange}
                        prefix={<HiSearch className="text-lg" />}
                    />
                    {action.insert ? (
                        <Link to={'/sales/sales-rep/add-sales-rep'} className=" mr-4 inline-flex">
                            <Button size="sm" variant="solid" icon={<MdAdd />}>
                                <span>Add Sales Representative</span>
                            </Button>
                        </Link>
                    ) : null}
                    <div className=" inline-flex">
                        <Button
                            size="sm"
                            variant="solid"
                            className="mr-4"
                            color="emerald-600"
                            icon={<MdImportExport />}
                            onClick={() => {
                                exportToExcel(
                                    toExportRows(data),
                                    `sales-representatives-${new Date().toLocaleString()}.xls`
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
            <Tabs defaultValue="salesrep" onChange={(tabValue) => { tabChanges(tabValue) }}>
                <TabList className="justify-end">
                    <TabNav value="salesrep">Sales Representative {`(${statusCount.salesrep})`}</TabNav>
                    <TabNav value="promoter">Promoter {`(${statusCount.promoter})`}</TabNav>
                    <TabNav value="merchandiser">Merchandiser {`(${statusCount.merchandiser})`}</TabNav>
                    <TabNav value="inactive">Inactive {`(${statusCount.inactive})`}</TabNav>
                </TabList>
                <div className="p-4">
                    <TabContent value="salesrep"></TabContent>
                    <TabContent value="promoter"></TabContent>
                    <TabContent value="merchandiser"></TabContent>
                    <TabContent value="inactive"></TabContent>
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

export default SalesRep
