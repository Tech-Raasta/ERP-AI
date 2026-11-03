import { Button, Dialog, FormContainer, FormItem } from 'components/ui'
import { Field, FieldArray, Formik, getIn, Form } from 'formik'
import React, {useEffect, useRef, useState } from 'react'
import Input from 'components/ui/Input'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import Select from 'components/ui/Select'
import * as Yup from 'yup'
import { FaPlus, FaTrash } from 'react-icons/fa'
import { apiPutProductionRetain, apiPutProductionWastage } from 'services/ProductionService'

const validationSchemaNew = Yup.object({
    storeReturns: Yup.array().of(
        Yup.object().shape({
            qty: Yup.number().test((value, context) => {
                const { path } = context
                if(value === undefined){
                    return context.createError({
                        path,
                        message: 'Qty is required',
                    })
                }else{
                    if(value > 0){
                        if (value > context.parent.available_qty) {
                            toast.push(
                                <Notification title="Error" type="danger" closable>Qty Should Not Greater Than Available Qty</Notification>
                            )
                            return context.createError({
                                path,
                                message: ' ',
                            })
                        }else{
                            return true
                        }
                    } else {
                        return context.createError({
                            path,
                            message: 'Qty is required',
                        })
                    }
                }
            }),
            raw_material_id: Yup.number().required('Product is required'),
            barcode: Yup.string().required('Barcode is required'),
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

const KeepInProduction = ({type, data, isOpen, getData}) => {

    // const [storeMaterials, setStoreMaterials] = useState([])
    const [isConfirm, setIsConfirm] = useState(false)
    const formRef = useRef()
    const [masterOption, setMasterOption] = useState([])
    const [loading, setLoading] = useState(false)

    const keepClose = ()=>{
        getData('closed',false)
        // console.log(formRef.current.resetForm   )
    }

    const isConfirmClose = ()=>{
        setIsConfirm(false)
    }
    const confirmKeep = ()=>{
        console.log(formRef.current.values)
        if(type){
            apiPutProductionWastage(
                formRef.current.values,
                data.return_id
            )
                .then((res) => {
                    // console.log(res)
                    if (res.status === 200) {
                        toast.push(
                            <Notification
                                title="Success"
                                type="success"
                                closable
                            >
                                {res.data['message']}
                            </Notification>
                        )
                        setIsConfirm(false)
                        getData('saved',false)
                        // getProductionList()
                        // socket.emit('AllProduction', 'Saurabh')
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
        }else{
            apiPutProductionRetain(
                formRef.current.values,
                data.return_id
            )
                .then((res) => {
                    // console.log(res)
                    if (res.status === 200) {
                        toast.push(
                            <Notification
                                title="Success"
                                type="success"
                                closable
                            >
                                {res.data['message']}
                            </Notification>
                        )
                        setIsConfirm(false)
                        getData('saved',false)
                        // getProductionList()
                        // socket.emit('AllProduction', 'Saurabh')
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
        }

    }

    const handleItemSelect = (option, field, index) => {
        const form = formRef.current
        console.log(option, index)
        form.setFieldValue(field.name, option?.value)
        form.setFieldValue(`storeReturns[${index}].barcode`, '')
        form.setFieldValue(`storeReturns[${index}].available_qty`, '')
        form.setFieldValue(`storeReturns[${index}].qty`, '')
        form.setFieldValue(`storeReturns[${index}].expiry_date`, '')
        setLoading(true)
        let barcodes = option.barcode.map((values)=>{
            return { value:values.barcode,  label:values.barcode, id: values.raw_material_id, available_qty: values.available_qty, expiry_date: values.expiry_date}
        })
        setMasterOption((prev)=>{
            let a = prev.map((value,indx)=>{
                console.log('Index:', index);
                if(indx === index){
                    return barcodes;
                }else{
                    return value
                }
            })
            setLoading(false)
            return a
        })
    }

    const handleBarcodeSelect = (option,field,index)=>{
        const form = formRef.current
        form.setFieldValue(field.name, option?.value)
        // console.log(option, field, index)
        form.setFieldValue(`storeReturns[${index}].qty`, option?.available_qty)
        form.setFieldValue(`storeReturns[${index}].available_qty`, option?.available_qty)
        form.setFieldValue(`storeReturns[${index}].expiry_date`, option?.expiry_date)
    }

    useEffect(() => {
        masterOp();
    }, [])

    const masterOp = () => {
        console.log(type, data)
        const mainData = type ? data ? data.production['productionWastes'] :[] : data ? data.production['productionRetains'] : [];

        mainData.forEach((val, index)=>{
            data.rawMaterials.forEach((rm, index2)=>{
                if(val.raw_material_id === rm.value){
                    let barcodes = rm.barcode.map((values)=>{
                        return { value:values.barcode,  label:values.barcode, available_qty: val.qty, expiry_date: val.expiry_date}
                    })
                    if (typeof masterOption[index] === 'undefined') {
                        setMasterOption((prev)=> {
                            if (prev.length > 0) {
                                return [...prev, barcodes];
                            } else {
                                return [barcodes];
                            }
                        });
                    } else {
                        setMasterOption((prev)=>{
                            let a = prev.map((value,indx)=>{
                                if(indx === index){
                                    return barcodes;
                                }else{
                                    return value
                                }
                            })
                            setLoading(false)
                            return a
                        })
                    }
                }
            })
        })
    }

    return (
        <>
            <Dialog isOpen={isOpen} onClose={keepClose} onRequestClose={keepClose} width={700}>
                <h5 className="mb-4"> Insert Qty {type ? 'For Wastage' : 'To Keep In Production'}</h5>
                <Formik 
                    enableReinitialize={true} 
                    innerRef={formRef}
                    validationSchema={validationSchemaNew} 
                    initialValues={{storeReturns: type ? data ? data.production['productionWastes'] :[] : data ? data.production['productionRetains'] : [],}} 
                    onSubmit={(values) => {
                        // console.log(values)
                        setIsConfirm(true)
                    }}
                >
                    {({ touched, errors, values }) => {
                        const storeReturns = values.storeReturns
                        return (
                            <Form>
                                <FormContainer>
                                    <FieldArray name="storeReturns">
                                        {({ form, remove, push }) => (
                                            <>
                                                <div className='flex items-center justify-start gap-[40px] mb-4'>
                                                    <p className='w-[200px]'><b><span className='text-rose-600'>*</span> Select Raw Material</b></p>
                                                    <p className='w-[210px]'><b><span className='text-rose-600'>*</span> Select Barcode</b></p>
                                                    <p className='w-[90px]'><b><span className='text-rose-600'>*</span> Qty</b></p>
                                                    <p></p>
                                                </div>
                                                <div className='overflow-y-auto h-[320px]'>
                                                    {storeReturns &&
                                                        storeReturns.length > 0 ? (
                                                        storeReturns.map(
                                                            (_, index) => {
                                                                const qty = fieldFeedback(form, `storeReturns[${index}].qty`)
                                                                const raw_material_id = fieldFeedback(form, `storeReturns[${index}].raw_material_id`)
                                                                const barcode = fieldFeedback(form, `storeReturns[${index}].barcode`)

                                                                // console.log(masterOption);

                                                                return (
                                                                    <div key={index} className="flex items-center justify-between gap-1 rounded mb-5 mt-1">
                                                                        <FormItem
                                                                            className="mb-0 custom-text-left w-[200px]"
                                                                            invalid={raw_material_id.invalid}
                                                                            errorMessage={raw_material_id.errorMessage}
                                                                        >
                                                                            <Field name={`storeReturns[${index}].raw_material_id`}>
                                                                                {({ field, form, }) => (
                                                                                    <Select
                                                                                    className="custom-text-left text-left"
                                                                                    field={field}
                                                                                    form={form}
                                                                                    options={data.rawMaterials ? data.rawMaterials : []}
                                                                                    value={data.rawMaterials ? data.rawMaterials.filter((option) =>option.value === values.storeReturns[index].raw_material_id): values.storeReturns[index].raw_material_id}
                                                                                    // value={values.storeReturns[index].raw_material_id}
                                                                                    onChange={(option,field) =>handleItemSelect(option,field,index)}
                                                                                />
                                                                            )}
                                                                            </Field>
                                                                        </FormItem>
                                                                        <FormItem
                                                                            className="mb-0 custom-text-left w-[220px]"
                                                                            invalid={barcode.invalid}
                                                                            errorMessage={barcode.errorMessage}
                                                                        >
                                                                            <Field name={`storeReturns[${index}].barcode`}>
                                                                                {({ field, form, }) => (
                                                                                    <Select
                                                                                    className="custom-text-left text-left"
                                                                                    field={field}
                                                                                    form={form}
                                                                                    options={masterOption.length > 0 ? masterOption[index] : []}
                                                                                    isLoading={loading}
                                                                                    value={ masterOption[index] ? masterOption[index].filter((option) =>option.value === values.storeReturns[index].barcode) : values.storeReturns[index].barcode}
                                                                                    // value={values.storeReturns[index].barcode}
                                                                                    onChange={(option,field) =>handleBarcodeSelect(option,field,index)}
                                                                                />
                                                                                )}
                                                                            </Field>
                                                                        </FormItem>
                                                                        <FormItem invalid={qty.invalid} errorMessage={qty.errorMessage} className={'mb-0 w-[90px]'}>
                                                                            <Field invalid={qty.invalid} placeholder="Qty" suffix={'KG'} name={`storeReturns[${index}].qty`} type="number" component={Input} />
                                                                        </FormItem>
                                                                        <Button shape="circle" size="sm" variant="solid" color="rose-500" icon={<FaTrash />}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                remove(
                                                                                    index
                                                                                )
                                                                                setMasterOption(prev=>prev.filter((_, indx)=>{return index != indx}))
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )
                                                            }
                                                        )
                                                    ) : (
                                                        <h5 className="text-center mb-5">No Data Found!!</h5>
                                                    )}
                                                </div>
                                                <div className="text-left mt-5 mb-0">
                                                    <Button variant="solid" shape="circle" type="button" icon={<FaPlus />} onClick={() => {
                                                        // console.log('Adding tab')
                                                        push({
                                                            raw_material_id:'',
                                                            barcode: '',
                                                            available_qty:'',
                                                            qty: '',
                                                            expiry_date: '',
                                                            fifo_not_followed: 0,
                                                        })
                                                        setMasterOption(prev =>[...prev, []])
                                                    }}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </FieldArray>
                                </FormContainer>
                                <div className="text-right mt-6">
                                    <Button className="ltr:mr-2 rtl:ml-2" variant="solid" color="rose-600" onClick={keepClose} size="lg" type="button">
                                        No
                                    </Button>
                                    <Button variant="solid" color="emerald-600" size="lg" type="submit" // onClick={()=> handleSubmit()}
                                    >
                                        Yes
                                    </Button>
                                </div>
                            </Form>
                        )
                    }}
                </Formik>
            </Dialog>
            <Dialog
                isOpen={isConfirm}
                onClose={isConfirmClose}
                onRequestClose={isConfirmClose}
            >
                <h5 className="mb-4">Confirmation!!</h5>
                <p>
                    Are you sure want to {type ? 'add qty in Wastage' : 'keep in production'} ??
                </p>
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="plain"
                        onClick={isConfirmClose}
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
        </>
    )
}

export default KeepInProduction