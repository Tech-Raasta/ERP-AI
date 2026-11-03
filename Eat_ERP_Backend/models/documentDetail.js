import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

// Shared document rows of the old PHP app (Document_model / table document_details).
// doc_ref_type is the module ('Sales_Rep', ...), doc_ref_id the record id.
// Old PHP files are stored as 'uploads/<type>/...' on the PHP server; files uploaded from the new ERP
// are stored under assets/uploads (path relative to it).
const DocumentDetail = sequelize.define('document_details', {
  doc_ref_id: DataTypes.INTEGER,
  doc_ref_type: DataTypes.STRING,
  doc_type_id: DataTypes.INTEGER,
  doc_doc_id: DataTypes.INTEGER,
  doc_ref_name: DataTypes.STRING,
  doc_description: DataTypes.STRING,
  doc_ref_no: DataTypes.STRING,
  doc_doi: DataTypes.DATEONLY,
  doc_doe: DataTypes.DATEONLY,
  doc_document: DataTypes.STRING,
  document_name: DataTypes.STRING
},
{
  timestamps: false,
  freezeTableName: true
});

// The old PHP app never reads document_details by id, so the model does not assume an id column
DocumentDetail.removeAttribute('id');

const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';
const dateOrNull = (value) => {
  const date = text(value);
  return date && !isNaN(new Date(date).getTime()) ? date.substring(0, 10) : null;
};

// Old PHP insert_doc: delete the record's rows, insert the posted rows that have a document name.
// rows: JSON rows from the form, files: multer files named doc_file_<row index>, folder: upload sub folder.
export const replaceDocuments = async (refType, refId, rows, files, folder, transaction) => {
  await DocumentDetail.destroy({ where: { doc_ref_id: refId, doc_ref_type: refType }, transaction });

  const list = Array.isArray(rows) ? rows : [];
  for (let index = 0; index < list.length; index++) {
    const row = list[index] || {};
    const name = text(row.doc_ref_name);
    if (!name) {
      continue;
    }
    const file = (files || []).find((item) => item.fieldname === `doc_file_${index}`);
    await DocumentDetail.create({
      doc_ref_id: refId,
      doc_ref_type: refType,
      doc_type_id: row.doc_type_id ? +row.doc_type_id : null,
      doc_doc_id: row.doc_doc_id ? +row.doc_doc_id : null,
      doc_ref_name: name,
      doc_description: text(row.doc_description),
      doc_ref_no: text(row.doc_ref_no),
      doc_doi: dateOrNull(row.doc_doi),
      doc_doe: dateOrNull(row.doc_doe),
      doc_document: file ? `${folder}/${file.filename}` : text(row.doc_document),
      document_name: file ? file.originalname : text(row.document_name)
    }, { transaction });
  }
};

export default DocumentDetail;
