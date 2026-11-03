import { getBatchRawMaterialQty, getBatchVariationQty } from "../models/batchProcessing.js";
import { getDepotInStockQty, getDepotOutStockQty } from "../models/depotTransfer.js";
import { getRawMaterialType } from "../models/rawMaterial.js";
import { getGRNStockQty } from "../models/rawMaterialIn.js";
import { getRawMaterialInStockQty, getRawMaterialOutStockQty } from "../models/rawMaterialInOut.js";



export const availableStock = async (raw_material_id, depot_id = null, barcode = null)=>{
    try {
    
        let batchStock = 0;
        let depotInStock = 0;
        let depotOutStock = 0;
        let grnStock = 0;
        let rawMaterialInStock = 0;
        let rawMaterialOutStock = 0;
        let totalStock = 0;
        let rmType = ""
        
        if(raw_material_id) {

          const rawMaterialType = await getRawMaterialType(raw_material_id);
          rmType = rawMaterialType;
          if(rawMaterialType === 'Packaging Material') {
            batchStock = await getBatchVariationQty(raw_material_id, depot_id, barcode);
          }else {
            batchStock = await getBatchRawMaterialQty(raw_material_id, depot_id, barcode);
          }
          depotInStock = await getDepotInStockQty(raw_material_id, depot_id, barcode);
          depotOutStock = await getDepotOutStockQty(raw_material_id, depot_id, barcode);
          grnStock = await getGRNStockQty(raw_material_id, depot_id, barcode);
          rawMaterialInStock = await getRawMaterialInStockQty(raw_material_id, depot_id, barcode);
          rawMaterialOutStock = await getRawMaterialOutStockQty(raw_material_id, depot_id, barcode);
          totalStock =  parseFloat(depotInStock + grnStock + rawMaterialInStock - depotOutStock - rawMaterialOutStock - batchStock).toFixed(2);
        }
    
        return { batchStock, depotInStock, depotOutStock, grnStock, rawMaterialInStock, rawMaterialOutStock, totalStock, rmType };
      } catch (error) {
        console.log("Error fetching available stock:", error);
        throw new Error("Fetching Available Stock failed!");
      }
}