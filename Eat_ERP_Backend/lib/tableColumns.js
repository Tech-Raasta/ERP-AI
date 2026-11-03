import { QueryTypes } from 'sequelize';
import sequelize from './database.js';

// Older databases lack some tables and columns the old PHP code writes (e.g. distributor_in_sale_items,
// tax_type / combo_box_id / discount on the item tables). Columns are looked up once per table so both
// schemas work: only the columns that exist are written.

const columnCache = {};

export const columnsOf = async (table, transaction) => {
  if (!columnCache[table]) {
    const rows = await sequelize.query(
      `select column_name as name from information_schema.columns where table_schema = database() and table_name = :table`,
      { replacements: { table }, type: QueryTypes.SELECT, transaction }
    );
    columnCache[table] = new Set(rows.map((row) => row.name || row.NAME || row.COLUMN_NAME));
  }
  return columnCache[table];
};

export const hasTable = async (table, transaction) => (await columnsOf(table, transaction)).size > 0;

// The row without the keys this table has no column for
export const knownColumns = async (table, row, transaction) => {
  const columns = await columnsOf(table, transaction);
  return Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key)));
};

// Inserts the known columns of row; returns the new id (null when the table does not exist)
export const insertKnown = async (table, row, transaction) => {
  const columns = await columnsOf(table, transaction);
  if (!columns.size) return null;
  const known = Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key)));
  const keys = Object.keys(known);
  const [id] = await sequelize.query(
    `insert into ${table} (${keys.join(', ')}) values (${keys.map((key) => `:${key}`).join(', ')})`,
    { replacements: known, transaction }
  );
  return id;
};
