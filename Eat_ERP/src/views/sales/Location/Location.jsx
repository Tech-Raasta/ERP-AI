import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import { MdCreate, MdAdd, MdImportExport } from "react-icons/md"
import { HiSearch } from 'react-icons/hi'
import { apiLocationGet, apiLocationMasterData, apiLocationPost, apiLocationUpdate } from 'services/LocationService'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { FormItem, FormContainer } from 'components/ui'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import { exportToExcel } from 'react-easy-export'

// Old PHP Location: list (Sr. No., Edit, Location, Distributor Type, Zone, Area),
// form Type / Zone (of that type) / Area (of that zone, optional) / Location / Status (edit) / Remarks.
// The old list only showed Active locations; here every location is listed with its status.

const validationSchema = Yup.object().shape({
    type_id: Yup.string().required('Type Is Required'),
    zone_id: Yup.string().required('Zone Is Required'),
    location: Yup.string().trim().required('Location Is Required'),
    status: Yup.string().required('Status Is Required'),
})

const emptyLocation = { type_id: '', zone_id: '', area_id: '', location: '', status: 'Approved', remarks: '' }

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' },
]

const str = (value) => (value !== null && value !== undefined ? value.toString() : '')
const statusLabel = (status) => (status === 'Approved' ? 'Active' : status)
const typeName = (row) => (row.distributorType ? row.distributorType.distributor_type : '')
const zoneName = (row) => (row.zone ? row.zone.zone : '')
const areaName = (row) => (row.area ? row.area.area : '')

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
    'Location': row.location,
    'Distributor Type': typeName(row),
    'Zone': zoneName(row),
    'Area': areaName(row),
    'Status': statusLabel(row.status),
    'Remarks': row.remarks,
}))

const Location = () => {
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
    const [areas, setAreas] = useState([])
    const [locationData, setLocationData] = useState(emptyLocation)
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
        apiLocationGet(tableData).then((data) => {
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

    // Dropdowns (old PHP: Approved types, zones of the chosen type, areas of the chosen zone)
    useEffect(() => {
        apiLocationMasterData().then((data) => {
            setTypes(data.data['types'].map((type) => ({ value: str(type.id), label: type.distributor_type })))
            setZones(data.data['zones'].map((zone) => ({ value: str(zone.id), label: zone.zone, typeId: str(zone.type_id) })))
            setAreas(data.data['areas'].map((area) => ({ value: str(area.id), label: area.area, zoneId: str(area.zone_id) })))
        }).catch((error) => {
            if (error.response) {
                showError(error.response.data['message'])
            }
        })
    }, [])

    const openAddDialog = () => {
        setEditId(null)
        setLocationData(emptyLocation)
        setIsOpen(true)
    }

    const openEditDialog = (row) => {
        const typeId = str(row.type_id)
        const zoneId = str(row.zone_id)
        const areaId = str(row.area_id)
        // Keep the location's current type / zone / area selectable even if they are no longer active
        if (typeId && !types.some((option) => option.value === typeId)) {
            setTypes((prev) => [...prev, { value: typeId, label: typeName(row) || typeId }])
        }
        if (zoneId && !zones.some((option) => option.value === zoneId)) {
            setZones((prev) => [...prev, { value: zoneId, label: zoneName(row) || zoneId, typeId }])
        }
        if (areaId && !areas.some((option) => option.value === areaId)) {
            setAreas((prev) => [...prev, { value: areaId, label: areaName(row) || areaId, zoneId }])
        }
        setEditId(row.id)
        setLocationData({
            type_id: typeId,
            zone_id: zoneId,
            area_id: areaId,
            location: row.location || '',
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
            ? apiLocationUpdate({ id: editId, values })
            : apiLocationPost(values)

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
                header: 'Location',
                accessorKey: 'location',
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
                header: 'Area',
                id: 'area_name',
                accessorFn: areaName,
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
    ), [tableData.pageIndex, tableData.pageSize, action, types, zones, areas])

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
        apiLocationGet({
            ...tableData,
            pageIndex: 1,
            pageSize: 'all',
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    toExportRows(data.data['rows']),
                    `locations-${new Date().toLocaleString()}.xls`
                )
            }
        }).catch((error) => {
            if (error.response) {
                showError(error.response.data['message'])
            }
        })
    }

    const selectField = (name, options, onSelect, isClearable = false) => (
        <Field name={name}>
            {({ field, form }) => (
                <Select
                    field={field}
                    form={form}
                    options={options}
                    placeholder="Select"
                    isClearable={isClearable}
                    // Menus open above the scrolling dialog body (Select merges `style` into its styles)
                    menuPortalTarget={document.body}
                    style={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
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
                <h3 className="mb-4 lg:mb-0 ">Location</h3>
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
                            <span>Add Location</span>
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
                contentClassName="my-8"
            >
                <h5 className="mb-6">{editId ? 'Edit' : 'Add'} Location</h5>
                <Formik
                    enableReinitialize={true}
                    initialValues={locationData}
                    validationSchema={validationSchema}
                    onSubmit={onSubmit}
                >
                    {({ values, errors, touched, isSubmitting }) => (
                        <Form autoComplete="off">
                            <FormContainer>
                                {/* Fields scroll inside the dialog so Save / Cancel always stay on screen */}
                                <div className="max-h-[60vh] overflow-y-auto pr-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                                <FormItem
                                    asterisk
                                    label="Type"
                                    invalid={errors.type_id && touched.type_id}
                                    errorMessage={errors.type_id}
                                >
                                    {selectField('type_id', types, (form, option) => {
                                        // Keep zone / area only if they still belong to the chosen type
                                        const zone = zones.find((item) => item.value === values.zone_id)
                                        if (!option || !zone || zone.typeId !== option.value) {
                                            form.setFieldValue('zone_id', '')
                                            form.setFieldValue('area_id', '')
                                        }
                                    })}
                                </FormItem>
                                <FormItem
                                    asterisk
                                    label="Zone"
                                    invalid={errors.zone_id && touched.zone_id}
                                    errorMessage={errors.zone_id}
                                >
                                    {selectField('zone_id', zones.filter((zone) => zone.typeId === values.type_id), (form, option) => {
                                        const area = areas.find((item) => item.value === values.area_id)
                                        if (!option || !area || area.zoneId !== option.value) {
                                            form.setFieldValue('area_id', '')
                                        }
                                    })}
                                </FormItem>
                                <FormItem
                                    label="Area"
                                    invalid={errors.area_id && touched.area_id}
                                    errorMessage={errors.area_id}
                                >
                                    {selectField('area_id', areas.filter((area) => area.zoneId === values.zone_id), null, true)}
                                </FormItem>
                                <FormItem
                                    asterisk
                                    label="Location"
                                    invalid={errors.location && touched.location}
                                    errorMessage={errors.location}
                                >
                                    <Field type="text" name="location" placeholder="Location Name" component={Input} />
                                </FormItem>
                                </div>
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
                                </div>
                                <FormItem className="text-right mb-0 mt-4">
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

export default Location
