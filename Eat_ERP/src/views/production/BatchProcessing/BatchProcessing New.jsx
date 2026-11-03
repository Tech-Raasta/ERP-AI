import React, { useEffect, useRef, useState } from 'react'
import { Card } from 'components/ui'
import Select from 'components/ui/Select'
import Button from 'components/ui/Buttons'
import Badge from 'components/ui/Badge'
import { MdEdit, } from 'react-icons/md'
import Dialog from 'components/ui/Dialog'
import Moment from 'react-moment'
import Tabs from 'components/ui/Tabs'
import Radio from 'components/ui/Radio'
import {
    apiGetAllProduction,
    apiGetBarcodeStock,
    apiGetDepot,
    apiGetMasterData,
    apiGetProductionStock,
    apiGetProductionStockEdit,
    apiGetReturnStore,
    apiProduction,
    apiProductionDelete,
    apiProductionEdit,
    apiProductionSubmit,
    apiPutProductionRetain,
    apiPutProductionReturn,
    apiPutProductionWastage,
    apiStoreManagerBarcodeStockReturn,
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
import Scanner from '../StoreManager/Scanner'
import { HiOutlineCamera, HiOutlineEye, HiEye, HiOutlineTrash } from 'react-icons/hi'
import { socket } from 'socket'
import Skeleton from 'components/ui/Skeleton'
import { FaTrash } from 'react-icons/fa'
import { HiSearch } from 'react-icons/hi'
import { debounce } from 'lodash'
import KeepInProduction from './KeepInProduction'

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
    product_id: Yup.string().required('Product Is Required'),
    requested_kg: Yup.number().required('Requested Kg Is Required').moreThan(0, 'Requested Kg Is Required'),
    no_of_batch: Yup.number().test((value, context) => {
        const { path } = context
        console.log(context.parent)
        if (context.parent.p_type === "Essentials") {
            return true
        } else {
            if (
                context.parent.no_of_batch == '' ||
                context.parent.no_of_batch == undefined ||
                context.parent.no_of_batch == null || 
                context.parent.no_of_batch <= 0 
            ) {
                return context.createError({ path, message: 'No. Of Batch Is Required' })
            } else {
                return true
            }
        }
    })
    // no_of_batch: Yup.number().required('No. Of Batch Is Required').moreThan(0, 'No. Of Batch Is Required'),
    
})

const validationSchemaNew = Yup.object({
    storeRawMaterials: Yup.array().of(
        Yup.object().shape({
            qty: Yup.number().required('Qty required').moreThan(0, 'Qty Required'),
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

const BatchProcessing = () => {
    const formRef = useRef()
    const formRefNew = useRef()
    const inputRef = useRef(null)
    const [value, setValue] = useState({
        depot_id: '',
        product_id: '',
        requested_kg: '',
        use_production_stock: false,
        no_of_batch: '',
        request_unit: 'Kg',
        p_type: 'Essentials'
    })

    const navigate = useNavigate()

    const [isEdit, setIsEdit] = useState(false)
    const [productId, setProductId] = useState('')
    const [options, setOptions] = useState([])
    const [depotValue, setDepotValue] = useState('')
    const [stockValue, setStockValue] = useState(0)
    const [loading, setLoading] = useState(false)
    const [loadingCard, setLoadingCard] = useState(false)
    const [open, setOpen] = useState(false)
    const [dialogIsOpen, setDialogIsOpen] = useState({isOpen:false, p_type:"Essentials"})
    const [returnIsOpen, setReturnIsOpen] = useState({
        isOpen: false,
        id: '',
        isReturned: 0,
        isInProduction: 0,
    })
    const [keepIsOpen, setKeepIsOpen] = useState({
        isOpen: false,
        id:'',
        wastage: false,
    })

    const [storeMaterials, setStoreMaterials] = useState([])

    const [confirmIsOpen, setConfirmIsOpen] = useState(false)
    const [confirm2IsOpen, setConfirm2IsOpen] = useState(false)
    const [submitIsOpen, setSubmitIsOpen] = useState({
        isOpen: false,
        id: '',
    })

    const [deleteIsOpen, setDeleteIsOpen] = useState({
        isOpen: false,
        id: '',
    })

    const [masterData, setMasterData] = useState({
        depots: [],
        products: [],
        nonEssentialProducts:[],
        recipes:[]
    })

    const [statusCount, setStatusCount] = useState({
        inProcess: 0,
        pending: 0,
        approved: 0,
        transferPending:0
    })

    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 5,
        query: '',
        status: 'inProcess',
    })

    const [dataList, setDataList] = useState([])
    const [scannerIsOpen, setScannerIsOpen] = useState(false)
    
    const [isKeepDialogOpen, setIsKeepDialogOpen] = useState(false)
    const [keepInProductionData, setKeepInProductionData] = useState([])

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


    const setData = (childData)=>{
        setIsKeepDialogOpen(childData)
        setKeepInProductionData([])
        setReturnIsOpen({
            isOpen: false,
            id: '',
            isReturned: 0,
            isInProduction: 0,
        })
        getProductionList()
        socket.emit('AllProduction', 'Saurabh')
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
            depot_id: '',
            product_id: '',
            requested_kg: '',
            use_production_stock: false,
            no_of_batch: '',
            request_unit: 'Kg',
            p_type: 'Essentials'
        })
        setStockValue(0)
        setDialogIsOpen({isOpen:false,p_type:'Essentials'})
    }

    const checkUnits = (val)=>{
        // console.log(val)
        setValue(prev=>({...formRef.current.values,...{requested_kg:'', no_of_batch:val === 'Kg'? 1 : '', request_unit:val}}))
        
    }

    const returnClose = () => {
        setReturnIsOpen({ isOpen: false, id: '' })
    }

    const confirmClose = () => {
        setConfirmIsOpen(false)
    }

    const confirm2Close = () => {
        setConfirm2IsOpen(false)
    }

    const submitClose = () => {
        setSubmitIsOpen({
            isOpen: false,
            id: '',
        })
    }

    const deleteClose = () => {
        setDeleteIsOpen({
            isOpen: false,
            id: '',
        })
    }

    const keepClose = () => {
        setKeepIsOpen({
            isOpen: false,
            id:'',
            wastage: false,
        })
        setStoreMaterials([])
        // setErrorFlag({ field1: false, field2: false })
    }

    const checkKG = (data) => {
        if (isEdit) {
            let obj = {
                manufacturer_id: productId,
                product_id: data.value,
            }
            apiGetProductionStockEdit(obj).then((data) => {
                // console.log(data.stock)
                setStockValue(data.stock !== null ? data.stock : 0)
            })
        } else {
            let obj = {
                manufacturer_id: JSON.parse(localStorage.getItem('batchDepot'))
                    .id,
                product_id: data.value,
            }
            apiGetProductionStock(obj).then((data) => {
                // console.log(data.stock)
                setStockValue(data.stock !== null ? data.stock : 0)
            })
        }
    }

    const getProductionList = () => {
        // let paramStatus = tab ? tab : status
        // console.log(tableData)
        setLoadingCard(true)
        apiGetAllProduction(
            JSON.parse(localStorage.getItem('batchDepot')).id,
            tableData
        ).then((data) => {
            // console.log(data)
            setStatusCount({
                inProcess: data.statusCount['inProcess'],
                pending: data.statusCount['pending'],
                approved: data.statusCount['approved'],
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

    const formSubmit = (values, { resetForm, setSubmitting }) => {
        let obj = {
            manufacturer_id: JSON.parse(localStorage.getItem('batchDepot')).id,
        }
        // console.log(Object.assign(values, obj))
        // console.log(isEdit)
        if (isEdit) {
            apiProductionEdit(Object.assign(values, obj), productId).then(
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
                            depot_id: '',
                            product_id: '',
                            requested_kg: '',
                            use_production_stock: false,
                            no_of_batch: '',
                            request_unit: 'Kg',
                            p_type: 'Essentials'
                        })
                        setSubmitting(false)
                        setStockValue(0)
                        setDialogIsOpen({isOpen:false,p_type:'Essentials'})
                        getProductionList()
                        socket.emit('AllProduction', 'Saurabh')
                    }
                }
            )
        } else {
            apiProduction(Object.assign(values, obj)).then((data) => {
                // console.log(data)
                if (data.status === 200 || data.status === 201) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    setValue({
                        depot_id: '',
                        product_id: '',
                        requested_kg: '',
                        use_production_stock: false,
                        no_of_batch: '',
                        request_unit: 'Kg',
                        p_type: 'Essentials'
                    })
                    setSubmitting(false)
                    setDialogIsOpen({isOpen:false,p_type:'Essentials'})
                    setStockValue(0)
                    getProductionList()
                    socket.emit('AllProduction', 'Saurabh')
                }
            })
        }
    }

    const handleReturnToStore = () => {
        setConfirmIsOpen(true)
    }

    const apiCallGetStore = (id, tab) => {
        apiGetReturnStore(id).then((data) => {
            // console.log(data)
            if(tab){
                setStoreMaterials(data.production.productionWastes)
                setKeepIsOpen((prev) => ({ ...prev, isOpen: true, id, wastage: true }))
            }else{
                // setStoreMaterials(data.production.productionRetains)
                // setKeepIsOpen((prev) => ({ ...prev, isOpen: true, id, wastage: false }))
                // console.log(data)
                setKeepInProductionData({
                    return_id: id,
                    production:data.production,
                    rawMaterials: data.rawMaterials.map((values)=>{
                        return {
                            value: values.raw_material_id,
                            label: values.rm_name,
                            barcode: values.barcodes
                        }
                    }),
                    // barcode: data.rawMaterials.map((rvalues)=>{
                    //     return rvalues.barcodes.map(values=>{
                    //         setLoading(false)
                    //         return { value:values.barcode,  label:values.barcode, id: rvalues.raw_material_id, available_qty: values.available_qty, expiry_date: values.expiry_date}}
                    //     )
                    // }) 
                })
                setIsKeepDialogOpen(true)
            }
        })
    }

    const handleKeepInProduction = () => {
        apiCallGetStore(returnIsOpen.id, false)
    }
    const handleWastageProduction = () => {
        apiCallGetStore(returnIsOpen.id, true)
    }

    const confirmReturn = () => {
        if (returnIsOpen.isOpen) {
            apiPutProductionReturn(
                {
                    return_raw_material: 1,
                },
                returnIsOpen.id
            ).then((data) => {
                // console.log(data)
                if (data.status === 200) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data['message']}
                        </Notification>
                    )
                    setConfirmIsOpen(false)
                    setReturnIsOpen({
                        isOpen: false,
                        id: '',
                        isReturned: 0,
                        isInProduction: 0,
                    })
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
        } else {
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Something Went Wrong!!
                </Notification>
            )
        }
    }

    const scannerClose = () => {
        setScannerIsOpen(false)
    }

    const onNewScanResult = (decodedText, decodedResult) => {
        // handle decoded results here
        handleMaterials(decodedText)
        setScannerIsOpen(false)
        // setKeepIsOpen((prev) => ({ ...prev, barcode: decodedText }))
        // setErrorFlag((prev) => ({ ...prev, field2: false }))
    }

    // const handleSubmit = () => {
    //     if (keepIsOpen.isOpen) {
    //         // console.log(keepIsOpen)
    //         if (keepIsOpen.return_kg <= 0) {
    //             setErrorFlag((prev) => ({ ...prev, field1: true }))
    //         }
    //         if (keepIsOpen.barcode === '') {
    //             setErrorFlag((prev) => ({ ...prev, field2: true }))
    //         }
    //         if (keepIsOpen.return_kg > 0 && keepIsOpen.barcode !== '') {
    //             setErrorFlag({ field1: false, field2: false })
    //             setConfirm2IsOpen(true)
    //         }
    //     }
    // }
    const confirmKeep = () => {
        console.log(formRefNew.current.values)
        if (keepIsOpen.wastage) {
            // Wastage
            apiPutProductionWastage(
                formRefNew.current.values,
                keepIsOpen.id
            )
                .then((data) => {
                    // console.log(data)
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
                        setStoreMaterials([])
                        setConfirm2IsOpen(false)
                        setKeepIsOpen({
                            isOpen: false,
                            id:'',
                            wastage: false,
                        })
                        setReturnIsOpen({
                            isOpen: false,
                            id: '',
                            isReturned: 0,
                            isInProduction: 0,
                        })
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
                .catch((error) => {
                    if (error.response.status === 422) {
                        let errorList = error.response['data'].error
                        console.log(errorList)
                        for (let err in errorList.errors) {
                            toast.push(
                                <Notification
                                    title="Error"
                                    type="danger"
                                    closable
                                >
                                    {errorList.errors[err].message}
                                </Notification>
                            )
                        }
                    }
                })
        } else {
            console.log('Keep In Production Code Changed ')
            //     apiPutProductionRetain(
            //     formRefNew.current.values,
            //     keepIsOpen.id
            // )
            //     .then((data) => {
            //         // console.log(data)
            //         if (data.status === 200) {
            //             toast.push(
            //                 <Notification
            //                     title="Success"
            //                     type="success"
            //                     closable
            //                 >
            //                     {data.data['message']}
            //                 </Notification>
            //             )
            //             setStoreMaterials([])
            //             setConfirm2IsOpen(false)
            //             setKeepIsOpen({
            //                 isOpen: false,
            //                 id:'',
            //                 wastage: false,
            //             })
            //             setReturnIsOpen({
            //                 isOpen: false,
            //                 id: '',
            //                 isReturned: 0,
            //                 isInProduction: 0,
            //             })
            //             getProductionList()
            //             socket.emit('AllProduction', 'Saurabh')
            //         } else {
            //             toast.push(
            //                 <Notification title="Error" type="danger" closable>
            //                     Something Went Wrong!!
            //                 </Notification>
            //             )
            //         }
            //     })
            //     .catch((error) => {
            //         if (error.response.status === 422) {
            //             let errorList = error.response['data'].error
            //             console.log(errorList)
            //             for (let err in errorList.errors) {
            //                 toast.push(
            //                     <Notification
            //                         title="Error"
            //                         type="danger"
            //                         closable
            //                     >
            //                         {errorList.errors[err].message}
            //                     </Notification>
            //                 )
            //             }
            //         }
            //     })
        }
    }

    const handleMaterials = (decodedText) => {
        const barcodeExist = formRefNew.current.values.storeReturns.some(
            (storeMaterial) => storeMaterial.barcode === decodedText
        )
        if (!barcodeExist) {
            apiStoreManagerBarcodeStockReturn({
                id: keepIsOpen.id,
                barcode: decodedText,
            }).then((data) => {
                console.log(data)
                if (data) {
                    setStoreMaterials((prev) => [
                        ...formRefNew.current.values['storeReturns'],
                        {
                            raw_material_id:
                                data.raw_material_id,
                            qty: '',
                            barcode: decodedText,
                            expiry_date: data.expiry_date,
                            fifo_not_followed: 0,
                        },
                    ])
                } else {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            Barcode Does Not Exist.
                        </Notification>
                    )
                }
            }).catch(error=>{
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {error.response['data'].message}
                    </Notification>
                )
            })
        } else {
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Barcode Already Scanned
                </Notification>
            )
        }
    }

    const confirmSubmit = (id) => {
        if (submitIsOpen.id !== '') {
            apiProductionSubmit(id)
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
                    setSubmitIsOpen({ isOpen: false, id: '' })
                })
                .catch((error) => {
                    console.log(error.response['data'])
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            Something Went Wrong.
                        </Notification>
                    )
                    // if (error.response.status === 422) {
                    //     let errorList = error.response['data'].error
                    //     for (let err in errorList.errors) {
                    //     }
                    // }
                })
        }
    }

    const deleteSubmit = (id) => {
        if (deleteIsOpen.id !== '') {
            apiProductionDelete(id)
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
                    // if (error.response.status === 422) {
                    //     let errorList = error.response['data'].error
                    //     for (let err in errorList.errors) {
                    //     }
                    // }
                })
        }
    }

    useEffect(() => {
        apiGetMasterData().then((data) => {
            // console.log(data)
            setMasterData({
                products: data['masterData'].products.map((value) => {
                    return {
                        value: value.id,
                        label: value.short_name,
                        short_name: value.short_name,
                    }
                }),
                depots: data['masterData'].depots.map((value) => {
                    return {
                        value: value.id,
                        label: value.depot_name,
                        depot_code: value.depot_code,
                    }
                }),
                nonEssentialProducts: data['masterData'].nonEssentialProducts.map((value) => {
                    return {
                        value: value.id,
                        label: value.short_name,
                        short_name: value.short_name,
                    }
                }),
                recipes: data['masterData'].recipes
            })
        })
    }, [])

    const tabChanges = (tab) => {
        setTableData((prevData) => ({
            ...prevData,
            pageIndex:1,
            status: tab,
        }))
        // getProductionList()
    }

    const onPageSelect = ({ value }) => {
        setTableData((prevData) => ({
            ...prevData,
            pageSize: value,
        }))
    }

    const onPaginationChange = (page) => {
        // console.log('onPaginationChange', page)
        setTableData((prevData) => ({
            ...prevData,
            pageIndex: page,
        }))
    }

    const changeRequestedKg = (value, product_id)=>{
        let no_of_batch = isNaN(value) ? 0 : value;
        let total = 0;
        const data = masterData.recipes.filter(value => value.product_id === product_id )
        console.log(data)
        if(data){
            total= data[0].total_kgs * no_of_batch
            console.log(total)
            formRef.current.setFieldValue('requested_kg', (Math.round(total * 10000))/10000)
        }
    }

    useEffect(() => {
        if (localStorage.getItem('batchDepot') === null) {
            setDepotValue('')
            setOpen(true)
        } else {
            setDepotValue(JSON.parse(localStorage.getItem('batchDepot')))
            // console.log(localStorage.getItem('batchDepot'))
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
            // if (socket.connected) {
            //     socket.disconnect()
            // }
        }
    }, [tableData.status, tableData.pageIndex, tableData.pageSize, tableData.query])

    return (
        <Card className=" card-shadow mb-4">
            <div className="flex justify-between items-center mb-8">
                <div className=" inline-flex justify-start items-center gap-5">
                    {/* <Button
                        size="lg"
                        variant="solid"
                        className="h-24"
                        color="amber-600"
                        type="button"
                        onClick={() => {
                            
                        }}
                    >
                        Connect
                    </Button> */}
                    <div>
                        <h4 className="mb-4">Production Floor Dashboard</h4>
                        <div>
                            <Button
                                size="lg"
                                variant="solid"
                                className="h-20 mr-2"
                                color="amber-600"
                                type="button"
                                onClick={() => {
                                    setIsEdit(false)
                                    // console.log('isEdit', isEdit)
                                    // setDialogIsOpen(true)
                                    setDialogIsOpen({isOpen:true,p_type:'Essentials'})
                                    setValue(prev=>({...prev,...{no_of_batch:1}}))
                                }}
                            >
                                Essential
                            </Button>
                            <Button
                                size="lg"
                                className="h-20"
                                type="button"
                                onClick={() => {
                                    setIsEdit(false)
                                    // console.log('isEdit', isEdit)
                                    // setDialogIsOpen(true)
                                    setDialogIsOpen({isOpen:true,p_type:'Other'})
                                    setValue(prev=>({...prev,...{no_of_batch:1, p_type:'Other'}}))
                                    // console.log('Other Selected')
                                }}
                            >
                                Non-Essential
                            </Button>
                        </div>
                    </div>

                    {/* <Button size="lg" className="h-24">
                        Non-Essential
                    </Button> */}
                </div>
                <div className="text-right">
                    <p className="text-black bg-amber-100 p-[7px] mb-1 rounded text-base text-center">
                        <b>Batch No.</b> :{' '}
                        {localStorage.getItem('batchDepot') === null
                            ? ''
                            : JSON.parse(localStorage.getItem('batchDepot'))
                                  .value}
                        <Moment format="DDMMYYYY">{new Date()}</Moment>
                    </p>
                    <div className=" inline-flex justify-end items-center gap-5 mb-3">
                        <p className="text-black bg-slate-100 p-[7px] rounded text-sm text-center">
                            {localStorage.getItem('batchDepot') === null
                                ? ''
                                : JSON.parse(localStorage.getItem('batchDepot'))
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
                defaultValue="inProcess"
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
                className="mb-2"
            >
                <TabList className="justify-end">
                    <TabNav value="inProcess">
                        In Process {`(${statusCount.inProcess})`}
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
                    <TabContent value="inProcess"></TabContent>
                    <TabContent value="transfer_pending"></TabContent>
                    <TabContent value="pending"></TabContent>
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
                                              Received Qty :&nbsp;
                                              <span className="text-lg ">
                                                  <span className="text-rose-600">
                                                      {(Math.floor(product.total_kg * 100)) / 100}
                                                  </span>
                                                  <span>
                                                      {' '}
                                                      / {
                                                          (Math.floor(product.requested_kg * 100)) / 100
                                                      }{' '}
                                                      Kg
                                                  </span>
                                              </span>
                                          </span>
                                          {product.store_kg > 0 || product.output_kg > 0 ? null : (
                                              <Button
                                                  shape="circle"
                                                  variant="plain"
                                                  type="button"
                                                  size="xs"
                                                  className="mr-2"
                                                  icon={<MdEdit />}
                                                  onClick={() => {
                                                      setValue({
                                                          product_id: product.product_id,
                                                          depot_id: product.depot_id,
                                                          requested_kg: product.requested_kg,
                                                          p_type:product.p_type,
                                                          use_production_stock: product.use_production_stock == 1 ? true : false,
                                                          request_unit: product.request_unit,
                                                          no_of_batch: product.no_of_batch
                                                      })
                                                      setIsEdit(true)
                                                      //   console.log('isEdit', isEdit)
                                                      setStockValue(
                                                          product.production_stock_kg
                                                      )
                                                      setProductId(product.id)
                                                    //   setDialogIsOpen(true)
                                                    setDialogIsOpen({isOpen:true,p_type:product.p_type})
                                                  }}
                                              />
                                          )}
                                          {product.p_type === 'Other' && product.check_batch_qty === 0  ? (
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
                                          ) : null}
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
                                      </p>
                                      <p className="text-center">
                                          <span className="font-semibold mr-1">
                                              Retain Qty :&nbsp;
                                              <span className="text-lg text-rose-600">
                                                  {(Math.floor(product.retain_kg * 100) / 100)} Kg
                                              </span>
                                          </span>
                                      </p>
                                      <p className="text-center">
                                          <span className="font-semibold mr-1">
                                              Wastage :&nbsp;
                                              <span className="text-lg text-rose-600">
                                                  {product.total_kg > 0
                                                      ? (Math.round((product.waste_kg / product.total_kg) * 100 ) * 100) / 100 : '0'} % ({(Math.floor(product.waste_kg * 100) / 100)} Kg)
                                              </span>
                                          </span>
                                      </p>
                                  </div>
                                  <div className="grid grid-cols-3 gap-3 p-2">
                                      {
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
                                      }
                                      <Button
                                          size="lg"
                                          className="h-4"
                                          type="button"
                                          onClick={() => {
                                              setReturnIsOpen({
                                                  isOpen: true,
                                                  id: product.id,
                                                  isReturned:
                                                      product.return_raw_material,
                                                  isInProduction:
                                                      product.keep_in_production,
                                              })
                                          }}
                                          disabled={ product.total_kg <= 0 || product.status == 'Approved' ? true : false }
                                      >
                                          Return
                                      </Button>
                                      <div>
                                        {
                                            tableData.status == 'inProcess' ? (
                                                <Button
                                                    size="lg"
                                                    variant="solid"
                                                    color="amber-600"
                                                    type="button"
                                                    className="h-4 w-full"
                                                    disabled={ product.output_kg > 0 || ((Math.round((product.retain_kg + product.return_kg + product.waste_kg) * 10000) / 10000) == product.total_kg) || product.status == 'Pending' ? false : true }
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
                                        }
                                      </div>
                                  </div>
                              </div>
                          </div>
                      ))
                    : `No Product ${
                          tableData.status === 'inProcess' ? 'In Process.' : tableData.status === 'pending' ? 'In Pending.' : tableData.status === 'transfer_pending' ? 'In Transfer Pending.' : 'In Processed.'
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
                            defaultValue={paginationOptions[0]}
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
                isOpen={dialogIsOpen.isOpen}
                shouldCloseOnOverlayClick={false}
                shouldCloseOnEsc={false}
                onClose={onDialogClose}
                onRequestClose={onDialogClose}
            >
                <div className="flex flex-col items-center justify-between gap-2 h-full">
                    <h3 className="mb-4 text-center">Request {dialogIsOpen.p_type === 'Other' ? 'Non-Essential' : 'Essential'} Production </h3>
                    <Formik
                        enableReinitialize={true}
                        initialValues={value}
                        innerRef={formRef}
                        validationSchema={validationSchema}
                        onSubmit={(values, { resetForm, setSubmitting }) => {
                            let a = Object.assign(values, {p_type:dialogIsOpen.p_type})
                            // console.log(a)
                            formSubmit(a, { resetForm, setSubmitting })
                        }}
                    >
                        {({
                            values,
                            touched,
                            errors,
                            resetForm,
                            isSubmitting,
                        }) => {
                            return (
                                <Form
                                    autoComplete="off"
                                    autoSave="off"
                                    className="w-full"
                                >
                                    <FormContainer layout="vertical" size="lg">
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
                                        <FormItem
                                            invalid={
                                                errors.product_id &&
                                                touched.product_id
                                            }
                                            errorMessage={errors.product_id}
                                        >
                                            <Field name="product_id">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={
                                                            dialogIsOpen.p_type ==='Essentials' ? masterData.products : masterData.nonEssentialProducts
                                                        }
                                                        // onFocus={onFocus}
                                                        isLoading={loading}
                                                        value={dialogIsOpen.p_type ==='Essentials' ? masterData.products.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.product_id
                                                        ) : masterData.nonEssentialProducts.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.product_id
                                                        )}
                                                        onChange={(option) => {
                                                            if(dialogIsOpen.p_type === 'Essentials'){
                                                                checkKG(option)
                                                            }
                                                            return form.setFieldValue(
                                                                field.name,
                                                                option?.value
                                                            )
                                                        }}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        { dialogIsOpen.p_type === 'Other'? (<FormItem
                                            asterisk
                                            label="Requested Unit"
                                            invalid={errors.request_unit && touched.request_unit}
                                            errorMessage={errors.request_unit}
                                        >
                                            <Field name="request_unit">
                                                {({ field, form }) => (
                                                    <Radio.Group
                                                        value={values.request_unit}
                                                        onChange={(val) =>{
                                                            checkUnits(val)
                                                            form.setFieldValue(
                                                                field.name,
                                                                val
                                                            )}
                                                        }
                                                    >
                                                        <Radio value={'No'}>Unit</Radio>
                                                        <Radio value={'Kg'} selected>Kg</Radio>
                                                    </Radio.Group>
                                                )}
                                            </Field>
                                        </FormItem>):null}
                                        { 
                                            values.request_unit === 'No' ? (
                                                <FormItem
                                                    invalid={
                                                        errors.no_of_batch &&
                                                        touched.no_of_batch
                                                    }
                                                    errorMessage={errors.no_of_batch}
                                                >
                                                    <Field
                                                        name="no_of_batch"
                                                        >
                                                     {({ field, form }) => (
                                                         <Input
                                                            type="number"
                                                            field={field}
                                                            placeholder="No. Of Batch"
                                                            suffix={values.request_unit === 'No' ? 'No.' : 'Kg'}
                                                            form={form}
                                                            value={values.no_of_batch}
                                                            onChange={(option) =>{
                                                                    console.log(option.target.value, values.product_id)
                                                                    changeRequestedKg(option.target.value, values.product_id)
                                                                    form.setFieldValue(
                                                                        field.name,
                                                                        option.target.value
                                                                    )
                                                                }
                                                            }
                                                            disabled={values.request_unit === 'Kg' ? true : false}
                                                        />
                                                     )}   
                                                    </Field>
                                                </FormItem>
                                            ) : null
                                        }
                                        <FormItem
                                            invalid={
                                                errors.requested_kg &&
                                                touched.requested_kg
                                            }
                                            errorMessage={errors.requested_kg}
                                        >
                                            <Field
                                                type="number"
                                                name="requested_kg"
                                                placeholder="Requested KG"
                                                suffix={'KG'}
                                                component={Input}
                                                disabled={values.request_unit === 'No'}
                                            />
                                        </FormItem>
                                        {
                                            dialogIsOpen.p_type !== 'Other' ? (
                                                <FormItem
                                                    invalid={
                                                        errors.use_production_stock &&
                                                        touched.use_production_stock
                                                    }
                                                    errorMessage={
                                                        errors.use_production_stock
                                                    }
                                                >
                                                    <Field
                                                        name="use_production_stock"
                                                        component={Checkbox}
                                                        disabled={stockValue <= 0}
                                                    >
                                                        <h6>
                                                            Use {stockValue}KG available
                                                        </h6>
                                                    </Field>
                                                </FormItem>
                                            ) : null
                                        }

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
                                                Save
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
                isOpen={returnIsOpen.isOpen}
                onClose={returnClose}
                onRequestClose={returnClose}
                closable={false}
                width={475}
            >
                <div className="flex items-center justify-center gap-7 mb-7">
                    <Button
                        variant="solid"
                        color="emerald-600"
                        className="h-24"
                        size="lg"
                        type="button"
                        onClick={() => handleReturnToStore()}
                    >
                        Return To Store
                    </Button>
                    <Button
                        variant="solid"
                        color="rose-600"
                        className="h-24"
                        size="lg"
                        type="button"
                        onClick={() => handleKeepInProduction()}
                    >
                        Keep In Production
                    </Button>
                </div>
                <div className="text-center">
                    <Button
                        variant="solid"
                        color="amber-600"
                        // className="h-24"
                        size="md"
                        type="button"
                        onClick={() => handleWastageProduction()}
                        // disabled={returnIsOpen.isInProduction ? true : false}
                    >
                        Add Wastage/Discard
                    </Button>
                </div>
            </Dialog>

            <Dialog
                isOpen={confirmIsOpen}
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
                isOpen={keepIsOpen.isOpen}
                onClose={keepClose}
                onRequestClose={keepClose}
            >
                <h5 className="mb-4">
                    Insert Qty{' '}
                    {keepIsOpen.wastage
                        ? 'For Wastage'
                        : 'To Keep In Production'}
                </h5>
                <div className="flex flex-col gap-4">
                    <Formik
                        enableReinitialize={true}
                        innerRef={formRefNew}
                        validationSchema={validationSchemaNew}
                        initialValues={{
                            storeReturns: storeMaterials,
                        }}
                        onSubmit={(values) => {
                            console.log(values, keepIsOpen.id)
                            setConfirm2IsOpen(true)
                            // if(values.storeReturns.length > 0){
                            // }else{
                            //     toast.push(
                            //         <Notification title="Error" type="danger" closable>
                            //             Please Scan Barcode!!
                            //         </Notification>
                            //     )
                            // }
                        }}
                    >
                        {({ touched, errors, values }) => {
                            const storeReturns = values.storeReturns
                            return (
                                <Form>
                                    <FormContainer layout="inline">
                                        <div className="w-full">
                                            <FieldArray name="storeReturns">
                                                {({ form, remove, push }) => (
                                                    <div>
                                                        {storeReturns &&
                                                        storeReturns.length > 0 ? (
                                                            storeReturns.map(
                                                                (_, index) => {
                                                                    const qty = fieldFeedback(form, `storeReturns[${index}].qty`)
                                                                    return (
                                                                        <div 
                                                                            key={index}
                                                                            className={`flex items-center justify-between gap-2 px-2 py-1 rounded mb-5 ${storeReturns[index].fifo_not_followed ? 'bg-rose-100' : 'bg-slate-100'} `}
                                                                        >
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <FormItem
                                                                                    invalid={qty.invalid}
                                                                                    errorMessage={qty.errorMessage}
                                                                                    className={'mb-0'}
                                                                                >
                                                                                    <Field
                                                                                        invalid={qty.invalid}
                                                                                        placeholder="Qty"
                                                                                        suffix={'KG'}
                                                                                        name={`storeReturns[${index}].qty`}
                                                                                        type="number"
                                                                                        className="w-[90px]"
                                                                                        component={Input}
                                                                                    />
                                                                                </FormItem>
                                                                                <p>
                                                                                    <span className=" font-semibold">Barcode :{' '}</span>
                                                                                    <span>
                                                                                        {
                                                                                            storeReturns[index].barcode
                                                                                        }
                                                                                    </span>
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <Button
                                                                                    shape="circle"
                                                                                    size="sm"
                                                                                    variant="solid"
                                                                                    color="rose-500"
                                                                                    icon={<FaTrash />}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setStoreMaterials((prev) => {
                                                                                            return prev.filter((value, i) => i !== index)
                                                                                        })
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                }
                                                            )
                                                        ) : (
                                                            <h5 className="text-center mb-5">Please Scan!!</h5>
                                                        )}
                                                        <div className="text-center mb-5">
                                                            <Button
                                                                variant="solid"
                                                                type="button"
                                                                onClick={() => {
                                                                    setScannerIsOpen(
                                                                        true
                                                                    )
                                                                }}
                                                                >
                                                                    Scan Code
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </FieldArray>
                                        </div>
                                    </FormContainer>
                                    <div className="text-right mt-6">
                                        <Button
                                            className="ltr:mr-2 rtl:ml-2"
                                            variant="solid"
                                            color="rose-600"
                                            onClick={keepClose}
                                            size="lg"
                                            type="button"
                                        >
                                            No
                                        </Button>
                                        <Button
                                            variant="solid"
                                            color="emerald-600"
                                            size="lg"
                                            type="submit"
                                            // onClick={() => handleSubmit()}
                                        >
                                            Yes
                                        </Button>
                                    </div>
                                </Form>
                            )
                        }}
                    </Formik>
                </div>
            </Dialog>
            <Dialog
                isOpen={scannerIsOpen}
                onClose={scannerClose}
                onRequestClose={scannerClose}
            >
                {scannerIsOpen ? (<Scanner qrCodeSuccessCallback={onNewScanResult} />): null}
            </Dialog>
            <Dialog
                isOpen={confirm2IsOpen}
                onClose={confirm2Close}
                onRequestClose={confirm2Close}
            >
                <h5 className="mb-4">Confirmation!!</h5>
                <p>
                    Are you sure want{' '}
                    {keepIsOpen.wastage
                        ? 'to add qty in Wastage'
                        : 'to keep in production'}{' '}
                    ??
                </p>
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="plain"
                        onClick={confirm2Close}
                        size="lg"
                        type="button"
                    >
                        No
                    </Button>
                    <Button
                        variant="solid"
                        color="emerald-600"
                        onClick={confirmKeep}
                        size="lg"
                        type="button"
                    >
                        Yes
                    </Button>
                </div>
            </Dialog>

            <Dialog
                isOpen={submitIsOpen.isOpen}
                onClose={submitClose}
                onRequestClose={submitClose}
            >
                <h5 className="mb-4">Confirmation!!</h5>
                <p>Are you sure want to submit for approval ??</p>
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="plain"
                        onClick={submitClose}
                        size="lg"
                        type="button"
                    >
                        No
                    </Button>
                    <Button
                        variant="solid"
                        color="emerald-600"
                        onClick={() => confirmSubmit(submitIsOpen.id)}
                        size="lg"
                        type="button"
                    >
                        Yes
                    </Button>
                </div>
            </Dialog>

            {isKeepDialogOpen && <KeepInProduction data={keepInProductionData} isOpen={isKeepDialogOpen} getData={setData}/>}

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

export default BatchProcessing
