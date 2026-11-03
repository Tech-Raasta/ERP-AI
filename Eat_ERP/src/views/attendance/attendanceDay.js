// How a day counts, so the page can show the result as times are typed. This mirrors lib/attendance.js on the server,
// which is what is saved; old PHP's page used different rules from its reports.

const OFF_DAYS = ['WeeklyOff', 'Holiday']

export const toMinutes = (value) => {
    const match = String(value === null || value === undefined ? '' : value).trim().match(/^(\d{1,2}):(\d{2})/)
    if (!match) return null
    const minutes = +match[1] * 60 + +match[2]
    return minutes > 0 ? minutes : null
}

const pad = (value) => String(value).padStart(2, '0')
export const toTimeText = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
// For a time box: a blank day has no time, and '0' from the file is not one
export const timeValue = (value) => {
    const minutes = toMinutes(value)
    return minutes === null ? '' : toTimeText(minutes)
}

export const computeDay = ({ empStatus, inTime, outTime, lateAfter }) => {
    const status = String(empStatus || '').trim()
    const isOff = OFF_DAYS.includes(status)
    const isAbsent = status === 'Absent'
    const start = toMinutes(inTime)
    const end = toMinutes(outTime)
    const bothPunches = start !== null && end !== null
    const worked = bothPunches ? (end < start ? end + 1440 - start : end - start) : null
    const effective = status === 'Present' && worked !== null ? worked : 0
    const cameLate = start !== null && toMinutes(lateAfter) !== null && start > toMinutes(lateAfter)
    const shortDay = worked !== null && worked < 540 && worked > 240
    const lateMark = (cameLate || shortDay) && !isOff && !isAbsent ? 'H' : 'N'
    let dayValue = 1
    if (lateMark === 'H') dayValue = 0.5
    else if (isAbsent || (!isOff && effective < 240)) dayValue = 0
    return {
        effective_time: isOff || isAbsent ? status : toTimeText(effective),
        late_mark: lateMark,
        day_value: dayValue,
    }
}
