
// const newRate = (values, index) => {
//     let discount_rate = 0
//     let new_rate = 0
//     let total = 0
//     // console.log(values.rawMaterialInItems[index])
//     discount_rate =
//         (parseFloat(values.rawMaterialInItems[index].rate) *
//             parseFloat(values.rawMaterialInItems[index].discount)) /
//         100
//     new_rate =
//         parseFloat(values.rawMaterialInItems[index].rate) -
//         parseFloat(discount_rate)
//     total =
//         parseFloat(values.rawMaterialInItems[index].rin_qty) *
//         parseFloat(new_rate)
//     return total
// }

const calcTotal = (e, index) => {
    let discount_rate = 0
    let new_rate = 0
    let total = 0
    // console.log(e)
    formRef.current.setFieldValue(e.target.name, e.target.value)
    discount_rate =
        (parseFloat(
            e.target.name == `rawMaterialInItems[${index}].rate`
                ? e.target.value
                : formRef.current.values.rawMaterialInItems[index].rate
        ) *
            parseFloat(
                e.target.name == `rawMaterialInItems[${index}].discount`
                    ? e.target.value
                    : formRef.current.values.rawMaterialInItems[index]
                        .discount
            )) /
        100
    new_rate =
        parseFloat(
            e.target.name == `rawMaterialInItems[${index}].rate`
                ? e.target.value
                : formRef.current.values.rawMaterialInItems[index].rate
        ) - parseFloat(discount_rate)
    total =
        parseFloat(
            formRef.current.values.rawMaterialInItems[index].rin_qty
        ) * parseFloat(new_rate)
    formRef.current.setFieldValue(
        `rawMaterialInItems[${index}].rin_amount`,
        total
    )
}

const calculate = (values, field) => {
    let total = 0
    values.rawMaterialInItems.map((value) => {
        if (field === 'amt') {
            if (value.rin_amount > 0) {
                total += value.rin_amount
            }
        } else if (field === 'tax_amt') {
            if (value.rin_gst > 0) {
                total += value.rin_gst
            }
        } else if (field === 'total_amt') {
            if (value.rin_total_amount > 0) {
                total += value.rin_total_amount
            }
        }
        return total
    })
    return total
}

const handleTotal = (values, field) => {
    let total = calculate(values, field)
    if (values.rawMaterialInOtherCharges.length > 0) {
        values.rawMaterialInOtherCharges.map((value, index) => {
            if (field === 'tax_amt') {
                if (value.gst > 0) {
                    total += value.gst
                }
            } else if (field === 'total_amt') {
                if (value.total_amount > 0) {
                    total += value.total_amount
                }
            } else if (field === 'amt') {
                if (value.amount > 0) {
                    total += value.amount
                }
            }
            return total
        })
    }
    // console.log(total)
    return total
}

const calcFinalTotal = () => {
    let total_amt = handleTotal(formRef.current.values, 'total_amt')
    let total_tds = formRef.current.values['tds_amt']
    let roundOff =
        Math.round(
            (Math.round(
                total_amt -
                (total_tds == '' ||
                    total_tds == null ||
                    isNaN(total_tds)
                    ? 0
                    : total_tds)
            ) -
                Math.round(
                    (total_amt -
                        (total_tds == '' ||
                            total_tds == null ||
                            isNaN(total_tds)
                            ? 0
                            : total_tds)) *
                    100
                ) /
                100) *
            100
        ) / 100
    formRef.current.setFieldValue('round_off_amt', roundOff)
}

const changeTDSTotal = (e, values) => {
    formRef.current.setFieldValue(e.target.name, e.target.value)
    console.log('amt', values['amt'])
    // let tds_amount =
    //     (handleTotal(values, 'amt') *
    //         parseFloat(
    //             values.tds_per == '' ||
    //                 values.tds_per == NaN ||
    //                 values.tds_per == null
    //                 ? 0
    //                 : values.tds_per
    //         )) /
    //     100
    const tds_per = parseFloat(e.target.value)
    const amount = formRef.current.values['amt']
    const tds_amount = (parseFloat(amount) * parseFloat(tds_per)) / 100
    formRef.current.setFieldValue('tds_amt', tds_amount)
    const roundOff =
        Math.round(
            (Math.round(formRef.current.values.total_amt - tds_amount) -
                Math.round(
                    (formRef.current.values.total_amt - tds_amount) * 100
                ) /
                100) *
            100
        ) / 100
    const net_amount =
        formRef.current.values['total_amt'] - tds_amount + roundOff
    formRef.current.setFieldValue('round_off_amt', roundOff)
    formRef.current.setFieldValue('final_amount', net_amount)
    // const roundOff = roundOffTotoal(values)
    // values['round_off_amt'] = roundOff
}

const handleTDS = (values) => {
    let tds_amount =
        (handleTotal(values, 'amt') *
            parseFloat(
                values.tds_per == '' ||
                    values.tds_per == NaN ||
                    values.tds_per == null
                    ? 0
                    : values.tds_per
            )) /
        100

    return tds_amount
}

const roundOffTotoal = (values) => {
    let total = values['total_amt']
    let total_tds = values['tds_amt']
    let roundOff =
        Math.round(
            (Math.round(
                total -
                (total_tds == '' ||
                    total_tds == null ||
                    isNaN(total_tds)
                    ? 0
                    : total_tds)
            ) -
                Math.round(
                    (total -
                        (total_tds == '' ||
                            total_tds == null ||
                            isNaN(total_tds)
                            ? 0
                            : total_tds)) *
                    100
                ) /
                100) *
            100
        ) / 100
    return roundOff
}

const changeRoundOffTotal = (e) => {
    console.log(e.target.name, e.target.val)
    const tds = formRef.current.values['tds_amt']
    const total_amt = formRef.current.values['total_amt']
    const roundOff = e.target.value
    formRef.current.setFieldValue(e.target.name, e.target.value)
    const final_amount = Math.round(
        Math.round((total_amt - tds) * 100) / 100 + roundOff
    )
    formRef.current.setFieldValue('final_amount', final_amount)
    // return e.target.value
}

const finalAmount = (values) => {
    const total = values.total_amt
    const total_tds = values.tds_amt
    const round_Off_total = values.round_off_amt
    const finalAmount = Math.round(
        Math.round((total - total_tds) * 100) / 100 + round_Off_total
    )
    console.log(total_tds)
    return finalAmount
    // return Math.round(handleTDS(values))
}



(rawMaterialInItems[
    index
].rin_gst =
    (parseFloat(
        rawMaterialInItems[
            index
        ]
            .rin_amount
    ) *
        parseFloat(
            rawMaterialInItems[
                index
            ]
                .rin_gst_rate
        )) /
    100)

    (rawMaterialInItems[
        index
    ].rin_total_amount =
        rawMaterialInItems[
            index
        ]
            .rin_amount +
        rawMaterialInItems[
            index
        ]
            .rin_gst)



            (rawMaterialInOtherCharges[
                index
            ].gst =
                (parseFloat(
                    rawMaterialInOtherCharges[
                        index
                    ]
                        .amount
                ) *
                    parseFloat(
                        rawMaterialInOtherCharges[
                            index
                        ]
                            .tax_per
                    )) /
                100)



                (rawMaterialInOtherCharges[
                    index
                ].total_amount =
                    parseFloat(
                        rawMaterialInOtherCharges[
                            index
                        ]
                            .gst
                    ) +
                    parseFloat(
                        rawMaterialInOtherCharges[
                            index
                        ]
                            .amount
                    ))