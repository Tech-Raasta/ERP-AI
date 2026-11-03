import { getDate, calculateFiscalYearForDate, getMonthName, round, calculateItemAmount, calculateTransactionAmount } from '../../lib/common.js';

describe('common lib test', function() {
  describe('getDate', function(){
    it('should return proper date in format yyyy-mm-dd', function(){
      const result = getDate('05-02-2024');
      expect(result).toBe('Mon Feb 05 2024');
    });
  });
  describe('calculateFiscalYearForDate', function(){
    it('should return financial year in format yy-yy', function(){
      const result = calculateFiscalYearForDate(new Date('2024-02-05'));
      expect(result).toBe('23-24');
    });
  });
  describe('getMonthName', function(){
    it('should return month for given index', function(){
      const result = getMonthName(1);
      expect(result).toBe('FEB');
    });
  });
  describe('round', function(){
    it('should return round of a number to specified decimal places', function(){
      const result = round(12.56328, 2);
      expect(result).toBe(12.56);
    });
  });
  describe('calculateItemAmount', function(){
    it('should return object of total item amount', function(){
      const result = calculateItemAmount(10, 20, 5, 'Intra');
      expect(result).toEqual(
        expect.objectContaining({ 
          amount: 200, 
          cgst: 2.5, 
          sgst: 2.5, 
          igst: 0, 
          cgst_amt: 5, 
          sgst_amt: 5, 
          igst_amt: 0, 
          tax_amt: 10, 
          total_amt: 210 
        })
      );
    });
  });
  describe('calculateItemAmount', function(){
    it('should return object of total item amount', function(){
      const result = calculateItemAmount(10, 20, 5, 'Inter');
      expect(result).toEqual(
        expect.objectContaining({ 
          amount: 200, 
          cgst: 0, 
          sgst: 0, 
          igst: 5, 
          cgst_amt: 0, 
          sgst_amt: 0, 
          igst_amt: 10, 
          tax_amt: 10, 
          total_amt: 210 
        })
      );
    });
  });
  describe('calculateTransactionAmount', function(){
    it('should return object of total item amount', function(){
      const purchaseOrderItems = [
        { amount: 200.28, cgst_amt: 5.14, sgst_amt: 5.14, igst_amt: 0, tax_amt: 10.28, total_amt: 210.28 },
        { amount: 200.28, cgst_amt: 0, sgst_amt: 0, igst_amt: 10.28, tax_amt: 10.28, total_amt: 210.28 }
      ]
      const result = calculateTransactionAmount(purchaseOrderItems);
      expect(result).toEqual(
        expect.objectContaining({ 
          amount: 400.56, 
          cgst_amount: 5.14, 
          sgst_amount: 5.14, 
          igst_amount: 10.28, 
          tax_amount: 20.56, 
          total_amount: 420.56, 
          round_off_amount: 0.44, 
          final_amount: 421
        })
      );
    });
  });
});