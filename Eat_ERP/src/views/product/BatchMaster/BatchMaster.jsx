import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import { MdCreate, MdAdd, MdImportExport } from "react-icons/md"
import { Link } from 'react-router-dom'
import { HiSearch } from 'react-icons/hi'
import { apiBatchMasterGet } from 'services/BatchMasterService'
import { exportToExcel } from 'react-easy-export'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'

// Old PHP Batch_master list: every batch (no status filter), Sr. No., Edit, Batch No, Date Of Processing (dd/mm/yyyy)

const showError = (error) => {
    if (error && error.response) {
        toast.push(
            <Notification title="Error" type="danger" closable>
                {error.response.data['message']}
            </Notification>
        )
    }
}

const formatDate = (value) => {
    if (!value) {
        return ''
    }
    const [year, month, day] = value.toString().substring(0, 10).split('-')
    return `${day}/${month}/${year}`
}

const toExportRows = (rows) => rows.map((row, index) => ({
    'Sr. No.': index + 1,
    'Batch No': row.batch_no,
    'Date Of Processing': formatDate(row.date_of_processing),
    'Status': row.status === 'Approved' ? 'Active' : row.status,
    'Remarks': row.remarks,
}))

const BatchMaster = () => {
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
        status: 'all',
    })
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

    const columns = useMemo(() => (
        [
            {
                header: 'Sr. No.',
                enableSorting: false,
                cell: (props) => props.row.index + 1 + tableData.pageSize * (tableData.pageIndex - 1),
                width: 60,
            },
            {
                header: 'Batch No',
                accessorKey: 'batch_no',
            },
            {
                header: 'Date Of Processing',
                accessorKey: 'date_of_processing',
                cell: (props) => formatDate(props.row.original.date_of_processing),
            },
            {
                header: 'Edit',
                width: 60,
                enableSorting: false,
                cell: (props) => (
                    <Link to={`/product/batch-master/edit-batch-master/${props.row.original.id}`}>
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
        apiBatchMasterGet(tableData).then((data) => {
            if (data.data) {
                setData(data.data['rows'])
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
    }, [tableData.pageIndex, tableData.sort, tableData.pageSize, tableData.query])

    const downloadAll = () => {
        apiBatchMasterGet({
            ...tableData,
            pageIndex: 1,
            pageSize: 'all',
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    toExportRows(data.data['rows']),
                    `batch-master-${new Date().toLocaleString()}.xls`
                )
            }
        }).catch(showError)
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0 ">Batch Master</h3>
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
                        <Link to={'/product/batch-master/add-batch-master'} className=" mr-4 inline-flex">
                            <Button size="sm" variant="solid" icon={<MdAdd />}>
                                <span>Add Batch No</span>
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
                                    `batch-master-${new Date().toLocaleString()}.xls`
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

export default BatchMaster
