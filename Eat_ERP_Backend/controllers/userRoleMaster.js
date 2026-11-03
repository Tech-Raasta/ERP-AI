import sequelize from '../lib/database.js';
import { select, execute, invalid, text, insertRow, updateRow } from './sales.js';
import { USER_ADMIN_ROLES } from '../models/user.js';

// User Roles (old PHP User_roles / User_role_model): what each role may do, per module (user_role_options) and which
// reports it sees (report_roles). Access: the User_Roles role section; Admin and Super Admin always (check-auth).
// Changes take effect at once on the server, because check-auth reads the role's options on every request;
// the menu follows at the user's next login.

const G = {
  dashboard: 'Dashboard',
  product: 'Master - Product',
  sales: 'Master - Sales',
  other: 'Master - Other',
  transaction: 'Transaction',
  transfer: 'Transfer',
  users: 'Users',
  salesRep: 'Sales Rep',
  other2: 'Others'
};
const ALL = ['r_view', 'r_insert', 'r_edit', 'r_delete', 'r_approvals', 'r_export'];
const VIEW = ['r_view'];

// The form's rows. 'note' says what else a section controls in this ERP (middleware/check-auth.js).
export const SECTIONS = [
  { section: 'Dashboard', label: 'Dashboard', group: G.dashboard, rights: VIEW },
  { section: 'Vendors', label: 'Vendors', group: G.product, rights: ALL },
  { section: 'Depot', label: 'Depot', group: G.product, rights: ALL },
  { section: 'Raw_Material', label: 'Raw Material', group: G.product, rights: ALL },
  { section: 'Tax', label: 'Tax', group: G.product, rights: ALL },
  { section: 'Product', label: 'Product', group: G.product, rights: ALL, note: 'Also Category' },
  { section: 'Box', label: 'Box', group: G.product, rights: ALL, note: 'Also Combo Box' },
  { section: 'Ingredient_Master', label: 'Ingredients Master', group: G.product, rights: ALL, note: 'Also Recipe Master' },
  { section: 'Sales_Rep', label: 'Sales Representative', group: G.sales, rights: ALL },
  { section: 'Distributor', label: 'Distributor', group: G.sales, rights: ALL },
  { section: 'Distributor_Type', label: 'Distributor Type', group: G.sales, rights: ALL },
  { section: 'Zone', label: 'Zone', group: G.sales, rights: ALL },
  { section: 'Area', label: 'Area', group: G.sales, rights: ALL, note: 'Also Location' },
  { section: 'Location', label: 'Location', group: G.sales, rights: ALL },
  { section: 'Sr_Mapping', label: 'Sr Mapping', group: G.sales, rights: ALL },
  { section: 'Relationship_Master', label: 'Relationship Master', group: G.sales, rights: ALL },
  { section: 'Store_Master', label: 'Store Master', group: G.sales, rights: ALL },
  { section: 'City_Master', label: 'Global (City Master)', group: G.other, rights: ALL, note: 'Also Pincode' },
  { section: 'Bank_Master', label: 'Bank Master', group: G.other, rights: ALL },
  { section: 'Vendor_Type', label: 'Accounting (Vendor Type)', group: G.other, rights: ALL },
  { section: 'Batch_Master', label: 'Production (Batch Master)', group: G.transaction, rights: ALL },
  { section: 'Purchase_Order', label: 'Purchase Order', group: G.transaction, rights: ALL, note: 'Also Production Planning' },
  { section: 'Raw_Material_In', label: 'Raw Material In', group: G.transaction, rights: ALL, note: 'Also Goods Received, Store, New Payment Upload' },
  { section: 'Batch_Processing', label: 'Batch Processing', group: G.transaction, rights: ALL, note: 'Also Production, Packaging, Requisition' },
  { section: 'Distributor_Out', label: 'Sales', group: G.transaction, rights: ALL, note: 'Also Sample / Expiry, Sales Upload' },
  { section: 'Distributor_In', label: 'Sales Return', group: G.transaction, rights: ALL, note: 'Also Sales Return Upload' },
  { section: 'Distributor_Sale', label: 'Super Stockist Sale', group: G.transaction, rights: ALL },
  { section: 'Distributor_Sale_In', label: 'Super Stockist Sale Return', group: G.transaction, rights: ALL },
  { section: 'Payment', label: 'Bank (Payment Details)', group: G.transaction, rights: ALL, note: 'Also Old Payment Upload' },
  { section: 'Credit_Debit_Note', label: 'Credit Debit Note', group: G.transaction, rights: ALL },
  { section: 'Vendor_Payment', label: 'Vendor Payment Details', group: G.transaction, rights: ALL },
  { section: 'Finance_Voucher', label: 'Finance Voucher', group: G.transaction, rights: ALL, note: 'Also Expense Category' },
  { section: 'Depot_Transfer', label: 'Depot Transfer', group: G.transfer, rights: ALL },
  { section: 'Distributor_Transfer', label: 'Distributor Transfer', group: G.transfer, rights: ALL },
  { section: 'Bar_To_Box', label: 'Bar To Box Transfer', group: G.transfer, rights: ALL },
  { section: 'Box_To_Bar', label: 'Box To Bar Transfer', group: G.transfer, rights: ALL },
  { section: 'User', label: 'User', group: G.users, rights: ALL },
  { section: 'User_Roles', label: 'User Roles', group: G.users, rights: ALL },
  { section: 'Sales_Rep_Target', label: 'Sales Rep Target', group: G.salesRep, rights: ALL },
  { section: 'Sales_Rep_Route_Plan', label: 'Sales Rep Route Plan', group: G.salesRep, rights: ALL },
  { section: 'Sales_Rep_Distributors', label: 'Sales Rep Distributors', group: G.salesRep, rights: ALL },
  { section: 'Sales_Rep_Orders', label: 'Sales Rep Orders', group: G.salesRep, rights: ALL },
  { section: 'Sales_Rep_Payment_Receivables', label: 'Sales Rep Payment Receivables', group: G.salesRep, rights: ALL },
  { section: 'Attendance', label: 'Eat Attendance', group: G.other2, rights: ['r_view', 'r_insert', 'r_approvals', 'r_export'], note: 'Everyone sees their own. View: all employees, Insert: upload, Approval: approve and mail, Download: Excel' },
  { section: 'Log', label: 'Log', group: G.other2, rights: VIEW },
  { section: 'Reports', label: 'Reports', group: G.other2, rights: VIEW }
];

// The reports offered on the form (old PHP user_role_details.php)
export const REPORTS = [
  { group: 'Sales', reports: [{ id: 1, name: 'Sales Report' }, { id: 18, name: 'Promoter Sales' }, { id: 8, name: 'Sales Return' }] },
  { group: 'MIS', reports: [{ id: 7, name: 'Distributor Master' }, { id: 9, name: 'Payment Receivables' }, { id: 5, name: 'Distributor Ledger' }, { id: 6, name: 'Aging Wise' }, { id: 14, name: 'All Distributor Ledger' }, { id: 16, name: 'Ledger Report and Ledger Balance' }, { id: 17, name: 'Trial Balance' }] },
  { group: 'Sales Monitoring', reports: [{ id: 13, name: 'Sales Representative Location' }, { id: 20, name: 'Sales Representative Route Plan' }, { id: 21, name: 'Promoters Location' }] },
  { group: 'Production', reports: [{ id: 2, name: 'Raw Material Stock' }, { id: 3, name: 'Production' }, { id: 4, name: 'Product Stock' }, { id: 10, name: 'Purchase Order' }, { id: 11, name: 'Production Data' }, { id: 12, name: 'Purchase Variance' }] }
];
const REPORT_IDS = REPORTS.flatMap((group) => group.reports.map((report) => report.id));

const STATUSES = ['Approved', 'InActive'];

const roleDetails = (req) => req.userData.roleDetails || {};
const isAdmin = (req) => USER_ADMIN_ROLES.includes(+req.userData.userRoleId);
// Old PHP: roles made by the system cannot be edited; they are copied
const isGlobal = (role) => !+role.created_by;

// Nobody may raise their own rights: only Admin and Super Admin edit their own role or the admin roles
const editable = (req, role) => {
  if (!roleDetails(req).r_edit || isGlobal(role)) return false;
  if (isAdmin(req)) return true;
  return +role.id !== +req.userData.userRoleId && !USER_ADMIN_ROLES.includes(+role.id);
};

const findRole = async (id, transaction) => (await select(
  `select A.*, concat_ws(' ', ifnull(B.first_name, ''), ifnull(B.last_name, '')) as created_by_name
   from user_role_master A left join user_master B on (A.created_by = B.id) where A.id = :id`,
  { id }, transaction
))[0] || null;

const activeUsers = async (roleId, transaction) => +(await select(
  `select count(*) as total from user_master where role_id = :roleId and status = 'Approved'`, { roleId }, transaction
))[0].total;

// Old PHP index: every role
export const getRoles = async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(+req.query.pageSize || 10, 1), 500);
    const pageIndex = Math.max(+req.query.pageIndex || 0, 0);
    const query = text(req.query.query);
    const replacements = { search: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };
    const where = query ? `where (A.role_name like :search or A.description like :search)` : '';
    const [[count], rows] = await Promise.all([
      select(`select count(*) as total from user_role_master A ${where}`, replacements),
      select(
        `select A.id, A.role_name, A.description, A.status, A.created_by,
           concat_ws(' ', ifnull(B.first_name, ''), ifnull(B.last_name, '')) as created_by_name,
           (select count(*) from user_master U where U.role_id = A.id and U.status = 'Approved') as active_users
         from user_role_master A left join user_master B on (A.created_by = B.id) ${where}
         order by A.role_name limit :limit offset :offset`,
        replacements
      )
    ]);
    res.status(200).json({
      total: +count.total || 0,
      rows: rows.map(({ created_by: createdBy, ...row }) => ({ ...row, global: !+createdBy })),
      action: { insert: !!roleDetails(req).r_insert }
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching user roles failed!";
    next(error, req, res);
  }
};

export const getMasterData = async (req, res, next) => {
  res.status(200).json({ sections: SECTIONS, reports: REPORTS, action: { insert: !!roleDetails(req).r_insert } });
};

export const getRole = async (req, res, next) => {
  try {
    const role = await findRole(+req.params.id || 0);
    if (!role) {
      return res.status(404).json({ message: "User role not found!" });
    }
    const [options, reports] = await Promise.all([
      select(`select section, r_view, r_insert, r_edit, r_delete, r_approvals, r_export from user_role_options where role_id = :id`, { id: role.id }),
      select(`select rep_id from report_roles where role_id = :id and rep_view = 1`, { id: role.id })
    ]);
    res.status(200).json({
      role: { id: role.id, role_name: role.role_name, description: role.description, status: role.status, global: isGlobal(role) },
      options: Object.fromEntries(options.map(({ section, ...rights }) => [section, rights])),
      reports: reports.map((report) => report.rep_id).filter((id) => REPORT_IDS.includes(id)),
      permissions: { submit: editable(req, role), copy: !!roleDetails(req).r_insert }
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching user role failed!";
    next(error, req, res);
  }
};

// Old PHP validations.js form_user_role_details + check_role
const buildRole = async (req, existing) => {
  const body = req.body || {};
  const errors = {};
  const addError = (key, message) => {
    if (!errors[key]) errors[key] = { message };
  };
  const roleName = text(body.role_name);
  if (!roleName) {
    addError('role_name', 'Role is required.');
  } else if ((await select(`select id from user_role_master where role_name = :roleName and id <> :id limit 1`, { roleName, id: existing ? existing.id : 0 })).length) {
    addError('role_name', 'User Role already exist.');
  }
  const status = text(body.status);
  if (!STATUSES.includes(status)) addError('status', 'Select the status.');

  const input = body.options && typeof body.options === 'object' ? body.options : {};
  const options = SECTIONS.map(({ section, rights }) => {
    const row = { section };
    ALL.forEach((right) => { row[right] = rights.includes(right) && input[section] && input[section][right] ? 1 : 0; });
    return row;
  });
  if (!options.some((row) => ALL.some((right) => row[right]))) {
    addError('options', 'Please assign atleast one role.');
  }

  // PHP let a role be switched off while people were using it, but an InActive role still gives them its rights
  if (existing && status === 'InActive' && text(existing.status) !== 'InActive') {
    const users = await activeUsers(existing.id);
    if (users) addError('status', `${users} active user${users > 1 ? 's have' : ' has'} this role. Move them to another role first.`);
  }

  if (Object.keys(errors).length) return { errors };
  const chosen = Array.isArray(body.reports) ? body.reports.map(Number) : [];
  return {
    row: { role_name: roleName, description: text(body.description), status },
    options,
    reports: REPORT_IDS.filter((id) => chosen.includes(id))
  };
};

// Only the sections and reports on the form change. PHP deleted every option row of the role and zeroed every report,
// losing the sections and reports the form does not show.
const saveRights = async (roleId, built, userId, now, t) => {
  const existing = await select(`select id, section from user_role_options where role_id = :roleId`, { roleId }, t);
  const idOf = new Map(existing.map((row) => [row.section, row.id]));
  for (const { section, ...rights } of built.options) {
    if (idOf.has(section)) await updateRow('user_role_options', idOf.get(section), rights, t);
    else await insertRow('user_role_options', { role_id: roleId, section, ...rights }, t);
  }
  const reportRows = await select(`select id, rep_id from report_roles where role_id = :roleId and rep_id in (:reportIds)`, { roleId, reportIds: REPORT_IDS }, t);
  const reportOf = new Map(reportRows.map((row) => [row.rep_id, row.id]));
  for (const repId of REPORT_IDS) {
    const repView = built.reports.includes(repId) ? 1 : 0;
    if (reportOf.has(repId)) {
      await execute(`update report_roles set rep_view = :repView, modified_by = :userId, modified_on = :now where id = :id`, { repView, userId, now, id: reportOf.get(repId) }, t);
    } else if (repView) {
      await insertRow('report_roles', { rep_id: repId, role_id: roleId, rep_view: 1, created_by: userId, created_on: now }, t);
    }
  }
};

export const createRole = async (req, res, next) => {
  try {
    const built = await buildRole(req, null);
    if (built.errors) return invalid(res, built.errors);
    const userId = req.userData.userId;
    const now = new Date();
    const t = await sequelize.transaction();
    try {
      const id = await insertRow('user_role_master', { ...built.row, created_by: userId, created_on: now, modified_by: userId, modified_on: now }, t);
      await saveRights(id, built, userId, now, t);
      await t.commit();
      res.status(201).json({ message: "User role added!", id });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Saving user role failed!";
    next(error, req, res);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const existing = await findRole(+req.params.id || 0);
    if (!existing) {
      return res.status(404).json({ message: "User role not found!" });
    }
    if (!editable(req, existing)) {
      return res.status(401).json({ message: isGlobal(existing) ? "This is a global role: copy it instead." : "You cannot change this role." });
    }
    const built = await buildRole(req, existing);
    if (built.errors) return invalid(res, built.errors);
    const userId = req.userData.userId;
    const now = new Date();
    // A role saved as Active stays Active; the form shows both as Active
    const status = built.row.status === 'Approved' && text(existing.status) === 'Active' ? 'Active' : built.row.status;
    const t = await sequelize.transaction();
    try {
      await updateRow('user_role_master', existing.id, { ...built.row, status, modified_by: userId, modified_on: now }, t);
      await saveRights(existing.id, built, userId, now, t);
      await t.commit();
      res.status(200).json({ message: "User role saved!", id: existing.id });
    } catch (error) {
      if (!t.finished) await t.rollback();
      throw error;
    }
  } catch (error) {
    res.statusCode = 500;
    res.message = "Saving user role failed!";
    next(error, req, res);
  }
};
