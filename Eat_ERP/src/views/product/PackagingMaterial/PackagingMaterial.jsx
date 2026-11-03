import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { Link, useNavigate } from 'react-router-dom'
import { MdCreate, MdAdd, MdImportExport } from 'react-icons/md'
import { HiSearch } from 'react-icons/hi'
import { exportToExcel } from 'react-easy-export'

import { apiPackagingMaterialGet } from 'services/RawMaterialService'

const RawMaterial = () => {
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
    })

    const navigate = useNavigate()
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

    const columns = useMemo(
        () => [
            {
                header: 'Sr. No.',
                cell: (props) =>
                    props.row.index +
                    1 +
                    tableData.pageSize * (tableData.pageIndex - 1),
                width: 60,
            },
            {
                header: 'Raw Material Name',
                accessorKey: 'rm_name',
            },
            {
                header: 'HSN Code',
                accessorKey: 'hsn_code',
                width: 200,
            },
            {
                header: 'Rate',
                accessorKey: 'rate',
                width: 150,
            },
            {
                header: 'Tax %',
                accessorKey: 'tax_per',
                width: 120,
                cell: (props) => props.row.original.tax_per + '%',
            },
            {
                header: 'Packaging Type',
                accessorKey: 'packaging_type',
                width: 120,
                cell: (props) =>
                    props.row.original.packaging_type != null
                        ? props.row.original.packaging_type
                        : '',
            },
            {
                header: 'Action',
                width: 80,
                cell: (props) => (
                    <Link to={`/product/packaging-material/edit-packaging-material/${props.row.original.id}`}>
                        <Button
                            shape="circle"
                            size="sm"
                            variant="twoTone"
                            icon={<MdCreate />}
                            className="mr-3"
                        />
                    </Link>
                ),
            },
        ],
        [tableData.pageIndex, tableData.pageSize]
    )

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

    console.log('RawMaterial.js Loading....')

    useEffect(() => {
        const fetchData = () => {
            // setLoading(true)
            apiPackagingMaterialGet(tableData)
                .then((data) => {
                    if (data.data) {
                        setData(data.data['rows'])
                        setTableData((prevData) => ({
                            ...prevData,
                            ...{ total: data.data['total'] },
                        }))
                        setLoading(false)
                    }
                })
                .catch((error) => {
                    if (error.response.status === 500) {
                        console.log(error)
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {error.response.data['message']}
                            </Notification>
                        )
                    } else if (error.response.status === 401) {
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {error.response.data['message']}
                            </Notification>
                        )
                    }
                    setLoading(false)
                })
            return true
        }
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        tableData.pageIndex,
        tableData.sort,
        tableData.pageSize,
        tableData.query,
    ])

    const downloadAll = () => {
        apiPackagingMaterialGet({
            total: 0,
            pageIndex: 1,
            pageSize: 'all',
            query: '',
            sort: {
                order: '',
                key: '',
            },
            status: tableData.status,
        })
            .then((data) => {
                if (data.data) {
                    exportToExcel(
                        data.data['rows'],
                        `packaging-materials-${new Date().toLocaleString()}.xls`
                    )
                }
            })
            .catch((error) => {
                if (error.response.status === 500) {
                    console.log(error)
                    setLoading(false)
                } else if (error.response.status === 401) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                }
            })
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0 ">Packaging Material</h3>
                <div className="flex flex-row lg:flex-row lg:items-center">
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52 mr-4"
                        onChange={handleChange}
                        prefix={<HiSearch className="text-lg" />}
                    />
                    <Link
                        to={
                            '/product/packaging-material/add-packaging-material'
                        }
                        className=" mr-4 inline-flex"
                    >
                        <Button size="sm" variant="solid" icon={<MdAdd />}>
                            <span>Add Packaging Material</span>
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
                                    data,
                                    `packaging-materials-${new Date().toLocaleString()}.xls`
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
                            onClick={() => {
                                downloadAll()
                            }}
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

export default RawMaterial
