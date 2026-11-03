import React, { useCallback, useEffect, useRef, useState } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import Table from 'components/ui/Table'
import Select from 'components/ui/Select'
import Button from 'components/ui/Buttons'
import Spinner from 'components/ui/Spinner'
import { HiDownload, HiLockClosed } from 'react-icons/hi'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiEndOfMonthSalesDownload,
    apiEndOfMonthSalesFreeze,
    apiEndOfMonthSalesGet,
    apiEndOfMonthSalesReport,
} from 'services/EndOfMonthSalesService'

const { Tr, Th, Td, THead, TBody } = Table

// End of Month Sales (old PHP Freezed, freezed_details.php). Freezing a month locks its sales, sales returns and
// credit / debit notes so they can no longer be changed. Admin only. A freezed month's sales summary Excel is
// generated from here (old PHP Export::generate_sales_summary_report).

const notify = (message, type = 'danger') => {
    toast.push(
        <Notification title={type === 'success' ? 'Success' : 'Error'} type={type} closable>
            {message}
        </Notification>
    )
}

// Error message of a JSON or (for downloads) blob response
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

const formatDateTime = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (isNaN(date.getTime())) return ''
    const pad = (part) => (part < 10 ? `0${part}` : `${part}`)
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
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

const EndOfMonthSales = () => {
    const [year, setYear] = useState(new Date().getFullYear())
    const [years, setYears] = useState([])
    const [months, setMonths] = useState([])
    const [loading, setLoading] = useState(true)
    const [confirmMonth, setConfirmMonth] = useState(null)
    // The month being freezed, generated or downloaded; one action at a time
    const [busy, setBusy] = useState(null)
    const latestRequest = useRef(0)

    // quiet: refresh the rows without the loading spinner (after an action)
    const load = useCallback((selectedYear, quiet = false) => {
        const request = ++latestRequest.current
        if (!quiet) setLoading(true)
        apiEndOfMonthSalesGet(selectedYear)
            .then((res) => {
                // Ignore a slower answer for a year that is no longer selected
                if (request !== latestRequest.current) return
                setYears(res.data['years'] || [])
                setMonths(res.data['months'] || [])
            })
            .catch(async (error) => {
                if (request === latestRequest.current) notify(await errorMessage(error, 'Loading failed'))
            })
            .finally(() => {
                if (request === latestRequest.current) setLoading(false)
            })
    }, [])

    useEffect(() => {
        load(year)
    }, [year, load])

    const run = (action, month, request, onSuccess, fallback) => {
        setBusy({ action, month })
        request()
            .then(onSuccess)
            .catch(async (error) => notify(await errorMessage(error, fallback)))
            .finally(() => setBusy(null))
    }

    const freeze = () => {
        const month = confirmMonth
        setConfirmMonth(null)
        run('freeze', month, () => apiEndOfMonthSalesFreeze(year, month), (res) => {
            const d = res.data
            // e.g. "732 sales returns (all already locked)"; many old entries were already locked by the PHP ERP
            const part = (count, label) => {
                const { total = 0, locked = 0 } = count || {}
                if (!total) return `no ${label}`
                if (locked === total) return `${total} ${label}`
                return `${total} ${label} (${locked ? `${locked} newly locked, ${total - locked}` : 'all'} already locked)`
            }
            notify(`${d.message} This month has ${part(d.sales, 'sales')}, ${part(d.salesReturns, 'sales returns')} and ${part(d.creditDebitNotes, 'credit / debit notes')}.`, 'success')
            load(year, true)
        }, 'Freezing failed')
    }

    const generate = (month) => {
        run('generate', month, () => apiEndOfMonthSalesReport(year, month), (res) => {
            notify(res.data.message, 'success')
            setMonths((rows) => rows.map((row) => (row.month === month
                ? { ...row, report_name: res.data.report_name, report_local: true, report_url: null }
                : row)))
        }, 'Generating report failed')
    }

    const download = (row) => {
        run('download', row.month, () => apiEndOfMonthSalesDownload(year, row.month), (res) => {
            saveFile(res.data, row.report_name)
        }, 'Downloading report failed')
    }

    const isBusy = (action, month) => busy !== null && busy.action === action && busy.month === month
    const yearOptions = years.map((value) => ({ value, label: String(value) }))

    return (
        <AdaptableCard className="card-shadow">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">End of Month Sales</h3>
                <div className="w-48">
                    <Select
                        size="sm"
                        options={yearOptions}
                        isDisabled={busy !== null}
                        value={yearOptions.filter((option) => option.value === year)}
                        onChange={(option) => option && setYear(option.value)}
                    />
                </div>
            </div>
            <p className="mb-4 text-sm text-gray-500">
                Freezing a month locks its sales, sales returns and credit / debit notes; they can no longer be added, edited or deleted.
                Once freezed, generate the month&apos;s sales summary report and download it.
            </p>
            {loading ? (
                <div className="flex justify-center py-8"><Spinner size={32} /></div>
            ) : (
                <div className="overflow-x-auto">
                    <Table compact className="border">
                        <THead>
                            <Tr>
                                <Th className="text-center">Sr. No.</Th>
                                <Th>Freeze Month</Th>
                                <Th>Freezed Date</Th>
                                <Th>Freezed By</Th>
                                <Th className="text-center">Action</Th>
                                <Th className="text-center">Generate Report</Th>
                                <Th className="text-center">Download Report</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {months.length === 0 ? (
                                <Tr><Td colSpan={7} className="text-center">No months to freeze in this year yet</Td></Tr>
                            ) : months.map((row) => (
                                <Tr key={row.month}>
                                    <Td className="text-center">{row.month_no}</Td>
                                    <Td>{row.month}</Td>
                                    <Td>{formatDateTime(row.added_on)}</Td>
                                    <Td>{row.added_by}</Td>
                                    <Td className="text-center">
                                        {row.freezed ? (
                                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold"><HiLockClosed /> Freezed</span>
                                        ) : (
                                            <Button
                                                size="xs"
                                                variant="solid"
                                                loading={isBusy('freeze', row.month)}
                                                disabled={busy !== null}
                                                onClick={() => setConfirmMonth(row.month)}
                                            >
                                                Freeze
                                            </Button>
                                        )}
                                    </Td>
                                    <Td className="text-center">
                                        {row.freezed ? (
                                            <Button
                                                size="xs"
                                                variant="twoTone"
                                                loading={isBusy('generate', row.month)}
                                                disabled={busy !== null}
                                                onClick={() => generate(row.month)}
                                            >
                                                {isBusy('generate', row.month) ? 'Generating...' : (row.report_name ? 'Regenerate' : 'Generate')}
                                            </Button>
                                        ) : null}
                                    </Td>
                                    <Td className="text-center">
                                        {row.report_local ? (
                                            <Button
                                                size="sm"
                                                shape="circle"
                                                variant="twoTone"
                                                color="blue-600"
                                                title={row.report_name}
                                                icon={<HiDownload className="text-xl" />}
                                                loading={isBusy('download', row.month)}
                                                disabled={busy !== null}
                                                onClick={() => download(row)}
                                            />
                                        ) : row.report_url ? (
                                            <a href={row.report_url} target="_blank" rel="noreferrer" title={row.report_name} className="inline-flex text-indigo-600 text-xl">
                                                <Button
                                                    shape="circle"
                                                    size="sm"
                                                    variant="twoTone"
                                                    color="blue-600"
                                                    icon={<HiDownload />}
                                                    className="text-sm"
                                                />
                                            </a>
                                        ) : null}
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </div>
            )}
            <ConfirmDialog
                isOpen={confirmMonth !== null}
                closable={false}
                type="warning"
                title="Freeze Month"
                onClose={() => setConfirmMonth(null)}
                onRequestClose={() => setConfirmMonth(null)}
                onCancel={() => setConfirmMonth(null)}
                onConfirm={freeze}
            >
                <p>Are you sure you want to freeze {confirmMonth} {year}? This cannot be undone.</p>
            </ConfirmDialog>
        </AdaptableCard>
    )
}

export default EndOfMonthSales
