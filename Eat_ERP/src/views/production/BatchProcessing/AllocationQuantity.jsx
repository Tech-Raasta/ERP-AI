import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from 'components/ui'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import { FormItem, FormContainer } from 'components/ui'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Button from 'components/ui/Buttons'
import { FaTrash, FaPlus } from 'react-icons/fa'
import { HiOutlinePlus } from 'react-icons/hi'
import * as Yup from 'yup'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiPackagingGetMasterData,
    apiPackagingMaterialStock,
    apiProductionAllocatePut,
    apiProductionAllocationList,
    apiProductionAllocationPending,
    apiProductionWorkInProgress,
} from 'services/ProductionService'
import Segment from 'components/ui/Segment'
import { io } from 'socket.io-client'

import appConfig from 'configs/app.config'

const validationSchema = Yup.object({
    box: Yup.array().of(
        Yup.object().shape({
            productionAllocations: Yup.array().of(
                Yup.object().shape({
                    qty: Yup.number()
                        .required('Qty required')
                        .moreThan(0, 'Qty required'),
                })
            ),
        })
    ),
    packagingMaterial:Yup.array().of(
        Yup.object().shape({
            raw_material_id: Yup.number().required(' ').moreThan(0, ' '),
            qty: Yup.number().required(' ').moreThan(-1, ' ').test(
                'qty-less-than-stock',
                ' ',
                function (value) {
                    const { totalStock } = this.parent;
                    if(value > totalStock){
                        return false;
                    }else{
                        return true;
                    }
                }
            ),
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

const socket = io(appConfig.socketUrl)

const AllocationQuantity = () => {
    const navigate = useNavigate()
    const allocatedId = useParams()
    const formRef = useRef()
    const [dataBox, setDataBox] = useState([]);
    const [masterPackageData, setMasterPackageData] = useState([])
    const [rawMaterialInOut, setRawMaterialInOut] = useState({})
    const [dataPackaginMaterial, setPackaginMaterial] = useState([]);
    const [countKg, setCountKg] = useState([])
    const [finalCount, setFinalCount] = useState(0)
    const [segmentSelections, setSegmentSelections] = useState([])
    const [segDefault, setSegDefault] = useState([])
    const [holdVal, setHoldVal] = useState([])
    const [checkHold, setCheckHold] = useState([])
    const [check1Hold, setCheck1Hold] = useState([])
    const [otherSegment, setOtherSegment] = useState([])
    const [wip, setWip] = useState(false)
    const [noAllocation, setNoAllocation] = useState(false)
    const [product, setProduct] = useState({
        product_name: '',
        total_kg: '',
        transfer: false,
        output_kg: '',
        transferred_kg: '',
        status:''
    })

    const [workInProgressIsOpen, setWorkInProgressIsOpen] = useState({
        isOpen: false,
        id: '',
    })

    const validationSchemaAllocationPending = Yup.object().shape({
        allocation_pending_kg: Yup.string().required('Allocation Pending Is Required')
    })

    const [allocationPending, setAllocationPending] = useState({
        allocation_pending_kg: ''
    })

    const [allocationPendingIsOpen, setAllocationPendingIsOpen] = useState({
        isOpen: false,
        id: '',
    })

    const [allocationsArray, setAllocationsArray] = useState([])


    const [viewIsOpen, setViewIsOpen] = useState({
        isOpen:false,
        allocations: []
    });

    const [errorItems, setErrorItems] = useState([]);

    const viewClose = ()=>{
        setViewIsOpen({isOpen:false, allocations:[]})
    }

    
    const allocationPendingClose = () => {
        setAllocationPendingIsOpen({
            isOpen: false,
            id: '',
        })
    }

    const holdCheckValue = () => {
        let holdVal = []
        formRef.current.values['box'].forEach((data) => {
            const exist = data.productionAllocations.some((a) => a.qty <= 0)
            holdVal.push(exist)
        })
        setCheckHold(holdVal)
    }

    const holdCheck1Value = () => {
        let holdVal1 = []
        let ds = []
        formRef.current.values['box'].forEach((a, index) => {
            if (a.productionAllocations.length > 0) {
                holdVal1.push(false)
                ds.push({ disabled: true })
            } else {
                holdVal1.push(true)
                ds.push({ disabled: false })
            }
        })
        setSegmentSelections((prev) => {
            prev.map((value, index) => {
                return Object.assign(value, ds[index])
            })
            console.log(prev)
            return prev
        })
        // console.log('hold1', holdVal1)
        setCheck1Hold(holdVal1)
    }

    const countTotalKg = () => {
        setTimeout(() => {
            let totalCalc = []
            let finalCalc = []
            console.log(formRef.current)
            formRef.current.values['box'].forEach((element) => {
                let calcTotal = 0
                element.productionAllocations.forEach((data, index) => {
                    return (calcTotal += data['qty'])
                })
                let final =
                    (parseFloat(element.box['grams']) * parseFloat(calcTotal)) /
                    1000
                finalCalc.push(Math.round(final * 100) / 100)
                totalCalc.push(calcTotal)
            })
            setCountKg(totalCalc)
            const finalTotal = finalCalc.reduce(
                (acc, c) => parseFloat(acc) + parseFloat(c),
                0
            )
            setFinalCount(finalTotal)
            holdCheckValue()
            holdCheck1Value()
            // console.log('Final Total : ', finalTotal)
        }, 100)
    }

    const segChange = (segmentValue) => {
        // console.log(segmentValue)
        // let holdVal = []
        setHoldVal(segmentValue)
        holdCheckValue()
        holdCheck1Value()
    }

    const otherSegChange = (segmentValue) => {
        console.log(segmentValue)
        // let holdVal = []
        setOtherSegment(segmentValue)
        // holdCheckValue()
        // holdCheck1Value()

        if (segmentValue==='Work_In_Progress') {
            setWip('Work_In_Progress')
            setWorkInProgressIsOpen({
                isOpen: true,
                id: allocatedId.aid,
            })
        }
        if (segmentValue==='Allocation_Pending') {
            setNoAllocation('Allocation_Pending')
            // setAllocationPending({allocation_pending_kg:product.allocation_pending_kg})
            setAllocationPendingIsOpen({isOpen:true, id:allocatedId.aid})
        }
    }

    const apiCallGetStore = (id) => {
        apiProductionAllocationList(id).then((data) => {
            // console.log('apiCallGetStore', data['production'])
            const {allocations} = data['production'];
            const productionData = data['production'];

            setRawMaterialInOut({
                production_id:productionData.id,
                date_of_processing:productionData.date_of_processing,
                depot_id:productionData.manufacturer_id,
                depot_name:JSON.parse(localStorage.getItem("batchDepot")).label,
                type:"Other",
                status:"Approved",
                remarks:"Packaging Material From Production Allocations",
            })

            setPackaginMaterial(data["rawMaterialInOutItems"]);

            let splitAllocation1 = allocations ? allocations.split(', ') : [];
            let splitNew = splitAllocation1.map((value)=>{
                return  value.split(" :- ")
              })

            setAllocationsArray(splitNew.map((value)=>{
                return  {
                  product:value[0],
                  qty:value[1],
                  mrp:value[2],
                  usp:value[3],
                }
              }))

            setProduct({
                product_name: data.production.product
                    ? data.production.product['short_name']
                    : '',
                total_kg: data.production.total_kg,
                transfer: data.production.transfer === 1 ? true : false,
                output_kg: data.production.output_kg,
                transferred_kg: data.production.transferred_kg,
                status: data.production.status,
                allocation_pending_kg: data.production.allocation_pending_kg
            })
            let options = []
            let defaultOptions = []
            data.data.forEach((value, index) => {
                options.push({
                    value: value.box['grams'].toString(),
                    desc: value.box['short_name'],
                    id: index,
                    disabled: false,
                })
                if (value.productionAllocations.length > 0) {
                    defaultOptions.push(value.box['grams'].toString())
                }
            })
            setSegmentSelections(options)
            setTimeout(() => {
                setHoldVal(defaultOptions)
                setSegDefault(defaultOptions)
            }, 100)
            console.log('defaultOptions', defaultOptions)
            console.log('Options', options)
            setDataBox(data.data)

            setWip(data.production.status === 'Work_In_Progress' ? "Work_In_Progress" : false)
            setNoAllocation(data.production.status === 'Allocation_Pending' ? 'Allocation_Pending' : false)

            setAllocationPending({ allocation_pending_kg: +data.production.allocation_pending_kg })

            // setOtherSegment({
            //     wip: data.production.status === 'Work_In_Progress' ? 1 : 0,
            //     noAllocation: data.production.status === 'Allocation_Pending' ? 1 : 0,
            //     noAllocationKg: +data.production.allocation_pending_kg
            // });

            setOtherSegment(data.production.status ? data.production.status : null);

            countTotalKg()
        })
    }

    const workInProgressClose = () => {
        setWorkInProgressIsOpen({
            isOpen: false,
            id: '',
        })
    }

    const confirmWorkInProgress = (id) => {
        if (workInProgressIsOpen.id !== '') {
            apiProductionWorkInProgress(id)
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
                        // getProductionList()
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
                    setWorkInProgressIsOpen({ isOpen: false, id: '' })
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

    const getPackagingMaterialStock = (id, index) => {
        apiPackagingMaterialStock(id, rawMaterialInOut.depot_id).then((data) => {
            console.log(data);
            // const material = data['masterData'].packagingMaterials.find((value)=> value.id === id)
            formRef.current.setFieldValue(`packagingMaterial[${index}].totalStock`, parseFloat(data.totalStock).toFixed(2) )
        })
    }

    useEffect(() => {
        const fetchData = () => {
            if (allocatedId.aid) {
                apiCallGetStore(allocatedId.aid)
            } else if (allocatedId.editaid) {
                apiCallGetStore(allocatedId.editaid)
            }
            apiPackagingGetMasterData().then((data) => {
                // console.log(data)
                setMasterPackageData(data['masterData'].packagingMaterials.map((value) => {
                        return {
                            value: value.id,
                            label: value.rm_name,
                        }
                }));
            });
        }
        fetchData()
    }, [])
    return (
        <>
            <Card className=" card-shadow mb-4">
                <Formik
                    enableReinitialize={true}
                    innerRef={formRef}
                    validationSchema={validationSchema}
                    initialValues={{
                        box: dataBox,
                        packagingMaterial:dataPackaginMaterial,
                    }}
                    onSubmit={(values) => {
                        const data = []
                        console.log(values)
                        if (holdVal.length > 0) {
                            values.box.map((allocatedData, index) => {
                                holdVal.forEach((value, index) => {
                                    if (
                                        parseInt(value) ===
                                        allocatedData.box['grams']
                                    ) {
                                        allocatedData.productionAllocations.map(
                                            (finalData, index) => {
                                                data.push(finalData)
                                            }
                                        )
                                    }
                                })
                            })
                        }

                        const packagingMaterial = values.packagingMaterial.map((item, index)=>Object.assign(item, {type:"STOCK OUT"}))
                        console.log(packagingMaterial)

                        apiProductionAllocatePut(
                            { productionAllocations: data, rawMaterialInOutItems: values.packagingMaterial, ...rawMaterialInOut },
                            allocatedId.aid
                                ? allocatedId.aid
                                : allocatedId.editaid
                        )
                            .then((data) => {
                                console.log(data)
                                if (data.status === 200) {
                                    setProduct((prev) => ({
                                        ...prev,
                                        output_kg:
                                            data.data['production'].output_kg,
                                    }))
                                    toast.push(
                                        <Notification
                                            title="Success"
                                            type="success"
                                            closable
                                        >
                                            {data.data['message']}
                                        </Notification>
                                    )
                                    apiCallGetStore(allocatedId.aid)
                                    socket.emit('AllProduction', 'Saurabh')
                                } else {
                                    toast.push(
                                        <Notification
                                            title="Error"
                                            type="danger"
                                            closable
                                        >
                                            Something Went Wrong.
                                        </Notification>
                                    )
                                }
                                // navigate('/production/production-floor-manager', {
                                //     replace: true,
                                // })

                            })
                            .catch((error) => {
                                toast.push(
                                    <Notification
                                        title="Error"
                                        type="danger"
                                        closable
                                    >
                                        {error.response['data'].message}
                                    </Notification>
                                )

                                // console.log("error", error);
                                // if(error.response.status === 422){
                                //     let errorList = error.response['data'].error
                                //     setErrorItems(errorList);
                                // }
                            })

                        // 
                        // if (data.length > 0) {
                        //     // alert(JSON.stringify(values, null, 2))
                        // } else {
                        //     toast.push(
                        //         <Notification title="Error" type="danger" closable>
                        //             Please Add Atleast 1 Product.
                        //         </Notification>
                        //     )
                        // }
                    }}
                >
                    {({ touched, errors, values }) => {
                        const box = values.box
                        const productionAllocations = box.map(
                            (value, index) => value.productionAllocations
                        )
                        const productionPackagingMaterial = values.packagingMaterial
                        return (
                            <Form>
                                <FormContainer layout="inline">
                                    <div className="w-full">
                                        <div className="mb-8 flex items-center justify-between">
                                            <h5>
                                                {product.product_name} (
                                                <span className=" text-rose-500">
                                                    {Math.round(finalCount * 100)/100}
                                                </span>
                                                /{product.total_kg}KG)
                                            </h5>
                                            <div className='flex gap-[10px] justify-end items-center flex-wrap'>
                                                {product.output_kg > 0 ? (
                                                    <Button
                                                        type="button"
                                                        variant="solid"
                                                        color="blue-600"
                                                        // className="ltr:mr-5 rtl:ml-3"
                                                        onClick={() => {
                                                            navigate(
                                                                `/production/production-floor-manager/transfer-batch/${allocatedId.aid}`
                                                            )
                                                        }}
                                                    >
                                                        Transfer
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    type="button"
                                                    // className="ltr:mr-5 rtl:ml-3"
                                                    color="gray-600"
                                                    variant="solid"
                                                    onClick={() => setViewIsOpen({isOpen:true, allocations : allocationsArray})}
                                                >
                                                    View Allocations
                                                </Button>
                                                <Button
                                                    type="button"
                                                    // className="ltr:mr-5 rtl:ml-3"
                                                    onClick={() => {
                                                        navigate(
                                                            '/production/production-floor-manager',
                                                            {
                                                                replace: true,
                                                            }
                                                        )
                                                    }}
                                                >
                                                    Back
                                                </Button>
                                                {
                                                    product.status === 'Approved'? null : (
                                                        <Button
                                                            type="submit"
                                                            variant="solid"
                                                            disabled={product.status === 'Approved'}
                                                        >
                                                            Save
                                                        </Button>
                                                    )
                                                }
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-12 gap-5">
                                            <div className="col-span-8">
                                                <Segment
                                                    value={holdVal}
                                                    selectionType="multiple"
                                                    className={`gap-2 flex flex-wrap mb-4 ${product.status === 'Approved'? 'hidden' : 'visible'}`}
                                                    onChange={(segmentValue) =>
                                                        segChange(segmentValue)
                                                    }
                                                >
                                                    {segmentSelections.map(
                                                        (item, index) => {
                                                            return (
                                                                <Segment.Item
                                                                    key={index}
                                                                    value={item.value}
                                                                    disabled={
                                                                        item.disabled
                                                                    }
                                                                >
                                                                    {({
                                                                        active,
                                                                        value,
                                                                        onSegmentItemClick,
                                                                        disabled,
                                                                    }) => {
                                                                        return (
                                                                            <div
                                                                                className={`flex ring-1 justify-between border rounded-md border-gray-300 py-5 px-4 cursor-pointer select-none w-[150px] 
                                                                                ${
                                                                                    active
                                                                                        ? checkHold[
                                                                                            index
                                                                                        ]
                                                                                            ? `ring-rose-500 border-rose-500 bg-rose-100 `
                                                                                            : check1Hold[
                                                                                                index
                                                                                            ]
                                                                                            ? `ring-amber-500 border-amber-500 bg-amber-100 `
                                                                                            : `ring-emerald-600 border-emerald-600 bg-emerald-200 `
                                                                                        : checkHold[
                                                                                            index
                                                                                        ]
                                                                                        ? `ring-rose-600 border-rose-600 bg-rose-300 `
                                                                                        : 'ring-transparent '
                                                                                }
                                                                                ${
                                                                                    disabled
                                                                                        ? 'opacity-50 cursor-not-allowed '
                                                                                        : 'hover:ring-amber-500 hover:border-amber-500 '
                                                                                }`}
                                                                                onClick={
                                                                                    onSegmentItemClick
                                                                                }
                                                                            >
                                                                                <div>
                                                                                    <h6>
                                                                                        {
                                                                                            value
                                                                                        }{' '}
                                                                                        Grams
                                                                                    </h6>
                                                                                    <p>
                                                                                        {
                                                                                            item.desc
                                                                                        }
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    }}
                                                                </Segment.Item>
                                                            )
                                                        }
                                                    )}
                                                </Segment>
                                            </div>
                                            <div className="col-span-4">
                                                <div className={`gap-2 flex flex-wrap justify-end mb-4 ${product.status === 'Approved'? 'hidden' : 'visible'}`}>
                                                    <button
                                                        type='button'
                                                        className={`flex ring-1 justify-between border rounded-md border-gray-300 py-5 px-4 cursor-pointer select-none w-[120px] 
                                                        ${
                                                            noAllocation
                                                                ? noAllocation
                                                                    ? `ring-rose-500 border-rose-500 bg-rose-100 `
                                                                    : `ring-emerald-600 border-emerald-600 bg-emerald-200 `
                                                                : noAllocation
                                                                ? `ring-rose-600 border-rose-600 bg-rose-300 `
                                                                : 'ring-transparent '
                                                        }`}
                                                        onClick={()=>{
                                                            otherSegChange('Allocation_Pending')
                                                        }
                                                        }
                                                    >
                                                        {/* <div> */}
                                                            <h6 className="text-center">
                                                                No Allocation
                                                            </h6>
                                                        {/* </div> */}
                                                    </button>

                                                    <button
                                                        type='button'
                                                        className={`flex ring-1 justify-between border rounded-md border-gray-300 py-5 px-4 cursor-pointer select-none w-[120px] 
                                                        ${
                                                            wip
                                                                ? wip
                                                                    ? `ring-rose-500 border-rose-500 bg-rose-100 `
                                                                    : `ring-emerald-600 border-emerald-600 bg-emerald-200 `
                                                                : wip
                                                                ? `ring-rose-600 border-rose-600 bg-rose-300 `
                                                                : 'ring-transparent '
                                                        }`}
                                                        onClick={()=>{
                                                            otherSegChange('Work_In_Progress')
                                                        }
                                                        }
                                                    >
                                                        {/* <div> */}
                                                            <h6 className="text-center">
                                                                Work In Progress
                                                            </h6>
                                                        {/* </div> */}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <FieldArray name="box">
                                            {({ form, remove, push }) => (
                                                <div>
                                                    {box && box.length > 0
                                                        ? box.map((data, i) => (
                                                            <div key={i}>
                                                                {holdVal &&
                                                                holdVal.length > 0
                                                                    ? holdVal.map(
                                                                            (
                                                                                value,
                                                                                holdIndex
                                                                            ) => (
                                                                                <div
                                                                                    key={
                                                                                        holdIndex
                                                                                    }
                                                                                    className={`card shadow mb-2 p-4 ${
                                                                                        parseInt(
                                                                                            value
                                                                                        ) ===
                                                                                        data
                                                                                            .box[
                                                                                            'grams'
                                                                                        ]
                                                                                            ? 'visible'
                                                                                            : 'hidden'
                                                                                    }`}
                                                                                >
                                                                                    <h4 className="mb-4 text-center grid grid-cols-3 items-center">
                                                                                        <span className="text-sm text-left">
                                                                                            <span className="px-[10px] py-[5px] bg-slate-300 rounded-full">
                                                                                                Total
                                                                                                :
                                                                                                {countKg.length >
                                                                                                0
                                                                                                    ? parseFloat(
                                                                                                        countKg[
                                                                                                            i
                                                                                                        ]
                                                                                                    )
                                                                                                    : '0'}
                                                                                            </span>
                                                                                        </span>
                                                                                        <span>
                                                                                            {
                                                                                                data
                                                                                                    .box[
                                                                                                    'box_name'
                                                                                                ]
                                                                                            }
                                                                                        </span>
                                                                                        <span></span>
                                                                                    </h4>
                                                                                    <FieldArray
                                                                                        name={`box[${i}].productionAllocations`}
                                                                                    >
                                                                                        {({
                                                                                            form,
                                                                                            remove,
                                                                                            push,
                                                                                        }) => (
                                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                                {box[
                                                                                                    i
                                                                                                ]
                                                                                                    .productionAllocations &&
                                                                                                box[
                                                                                                    i
                                                                                                ]
                                                                                                    .productionAllocations
                                                                                                    .length >
                                                                                                    0 ? (
                                                                                                    box[
                                                                                                        i
                                                                                                    ].productionAllocations.map(
                                                                                                        (
                                                                                                            _,
                                                                                                            index
                                                                                                        ) => {
                                                                                                            const qty =
                                                                                                                fieldFeedback(
                                                                                                                    form,
                                                                                                                    `box[${i}].productionAllocations[${index}].qty`
                                                                                                                )

                                                                                                            return (
                                                                                                                <div
                                                                                                                    key={index}
                                                                                                                    // ${
                                                                                                                    //     productionAllocations[i][index].fifo_not_followed ? 'bg-rose-100' : 'bg-slate-100'
                                                                                                                    // } 
                                                                                                                    className={`flex items-center w-[230px] justify-between gap-2 px-2 py-1 rounded bg-slate-100 `}
                                                                                                                >
                                                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                                                        <FormItem
                                                                                                                            asterisk
                                                                                                                            label="qty"
                                                                                                                            invalid={
                                                                                                                                qty.invalid
                                                                                                                            }
                                                                                                                            errorMessage={
                                                                                                                                qty.errorMessage
                                                                                                                            }
                                                                                                                            className={
                                                                                                                                'mb-0'
                                                                                                                            }
                                                                                                                        >
                                                                                                                            <Field
                                                                                                                                invalid={
                                                                                                                                    qty.invalid
                                                                                                                                }
                                                                                                                                placeholder="Qty"
                                                                                                                                suffix={
                                                                                                                                    'No.'
                                                                                                                                }
                                                                                                                                name={`box[${i}].productionAllocations[${index}].qty`}
                                                                                                                                type="number"
                                                                                                                                component={
                                                                                                                                    Input
                                                                                                                                }
                                                                                                                                disabled = {product.status === 'Approved'}
                                                                                                                                onChange={(
                                                                                                                                    e
                                                                                                                                ) => {
                                                                                                                                    let val =
                                                                                                                                        e
                                                                                                                                            .target
                                                                                                                                            .value ==
                                                                                                                                        ''
                                                                                                                                            ? ''
                                                                                                                                            : parseInt(
                                                                                                                                                e
                                                                                                                                                    .target
                                                                                                                                                    .value
                                                                                                                                            )
                                                                                                                                    countTotalKg()
                                                                                                                                    return form.setFieldValue(
                                                                                                                                        `box[${i}].productionAllocations[${index}].qty`,
                                                                                                                                        val
                                                                                                                                    )
                                                                                                                                }}
                                                                                                                            />
                                                                                                                        </FormItem>
                                                                                                                    </div>
                                                                                                                    <div>
                                                                                                                        {product.status === 'Approved' ? null : (
                                                                                                                            <Button
                                                                                                                                shape="circle"
                                                                                                                                size="sm"
                                                                                                                                variant="solid"
                                                                                                                                color="rose-500"
                                                                                                                                icon={
                                                                                                                                    <FaTrash />
                                                                                                                                }
                                                                                                                                type="button"
                                                                                                                                onClick={() => {
                                                                                                                                    countTotalKg()
                                                                                                                                    holdCheck1Value()
                                                                                                                                    remove(
                                                                                                                                        index
                                                                                                                                    )
                                                                                                                                }}
                                                                                                                            />
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            )
                                                                                                        }
                                                                                                    )
                                                                                                ) : (
                                                                                                    <p className="text-center text-base font-medium">
                                                                                                        Add
                                                                                                        Finished
                                                                                                        Product!!
                                                                                                    </p>
                                                                                                )}
                                                                                                <div>
                                                                                                    {product.status === 'Approved' ? null : (
                                                                                                        <Button
                                                                                                            type="button"
                                                                                                            shape="circle"
                                                                                                            icon={
                                                                                                                <HiOutlinePlus />
                                                                                                            }
                                                                                                            onClick={() => {
                                                                                                                holdCheckValue()
                                                                                                                holdCheck1Value()
                                                                                                                push(
                                                                                                                    {
                                                                                                                        box_id: data
                                                                                                                            .box[
                                                                                                                            'id'
                                                                                                                        ],
                                                                                                                        qty: '',
                                                                                                                        grams: data
                                                                                                                            .box[
                                                                                                                            'grams'
                                                                                                                        ],
                                                                                                                    }
                                                                                                                )
                                                                                                            }}
                                                                                                        />
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </FieldArray>
                                                                                </div>
                                                                            )
                                                                        )
                                                                    : null}
                                                            </div>
                                                        ))
                                                        : null}
                                                    
                                                    {/* <div>
                                                        {noAllocation==="Allocation_Pending"
                                                            ?  <div></div>
                                                            : null}
                                                    </div> */}
                                                </div>
                                            )}
                                        </FieldArray>
                                        <div className='mt-10 border-t-2 border-gray-300 border-dashed'>
                                            <h3 className='my-7'>Add Packaging Material</h3>
                                            <FieldArray name="packagingMaterial">
                                                {({ form, remove, push }) => (
                                                    <>
                                                        <div className=''>
                                                            {
                                                                productionPackagingMaterial && productionPackagingMaterial.length > 0 ? (productionPackagingMaterial.map(
                                                                    (_, index) => {
                                                                        const raw_material_id = fieldFeedback(form, `packagingMaterial[${index}].raw_material_id`);
                                                                        const qty = fieldFeedback(form, `packagingMaterial[${index}].qty`);
                                                                        const totalStock = fieldFeedback(form, `packagingMaterial[${index}].totalStock`);

                                                                        return (
                                                                            <div key={index} className="flex items-center justify-start gap-2 rounded mb-5 mt-1">
                                                                                <FormItem
                                                                                    className="block mb-0 custom-text-left w-[400px]"
                                                                                    invalid={raw_material_id.invalid}
                                                                                    errorMessage={raw_material_id.errorMessage}
                                                                                    layout={"vertical"}
                                                                                >
                                                                                    <Field name={`packagingMaterial[${index}].raw_material_id`}>
                                                                                        {({ field, form, }) => (
                                                                                            <Select
                                                                                                className="custom-text-left text-left"
                                                                                                placeholder="Select Packaging Material"
                                                                                                field={field}
                                                                                                form={form}
                                                                                                options={masterPackageData ? masterPackageData : []}
                                                                                                value={masterPackageData ? masterPackageData.filter((option) =>option.value === values.packagingMaterial[index].raw_material_id): values.packagingMaterial[index].raw_material_id}
                                                                                                onChange={(option) => {
                                                                                                    console.log("option", option);
                                                                                                    form.setFieldValue(field.name, option?.value);
                                                                                                    // form.setFieldValue(`packagingMaterial[${index}].item_names`, option?.label)
                                                                                                    form.setFieldValue(`packagingMaterial[${index}].rm_name`, option?.label)
                                                                                                    getPackagingMaterialStock(option?.value, index)
                                                                                                }}
                                                                                            />
                                                                                        )}
                                                                                    </Field>
                                                                                </FormItem>
                                                                                <FormItem invalid={qty.invalid} errorMessage={qty.errorMessage} className={'mb-0 w-[100px]'}>
                                                                                    <Field invalid={qty.invalid} suffix={'No.'} name={`packagingMaterial[${index}].qty`} type="number" component={Input} />
                                                                                </FormItem>
                                                                                <Button shape="circle" size="sm" variant="solid" color="rose-500" icon={<FaTrash />} type="button" onClick={() => remove(index)} className="mr-[5px]" disabled={values.packagingMaterial[index].id !== null} />
                                                                                <p className={`${productionPackagingMaterial[index].qty > productionPackagingMaterial[index].totalStock ? 'hidden' : 'text-sm text-gray-500'}`}>
                                                                                    Available Stock: {productionPackagingMaterial[index].totalStock ? productionPackagingMaterial[index].totalStock : 0}
                                                                                </p>
                                                                                <div>
                                                                                    <p className='text-rose-600'>{productionPackagingMaterial[index].qty > productionPackagingMaterial[index].totalStock ? `Stock Cannot be negative. Available Stock is ${productionPackagingMaterial[index].totalStock} ` :''}</p>
                                                                                </div>
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
                                                                console.log('Adding tab')
                                                                push({
                                                                    id:null,
                                                                    raw_material_id:'',
                                                                    qty: 0,
                                                                    totalStock:0,
                                                                })
                                                            }}
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </FieldArray>
                                        </div>
                                    </div>
                                </FormContainer>
                            </Form>
                        )
                    }}
                </Formik>
            </Card>
            
            <Dialog
                isOpen={workInProgressIsOpen.isOpen}
                onClose={workInProgressClose}
                onRequestClose={workInProgressClose}
            >
                <h5 className="mb-4">Confirmation!!</h5>
                <p>Are you sure you want to set production as work in progress ??</p>
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="plain"
                        onClick={workInProgressClose}
                        size="lg"
                        type="button"
                    >
                        No
                    </Button>
                    <Button
                        variant="solid"
                        color="emerald-600"
                        onClick={() => confirmWorkInProgress(workInProgressIsOpen.id)}
                        size="lg"
                        type="button"
                    >
                        Yes
                    </Button>
                </div>
            </Dialog>
            
            <Dialog
                isOpen={allocationPendingIsOpen.isOpen}
                shouldCloseOnOverlayClick={false}
                shouldCloseOnEsc={false}
                onClose={allocationPendingClose}
                onRequestClose={allocationPendingClose}
            >
                <div className="flex flex-col items-center justify-between gap-2 h-full">
                    <h3 className="mb-4 text-center">Production Allocation Pending </h3>
                    <Formik
                        enableReinitialize={true}
                        initialValues={allocationPending}
                        innerRef={formRef}
                        validationSchema={validationSchemaAllocationPending}
                        onSubmit={(values, { resetForm, setSubmitting }) => {
                            console.log(values)
                            apiProductionAllocationPending(values, allocationPendingIsOpen.id).then(data=>{
                                // console.log(data);
                                if(data.status === 200 || data.status === 201){
                                    console.log(data);
                                    setAllocationPendingIsOpen({id:'', isOpen:false})
                                    setAllocationPending(values)
                                    toast.push(
                                        <Notification title="Success" type="success" closable>
                                            {data.data.message}
                                        </Notification>
                                    )
                                    // getProductionList()
                                }
                            })
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
                                                errors.requested_kg &&
                                                touched.requested_kg
                                            }
                                            errorMessage={errors.requested_kg}
                                        >
                                            <Field
                                                type="number"
                                                name="allocation_pending_kg"
                                                placeholder="Allocation Pending KG"
                                                suffix={'KG'}
                                                component={Input}
                                            />
                                        </FormItem>
                                        <div className="text-right">
                                            <Button
                                                className="ltr:mr-2 rtl:ml-2"
                                                onClick={allocationPendingClose}
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
                isOpen={viewIsOpen.isOpen}
                onClose={viewClose}
                onRequestClose={viewClose}
            >
                <h5 className="mb-4"> Allocations</h5>
                <div className='grid grid-cols-[50px_1fr_80px_80px_80px] gap-[10px] mb-2 font-bold'>
                    <p>Sr. No.</p>
                    <p>Product</p>
                    <p>Qty</p>
                    <p>MRP</p>
                    <p>USP</p>
                </div>
                {
                    viewIsOpen.allocations.map((data, index)=>(
                        <div key={index} className=' grid grid-cols-[50px_1fr_80px_80px_80px] gap-[10px] mb-1'>
                            <p>{index + 1}</p>
                            <p>{data.product}</p>
                            <p>{data.qty}</p>
                            <p>{data.mrp}</p>
                            <p>{data.usp}</p>
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
        </>
        
    )
}

export default AllocationQuantity
