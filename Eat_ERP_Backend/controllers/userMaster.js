import { select, invalid, text, insertRow, updateRow } from './sales.js';

// User (old PHP User / User_model): the people who log in, with their role and depots. Users are not deleted: they are
// set InActive (Status), which stops their login. Access: the User role section.
// Passwords never leave the server here: PHP kept the password in a hidden field of the form. A new user starts on
// the default password and is asked to change it at first login; editing a user does not touch it.

const DEFAULT_PASSWORD = 'pass@123';
const DEFAULT_IN_TIME = '11:00';
const STATUSES = ['Approved', 'InActive'];
const NAME = /^[a-z][a-z .'-]*$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^[0-9]{10}$/;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

const STATUS_FILTERS = {
  approved: `A.status = 'Approved'`,
  inactive: `A.status = 'InActive'`,
  all: '1 = 1'
};

// Every column the screens use; never the password
const COLUMNS = `A.id, A.first_name, A.middle_name, A.last_name, A.email_id, A.mobile, A.emp_code, A.in_time, A.role_id,
  A.status, A.remarks, A.depot_ids`;

const roleDetails = (req) => req.userData.roleDetails || {};
const fullName = (row) => [row.first_name, row.middle_name, row.last_name].map(text).filter(Boolean).join(' ');
const depotList = (value) => text(value).split(',').map((id) => +id).filter(Boolean);

const findUser = async (id) => (await select(
  `select ${COLUMNS}, B.role_name from user_master A left join user_role_master B on (A.role_id = B.id) where A.id = :id`,
  { id }
))[0] || null;

// Old PHP checkstatus: tabs Approved (Active) and InActive
export const getUsers = async (req, res, next) => {
  try {
    const status = STATUS_FILTERS[text(req.query.status)] ? text(req.query.status) : 'approved';
    const pageSize = Math.min(Math.max(+req.query.pageSize || 10, 1), 500);
    const pageIndex = Math.max(+req.query.pageIndex || 0, 0);
    const query = text(req.query.query);
    const replacements = { search: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };
    const search = query
      ? `and (concat_ws(' ', A.first_name, A.middle_name, A.last_name) like :search or A.email_id like :search or A.mobile like :search
           or A.emp_code like :search or B.role_name like :search)`
      : '';
    const from = `from user_master A left join user_role_master B on (A.role_id = B.id) where ${STATUS_FILTERS[status]} ${search}`;
    const [[count], rows, [counts]] = await Promise.all([
      select(`select count(*) as total ${from}`, replacements),
      select(`select ${COLUMNS}, B.role_name ${from} order by A.modified_on desc, A.id desc limit :limit offset :offset`, replacements),
      select(`select count(*) as all_count, sum(status = 'Approved') as approved, sum(status = 'InActive') as inactive from user_master`)
    ]);
    res.status(200).json({
      total: +count.total || 0,
      rows: rows.map((row) => ({ ...row, name: fullName(row) })),
      statusCount: { approved: +counts.approved || 0, inactive: +counts.inactive || 0, all: +counts.all_count || 0 },
      action: { insert: !!roleDetails(req).r_insert }
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching users failed!";
    next(error, req, res);
  }
};

// Old PHP add / edit: roles (Approved or Active) and approved depots
export const getMasterData = async (req, res, next) => {
  try {
    const [roles, depots] = await Promise.all([
      select(`select id, role_name from user_role_master where status = 'Approved' or status = 'Active' order by role_name`),
      select(`select id, depot_name from depot_master where status = 'Approved' order by depot_name`)
    ]);
    res.status(200).json({ roles, depots, action: { insert: !!roleDetails(req).r_insert } });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching user master data failed!";
    next(error, req, res);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await findUser(+req.params.id || 0);
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }
    res.status(200).json({
      user: { ...user, depot_ids: depotList(user.depot_ids) },
      permissions: { submit: !!roleDetails(req).r_edit, self: +user.id === +req.userData.userId }
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching user failed!";
    next(error, req, res);
  }
};

// Old PHP validations.js form_user_details. Many existing users do not meet these (a full name in First Name, no last
// name or mobile, shared emails), so on an edit a rule applies only to a field that is being changed; PHP refused to
// save them at all.
const buildUser = async (req, existing) => {
  const body = req.body || {};
  const errors = {};
  const addError = (key, message) => {
    if (!errors[key]) errors[key] = { message };
  };
  const value = (key) => text(body[key]);
  const changed = (key) => !existing || value(key) !== text(existing[key]);

  if (changed('first_name')) {
    if (!value('first_name')) addError('first_name', 'First name is required.');
    else if (!NAME.test(value('first_name'))) addError('first_name', 'First name should have letters only.');
  }
  if (changed('last_name')) {
    if (!value('last_name')) addError('last_name', 'Last name is required.');
    else if (!NAME.test(value('last_name'))) addError('last_name', 'Last name should have letters only.');
  }
  if (changed('email_id')) {
    if (!value('email_id')) {
      addError('email_id', 'Email ID is required.');
    } else if (!EMAIL.test(value('email_id'))) {
      addError('email_id', 'Enter a valid email ID.');
    } else if ((await select(`select id from user_master where email_id = :email and id <> :id limit 1`, { email: value('email_id'), id: existing ? existing.id : 0 })).length) {
      addError('email_id', 'Email ID already in use.');
    }
  }
  if (changed('mobile')) {
    if (!value('mobile')) addError('mobile', 'Mobile no is required.');
    else if (!MOBILE.test(value('mobile'))) addError('mobile', 'Mobile no should be 10 digits.');
  }
  if (changed('emp_code') && value('emp_code')
    && (await select(`select id from user_master where emp_code = :code and id <> :id limit 1`, { code: value('emp_code'), id: existing ? existing.id : 0 })).length) {
    addError('emp_code', 'Employee code already in use.');
  }
  if (value('in_time') && !TIME.test(value('in_time'))) addError('in_time', 'Enter a valid time.');

  const roleId = +body.role_id || 0;
  if (!roleId) {
    addError('role_id', 'Role is required.');
  } else if (changed('role_id') && !(await select(`select id from user_role_master where id = :roleId and (status = 'Approved' or status = 'Active')`, { roleId })).length) {
    addError('role_id', 'Select an active role.');
  }
  const status = value('status');
  if (!STATUSES.includes(status)) addError('status', 'Select the status.');

  // Nobody can lock themselves out or give themselves another role
  if (existing && +existing.id === +req.userData.userId) {
    if (status !== text(existing.status)) addError('status', 'You cannot change your own status.');
    if (roleId !== +existing.role_id) addError('role_id', 'You cannot change your own role.');
  }

  const depots = await select(`select id from depot_master where status = 'Approved'`);
  const approved = new Set(depots.map((depot) => depot.id));
  const chosen = (Array.isArray(body.depot_ids) ? body.depot_ids : []).map((id) => +id).filter((id) => approved.has(id));
  // Depots no longer approved are not on the form: they stay as they were
  const kept = existing ? depotList(existing.depot_ids).filter((id) => !approved.has(id)) : [];

  if (Object.keys(errors).length) return { errors };
  return {
    row: {
      first_name: value('first_name'),
      middle_name: value('middle_name'),
      last_name: value('last_name'),
      email_id: value('email_id'),
      mobile: value('mobile'),
      emp_code: value('emp_code'),
      in_time: value('in_time') || DEFAULT_IN_TIME,
      role_id: roleId,
      status,
      remarks: value('remarks'),
      depot_ids: [...new Set([...kept, ...chosen])].join(',')
    }
  };
};

export const createUser = async (req, res, next) => {
  try {
    const built = await buildUser(req, null);
    if (built.errors) return invalid(res, built.errors);
    const userId = req.userData.userId;
    const now = new Date();
    const id = await insertRow('user_master', {
      ...built.row, password: DEFAULT_PASSWORD, created_by: userId, created_on: now, modified_by: userId, modified_on: now
    });
    res.status(201).json({ message: `User added! First login is with the default password ${DEFAULT_PASSWORD}.`, id });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Saving user failed!";
    next(error, req, res);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    if (!roleDetails(req).r_edit) {
      return res.status(401).json({ message: "You cannot change users." });
    }
    const existing = await findUser(+req.params.id || 0);
    if (!existing) {
      return res.status(404).json({ message: "User not found!" });
    }
    const built = await buildUser(req, existing);
    if (built.errors) return invalid(res, built.errors);
    await updateRow('user_master', existing.id, { ...built.row, modified_by: req.userData.userId, modified_on: new Date() });
    res.status(200).json({ message: "User saved!", id: existing.id });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Saving user failed!";
    next(error, req, res);
  }
};
