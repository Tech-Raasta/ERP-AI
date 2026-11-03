// Sales Return line amounts (old PHP distributor_in_details.php get_amount / get_total).
// The backend (controllers/salesReturns.js) recalculates the same way when saving.

export const round = (value, decimals = 2) => {
    const factor = Math.pow(10, decimals)
    return Math.round((+value || 0) * factor) / factor
}

// Sell rate before tax: MRP less (item margin + discount)
export const sellRateFor = (rate, margin, discount, taxPer) => (
    round(((+rate || 0) - ((+rate || 0) * ((+margin || 0) + (+discount || 0))) / 100) / (100 + (+taxPer || 0)) * 100, 4)
)

export const taxTypeFor = (depotState, state) => (
    (depotState || '').toString().trim().toUpperCase() === (state || '').toString().trim().toUpperCase() ? 'Intra' : 'Inter'
)

export const calculateLine = (line, taxType) => {
    const amount = (+line.qty || 0) * (+line.sell_rate || 0)
    const taxPer = +line.tax_per || 0
    return {
        amount: round(amount),
        cgst_amt: taxType === 'Intra' ? round((amount * taxPer) / 2 / 100) : 0,
        sgst_amt: taxType === 'Intra' ? round((amount * taxPer) / 2 / 100) : 0,
        igst_amt: taxType === 'Intra' ? 0 : round((amount * taxPer) / 100),
        tax_amt: round((amount * taxPer) / 100),
        total_amt: round(amount + (amount * taxPer) / 100),
    }
}

export const totalsFor = (lines) => {
    const sum = (key) => round(lines.reduce((total, line) => total + (+line[key] || 0), 0))
    const finalAmount = sum('total_amt')
    return {
        amount: sum('amount'),
        cgst_amount: sum('cgst_amt'),
        sgst_amount: sum('sgst_amt'),
        igst_amount: sum('igst_amt'),
        tax_amount: sum('tax_amt'),
        final_amount: finalAmount,
        round_off_amount: round(Math.round(finalAmount) - finalAmount),
    }
}
