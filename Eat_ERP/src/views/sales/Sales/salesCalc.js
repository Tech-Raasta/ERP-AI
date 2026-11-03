// Sales amount calculations (old PHP distributor_out_details.php get_amount / get_total).
// The backend (lib/salesCalc.js) recalculates the same way when saving.

export const round = (value, decimals = 2) => {
    const factor = Math.pow(10, decimals)
    return Math.round((+value || 0) * factor) / factor
}

// Intra-state (CGST + SGST) when the depot and the billing state match, else IGST
export const getTaxType = (depotState, state) => (
    (depotState || '').toString().trim().toUpperCase() === (state || '').toString().trim().toUpperCase() ? 'Intra' : 'Inter'
)

// Sell rate (before tax) from the MRP rate and a discount %
export const sellRateFromDiscount = (rate, discount, taxPer) => (
    round(((+rate || 0) - (((+rate || 0) * (+discount || 0)) / 100)) / (100 + (+taxPer || 0)) * 100, 4)
)

// Discount % from a typed sell rate (old PHP set_discount)
export const discountFromSellRate = (rate, sellRate, taxPer) => {
    if (!(+rate)) return 0
    const withTax = (+sellRate || 0) + ((+sellRate || 0) * (+taxPer || 0)) / 100
    return round((((+rate) - withTax) / (+rate)) * 100)
}

export const calculateLine = (line, taxType) => {
    const qty = +line.qty || 0
    const sellRate = +line.sell_rate || 0
    const taxPer = +line.tax_per || 0

    const cgst = taxType === 'Intra' ? taxPer / 2 : 0
    const sgst = taxType === 'Intra' ? taxPer / 2 : 0
    const igst = taxType === 'Intra' ? 0 : taxPer

    const amount = qty * sellRate
    const cgstAmt = round(amount * cgst / 100)
    const sgstAmt = round(amount * sgst / 100)
    const igstAmt = round(amount * igst / 100)
    const taxAmt = round(cgstAmt + sgstAmt + igstAmt)

    return {
        amount: round(amount),
        cgst_amt: cgstAmt,
        sgst_amt: sgstAmt,
        igst_amt: igstAmt,
        tax_amt: taxAmt,
        total_amt: round(taxAmt + amount),
    }
}

// Invoice amount is rounded to the rupee (old PHP get_total)
export const calculateTotals = (lines, shippingCharges) => {
    const sum = (key) => round(lines.reduce((total, line) => total + (+line[key] || 0), 0))
    const finalAmount = sum('total_amt')
    const invoice = finalAmount + (+shippingCharges || 0)
    return {
        amount: sum('amount'),
        cgst_amount: sum('cgst_amt'),
        sgst_amount: sum('sgst_amt'),
        igst_amount: sum('igst_amt'),
        tax_amount: sum('tax_amt'),
        final_amount: finalAmount,
        round_off_amount: round(Math.round(invoice) - round(invoice)),
        invoice_amount: Math.round(invoice),
    }
}
