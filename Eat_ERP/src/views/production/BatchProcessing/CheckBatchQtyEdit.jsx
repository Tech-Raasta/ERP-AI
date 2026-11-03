import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from 'components/ui'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import { FormItem, FormContainer } from 'components/ui'
import Input from 'components/ui/Input'
import Button from 'components/ui/Buttons'
import { FaTrash } from 'react-icons/fa'
import { HiOutlinePlus } from 'react-icons/hi'
import Select from 'components/ui/Select'
import * as Yup from 'yup'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiProductionCheckQtyApprove,
    apiProductionCheckQtyList,
    apiProductionCheckQtyPut,
    apiProductionCheckQtyReject,
} from 'services/ProductionService'

import { io } from 'socket.io-client'

import appConfig from 'configs/app.config'

const validationSchema = Yup.object({
    rawMaterialRequests: Yup.array().of(
        Yup.object().shape({
            raw_material_id: Yup.number().required(' '),
            requested_kg: Yup.number().required(' '),
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

const CheckBatchQty = () => {
    const navigate = useNavigate()
    const checkId = useParams()
    const formRef = useRef()
    const [productionData, setProductionData] = useState([])
    const [rawMaterialRequests, setRawMaterialRequests] = useState([])
    const [rawMaterial, setRawMaterial] = useState([])
    const [finalCount, setFinalCount] = useState(0);
    const [submitIsOpen, setSubmitIsOpen] = useState({
        isOpen: false,
        status:'',
    })

    const countTotalKg = () => {
        setTimeout(() => {
            let calcTotal = 0
            formRef.current.values['rawMaterialRequests'].forEach((element) =>{calcTotal+= parseFloat(element.requested_kg)})
            setFinalCount(isNaN(calcTotal) ? 0 : (Math.round(calcTotal)))
        }, 100)
    }

    const apiCallGetStore = (id) => {
        apiProductionCheckQtyList(id).then((data) => {
            console.log(data)
            setProductionData(data['production'])
            setRawMaterialRequests(data['rawMaterialRequests'])
            setRawMaterial(prev=>data['rawMaterial'].map(raw=> {return {value: raw.id, label: raw.rm_name}}))
            countTotalKg()
        })
    }

    const approve = ()=>{
        apiProductionCheckQtyApprove(formRef.current.values, checkId.approveid).then((data) => {
            console.log(data)
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
            setSubmitIsOpen({isOpen:false, status:''})
            navigate('/production/production-manager', {
                replace: true,
            })
        }).catch((error) => {
            toast.push(
                <Notification
                    title="Error"
                    type="danger"
                    closable
                >
                    {error.response['data'].message}
                </Notification>
            )
        })
    }

    const reject = ()=>{
        apiProductionCheckQtyReject(formRef.current.values, checkId.approveid).then((data) => {
            console.log(data)
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
            setSubmitIsOpen({isOpen:false, status:''})
            navigate('/production/production-manager', {
                replace: true,
            })
        }).catch((error) => {
            toast.push(
                <Notification
                    title="Error"
                    type="danger"
                    closable
                >
                    {error.response['data'].message}
                </Notification>
            )
        })
    }
    
    const submitClose = () => {
        setSubmitIsOpen({
            isOpen: false,
            status: '',
        })
    }

    useEffect(() => {
        const fetchData = () => {
            if (checkId.cid) {
                apiCallGetStore(checkId.cid)
            }else{
                apiCallGetStore(checkId.approveid)
            }
        }
        fetchData()
    }, [])
    return (
        <Card className=" card-shadow mb-4">
            <Formik
                enableReinitialize={true}
                innerRef={formRef}
                validationSchema={validationSchema}
                initialValues={{rawMaterialRequests}}
                onSubmit={(values) => {
                    apiProductionCheckQtyPut(values, checkId.cid).then((data) => {
                        console.log(data)
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
                        navigate('/production/production-floor-manager', {
                            replace: true,
                        })
                    }).catch((error) => {
                        toast.push(
                            <Notification
                                title="Error"
                                type="danger"
                                closable
                            >
                                {error.response['data'].message}
                            </Notification>
                        )
                    })
                }}
            >
                {({ touched, errors, values }) => {
                    const rawMaterialRequests = values.rawMaterialRequests
                    return (
                        <Form>
                            <FormContainer layout="inline">
                                <div className="w-full">
                                    <div className="mb-8 flex items-center justify-between">
                                        <h5>
                                            {productionData.product ? productionData.product['short_name'] : ''} (
                                            <span className=" text-rose-500">
                                                {finalCount}
                                            </span>
                                            /{productionData.requested_kg}KG)
                                        </h5>
                                        <div className='flex'>
                                            <Button
                                                type="button"
                                                className="ltr:mr-5 sm:mb-3"
                                                onClick={() => {
                                                    navigate(
                                                        `/production/${checkId.approveid ? 'production-manager' : 'production-floor-manager'}`,
                                                        {
                                                            replace: true,
                                                        }
                                                    )
                                                }}
                                            >
                                                Back
                                            </Button>
                                            {
                                                checkId.approveid ? (
                                                    <div>
                                                        <Button
                                                            type="button"
                                                            className="ltr:mr-5 sm:mb-3"
                                                            variant="solid"
                                                            color="rose-600"
                                                            onClick={() => {
                                                                setSubmitIsOpen({isOpen:true, status:'reject'})
                                                            }}
                                                        >
                                                            Reject
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="solid"
                                                            color="emerald-600"
                                                            onClick={() => {
                                                                setSubmitIsOpen({isOpen:true, status:'approve'})
                                                            }}
                                                        >
                                                            Approve
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    
                                                    <Button
                                                        type="submit"
                                                        variant="solid"
                                                    >
                                                        Submit For Approval
                                                    </Button>
                                                )
                                            }
                                        </div>
                                    </div>
                                    <div className='flex items-center justify-between gap-2 px-2 py-1 mb-3'>
                                        <p className='flex items-center justify-between gap-5 font-bold text-base flex-wrap'>
                                            <span className='w-[250px]'></span>
                                            <span className='w-[120px]'>Required Kg</span>
                                            <span className='w-[120px]'>Actual Kg</span>
                                        </p>
                                        <div></div>
                                    </div>
                                    <FieldArray name="rawMaterialRequests">
                                        {({ form, remove, push }) => (
                                            <>
                                                {rawMaterialRequests &&
                                                rawMaterialRequests.length > 0 ? (
                                                    rawMaterialRequests.map(
                                                        (_, index) => {

                                                            const raw_material_id = fieldFeedback(form, `rawMaterialRequests[${index}].raw_material_id`)
                                                            const requested_kg = fieldFeedback(form, `rawMaterialRequests[${index}].requested_kg`)

                                                            return (
                                                                <>
                                                                {/* // <div key={index} className={`flex items-center justify-between gap-2 px-2 py-1 rounded mb-5 ${rawMaterialRequests[index].fifo_not_followed ? 'bg-rose-100' : 'bg-slate-50' }`} > */}
                                                                {/* ${rawMaterialRequests[index].fifo_not_followed ? 'bg-rose-100' : 'bg-slate-50'} */}
                                                                    <div className={`grid grid-cols-2 md:grid-cols-[300px_120px_180px_120px] px-2 py-1 gap-2 rounded mb-5 bg-slate-50 `}>
                                                                        {/* <h5>{rawMaterialRequests[index].rawMaterial['rm_name']}</h5> */}
                                                                        <FormItem
                                                                            invalid={raw_material_id.invalid}
                                                                            errorMessage={raw_material_id.errorMessage}
                                                                            className='mb-0'
                                                                            layout="vertical"
                                                                        >
                                                                            <Field name={`rawMaterialRequests[${index}].raw_material_id`}>
                                                                                {({ field, form }) => (
                                                                                    <Select
                                                                                        field={field}
                                                                                        form={form}
                                                                                        options={rawMaterial}
                                                                                        value={rawMaterial.filter(
                                                                                            (option) =>
                                                                                                option.value === values.rawMaterialRequests[index].raw_material_id
                                                                                        )}
                                                                                        onChange={(option) => {
                                                                                            return form.setFieldValue(
                                                                                                `rawMaterialRequests[${index}].raw_material_id`,
                                                                                                option?.value
                                                                                            )
                                                                                        }}
                                                                                        isDisabled={rawMaterialRequests[index].id !== ""}
                                                                                    />
                                                                                )}
                                                                            </Field>
                                                                        </FormItem>
                                                                        <p><b>{(Math.round(rawMaterialRequests[index].required_kg * 10000))/10000} Kg</b></p>
                                                                        <FormItem
                                                                            invalid={requested_kg.invalid}
                                                                            errorMessage={requested_kg.errorMessage}
                                                                            className='mb-0'
                                                                        >
                                                                            <Field
                                                                                name={`rawMaterialRequests[${index}].requested_kg`}
                                                                                >
                                                                            {({ field, form }) => (
                                                                                <Input
                                                                                    type="number"
                                                                                    suffix='Kg'
                                                                                    field={field}
                                                                                    invalid={requested_kg.invalid}
                                                                                    placeholder="Actual Kg"
                                                                                    form={form}
                                                                                    value={rawMaterialRequests[index].requested_kg}
                                                                                    onChange={(option) =>{
                                                                                            countTotalKg()
                                                                                            form.setFieldValue(
                                                                                                `rawMaterialRequests[${index}].requested_kg`,
                                                                                                (option.target.value)
                                                                                            )
                                                                                        }
                                                                                    }
                                                                                    disabled={checkId.approveid}
                                                                                />
                                                                            )}   
                                                                            </Field>
                                                                        </FormItem>
                                                                    </div>
                                                                    {rawMaterialRequests[index].id == "" ? (
                                                                        <div>
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
                                                                                    remove(index)
                                                                                    countTotalKg()
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    ) : null}
                                                                </>
                                                            )
                                                        }
                                                    )
                                                ) : (
                                                    <h5 className="text-center mb-5">
                                                        Nothing in Production Request
                                                    </h5>
                                                )}
                                                <>
                                                    {
                                                        checkId.cid ? (
                                                            <div className="mb-5">
                                                                <Button
                                                                    type="button"
                                                                    shape="circle"
                                                                    icon={
                                                                        <HiOutlinePlus />
                                                                    }
                                                                    onClick={() => {
                                                                        console.log('Add Production')
                                                                        push({
                                                                            id:'',
                                                                            raw_material_id:'',
                                                                            required_kg:0,
                                                                            requested_kg:'',
                                                                            approved_kg:0,
                                                                        })
                                                                    }}
                                                                />
                                                            </div>
                                                        ):null
                                                    }
                                                </>
                                            </>
                                        )}
                                    </FieldArray>
                                </div>
                            </FormContainer>
                        </Form>
                    )
                }}
            </Formik>
            <Dialog
                isOpen={submitIsOpen.isOpen}
                onClose={submitClose}
                onRequestClose={submitClose}
            >
                <h5 className="mb-4">Confirmation!!</h5>
                <p>Are you sure want to {submitIsOpen.status} ??</p>
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
                        onClick={() =>{
                            if(submitIsOpen.status === 'approve'){
                                approve()
                            }else if(submitIsOpen.status === 'reject'){
                                reject()
                            }
                        }}
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

export default CheckBatchQty
