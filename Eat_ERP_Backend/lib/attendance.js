// How a day of attendance counts (old PHP Attendence_model). The list, the employee page, the Excel files and the mails
// all use this. PHP repeated the rules in six SQL statements and again, differently, in the page's JavaScript, so a
// single punch could show one figure on screen and be paid another.

const OFF_DAYS = ['WeeklyOff', 'Holiday'];
const FULL_DAY_MINUTES = 9 * 60;
const HALF_DAY_MINUTES = 4 * 60;
export const HALF = 0.5;

// '10:12' or '10:12:30' to minutes. PHP treats '', '0' and '00:00' as no punch.
export const toMinutes = (value) => {
  const match = String(value === null || value === undefined ? '' : value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const minutes = +match[1] * 60 + +match[2];
  return minutes > 0 ? minutes : null;
};

const pad = (value) => String(value).padStart(2, '0');
export const toTimeText = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

// Late mark H (half day): in after the employee's in time, or a day of between 4 and 9 hours.
// Weekly offs and holidays count as a day; absence, or under 4 hours, as none.
export const computeDay = ({ empStatus, inTime, outTime, lateAfter }) => {
  const status = String(empStatus || '').trim();
  const isOff = OFF_DAYS.includes(status);
  const isAbsent = status === 'Absent';
  const start = toMinutes(inTime);
  const end = toMinutes(outTime);
  const bothPunches = start !== null && end !== null;
  // A punch out before the punch in is the next morning
  const worked = bothPunches ? (end < start ? end + 1440 - start : end - start) : null;
  const effective = status === 'Present' && worked !== null ? worked : 0;
  const cameLate = start !== null && toMinutes(lateAfter) !== null && start > toMinutes(lateAfter);
  const shortDay = worked !== null && worked < FULL_DAY_MINUTES && worked > HALF_DAY_MINUTES;
  const lateMark = (cameLate || shortDay) && !isOff && !isAbsent ? 'H' : 'N';

  let dayValue = 1;
  if (lateMark === 'H') dayValue = HALF;
  else if (isAbsent || (!isOff && effective < HALF_DAY_MINUTES)) dayValue = 0;

  return {
    effective_time: isOff || isAbsent ? status : toTimeText(effective),
    effective_minutes: effective,
    late_mark: lateMark,
    day_value: dayValue
  };
};

const lastDay = (year, month) => new Date(year, month, 0).getDate();
const iso = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

// A month runs 1st to last day, or for a start day of 16, from the 16th before to the 15th. PHP treated every fourth
// year as leap in its own table of month ends.
export const periodOf = (startDay, year, month) => {
  const start = +startDay || 1;
  if (start === 1) return { from: iso(year, month, 1), to: iso(year, month, lastDay(year, month)) };
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  return { from: iso(previousYear, previousMonth, start), to: iso(year, month, start - 1) };
};

// PHP's month status: anything unsubmitted first, then waiting, then rejected. Blank status counted as Approved in PHP
export const monthStatus = (statuses) => {
  const values = statuses.map((status) => String(status || '').trim().toLowerCase());
  if (values.includes('')) return 'Pending';
  if (values.includes('pending')) return 'Pending For Approval';
  if (values.includes('rejected')) return 'Rejected';
  return 'Approved';
};
