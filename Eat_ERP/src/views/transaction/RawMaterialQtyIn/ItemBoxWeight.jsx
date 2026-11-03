import { Field, Form, FieldArray, Formik, getIn } from 'formik'
import React, { useState, useRef, useEffect } from 'react'
import Input from 'components/ui/Input'
import DatePicker from 'components/ui/DatePicker'
import Button from 'components/ui/Buttons'
import { FormItem, FormContainer } from 'components/ui'
import * as Yup from 'yup'
import Table from 'components/ui/Table'
import { useReactToPrint } from 'react-to-print'
import CreatePrint from './CreatePrint'

const { Tr, Th, Td, THead, TBody } = Table

const fieldFeedback = (form, name) => {
    const error = getIn(form.errors, name)
    const touch = getIn(form.touched, name)
    return {
        errorMessage: error || '',
        invalid: typeof touch === 'undefined' ? false : error && touch,
    }
}

const validationSchema1 = Yup.object().shape({
    item_box_weight: Yup.array().of(
        Yup.object()
            .shape({
                gross_weight: Yup.number().required(' ').moreThan(0, ' '),
                net_weight: Yup.number().required(' ').moreThan(0, ' '),
                expiry_date: Yup.string().required(' '),
            })
            .required('Details is Required')
    ),
})

const ItemBoxWeight = ({ data, getData }) => {
    const formRef = useRef()
    // const [boxData, setBoxData] = useState([
    //     {
    //         gross_weight: '',
    //         net_weight: '',
    //         expiry_date: '',
    //         barcode: ''
    //     }
    // ]);

    const changeDateForAll = () => {
        console.log(formRef.current.values.item_box_weight[0].expiry_date)
        if (
            formRef.current.values.item_box_weight[0].expiry_date !==
            '1970-01-01'
        ) {
            for (
                let i = 1;
                i < formRef.current.values.item_box_weight.length;
                i++
            ) {
                formRef.current.setFieldValue(
                    `item_box_weight[${i}].expiry_date`,
                    formRef.current.values.item_box_weight[0].expiry_date
                )
                console.log(
                    formRef.current.values.item_box_weight[i].expiry_date
                )
            }
        } else {
            for (
                let i = 0;
                i < formRef.current.values.item_box_weight.length;
                i++
            ) {
                formRef.current.setFieldValue(
                    `item_box_weight[${i}].expiry_date`,
                    new Date()
                )
            }
        }
    }
    const [total, setTotal] = useState(0)
    const dataForm = { ...data.form.values }
    const dataInex = data.index
    const handleTotal = (value, data) => {
        let sum = 0
        if (value.length > 0) {
            value.map((count) => {
                if (data === 'gross') {
                    if (count.gross_weight !== '') {
                        sum += count.gross_weight
                    }
                    return sum
                }

                if (data === 'net') {
                    if (count.net_weight !== '') {
                        sum += count.net_weight
                    }
                    return sum
                }
            })
        }
        setTotal(sum)
        return sum
    }

    return (
        <Formik
            enableReinitialize={true}
            innerRef={formRef}
            initialValues={{
                item_box_weight:
                    data.boxes == []
                        ? []
                        : data.boxes.map((value) => {
                              return {
                                  barcode:
                                      value.barcode == null ||
                                      value.barcode == ''
                                          ? ''
                                          : value.barcode,
                                  expiry_date:
                                      value.expiry_date == null ||
                                      value.expiry_date == ''
                                          ? ''
                                          : value.expiry_date,
                                  gross_weight:
                                      value.gross_weight == null ||
                                      value.gross_weight == ''
                                          ? ''
                                          : value.gross_weight,
                                  net_weight:
                                      value.net_weight == null ||
                                      value.net_weight == ''
                                          ? ''
                                          : value.net_weight,
                              }
                          }),
            }}
            validationSchema={validationSchema1}
            onSubmit={(values, { resetForm, setSubmitting }) => {
                console.log(values)
                setSubmitting(false)
                getData({
                    ...values,
                    ...{ cancel: false, index: data.index, total },
                })
                // setTimeout(() => {
                //     alert(JSON.stringify(values, null, 2))
                //     resetForm()
                // }, 400)
            }}
        >
            {({ values }) => {
                const item_box_weight = values.item_box_weight
                return (
                    <Form autoComplete="off" autoSave="off">
                        <FormContainer size="sm">
                            <div className=" flex justify-between mb-4">
                                <Button
                                    variant="solid"
                                    type="button"
                                    onClick={() => changeDateForAll()}
                                >
                                    Same Expiry Date For All
                                </Button>
                                <h5 className="mb-4">Add Item Box Weight</h5>
                            </div>
                            <Table compact className="border">
                                <THead>
                                    <Tr>
                                        <Th>Sr. No. </Th>
                                        <Th>Expiry</Th>
                                        <Th>Gross Weight in Kg</Th>
                                        <Th>Net Weight in Kg</Th>
                                        <Th>Barcode</Th>
                                    </Tr>
                                </THead>
                                <FieldArray name="item_box_weight">
                                    {({ form }) => (
                                        <TBody>
                                            {item_box_weight &&
                                            item_box_weight.length > 0
                                                ? item_box_weight.map(
                                                      (item_detail, index) => {
                                                          const gross_weight =
                                                              fieldFeedback(
                                                                  form,
                                                                  `item_box_weight[${index}].gross_weight`
                                                              )
                                                          const net_weight =
                                                              fieldFeedback(
                                                                  form,
                                                                  `item_box_weight[${index}].net_weight`
                                                              )
                                                          const expiry_date =
                                                              fieldFeedback(
                                                                  form,
                                                                  `item_box_weight[${index}].expiry_date`
                                                              )
                                                          return (
                                                              <Tr key={index}>
                                                                  <Td width="100">
                                                                      {' '}
                                                                      {index +
                                                                          1}{' '}
                                                                  </Td>
                                                                  <Td>
                                                                      <FormItem
                                                                          className="mb-0"
                                                                          invalid={
                                                                              expiry_date.invalid
                                                                          }
                                                                          layout="vertical"
                                                                          errorMessage={
                                                                              expiry_date.errorMessage
                                                                          }
                                                                      >
                                                                          <Field
                                                                              autoComplete="off"
                                                                              name={`item_box_weight[${index}].expiry_date`}
                                                                          >
                                                                              {({
                                                                                  field,
                                                                                  form,
                                                                              }) => (
                                                                                  <DatePicker
                                                                                      inputFormat="DD-MM-YYYY"
                                                                                      size="sm"
                                                                                      locale="en"
                                                                                      minDate={
                                                                                          new Date()
                                                                                      }
                                                                                      field={
                                                                                          field
                                                                                      }
                                                                                      placeholder="Date"
                                                                                      form={
                                                                                          form
                                                                                      }
                                                                                      value={
                                                                                          values
                                                                                              .item_box_weight[
                                                                                              index
                                                                                          ]
                                                                                              .expiry_date !=
                                                                                          ''
                                                                                              ? new Date(
                                                                                                    values.item_box_weight[
                                                                                                        index
                                                                                                    ].expiry_date
                                                                                                )
                                                                                              : ''
                                                                                      }
                                                                                      onChange={(
                                                                                          value
                                                                                      ) => {
                                                                                          let date =
                                                                                              new Date(
                                                                                                  value
                                                                                              )
                                                                                          return form.setFieldValue(
                                                                                              field.name,
                                                                                              // date.toDateString()
                                                                                              `${date.getFullYear()}-${
                                                                                                  date.getMonth() <
                                                                                                  10
                                                                                                      ? '0' +
                                                                                                        (date.getMonth() +
                                                                                                            1)
                                                                                                      : date.getMonth() +
                                                                                                        1
                                                                                              }-${
                                                                                                  date.getDate() <
                                                                                                  10
                                                                                                      ? '0' +
                                                                                                        date.getDate()
                                                                                                      : date.getDate()
                                                                                              }`
                                                                                          )
                                                                                      }}
                                                                                  />
                                                                              )}
                                                                          </Field>
                                                                      </FormItem>
                                                                  </Td>
                                                                  <Td>
                                                                      <FormItem
                                                                          className="mb-0"
                                                                          invalid={
                                                                              gross_weight.invalid
                                                                          }
                                                                          layout="vertical"
                                                                          errorMessage={
                                                                              gross_weight.errorMessage
                                                                          }
                                                                      >
                                                                          <Field
                                                                              invalid={
                                                                                  gross_weight.invalid
                                                                              }
                                                                              placeholder="Gross Weight in KG"
                                                                              name={`item_box_weight[${index}].gross_weight`}
                                                                              type="number"
                                                                              component={
                                                                                  Input
                                                                              }
                                                                          />
                                                                      </FormItem>
                                                                  </Td>
                                                                  <Td>
                                                                      <FormItem
                                                                          className="mb-0"
                                                                          invalid={
                                                                              net_weight.invalid
                                                                          }
                                                                          layout="vertical"
                                                                          errorMessage={
                                                                              net_weight.errorMessage
                                                                          }
                                                                      >
                                                                          <Field
                                                                              invalid={
                                                                                  net_weight.invalid
                                                                              }
                                                                              placeholder="Net Weight in KG"
                                                                              name={`item_box_weight[${index}].net_weight`}
                                                                              type="number"
                                                                              component={
                                                                                  Input
                                                                              }
                                                                          />
                                                                      </FormItem>
                                                                  </Td>

                                                                  <Td>
                                                                      {/* {form.values.expiry_date != '' && (<Button
                                                                        shape="circle"
                                                                        size="sm"
                                                                        variant="solid"
                                                                        color="blue-600"
                                                                        type="button"
                                                                        onClick={() =>
                                                                            printBarcode(index)
                                                                        }
                                                                    >Print Barcode
                                                                    </Button>)} */}
                                                                      {item_box_weight[
                                                                          index
                                                                      ]
                                                                          .barcode !==
                                                                      '' ? (
                                                                          <CreatePrint
                                                                              value={
                                                                                  item_box_weight[
                                                                                      index
                                                                                  ]
                                                                              }
                                                                              rmName={
                                                                                  dataForm
                                                                                      .rawMaterialInItems[
                                                                                      dataInex
                                                                                  ]
                                                                                      .raw_material_name
                                                                              }
                                                                          />
                                                                      ) : (
                                                                          ''
                                                                      )}
                                                                  </Td>
                                                              </Tr>
                                                          )
                                                      }
                                                  )
                                                : null}
                                            <Tr>
                                                <Td>Total Weight</Td>
                                                <Td></Td>
                                                <Td>
                                                    {handleTotal(
                                                        values.item_box_weight,
                                                        'gross'
                                                    )}
                                                </Td>
                                                <Td>
                                                    {handleTotal(
                                                        values.item_box_weight,
                                                        'net'
                                                    )}
                                                </Td>
                                                <Td></Td>
                                            </Tr>
                                        </TBody>
                                    )}
                                </FieldArray>
                            </Table>
                            <div className="text-right mt-6">
                                <Button
                                    className="ltr:mr-2 rtl:ml-2"
                                    variant="plain"
                                    type="button"
                                    onClick={() => {
                                        console.log(data.boxes)
                                        getData({
                                            ...{
                                                item_box_weight: [
                                                    ...data.boxes,
                                                ],
                                            },
                                            ...{
                                                cancel: true,
                                                index: data.index,
                                                total: 0,
                                            },
                                        })
                                    }}
                                >
                                    Back
                                </Button>
                                <Button variant="solid" type="submit">
                                    Save
                                </Button>
                            </div>
                        </FormContainer>
                    </Form>
                )
            }}
        </Formik>
    )
}

export default React.memo(ItemBoxWeight)
