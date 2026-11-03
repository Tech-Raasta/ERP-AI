import React from 'react'
import Barcode from 'react-barcode'
import './BarcodePrint.css'
import Moment from 'react-moment'

const BarcodePrintMultiple = React.forwardRef(({ barcode, rmName }, ref) => {
    return (
        <div ref={ref}>
            {barcode.map((value, index) => {
                return (
                    <div
                        key={index}
                        style={{
                            paddingBottom: '10px',
                            paddingTop: '10px',
                        }}
                    >
                        <p className="text-black text-[7.2px] font-semibold mb-0 mt-0 grid grid-col-1 gap-0 p-[10px] pt-0 pb-0">
                         <span>{rmName} ({value.gross_weight}KG)-({value.net_weight}KG)-(<Moment format="DD-MM-YYYY">{value.expiry_date}</Moment>)</span>
                            {/* <span>RM Name : {rmName}</span>
                            <span>Gross Weight : {value.gross_weight}KG</span>
                            <span>Net Weight : {value.net_weight}KG</span>
                            <span>
                                Exp Date :
                                <Moment format="DD-MM-YYYY">
                                    {value.expiry_date}
                                </Moment>
                            </span> */}
                        </p>
                        <Barcode
                            width={1.5}
                            height={92}
                            type="Code128"
                            value={value.barcode == '' ? '' : value.barcode}
                            fontSize={10}
                            textAlign="center"
                        />
                    </div>
                )
            })}
        </div>
    )
})

export default React.memo(BarcodePrintMultiple)
