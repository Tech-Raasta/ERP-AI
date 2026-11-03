import React, { useEffect, useMemo, useState } from 'react'
import Button from 'components/ui/Buttons'
import StickyFooter from 'components/shared/StickyFooter'
import AdaptableCard from 'components/shared/AdaptableCard'
import Input from 'components/ui/Input'
import Select from 'components/ui/Select'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, FieldArray, Form, Formik, getIn } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from 'components/ui'
import Table from 'components/ui/Table'
import { HiMinus } from 'react-icons/hi'
import NumberFormat from 'react-number-format'
import toast from 'components/ui/toast'
import Notification from 'components/ui/Notification'
import {
    apiRecipeGetSingle,
    apiRecipeMasterData,
    apiRecipePost,
    apiRecipeUpdate,
} from 'services/RecipeService'

const { Tr, Th, Td, THead, TBody } = Table

// Old PHP Recipe Master form (ingredients_master_details.php + js/ingredients.js).
// Costs are shown live here; the backend recalculates them with the same formulas when saving.

const controlUnitOptions = [
    { value: 'Piece', label: 'Piece' },
    { value: 'Grams', label: 'Grams' },
]

const statusOptions = [
    { value: 'Approved', label: 'Active' },
    { value: 'InActive', label: 'InActive' },
]

// ---- Costing (same formulas and rounding as the old PHP form / backend lib/recipeCosting.js) ----
const num = (value) => {
    const n = parseFloat(value)
    return isNaN(n) ? 0 : n
}
const round = (value, places = 0) => {
    const p = Math.pow(10, places)
    return Math.round(value * p * (1 + Number.EPSILON)) / p
}
const taxedRate = (rate, taxPer) => num(rate) + (num(rate) * num(taxPer) / 100)

const costDetails = (details, rmMap) => {
    const totalKgs = round(details.reduce((sum, detail) => sum + num(detail.qty_per_batch), 0), 4)
    let totalPercent = 0
    let totalCost = 0
    const lines = details.map((detail) => {
        const material = rmMap[detail.rm_id]
        const percent = totalKgs ? round((num(detail.qty_per_batch) / totalKgs) * 100, 2) : 0
        const cost = material ? round((percent * taxedRate(material.rate, material.tax_per)) / 100, 2) : 0
        totalPercent += percent
        totalCost += cost
        return { percent, cost }
    })
    return { lines, totalKgs, totalPercent: Math.round(totalPercent), totalCost: round(totalCost, 2) }
}

const costPerGram = (totalCost, processLoss) => round((num(totalCost) * (1 + (num(processLoss) / 100))) / 1000, 4)
const packagingCost = (qty, rate, taxPer) => round(num(qty) * taxedRate(rate, taxPer), 4)
const variationCost = (controlUnit, qty, gramsPerUnit, cpg) => (
    controlUnit === 'Grams'
        ? round(num(qty) * num(cpg), 2)
        : round(num(qty) * num(gramsPerUnit) * num(cpg), 2)
)
// -------------------------------------------------------------------------------------------------

const requiredNumber = (label) => Yup.number()
    .transform((value, original) => (original === '' ? undefined : value))
    .typeError(`${label} must be a number`)
    .required(`${label} Is Required`)

const optionalNumber = (label) => Yup.number()
    .transform((value, original) => (original === '' ? undefined : value))
    .typeError(`${label} must be a number`)

// Same required fields as the old PHP form (validations.js #form_ingredients_master_details)
const validationSchema = Yup.object().shape({
    product_id: Yup.string().required('Product Is Required'),
    control_unit: Yup.string().required('Control Unit Is Required'),
    grams_per_unit: optionalNumber('Grams Per Unit').when('control_unit', {
        is: 'Piece',
        then: (schema) => schema.required('Grams Per Unit Is Required').moreThan(0, 'Grams Per Unit must be greater than 0'),
    }),
    process_loss: requiredNumber('Process Loss').min(0, 'Process Loss cannot be negative'),
    recipeDetails: Yup.array().of(Yup.object().shape({
        rm_id: Yup.string().required('Raw Material Is Required'),
        qty_per_batch: requiredNumber('Qty').min(0, 'Qty cannot be negative'),
    })).min(1, 'Please add atleast one raw material'),
    recipeVariations: Yup.array().of(Yup.object().shape({
        variation_qty: requiredNumber('Variation Qty').moreThan(0, 'Variation Qty must be greater than 0'),
        labour: requiredNumber('Labour'),
        other: optionalNumber('Other'),
        mrp: requiredNumber('MRP'),
        primary_qty: optionalNumber('Qty'),
        secondary_qty: optionalNumber('Qty'),
        moq_inventory: optionalNumber('MOQ Inventory'),
        moq_production: optionalNumber('MOQ Production'),
    })).min(1, 'Please add atleast one variation'),
})

const emptyDetail = { rm_id: '', qty_per_batch: '' }

const emptyVariation = {
    box_id: '',
    variation_qty: '',
    labour: '',
    primary_packaging_id: '',
    primary_qty: '',
    primary_rate: '',
    primary_tax_per: '',
    secondary_packaging_id: '',
    secondary_qty: '',
    secondary_rate: '',
    secondary_tax_per: '',
    other: '',
    asin: '',
    sku_code: '',
    mrp: '',
    moq_inventory: '',
    moq_production: '',
    box_status: 'Approved',
}

const emptyRecipe = {
    product_id: '',
    control_unit: '',
    grams_per_unit: '',
    process_loss: '',
    remarks: '',
    recipeDetails: [emptyDetail],
    recipeVariations: [],
}

const str = (value) => (value !== null && value !== undefined ? value.toString() : '')

// Same helper as the Purchase Order item table
const fieldFeedback = (form, name) => {
    const error = getIn(form.errors, name)
    const touch = getIn(form.touched, name)
    return {
        errorMessage: error || '',
        invalid: typeof touch === 'undefined' ? false : error && touch,
    }
}

const showError = (message) => {
    toast.push(
        <Notification title="Error" type="danger" closable>
            {message}
        </Notification>
    )
}

// Backend returns either a Sequelize ValidationError ({ errors: [{ path, message }] })
// or a custom error ({ errors: { field: { message } } })
const handleValidationErrors = (errorData, actions) => {
    const errors = errorData && errorData.errors ? errorData.errors : {}
    const list = Array.isArray(errors)
        ? errors.map((err) => ({ path: err.path, message: err.message }))
        : Object.keys(errors).map((key) => ({ path: key, message: errors[key].message }))

    list.forEach((err) => {
        if (err.path !== 'items') {
            actions.setFieldError(err.path, err.message)
        }
        showError(err.message)
    })
}

const moneyText = (value, places = 2) => (
    <NumberFormat
        displayType="text"
        prefix={'₹'}
        thousandsGroupStyle={'lakh'}
        decimalScale={places}
        fixedDecimalScale
        value={value}
        thousandSeparator=","
    />
)

const numberText = (value, places = 2) => (
    <NumberFormat
        displayType="text"
        decimalScale={places}
        fixedDecimalScale
        value={value}
        thousandSeparator=","
    />
)

const AddEditRecipeMaster = () => {
    const [products, setProducts] = useState([])
    const [rawMaterials, setRawMaterials] = useState([])
    const [packagingMaterials, setPackagingMaterials] = useState([])
    const [loading, setLoading] = useState(false)
    const [recipeData, setRecipeData] = useState(emptyRecipe)
    const [canSave, setCanSave] = useState(true)
    const navigate = useNavigate()
    const { recipeid } = useParams()

    const productOptions = useMemo(() => products.map((product) => ({ value: str(product.id), label: product.product_name })), [products])
    const rmOptions = useMemo(() => rawMaterials.map((rm) => ({ value: str(rm.id), label: rm.rm_name })), [rawMaterials])
    const primaryOptions = useMemo(() => packagingMaterials
        .filter((pm) => pm.packaging_type === 'Primary')
        .map((pm) => ({ value: str(pm.id), label: pm.rm_name })), [packagingMaterials])
    const secondaryOptions = useMemo(() => packagingMaterials
        .filter((pm) => pm.packaging_type === 'Secondary')
        .map((pm) => ({ value: str(pm.id), label: pm.rm_name })), [packagingMaterials])

    const rmMap = useMemo(() => {
        const map = {}
        rawMaterials.forEach((rm) => { map[str(rm.id)] = rm })
        return map
    }, [rawMaterials])

    const pmMap = useMemo(() => {
        const map = {}
        packagingMaterials.forEach((pm) => { map[str(pm.id)] = pm })
        return map
    }, [packagingMaterials])

    useEffect(() => {
        setLoading(true)
        const request = recipeid ? apiRecipeGetSingle(recipeid) : apiRecipeMasterData()
        request.then((data) => {
            if (data.status === 200) {
                setProducts(data.data['products'])
                setRawMaterials(data.data['rawMaterials'])
                setPackagingMaterials(data.data['packagingMaterials'])
                if (recipeid) {
                    const recipe = data.data['recipe']
                    setCanSave(data.data['action']['update'])
                    const details = data.data['details'].map((detail) => ({
                        rm_id: str(detail.rm_id),
                        qty_per_batch: str(detail.qty_per_batch),
                    }))
                    const variations = data.data['variations'].map((variation) => {
                        const row = {}
                        for (const key in emptyVariation) {
                            row[key] = str(variation[key])
                        }
                        row.box_status = variation.box_status === 'InActive' ? 'InActive' : 'Approved'
                        row.saved = true
                        return row
                    })
                    setRecipeData({
                        product_id: str(recipe.product_id),
                        control_unit: recipe.control_unit || '',
                        grams_per_unit: str(recipe.grams_per_unit),
                        process_loss: str(recipe.process_loss),
                        remarks: recipe.remarks || '',
                        recipeDetails: details.length ? details : [emptyDetail],
                        recipeVariations: variations,
                    })
                }
            }
            setLoading(false)
        }).catch((error) => {
            setLoading(false)
            if (error.response) {
                showError(error.response.data['message'])
                if (error.response.status === 404) {
                    navigate('/product/recipe-master')
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recipeid])

    const onSubmit = (values, actions) => {
        const payload = {
            product_id: values.product_id,
            control_unit: values.control_unit,
            grams_per_unit: values.control_unit === 'Grams' ? 100 : values.grams_per_unit,
            process_loss: values.process_loss,
            remarks: values.remarks,
            recipeDetails: values.recipeDetails.map((detail) => ({
                rm_id: detail.rm_id,
                qty_per_batch: detail.qty_per_batch,
            })),
            recipeVariations: values.recipeVariations.map(({ saved, ...variation }) => variation),
        }

        const request = recipeid
            ? apiRecipeUpdate({ values: payload, id: recipeid })
            : apiRecipePost(payload)

        request.then((data) => {
            actions.setSubmitting(false)
            if (data.status === 200 || data.status === 201) {
                toast.push(
                    <Notification title="Success" type="success" closable>
                        {data.data['message']}
                    </Notification>
                )
                actions.resetForm()
                navigate('/product/recipe-master')
            }
        }).catch((error) => {
            actions.setSubmitting(false)
            if (!error.response) {
                return
            }
            if (error.response.status === 422) {
                handleValidationErrors(error.response.data['error'], actions)
            } else {
                showError(error.response.data['message'])
            }
        })
    }

    const selectField = (name, options, props = {}) => (
        <Field name={name}>
            {({ field, form }) => (
                <Select
                    field={field}
                    form={form}
                    options={options}
                    isLoading={loading}
                    placeholder="Select"
                    value={options.filter((option) => option.value === field.value)}
                    onChange={(option) => {
                        form.setFieldValue(field.name, option ? option.value : '')
                        if (props.onSelect) {
                            props.onSelect(form, option)
                        }
                    }}
                    isDisabled={props.isDisabled}
                    isClearable={props.isClearable}
                    // Menus open above the scrolling variations table (Select merges `style` into its styles)
                    menuPortalTarget={document.body}
                    style={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                />
            )}
        </Field>
    )

    const cellInput = (name, placeholder, feedback, type = 'number') => (
        <FormItem
            className="mb-0"
            invalid={feedback.invalid}
            layout="vertical"
            errorMessage={feedback.errorMessage}
        >
            <Field
                invalid={feedback.invalid}
                placeholder={placeholder}
                name={name}
                type={type}
                onWheel={(e) => e.target.blur()}
                component={Input}
            />
        </FormItem>
    )

    // Packaging cell: material select + qty + cost (rate / tax come from the packaging master when chosen)
    const packagingCell = (index, prefix, options, variation, errors, touched) => {
        const qty = fieldFeedback({ errors, touched }, `recipeVariations[${index}].${prefix}_qty`)
        return (
            <div className="min-w-[220px]">
                {selectField(`recipeVariations[${index}].${prefix}_packaging_id`, options, {
                    isClearable: true,
                    onSelect: (form, option) => {
                        const material = option ? pmMap[option.value] : null
                        form.setFieldValue(`recipeVariations[${index}].${prefix}_rate`, material ? str(material.rate) : '')
                        form.setFieldValue(`recipeVariations[${index}].${prefix}_tax_per`, material ? str(material.tax_per) : '')
                    },
                })}
                <div className="flex items-start gap-2 mt-1">
                    <div className="w-24">{cellInput(`recipeVariations[${index}].${prefix}_qty`, 'Qty', qty)}</div>
                    <div className="pt-2 whitespace-nowrap">
                        {moneyText(packagingCost(variation[`${prefix}_qty`], variation[`${prefix}_rate`], variation[`${prefix}_tax_per`]), 4)}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <Formik
            enableReinitialize={true}
            initialValues={recipeData}
            validationSchema={validationSchema}
            onSubmit={onSubmit}
        >
            {({ values, touched, errors, isSubmitting }) => {
                const costing = costDetails(values.recipeDetails, rmMap)
                const cpg = costPerGram(costing.totalCost, values.process_loss)
                const gramsPerUnit = values.control_unit === 'Grams' ? 100 : num(values.grams_per_unit)
                // Old PHP: Process Loss Cost and Cost Of 1 Piece / Cost Of 100 Grams
                const processLossCost = round(gramsPerUnit * round((costing.totalCost * (num(values.process_loss) / 100)) / 1000, 4), 2)
                const costOfControlUnit = round(gramsPerUnit * cpg, 2)

                return (
                    <Form autoComplete="off">
                        <FormContainer layout="horizontal" labelWidth={120} size="sm">
                            <div className="mb-4 md:w-full m-auto">
                                <AdaptableCard className="card-shadow">
                                    <h5 className="mb-2">{recipeid ? 'Edit' : 'Add New'} Recipe Master</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                                        <FormItem
                                            asterisk
                                            label="Product"
                                            invalid={errors.product_id && touched.product_id}
                                            errorMessage={errors.product_id}
                                        >
                                            {selectField('product_id', productOptions, { isDisabled: !!recipeid })}
                                        </FormItem>
                                        <FormItem
                                            asterisk
                                            label="Control Unit"
                                            invalid={errors.control_unit && touched.control_unit}
                                            errorMessage={errors.control_unit}
                                        >
                                            {selectField('control_unit', controlUnitOptions, {
                                                onSelect: (form, option) => {
                                                    // Old PHP: Grams means 100 grams per unit; a new recipe starts its variations again
                                                    if (option && option.value === 'Grams') {
                                                        form.setFieldValue('grams_per_unit', '100')
                                                    }
                                                    if (!recipeid) {
                                                        form.setFieldValue('recipeVariations', [])
                                                    }
                                                },
                                            })}
                                        </FormItem>
                                        {values.control_unit !== 'Grams' ? (
                                            <FormItem
                                                asterisk
                                                label="Grams Per Unit"
                                                invalid={errors.grams_per_unit && touched.grams_per_unit}
                                                errorMessage={errors.grams_per_unit}
                                            >
                                                <Field type="number" name="grams_per_unit" placeholder="Grams Per Unit" component={Input} />
                                            </FormItem>
                                        ) : null}
                                        <FormItem
                                            asterisk
                                            label="Process Loss In %"
                                            invalid={errors.process_loss && touched.process_loss}
                                            errorMessage={errors.process_loss}
                                        >
                                            <Field type="number" name="process_loss" placeholder="Process Loss" component={Input} />
                                        </FormItem>
                                    </div>

                                    <Table compact className="border mb-6">
                                        <THead>
                                            <Tr>
                                                <Th>Raw Material*</Th>
                                                <Th>Qty (In Kg)*</Th>
                                                <Th>%</Th>
                                                <Th>Cost</Th>
                                                <Th>Action</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            <FieldArray name="recipeDetails">
                                                {({ remove, push }) => (
                                                    <>
                                                        {values.recipeDetails.map((detail, index) => {
                                                            const rm = fieldFeedback({ errors, touched }, `recipeDetails[${index}].rm_id`)
                                                            const qty = fieldFeedback({ errors, touched }, `recipeDetails[${index}].qty_per_batch`)
                                                            const line = costing.lines[index] || { percent: 0, cost: 0 }
                                                            return (
                                                                <Tr key={index}>
                                                                    <Td width="350">
                                                                        <FormItem
                                                                            className="mb-0 text-left"
                                                                            invalid={rm.invalid}
                                                                            layout="vertical"
                                                                            errorMessage={rm.errorMessage}
                                                                        >
                                                                            {selectField(`recipeDetails[${index}].rm_id`, rmOptions)}
                                                                        </FormItem>
                                                                    </Td>
                                                                    <Td width="150">{cellInput(`recipeDetails[${index}].qty_per_batch`, 'Qty', qty)}</Td>
                                                                    <Td width="120"><p>{numberText(line.percent)}</p></Td>
                                                                    <Td width="150"><p>{moneyText(line.cost)}</p></Td>
                                                                    <Td width="80">
                                                                        <Button
                                                                            shape="circle"
                                                                            size="sm"
                                                                            type="button"
                                                                            icon={<HiMinus />}
                                                                            onClick={() => remove(index)}
                                                                            disabled={values.recipeDetails.length === 1}
                                                                        />
                                                                    </Td>
                                                                </Tr>
                                                            )
                                                        })}
                                                        <Tr>
                                                            <Td colSpan="5" className="text-left">
                                                                <Button
                                                                    type="button"
                                                                    className="ltr:mr-2 rtl:ml-2"
                                                                    onClick={() => push(emptyDetail)}
                                                                >
                                                                    Add Raw Material
                                                                </Button>
                                                                {typeof errors.recipeDetails === 'string' ? (
                                                                    <span className="text-red-500">{errors.recipeDetails}</span>
                                                                ) : null}
                                                            </Td>
                                                        </Tr>
                                                    </>
                                                )}
                                            </FieldArray>
                                            <Tr>
                                                <Td className="text-left font-semibold">Total</Td>
                                                <Td className="font-semibold">{numberText(costing.totalKgs, 4)}</Td>
                                                <Td className="font-semibold">{costing.totalPercent}</Td>
                                                <Td className="font-semibold">{moneyText(costing.totalCost)}</Td>
                                                <Td></Td>
                                            </Tr>
                                            <Tr>
                                                <Td colSpan="3" className="text-right">Process Loss Cost</Td>
                                                <Td>{moneyText(processLossCost)}</Td>
                                                <Td></Td>
                                            </Tr>
                                            <Tr>
                                                <Td colSpan="3" className="text-right">
                                                    {values.control_unit === 'Grams' ? 'Cost Of 100 Grams' : values.control_unit === 'Piece' ? 'Cost Of 1 Piece' : 'Cost'}
                                                </Td>
                                                <Td>{moneyText(costOfControlUnit)}</Td>
                                                <Td></Td>
                                            </Tr>
                                        </TBody>
                                    </Table>

                                    <h5 className="mb-2">Variations</h5>
                                    <div className="overflow-x-auto mb-6">
                                        <Table compact className="border">
                                            <THead>
                                                <Tr>
                                                    <Th>Variation Qty*</Th>
                                                    <Th>Variation Cost</Th>
                                                    <Th>Labour*</Th>
                                                    <Th>Primary Packaging</Th>
                                                    <Th>Secondary Packaging</Th>
                                                    <Th>Other</Th>
                                                    <Th>Total Cost</Th>
                                                    <Th>ASIN</Th>
                                                    <Th>SKU Code</Th>
                                                    <Th>MRP*</Th>
                                                    <Th>MOQ Inventory</Th>
                                                    <Th>MOQ Production</Th>
                                                    <Th>Status</Th>
                                                    <Th>Action</Th>
                                                </Tr>
                                            </THead>
                                            <TBody>
                                                <FieldArray name="recipeVariations">
                                                    {({ remove, push }) => (
                                                        <>
                                                            {values.recipeVariations.map((variation, index) => {
                                                                const field = (key) => fieldFeedback({ errors, touched }, `recipeVariations[${index}].${key}`)
                                                                const vCost = variationCost(values.control_unit, variation.variation_qty, gramsPerUnit, cpg)
                                                                const total = round(
                                                                    vCost + num(variation.labour) + num(variation.other) +
                                                                    packagingCost(variation.primary_qty, variation.primary_rate, variation.primary_tax_per) +
                                                                    packagingCost(variation.secondary_qty, variation.secondary_rate, variation.secondary_tax_per),
                                                                    2
                                                                )
                                                                return (
                                                                    <Tr key={index} className="align-top">
                                                                        <Td><div className="w-24">{cellInput(`recipeVariations[${index}].variation_qty`, 'Qty', field('variation_qty'))}</div></Td>
                                                                        <Td><p className="pt-2 whitespace-nowrap">{moneyText(vCost)}</p></Td>
                                                                        <Td><div className="w-24">{cellInput(`recipeVariations[${index}].labour`, 'Labour', field('labour'))}</div></Td>
                                                                        <Td>{packagingCell(index, 'primary', primaryOptions, variation, errors, touched)}</Td>
                                                                        <Td>{packagingCell(index, 'secondary', secondaryOptions, variation, errors, touched)}</Td>
                                                                        <Td><div className="w-24">{cellInput(`recipeVariations[${index}].other`, 'Other', field('other'))}</div></Td>
                                                                        <Td><p className="pt-2 whitespace-nowrap font-semibold">{moneyText(total)}</p></Td>
                                                                        <Td><div className="w-36">{cellInput(`recipeVariations[${index}].asin`, 'ASIN', field('asin'), 'text')}</div></Td>
                                                                        <Td><div className="w-36">{cellInput(`recipeVariations[${index}].sku_code`, 'SKU Code', field('sku_code'), 'text')}</div></Td>
                                                                        <Td><div className="w-24">{cellInput(`recipeVariations[${index}].mrp`, 'MRP', field('mrp'))}</div></Td>
                                                                        <Td><div className="w-24">{cellInput(`recipeVariations[${index}].moq_inventory`, 'MOQ', field('moq_inventory'))}</div></Td>
                                                                        <Td><div className="w-24">{cellInput(`recipeVariations[${index}].moq_production`, 'MOQ', field('moq_production'))}</div></Td>
                                                                        <Td><div className="w-32">{selectField(`recipeVariations[${index}].box_status`, statusOptions)}</div></Td>
                                                                        <Td>
                                                                            {/* Old PHP: saved variations own a box and cannot be removed */}
                                                                            {!variation.saved ? (
                                                                                <Button
                                                                                    shape="circle"
                                                                                    size="sm"
                                                                                    type="button"
                                                                                    icon={<HiMinus />}
                                                                                    onClick={() => remove(index)}
                                                                                />
                                                                            ) : null}
                                                                        </Td>
                                                                    </Tr>
                                                                )
                                                            })}
                                                            <Tr>
                                                                <Td colSpan="14" className="text-left">
                                                                    <Button
                                                                        type="button"
                                                                        className="ltr:mr-2 rtl:ml-2"
                                                                        onClick={() => push(emptyVariation)}
                                                                    >
                                                                        Add Variation
                                                                    </Button>
                                                                    {typeof errors.recipeVariations === 'string' ? (
                                                                        <span className="text-red-500">{errors.recipeVariations}</span>
                                                                    ) : null}
                                                                </Td>
                                                            </Tr>
                                                        </>
                                                    )}
                                                </FieldArray>
                                            </TBody>
                                        </Table>
                                    </div>

                                    <FormItem
                                        label="Remarks"
                                        invalid={errors.remarks && touched.remarks}
                                        errorMessage={errors.remarks}
                                    >
                                        <Field name="remarks" placeholder="Remarks" textArea component={Input} />
                                    </FormItem>
                                </AdaptableCard>
                            </div>
                        </FormContainer>
                        <StickyFooter
                            className="-mx-1 md:-mx-1 px-8 flex items-center justify-end py-4"
                            stickyClass="border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        >
                            <div className="md:flex items-center">
                                <Button
                                    size="sm"
                                    type="submit"
                                    variant="solid"
                                    className={'ltr:mr-3 rtl:ml-3 ' + (canSave ? '' : 'hidden')}
                                    disabled={isSubmitting || loading}
                                >
                                    Save
                                </Button>
                                <Button size="sm" type="button" onClick={() => navigate('/product/recipe-master')}>
                                    Cancel
                                </Button>
                            </div>
                        </StickyFooter>
                    </Form>
                )
            }}
        </Formik>
    )
}

export default AddEditRecipeMaster
