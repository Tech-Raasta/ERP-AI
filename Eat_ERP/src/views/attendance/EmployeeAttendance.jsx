import React, { useEffect, useMemo, useState } from 'react'
import AdaptableCard from 'components/shared/AdaptableCard'
import Loading from 'components/shared/Loading'
import StickyFooter from 'components/shared/StickyFooter'
import ConfirmDialog from 'components/shared/ConfirmDialog'
import Button from 'components/ui/Buttons'
import Checkbox from 'components/ui/Checkbox'
import Input from 'components/ui/Input'
import Table from 'components/ui/Table'
import { useNavigate, useParams } from 'react-router-dom'
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import { apiAttendanceEmployee, apiAttendanceSave } from 'services/AttendanceService'
import { computeDay, timeValue } from './attendanceDay'

const { Tr, Th, Td, THead, TBody } = Table

// One employee's month (old PHP employee_detailed_attendence.php). The employee corrects their times and submits;
// a changed day goes for approval. An approver ticks days and approves or rejects them. Figures update as times are typed.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const showMessage = (message, type = 'danger') => {
    toast.push(
        <Notification title={type === 'success' ? 'Success' : 'Error'} type={type} closable>
            {message}
        </Notification>
    )
}

const dateText = (value) => String(value).split('-').reverse().join('-')
const isOffDay = (row) => row.emp_status === 'WeeklyOff' || row.emp_status === 'Holiday'
const changedFrom = (row) => timeValue(row.adjusted_in_time) !== timeValue(row.saved_in) || timeValue(row.adjusted_out_time) !== timeValue(row.saved_out)
const differsFromPunch = (row) => timeValue(row.first_in) !== timeValue(row.adjusted_in_time) || timeValue(row.last_out) !== timeValue(row.adjusted_out_time)

// A day given new times becomes Present when saved
const dayFigures = (row, lateAfter) => computeDay({
    empStatus: changedFrom(row) && !isOffDay(row) && (row.adjusted_in_time || row.adjusted_out_time) ? 'Present' : row.emp_status,
    inTime: row.adjusted_in_time,
    outTime: row.adjusted_out_time,
    lateAfter,
})

const rowClass = (row) => {
    if (row.status === 'rejected') return 'bg-red-50 dark:bg-gray-700'
    if (changedFrom(row) || (row.status === 'pending' && differsFromPunch(row))) return 'bg-amber-50 dark:bg-gray-700'
    if (row.status === 'approved' && differsFromPunch(row)) return 'bg-blue-50 dark:bg-gray-700'
    return ''
}

const EmployeeAttendance = () => {
    const { empNo, year, month } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [summary, setSummary] = useState(null)
    const [inTime, setInTime] = useState('')
    const [rows, setRows] = useState([])
    const [permissions, setPermissions] = useState({ approve: false })
    const [busy, setBusy] = useState(false)
    const [confirm, setConfirm] = useState(false)
    const [missing, setMissing] = useState('')

    const load = () => {
        setLoading(true)
        setMissing('')
        apiAttendanceEmployee(empNo, year, month)
            .then((res) => {
                setSummary(res.data.summary)
                setInTime(res.data.in_time)
                setPermissions(res.data.permissions)
                setRows(res.data.rows.map((row) => ({
                    ...row,
                    adjusted_in_time: timeValue(row.adjusted_in_time),
                    adjusted_out_time: timeValue(row.adjusted_out_time),
                    saved_in: row.adjusted_in_time,
                    saved_out: row.adjusted_out_time,
                    checked: false,
                })))
            })
            .catch((error) => {
                const message = error && error.response ? error.response.data['message'] : 'Fetching attendance failed'
                setSummary(null)
                setRows([])
                setMissing(message)
            })
            .finally(() => setLoading(false))
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [empNo, year, month])

    const figures = (row) => dayFigures(row, inTime)
    const totals = useMemo(() => ({
        system: rows.reduce((sum, row) => sum + row.system.day_value, 0),
        entered: rows.reduce((sum, row) => sum + dayFigures(row, inTime).day_value, 0),
    }), [rows, inTime])

    const setRow = (id, change) => setRows((prev) => prev.map((row) => (row.emp_id === id ? { ...row, ...change } : row)))
    const allChecked = rows.length > 0 && rows.every((row) => row.checked)
    const anyChecked = rows.some((row) => row.checked)
    const changedCount = rows.filter(changedFrom).length

    const goMonth = (step) => {
        const date = new Date(+year, +month - 1 + step, 1)
        navigate(`/attendance/employee/${encodeURIComponent(empNo)}/${date.getFullYear()}/${date.getMonth() + 1}`)
    }

    const save = (action) => {
        setConfirm(false)
        setBusy(true)
        apiAttendanceSave(empNo, {
            year,
            month,
            action,
            rows: rows.map(({ emp_id: id, adjusted_in_time: inValue, adjusted_out_time: outValue, remark, checked }) => ({
                emp_id: id, adjusted_in_time: inValue, adjusted_out_time: outValue, remark, checked,
            })),
        })
            .then((res) => {
                showMessage(res.data['message'], 'success')
                load()
            })
            .catch((error) => showMessage(error && error.response ? error.response.data['message'] : 'Saving attendance failed'))
            .finally(() => setBusy(false))
    }

    const heading = `${MONTHS[+month - 1]} ${year}`

    return (
        <Loading loading={loading}>
            <AdaptableCard className="mb-4 card-shadow" divider>
                <div className="lg:flex items-center justify-between">
                    <div>
                        <h4 className="mb-1">{summary ? summary.emp_name : empNo}</h4>
                        {summary ? (
                            <p className="text-gray-500">
                                {summary.emp_no}{summary.department ? ` / ${summary.department}` : ''} / {dateText(summary.from)} to {dateText(summary.to)}
                                {inTime ? ` / In time ${inTime}` : ''} / <span className="font-semibold">{summary.status}</span>
                            </p>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-3 lg:mt-0">
                        <Button size="sm" shape="circle" icon={<HiChevronLeft />} title="Previous month" onClick={() => goMonth(-1)} />
                        <span className="font-semibold w-36 text-center">{heading}</span>
                        <Button size="sm" shape="circle" icon={<HiChevronRight />} title="Next month" onClick={() => goMonth(1)} />
                    </div>
                </div>
            </AdaptableCard>

            {missing ? <AdaptableCard className="card-shadow"><p className="py-6 text-center text-gray-500">{missing}</p></AdaptableCard> : null}

            {rows.length ? (
                <AdaptableCard className="mb-4 card-shadow">
                    <div className="flex flex-wrap gap-6 mb-3">
                        <span>As recorded: <b>{totals.system}</b> days</span>
                        <span>After corrections: <b>{totals.entered}</b> days</span>
                        {changedCount ? <span className="text-amber-600">{changedCount} unsaved change{changedCount === 1 ? '' : 's'}</span> : null}
                    </div>
                    <div className="overflow-auto" style={{ maxHeight: '65vh' }}>
                        <Table compact className="border">
                            <THead>
                                <Tr>
                                    {permissions.approve ? (
                                        <Th className="sticky top-0 z-10 bg-white dark:bg-gray-800">
                                            <Checkbox checked={allChecked} onChange={(checked) => setRows((prev) => prev.map((row) => ({ ...row, checked })))} />
                                        </Th>
                                    ) : null}
                                    {['Date', 'Punch In', 'Punch Out', 'Status', 'Effective', 'Late', 'Count', 'Corrected In', 'Corrected Out', 'Remark', 'Effective', 'Late', 'Count', 'Approval'].map((title, index) => (
                                        // eslint-disable-next-line react/no-array-index-key
                                        <Th key={index} className="sticky top-0 z-10 bg-white dark:bg-gray-800 whitespace-nowrap">{title}</Th>
                                    ))}
                                </Tr>
                            </THead>
                            <TBody>
                                {rows.map((row) => {
                                    const entered = figures(row)
                                    const locked = isOffDay(row)
                                    return (
                                        <Tr key={row.emp_id} className={rowClass(row)}>
                                            {permissions.approve ? <Td><Checkbox checked={row.checked} onChange={(checked) => setRow(row.emp_id, { checked })} /></Td> : null}
                                            <Td className="whitespace-nowrap">{dateText(row.date)}</Td>
                                            <Td>{timeValue(row.first_in)}</Td>
                                            <Td>{timeValue(row.last_out)}</Td>
                                            <Td>{row.emp_status}</Td>
                                            <Td>{row.system.effective_time}</Td>
                                            <Td>{row.system.late_mark}</Td>
                                            <Td>{row.system.day_value}</Td>
                                            <Td><Input size="sm" type="time" disabled={locked} value={row.adjusted_in_time} onChange={(e) => setRow(row.emp_id, { adjusted_in_time: e.target.value })} /></Td>
                                            <Td><Input size="sm" type="time" disabled={locked} value={row.adjusted_out_time} onChange={(e) => setRow(row.emp_id, { adjusted_out_time: e.target.value })} /></Td>
                                            <Td style={{ minWidth: 180 }}><Input size="sm" value={row.remark} onChange={(e) => setRow(row.emp_id, { remark: e.target.value })} /></Td>
                                            <Td>{entered.effective_time}</Td>
                                            <Td>{entered.late_mark}</Td>
                                            <Td>{entered.day_value}</Td>
                                            <Td className="capitalize">{row.status}</Td>
                                        </Tr>
                                    )
                                })}
                            </TBody>
                        </Table>
                    </div>
                </AdaptableCard>
            ) : null}

            <StickyFooter className="-mx-8 px-8 flex items-center justify-end py-4" stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                <Button size="sm" className="ltr:mr-3" onClick={() => navigate('/attendance')}>Back</Button>
                {rows.length && permissions.approve ? (
                    <>
                        <Button size="sm" className="ltr:mr-3" variant="solid" color="red-600" disabled={busy || !anyChecked} onClick={() => setConfirm(true)}>Reject</Button>
                        <Button size="sm" className="ltr:mr-3" variant="solid" color="emerald-600" loading={busy} disabled={!anyChecked} onClick={() => save('approve')}>Approve</Button>
                    </>
                ) : null}
                {rows.length ? <Button size="sm" variant="solid" loading={busy} onClick={() => save('submit')}>Submit For Approval</Button> : null}
            </StickyFooter>
            <ConfirmDialog
                isOpen={confirm}
                closable={false}
                type="danger"
                title="Reject Days"
                onClose={() => setConfirm(false)}
                onRequestClose={() => setConfirm(false)}
                onCancel={() => setConfirm(false)}
                onConfirm={() => save('reject')}
            >
                <p>Reject the ticked days? Add the reason in each day&apos;s remark first.</p>
            </ConfirmDialog>
        </Loading>
    )
}

export default EmployeeAttendance
