import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import Tabs from 'components/ui/Tabs'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { MdCreate, MdAdd, MdImportExport } from 'react-icons/md'
import { HiSearch } from 'react-icons/hi'
import {
    apiProductionPlanningGet,
    apiProductionPlanningSendMail,
} from 'services/ProductionPlanningService'
import { exportToExcel } from 'react-easy-export'
import NumberFormat from 'react-number-format'
import Tooltip from 'components/ui/Tooltip'
import { BiBookOpen, BiMailSend } from 'react-icons/bi'

const { TabNav, TabList, TabContent } = Tabs

const ProductionPlanning = () => {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 10,
        query: '',
        sort: {
            order: '',
            key: '',
        },
        status: 'open',
    })

    const [statusCount, setStatusCount] = useState({
        open: 0,
        closed: 0
    })

    const [loadStatus, setLoadStatus] = useState('open')
    const location = useLocation()
    const navigate = useNavigate()
    const inputRef = useRef(null)

    const debounceFn = debounce(handleDebounceFn, 1000)

    const tabChanges = (tab) => {
        setLoadStatus(tab)
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
    }

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
                header: 'Order Date',
                cell: (props) => {
                    let a = new Date(props.row.original.order_date)
                    return props.row.original.order_date === null
                        ? ''
                        : `${
                              a.getDate() < 10 ? '0' + a.getDate() : a.getDate()
                          }-${
                              a.getMonth() + 1 < 10
                                  ? '0' + (a.getMonth() + 1)
                                  : a.getMonth() + 1
                          }-${a.getFullYear()}`
                },
                accessorKey: 'order_date',
                width:110
            },
            {
                header: 'Depot Name',
                cell: (props) =>props.row.original.depot_name === null ? '' : props.row.original.depot_name,
                accessorKey: 'depot_name'
            },
            {
                header: 'Product Names',
                cell: (props) => props.row.original.product_names === null ? '' : props.row.original.product_names,
                accessorKey: 'product_names'
            },
            {
                header: 'Item Names',
                cell: (props) => props.row.original.item_names === null ? '' : props.row.original.item_names,
                accessorKey: 'item_names'
            },
            {
                header: 'PO Drafted',
                cell: (props) => props.row.original.po_drafted === null ? '' : props.row.original.po_drafted === 1 ? 'Yes' : 'No',
                accessorKey: 'po_drafted'
            },
            {
                header: 'Action',
                width: 80,
                cell: (props) => (
                    <>
                        <Tooltip title="Edit Production Planning">
                            <Link to={`/transaction/production-planning/edit-production-planning/${props.row.original.id}`}>
                                <Button
                                    shape="circle"
                                    size="sm"
                                    variant="twoTone"
                                    icon={<MdCreate />}
                                    className="text-sm mr-3"
                                />
                            </Link>
                        </Tooltip>
                    </>
                ),
            },
        ],
        [tableData.pageIndex, tableData.pageSize, tableData.status]
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

    console.log('ProductionPlanning.js Loading....')
    useEffect(() => {
        // console.log(location)

        setLoading(true)
        const fetchData = () => {
            if (location.search != '') {
                let status = location.search.replace('?', '').split('=')[1]
                setLoadStatus(status)
                setTableData((prevData) => ({
                    ...prevData,
                    ...{ status: status },
                }))
                setTimeout(() => {
                    const updatedUrl =
                        window.location.protocol +
                        '//' +
                        window.location.host +
                        window.location.pathname
                    window.history.pushState(
                        { path: updatedUrl },
                        '',
                        updatedUrl
                    )
                    // window.history.replace({
                    //     search: queryParams,
                    // })
                    location.search = ''
                }, 500)
                console.log(location)
                console.log('only 1st time')
            }
            apiProductionPlanningGet(tableData)
                .then((data) => {
                    if (data.data) {
                        setStatusCount({
                            open: data.data['statusCount'].open,
                            closed: data.data['statusCount'].closed,
                        })
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
        tableData.status,
    ])

    const downloadAll = () => {
        apiProductionPlanningGet({
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
                        `ProductionPlanning-${new Date().toLocaleString()}.xls`
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
            <div className="lg:flex items-center justify-between mb-0">
                <h3 className="mb-4 lg:mb-0 ">Production Planning</h3>
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
                        to={'/transaction/production-planning/add-production-planning'}
                        className=" mr-4 inline-flex"
                    >
                        <Button size="sm" variant="solid" icon={<MdAdd />}>
                            <span>Add Production Planning</span>
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
                                    `ProductionPlanning-${new Date().toLocaleString()}.xls`
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

            <Tabs
                value={loadStatus}
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
            >
                <TabList className="justify-end">
                    <TabNav value="open">Open {`(${statusCount.open})`}</TabNav>
                    <TabNav value="closed">Closed {`(${statusCount.closed})`}</TabNav>
                </TabList>
                <div className="p-1">
                    <TabContent value="open"></TabContent>
                    <TabContent value="closed"></TabContent>
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

export default ProductionPlanning
