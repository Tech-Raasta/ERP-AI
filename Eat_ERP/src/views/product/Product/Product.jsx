import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import { MdCreate, MdAdd, MdDelete, MdImportExport } from "react-icons/md"
import { Link } from 'react-router-dom'
import { HiSearch } from 'react-icons/hi'
import { apiProductDelete, apiProductGet } from 'services/ProductService'
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

// Flatten rows for Excel export (category is a nested object)
const toExportRows = (rows) => rows.map((row) => ({
    'Product Name': row.product_name,
    'Short Name': row.short_name,
    'Category': row.category ? row.category.category_name : '',
    'HSN Code': row.hsn_code,
    'HSN Name': row.hsn_name,
    'Barcode': row.barcode,
    'Disclosed Grams': row.grams,
    'Avg Grams In Bar': row.avg_grams,
    'Rate (In Rs)': row.rate,
    'Cost (In Rs)': row.cost,
    'Anticipated Wastage (In %)': row.anticipated_wastage,
    'Tax (In %)': row.tax_percentage,
    'Status': row.status === 'Approved' ? 'Active' : row.status,
}))

const Product = () => {
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
    const inputRef = useRef(null)
    const [open, setOpen] = useState(false)
    const [deleteId, setDeleteId] = useState(null)

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

    const fetchData = () => {
        setLoading(true)
        apiProductGet(tableData).then((data) => {
            if (data.data) {
                setData(data.data['rows'])
                setStatusCount(data.data['statusCount'])
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
    }

    const onDialogClose = () => {
        setOpen(false)
    }

    const onDialogOk = () => {
        apiProductDelete(deleteId).then((data) => {
            if (data.status === 200) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        Product marked as InActive
                    </Notification>
                )
                setOpen(false)
                fetchData()
            }
        }).catch((error) => {
            setOpen(false)
            showError(error)
        })
    }

    const columns = useMemo(() => (
        [
            {
                header: 'Sr. No.',
                cell: (props) => props.row.index + 1 + tableData.pageSize * (tableData.pageIndex - 1),
                width: 60,
            },
            {
                header: 'Product Name',
                accessorKey: 'product_name',
            },
            {
                header: 'Short Name',
                accessorKey: 'short_name',
            },
            {
                header: 'Category',
                enableSorting: false,
                cell: (props) => props.row.original.category ? props.row.original.category.category_name : '',
            },
            {
                header: 'Disclosed Grams',
                accessorKey: 'grams',
                width: 100
            },
            {
                header: 'Avg Grams In Bar',
                accessorKey: 'avg_grams',
                width: 95
            },
            {
                header: 'Rate (In Rs)',
                accessorKey: 'rate',
                width: 80
            },
            {
                header: 'Cost (In Rs)',
                accessorKey: 'cost',
                width: 80
            },
            {
                header: 'Anticipated Wastage (In %)',
                accessorKey: 'anticipated_wastage',
                width: 100
            },
            {
                header: 'Action',
                width: 110,
                cell: (props) => (
                    <>
                        <Link to={`/product/product/edit-product/${props.row.original.id}`}>
                            <Button
                                shape="circle"
                                size="sm"
                                variant="twoTone"
                                icon={<MdCreate />}
                                className="mr-3"
                            />
                        </Link>
                        {props.row.original.status === 'Approved' ? (
                            <Button
                                shape="circle"
                                size="sm"
                                variant="twoTone"
                                color="red-600"
                                icon={<MdDelete />}
                                onClick={() => {
                                    setDeleteId(props.row.original.id)
                                    setOpen(true)
                                }}
                            />
                        ) : null}
                    </>
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
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableData.pageIndex, tableData.sort, tableData.pageSize, tableData.query, tableData.status])

    const downloadAll = () => {
        apiProductGet({
            ...tableData,
            pageIndex: 1,
            pageSize: 'all',
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    toExportRows(data.data['rows']),
                    `products-${new Date().toLocaleString()}.xls`
                )
            }
        }).catch(showError)
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-2">
                <h3 className="mb-4 lg:mb-0 ">Products</h3>
                <div className="flex flex-row lg:flex-row lg:items-center">
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52 mr-4"
                        onChange={handleChange}
                        prefix={<HiSearch className="text-lg" />}
                    />
                    <Link to={'/product/product/add-product'} className=" mr-4 inline-flex">
                        <Button size="sm" variant="solid" icon={<MdAdd />}>
                            <span>Add Product</span>
                        </Button>
                    </Link>
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
                                    `products-${new Date().toLocaleString()}.xls`
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
            <ConfirmDialog
                isOpen={open}
                closable={false}
                type="danger"
                title="Deactivate Product"
                onClose={onDialogClose}
                onRequestClose={onDialogClose}
                onCancel={onDialogClose}
                onConfirm={onDialogOk}
                confirmButtonColor="red-600">
                <p>
                    Do you want to mark this product as InActive?
                </p>
            </ConfirmDialog>
        </AdaptableCard>
    )
}

export default Product
