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
import Checkbox from 'components/ui/Checkbox'
import * as Yup from 'yup'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiProductionCheckQtyList,
    apiProductionCheckQtyRequest,
} from 'services/ProductionService'
import { io } from 'socket.io-client'

import appConfig from 'configs/app.config'

const validationSchema = Yup.object({
    rawMaterialRequests: Yup.array().of(
        Yup.object().shape({
            use_production_stock: Yup.boolean()
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

    const apiCallGetStore = (id) => {
        apiProductionCheckQtyList(id).then((data) => {
            console.log(data)
            setProductionData(data['production'])
            setRawMaterialRequests(data['rawMaterialRequests'])
        })
    }

    const onCheck = (value, index) => {
        console.log(value, index)
        formRef.current.setFieldValue(`rawMaterialRequests[${index}].use_production_stock`, value ? 1 : 0)
    }

    useEffect(() => {
        const fetchData = () => {
            if (checkId.cid) {
                apiCallGetStore(checkId.cid)
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
                    console.log(values)
                    apiProductionCheckQtyRequest(values, checkId.cid)
                        .then((data) => {
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
                                            {productionData.product ? productionData.product['short_name'] : ''} ({productionData.requested_kg}KG)
                                        </h5>
                                        <div>
                                            {
                                                productionData.check_batch_qty === 1 ? (
                                                    <Button
                                                        type="button"
                                                        variant="solid"
                                                        color="blue-600"
                                                        className="ltr:mr-5 sm:mb-3"
                                                        onClick={() => {
                                                            navigate(
                                                                `/production/production-floor-manager/check-batch-edit/${checkId.cid}`
                                                            )
                                                        }}
                                                    >
                                                        Edit
                                                    </Button>
                                                ):null
                                            }
                                            <Button
                                                type="button"
                                                className="ltr:mr-5 sm:mb-3"
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
                                            <Button
                                                type="submit"
                                                variant="solid"
                                            >
                                                Request For RM
                                            </Button>
                                        </div>
                                    </div>
                                    <p className='grid grid-cols-2 md:grid-cols-[300px_120px_180px_120px] px-2 py-1 gap-2 mb-5 font-bold text-base flex-wrap'>
                                        <span></span>
                                        <span>Required Kg</span>
                                        <span>Use Available Kg</span>
                                        {
                                            productionData.check_batch_qty === 0 ? (
                                                <span>Store Kg</span>
                                            ):null
                                        }
                                        
                                    </p>
                                    {/* <div className='flex items-center justify-between gap-2 px-2 py-1 mb-3'>
                                        <div></div>
                                    </div> */}
                                    <FieldArray name="rawMaterialRequests">
                                        {({ form, remove, push }) => (
                                            <>
                                                {rawMaterialRequests &&
                                                rawMaterialRequests.length > 0 ? (
                                                    rawMaterialRequests.map(
                                                        (_, index) => {
                                                            const use_production_stock = fieldFeedback(form, `rawMaterialRequests[${index}].use_production_stock`)

                                                            return (
                                                                // <div key={index} className={`flex items-center justify-between gap-2 px-2 py-1 rounded mb-5 ${rawMaterialRequests[index].fifo_not_followed ? 'bg-rose-100' : 'bg-slate-50' }`} >
                                                                // ${rawMaterialRequests[index].fifo_not_followed ? 'bg-rose-100' : 'bg-slate-50'}
                                                                    <div key={index} className={`grid grid-cols-2 md:grid-cols-[300px_120px_180px_120px] px-2 py-1 gap-2 rounded mb-5 bg-slate-50 `}>
                                                                        <h6 className='mb-0 text-gray-600'>{rawMaterialRequests[index].rawMaterial['rm_name']}</h6>
                                                                        <p><b>{rawMaterialRequests[index].approved_kg} Kg</b></p>
                                                                        {
                                                                            rawMaterialRequests[index].available_kg > 0 ? (

                                                                                <FormItem
                                                                                    invalid={use_production_stock.invalid}
                                                                                    errorMessage={use_production_stock.errorMessage}
                                                                                    className="mb-0"
                                                                                >
                                                                                    <Field
                                                                                        name={`rawMaterialRequests[${index}].use_production_stock`}
                                                                                    >
                                                                                        {({ field, form }) => (
                                                                                            <Checkbox  
                                                                                                defaultChecked={rawMaterialRequests[index].use_production_stock === 1 ? true : false}
                                                                                                value={`rawMaterialRequests[${index}].use_production_stock`} onChange={(value, e)=>onCheck(value, index)}>
                                                                                                {rawMaterialRequests[index].available_kg}KG available
                                                                                            </Checkbox>
                                                                                        )}
                                                                                    </Field>
                                                                                </FormItem>
                                                                            ):(
                                                                                <p></p>
                                                                            )
                                                                        }
                                                                        {
                                                                            productionData.check_batch_qty === 0 ? (
                                                                                <p><b>{rawMaterialRequests[index].store_kg} Kg</b></p>
                                                                            ):null
                                                                        }
                                                                    </div>
                                                                // </div>
                                                            )
                                                        }
                                                    )
                                                ) : (
                                                    <h5 className="text-center mb-5">
                                                        Nothing in Production Request
                                                    </h5>
                                                )}
                                            </>
                                        )}
                                    </FieldArray>
                                </div>
                            </FormContainer>
                        </Form>
                    )
                }}
            </Formik>
        </Card>
    )
}

export default CheckBatchQty
