import React, { useState, useEffect } from 'react'
import { Card } from 'components/ui'
import Select from 'components/ui/Select'
import Tabs from 'components/ui/Tabs'
import Button from 'components/ui/Buttons'
import Badge from 'components/ui/Badge'
import { MdEdit } from 'react-icons/md'
import Moment from 'react-moment'
import Dialog from 'components/ui/Dialog'
import {
    apiGetAllStore,
    apiGetStoreDepot,
    apiStoreManagerCancel,
    apiStoreManagerCancelPackaging,
} from 'services/ProductionService'
import Pagination from 'components/ui/Pagination'
import { useNavigate } from 'react-router-dom'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { socket } from 'socket'
import Skeleton from 'components/ui/Skeleton'
import { HiSearch } from 'react-icons/hi'
import { debounce } from 'lodash'
import Input from 'components/ui/Input'

const { TabNav, TabList, TabContent } = Tabs

const paginationOptions = [
    { value: 5, label: '5' },
    { value: 10, label: '10' },
    { value: 25, label: '25' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]


const StoreManager = () => {
    const [options, setOptions] = useState([])
    const [depotValue, setDepotValue] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingCard, setLoadingCard] = useState(false)
    const [statusCount, setStatusCount] = useState({
        pending: 0,
        transferred: 0,
    })

    const [open, setOpen] = useState(false)
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 5,
        query: '',
        status: 'pending',
    })

    const [dataList, setDataList] = useState([])
    const navigate = useNavigate()
    const [confirmData, setConfirmData] = useState({
        isOpen: false,
        id: '',
        packaging: false,
    })

    const debounceFn = debounce(handleDebounceFn, 1000)

    const today = new Date(new Date().toDateString());
    // console.log(today);
    const tomorrow = new Date(today.setDate(today.getDate() + 1));
    // console.log(tomorrow);
    const dayAfterTomorrow = new Date(today.setDate(today.getDate() + 1));
    // console.log(dayAfterTomorrow);

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

    const getStoreList = () => {
        // let paramStatus = tab ? tab : status
        // console.log(tableData)
        setLoadingCard(true)
        apiGetAllStore(
            JSON.parse(localStorage.getItem('storeDepot')).id,
            tableData
        ).then((data) => {
            console.log(data)
            setStatusCount({
                pending: data.statusCount['pending'],
                transferred: data.statusCount['transferred'],
            })
            setTableData((prevData) => ({
                ...prevData,
                total: data.total,
            }))
            setDataList(data.rows)
            setLoadingCard(false)
        })
    }

    const handleClose = () => {
        console.log('Close')
        setDepotValue(JSON.parse(localStorage.getItem('storeDepot')))
        setOpen(false)
    }

    const handleConfirm = () => {
        console.log('Confirm')
        localStorage.setItem('storeDepot', JSON.stringify(depotValue))
        getStoreList()
        setOpen(false)
    }

    const promiseOptions = () => {
        apiGetStoreDepot().then((data) => {
            let options = data.data['depots']
            let opdata = []
            // setDepoOptions((prev) => {
            //     options.forEach((element) => {
            //         opdata.push({
            //             label: element.depot_name,
            //             value: element.depot_code,
            //         })
            //         return [...prev, opdata]
            //     })
            // })
            options.forEach((element) => {
                opdata.push({
                    label: element.depot_name,
                    value: element.depot_code,
                    id: element.id,
                    location_key: element.easyecom_location_key,
                })
            })
            console.log(opdata)
            setOptions(opdata)
            setLoading(false)
        })
    }

    const onFocus = () => {
        if (options.length === 0) {
            setLoading(true)
            promiseOptions()
        }
    }

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            pageIndex: 1,
            status: tab,
        }))
    }

    const onPageSelect = ({ value }) => {
        setTableData((prevData) => ({
            ...prevData,
            pageSize: value,
        }))
    }

    const onPaginationChange = (page) => {
        console.log('onPaginationChange', page)
        setTableData((prevData) => ({
            ...prevData,
            pageIndex: page,
        }))
    }

    const confirmClose = () => {
        setConfirmData({
            isOpen: false,
            id: '',
            packaging: false
        })
    }

    const confirmSubmit = (id) => {
        if (confirmData.packaging) {
            apiStoreManagerCancelPackaging(id).then((data) => {
                if (data.status === 200) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    getStoreList()
                } else {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                }
                setConfirmData({
                    isOpen: false,
                    id: '',
                    packaging:false,
                })
            })
            .catch((error) => {
                console.log(error.response)
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {error.response['data'].message}
                    </Notification>
                )
            })

        } else {

            apiStoreManagerCancel(id).then((data) => {
                if (data.status === 200) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    getStoreList()
                } else {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                }
                setConfirmData({
                    isOpen: false,
                    id: '',
                    packaging:false,
                })
            })
            .catch((error) => {
                console.log(error.response)
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {error.response['data'].message}
                    </Notification>
                )
            })
        }
    }

    // useEffect(() => {

    // }, [])

    useEffect(() => {
        if (localStorage.getItem('storeDepot') === null) {
            setDepotValue('')
            setOpen(true)
        } else {
            setDepotValue(JSON.parse(localStorage.getItem('storeDepot')))
            console.log(localStorage.getItem('storeDepot'))
            getStoreList()
        }
        socket.on('connect', () => {
            console.log('connection established')
        })
        socket.on('AllProduction', (arg) => {
            console.log(arg)
            const transport = socket.io.engine.transport.name; // in most cases, "polling"
            console.log("transport", transport)
            socket.io.engine.on("upgrade", () => {
                const upgradedTransport = socket.io.engine.transport.name; // in most cases, "websocket"
                console.log("upgradedTransport", upgradedTransport)
            })
            console.log(tableData)
            getStoreList()
        })

        socket.on('connect_error', (err) => {
            console.log('Connection_error', err)
        })
        return () => {
            console.log("Connection Disconnected")
            socket.off('connect')
            socket.off('AllProduction')
            // if (socket.connected) {
            //     socket.off('AllProduction')
            // }
        }
    }, [tableData.status, tableData.pageIndex, tableData.pageSize, tableData.query])

    return (
        <Card className=" card-shadow mb-4">
            <div className="flex justify-between items-top">
                <h4>Store Manager</h4>
                <div className="text-right">
                    <p className="text-black bg-amber-100 p-[7px] mb-1 rounded text-base text-center">
                        <b>Batch No.</b> :{' '}
                        {localStorage.getItem('storeDepot') === null
                            ? ''
                            : JSON.parse(localStorage.getItem('storeDepot'))
                                .value}
                        <Moment format="DDMMYYYY">{new Date()}</Moment>
                    </p>
                    <div className=" inline-flex justify-end items-center gap-5 mb-3">
                        <p className="text-black bg-slate-100 p-[7px] rounded text-sm text-center">
                            {localStorage.getItem('storeDepot') === null
                                ? ''
                                : JSON.parse(localStorage.getItem('storeDepot'))
                                    .label}
                        </p>

                        <Button
                            shape="circle"
                            variant="solid"
                            size="md"
                            color="emerald-600"
                            icon={<MdEdit />}
                            onClick={() => {
                                setOpen(true)
                            }}
                        />
                    </div>
                    <div className='mb-2'>
                        <Input
                            // ref={inputRef}
                            placeholder="Search..."
                            size="sm"
                            className="lg:w-52 mr-4"
                            onChange={handleChange}
                            prefix={<HiSearch className="text-lg" />}
                        />
                    </div>
                </div>
            </div>
            <Tabs
                defaultValue="pending"
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
                className="mb-2"
            >
                <TabList className="justify-end">
                    <TabNav value="pending">
                        Pending {`(${statusCount.pending})`}
                    </TabNav>
                    <TabNav value="transferred">
                        Transferred {`(${statusCount.transferred})`}
                    </TabNav>
                </TabList>
                <div className="p-1">
                    <TabContent value="pending"></TabContent>
                    <TabContent value="transferred"></TabContent>
                </div>
            </Tabs>
            <div className="grid grid-cols-1 lg:grid-cols-1 2xl:grid-cols-1 gap-4 mb-4">
                {
                    loadingCard ? (
                        <div className="flex flex-col gap-4">
                            <Skeleton height={20} />
                            <div className="flex flex-auto items-center gap-2">
                                <div className="flex flex-col gap-4 w-full">
                                    <Skeleton height={10} />
                                    <Skeleton height={20} />
                                </div>
                                <div className="flex flex-col gap-4 w-full">
                                    <Skeleton height={10} />
                                    <Skeleton height={20} />
                                </div>
                                <div className="flex flex-col gap-4 w-full">
                                    <Skeleton height={10} />
                                    <Skeleton height={20} />
                                </div>
                            </div>
                        </div>
                    ) : dataList && dataList.length > 0
                        ? dataList.map((store, index) => (
                            <div
                            // ${store.fifo_not_followed
                            //             ? 'bg-rose-100 '
                            //             : 'bg-slate-100 '
                            //         }
                                className={`card border-0 bg-slate-100 card-shadow relative`}
                                key={index}
                            >
                                <div className="card-body p-0">
                                    <div className=" absolute top-2 right-2 flex gap-2 justify-center items-center">
                                        {/* {store.fifo_not_followed ? (
                                            <Badge
                                                content={'FIFO NOT FOLLOWED'}
                                                innerClass="bg-rose-400"
                                            />
                                        ) : (
                                            ''
                                        )} */}
                                        {store.return_raw_material ? (
                                            <Badge
                                                content={'IN'}
                                                innerClass="bg-amber-400"
                                            />
                                        ) : (
                                            <Badge
                                                content={'OUT'}
                                                innerClass="bg-slate-400"
                                            />
                                        )}
                                    </div>
                                    <p className=" absolute top-[10px] left-2 text-xs">
                                        {store.date_of_processing ? (
                                            <Moment format="DD-MM-YYYY">
                                                {store.date_of_processing}
                                            </Moment>
                                        ) : (
                                            ''
                                        )}
                                        {store.date_of_processing && new Date(store.date_of_processing) > new Date() ?
                                            (<span className="text-rose-600 font-semibold">{' (For ' +
                                                (new Date(store.date_of_processing) >= dayAfterTomorrow ? 'Day After Tomorrow' : 'Tomorrow')
                                                + ')'}</span>) :
                                            ''}
                                    </p>
                                    <h6 className=" bg-slate-50 text-center p-[5px] rounded mb-2">
                                        {store.product ? store.product['short_name'] : 'Packaging-' + store.id}
                                    </h6>
                                    {store.return_raw_material ? (
                                        <div className="grid items-center grid-cols-3 gap-3 p-2">
                                            <div>
                                                {store.return_kg > 0 ? (
                                                    <p className="text-center">
                                                        <span className="font-semibold">
                                                            Total Received Qty
                                                            :&nbsp;
                                                            <span className="text-lg ">
                                                                <span className="text-rose-600">
                                                                    {
                                                                        store.return_kg
                                                                    }
                                                                </span>
                                                                Kg
                                                            </span>
                                                        </span>
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div>
                                                <Button
                                                    size="lg"
                                                    className="h-4"
                                                    block
                                                    onClick={() => {
                                                        if (store.product) {
                                                            navigate(`/production/store-manager/receive/${store.id}`)
                                                        } else {
                                                            navigate(`/production/store-manager/receivePackaging/${store.id}`)
                                                        }
                                                    }}
                                                >
                                                    {tableData.status !==
                                                        'transferred'
                                                        ? 'Receive'
                                                        : 'View Received'}
                                                </Button>
                                            </div>
                                            <div>
                                                {store.receive === 1 && tableData.status === 'pending' ? (
                                                    <Button
                                                        size="lg"
                                                        className="h-4"
                                                        block
                                                        variant="solid"
                                                        color="rose-600"
                                                        onClick={() => {
                                                            setConfirmData({
                                                                isOpen: true,
                                                                id: store.id,
                                                                packaging: store.product ? false: true,
                                                            })
                                                        }}
                                                    >
                                                        Cancel Receive
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="lg"
                                                        variant="solid"
                                                        color="amber-600"
                                                        className="h-4"
                                                        block
                                                        onClick={() => {
                                                            if(store.product){
                                                                navigate(`/production/store-manager/transfer/${store.id}`)
                                                            }else{
                                                                navigate(`/production/store-manager/transferPackaging/${store.id}`)
                                                            }
                                                        }}
                                                        disabled={store.store_kg <= 0}
                                                    >
                                                        {tableData.status ===
                                                            'transferred'
                                                            ? 'View Transferred'
                                                            : 'Transfer'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid items-center grid-cols-3 gap-3 p-2">
                                            <div>
                                                {store.store_requested_kg ? (
                                                    <p className="text-center">
                                                        <span className="font-semibold">
                                                            Quantity :&nbsp;
                                                            <span className="text-lg ">
                                                                <span className="text-rose-600">
                                                                    {
                                                                        store.store_kg
                                                                    }
                                                                </span>
                                                                <span>
                                                                    {' '}
                                                                    /{' '}
                                                                    {
                                                                        store.store_requested_kg
                                                                    }{' '}
                                                                    Kg
                                                                </span>
                                                            </span>
                                                        </span>
                                                    </p>
                                                ) : (
                                                    ''
                                                )}
                                            </div>
                                            <div>
                                                {store.store_kg > 0 && store.raw_material_request == 1 && store.transfer_approval != 1 && store.store_id == null ? (
                                                    tableData.status !== 'transferred' ? (
                                                        <Button
                                                            size="lg"
                                                            className="h-4"
                                                            block
                                                            onClick={() => {
                                                                if (store.p_type === 'Other' && store.product) {
                                                                    navigate(`/production/store-manager/add-batch-material/${store.id}`)
                                                                } else if (store.p_type === 'Essentials' && store.product) {
                                                                    // navigate(`/production/store-manager/add-material/${store.id}`)
                                                                    navigate(
                                                                        `/production/store-manager/edit-material/${store.id}`
                                                                    )
                                                                } else {
                                                                    navigate(`/production/store-manager/add-packaging-material/${store.id}`)
                                                                }
                                                            }}
                                                        >
                                                            {tableData.status ===
                                                                'transferred'
                                                                ? 'Picked'
                                                                : 'Edit'}
                                                        </Button>
                                                    ) : null
                                                ) :  store.store_id == JSON.parse(localStorage.getItem('storeDepot')).id ? (
                                                        <Button
                                                            size="lg"
                                                            className="h-4"
                                                            block
                                                            onClick={() => {
                                                                navigate(`/production/store-manager/receive-transfer/${store.id}`)
                                                            }}
                                                        >
                                                            {store.transfer_approval ? 'Receive Transfer': 'View Received Transfer'}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="lg"
                                                            className="h-4"
                                                            block
                                                            onClick={() => {
                                                                if (store.p_type === 'Other' && store.product) {
                                                                    navigate(`/production/store-manager/add-batch-material/${store.id}`)
                                                                } else if (store.p_type === 'Essentials' && store.product) {
                                                                    navigate(`/production/store-manager/add-material/${store.id}`)
                                                                } else {
                                                                    navigate(`/production/store-manager/add-packaging-material/${store.id}`)
                                                                }
                                                            }}
                                                            disabled={store.transfer == 1}  
                                                        >
                                                            Assemble
                                                        </Button>
                                                    )
                                                    
                                                }
                                            </div>
                                            <div>
                                                <Button
                                                    size="lg"
                                                    variant="solid"
                                                    color="amber-600"
                                                    className="h-4"
                                                    block
                                                    onClick={() => {
                                                        if (store.product) {
                                                            navigate(`/production/store-manager/transfer/${store.id}`)
                                                        } else {
                                                            navigate(`/production/store-manager/transferPackaging/${store.id}`)
                                                        }
                                                    }}
                                                    disabled={store.store_kg <= 0}
                                                >
                                                    {tableData.status ===
                                                        'transferred'
                                                        ? 'View Transferred'
                                                        : 'Transfer'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                        : `No Product ${tableData.status === 'pending'
                            ? 'In Pending'
                            : 'In Transferred'
                        }`
                }

                {/* <div className="card bg-rose-100 border-0 card-shadow relative">
                    <div className="card-body p-0">
                        <div className=" absolute top-2 right-2 flex gap-2 justify-center items-center">
                            <Badge
                                content={'FIFO Not Followed'}
                                innerClass="bg-rose-500"
                            />
                            <Badge content={'OUT'} innerClass="bg-slate-400" />
                        </div>
                        <p className=" absolute top-[10px] left-2 text-xs">
                            12-12-2012
                        </p>
                        <h6 className=" bg-rose-50 text-center p-[5px] rounded mb-2">
                            Cashew Almonds
                        </h6>
                        <div className="grid items-center grid-cols-3 gap-3 p-2">
                            <div>
                                <p className="text-center">
                                    <span className="font-semibold">
                                        Quantity :&nbsp;
                                        <span className="text-lg ">
                                            <span className="text-rose-600">
                                                800
                                            </span>
                                            <span> / 1000 Kg</span>
                                        </span>
                                    </span>
                                </p>
                            </div>
                            <Button size="lg" className="h-4">
                                Assemble
                            </Button>
                            <Button
                                size="lg"
                                variant="solid"
                                color="amber-600"
                                className="h-4"
                            >
                                Transfer
                            </Button>
                        </div>
                    </div>
                </div> */}
                <div className="flex items-center justify-center">
                    <Pagination
                        displayTotal
                        pageSize={tableData.pageSize}
                        total={tableData.total}
                        onChange={onPaginationChange}
                    />
                    <div style={{ minWidth: 120 }}>
                        <Select
                            size="sm"
                            isSearchable={false}
                            defaultValue={paginationOptions[0]}
                            options={paginationOptions}
                            onChange={(selected) => onPageSelect(selected)}
                        />
                    </div>
                </div>
            </div>
            <Dialog isOpen={open} closable={false} height={400}>
                <div className="flex flex-col items-center justify-between gap-2 h-full">
                    <h5 className="mb-4 text-center">Select Store Depot</h5>
                    <div className="w-full h-5/6">
                        <Select
                            size="md"
                            options={options}
                            onFocus={onFocus}
                            isLoading={loading}
                            className="mb-2"
                            value={depotValue}
                            onChange={(e) => {
                                console.log(e)
                                setDepotValue(e)
                            }}
                        />
                    </div>
                    <div className="text-right mt-6 w-full">
                        <Button
                            className="ltr:mr-2 rtl:ml-2"
                            variant="plain"
                            onClick={handleClose}
                        >
                            Cancel
                        </Button>
                        <Button variant="solid" onClick={handleConfirm}>
                            Save
                        </Button>
                    </div>
                </div>
            </Dialog>

            <Dialog
                isOpen={confirmData.isOpen}
                onClose={confirmClose}
                onRequestClose={confirmClose}
            >
                <h5 className="mb-4">Confirmation!!</h5>
                <p>Are you sure want to Cancel Receive ??</p>
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="plain"
                        onClick={confirmClose}
                        size="lg"
                        type="button"
                    >
                        No
                    </Button>
                    <Button
                        variant="solid"
                        color="emerald-600"
                        onClick={() => confirmSubmit(confirmData.id)}
                        size="lg"
                        type="button"
                    >
                        Yes
                    </Button>
                </div>
            </Dialog>
        </Card>
    )
}

export default StoreManager
