import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from 'components/ui'
import Button from 'components/ui/Buttons'
import * as Yup from 'yup'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiProductionCheckQtyList,
    apiProductionCheckQtyRequest,
    apiProductionTransferApprove,
    apiProductionTransferReceiveList,
    apiProductionTransferReject,
    apiStoreManagerCheckQtyList,
} from 'services/ProductionService'

const ReceiveTransfer = () => {
    const navigate = useNavigate()
    const checkId = useParams()
    const formRef = useRef()
    const [productionData, setProductionData] = useState([])
    const [receivedTransfer, setReceivedTransfer] = useState([])

    const apiCallGetStore = (id) => {
        apiProductionTransferReceiveList(id).then((data) => {
            console.log(data)
            setProductionData(data['production'])
            setReceivedTransfer(data['production'].productionTransfers)
        })
    }

    const onCheck = (value, index) => {
        console.log(value, index)
        formRef.current.setFieldValue(`receivedTransfer[${index}].use_production_stock`, value ? 1 : 0)
    }

    const approveTransfer = (id)=>{
        apiProductionTransferApprove(id).then(data=>{
            console.log(data)
            toast.push(
                <Notification title="Success" type="success" closable >
                    {data.data['message']}
                </Notification>
            )
            apiProductionTransferReceiveList(checkId.rtid).then((data) => {
                setReceivedTransfer(data['production'].productionTransfers)
            })
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

    const rejectTransfer = (id)=>{
        apiProductionTransferReject(id).then(data=>{
            console.log(data)
            toast.push(
                <Notification title="Success" type="success" closable >
                    {data.data['message']}
                </Notification>
            )
            apiProductionTransferReceiveList(checkId.rtid).then((data) => {
                setReceivedTransfer(data['production'].productionTransfers)
            })
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
            if (checkId.rtid) {
                apiCallGetStore(checkId.rtid)
            }
        }
        fetchData()
    }, [])
    return (
        <Card className=" card-shadow mb-4">
            <div className="w-full">
                <div className="mb-8 flex items-center justify-between">
                    <h5>
                        {productionData.product ? productionData.product['short_name'] : ''}
                         {/* (<span className=" text-rose-500">{productionData.store_kg}</span>/{productionData.store_requested_kg}KG) */}
                    </h5>
                    <div>
                        <Button type="button" variant="solid" className="mr-4" onClick={() => { navigate(`/production/store-manager/receive-transfer/${checkId.rtid}/sync`) }}>Sync To EasyEcom</Button>
                        <Button type="button" onClick={() => { navigate('/production/store-manager',{replace: true,}) }} >Back</Button>
                    </div>
                </div>
                <div className='flex items-center justify-between gap-2 px-2 py-1 mb-3'>
                    <p className='flex items-center justify-between gap-5 font-bold text-base flex-wrap'>
                        <span className='w-[350px]'>Box Name</span>
                        <span className='w-[120px]'>Qty</span>
                        <span>Status</span>
                        {/* <span className='w-[120px]'>Not In Store</span> */}
                    </p>
                    <div></div>
                </div>
                <div>
                    { receivedTransfer && receivedTransfer.length > 0 ? ( receivedTransfer.map((_, index) => {
                        return (
                                <div key={index} className={`flex items-center justify-between gap-2 px-2 py-1 rounded mb-5 bg-slate-50`} >
                                    <div className="flex items-center justify-between gap-5 flex-wrap">
                                        <h6 className='mb-0 w-[350px] text-gray-600'>{receivedTransfer[index].box['box_name']}</h6>
                                        <p className='w-[120px]'><b>{receivedTransfer[index].qty}</b></p>
                                        {
                                            receivedTransfer[index].status == 'Pending' ? (
                                                <>
                                                    <Button type="button" variant="solid" color="emerald-600" onClick={()=>{approveTransfer(receivedTransfer[index].id)}}>Approve</Button>
                                                    <Button type="button" variant="solid" color="rose-600" onClick={()=>{rejectTransfer(receivedTransfer[index].id)}}>Reject</Button>
                                                </>
                                            ) : receivedTransfer[index].status
                                        }
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <h5 className="text-center mb-5">
                            Nothing Received In Transfer
                        </h5>
                    )}
                </div>
            </div>
        </Card>
    )
}

export default ReceiveTransfer
