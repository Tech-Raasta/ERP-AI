import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import { MdCreate, MdDelete, } from "react-icons/md"
import { useNavigate } from 'react-router-dom'
import { HiSearch } from 'react-icons/hi'
import { apiExpenseCategoryDelete, apiExpenseCategoryGet, apiExpenseCategoryPost, apiExpenseCategoryUpdate } from 'services/ExpenseCategoryService'
import Dialog from 'components/ui/Dialog'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { FormItem, FormContainer, Tabs} from 'components/ui'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import { Field, Form, Formik } from 'formik'
import { useDispatch } from 'react-redux'
import { setUser, initialState } from 'store/auth/userSlice'
import { onSignOutSuccess } from 'store/auth/sessionSlice'
import appConfig from 'configs/app.config'
import * as Yup from 'yup'


const { TabNav, TabList, TabContent } = Tabs

const validationSchema = Yup.object().shape({
    category: Yup.string().required('Expense Category Name Is Required'),
})

const Category = () => {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 10,
        query: '',
        sort: {
            order: '',
            key: '',
        },
        status:'Approved'
    });

    const [statusCount, setStatusCount] = useState({
        approved: 0,
        inActive: 0,
    })
    const [expenseCategoryData, setExpenseCategoryData] = useState({ category: ''})
    const navigate = useNavigate();
    const inputRef = useRef(null)
    const [addEdit, setAddEdit] = useState('');
    const [open, setOpen] = useState(false)
    const [deleteId, setDeleteId] = useState(null);

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

    const handleRowClick = (data) => {
        // navigate(`/product/product/edit-product/${dataid}`);
        console.log(data);
        openDialog();
        setAddEdit(data.id);
        setExpenseCategoryData({
            category: data.category
        })
    }

    const onDialogClose1 = (e) => {
        console.log('onDialogClose', e)
        setOpen(false)
    }

    const onDialogOk1 = (e) => {
        console.log('onDialogOk', e)
        apiExpenseCategoryDelete(deleteId).then(data => {
            console.log(data);
            if (data.status === 200) {
                toast.push(
                    <Notification
                        title='Success'
                        type='success'
                        closable
                    >
                        {data.data['message']}
                    </Notification>
                )
                setLoading(true)
                setOpen(false)
                apiExpenseCategoryGet(tableData).then(data => {
                    if (data.data) {
                        console.log(data.data)
                        setData(data.data['rows'])
                        setLoading(false)
                        setTableData((prevData) => ({
                            ...prevData,
                            ...{ total: data.data['total'] },
                        }))
                    }
                }).catch(error => {
                    console.log(error);
                })
            }
        }).catch(error => {
            console.log(error);
        })

    }


    const handleDeleteRowClick = (dataId) => {
        setDeleteId(dataId);
        setOpen(true)
    }

    const [dialogIsOpen, setIsOpen] = useState(false)
    const [loadStatus, setLoadStatus] = useState('approved');

    const openDialog = () => {
        setAddEdit('');
        setExpenseCategoryData({ category: ''})
        setIsOpen(true)
    }

    const onDialogClose = (e) => {
        console.log('onDialogClose', e)
        setIsOpen(false)
    }

    const columns = useMemo(() => (
        [
            {
                header: 'Sr. No.',
                cell: ((props) => props.row.index + 1),
                width: 70

            },
            {
                header: 'Expense Category Name',
                accessorKey: 'category',
            },
            {
                header: 'Status',
                accessorKey: 'status',
                cell: (props) => (props.row.original.status === 'Approved' ? 'Active' : 'InActive'),
                width: 123
            },
            {
                header: 'Action',
                width: 135,
                cell: (props) => (
                    <>
                        <Button
                            shape="circle"
                            size="sm"
                            variant="twoTone"
                            icon={<MdCreate />}
                            className='mr-3'
                            onClick={() => { handleRowClick(props.row.original) }}
                        />
                        {
                            props.row.original.status === 'Approved' ? (
                                <Button
                                    shape="circle"
                                    size="sm"
                                    variant="twoTone"
                                    color="red-600"
                                    icon={<MdDelete />}
                                    onClick={() => { handleDeleteRowClick(props.row.original.id) }}
                                />
                            ):null
                        }
                    </>
                ),
            },
        ]
    ), [tableData.pageIndex, tableData.pageSize, tableData.status])

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

    const tabChanges = (tab) => {
        setLoadStatus(tab)
        setTableData((prevData) => ({
            ...prevData,
            ...{ status: tab, pageIndex: 1 },
        }))
    }
    // function validateCategory(value) {
    //     if (!value) {
    //         return 'Required'
    //     }
    //     return
    // }

    const dispatch = useDispatch()

    useEffect(() => {

        const fetchData = async () => {
            setLoading(true)
            const data = await apiExpenseCategoryGet(tableData).catch(error => {
                if (error.response.status === 500) {
                    console.log(error)
                    toast.push(
                        <Notification
                            title='Failed'
                            type='warning'
                            closable
                        >
                            {error.response.data['message']}
                        </Notification>
                    )
                    setLoading(false);
                } else if (error.response.status === 400) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                    dispatch(onSignOutSuccess())
                    dispatch(setUser(initialState))
                    navigate(appConfig.unAuthenticatedEntryPath)
                }
            });
            if (data.data) {
                console.log(data.data)
                setData(data.data['rows']);
                setStatusCount(data.data['statusCount']);
                setLoading(false);
                setTableData((prevData) => ({
                    ...prevData,
                    ...{ total: data.data['total'] },
                }))
            }
        }
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps

    }, 
    [
        tableData.pageIndex,
        tableData.sort,
        tableData.pageSize,
        tableData.query,
        tableData.status
    ])
    return (
        <AdaptableCard className="card-shadow">
            <div className='lg:flex items-center justify-between mb-4'>
                <h3 className="mb-4 lg:mb-0 ">Category</h3>
                <div className='flex flex-col lg:flex-row lg:items-center'>
                    <Input
                        ref={inputRef}
                        placeholder="Search..."
                        size="sm"
                        className="lg:w-52 mr-4 lg:mb-0 "
                        onChange={handleChange}
                        prefix={<HiSearch className="text-lg" />}
                    />
                    <Button variant="solid" size="sm" onClick={() => openDialog()}>
                        Add Category
                    </Button>
                    <Dialog
                        isOpen={dialogIsOpen}
                        shouldCloseOnOverlayClick={false}
                        shouldCloseOnEsc={false}
                        onClose={onDialogClose}
                        onRequestClose={onDialogClose}
                    >
                        <h5 className=" mb-6">{addEdit === '' ? 'Add' : 'Edit'} Expense Category</h5>
                        <Formik
                            enableReinitialize={true}
                            initialValues={expenseCategoryData}
                            validationSchema={validationSchema}
                            onSubmit={(values, actions) => {
                                console.log("Values", values)
                                if (addEdit === '') {
                                    apiExpenseCategoryPost(values).then(data => {
                                        toast.push(
                                            <Notification
                                                title='Success'
                                                type='success'
                                                closable
                                            >
                                                {data.data['message']}
                                            </Notification>
                                        )
                                        actions.setSubmitting(false)
                                        setIsOpen(false)
                                        setLoading(true);
                                        apiExpenseCategoryGet(tableData).then(data => {
                                            if (data.data) {
                                                console.log(data.data)
                                                setData(data.data['rows'])
                                                setLoading(false)
                                                setTableData((prevData) => ({
                                                    ...prevData,
                                                    ...{ total: data.data['total'] },
                                                }))
                                            }
                                        }).catch(error => {
                                            console.log(error);
                                        })
                                    }).catch(error => {
                                        let errorData = error.response['data']['error']['errors'];
                                        actions.setSubmitting(false)
                                        if (error.response.status === 422) {
                                            for (const errMsg in errorData) {
                                                actions.setFieldError('category', errorData[errMsg]['message'])
                                                toast.push(
                                                    <Notification
                                                        title='Error'
                                                        type='danger'
                                                        closable
                                                    >
                                                        {errorData[errMsg]['message']}

                                                    </Notification>
                                                )
                                            }
                                        } else if (error.response.status === 500) {
                                            console.log(errorData)
                                        }
                                    })
                                } else {
                                    apiExpenseCategoryUpdate({ ...{ id: addEdit }, values }).then(data => {
                                        toast.push(
                                            <Notification
                                                title='Success'
                                                type='success'
                                                closable
                                            >
                                                {data.data['message']}
                                            </Notification>
                                        )
                                        actions.setSubmitting(false)
                                        setIsOpen(false)
                                        setLoading(true);
                                        apiExpenseCategoryGet(tableData).then(data => {
                                            if (data.data) {
                                                console.log(data.data)
                                                setData(data.data['rows'])
                                                setLoading(false)
                                                setTableData((prevData) => ({
                                                    ...prevData,
                                                    ...{ total: data.data['total'] },
                                                }))
                                            }
                                        }).catch(error => {
                                            console.log(error);
                                        })
                                    }).catch(error => {
                                        let errorData = error.response['data']['error']['errors'];
                                        actions.setSubmitting(false)
                                        if (error.response.status === 422) {
                                            for (const errMsg in errorData) {
                                                actions.setFieldError('category', errorData[errMsg]['message'])
                                                toast.push(
                                                    <Notification
                                                        title='Error'
                                                        type='danger'
                                                        closable
                                                    >
                                                        {errorData[errMsg]['message']}

                                                    </Notification>
                                                )
                                            }
                                        } else if (error.response.status === 500) {
                                            console.log(errorData)
                                        }
                                    })
                                }
                            }}
                        >
                            {({ values, errors, touched, isSubmitting }) => (
                                <Form autoComplete='off' >
                                    <FormContainer>
                                        <FormItem
                                            asterisk
                                            invalid={errors.category && touched.category}
                                            errorMessage={errors.category}
                                            label="Expense Category Name"
                                        >
                                            <Field
                                                type="text"
                                                name="category"
                                                placeholder="Expense Category Name"
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
                                                Back
                                            </Button>
                                            <Button type="submit" variant="solid" disabled={isSubmitting}>
                                                Submit
                                            </Button>
                                        </FormItem>
                                    </FormContainer>
                                </Form>
                            )}
                        </Formik>
                    </Dialog>
                </div>
            </div>
            <Tabs
                defaultValue={loadStatus}
                onChange={(tabValue) => {
                    tabChanges(tabValue)
                }}
            >
                <TabList className="justify-end">
                    <TabNav value="approved">
                        Active {`(${statusCount.approved})`}
                    </TabNav>
                    <TabNav value="inActive">
                        InActive {`(${statusCount.inActive})`}
                    </TabNav>
                </TabList>
                <div className="p-1">
                    <TabContent value="approved"></TabContent>
                    <TabContent value="inActive"></TabContent>
                </div>
            </Tabs>
            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagingData={tableData}
                onPaginationChange={handlePaginationChange}
                onSelectChange={handleSelectChange}
                onSort={handleSort}
            />
            <ConfirmDialog
                isOpen={open}
                closable={false}
                type='danger'
                title="Delete Expense Category!!"
                onClose={onDialogClose1}
                onRequestClose={onDialogClose1}
                onCancel={onDialogClose1}
                onConfirm={onDialogOk1}
                confirmButtonColo="red-600">
                <p>
                    Do you want to delete this expense category ?
                </p>
            </ConfirmDialog>
        </AdaptableCard>
    )
}

export default Category
