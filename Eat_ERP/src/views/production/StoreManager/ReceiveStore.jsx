import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    apiGetReturnStore,
    apiGetStore,
    apiStoreManagerBarcodeStockReturn,
    apiStoreManagerEdit,
    apiStoreManagerReceive,
} from 'services/ProductionService'
import { Card } from 'components/ui'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import { FormItem, FormContainer } from 'components/ui'
import Input from 'components/ui/Input'
import Button from 'components/ui/Buttons'
import { FaTrash } from 'react-icons/fa'
import * as Yup from 'yup'
import Table from 'components/ui/Table'
import Scanner from './Scanner'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import { io } from 'socket.io-client'
import appConfig from 'configs/app.config'
import { useHardwareScanner } from 'utils/hooks/useHardwareScanner'

const { Tr, Th, Td, THead, TBody } = Table

const validationSchema = Yup.object({
    storeReturns: Yup.array().of(
        Yup.object().shape({
            qty: Yup.number()
                .required('Qty required')
                .moreThan(0, 'Qty Required'),
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

const ReceiveStore = () => {
    const navigate = useNavigate()
    const receiveId = useParams()
    const formRef = useRef()
    const [storeMaterials, setStoreMaterials] = useState([])
    const [scannerIsOpen, setScannerIsOpen] = useState(false)
    const [product, setProduct] = useState({
        product_name: '',
        store_kg: '',
        store_requested_kg: '',
        transfer: false,
        return_kg: '',
        return_raw_material: 0,
        receive:1
    })

    

    const handleMaterials = (decodedText) => {
        const barcodeExist = formRef.current.values.storeReturns.some(
            (storeMaterial) => storeMaterial.barcode === decodedText
        )
        if (!barcodeExist) {
            apiStoreManagerBarcodeStockReturn({
                id: receiveId.rid,
                barcode: decodedText,
            }).then((data) => {
                console.log(data)
                if (data) {
                    // formRef.current.values['storeReturns'].push({
                    //     id:'',
                    //     raw_material_id:
                    //         data['depotStock'][0].raw_material_id,
                    //     qty: '',
                    //     barcode: decodedText,
                    //     expiry_date: data['depotStock'][0].expiry_date,
                    //     fifo_not_followed: 0,
                    // })
                    setStoreMaterials((prev) => [
                        ...formRef.current.values['storeReturns'],
                        {
                            id:'',
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

    const handleHardwareScan = (decodedText) => {
        // setScannedBarcode(decodedText)
        handleMaterials(decodedText)
    }

    useHardwareScanner(handleHardwareScan)

    const onNewScanResult = (decodedText, decodedResult) => {
        // handle decoded results here
        handleMaterials(decodedText)
        setScannerIsOpen(false)
    }

    const scannerClose = () => {
        setScannerIsOpen(false)
    }

    const apiCallGetStore = (id) => {
        apiGetReturnStore(id).then((data) => {
            console.log(data)
            setProduct({
                product_name: data.production.product
                    ? data.production.product['short_name']
                    : '',
                store_kg: data.production.store_kg,
                store_requested_kg: data.production.store_requested_kg,
                transfer: data.production.transfer === 1 ? true : false,
                return_kg: data.production.return_kg,
                return_raw_material: data.production.return_raw_material,
                receive:data.production.receive
            })
            setStoreMaterials(data.production.productionReturns)
            // if (receiveId.editrid) {
            // }
        })
    }

    useEffect(() => {
        const fetchData = () => {
            if (receiveId.rid) {
                apiCallGetStore(receiveId.rid)
            } else if (receiveId.editrid) {
                apiCallGetStore(receiveId.editrid)
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
                    storeReturns: storeMaterials,
                }}
                onSubmit={(values) => {
                    if (values.storeReturns.length > 0) {
                        // alert(JSON.stringify(values, null, 2))
                        apiStoreManagerReceive(
                            values,
                            receiveId.rid ? receiveId.rid : receiveId.editrid
                        )
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
                                socket.emit('AllProduction', 'Saurabh')
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
                    } else {
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                Please Add Raw Material To Process.
                            </Notification>
                        )
                    }
                }}
            >
                {({ touched, errors, values }) => {
                    const storeReturns = values.storeReturns
                    return (
                        <Form>
                            <FormContainer layout="inline">
                                <div className="w-full">
                                    <div className="mb-8 flex items-center justify-between">
                                        <h5>
                                            {product.product_name}
                                            {/* (
                                            <span className=" text-rose-500">
                                                {product.store_kg}
                                            </span>
                                            /{product.store_requested_kg}KG) */}
                                        </h5>
                                        <div>
                                            <Button
                                                type="button"
                                                className="ltr:mr-5 rtl:ml-3"
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
                                            {product.receive == 1 ? (
                                                <Button
                                                    type="submit"
                                                    variant="solid"
                                                >
                                                    Save
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                    <FieldArray name="storeReturns">
                                        {({ form, remove, push }) => (
                                            <div>
                                                {storeReturns &&
                                                storeReturns.length > 0 ? (
                                                    storeReturns.map(
                                                        (_, index) => {
                                                            const qty =
                                                                fieldFeedback(
                                                                    form,
                                                                    `storeReturns[${index}].qty`
                                                                )

                                                            return (
                                                                <div
                                                                    key={index}
                                                                    // ${storeReturns[index].fifo_not_followed ? 'bg-rose-100' : 'bg-slate-100' }
                                                                    className={`flex items-center justify-between gap-2 px-2 py-1 rounded mb-5 bg-slate-100`}
                                                                >
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <FormItem
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
                                                                                    'KG'
                                                                                }
                                                                                name={`storeReturns[${index}].qty`}
                                                                                type="number"
                                                                                component={
                                                                                    Input
                                                                                }
                                                                                readOnly={
                                                                                    product.receive == 0
                                                                                }
                                                                            />
                                                                        </FormItem>
                                                                        <p>
                                                                            <span className=" font-semibold">
                                                                                Barcode
                                                                                :{' '}
                                                                            </span>
                                                                            <span>
                                                                                {
                                                                                    storeReturns[
                                                                                        index
                                                                                    ]
                                                                                        .barcode
                                                                                }
                                                                            </span>
                                                                        </p>
                                                                    </div>
                                                                    {storeReturns[index].id ==
                                                                    "" ? (
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
                                                                                setStoreMaterials(
                                                                                    (
                                                                                        prev
                                                                                    ) => {
                                                                                        return prev.filter(
                                                                                            (
                                                                                                value,
                                                                                                i
                                                                                            ) =>
                                                                                                i !==
                                                                                                index
                                                                                        )
                                                                                    }
                                                                                )
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                </div>
                                                            )
                                                        }
                                                    )
                                                ) : (
                                                    <h5 className="text-center mb-5">
                                                        Please Scan!!
                                                    </h5>
                                                )}
                                                <div className="text-center mb-5">
                                                    {product.receive == 1 ? (
                                                        <Button
                                                            variant="solid"
                                                            color="blue-500"
                                                            onClick={() => {
                                                                // push({
                                                                //     raw_material_id: 13,
                                                                //     batch_qty: 150,
                                                                //     qty: 150,
                                                                //     barcode:
                                                                //         '314300240013250531',
                                                                // })
                                                                setScannerIsOpen(
                                                                    true
                                                                )
                                                            }}
                                                            type="button"
                                                        >
                                                            Scan Code
                                                        </Button>
                                                    ) : null}
                                                </div>
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
                isOpen={scannerIsOpen}
                onClose={scannerClose}
                onRequestClose={scannerClose}
            >
                {scannerIsOpen ? (<Scanner qrCodeSuccessCallback={onNewScanResult} />): null}
            </Dialog>
        </Card>
    )
}

export default ReceiveStore
