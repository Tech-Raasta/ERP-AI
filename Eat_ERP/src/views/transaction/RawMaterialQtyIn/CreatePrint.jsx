import React, { useRef } from 'react'
import BarcodePrint from './BarcodePrint'
import ReactToPrint from 'react-to-print'
import Button from 'components/ui/Buttons'

const CreatePrint = ({ value, rmName }) => {
    const componentRef = useRef()
    // console.log(value)
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
                {' '}
                <BarcodePrint
                    value={value}
                    rmName={rmName}
                    ref={componentRef}
                />
            </div>
        </>
    )
}

export default React.memo(CreatePrint)
