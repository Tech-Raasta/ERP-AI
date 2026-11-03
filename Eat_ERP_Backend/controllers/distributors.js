import { QueryTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import Distributor from '../models/distributor.js';

// Distributor / Retailer master (old PHP Distributor + Distributor_model).
// Records come from two tables:
//   d_<id> -> distributor_master
//   s_<id> -> sales_rep_distributors (retailers added by sales reps, status 'Approved' there, shown as 'Pending').
// Saving a 's_' record creates the distributor and marks the sales rep record Active (PHP save_data).

// multer (middleware/file.js) stores files under assets/uploads/<last segment of the api url>
const DOC_FOLDER = 'distributor';
const CLASSES = ['normal', 'direct', 'super stockist', 'sample'];

const invalid = (res, error) => res.status(422).json({
  message: "Invalid inputs passed, please check your data.",
  error: error
});
const fieldError = (field, message) => ({ errors: { [field]: { message } } });

const select = (sql, replacements = {}, transaction) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
const execute = (sql, replacements = {}, transaction) => sequelize.query(sql, { replacements, transaction });

const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';
const numOrNull = (value) => (text(value) === '' || isNaN(+value)) ? null : +value;
const parseJson = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (error) { return fallback; }
};

const getAction = (req) => {
  const roleDetails = req.userData.roleDetails;
  return {
    insert: roleDetails.r_insert ? true : false,
    update: roleDetails.r_edit ? true : false
  };
};

// Dropdown data (old PHP add/edit: Approved types, zones, areas, locations, beat plans; cities for the city lookup)
const getMasterOptions = async () => {
  const types = await select(`select id, distributor_type from distributor_type_master where status = 'Approved' order by distributor_type`);
  const zones = await select(`select id, zone, type_id from zone_master where status = 'Approved' order by zone`);
  const areas = await select(`select id, area, zone_id from area_master where status = 'Approved' order by area`);
  const locations = await select(`select id, location from location_master where status = 'Approved' order by location`);
  const beatPlans = await select(`select id, beat_id, beat_name from beat_master where status = 'Approved' order by beat_name`);
  // Old PHP city autocomplete fills state, country and state code
  const cities = await select(
    `select A.id, A.city_name, B.state_name, B.state_code, C.country_name
     from city_master A
     left join state_master B on (A.state_id = B.id)
     left join country_master C on (B.country_id = C.id)
     where A.status = 1 order by A.city_name`
  );
  return { types, zones, areas, locations, beatPlans, cities };
};

// Old PHP getDistributor_margin: every category with this distributor's margins
const getMargins = async (distributorId) => select(
  `select A.id as category_id, A.category_name, B.inv_margin, B.pro_margin
   from category_master A
   left join distributor_category_margin B on (A.id = B.category_id and B.distributor_id = :distributorId)
   where (A.status = 1 and A.is_deleted = 1) or B.distributor_id is not null
   order by A.category_name`,
  { distributorId: distributorId || 0 }
);

// ---- Validation (old PHP validations.js #form_distributor_details) ----
const validateRequest = async (body, distributorId, contacts, consignees, margins) => {
  const name = text(body.distributor_name);
  if (!name) return fieldError('distributor_name', 'Distributor Name is required');
  const nameCount = await select(
    `select count(*) as count from distributor_master where distributor_name = :name and id <> :id`,
    { name, id: distributorId || 0 }
  );
  if (+nameCount[0].count > 0) return fieldError('distributor_name', 'Distributor Name already in use.');

  if (text(body.sell_out) === '' || isNaN(+body.sell_out)) return fieldError('sell_out', 'Discount is required and must be a number');
  if (!['0', '1'].includes(text(body.send_invoice))) return fieldError('send_invoice', 'Generate Invoice is required');
  if (!/^\d+$/.test(text(body.credit_period))) return fieldError('credit_period', 'Credit Period is required and must be in days');
  if (text(body.d_email_id) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(body.d_email_id))) return fieldError('d_email_id', 'Please enter a valid email id');
  if (text(body.pincode) && !/^\d+$/.test(text(body.pincode))) return fieldError('pincode', 'Pincode must contain digits only');
  if (!/^\d{10}$/.test(text(body.d_mobile))) return fieldError('d_mobile', 'Mobile must be 10 digits');
  const distributorClass = text(body.class);
  if (!CLASSES.includes(distributorClass)) return fieldError('class', 'Class is required');
  if (!text(body.state)) return fieldError('state', 'State is required');
  if (!text(body.state_code)) return fieldError('state_code', 'State Code is required');
  if (!numOrNull(body.type_id)) return fieldError('type_id', 'Type is required');
  if (!numOrNull(body.zone_id)) return fieldError('zone_id', 'Zone is required');
  if (!numOrNull(body.area_id)) return fieldError('area_id', 'Area is required');
  if ((distributorClass === 'normal' || distributorClass === 'direct') && !numOrNull(body.location_id)) {
    return fieldError('location_id', 'Location is required for Retailer / Direct');
  }
  if (distributorClass === 'direct' && !text(body.prefix)) return fieldError('prefix', 'Prefix is required for Direct');
  if (!['Approved', 'InActive'].includes(text(body.status) || 'Approved')) return fieldError('status', 'Status must be Active or InActive');

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    if (!text(contact.contact_person)) return fieldError('contacts', `Contact row ${i + 1}: Contact Person is required`);
    if (!/^\d{10}$/.test(text(contact.mobile))) return fieldError('contacts', `Contact row ${i + 1}: Mobile must be 10 digits`);
    if (text(contact.email_id) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(contact.email_id))) return fieldError('contacts', `Contact row ${i + 1}: Please enter a valid email id`);
  }

  // Consignees are optional. A row with any input must be complete (name / address / state / state code);
  // saved rows only need a name, so older incomplete rows do not block a save.
  for (let i = 0; i < consignees.length; i++) {
    const consignee = consignees[i];
    const required = consignee.id ? [['con_name', 'Name']] : [['con_name', 'Name'], ['con_address', 'Address'], ['con_state', 'State'], ['con_state_code', 'State Code']];
    for (const [field, label] of required) {
      if (!text(consignee[field])) return fieldError('consignees', `Consignee row ${i + 1}: ${label} is required`);
    }
  }

  // Old PHP marks margins required, but its jQuery rule only reached the first row; margins must be numbers when entered
  for (const margin of margins) {
    if ((text(margin.inv_margin) !== '' && isNaN(+margin.inv_margin)) || (text(margin.pro_margin) !== '' && isNaN(+margin.pro_margin))) {
      return fieldError('margins', `${margin.category_name || 'Category'}: Margin must be a number`);
    }
  }

  return null;
};

// ---- Save (old PHP Distributor_model::save_data) ----
const saveDistributor = async (req, res, distributor, salesRepDistributor) => {
  const body = req.body;
  const userId = req.userData.userId;
  // Contacts and consignees are optional: completely blank rows are ignored, rows with any input are validated
  const hasInput = (row, fields) => fields.some((field) => text(row[field]) !== '');
  const contacts = parseJson(body.contacts, []).filter((row) => row && hasInput(row, ['contact_person', 'email_id', 'mobile']));
  const consignees = parseJson(body.consignees, []).filter((row) => row && (row.id || hasInput(row, [
    'con_name', 'con_address', 'con_city', 'con_pincode', 'con_state', 'con_country', 'con_state_code', 'con_gst_number'
  ])));
  const margins = parseJson(body.margins, []).filter((row) => row && row.category_id);
  const beatIds = parseJson(body.beat_ids, []).map((id) => +id).filter((id) => id);

  const error = await validateRequest(body, distributor.id, contacts, consignees, margins);
  if (error) {
    return invalid(res, error);
  }

  // Consignee ids sent back must belong to this distributor
  const savedConsignees = distributor.id
    ? await select(`select id from distributor_consignee where distributor_id = :id`, { id: distributor.id })
    : [];
  const savedConsigneeIds = savedConsignees.map((row) => row.id);
  if (consignees.some((row) => row.id && !savedConsigneeIds.includes(+row.id))) {
    return invalid(res, fieldError('consignees', 'Consignee does not belong to this distributor'));
  }

  distributor.distributor_name = text(body.distributor_name);
  distributor.address = text(body.address);
  distributor.city = text(body.city);
  distributor.pincode = text(body.pincode);
  distributor.state = text(body.state);
  distributor.country = text(body.country);
  distributor.google_address = text(body.google_address);
  distributor.email_id = text(body.d_email_id);
  distributor.mobile = text(body.d_mobile);
  distributor.tin_number = text(body.tin_number);
  distributor.cst_number = text(body.cst_number);
  // The old PHP form has no sales rep field and so cleared the link on every save; keep it instead.
  if (salesRepDistributor) {
    distributor.sales_rep_id = salesRepDistributor.sales_rep_id || null;
  } else if (body.sales_rep_id !== undefined) {
    distributor.sales_rep_id = numOrNull(body.sales_rep_id);
  }
  distributor.sell_out = numOrNull(body.sell_out);
  distributor.send_invoice = numOrNull(body.send_invoice);
  distributor.credit_period = numOrNull(body.credit_period);
  distributor.class = text(body.class);
  distributor.area_id = numOrNull(body.area_id);
  distributor.type_id = numOrNull(body.type_id);
  distributor.zone_id = numOrNull(body.zone_id);
  distributor.location_id = numOrNull(body.location_id);
  distributor.status = text(body.status) || 'Approved';
  distributor.remarks = text(body.remarks);
  distributor.modified_by = userId;
  distributor.state_code = text(body.state_code);
  distributor.gst_number = text(body.gst_number);
  distributor.latitude = numOrNull(body.d_latitude);
  distributor.longitude = numOrNull(body.d_longitude);
  distributor.tally_name = text(body.tally_name);
  distributor.master_distributor_id = numOrNull(body.master_distributor_id);
  distributor.prefix = text(body.prefix);
  distributor.marketplace = text(body.marketplace);
  distributor.marketplace_id = numOrNull(body.marketplace_id);
  // Existing document (or the sales rep's document) is kept unless a new file is uploaded
  distributor.doc_document = text(body.doc_document);
  distributor.document_name = text(body.document_name);
  const file = (Array.isArray(req.files) ? req.files : []).find((item) => item.fieldname === 'doc_file');
  if (file) {
    distributor.doc_document = `${DOC_FOLDER}/${file.filename}`;
    distributor.document_name = file.originalname;
  }

  const now = new Date();
  const t = await sequelize.transaction();
  try {
    await distributor.save({ transaction: t });
    const id = distributor.id;

    await execute(`delete from distributor_beat_plans where distributor_id = :id`, { id }, t);
    for (const beatId of beatIds) {
      await execute(
        `insert into distributor_beat_plans (distributor_id, beat_id, status, remarks, created_by, created_on, modified_by, modified_on)
         values (:id, :beatId, :status, :remarks, :userId, :now, :userId, :now)`,
        { id, beatId, status: distributor.status, remarks: distributor.remarks, userId, now }, t
      );
    }

    await execute(`delete from distributor_category_margin where distributor_id = :id`, { id }, t);
    for (const margin of margins) {
      await execute(
        `insert into distributor_category_margin (distributor_id, category_id, inv_margin, pro_margin)
         values (:id, :categoryId, :invMargin, :proMargin)`,
        { id, categoryId: +margin.category_id, invMargin: numOrNull(margin.inv_margin), proMargin: numOrNull(margin.pro_margin) }, t
      );
    }

    await execute(`delete from distributor_contacts where distributor_id = :id`, { id }, t);
    for (const contact of contacts) {
      await execute(
        `insert into distributor_contacts (distributor_id, contact_person, email_id, mobile) values (:id, :person, :email, :mobile)`,
        { id, person: text(contact.contact_person), email: text(contact.email_id), mobile: text(contact.mobile) }, t
      );
    }

    // Old PHP: consignees are updated by id or inserted, never deleted (sales may refer to them)
    for (const consignee of consignees) {
      const values = {
        id,
        name: text(consignee.con_name),
        address: text(consignee.con_address),
        city: text(consignee.con_city),
        pincode: text(consignee.con_pincode),
        state: text(consignee.con_state),
        country: text(consignee.con_country),
        stateCode: text(consignee.con_state_code),
        gst: text(consignee.con_gst_number)
      };
      if (consignee.id) {
        await execute(
          `update distributor_consignee set con_name = :name, con_address = :address, con_city = :city, con_pincode = :pincode,
             con_state = :state, con_country = :country, con_state_code = :stateCode, con_gst_number = :gst
           where id = :conId and distributor_id = :id`,
          { ...values, conId: +consignee.id }, t
        );
      } else {
        await execute(
          `insert into distributor_consignee (distributor_id, con_name, con_address, con_city, con_pincode, con_state, con_country, con_state_code, con_gst_number)
           values (:id, :name, :address, :city, :pincode, :state, :country, :stateCode, :gst)`,
          values, t
        );
      }
    }

    if (salesRepDistributor) {
      await execute(
        `update sales_rep_distributors set status = 'Active', distributor_id = :id, modified_by = :userId, modified_on = :now where id = :srdId`,
        { id, userId, now, srdId: salesRepDistributor.id }, t
      );
    }

    // Old PHP accountledger_model->set_ledger(id, 'Distributor', name)
    const ledger = await select(`select id from account_ledger_master where ref_id = :id and ref_type = 'Distributor'`, { id }, t);
    if (ledger.length === 0) {
      await execute(
        `insert into account_ledger_master (ledger_name, ref_id, ref_type, status, updated_by, updated_date, fk_group_id, ledger_type, created_by, created_date)
         values (:name, :id, 'Distributor', 'Approved', :userId, :now, 9, 'Current Asset', :userId, :now)`,
        { name: distributor.distributor_name, id, userId, now }, t
      );
    } else {
      await execute(
        `update account_ledger_master set ledger_name = :name, status = 'Approved', updated_by = :userId, updated_date = :now where id = :ledgerId`,
        { name: distributor.distributor_name, userId, now, ledgerId: ledger[0].id }, t
      );
    }

    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }
  return null;
};

const getSalesRepDistributor = async (id) => {
  const rows = await select(`select * from sales_rep_distributors where id = :id and status = 'Approved'`, { id });
  return rows.length ? rows[0] : null;
};

export const getMasterData = async (req, res, next) => {
  try {
    const options = await getMasterOptions();
    const margins = await getMargins(0);
    return res.status(200).json({ ...options, margins });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

// Create. A body d_id of 's_<id>' converts that sales rep retailer into a distributor.
export const createDistributor = async (req, res, next) => {
  try {
    let salesRepDistributor = null;
    const dId = text(req.body.d_id);
    if (dId.startsWith('s_')) {
      salesRepDistributor = await getSalesRepDistributor(+dId.substring(2));
      if (!salesRepDistributor) {
        return res.status(404).json({ message: "Pending retailer not found!" });
      }
    }

    const distributor = Distributor.build({ created_by: req.userData.userId });
    const response = await saveDistributor(req, res, distributor, salesRepDistributor);
    if (response) {
      return response;
    }
    return res.status(201).json({ message: "Distributor added successfully", distributor });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a distributor failed!";
    next(error, req, res);
  }
};

export const updateDistributor = async (req, res, next) => {
  try {
    const distributor = await Distributor.findByPk(req.params.id);
    if (!distributor) {
      return res.status(404).json({ message: "Distributor not found!" });
    }
    const response = await saveDistributor(req, res, distributor, null);
    if (response) {
      return response;
    }
    res.status(200).json({ message: "Update successful!", distributor });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't update distributor!";
    next(error, req, res);
  }
};

// List (old PHP checkstatus). Tabs: distributor (Approved super stockist), retailer (Approved normal/direct),
// inactive (InActive), pending (sales rep retailers waiting to be converted).
export const getDistributors = async (req, res, next) => {
  try {
    const status = req.query.status ? req.query.status.toString().trim().toLowerCase() : 'distributor';
    const query = req.query.query ? req.query.query.toString().trim() : '';
    const pageAll = req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL';
    const pageSize = pageAll ? 0 : (+req.query.pageSize || 10);
    const pageIndex = +req.query.pageIndex || 0;

    const countRows = await select(
      `select
         sum(status = 'Approved' and class = 'super stockist') as distributor,
         sum(status = 'Approved' and class in ('normal', 'direct')) as retailer,
         sum(status = 'InActive') as inactive,
         sum(status = 'Pending') as pending
       from distributor_master`
    );
    const pendingRows = await select(`select count(*) as count from sales_rep_distributors where status = 'Approved'`);
    // Old PHP counts over the union: sales rep retailers are always 'Pending'
    const statusCount = {
      distributor: +countRows[0].distributor || 0,
      retailer: +countRows[0].retailer || 0,
      inactive: +countRows[0].inactive || 0,
      pending: (+countRows[0].pending || 0) + (+pendingRows[0].count || 0)
    };

    let from;
    if (status === 'pending') {
      // Old PHP Pending tab: union filtered on status 'Pending' -> sales rep retailers + distributors still 'Pending'
      from = `((select concat('d_', id) as d_id, id, distributor_name, location_id, sell_out, credit_period,
                  status, latitude, longitude, google_address, sales_rep_id, class
                from distributor_master where status = 'Pending')
               union all
               (select concat('s_', id) as d_id, id, distributor_name, location_id, margin as sell_out, null as credit_period,
                  'Pending' as status, null as latitude, null as longitude, null as google_address, sales_rep_id, null as class
                from sales_rep_distributors where status = 'Approved')) D`;
    } else {
      let condition = `status = 'Approved' and class = 'super stockist'`;
      if (status === 'retailer') condition = `status = 'Approved' and class in ('normal', 'direct')`;
      if (status === 'inactive') condition = `status = 'InActive'`;
      from = `(select concat('d_', id) as d_id, id, distributor_name, location_id, sell_out, credit_period,
                 status, latitude, longitude, google_address, sales_rep_id, class
               from distributor_master where ${condition}) D`;
    }

    const where = query ? `where D.distributor_name like :query or G.location like :query` : '';
    const sortable = { distributor_name: 'D.distributor_name', location: 'G.location', sell_out: 'D.sell_out', credit_period: 'D.credit_period' };
    const sortKey = sortable[req.query.key] || 'D.distributor_name';
    const sortOrder = (req.query.order && req.query.order.toString().toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
    const replacements = { query: `%${query}%`, limit: pageSize, offset: pageIndex * pageSize };

    const totalRows = await select(
      `select count(*) as count from ${from} left join location_master G on (G.id = D.location_id) ${where}`, replacements
    );
    const rows = await select(
      `select D.*, G.location, E.sales_rep_name from ${from}
       left join location_master G on (G.id = D.location_id)
       left join sales_rep_master E on (E.id = D.sales_rep_id)
       ${where} order by ${sortKey} ${sortOrder} ${pageAll ? '' : 'limit :limit offset :offset'}`,
      replacements
    );

    res.status(200).json({
      message: "Distributors fetched successfully!",
      action: getAction(req),
      total: +totalRows[0].count,
      statusCount,
      rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching distributors failed!";
    next(error, req, res);
  }
};

// Single record by 'd_<id>' (distributor) or 's_<id>' (pending sales rep retailer)
export const getDistributor = async (req, res, next) => {
  try {
    const dId = text(req.params.id);
    const options = await getMasterOptions();
    let distributor = null;
    let contacts = [];
    let consignees = [];
    let beatIds = [];
    let margins = [];

    if (dId.startsWith('s_')) {
      // Old PHP union: sales_rep_distributors mapped onto distributor fields
      const row = await getSalesRepDistributor(+dId.substring(2));
      if (row) {
        distributor = {
          d_id: dId, id: null, distributor_name: row.distributor_name, address: row.address, city: row.city,
          pincode: row.pincode, state: row.state, country: row.country, email_id: null, mobile: row.contact_no,
          tin_number: row.vat_no, cst_number: null, sales_rep_id: row.sales_rep_id, sell_out: row.margin,
          send_invoice: null, credit_period: null, class: null, area_id: row.area_id, type_id: null,
          zone_id: row.zone_id, location_id: row.location_id, status: 'Pending', remarks: row.remarks,
          doc_document: row.doc_document, document_name: row.document_name, state_code: row.state_code,
          gst_number: row.gst_number, latitude: null, longitude: null, google_address: null, tally_name: null,
          marketplace: null, marketplace_id: null, master_distributor_id: row.master_distributor_id, prefix: null
        };
        margins = await getMargins(0);
      }
    } else {
      const id = +dId.replace(/^d_/, '');
      const row = id ? await Distributor.findByPk(id) : null;
      if (row) {
        distributor = { ...row.toJSON(), d_id: `d_${row.id}` };
        contacts = await select(`select contact_person, email_id, mobile from distributor_contacts where distributor_id = :id`, { id });
        consignees = await select(
          `select id, con_name, con_address, con_city, con_pincode, con_state, con_country, con_state_code, con_gst_number
           from distributor_consignee where distributor_id = :id order by id`, { id }
        );
        beatIds = (await select(`select beat_id from distributor_beat_plans where distributor_id = :id`, { id })).map((beat) => beat.beat_id);
        margins = await getMargins(id);
      }
    }

    if (!distributor) {
      return res.status(404).json({ message: "Distributor not found!" });
    }

    return res.status(200).json({ action: getAction(req), distributor, contacts, consignees, beatIds, margins, ...options });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Distributor failed!";
    next(error, req, res);
  }
};
