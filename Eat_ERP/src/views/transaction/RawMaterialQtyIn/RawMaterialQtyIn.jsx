import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import { MdCreate, MdAdd, MdImportExport } from 'react-icons/md'
import { BiBookOpen } from 'react-icons/bi'
import { Link, useNavigate } from 'react-router-dom'
import { HiSearch } from 'react-icons/hi'
import { exportToExcel } from 'react-easy-export'
import { apiRawMaterialQtyInGet } from 'services/RawMaterialQtyInService'
import Tabs from 'components/ui/Tabs'
import Notification from 'components/ui/Notification'
import toast from 'components/ui/toast'
import DownloadDebitNote from './DownloadDebitNote'

const { TabNav, TabList, TabContent } = Tabs

const RawMaterialQtyIn = () => {
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
        status: 'inCheck',
    })
    const navigate = useNavigate()
    const inputRef = useRef(null)

    const debounceFn = debounce(handleDebounceFn, 1000)

    const [statusCount, setStatusCount] = useState({
        inProcess: 0,
        processed: 0,
        rejected: 0,
        inCheck: 0,
    })

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
                header: 'Date Of Receipt',
                accessorKey: 'date_of_receipt',
                cell: (props) => {
                    let a = new Date(props.row.original.date_of_receipt)
                    return `${
                        a.getDate() < 10 ? '0' + a.getDate() : a.getDate()
                    }-${
                        a.getMonth() < 10
                            ? '0' + (a.getMonth() + 1)
                            : a.getMonth() + 1
                    }-${a.getFullYear()}`
                },
                width: 100,
            },
            {
                header: 'PO No.',
                cell: (props) => {
                    return props.row.original.po_no === null ||
                        props.row.original.po_no === ''
                        ? ''
                        : props.row.original.po_no
                },
                width: 180,
            },
            {
                header: 'GRN No.',
                cell: (props) => {
                    return props.row.original.raw_material_in_no === null ||
                        props.row.original.raw_material_in_no === ''
                        ? ''
                        : props.row.original.raw_material_in_no
                },
                width: 180,
            },
            {
                header: 'Vendor Name',
                cell: (props) => {
                    return props.row.original.vendor_name === null ||
                        props.row.original.vendor_name === ''
                        ? ''
                        : props.row.original.vendor_name
                },
            },
            {
                header: 'Depot Name',
                cell: (props) => {
                    return props.row.original.depot_name === null ||
                        props.row.original.depot_name === ''
                        ? ''
                        : props.row.original.depot_name
                },
            },
            {
                header: 'Items',
                cell: (props) => {
                    return props.row.original.rm_in_item_names === null ||
                        props.row.original.rm_in_item_names === ''
                        ? ''
                        : props.row.original.rm_in_item_names
                },
            },
            {
                header: 'Status',
                accessorKey: 'grn_status',
                width: 90,
            },
            {
                header: 'Action',
                width: 70,
                cell: (props) => (
                    <>
                        {tableData.status !== 'processed' && tableData.status !== 'rejected' ? (
                        // {tableData.status !== 'processed' ? (
                            <Link to={`/transaction/raw-material-qty-in/edit-raw-material-qty-in/${props.row.original.id}`}>
                                <Button
                                    shape="circle"
                                    size="sm"
                                    variant="twoTone"
                                    icon={<MdCreate />}
                                    className="mr-3"
                                />
                            </Link>
                        ) :(
                            <>
                                {
                                    tableData.status === 'rejected' ? (
                                        (<DownloadDebitNote grnId={props.row.original.id} />)
                                    ):(
                                        <Link to={`/transaction/raw-material-qty-in/view-raw-material-qty-in/${props.row.original.id}`}>
                                            <Button
                                                shape="circle"
                                                size="sm"
                                                variant="twoTone"
                                                color="blue-600"
                                                icon={<BiBookOpen />}
                                                className="mr-3"
                                            />
                                        </Link>
                                    )   
                                }
                            </>
                        )}
                    </>
                ),
            },
        ],
        [tableData.pageIndex, tableData.pageSize, tableData.status]
    )

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
        localStorage.setItem('grn', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:1, status: tab }))
    }

    const handlePaginationChange = (pageIndex) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageIndex } }))
        localStorage.setItem('grn', JSON.stringify({ pageSize:tableData.pageSize, pageIndex, status: tableData.status }))
    }

    const handleSelectChange = (pageSize) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageSize } }))
        localStorage.setItem('grn', JSON.stringify({ pageSize, pageIndex:tableData.pageIndex, status: tableData.status }))
    }

    const handleSort = ({ order, key }) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ sort: { order, key } },
        }))
    }

    console.log('RawMaterialQtyIn.js Loading....')

    // useEffect(() => {
        
    // }, []);

    const getGRN = (data)=>{
        apiRawMaterialQtyInGet(data).then(data=>{
            if (data.data) {
                console.log(data.data)
                setData(data.data['rows'])
                setStatusCount({
                    inProcess: data.data['statusCount'].inProcess,
                    processed: data.data['statusCount'].processed,
                    rejected: data.data['statusCount'].rejected,
                    inCheck: data.data['statusCount'].inCheck,
                })
                setLoading(false)
                setTableData((prevData) => ({
                    ...prevData,
                    ...{ total: data.data['total'] },
                }))
            }
        }).catch(
            (error) => {
                if (error.response.status === 401) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                }
            }
        )
    }
    
    useEffect(() => {
        const fetchData = () => {
            setLoading(true)
            if (localStorage.getItem('grn')){
                let data = JSON.parse(localStorage.getItem('grn')) 
                // console.log(data.status)
                setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
                getGRN({...tableData, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status})
            }else{
                getGRN(tableData)
            }
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
        apiRawMaterialQtyInGet({
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
                        `grn-${new Date().toLocaleString()}.xls`
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
            <div className="lg:flex items-center justify-between mb-2">
                <h3 className="mb-4 lg:mb-0 ">Goods Received Note</h3>
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
                            '/transaction/raw-material-qty-in/add-raw-material-qty-in'
                        }
                        className=" mr-4 inline-flex"
                    >
                        <Button size="sm" variant="solid" icon={<MdAdd />}>
                            <span>Add Goods Received Note</span>
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
                                    `grn-${new Date().toLocaleString()}.xls`
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
                defaultValue={localStorage.getItem('grn') === null ? 'inCheck' : JSON.parse(localStorage.getItem('grn')).status}
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
            >
                <TabList className="justify-end">
                    <TabNav value="inCheck">
                        Pending {`(${statusCount.inCheck})`}
                    </TabNav>
                    <TabNav value="inProcess">
                        In Process {`(${statusCount.inProcess})`}
                    </TabNav>
                    <TabNav value="processed">
                        Processed {`(${statusCount.processed})`}
                    </TabNav>
                    <TabNav value="rejected">
                        Rejected {`(${statusCount.rejected})`}
                    </TabNav>
                </TabList>
                <div className="p-1">
                    <TabContent value="inCheck"></TabContent>
                    <TabContent value="inProcess"></TabContent>
                    <TabContent value="processed"></TabContent>
                    <TabContent value="rejected"></TabContent>
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

export default RawMaterialQtyIn
