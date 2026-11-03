import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { Link } from 'react-router-dom'
import { MdCreate, MdAdd, MdImportExport } from 'react-icons/md'
import { HiSearch } from 'react-icons/hi'
import { exportToExcel } from 'react-easy-export'
import { apiDepotGet } from 'services/Depot'

const { TabNav, TabList, TabContent } = Tabs

const Depot = () => {
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

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
    }

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
                cell: (props) => props.row.index + 1 + tableData.pageSize * (tableData.pageIndex - 1),
                width: 60,
            },
            {
                header: 'Depot Name',
                accessorKey: 'depot_name',
            },
            {
                header: 'Depot Code',
                accessorKey: 'depot_code',
                width: 200,
            },
            {
                header: 'Type',
                accessorKey: 'type',
                width: 120,
            },
            {
                header: 'Email Id',
                accessorKey: 'email_id',
                width: 150,
            },
            {
                header: 'Mobile No.',
                accessorKey: 'mobile',
                width: 120,
            },
            {
                header: 'Action',
                width: 80,
                cell: (props) => (
                    <Link to={`/product/depot/edit-depot/${props.row.original.id}`}>
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

    console.log('Depot.js Loading....')

    useEffect(() => {
        const fetchData = () => {
            // setLoading(true)
            apiDepotGet(tableData).then((data) => {
                if (data.data) {
                    setData(data.data['rows'])
                    setStatusCount(data.data['statusCount'])
                    setTableData((prevData) => ({
                        ...prevData,
                        ...{ total: data.data['total'] },
                    }))
                    setLoading(false)
                }
            }).catch((error) => {
                if (error.response.status === 500) {
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
                setLoading(false);
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
        tableData.status,
    ])

    const downloadAll = () => {
        apiDepotGet({
            total: 0,
            pageIndex: 1,
            pageSize: 'all',
            query: '',
            sort: {
                order: '',
                key: '',
            },
            status: tableData.status,
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    data.data['rows'],
                    `depots-${new Date().toLocaleString()}.xls`
                )
            }
        }).catch((error) => {
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
                <h3 className="mb-4 lg:mb-0 ">Depot</h3>
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
                        to={'/product/depot/add-depot'}
                        className=" mr-4 inline-flex"
                    >
                        <Button size="sm" variant="solid" icon={<MdAdd />}>
                            <span>Add Depot</span>
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
                                    `depots-${new Date().toLocaleString()}.xls`
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

export default Depot
