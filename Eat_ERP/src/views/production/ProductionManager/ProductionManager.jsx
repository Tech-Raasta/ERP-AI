import React, { useState, useEffect } from 'react'
import { Card, Pagination } from 'components/ui'
import Select from 'components/ui/Select'
import Tabs from 'components/ui/Tabs'
import Button from 'components/ui/Buttons'
import Badge from 'components/ui/Badge'
import { MdEdit } from 'react-icons/md'
import Moment from 'react-moment'
import Dialog from 'components/ui/Dialog'
import {
    apiGetAllProduction,
    apiGetDepot,
    apiGetProductionReturnDetails,
    apiProductionApprove,
    apiProductionReject,
} from 'services/ProductionService'
import { useNavigate } from 'react-router-dom'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { socket } from 'socket'
import Skeleton from 'components/ui/Skeleton'
import { HiEye, HiSearch } from 'react-icons/hi'
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

const ProductionManager = () => {
    const [options, setOptions] = useState([])
    const [depotValue, setDepotValue] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingCard, setLoadingCard] = useState(false)
    const [open, setOpen] = useState(false)
    const navigate = useNavigate()
    const [statusCount, setStatusCount] = useState({
        inProcess: 0,
        pending: 0,
        workInProgress: 0,
        allocationPending:0,
        transferPending:0,
        approved: 0,
        waiting:0,
    })
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 5,
        query:'',
        status: 'pending',
    })
    const [dataList, setDataList] = useState([])

    const [confirmIsOpen, setConfirmIsOpen] = useState({
        isOpen: false,
        approved: false,
        id: '',
    })

    const [viewIsOpen, setViewIsOpen] = useState({
        isOpen:false,
        type:'',
        productionReturn: []
    });

    const debounceFn = debounce(handleDebounceFn, 1000)

    function handleDebounceFn(val) {
        if (typeof val === 'string' && (val.length > 1 || val.length === 0)) {
            setTableData((prevData) => ({
                ...prevData,
                ...{ query: val, pageIndex: 1 },
            }))
            // localStorage.setItem('productionManager', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:1, status: tableData.status, query: val }))
        }
    }

    const handleChange = (e) => {
        debounceFn(e.target.value)
    }

    const handleClose = () => {
        console.log('Close')
        setDepotValue(JSON.parse(localStorage.getItem('prodDepot')))
        setOpen(false)
    }

    const handleConfirm = () => {
        console.log('Confirm')
        localStorage.setItem('prodDepot', JSON.stringify(depotValue))
        getProductionList()
        setOpen(false)
    }

    const promiseOptions = () => {
        apiGetDepot().then((data) => {
            let options = data.data['depots']
            let opdata = []
            options.forEach((element) => {
                opdata.push({
                    label: element.depot_name,
                    value: element.depot_code,
                    id: element.id,
                })
            })
            // console.log(opdata)
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
            pageIndex:1,
            status: tab,
        }))
        localStorage.setItem('productionManager', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:1, status: tab }))
        // getProductionList()
    }

    const getProductionList = () => {
        // let paramStatus = tab ? tab : status
        // console.log(tableData)
        let tdata;
        if (localStorage.getItem('productionManager')){
            let data = JSON.parse(localStorage.getItem('productionManager')) 
            console.log(data)
            tdata = {...tableData, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status, }
            setTableData(prev=>{
                return {...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}
            })
        }
        // console.log("Socket Change data:", tdata)
        setLoadingCard(true)
        apiGetAllProduction(
            JSON.parse(localStorage.getItem('prodDepot')).id,
            localStorage.getItem('productionManager') ? tdata : tableData
        ).then((data) => {
            console.log(data)
            setStatusCount({
                waiting: data.statusCount['waiting'],
                inProcess: data.statusCount['inProcess'],
                pending: data.statusCount['pending'],
                approved: data.statusCount['approved'],
                workInProgress: data.statusCount['workInProgress'],
                allocationPending: data.statusCount['allocationPending'],
                transferPending: data.statusCount['transferPending']
            })
            setTableData((prevData) => ({
                ...prevData,
                total: data.total,
            }))
            setDataList(data.rows)
            setLoadingCard(false)
        })
    }

    const onPageSelect = ({ value }) => {
        setTableData((prevData) => ({
            ...prevData,
            pageSize: value,
        }))
        localStorage.setItem('productionManager', JSON.stringify({ pageSize:value, pageIndex:tableData.pageIndex, status: tableData.status }))
    }

    const onPaginationChange = (page) => {
        // console.log('onPaginationChange', page)
        setTableData((prevData) => ({
            ...prevData,
            pageIndex: page,
        }))

        localStorage.setItem('productionManager', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:page, status: tableData.status }))
    }

    const confirmClose = () => {
        setConfirmIsOpen({
            isOpen: false,
            approved: false,
            id: '',
        })
    }

    const callApprove = () => {
        if (confirmIsOpen.id !== '') {
            apiProductionApprove(confirmIsOpen.id)
                .then((data) => {
                    if (data.status === 200) {
                        toast.push(
                            <Notification
                                title="Success"
                                type="success"
                                closable
                            >
                                {data.data['message']}
                            </Notification>
                        )
                        getProductionList()
                        socket.emit('AllProduction', 'Saurabh')
                    } else {
                        toast.push(
                            <Notification
                                title="Success"
                                type="success"
                                closable
                            >
                                {data.data['message']}
                            </Notification>
                        )
                    }
                })
                .catch((error) => {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response['data'].message}
                        </Notification>
                    )
                })

            setConfirmIsOpen({
                isOpen: false,
                approved: false,
                id: '',
            })
        }
    }

    const callReject = () => {
        if (confirmIsOpen.id !== '') {
            apiProductionReject(confirmIsOpen.id)
                .then((data) => {
                    if (data.status === 200) {
                        toast.push(
                            <Notification
                                title="Success"
                                type="success"
                                closable
                            >
                                {data.data['message']}
                            </Notification>
                        )
                        getProductionList()
                        socket.emit('AllProduction', 'Saurabh')
                    } else {
                        toast.push(
                            <Notification
                                title="Success"
                                type="success"
                                closable
                            >
                                {data.data['message']}
                            </Notification>
                        )
                    }
                })
                .catch((error) => {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response['data'].message}
                        </Notification>
                    )
                })

            setConfirmIsOpen({
                isOpen: false,
                approved: false,
                id: '',
            })
        }
    }

    const confirmSubmit = () => {
        if (confirmIsOpen.isOpen) {
            if (confirmIsOpen.approved) {
                callApprove()
            } else {
                callReject()
            }
        }
    }

    const openReturn = (id, value)=>{
        apiGetProductionReturnDetails(id).then(data=>{
            if(value === 'return'){
                if(data.production['productionReturns'].length > 0){
                    console.log(data.production['productionReturns'])
                    setViewIsOpen({isOpen:true, type:'Returns', productionReturn:data.production['productionReturns']})
                }else{
                    console.log('blank', data.production['productionReturns'])
                }
            }else if(value === 'retain'){
                if(data.production['productionRetains'].length > 0){
                    console.log(data.production['productionRetains'])
                    setViewIsOpen({isOpen:true, type:'Retains', productionReturn:data.production['productionRetains']})
                }else{
                    console.log('blank', data.production['productionRetains'])
                }
            }else if(value === 'wastage'){
                if(data.production['productionWastes'].length > 0){
                    console.log(data.production['productionWastes'])
                    setViewIsOpen({isOpen:true, type:'Wastes', productionReturn:data.production['productionWastes']})
                }else{
                    console.log('blank', data.production['productionWastes'])
                }
            }
        })
    }

    const viewClose = ()=>{
        setViewIsOpen({isOpen:false, productionReturn:[]})
    }

    useEffect(() => {
        if (localStorage.getItem('productionManager')){
            let data = JSON.parse(localStorage.getItem('productionManager')) 
            console.log(data)
            setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
        }
    }, [])

    useEffect(() => {
        const fetchData = () => {
            
            if (localStorage.getItem('prodDepot') === null) {
                setDepotValue('')
                setOpen(true)
            } else {
                setDepotValue(JSON.parse(localStorage.getItem('prodDepot')))
                // console.log(localStorage.getItem('prodDepot'))
                getProductionList()
            }
            socket.on('connect', ()=>{
                console.log('connection established')
            })
            socket.on('AllProduction', (arg) => {
                console.log(arg)
                getProductionList()
                const transport = socket.io.engine.transport.name; // in most cases, "polling"
                console.log("transport",transport)
                socket.io.engine.on("upgrade", () => {
                    const upgradedTransport = socket.io.engine.transport.name; // in most cases, "websocket"
                    console.log("upgradedTransport",upgradedTransport)
                })
                // console.log(tableData)
            })
            socket.on('connect_error', (err) => {
                console.log('Connection_error', err)
            })
        }
        fetchData()
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
                <h4>Production Manager</h4>
                <div className="text-right">
                    <p className="text-black bg-amber-100 p-[7px] mb-1 rounded text-base text-center">
                        <b>Batch No.</b> :{' '}
                        {localStorage.getItem('prodDepot') === null
                            ? ''
                            : JSON.parse(localStorage.getItem('prodDepot'))
                                  .value}
                        <Moment format="DDMMYYYY">{new Date()}</Moment>
                    </p>
                    <div className=" inline-flex justify-end items-center gap-5 mb-3">
                        <p className="text-black bg-slate-100 p-[7px] rounded text-sm text-center">
                            {localStorage.getItem('prodDepot') === null
                                ? ''
                                : JSON.parse(localStorage.getItem('prodDepot'))
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
                defaultValue={localStorage.getItem('productionManager') === null ? 'pending' : JSON.parse(localStorage.getItem('productionManager')).status}
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
                className="mb-2"
            >
                <TabList className="justify-end">
                    <TabNav value="waiting">
                        Waiting {`(${statusCount.waiting})`}
                    </TabNav>
                    <TabNav value="inProcess">
                        In Process {`(${statusCount.inProcess})`}
                    </TabNav>
                    <TabNav value="work_in_progress">
                        Work In Progress {`(${statusCount.workInProgress})`}
                    </TabNav>
                    <TabNav value="allocation_pending">
                        Allocation Pending {`(${statusCount.allocationPending})`}
                    </TabNav>
                    <TabNav value="transfer_pending">
                        Transfer Pending {`(${statusCount.transferPending})`}
                    </TabNav>
                    <TabNav value="pending">
                        Pending {`(${statusCount.pending})`}
                    </TabNav>
                    <TabNav value="approved">
                        Processed {`(${statusCount.approved})`}
                    </TabNav>
                </TabList>
                <div className="p-1">
                    <TabContent value="waiting"></TabContent>
                    <TabContent value="inProcess"></TabContent>
                    <TabContent value="work_in_progress"></TabContent>
                    <TabContent value="allocation_pending"></TabContent>
                    <TabContent value="transfer_pending"></TabContent>
                    <TabContent value="pending"></TabContent>
                    <TabContent value="approved"></TabContent>
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
                    ):
                        dataList && dataList.length > 0
                            ? dataList.map((product, index) => (
                                  <div
                                        // ${
                                        //   product.fifo_not_followed
                                        //       ? 'bg-rose-100'
                                        //       : 'bg-slate-100 '
                                        // }
                                      className={`card border-0 bg-slate-100 card-shadow relative`}
                                      key={index}
                                  >
                                      <div className="card-body p-0">
                                          {/* <div className=" absolute top-2 right-2 flex gap-2 justify-center items-center">
                                              {product.fifo_not_followed ? (
                                                  <Badge
                                                      content={'FIFO NOT FOLLOWED'}
                                                      innerClass="bg-rose-600"
                                                  />
                                              ) : (
                                                  ''
                                              )}
                                          </div> */}
                                          <p className=" absolute top-[10px] left-2 text-xs">
                                              {product.date_of_processing ? (
                                                  <Moment format="DD-MM-YYYY">
                                                      {product.date_of_processing}
                                                  </Moment>
                                              ) : (
                                                  ''
                                              )}
                                              {product.batch_id_as_per_fssai
                                                  ? ' | ' +
                                                    product.batch_id_as_per_fssai
                                                  : ''}
                                          </p>
                                          <h6 className=" bg-slate-50 text-center p-[5px] rounded mb-2">
                                              {product.product
                                                  ? product.product['short_name']
                                                  : 'N/A'}
                                          </h6>
                                          <div className="grid grid-cols-3 gap-3 mb-0 p-2">
                                              <p className="text-center">
                                                  <span className="font-semibold mr-1">
                                                      Quantity :&nbsp;
                                                      <span className="text-lg ">
                                                          <span className="text-rose-600">
                                                              {product.total_kg}
                                                          </span>
                                                          <span>
                                                              {' '}
                                                              / {
                                                                  product.requested_kg
                                                              }{' '}
                                                              Kg
                                                          </span>
                                                      </span>
                                                  </span>
                                              </p>
                                              <p className="text-center">
                                                  <span className="font-semibold">
                                                      Allocated Qty :&nbsp;
                                                      <span className="text-lg ">
                                                          <span className="text-rose-600">
                                                              {(Math.floor(product.transferred_kg * 100) / 100)}
                                                          </span>
                                                          &nbsp;/ {(Math.floor(product.output_kg * 100) / 100)} Kg
                                                      </span>
                                                  </span>
                                              </p>
                                              <p className="text-center">
                                                  <span className="font-semibold">
                                                      Process Loss :&nbsp;
                                                      <span className="text-lg text-rose-600">
                                                          {(Math.floor(product.process_loss * 100) / 100)}%
                                                      </span>
                                                  </span>
                                              </p>
                                          </div>
                                          <div className="grid grid-cols-3 gap-3 mb-0 p-2">
                                            <p className="text-center">
                                                <span className="font-semibold mr-1">
                                                    Return Qty :&nbsp;
                                                    <span className="text-lg text-rose-600">
                                                        {(Math.floor(product.return_kg * 100) / 100)} Kg
                                                    </span>
                                                </span>
                                                {product.return_kg >= 0  ? (
                                                    <Button
                                                        shape="circle"
                                                        variant="plain"
                                                        type="button"
                                                        size="xs"
                                                        className="mr-2"
                                                        icon={<HiEye />}
                                                        onClick={() => {
                                                            openReturn(product.id, 'return');
                                                        }}
                                                    />
                                                ) : null}
                                            </p>
                                            <p className="text-center">
                                                <span className="font-semibold mr-1">
                                                    Retain Qty :&nbsp;
                                                    <span className="text-lg text-rose-600">
                                                        {(Math.floor(product.retain_kg * 100) / 100)} Kg
                                                    </span>
                                                    {product.return_kg >= 0  ? (
                                                    <Button
                                                        shape="circle"
                                                        variant="plain"
                                                        type="button"
                                                        size="xs"
                                                        className="mr-2"
                                                        icon={<HiEye />}
                                                        onClick={() => {
                                                            openReturn(product.id, 'retain');
                                                        }}
                                                    />
                                                ) : null}
                                                </span>
                                            </p>
                                            <p className="text-center">
                                                <span className="font-semibold mr-1">
                                                    Wastage :&nbsp;
                                                    <span className="text-lg text-rose-600">
                                                        {product.total_kg > 0 ? (Math.round((product.waste_kg / product.total_kg) * 100 ) * 100) / 100 : '0'} % ({(Math.floor(product.waste_kg * 100) / 100)} Kg)
                                                    </span>
                                                    {product.return_kg >= 0  ? (
                                                        <Button
                                                            shape="circle"
                                                            variant="plain"
                                                            type="button"
                                                            size="xs"
                                                            className="mr-2"
                                                            icon={<HiEye />}
                                                            onClick={() => {
                                                                openReturn(product.id, 'wastage');
                                                            }}
                                                        />
                                                        ) : null}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 p-2">
                                            <div>
                                                {
                                                    tableData.status !== 'waiting' ? (
                                                        <Button
                                                            block
                                                            size="lg"
                                                            className="h-4"
                                                            type="button"
                                                            onClick={() => { navigate(`/production/production-manager/view-allocation/${product.id}`) }}
                                                        >
                                                            Allocate Qty
                                                        </Button>
                                                    ) : null
                                                }
                                            </div>
                                            <div>
                                                {
                                                    tableData.status === 'waiting' ? (
                                                        <Button
                                                            block
                                                            size="lg"
                                                            className="h-4"
                                                            type="button"
                                                            onClick={() => {
                                                                navigate(
                                                                    `/production/production-floor-manager/approve-batch/${product.id}`
                                                                )
                                                            }}
                                                        >
                                                           Check Batch Qty
                                                        </Button>
                                                    ):(
                                                        <Button
                                                            block
                                                            size="lg"
                                                            variant="solid"
                                                            color="rose-600"
                                                            className="h-4"
                                                            disabled={
                                                                tableData.status !== 'pending'
                                                            }
                                                            onClick={() => {
                                                                setConfirmIsOpen({
                                                                    isOpen: true,
                                                                    approved: false,
                                                                    id: product.id,
                                                                })
                                                            }}
                                                        >
                                                            Reject
                                                        </Button>
                                                    )
                                                }
                                            </div>
                                            <div>
                                                {
                                                    tableData.status !== 'waiting' ? (
                                                        <Button
                                                            block
                                                            size="lg"
                                                            className="h-4"
                                                            variant="solid"
                                                            color="emerald-600"
                                                            disabled={
                                                                tableData.status !== 'pending'
                                                            }
                                                            onClick={() => {
                                                                setConfirmIsOpen({
                                                                    isOpen: true,
                                                                    approved: true,
                                                                    id: product.id,
                                                                })
                                                            }}
                                                        >
                                                            Approve
                                                        </Button>
                                                    ) : null
                                                }
                                            </div>
                                          </div>
                                      </div>
                                  </div>
                              ))
                            : `No Product ${
                                  tableData.status === 'inProcess' ? 'In Process.' : tableData.status === 'pending' ? 'In Pending.': tableData.status === 'transfer_pending' ? 'In Transfer Pending.' : tableData.status === 'waiting' ? 'In waiting.' : tableData.status === 'allocation_pending' ? 'In allocation pending.' : 'In Processed.'
                              }`
                }
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
                            defaultValue={tableData.pageSize}
                            options={paginationOptions}
                            onChange={(selected) => onPageSelect(selected)}
                        />
                    </div>
                </div>
                {/* <div className="card bg-slate-100 border-0 card-shadow relative">
                    <div className="card-body p-0">
                        <Badge
                            className=" absolute top-2 right-2"
                            content={'In Process'}
                            innerClass="bg-emerald-500"
                        />
                        <p className=" absolute top-[10px] left-2 text-xs">
                            12-12-2012 | M100520245263
                        </p>
                        <h6 className=" bg-slate-50 text-center p-[5px] rounded mb-2">
                            Watermelon Oats
                        </h6>
                        <div className="grid grid-cols-3 gap-3 mb-0 p-2 text-gray-900">
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
                            <p className="text-center">
                                <span className="font-semibold">
                                    Allocated Qty :&nbsp;
                                    <span className="text-lg ">1000 Kg</span>
                                </span>
                            </p>
                            <p className="text-center">
                                <span className="font-semibold">
                                    Process Loss :&nbsp;
                                    <span className="text-lg text-rose-600">
                                        20%
                                    </span>
                                </span>
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 p-2">
                            <Button size="lg" className="h-4">
                                Allocate Qty
                            </Button>
                            <Button
                                size="lg"
                                variant="solid"
                                color="rose-600"
                                className="h-4"
                            >
                                Reject
                            </Button>
                            <Button
                                size="lg"
                                className="h-4"
                                variant="solid"
                                color="emerald-600"
                            >
                                Approve
                            </Button>
                        </div>
                    </div>
                </div> */}
                {/* <div className="card bg-rose-100 border-0 card-shadow relative">
                    <div className="card-body p-0">
                        <div className=" absolute top-2 right-2 flex gap-2 justify-center items-center">
                            <Badge
                                content={'FIFO Not Followed'}
                                innerClass="bg-rose-500"
                            />
                        </div>
                        <p className=" absolute top-[10px] left-2 text-xs">
                            12-12-2012 | M100520245263
                        </p>
                        <h6 className=" bg-rose-50 text-center p-[5px] rounded mb-2">
                            Watermelon Oats
                        </h6>
                        <div className="grid grid-cols-3 gap-3 mb-0 p-2 text-gray-900">
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
                            <p className="text-center">
                                <span className="font-semibold">
                                    Allocated Qty :&nbsp;
                                    <span className="text-lg ">1000 Kg</span>
                                </span>
                            </p>
                            <p className="text-center">
                                <span className="font-semibold">
                                    Process Loss :&nbsp;
                                    <span className="text-lg text-rose-600">
                                        20%
                                    </span>
                                </span>
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 p-2">
                            <Button size="lg" className="h-4">
                                Allocate Qty
                            </Button>
                            <Button
                                size="lg"
                                variant="solid"
                                color="rose-600"
                                className="h-4"
                            >
                                Reject
                            </Button>
                            <Button
                                size="lg"
                                className="h-4"
                                variant="solid"
                                color="emerald-600"
                            >
                                Approve
                            </Button>
                        </div>
                    </div>
                </div> */}
            </div>
            <Dialog isOpen={open} closable={false} height={400}>
                <div className="flex flex-col items-center justify-between gap-2 h-full">
                    <h5 className="mb-4 text-center">
                        Select Production Depot
                    </h5>
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
                            Back
                        </Button>
                        <Button variant="solid" onClick={handleConfirm}>
                            Save
                        </Button>
                    </div>
                </div>
            </Dialog>
            <Dialog
                isOpen={confirmIsOpen.isOpen}
                onClose={confirmClose}
                onRequestClose={confirmClose}
            >
                <h5 className="mb-4">Confirmation!!</h5>
                <p>
                    Are you sure want to{' '}
                    {confirmIsOpen.approved ? 'approve' : 'reject'} ??
                </p>
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
                        onClick={() => confirmSubmit()}
                        size="lg"
                        type="button"
                    >
                        Yes
                    </Button>
                </div>
            </Dialog>
            <Dialog
                isOpen={viewIsOpen.isOpen}
                onClose={viewClose}
                onRequestClose={viewClose}
            >
                <h5 className="mb-4">{viewIsOpen.type} Quantity</h5>
                <div className='grid grid-cols-[1fr_50px_160px_85px] gap-[10px] mb-2 font-bold'>
                    <p>Name</p>
                    <p>Qty</p>
                    <p>Barcode</p>
                    <p>Expiry Date</p>
                </div>
                {
                    viewIsOpen.productionReturn.map((data, index)=>(
                        <div key={index} className=' grid grid-cols-[1fr_50px_160px_85px] gap-[10px] mb-1'>
                            <p>{data.rawMaterial ? data.rawMaterial['rm_name'] : ''}</p>
                            <p>{data.qty}</p>
                            <p>{data.barcode}</p>
                            <p><Moment format="DD-MM-YYYY">{data.expiry_date}</Moment></p>
                        </div>
                    ))
                }
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="plain"
                        type="button"
                        onClick={viewClose}
                        size="lg"
                    >
                        Close
                    </Button>
                </div>
            </Dialog>
        </Card>
    )
}

export default ProductionManager
