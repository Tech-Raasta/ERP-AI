import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from 'components/ui'
import Input from 'components/ui/Input'
import Button from 'components/ui/Buttons'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import { apiGetPackagingStore, apiPutTransferPackaging } from 'services/ProductionService'
import Camera, { FACING_MODES } from 'react-html5-camera-photo'
import 'react-html5-camera-photo/build/css/index.css'
import { io } from 'socket.io-client'
import appConfig from 'configs/app.config'

const socket = io(appConfig.socketUrl)

const TransferPackaging = () => {
    const navigate = useNavigate()
    const transferId = useParams()
    const [photoIsOpen, setPhotoIsOpen] = useState(false)
    const [open, setOpen] = useState(false)
    const [product, setProduct] = useState('')
    const [storeRawMaterials, setStoreRawMaterials] = useState([])
    const [dataUri, setDataUri] = useState('')
    

    const photoClose = () => {
        setPhotoIsOpen(false)
        handleCameraStop()
    }

    function handleTakePhotoAnimationDone(data) {
        console.log(data)
        setDataUri(data)
        setPhotoIsOpen(false)
    }

    const handlePhoto = (index) => {
        setPhotoIsOpen(true)
    }

    function handleCameraStart(stream) {
        console.log('handleCameraStart', stream)
    }

    function handleCameraStop(stream) {
        console.log('handleCameraStop', stream)
    }
    const handleClose = () => {
        console.log('Close')
        setOpen(false)
    }
    const handleConfirm = () => {
        console.log('Confirm')
        setOpen(false)
    }
    const handleSubmit = () => {
        if (dataUri) {
            const formData = new FormData()
            formData.append('doc_document', dataUri)
            apiPutTransferPackaging({ doc_document: dataUri }, transferId.tid).then(
                (data) => {
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
                        navigate('/production/store-manager', {
                            replace: true,
                        })
                    } else {
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                Something Went Wrong.
                            </Notification>
                        )
                    }
                }
            )
        } else {
            toast.push(
                <Notification title="Error" type="danger" closable>
                    Please Click Photo To Transfer
                </Notification>
            )
        }
    }
    useEffect(() => {
        const fetchData = () => {
            apiGetPackagingStore(transferId.tid).then((data) => {
                console.log(data)
                setProduct({
                    product_name: "Packaging-"+data.packaging.id,
                    store_kg: data.packaging.store_kg,
                    store_requested_kg: data.packaging.store_requested_kg,
                    transfer: data.packaging.transfer,
                    document_name: data.packaging.document_name ? data.packaging.document_name.split(' | ') : [],
                })
                setStoreRawMaterials(data.packaging.packagingItems)
            })
        }
        fetchData()
    }, [])
    return (
        <Card className=" card-shadow mb-4">
            <div className="mb-8 flex items-center justify-between">
                <h5>
                    {product.product_name} (
                    <span className=" text-rose-500">{product.store_kg}</span>/
                    {product.store_requested_kg})
                </h5>
                <div>
                    <Button
                        type="button"
                        className="ltr:mr-5 rtl:ml-3"
                        onClick={() => {
                            navigate('/production/store-manager', {
                                replace: true,
                            })
                        }}
                    >
                        Back
                    </Button>
                    {product.transfer === 0 ? (
                        <Button
                            type="button"
                            variant="solid"
                            onClick={() => handleSubmit()}
                            disabled={product.transfer === 1 ? true : false}
                        >
                            Transfer
                        </Button>
                    ) : null}
                </div>
            </div>
            {storeRawMaterials && storeRawMaterials.length > 0 ? (
                storeRawMaterials.map((storeRawMaterial, index) => {
                    return (
                        <div
                            key={index}
                            // ${storeRawMaterial.fifo_not_followed ? 'bg-rose-100' : 'bg-slate-100' }
                            className={`flex items-center justify-between px-2 py-1 rounded mb-5 bg-slate-100`}
                        >
                            <div className="flex items-center justify-start gap-12 w-full">
                                <p>
                                    <span className=" font-semibold">
                                        Name :{' '}
                                    </span>
                                    <span>{storeRawMaterial.rawMaterial ? storeRawMaterial.rawMaterial.rm_name : ''}</span>
                                </p>
                                <Input
                                    placeholder="Qty"
                                    suffix={'KG'}
                                    value={storeRawMaterial.qty}
                                    type="text"
                                    readOnly
                                    className="w-[200px]"
                                />
                                <p>
                                    <span className=" font-semibold">
                                        Barcode :{' '}
                                    </span>
                                    <span>{storeRawMaterial.barcode}</span>
                                </p>
                            </div>
                            {/* <Button
                                shape="circle"
                                size="sm"
                                variant="solid"
                                color="rose-500"
                                icon={<FaTrash />}
                                type="button"
                            /> */}
                        </div>
                    )
                })
            ) : (
                <h5 className="text-center mb-5">Not Found!!</h5>
            )}
            <div
                className={`text-center mb-5 ${
                    product.transfer === 1 ? 'hidden' : ''
                }`}
            >
                <Button
                    type="button"
                    color="blue-600"
                    variant="solid"
                    size="lg"
                    onClick={handlePhoto}
                >
                    Click Photo
                </Button>
            </div>
            {dataUri ? (
                <div className="w-full">
                    <img src={dataUri} alt="" width={400} className=" m-auto" />
                </div>
            ) : null}

            {product.document_name ? product.document_name.map((value, index)=>(
                <div className="w-full text-center" key={index}>
                    <img
                        src={`${appConfig.uploadUrl}store_manager/${value}`}
                        alt={value}
                        width={400}
                        className=" m-auto"
                    />
                </div>
            )) : null}
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
                    imageCompression={0.90}
                    isMaxResolution={true}
                    isImageMirror={true}
                    isSilentMode={false}
                    isDisplayStartCameraError={true}
                    isFullscreen={false}
                    sizeFactor={0.4}
                    onCameraStart={(stream) => {
                        handleCameraStart(stream)
                    }}
                    onCameraStop={() => {
                        handleCameraStop()
                    }}
                />
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

export default TransferPackaging
