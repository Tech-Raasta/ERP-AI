import React, { useEffect, useState, useRef } from "react";
import { FormItem, FormContainer, Radio } from "components/ui";
import AdaptableCard from "components/shared/AdaptableCard";
import Input from "components/ui/Input";
import DatePicker from "components/ui/DatePicker";
import Button from "components/ui/Buttons";
import StickyFooter from "components/shared/StickyFooter";
import Checkbox from "components/ui/Checkbox";
import { Field, Form, FieldArray, Formik, getIn } from "formik";
import { useNavigate, useParams } from "react-router-dom";
import * as Yup from "yup";
import Table from "components/ui/Table";
import "../PurchaseOrder/AddEditPurchaseOrder.css";
import NumberFormat from "react-number-format";
import {
    apiAddVendorPayment,
    apiVendorPaymentApprove,
    apiVendorPaymentGetSingle,
    apiVendorPaymentReject,
} from "services/VendorPaymentService";
import Loading from "components/shared/Loading";
import toast from "components/ui/toast";
import Notification from "components/ui/Notification";
import Moment from "react-moment";
import "./VendorPayment.css";

const { Tr, Th, Td, THead, TBody } = Table;

let p_type;

const validationSchema = Yup.object().shape({
    transaction_date: Yup.string().required("Date Of Transaction Is Required").nullable(),
    total_amount: Yup.number().required("Total Amount Is Required").moreThan(0, "Total Amount Is Required"),
    payment_type: Yup.string().required(" ").test((value)=>{
        p_type = value;
        return true;
    }),
    vendorPaymentItems: Yup.array().of(
        Yup.object().shape({
            beneficiary_name: Yup.string().test((value, context) => {
                const { path } = context;
                // console.log(p_type)
                if (context.parent.is_approved) {
                    if(p_type === 'Online'){
                        if (
                            context.parent.beneficiary_name == "" ||
                            context.parent.beneficiary_name == undefined ||
                            context.parent.beneficiary_name == null
                        ) {
                            toast.push(
                                <Notification title="Error" type="danger" closable>
                                    Please add beneficiary name first.
                                </Notification>
                            );
                            return context.createError({ path, message: " " });
                        } else {
                            return true;
                        }
                    }else{
                        return true
                    }
                } else {
                    return true;
                }
            }).nullable().typeError(),
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

const AddEditVendorPayment = () => {
    const [vendorPaymentData, setVendorPaymentData] = useState({
        transaction_date: "", //YYYY-MM-DD
        payment_type: "Online",
        vendorPaymentItems: [
            {
                vendor_id: "",
                invoice_no: "",
                invoice_date: "",
                vendor_payment_date: "",
                vendor_name: "",
                vendor_payment_amount: "",
                vendor_amount: "",
                narration: "",
                is_approved: false,
                payment_voucher_id: "",
                payment_remarks:'',
            },
        ],
        total_amount: "",
        approved_amount: "",
        remarks: "",
    });
    const [actionBtn, setActionBtn] = useState({
        approve: false,
        delete: false,
        update: false,
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const vendorPaymentId = useParams();
    const formRef = useRef();

    const deleteVendorPayment = () => {
        console.log("Delete Purchase Order");
    };
    const rejectVendorPayment = async () => {
        await apiVendorPaymentReject({
            values: formRef.current,
            ...{ id: vendorPaymentId.vendorpaymentid },
        })
            .then((data) => {
                console.log(data);
                if (data.status === 200) {
                    formRef.current.setSubmitting(false);
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data["message"]}
                        </Notification>
                    );
                    formRef.current.resetForm();
                    navigate("/transaction/vendor-payment");
                } else if (data.status === 201) {
                    formRef.current.setSubmitting(false);
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data["message"]}
                        </Notification>
                    );
                    formRef.current.resetForm();
                    navigate("/transaction/vendor-payment");
                } else if (data.response.status === 422) {
                    let errorData = data.response["data"]["error"]["errors"];
                    for (const errMsg in errorData) {
                        formRef.current.setFieldError(errMsg, errorData[errMsg]["message"]);
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {errorData[errMsg]["message"]}
                            </Notification>
                        );
                    }
                } else if (data.response.status === 500) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {data.response.data["message"]}
                        </Notification>
                    );
                }
            })
            .catch((error) => {
                let errorData = error.response["data"]["error"]["errors"];
                if (error.response.status === 422) {
                    for (const errMsg in errorData) {
                        formRef.current.setFieldError(errMsg, errorData[errMsg]["message"]);
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {errorData[errMsg]["message"]}
                            </Notification>
                        );
                    }
                } else if (error.response.status === 500) {
                    console.log(errorData);
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data["message"]}
                        </Notification>
                    );
                }
            });
    };
    const handleTotal = () => {
        let total = 0;
        formRef.current.values.vendorPaymentItems.map((value) => {
            if (value.is_approved) {
                if (parseFloat(value.vendor_payment_amount) > 0) {
                    total += parseFloat(value.vendor_payment_amount);
                }
            }
        });
        formRef.current.setFieldValue("approved_amount", total);
    };

    const onCheck = (value, e) => {
        console.log(value, e.target.name);
        formRef.current.setFieldValue(e.target.name, value);
        setTimeout(() => {
            handleTotal();
        }, 100);
    };

    const changePaymentType = (e) => {
        console.log(e.target);
        formRef.current.setFieldValue(e.target.name, e.target.value);
    };

    useEffect(() => {
        setLoading(true);
        const fetchData = () => {
            apiVendorPaymentGetSingle(vendorPaymentId.vendorpaymentid)
                .then((data) => {
                    if (data.status === 200) {
                        // console.log(data.data)
                        setActionBtn({
                            approve: data.data.action.approve,
                            delete: data.data.action.delete,
                            update: data.data.action.update,
                        });
                        setVendorPaymentData({
                            transaction_date: new Date(
                                data.data.vendorPayment.transaction_date
                            ),
                            payment_type: data.data.vendorPayment.payment_type,
                            vendorPaymentItems:
                                data.data.vendorPayment.vendorPaymentItems.map((value) => {
                                    return {
                                        id: value.id,
                                        vendor_id: value.vendor_id,
                                        invoice_no: value.invoice_no,
                                        invoice_date:
                                            value.invoice_date != null ? value.invoice_date : "",
                                        vendor_payment_date: value.vendor_payment_date,
                                        is_approved:
                                            value.is_approved != null && value.is_approved == 1
                                                ? true
                                                : false,
                                        is_checked: true,
                                        vendor_name: value.vendor.vendor_name,
                                        vendor_payment_amount: value.vendor_payment_amount,
                                        vendor_amount: value.vendor_amount,
                                        narration: value.narration,
                                        beneficiary_name: value.beneficiary_name,
                                        payment_voucher_id: value.payment_voucher_id,
                                        payment_remarks:value.payment_remarks
                                    };
                                }),
                            total_amount: data.data.vendorPayment.total_amount,
                            approved_amount: data.data.vendorPayment.approved_amount,
                            remarks: data.data.vendorPayment.remarks,
                        });

                        setLoading(false);
                    } else {
                        console.log(data);
                    }
                })
                .catch((error) => {
                    if (error.response.status === 401) {
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {error.response.data["message"]}
                            </Notification>
                        );
                    } else if (error.response.status === 500) {
                        console.log(error.response);
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                {error.response.data["message"]}
                            </Notification>
                        );
                    }
                    setLoading(false);
                });
        };
        fetchData();
    }, []);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={vendorPaymentData}
            innerRef={formRef}
            validationSchema={validationSchema}
            onSubmit={async (values, actions) => {
                console.log(values);
                if (vendorPaymentId.vendorpaymentid) {
                    if (values.approved_amount > 0) {
                        await apiVendorPaymentApprove({
                            values,
                            ...{ id: vendorPaymentId.vendorpaymentid },
                        })
                            .then((data) => {
                                console.log(data);
                                if (data.status === 200) {
                                    actions.setSubmitting(false);
                                    toast.push(
                                        <Notification title="Success" type="success" closable>
                                            {data.data["message"]}
                                        </Notification>
                                    );
                                    actions.resetForm();
                                    navigate("/transaction/vendor-payment");
                                } else if (data.status === 201) {
                                    actions.setSubmitting(false);
                                    toast.push(
                                        <Notification title="Success" type="success" closable>
                                            {data.data["message"]}
                                        </Notification>
                                    );
                                    actions.resetForm();
                                    navigate("/transaction/vendor-payment");
                                } else if (data.response.status === 422) {
                                    let errorData = data.response["data"]["error"]["errors"];
                                    for (const errMsg in errorData) {
                                        actions.setFieldError(errMsg, errorData[errMsg]["message"]);
                                        toast.push(
                                            <Notification title="Error" type="danger" closable>
                                                {errorData[errMsg]["message"]}
                                            </Notification>
                                        );
                                    }
                                } else if (data.response.status === 500) {
                                    toast.push(
                                        <Notification title="Error" type="danger" closable>
                                            {data.response.data["message"]}
                                        </Notification>
                                    );
                                }
                            })
                            .catch((error) => {
                                let errorData = error.response["data"]["error"]["errors"];
                                if (error.response.status === 422) {
                                    for (const errMsg in errorData) {
                                        actions.setFieldError(errMsg, errorData[errMsg]["message"]);
                                        toast.push(
                                            <Notification title="Error" type="danger" closable>
                                                {errorData[errMsg]["message"]}
                                            </Notification>
                                        );
                                    }
                                } else if (error.response.status === 500) {
                                    console.log(errorData);
                                    toast.push(
                                        <Notification title="Error" type="danger" closable>
                                            {error.response.data["message"]}
                                        </Notification>
                                    );
                                }
                            });
                    } else {
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                Please Approve Total Approved Amount.
                            </Notification>
                        );
                    }
                }
            }}
        >
            {({ values, touched, errors, resetForm, isSubmitting }) => {
                const vendorPaymentItems = values.vendorPaymentItems;
                return (
                    <Form autoComplete="off" autoSave="off">
                        <AdaptableCard className="card-shadow mb-4">
                            <h5 className="mb-6">
                                {vendorPaymentId.vendorpaymentid ? "Approve" : "Add"} Vendor
                                Payment
                            </h5>
                            <Loading loading={loading}></Loading>
                            <FormContainer
                                layout="horizontal"
                                size="sm"
                                className={loading ? "hidden" : "visible"}
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-3">
                                    <FormItem
                                        asterisk
                                        label="Date Of Transaction"
                                        invalid={
                                            errors.transaction_date && touched.transaction_date
                                        }
                                        errorMessage={errors.transaction_date}
                                    >
                                        <Field autoComplete="off" name="transaction_date">
                                            {({ field, form }) => (
                                                <DatePicker
                                                    inputFormat="DD-MM-YYYY"
                                                    field={field}
                                                    placeholder="Date Of Transaction"
                                                    form={form}
                                                    value={values.transaction_date}
                                                    onChange={(option) => {
                                                        let date = new Date(option);
                                                        return form.setFieldValue(
                                                            field.name,
                                                            `${date.getFullYear()}-${date.getMonth() < 10
                                                                ? "0" + (date.getMonth() + 1)
                                                                : date.getMonth() + 1
                                                            }-${date.getDate() < 10
                                                                ? "0" + date.getDate()
                                                                : date.getDate()
                                                            }`
                                                        );
                                                    }}
                                                    disabled={!actionBtn.update ? true : false}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                    <p>
                                        <strong>Total Amount (In Rs) * : </strong>
                                        <NumberFormat
                                            displayType="text"
                                            prefix={"₹"}
                                            thousandsGroupStyle={"lakh"}
                                            decimalScale={2}
                                            value={vendorPaymentData.total_amount}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </p>
                                    <p>
                                        <strong>Total Approved Amount (In Rs) * : </strong>
                                        <NumberFormat
                                            displayType="text"
                                            prefix={"₹"}
                                            thousandsGroupStyle={"lakh"}
                                            decimalScale={2}
                                            value={values.approved_amount}
                                            allowLeadingZeros
                                            thousandSeparator=","
                                        />
                                    </p>
                                    <FormItem
                                        asterisk
                                        label="Payment Type"
                                        invalid={errors.payment_type && touched.payment_type}
                                        errorMessage={errors.payment_type}
                                    >
                                        <div className="flex gap-3">
                                            <label className="inline-flex gap-1">
                                                <input
                                                    type="radio"
                                                    className="radio text-amber-600"
                                                    name="payment_type"
                                                    value={"Online"}
                                                    disabled={actionBtn.approve}
                                                    checked={
                                                        values.payment_type == "Online" ? true : false
                                                    }
                                                    onChange={(e) => changePaymentType(e)}
                                                />
                                                Online
                                            </label>
                                            <label className="inline-flex gap-1">
                                                <input
                                                    type="radio"
                                                    className="radio text-amber-600"
                                                    name="payment_type"
                                                    value={0}
                                                    checked={
                                                        values.payment_type == "Manual" ? true : false
                                                    }
                                                    onChange={(e) => changePaymentType(e)}
                                                    disabled={actionBtn.approve}
                                                />
                                                Manual
                                            </label>
                                        </div>
                                    </FormItem>
                                </div>
                                <FieldArray name="vendorPaymentItems">
                                    {({ form, remove, push }) => (
                                        <>
                                            <h5 className="mb-3">Total Payment</h5>
                                            <Table compact className="border mb-6">
                                                <THead>
                                                    <Tr>
                                                        <Th>Due Date*</Th>
                                                        <Th>Invoice No.</Th>
                                                        <Th>Invoice Date</Th>
                                                        <Th>Vendor Name</Th>
                                                        {
                                                            values.payment_type === 'Online' ? (
                                                                <Th>Beneficiary Name*</Th>
                                                            ) : null
                                                        }
                                                        <Th>Payment Amount</Th>
                                                        <Th>Narration</Th>
                                                        <Th>Action</Th>
                                                        {
                                                            values.payment_type === 'Manual' ? (
                                                                <Th>Payment Remarks</Th>
                                                            ) : null
                                                        }
                                                    </Tr>
                                                </THead>
                                                <TBody>
                                                    {vendorPaymentItems &&
                                                        vendorPaymentItems.length > 0 ? (
                                                        vendorPaymentItems.map((item_detail, index) => {
                                                            const is_approved = fieldFeedback(
                                                                form,
                                                                `vendorPaymentItems[${index}].is_approved`
                                                            );
                                                            return (
                                                                <Tr key={index}>
                                                                    <Td>
                                                                        {
                                                                            vendorPaymentItems[index]
                                                                                .vendor_payment_date
                                                                        }
                                                                    </Td>
                                                                    <Td>
                                                                        {vendorPaymentItems[index].invoice_no}
                                                                    </Td>
                                                                    <Td width="150">
                                                                        <Moment
                                                                            format="DD-MM-YYYY"
                                                                            className={
                                                                                vendorPaymentItems[index]
                                                                                    .invoice_date === ""
                                                                                    ? "hidden"
                                                                                    : "visible"
                                                                            }
                                                                        >
                                                                            {vendorPaymentItems[index].invoice_date}
                                                                        </Moment>
                                                                    </Td>
                                                                    <Td width="300">
                                                                        {vendorPaymentItems[index].vendor_name}
                                                                    </Td>
                                                                    {
                                                                        values.payment_type === 'Online' ? (
                                                                            <Td width="300">
                                                                                {vendorPaymentItems[index].beneficiary_name}
                                                                            </Td>
                                                                        ) : null
                                                                    }
                                                                    <Td>
                                                                        <p>
                                                                            <NumberFormat
                                                                                displayType="text"
                                                                                prefix={"₹"}
                                                                                thousandsGroupStyle={"lakh"}
                                                                                decimalScale={2}
                                                                                value={
                                                                                    vendorPaymentItems[index]
                                                                                        .vendor_payment_amount
                                                                                }
                                                                                allowLeadingZeros
                                                                                thousandSeparator=","
                                                                            />
                                                                        </p>
                                                                    </Td>
                                                                    <Td>{vendorPaymentItems[index].narration}</Td>
                                                                    <Td>
                                                                        <FormItem
                                                                            className="mb-0 custom-text-left"
                                                                            invalid={is_approved.invalid}
                                                                            layout="vertical"
                                                                            errorMessage={is_approved.errorMessage}
                                                                        >
                                                                            <Checkbox
                                                                                name={`vendorPaymentItems[${index}].is_approved`}
                                                                                value={
                                                                                    vendorPaymentItems[index].is_approved
                                                                                }
                                                                                checked={
                                                                                    vendorPaymentItems[index].is_approved
                                                                                }
                                                                                onChange={(e, index) =>
                                                                                    onCheck(e, index)
                                                                                }
                                                                                className={
                                                                                    !actionBtn.approve &&
                                                                                        vendorPaymentItems[index].is_approved
                                                                                        ? "changeColor"
                                                                                        : ""
                                                                                }
                                                                                disabled={
                                                                                    !actionBtn.approve ? true : false
                                                                                }
                                                                            ></Checkbox>
                                                                        </FormItem>
                                                                    </Td>
                                                                    {
                                                                        values.payment_type === 'Manual' ? (
                                                                            <Td width="300">
                                                                                {vendorPaymentItems[index].payment_remarks}
                                                                            </Td>
                                                                        ) : null
                                                                    }
                                                                </Tr>
                                                            );
                                                        })
                                                    ) : (
                                                        <Tr>
                                                            <Td colSpan="6" className="p-2 text-center">
                                                                No Record Found
                                                            </Td>
                                                        </Tr>
                                                    )}
                                                </TBody>
                                            </Table>
                                        </>
                                    )}
                                </FieldArray>
                                {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-3">
                                        
                                    </div> */}
                                {/* <h5>Other Information</h5>
                                    <p className="mb-6">{vendorPaymentId.vendorpaymentid ? 'Edit' : 'Add'} final Purchase Order remark</p> */}
                                <div className="grid grid-cols-1 gap-x-8 gap-y-2">
                                    <FormItem
                                        label="Remarks"
                                        invalid={errors.remarks && touched.remarks}
                                        errorMessage={errors.remarks}
                                    >
                                        <Field name="remarks">
                                            {({ field, form }) => {
                                                return (
                                                    <Input
                                                        type="text"
                                                        field={field}
                                                        form={form}
                                                        // name={field.name}
                                                        value={field.value}
                                                        onChange={(option) =>
                                                            form.setFieldValue(
                                                                field.name,
                                                                option.target.value
                                                            )
                                                        }
                                                        textArea
                                                    />
                                                );
                                            }}
                                        </Field>
                                    </FormItem>
                                </div>
                            </FormContainer>
                        </AdaptableCard>
                        <StickyFooter
                            className="-mx-1 md:-mx-1 px-8 flex items-center justify-between py-4"
                            stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        >
                            <div>
                                <Button
                                    size="sm"
                                    type="submit"
                                    variant="solid"
                                    color="emerald-600"
                                    className={
                                        "ltr:mr-6 rtl:ml-6 " + (actionBtn.approve ? "" : "hidden")
                                    }
                                    disabled={isSubmitting}
                                >
                                    Approve
                                </Button>
                                <Button
                                    size="sm"
                                    type="button"
                                    variant="solid"
                                    color="red-600"
                                    onClick={() => rejectVendorPayment()}
                                    disabled={isSubmitting}
                                    className={
                                        "ltr:mr-3 rtl:ml-3 " + (actionBtn.approve ? "" : "hidden")
                                    }
                                >
                                    Reject
                                </Button>
                            </div>
                            <div className="md:flex items-center">
                                <Button
                                    size="sm"
                                    type="submit"
                                    className={
                                        "ltr:mr-3 rtl:ml-3 " +
                                        (actionBtn.approve || !actionBtn.update ? "hidden" : "")
                                    }
                                    variant="solid"
                                    disabled={isSubmitting}
                                >
                                    Submit For Approval
                                </Button>

                                <Button
                                    size="sm"
                                    type="button"
                                    variant="solid"
                                    color="red-600"
                                    onClick={() => deleteVendorPayment()}
                                    disabled={isSubmitting}
                                    className={
                                        "ltr:mr-3 rtl:ml-3 " + (actionBtn.delete ? "" : "hidden")
                                    }
                                >
                                    Delete
                                </Button>

                                <Button
                                    size="sm"
                                    type="button"
                                    onClick={() => navigate("/transaction/vendor-payment")}
                                >
                                    Back
                                </Button>
                            </div>
                        </StickyFooter>
                    </Form>
                );
            }}
        </Formik>
    );
};

export default AddEditVendorPayment;
