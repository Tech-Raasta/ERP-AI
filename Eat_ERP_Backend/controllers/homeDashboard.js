import { select } from "./sales.js";
import { USER_ADMIN_ROLES } from "../models/user.js";

// Home page (old PHP Dashboard). What a user sees depends on their role (user_role_options):
//  - work waiting in the screens they can open: drafts to finish for makers, entries to approve for approvers;
//  - the business figures, only for roles with the Dashboard section, as in PHP (get_access);
//  - their name, role and depots.
// Counts follow the list screens' own tabs, so a number here is the number on that tab.

const PENDING = `(A.status = 'Pending' or A.status = 'Deleted')`;
const NOT_SAMPLE = `(A.distributor_id <> 1 and A.distributor_id <> 189)`;

// section: the user_role_options row; depot: limited to the user's depots like the list screen; tab: ?status= of the list
const WORK = [
  {
    section: 'Distributor_Out', group: 'Sales', label: 'Sales', path: '/transaction/sales', depot: 'A.depot_id', table: 'distributor_out',
    items: [
      { key: 'pending', label: 'Pending', condition: `(A.status = 'Pending' and (A.delivery_status is null or A.delivery_status = ''))`, extra: NOT_SAMPLE, who: 'maker' },
      { key: 'pending_for_approval', label: 'Approval Pending', condition: `((A.status = 'Pending' and A.delivery_status in ('Pending', 'GP Issued', 'Delivered Not Complete', 'Delivered')) or A.status = 'Deleted')`, extra: NOT_SAMPLE, who: 'approver' },
      { key: 'pending_for_delivery', label: 'Delivery Pending', condition: `(A.status = 'Approved' and A.delivery_status = 'Pending')`, extra: NOT_SAMPLE, who: 'maker' },
    ],
  },
  { section: 'Distributor_In', group: 'Sales', label: 'Sales Returns', path: '/transaction/sales-return', depot: 'A.depot_id', table: 'distributor_in', items: [{ key: 'pending', label: 'Pending', condition: PENDING }] },
  { section: 'Payment', group: 'Bank', label: 'Payment Details', path: '/transaction/payment-details', table: 'payment_details', items: [{ key: 'pending', label: 'Pending', condition: PENDING }] },
  { section: 'Credit_Debit_Note', group: 'Bank', label: 'Credit / Debit Notes', path: '/transaction/credit-debit-note', table: 'credit_debit_note', items: [{ key: 'pending', label: 'Pending', condition: PENDING }] },
  { section: 'Batch_Processing', group: 'Production', label: 'Batch Processing', path: '/transaction/batch-processing', depot: 'A.depot_id', table: 'batch_processing', items: [{ key: 'pending', label: 'Pending', condition: PENDING }] },
  { section: 'Depot_Transfer', group: 'Transfer', label: 'Depot Transfers', path: '/transaction/depot-transfer', table: 'depot_transfer', items: [{ key: 'pending', label: 'Pending', condition: `A.status = 'Pending'` }] },
  {
    section: 'Purchase_Order', group: 'Production', label: 'Purchase Orders', path: '/transaction/purchase-order', depot: 'A.depot_id', table: 'purchase_order',
    items: [
      { key: 'drafted', label: 'Drafted', condition: `A.status = 'Drafted'`, who: 'maker' },
      { key: 'pending', label: 'Pending', condition: PENDING, who: 'approver' },
      { key: 'payment_pending', label: 'Payment Pending', condition: `(A.status = 'Approved' and A.po_status = 'Raw Material In')` },
      { key: 'advance', label: 'Advance', condition: `(A.status = 'Approved' and A.po_status = 'Advance')` },
    ],
  },
];

const roleSections = async (roleId) => {
  const rows = await select(
    `select section, max(r_view) as r_view, max(r_insert) as r_insert, max(r_edit) as r_edit, max(r_approvals) as r_approvals
     from user_role_options where role_id = :roleId group by section`,
    { roleId }
  );
  return new Map(rows.map((row) => [row.section, row]));
};

// A maker (insert / edit) sees drafts, an approver sees what waits for approval; an item for nobody in particular
// goes to anyone who can open the screen
const showsItem = (item, rights, isAdmin) => {
  if (isAdmin || !item.who) return true;
  if (item.who === 'approver') return !!+rights.r_approvals;
  return !!(+rights.r_insert || +rights.r_edit);
};

const workOf = async (sections, depotIds, isAdmin) => {
  const modules = WORK.filter((module) => {
    const rights = sections.get(module.section);
    return isAdmin || (rights && +rights.r_view);
  });
  const results = await Promise.all(modules.map(async (module) => {
    const rights = sections.get(module.section) || {};
    const items = module.items.filter((item) => showsItem(item, rights, isAdmin));
    if (!items.length) return null;
    if (module.depot && !depotIds.length) return { ...module, items: items.map(({ key, label }) => ({ key, label, count: 0 })) };
    const where = module.depot ? `${module.depot} in (:depotIds)` : '1 = 1';
    const [counts] = await select(
      `select ${items.map((item, index) => `sum(${item.condition}${item.extra ? ` and ${item.extra}` : ''}) as c${index}`).join(', ')}
       from ${module.table} A where ${where}`,
      { depotIds }
    );
    return {
      section: module.section, group: module.group, label: module.label, path: module.path,
      items: items.map(({ key, label }, index) => ({ key, label, count: +counts[`c${index}`] || 0 })),
    };
  }));
  return results.filter(Boolean);
};

// Old PHP dashboard tiles, for the current financial year instead of all time (PHP added up every year, and its stock
// figures were typed-in numbers, not data, so they are left out)
const figuresOf = async (depotIds) => {
  const now = new Date();
  const fyStart = `${now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1}-04-01`;
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const sampleDistributors = `(select id from distributor_master where class = 'sample')`;
  const [[sales], [distributors], [receivable]] = await Promise.all([
    depotIds.length ? select(
      `select
         ifnull((select sum(final_amount) from distributor_out where status = 'Approved' and depot_id in (:depotIds) and invoice_date >= :fyStart and distributor_id not in ${sampleDistributors}), 0)
         - ifnull((select sum(final_amount) from distributor_in where status = 'Approved' and depot_id in (:depotIds) and date_of_processing >= :fyStart and distributor_id not in ${sampleDistributors}), 0) as year_sales,
         ifnull((select sum(final_amount) from distributor_out where status = 'Approved' and depot_id in (:depotIds) and invoice_date >= :monthStart and distributor_id not in ${sampleDistributors}), 0)
         - ifnull((select sum(final_amount) from distributor_in where status = 'Approved' and depot_id in (:depotIds) and date_of_processing >= :monthStart and distributor_id not in ${sampleDistributors}), 0) as month_sales`,
      { depotIds, fyStart, monthStart }
    ) : [{ year_sales: 0, month_sales: 0 }],
    select(
      `select count(*) as total, sum(type_id = 3) as general_trade, sum(type_id = 7) as modern_trade, sum(type_id = 4) as e_commerce
       from distributor_master where status = 'Approved'`
    ),
    // What distributors owe: everything sold less returns, payments and notes, as the ledger counts it
    select(
      `select
         ifnull((select sum(final_amount) from distributor_out where status = 'Approved' and distributor_id not in ${sampleDistributors}), 0)
         - ifnull((select sum(final_amount) from distributor_in where status = 'Approved' and distributor_id not in ${sampleDistributors}), 0)
         - ifnull((select sum(B.payment_amount) from payment_details A join payment_details_items B on (A.id = B.payment_id) where A.status = 'Approved'), 0)
         - ifnull((select sum(case when transaction in ('Credit Note', 'Expense Voucher') then amount else -amount end) from credit_debit_note where status = 'Approved'), 0)
         as total`
    ),
  ]);
  return {
    fyStart,
    yearSales: Math.round(+sales.year_sales || 0),
    monthSales: Math.round(+sales.month_sales || 0),
    distributors: { total: +distributors.total || 0, generalTrade: +distributors.general_trade || 0, modernTrade: +distributors.modern_trade || 0, eCommerce: +distributors.e_commerce || 0 },
    receivable: Math.round(+receivable.total || 0),
  };
};

export const getHomeDashboard = async (req, res, next) => {
  try {
    const roleId = +req.userData.userRoleId;
    const isAdmin = USER_ADMIN_ROLES.includes(roleId);
    const [[user], sections] = await Promise.all([
      select(
        `select A.first_name, A.last_name, A.depot_ids, B.role_name from user_master A left join user_role_master B on (A.role_id = B.id) where A.id = :userId`,
        { userId: req.userData.userId }
      ),
      roleSections(roleId),
    ]);
    // check-login does not load the depots; the home page reads them itself
    const depotIds = String((user && user.depot_ids) || '').split(',').map(Number).filter(Boolean);
    const dashboard = sections.get('Dashboard');
    const showFigures = isAdmin || !!(dashboard && +dashboard.r_view);
    const [work, figures, depots] = await Promise.all([
      workOf(sections, depotIds, isAdmin),
      showFigures ? figuresOf(depotIds) : null,
      depotIds.length ? select(`select depot_name from depot_master where id in (:depotIds) order by depot_name`, { depotIds }) : [],
    ]);
    res.status(200).json({
      user: {
        name: user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : '',
        role: user ? user.role_name : '',
        depots: depots.map((depot) => depot.depot_name),
      },
      work,
      figures,
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching home page failed!";
    next(error, req, res);
  }
};
