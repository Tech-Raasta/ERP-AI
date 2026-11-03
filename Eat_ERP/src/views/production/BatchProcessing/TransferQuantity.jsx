import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from 'components/ui'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import { FormItem, FormContainer } from 'components/ui'
import Input from 'components/ui/Input'
import Button from 'components/ui/Buttons'
import Select from 'components/ui/Select'
import { FaTrash } from 'react-icons/fa'
import { HiOutlinePlus } from 'react-icons/hi'
import * as Yup from 'yup'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiProductionAllocatePut,
    apiProductionTransferDelete,
    apiProductionTransferList,
    apiProductionTransferPut,
} from 'services/ProductionService'
import Camera, { FACING_MODES } from 'react-html5-camera-photo'
import 'react-html5-camera-photo/build/css/index.css'
import { HiOutlineCamera, HiOutlineEye } from 'react-icons/hi'

import { io } from 'socket.io-client'
import appConfig from 'configs/app.config'

const socket = io(appConfig.socketUrl)

const validationSchema = Yup.object({
    store_id: Yup.number().required('Depot is required'),
    box: Yup.array().of(
        Yup.object().shape({
            productionTransfers: Yup.array().of(
                Yup.object().shape({
                    qty: Yup.number()
                        .required('Qty required')
                        .moreThan(0, 'Qty required'),
                    doc_document: Yup.string().required('Photo is required'),
                })
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

const TransferQuantity = () => {
    const navigate = useNavigate()
    const transferId = useParams()
    const formRef = useRef()
    const [dataBox, setDataBox] = useState([])
    const [countKg, setCountKg] = useState([])
    const [finalCount, setFinalCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [product, setProduct] = useState({
        product_name: '',
        output_kg: '',
        transferred_kg: '',
        transfer: false,
        store_id: '',
        status: ''
    })
    const [depotOption, setDepotOption] = useState([])
    const [photoIsOpen, setPhotoIsOpen] = useState(false)
    const [showIsOpen, setShowIsOpen] = useState({
        isOpen: false,
        data: '',
    })
    const [photo, setPhoto] = useState({
        box_id: '',
        allocation_id: '',
    })

    // const [dataUri, setDataUri] = useState('')

    function handleTakePhotoAnimationDone(data) {
        formRef.current.setFieldValue(
            `box[${photo.box_id}].productionTransfers[${photo.allocation_id}].doc_document`,
            data
        )
        setPhotoIsOpen(false)
        // setPhoto(prev=>({...prev, uri:data}))
    }

    const handlePhoto = (i, index) => {
        setPhoto({ box_id: i, allocation_id: index })
        setPhotoIsOpen(true)
    }

    const photoClose = () => {
        setPhotoIsOpen(false)
    }

    const apiCallGetStore = (id) => {
        apiProductionTransferList(id).then((data) => {
            console.log(data)
            setProduct({
                product_name: data.production.product
                    ? data.production.product['short_name']
                    : '',
                output_kg: data.production.output_kg,
                transferred_kg: data.production.transferred_kg,
                transfer: data.production.transfer === 1 ? true : false,
                store_id: data.production.store_id,
                status: data.production.status
            })
            setDepotOption(
                data['depots'].map((value) => {
                    return {
                        label: value.depot_name,
                        value: value.id,
                    }
                })
            )
            setLoading(false)
            setDataBox(data.data)
            countTotalKg()
        })
    }

    const countTotalKg = () => {
        setTimeout(() => {
            let totalCalc = []
            let finalCalc = []
            formRef.current.values['box'].forEach((element) => {
                let calcTotal = 0
                element.productionTransfers.forEach((data, index) => {
                    return (calcTotal += data['qty'])
                })
                let final = (parseFloat(element.box['grams']) * parseFloat(calcTotal)) / 1000
                finalCalc.push(Math.round(final * 100) / 100)
                totalCalc.push(calcTotal)
            })
            setCountKg(totalCalc)
            const finalTotal = finalCalc.reduce((acc, c) => parseFloat(acc) + parseFloat(c), 0)
            setFinalCount(finalTotal)
        }, 100)
    }

    const showClose = () => {
        setShowIsOpen({ isOpen: false, data: '' })
    }

    const deletePending = (id)=>{
        apiProductionTransferDelete(id).then(data=>{
            console.log(data);
            toast.push(
                <Notification title="Success" type="success" closable >
                    {data.data['message']}
                </Notification>
            )
        }).catch(error=>{
            console.log(error)
            let err = error.response;
            toast.push(
                <Notification title="Error" type="danger" closable>
                    {err['data'].message}
                </Notification>
            )
        })
    }

    useEffect(() => {
        const fetchData = () => {
            if (transferId.tid) {
                apiCallGetStore(transferId.tid)
            } else if (transferId.edittid) {
                apiCallGetStore(transferId.edittid)
            } else {
                if (localStorage.getItem('store_id')) {
                    setProduct((prev) => ({ ...prev, store_id: localStorage.getItem('store_id') }))
                }
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
                initialValues={{
                    store_id: product.store_id,
                    box: dataBox,
                }}
                onSubmit={(values) => {
                    const data = []
                    // console.log(values)
                    values.box.forEach((transferredData, index) => {
                        transferredData.productionTransfers.map((finalData, index) => data.push(finalData))})
                    // console.log(data)
                    if (data.length > 0) {
                        // alert(JSON.stringify(values, null, 2))
                        apiProductionTransferPut({ store_id: values.store_id, productionTransfers: data,}, transferId.tid ? transferId.tid : transferId.edittid).then((data) => {
                            // alert(JSON.stringify(data))
                            if (data.status === 200) {
                                // setProduct((prev) => ({
                                //     ...prev,
                                //     output_kg:
                                //         data.data['production'].output_kg,
                                // }))
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
                                localStorage.setItem('store_id', values.store_id)
                            } else {
                                console.log(data);
                                toast.push(
                                    <Notification
                                        title="Error"
                                        type="danger"
                                        closable
                                    >
                                        {data.response['data'].message}
                                    </Notification>
                                )
                            }

                            navigate(`/production/production-floor-manager`, {replace: true,})
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
                    } else {
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                Please Add Atleast 1 Product.
                            </Notification>
                        )
                    }
                }}
            >
                {({ touched, errors, values }) => {
                    const box = values.box
                    const productionTransfers = box.map(
                        (value, index) => value.productionTransfers
                    )
                    return (
                        <Form>
                            <FormContainer layout="inline">
                                <div className="w-full">
                                    <div className="mb-8 flex items-center justify-between">
                                        <h5>
                                            {product.product_name} (
                                            <span className=" text-rose-500">
                                                {finalCount}
                                            </span>
                                            /{product.output_kg}KG)
                                        </h5>
                                        <div>
                                            <Button
                                                type="button"
                                                className="ltr:mr-5 rtl:ml-3"
                                                onClick={() => {
                                                    navigate(
                                                        `/production/production-floor-manager/add-batch/${transferId.tid}`,
                                                        {
                                                            replace: true,
                                                        }
                                                    )
                                                }}
                                            >
                                                Back
                                            </Button>
                                            {
                                                product.status === 'Approved' && product.transferred_kg >= product.output_kg ? null : (
                                                    <Button
                                                        type="submit"
                                                        variant="solid"
                                                        disabled={product.status === 'Approved' && product.transferred_kg >= product.output_kg}
                                                    >
                                                        Save
                                                    </Button>
                                                )
                                            }
                                        </div>
                                    </div>
                                    <div className="flex justify-end items-center mb-5">
                                        <FormItem
                                            className="mb-0 font-normal"
                                            invalid={
                                                errors.store_id &&
                                                touched.store_id
                                            }
                                            errorMessage={errors.store_id}
                                        >
                                            <Field name="store_id">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={depotOption}
                                                        // onFocus={onFocus}
                                                        isLoading={loading}
                                                        className="w-[220px]"
                                                        value={depotOption.filter(
                                                            (option) =>
                                                                option.value ===
                                                                values.store_id
                                                        )}
                                                        onChange={(option) => {
                                                            return form.setFieldValue(
                                                                `store_id`,
                                                                option.value
                                                            )
                                                        }}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                    </div>
                                    <FieldArray name="box">
                                        {({ form, remove, push }) => (
                                            <div>
                                                {box && box.length > 0
                                                    ? box.map((data, i) => {
                                                        const depot_id =
                                                            fieldFeedback(
                                                                form,
                                                                `box[${i}].depot_id`
                                                            )
                                                        return (
                                                            <div
                                                                key={i}
                                                                className="card shadow mb-2 p-4 bg-slate-50"
                                                            >
                                                                <h5 className="mb-4 text-center grid grid-cols-3 items-center">
                                                                    <span className="text-sm text-left">
                                                                        <span className="px-[10px] py-[5px] bg-slate-300 rounded-full mr-2">
                                                                            Total : {countKg.length > 0 ? parseFloat(countKg[i]) : '0'}
                                                                        </span>
                                                                        <span className="px-[10px] py-[5px] bg-slate-300 rounded-full">
                                                                            Available Qty : {data.boxAllocatedQty}
                                                                        </span>
                                                                    </span>
                                                                    <span>
                                                                        {data.box['box_name']}
                                                                    </span>
                                                                    <span className="text-sm text-gray-700 text-left">
                                                                        {/* <FormItem
                                                                              asterisk
                                                                              label="Depot"
                                                                              className="mb-0"
                                                                              invalid={
                                                                                  depot_id.invalid
                                                                              }
                                                                              errorMessage={
                                                                                  depot_id.errorMessage
                                                                              }
                                                                          >
                                                                              <Field
                                                                                  name={`box[${i}].depot_id`}
                                                                              >
                                                                                  {({
                                                                                      field,
                                                                                      form,
                                                                                  }) => (
                                                                                      <Select
                                                                                          field={
                                                                                              field
                                                                                          }
                                                                                          form={
                                                                                              form
                                                                                          }
                                                                                          options={
                                                                                              depotOption
                                                                                          }
                                                                                          // onFocus={onFocus}
                                                                                          isLoading={
                                                                                              loading
                                                                                          }
                                                                                          className="w-[220px]"
                                                                                          value={depotOption.filter(
                                                                                              (
                                                                                                  option
                                                                                              ) =>
                                                                                                  option.value ===
                                                                                                  box[
                                                                                                      i
                                                                                                  ]
                                                                                                      .depot_id
                                                                                          )}
                                                                                          onChange={(
                                                                                              option
                                                                                          ) => {
                                                                                              return form.setFieldValue(
                                                                                                  `box[${i}].depot_id`,
                                                                                                  option.value
                                                                                              )
                                                                                          }}
                                                                                      />
                                                                                  )}
                                                                              </Field>
                                                                          </FormItem> */}
                                                                    </span>
                                                                </h5>
                                                                <FieldArray
                                                                    name={`box[${i}].productionTransfers`}
                                                                >
                                                                    {({
                                                                        form,
                                                                        remove,
                                                                        push,
                                                                    }) => (
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            {box[i].productionTransfers && box[i].productionTransfers.length > 0 ? (
                                                                                box[i].productionTransfers.map((_, index) => {
                                                                                    const qty = fieldFeedback(form, `box[${i}].productionTransfers[${index}].qty`)
                                                                                    const doc_document = fieldFeedback(form, `box[${i}].productionTransfers[${index}].doc_document`)
                                                                                    const transfer_date = new Date(box[i].productionTransfers[index].modified_on)
                                                                                    const approved_date = new Date(box[i].productionTransfers[index].approved_on)
                                                                                    return (
                                                                                        <div
                                                                                            key={index}
                                                                                            className={`flex flex-col items-center w-[340px] justify-start gap-2 px-2 py-1 rounded w-full ${productionTransfers[i][index].status == "Approved" ? 'bg-emerald-200' : productionTransfers[i][index].status == "Rejected" ? 'bg-rose-200' : 'bg-amber-100' } `}
                                                                                        >
                                                                                            <div className='flex items-center gap-2 justify-between w-full'>
                                                                                                <div className="flex items-center justify-between gap-2">
                                                                                                    <FormItem
                                                                                                        asterisk
                                                                                                        label="qty"
                                                                                                        invalid={qty.invalid}
                                                                                                        errorMessage={qty.errorMessage}
                                                                                                        className={'mb-0'}
                                                                                                    >
                                                                                                        <Field
                                                                                                            invalid={qty.invalid}
                                                                                                            placeholder="Qty"
                                                                                                            suffix={'No.'}
                                                                                                            name={`box[${i}].productionTransfers[${index}].qty`}
                                                                                                            type="number"
                                                                                                            className="w-[100px]"
                                                                                                            component={Input}
                                                                                                            onChange={(e) => {
                                                                                                                let val =e.target.value =='' ? '' : parseInt(e.target.value)
                                                                                                                countTotalKg()
                                                                                                                return form.setFieldValue(`box[${i}].productionTransfers[${index}].qty`, val)
                                                                                                            }}
                                                                                                            disabled={box[i].productionTransfers[index].id === '' ? false: true}
                                                                                                        />
                                                                                                    </FormItem>
                                                                                                    {box[i].productionTransfers[index].id === '' ? (
                                                                                                        <div className="relative">
                                                                                                            <Button
                                                                                                                shape="circle"
                                                                                                                variant="solid"
                                                                                                                type="button"
                                                                                                                size="sm"
                                                                                                                icon={<HiOutlineCamera />}
                                                                                                                onClick={() => {handlePhoto(i, index) }}
                                                                                                            />
                                                                                                            <small className={`text-red-500 absolute bottom-[-20px] left-0 w-[90px] ${doc_document.invalid ? 'visible': 'hidden'}`}
                                                                                                            >
                                                                                                                {doc_document.errorMessage}
                                                                                                            </small>
                                                                                                        </div>
                                                                                                    ) : null}
                                                                                                    {box[i].productionTransfers[index].doc_document !=='' ? (
                                                                                                        <Button
                                                                                                            shape="circle"
                                                                                                            variant="solid"
                                                                                                            color="blue-600"
                                                                                                            type="button"
                                                                                                            size="sm"
                                                                                                            icon={
                                                                                                                <HiOutlineEye />
                                                                                                            }
                                                                                                            onClick={() => {
                                                                                                                setShowIsOpen(
                                                                                                                    {
                                                                                                                        isOpen: true,
                                                                                                                        data: box[i].productionTransfers[index].document_name,
                                                                                                                    }
                                                                                                                )
                                                                                                            }}
                                                                                                        />
                                                                                                    ) : null}
                                                                                                </div>
                                                                                                <Button
                                                                                                    shape="circle"
                                                                                                    size="sm"
                                                                                                    variant="solid"
                                                                                                    color="rose-500"
                                                                                                    icon={<FaTrash />}
                                                                                                    type="button"
                                                                                                    disabled={
                                                                                                        // box[i].productionTransfers[index].id === '' ? false : true
                                                                                                        productionTransfers[i][index].status == "Approved" ? true : false 
                                                                                                    }
                                                                                                    onClick={() => {
                                                                                                        if(box[i].productionTransfers[index].id != ''){
                                                                                                            deletePending(box[i].productionTransfers[index].id)
                                                                                                        }
                                                                                                        countTotalKg()
                                                                                                        remove(index)
                                                                                                    }}
                                                                                                />
                                                                                            </div>
                                                                                            <p className='mt-2 text-left w-full text-gray-700'> 
                                                                                                <b>Transfer</b> 
                                                                                                <b>{box[i].productionTransfers[index].modified_on ? " Date: ":''}</b> 
                                                                                                {box[i].productionTransfers[index].modified_on ? `${transfer_date.toLocaleDateString('en-GB')} | ` : '' } 
                                                                                                <b>{box[i].productionTransfers[index].modified_on ? `Time: ` : '' }</b>
                                                                                                {box[i].productionTransfers[index].modified_on ? `${transfer_date.toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit" })}` : ': Pending' }
                                                                                            </p>
                                                                                            <p className='text-left w-full text-gray-700'> 
                                                                                                <b>Approval</b> 
                                                                                                <b>{box[i].productionTransfers[index].approved_on ? " Date: ":''}</b> 
                                                                                                {box[i].productionTransfers[index].approved_on ? `${approved_date.toLocaleDateString('en-GB')} | ` : '' }
                                                                                                <b>{box[i].productionTransfers[index].approved_on ? `Time: ` : '' }</b>
                                                                                                {box[i].productionTransfers[index].approved_on ? `${approved_date.toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit" })}` : box[i].productionTransfers[index].status === 'Approved' ? ': Approved' : box[i].productionTransfers[index].status === 'Rejected' ? ': Rejected' :': Pending' }
                                                                                            </p>
                                                                                        </div>
                                                                                    )
                                                                                }
                                                                                )
                                                                            ) : (
                                                                                <p className="text-center text-base font-medium mb-5">
                                                                                    Add To Transfer!!
                                                                                </p>
                                                                            )}
                                                                            <div>
                                                                                {product.status === 'Approved' && product.transferred_kg >= product.output_kg ? null : (
                                                                                    <Button
                                                                                        type="button"
                                                                                        shape="circle"
                                                                                        icon={
                                                                                            <HiOutlinePlus />
                                                                                        }
                                                                                        onClick={() => {
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
                                                                                                    depot_id:
                                                                                                        '',
                                                                                                    doc_document:
                                                                                                        '',
                                                                                                    id: '',
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
                                                    })
                                                    : null}
                                            </div>
                                        )}
                                    </FieldArray>
                                </div>
                            </FormContainer>
                        </Form>
                    )
                }}
            </Formik>
            <Dialog
                isOpen={photoIsOpen}
                onClose={photoClose}
                onRequestClose={photoClose}
            >
                <Camera
                    onTakePhotoAnimationDone={(data) => {
                        handleTakePhotoAnimationDone(data)
                    }}
                    idealFacingMode={FACING_MODES.ENVIRONMENT}
                    idealResolution={{ width: 480, height: 650 }}
                    imageCompression={0.5}
                    isMaxResolution={false}
                    isImageMirror={false}
                    isSilentMode={false}
                    isDisplayStartCameraError={true}
                    isFullscreen={false}
                    sizeFactor={0.5}
                />
            </Dialog>
            <Dialog
                isOpen={showIsOpen.isOpen}
                onClose={showClose}
                onRequestClose={showClose}
                contentClassName="pb-0 pt-0 px-0 mt-8 mb-8"
                width={500}
            >
                <div className="flex justify-center items-center">
                    <img
                        src={`${appConfig.uploadUrl}production/${showIsOpen.data}`}
                        alt={showIsOpen.data}
                        className='bordered'
                        width={'100%'}
                    />
                </div>
            </Dialog>
        </Card>
    )
}

export default TransferQuantity
