import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { Link, useNavigate } from 'react-router-dom'
import { MdCreate, MdAdd, MdImportExport, MdOutlineDownloading, MdOutlineDownloadForOffline } from 'react-icons/md'
import { HiSearch } from 'react-icons/hi'
import { exportToExcel } from 'react-easy-export'
import { apiPackagingMaterialGet } from 'services/RawMaterialService'
import { Dialog, FormContainer, FormItem, Upload } from 'components/ui'
import { FaFileExcel } from 'react-icons/fa'
import * as Yup from 'yup'
import { Field, Form, Formik } from 'formik'

import Moment from 'react-moment'
import { saveAs } from 'file-saver'
import { socket } from 'socket'
import { apiDepotTransferUploadApprove, apiDepotTransferUploadDownload, apiDepotTransferUploadPost, apiDepotTransferUploadReject, apiDepotTransferUploads } from 'services/DepotTransferUploadService'
import appConfig from 'configs/app.config'

const MAX_UPLOAD = 1;

const validationSchema = Yup.object().shape({
    doc_document: Yup.array().min(MAX_UPLOAD, 'At least one file uploaded!'),
})

const beforeUpload = (file, fileList) => {
    let valid = true

    const MAX_FILE_SIZE = 25000000
    const allowedFileType = ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    
    if (fileList.length >= MAX_UPLOAD) {
        return `You can only upload ${MAX_UPLOAD} file(s)`
    }
    console.log("fileList: ",fileList)
    if (file) {
        for (const f of file) {
            console.log("file: ",f.type)
            if (!allowedFileType.includes(f.type)) {
                valid = 'Please upload a .xls or .xlsx file!'
            }

            if (f.size >= MAX_FILE_SIZE) {
                valid = 'Upload image cannot more then 25MB!'
            }
        }
    }

    return valid
}

const DepotTransferUpload = () => {
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

    const navigate = useNavigate();
    const inputRef = useRef(null)
    const [isLoading, setIsLoading] = useState(false);

    const debounceFn = debounce(handleDebounceFn, 1000)

    const handleChange = (e) => {
        debounceFn(e.target.value)
    }

    const [dialogIsOpen, setIsOpen] = useState(false)

    const openDialog = () => {
        setIsOpen(true)
    }

    const onDialogClose = (e) => {
        console.log('onDialogClose', e)
        setIsOpen(false)
    }

    // const onDialogOk = (e) => {
        
    // }

    function handleDebounceFn(val) {
        if (typeof val === 'string' && (val.length > 1 || val.length === 0)) {
            setTableData((prevData) => ({
                ...prevData,
                ...{ query: val, pageIndex: 1 },
            }))
        }
    }

    const columns = useMemo(
        () => [
            {
                header: 'Sr. No.',
                cell: (props) =>
                    props.row.index +
                    1 +
                    tableData.pageSize * (tableData.pageIndex - 1),
                width: 60,
                varticalAlign:'top',
            },
            {
                header:"Upload Date",
                accessorKey: 'upload_date',
                cell: (props) =>
                    <Moment format="DD-MM-YYYY">
                        {props.row.original.upload_date}
                    </Moment>,
                width: 110,
                varticalAlign:'top', 
            },
            {
                header: 'File Name',
                accessorKey: 'file_name',
                varticalAlign:'top',
            },
            {
                header: 'Status',
                accessorKey: 'status',
                width: 80,
                varticalAlign:'top',
            },
            {
                header: 'Remarks',
                accessorKey: 'remarks',
                varticalAlign:'top',
            },
            {
                header: 'Original File',
                width: 80,
                varticalAlign:'top',
                cell: (props) => (
                    <>
                        {
                            props.row.original.file_name !== "" ? (
                            <Button
                                shape="circle"
                                size="sm"
                                variant="solid"
                                icon={<MdOutlineDownloading />}
                                className="mr-3"
                                onClick={()=>saveAs(`${appConfig.uploadUrl}depot_transfer_upload/` + props.row.original.file_name, props.row.original.file_name)}
                            />):null
                        }
                    </>
                ),
            },
            {
                header: 'Check File',
                accessorKey: 'check_file_name',
                width: 80,
                varticalAlign:'top',
                cell: (props) => (
                    <>
                        {
                            props.row.original.check_file_name !== null ? (
                            <Button
                                shape="circle"
                                size="sm"
                                color="blue-600"
                                variant="solid"
                                icon={<MdOutlineDownloadForOffline />}
                                className="mr-3"
                                onClick={()=>saveAs(`${appConfig.uploadUrl}depot_transfer_upload/` + props.row.original.check_file_name, props.row.original.check_file_name)}
                            />):null
                        }
                    </>
                ),
            },
            {
                header: 'Error File',
                accessorKey: 'error_file_name',
                width: 80,
                varticalAlign:'top',
                cell: (props) => (
                    <>
                        {
                            props.row.original.error_file_name != null ? (
                            <Button
                                shape="circle"
                                size="sm"
                                color="rose-600"
                                variant="solid"
                                icon={<MdOutlineDownloadForOffline />}
                                className="mr-3"
                                onClick={()=>saveAs(`${appConfig.uploadUrl}depot_transfer_upload/` + props.row.original.error_file_name, props.row.original.error_file_name)}
                            />):null
                        }
                    </>
                ),
            },
            {
                header: 'Action',
                varticalAlign:'top',
                width:80,
                cell: (props) => (
                    <>
                        {
                            props.row.original.status == "Pending" ? (
                                <>
                                    <Button
                                        size="xs"
                                        className="mr-2 mb-2"
                                        variant="solid"
                                        color="emerald-500"
                                        disabled={isLoading}
                                        onClick={()=>{
                                            setIsLoading(true);
                                            apiDepotTransferUploadApprove(props.row.original.id).then(data=>{
                                                console.log(data)
                                                if(data.status === 200){
                                                    toast.push(
                                                        <Notification title="Success" type="success" closable>
                                                            {data["message"]}
                                                        </Notification>
                                                    );
                                                    fetchData();
                                                }else if (data.response.status === 422) {
                                                    toast.push(
                                                        <Notification title="Error" type="danger" closable>
                                                            {data.response.data["message"]}
                                                        </Notification>
                                                    );
                                                }
                                                setIsLoading(false);
                                            }).catch((error) => {
                                                console.log(error);
                                                if (error.response.status === 401) {
                                                    toast.push(
                                                        <Notification title="Error" type="danger" closable>
                                                            {error.response.data["message"]}
                                                        </Notification>
                                                    );
                                                }
                                                setIsLoading(false);
                                            });
                                        }}
                                    >Approve</Button>
                                    <Button
                                        size="xs"
                                        variant="solid"
                                        color="rose-500"
                                        disabled={isLoading}
                                        onClick={()=>{
                                            setIsLoading(true);
                                            apiDepotTransferUploadReject(props.row.original.id).then(data=>{
                                                console.log(data)
                                                if(data.status === 200){
                                                    toast.push(
                                                        <Notification title="Success" type="success" closable>
                                                            {data["message"]}
                                                        </Notification>
                                                    );
                                                    fetchData();
                                                }else if (data.response.status === 422) {
                                                    toast.push(
                                                        <Notification title="Error" type="danger" closable>
                                                            {data.response.data["message"]}
                                                        </Notification>
                                                    );
                                                }
                                                setIsLoading(false);
                                            }).catch((error) => {
                                                console.log(error);
                                                if (error.response.status === 401) {
                                                    toast.push(
                                                        <Notification title="Error" type="danger" closable>
                                                            {error.response.data["message"]}
                                                        </Notification>
                                                    );
                                                }
                                                setIsLoading(false);
                                            });
                                        }}
                                    >Reject</Button>
                                </>
                            ):null
                        }
                    </>
                ),
            },
        ],
        [tableData.pageIndex, tableData.pageSize]
    )

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

    const downloadSample = ()=>{
        apiDepotTransferUploadDownload().then(data=>{
            if(data.data['fileName']){
                console.log(data)
                saveAs(`${appConfig.reportUrl}` + data.data['fileName'], data.data['fileName'])
            }
        }).catch((error) => {
            if (error.response.status === 500) {
                console.log(error)
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {error.response.data['message']}
                    </Notification>
                )
            } else if (error.response.status === 401) {
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {error.response.data['message']}
                    </Notification>
                )
            }
        })
    }

    console.log('DepotTransferUpload.js Loading....');

    const fetchData = () => {
        // setLoading(true)
        apiDepotTransferUploads(tableData)
            .then((data) => {
                if (data.data) {
                    console.log(data.data)
                    setData(data.data['rows'])
                    setTableData((prevData) => ({
                        ...prevData,
                        ...{ total: data.data['total'] },
                    }))
                    setLoading(false)
                }
            })
            .catch((error) => {
                if (error.response.status === 500) {
                    console.log(error)
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                } else if (error.response.status === 401) {
                    toast.push(
                        <Notification title="Error" type="danger" closable>
                            {error.response.data['message']}
                        </Notification>
                    )
                }
                setLoading(false)
            })
    }
    useEffect(() => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        fetchData();
    }, [
        tableData.pageIndex,
        tableData.sort,
        tableData.pageSize,
        tableData.query,
    ])

    // const downloadAll = () => {
    //     apiDepotTransferUploadsSingle({
    //         total: 0,
    //         pageIndex: 1,
    //         pageSize: 'all',
    //         query: '',
    //         sort: {
    //             order: '',
    //             key: '',
    //         },
    //         status: '',
    //     })
    //         .then((data) => {
    //             if (data.data) {
    //                 exportToExcel(data.data['saleUploads'], `sales-upload-${new Date().toLocaleString()}.xls`)
    //             }
    //         })
    //         .catch((error) => {
    //             if (error.response.status === 500) {
    //                 console.log(error)
    //                 setLoading(false)
    //             } else if (error.response.status === 401) {
    //                 toast.push(
    //                     <Notification title="Error" type="danger" closable>
    //                         {error.response.data['message']}
    //                     </Notification>
    //                 )
    //             }
    //         })
    // }

    return (
        <>
            <AdaptableCard className="card-shadow">
                <div className="lg:flex items-center justify-between mb-4">
                    <h3 className="mb-4 lg:mb-0 ">Depot Transfer Upload</h3>
                    <div className="flex flex-row lg:flex-row lg:items-center">
                        <div className=" inline-flex gap-[10px] items-start justify-end">
                            <Input
                                ref={inputRef}
                                placeholder="Search..."
                                size="sm"
                                className="lg:w-52"
                                onChange={handleChange}
                                prefix={<HiSearch className="text-lg" />}
                            />
                            <div className='inline-flex flex-col items-end justify-start '>
                                <Button size="sm" icon={<FaFileExcel />} onClick={openDialog}>
                                    Upload Exel
                                </Button>
                            </div>
                            <Button
                                size="sm"
                                variant="solid"
                                icon={<FaFileExcel />}
                                onClick={() => {
                                    downloadSample()
                                }}
                            >
                                <span>Download Sample</span>
                            </Button>
                            {/* <Button
                                size="sm"
                                variant="solid"
                                color="emerald-600"
                                icon={<MdImportExport />}
                                onClick={() => {
                                    exportToExcel(
                                        data,
                                        `sales-upload-${new Date().toLocaleString()}.xls`
                                    )
                                }}
                                // disabled={!data.length > 0}
                            >
                                <span>Download</span>
                            </Button>
                            <Button
                                size="sm"
                                variant="solid"
                                color="emerald-600"
                                icon={<MdImportExport />}
                                onClick={() => {
                                    downloadAll()
                                }}
                                // disabled={!data.length > 0}
                            >
                                <span>Download All</span>
                            </Button> */}
                        </div>
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
                
            </AdaptableCard>
            <Dialog
                isOpen={dialogIsOpen}
                onClose={onDialogClose}
                onRequestClose={onDialogClose}
            >
                <h5 className="mb-4">Upload Exel</h5>
                <Formik
                    initialValues={{
                        doc_document: '',
                    }}
                    validationSchema={validationSchema}
                    onSubmit={(values, { resetForm, setSubmitting }) => {
                        const formData = new FormData();
                        formData.append('doc_document', values.doc_document[0])
                        // console.log(formData)
                        for(var key of formData.entries()) {
                            console.log(key[1]); 
                        }
                        apiDepotTransferUploadPost(formData).then(data=>{
                            console.log(data)
                            setSubmitting(false)
                            resetForm()
                            setIsOpen(false)
                            if(data.status === 201){
                                toast.push(
                                    <Notification title="Success" type="success" closable>
                                        {data["message"]}
                                    </Notification>
                                );
                                fetchData();
                            }else if (data.response.status === 401) {
                                toast.push(
                                    <Notification title="Error" type="danger" closable>
                                        {data.response.data["message"]}
                                    </Notification>
                                );
                            }
                        }).catch((error) => {
                            console.log(error);
                            if (error.response.status === 401) {
                                toast.push(
                                    <Notification title="Error" type="danger" closable>
                                        {error.response.data["message"]}
                                    </Notification>
                                );
                                setSubmitting(false)
                                resetForm()
                                setIsOpen(false)
                            }
                        });
                    }}
                >
                    {({ values, touched, errors, resetForm }) => (
                        <Form>
                            <FormContainer>
                                <FormItem
                                    invalid={errors.doc_document && touched.doc_document}
                                    errorMessage={errors.doc_document}
                                >
                                    <Field name="doc_document" >
                                        {({ field, form }) => (
                                            <Upload 
                                                draggable
                                                beforeUpload={beforeUpload}
                                                accept=".xlsx,.xls" 
                                                multiple={false}
                                                onChange={(files) =>
                                                    form.setFieldValue(field.name, files)
                                                }
                                                onFileRemove={(files) =>
                                                    form.setFieldValue(field.name, files)
                                                }
                                            />
                                        )}
                                    </Field>
                                </FormItem>
                                <FormItem>
                                    <div className="text-right">
                                        <Button
                                            type="reset"
                                            className="ltr:mr-2 rtl:ml-2"
                                            onClick={() => {
                                                resetForm()
                                                console.log('onDialogCance')
                                                setIsOpen(false)
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button variant="solid" type="submit">
                                            Submit
                                        </Button>
                                    </div>
                                </FormItem>
                            </FormContainer>
                        </Form>
                    )}
                </Formik>
            </Dialog>
            {/* {
                dialogIsOpen ? (
                ): null
            } */}
        </>
    )
}

export default DepotTransferUpload
