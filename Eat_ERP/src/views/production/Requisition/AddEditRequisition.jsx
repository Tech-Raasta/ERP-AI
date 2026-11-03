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
import { apiRequisitionGetItems, apiRequisitionGetItemStock, apiRequisitionGetSingle, apiRequisitionMasterData, apiRequisitionPost, apiRequisitionUpdate } from "services/RequisitionService";
import { HiMinus } from "react-icons/hi";

const { Tr, Th, Td, THead, TBody } = Table;

const validationSchema = Yup.object().shape({
    depot_id: Yup.string().required("Depot Is Required"),
    requisitionItems: Yup.array().of(
        Yup.array().of(
            Yup.object().shape({
                item_id: Yup.string().required(" "),
                item_name: Yup.string().required(" "),
                raise_requisition_for: Yup.number().required(" ").typeError(' ').test((_, context) => {
                    const { path } = context;
                    if (context.parent.raise == 1) {
                        if (context.parent.raise_requisition_for <= 0) {
                            return context.createError({ path, message: " " });
                        } else {
                            return true
                        }
                    } else {
                        return true
                    }
                }),
                raise: Yup.mixed()
            })
        )
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


const AddEditRequisition = () => {
    const [requisition, setRequisition] = useState({
        depot_id: '',
        requisitionItems: []
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

    const [requisitionExtra, setRequisitionExtra] = useState([]);
    // const [printCodeIndex, setPrintCodeIndex] = useState()
    const [loading, setLoading] = useState(false);
    const [componentLoading, setComponentLoading] = useState(false);
    const [tableLoading, setTableLoading] = useState(false);
    const navigate = useNavigate();
    const requisitionId = useParams();
    const formRef = useRef();


    const getItemDetails = (id) => {
        setTableLoading(true);
        apiRequisitionGetItems(id).then(data => {
            console.log(data)
            // const sortedData = data.data['requisitionItems'].sort((a, b) => parseInt(a.category_id) - parseInt(b.category_id));
            // console.log('sortedData : ', sortedData)
            // sortedData.map((value, index) => {
            //     formRef.current.setFieldValue(`requisitionItems[${index}].item_id`, value.item_id)
            //     formRef.current.setFieldValue(`requisitionItems[${index}].item_name`, value.item_name)
            //     formRef.current.setFieldValue(`requisitionItems[${index}].depot_id`, value.depot_id);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].depot_name`, value.depot_name);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].difference`, value.difference);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].inventory`, value.inventory);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].moq_inventory`, value.moq_inventory);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].moq_production`, value.moq_production);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].production_status`, value.production_status);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].raise`, value.raise);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].raise_requisition_for`, value.raise_requisition_for);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].requisition_id`, value.requisition_id);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].sales`, value.sales);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].category_id`, value.box.category_id);
            //     formRef.current.setFieldValue(`requisitionItems[${index}].category_name`, value.category_name);
            // })
            const result = Object.groupBy(data.data['requisitionItems'], (el) => el.category_name);
            const result1 = Object.groupBy(data.data['requisitionItems'], (el) => el.category_name);
            console.log('result : ', Object.values(result));
            const keyVal = Object.keys(result1).map((key) => key)
            console.log('keyVal : ', keyVal);
            setRequisition({
                depot_id: id,
                requisitionItems: Object.values(result),
            });
            setRequisitionExtra(keyVal)
            setTableLoading(false);
        })
    }

    const getItemStock = (depotId, itemId, index, indx) => {
        apiRequisitionGetItemStock(depotId == '' ? 0 : depotId, itemId).then(data => {
            console.log(data.data['requisitionItem']);
            const { depot_id, depot_name, difference, inventory, moq_inventory, moq_production, production_status, raise, raise_requisition_for, requisition_id, sales, category_id, category_name } = data.data['requisitionItem'];
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].depot_id`, depot_id);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].depot_name`, depot_name);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].difference`, difference);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].inventory`, inventory);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].moq_inventory`, moq_inventory);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].moq_production`, moq_production);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].production_status`, production_status);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].raise`, parseInt(raise));
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].raise_requisition_for`, raise_requisition_for);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].requisition_id`, requisition_id);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].sales`, sales);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].category_id`, category_id);
            formRef.current.setFieldValue(`requisitionItems[${index}][${indx}].category_name`, category_name);

        })
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
                            // const sortedItems = data.data['requisition'].requisitionItems.sort((a, b) => parseInt(a.box.category_id) - parseInt(b.box.category_id));
                            // console.log('sortedItems : ', sortedItems);
                            const sortedItems = data.data['requisition'].requisitionItems.map((value) => {
                                return {
                                    requisition_id: value.requisition_id,
                                    item_id: value.item_id,
                                    item_name: value.item_name,
                                    sales: value.sales,
                                    inventory: value.inventory,
                                    difference: value.difference,
                                    moq_inventory: value.moq_inventory,
                                    moq_production: value.moq_production,
                                    raise_requisition_for: value.raise_requisition_for,
                                    depot_id: value.depot_id,
                                    depot_name: value.depot_name,
                                    raise: value.raise,
                                    production_status: value.production_status,
                                    category_id: value.box.category.category_id,
                                    category_name: value.box.category.category_name
                                };
                            })
                            const result = Object.groupBy(sortedItems, (el) => el.category_name);
                            const result1 = Object.groupBy(sortedItems, (el) => el.category_name);
                            console.log('result : ', Object.values(result));
                            const keyVal = Object.keys(result1).map((key) => key)
                            console.log('keyVal : ', keyVal);
                            setRequisition({
                                depot_id: data.data['requisition'].depot_id != null ? data.data['requisition'].depot_id : "",
                                requisitionItems: Object.values(result),
                            });
                            setRequisitionExtra(keyVal)
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
            } else {
                apiRequisitionMasterData()
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
                        }
                        setComponentLoading(false);
                    })
                    .catch((error) => {
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



    console.log("AddEditRequisition.js");
    return (
        <>
            <Formik
                enableReinitialize={true}
                initialValues={{
                    depot_id: requisition.depot_id,
                    requisitionItems: requisition.requisitionItems
                }}
                innerRef={formRef}
                validationSchema={validationSchema}
                onSubmit={(values, { resetForm, setSubmitting }) => {
                    console.log(values);
                    let unGroup = values.requisitionItems.flat()
                    console.log(unGroup)
                    setSubmitting(false);
                    if (requisitionId.rid) {
                        apiRequisitionUpdate(requisitionId.rid, { depot_id: values.depot_id, requisitionItems: unGroup }).then((data) => {
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
                    } else {
                        apiRequisitionPost({ depot_id: values.depot_id, requisitionItems: unGroup }).then((data) => {
                            console.log(data);
                            if (data.status === 200) {
                                toast.push(
                                    <Notification title="Success" type="success" closable>
                                        {data.data["message"]}
                                    </Notification>
                                );
                                resetForm()
                                setTimeout(() => {
                                    navigate("/production/requisition", { replace: true });
                                }, 2000);
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
                    const requisitionItems = values.requisitionItems;
                    return (
                        <Form autoComplete="off" autoSave="off">
                            <AdaptableCard className="card-shadow mb-4">
                                <h5 className="mb-6"> {requisitionId.rid ? "Edit" : "Add"} Requisition</h5>
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
                                                            getItemDetails(option?.value)
                                                        }}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                    </div>
                                    {/* <h5>Items Imformation</h5>
                                <p className="mb-6">{purchaseId.purchaseid ? 'Edit' : 'Add'} details of Items for purchase order</p> */}
                                    <Table compact className="border mb-6">
                                        <THead>
                                            <Tr>
                                                <Th>
                                                    Category Name
                                                </Th>
                                                <Th>Box*</Th>
                                                <Th>Sales</Th>
                                                <Th>Inventory</Th>
                                                <Th>Difference</Th>
                                                {/* <Th>MOQ Inventory</Th>
                                                <Th>MOQ Production</Th> */}
                                                <Th>Raise Requisition For*</Th>
                                                <Th>Raise*</Th>
                                                <Th>Action</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="requisitionItems">
                                                {({ field, form, remove, push }) => (
                                                    <>
                                                        <Tr className={tableLoading ? 'visible' : 'hidden'}>
                                                            <Td colSpan="8"><Loading loading={tableLoading}></Loading></Td>
                                                        </Tr>
                                                        {
                                                            !tableLoading && requisitionItems.map((key, index) => {
                                                                const AllTr = () => (
                                                                    <>
                                                                        <Tr key={index}>
                                                                            <Td width="150" rowSpan={requisitionItems[index].length + 1} className=" align-top"><b>{requisitionExtra[index]}</b></Td>
                                                                        </Tr>
                                                                        {
                                                                            requisitionItems[index].map((item, indx) => {
                                                                                const item_id = fieldFeedback(form, `requisitionItems[${index}][${indx}].item_id`)
                                                                                const raise_requisition_for = fieldFeedback(form, `requisitionItems[${index}][${indx}].raise_requisition_for`)
                                                                                const raise = fieldFeedback(form, `requisitionItems[${index}][${indx}].raise`)
                                                                                return (
                                                                                    <Tr key={indx}>
                                                                                        <Td width="350">
                                                                                            <FormItem
                                                                                                className="mb-0 custom-text-left"
                                                                                                invalid={item_id.invalid}
                                                                                                layout="vertical"
                                                                                                errorMessage={item_id.errorMessage}
                                                                                            >
                                                                                                <Field name={`requisitionItems[${index}][${indx}].item_id`}>
                                                                                                    {({ field, form, }) => (
                                                                                                        <Select
                                                                                                            className="custom-text-left text-left"
                                                                                                            field={field}
                                                                                                            form={form}
                                                                                                            options={masterOption.boxes}
                                                                                                            isLoading={loading}
                                                                                                            value={masterOption.boxes ? masterOption.boxes.filter((option) => option.value === values.requisitionItems[index][indx].item_id) : values.requisitionItems[index][indx].item_id}
                                                                                                            onChange={(option, field) => {
                                                                                                                console.log(field.name, option)
                                                                                                                form.setFieldValue(field.name, option.value)
                                                                                                                form.setFieldValue(`requisitionItems[${index}][${indx}].item_name`, option.label)
                                                                                                                getItemStock(values.depot_id, option.value, index, indx)
                                                                                                            }}
                                                                                                            isDisabled={actionBtn.approve || requisitionItems[index][indx].production_status == 'Closed' ? true : false}
                                                                                                        />
                                                                                                    )}
                                                                                                </Field>
                                                                                            </FormItem>
                                                                                        </Td>
                                                                                        <Td width="100">{requisitionItems[index][indx].sales}</Td>
                                                                                        <Td width="100">{requisitionItems[index][indx].inventory}</Td>
                                                                                        <Td width="100">{requisitionItems[index][indx].difference}</Td>
                                                                                        {/* <Td width="100">{requisitionItems[index][indx].moq_inventory}</Td>
                                                                                    <Td width="100">{requisitionItems[index][indx].moq_production}</Td> */}
                                                                                        <Td width="150">
                                                                                            <FormItem
                                                                                                className="mb-0"
                                                                                                invalid={raise_requisition_for.invalid}
                                                                                                layout="vertical"
                                                                                                errorMessage={raise_requisition_for.errorMessage}
                                                                                            >
                                                                                                <Field
                                                                                                    invalid={raise_requisition_for.invalid}
                                                                                                    placeholder="Quantity"
                                                                                                    name={`requisitionItems[${index}][${indx}].raise_requisition_for`}
                                                                                                    type="number"
                                                                                                    onWheel={(e) => e.target.blur()}
                                                                                                    component={Input}
                                                                                                    disabled={actionBtn.approve || requisitionItems[index][indx].production_status == 'Closed' ? true : false}
                                                                                                />
                                                                                            </FormItem>
                                                                                        </Td>
                                                                                        <Td width="100">
                                                                                            <FormItem
                                                                                                className="mb-0 custom-text-left"
                                                                                                invalid={raise.invalid}
                                                                                                layout="vertical"
                                                                                                errorMessage={raise.errorMessage}
                                                                                            >
                                                                                                <Checkbox
                                                                                                    name={`requisitionItems[${index}][${indx}].raise`}
                                                                                                    value={requisitionItems[index][indx].raise}
                                                                                                    checked={requisitionItems[index][indx].raise == 0 ? false : true}
                                                                                                    onChange={(value, event) => {
                                                                                                        console.log(value, event.target.name)
                                                                                                        form.setFieldValue(event.target.name, value)
                                                                                                    }}
                                                                                                    disabled={actionBtn.approve || requisitionItems[index][indx].production_status == 'Closed' ? true : false}
                                                                                                ></Checkbox>
                                                                                            </FormItem>
                                                                                        </Td>
                                                                                        <Td
                                                                                            width="80"
                                                                                            className={actionBtn.approve ? 'hidden' : 'visible'}
                                                                                        >
                                                                                            <Button
                                                                                                shape="circle"
                                                                                                size="sm"
                                                                                                type="button"
                                                                                                icon={
                                                                                                    <HiMinus />
                                                                                                }
                                                                                                onClick={() => {
                                                                                                    // remove(index)
                                                                                                    if (requisitionItems[index].length > 1) {
                                                                                                        console.log("inside Array")
                                                                                                        let newArr = [];
                                                                                                        requisitionItems.forEach((val, idx) => {
                                                                                                            if (idx === index) {
                                                                                                                newArr.push(val.filter((_, i) => i !== indx))
                                                                                                            } else {
                                                                                                                newArr.push(val)
                                                                                                            }
                                                                                                        })
                                                                                                        setRequisition({ ...requisition, requisitionItems: newArr })

                                                                                                    } else {
                                                                                                        console.log("Outer array")
                                                                                                        setRequisitionExtra(requisitionExtra.filter((val, i) => i !== index))
                                                                                                        remove(index)
                                                                                                    }
                                                                                                }}
                                                                                                disabled={requisitionItems[index][indx].production_status == 'Closed' ? true : false}
                                                                                            />
                                                                                        </Td>
                                                                                    </Tr>
                                                                                )
                                                                            })
                                                                        }
                                                                    </>
                                                                )
                                                                return (
                                                                    <AllTr key={index} />
                                                                )
                                                            })
                                                        }

                                                        <Tr className={tableLoading || actionBtn.approve ? 'hidden' : 'visible'} >
                                                            <Td colSpan="9" className="custom-text-left" >
                                                                <Button
                                                                    type="button"
                                                                    className="ltr:mr-2 rtl:ml-2"
                                                                    onClick={() => {
                                                                        console.log('Requisition Data : ', requisitionItems)
                                                                        setRequisitionExtra(prev => [...prev, "New"])
                                                                        push([{
                                                                            requisition_id: '',
                                                                            item_id: '',
                                                                            item_name: '',
                                                                            sales: '',
                                                                            inventory: '',
                                                                            difference: '',
                                                                            moq_inventory: '',
                                                                            moq_production: '',
                                                                            raise_requisition_for: '',
                                                                            depot_id: '',
                                                                            depot_name: '',
                                                                            raise: 0,
                                                                            production_status: '',
                                                                            category_id: ''
                                                                        }])
                                                                    }}
                                                                >
                                                                    Add Item
                                                                </Button>
                                                            </Td>
                                                        </Tr>
                                                    </>
                                                )}
                                            </FieldArray>
                                        </TBody>
                                    </Table>
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
        </>
    );
};

export default AddEditRequisition