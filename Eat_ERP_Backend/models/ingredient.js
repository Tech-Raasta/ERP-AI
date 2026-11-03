import { DataTypes, Op, QueryTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import moment from 'moment/moment.js';
import { round } from '../lib/common.js';

// import Depot from './depot.js';
// import Vendor from './vendor.js';
// import RawMaterial from './rawMaterial.js';
// import PurchaseOrderItem from './purchaseOrderItem.js';
// import PurchaseOrderOtherCharge from './purchaseOrderOtherCharge.js';
import sendEmail from '../lib/email.js';

const Ingredient = sequelize.define('ingredients_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  total_batch_in_grams: DataTypes.DOUBLE,
  per_bar: DataTypes.DOUBLE,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER,
  updated_by: DataTypes.INTEGER,
  updated_date: DataTypes.DATE,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  ref_id: DataTypes.INTEGER,
  packaging: DataTypes.TINYINT,
  control_unit: DataTypes.TEXT,
  grams_per_unit: DataTypes.DOUBLE,
  process_loss: DataTypes.DOUBLE,
  cost_per_gram: DataTypes.DOUBLE,
  total_kgs: DataTypes.DOUBLE,
  total_percent: DataTypes.DOUBLE,
  total_cost: DataTypes.DOUBLE
}, 
{ 
  timestamps: true,
  createdAt: 'created_date',
  updatedAt: 'modified_on',
  freezeTableName: true
});

export const set_raw_material_rate = async function(module='', id='', curusr='') {
  let result = [];
  let remarks = ` Changes in ${module} Master. Ref id - ${id}.`;
  let sql = '';
  let rm_ids = '';

  if(module === 'Raw Material') {
    sql = 'SELECT distinct A.id FROM ' +
          '(select id, rate from raw_material_master where id=(:id)) A ' +
          'left join ' +
          '(select raw_material_id, rate from ingredient_cost_master where raw_material_id=(:id) ' +
          'order by modified_on desc limit 1) B ' +
          'on (A.id=B.raw_material_id) ' +
          'where (A.rate<>B.rate or B.rate is null)';
    result = await sequelize.query(sql, {
      replacements: {id: id},
      type: sequelize.QueryTypes.SELECT
    });

    console.log(result);

    if(result.length > 0){
      sql = 'insert into ingredient_cost_master (raw_material_id, rate, modified_by, modified_on, remarks) ' +
            'select distinct A.id, A.rate, (:curusr), now(), (:remarks) from ' +
            '(select id, rate from raw_material_master where id=(:id)) A ' +
            'left join ' +
            '(select raw_material_id, rate from ingredient_cost_master where raw_material_id=(:id) ' +
            'order by modified_on desc limit 1) B ' +
            'on (A.id=B.raw_material_id) ' +
            'where (A.rate<>B.rate or B.rate is null)';
      await sequelize.query(sql, {
        replacements: {id: id, curusr: curusr, remarks: remarks}
      });
    }
  } else if(module === 'Ingredient Cost') {
    sql = 'select distinct A.id from raw_material_master A ' +
          'left join ingredient_cost_items B on (A.id=B.raw_material_id) ' +
          'where A.id=B.raw_material_id and B.ingredient_cost_id=(:id) and B.modified=1 and A.rate<>B.current_rate';
    result = await sequelize.query(sql, {
      replacements: {id: id},
      type: sequelize.QueryTypes.SELECT
    });

    console.log(result);

    if(result.length > 0){
      sql = 'update raw_material_master A left join ingredient_cost_items B on (A.id=B.raw_material_id) ' +
            'set A.rate=B.current_rate, A.modified_by=(:curusr), A.modified_on=now() ' +
            'where A.id=B.raw_material_id and B.ingredient_cost_id=(:id) and B.modified=1';
      await sequelize.query(sql, {
        replacements: {id: id, curusr: curusr, remarks: remarks}
      });

      sql = 'insert into ingredient_cost_master (raw_material_id, rate, modified_by, modified_on, remarks) ' +
            'select raw_material_id, current_rate, (:curusr), now(), (:remarks) from ingredient_cost_items ' +
            'where ingredient_cost_id=(:id) and modified=1';
      await sequelize.query(sql, {
        replacements: {id: id, curusr: curusr, remarks: remarks}
      });
    }
  } else if(module === 'Raw Material Rate Upload') {
    sql = 'select distinct A.id from raw_material_master A ' +
          'left join raw_material_rate_upload_items B on (A.id=B.raw_material_id) ' +
          'where A.id=B.raw_material_id and B.file_id=(:id) and A.rate<>B.current_rate';
    result = await sequelize.query(sql, {
      replacements: {id: id},
      type: sequelize.QueryTypes.SELECT
    });

    console.log(result);

    if(result.length > 0){
      sql = 'update raw_material_master A left join raw_material_rate_upload_items B on (A.id=B.raw_material_id) ' +
            'set A.rate=B.current_rate, A.modified_by=(:curusr), A.modified_on=now() ' +
            'where A.id=B.raw_material_id and B.file_id=(:id) and A.rate<>B.current_rate';
      await sequelize.query(sql, {
        replacements: {id: id, curusr: curusr, remarks: remarks}
      });
      
      sql = 'insert into ingredient_cost_master (raw_material_id, rate, modified_by, modified_on, remarks) ' +
            'select raw_material_id, current_rate, (:curusr), now(), (:remarks) from raw_material_rate_upload_items ' +
            'where file_id=(:id)';
      await sequelize.query(sql, {
        replacements: {id: id, curusr: curusr, remarks: remarks}
      });
    }
  } else if(module === 'Raw Material In') {
    sql = 'select distinct A.id from raw_material_master A ' +
          'left join raw_material_stock B on (A.id=B.raw_material_id) ' +
          'where A.id=B.raw_material_id and B.raw_material_in_id=(:id) and A.rate=B.rate';
    result = await sequelize.query(sql, {
      replacements: {id: id},
      type: sequelize.QueryTypes.SELECT
    });

    console.log(result);

    if(result.length > 0){
      sql = 'update raw_material_master A left join raw_material_stock B on (A.id=B.raw_material_id) ' +
            'set A.rate=B.rate, A.modified_by=(:curusr), A.modified_on=now() ' +
            'where A.id=B.raw_material_id and B.raw_material_in_id=(:id) and A.rate=B.rate';
      await sequelize.query(sql, {
        replacements: {id: id, curusr: curusr, remarks: remarks}
      });
    }

    sql = 'select distinct A.id from raw_material_master A ' +
          'left join raw_material_stock B on (A.id=B.raw_material_id) ' +
          'where A.id=B.raw_material_id and B.raw_material_in_id=(:id) and (A.rate<>B.rate or A.rate is null)';
    result = await sequelize.query(sql, {
      replacements: {id: id},
      type: sequelize.QueryTypes.SELECT
    });

    console.log(result);

    if(result.length > 0){
      sql = 'insert into ingredient_cost_master (raw_material_id, rate, modified_by, modified_on, remarks) ' +
            'select A.raw_material_id, A.rate, (:curusr), now(), (:remarks) from raw_material_stock A ' +
            'left join raw_material_master B on (A.raw_material_id=B.id) ' +
            'where A.raw_material_in_id=(:id) and A.raw_material_id=B.id and (A.rate<>B.rate or A.rate is null)';
      await sequelize.query(sql, {
        replacements: {id: id, curusr: curusr, remarks: remarks}
      });

      sql = 'update raw_material_master A left join raw_material_stock B on (A.id=B.raw_material_id) ' +
            'set A.rate=B.rate, A.modified_by=(:curusr), A.modified_on=now() ' +
            'where A.id=B.raw_material_id and B.raw_material_in_id=(:id) and (A.rate<>B.rate or A.rate is null)';
      await sequelize.query(sql, {
        replacements: {id: id, curusr: curusr, remarks: remarks}
      });
    }
  }

  rm_ids = result.map(r => r.id).join(',');
  return rm_ids;
}

export const set_products = async function(module='', id='', curusr='') {
  let result = [];
  let ing_ids = '';
  let sql = '';

  if(module === 'Raw Material') {
    sql = `select distinct A.ing_id from ingredients_details A left join raw_material_master B on (A.rm_id=B.id) 
          where A.rm_id='${id}' and B.id='${id}' and A.rm_id=B.id and (A.rate<>B.rate or A.tax_per<>B.tax_per or 
          A.rate is null or A.tax_per is null)`;
    result = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });

    if(result.length > 0){
      sql = `update ingredients_details A left join raw_material_master B on (A.rm_id=B.id) 
            set A.rate=ifnull(B.rate,0), A.tax_per=ifnull(B.tax_per,0), 
            A.cost=round(((ifnull(B.rate,0)+(ifnull(B.rate,0)*ifnull(B.tax_per,0)/100))*ifnull(A.percent,0)/100),2) 
            where A.rm_id='${id}' and B.id='${id}' and A.rm_id=B.id and (A.rate<>B.rate or A.tax_per<>B.tax_per or 
              A.rate is null or A.tax_per is null)`;
      await sequelize.query(sql);
    }
  } else if(module === 'Ingredient Cost') {
    sql = `select distinct A.ing_id from ingredients_details A 
            left join ingredient_cost_items B on (A.rm_id=B.raw_material_id) 
            where A.rm_id=B.raw_material_id and B.ingredient_cost_id='${id}' and 
            B.modified=1 and (A.rate<>B.current_rate or A.rate is null)`;
    result = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });

    if(result.length > 0){
      sql = `update ingredients_details A left join ingredient_cost_items B on (A.rm_id=B.raw_material_id) 
              set A.rate=ifnull(B.rate,0), 
                  A.cost=round(((ifnull(B.rate,0)+(ifnull(B.rate,0)*ifnull(A.tax_per,0)/100))*ifnull(A.percent,0)/100),2) 
              where A.rm_id=B.raw_material_id and B.ingredient_cost_id='${id}' and 
                  B.modified=1 and (A.rate<>B.current_rate or A.rate is null)`;
      await sequelize.query(sql);
    }
  } else if(module === 'Raw Material Rate Upload') {
    sql = `select distinct A.ing_id from ingredients_details A 
            left join raw_material_rate_upload_items B on (A.rm_id=B.raw_material_id) 
            where A.rm_id=B.raw_material_id and B.file_id='${id}' and (A.rate<>B.current_rate or A.rate is null)`;
    result = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });

    if(result.length > 0){
      sql = `update ingredients_details A left join raw_material_rate_upload_items B on (A.rm_id=B.raw_material_id) 
              set A.rate=ifnull(B.current_rate,0), 
                A.cost=round(((ifnull(B.current_rate,0)+(ifnull(B.current_rate,0)*ifnull(A.tax_per,0)/100))*ifnull(A.percent,0)/100),2) 
              where A.rm_id=B.raw_material_id and B.file_id='${id}' and (A.rate<>B.current_rate or A.rate is null)`;
      await sequelize.query(sql);
    }
  } else if(module === 'Raw Material In') {
    sql = `select distinct A.ing_id from ingredients_details A 
            left join raw_material_stock B on (A.rm_id=B.raw_material_id) 
            where A.rm_id=B.raw_material_id and B.raw_material_in_id='${id}' and (A.rate<>B.rate or A.rate is null)`;
    result = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });

    if(result.length > 0){
      sql = `update ingredients_details A left join raw_material_stock B on (A.rm_id=B.raw_material_id) 
              set A.rate=ifnull(B.rate,0), 
                A.cost=round(((ifnull(B.rate,0)+(ifnull(B.rate,0)*ifnull(A.tax_per,0)/100))*ifnull(A.percent,0)/100),2) 
              where A.rm_id=B.raw_material_id and B.raw_material_in_id='${id}' and (A.rate<>B.rate or A.rate is null)`;
      await sequelize.query(sql);
    }
  }

  if(result.length > 0) {
    ing_ids = result.map(r => r.ing_id).join(',');

    if(ing_ids!='') {
      sql = `update ingredients_master AA left join 
            (select B.ing_id, round(sum(B.cost),2) as total_cost from ingredients_details B 
            where B.ing_id in (${ing_ids}) group by B.ing_id) BB 
            on (AA.id=BB.ing_id) 
            set AA.total_cost=BB.total_cost where AA.id=BB.ing_id and AA.id in (${ing_ids})`;
      await sequelize.query(sql);

      sql = `update ingredients_master 
            set cost_per_gram=round(((ifnull(total_cost,0)*(1+(ifnull(process_loss,0)/100)))/1000),4) 
            where id in (${ing_ids})`;
      await sequelize.query(sql);

      sql = `update ingredients_variations A left join ingredients_master B on (A.ing_id=B.id) 
            set A.variation_cost=round((ifnull(A.variation_qty,0)*ifnull(B.cost_per_gram,0)),2) 
            where A.ing_id=B.id and B.id in (${ing_ids}) and A.ing_id in (${ing_ids}) and B.control_unit='Grams'`;
      await sequelize.query(sql);

      sql = `update ingredients_variations A left join ingredients_master B on (A.ing_id=B.id) 
            set A.variation_cost=round((ifnull(A.variation_qty,0)*ifnull(B.grams_per_unit,0)*ifnull(B.cost_per_gram,0)),2) 
            where A.ing_id=B.id and B.id in (${ing_ids}) and A.ing_id in (${ing_ids}) and B.control_unit='Piece'`;
      await sequelize.query(sql);

      sql = `update ingredients_variations 
            set total=round((ifnull(variation_cost,0)+ifnull(labour,0)+ifnull(primary_cost,0)+ifnull(secondary_cost,0)+ifnull(other,0)),2) 
            where ing_id in (${ing_ids})`;
      await sequelize.query(sql);

      sql = `update box_master A left join ingredients_variations B on (A.id=B.box_id) 
            set A.cost=B.total where A.id=B.box_id and B.ing_id in(${ing_ids})`;
      await sequelize.query(sql);
    }
  }

  return ing_ids;
}

export const set_product_rate = async function(module='', ing_ids='', curusr='') {
  let result=[];
  let sql='';
  let remarks = '';

  if(ing_ids!='') {
    sql = `select distinct A.id from 
          (select id, round((grams_per_unit*cost_per_gram),2) as total from ingredients_master where id in (${ing_ids})) A 
          left join 
          (select B.ing_id, B.modified_on, C.rate from 
          (select ing_id, max(modified_on) as modified_on from recipe_cost_master group by ing_id) B 
          left join 
          (select ing_id, rate, modified_on from recipe_cost_master) C 
          on (B.ing_id=C.ing_id and B.modified_on=C.modified_on)) D 
          on (A.id=D.ing_id) 
          where (D.rate is null or A.total<>D.rate)`;
    result = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });

    if(result.length > 0){
      remarks = `Changes in ${module} Master. Ref Ing Id - ${ing_ids}.`;

      sql = `insert into recipe_cost_master (ing_id, product_id, rate, modified_by, modified_on, remarks) 
            select A.id, product_id, A.total, '${curusr}', now(), '${remarks}' from 
            (select id, product_id, round((grams_per_unit*cost_per_gram),2) as total from ingredients_master where id in (${ing_ids})) A 
            left join 
            (select B.ing_id, B.modified_on, C.rate from 
            (select ing_id, max(modified_on) as modified_on from recipe_cost_master group by ing_id) B 
            left join 
            (select ing_id, rate, modified_on from recipe_cost_master) C 
            on (B.ing_id=C.ing_id and B.modified_on=C.modified_on) 
            where C.rate is not null) D 
            on (A.id=D.ing_id) 
            where (D.rate is null or A.total<>D.rate)`;
      await sequelize.query(sql);
    }
  }
  
  result=[];
  if(ing_ids!='') {
    sql = `select distinct A.box_id from 
          (select box_id, total from ingredients_variations where ing_id in (${ing_ids})) A 
          left join 
          (select B.box_id, B.modified_on, C.rate from 
          (select box_id, max(modified_on) as modified_on from product_cost_master group by box_id) B 
          left join 
          (select box_id, rate, modified_on from product_cost_master) C 
          on (B.box_id=C.box_id and B.modified_on=C.modified_on) 
          where C.rate is not null) D 
          on (A.box_id=D.box_id) 
          where (D.rate is null or A.total<>D.rate)`;
    result = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });

    if(result.length > 0){
      remarks = ` Changes in ${module} Master. Ref Ing Id - ${ing_ids}.`;

      sql = `insert into product_cost_master (box_id, rate, modified_by, modified_on, remarks) 
            select A.box_id, A.total, '${curusr}', now(), '${remarks}' from 
            (select box_id, total from ingredients_variations where ing_id in (${ing_ids})) A 
            left join 
            (select B.box_id, B.modified_on, C.rate from 
            (select box_id, max(modified_on) as modified_on from product_cost_master group by box_id) B 
            left join 
            (select box_id, rate, modified_on from product_cost_master) C 
            on (B.box_id=C.box_id and B.modified_on=C.modified_on) 
            where C.rate is not null) D 
            on (A.box_id=D.box_id) 
            where (D.rate is null or A.total<>D.rate)`;
      await sequelize.query(sql);
    }
  }
  
  let box_ids = result.map(r => r.box_id).join(',');

  return box_ids;
}

export const send_updated_variations = async function(rm_ids, ing_ids, box_ids) {
  let table = '';
  let rm_table = '';
  let recipe_table = '';
  let box_table = '';
  let sql = '';
  let result = '';

  if(rm_ids != '') {
    let rm_id_arr = rm_ids.split(',');
    let rm_tr = '';

    for(let i = 0; i < rm_id_arr.length; i++){
      sql = `select A.*, B.rm_name from ingredient_cost_master A 
            left join raw_material_master B on (A.raw_material_id=B.id) 
            where A.raw_material_id='${rm_id_arr[i]}' order by A.modified_on desc limit 2`;
      result = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });
      if(result.length > 0){
        let rate1 = parseFloat(result[0].rate);
        let rate2 = 0;
        let remarks = result[0].remarks;

        if(result.length >1){
          rate2 = parseFloat(result[1].rate);
        }

        let diff = round(rate1 - rate2, 2);
        let span = '';

        if(diff>0) {
          span = `<span style="color: red;">${diff} &#x21E7;</span>`;
        } else {
          span = `<span style="color: green;">${diff} &#x21E9;</span>`;
        }

        rm_tr += `<tr>
                <td>${result[0].rm_name}</td>
                <td>${rate2}</td>
                <td>${rate1}</td>
                <td>${span}</td>
                <td>${remarks}</td>
                </tr>`;
      }
    }

    rm_table = `<br/><br/>
                <table class="body_table" border="1px" style="border-collapse: collapse;">
                    <thead>
                        <tr>
                            <td style="width: 30%;">Raw Material</td>
                            <td style="width: 15%;">Old Rate</td>
                            <td style="width: 15%;">New Rate</td>
                            <td style="width: 15%;">Difference</td>
                            <td style="width: 25%;">Remarks</td>
                        </tr>
                    </thead>
                    <tbody>
                      ${rm_tr}
                    </tbody>
                </table>
                <br/><br/>`;
  }

  if(ing_ids!='') {
    let ing_id_arr = ing_ids.split(',');
    let recipe_tr = '';
    let sql = '';

    for(let i=0; i < ing_id_arr.length; i++){
      sql = `select A.*, C.product_name from recipe_cost_master A 
              left join ingredients_master B on (A.ing_id=B.id) 
              left join product_master C on (B.product_id=C.id) 
              where A.ing_id='${ing_id_arr[i]}' order by A.modified_on desc limit 2`;
      result = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });
      if(result.length > 0){
        let rate1 = parseFloat(result[0].rate);
        let rate2 = 0;

        if(result.length >1){
            rate2 = parseFloat(result[1].rate);
        }

        let diff = round(rate1 - rate2, 2);
        let span = '';

        if(diff>0) {
          span = `<span style="color: red;">${diff} &#x21E7;</span>`;
        } else {
          span = `<span style="color: green;">${diff} &#x21E9;</span>`;
        }

        recipe_tr += `<tr>
                    <td>${result[0].product_name}</td>
                    <td>${rate2}</td>
                    <td>${rate1}</td>
                    <td>${span}</td>
                    </tr>`;
      }
    }

    recipe_table = `<br/><br/>
                    <table class="body_table" border="1px" style="border-collapse: collapse;">
                        <thead>
                            <tr>
                                <td style="width: 40%;">Product</td>
                                <td style="width: 20%;">Old Cost</td>
                                <td style="width: 20%;">New Cost</td>
                                <td style="width: 20%;">Difference</td>
                            </tr>
                        </thead>
                        <tbody>
                          ${recipe_tr}
                        </tbody>
                    </table>
                    <br/><br/>`;
  }

  // if(box_ids!='') {
  //     box_id_arr = box_ids.split(',');
  //     box_tr = '';

  //     for(i=0; i<count(box_id_arr); i++){
  //         sql = `select A.*, B.box_name from product_cost_master A 
  //                 left join box_master B on (A.box_id=B.id) 
  //                 where A.box_id='box_id_arr[i]' order by A.modified_on desc limit 2`;
  //         result = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });
  //         if(result.length > 0){
  //             rate1 = parseFloat(result[0].rate);
  //             rate2 = 0;

  //             if(count(result)>1){
  //                 rate2 = parseFloat(result[1].rate);
  //             }

  //             diff = round(rate1 - rate2,2);

  //             if(diff>0) {
  //                 span = '<span style="color: red;">'.diff.' &#x21E7;</span>';
  //             } else {
  //                 span = '<span style="color: green;">'.diff.' &#x21E9;</span>';
  //             }

  //             box_tr .= '<tr>
  //                         <td>'.result[0].box_name.'</td>
  //                         <td>'.rate2.'</td>
  //                         <td>'.rate1.'</td>
  //                         <td>'.span.'</td>
  //                         </tr>';
  //         }
  //     }

  //     box_table = '<br/><br/>
  //                     <table class="body_table" border="1px" style="border-collapse: collapse;">
  //                         <thead>
  //                             <tr>
  //                                 <td style="width: 40%;">Product</td>
  //                                 <td style="width: 20%;">Old Cost</td>
  //                                 <td style="width: 20%;">New Cost</td>
  //                                 <td style="width: 20%;">Difference</td>
  //                             </tr>
  //                         </thead>
  //                         <tbody>
  //                             '.box_tr.'
  //                         </tbody>
  //                     </table>
  //                     <br/><br/>';
  // }

  if((!rm_ids && rm_ids!='') || (!ing_ids && ing_ids!='')) {
    let message = `<html>
                <head>
                    <style>
                        h3{
                            font-size: 36px;
                            font-family: sans-serif;
                            font-weight: 900;
                            margin-bottom: 15px;
                        }
                        h4{
                            font-size: 24px;
                            font-family: sans-serif;
                            margin-top: 0;
                        }
                        .body_table{
                            cellspacing:0;
                            font-family:sans-serif
                        }
                        .body_table thead tr{
                            background-color:#cfffff;
                        }
                        .body_table thead tr td {
                            width: 40%;
                            font-weight: bold;
                            padding: 10px;
                            text-align: center;
                        }
                        .body_table tbody tr td{
                            padding: 10px;
                        }
                        .body_table tbody tr td:not(:first-child){
                            text-align:center;
                        }
                        .body_table tbody tr td:last-child{
                            font-weight:bold;
                        }
                    </style>
                </head>
                <body>
                    <h3>Wholesome Habits Private Limited</h3>
                    <h4>Product Cost Changes </h4>
                    <br/><br/>

                    ${rm_table}

                    ${recipe_table}                    

                    ${box_table}                    

                    <br/><br/>
                    Regards,
                    <br/><br/>
                    CS
                </body>
                </html>`;
    let from_email = 'cs@eatanytime.in';
    let from_email_sender = 'EAT MIS';

    // let date = new Date().toLocaleDateString();
    let date = moment().format('DD/MM/YYYY');
    let subject = 'Product Cost Changes On ' + date;

    // // to_email = "prasad.bhisale@otbconsulting.co.in";
    // // cc = 'prasad.bhisale@otbconsulting.co.in';
    // // bcc = 'prasad.bhisale@otbconsulting.co.in';

    // to_email = "rishit.sanghvi@eatanytime.in, product@eatanytime.in, prachi.sanghvi@eatanytime.in";
    // cc = 'dhaval.maru@otbconsulting.co.in';
    // bcc = 'prasad.bhisale@otbconsulting.co.in';

    // sleep(1);

    // // echo attachment;
    // // echo '<br/><br/>';
    // // echo message;
    // // echo '<br/><br/>';

    // mailSent=send_email_new(from_email,  from_email_sender, to_email, subject, message, bcc, cc);

    const mailOptions = {
      from: 'EAT MIS <cs@eatanytime.in>',
      to: 'rishit.sanghvi@eatanytime.in, product@eatanytime.in, prachi.sanghvi@eatanytime.in',
      cc: 'dhaval.maru@otbconsulting.co.in',
      bcc: 'prasad.bhisale@otbconsulting.co.in',
      // to: 'technology@raastaconsulting.com',
      // cc: 'technology@raastaconsulting.com',
      // bcc: 'technology@raastaconsulting.com',
      // cc: 'dhaval.maru@otbconsulting.co.in',
      // bcc: 'rishit.sanghvi@eatanytime.in',
      subject: subject,
      text: message,
      html: message,
      // attachments: [{ path: paymentFile }]
    };

    // result = await sendEmail(mailOptions);

    return sendEmail(mailOptions);
  }
}

export default Ingredient;