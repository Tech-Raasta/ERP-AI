import React, { useState, useRef, useEffect } from "react";
import { FormItem, FormContainer } from "components/ui";
import AdaptableCard from "components/shared/AdaptableCard";
import Input from "components/ui/Input";
import Select from "components/ui/Select";
import Button from "components/ui/Buttons";
import StickyFooter from "components/shared/StickyFooter";
import { Field, Form, FieldArray, Formik, getIn } from "formik";
import { useNavigate, useParams } from "react-router-dom";
import * as Yup from "yup";
import Table from "components/ui/Table";
import Checkbox from "components/ui/Checkbox";
import Loading from "components/shared/Loading";
import Notification from "components/ui/Notification";
import toast from "components/ui/toast";
import Dialog from 'components/ui/Dialog'
import { apiRequisitionGetRaiseProduction, apiRequisitionGetSingle } from "services/RequisitionService";
import { HiEye } from "react-icons/hi";

const { Tr, Th, Td, THead, TBody } = Table;

const validationSchema = Yup.object().shape({
    depot_id: Yup.string().required("Depot Is Required"),
    requisitionProducts: Yup.array().of(
        Yup.object().shape({
            manufacturer_id: Yup.string().nullable().test((_, context)=>{
              const {path} = context;
              if(context.parent.raise == 1){
                  if(context.parent.manufacturer_id == '' || context.parent.manufacturer_id == null || context.parent.manufacturer_id == undefined ){
                      return context.createError({ path, message: " " });
                  }else{
                      return true
                  }
              }else{
                  return true
              }
          }),
            requested_kg: Yup.number().required(" ").typeError(' ').test((_, context)=>{
                const {path} = context;
                if(context.parent.raise == 1){
                    if(context.parent.requested_kg <= 0){
                        return context.createError({ path, message: " " });
                    }else{
                        return true
                    }
                }else{
                    return true
                }
            }),
            raise: Yup.mixed()
        })
    ),
});

const fieldFeedback = (form, name) => {
    const error = getIn(form.errors, name);
    const touch = getIn(form.touched, name);
    return {
        errorMessage: error || "",
        invalid: typeof touch === "undefined" ? false : error && touch,
    };
};


const RaiseRequisition = () => {
    const [requisition, setRequisition] = useState({
        depot_id: '',
        requisitionProducts: []
    });

    const [actionBtn, setActionBtn] = useState({
        approve: false,
        delete: false,
        update: false,
    });
    const [masterOption, setMasterOption] = useState({
        depots: [],
        boxes: [],
    });
    // const [printCodeIndex, setPrintCodeIndex] = useState()
    const [loading, setLoading] = useState(false);
    const [componentLoading, setComponentLoading] = useState(false);
    const [tableLoading, setTableLoading] = useState(false);
    const navigate = useNavigate();
    const requisitionId = useParams();
    const formRef = useRef();

    const [viewIsOpen, setViewIsOpen] = useState({
      isOpen:false,
      allocations: []
    });

  const viewClose = ()=>{
    setViewIsOpen({isOpen:false, allocations:[]})
  }

    useEffect(() => {

        const fetchData = () => {
            setComponentLoading(true);
            if (requisitionId.rid) {
                apiRequisitionGetSingle(requisitionId.rid)
                    .then((data) => {
                        if (data.status === 200) {
                            const { depots, boxes } = data.data.masterData;
                            setMasterOption({
                                depots: depots.map((data) => {
                                    return {
                                        value: data.id,
                                        label: data.depot_name,
                                        state: data.state,
                                    };
                                }),
                                boxes: boxes.map((data) => {
                                    return {
                                        value: data.id,
                                        label: data.box_name,
                                    };
                                }),
                            });
                            setRequisition({
                                depot_id: data.data['requisition'].depot_id != null ? data.data['requisition'].depot_id : "",
                                requisitionProducts: data.data['requisition'].requisitionProducts.map((value) => {
                                  let splitAllocations = value.allocations.split(", ")
                                  let splitNew = splitAllocations.map((value)=>{
                                    return  value.split(" :- ")
                                  })
                                  console.log(splitNew)
                                  return {
                                    id: value.id,
                                    requisition_id: value.requisition_id,
                                    type: value.type,
                                    product_id: value.product_id,
                                    product_name: value.product_name,
                                    no_of_batch: value.no_of_batch,
                                    requested_kg: value.requested_kg,
                                    allocations: splitNew.map((value)=>{
                                      return  {
                                        product:value[0],
                                        qty:value[1]
                                      }
                                    }),
                                    raise: value.raise,
                                    production_status: value.production_status,
                                    manufacturer_id: value.manufacturer_id,
                                  };
                                }),
                            });
                        } else if (data.response.status === 422) {
                            console.log(data.response.status);
                        }
                        setComponentLoading(false);
                    })
                    .catch((error) => {
                        console.log(error);
                        if (error.response.status === 401) {
                            toast.push(
                                <Notification title="Error" type="danger" closable>
                                    {error.response.data["message"]}
                                </Notification>
                            );
                        }
                        setComponentLoading(false);
                    });
            }
            return true;
        };
        fetchData();
    }, []);



    console.log("RaiseRequisition.js");
    return (
        <>
            <Formik
                enableReinitialize={true}
                initialValues={{
                    depot_id: requisition.depot_id,
                    requisitionProducts: requisition.requisitionProducts
                }}
                innerRef={formRef}
                validationSchema={validationSchema}
                onSubmit={(values, { resetForm, setSubmitting }) => {
                    console.log(values);
                    setSubmitting(false);
                    if (requisitionId.rid) {
                      apiRequisitionGetRaiseProduction(requisitionId.rid, values).then((data) => {
                            if (data.status === 200) {
                                console.log(data.data);
                                toast.push(
                                    <Notification title="Success" type="success" closable>
                                        {data.data["message"]}
                                    </Notification>
                                );
                                resetForm()
                                navigate("/production/requisition", { replace: true })
                            } else if (data.status === 201) {
                                toast.push(
                                    <Notification title="Success" type="success" closable>
                                        {data.data["message"]}
                                    </Notification>
                                );
                                resetForm()
                                setTimeout(() => {
                                    navigate("/production/requisition", { replace: true });
                                }, 2000);
                            } else if (data.response.status === 422) {
                                toast.push(
                                    <Notification title="Error" type="danger" closable>
                                        {data.response.data["message"]}
                                    </Notification>
                                );
                            } else if (data.response.status === 500) {
                                toast.push(
                                    <Notification title="Error" type="danger" closable>
                                        {data.response.data["message"]}
                                    </Notification>
                                );
                            }
                        });
                    }
                }}
            >
                {({ values, touched, errors, resetForm, isSubmitting }) => {
                    const requisitionProducts = values.requisitionProducts;
                    return (
                        <Form autoComplete="off" autoSave="off">
                            <AdaptableCard className="card-shadow mb-4">
                                <h5 className="mb-6"> Raise Requisition</h5>
                                {/* <p className="mb-6">{purchaseId.purchaseid ? 'Edit' : 'Add'} basic details of Purchase</p> */}
                                <Loading loading={componentLoading}></Loading>
                                <FormContainer layout="horizontal" size="sm" className={componentLoading ? "hidden" : "visible"}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-3">
                                        <FormItem asterisk label="Depot" invalid={errors.depot_id && touched.depot_id} errorMessage={errors.depot_id}>
                                            <Field name="depot_id">
                                                {({ field, form }) => (
                                                    <Select
                                                        field={field}
                                                        form={form}
                                                        options={masterOption.depots}
                                                        // onFocus={onFocus}
                                                        isLoading={loading}
                                                        value={masterOption.depots.filter((option) => option.value === values.depot_id)}
                                                        onChange={(option) => {
                                                            form.setFieldValue(field.name, option?.value);
                                                        }}
                                                        isDisabled={true}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                    </div>
                                    {/* <h5>Items Imformation</h5>
                                <p className="mb-6">{purchaseId.purchaseid ? 'Edit' : 'Add'} details of Items for purchase order</p> */}
                                  <div className="w-[80%] md:w-[70%]">
                                    <Table compact className="border mb-6">
                                        <THead>
                                            <Tr>
                                                <Th>Products</Th>
                                                <Th>View Allocation</Th>
                                                <Th>Raise Production For KGS*</Th>
                                                <Th>Action</Th>
                                                <Th>Manufacturer</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="requisitionProducts">
                                                {({ field, form, remove, push }) => (
                                                    <>
                                                        <Tr className={tableLoading ? 'visible' : 'hidden'}>
                                                            <Td colSpan="9"><Loading loading={tableLoading}></Loading></Td>
                                                        </Tr>
                                                        
                                                        {!tableLoading && requisitionProducts && requisitionProducts.length > 0 ? requisitionProducts.map(
                                                        (_, index) => {
                                                            const manufacturer_id = fieldFeedback(form, `requisitionProducts[${index}].manufacturer_id`)
                                                            const requested_kg = fieldFeedback(form, `requisitionProducts[${index}].requested_kg`)
                                                            const raise = fieldFeedback(form, `requisitionProducts[${index}].raise`)
                                                                  return (
                                                                      <Tr key={index}>
                                                                          <Td width="300">{requisitionProducts[index].product_name}</Td>
                                                                          <Td width="100" className="text-center">
                                                                            <Button
                                                                                shape="circle"
                                                                                variant="twoTone"
                                                                                type="button"
                                                                                size="xs"
                                                                                color="blue-600"
                                                                                icon={<HiEye />}
                                                                                onClick={() => {
                                                                                    setViewIsOpen({isOpen:true, allocations : requisitionProducts[index].allocations});
                                                                                }}
                                                                            />
                                                                          </Td>
                                                                          <Td width="150">
                                                                              <FormItem
                                                                                  className="mb-0"
                                                                                  invalid={requested_kg.invalid}
                                                                                  layout="vertical"
                                                                                  errorMessage={requested_kg.errorMessage}
                                                                              >
                                                                                  <Field
                                                                                      invalid={requested_kg.invalid}
                                                                                      placeholder="Quantity"
                                                                                      name={`requisitionProducts[${index}].requested_kg`}
                                                                                      type="number"
                                                                                      onWheel={(e) =>e.target.blur()}
                                                                                      component={Input}
                                                                                      disabled={actionBtn.approve}
                                                                                  />
                                                                              </FormItem>
                                                                          </Td>
                                                                          <Td width="80" className="text-center">
                                                                              <FormItem
                                                                                  className="mb-0 custom-text-left"
                                                                                  invalid={raise.invalid}
                                                                                  layout="vertical"
                                                                                  errorMessage={raise.errorMessage}
                                                                              >
                                                                                  <Checkbox
                                                                                      name={`requisitionProducts[${index}].raise`}
                                                                                      value={requisitionProducts[index].raise}
                                                                                      checked={requisitionProducts[index].raise == 0 ? false : true}
                                                                                      className="mr-0"
                                                                                      onChange={(value, event) =>{
                                                                                          form.setFieldValue(event.target.name, value)
                                                                                      }}
                                                                                      disabled={actionBtn.approve}
                                                                                  ></Checkbox>
                                                                              </FormItem>
                                                                          </Td>
                                                                          <Td width="350">
                                                                              <FormItem
                                                                                  className="mb-0 custom-text-left"
                                                                                  invalid={manufacturer_id.invalid}
                                                                                  layout="vertical"
                                                                                  errorMessage={manufacturer_id.errorMessage}
                                                                              >
                                                                                  <Field name={`requisitionProducts[${index}].manufacturer_id`}>
                                                                                      {({field, form,}) =>(
                                                                                          <Select
                                                                                              className="custom-text-left text-left"
                                                                                              field={field}
                                                                                              form={form}
                                                                                              options={masterOption.depots}
                                                                                              isLoading={loading}
                                                                                              value={masterOption.depots ? masterOption.depots.filter((option) => option.value === values.requisitionProducts[index].manufacturer_id) : values.requisitionProducts[index].manufacturer_id}
                                                                                              onChange={(option, field) => {
                                                                                                  console.log(field.name, option)
                                                                                                  form.setFieldValue(field.name, option.value)
                                                                                              }}
                                                                                              isDisabled={actionBtn.approve}
                                                                                          />
                                                                                      )}
                                                                                  </Field>
                                                                              </FormItem>
                                                                          </Td>
                                                                    </Tr>
                                                                  )
                                                              }
                                                          )
                                                        : null}
                                                    </>
                                                )}
                                            </FieldArray>
                                        </TBody>
                                    </Table>
                                  </div>
                                </FormContainer>
                            </AdaptableCard>
                            <StickyFooter className="-mx-1 md:-mx-1 px-8 flex items-center justify-between py-4" stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <div></div>
                                <div className="md:flex items-center">
                                    <Button size="sm" type="submit" className={"ltr:mr-3 rtl:ml-3 " + (actionBtn.approve ? "hidden" : "")} variant="solid" disabled={isSubmitting}>
                                        Save
                                    </Button>
                                    <Button size="sm" type="button" onClick={() => navigate("/production/requisition")}>
                                        Back
                                    </Button>
                                </div>
                            </StickyFooter>
                        </Form>
                    );
                }}
            </Formik>
            <Dialog
                isOpen={viewIsOpen.isOpen}
                onClose={viewClose}
                onRequestClose={viewClose}
            >
                <h5 className="mb-4"> Allocations</h5>
                <div className='grid grid-cols-[50px_1fr_80px] gap-[10px] mb-2 font-bold'>
                    <p>Sr. No.</p>
                    <p>Product</p>
                    <p>Qty</p>
                </div>
                {
                    viewIsOpen.allocations.map((data, index)=>(
                        <div key={index} className=' grid grid-cols-[50px_1fr_80px] gap-[10px] mb-1'>
                            <p>{index + 1}</p>
                            <p>{data.product}</p>
                            <p>{data.qty}</p>
                        </div>
                    ))
                }
                <div className="text-right mt-6">
                    <Button
                        className="ltr:mr-2 rtl:ml-2"
                        variant="plain"
                        type="button"
                        onClick={viewClose}
                        size="lg"
                    >
                        Close
                    </Button>
                </div>
            </Dialog>
        </>
    );
};

export default RaiseRequisition