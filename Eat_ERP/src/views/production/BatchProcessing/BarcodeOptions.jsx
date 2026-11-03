import { Select } from 'components/ui'
import React from 'react'

const BarcodeOptions = ({index, field, form, options, isLoading, values, getData }) => {
    const handleBarcodeSelect = (option,field,index) =>{
        form.setFieldValue(field.name, option?.value)
        getData({option, field, index})

    }
    return (
        <Select
            className="custom-text-left text-left"
            field={field}
            form={form}
            options={options ? options : []}
            isLoading={isLoading}
            value={ options.filter((option) =>option.value === values.storeReturns[index].barcode)}
            onChange={(option,field) =>handleBarcodeSelect(option,field,index)}
        />
    )
}

export default BarcodeOptions
