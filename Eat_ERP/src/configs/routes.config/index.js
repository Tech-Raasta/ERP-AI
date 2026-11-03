import React from 'react'
import authRoute from './authRoute'

export const publicRoutes = [...authRoute]

export const protectedRoutes = [
    {
        key: 'home',
        path: '/home',
        component: React.lazy(() => import('views/Home')),
        authority: [],
        pathName: 'home',
    },

    // Product
    {
        key: 'master.collapse.product',
        path: '/product/product',
        component: React.lazy(() =>
            import('views/product/Product/Product')
        ),
        authority: [],
        pathName: 'product',
    },
    {
        key: 'master.collapse.product',
        path: '/product/product/add-product',
        component: React.lazy(() =>
            import('views/product/Product/AddProductInline')
        ),
        authority: [],
        pathName: 'product',
    },
    {
        key: 'master.collapse.product',
        path: '/product/product/edit-product/:productid',
        component: React.lazy(() =>
            import('views/product/Product/AddProductInline')
        ),
        authority: [],
        pathName: 'product',
    },
    // Category
    {
        key: 'master.collapse.category',
        path: '/product/category',
        component: React.lazy(() =>
            import('views/product/Category/Category')
        ),
        authority: [],
        pathName: 'category',
    },

    // Box
    {
        key: 'master.collapse.box',
        path: '/product/box',
        component: React.lazy(() =>
            import('views/product/Box/Box')
        ),
        authority: [],
        pathName: 'box',
    },
    {
        key: 'master.collapse.box',
        path: '/product/box/add-box',
        component: React.lazy(() =>
            import('views/product/Box/AddEditBox')
        ),
        authority: [],
        pathName: 'box',
    },
    {
        key: 'master.collapse.box',
        path: '/product/box/edit-box/:boxid',
        component: React.lazy(() =>
            import('views/product/Box/AddEditBox')
        ),
        authority: [],
        pathName: 'box',
    },

    // Combo Box
    {
        key: 'master.collapse.combo-box',
        path: '/product/combo-box',
        component: React.lazy(() =>
            import('views/product/ComboBox/ComboBox')
        ),
        authority: [],
        pathName: 'box',
    },
    {
        key: 'master.collapse.combo-box',
        path: '/product/combo-box/add-combo-box',
        component: React.lazy(() =>
            import('views/product/ComboBox/AddEditComboBox')
        ),
        authority: [],
        pathName: 'box',
    },
    {
        key: 'master.collapse.combo-box',
        path: '/product/combo-box/edit-combo-box/:comboboxid',
        component: React.lazy(() =>
            import('views/product/ComboBox/AddEditComboBox')
        ),
        authority: [],
        pathName: 'box',
    },

    // Recipe Master (old PHP Ingredients_master)
    {
        key: 'master.collapse.recipe-master',
        path: '/product/recipe-master',
        component: React.lazy(() =>
            import('views/product/RecipeMaster/RecipeMaster')
        ),
        authority: [],
        pathName: 'recipeMaster',
    },
    {
        key: 'master.collapse.recipe-master',
        path: '/product/recipe-master/add-recipe-master',
        component: React.lazy(() =>
            import('views/product/RecipeMaster/AddEditRecipeMaster')
        ),
        authority: [],
        pathName: 'recipeMaster',
    },
    {
        key: 'master.collapse.recipe-master',
        path: '/product/recipe-master/edit-recipe-master/:recipeid',
        component: React.lazy(() =>
            import('views/product/RecipeMaster/AddEditRecipeMaster')
        ),
        authority: [],
        pathName: 'recipeMaster',
    },

    // Raw Material
    {
        key: 'master.collapse.raw-material',
        path: '/product/raw-material',
        component: React.lazy(() =>
            import('views/product/RawMaterial/RawMaterial')
        ),
        authority: [],
        pathName: 'rawMaterial',
    },
    {
        key: 'master.collapse.raw-material',
        path: '/product/raw-material/add-raw-material',
        component: React.lazy(() =>
            import('views/product/RawMaterial/AddEditRawMaterial')
        ),
        authority: [],
        pathName: 'rawMaterial',
    },
    {
        key: 'master.collapse.raw-material',
        path: '/product/raw-material/edit-raw-material/:rawmaterialid',
        component: React.lazy(() =>
            import('views/product/RawMaterial/AddEditRawMaterial')
        ),
        authority: [],
        pathName: 'rawMaterial',
    },

    // Packaging Material
    {
        key: 'master.collapse.packaging-material',
        path: '/product/packaging-material',
        component: React.lazy(() =>
            import('views/product/PackagingMaterial/PackagingMaterial')
        ),
        authority: [],
        pathName: 'packagingMaterial',
    },
    {
        key: 'master.collapse.packaging-material',
        path: '/product/packaging-material/add-packaging-material',
        component: React.lazy(() =>
            import('views/product/PackagingMaterial/AddEditPackagingMaterial')
        ),
        authority: [],
        pathName: 'packagingMaterial',
    },
    {
        key: 'master.collapse.packaging-material',
        path: '/product/packaging-material/edit-packaging-material/:packagingiaterialid',
        component: React.lazy(() =>
            import('views/product/PackagingMaterial/AddEditPackagingMaterial')
        ),
        authority: [],
        pathName: 'packagingMaterial',
    },

    // Asset (raw_material_master with material_type = 'Asset')
    {
        key: 'master.collapse.asset',
        path: '/product/asset',
        component: React.lazy(() =>
            import('views/product/Asset/Asset')
        ),
        authority: [],
        pathName: 'rawMaterial',
    },
    {
        key: 'master.collapse.asset',
        path: '/product/asset/add-asset',
        component: React.lazy(() =>
            import('views/product/Asset/AddEditAsset')
        ),
        authority: [],
        pathName: 'rawMaterial',
    },
    {
        key: 'master.collapse.asset',
        path: '/product/asset/edit-asset/:assetid',
        component: React.lazy(() =>
            import('views/product/Asset/AddEditAsset')
        ),
        authority: [],
        pathName: 'rawMaterial',
    },

    // Batch Master
    {
        key: 'master.collapse.batch-master',
        path: '/product/batch-master',
        component: React.lazy(() =>
            import('views/product/BatchMaster/BatchMaster')
        ),
        authority: [],
        pathName: 'batchMaster',
    },
    {
        key: 'master.collapse.batch-master',
        path: '/product/batch-master/add-batch-master',
        component: React.lazy(() =>
            import('views/product/BatchMaster/AddEditBatchMaster')
        ),
        authority: [],
        pathName: 'batchMaster',
    },
    {
        key: 'master.collapse.batch-master',
        path: '/product/batch-master/edit-batch-master/:batchmasterid',
        component: React.lazy(() =>
            import('views/product/BatchMaster/AddEditBatchMaster')
        ),
        authority: [],
        pathName: 'batchMaster',
    },


    // Sales Representative (Master -> Sales)
    {
        key: 'master.collapse.sales.sales-rep',
        path: '/sales/sales-rep',
        component: React.lazy(() =>
            import('views/sales/SalesRep/SalesRep')
        ),
        authority: [],
        pathName: 'salesRep',
    },
    {
        key: 'master.collapse.sales.sales-rep',
        path: '/sales/sales-rep/add-sales-rep',
        component: React.lazy(() =>
            import('views/sales/SalesRep/AddEditSalesRep')
        ),
        authority: [],
        pathName: 'salesRep',
    },
    {
        key: 'master.collapse.sales.sales-rep',
        path: '/sales/sales-rep/edit-sales-rep/:salesrepid',
        component: React.lazy(() =>
            import('views/sales/SalesRep/AddEditSalesRep')
        ),
        authority: [],
        pathName: 'salesRep',
    },

    // Distributor / Retailer (Master -> Sales)
    {
        key: 'master.collapse.sales.distributor',
        path: '/sales/distributor',
        component: React.lazy(() =>
            import('views/sales/Distributor/Distributor')
        ),
        authority: [],
        pathName: 'distributor',
    },
    {
        key: 'master.collapse.sales.distributor',
        path: '/sales/distributor/add-distributor',
        component: React.lazy(() =>
            import('views/sales/Distributor/AddEditDistributor')
        ),
        authority: [],
        pathName: 'distributor',
    },
    {
        key: 'master.collapse.sales.distributor',
        path: '/sales/distributor/edit-distributor/:distributorid',
        component: React.lazy(() =>
            import('views/sales/Distributor/AddEditDistributor')
        ),
        authority: [],
        pathName: 'distributor',
    },

    // Distributor Type (Master -> Sales)
    {
        key: 'master.collapse.sales.distributor-type',
        path: '/sales/distributor-type',
        component: React.lazy(() =>
            import('views/sales/DistributorType/DistributorType')
        ),
        authority: [],
        pathName: 'distributorType',
    },

    // Zone (Master -> Sales)
    {
        key: 'master.collapse.sales.zone',
        path: '/sales/zone',
        component: React.lazy(() =>
            import('views/sales/Zone/Zone')
        ),
        authority: [],
        pathName: 'zone',
    },

    // Area (Master -> Sales)
    {
        key: 'master.collapse.sales.area',
        path: '/sales/area',
        component: React.lazy(() =>
            import('views/sales/Area/Area')
        ),
        authority: [],
        pathName: 'area',
    },

    // Location (Master -> Sales)
    {
        key: 'master.collapse.sales.location',
        path: '/sales/location',
        component: React.lazy(() =>
            import('views/sales/Location/Location')
        ),
        authority: [],
        pathName: 'area',
    },

    // Pincode Master (Master -> Global)
    {
        key: 'master.collapse.global.pincode-master',
        path: '/global/pincode-master',
        component: React.lazy(() =>
            import('views/global/PincodeMaster/PincodeMaster')
        ),
        authority: [],
        pathName: 'cityMaster',
    },

    // City Master (Master -> Global)
    {
        key: 'master.collapse.global.city-master',
        path: '/global/city-master',
        component: React.lazy(() =>
            import('views/global/CityMaster/CityMaster')
        ),
        authority: [],
        pathName: 'cityMaster',
    },

    // Vendor Type (Master -> Accounting)
    {
        key: 'master.collapse.accounting.vendor-type',
        path: '/accounting/vendor-type',
        component: React.lazy(() =>
            import('views/accounting/VendorType/VendorType')
        ),
        authority: [],
        pathName: 'vendorType',
    },

    // Expense Category
    {
        key: 'master.collapse.accounting.expense-category',
        path: '/accounting/expense-category',
        component: React.lazy(() =>
            import('views/accounting/ExpenseCategory/ExpenseCategory')
        ),
        authority: [],
        pathName: 'financeVoucher',
    },

    // Vendoor
    {
        key: 'master.collapse.vendor',
        path: '/product/vendor',
        component: React.lazy(() =>
            import('views/product/Vendor/Vendor')
        ),
        authority: [],
        pathName: 'vendor',
    },
    {
        key: 'master.collapse.vendor',
        path: '/product/vendor/add-vendor',
        component: React.lazy(() =>
            import('views/product/Vendor/AddEditVendor')
        ),
        authority: [],
        pathName: 'vendor',
    },
    {
        key: 'master.collapse.vendor',
        path: '/product/vendor/edit-vendor/:vendorid',
        component: React.lazy(() =>
            import('views/product/Vendor/AddEditVendor')
        ),
        authority: [],
        pathName: 'vendor',
    },
    // Depot Master
    {
        key: 'master.collapse.depot',
        path: '/product/depot',
        component: React.lazy(() =>
            import('views/product/Depot/Depot')
        ),
        authority: [],
        pathName: 'product',
    },
    {
        key: 'master.collapse.depot',
        path: '/product/depot/add-depot',
        component: React.lazy(() =>
            import('views/product/Depot/AddEditDepot')
        ),
        authority: [],
        pathName: 'product',
    },
    {
        key: 'master.collapse.depot',
        path: '/product/depot/edit-depot/:depotid',
        component: React.lazy(() =>
            import('views/product/Depot/AddEditDepot')
        ),
        authority: [],
        pathName: 'product',
    },

    // Purchase Order
    {
        key: 'transaction.collapse.purchase-order',
        path: '/transaction/purchase-order',
        component: React.lazy(() => import('views/transaction/PurchaseOrder/PurchaseOrder')),
        authority: [],
        pathName: 'purchaseOrder',
    },
    {
        key: 'transaction.collapse.purchase-order',
        path: '/transaction/purchase-order/add-purchase-order',
        component: React.lazy(() => import('views/transaction/PurchaseOrder/AddEditPurchaseOrder')),
        authority: [],
        pathName: 'purchaseOrder',
    },
    {
        key: 'transaction.collapse.purchase-order',
        path: '/transaction/purchase-order/edit-purchase-order/:purchaseid',
        component: React.lazy(() => import('views/transaction/PurchaseOrder/AddEditPurchaseOrder')),
        authority: [],
        pathName: 'purchaseOrder',
    },
    {
        key: 'transaction.collapse.purchase-order',
        path: '/transaction/purchase-order/view-purchase-order/:purchaseid',
        component: React.lazy(() => import('views/transaction/PurchaseOrder/ViewPurchaseOrder')),
        authority: [],
        pathName: 'purchaseOrder',
    },

    // Production Planning
    {
        key: 'transaction.collapse.production-planning',
        path: '/transaction/production-planning',
        component: React.lazy(() => import('views/transaction/ProductionPlanning/ProductionPlanning')),
        authority: [],
        pathName: 'purchaseOrder',
    },
    {
        key: 'transaction.collapse.production-planning',
        path: '/transaction/production-planning/add-production-planning',
        component: React.lazy(() => import('views/transaction/ProductionPlanning/AddEditProductionPlanning')),
        authority: [],
        pathName: 'purchaseOrder',
    },
    {
        key: 'transaction.collapse.production-planning',
        path: '/transaction/production-planning/edit-production-planning/:productionid',
        component: React.lazy(() => import('views/transaction/ProductionPlanning/AddEditProductionPlanning')),
        authority: [],
        pathName: 'purchaseOrder',
    },
    {
        key: 'transaction.collapse.production-planning',
        path: '/transaction/production-planning/view-production-planning/:productionid',
        component: React.lazy(() => import('views/transaction/ProductionPlanning/ViewProductionPlanning')),
        authority: [],
        pathName: 'purchaseOrder',
    },

    // Raw Material In / Out
    {
        key: 'transaction.collapse.raw-material-in-out',
        path: '/transaction/raw-material-in-out',
        component: React.lazy(() => import('views/transaction/RawMaterialInOut/RawMaterialInOut')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },
    {
        key: 'transaction.collapse.raw-material-in-out',
        path: '/transaction/raw-material-in-out/add-raw-material-in-out',
        component: React.lazy(() => import('views/transaction/RawMaterialInOut/AddEditRawMaterialInOut')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },
    {
        key: 'transaction.collapse.raw-material-in-out',
        path: '/transaction/raw-material-in-out/edit-raw-material-in-out/:rmInOutid',
        component: React.lazy(() => import('views/transaction/RawMaterialInOut/AddEditRawMaterialInOut')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },

    // Depot Transfer
    {
        key: 'transaction.collapse.depot-transfer',
        path: '/transaction/depot-transfer',
        component: React.lazy(() => import('views/transaction/DepotTransfer/DepotTransfer')),
        authority: [],
        pathName: 'depotTransfer',
    },
    {
        key: 'transaction.collapse.depot-transfer',
        path: '/transaction/depot-transfer/add-depot-transfer',
        component: React.lazy(() => import('views/transaction/DepotTransfer/AddEditDepotTransfer')),
        authority: [],
        pathName: 'depotTransfer',
    },
    {
        key: 'transaction.collapse.depot-transfer',
        path: '/transaction/depot-transfer/edit-depot-transfer/:dtid',
        component: React.lazy(() => import('views/transaction/DepotTransfer/AddEditDepotTransfer')),
        authority: [],
        pathName: 'depotTransfer',
    },
    {
        key: 'transaction.collapse.depot-transfer-upload',
        path: '/transaction/depot-transfer-upload',
        component: React.lazy(() => import('views/transaction/DepotTransferUpload/DepotTransferUpload')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },

    // Payment  Upload
    // New Payment Upload (Transaction -> Bank): marketplace settlements
    {
        key: 'transaction.collapse.bank.new-payment-upload',
        path: '/transaction/new-payment-upload',
        component: React.lazy(() => import('views/bank/NewPaymentUpload/NewPaymentUpload')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },
    // Old Payment Upload (Transaction -> Bank, old PHP Payment_upload)
    {
        key: 'transaction.collapse.bank.old-payment-upload',
        path: '/transaction/old-payment-upload',
        component: React.lazy(() => import('views/bank/OldPaymentUpload/OldPaymentUpload')),
        authority: [],
        pathName: 'payment',
    },

    // Raw Material Qty In
    {
        key: 'transaction.collapse.raw-material-qty-in',
        path: '/transaction/raw-material-qty-in',
        component: React.lazy(() => import('views/transaction/RawMaterialQtyIn/RawMaterialQtyIn')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },
    {
        key: 'transaction.collapse.raw-material-qty-in',
        path: '/transaction/raw-material-qty-in/add-raw-material-qty-in',
        component: React.lazy(() => import('views/transaction/RawMaterialQtyIn/AddEditRawMaterialQtyIn')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },
    {
        key: 'transaction.collapse.raw-material-qty-in',
        path: '/transaction/raw-material-qty-in/edit-raw-material-qty-in/:rmqtyinid',
        component: React.lazy(() => import('views/transaction/RawMaterialQtyIn/AddEditRawMaterialQtyIn')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },
    {
        key: 'transaction.collapse.raw-material-qty-in',
        path: '/transaction/raw-material-qty-in/view-raw-material-qty-in/:rmqtyinid',
        component: React.lazy(() => import('views/transaction/RawMaterialQtyIn/ViewRawMaterialQtyIn')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },
    // Goods Received Note
    {
        key: 'transaction.collapse.goods-received-note',
        path: '/transaction/goods-received-note',
        component: React.lazy(() => import('views/transaction/GoodsReceivedNote/GoodsReceivedNote')),
        authority: [],
        pathName: 'invoiceProcessing',
    },
    // {
    //     key: 'transaction.collapse.goods-received-note',
    //     path: '/transaction/goods-received-note/add-goods-received-note',
    //     component: React.lazy(() => import('views/transaction/GoodsReceivedNote/AddEditGoodsReceivedNote')),
    //     authority: [],
    // },
    {
        key: 'transaction.collapse.goods-received-note',
        path: '/transaction/goods-received-note/edit-goods-received-note/:grnid',
        component: React.lazy(() => import('views/transaction/GoodsReceivedNote/AddEditGoodsReceivedNote')),
        authority: [],
        pathName: 'invoiceProcessing',
    },
    {
        key: 'transaction.collapse.goods-received-note',
        path: '/transaction/goods-received-note/view-goods-received-note/:grnid',
        component: React.lazy(() => import('views/transaction/GoodsReceivedNote/ViewGRN')),
        authority: [],
        pathName: 'invoiceProcessing',
    },
    // Finance Voucher
    {
        key: 'transaction.collapse.finance-voucher',
        path: '/transaction/finance-voucher',
        component: React.lazy(() => import('views/transaction/FinanceVoucher/FinanceVoucher')),
        authority: [],
        pathName: 'financeVoucher',
    },
    {
        key: 'transaction.collapse.finance-voucher',
        path: '/transaction/finance-voucher/add-finance-voucher',
        component: React.lazy(() => import('views/transaction/FinanceVoucher/AddFinanceVoucher')),
        authority: [],
        pathName: 'financeVoucher',
    },
    {
        key: 'transaction.collapse.finance-voucher',
        path: '/transaction/finance-voucher/edit-new-finance-voucher/:financeid',
        component: React.lazy(() => import('views/transaction/FinanceVoucher/AddFinanceVoucher')),
        authority: [],
        pathName: 'financeVoucher',
    },
    {
        key: 'transaction.collapse.finance-voucher',
        path: '/transaction/finance-voucher/edit-finance-voucher/:voucherid',
        component: React.lazy(() => import('views/transaction/FinanceVoucher/AddEditFinanceVoucher')),
        authority: [],
        pathName: 'financeVoucher',
    },
    {
        key: 'transaction.collapse.finance-voucher',
        path: '/transaction/finance-voucher/view-finance-voucher/:voucherid',
        component: React.lazy(() => import('views/transaction/FinanceVoucher/ViewFinanceVoucher')),
        authority: [],
        pathName: 'financeVoucher',
    },
    // Vendor Payment
    {
        key: 'transaction.collapse.vendor-payment',
        path: '/transaction/vendor-payment',
        component: React.lazy(() => import('views/transaction/VendorPayment/VendorPayment')),
        authority: [],
        pathName: 'vendorPayment',
    },
    {
        key: 'transaction.collapse.vendor-payment',
        path: '/transaction/vendor-payment/add-vendor-payment',
        component: React.lazy(() => import('views/transaction/VendorPayment/AddEditVendorPayment')),
        authority: [],
        pathName: 'vendorPayment',
    },
    // {
    //     key: 'transaction.collapse.vendor-payment',
    //     path: '/transaction/vendor-payment/edit-vendor-payment/:vendorid',
    //     component: React.lazy(() => import('views/transaction/VendorPayment/AddEditVendorPayment')),
    //     authority: [],
    // },
    {
        key: 'transaction.collapse.vendor-payment',
        path: '/transaction/vendor-payment/edit-vendor-payment/:vendorpaymentid',
        component: React.lazy(() => import('views/transaction/VendorPayment/AddEditVendorPayment')),
        authority: [],
        pathName: 'vendorPayment',
    },
    {
        key: 'transaction.collapse.vendor-payment',
        path: '/transaction/vendor-payment/approved-vendor-payment/:vendorpaymentid',
        component: React.lazy(() => import('views/transaction/VendorPayment/EditVendorPayment')),
        authority: [],
        pathName: 'vendorPayment',
    },

    // Batch Processing (Transaction -> Production, old PHP Batch_processing)
    {
        key: 'transaction.collapse.batch-processing',
        path: '/transaction/batch-processing',
        component: React.lazy(() => import('views/transaction/BatchProcessing/BatchProcessing')),
        authority: [],
        pathName: 'batchProcessing',
    },
    {
        key: 'transaction.collapse.batch-processing',
        path: '/transaction/batch-processing/add',
        component: React.lazy(() => import('views/transaction/BatchProcessing/AddEditBatchProcessing')),
        authority: [],
        pathName: 'batchProcessing',
    },
    {
        key: 'transaction.collapse.batch-processing',
        path: '/transaction/batch-processing/edit/:batchid',
        component: React.lazy(() => import('views/transaction/BatchProcessing/AddEditBatchProcessing')),
        authority: [],
        pathName: 'batchProcessing',
    },

    // Reconcilliation

    {
        key: 'transaction.collapse.reconcilliation',
        path: '/transaction/reconcilliation',
        component: React.lazy(() => import('views/transaction/Reconcilliation/Reconcilliation')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },
    {
        key: 'transaction.collapse.reconcilliation',
        path: '/transaction/reconcilliation/add-reconcilliation',
        component: React.lazy(() => import('views/transaction/Reconcilliation/AddEditReconcilliation')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },
    // Sales (Transaction -> Sales -> Sales, old PHP Distributor_out)
    {
        key: 'transaction.collapse.sales.sales',
        path: '/transaction/sales',
        component: React.lazy(() => import('views/sales/Sales/Sales')),
        authority: [],
        pathName: 'salesOut',
    },
    {
        key: 'transaction.collapse.sales.sales',
        path: '/transaction/sales/view/:saleid',
        component: React.lazy(() => import('views/sales/Sales/ViewSales')),
        authority: [],
        pathName: 'salesOut',
    },
    {
        key: 'transaction.collapse.sales.sales',
        path: '/transaction/sales/add-sales',
        component: React.lazy(() => import('views/sales/Sales/AddEditSales')),
        authority: [],
        pathName: 'salesOut',
    },
    {
        key: 'transaction.collapse.sales.sales',
        path: '/transaction/sales/edit-sales/:saleid',
        component: React.lazy(() => import('views/sales/Sales/AddEditSales')),
        authority: [],
        pathName: 'salesOut',
    },
    {
        key: 'transaction.collapse.sales.sales',
        path: '/transaction/sales/dispatch/:saleid',
        component: React.lazy(() => import('views/sales/Sales/DispatchSales')),
        authority: [],
        pathName: 'salesOut',
    },
    // Sample / Expiry (Transaction -> Sales -> Sample / Expiry, old PHP Sample_out)
    {
        key: 'transaction.collapse.sales.sample-expiry',
        path: '/transaction/sample-expiry',
        component: React.lazy(() => import('views/sales/SampleExpiry/SampleExpiry')),
        authority: [],
        pathName: 'salesOut',
    },
    {
        key: 'transaction.collapse.sales.sample-expiry',
        path: '/transaction/sample-expiry/add-sample-expiry',
        component: React.lazy(() => import('views/sales/SampleExpiry/AddEditSampleExpiry')),
        authority: [],
        pathName: 'salesOut',
    },
    {
        key: 'transaction.collapse.sales.sample-expiry',
        path: '/transaction/sample-expiry/edit-sample-expiry/:sampleid',
        component: React.lazy(() => import('views/sales/SampleExpiry/AddEditSampleExpiry')),
        authority: [],
        pathName: 'salesOut',
    },
    {
        key: 'transaction.collapse.sales.sample-expiry',
        path: '/transaction/sample-expiry/view/:sampleid',
        component: React.lazy(() => import('views/sales/SampleExpiry/ViewSampleExpiry')),
        authority: [],
        pathName: 'salesOut',
    },
    {
        key: 'transaction.collapse.sales.sample-expiry',
        path: '/transaction/sample-expiry/dispatch/:saleid',
        component: React.lazy(() => import('views/sales/SampleExpiry/DispatchSampleExpiry')),
        authority: [],
        pathName: 'salesOut',
    },
    // Sales Return (Transaction -> Sales -> Sales Return, old PHP Distributor_in)
    {
        key: 'transaction.collapse.sales.sales-return',
        path: '/transaction/sales-return',
        component: React.lazy(() => import('views/sales/SaleReturn/SaleReturn')),
        authority: [],
        pathName: 'salesReturn',
    },
    {
        key: 'transaction.collapse.sales.sales-return',
        path: '/transaction/sales-return/add-sales-return',
        component: React.lazy(() => import('views/sales/SaleReturn/AddEditSaleReturn')),
        authority: [],
        pathName: 'salesReturn',
    },
    {
        key: 'transaction.collapse.sales.sales-return',
        path: '/transaction/sales-return/edit-sales-return/:returnid',
        component: React.lazy(() => import('views/sales/SaleReturn/AddEditSaleReturn')),
        authority: [],
        pathName: 'salesReturn',
    },
    {
        key: 'transaction.collapse.sales.sales-return',
        path: '/transaction/sales-return/view/:returnid',
        component: React.lazy(() => import('views/sales/SaleReturn/ViewSaleReturn')),
        authority: [],
        pathName: 'salesReturn',
    },
    // End of Month Sales Details (Transaction -> Sales, old PHP Freezed; Admin only)
    {
        key: 'transaction.collapse.sales.end-of-month-sales',
        path: '/transaction/end-of-month-sales',
        component: React.lazy(() => import('views/sales/EndOfMonthSales/EndOfMonthSales')),
        authority: [],
        pathName: 'endOfMonthSales',
    },
    {
        key: 'transaction.collapse.reconcilliation',
        path: '/transaction/reconcilliation/edit-reconcilliation/:rid',
        component: React.lazy(() => import('views/transaction/Reconcilliation/AddEditReconcilliation')),
        authority: [],
        pathName: 'goodsReceivedNote',
    },



    // Sales Main 

    // Sales
    // {
    //     key: 'sales.collapse.sales',
    //     path: '/sales/sales',
    //     component: React.lazy(() =>
    //         import('views/sales/Sales/Sales')
    //     ),
    //     authority: [],
    //     pathName: 'transaction',
    // },

    // // Add Sales
    // {
    //     key: 'sales.collapse.add-sales',
    //     path: '/sales/sales/add-sales',
    //     component: React.lazy(() =>
    //         import('views/sales/Sales/AddEditSales')
    //     ),
    //     authority: [],
    //     pathName: 'transaction',
    // },

    // // Edit Sales
    // {
    //     key: 'sales.collapse.edit-sales',
    //     path: '/sales/sales/edit-sales/:sid',
    //     component: React.lazy(() =>
    //         import('views/sales/Sales/AddEditSales')
    //     ),
    //     authority: [],
    //     pathName: 'transaction',
    // },




    // Sales Upload (Transaction -> Sales, old PHP Sales_upload)
    {
        key: 'transaction.collapse.sales.sales-upload',
        path: '/transaction/sales-upload',
        component: React.lazy(() =>
            import('views/sales/SalesUpload/SalesUpload')
        ),
        authority: [],
        pathName: 'salesOut',
    },
    // Sales Return Upload (Transaction -> Sales, old PHP Sales_return_upload)
    {
        key: 'transaction.collapse.sales.sales-return-upload',
        path: '/transaction/sales-return-upload',
        component: React.lazy(() =>
            import('views/sales/SalesReturnUpload/SalesReturnUpload')
        ),
        authority: [],
        pathName: 'salesReturn',
    },
    // Payment Details (Transaction -> Bank, old PHP Payment)
    {
        key: 'transaction.collapse.bank.payment-details',
        path: '/transaction/payment-details',
        component: React.lazy(() => import('views/bank/PaymentDetails/PaymentDetails')),
        authority: [],
        pathName: 'payment',
    },
    {
        key: 'transaction.collapse.bank.payment-details',
        path: '/transaction/payment-details/add',
        component: React.lazy(() => import('views/bank/PaymentDetails/AddEditPayment')),
        authority: [],
        pathName: 'payment',
    },
    {
        key: 'transaction.collapse.bank.payment-details',
        path: '/transaction/payment-details/edit/:paymentid',
        component: React.lazy(() => import('views/bank/PaymentDetails/AddEditPayment')),
        authority: [],
        pathName: 'payment',
    },
    // User Roles (User -> User Roles, old PHP User_roles)
    {
        key: 'user.collapse.user-roles',
        path: '/user/user-roles',
        component: React.lazy(() => import('views/user/UserRoles/UserRoles')),
        authority: [],
        pathName: 'userRoles',
    },
    {
        key: 'user.collapse.user-roles',
        path: '/user/user-roles/add',
        component: React.lazy(() => import('views/user/UserRoles/AddEditUserRole')),
        authority: [],
        pathName: 'userRoles',
    },
    {
        key: 'user.collapse.user-roles',
        path: '/user/user-roles/edit/:roleid',
        component: React.lazy(() => import('views/user/UserRoles/AddEditUserRole')),
        authority: [],
        pathName: 'userRoles',
    },
    {
        key: 'user.collapse.user-roles',
        path: '/user/user-roles/copy/:roleid',
        component: React.lazy(() => import('views/user/UserRoles/CopyUserRole')),
        authority: [],
        pathName: 'userRoles',
    },
    // User (User -> User, old PHP User)
    {
        key: 'user.collapse.user',
        path: '/user/user',
        component: React.lazy(() => import('views/user/User/User')),
        authority: [],
        pathName: 'user',
    },
    {
        key: 'user.collapse.user',
        path: '/user/user/add',
        component: React.lazy(() => import('views/user/User/AddEditUser')),
        authority: [],
        pathName: 'user',
    },
    {
        key: 'user.collapse.user',
        path: '/user/user/edit/:userid',
        component: React.lazy(() => import('views/user/User/AddEditUser')),
        authority: [],
        pathName: 'user',
    },
    // Credit Debit Note (Transaction -> Bank, old PHP Credit_debit_note)
    {
        key: 'transaction.collapse.bank.credit-debit-note',
        path: '/transaction/credit-debit-note',
        component: React.lazy(() => import('views/bank/CreditDebitNote/CreditDebitNote')),
        authority: [],
        pathName: 'creditDebitNote',
    },
    {
        key: 'transaction.collapse.bank.credit-debit-note',
        path: '/transaction/credit-debit-note/add',
        component: React.lazy(() => import('views/bank/CreditDebitNote/AddEditCreditDebitNote')),
        authority: [],
        pathName: 'creditDebitNote',
    },
    {
        key: 'transaction.collapse.bank.credit-debit-note',
        path: '/transaction/credit-debit-note/edit/:noteid',
        component: React.lazy(() => import('views/bank/CreditDebitNote/AddEditCreditDebitNote')),
        authority: [],
        pathName: 'creditDebitNote',
    },
    // {
    //     key: 'sales.collapse.ezycom-inventory',
    //     path: '/sales/ezycom-inventory',
    //     component: React.lazy(() =>
    //         import('views/sales/EzycomInventory/EzycomInventory')
    //     ),
    //     authority: [],
    //     pathName: 'transaction',
    // },
    // {
    //     key: 'sales.collapse.ezycom-inventory',
    //     path: '/sales/ezycom-inventory/update-ezycom-inventory/:id',
    //     component: React.lazy(() =>
    //         import('views/sales/EzycomInventory/AddEditEzycomInventory')
    //     ),
    //     authority: [],
    //     pathName: 'transaction',
    // },

    // Production Manager

    {
        key: 'production.collapse.production-manager',
        path: '/production/production-manager',
        component: React.lazy(() => import('views/production/ProductionManager/ProductionManager')),
        authority: [],
        pathName: 'productionManager',
    },
    {
        key: 'production.collapse.production-manager',
        path: '/production/production-manager/view-allocation/:aid',
        component: React.lazy(() => import('views/production/ProductionManager/ViewAllocatedQty')),
        authority: [],
        pathName: 'productionManager',
    },
    {
        key: 'production.collapse.production-manager',
        path: '/production/production-manager/view-transfer/:tid',
        component: React.lazy(() => import('views/production/ProductionManager/ViewTransferQuantity')),
        authority: [],
        pathName: 'productionManager',
    },


    // Production Floor Manager
    {
        key: 'production.collapse.production-floor-manager',
        path: '/production/production-floor-manager',
        component: React.lazy(() => import('views/production/BatchProcessing/BatchProcessing')),
        authority: [],
        pathName: 'productionFloorManager',
    },
    {
        key: 'production.collapse.production-floor-manager',
        path: '/production/production-floor-manager/add-batch/:aid',
        component: React.lazy(() => import('views/production/BatchProcessing/AllocationQuantity')),
        authority: [],
        pathName: 'productionFloorManager',
    },
    {
        key: 'production.collapse.production-floor-manager',
        path: '/production/production-floor-manager/check-batch/:cid',
        component: React.lazy(() => import('views/production/BatchProcessing/CheckBatchQty')),
        authority: [],
        pathName: 'productionFloorManager',
    },
    {
        key: 'production.collapse.production-floor-manager',
        path: '/production/production-floor-manager/check-batch-edit/:cid',
        component: React.lazy(() => import('views/production/BatchProcessing/CheckBatchQtyEdit')),
        authority: [],
        pathName: 'productionFloorManager',
    },
    {
        key: 'production.collapse.production-floor-manager',
        path: '/production/production-floor-manager/approve-batch/:approveid',
        component: React.lazy(() => import('views/production/BatchProcessing/CheckBatchQtyEdit')),
        authority: [],
        pathName: 'productionFloorManager',
    },
    {
        key: 'production.collapse.production-floor-manager',
        path: '/production/production-floor-manager/transfer-batch/:tid',
        component: React.lazy(() => import('views/production/BatchProcessing/TransferQuantity')),
        authority: [],
        pathName: 'productionFloorManager',
    },


    // Request Packaging Material
    {
        key: 'production.collapse.request-packaging-material',
        path: '/production/request-packaging-material',
        component: React.lazy(() => import('views/production/RequestPackagingMaterial/RequestPackagingMaterial')),
        authority: [],
        pathName: 'productionFloorManager',
    },


    // Store Manager 
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager',
        component: React.lazy(() => import('views/production/StoreManager/StoreManager')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/add-material/:mid',
        component: React.lazy(() => import('views/production/StoreManager/AssembleStore')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/edit-material/:editmid',
        component: React.lazy(() => import('views/production/StoreManager/AssembleStore')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/add-batch-material/:bmid',
        component: React.lazy(() => import('views/production/StoreManager/AssembleBatchQty')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/add-batch-material/:bmid/:abmid',
        component: React.lazy(() => import('views/production/StoreManager/AssembleBatchStore')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/add-packaging-material/:bmid',
        component: React.lazy(() => import('views/production/StoreManager/AssemblePackagingQty')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/add-packaging-material/:bmid/:abmid',
        component: React.lazy(() => import('views/production/StoreManager/AssemblePackagingStore')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/receive-transfer/:rtid',
        component: React.lazy(() => import('views/production/StoreManager/ReceiveTransfer')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/receive-transfer/:rtid/sync',
        component: React.lazy(() => import('views/production/StoreManager/SyncToEasyEcomForm')),
        authority: [],
        pathName: 'storeManager',
    },
    // {
    //     key: 'production.collapse.store-manager',
    //     path: '/production/store-manager/add-batch-material/:bmid/:editabmid',
    //     component: React.lazy(() => import('views/production/StoreManager/AssembleBatchStore')),
    //     authority: [],
    //     pathName: 'storeManager',
    // },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/transfer/:tid',
        component: React.lazy(() => import('views/production/StoreManager/Transfer')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/transferPackaging/:tid',
        component: React.lazy(() => import('views/production/StoreManager/TransferPackaging')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/receive/:rid',
        component: React.lazy(() => import('views/production/StoreManager/ReceiveStore')),
        authority: [],
        pathName: 'storeManager',
    },
    {
        key: 'production.collapse.store-manager',
        path: '/production/store-manager/receivePackaging/:rid',
        component: React.lazy(() => import('views/production/StoreManager/ReceivePackagingStore')),
        authority: [],
        pathName: 'storeManager',
    },


    // Production Manager

    {
        key: 'production.collapse.requisition',
        path: '/production/requisition',
        component: React.lazy(() => import('views/production/Requisition/Requisition')),
        authority: [],
        pathName: 'productionManager',
    },
    {
        key: 'production.collapse.requisition',
        path: '/production/requisition/add-requisition',
        component: React.lazy(() => import('views/production/Requisition/AddEditRequisition')),
        authority: [],
        pathName: 'productionManager',
    },
    {
        key: 'production.collapse.requisition',
        path: '/production/requisition/edit-requisition/:rid',
        component: React.lazy(() => import('views/production/Requisition/AddEditRequisition')),
        authority: [],
        pathName: 'productionManager',
    },
    {
        key: 'production.collapse.requisition',
        path: '/production/requisition/raise-requisition/:rid',
        component: React.lazy(() => import('views/production/Requisition/RaiseRequisition')),
        authority: [],
        pathName: 'productionManager',
    },


    // Track Barcode
    {
        key: 'production.collapse.track-barcode',
        path: '/production/track-barcode',
        component: React.lazy(() => import('views/production/TrackBarcode/TrackBarcode')),
        authority: [],
        pathName: 'productionDashboard',
    },


    // Reports
    {
        key: 'reports',
        path: '/reports',
        component: React.lazy(() => import('views/reports/Reports')),
        authority: [],
        pathName: 'reports',
    },
    // Eat Attendance (old PHP Eat_Attendence)
    {
        key: 'attendance',
        path: '/attendance',
        component: React.lazy(() => import('views/attendance/Attendance')),
        authority: [],
        pathName: 'attendance',
    },
    {
        key: 'attendance',
        path: '/attendance/employee/:empNo/:year/:month',
        component: React.lazy(() => import('views/attendance/EmployeeAttendance')),
        authority: [],
        pathName: 'attendance',
    },
    {
        key: 'reports.collapse.report-viewer',
        path: '/reports/view/:key',
        component: React.lazy(() => import('views/reports/ReportViewer')),
        authority: [],
        pathName: 'reports',
    },
    {
        key: 'reports.collapse.production-report',
        path: '/reports/production-report',
        component: React.lazy(() => import('views/reports/ProductionReport')),
        authority: [],
        pathName: 'reports',
    },

]
