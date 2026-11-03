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
import { exportToExcel } from 'react-easy-export'
import NumberFormat from 'react-number-format'
import { apiGetEzycomInventory } from 'services/easyEcomService'
import { Tooltip } from 'components/ui'

const { TabNav, TabList, TabContent } = Tabs

const EzycomInventory = () => {
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
        status: "Unsynced",
    })

    const [statusCount, setStatusCount] = useState({
        unsynced:0,
        synced: 0,
    })

    const inputRef = useRef(null);

    const debounceFn = debounce(handleDebounceFn, 1000)

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
        localStorage.setItem('ezyconInventory', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:1, status: tab }))
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
                accessorKey: 'date_of_transfer',
                cell: (props) => {
                    return props.row.original.date_of_transfer === null
                        ? ''
                        : new Date(props.row.original.date_of_transfer).toLocaleDateString('en-GB', { formatMatcher: 'basic', year: 'numeric', month: '2-digit', day: '2-digit', })
                },
            },
            {
                header: 'Production Name',
                cell: (props) => {
                    return props.row.original.product === null
                        ? ''
                        : props.row.original.product.product_name
                },
            },
            {
                header: 'Status',
                cell: (props) => {
                    return props.row.original.status === null
                        ? ""
                        : `${props.row.original.status}`
                },
            },
            {
                header: 'Action',
                width: 150,
                cell: (props) => (
                    <>
                        {props.row.original.status == 'Unsynced' ? (
                            <Tooltip title="Update Ezycom Inventory">
                                <Link to={`/sales/ezycom-inventory/update-ezycom-inventory/${props.row.original.production_id}`}>
                                    <Button
                                        shape="circle"
                                        size="sm"
                                        variant="twoTone"
                                        color="blue-600"
                                        icon={<MdCreate />}
                                        className="text-sm mr-3"
                                        // loading={loading}
                                    />
                                </Link>
                            </Tooltip>
                        ) : null}
                    </>
                ),
            },
        ],
        [tableData.pageIndex, tableData.pageSize, tableData.status]
    )

    const handlePaginationChange = (pageIndex) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageIndex } }))
        localStorage.setItem('ezyconInventory', JSON.stringify({ pageSize:tableData.pageSize, pageIndex, status: tableData.status }))
    }

    const handleSelectChange = (pageSize) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageSize } }))
        localStorage.setItem('ezyconInventory', JSON.stringify({ pageSize, pageIndex:tableData.pageIndex, status: tableData.status }))
    }

    const handleSort = ({ order, key }) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ sort: { order, key } },
        }))
    }

    console.log('EzycomInventory.js Loading....')

    // useEffect(() => {
    //     if (localStorage.getItem('ezyconInventory')){
    //         let data = JSON.parse(localStorage.getItem('ezyconInventory')) 
    //         // console.log(data.status)
    //         setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
    //     }
    // }, []);

    const getInventoryData = (data)=>{
        console.log(data)
        apiGetEzycomInventory(data).then((data) => {
                console.log(data)
                if (data.data) {
                    setStatusCount({
                        unsynced:data.data['statusCount'].unsynced,
                        synced: data.data['statusCount'].synced,
                    })
                    setData(data.data['easyEcomInventory'])
                    setTableData((prevData) => ({
                        ...prevData,
                        ...{ total: data.data['total'] },
                    }))
                    setLoading(false)
                }
            })
            .catch((error) => {
                console.log(error)
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
    }

    useEffect(() => {
        // console.log(location)

        setLoading(true)
        const fetchData = () => {
            if (localStorage.getItem('ezyconInventory')){
                let data = JSON.parse(localStorage.getItem('ezyconInventory'));
                setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
                getInventoryData({...tableData, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status})
            }else{
                getInventoryData(tableData)
            }
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

    
    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-0">
                <h3 className="mb-4 lg:mb-0 ">Eazycom Inventory</h3>
                <div className="flex flex-row lg:flex-row lg:items-center">
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52 mr-4"
                        onChange={handleChange}
                        prefix={<HiSearch className="text-lg" />}
                    />
                    {/* <Link
                        to={'/sales/ezycom-inventory/update-ezycom-inventory'}
                        className=" mr-4 inline-flex"
                    >
                        <Button size="sm" variant="solid" icon={<MdAdd />}>
                            <span>Update EazyCom Inventory</span>
                        </Button>
                    </Link> */}
                </div>
            </div>

            <Tabs
                // value={loadStatus}
                defaultValue={localStorage.getItem('ezyconInventory') !== null ? JSON.parse(localStorage.getItem('ezyconInventory')).status : 'Unsynced'}
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
            >
                <TabList className="justify-end">
                    <TabNav value="Unsynced">
                        Unsynced {`(${statusCount.unsynced})`}
                    </TabNav>
                    <TabNav value="Synced">
                        Synced {`(${statusCount.synced})`}
                    </TabNav>
                </TabList>
                <div className="p-1">
                    <TabContent value="Unsynced"></TabContent>
                    <TabContent value="Synced"></TabContent>
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

export default EzycomInventory
