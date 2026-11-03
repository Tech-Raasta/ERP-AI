import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../lib/database.js';
import sendEmail from '../lib/email.js';
import { select, execute, text, insertRow, toDate } from './sales.js';
import { USER_ADMIN_ROLES } from '../models/user.js';
import { loadWorkbook, cellValue, isEmptyRow, parseDate } from '../lib/excelUpload.js';
import { computeDay, periodOf, monthStatus, toMinutes, toTimeText } from '../lib/attendance.js';
import { writeExcel } from '../lib/reports/engine.js';
import { escapeHtml } from '../lib/salesPrint.js';

// Eat Attendance (old PHP Eat_Attendence). Attendance comes from the Keka file; employees correct their times, and a
// manager approves. Everyone logged in can see their own month and those of people who report to them. Seeing everyone,
// uploading, approving and downloading come from the 'Attendance' role section (Admin and Super Admin always); PHP had
// five email addresses written into the code.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_PATH = path.join(__dirname, '..', 'assets', 'uploads', 'attendance_upload');
const FROM_EMAIL = process.env.MAIL_EMAIL;
const COLUMNS = { emp_no: 'A', emp_name: 'B', job_title: 'C', department: 'D', location: 'E', date: 'F', first_in: 'H', last_out: 'K', emp_status: 'M', effective_hour: 'N', gross_hour: 'O' };
const FIRST_ROW = 4; // The Keka file has a title and headers above this
const STATUSES = ['Pending', 'Pending For Approval', 'Approved', 'Rejected'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const accessOf = async (req) => {
  const roleId = +req.userData.userRoleId;
  const [[user], [rights]] = await Promise.all([
    select(`select id, emp_code, email_id from user_master where id = :id`, { id: req.userData.userId }),
    select(`select r_view, r_insert, r_approvals, r_export from user_role_options where role_id = :roleId and section = 'Attendance'`, { roleId })
  ]);
  const admin = USER_ADMIN_ROLES.includes(roleId);
  const has = (right) => admin || !!(rights && +rights[right]);
  const email = text(user && user.email_id);
  const team = email
    ? await select(`select emp_code from user_master where (email_id = :email or email_id2 = :email) and ifnull(emp_code, '') <> ''`, { email })
    : [];
  return {
    all: has('r_view'),
    upload: has('r_insert'),
    approve: has('r_approvals'),
    download: has('r_export'),
    empCodes: [...new Set([text(user && user.emp_code), ...team.map((row) => text(row.emp_code))].filter(Boolean))]
  };
};
const canSee = (access, empNo) => access.all || access.empCodes.includes(empNo);

const readPeriod = (source) => {
  const now = new Date();
  const year = +source.year || now.getFullYear();
  const month = +source.month || now.getMonth() + 1;
  return { year, month: Math.min(Math.max(month, 1), 12) };
};

// One user per employee code: PHP joined every user of a code, doubling the days of the 2 codes that have two
const employeeUsers = async () => {
  const rows = await select(
    `select emp_code, email_id, email_id2, in_time, start_day from user_master where ifnull(emp_code, '') <> '' order by emp_code, sales_rep_id`
  );
  const users = new Map();
  rows.forEach((row) => {
    if (!users.has(row.emp_code)) users.set(row.emp_code, row);
  });
  return users;
};

// The day as the system recorded it, and as the employee has corrected it
const dayFigures = (row, user) => {
  const lateAfter = user ? user.in_time : null;
  return {
    system: computeDay({ empStatus: row.emp_status, inTime: row.first_in, outTime: row.last_out, lateAfter }),
    adjusted: computeDay({ empStatus: row.emp_status, inTime: row.adjusted_in_time, outTime: row.adjusted_out_time, lateAfter })
  };
};

// Every employee's days in their own month. An employee with no user is taken as a calendar month; PHP left them out of
// the list altogether (95 of the codes in the file).
const loadMonth = async (year, month, empNo) => {
  const users = await employeeUsers();
  const earliest = periodOf(16, year, month).from;
  const latest = periodOf(1, year, month).to;
  const rows = await select(
    `select * from employee_attendence where date >= :earliest and date <= :latest and ifnull(emp_no, '') <> ''
     ${empNo ? 'and emp_no = :empNo' : ''} order by emp_no, date`,
    { earliest, latest, empNo }
  );
  const employees = new Map();
  rows.forEach((row) => {
    const user = users.get(row.emp_no);
    const period = periodOf(user ? user.start_day : 1, year, month);
    const date = toDate(row.date);
    if (date < period.from || date > period.to) return;
    if (!employees.has(row.emp_no)) employees.set(row.emp_no, { emp_no: row.emp_no, emp_name: row.emp_name, department: row.department, user, period, days: [] });
    employees.get(row.emp_no).days.push({ ...row, date, ...dayFigures(row, user) });
  });
  return employees;
};

const summarise = (employee) => {
  const count = (status) => employee.days.filter((day) => day.emp_status === status).length;
  return {
    emp_no: employee.emp_no,
    emp_name: employee.emp_name,
    department: employee.department,
    from: employee.period.from,
    to: employee.period.to,
    total_days: employee.days.reduce((sum, day) => sum + day.adjusted.day_value, 0),
    system_days: employee.days.reduce((sum, day) => sum + day.system.day_value, 0),
    no_of_holiday: count('Holiday'),
    weekly_off: count('WeeklyOff'),
    no_of_leave: count('Absent'),
    status: monthStatus(employee.days.map((day) => day.status))
  };
};

const failure = (error, req, res, next, message) => {
  res.statusCode = 500;
  res.message = message;
  next(error, req, res);
};

// ---------- List ----------

export const getAttendance = async (req, res, next) => {
  try {
    const access = await accessOf(req);
    const { year, month } = readPeriod(req.query);
    const query = text(req.query.query).toLowerCase();
    const status = STATUSES.includes(text(req.query.status)) ? text(req.query.status) : '';
    const pageSize = Math.min(Math.max(+req.query.pageSize || 10, 1), 500);
    const pageIndex = Math.max(+req.query.pageIndex || 0, 0);
    const employees = [...(await loadMonth(year, month)).values()]
      .filter((employee) => canSee(access, employee.emp_no))
      .map(summarise)
      .filter((row) => !query || `${row.emp_no} ${row.emp_name} ${row.department}`.toLowerCase().includes(query))
      .sort((a, b) => text(a.emp_name).localeCompare(text(b.emp_name)));
    const statusCount = Object.fromEntries(STATUSES.map((value) => [value, employees.filter((row) => row.status === value).length]));
    const rows = status ? employees.filter((row) => row.status === status) : employees;
    res.status(200).json({
      total: rows.length,
      rows: rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
      statusCount: { ...statusCount, all: employees.length },
      permissions: { upload: access.upload, approve: access.approve, download: access.download }
    });
  } catch (error) {
    failure(error, req, res, next, "Fetching attendance failed!");
  }
};

// ---------- One employee's month ----------

const dayRow = (day) => ({
  emp_id: day.emp_id,
  date: day.date,
  first_in: text(day.first_in),
  last_out: text(day.last_out),
  emp_status: day.emp_status,
  adjusted_in_time: text(day.adjusted_in_time),
  adjusted_out_time: text(day.adjusted_out_time),
  remark: text(day.remark),
  status: text(day.status),
  system: day.system,
  adjusted: day.adjusted
});

export const getEmployeeAttendance = async (req, res, next) => {
  try {
    const access = await accessOf(req);
    const empNo = text(req.params.empNo);
    if (!canSee(access, empNo)) {
      return res.status(401).json({ message: "You can only see your own attendance and your team's." });
    }
    const { year, month } = readPeriod(req.query);
    const employee = (await loadMonth(year, month, empNo)).get(empNo);
    if (!employee) {
      return res.status(404).json({ message: `No attendance found for ${MONTHS[month - 1]} ${year}.` });
    }
    res.status(200).json({
      summary: summarise(employee),
      in_time: employee.user ? text(employee.user.in_time) : '',
      rows: employee.days.map(dayRow),
      permissions: { approve: access.approve }
    });
  } catch (error) {
    failure(error, req, res, next, "Fetching attendance failed!");
  }
};

// ---------- Save, approve, reject ----------

const cleanTime = (value) => {
  const minutes = toMinutes(value);
  return minutes === null ? '' : toTimeText(minutes);
};

const mailTable = (employee) => {
  const total = employee.days.reduce((sum, day) => sum + day.adjusted.day_value, 0);
  const cell = (value) => `<td style="border:1px solid #ddd;padding:8px">${escapeHtml(text(value))}</td>`;
  const head = ['Date', 'Punch In', 'Punch Out', 'Effective Time', 'Late Marks', 'Adjusted Time']
    .map((title) => `<th style="padding:12px 8px;text-align:left;background:#000;color:#fff">${title}</th>`).join('');
  const rows = employee.days.map((day) => `<tr>${cell(day.date)}${cell(day.adjusted_in_time)}${cell(day.adjusted_out_time)}${cell(day.adjusted.effective_time)}${cell(day.adjusted.late_mark)}${cell(day.adjusted.day_value)}</tr>`).join('');
  return `<table style="font-family:Arial,Helvetica,sans-serif;border-collapse:collapse;width:100%"><tr>${head}</tr>
    <tr>${cell('')}${cell('')}${cell('')}${cell('')}${cell('Total Days')}${cell(total)}</tr>${rows}</table>`;
};

const mailMonth = async (employee, year, month, approved) => {
  const to = [employee.user && employee.user.email_id, employee.user && employee.user.email_id2].map(text).filter(Boolean);
  if (!to.length) return false;
  await sendEmail({
    from: FROM_EMAIL,
    to: to.join(','),
    subject: `${employee.emp_name} Attendance For Month - ${MONTHS[month - 1]} ${year}${approved ? ' - Approved' : ''}`,
    html: mailTable(employee)
  });
  return true;
};

export const saveEmployeeAttendance = async (req, res, next) => {
  try {
    const access = await accessOf(req);
    const empNo = text(req.params.empNo);
    if (!canSee(access, empNo)) {
      return res.status(401).json({ message: "You can only change your own attendance and your team's." });
    }
    const body = req.body || {};
    const action = text(body.action);
    if (!['submit', 'approve', 'reject'].includes(action)) {
      return res.status(422).json({ message: "Choose what to do with this attendance." });
    }
    if (action !== 'submit' && !access.approve) {
      return res.status(401).json({ message: "You cannot approve attendance." });
    }
    const { year, month } = readPeriod(body);
    const employee = (await loadMonth(year, month, empNo)).get(empNo);
    if (!employee) {
      return res.status(404).json({ message: `No attendance found for ${MONTHS[month - 1]} ${year}.` });
    }
    const days = new Map(employee.days.map((day) => [+day.emp_id, day]));
    const posted = (Array.isArray(body.rows) ? body.rows : []).filter((row) => days.has(+row.emp_id));
    if (!posted.length) {
      return res.status(422).json({ message: "Nothing to save." });
    }
    if (action !== 'submit' && !posted.some((row) => row.checked)) {
      return res.status(422).json({ message: `Tick the days to ${action}.` });
    }
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    let changed = 0;
    try {
      for (const row of posted) {
        const day = days.get(+row.emp_id);
        const isOff = day.emp_status === 'WeeklyOff' || day.emp_status === 'Holiday';
        const inTime = isOff ? text(day.adjusted_in_time) : cleanTime(row.adjusted_in_time);
        const outTime = isOff ? text(day.adjusted_out_time) : cleanTime(row.adjusted_out_time);
        const timesChanged = cleanTime(day.adjusted_in_time) !== cleanTime(inTime) || cleanTime(day.adjusted_out_time) !== cleanTime(outTime);
        const remark = text(row.remark).substring(0, 1000);
        // A changed day goes for approval unless it is being approved now
        let status = timesChanged ? 'pending' : day.status;
        if (action === 'approve' && row.checked) status = 'approved';
        if (action === 'reject' && row.checked) status = 'rejected';
        if (status === day.status && !timesChanged && remark === text(day.remark)) continue;
        const present = timesChanged && (inTime || outTime) && !isOff;
        await execute(
          `update employee_attendence set adjusted_in_time = :inTime, adjusted_out_time = :outTime, remark = :remark, status = :status,
             emp_status = :empStatus, modified_by = :userId, modified_on = :now where emp_id = :empId`,
          { inTime, outTime, remark, status, empStatus: present ? 'Present' : day.emp_status, userId, now, empId: day.emp_id }, t
        );
        changed += 1;
      }
      await t.commit();
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
    let mailed = false;
    if (action === 'approve') {
      // PHP mailed the approved month once nothing was pending or rejected
      const fresh = (await loadMonth(year, month, empNo)).get(empNo);
      if (fresh && monthStatus(fresh.days.map((day) => day.status)) === 'Approved') {
        // The approval stands if the mail fails
        mailed = await mailMonth(fresh, year, month, true).catch(() => false);
      }
    }
    const done = { submit: 'Attendance submitted for approval', approve: 'Attendance approved', reject: 'Attendance rejected' }[action];
    res.status(200).json({ message: changed ? `${done}! (${changed} day${changed === 1 ? '' : 's'})` : "Nothing had changed.", changed, mailed });
  } catch (error) {
    failure(error, req, res, next, "Saving attendance failed!");
  }
};

// ---------- Keka upload ----------

const timeOf = (value) => {
  if (value instanceof Date) return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
  const time = text(value);
  return !time || time === 'NA' ? '0' : time;
};

export const uploadAttendance = async (req, res, next) => {
  const filePath = req.file && req.file.path;
  try {
    const access = await accessOf(req);
    if (!access.upload) {
      return res.status(401).json({ message: "You cannot upload attendance." });
    }
    if (!filePath) {
      return res.status(422).json({ message: "Choose the Keka attendance file." });
    }
    const workbook = await loadWorkbook(await fs.promises.readFile(filePath));
    const sheet = workbook.worksheets[0];
    const seen = new Set();
    const rows = [];
    const errors = [];
    for (let number = FIRST_ROW; number <= sheet.rowCount; number += 1) {
      const row = sheet.getRow(number);
      if (isEmptyRow(row, 15)) continue;
      const read = (key) => cellValue(row.getCell(COLUMNS[key]));
      const empNo = text(read('emp_no'));
      if (!empNo) continue;
      const date = parseDate(read('date'));
      if (!date) {
        errors.push(`Row ${number}: the date is not valid.`);
        continue;
      }
      const key = `${empNo}|${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        emp_no: empNo,
        emp_name: text(read('emp_name')),
        job_title: text(read('job_title')),
        department: text(read('department')),
        location: text(read('location')),
        date,
        first_in: timeOf(read('first_in')),
        last_out: timeOf(read('last_out')),
        emp_status: text(read('emp_status')),
        effective_hour: text(read('effective_hour')),
        gross_hour: text(read('gross_hour'))
      });
    }
    if (!rows.length) {
      return res.status(422).json({ message: errors[0] || "No attendance found in this file. Attendance starts on row 4 of the Keka file." });
    }
    const dates = rows.map((row) => row.date).sort();
    const existing = await select(
      `select emp_id, emp_no, date, is_sales, status, first_in, last_out, adjusted_in_time, adjusted_out_time
       from employee_attendence where date >= :from and date <= :to`,
      { from: dates[0], to: dates[dates.length - 1] }
    );
    const known = new Map(existing.map((row) => [`${row.emp_no}|${toDate(row.date)}`, row]));
    const userId = req.userData.userId;
    const now = new Date();
    const counts = { added: 0, updated: 0, kept: 0, sales: 0 };
    const t = await sequelize.transaction();
    try {
      for (const row of rows) {
        const found = known.get(`${row.emp_no}|${row.date}`);
        if (!found) {
          await insertRow('employee_attendence', {
            ...row, adjusted_in_time: row.first_in, adjusted_out_time: row.last_out, is_sales: 0,
            created_by: userId, created_on: now, modified_by: userId, modified_on: now
          }, t);
          counts.added += 1;
        } else if (+found.is_sales === 1) {
          // Sales staff punch in the app: the file only refreshes their details
          await execute(
            `update employee_attendence set emp_name = :emp_name, job_title = :job_title, department = :department, location = :location where emp_id = :emp_id`,
            { ...row, emp_id: found.emp_id }, t
          );
          counts.sales += 1;
        } else {
          // PHP overwrote the corrected times here, so uploading the file again wiped what managers had approved
          const corrected = text(found.status) !== '' || text(found.adjusted_in_time) !== text(found.first_in) || text(found.adjusted_out_time) !== text(found.last_out);
          await execute(
            `update employee_attendence set emp_name = :emp_name, job_title = :job_title, department = :department, location = :location,
               first_in = :first_in, last_out = :last_out, effective_hour = :effective_hour, gross_hour = :gross_hour,
               ${corrected ? '' : 'adjusted_in_time = :first_in, adjusted_out_time = :last_out, emp_status = :emp_status,'}
               modified_by = :userId, modified_on = :now where emp_id = :emp_id`,
            { ...row, userId, now, emp_id: found.emp_id }, t
          );
          if (corrected) counts.kept += 1; else counts.updated += 1;
        }
      }
      await t.commit();
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
    res.status(200).json({
      message: `Attendance uploaded: ${counts.added} added, ${counts.updated} updated, ${counts.kept} with corrections kept.`,
      ...counts,
      errors: errors.slice(0, 20)
    });
  } catch (error) {
    failure(error, req, res, next, "Uploading attendance failed!");
  } finally {
    if (filePath) fs.promises.unlink(filePath).catch(() => {});
  }
  return undefined;
};

// ---------- Downloads and mail ----------

const text2 = (key, header, width) => ({ key, header, width });
const number = (key, header) => ({ key, header, type: 'number' });

export const downloadAttendance = async (req, res, next) => {
  try {
    const access = await accessOf(req);
    if (!access.download) {
      return res.status(401).json({ message: "You cannot download attendance." });
    }
    const kind = text(req.params.kind);
    if (!['system', 'approved', 'summary'].includes(kind)) {
      return res.status(404).json({ message: "Download not found!" });
    }
    const { year, month } = readPeriod(req.body || {});
    const label = `${MONTHS[month - 1]} ${year}`;
    let employees = [...(await loadMonth(year, month)).values()];
    if (kind !== 'system') employees = employees.filter((employee) => monthStatus(employee.days.map((day) => day.status)) === 'Approved');
    if (!employees.length) {
      return res.status(422).json({ message: `No ${kind === 'system' ? '' : 'approved '}attendance found for ${label}.` });
    }
    let sheet;
    if (kind === 'summary') {
      sheet = {
        name: 'Summary',
        columns: [text2('emp_no', 'Employee Code', 16), text2('emp_name', 'Employee Name', 30), number('total_days', 'Total Count'), number('no_of_holiday', 'Total Holiday'),
          number('weekly_off', 'Total WeeklyOff'), number('no_of_leave', 'Total Leaves')],
        rows: employees.map(summarise)
      };
    } else {
      const source = kind === 'approved' ? 'adjusted' : 'system';
      sheet = {
        name: 'Attendance',
        columns: [text2('emp_no', 'Employee Number', 16), text2('emp_name', 'Employee Name', 30), { key: 'date', header: 'Date', type: 'date' }, text2('in_time', 'First In', 10), text2('out_time', 'Last Out', 10),
          text2('emp_status', 'Status', 12), text2('effective_time', 'Effective Time', 14), text2('late_mark', 'Late Marks', 10), number('day_value', 'Adjusted Counts'),
          number('month_total', 'Attendance Counts'), text2('remark', 'Remarks', 34)],
        rows: employees.flatMap((employee) => {
          const total = employee.days.reduce((sum, day) => sum + day[source].day_value, 0);
          return employee.days.map((day, index) => ({
            emp_no: day.emp_no,
            emp_name: day.emp_name,
            date: day.date,
            in_time: kind === 'approved' ? day.adjusted_in_time : day.first_in,
            out_time: kind === 'approved' ? day.adjusted_out_time : day.last_out,
            emp_status: day.emp_status,
            effective_time: day[source].effective_time,
            late_mark: day[source].late_mark,
            day_value: day[source].day_value,
            month_total: index === 0 ? total : null,
            remark: day.remark
          }));
        })
      };
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Attendance_${kind}_${MONTHS[month - 1]}_${year}.xlsx"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    await writeExcel({ name: `Attendance For ${label}` }, { filters: {} }, { sheets: [sheet] }, res);
  } catch (error) {
    if (res.headersSent) return res.destroy(error);
    failure(error, req, res, next, "Downloading attendance failed!");
  }
  return undefined;
};

// Old PHP send_bulk_mail: each employee's month, to them and their manager
export const mailAttendance = async (req, res, next) => {
  try {
    const access = await accessOf(req);
    if (!access.approve) {
      return res.status(401).json({ message: "You cannot send attendance mail." });
    }
    const { year, month } = readPeriod(req.body || {});
    const employees = [...(await loadMonth(year, month)).values()];
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const employee of employees) {
      try {
        if (await mailMonth(employee, year, month, false)) sent += 1; else skipped += 1;
      } catch (error) {
        failed += 1;
      }
    }
    res.status(200).json({ message: `Mail sent to ${sent} employees${skipped ? `, ${skipped} have no email` : ''}${failed ? `, ${failed} failed` : ''}.`, sent, skipped, failed });
  } catch (error) {
    failure(error, req, res, next, "Sending attendance mail failed!");
  }
};
