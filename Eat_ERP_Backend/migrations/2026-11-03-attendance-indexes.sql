-- Eat Attendance: employee_attendence is read by month and by employee, and has no index but its primary key
ALTER TABLE employee_attendence ADD INDEX idx_attendance_date (date);
ALTER TABLE employee_attendence ADD INDEX idx_attendance_employee_date (emp_no, date);
