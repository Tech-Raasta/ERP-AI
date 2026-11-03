import { Button, Card, Dialog, Input, Notification, toast } from 'components/ui'
import React, { useState } from 'react'
import Scanner from '../StoreManager/Scanner'
import { apiProductionTrackBarcode } from 'services/ProductionService'

// ── tiny helpers ──────────────────────────────────────────────────────────────

const SectionHeader = ({ icon, title, count }) => (
    <div className="flex items-center gap-3 mb-4">
        <span className="text-lg">{icon}</span>
        <h3 className="font-semibold text-stone-700 tracking-wide text-sm uppercase">
            {title}
        </h3>
        {count > 0 && (
            <span className="ml-1 text-xs font-medium bg-stone-100 text-stone-500 border border-stone-200 rounded-full px-2.5 py-0.5">
                {count}
            </span>
        )}
        <div className="flex-1 h-px bg-stone-200" />
    </div>
)

const MetaRow = ({ label, value, mono }) => (
    <div className="flex gap-2 items-baseline">
        <span className="text-[10px] uppercase tracking-widest text-stone-400 font-medium min-w-[64px] leading-4">
            {label}
        </span>
        <span className={`text-sm text-stone-600 leading-4 ${mono ? 'font-mono text-xs tracking-wide' : ''}`}>
            {value ?? '—'}
        </span>
    </div>
)

// ── main component ────────────────────────────────────────────────────────────

const TrackBarcode = () => {
    const [barcode, setBarcode] = useState('')
    const [error, setError] = useState('')
    const [scannerIsOpen, setScannerIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [scannedData, setScannedData] = useState({
        batchProcessing: [],
        depotTransfers: [],
        rawMaterialIn: [],
        rawMaterialInItems: [],
        rawMaterialInOut: [],
        rawMaterialInOutItems: [],
        depotTransferItems: [],
        totalStock: '',
    })

    const hasData = scannedData.rawMaterialIn.length > 0

    const handleTrack = () => {
        if (barcode.length !== 18) {
            setError('Barcode must be exactly 18 digits')
            return
        }
        setIsSubmitting(true)
        apiProductionTrackBarcode(barcode)
            .then((res) => {
                if (res.status === 200) {
                    toast.push(
                        <Notification title="Success" type="success" closable>
                            {res.message}
                        </Notification>
                    )
                    setScannedData({
                        rawMaterialIn: res.data['rawMaterialIn'],
                        rawMaterialInItems: res.data['rawMaterialInItems'],
                        batchProcessing: res.data['batchProcessing'],
                        depotTransfers: res.data['depotTransfers'],
                        rawMaterialInOut: res.data['rawMaterialInOut'],
                        rawMaterialInOutItems: res.data['rawMaterialInOutItems'],
                        depotTransferItems: res.data['depotTransferItems'],
                        totalStock: res.data['totalStock'],
                    })
                }
            })
            .catch((err) => {
                toast.push(
                    <Notification title="Error" type="danger" closable>
                        {err.response.data['message']}
                    </Notification>
                )
            })
            .finally(() => setIsSubmitting(false))
    }

    const handleInputChange = (e) => {
        const value = e.target.value
        if (value.length > 18) return
        setBarcode(value)
        if (value.length > 0 && value.length < 18) {
            setError(`Barcode must be exactly 18 digits (${value.length}/18)`)
        } else {
            setError('')
        }
    }

    const onNewScanResult = (decodedText) => {
        setScannerIsOpen(false)
        setBarcode(decodedText)
    }

    // ── render ────────────────────────────────────────────────────────────────

    return (
        <Card className="shadow-sm border border-stone-200 overflow-hidden rounded-2xl">

            {/* ── PAGE HEADER ── */}
            <div className="bg-stone-800 px-6 pt-6 pb-5 relative overflow-hidden">
                {/* subtle diagonal stripe texture */}
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage:
                            'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
                        backgroundSize: '16px 16px',
                    }}
                />
                <div className="relative flex items-end gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-700/80 flex items-center justify-center text-xl flex-shrink-0">
                        📦
                    </div>
                    <div>
                        <p className="text-[10px] tracking-[0.2em] uppercase text-emerald-400 font-medium mb-0.5">
                            Inventory · Track
                        </p>
                        <h2 className="text-white font-semibold text-xl leading-tight">
                            Barcode Tracker
                        </h2>
                    </div>
                    {hasData && scannedData.totalStock && (
                        <div className="ml-auto bg-emerald-700/30 border border-emerald-600/40 rounded-full px-3.5 py-1.5">
                            <span className="text-emerald-300 text-xs font-medium tracking-wide">
                                Stock: {scannedData.totalStock}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── SCAN BAR ── */}
            <div className="px-6 py-4 border-b border-stone-100 bg-white flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[200px]">
                    <Input
                        type="number"
                        placeholder="Enter or scan 18-digit barcode"
                        value={barcode}
                        onChange={handleInputChange}
                        invalid={!!error}
                        className="rounded-lg border-stone-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    {error && (
                        <p className="mt-1 text-xs text-red-500">{error}</p>
                    )}
                </div>
                <Button
                    variant="default"
                    className="rounded-lg border-stone-300 text-stone-600 text-sm h-10 px-4 hover:border-stone-400"
                    onClick={() => setScannerIsOpen(true)}
                >
                    <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                        <line x1="7" y1="12" x2="7" y2="12.01" /><line x1="12" y1="12" x2="12" y2="12.01" /><line x1="17" y1="12" x2="17" y2="12.01" />
                    </svg>
                    Scan
                </Button>
                <Button
                    variant="solid"
                    className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm h-10 px-5 disabled:opacity-40"
                    onClick={handleTrack}
                    disabled={isSubmitting || barcode.length !== 18}
                >
                    {isSubmitting ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Tracking…
                        </span>
                    ) : 'Track'}
                </Button>
            </div>

            {/* ── RESULTS ── */}
            {hasData && (
                <div className="px-6 py-6 space-y-8 bg-stone-50">

                    {/* RAW MATERIAL INFO CARD */}
                    {scannedData.rawMaterialIn.map((rm, index) => {
                        const item = scannedData.rawMaterialInItems[index]
                        return (
                            <div key={index}>
                                {/* Product name as large heading */}
                                <div className="mb-4 flex items-start gap-3">
                                    <div className="flex-1">
                                        <p className="text-[10px] uppercase tracking-widest text-stone-400 font-medium mb-1">
                                            Raw Material
                                        </p>
                                        <h2 className="text-xl font-semibold text-stone-800 leading-tight">
                                            {item?.item_name}
                                        </h2>
                                    </div>
                                </div>

                                {/* Info strip */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone-200 rounded-xl overflow-hidden border border-stone-200">
                                    {[
                                        { label: 'Vendor',      value: rm.vendor_name },
                                        { label: 'Avail. Stock', value: scannedData.totalStock, accent: true },
                                        { label: 'Quantity',    value: item?.qty },
                                        { label: 'GRN Date',    value: rm.date_of_receipt },
                                    ].map(({ label, value, accent }) => (
                                        <div key={label} className="bg-white px-4 py-3.5">
                                            <p className="text-[9px] uppercase tracking-widest text-stone-400 font-medium mb-1">
                                                {label}
                                            </p>
                                            <p className={`text-sm font-semibold leading-tight ${accent ? 'text-emerald-700' : 'text-stone-800'}`}>
                                                {value ?? '—'}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Secondary info */}
                                <div className="mt-3 flex flex-wrap gap-4 px-1">
                                    <MetaRow label="PO No." value={rm.po_no} mono />
                                    <MetaRow label="Final Amt." value={rm.final_amount} />
                                </div>
                            </div>
                        )
                    })}

                    {/* ── PRODUCTION BATCHES ── */}
                    {scannedData.batchProcessing.length > 0 && (
                        <div>
                            <SectionHeader icon="🏭" title="Production" count={scannedData.batchProcessing.length} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                {scannedData.batchProcessing.map((batch, i) => (
                                    <div
                                        key={i}
                                        className="bg-white border border-stone-200 rounded-xl px-4 py-4 relative overflow-hidden
                                                   hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                                    >
                                        {/* left accent bar */}
                                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500 rounded-l-xl" />

                                        {/* qty badge */}
                                        <div className="absolute top-3.5 right-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700
                                                        text-sm font-bold px-2.5 py-1 rounded-lg leading-none">
                                            {batch.output_kg}
                                        </div>

                                        <p className="text-[13px] font-semibold text-stone-700 leading-snug pr-14 mb-3">
                                            {batch.product?.product_name}
                                        </p>
                                        <div className="space-y-1.5">
                                            <MetaRow label="Date" value={batch.date_of_processing} />
                                            <MetaRow label="Batch" value={batch.batch_id_as_per_fssai} mono />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── DEPOT TRANSFERS ── */}
                    {scannedData.depotTransfers.length > 0 && (
                        <div>
                            <SectionHeader icon="🚛" title="Depot Transfer" count={scannedData.depotTransfers.length} />
                            <div className="space-y-2.5">
                                {scannedData.depotTransfers.map((t, i) => {
                                    const tItem = scannedData.depotTransferItems[i]
                                    return (
                                        <div
                                            key={i}
                                            className="bg-white border border-stone-200 rounded-xl px-5 py-4 flex flex-wrap items-center gap-4
                                                       hover:shadow-sm transition-shadow duration-200"
                                        >
                                            {/* FROM */}
                                            <div className="min-w-[120px]">
                                                <p className="text-[9px] uppercase tracking-widest text-stone-400 font-medium mb-0.5">From</p>
                                                <p className="text-sm font-semibold text-stone-700">{t.depot_in?.depot_name}</p>
                                            </div>

                                            {/* ARROW */}
                                            <div className="text-emerald-500 flex-shrink-0">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>

                                            {/* TO */}
                                            <div className="min-w-[120px]">
                                                <p className="text-[9px] uppercase tracking-widest text-stone-400 font-medium mb-0.5">To</p>
                                                <p className="text-sm font-semibold text-stone-700">{t.depot_out?.depot_name}</p>
                                            </div>

                                            {/* SPACER */}
                                            <div className="flex-1" />

                                            {/* DATE + QTY */}
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-[11px] text-stone-400 mb-1">{t.date_of_transfer}</p>
                                                <span className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-700
                                                                 text-sm font-bold px-3 py-0.5 rounded-full">
                                                    {tItem?.qty}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── RAW MATERIAL IN/OUT ── */}
                    {scannedData.rawMaterialInOut.length > 0 && (
                        <div>
                            <SectionHeader icon="🔄" title="Raw Material In / Out" count={scannedData.rawMaterialInOut.length} />
                            <div className="space-y-2.5">
                                {scannedData.rawMaterialInOut.map((rm, i) => {
                                    const relatedItems = scannedData.rawMaterialInOutItems.filter(
                                        (item) => item.raw_material_in_out_id === rm.id
                                    )
                                    return relatedItems.map((item, j) => (
                                        <div
                                            key={`${i}-${j}`}
                                            className="bg-white border border-stone-200 rounded-xl px-5 py-4 flex flex-wrap items-center gap-6
                                                       hover:shadow-sm transition-shadow duration-200"
                                        >
                                            {/* Type pill */}
                                            <div>
                                                <p className="text-[9px] uppercase tracking-widest text-stone-400 font-medium mb-1">Type</p>
                                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                                    item.type?.toLowerCase() === 'in'
                                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}>
                                                    {item.type}
                                                </span>
                                            </div>
                                            <MetaRow label="Date" value={rm.date_of_processing} />
                                            <div className="flex-1" />
                                            <div className="text-right">
                                                <p className="text-[9px] uppercase tracking-widest text-stone-400 font-medium mb-1">Quantity</p>
                                                <p className="text-sm font-bold text-stone-700">{item.qty}</p>
                                            </div>
                                        </div>
                                    ))
                                })}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* ── EMPTY STATE ── */}
            {!hasData && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-stone-50">
                    <div className="w-14 h-14 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center text-2xl mb-4">
                        🔍
                    </div>
                    <p className="text-stone-500 text-sm font-medium">Enter or scan a barcode to begin tracking</p>
                    <p className="text-stone-400 text-xs mt-1">Results will appear here</p>
                </div>
            )}

            {/* ── SCANNER DIALOG ── */}
            <Dialog
                isOpen={scannerIsOpen}
                onClose={() => setScannerIsOpen(false)}
                onRequestClose={() => setScannerIsOpen(false)}
            >
                {scannerIsOpen ? (
                    <Scanner qrCodeSuccessCallback={onNewScanResult} />
                ) : null}
            </Dialog>
        </Card>
    )
}

export default TrackBarcode