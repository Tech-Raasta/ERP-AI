import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Input } from 'components/ui'
import { FaTrash } from 'react-icons/fa'
import { apiProductionAllocationList } from 'services/ProductionService'

const ViewAllocatedQty = () => {
    const navigate = useNavigate()
    const allocatedId = useParams()
    const [dataBox, setDataBox] = useState([])
    const [countKg, setCountKg] = useState([])
    const [product, setProduct] = useState({
        product_name: '',
        total_kg: '',
        transfer: false,
        output_kg: '',
        transferred_kg: '',
    })

    const countTotalKg = () => {
        setTimeout(() => {
            let totalCalc = []
            dataBox.forEach((element) => {
                let calcTotal = 0
                element.productionAllocations.forEach((data, index) => {
                    return (calcTotal += data['qty'])
                })
                // let final =
                //     (parseFloat(element.box['grams']) * parseFloat(calcTotal)) /
                //     1000
                // totalCalc.push(Math.round(final * 100) / 100)
                totalCalc.push(calcTotal)
            })
            setCountKg(totalCalc)
        }, 100)
    }

    useEffect(() => {
        const fetchData = () => {
            if (allocatedId.aid) {
                apiProductionAllocationList(allocatedId.aid).then((data) => {
                    console.log(data)
                    setProduct({
                        product_name: data.production.product
                            ? data.production.product['short_name']
                            : '',
                        output_kg: data.production.output_kg,
                        total_kg: data.production.total_kg,
                        transfer: data.production.transfer === 1 ? true : false,
                        output_kg: data.production.output_kg,
                        transferred_kg: data.production.transferred_kg,
                    })
                    setDataBox(data.data)
                    setTimeout(() => {
                        let totalCalc = []
                        data.data.forEach((element) => {
                            let calcTotal = 0
                            element.productionAllocations.forEach(
                                (data, index) => {
                                    return (calcTotal += data['qty'])
                                }
                            )
                            // let final =
                            //     (parseFloat(element.box['grams']) * parseFloat(calcTotal)) /
                            //     1000
                            // totalCalc.push(Math.round(final * 100) / 100)
                            totalCalc.push(calcTotal)
                        })
                        setCountKg(totalCalc)
                    }, 100)
                })
            }
        }
        fetchData()
    }, [])
    return (
        <Card className=" card-shadow mb-4">
            <div className="mb-8 flex items-center justify-between">
                <h5>
                    {product.product_name} (
                    <span className=" text-rose-500">{product.output_kg}</span>/
                    {product.total_kg}KG)
                </h5>
                <div>
                    <Button
                        type="button"
                        className="ltr:mr-5 sm:mb-3"
                        onClick={() => {
                            navigate('/production/production-manager', {
                                replace: true,
                            })
                        }}
                    >
                        Back
                    </Button>
                    <Button
                        type="button"
                        color="blue-600"
                        variant="solid"
                        onClick={() => {
                            navigate(`/production/production-manager/view-transfer/${allocatedId.aid}`)
                        }}
                    >
                        Show Transfer
                    </Button>
                </div>
            </div>
            <div>
                {dataBox && dataBox.length > 0
                    ? dataBox.map((data, i) => (
                          <div
                              key={i}
                              className={`card shadow mb-2 p-4 ${
                                  data.productionAllocations.length > 0
                                      ? 'visible'
                                      : 'hidden'
                              }`}
                          >
                              <h4 className="mb-4 text-center grid grid-cols-3 items-center">
                                  <span className="text-sm text-left">
                                      <span className="px-[10px] py-[5px] bg-slate-300 rounded-full">
                                          Total :
                                          {countKg.length > 0
                                              ? parseFloat(countKg[i])
                                              : '0'}
                                      </span>
                                  </span>
                                  <span>{data.box['box_name']}</span>
                                  <span></span>
                              </h4>
                              <div className='flex flex-wrap items-center gap-2'>
                                {data.productionAllocations &&
                                data.productionAllocations.length > 0 ? (
                                    data.productionAllocations.map(
                                        (productionAllocation, index) => (
                                            <div
                                                key={index}
                                                // ${ productionAllocation.fifo_not_followed ? 'bg-rose-100' : 'bg-slate-100' }
                                                className={`flex items-center justify-between w-auto gap-2 px-2 py-1 rounded mb-5 bg-slate-100 `}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p>Qty</p>
                                                    <Input
                                                        type="number"
                                                        suffix="No."
                                                        value={
                                                            productionAllocation.qty
                                                        }
                                                        readOnly
                                                        className="w-[100px]"
                                                    />
                                                </div>
                                            </div>
                                        )
                                    )
                                ) : (
                                    <p className="text-center text-base font-medium mb-5">
                                        {' '}
                                        No Finished Products!!
                                    </p>
                                )}
                              </div>
                          </div>
                      ))
                    : null}
            </div>
        </Card>
    )
}

export default ViewAllocatedQty
