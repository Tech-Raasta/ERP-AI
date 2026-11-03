import React, { useEffect, useMemo, useState } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import Loading from 'components/shared/Loading'
import Button from 'components/ui/Buttons'
import Checkbox from 'components/ui/Checkbox'
import DatePicker from 'components/ui/DatePicker'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import Table from 'components/ui/Table'
import Tabs from 'components/ui/Tabs'
import { FormItem, FormContainer } from 'components/ui'
import { Link, useParams } from 'react-router-dom'
import { HiArrowNarrowLeft, HiDownload, HiEye, HiSearch } from 'react-icons/hi'
import { saveAs } from 'file-saver'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiReportDownload, apiReportOptions, apiReportPreview } from 'services/reportsService'
import ReportAccessDenied from './ReportAccessDenied'
import './Reports.css'

const { Tr, Th, Td, THead, TBody, TFoot } = Table
const { TabNav, TabList } = Tabs

// Any report on the Reports screen: its filters come from its definition on the server (lib/reports). Preview shows
// the first rows and the totals; Download gives the whole report in Excel. A file-only report has no preview.

const pad = (value) => (value < 10 ? `0${value}` : `${value}`)
const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const parseDate = (value) => {
    if (!value) return null
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
}
// Reports open on the current financial year, from 1 April
const yearStart = () => {
    const now = new Date()
    return `${now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1}-04-01`
}

// The common periods, one click each
const lastDay = (year, month) => new Date(year, month + 1, 0)
const PERIODS = [
    { label: 'This month', range: (now) => [new Date(now.getFullYear(), now.getMonth(), 1), now] },
    { label: 'Last month', range: (now) => [new Date(now.getFullYear(), now.getMonth() - 1, 1), lastDay(now.getFullYear(), now.getMonth() - 1)] },
    { label: 'This year', range: (now) => [parseDate(yearStart()), now] },
    {
        label: 'Last year',
        range: () => {
            const start = parseDate(yearStart())
            return [new Date(start.getFullYear() - 1, 3, 1), new Date(start.getFullYear(), 2, 31)]
        },
    },
]

const STAT_COUNT = 4

const showMessage = (message, type = 'danger') => {
    toast.push(
        <Notification title={type === 'success' ? 'Success' : 'Error'} type={type} closable>
            {message}
        </Notification>
    )
}

const formatNumber = (value, column) => {
    if (value === null || value === undefined || value === '') return ''
    if (typeof value !== 'number') return value
    const money = column.type === 'money'
    return value.toLocaleString('en-IN', { minimumFractionDigits: money ? 2 : 0, maximumFractionDigits: column.decimals === undefined ? 2 : column.decimals })
}

// A failed download comes back as a file like any other, so its message has to be read out of it
const errorOf = async (error) => {
    const response = error && error.response
    if (!response) return { message: 'The report could not be reached. Please try again.' }
    const data = response.data instanceof Blob ? JSON.parse(await response.data.text()) : response.data
    return data || {}
}

const ReportViewer = () => {
    const { key } = useParams()
    const [report, setReport] = useState(null)
    const [lists, setLists] = useState({ distributors: [], depots: [], ledgers: [] })
    const [values, setValues] = useState({})
    const [errors, setErrors] = useState({})
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState('')
    const [result, setResult] = useState(null)
    const [sheetName, setSheetName] = useState('')
    const [rowSearch, setRowSearch] = useState('')
    // Set when the report cannot be opened: the page then shows only why
    const [denied, setDenied] = useState('')

    useEffect(() => {
        setLoading(true)
        setResult(null)
        setDenied('')
        setReport(null)
        apiReportOptions(key)
            .then((res) => {
                const definition = res.data['report']
                setReport(definition)
                setLists(res.data)
                const start = {}
                definition.filters.forEach((filter) => {
                    if (filter.type === 'dateRange') {
                        start.fromDate = yearStart()
                        start.toDate = toDateString(new Date())
                    } else if (filter.type === 'date') {
                        start[filter.name] = toDateString(new Date())
                    } else if (filter.type === 'checkbox') {
                        start[filter.name] = !!filter.default
                    }
                })
                setValues(start)
            })
            .catch((error) => {
                const status = error && error.response ? error.response.status : 0
                const message = error && error.response ? error.response.data['message'] : 'Fetching report failed'
                if (status === 401 || status === 404) setDenied(message)
                else showMessage(message)
            })
            .finally(() => setLoading(false))
    }, [key])

    const clearResult = () => setResult(null)

    const setValue = (name, value) => {
        setValues((prev) => ({ ...prev, [name]: value }))
        setErrors((prev) => ({ ...prev, [name]: undefined }))
        clearResult()
    }

    const setPeriod = (period) => {
        const [from, to] = period.range(new Date())
        setValues((prev) => ({ ...prev, fromDate: toDateString(from), toDate: toDateString(to) }))
        setErrors((prev) => ({ ...prev, fromDate: undefined, toDate: undefined }))
        clearResult()
    }

    const setGroup = (filters, checked) => {
        setValues((prev) => ({ ...prev, ...Object.fromEntries(filters.map((filter) => [filter.name, checked])) }))
        clearResult()
    }

    const handleError = async (error) => {
        const data = await errorOf(error)
        const fields = data.error && data.error.errors
        if (fields) {
            setErrors(Object.fromEntries(Object.entries(fields).map(([name, item]) => [name, item.message])))
            showMessage(Object.values(fields)[0].message)
        } else {
            showMessage(data.message || 'The report failed. Please try again.')
        }
    }

    const runPreview = () => {
        setErrors({})
        setBusy('preview')
        apiReportPreview(key, values)
            .then((res) => {
                setResult(res.data)
                setRowSearch('')
                setSheetName(res.data.sheets.length ? res.data.sheets[0].name : '')
            })
            .catch(handleError)
            .finally(() => setBusy(''))
    }

    const download = () => {
        setErrors({})
        setBusy('download')
        apiReportDownload(key, values)
            .then((res) => {
                const name = (res.headers['content-disposition'] || '').match(/filename="([^"]+)"/)
                saveAs(res.data, name ? name[1] : `${report.name}.xlsx`)
            })
            .catch(handleError)
            .finally(() => setBusy(''))
    }

    const sheet = useMemo(() => (result ? result.sheets.find((item) => item.name === sheetName) || result.sheets[0] : null), [result, sheetName])
    const empty = result && !result.sheets.some((item) => item.total)
    const rows = useMemo(() => {
        const term = rowSearch.trim().toLowerCase()
        if (!sheet || !term) return sheet ? sheet.rows : []
        return sheet.rows.filter((row) => sheet.columns.some((column) => String(row[column.key] === null ? '' : row[column.key]).toLowerCase().includes(term)))
    }, [sheet, rowSearch])
    // The money totals are the figures people look for first
    const stats = useMemo(() => {
        if (!sheet || !sheet.totals) return []
        const money = sheet.columns.filter((column) => sheet.totals[column.key] !== undefined && column.type === 'money')
        return (money.length ? money : sheet.columns.filter((column) => sheet.totals[column.key] !== undefined)).slice(-STAT_COUNT)
    }, [sheet])
    const hasPeriod = report && report.filters.some((filter) => filter.type === 'dateRange')
    const grouped = report ? report.filters.filter((filter) => filter.group) : []
    const groupNames = [...new Set(grouped.map((filter) => filter.group))]

    const filterField = (filter) => {
        if (filter.type === 'dateRange') {
            return (
                <React.Fragment key="dates">
                    <FormItem asterisk label="From" invalid={!!errors.fromDate} errorMessage={errors.fromDate}>
                        <DatePicker inputFormat="DD/MM/YYYY" maxDate={new Date()} clearable={false} value={parseDate(values.fromDate)}
                            onChange={(date) => setValue('fromDate', date ? toDateString(new Date(date)) : '')} />
                    </FormItem>
                    <FormItem asterisk label="To" invalid={!!errors.toDate} errorMessage={errors.toDate}>
                        <DatePicker inputFormat="DD/MM/YYYY" maxDate={new Date()} clearable={false} value={parseDate(values.toDate)}
                            onChange={(date) => setValue('toDate', date ? toDateString(new Date(date)) : '')} />
                    </FormItem>
                </React.Fragment>
            )
        }
        if (filter.type === 'date') {
            return (
                <FormItem key={filter.name} asterisk label={filter.label} invalid={!!errors[filter.name]} errorMessage={errors[filter.name]}>
                    <DatePicker inputFormat="DD/MM/YYYY" clearable={false} value={parseDate(values[filter.name])}
                        onChange={(date) => setValue(filter.name, date ? toDateString(new Date(date)) : '')} />
                </FormItem>
            )
        }
        if (filter.type === 'checkbox') {
            return (
                <FormItem key={filter.name} label={' '}>
                    <Checkbox checked={!!values[filter.name]} onChange={(checked) => setValue(filter.name, checked)}>{filter.label}</Checkbox>
                </FormItem>
            )
        }
        const source = { distributor: lists.distributors, depot: lists.depots, ledger: lists.ledgers }[filter.type] || filter.options || []
        const options = filter.allowAll ? [{ value: '', label: 'All' }, ...source] : source
        return (
            <FormItem key={filter.name} asterisk={!!filter.required} label={filter.label} invalid={!!errors[filter.name]} errorMessage={errors[filter.name]}>
                <Select
                    placeholder={filter.allowAll ? 'All' : 'Select'}
                    options={options}
                    value={options.filter((option) => String(option.value) === String(values[filter.name] === undefined ? '' : values[filter.name]))}
                    onChange={(option) => setValue(filter.name, option ? option.value : '')}
                />
            </FormItem>
        )
    }

    if (denied) return <ReportAccessDenied message={denied} />

    return (
        <Loading loading={loading}>
            <AdaptableCard className="mb-4 card-shadow" divider>
                <Link to="/reports" className="text-sm text-amber-600 inline-flex items-center gap-1 mb-2"><HiArrowNarrowLeft /> Reports</Link>
                <h4 className="mb-1">{report ? report.name : 'Report'}</h4>
                {report ? <p className="mb-4 text-gray-500">{report.description}</p> : null}
                {report ? (
                    <FormContainer>
                        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-x-4">
                            {report.filters.filter((filter) => !filter.group).map(filterField)}
                        </div>
                        {hasPeriod ? (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {PERIODS.map((period) => (
                                    <button key={period.label} type="button" className="report-chip" onClick={() => setPeriod(period)}>{period.label}</button>
                                ))}
                            </div>
                        ) : null}
                        {groupNames.length ? (
                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                {groupNames.map((name) => {
                                    const filters = grouped.filter((filter) => filter.group === name)
                                    const allOn = filters.every((filter) => values[filter.name])
                                    return (
                                        <div key={name} className="report-panel">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold">{name}</span>
                                                <button type="button" className="text-xs text-amber-600" onClick={() => setGroup(filters, !allOn)}>{allOn ? 'Clear all' : 'Select all'}</button>
                                            </div>
                                            <div className="grid sm:grid-cols-2 gap-2">
                                                {filters.map((filter) => (
                                                    <Checkbox key={filter.name} checked={!!values[filter.name]} onChange={(checked) => setValue(filter.name, checked)}>{filter.label}</Checkbox>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : null}
                        <div className="flex gap-3">
                            {!report.fileOnly ? (
                                <Button size="sm" icon={<HiEye />} type="button" loading={busy === 'preview'} disabled={!!busy} onClick={runPreview}>Preview</Button>
                            ) : null}
                            <Button size="sm" variant="solid" icon={<HiDownload />} type="button" loading={busy === 'download'} disabled={!!busy} onClick={download}>{report.downloadLabel || 'Download Excel'}</Button>
                        </div>
                    </FormContainer>
                ) : null}
            </AdaptableCard>

            {result ? (
                <AdaptableCard className="card-shadow" bodyClass="h-full">
                    {empty ? <p className="py-6 text-center text-gray-500">No data found for this report.</p> : null}
                    {!empty && result.sheets.length > 1 ? (
                        <Tabs value={sheet.name} onChange={setSheetName}>
                            <TabList className="mb-4">
                                {result.sheets.map((item) => <TabNav key={item.name} value={item.name}>{item.name}</TabNav>)}
                            </TabList>
                        </Tabs>
                    ) : null}
                    {!empty && sheet ? (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                                <div className="report-stat">
                                    <p className="text-xs text-gray-500">Rows</p>
                                    <p className="font-semibold text-gray-800 dark:text-gray-100">{sheet.total.toLocaleString('en-IN')}</p>
                                </div>
                                {stats.map((column) => (
                                    <div key={column.key} className="report-stat">
                                        <p className="text-xs text-gray-500">{column.header}</p>
                                        <p className={`font-semibold text-gray-800 dark:text-gray-100 ${sheet.totals[column.key] < 0 ? 'report-negative' : ''}`}>{formatNumber(sheet.totals[column.key], column)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                                <p className="text-sm text-gray-500">
                                    {sheet.total > sheet.shown
                                        ? `Showing the first ${sheet.shown.toLocaleString('en-IN')} of ${sheet.total.toLocaleString('en-IN')} rows. Download for all of them.${sheet.totals ? ' Totals cover every row.' : ''}`
                                        : `${sheet.total.toLocaleString('en-IN')} rows.`}
                                </p>
                                <Input
                                    size="sm"
                                    className="md:w-64"
                                    placeholder="Find in these rows"
                                    prefix={<HiSearch className="text-lg" />}
                                    value={rowSearch}
                                    onChange={(e) => setRowSearch(e.target.value)}
                                />
                            </div>
                            <div className="report-table-wrap">
                                <Table compact>
                                    <THead>
                                        <Tr>
                                            {sheet.columns.map((column) => (
                                                <Th key={column.key}>{column.header}</Th>
                                            ))}
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {rows.map((row, index) => (
                                            // eslint-disable-next-line react/no-array-index-key
                                            <Tr key={index}>
                                                {sheet.columns.map((column) => (
                                                    <Td key={column.key} className={`${column.type === 'money' || column.type === 'number' ? 'text-right' : ''} ${row[column.key] < 0 ? 'report-negative' : ''}`}>
                                                        {formatNumber(row[column.key], column)}
                                                    </Td>
                                                ))}
                                            </Tr>
                                        ))}
                                    </TBody>
                                    {sheet.totals || sheet.footer ? (
                                        <TFoot>
                                            {sheet.totals ? (
                                                <Tr>
                                                    {sheet.columns.map((column, index) => (
                                                        <Td key={column.key} className="text-right">
                                                            {sheet.totals[column.key] !== undefined ? formatNumber(sheet.totals[column.key], column) : index === 0 ? 'Total' : ''}
                                                        </Td>
                                                    ))}
                                                </Tr>
                                            ) : null}
                                            {(sheet.footer || []).map((item) => (
                                                <Tr key={item.label}>
                                                    {sheet.columns.map((column, index) => (
                                                        <Td key={column.key} className="text-right">
                                                            {column.key === item.key ? formatNumber(item.value, column) : index === 0 ? item.label : ''}
                                                        </Td>
                                                    ))}
                                                </Tr>
                                            ))}
                                        </TFoot>
                                    ) : null}
                                </Table>
                            </div>
                            {!rows.length ? <p className="py-4 text-center text-gray-500">No rows match this search.</p> : null}
                        </>
                    ) : null}
                </AdaptableCard>
            ) : null}
        </Loading>
    )
}

export default ReportViewer
