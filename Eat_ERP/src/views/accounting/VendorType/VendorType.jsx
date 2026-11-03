import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import { MdCreate, MdAdd, MdImportExport } from "react-icons/md"
import { HiSearch } from 'react-icons/hi'
import { apiVendorTypeGet, apiVendorTypePost, apiVendorTypeUpdate } from 'services/VendorTypeService'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { FormItem, FormContainer } from 'components/ui'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import { exportToExcel } from 'react-easy-export'

// Old PHP Vendor_type: list (Sr. No., Edit, Vendor Type), form Vendor Type / Status (edit) / Remarks.
// No delete in the old app: a type is switched off with status InActive.

const validationSchema = Yup.object().shape({
    vendor_type: Yup.string().trim().required('Vendor Type Is Required'),
    status: Yup.string().required('Status Is Required'),
})

const emptyVendorType = { vendor_type: '', status: 'Approved', remarks: '' }

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' },
]

const statusLabel = (status) => (status === 'Approved' ? 'Active' : status)

const showError = (message) => {
    toast.push(
        <Notification title="Error" type="danger" closable>
            {message}
        </Notification>
    )
}

const showSuccess = (message) => {
    toast.push(
        <Notification title="Success" type="success" closable>
            {message}
        </Notification>
    )
}

// Backend returns either a Sequelize ValidationError ({ errors: [{ path, message }] })
// or a custom error ({ errors: { field: { message } } })
const handleValidationErrors = (errorData, actions) => {
    const errors = errorData && errorData.errors ? errorData.errors : {}
    const list = Array.isArray(errors)
        ? errors.map((err) => ({ path: err.path, message: err.message }))
        : Object.keys(errors).map((key) => ({ path: key, message: errors[key].message }))

    list.forEach((err) => {
        actions.setFieldError(err.path, err.message)
        showError(err.message)
    })
}

const toExportRows = (rows) => rows.map((row, index) => ({
    'Sr. No.': index + 1,
    'Vendor Type': row.vendor_type,
    'Status': statusLabel(row.status),
    'Remarks': row.remarks,
}))

const VendorType = () => {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 10,
        query: '',
        sort: {
            order: '',
            key: '',
        },
    })
    const [action, setAction] = useState({ insert: false, update: false })
    const [vendorTypeData, setVendorTypeData] = useState(emptyVendorType)
    const [editId, setEditId] = useState(null)
    const [dialogIsOpen, setIsOpen] = useState(false)
    const inputRef = useRef(null)

    const debounceFn = debounce(handleDebounceFn, 1000)

    function handleDebounceFn(val) {
        if (typeof val === 'string' && (val.length > 1 || val.length === 0)) {
            setTableData((prevData) => ({
                ...prevData,
                ...{ query: val, pageIndex: 1 },
            }))
        }
    }

    const handleChange = (e) => {
        debounceFn(e.target.value)
    }

    const fetchData = () => {
        setLoading(true)
        apiVendorTypeGet(tableData).then((data) => {
            if (data.data) {
                setData(data.data['rows'])
                setAction(data.data['action'])
                setTableData((prevData) => ({
                    ...prevData,
                    ...{ total: data.data['total'] },
                }))
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error.response) {
                showError(error.response.data['message'])
            }
        })
    }

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableData.pageIndex, tableData.sort, tableData.pageSize, tableData.query])

    const openAddDialog = () => {
        setEditId(null)
        setVendorTypeData(emptyVendorType)
        setIsOpen(true)
    }

    const openEditDialog = (row) => {
        setEditId(row.id)
        setVendorTypeData({
            vendor_type: row.vendor_type || '',
            status: row.status === 'InActive' ? 'InActive' : 'Approved',
            remarks: row.remarks || '',
        })
        setIsOpen(true)
    }

    const onDialogClose = () => {
        setIsOpen(false)
    }

    const onSubmit = (values, actions) => {
        const request = editId
            ? apiVendorTypeUpdate({ id: editId, values })
            : apiVendorTypePost(values)

        request.then((data) => {
            actions.setSubmitting(false)
            showSuccess(data.data['message'])
            setIsOpen(false)
            fetchData()
        }).catch((error) => {
            actions.setSubmitting(false)
            if (!error.response) {
                return
            }
            if (error.response.status === 422) {
                handleValidationErrors(error.response.data['error'], actions)
            } else {
                showError(error.response.data['message'])
            }
        })
    }

    const columns = useMemo(() => (
        [
            {
                header: 'Sr. No.',
                enableSorting: false,
                cell: (props) => props.row.index + 1 + tableData.pageSize * (tableData.pageIndex - 1),
                width: 70,
            },
            {
                header: 'Vendor Type',
                accessorKey: 'vendor_type',
            },
            {
                header: 'Status',
                accessorKey: 'status',
                width: 120,
                cell: (props) => statusLabel(props.row.original.status),
            },
            {
                header: 'Action',
                width: 100,
                enableSorting: false,
                cell: (props) => (
                    action.update ? (
                        <Button
                            shape="circle"
                            size="sm"
                            variant="twoTone"
                            icon={<MdCreate />}
                            onClick={() => openEditDialog(props.row.original)}
                        />
                    ) : null
                ),
            },
        ]
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [tableData.pageIndex, tableData.pageSize, action])

    const handlePaginationChange = (pageIndex) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageIndex } }))
    }

    const handleSelectChange = (pageSize) => {
        setTableData((prevData) => ({ ...prevData, ...{ pageSize } }))
    }

    const handleSort = ({ order, key }) => {
        setTableData((prevData) => ({
            ...prevData,
            ...{ sort: { order, key } },
        }))
    }

    const downloadAll = () => {
        apiVendorTypeGet({
            ...tableData,
            pageIndex: 1,
            pageSize: 'all',
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    toExportRows(data.data['rows']),
                    `vendor-types-${new Date().toLocaleString()}.xls`
                )
            }
        }).catch((error) => {
            if (error.response) {
                showError(error.response.data['message'])
            }
        })
    }

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0 ">Vendor Type</h3>
                <div className="flex flex-col lg:flex-row lg:items-center">
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52 mr-4 lg:mb-0 "
                        onChange={handleChange}
                        prefix={<HiSearch className="text-lg" />}
                    />
                    {action.insert ? (
                        <Button variant="solid" size="sm" className="mr-4" icon={<MdAdd />} onClick={openAddDialog}>
                            <span>Add Vendor Type</span>
                        </Button>
                    ) : null}
                    <Button
                        size="sm"
                        variant="solid"
                        color="emerald-600"
                        icon={<MdImportExport />}
                        onClick={downloadAll}
                        disabled={!data.length > 0}
                    >
                        <span>Download</span>
                    </Button>
                </div>
            </div>
            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagingData={tableData}
                onPaginationChange={handlePaginationChange}
                onSelectChange={handleSelectChange}
                onSort={handleSort}
            />
            <Dialog
                isOpen={dialogIsOpen}
                shouldCloseOnOverlayClick={false}
                shouldCloseOnEsc={false}
                onClose={onDialogClose}
                onRequestClose={onDialogClose}
            >
                <h5 className="mb-6">{editId ? 'Edit' : 'Add'} Vendor Type</h5>
                <Formik
                    enableReinitialize={true}
                    initialValues={vendorTypeData}
                    validationSchema={validationSchema}
                    onSubmit={onSubmit}
                >
                    {({ errors, touched, isSubmitting }) => (
                        <Form autoComplete="off">
                            <FormContainer>
                                <FormItem
                                    asterisk
                                    label="Vendor Type"
                                    invalid={errors.vendor_type && touched.vendor_type}
                                    errorMessage={errors.vendor_type}
                                >
                                    <Field
                                        type="text"
                                        name="vendor_type"
                                        placeholder="Vendor Type"
                                        component={Input}
                                    />
                                </FormItem>
                                {editId ? (
                                    <FormItem
                                        asterisk
                                        label="Status"
                                        invalid={errors.status && touched.status}
                                        errorMessage={errors.status}
                                    >
                                        <Field name="status">
                                            {({ field, form }) => (
                                                <Select
                                                    field={field}
                                                    form={form}
                                                    options={statusOptions}
                                                    value={statusOptions.filter((option) => option.value === field.value)}
                                                    onChange={(option) => form.setFieldValue(field.name, option ? option.value : '')}
                                                />
                                            )}
                                        </Field>
                                    </FormItem>
                                ) : null}
                                <FormItem
                                    label="Remarks"
                                    invalid={errors.remarks && touched.remarks}
                                    errorMessage={errors.remarks}
                                >
                                    <Field name="remarks" placeholder="Remarks" textArea component={Input} />
                                </FormItem>
                                <FormItem className="text-right">
                                    <Button
                                        className="ltr:mr-2 rtl:ml-2"
                                        variant="plain"
                                        type="button"
                                        onClick={onDialogClose}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" variant="solid" disabled={isSubmitting}>
                                        Save
                                    </Button>
                                </FormItem>
                            </FormContainer>
                        </Form>
                    )}
                </Formik>
            </Dialog>
        </AdaptableCard>
    )
}

export default VendorType
