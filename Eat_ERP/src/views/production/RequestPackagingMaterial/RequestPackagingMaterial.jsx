import React, { useEffect, useRef, useState } from 'react'
import { Card, Tooltip } from 'components/ui'
import Select from 'components/ui/Select'
import Button from 'components/ui/Buttons'
import Badge from 'components/ui/Badge'
import { MdEdit, } from 'react-icons/md'
import Dialog from 'components/ui/Dialog'
import Moment from 'react-moment'
import Tabs from 'components/ui/Tabs'
import Radio from 'components/ui/Radio'
import {
    apiGetAllPackaging,
    apiGetDepot,
    apiGetMasterData,
    apiGetPackaging,
    apiGetProductionStock,
    apiGetProductionStockEdit,
    apiGetReturnStore,
    apiPackaging,
    apiPackagingDelete,
    apiPackagingEdit,
    apiPackagingGetMasterData,
    apiProduction,
    apiProductionDelete,
    apiProductionEdit,
    apiProductionSubmit,
    apiPutPackagingReturn,
} from 'services/ProductionService'
import Input from 'components/ui/Input'
import { FormItem, FormContainer } from 'components/ui'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import Checkbox from 'components/ui/Checkbox'
import * as Yup from 'yup'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import Pagination from 'components/ui/Pagination'
import { useNavigate } from 'react-router-dom'
import { HiEye, HiOutlineTrash } from 'react-icons/hi'
import { socket } from 'socket'
import Skeleton from 'components/ui/Skeleton'
import { HiSearch } from 'react-icons/hi'
import { debounce } from 'lodash'
import { FaPlus, FaTrash } from 'react-icons/fa'
// import KeepInProduction from './KeepInProduction'

const { TabNav, TabList, TabContent } = Tabs

const paginationOptions = [
    { value: 5, label: '5' },
    { value: 10, label: '10' },
    { value: 25, label: '25' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
]

const validationSchema = Yup.object().shape({
    depot_id: Yup.string().required('Depot Is Required'),
    itemRequests: Yup.array().of(
        Yup.object().shape({
            raw_material_id: Yup.number().required(' '),
            requested_kg: Yup.number().required(' ').moreThan(0, ' ').typeError(' '),
        })
    ),
})

const fieldFeedback = (form, name) => {
    const error = getIn(form.errors, name)
    const touch = getIn(form.touched, name)
    return {
        errorMessage: error || '',
        invalid: typeof touch === 'undefined' ? false : error && touch,
    }
}

const RequestPackagingMaterial = () => {
    const formRef = useRef()
    const [value, setValue] = useState(
        // {
        //     production_day:'Today',
        //     depot_id: '',
        //     product_id: '',
        //     requested_kg: '',
        //     use_production_stock: false,
        //     no_of_batch: '',
        //     request_unit: 'Kg',
        //     p_type: 'Essentials'
        // }
        {
            production_day: "Today",
            manufacturer_id: '',
            depot_id: '',
            itemRequests: [
                {
                    raw_material_id: '',
                    requested_kg: ''
                },
            ]
        }
    )

    const navigate = useNavigate()

    const [isEdit, setIsEdit] = useState(false)
    const [productId, setProductId] = useState('')
    const [options, setOptions] = useState([])
    const [depotValue, setDepotValue] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingCard, setLoadingCard] = useState(false)
    const [open, setOpen] = useState(false)
    const [dialogIsOpen, setDialogIsOpen] = useState(false)

    const [confirmIsOpen, setConfirmIsOpen] = useState({isOpen:false, id:''})

    const [deleteIsOpen, setDeleteIsOpen] = useState({
        isOpen: false,
        id: '',
    })

    const [masterData, setMasterData] = useState({
        depots: [],
        packagingMaterials: [],
    })

    const [statusCount, setStatusCount] = useState({
        inProcess: 0,
        approved:0
    })

    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 5,
        query: '',
        status: 'inProcess',
    })

    const [dataList, setDataList] = useState([])

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

    const handleClose = () => {
        console.log('Close')
        setDepotValue(JSON.parse(localStorage.getItem('batchDepot')))
        setOpen(false)
    }

    const handleConfirm = () => {
        console.log('Confirm')
        localStorage.setItem('batchDepot', JSON.stringify(depotValue))
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

    const onDialogClose = (e) => {
        // console.log('onDialogClose', e)
        setValue({
            production_day: "Today",
            manufacturer_id: '',
            depot_id: '',
            itemRequests: [
                {
                    raw_material_id: '',
                    requested_kg: ''
                },
            ]
        })
        setDialogIsOpen(false)
    }

    const confirmClose = () => {
        setConfirmIsOpen({isOpen:false, id:''})
    }


    const getProductionList = () => {
        setLoadingCard(true)
        apiGetAllPackaging(
            JSON.parse(localStorage.getItem('batchDepot')).id,
            tableData
        ).then((data) => {
            // console.log(data)
            setStatusCount({
                inProcess: data.statusCount['inProcess'],
                approved: data.statusCount['approved']
            })
            setTableData((prevData) => ({
                ...prevData,
                total: data.total,
            }))
            setDataList(data.rows)
            setLoadingCard(false)
        })
    }

    const formSubmit = (values, { resetForm, setSubmitting }) => {
        
        // console.log(Object.assign(values, obj))
        // console.log(isEdit)
        if (isEdit) {
            apiPackagingEdit(values, productId).then(
                (data) => {
                    // console.log(data)
                    if (data.status === 200 || data.status === 201) {
                        toast.push(
                            <Notification
                                title="Success"
                                type="success"
                                closable
                            >
                                {data.data['message']}
                            </Notification>
                        )
                        setValue({
                            production_day: "Today",
                            manufacturer_id: '',
                            depot_id: '',
                            itemRequests: [
                                {
                                    raw_material_id: '',
                                    requested_kg: ''
                                },
                            ]
                        })
                        setSubmitting(false)
                        setDialogIsOpen(false)
                        getProductionList()
                        socket.emit('AllProduction', 'Saurabh')
                    }
                }
            )
        } else {
            apiPackaging(values).then((data) => {
                // console.log(data)
                if (data.status === 200 || data.status === 201) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    setValue({
                        production_day: "Today",
                        manufacturer_id: '',
                        depot_id: '',
                        itemRequests: [
                            {
                                raw_material_id: '',
                                requested_kg: ''
                            },
                        ]
                    })
                    setSubmitting(false)
                    setDialogIsOpen(false)
                    getProductionList()
                    socket.emit('AllProduction', 'Saurabh')
                }
            })
        }
    }



    const confirmReturn = () => {
        apiPutPackagingReturn(
            {
                return_raw_material: 1,
            },
            confirmIsOpen.id
        ).then((data) => {
            // console.log(data)
            if (data.status === 200) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                setConfirmIsOpen({isOpen:false, id:''})
                getProductionList()
                socket.emit('AllProduction', 'Saurabh')
            } else {
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        Something Went Wrong!!
                    </Notification>
                )
            }
        })
    }

    // const confirmSubmit = (id) => {
    //     if (submitIsOpen.id !== '') {
    //         apiProductionSubmit(id)
    //             .then((data) => {
    //                 if (data.status === 200) {
    //                     toast.push(
    //                         <Notification
    //                             title="Success"
    //                             type="success"
    //                             closable
    //                         >
    //                             {data.data['message']}
    //                         </Notification>
    //                     )
    //                     getProductionList()
    //                     socket.emit('AllProduction', 'Saurabh')
    //                 } else {
    //                     toast.push(
    //                         <Notification
    //                             title="Success"
    //                             type="success"
    //                             closable
    //                         >
    //                             {data.data['message']}
    //                         </Notification>
    //                     )
    //                 }
    //                 setSubmitIsOpen({ isOpen: false, id: '' })
    //             })
    //             .catch((error) => {
    //                 console.log(error.response['data'])
    //                 toast.push(
    //                     <Notification title="Error" type="danger" closable>
    //                         Something Went Wrong.
    //                     </Notification>
    //                 )
    //             })
    //     }
    // }

    const deleteClose = () => {
        setDeleteIsOpen({
            isOpen: false,
            id: '',
        })
    }

    const deleteSubmit = (id) => {
        if (deleteIsOpen.id !== '') {
            apiPackagingDelete(id)
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
                    setDeleteIsOpen({ isOpen: false, id: '' })
                })
                .catch((error) => {
                    console.log(error.response['data'])
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            Something Went Wrong.
                        </Notification>
                    )
                })
        }
    }
    
    useEffect(() => {
        if (localStorage.getItem('requestPackage')){
            let data = JSON.parse(localStorage.getItem('requestPackage')) 
            // console.log(data.status)
            setTableData(prev=>({...prev, pageSize:data.pageSize, pageIndex:data.pageIndex, status:data.status}))
        }
        apiPackagingGetMasterData().then((data) => {
            // console.log(data)
            setMasterData({
                packagingMaterials: data['masterData'].packagingMaterials.map((value) => {
                    return {
                        value: value.id,
                        label: value.rm_name,
                    }
                }),
                depots: data['masterData'].depots.map((value) => {
                    return {
                        value: value.id,
                        label: value.depot_name,
                        depot_code: value.depot_code,
                    }
                }),
            })
        })
    }, [])

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            pageIndex:1,
            status: tab,
        }))
        localStorage.setItem('requestPackage', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:1, status: tab }))
        // getProductionList()
    }

    const onPageSelect = ({ value }) => {
        setTableData((prevData) => ({
            ...prevData,
            pageSize: value,
        }))
        localStorage.setItem('requestPackage', JSON.stringify({ pageSize:value, pageIndex:tableData.pageIndex, status: tableData.status }))
    }

    const onPaginationChange = (page) => {
        setTableData((prevData) => ({
            ...prevData,
            pageIndex: page,
        }))
        localStorage.setItem('requestPackage', JSON.stringify({ pageSize:tableData.pageSize, pageIndex:page, status: tableData.status }))
    }

    useEffect(() => {
        const fetchData = () =>{
            if (localStorage.getItem('batchDepot') === null) {
                setDepotValue('')
                setOpen(true)
            } else {
                setDepotValue(JSON.parse(localStorage.getItem('batchDepot')))
                getProductionList()
            }
            socket.on('connect', ()=>{
                console.log('connection established')
            })
            socket.on('AllProduction', (arg) => {
                console.log(arg)
                const transport = socket.io.engine.transport.name; // in most cases, "polling"
                console.log("transport",transport)
                socket.io.engine.on("upgrade", () => {
                    const upgradedTransport = socket.io.engine.transport.name; // in most cases, "websocket"
                    console.log("upgradedTransport",upgradedTransport)
                })
                console.log(tableData)
                getProductionList()
            })
            socket.on('connect_error', (err) => {
                console.log('Connection_error', err)
            })
            return () => {
                console.log("Connection Disconnected")
                socket.off('connect')
                socket.off('AllProduction')
            }
        }
        fetchData();
    }, [tableData.status, tableData.pageIndex, tableData.pageSize, tableData.query])

    return (
        <Card className=" card-shadow mb-4">
            <div className="flex justify-between items-center mb-8">
                <div className=" inline-flex justify-start items-center gap-5">
                    <div>
                        <h4 className="mb-4">Request Packaging Material</h4>
                        <div>
                            <Button
                                size="lg"
                                variant="solid"
                                className="h-20 mr-2"
                                color="amber-600"
                                type="button"
                                onClick={() => {
                                    setIsEdit(false)
                                    setDialogIsOpen(true)
                                    // setValue(prev=>({...prev,...{no_of_batch:1}}))
                                }}
                            >
                                Request
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-black bg-amber-100 p-[7px] mb-1 rounded text-base text-center">
                        <b>Batch No.</b> :{' '}
                        {localStorage.getItem('batchDepot') === null
                            ? ''
                            : JSON.parse(localStorage.getItem('batchDepot')).value}
                        <Moment format="DDMMYYYY">{new Date()}</Moment>
                    </p>
                    <div className=" inline-flex justify-end items-center gap-5 mb-3">
                        <p className="text-black bg-slate-100 p-[7px] rounded text-sm text-center">
                            {localStorage.getItem('batchDepot') === null
                                ? ''
                                : JSON.parse(localStorage.getItem('batchDepot')).label}
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
                            type="button"
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
                defaultValue={localStorage.getItem('requestPackage') === null ? "inProcess" : JSON.parse(localStorage.getItem('requestPackage')).status}
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
                className="mb-2"
            >
                <TabList className="justify-end">
                    <TabNav value="inProcess">
                        In Process {`(${statusCount.inProcess})`}
                    </TabNav>
                    <TabNav value="approved">
                        Processed {`(${statusCount.approved})`}
                    </TabNav>
                </TabList>
                <div className="p-1">
                    <TabContent value="inProcess"></TabContent>
                    <TabContent value="approved"></TabContent>
                </div>
            </Tabs>
            <div className="grid grid-cols-1 lg:grid-cols-1 2xl:grid-cols-1 gap-6 mb-4">
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
                            className={`card ${
                                product.fifo_not_followed
                                    ? 'bg-rose-100'
                                    : 'bg-slate-100 '
                            }  border-0 card-shadow relative`}
                            key={index}
                        >
                            <div className="card-body p-0">
                                <div className=" absolute top-2 right-2 flex gap-2 justify-center items-center">
                                    {product.fifo_not_followed ? (
                                        <Badge
                                            content={'FIFO NOT FOLLOWED'}
                                            innerClass="bg-rose-600"
                                        />
                                    ) : (
                                        ''
                                    )}
                                    {
                                    product.total_kg > 0 ||  product.output_kg > 0 || product.return_kg > 0 || product.retain_kg > 0 || product.waste_kg > 0? null : (
                                        <Button
                                                shape="circle"
                                                variant="solid"
                                                color="rose-600"
                                                icon={<HiOutlineTrash />}
                                                onClick={()=>{ setDeleteIsOpen({isOpen:true, id:product.id})}}
                                            />
                                    )
                                    }
                                </div>
                                <p className=" absolute top-[10px] left-2 text-xs">
                                    {product.date_of_processing ? (
                                        <Moment format="DD-MM-YYYY">
                                            {product.date_of_processing}
                                        </Moment>
                                    ) : (
                                        ''
                                    )}
                                </p>
                                <h6 className=" bg-slate-50 text-center p-[5px] rounded mb-2">
                                    {product.id
                                        ? "Packaging-"+product.id
                                        : 'N/A'}
                                </h6>
                                <div className="grid grid-cols-3 gap-3 mb-0 p-2">
                                    <p className="text-center">
                                        <span className="font-semibold mr-1">
                                            Received Qty :&nbsp;
                                            <span className="text-lg ">
                                                <span className="text-rose-600">
                                                    {(Math.floor(product.total_kg * 100)) / 100}
                                                </span>
                                                <span>
                                                    {' '}
                                                    / {
                                                        (Math.floor(product.requested_kg * 100)) / 100
                                                    }
                                                </span>
                                            </span>
                                        </span>
                                        {product.store_kg > 0 || product.output_kg > 0 ? null : (
                                        <Tooltip title="Edit">
                                            <Button
                                                shape="circle"
                                                variant="plain"
                                                type="button"
                                                size="xs"
                                                className="mr-2"
                                                icon={<MdEdit />}
                                                onClick={() => {
                                                    apiGetPackaging(product.id).then(data=>{
                                                        console.log(data);
                                                        setValue(
                                                        {
                                                            production_day: product.production_day,
                                                            manufacturer_id: product.manufacturer_id,
                                                            depot_id: product.depot_id,
                                                            itemRequests: data.itemRequests ? data.itemRequests : []
                                                        })
                                                        setIsEdit(true)
                                                        setProductId(product.id)
                                                        setDialogIsOpen(true)
                                                    }).catch(err=>{
                                                        console.log(err)
                                                        toast.push(
                                                            <Notification title="Error" type="danger" closable>
                                                                Something Went Wrong!!
                                                            </Notification>
                                                        )
                                                    })
                                                }}
                                            />
                                        </Tooltip>
                                        )}
                                        {product.p_type === 'Other' && product.check_batch_qty === 0  ? (
                                        <Tooltip title="View">
                                            <Button
                                                shape="circle"
                                                variant="plain"
                                                type="button"
                                                size="xs"
                                                className="mr-2"
                                                icon={<HiEye />}
                                                onClick={() => {
                                                    navigate(
                                                        `/production/production-floor-manager/check-batch/${product.id}`
                                                    )
                                                }}
                                            />
                                        </Tooltip>
                                        ) : null}
                                    </p>
                                    <p className="text-center">
                                        {/* <span className="font-semibold">
                                            Allocated Qty :&nbsp;
                                            <span className="text-lg ">
                                                <span className="text-rose-600">
                                                    {(Math.floor(product.transferred_kg * 100) / 100)}
                                                </span>
                                                &nbsp;/ {(Math.floor(product.output_kg * 100) / 100)} Kg
                                            </span>
                                        </span> */}
                                    </p>
                                    <p className="text-center">
                                        <span className="font-semibold mr-1">
                                            Return Qty :&nbsp;
                                            <span className="text-lg text-rose-600">
                                                {(Math.floor(product.return_kg * 100) / 100)}
                                            </span>
                                        </span>
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 gap-3 p-2">
                                    <div>
                                        {/* {
                                            product.check_batch_qty === 1  ? (
                                            <Button
                                            size="lg"
                                            className="h-4"
                                            type="button"
                                            onClick={() => {
                                                navigate(
                                                    `/production/production-floor-manager/check-batch/${product.id}`
                                                )
                                            }}
                                            >
                                                Check Batch Qty
                                            </Button>
                                                ):(
                                                    <Button
                                                size="lg"
                                                className="h-4"
                                                type="button"
                                                onClick={() => {
                                                    navigate(
                                                        `/production/production-floor-manager/add-batch/${product.id}`
                                                    )
                                                }}
                                            >
                                                Allocate Qty
                                            </Button>
                                            )
                                        } */}
                                    </div>
                                    <Button
                                        size="lg"
                                        className="h-4"
                                        type="button"
                                        onClick={() => {
                                            setConfirmIsOpen({
                                                isOpen: true,
                                                id: product.id
                                            })
                                        }}
                                        disabled={ product.total_kg <= 0 ? true : false }
                                    >
                                        Return
                                    </Button>
                                    <div>
                                        {/* {
                                            tableData.status == 'inProcess' || tableData.status == 'allocation_pending' ? (
                                                <Button
                                                    size="lg"
                                                    variant="solid"
                                                    color="amber-600"
                                                    type="button"
                                                    className="h-4 w-full"
                                                    disabled={ product.output_kg > 0 || ((Math.round((product.retain_kg + product.return_kg + product.waste_kg) * 10000) / 10000) == product.total_kg && product.total_kg > 0) || product.status == 'Pending' ? false : true }
                                                    onClick={() => {
                                                        setSubmitIsOpen({
                                                            isOpen: true,
                                                            id: product.id,
                                                        })
                                                    }}
                                                >
                                                    Submit For Approval
                                                </Button>
                                            ) : null
                                        } */}
                                    </div>
                                  </div>
                              </div>
                          </div>
                      ))
                    : `No Request Packaging Material ${
                          tableData.status === 'approved' ? 'Is In Processed.' : 'Is In Process.'
                      }`
                }
                <div className="flex items-center justify-center">
                    <Pagination
                        displayTotal
                        // currentPage={tableData.pageSize}
                        pageSize={tableData.pageSize}
                        total={tableData.total}
                        onChange={(page)=>onPaginationChange(page)}
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
            </div>
            {/* Dialog to choose depot */}
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
                                setDepotValue(e)
                            }}
                        />
                    </div>
                    <div className="text-right mt-6 w-full">
                        <Button
                            className="ltr:mr-2 rtl:ml-2"
                            variant="plain"
                            type="button"
                            onClick={handleClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            type="button"
                            onClick={handleConfirm}
                        >
                            Save
                        </Button>
                    </div>
                </div>
            </Dialog>

            {/* Dialog to add production */}
            <Dialog
                isOpen={dialogIsOpen}
                shouldCloseOnOverlayClick={false}
                shouldCloseOnEsc={false}
                onClose={onDialogClose}
                onRequestClose={onDialogClose}
            >
                <div className="flex flex-col items-center justify-between gap-2 h-full">
                    <h3 className="mb-4 text-center">Request Packaging Material </h3>
                    <Formik
                        enableReinitialize={true}
                        initialValues={value}
                        innerRef={formRef}
                        validationSchema={validationSchema}
                        onSubmit={(values, { resetForm, setSubmitting }) => {
                            // let a = Object.assign(values, {manufacturer_id:JSON.parse(localStorage.getItem('batchDepot')).id})
                            // console.log(values)
                            let obj = {
                                manufacturer_id: JSON.parse(localStorage.getItem('batchDepot')).id,
                            }
                            formSubmit(Object.assign(values, obj), { resetForm, setSubmitting })
                        }}
                    >
                        {({
                            values,
                            touched,
                            errors,
                            resetForm,
                            isSubmitting,
                        }) => {
                            const itemRequests = values.itemRequests;
                            return (
                                <Form
                                    autoComplete="off"
                                    autoSave="off"
                                    className="w-full"
                                >
                                    <FormContainer layout="vertical" size="lg">
                                        <FormItem
                                            asterisk
                                            label="Production Day"
                                            invalid={errors.production_day && touched.production_day}
                                            errorMessage={errors.production_day}
                                        >
                                            <Field name="production_day">
                                                {({ field, form }) => (
                                                    <Radio.Group
                                                        value={values.production_day}
                                                        onChange={(val) =>{
                                                            // checkUnits(val)
                                                            form.setFieldValue(
                                                                field.name,
                                                                val
                                                            )}
                                                        }
                                                    >
                                                        <Radio value={'Today'} defaultChecked>Today</Radio>
                                                        <Radio value={'Tomorrow'}>Tomorrow</Radio>
                                                        <Radio value={'DayAfterTomorrow'}>Day After Tomorrow</Radio>
                                                    </Radio.Group>
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            invalid={
                                                errors.depot_id &&
                                                touched.depot_id
                                            }
                                            errorMessage={errors.depot_id}
                                        >
                                            <Field name="depot_id">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={
                                                            masterData.depots
                                                        }
                                                        // onFocus={onFocus}
                                                        isLoading={loading}
                                                        value={masterData.depots.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.depot_id
                                                        )}
                                                        onChange={(option) => {
                                                            return form.setFieldValue(
                                                                field.name,
                                                                option?.value
                                                            )
                                                        }}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <div>
                                            <FieldArray name="itemRequests">
                                                {({ form, remove, push }) => (
                                                    <>
                                                        <div className='overflow-y-auto h-[210px]'>
                                                            {
                                                                itemRequests && itemRequests.length > 0 ? (itemRequests.map(
                                                                    (_, index) => {
                                                                        const raw_material_id = fieldFeedback(form, `itemRequests[${index}].raw_material_id`);
                                                                        const requested_kg = fieldFeedback(form, `itemRequests[${index}].requested_kg`);

                                                                        // console.log(masterOption);

                                                                        return (
                                                                            <div key={index} className="flex items-center justify-between gap-1 rounded mb-3 mt-1">
                                                                                <FormItem
                                                                                    className="mb-0 custom-text-left w-[300px]"
                                                                                    invalid={raw_material_id.invalid}
                                                                                    errorMessage={raw_material_id.errorMessage}
                                                                                >
                                                                                    <Field name={`itemRequests[${index}].raw_material_id`}>
                                                                                        {({ field, form, }) => (
                                                                                            <Select
                                                                                                className="custom-text-left text-left"
                                                                                                placeholder="Select Packaging Material"
                                                                                                field={field}
                                                                                                form={form}
                                                                                                options={masterData.packagingMaterials ? masterData.packagingMaterials : []}
                                                                                                value={masterData.packagingMaterials ? masterData.packagingMaterials.filter((option) =>option.value === values.itemRequests[index].raw_material_id): values.itemRequests[index].raw_material_id}
                                                                                                onChange={(option) => form.setFieldValue(field.name, option?.value)}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                </FormItem>
                                                                                <FormItem invalid={requested_kg.invalid} errorMessage={requested_kg.errorMessage} className={'mb-0 w-[100px]'}>
                                                                                    <Field invalid={requested_kg.invalid} suffix={'No.'} name={`itemRequests[${index}].requested_kg`} type="number" component={Input} />
                                                                                </FormItem>
                                                                                <Button shape="circle" size="sm" variant="solid" color="rose-500" icon={<FaTrash />} type="button" onClick={() => remove(index)} className="mr-[5px]" disabled={index == 0} />
                                                                            </div>
                                                                        )
                                                                    }
                                                                )
                                                            ) : (
                                                                null
                                                                // <h5 className="text-center mb-5">No Data Found!!</h5>
                                                            )}
                                                        </div>
                                                        <div className="text-left mt-5 mb-0">
                                                            <Button variant="solid" shape="circle" size="md" type="button" icon={<FaPlus />} onClick={() => {
                                                                // console.log('Adding tab')
                                                                push({
                                                                    raw_material_id:'',
                                                                    requested_kg: '',
                                                                })
                                                            }}
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </FieldArray>
                                        </div>

                                        <div className="text-right">
                                            <Button
                                                className="ltr:mr-2 rtl:ml-2"
                                                onClick={onDialogClose}
                                                type="button"
                                            >
                                                Back
                                            </Button>
                                            <Button
                                                variant="solid"
                                                type="submit"
                                                disabled={isSubmitting}
                                            >
                                                Request
                                            </Button>
                                        </div>
                                    </FormContainer>
                                </Form>
                            )
                        }}
                    </Formik>
                </div>
            </Dialog>

            <Dialog
                isOpen={confirmIsOpen.isOpen}
                onClose={confirmClose}
                onRequestClose={confirmClose}
            >
                <h5 className="mb-4">Confirmation!!</h5>
                <p>Are you sure want to return to store ??</p>
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="plain"
                        type="button"
                        onClick={confirmClose}
                        size="lg"
                    >
                        No
                    </Button>
                    <Button
                        variant="solid"
                        color="emerald-600"
                        type="button"
                        onClick={confirmReturn}
                        size="lg"
                    >
                        Yes
                    </Button>
                </div>
            </Dialog>

            <Dialog
                isOpen={deleteIsOpen.isOpen}
                onClose={deleteClose}
                onRequestClose={deleteClose}
            >
                <h5 className="mb-4">Confirmation!!</h5>
                <p>Are you sure want to delete production ??</p>
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="plain"
                        onClick={deleteClose}
                        size="lg"
                        type="button"
                    >
                        No
                    </Button>
                    <Button
                        variant="solid"
                        color="emerald-600"
                        onClick={() => deleteSubmit(deleteIsOpen.id)}
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

export default RequestPackagingMaterial