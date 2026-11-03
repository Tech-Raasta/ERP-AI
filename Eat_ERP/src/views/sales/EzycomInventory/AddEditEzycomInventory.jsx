import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from 'components/ui'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import { FormItem, FormContainer } from 'components/ui'
import Input from 'components/ui/Input'
import Button from 'components/ui/Buttons'
import Checkbox from 'components/ui/Checkbox'
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
import { apiGetEzycomInventoryByID, apiPostEzycomInventory } from 'services/easyEcomService'

const validationSchema = Yup.object({
    items: Yup.array().of(
        Yup.object().shape({
            synced_qty: Yup.number().required('Atleast 0 Required').moreThan(0, 'Required qty greater than 0'),
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

const AddEditEzycomInventory = () => {
    const formRef = useRef()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()
    const productionId = useParams()

    useEffect(() => {
        const fetchData = () => {
            if (productionId.id) {
                setLoading(true)
                apiGetEzycomInventoryByID(productionId.id).then((data) => {
                    if (data.status === 200) {
                        console.log(data.data);
                        setItems(data.data['easyEcomInventory'])
                        setLoading(false)
                    }
                }).catch((error) => {
                    if (error.response.status === 401) {
                        toast.push(
                            <Notification
                                title="Error"
                                type="danger"
                                closable
                            >
                                {error.response.data['message']}
                            </Notification>
                        )
                    }
                    setLoading(false)
                })
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
                initialValues={{items: items.map(item => ({
                    id: item.id,
                    box_id: item.box_id,
                    box_name: item.box ? item.box.box_name:'',
                    sku: item.box ? item.box.sku_code:'',
                    grams: item.grams || 0,
                    qty: item.qty || 0,
                    synced_qty: item.qty || 0,
                }))
            }}
                onSubmit={(values) => {
                    console.log(values)
                    apiPostEzycomInventory(values).then((data) => {
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
                            navigate('/sales/ezycom-inventory/');
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
                {({ values }) => {
                    const items = values.items
                    return (
                        <Form >
                            <FormContainer layout="inline">
                                <div className="w-full">
                                    <div className="mb-8 flex items-center justify-between">
                                        <h5>
                                            EzyCom Inventory Upload
                                        </h5>
                                        <div className='flex gap-3'>

                                            <Button
                                                type="button"
                                                onClick={() =>
                                                    navigate('/sales/ezycom-inventory/')
                                                }
                                            >
                                                Back
                                            </Button>
                                            <Button type="submit" variant="solid"> Upload To EasyEcom</Button>
                                        </div>
                                    </div>
                                    <div className='flex items-center justify-between gap-4 py-1 mb-3'>
                                        <p className='grid grid-cols-2 md:grid-cols-[450px_120px_200px] px-2 py-1 gap-8 font-bold text-base'>
                                            <span>Production Name</span>
                                            <span>Transfered Qty</span>
                                            <span>Upload Qty</span>
                                            
                                        </p>
                                        <div></div>
                                    </div>
                                    <FieldArray name="items">
                                        {({ form }) => (
                                            <>
                                                {
                                                    items && items.length > 0 ? ( 
                                                        items.map((_, index) => {
                                                            const synced_qty = fieldFeedback(form, `items[${index}].synced_qty`)
                                                            return (
                                                                <div key={index} className={`grid grid-cols-2 md:grid-cols-[450px_120px_200px] px-2 py-1 gap-8 rounded mb-5 ${items[index].sku == ""?"bg-red-200":"bg-slate-50"} items-center`} >
                                                                    <h5 className={` text-md font-normal `}>{ items[index].box_name}</h5>
                                                                    <h6 className='text-center'>{items[index].qty}</h6>
                                                                    <FormItem
                                                                        invalid={synced_qty.invalid}
                                                                        errorMessage={synced_qty.errorMessage}
                                                                        className='mb-0'
                                                                    >
                                                                        <Field
                                                                            name={`items[${index}].synced_qty`}
                                                                            >
                                                                        {({ field, form }) => (
                                                                            <Input
                                                                                type="number"
                                                                                suffix='Qty'
                                                                                field={field}
                                                                                invalid={synced_qty.invalid}
                                                                                placeholder="Upload Qty"
                                                                                form={form}
                                                                                value={items[index].synced_qty}
                                                                                disabled={items[index].sku == ""}
                                                                                onChange={(option) =>{ form.setFieldValue(`items[${index}].synced_qty`, (option.target.value))}}
                                                                            />
                                                                        )}   
                                                                        </Field>
                                                                    </FormItem>
                                                                </div>
                                                            )
                                                        })
                                                    ) : (
                                                        <h5 className="text-center mb-5">
                                                            {loading? "Loading...": "Nothing in Production Request"}
                                                        </h5>
                                                    )
                                                }
                                                <h5 className="text-left text-xs text-rose-600 mt-7 mb-5"><sup>*</sup>SKU Not Found In Master If Marked In Red</h5>
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

export default AddEditEzycomInventory
