import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import { MdCreate, MdDelete, MdAdd, MdImportExport } from "react-icons/md"
import { HiSearch } from 'react-icons/hi'
import { apiCategoryDelete, apiCategoryGet, apiCategoryPost, apiCategoryUpdate } from 'services/CategoryService'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { FormItem, FormContainer } from 'components/ui'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import { Field, Form, Formik } from 'formik'
import * as Yup from 'yup'
import { exportToExcel } from 'react-easy-export'

const validationSchema = Yup.object().shape({
    category_name: Yup.string().trim().required('Category Name Is Required'),
})

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
    'Category': row.category_name,
}))

const Category = () => {
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
    const [action, setAction] = useState({ insert: false, update: false, delete: false })
    const [categoryData, setCategoryData] = useState({ category_name: '' })
    const [editId, setEditId] = useState(null)
    const [dialogIsOpen, setIsOpen] = useState(false)
    const [deleteId, setDeleteId] = useState(null)
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
        apiCategoryGet(tableData).then((data) => {
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
        setCategoryData({ category_name: '' })
        setIsOpen(true)
    }

    const openEditDialog = (row) => {
        setEditId(row.id)
        setCategoryData({ category_name: row.category_name })
        setIsOpen(true)
    }

    const onDialogClose = () => {
        setIsOpen(false)
    }

    const onSubmit = (values, actions) => {
        const request = editId
            ? apiCategoryUpdate({ id: editId, values })
            : apiCategoryPost(values)

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

    const onDeleteConfirm = () => {
        apiCategoryDelete(deleteId).then((data) => {
            setDeleteId(null)
            showSuccess(data.data['message'])
            fetchData()
        }).catch((error) => {
            setDeleteId(null)
            if (error.response) {
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
                header: 'Category',
                accessorKey: 'category_name',
            },
            {
                header: 'Action',
                width: 135,
                cell: (props) => (
                    <>
                        {action.update ? (
                            <Button
                                shape="circle"
                                size="sm"
                                variant="twoTone"
                                icon={<MdCreate />}
                                className="mr-3"
                                onClick={() => openEditDialog(props.row.original)}
                            />
                        ) : null}
                        {action.delete ? (
                            <Button
                                shape="circle"
                                size="sm"
                                variant="twoTone"
                                color="red-600"
                                icon={<MdDelete />}
                                onClick={() => setDeleteId(props.row.original.id)}
                            />
                        ) : null}
                    </>
                ),
            },
        ]
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
        apiCategoryGet({
            ...tableData,
            pageIndex: 1,
            pageSize: 'all',
        }).then((data) => {
            if (data.data) {
                exportToExcel(
                    toExportRows(data.data['rows']),
                    `categories-${new Date().toLocaleString()}.xls`
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
                <h3 className="mb-4 lg:mb-0 ">Category</h3>
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
                            <span>Add Category</span>
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
                <h5 className="mb-6">{editId ? 'Edit' : 'Add'} Category</h5>
                <Formik
                    enableReinitialize={true}
                    initialValues={categoryData}
                    validationSchema={validationSchema}
                    onSubmit={onSubmit}
                >
                    {({ errors, touched, isSubmitting }) => (
                        <Form autoComplete="off">
                            <FormContainer>
                                <FormItem
                                    asterisk
                                    label="Category Name"
                                    invalid={errors.category_name && touched.category_name}
                                    errorMessage={errors.category_name}
                                >
                                    <Field
                                        type="text"
                                        name="category_name"
                                        placeholder="Category Name"
                                        component={Input}
                                    />
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
            <ConfirmDialog
                isOpen={deleteId !== null}
                closable={false}
                type="danger"
                title="Delete Category"
                onClose={() => setDeleteId(null)}
                onRequestClose={() => setDeleteId(null)}
                onCancel={() => setDeleteId(null)}
                onConfirm={onDeleteConfirm}
                confirmButtonColor="red-600">
                <p>
                    Are you sure you want to delete this category?
                </p>
            </ConfirmDialog>
        </AdaptableCard>
    )
}

export default Category
