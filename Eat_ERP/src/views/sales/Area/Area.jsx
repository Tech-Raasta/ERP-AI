import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import { MdCreate, MdAdd, MdImportExport } from "react-icons/md"
import { HiSearch } from 'react-icons/hi'
import { apiAreaGet, apiAreaMasterData, apiAreaPost, apiAreaUpdate } from 'services/AreaService'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { FormItem, FormContainer } from 'components/ui'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import { exportToExcel } from 'react-easy-export'

// Old PHP Area: list (Sr. No., Edit, Area, Distributor Type, Zone), form Type / Zone (of that type) / Area / Status (edit) / Remarks.
// The old list only showed Active areas; here every area is listed with its status so InActive ones can be reactivated.

const validationSchema = Yup.object().shape({
    type_id: Yup.string().required('Type Is Required'),
    zone_id: Yup.string().required('Zone Is Required'),
    area: Yup.string().trim().required('Area Is Required'),
    status: Yup.string().required('Status Is Required'),
})

const emptyArea = { type_id: '', zone_id: '', area: '', status: 'Approved', remarks: '' }

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' },
]

const str = (value) => (value !== null && value !== undefined ? value.toString() : '')
const statusLabel = (status) => (status === 'Approved' ? 'Active' : status)
const typeName = (row) => (row.distributorType ? row.distributorType.distributor_type : '')
const zoneName = (row) => (row.zone ? row.zone.zone : '')

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
    'Area': row.area,
    'Distributor Type': typeName(row),
    'Zone': zoneName(row),
    'Status': statusLabel(row.status),
    'Remarks': row.remarks,
}))

const Area = () => {
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
    const [types, setTypes] = useState([])
    const [zones, setZones] = useState([])
    const [areaData, setAreaData] = useState(emptyArea)
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
        apiAreaGet(tableData).then((data) => {
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

    // Dropdowns (old PHP: Approved types and zones; zones are filtered by the chosen type)
    useEffect(() => {
        apiAreaMasterData().then((data) => {
            setTypes(data.data['types'].map((type) => ({ value: str(type.id), label: type.distributor_type })))
            setZones(data.data['zones'].map((zone) => ({ value: str(zone.id), label: zone.zone, typeId: str(zone.type_id) })))
        }).catch((error) => {
            if (error.response) {
                showError(error.response.data['message'])
            }
        })
    }, [])

    const openAddDialog = () => {
        setEditId(null)
        setAreaData(emptyArea)
        setIsOpen(true)
    }

    const openEditDialog = (row) => {
        const typeId = str(row.type_id)
        const zoneId = str(row.zone_id)
        // Keep the area's current type / zone selectable even if they are no longer active
        if (typeId && !types.some((option) => option.value === typeId)) {
            setTypes((prev) => [...prev, { value: typeId, label: typeName(row) || typeId }])
        }
        if (zoneId && !zones.some((option) => option.value === zoneId)) {
            setZones((prev) => [...prev, { value: zoneId, label: zoneName(row) || zoneId, typeId }])
        }
        setEditId(row.id)
        setAreaData({
            type_id: typeId,
            zone_id: zoneId,
            area: row.area || '',
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
            ? apiAreaUpdate({ id: editId, values })
            : apiAreaPost(values)

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
                header: 'Area',
                accessorKey: 'area',
            },
            {
                header: 'Distributor Type',
                id: 'distributor_type',
                accessorFn: typeName,
            },
            {
                header: 'Zone',
                id: 'zone_name',
                accessorFn: zoneName,
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
    ), [tableData.pageIndex, tableData.pageSize, action, types, zones])

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
        apiAreaGet({
            ...tableData,
            pageIndex: 1,
            pageSize: 'all',
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    toExportRows(data.data['rows']),
                    `areas-${new Date().toLocaleString()}.xls`
                )
            }
        }).catch((error) => {
            if (error.response) {
                showError(error.response.data['message'])
            }
        })
    }

    const selectField = (name, options, onSelect) => (
        <Field name={name}>
            {({ field, form }) => (
                <Select
                    field={field}
                    form={form}
                    options={options}
                    placeholder="Select"
                    value={options.filter((option) => option.value === field.value)}
                    onChange={(option) => {
                        form.setFieldValue(field.name, option ? option.value : '')
                        if (onSelect) {
                            onSelect(form, option)
                        }
                    }}
                />
            )}
        </Field>
    )

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0 ">Area</h3>
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
                            <span>Add Area</span>
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
                <h5 className="mb-6">{editId ? 'Edit' : 'Add'} Area</h5>
                <Formik
                    enableReinitialize={true}
                    initialValues={areaData}
                    validationSchema={validationSchema}
                    onSubmit={onSubmit}
                >
                    {({ values, errors, touched, isSubmitting }) => (
                        <Form autoComplete="off">
                            <FormContainer>
                                <FormItem
                                    asterisk
                                    label="Type"
                                    invalid={errors.type_id && touched.type_id}
                                    errorMessage={errors.type_id}
                                >
                                    {selectField('type_id', types, (form, option) => {
                                        // Old PHP reloads the zones of the chosen type; keep the zone only if it belongs to it
                                        const zone = zones.find((item) => item.value === values.zone_id)
                                        if (!option || !zone || zone.typeId !== option.value) {
                                            form.setFieldValue('zone_id', '')
                                        }
                                    })}
                                </FormItem>
                                <FormItem
                                    asterisk
                                    label="Zone"
                                    invalid={errors.zone_id && touched.zone_id}
                                    errorMessage={errors.zone_id}
                                >
                                    {selectField('zone_id', zones.filter((zone) => zone.typeId === values.type_id))}
                                </FormItem>
                                <FormItem
                                    asterisk
                                    label="Area"
                                    invalid={errors.area && touched.area}
                                    errorMessage={errors.area}
                                >
                                    <Field type="text" name="area" placeholder="Area Name" component={Input} />
                                </FormItem>
                                {editId ? (
                                    <FormItem
                                        asterisk
                                        label="Status"
                                        invalid={errors.status && touched.status}
                                        errorMessage={errors.status}
                                    >
                                        {selectField('status', statusOptions)}
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

export default Area
