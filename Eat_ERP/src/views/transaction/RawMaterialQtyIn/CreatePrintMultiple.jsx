import React, { useRef } from 'react'
import ReactToPrint from 'react-to-print'
import Button from 'components/ui/Buttons'
import BarcodePrintMultiple from './BarcodePrintMultiple'

const CreatePrintMultiple = ({ code }) => {
    const componentRef = useRef()
    // console.log(code)
    return (
        <>
            <ReactToPrint
                trigger={() => (
                    <Button
                        shape="circle"
                        size="sm"
                        variant="solid"
                        color="blue-600"
                        type="button"
                    >
                        Print Barcode
                    </Button>
                )}
                content={() => componentRef.current}
            />
            <div className="hidden">
                <BarcodePrintMultiple
                    barcode={code.itemWeights}
                    rmName={code.raw_material_name}
                    ref={componentRef}
                />
            </div>
        </>
    )
}

export default React.memo(CreatePrintMultiple)
