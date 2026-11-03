import { ConfirmDialog } from 'components/shared';
import { Button, Card, FormContainer, FormItem, Input, Notification, toast } from 'components/ui';
import { Field, FieldArray, Form, Formik, getIn } from 'formik';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiProductionTransferReceiveList, apiSyncProductionTransfer } from 'services/ProductionService';
import * as Yup from 'yup'

const validationSchema = Yup.object({
    items: Yup.array().of(
        Yup.object().shape({
            sku: Yup.string().required('SKU Code Missing in Master').test(
                'backend-error',
                function () {
                    if (this.parent.backendError) {
                        return this.createError({
                            message: this.parent.backendError
                        });
                    }
                    return true;
                }
            ),
            quantity: Yup.number().required('Quantity required').moreThan(0, 'Qty Required'),
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

const SyncToEasyEcomForm = () => {
    const navigate = useNavigate()
    const params = useParams();
    const formRef = useRef();
    const [open, setOpen] = useState(false);
    const [autoGrn, setAutoGrn] = useState({
        vendor_id: '',
        batch_code: '',
        location_key: '',
        date_of_processing: '',
        date_of_expiry: '',
        items:[
            {
                transfer_id: '',
                production_id: '',
                uploaded_to_easyecom:0,
                sku: '',
                quantity: 0,
                cost: '', 
            },            
        ]
    });
    const [productionData, setProductionData] = useState({});


    const handleConfirm = () => {
        setOpen(false);
        const form = formRef.current;
        // Deep copy only what you need to mutate
        const finalForm = {
        ...form,
        values: {
            ...form.values,
            items: form.values.items.filter(item => item.uploaded_to_easyecom !== 1)
            }
        };

        if(finalForm.values.items.length === 0) {
            toast.push(
                <Notification title="Info" type="info" closable>
                    All items are already synced to EasyEcom !!
                </Notification>
            )
            form.setSubmitting(false);
            return;
        }else {

            console.log("Final Form Values", finalForm.values);
            apiSyncProductionTransfer(finalForm.values).then((data) => {
                console.log(data);
                fetchData();
                toast.push(
                    <Notification title="Success" type="success" closable>
                        Sync to EasyEcom Successfully !!
                    </Notification>
                )
                form.setSubmitting(false);
            }).catch(error => {
                console.log("Error By Easyecom", error)
                let err = error.response;
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {err['data'].error ? err['data'].error : 'Error Syncing to EasyEcom'}
                    </Notification>
                );

                const errorMessage = err['data'].message;
                if(Array.isArray(errorMessage)){
                    form.values.items.forEach((item, index) => {
                        if(item.uploaded_to_easyecom === 0) {
                            console.log("err['data'].message", errorMessage);
                            const errorItem = errorMessage.find(error => error.SKU === item.sku);
                            const indx= errorMessage.findIndex(error => error.SKU === item.sku);
                            console.log("errorItem", errorItem);
                            if(errorItem) {
                                form.setFieldValue(
                                    `items.${index}.backendError`,
                                    errorItem.Error,
                                    false
                                );
                                form.setFieldError(`items[${index}].sku`, errorItem.Error);
                            }
                            if (indx > -1) {
                                errorMessage.splice(indx, 1);
                            }
                        };
                        console.log("Error Message After", errorMessage);
                    });
                }else{
                    toast.push(
                      <Notification title="Error" type="danger" closable>
                            {errorMessage ? errorMessage : 'Error Syncing to EasyEcom'}
                        </Notification>
                    );
                }
                console.log("Form", form.errors);
                form.setSubmitting(false);
            })
        }
    }

    const handleNo = () => {
        setOpen(false);
        const form = formRef.current;
        form.setSubmitting(false);

    }

    const fetchData = () => {
        if (params.rtid) {
            apiProductionTransferReceiveList(params.rtid).then((data) => {
                console.log(data);
                setProductionData(data['production'])
                const currentDate = new Date(data['production'].date_of_processing ? data['production'].date_of_processing : '')
                setAutoGrn({
                    vendor_id: 279193,
                    location_key: localStorage.getItem('storeDepot') ? JSON.parse(localStorage.getItem('storeDepot')).location_key : null,
                    batch_code: data['production'].batch_id_as_per_fssai,
                    date_of_processing: data['production'].date_of_processing,
                    date_of_expiry: new Date(currentDate.setMonth(currentDate.getMonth() + 6)).toLocaleDateString('sv-SE'),
                    items: data['production'].productionTransfers.reduce((acc, transfer) => {
                    if (transfer.status === "Approved") {
                        acc.push({
                        transfer_id: transfer.id,
                        production_id: transfer.production_id,
                        uploaded_to_easyecom: transfer.uploaded_to_easyecom,
                        sku: transfer.box ? transfer.box.sku_code : '',
                        quantity: transfer.uploaded_qty ? transfer.uploaded_qty :  transfer.qty ? transfer.qty : 0,
                        cost: transfer.box ? transfer.box.cost : '',
                        });
                    }
                    return acc;
                    }, [])
                })
            }).catch(error => {
                console.log(error)
                let err = error.response;
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {err['data'].message}
                    </Notification>
                )
            })
        }
    }
    useEffect(() => {
        console.log("localStorage.getItem('storeDepot').location_key", JSON.parse(localStorage.getItem('storeDepot')).location_key);
        fetchData()
    }, []);
    return (
        <Card className=" card-shadow mb-4">
            <Formik
                enableReinitialize={true}
                innerRef={formRef}
                validationSchema={validationSchema}
                initialValues={autoGrn}
                onSubmit={(values,{setSubmitting,}) => {

                    setSubmitting(true);
                    setOpen(true);
                }}
            >
                {({ touched, errors, values, isSubmitting }) => {
                    const items = values.items
                    return (
                        <Form>
                            <FormContainer layout="inline">
                                <div className="w-full">
                                    <div className="mb-8 flex items-center justify-between">
                                        <h5>
                                            {productionData.product ? productionData.product['short_name'] : ''}
                                        </h5>
                                        <div>
                                            <Button type="button" className="mr-3" onClick={() => { navigate(`/production/store-manager/receive-transfer/${params.rtid}`,{replace: true,}) }} >Back</Button>
                                            <Button type="submit" variant="solid" disabled={isSubmitting}>Sync</Button>
                                        </div>
                                    </div>
                                    <div className='flex items-center justify-between gap-2 px-2 py-1 mb-3'>
                                        <p className='flex items-center justify-between gap-5 font-bold text-base flex-wrap'>
                                            <span className='w-[350px]'>Box Name</span>
                                            <span className='w-[120px]'>Quantity</span>
                                            {/* <span className='w-[120px]'>Not In Store</span> */}
                                        </p>
                                        <div></div>
                                    </div>
                                    <FieldArray name="items">
                                        {({ form, remove, push }) => (
                                            <>
                                                { items && items.length > 0 ? (
                                                    items.map((_, index) => {
                                                        const quantity = fieldFeedback(form,`items[${index}].quantity`);
                                                        const sku = fieldFeedback(form,`items[${index}].sku`);
                                                        return (
                                                            <div key={index} className={`flex items-center justify-between gap-2 px-2 py-1 rounded mb-5 `}>
                                                                <div className="flex items-center justify-between gap-5 flex-wrap">
                                                                    <h6 className='mb-0 w-[350px] text-gray-600'>{productionData['productionTransfers'] ? productionData['productionTransfers'][index].box['box_name'] : ''}</h6>
                                                                    <FormItem
                                                                        invalid={quantity.invalid}
                                                                        errorMessage={quantity.errorMessage}
                                                                        className={'mb-0'}
                                                                    >
                                                                        <Field 
                                                                            invalid={quantity.invalid}
                                                                            placeholder="Quantity"
                                                                            // suffix={'KG'} 
                                                                            name={`items[${index}].quantity`}
                                                                            type="number"
                                                                            component={Input}
                                                                            disabled={items[index].uploaded_to_easyecom === 1 ? true : false}
                                                                        />
                                                                    </FormItem>
                                                                    <p>
                                                                        <span className='text-emerald-600'>{items[index].uploaded_to_easyecom === 1 ? 'Synced To EasyEcom' : ''}</span>
                                                                        <span className='text-red-600'>{sku.errorMessage}</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            )
                                                        }
                                                    )
                                                ) : (
                                                    <h5 className="text-center mb-5">
                                                        There is Nothing to Sync !!
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
            <ConfirmDialog
                isOpen={open}
                type={'success'}
                confirmButtonColor={'rose-600'}
                onClose={handleNo}
                onRequestClose={handleNo}
                cancelText={'No'}
                confirmText={'Yes'}
                onCancel={handleNo}
                onConfirm={handleConfirm}
            >
                <p>Are You Sure want to sync ??</p>
            </ConfirmDialog>
            <p className='text-red-400'>*Only approved transfer will be shown here</p>
        </Card>
    )
}

export default SyncToEasyEcomForm
