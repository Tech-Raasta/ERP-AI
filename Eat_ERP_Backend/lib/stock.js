import { QueryTypes } from "sequelize";
import sequelize from "./database.js";
import { round } from "./common.js";

class Stock {
  id = 0;
  module = '';
  depot_id = 0;
  box_id = 0;
  qty = 0;
  ref_id = 0;
  stock = 1;

  // constructor(depot_id, box_id) {
  //   this.depot_id = depot_id;
  //   this.box_id = box_id;
  // }

  get id() {
    return this.id;
  }
  set id(id) {
    this.id = id;
  }
  get module() {
    return this.module;
  }
  set module(module) {
    this.module = module;
  }
  get depot_id() {
    return this.depot_id;
  }
  set depot_id(depot_id) {
    this.depot_id = depot_id;
  }
  get box_id() {
    return this.box_id;
  }
  set box_id(box_id) {
    this.box_id = box_id;
  }
  get qty() {
    return this.qty;
  }
  set qty(qty) {
    this.qty = qty;
  }
  get ref_id() {
    return this.ref_id;
  }
  set ref_id(ref_id) {
    this.ref_id = ref_id;
  }
  get stock() {
    return this.stock;
  }
  set stock(stock) {
    this.stock = stock;
  }

  get batch_processing_cond() {
    if (this.module === 'batch_processing') {
      return " and id <> '" + this.id + "'" + (this.ref_id ? " and id <> '" + this.ref_id + "'" : "");
    } else {
      return "";
    }
  }

  get depot_transfer_cond() {
    if (this.module === 'depot_transfer') {
      return " and id <> '" + this.id + "'" + (this.ref_id ? " and id <> '" + this.ref_id + "'" : "");
    } else {
      return "";
    }
  }

  get distributor_in_cond() {
    if (this.module === 'distributor_in') {
      return " and id <> '" + this.id + "'" + (this.ref_id ? " and id <> '" + this.ref_id + "'" : "");
    } else {
      return "";
    }
  }

  get distributor_out_cond() {
    if (this.module === 'distributor_out') {
      return " and id <> '" + this.id + "'" + (this.ref_id ? " and id <> '" + this.ref_id + "'" : "");
    } else {
      return "";
    }
  }

  get box_to_bar_cond() {
    if (this.module === 'box_to_bar') {
      return " and id <> '" + this.id + "'";
    } else {
      return "";
    }
  }

  get bar_to_box_cond() {
    if (this.module === 'bar_to_box') {
      return " and id <> '" + this.id + "'";
    } else {
      return "";
    }
  }

  get box_to_box_cond() {
    if (this.module === 'box_to_box') {
      return " and id <> '" + this.id + "'";
    } else {
      return "";
    }
  }

  get_box_stock = async function() {
    let sql = `select sum(A.tot_qty) as totQtyIn from (select sum(qty) as tot_qty from batch_variations where box_id = '${this.box_id}' and batch_processing_id in (select distinct id from batch_processing where status = 'Approved' and depot_id = '${this.depot_id}' and date_of_processing>'2022-06-05'${this.batch_processing_cond}) union all select sum(qty) as tot_qty from depot_transfer_items where item_id = '${this.box_id}' and type = 'Box' and depot_transfer_id in (select distinct id from depot_transfer where status = 'Approved' and depot_in_id = '${this.depot_id}' and date_of_transfer>'2022-06-05'${this.depot_transfer_cond}) union all select sum(qty) as tot_qty from distributor_in_items where item_id = '${this.box_id}' and type = 'Box' and distributor_in_id in (select distinct id from distributor_in where status = 'Approved' and depot_id = '${this.depot_id}' and date_of_processing>'2022-06-05'${this.distributor_in_cond}) union all select sum(qty) as tot_qty from bar_to_box_qty where box_id = '${this.box_id}' and bar_to_box_id in (select distinct id from bar_to_box where status = 'Approved' and depot_id = '${this.depot_id}' and date_of_processing>'2022-06-05'${this.bar_to_box_cond}) union all select sum(qty_in) as tot_qty from box_to_box where box_in_id = '${this.box_id}' and status = 'Approved' and depot_id = '${this.depot_id}' and date_of_transfer>'2022-06-05'${this.box_to_box_cond}) A`;
    // console.log(sql);
    let result = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });

    let totQtyIn = 0;
    if (result.length > 0){
      totQtyIn = result[0].totQtyIn ? result[0].totQtyIn : 0;
    }

    let sql2 = `select sum(D.tot_qty) as totQtyOut from (select sum(qty) as tot_qty from depot_transfer_items where item_id = '${this.box_id}' and type = 'Box' and depot_transfer_id in (select distinct id from depot_transfer where status = 'Approved' and depot_out_id = '${this.depot_id}' and date_of_transfer>'2022-06-05'${this.depot_transfer_cond}) union all select sum(qty) as tot_qty from distributor_out_items where item_id = '${this.box_id}' and type = 'Box' and distributor_out_id in (select distinct id from distributor_out where status = 'Approved' and depot_id = '${this.depot_id}' and date_of_processing>'2022-06-05'${this.distributor_out_cond}) union all select sum(qty) as tot_qty from box_to_bar_qty where box_id = '${this.box_id}' and box_to_bar_id in (select distinct id from box_to_bar where status = 'Approved' and depot_id = '${this.depot_id}' and date_of_processing>'2022-06-05'${this.box_to_bar_cond}) union all select sum(qty_out) as tot_qty from box_to_box where box_out_id = '${this.box_id}' and status = 'Approved' and depot_id = '${this.depot_id}' and date_of_transfer>'2022-06-05'${this.box_to_box_cond}) D`;
    // console.log(sql2);
    let result2 = await sequelize.query(sql2, {
      type: QueryTypes.SELECT,
    });

    let totQtyOut = 0;
    if (result2.length > 0){
      totQtyOut = result2[0].totQtyOut ? result2[0].totQtyOut : 0;
    }

    const stock = round(totQtyIn-totQtyOut, 2);
    if(this.stock === 1){
        return stock;
    } else {
      if ((stock-this.qty) < 0){
        return 1;
      } else {
        return 0;
      }  
    }
  }
}

export default Stock;