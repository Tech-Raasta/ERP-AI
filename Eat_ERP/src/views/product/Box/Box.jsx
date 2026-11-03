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
import { apiBoxGet } from 'services/BoxService'
import { exportToExcel } from 'react-easy-export'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

const { TabNav, TabList, TabContent } = Tabs

const showError = (error) => {
    if (error && error.response) {
        toast.push(
            <Notification title="Error" type="danger" closable>
                {error.response.data['message']}
            </Notification>
        )
    }
}

const toExportRows = (rows) => rows.map((row) => ({
    'Box Name': row.box_name,
    'Short Name': row.short_name,
    'ASIN': row.asin,
    'SKU Code': row.sku_code,
    'Barcode': row.barcode,
    'Category': row.category ? row.category.category_name : '',
    'HSN Code': row.hsn_code,
    'HSN Name': row.hsn_name,
    'Grams': row.grams,
    'Total Amount (In Rs)': row.amount,
    'Rate (In Rs)': row.rate,
    'Cost (In Rs)': row.cost,
    'Tax (In %)': row.tax_percentage,
    'MOQ Inventory': row.moq_inventory,
    'MOQ Production': row.moq_production,
    'Status': row.status === 'Approved' ? 'Active' : row.status,
}))

const Box = () => {
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
        status: 'approved',
    })
    const [statusCount, setStatusCount] = useState({ approved: 0, inActive: 0 })
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
                header: 'Box Name',
                accessorKey: 'box_name',
            },
            {
                header: 'Short Name',
                accessorKey: 'short_name',
            },
            {
                header: 'ASIN',
                accessorKey: 'asin',
                width: 130,
            },
            {
                header: 'SKU Code',
                accessorKey: 'sku_code',
                width: 130,
            },
            {
                header: 'Barcode',
                accessorKey: 'barcode',
                width: 130,
            },
            {
                header: 'Grams',
                accessorKey: 'grams',
                width: 80,
            },
            {
                header: 'Rate (In Rs)',
                accessorKey: 'rate',
                width: 80,
            },
            {
                header: 'Cost (In Rs)',
                accessorKey: 'cost',
                width: 80,
            },
            {
                header: 'Action',
                width: 70,
                cell: (props) => (
                    <Link to={`/product/box/edit-box/${props.row.original.id}`}>
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
        apiBoxGet(tableData).then((data) => {
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
        apiBoxGet({
            ...tableData,
            pageIndex: 1,
            pageSize: 'all',
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    toExportRows(data.data['rows']),
                    `boxes-${new Date().toLocaleString()}.xls`
                )
            }
        }).catch(showError)
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-2">
                <h3 className="mb-4 lg:mb-0 ">Box</h3>
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
                        <Link to={'/product/box/add-box'} className=" mr-4 inline-flex">
                            <Button size="sm" variant="solid" icon={<MdAdd />}>
                                <span>Add Box</span>
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
                                    `boxes-${new Date().toLocaleString()}.xls`
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
            <Tabs defaultValue="approved" onChange={(tabValue) => { tabChanges(tabValue) }}>
                <TabList className="justify-end">
                    <TabNav value="approved">Active {`(${statusCount.approved})`}</TabNav>
                    <TabNav value="inactive">Inactive {`(${statusCount.inActive})`}</TabNav>
                </TabList>
                <div className="p-4">
                    <TabContent value="approved">
                    </TabContent>
                    <TabContent value="inactive">
                    </TabContent>
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

export default Box
