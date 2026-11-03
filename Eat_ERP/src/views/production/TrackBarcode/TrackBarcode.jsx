import { Button, Card, Dialog, Input, Notification, toast } from 'components/ui'
import React, { useState } from 'react'
import Scanner from '../StoreManager/Scanner'
import { apiProductionTrackBarcode } from 'services/ProductionService'
import { useHardwareScanner } from 'utils/hooks/useHardwareScanner'

// ── formatters ────────────────────────────────────────────────────────────────

const fmtINR = (value) => {
    if (value === null || value === undefined || value === '') return '—'
    const num = parseFloat(value)
    if (isNaN(num)) return value
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num)
}

const fmtDate = (value) => {
    if (!value) return '—'
    // handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss" formats
    const date = new Date(value)
    if (isNaN(date)) return value
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yyyy = date.getFullYear()
    return `${dd}-${mm}-${yyyy}`
}

const fmtKg = (value) => {
    if (value === null || value === undefined || value === '') return '—'
    return `${parseFloat(value).toFixed(2)} kg`
}

// ── helpers ───────────────────────────────────────────────────────────────────

// const SectionHeader = ({ icon, title, count }) => (
//     <div className="flex items-center gap-2 mb-2">
//         <span className="text-sm">{icon}</span>
//         <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">{title}</h3>
//         {count > 0 && (
//             <span className="text-[10px] font-medium bg-stone-100 text-stone-400 border border-stone-200 rounded-full px-2 py-0.5">
//                 {count}
//             </span>
//         )}
//         <div className="flex-1 h-px bg-stone-100" />
//     </div>
// )

const Td = ({ children, className = '' }) => (
    <td className={`px-3 py-2 text-sm text-stone-700 ${className}`}>{children}</td>
)

const Th = ({ children, className = '' }) => (
    <th className={`px-3 py-2 text-[10px] font-semibold text-stone-400 uppercase tracking-widest text-left bg-stone-50 ${className}`}>
        {children}
    </th>
)

// ── main component ────────────────────────────────────────────────────────────

const TrackBarcode = () => {
    const [barcode, setBarcode] = useState('')
    const [error, setError] = useState('')
    const [scannerIsOpen, setScannerIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [scannedData, setScannedData] = useState({
        batchProcessing: [],
        batchRawMaterial:[],
        depotTransfers: [],
        rawMaterialIn: [],
        rawMaterialInItems: [],
        rawMaterialInOut: [],
        rawMaterialInOutItems: [],
        depotTransferItems: [],
        totalStock: '',
        rmType: ''
    })

    const hasData = scannedData.rawMaterialIn.length > 0

    const handleTrack = () => {
        if (barcode.length !== 18) { setError('Barcode must be exactly 18 digits'); return }
        setIsSubmitting(true)
        apiProductionTrackBarcode(barcode)
            .then((res) => {
                if (res.status === 200) {
                    toast.push(<Notification title="Success" type="success" closable>{res.message}</Notification>)
                    setScannedData({
                        rawMaterialIn: res.data['rawMaterialIn'],
                        rawMaterialInItems: res.data['rawMaterialInItems'],
                        batchProcessing: res.data['batchProcessing'],
                        batchRawMaterial:res.data['batchRawMaterial'],
                        depotTransfers: res.data['depotTransfers'],
                        rawMaterialInOut: res.data['rawMaterialInOut'],
                        rawMaterialInOutItems: res.data['rawMaterialInOutItems'],
                        depotTransferItems: res.data['depotTransferItems'],
                        totalStock: res.data['totalStock'],
                        rmType:res.data['rmType']
                    })
                }
            })
            .catch((err) => {
                toast.push(<Notification title="Error" type="danger" closable>{err.response.data['message']}</Notification>)
            })
            .finally(() => setIsSubmitting(false))
    }

    const handleInputChange = (e) => {
        const value = e.target.value
        if (value.length > 18) return
        setBarcode(value)
        setError(value.length > 0 && value.length < 18 ? `Barcode must be exactly 18 digits (${value.length}/18)` : '')
    }

    const onNewScanResult = (decodedText) => { setScannerIsOpen(false); setBarcode(decodedText) }

    const handleHardwareScan = (decodedText) => {
        setIsSubmitting(true)
        setBarcode(decodedText)
        apiProductionTrackBarcode(decodedText)
            .then((res) => {
                if (res.status === 200) {
                    toast.push(<Notification title="Success" type="success" closable>{res.message}</Notification>)
                    setScannedData({
                        rawMaterialIn: res.data['rawMaterialIn'],
                        rawMaterialInItems: res.data['rawMaterialInItems'],
                        batchProcessing: res.data['batchProcessing'],
                        batchRawMaterial:res.data['batchRawMaterial'],
                        depotTransfers: res.data['depotTransfers'],
                        rawMaterialInOut: res.data['rawMaterialInOut'],
                        rawMaterialInOutItems: res.data['rawMaterialInOutItems'],
                        depotTransferItems: res.data['depotTransferItems'],
                        totalStock: res.data['totalStock'],
                        rmType:res.data['rmType']
                    })
                }
            })
            .catch((err) => {
                toast.push(<Notification title="Error" type="danger" closable>{err.response.data['message']}</Notification>)
            })
            .finally(() => setIsSubmitting(false))
    }
    
    useHardwareScanner(handleHardwareScan);

    // ── render ────────────────────────────────────────────────────────────────

    return (
        <Card className="shadow-sm border border-stone-200 rounded-xl overflow-hidden">

            {/* HEADER */}
            <div className="bg-stone-800 px-5 py-4 flex items-center gap-3 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-emerald-700/80 flex items-center justify-center text-base flex-shrink-0">📦</div>
                <div>
                    <p className="text-[9px] tracking-[0.18em] uppercase text-emerald-400 font-medium leading-none mb-0.5">Inventory · Track</p>
                    <h2 className="text-white font-semibold text-base leading-tight">Barcode Tracker</h2>
                </div>
                {hasData && scannedData.totalStock && (
                    <div className="ml-auto bg-emerald-700/30 border border-emerald-600/40 rounded-full px-3 py-1">
                        <span className="text-emerald-300 text-xs font-medium">Stock: {fmtKg(scannedData.totalStock)}</span>
                    </div>
                )}
            </div>

            {/* SCAN BAR */}
            <div className="px-5 py-3 border-b border-stone-100 bg-white flex flex-wrap items-center justify-center gap-2">
                <div className="min-w-[180px]">
                    <Input
                        type="number"
                        placeholder="Enter or scan 18-digit barcode"
                        value={barcode}
                        onChange={handleInputChange}
                        invalid={!!error}
                        className="text-sm"
                    />
                    {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
                </div>
                <Button variant="default" className="text-sm h-9 px-3 flex gap-1 justify-center items-center" onClick={() => setScannerIsOpen(true)}>
                    <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                        <line x1="7" y1="12" x2="7" y2="12.01"/><line x1="12" y1="12" x2="12" y2="12.01"/><line x1="17" y1="12" x2="17" y2="12.01"/>
                    </svg>
                    Scan
                </Button>
                <Button
                    variant="solid"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm h-9 px-4 disabled:opacity-40"
                    onClick={handleTrack}
                    disabled={isSubmitting || barcode.length !== 18}
                >
                    {isSubmitting
                        ? 
                        <span className="flex items-center gap-1.5">
                            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Tracking…
                        </span>
                        : 'Track Barcode'}
                </Button>
            </div>

            {/* RESULTS */}
            {hasData && (
                <div className="px-5 py-4 space-y-5">

                    {/* RAW MATERIAL INFO */}
                    {scannedData.rawMaterialIn.map((rm, index) => {
                        const item = scannedData.rawMaterialInItems[index]

                        // sum qty for all items sharing the same raw_material_in_id
                        const totalQty = scannedData.rawMaterialInItems.filter((it) => it.raw_material_in_id === rm.id).reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0)
                        return (
                            <div key={index}>
                                <div className="mb-2">
                                    <span className="text-xs text-stone-400">{scannedData.rmType}</span>
                                    <h2 className="text-3xl font-semibold text-stone-800 capitalize">{item?.item_name?.toLowerCase()}</h2>
                                </div>
                                <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-left">
                                        <tbody className="divide-y divide-stone-100">
                                            <tr>
                                                <Th className="w-32">Vendor</Th>
                                                <Td>{rm.vendor_name}</Td>
                                                <Th className="w-32">GRN Date</Th>
                                                <Td>{fmtDate(rm.date_of_receipt)}</Td>
                                                <Th>Final Amount</Th>
                                                <Td className="font-semibold text-emerald-700">{fmtINR(rm.final_amount)}</Td>
                                            </tr>
                                            <tr>
                                                <Th>PO No.</Th>
                                                <Td><span className="text-xs">{rm.po_no}</span></Td>
                                                <Th>Qty (kg)</Th>
                                                <Td>{fmtKg(totalQty)}</Td>
                                                <Th>Avail. Stock</Th>
                                                <Td className="font-semibold text-emerald-700">{fmtKg(scannedData.totalStock)}</Td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    })}
                    {/* PRODUCTION */}
                    {scannedData.batchProcessing.length > 0 && (() => {
                        const totalProductionQty = scannedData.batchProcessing.reduce((total, batch) => {
                            const batchQty = scannedData.batchRawMaterial
                                .filter((brm) => brm.batch_processing_id === batch.id)
                                .reduce((sum, brm) => sum + (parseFloat(brm.qty) || 0), 0)
                            return total + batchQty
                        }, 0)
 
                        return (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm">🏭</span>
                                <h3 className="text-lg font-semibold text-stone-500 uppercase">Production</h3>
                                <span className="text-[10px] font-medium bg-stone-100 text-stone-400 border border-stone-200 rounded-full px-2 py-0.5">
                                    {scannedData.batchProcessing.length}
                                </span>
                                <div className="flex-1 h-px bg-stone-100" />
                                <span className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">Total</span>
                                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                    {fmtKg(parseFloat(totalProductionQty.toFixed(4)))}
                                </span>
                            </div>
                            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-stone-100">
                                            <Th>Product</Th>
                                            <Th>Production Date</Th>
                                            <Th>Batch Code</Th>
                                            <Th className="text-right">Qty (kg)</Th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {scannedData.batchProcessing.map((batch, i) => {
                                            const batchQty = scannedData.batchRawMaterial
                                                .filter((brm) => brm.batch_processing_id === batch.id)
                                                .reduce((sum, brm) => sum + (parseFloat(brm.qty) || 0), 0)
                                            const displayQty = batchQty > 0 ? batchQty : batch.output_kg
                                            return (
                                                <tr key={i} className="hover:bg-stone-50 transition-colors">
                                                    <Td className="font-medium">{batch.product?.product_name}</Td>
                                                    <Td className="text-stone-500">{fmtDate(batch.date_of_processing)}</Td>
                                                    <Td><span className="text-xs text-stone-800">{batch.batch_id_as_per_fssai}</span></Td>
                                                    <Td className="text-right">
                                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2 py-0.5 rounded-md">
                                                            {fmtKg(displayQty)}
                                                        </span>
                                                    </Td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        )
                    })()}

                    {/* DEPOT TRANSFERS */}
                    {scannedData.depotTransfers.length > 0 && (() => {
                        const totalDepotQty = scannedData.depotTransfers.reduce((total, t) => {
                            const tItem = scannedData.depotTransferItems.find((item) => item.depot_transfer_id === t.id)
                            return total + (parseFloat(tItem?.qty) || 0)
                        }, 0)
 
                        return (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm">🚛</span>
                                <h3 className="text-lg font-semibold text-stone-500 uppercase">Depot Transfer</h3>
                                <span className="text-[10px] font-medium bg-stone-100 text-stone-400 border border-stone-200 rounded-full px-2 py-0.5">
                                    {scannedData.depotTransfers.length}
                                </span>
                                <div className="flex-1 h-px bg-stone-100" />
                                <span className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">Total</span>
                                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                    {fmtKg(parseFloat(totalDepotQty.toFixed(4)))}
                                </span>
                            </div>
                            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-stone-100">
                                            <Th>From</Th>
                                            <Th></Th>
                                            <Th>To</Th>
                                            <Th>Transfer Date</Th>
                                            <Th className="text-right">Qty (kg)</Th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {[...scannedData.depotTransfers]
                                            .sort((a, b) => new Date(b.date_of_transfer) - new Date(a.date_of_transfer))
                                            .map((t, i) => {
                                                const tItem = scannedData.depotTransferItems.find(
                                                    (item) => item.depot_transfer_id === t.id
                                                )
                                                return (
                                                <tr key={t.id ?? i} className="hover:bg-stone-50 transition-colors">
                                                    <Td className="font-medium">{t.depot_out?.depot_name}</Td>
                                                    <Td className="text-stone-300 text-center px-0">
                                                        <svg className="w-4 h-4 inline text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    </Td>
                                                    <Td className="font-medium">{t.depot_in?.depot_name}</Td>
                                                    <Td className="text-stone-500">{fmtDate(t.date_of_transfer)}</Td>
                                                    <Td className="text-right">
                                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2 py-0.5 rounded-md">
                                                            {fmtKg(tItem?.qty)}
                                                        </span>
                                                    </Td>
                                                </tr>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        )
                    })()}

                    {/* RAW MATERIAL IN/OUT */}
                    {scannedData.rawMaterialInOut.length > 0 && (() => {
                        const totalRmioQty = scannedData.rawMaterialInOutItems
                            .reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
 
                        return (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm">🔄</span>
                                <h3 className="text-lg font-semibold text-stone-500 uppercase">Raw Material In / Out</h3>
                                <span className="text-[10px] font-medium bg-stone-100 text-stone-400 border border-stone-200 rounded-full px-2 py-0.5">
                                    {scannedData.rawMaterialInOut.length}
                                </span>
                                <div className="flex-1 h-px bg-stone-100" />
                                <span className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">Total</span>
                                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                    {fmtKg(parseFloat(totalRmioQty.toFixed(4)))}
                                </span>
                            </div>
                            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-stone-100">
                                            <Th>Date</Th>
                                            <Th>Type</Th>
                                            <Th className="text-right">Qty (kg)</Th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {scannedData.rawMaterialInOut.map((rm, i) =>
                                            scannedData.rawMaterialInOutItems
                                                .filter((item) => item.raw_material_in_out_id === rm.id)
                                                .map((item, j) => (
                                                    <tr key={`${i}-${j}`} className="hover:bg-stone-50 transition-colors">
                                                        <Td className="text-stone-500">{fmtDate(rm.date_of_processing)}</Td>
                                                        <Td>
                                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                                                item.type?.toLowerCase() === 'in'
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                                            }`}>
                                                                {item.type}
                                                            </span>
                                                        </Td>
                                                        <Td className="text-right">
                                                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2 py-0.5 rounded-md">
                                                                {fmtKg(item.qty)}
                                                            </span>
                                                        </Td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        )
                    })()}

                </div>

            )}

            {/* EMPTY STATE */}
            {!hasData && (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center bg-stone-50">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-xl mb-3">🔍</div>
                    <p className="text-stone-500 text-sm font-medium">Enter or scan a barcode to begin tracking</p>
                    <p className="text-stone-400 text-xs mt-0.5">Results will appear here</p>
                </div>
            )}

            {/* SCANNER DIALOG */}
            <Dialog isOpen={scannerIsOpen} onClose={() => setScannerIsOpen(false)} onRequestClose={() => setScannerIsOpen(false)}>
                {scannerIsOpen ? <Scanner qrCodeSuccessCallback={onNewScanResult} /> : null}
            </Dialog>
        </Card>
    )
}

export default TrackBarcode