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
import { MdCreate, MdAdd, MdImportExport, MdDelete } from 'react-icons/md'
import { FaFistRaised} from 'react-icons/fa'
import { HiSearch } from 'react-icons/hi'
import {
    apiRequisitionDelete,
    apiRequisitionGet,
} from 'services/RequisitionService'
import { exportToExcel } from 'react-easy-export'
import NumberFormat from 'react-number-format'
import Tooltip from 'components/ui/Tooltip'
import { BiBookOpen, BiMailSend } from 'react-icons/bi'
import { ConfirmDialog } from 'components/shared'

const { TabNav, TabList, TabContent } = Tabs

const Requisition = () => {
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
        closed: 0,
    })

    const [confirmation, setConfirmation] = useState({
        isOpen:false,
        id:0,
    });

    const inputRef = useRef(null)

    const debounceFn = debounce(handleDebounceFn, 1000)

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
        localStorage.setItem('requisition', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:1, status: tab }))
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
                cell: (props) =>
                    props.row.index +
                    1 +
                    tableData.pageSize * (tableData.pageIndex - 1),
                width: 60,
            },
            {
                header: 'Date',
                cell: (props) => {
                    let a = new Date(props.row.original.requisition_date)
                    return props.row.original.requisition_date === null
                        ? ''
                        : `${
                              a.getDate() < 10 ? '0' + a.getDate() : a.getDate()
                          }-${
                              a.getMonth() + 1 < 10
                                  ? '0' + (a.getMonth() + 1)
                                  : a.getMonth() + 1
                          }-${a.getFullYear()}`
                },
                accessorKey: 'requisition_date',
                width: 120,
            },
            {
                header: 'Depot Name',
                cell: (props) => {
                    return props.row.original.depot_name === null
                        ? ''
                        : props.row.original.depot_name
                },
                accessorKey: 'depot_name',
                width: 150,
            },
            {
                header: 'Items',
                cell: (props) => {
                    return props.row.original.item_names === null
                        ? ''
                        : props.row.original.item_names
                },
                accessorKey: 'item_names',
            },
            {
                header: 'Products',
                cell: (props) => {
                    return props.row.original.product_names === null
                        ? ''
                        : props.row.original.product_names
                },
                accessorKey: 'product_names',
            },
            {
                header: 'Action',
                width: 150,
                cell: (props) => (
                    <>
                        <Tooltip title="Edit Requisition">
                            <Link to={`/production/requisition/edit-requisition/${props.row.original.id}`}>
                                <Button
                                    shape="circle"
                                    size="sm"
                                    variant="solid"
                                    icon={<MdCreate />}
                                    className="text-sm mr-3"
                                />
                            </Link>
                        </Tooltip>
                        <Tooltip title="Raise Production">
                            <Link to={`/production/requisition/raise-requisition/${props.row.original.id}`}>
                                <Button
                                    shape="circle"
                                    size="sm"
                                    variant="solid"
                                    color="blue-600"
                                    icon={<FaFistRaised />}
                                    className="text-sm mr-3"
                                />
                            </Link>
                        </Tooltip>
                        {
                            tableData.status !== "closed" && (
                                <Tooltip title="Delete Requisition">
                                    <Button
                                        shape="circle"
                                        size="sm"
                                        variant="solid"
                                        color="rose-600"
                                        icon={<MdDelete />}
                                        className="text-sm"
                                        onClick={()=>setConfirmation({isOpen:true, id:props.row.original.id})}
                                    />
                                </Tooltip>
                            )
                        }
                    </>
                ),
            },
        ],
        [tableData.pageIndex, tableData.pageSize, tableData.status]
    )

    const handlePaginationChange = (pageIndex) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageIndex } }))
        localStorage.setItem('requisition', JSON.stringify({ pageSize:tableData.pageSize, pageIndex, status: tableData.status }))
    }

    const handleSelectChange = (pageSize) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageSize } }))
        localStorage.setItem('requisition', JSON.stringify({ pageSize, pageIndex:tableData.pageIndex, status: tableData.status }))
    }

    const handleSort = ({ order, key }) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ sort: { order, key } },
        }))
    }

    const downloadAll = () => {
        apiRequisitionGet({
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
                        `Requisitions-${new Date().toLocaleString()}.xls`
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

    const handleClose = () => {
        console.log('Close')
        setConfirmation({isOpen:false, id:0})
    }

    const handleConfirm = () => {
        console.log('Confirm')
        apiRequisitionDelete(confirmation.id).then((data) => {
            if (data.status === 200) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data["message"]}
                    </Notification>
                );
            } else if (data.status === 201) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data["message"]}
                    </Notification>
                );
            } else if (data.response.status === 422) {
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {data.response.data["message"]}
                    </Notification>
                );
            } else if (data.response.status === 500) {
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {data.response.data["message"]}
                    </Notification>
                );
            }
            setConfirmation({isOpen:false, id:0})
            fetchData();
        });
    }

    console.log('Requisition.js Loading....')

    const fetchData = () => {
        apiRequisitionGet(tableData)
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

    useEffect(() => {
        if (localStorage.getItem('requisition')){
            let data = JSON.parse(localStorage.getItem('requisition')) 
            // console.log(data.status)
            setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
        }
    }, []);

    useEffect(() => {
        setLoading(true)
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        tableData.pageIndex,
        tableData.sort,
        tableData.pageSize,
        tableData.query,
        tableData.status,
    ])

    return (
        <>
            <AdaptableCard className="card-shadow">
                <div className="lg:flex items-center justify-between mb-0">
                    <h3 className="mb-4 lg:mb-0 ">Requisition</h3>
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
                            to={'/production/requisition/add-requisition'}
                            className=" mr-4 inline-flex"
                        >
                            <Button size="sm" variant="solid" icon={<MdAdd />}>
                                <span>Add Requisition</span>
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
                                        `Requisitions-${new Date().toLocaleString()}.xls`
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
                    // value={loadStatus}
                    defaultValue={localStorage.getItem('requisition') === null ? 'open' : JSON.parse(localStorage.getItem('requisition')).status}
                    onChange={(tabValue) => {
                        tabChanges(tabValue)
                    }}
                >
                    <TabList className="justify-end">
                        <TabNav value="open">
                            Open {`(${statusCount.open})`}
                        </TabNav>
                        <TabNav value="closed">
                            Closed {`(${statusCount.closed})`}
                        </TabNav>
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
            <ConfirmDialog
                isOpen={confirmation.isOpen}
                type='danger'
                title='Delete Requisition'
                confirmButtonColor='rose-600'
                cancelText='No'
                confirmText='Yes'
                onClose={handleClose}
                onRequestClose={handleClose}
                onCancel={handleClose}
                onConfirm={handleConfirm}
            >
                <p>Are you sure want to delete this requisition ?</p>
            </ConfirmDialog>
        </>
    )
}

export default Requisition
