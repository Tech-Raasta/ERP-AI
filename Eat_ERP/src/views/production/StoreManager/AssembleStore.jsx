import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    apiGetBarcodeStock,
    apiGetStore,
    apiStoreManagerEdit,
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
    storeRawMaterials: Yup.array().of(
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

const AssembleStore = () => {
    const navigate = useNavigate()
    const materialId = useParams()
    const [stock, setStock] = useState([])
    const formRef = useRef()
    const [storeMaterials, setStoreMaterials] = useState([])
    const [scannerIsOpen, setScannerIsOpen] = useState(false)
    const [product, setProduct] = useState({
        product_name: '',
        store_kg: '',
        store_requested_kg: '',
        transfer: false,
    })

    const [scannedBarcode, setScannedBarcode] = useState('')

    const [qrCode, setQrCode] = useState('')
    const [open, setOpen] = useState(false)

    const handleMaterials = (decodedText) => {
        const checkStock = stock.some((value) => value.barcode == decodedText)
        if (checkStock) {
            const barcodeExist = formRef.current.values.storeRawMaterials.some(
                (storeMaterial) => storeMaterial.barcode === decodedText
            )
            if (!barcodeExist) {
                const singleValue = stock.filter(
                    (value) => value.barcode === decodedText
                )
                // console.log(singleValue)
                if (singleValue) {
                    setStoreMaterials((prev) => [
                        ...prev,
                        {
                            raw_material_id: singleValue[0].raw_material_id,
                            batch_qty: singleValue[0].batch_qty,
                            qty: singleValue[0].qty,
                            barcode: singleValue[0].barcode,
                            expiry_date: singleValue[0].expiry_date,
                            fifo_not_followed: 0,
                        },
                    ])
                }
            } else {
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        Barcode Already Scanned
                    </Notification>
                )
            }
        } else {
            const barcodeExist = formRef.current.values.storeRawMaterials.some(
                (storeMaterial) => storeMaterial.barcode === decodedText
            )
            if (!barcodeExist) {
                setOpen(true)
            } else {
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        Barcode Already Scanned
                    </Notification>
                )
            }
        }
    }

    const handleHardwareScan = (decodedText) => {
        setScannedBarcode(decodedText)
        handleMaterials(decodedText)
    }

    useHardwareScanner(handleHardwareScan)

    const handleClose = () => {
        console.log('Close')
        setOpen(false)
    }

    const apiCallGetBarcodeStock = (id) => {
        apiGetBarcodeStock({
            id,
            barcode: scannedBarcode,
        }).then((data) => {
            console.log(data)
            if (data['depotStock'].length > 0) {
                setStoreMaterials((prev) => [
                    ...prev,
                    {
                        raw_material_id: data['depotStock'][0].raw_material_id,
                        batch_qty: data['depotStock'][0].stock_qty,
                        qty: '',
                        barcode: scannedBarcode,
                        expiry_date: data['depotStock'][0].expiry_date,
                        fifo_not_followed: 1,
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
                    {error.response.data['message']}
                </Notification>
            )
        })
    }

    const handleConfirm = () => {
        console.log('Confirm')
        if (materialId.mid) {
            apiCallGetBarcodeStock(materialId.mid)
        } else if (materialId.editmid) {
            apiCallGetBarcodeStock(materialId.editmid)
        }
        setOpen(false)
    }

    const onNewScanResult = (decodedText, decodedResult) => {
        // handle decoded results here
        setScannerIsOpen(false)
        setScannedBarcode(decodedText)
        handleMaterials(decodedText)
    }

    const scannerClose = () => {
        setScannerIsOpen(false)
    }

    const apiCallGetStore = (id) => {
        apiGetStore(id).then((data) => {
            console.log(data)
            setStock(data.depotStock)
            setProduct({
                product_name: data.production.product
                    ? data.production.product['short_name']
                    : '',
                store_kg: data.production.store_kg,
                store_requested_kg: data.production.store_requested_kg,
                transfer: data.production.transfer === 1 ? true : false,
            })
            if (materialId.editmid) {
                setStoreMaterials(data.production.productionRawMaterials)
            }
        })
    }

    useEffect(() => {
        const fetchData = () => {
            if (materialId.mid) {
                apiCallGetStore(materialId.mid)
            } else if (materialId.editmid) {
                apiCallGetStore(materialId.editmid)
            }
        }
        fetchData();
    }, [])

    return (
        <Card className=" card-shadow mb-4">
            <Formik
                enableReinitialize={true}
                innerRef={formRef}
                validationSchema={validationSchema}
                initialValues={{
                    storeRawMaterials: storeMaterials,
                }}
                onSubmit={(values) => {
                    if (values.storeRawMaterials.length > 0) {
                        // alert(JSON.stringify(values, null, 2))
                        apiStoreManagerEdit(
                            values,
                            materialId.mid ? materialId.mid : materialId.editmid
                        ).then((data) => {
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
                                Please Add Raw Material To Process.
                            </Notification>
                        )
                    }
                }}
            >
                {({ touched, errors, values }) => {
                    const storeRawMaterials = values.storeRawMaterials
                    return (
                        <Form>
                            <FormContainer layout="inline">
                                <div className="w-full">
                                    <div className="mb-8 flex items-center justify-between">
                                        <h5>
                                            {product.product_name} (
                                            <span className=" text-rose-500">
                                                {product.store_kg}
                                            </span>
                                            /{product.store_requested_kg}KG)
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
                                            {!product.transfer ? (
                                                <Button
                                                    type="submit"
                                                    variant="solid"
                                                    disabled={product.transfer}
                                                >
                                                    Save
                                                </Button>
                                            ) : (
                                                ''
                                            )}
                                        </div>
                                    </div>
                                    <FieldArray name="storeRawMaterials">
                                        {({ form, remove, push }) => (
                                            <div>
                                                {storeRawMaterials &&
                                                storeRawMaterials.length > 0 ? (
                                                    storeRawMaterials.map(
                                                        (_, index) => {
                                                            const qty =
                                                                fieldFeedback(
                                                                    form,
                                                                    `storeRawMaterials[${index}].qty`
                                                                )

                                                            return (
                                                                <div
                                                                    key={index}
                                                                    // ${ storeRawMaterials[index].fifo_not_followed ? 'bg-rose-100' : 'bg-slate-100' }
                                                                    className={`flex items-center justify-between gap-2 px-2 py-1 rounded mb-5 bg-slate-100 `}
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
                                                                                name={`storeRawMaterials[${index}].qty`}
                                                                                type="number"
                                                                                component={
                                                                                    Input
                                                                                }
                                                                                readOnly={
                                                                                    product.transfer
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
                                                                                    storeRawMaterials[
                                                                                        index
                                                                                    ]
                                                                                        .barcode
                                                                                }
                                                                            </span>
                                                                        </p>
                                                                    </div>
                                                                    {!product.transfer ? (
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
                                                                            disabled={
                                                                                product.transfer
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        ''
                                                                    )}
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
                                                    {!product.transfer ? (
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
                                                            disabled={
                                                                product.transfer
                                                            }
                                                        >
                                                            Scan Code
                                                        </Button>
                                                    ) : (
                                                        ''
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </FieldArray>
                                    <div className="flex justify-center">
                                        <Table compact className="border">
                                            <THead>
                                                <Tr>
                                                    <Th colSpan="2">
                                                        Recommanded
                                                    </Th>
                                                </Tr>
                                                <Tr>
                                                    <Th>Barcode</Th>
                                                    <Th>Available Qty</Th>
                                                </Tr>
                                            </THead>
                                            <TBody>
                                                {stock.map((values, index) => (
                                                    <Tr key={index}>
                                                        <Td>
                                                            {values.barcode}
                                                        </Td>
                                                        <Td className="text-center">
                                                            {values.batch_qty}KG
                                                        </Td>
                                                    </Tr>
                                                ))}
                                            </TBody>
                                        </Table>
                                    </div>
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
            <ConfirmDialog
                isOpen={open}
                type={'danger'}
                title={'FIFO NOT FOLLOWED'}
                confirmButtonColor={'rose-600'}
                onClose={handleClose}
                onRequestClose={handleClose}
                cancelText={'No'}
                confirmText={'Yes'}
                onCancel={handleClose}
                onConfirm={handleConfirm}
            >
                <p>Are You Sure want to continue ??</p>
            </ConfirmDialog>
        </Card>
    )
}

export default AssembleStore
