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
import { apiAddVendorPayment, apiVendorPaymentDelete, apiVendorPaymentGetSingleEdit, apiVendorPaymentPost, apiVendorPaymentUpdate } from "services/VendorPaymentService";
import Loading from "components/shared/Loading";
import toast from "components/ui/toast";
import Notification from "components/ui/Notification";
import Tabs from "components/ui/Tabs";
import Moment from "react-moment";
import ConfirmDialog from "components/shared/ConfirmDialog";

const { TabNav, TabList, TabContent } = Tabs;

const { Tr, Th, Td, THead, TBody } = Table;

const validationSchema = Yup.object().shape({
    transaction_date: Yup.string().required("Date Of Transaction Is Required").nullable(),
    // approved_amount: Yup.number()
    //     .required('Total Amount Is Required')
    //     .moreThan(0, 'Total Amount Is Required'),
    vendorPaymentItems: Yup.array().of(
        Yup.object().shape({
            vendor_payment_amount: Yup.number()
                .required(" ")
                .test((value, context) => {
                    const { path } = context;
                    // console.log(value)
                    if (context.parent.is_checked) {
                        if (parseFloat(context.parent.balance_amount) < 0) {
                            return context.createError({ path, message: " " });
                        } else if (context.parent.vendor_payment_amount <= 0) {
                            return context.createError({ path, message: " " });
                        } else {
                            if (context.parent.beneficiary_name == null) {
                                toast.push(
                                    <Notification title="Error" type="danger" closable>
                                        Please add beneficiary name first.
                                    </Notification>
                                );

                                return context.createError({
                                    path,
                                    message: " ",
                                });
                            } else {
                                return true;
                            }
                        }
                    } else {
                        return true;
                    }
                }),
            balance_amount: Yup.number().required(" "),
            // payment_type: Yup.string().required(' ')
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
                vendor_amount: "",
                paid_amount: "",
                vendor_payment_amount: "",
                balance_amount: "",
                narration: "",
                is_checked: false,
                payment_voucher_id: "",
            },
        ],
        approved_amount: 0,
        total_amount: "",
        remarks: "",
    });
    const [actionBtn, setActionBtn] = useState({
        approve: false,
        delete: false,
        update: false,
    });

    const [statusCount, setStatusCount] = useState({
        immediate: 0,
        due: 0,
        notDue: 0,
        immediateAmt: 0,
        dueAmt: 0,
        notDueAmt: 0,
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const vendorPaymentId = useParams();
    const formRef = useRef();

    const [open, setOpen] = useState(false);

    const handleClose = () => {
        console.log("Close");
        setOpen(false);
    };

    const handleConfirm = () => {
        console.log("Confirm");
        apiVendorPaymentDelete(vendorPaymentId.vendorpaymentid)
            .then((data) => {
                console.log(data);
                if (data.status === 200) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data["message"]}
                        </Notification>
                    );
                    navigate("/transaction/vendor-payment");
                } else if (data.status === 201) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {data.data["message"]}
                        </Notification>
                    );
                    navigate("/transaction/vendor-payment");
                } else if (data.response.status === 422) {
                    let errorData = data.response["data"]["error"]["errors"];
                    for (const errMsg in errorData) {
                        formRef.current.actions.setFieldError(errMsg, errorData[errMsg]["message"]);
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
                setOpen(false);
            })
            .catch((error) => {
                let errorData = error.response["data"]["error"]["errors"];
                if (error.response.status === 422) {
                    for (const errMsg in errorData) {
                        formRef.current.actions.setFieldError(errMsg, errorData[errMsg]["message"]);
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
                setOpen(false);
            });
    };

    const deleteVendorPayment = () => {
        setOpen(true);
    };
    const rejectPurchaseOrder = () => {
        console.log("Reject Purchase Order");
    };
    const [finalAmountCheck, setFinalAmountCheck] = useState(0);
    const vendorId = useParams();

    // const changeVal = (val)=>{
    //     setVendorPaymentData(prev=>({...prev, payment_type:val}))
    // }

    useEffect(() => {
        setLoading(true);
        const fetchData = () => {
            if (vendorPaymentId.vendorpaymentid) {
                apiVendorPaymentGetSingleEdit(vendorPaymentId.vendorpaymentid)
                    .then((data) => {
                        if (data.status === 200) {
                            let total = 0;
                            const dataCopy = data.data.vendorPayments;
                            console.log("edit", data.data);
                            dataCopy.map((value) => (total += parseFloat(value.total_payable)));

                            setStatusCount({
                                immediate: data.data["statusCount"].immediate,
                                immediateAmt: data.data["statusCount"].immediateAmt,
                                due: data.data["statusCount"].due,
                                dueAmt: data.data["statusCount"].dueAmt,
                                notDue: data.data["statusCount"].notDue,
                                notDueAmt: data.data["statusCount"].notDueAmt,
                            });

                            setActionBtn({
                                approve: data.data["action"].approve,
                                delete: data.data["action"].delete,
                                update: data.data["action"].update,
                            });
                            // console.log('data.data[vendorPayment].payment_type', data.data['vendorPayment'].payment_type)
                            setVendorPaymentData({
                                transaction_date: new Date(data.data["vendorPayment"].transaction_date),
                                payment_type: data.data["vendorPayment"].payment_type,
                                vendorPaymentItems: data.data.vendorPayments.map((value) => {
                                    return {
                                        vendor_id: value.vendor_id,
                                        vendor_payment_date: value.date_of_processing,
                                        is_checked: value.vendorPaymentItems && value.vendorPaymentItems.length > 0 ? true : false,
                                        invoice_no: value.invoice_no != null ? value.invoice_no : "",
                                        invoice_date: value.invoice_date != null ? value.invoice_date : "",
                                        vendor_name: value.vendor_name,
                                        vendor_amount: value.total_payable,
                                        paid_amount: value.paid_amount != "" || value.paid_amount != null ? value.paid_amount : 0,
                                        vendor_payment_amount:
                                            value.vendorPaymentItems && value.vendorPaymentItems.length > 0
                                                ? value.vendorPaymentItems[0].vendor_payment_amount != null && value.vendorPaymentItems[0].vendor_payment_amount != ""
                                                    ? parseFloat(value.vendorPaymentItems[0].vendor_payment_amount)
                                                    : 0
                                                : 0,
                                        balance_amount:
                                            value.vendorPaymentItems && value.vendorPaymentItems.length > 0
                                                ? value.vendorPaymentItems[0].vendor_payment_amount != null && value.vendorPaymentItems[0].vendor_payment_amount != ""
                                                    ? parseFloat(value.total_payable) - parseFloat(value.vendorPaymentItems[0].vendor_payment_amount)
                                                    : parseFloat(value.total_payable) - 0
                                                : parseFloat(value.total_payable) - 0,
                                        narration: value.type,
                                        beneficiary_name: value.vendor["bank_acc_name"],
                                        payment_type: value.payment_type,
                                        payment_voucher_id: value.id,
                                    };
                                }),
                                total_amount: data.data["statusCount"].totalPayableAmt,
                                approved_amount: data.data["vendorPayment"].total_amount,
                                remarks: data.data["vendorPayment"].remarks,
                            });
                            setLoading(false);
                        } else {
                            console.log(data);
                        }
                    })
                    .catch((error) => {
                        console.log(error);
                        if (error.response.status === 401) {
                            toast.push(
                                <Notification title="Error" type="danger" closable>
                                    {error.response.data["message"]}
                                </Notification>
                            );
                        } else if (error.response.status === 500) {
                            toast.push(
                                <Notification title="Error" type="danger" closable>
                                    {error.response.data["message"]}
                                </Notification>
                            );
                        }
                        setLoading(false);
                    });
            } else {
                apiAddVendorPayment()
                    .then((data) => {
                        if (data.status === 200) {
                            // let total = 0
                            // const dataCopy = data.data.vendorPayments
                            // console.log(data.data)
                            // dataCopy.map(
                            //     (value) =>
                            //         (total += parseFloat(value.total_payable))
                            // )
                            console.log("Add", data.data);
                            setStatusCount({
                                immediate: data.data["statusCount"].immediate,
                                immediateAmt: data.data["statusCount"].immediateAmt,
                                due: data.data["statusCount"].due,
                                dueAmt: data.data["statusCount"].dueAmt,
                                notDue: data.data["statusCount"].notDue,
                                notDueAmt: data.data["statusCount"].notDueAmt,
                            });

                            setVendorPaymentData({
                                transaction_date: new Date(),
                                payment_type: "Online",
                                vendorPaymentItems: data.data.vendorPayments.map((value) => {
                                    return {
                                        vendor_id: value.vendor_id,
                                        vendor_payment_date: value.date_of_processing,
                                        is_checked: false,
                                        invoice_no: value.invoice_no != null ? value.invoice_no : "",
                                        invoice_date: value.invoice_date != null ? value.invoice_date : "",
                                        vendor_name: value.vendor_name,
                                        vendor_amount: value.total_payable,
                                        paid_amount: value.paid_amount != "" || value.paid_amount != null ? value.paid_amount : 0,
                                        vendor_payment_amount: Math.round(parseFloat(parseFloat(value.total_payable) - parseFloat(value.paid_amount == null ? 0 : value.paid_amount)) * 100) / 100,
                                        balance_amount: 0,
                                        narration: value.type,
                                        beneficiary_name: value.vendor["bank_acc_name"],
                                        payment_type: value.payment_type,
                                        payment_voucher_id: value.id,
                                    };
                                }),
                                total_amount: data.data["statusCount"].totalPayableAmt,
                                approved_amount: 0,
                                remarks: "",
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
                            toast.push(
                                <Notification title="Error" type="danger" closable>
                                    {error.response.data["message"]}
                                </Notification>
                            );
                        }
                        setLoading(false);
                    });
            }
        };
        fetchData();
    }, []);

    const handleTotal = (e, index) => {
        let balance_amount = 0;
        let vendor_amount = parseFloat(formRef.current.values.vendorPaymentItems[index].vendor_amount != null ? formRef.current.values.vendorPaymentItems[index].vendor_amount : 0);
        let paid_amount = parseFloat(formRef.current.values.vendorPaymentItems[index].paid_amount != null ? formRef.current.values.vendorPaymentItems[index].paid_amount : 0);
        balance_amount = vendor_amount - paid_amount - e.target.value;
        formRef.current.setFieldValue(`vendorPaymentItems[${index}].balance_amount`, balance_amount);
        setTimeout(() => {
            calcTotal();
        }, 100);
        // return total
    };

    const calcTotal = () => {
        let total = 0;
        formRef.current.values.vendorPaymentItems.map((value) => {
            // console.log(value)
            if (value.is_checked) {
                if (parseFloat(value.vendor_payment_amount) > 0) {
                    total += parseFloat(value.vendor_payment_amount);
                }
            }
        });
        // console.log('CalcTotal', total)
        setFinalAmountCheck(total);
        formRef.current.setFieldValue("approved_amount", total);
    };

    const onCheck = (value, e) => {
        console.log(value, e.target.name);
        formRef.current.setFieldValue(e.target.name, value);
        setTimeout(() => {
            calcTotal();
        }, 100);
    };

    const changePaymentType = (e) => {
        console.log(e.target);
        formRef.current.setFieldValue(e.target.name, e.target.value);
    };

    return (
        <>
            <Formik
                enableReinitialize={true}
                initialValues={{
                    transaction_date: vendorPaymentData.transaction_date, //YYYY-MM-DD
                    payment_type: vendorPaymentData.payment_type,
                    vendorPaymentItems: vendorPaymentData.vendorPaymentItems,
                    approved_amount: vendorPaymentData.approved_amount,
                    total_amount: vendorPaymentData.total_amount,
                    remarks: vendorPaymentData.remarks,
                }}
                innerRef={formRef}
                validationSchema={validationSchema}
                onSubmit={(values, actions) => {
                    console.log(values);
                    if (values.approved_amount > 0) {
                        if (vendorPaymentId.vendorpaymentid) {
                            apiVendorPaymentUpdate({
                                values,
                                ...{ id: vendorPaymentId.vendorpaymentid },
                            })
                                .then((data) => {
                                    console.log(data);
                                    if (data.status === 200) {
                                        toast.push(
                                            <Notification title="Success" type="success" closable>
                                                {data.data["message"]}
                                            </Notification>
                                        );
                                        actions.resetForm();
                                        navigate("/transaction/vendor-payment");
                                    } else if (data.status === 201) {
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
                                    actions.setSubmitting(false);
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
                                    actions.setSubmitting(false);
                                });
                        } else {
                            apiVendorPaymentPost(values)
                                .then((data) => {
                                    console.log(data);
                                    if (data.status === 200) {
                                        toast.push(
                                            <Notification title="Success" type="success" closable>
                                                {data.data["message"]}
                                            </Notification>
                                        );
                                        actions.resetForm();
                                        navigate("/transaction/vendor-payment");
                                    } else if (data.status === 201) {
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
                                    actions.setSubmitting(false);
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
                                    actions.setSubmitting(false);
                                });
                        }
                    } else {
                        actions.setSubmitting(false);
                        toast.push(
                            <Notification title="Error" type="danger" closable>
                                Please Add Total Paying Amount
                            </Notification>
                        );
                    }
                }}
            >
                {({ values, touched, errors, resetForm, isSubmitting }) => {
                    const vendorPaymentItems = values.vendorPaymentItems;
                    const immediatePayment = vendorPaymentItems.filter((vendorPaymentItem) => vendorPaymentItem.payment_type === "immediate");
                    const paymentDue = vendorPaymentItems.filter((vendorPaymentItem) => vendorPaymentItem.payment_type === "due");
                    const paymentNotDue = vendorPaymentItems.filter((vendorPaymentItem) => vendorPaymentItem.payment_type === "notDue");
                    return (
                        <Form autoComplete="off" autoSave="off">
                            <AdaptableCard className="card-shadow mb-4">
                                <h5 className="mb-6">{vendorPaymentId.vendorpaymentid ? "Edit" : "Add"} Vendor Payment</h5>
                                <Loading loading={loading}></Loading>
                                <FormContainer layout="horizontal" size="sm" className={loading ? "hidden" : "visible"}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-3">
                                        <FormItem asterisk label="Date Of Transaction" invalid={errors.transaction_date && touched.transaction_date} errorMessage={errors.transaction_date}>
                                            <Field autoComplete="off" name="transaction_date">
                                                {({ field, form }) => (
                                                    <DatePicker
                                                        inputFormat="DD-MM-YYYY"
                                                        // inputtable
                                                        // inputtableBlurClose={false}
                                                        field={field}
                                                        placeholder="Date Of Transaction"
                                                        form={form}
                                                        value={values.transaction_date}
                                                        onChange={(option) => {
                                                            let date = new Date(option);
                                                            return form.setFieldValue(
                                                                field.name,
                                                                `${date.getFullYear()}-${date.getMonth() < 10 ? "0" + (date.getMonth() + 1) : date.getMonth() + 1}-${date.getDate() < 10 ? "0" + date.getDate() : date.getDate()}`
                                                            );
                                                        }}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <p>
                                            <strong>Total Amount Paying (In Rs) * : </strong>
                                            <NumberFormat displayType="text" prefix={"₹"} thousandsGroupStyle={"lakh"} decimalScale={2} value={values.total_amount} allowLeadingZeros thousandSeparator="," />
                                        </p>
                                        <p>
                                            <strong>Total Amount Paying (In Rs) * : </strong>
                                            <NumberFormat displayType="text" prefix={"₹"} thousandsGroupStyle={"lakh"} decimalScale={2} value={values.approved_amount} allowLeadingZeros thousandSeparator="," />
                                        </p>

                                        <FormItem asterisk label="Payment Type" invalid={errors.payment_type && touched.payment_type} errorMessage={errors.payment_type}>
                                            <div className="flex gap-3">
                                                <label className="inline-flex gap-1">
                                                    <input
                                                        type="radio"
                                                        className="radio text-amber-600"
                                                        name="payment_type"
                                                        value={"Online"}
                                                        // disabled={
                                                        //     actionBtn.approve
                                                        // }
                                                        checked={values.payment_type == "Online" ? true : false}
                                                        // defaultChecked
                                                        onChange={(e) => changePaymentType(e)}
                                                    />
                                                    Online
                                                </label>
                                                <label className="inline-flex gap-1">
                                                    <input
                                                        type="radio"
                                                        className="radio text-amber-600"
                                                        name="payment_type"
                                                        value={"Manual"}
                                                        checked={values.payment_type == "Manual" ? true : false}
                                                        onChange={(e) => changePaymentType(e)}
                                                        // disabled={
                                                        //     actionBtn.approve
                                                        // }
                                                    />
                                                    Manual
                                                </label>
                                            </div>
                                        </FormItem>
                                    </div>
                                    <Tabs defaultValue="tab1">
                                        <TabList>
                                            <TabNav value="tab1">
                                                <p className=" relative pb-4">
                                                    <span>Immediate Payment {`(${statusCount.immediate})`}</span>
                                                    <NumberFormat
                                                        className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-0"
                                                        displayType="text"
                                                        prefix={"₹"}
                                                        thousandsGroupStyle={"lakh"}
                                                        decimalScale={2}
                                                        value={statusCount.immediateAmt}
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </p>
                                            </TabNav>
                                            <TabNav value="tab2">
                                                <p className=" relative pb-4">
                                                    <span>Payment Due {`(${statusCount.due})`}</span>
                                                    <NumberFormat
                                                        className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-0"
                                                        displayType="text"
                                                        prefix={"₹"}
                                                        thousandsGroupStyle={"lakh"}
                                                        decimalScale={2}
                                                        value={statusCount.dueAmt}
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </p>
                                            </TabNav>
                                            <TabNav value="tab3">
                                                <p className=" relative pb-4">
                                                    <span>Payment Not Due {`(${statusCount.notDue})`}</span>
                                                    <NumberFormat
                                                        className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-0"
                                                        displayType="text"
                                                        prefix={"₹"}
                                                        thousandsGroupStyle={"lakh"}
                                                        decimalScale={2}
                                                        value={statusCount.notDueAmt}
                                                        allowLeadingZeros
                                                        thousandSeparator=","
                                                    />
                                                </p>
                                            </TabNav>
                                        </TabList>
                                        <FieldArray name="vendorPaymentItems">
                                            {({ form, remove, push }) => (
                                                <>
                                                    <div className="p-4">
                                                        <TabContent value="tab1">
                                                            <Table compact className="border mb-6">
                                                                <THead>
                                                                    <Tr>
                                                                        <Th>Due Date*</Th>
                                                                        <Th>Invoice No.</Th>
                                                                        <Th>Invoice Date</Th>
                                                                        <Th>Vendor Name</Th>
                                                                        <Th>Beneficiary Name*</Th>
                                                                        <Th>Invoice Amount</Th>
                                                                        <Th>Amount Paid</Th>
                                                                        <Th>Amount Paying</Th>
                                                                        <Th>Balance Amount</Th>
                                                                        <Th>Narration</Th>
                                                                        <Th>Action</Th>
                                                                    </Tr>
                                                                </THead>
                                                                <TBody>
                                                                    {vendorPaymentItems && immediatePayment.length > 0 ? (
                                                                        vendorPaymentItems.map((item_detail, index) => {
                                                                            const vendor_payment_amount = fieldFeedback(form, `vendorPaymentItems[${index}].vendor_payment_amount`);
                                                                            const is_checked = fieldFeedback(form, `vendorPaymentItems[${index}].is_checked`);
                                                                            return (
                                                                                <Tr key={index} className={vendorPaymentItems[index].payment_type === "immediate" ? "visible" : "hidden"}>
                                                                                    <Td width="120">
                                                                                        <Moment format="DD-MM-YYYY" className={vendorPaymentItems[index].vendor_payment_date === "" ? "hidden" : "visible"}>
                                                                                            {vendorPaymentItems[index].vendor_payment_date}
                                                                                        </Moment>
                                                                                    </Td>
                                                                                    <Td width="150">{vendorPaymentItems[index].invoice_no}</Td>
                                                                                    <Td width="120">
                                                                                        <Moment format="DD-MM-YYYY" className={vendorPaymentItems[index].invoice_date === "" ? "hidden" : "visible"}>
                                                                                            {vendorPaymentItems[index].invoice_date}
                                                                                        </Moment>
                                                                                    </Td>
                                                                                    <Td width="300">{vendorPaymentItems[index].vendor_name}</Td>
                                                                                    <Td width="300">{vendorPaymentItems[index].beneficiary_name}</Td>
                                                                                    <Td>
                                                                                        <p>
                                                                                            <NumberFormat
                                                                                                displayType="text"
                                                                                                prefix={"₹"}
                                                                                                thousandsGroupStyle={"lakh"}
                                                                                                decimalScale={2}
                                                                                                value={vendorPaymentItems[index].vendor_amount}
                                                                                                allowLeadingZeros
                                                                                                thousandSeparator=","
                                                                                            />
                                                                                        </p>
                                                                                    </Td>
                                                                                    <Td>
                                                                                        <p>
                                                                                            <NumberFormat
                                                                                                displayType="text"
                                                                                                prefix={"₹"}
                                                                                                thousandsGroupStyle={"lakh"}
                                                                                                decimalScale={2}
                                                                                                value={vendorPaymentItems[index].paid_amount == "" || vendorPaymentItems[index].paid_amount == null ? 0 : vendorPaymentItems[index].paid_amount}
                                                                                                allowLeadingZeros
                                                                                                thousandSeparator=","
                                                                                            />
                                                                                        </p>
                                                                                    </Td>
                                                                                    <Td width="200">
                                                                                        <FormItem className="mb-0" invalid={vendor_payment_amount.invalid} layout="vertical" errorMessage={vendor_payment_amount.errorMessage}>
                                                                                            <Field name={`vendorPaymentItems[${index}].vendor_payment_amount`}>
                                                                                                {({ form, field }) => (
                                                                                                    <Input
                                                                                                        invalid={vendor_payment_amount.invalid}
                                                                                                        placeholder="Amount Paying"
                                                                                                        type="number"
                                                                                                        onWheel={(e) => e.target.blur()}
                                                                                                        value={vendorPaymentItems[index].vendor_payment_amount}
                                                                                                        onChange={(e) => {
                                                                                                            handleTotal(e, index);
                                                                                                            return form.setFieldValue(field.name, e.target.value);
                                                                                                        }}
                                                                                                        prefix="₹"
                                                                                                        disabled={actionBtn.approve}
                                                                                                    />
                                                                                                )}
                                                                                            </Field>
                                                                                        </FormItem>
                                                                                    </Td>
                                                                                    <Td>
                                                                                        <p>
                                                                                            <NumberFormat
                                                                                                displayType="text"
                                                                                                prefix={"₹"}
                                                                                                thousandsGroupStyle={"lakh"}
                                                                                                decimalScale={2}
                                                                                                value={vendorPaymentItems[index].balance_amount}
                                                                                                allowLeadingZeros
                                                                                                thousandSeparator=","
                                                                                            />
                                                                                        </p>
                                                                                    </Td>
                                                                                    <Td>{vendorPaymentItems[index].narration}</Td>
                                                                                    <Td>
                                                                                        <FormItem className="mb-0 custom-text-left" invalid={is_checked.invalid} layout="vertical" errorMessage={is_checked.errorMessage}>
                                                                                            <Checkbox
                                                                                                name={`vendorPaymentItems[${index}].is_checked`}
                                                                                                value={vendorPaymentItems[index].is_checked}
                                                                                                checked={vendorPaymentItems[index].is_checked}
                                                                                                onChange={(e, index) => onCheck(e, index)}
                                                                                            ></Checkbox>
                                                                                        </FormItem>
                                                                                    </Td>
                                                                                </Tr>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <Tr>
                                                                            <Td colSpan="11" className="p-2 text-center">
                                                                                No Record Found
                                                                            </Td>
                                                                        </Tr>
                                                                    )}
                                                                </TBody>
                                                            </Table>
                                                        </TabContent>
                                                        <TabContent value="tab2">
                                                            <Table compact className="border mb-6">
                                                                <THead>
                                                                    <Tr>
                                                                        <Th>Due Date*</Th>
                                                                        <Th>Invoice No.</Th>
                                                                        <Th>Invoice Date</Th>
                                                                        <Th>Vendor Name</Th>
                                                                        <Th>Beneficiary Name*</Th>
                                                                        <Th>Invoice Amount</Th>
                                                                        <Th>Amount Paid</Th>
                                                                        <Th>Amount Paying</Th>
                                                                        <Th>Balance Amount</Th>
                                                                        <Th>Narration</Th>
                                                                        <Th>Action</Th>
                                                                    </Tr>
                                                                </THead>
                                                                <TBody>
                                                                    {vendorPaymentItems && paymentDue.length > 0 ? (
                                                                        vendorPaymentItems.map((item_detail, index) => {
                                                                            const is_checked = fieldFeedback(form, `vendorPaymentItems[${index}].is_checked`);
                                                                            const beneficiary_name = fieldFeedback(form, `vendorPaymentItems[${index}].beneficiary_name`);
                                                                            const vendor_payment_amount = fieldFeedback(form, `vendorPaymentItems[${index}].vendor_payment_amount`);
                                                                            return (
                                                                                <Tr key={index} className={vendorPaymentItems[index].payment_type === "due" ? "visible" : "hidden"}>
                                                                                    <Td width="130">
                                                                                        <Moment format="DD-MM-YYYY" className={vendorPaymentItems[index].vendor_payment_date === "" ? "hidden" : "visible"}>
                                                                                            {vendorPaymentItems[index].vendor_payment_date}
                                                                                        </Moment>
                                                                                    </Td>
                                                                                    <Td width="150">{vendorPaymentItems[index].invoice_no}</Td>
                                                                                    <Td width="120">
                                                                                        <Moment format="DD-MM-YYYY" className={vendorPaymentItems[index].invoice_date === "" ? "hidden" : "visible"}>
                                                                                            {vendorPaymentItems[index].invoice_date}
                                                                                        </Moment>
                                                                                    </Td>
                                                                                    <Td width="300">{vendorPaymentItems[index].vendor_name}</Td>
                                                                                    <Td width="300">{vendorPaymentItems[index].beneficiary_name === null ? beneficiary_name.errorMessage : vendorPaymentItems[index].beneficiary_name}</Td>
                                                                                    <Td>
                                                                                        <p>
                                                                                            <NumberFormat
                                                                                                displayType="text"
                                                                                                prefix={"₹"}
                                                                                                thousandsGroupStyle={"lakh"}
                                                                                                decimalScale={2}
                                                                                                value={vendorPaymentItems[index].vendor_amount}
                                                                                                allowLeadingZeros
                                                                                                thousandSeparator=","
                                                                                            />
                                                                                        </p>
                                                                                    </Td>
                                                                                    <Td>
                                                                                        <p>
                                                                                            <NumberFormat
                                                                                                displayType="text"
                                                                                                prefix={"₹"}
                                                                                                thousandsGroupStyle={"lakh"}
                                                                                                decimalScale={2}
                                                                                                value={vendorPaymentItems[index].paid_amount == "" || vendorPaymentItems[index].paid_amount == null ? 0 : vendorPaymentItems[index].paid_amount}
                                                                                                allowLeadingZeros
                                                                                                thousandSeparator=","
                                                                                            />
                                                                                        </p>
                                                                                    </Td>
                                                                                    <Td width="200">
                                                                                        <FormItem className="mb-0" invalid={vendor_payment_amount.invalid} layout="vertical" errorMessage={vendor_payment_amount.errorMessage}>
                                                                                            <Field name={`vendorPaymentItems[${index}].vendor_payment_amount`}>
                                                                                                {({ form, field }) => (
                                                                                                    <Input
                                                                                                        invalid={vendor_payment_amount.invalid}
                                                                                                        placeholder="Amount Paying"
                                                                                                        type="number"
                                                                                                        onWheel={(e) => e.target.blur()}
                                                                                                        value={vendorPaymentItems[index].vendor_payment_amount}
                                                                                                        onChange={(e) => {
                                                                                                            handleTotal(e, index);
                                                                                                            return form.setFieldValue(field.name, e.target.value);
                                                                                                        }}
                                                                                                        prefix="₹"
                                                                                                        disabled={actionBtn.approve}
                                                                                                    />
                                                                                                )}
                                                                                            </Field>
                                                                                        </FormItem>
                                                                                    </Td>
                                                                                    <Td>
                                                                                        <p>
                                                                                            <NumberFormat
                                                                                                displayType="text"
                                                                                                prefix={"₹"}
                                                                                                thousandsGroupStyle={"lakh"}
                                                                                                decimalScale={2}
                                                                                                value={vendorPaymentItems[index].balance_amount}
                                                                                                allowLeadingZeros
                                                                                                thousandSeparator=","
                                                                                            />
                                                                                        </p>
                                                                                    </Td>
                                                                                    <Td>{vendorPaymentItems[index].narration}</Td>
                                                                                    <Td>
                                                                                        <FormItem className="mb-0" invalid={is_checked.invalid} layout="vertical" errorMessage={is_checked.errorMessage}>
                                                                                            <Checkbox
                                                                                                name={`vendorPaymentItems[${index}].is_checked`}
                                                                                                value={vendorPaymentItems[index].is_checked}
                                                                                                checked={vendorPaymentItems[index].is_checked}
                                                                                                onChange={(e, index) => onCheck(e, index)}
                                                                                            ></Checkbox>
                                                                                        </FormItem>
                                                                                    </Td>
                                                                                </Tr>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <Tr>
                                                                            <Td colSpan="11" className="p-2 text-center">
                                                                                No Record Found
                                                                            </Td>
                                                                        </Tr>
                                                                    )}
                                                                </TBody>
                                                            </Table>
                                                        </TabContent>
                                                        <TabContent value="tab3">
                                                            <Table compact className="border mb-6">
                                                                <THead>
                                                                    <Tr>
                                                                        <Th>Due Date*</Th>
                                                                        <Th>Invoice No.</Th>
                                                                        <Th>Invoice Date</Th>
                                                                        <Th>Vendor Name</Th>
                                                                        <Th>Beneficiary Name*</Th>
                                                                        <Th>Invoice Amount</Th>
                                                                        <Th>Amount Paid</Th>
                                                                        <Th>Amount Paying</Th>
                                                                        <Th>Balance Amount</Th>
                                                                        <Th>Narration</Th>
                                                                        <Th>Action</Th>
                                                                    </Tr>
                                                                </THead>
                                                                <TBody>
                                                                    {vendorPaymentItems && paymentNotDue.length > 0 ? (
                                                                        vendorPaymentItems.map((item_detail, index) => {
                                                                            const vendor_payment_amount = fieldFeedback(form, `vendorPaymentItems[${index}].vendor_payment_amount`);
                                                                            const is_checked = fieldFeedback(form, `vendorPaymentItems[${index}].is_checked`);
                                                                            return (
                                                                                <Tr key={index} className={vendorPaymentItems[index].payment_type === "notDue" ? "visible" : "hidden"}>
                                                                                    <Td width="120">
                                                                                        <Moment format="DD-MM-YYYY" className={vendorPaymentItems[index].vendor_payment_date === "" ? "hidden" : "visible"}>
                                                                                            {vendorPaymentItems[index].vendor_payment_date}
                                                                                        </Moment>
                                                                                    </Td>
                                                                                    <Td width="150">{vendorPaymentItems[index].invoice_no}</Td>
                                                                                    <Td width="120">
                                                                                        {
                                                                                            <Moment format="DD-MM-YYYY" className={vendorPaymentItems[index].invoice_date === "" ? "hidden" : "visible"}>
                                                                                                {vendorPaymentItems[index].invoice_date}
                                                                                            </Moment>
                                                                                        }
                                                                                    </Td>
                                                                                    <Td width="300">{vendorPaymentItems[index].vendor_name}</Td>
                                                                                    <Td width="300">{vendorPaymentItems[index].beneficiary_name}</Td>
                                                                                    <Td>
                                                                                        <p>
                                                                                            <NumberFormat
                                                                                                displayType="text"
                                                                                                prefix={"₹"}
                                                                                                thousandsGroupStyle={"lakh"}
                                                                                                decimalScale={2}
                                                                                                value={vendorPaymentItems[index].vendor_amount}
                                                                                                allowLeadingZeros
                                                                                                thousandSeparator=","
                                                                                            />
                                                                                        </p>
                                                                                    </Td>
                                                                                    <Td>
                                                                                        <p>
                                                                                            <NumberFormat
                                                                                                displayType="text"
                                                                                                prefix={"₹"}
                                                                                                thousandsGroupStyle={"lakh"}
                                                                                                decimalScale={2}
                                                                                                value={vendorPaymentItems[index].paid_amount == "" || vendorPaymentItems[index].paid_amount == null ? 0 : vendorPaymentItems[index].paid_amount}
                                                                                                allowLeadingZeros
                                                                                                thousandSeparator=","
                                                                                            />
                                                                                        </p>
                                                                                    </Td>
                                                                                    <Td width="200">
                                                                                        <FormItem className="mb-0" invalid={vendor_payment_amount.invalid} layout="vertical" errorMessage={vendor_payment_amount.errorMessage}>
                                                                                            <Field name={`vendorPaymentItems[${index}].vendor_payment_amount`}>
                                                                                                {({ form, field }) => (
                                                                                                    <Input
                                                                                                        invalid={vendor_payment_amount.invalid}
                                                                                                        placeholder="Amount Paying"
                                                                                                        type="number"
                                                                                                        onWheel={(e) => e.target.blur()}
                                                                                                        value={vendorPaymentItems[index].vendor_payment_amount}
                                                                                                        onChange={(e) => {
                                                                                                            handleTotal(e, index);
                                                                                                            return form.setFieldValue(field.name, e.target.value);
                                                                                                        }}
                                                                                                        prefix="₹"
                                                                                                        disabled={actionBtn.approve}
                                                                                                    />
                                                                                                )}
                                                                                            </Field>
                                                                                        </FormItem>
                                                                                    </Td>
                                                                                    <Td>
                                                                                        <p>
                                                                                            <NumberFormat
                                                                                                displayType="text"
                                                                                                prefix={"₹"}
                                                                                                thousandsGroupStyle={"lakh"}
                                                                                                decimalScale={2}
                                                                                                value={vendorPaymentItems[index].balance_amount}
                                                                                                allowLeadingZeros
                                                                                                thousandSeparator=","
                                                                                            />
                                                                                        </p>
                                                                                    </Td>
                                                                                    <Td>{vendorPaymentItems[index].narration}</Td>
                                                                                    <Td>
                                                                                        <FormItem invalid={is_checked.invalid} errorMessage={is_checked.errorMessage} layout="vertical" className="mb-0">
                                                                                            <Checkbox
                                                                                                name={`vendorPaymentItems[${index}].is_checked`}
                                                                                                value={vendorPaymentItems[index].is_checked}
                                                                                                checked={vendorPaymentItems[index].is_checked}
                                                                                                onChange={(e, index) => onCheck(e, index)}
                                                                                            ></Checkbox>
                                                                                        </FormItem>
                                                                                    </Td>
                                                                                </Tr>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <Tr>
                                                                            <Td colSpan="11" className="p-2 text-center">
                                                                                No Record Found
                                                                            </Td>
                                                                        </Tr>
                                                                    )}
                                                                </TBody>
                                                            </Table>
                                                        </TabContent>
                                                    </div>
                                                </>
                                            )}
                                        </FieldArray>
                                    </Tabs>
                                    {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-3">
                                        
                                    </div> */}
                                    {/* <h5>Other Information</h5>
                                    <p className="mb-6">{vendorPaymentId.vendorpaymentid ? 'Edit' : 'Add'} final Purchase Order remark</p> */}
                                    <div className="grid grid-cols-1 gap-x-8 gap-y-2">
                                        <FormItem label="Remark" invalid={errors.remarks && touched.remarks} errorMessage={errors.remarks}>
                                            <Field name="remarks">
                                                {({ field, form }) => {
                                                    return (
                                                        <Input
                                                            type="text"
                                                            field={field}
                                                            form={form}
                                                            // name={field.name}
                                                            value={field.value}
                                                            onChange={(option) => form.setFieldValue(field.name, option.target.value)}
                                                            textArea
                                                        />
                                                    );
                                                }}
                                            </Field>
                                        </FormItem>
                                    </div>
                                </FormContainer>
                            </AdaptableCard>
                            <StickyFooter className="-mx-1 md:-mx-1 px-8 flex items-center justify-between py-4" stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <div>
                                    <Button size="sm" type="submit" variant="solid" color="emerald-600" className={"ltr:mr-6 rtl:ml-6 " + (actionBtn.approve ? "" : "hidden")} disabled={isSubmitting}>
                                        Approve
                                    </Button>
                                    <Button size="sm" type="button" variant="solid" color="red-600" onClick={() => rejectPurchaseOrder()} disabled={isSubmitting} className={"ltr:mr-3 rtl:ml-3 " + (actionBtn.approve ? "" : "hidden")}>
                                        Reject
                                    </Button>
                                </div>
                                <div className="md:flex items-center">
                                    <Button size="sm" type="submit" className={"ltr:mr-3 rtl:ml-3 " + (actionBtn.approve ? "hidden" : "")} variant="solid" disabled={finalAmountCheck <= 0 && isSubmitting}>
                                        Submit For Approval
                                    </Button>
                                    <Button size="sm" type="button" variant="solid" color="red-600" onClick={() => deleteVendorPayment()} className={"ltr:mr-3 rtl:ml-3 " + (actionBtn.delete ? "" : "hidden")}>
                                        Delete
                                    </Button>

                                    <Button size="sm" type="button" onClick={() => navigate("/transaction/vendor-payment")}>
                                        Back
                                    </Button>
                                </div>
                            </StickyFooter>
                        </Form>
                    );
                }}
            </Formik>
            <ConfirmDialog isOpen={open} type={"danger"} title={"Delete"} confirmButtonColor={"red-600"} onClose={handleClose} onRequestClose={handleClose} onCancel={handleClose} onConfirm={handleConfirm} confirmText={"Delete"}>
                <p>Are you sure you wan to delete?</p>
            </ConfirmDialog>
        </>
    );
};

export default AddEditVendorPayment;
