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
import { apiDistributorGet } from 'services/DistributorService'
import { exportToExcel } from 'react-easy-export'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

const { TabNav, TabList, TabContent } = Tabs

// Old PHP Distributor list: tabs Distributor / Retailer / InActive / Pending (sales rep retailers).
// Columns: Sr. No., Edit, Action (View Map), Distributor Name, Location, Sell Out (In %), Credit Period (In Days), Status

const showError = (error) => {
    if (error && error.response) {
        toast.push(
            <Notification title="Error" type="danger" closable>
                {error.response.data['message']}
            </Notification>
        )
    }
}

const statusLabel = (status) => (status === 'Approved' ? 'Active' : status)

// Old PHP "View Map" showed the saved Google location; open it in Google Maps
const mapUrl = (row) => {
    if (row.latitude && row.longitude) {
        return `https://www.google.com/maps/search/?api=1&query=${row.latitude},${row.longitude}`
    }
    if (row.google_address) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.google_address)}`
    }
    return null
}

const toExportRows = (rows) => rows.map((row, index) => ({
    'Sr. No.': index + 1,
    'Distributor Name': row.distributor_name,
    'Location': row.location,
    'Sales Representative': row.sales_rep_name,
    'Sell Out (In %)': row.sell_out,
    'Credit Period (In Days)': row.credit_period,
    'Status': statusLabel(row.status),
}))

const Distributor = () => {
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
        status: 'distributor',
    })
    const [statusCount, setStatusCount] = useState({ distributor: 0, retailer: 0, inactive: 0, pending: 0 })
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
                header: 'Distributor Name',
                accessorKey: 'distributor_name',
            },
            {
                header: 'Location',
                accessorKey: 'location',
            },
            {
                header: 'Sell Out (In %)',
                accessorKey: 'sell_out',
                width: 120,
            },
            {
                header: 'Credit Period (In Days)',
                accessorKey: 'credit_period',
                width: 170,
            },
            {
                header: 'Status',
                accessorKey: 'status',
                enableSorting: false,
                width: 100,
                cell: (props) => statusLabel(props.row.original.status),
            },
            {
                header: 'Action',
                width: 90,
                enableSorting: false,
                cell: (props) => {
                    const url = mapUrl(props.row.original)
                    return url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="text-indigo-600">View Map</a>
                    ) : null
                },
            },
            {
                header: 'Edit',
                width: 60,
                enableSorting: false,
                cell: (props) => (
                    <Link to={`/sales/distributor/edit-distributor/${props.row.original.d_id}`}>
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
        apiDistributorGet(tableData).then((data) => {
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
        apiDistributorGet({
            ...tableData,
            pageIndex: 1,
            pageSize: 'all',
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    toExportRows(data.data['rows']),
                    `distributors-${new Date().toLocaleString()}.xls`
                )
            }
        }).catch(showError)
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-2">
                <h3 className="mb-4 lg:mb-0 ">Distributor / Retailer</h3>
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
                        <Link to={'/sales/distributor/add-distributor'} className=" mr-4 inline-flex">
                            <Button size="sm" variant="solid" icon={<MdAdd />}>
                                <span>Add Distributor/Retailer</span>
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
                                    `distributors-${new Date().toLocaleString()}.xls`
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
            <Tabs defaultValue="distributor" onChange={(tabValue) => { tabChanges(tabValue) }}>
                <TabList className="justify-end">
                    <TabNav value="distributor">Distributor {`(${statusCount.distributor})`}</TabNav>
                    <TabNav value="retailer">Retailer {`(${statusCount.retailer})`}</TabNav>
                    <TabNav value="inactive">InActive {`(${statusCount.inactive})`}</TabNav>
                    <TabNav value="pending">Pending {`(${statusCount.pending})`}</TabNav>
                </TabList>
                <div className="p-4">
                    <TabContent value="distributor"></TabContent>
                    <TabContent value="retailer"></TabContent>
                    <TabContent value="inactive"></TabContent>
                    <TabContent value="pending"></TabContent>
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

export default Distributor
