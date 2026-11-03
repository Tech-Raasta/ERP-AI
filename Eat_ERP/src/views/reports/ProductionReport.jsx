import React, { useEffect, useState } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'
import DatePicker from 'components/ui/DatePicker'
import { saveAs } from 'file-saver'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import Loading from 'components/shared/Loading'
import { apiProductionReport, apiReportCatalog } from 'services/reportsService'
import ReportAccessDenied from './ReportAccessDenied'
import './Reports.css'
import appConfig from 'configs/app.config'

const validationSchema = Yup.object().shape({
    fromDate: Yup.string().required('From Date Is Required'),
    toDate: Yup.string().required('To Date Is Required'),
})


const ProductionReportForm = () => {
    const [reportData, setReportData] = useState({
        fromDate: '',
        toDate: '',
    })
    const navigate = useNavigate()

    useEffect(() => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <>
            <Formik
                enableReinitialize={true}
                initialValues={{
                    fromDate:reportData.fromDate,
                    toDate:reportData.toDate
                }}
                validationSchema={validationSchema}
                onSubmit={(values, actions) => {
                    apiProductionReport(values).then(data=>{
                        console.log(data)
                        if (data.data['fileName'] != null) {
                            // saveAs('https://phpstack-1207426-6335616.cloudwaysapps.com/assets/reports/' + data.data['fileName'], data.data['fileName'])
                            saveAs(`${appConfig.apiPrefix.replace(/\/api$/, '')}/assets/reports/${data.data['fileName']}`, data.data['fileName'])
                            // saveAs('http://localhost:5000/assets/reports/' + data.data['fileName'], data.data['fileName']);
                            toast.push(
                                <Notification
                                    title="Success"
                                    type="success"
                                    closable
                                >
                                    File will get download shortly...
                                </Notification>
                            )
                            actions.setSubmitting(false)
                            actions.resetForm()
                        }
                    })
                }}
            >
                {({ values, touched, errors, isSubmitting }) => (
                    <Form autoComplete="off" autoSave="off">
                        <FormContainer layout="vertical" labelWidth={120}>
                            <div className="mb-4 md:w-full m-auto">
                                <AdaptableCard className="card-shadow">
                                    <h5 className="mb-6">Production Report</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2 ">
                                        <div></div>
                                        <FormItem
                                            asterisk
                                            label="From Date"
                                            invalid={
                                                errors.fromDate &&
                                                touched.fromDate
                                            }
                                            errorMessage={errors.fromDate}
                                        >
                                            <Field
                                                autoComplete="off"
                                                autoSave="off"
                                                name="fromDate"
                                            >
                                                {({ field, form }) => (
                                                    <DatePicker
                                                        inputFormat="DD-MM-YYYY"
                                                        // inputtable
                                                        // inputtableBlurClose={false}
                                                        field={field}
                                                        placeholder="From Date"
                                                        form={form}
                                                        maxDate={new Date()}
                                                        value={values.fromDate}
                                                        onChange={(option) => {
                                                            let date = new Date(option)
                                                            form.setFieldValue(field.name, `${date.getFullYear()}-${date.getMonth()+1 < 10 ? '0' + (date.getMonth() + 1): (date.getMonth() + 1)}-${ date.getDate() < 10 ? '0' + date.getDate() : date.getDate()}`)
                                                        }}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="To Date"
                                            invalid={
                                                errors.toDate &&
                                                touched.toDate
                                            }
                                            errorMessage={errors.toDate}
                                        >
                                            <Field
                                                autoComplete="off"
                                                autoSave="off"
                                                name="toDate"
                                            >
                                                {({ field, form }) => (
                                                    <DatePicker
                                                        inputFormat="DD-MM-YYYY"
                                                        // inputtable
                                                        // inputtableBlurClose={false}
                                                        field={field}
                                                        placeholder="To Date"
                                                        form={form}
                                                        maxDate={new Date()}
                                                        value={values.toDate}
                                                        onChange={(option) => {
                                                            let date = new Date(option);
                                                            form.setFieldValue(field.name, `${date.getFullYear()}-${date.getMonth()+1 < 10 ? '0' + (date.getMonth() + 1): (date.getMonth() + 1)}-${ date.getDate() < 10 ? '0' + date.getDate() : date.getDate()}`)
                                                        }}
                                                    />
                                                )}
                                            </Field>
                                        </FormItem>
                                    </div>
                                    <div className="grid grid-cols-1 mt-6 mb-5">
                                        <div></div>
                                        <div className='text-center'>

                                            <Button
                                                size="sm"
                                                type="submit"
                                                className='ltr:mr-3 rtl:ml-3 '
                                                variant="solid"
                                                disabled={isSubmitting}
                                            >
                                                Download Report
                                            </Button>
                                        </div>
                                    </div>
                                </AdaptableCard>
                            </div>
                        </FormContainer>
                        <StickyFooter
                            className="-mx-1 md:-mx-1 px-8 flex items-center justify-between py-4"
                            stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        >
                            <div></div>
                            <div className="md:flex items-center">
                                <Button
                                    size="sm"
                                    onClick={() =>
                                        navigate('/reports')
                                    }
                                >
                                    Back
                                </Button>
                            </div>
                        </StickyFooter>
                    </Form>
                )}
            </Formik>
        </>
    )
}

const ProductionReport = () => {
    const [allowed, setAllowed] = useState(null)

    useEffect(() => {
        apiReportCatalog()
            .then((res) => setAllowed((res.data['screens'] || []).includes('production')))
            .catch(() => setAllowed(false))
    }, [])

    if (allowed === false) return <ReportAccessDenied />
    return <Loading loading={allowed === null}>{allowed ? <ProductionReportForm /> : null}</Loading>
}

export default ProductionReport
