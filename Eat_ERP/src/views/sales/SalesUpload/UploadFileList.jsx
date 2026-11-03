import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import DataTable from 'components/shared/DataTable'
import debounce from 'lodash/debounce'
import Button from 'components/ui/Buttons'
import Input from 'components/ui/Input'
import Dialog from 'components/ui/Dialog'
import Select from 'components/ui/Select'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { HiDownload, HiSearch, HiUpload } from 'react-icons/hi'
import { FaFileExcel } from 'react-icons/fa'
import { openPrintout } from '../Sales/salesFiles'
import { formatDate } from '../Sales/Sales'

// List of Excel uploads ported from the old PHP app (Sales Upload, Sales Return Upload, Old Payment Upload): Download Format, Upload File
// (its rows are checked straight away; check / error files), Upload Data for files still marked Uploading,
// Approve / Reject a Pending file and print the documents of an Approved one.
//
// api: { get, format, post, process, approve, reject } (service functions)
// labels: { title, formatFile, uploadHelp, approveConfirm, rejectConfirm }
// prints: [{ label, request }] printouts of an Approved file
// uploadTypes: file types to choose from when uploading (optional; also shows a Type column)

const notify = (message, type = 'danger') => {
    toast.push(
        <Notification title={type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Error'} type={type} closable>
            {message}
        </Notification>
    )
}

// Error message of a JSON or (for the format download) blob response
const errorMessage = async (error, fallback) => {
    const data = error && error.response ? error.response.data : null
    if (!data) return fallback
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
        try {
            return JSON.parse(await data.text()).message || fallback
        } catch (e) {
            return fallback
        }
    }
    return data.message || fallback
}

const saveFile = (blob, name) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
}

const STATUS_COLOR = {
    Approved: 'text-emerald-600',
    Pending: 'text-amber-600',
    Uploading: 'text-indigo-600',
    InProcess: 'text-indigo-600',
    Error: 'text-red-600',
    Failed: 'text-red-600',
    Rejected: 'text-gray-500',
}

const FileLink = ({ url, title }) => (url ? (
    <a href={url} target="_blank" rel="noreferrer" title={title} className="inline-flex text-indigo-600 text-xl bg-indigo-50 rounded-full p-2 hover:bg-indigo-100 transition-colors">
        <HiDownload />
    </a>
) : null)

const UploadFileList = ({ api, labels, prints, uploadTypes }) => {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [action, setAction] = useState({ upload: false, approve: false })
    const [tableData, setTableData] = useState({
        total: 0,
        pageIndex: 1,
        pageSize: 10,
        query: '',
        sort: { order: '', key: '' },
    })
    const [uploadOpen, setUploadOpen] = useState(false)
    const [file, setFile] = useState(null)
    const [uploadType, setUploadType] = useState('')
    const [fileError, setFileError] = useState('')
    // { action, id } of the request running; one at a time
    const [busy, setBusy] = useState(null)
    const [confirm, setConfirm] = useState(null)
    const inputRef = useRef(null)
    const latestRequest = useRef(0)

    const load = useCallback((quiet = false) => {
        const request = ++latestRequest.current
        if (!quiet) setLoading(true)
        api.get(tableData)
            .then((res) => {
                if (request !== latestRequest.current) return
                setData(res.data['rows'] || [])
                setAction(res.data['action'] || { upload: false, approve: false })
                setTableData((prev) => (prev.total === res.data['total'] ? prev : { ...prev, total: res.data['total'] }))
            })
            .catch(async (error) => {
                if (request === latestRequest.current) notify(await errorMessage(error, 'Fetching uploads failed'))
            })
            .finally(() => {
                if (request === latestRequest.current) setLoading(false)
            })
        // tableData.total is set from the answer, so it is not a reason to load again
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api, tableData.pageIndex, tableData.pageSize, tableData.query, tableData.sort])

    useEffect(() => {
        load()
    }, [load])

    const debounceFn = useMemo(() => debounce((value) => {
        if (typeof value === 'string' && (value.length > 1 || value.length === 0)) {
            setTableData((prev) => ({ ...prev, query: value, pageIndex: 1 }))
        }
    }, 1000), [])

    const run = (name, id, request, onSuccess, fallback) => {
        setBusy({ action: name, id })
        return request()
            .then(onSuccess)
            .catch(async (error) => {
                const res = error && error.response
                // An upload with only invalid rows still answers with the file's result
                if (res && res.status === 422 && res.data && res.data.status === 'Error') {
                    notify(res.data.message)
                    if (name === 'upload') {
                        setUploadOpen(false)
                        setFile(null)
                        setUploadType('')
                    }
                    load(true)
                } else {
                    notify(await errorMessage(error, fallback))
                }
            })
            .finally(() => setBusy(null))
    }
    const isBusy = (name, id) => busy !== null && busy.action === name && busy.id === id

    const downloadFormat = () => run('format', null, api.format, (res) => {
        saveFile(res.data, labels.formatFile)
    }, 'Downloading format failed')

    const chooseFile = (event) => {
        const chosen = event.target.files && event.target.files[0]
        setFile(null)
        setFileError('')
        if (!chosen) return
        if (!/\.xlsx$/i.test(chosen.name)) {
            setFileError('Please choose a .xlsx file (use Download Format).')
        } else if (chosen.size > 25 * 1024 * 1024) {
            setFileError('The file cannot be more than 25MB.')
        } else {
            setFile(chosen)
        }
    }

    const closeUpload = () => {
        if (busy) return
        setUploadOpen(false)
        setFile(null)
        setUploadType('')
        setFileError('')
    }

    const upload = () => {
        if (uploadTypes && !uploadType) {
            setFileError('Select the upload type.')
            return
        }
        if (!file) {
            setFileError('Choose the file to upload.')
            return
        }
        run('upload', null, () => api.post(file, uploadType), (res) => {
            notify(res.data['message'], 'success')
            setUploadOpen(false)
            setFile(null)
            setUploadType('')
            setTableData((prev) => ({ ...prev, query: '', pageIndex: 1 }))
            if (inputRef.current) inputRef.current.value = ''
            load(true)
        }, 'Uploading file failed')
    }

    const process = (row) => run('process', row.id, () => api.process(row.id), (res) => {
        notify(res.data['message'], 'success')
        load(true)
    }, 'Uploading file data failed')

    const decide = () => {
        const { type, row } = confirm
        setConfirm(null)
        const request = type === 'approve' ? api.approve : api.reject
        run(type, row.id, () => request(row.id), (res) => {
            notify(res.data['message'], 'success')
            if (res.data['warning']) notify(res.data['warning'], 'warning')
            load(true)
        }, type === 'approve' ? 'Approving file failed' : 'Rejecting file failed')
    }

    const print = (row, item) => openPrintout(
        () => item.request(row.id),
        async (error) => notify(await errorMessage(error, `${item.label} failed`))
    )

    const columns = useMemo(() => [
        {
            header: 'Sr. No.',
            cell: (props) => props.row.index + 1 + tableData.pageSize * (tableData.pageIndex - 1),
            width: 60,
        },
        {
            header: 'Upload Date',
            accessorKey: 'upload_date',
            cell: (props) => formatDate(props.row.original.upload_date),
            width: 110,
        },
        ...(uploadTypes ? [{ header: 'Type', accessorKey: 'upload_type', width: 90 }] : []),
        { header: 'File Name', accessorKey: 'file_name' },
        {
            header: 'Status',
            accessorKey: 'status',
            width: 100,
            cell: (props) => (
                <span className={`font-semibold ${STATUS_COLOR[props.row.original.status] || ''}`}>{props.row.original.status}</span>
            ),
        },
        {
            header: 'Remarks',
            accessorKey: 'remarks',
            cell: (props) => <span className="whitespace-pre-line">{props.row.original.remarks}</span>,
        },
        {
            header: 'Original File',
            enableSorting: false,
            width: 80,
            cell: (props) => <FileLink url={props.row.original.file_url} title="Original file" />,
        },
        {
            header: 'Error File',
            enableSorting: false,
            width: 80,
            cell: (props) => <FileLink url={props.row.original.error_file_url} title="Rows with errors (see Error Remark)" />,
        },
        {
            header: 'Check File',
            enableSorting: false,
            width: 80,
            cell: (props) => <FileLink url={props.row.original.check_file_url} title="Calculated amounts of the uploaded rows" />,
        },
        {
            header: 'Action',
            enableSorting: false,
            width: 190,
            cell: (props) => {
                const row = props.row.original
                if (row.status === 'Uploading' && action.upload) {
                    return (
                        <Button size="xs" variant="solid" loading={isBusy('process', row.id)} disabled={busy !== null} onClick={() => process(row)}>
                            Upload Data
                        </Button>
                    )
                }
                if (row.status === 'Pending' && action.approve) {
                    return (
                        <div className="flex gap-2">
                            <Button size="xs" variant="solid" color="emerald-600" loading={isBusy('approve', row.id)} disabled={busy !== null}
                                onClick={() => setConfirm({ type: 'approve', row })}>
                                Approve File
                            </Button>
                            <Button size="xs" variant="solid" color="red-600" loading={isBusy('reject', row.id)} disabled={busy !== null}
                                onClick={() => setConfirm({ type: 'reject', row })}>
                                Reject File
                            </Button>
                        </div>
                    )
                }
                if (row.status === 'Approved') {
                    return (
                        <div className="flex flex-wrap gap-2">
                            {prints.map((item) => <Button key={item.label} size="xs" onClick={() => print(row, item)}>{item.label}</Button>)}
                        </div>
                    )
                }
                return null
            },
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [tableData.pageIndex, tableData.pageSize, action, busy, labels, prints, uploadTypes])

    return (
        <AdaptableCard className="h-full card-shadow" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">{labels.title}</h3>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <Input
                        ref={inputRef}
                        size="sm"
                        className="lg:w-64"
                        placeholder="Search"
                        prefix={<HiSearch className="text-lg" />}
                        onChange={(e) => debounceFn(e.target.value)}
                    />
                    <Button size="sm" variant="solid" color="emerald-600" icon={<FaFileExcel />} loading={isBusy('format', null)}
                        disabled={busy !== null} onClick={downloadFormat}>
                        Download Format
                    </Button>
                    {action.upload ? (
                        <Button size="sm" variant="solid" icon={<HiUpload />} disabled={busy !== null} onClick={() => setUploadOpen(true)}>
                            Upload File
                        </Button>
                    ) : null}
                </div>
            </div>
            <DataTable
                columns={columns}
                data={data}
                loading={loading}
                pagingData={tableData}
                onPaginationChange={(pageIndex) => setTableData((prev) => ({ ...prev, pageIndex }))}
                onSelectChange={(pageSize) => setTableData((prev) => ({ ...prev, pageSize, pageIndex: 1 }))}
                onSort={({ order, key }) => setTableData((prev) => ({ ...prev, sort: { order, key } }))}
            />
            <Dialog isOpen={uploadOpen} onClose={closeUpload} onRequestClose={closeUpload} closable={!busy}>
                <h5 className="mb-2">Upload File</h5>
                <p className="mb-4 text-sm text-gray-500">{labels.uploadHelp}</p>
                {uploadTypes ? (
                    <div className="mb-4">
                        <Select
                            placeholder="Upload Type"
                            isDisabled={!!busy}
                            options={uploadTypes.map((value) => ({ value, label: value }))}
                            value={uploadType ? [{ value: uploadType, label: uploadType }] : []}
                            onChange={(option) => setUploadType(option ? option.value : '')}
                            menuPortalTarget={document.body}
                            style={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        />
                    </div>
                ) : null}
                <input type="file" accept=".xlsx" onChange={chooseFile} disabled={!!busy} className="block w-full text-sm" />
                {fileError ? <p className="mt-2 text-sm text-red-600">{fileError}</p> : null}
                <div className="text-right mt-6">
                    <Button className="mr-2" size="sm" variant="plain" disabled={!!busy} onClick={closeUpload}>Cancel</Button>
                    <Button size="sm" variant="solid" loading={isBusy('upload', null)} disabled={!file || (!!uploadTypes && !uploadType)} onClick={upload}>
                        {isBusy('upload', null) ? 'Uploading...' : 'Upload'}
                    </Button>
                </div>
            </Dialog>
            <ConfirmDialog
                isOpen={confirm !== null}
                closable={false}
                type={confirm && confirm.type === 'reject' ? 'danger' : 'success'}
                title={confirm && confirm.type === 'reject' ? 'Reject File' : 'Approve File'}
                onClose={() => setConfirm(null)}
                onRequestClose={() => setConfirm(null)}
                onCancel={() => setConfirm(null)}
                onConfirm={decide}
            >
                <p>
                    {confirm ? `${confirm.type === 'reject' ? 'Reject' : 'Approve'} ${confirm.row.file_name}? ${confirm.type === 'reject' ? labels.rejectConfirm : labels.approveConfirm}` : ''}
                </p>
            </ConfirmDialog>
        </AdaptableCard>
    )
}

export default UploadFileList
