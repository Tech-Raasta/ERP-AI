import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from 'components/ui'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import { FormItem, FormContainer } from 'components/ui'
import Input from 'components/ui/Input'
import Button from 'components/ui/Buttons'
import { FaTrash } from 'react-icons/fa'
import { HiOutlinePlus } from 'react-icons/hi'
import * as Yup from 'yup'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiProductionAllocatePut,
    apiProductionAllocationList,
    apiStoreManagerEdit,
} from 'services/ProductionService'

import classNames from 'classnames'
import Segment from 'components/ui/Segment'

const validationSchema = Yup.object({
    box: Yup.array().of(
        Yup.object().shape({
            productionAllocations: Yup.array().of(
                Yup.object().shape({
                    qty: Yup.number()
                        .required('Qty required')
                        .moreThan(0, 'Qty required'),
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

const AllocationQuantity = () => {
    const navigate = useNavigate()
    const allocatedId = useParams()
    const formRef = useRef()
    const [dataBox, setDataBox] = useState([])
    const [tempDataBox, setTempDataBox] = useState([])
    const [countKg, setCountKg] = useState([])
    const [finalCount, setFinalCount] = useState(0)
    const [segmentSelections, setSegmentSelections] = useState([])
    const [segDefault, setSegDefault] = useState([])
    const [holdVal, setHoldVal] = useState([])
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
            let finalCalc = []
            formRef.current.values['box'].forEach((element) => {
                let calcTotal = 0
                element.productionAllocations.forEach((data, index) => {
                    return (calcTotal += data['qty'])
                })
                let final =
                    (parseFloat(element.box['grams']) * parseFloat(calcTotal)) /
                    1000
                finalCalc.push(Math.round(final * 100) / 100)
                totalCalc.push(calcTotal)
            })
            setCountKg(totalCalc)
            const finalTotal = finalCalc.reduce(
                (acc, c) => parseFloat(acc) + parseFloat(c),
                0
            )
            setFinalCount(finalTotal)
            // console.log('Final Total : ', finalTotal)
        }, 100)
    }

    const segChange = (segmentValue) => {
        console.log('temp', tempDataBox)
        console.log('choosen', segmentValue)
        // let holdVal = []
        tempDataBox.forEach(
            (value) =>
                // if(segmentValue.length > 0){
                segmentValue.forEach((val) => {
                    if (val == value.box['grams']) {
                        // holdVal.push(value)
                        console.log(dataBox)

                        const exist = dataBox.some((h) => h.box['grams'] == val)

                        if (!exist) {
                            setDataBox((prv) => [...prv, { ...value }])
                            // setTempDataBox((prev) => [...prev, ...dataBox])
                        }
                    }
                })
            // }
        )
        // setTimeout(() => {
        //     console.log('return', holdVal)
        //     console.log('current Stack', dataBox)
        //     setDataBox(holdVal)
        // }, 100)

        countTotalKg()
    }

    const apiCallGetStore = (id) => {
        apiProductionAllocationList(id).then((data) => {
            console.log(data)
            setProduct({
                product_name: data.production.product
                    ? data.production.product['short_name']
                    : '',
                total_kg: data.production.total_kg,
                transfer: data.production.transfer === 1 ? true : false,
                output_kg: data.production.output_kg,
                transferred_kg: data.production.transferred_kg,
            })
            setTempDataBox(data.data)
            let options = []
            let defaultOptions = []
            let defaultValue = []
            data.data.forEach((value, index) => {
                options.push({
                    value: value.box['grams'].toString(),
                    desc: value.box['short_name'],
                    id: index,
                    // disabled:
                    //     value.productionAllocations.length > 0 ? true : false,
                })
                if (value.productionAllocations.length > 0) {
                    defaultOptions.push(value.box['grams'].toString())
                    defaultValue.push(value)
                }
            })
            setSegDefault(defaultOptions)
            setDataBox(defaultValue)
            setSegmentSelections(options)
            countTotalKg()
            // if (allocatedId.editaid) {
            // }
        })
    }

    useEffect(() => {
        const fetchData = () => {
            if (allocatedId.aid) {
                apiCallGetStore(allocatedId.aid)
            } else if (allocatedId.editaid) {
                apiCallGetStore(allocatedId.editaid)
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
                    box: dataBox,
                }}
                onSubmit={(values) => {
                    const data = []
                    // console.log(values)
                    values.box.map((allocatedData, index) => {
                        allocatedData.productionAllocations.map(
                            (finalData, index) => {
                                data.push(finalData)
                            }
                        )
                    })
                    if (data.length > 0) {
                        // alert(JSON.stringify(values, null, 2))
                        apiProductionAllocatePut(
                            { productionAllocations: data },
                            allocatedId.aid
                                ? allocatedId.aid
                                : allocatedId.editaid
                        )
                            .then((data) => {
                                console.log(data)
                                if (data.status === 200) {
                                    setProduct((prev) => ({
                                        ...prev,
                                        output_kg:
                                            data.data['production'].output_kg,
                                    }))
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
                                // navigate('/production/production-floor-manager', {
                                //     replace: true,
                                // })
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
                                Please Add Atleast 1 Product.
                            </Notification>
                        )
                    }
                }}
            >
                {({ touched, errors, values }) => {
                    const box = values.box
                    const productionAllocations = box.map(
                        (value, index) => value.productionAllocations
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
                                            /{product.total_kg}KG)
                                        </h5>
                                        <div>
                                            <Button
                                                type="button"
                                                className="ltr:mr-5 rtl:ml-3"
                                                onClick={() => {
                                                    navigate(
                                                        '/production/production-floor-manager',
                                                        {
                                                            replace: true,
                                                        }
                                                    )
                                                }}
                                            >
                                                Back
                                            </Button>
                                            <Button
                                                type="submit"
                                                variant="solid"
                                                className="ltr:mr-5 rtl:ml-3"
                                            >
                                                Save
                                            </Button>
                                            {product.output_kg > 0 ? (
                                                product.transferred_kg <
                                                product.output_kg ? (
                                                    <Button
                                                        type="button"
                                                        variant="solid"
                                                        color="blue-600"
                                                        onClick={() => {
                                                            navigate(
                                                                `/production/production-floor-manager/transfer-batch/${allocatedId.aid}`
                                                            )
                                                        }}
                                                    >
                                                        Transfer
                                                    </Button>
                                                ) : null
                                            ) : null}
                                        </div>
                                    </div>
                                    <div>
                                        <Segment
                                            // defaultValue={segDefault}
                                            selectionType="multiple"
                                            className="gap-2 flex flex-wrap mb-4"
                                            onChange={(segmentValue) =>
                                                segChange(segmentValue)
                                            }
                                        >
                                            {segmentSelections.map((item) => (
                                                <Segment.Item
                                                    key={item.value}
                                                    value={item.value}
                                                    disabled={item.disabled}
                                                >
                                                    {({
                                                        active,
                                                        value,
                                                        onSegmentItemClick,
                                                        disabled,
                                                    }) => {
                                                        return (
                                                            <div
                                                                className={classNames(
                                                                    'flex',
                                                                    'ring-1',
                                                                    'justify-between',
                                                                    'border',
                                                                    'rounded-md ',
                                                                    'border-gray-300',
                                                                    'py-5 px-4',
                                                                    'cursor-pointer',
                                                                    'select-none',
                                                                    'w-[150px]',
                                                                    // 'md:w-[260px]',
                                                                    active
                                                                        ? 'ring-amber-500 border-amber-500 bg-amber-100'
                                                                        : 'ring-transparent',
                                                                    disabled
                                                                        ? 'opacity-50 cursor-not-allowed'
                                                                        : 'hover:ring-amber-500 hover:border-amber-500'
                                                                )}
                                                                onClick={
                                                                    onSegmentItemClick
                                                                }
                                                            >
                                                                <div>
                                                                    <h6>
                                                                        {value}{' '}
                                                                        Grams
                                                                    </h6>
                                                                    <p>
                                                                        {
                                                                            item.desc
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )
                                                    }}
                                                </Segment.Item>
                                            ))}
                                        </Segment>
                                    </div>
                                    <FieldArray name="box">
                                        {({ form, remove, push }) => (
                                            <div>
                                                {box && box.length > 0
                                                    ? box.map((data, i) => (
                                                          <div
                                                              key={i}
                                                              className="card shadow mb-2 p-4"
                                                          >
                                                              <h4 className="mb-4 text-center grid grid-cols-3 items-center">
                                                                  <span className="text-sm text-left">
                                                                      <span className="px-[10px] py-[5px] bg-slate-300 rounded-full">
                                                                          Total
                                                                          :
                                                                          {countKg.length >
                                                                          0
                                                                              ? parseFloat(
                                                                                    countKg[
                                                                                        i
                                                                                    ]
                                                                                )
                                                                              : '0'}
                                                                      </span>
                                                                  </span>
                                                                  <span>
                                                                      {
                                                                          data
                                                                              .box[
                                                                              'box_name'
                                                                          ]
                                                                      }
                                                                  </span>
                                                                  <span></span>
                                                              </h4>
                                                              <FieldArray
                                                                  name={`box[${i}].productionAllocations`}
                                                              >
                                                                  {({
                                                                      form,
                                                                      remove,
                                                                      push,
                                                                  }) => (
                                                                      <div className="flex flex-wrap items-center gap-2">
                                                                          {box[
                                                                              i
                                                                          ]
                                                                              .productionAllocations &&
                                                                          box[i]
                                                                              .productionAllocations
                                                                              .length >
                                                                              0 ? (
                                                                              box[
                                                                                  i
                                                                              ].productionAllocations.map(
                                                                                  (
                                                                                      _,
                                                                                      index
                                                                                  ) => {
                                                                                      const qty =
                                                                                          fieldFeedback(
                                                                                              form,
                                                                                              `box[${i}].productionAllocations[${index}].qty`
                                                                                          )

                                                                                      return (
                                                                                          <div
                                                                                              key={
                                                                                                  index
                                                                                              }
                                                                                              className={`flex items-center w-[230px] justify-between gap-2 px-2 py-1 rounded ${
                                                                                                  productionAllocations[
                                                                                                      i
                                                                                                  ][
                                                                                                      index
                                                                                                  ]
                                                                                                      .fifo_not_followed
                                                                                                      ? 'bg-rose-100'
                                                                                                      : 'bg-slate-100'
                                                                                              } `}
                                                                                          >
                                                                                              <div className="flex items-center justify-between gap-2">
                                                                                                  <FormItem
                                                                                                      asterisk
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
                                                                                                              'No.'
                                                                                                          }
                                                                                                          name={`box[${i}].productionAllocations[${index}].qty`}
                                                                                                          type="number"
                                                                                                          component={
                                                                                                              Input
                                                                                                          }
                                                                                                          onChange={(
                                                                                                              e
                                                                                                          ) => {
                                                                                                              let val =
                                                                                                                  e
                                                                                                                      .target
                                                                                                                      .value ==
                                                                                                                  ''
                                                                                                                      ? ''
                                                                                                                      : parseInt(
                                                                                                                            e
                                                                                                                                .target
                                                                                                                                .value
                                                                                                                        )
                                                                                                              countTotalKg()
                                                                                                              return form.setFieldValue(
                                                                                                                  `box[${i}].productionAllocations[${index}].qty`,
                                                                                                                  val
                                                                                                              )
                                                                                                          }}
                                                                                                      />
                                                                                                  </FormItem>
                                                                                              </div>
                                                                                              <div>
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
                                                                                                          countTotalKg()
                                                                                                          remove(
                                                                                                              index
                                                                                                          )
                                                                                                      }}
                                                                                                  />
                                                                                              </div>
                                                                                          </div>
                                                                                      )
                                                                                  }
                                                                              )
                                                                          ) : (
                                                                              <p className="text-center text-base font-medium">
                                                                                  Add
                                                                                  Finished
                                                                                  Product!!
                                                                              </p>
                                                                          )}
                                                                          <div>
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
                                                                                          }
                                                                                      )
                                                                                  }}
                                                                              />
                                                                          </div>
                                                                      </div>
                                                                  )}
                                                              </FieldArray>
                                                          </div>
                                                      ))
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
        </Card>
    )
}

export default AllocationQuantity
