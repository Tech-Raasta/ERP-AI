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
    apiPackagingCheckQtyRequest,
    apiStoreManagerPackagingCheckQtyList,
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

const AssemblePackagingQty = () => {
    const navigate = useNavigate()
    const checkId = useParams()
    const formRef = useRef()
    const [packagingData, setPackagingData] = useState([])
    const [rawMaterialRequests, setRawMaterialRequests] = useState([])

    const apiCallGetStore = (id) => {
        apiStoreManagerPackagingCheckQtyList(id).then((data) => {
            console.log(data)
            setPackagingData(data['packaging'])
            setRawMaterialRequests(data['packaging'].packagingItemRequests)
        })
    }

    const onCheck = (value, index) => {
        console.log(value, index)
        formRef.current.setFieldValue(`rawMaterialRequests[${index}].use_production_stock`, value ? 1 : 0)
    }

    useEffect(() => {
        const fetchData = () => {
            if (checkId.bmid) {
                apiCallGetStore(checkId.bmid)
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
                    apiPackagingCheckQtyRequest(values, checkId.bmid)
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
                            navigate('/production/store-manager', {
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
                                            {"Packaging-"+packagingData.id} (<span className=" text-rose-500">{packagingData.store_kg}</span>/{packagingData.store_requested_kg})
                                        </h5>
                                        <div>
                                            <Button
                                                type="button"
                                                onClick={() => {
                                                    navigate(
                                                        '/production/store-manager',
                                                        {
                                                            replace: true,
                                                        }
                                                    )
                                                }}
                                            >
                                                Back
                                            </Button>
                                        </div>
                                    </div>
                                    <div className='flex items-center justify-between gap-2 px-2 py-1 mb-3'>
                                        <p className='flex items-center justify-between gap-5 font-bold text-base flex-wrap'>
                                            <span className='w-[250px]'></span>
                                            <span className='w-[120px]'>Required Qty</span>
                                            <span className='w-[120px]'>Allocated Qty</span>
                                            {/* <span className='w-[120px]'>Not In Store</span> */}
                                        </p>
                                        <div></div>
                                    </div>
                                    <FieldArray name="rawMaterialRequests">
                                        {({ form, remove, push }) => (
                                            <div>
                                                {rawMaterialRequests &&
                                                rawMaterialRequests.length > 0 ? (
                                                    rawMaterialRequests.map(
                                                        (_, index) => {
                                                            const use_production_stock = fieldFeedback(form, `rawMaterialRequests[${index}].use_production_stock`)

                                                            return (
                                                                // ${rawMaterialRequests[index].fifo_not_followed ? 'bg-rose-100' : 'bg-slate-50' }
                                                                <div key={index} className={`flex items-center justify-between gap-2 px-2 py-1 rounded mb-5 bg-slate-50 ${rawMaterialRequests[index].store_requested_kg == 0 ? 'hidden' : 'visible'}`} >
                                                                    <div className="flex items-center justify-between gap-5 flex-wrap">
                                                                        <h6 className='mb-0 w-[250px] text-gray-600'>{rawMaterialRequests[index].rawMaterial['rm_name']}</h6>
                                                                        <p className='w-[120px]'><b>{rawMaterialRequests[index].store_requested_kg}</b></p>
                                                                        <p className='w-[120px]'><b>{rawMaterialRequests[index].store_kg}</b></p>
                                                                        <Button type="button" variant="solid" color="blue-600" onClick={()=>{navigate(`/production/store-manager/add-packaging-material/${checkId.bmid}/${rawMaterialRequests[index].id}`)}}>Scan</Button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        }
                                                    )
                                                ) : (
                                                    <h5 className="text-center mb-5">
                                                        Nothing in Production Request
                                                    </h5>
                                                )}
                                            </div>
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

export default AssemblePackagingQty
