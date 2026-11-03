import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from 'components/ui'
import Input from 'components/ui/Input'
import Button from 'components/ui/Buttons'
import Select from 'components/ui/Select'
import Dialog from 'components/ui/Dialog'
import {
    apiProductionTransferList,
} from 'services/ProductionService'
import Camera, { FACING_MODES } from 'react-html5-camera-photo'
import 'react-html5-camera-photo/build/css/index.css'
import { HiOutlineEye } from 'react-icons/hi'
import appConfig from 'configs/app.config'

const TransferQuantity = () => {
    const navigate = useNavigate()
    const transferId = useParams()
    const [dataBox, setDataBox] = useState([])
    const [countKg, setCountKg] = useState([])
    const [loading, setLoading] = useState(true)
    const [product, setProduct] = useState({
        product_name: '',
        output_kg: '',
        transferred_kg: '',
        transfer: false,
        store_id: '',
        status:''
    })
    const [depotOption, setDepotOption] = useState([])
    const [showIsOpen, setShowIsOpen] = useState({
        isOpen: false,
        data: '',
    })
    
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
            countTotalKg(data.data)
        })
    }

    const countTotalKg = (dataB) => {
        let totalCalc = []
        dataB.forEach((element) => {
            let calcTotal = 0
            element.productionTransfers.forEach((data, index) => {
                return (calcTotal += data['qty'])
            })
            totalCalc.push(calcTotal)
        })
        setCountKg(totalCalc)
    }

    const showClose = () => {
        setShowIsOpen({ isOpen: false, data: '' })
    }

    useEffect(() => {
        const fetchData = () => {
            if (transferId.tid) {
                apiCallGetStore(transferId.tid)
            }
        }
        fetchData()
    }, [])
    return (
        <Card className=" card-shadow mb-4">
            <div className="w-full">
                <div className="mb-8 flex items-center justify-between">
                    <h5>
                        {product.product_name} (<span className=" text-rose-500">{product.transferred_kg}</span>/{product.output_kg}KG)
                    </h5>
                    <div>
                        <Button
                            type="button"
                            onClick={() => {
                                navigate(
                                    `/production/production-manager/view-allocation/${transferId.tid}`, {replace: true}
                                )
                            }}
                        >Back</Button>
                    </div>
                </div>
                <div className="flex justify-end items-center mb-5">
                    <Select
                        options={depotOption}
                        // onFocus={onFocus}
                        isLoading={loading}
                        className="w-[220px]"
                        value={depotOption.filter(
                            (option) =>
                                option.value === product.store_id
                        )}
                        isDisabled={true}
                    />
                </div>
                <div>
                    {dataBox && dataBox.length > 0 ? dataBox.map((data, i) => {
                        return (
                            <div key={i} className="card shadow mb-2 p-4 bg-slate-50">
                                <h5 className="mb-4 text-center grid grid-cols-3 items-center">
                                    <span className="text-sm text-left">
                                        <span className="px-[10px] py-[5px] bg-slate-300 rounded-full mr-2">
                                            Total : {countKg.length > 0 ? parseFloat(countKg[i]): '0'}
                                        </span>
                                    </span>
                                    <span>{data.box['box_name']}
                                    </span>
                                </h5>
                                <div className="flex flex-wrap items-center gap-2">
                                    {
                                        data['productionTransfers'] && data['productionTransfers'].length > 0 ? (
                                            data['productionTransfers'].map((dataValue,index) => {
                                                return (
                                                    // ${dataValue.fifo_not_followed ? 'bg-rose-100' : 'bg-slate-100' }
                                                    <div key={index} className={`flex items-center w-auto justify-between gap-2 px-2 py-1 rounded bg-slate-100`}>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p>Qty</p>
                                                            <Input
                                                                type="number"
                                                                suffix="No."
                                                                value={
                                                                    dataValue.qty
                                                                }
                                                                readOnly
                                                                className="w-[100px]"
                                                            />
                                                            {   dataValue.doc_document !== '' ? (
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
                                                                                data: dataValue.document_name,
                                                                            }
                                                                        )
                                                                    }}
                                                                />
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                )
                                            }
                                        )
                                    ) : (
                                        <p className="text-center text-base font-medium mb-5">
                                            Not Transfered!!
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    }) : null}
                </div>
            </div>
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
