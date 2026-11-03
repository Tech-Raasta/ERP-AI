import { query } from './engine.js';
import { REPORTS } from './index.js';

// Which reports a role may open: Admin and Super Admin every one, any other role the reports ticked for it on the User
// Roles screen (report_roles). Reports with no tick of their own are open to anyone with the Reports section.

// Reports with a screen of their own instead of the Report Viewer
export const SCREENS = [{ key: 'production', repId: 3 }];

const ticksOf = async (roleId) => {
  const rows = await query(`select rep_id from report_roles where role_id = :roleId and rep_view = 1`, { roleId });
  return new Set(rows.map((row) => +row.rep_id));
};

export const reportAccess = async (roleId, isAdmin) => {
  if (isAdmin) return { reports: REPORTS, screens: SCREENS };
  const ticked = await ticksOf(roleId);
  const allowed = (item) => !item.repId || ticked.has(item.repId);
  return { reports: REPORTS.filter(allowed), screens: SCREENS.filter(allowed) };
};

export const canOpenScreen = async (roleId, isAdmin, key) => (await reportAccess(roleId, isAdmin)).screens.some((screen) => screen.key === key);
