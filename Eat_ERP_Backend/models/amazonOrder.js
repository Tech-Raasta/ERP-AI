const { Schema, model } = require("mongoose");

const amazonReportSchema = Schema({
  AmazonOrderId: {
    type: String,
    required: true
  },
  SellerOrderId: {
    type: String,
    // required: true
  },
  PurchaseDate: {
    type: String,
    // required: true
  },
  LastUpdateDate: {
    type: String,
    // required: true
  },
  OrderStatus: {
    type: String,
    // required: true
  },
  FulfillmentChannel: {
    type: String,
    // required: true
  },
  SalesChannel: {
    type: String,
    // required: true
  },
  OrderChannel: {
    type: String,
    // required: true
  },
  ShipServiceLevel: {
    type: String,
    // required: true
  },
  OrderTotal: {
    CurrencyCode: {
      type: String
    },
    Amount: {
      type: String
    }
  },
  NumberOfItemsShipped: {
    type: Number
  },
  NumberOfItemsUnshipped: {
    type: Number
  },
  PaymentExecutionDetail: {
    type: String
  },
  PaymentMethod: {
    type: String
  },
  PaymentMethodDetails: [{
    Payment: {
      CurrencyCode: {
        type: String
      },
      Amount: {
        type: String
      }
    },
    PaymentMethod: {
      type: String
    }
  }],
  MarketplaceId: {
    type: String
  },
  ShipmentServiceLevelCategory: {
    type: String
  },
  EasyShipShipmentStatus: {
    type: String
  },
  CbaDisplayableShippingLabel: {
    type: String
  },
  OrderType: {
    type: String
  },
  EarliestShipDate: {
    type: String
  },
  LatestShipDate: {
    type: String
  },
  EarliestDeliveryDate: {
    type: String
  },
  LatestDeliveryDate: {
    type: String
  },
  IsBusinessOrder: {
    type: Boolean
  },
  IsPrime: {
    type: Boolean
  },
  IsPremiumOrder: {
    type: Boolean
  },
  IsGlobalExpressEnabled: {
    type: Boolean
  },
  ReplacedOrderId: {
    type: String
  },
  IsReplacementOrder: {
    type: Boolean
  },
  PromiseResponseDueDate: {
    type: String
  },
  IsEstimatedShipDateSet: {
    type: Boolean
  },
  IsSoldByAB: {
    type: Boolean
  },
  IsIBA: {
    type: Boolean
  },
  DefaultShipFromLocationAddress: {
    type: String
  },
  BuyerInvoicePreference: {
    type: String
  },
  BuyerTaxInformation: {
    BuyerLegalCompanyName: {
      type: String
    },
    BuyerBusinessAddress: {
      type: String
    },
    BuyerTaxRegistrationId: {
      type: String
    },
    BuyerTaxOffice: {
      type: String
    }
  },
  FulfillmentInstruction: {
    type: String
  },
  IsISPU: {
    type: Boolean
  },
  IsAccessPointOrder: {
    type: Boolean
  },
  MarketplaceTaxInfo: {
    type: String
  },
  SellerDisplayName: {
    type: String
  },
  ShippingAddress: {
    Name: {
      type: String
    },
    AddressLine1: {
      type: String
    },
    AddressLine2: {
      type: String
    },
    AddressLine3: {
      type: String
    },
    City: {
      type: String
    },
    County: {
      type: String
    },
    District: {
      type: String
    },
    StateOrRegion: {
      type: String
    },
    Municipality: {
      type: String
    },
    PostalCode: {
      type: String
    },
    CountryCode: {
      type: String
    },
    Phone: {
      type: String
    },
    AddressType: {
      type: String
    }
  },
  BuyerInfo: {
    BuyerEmail: {
      type: String
    },
    BuyerName: {
      type: String
    },
    BuyerCounty: {
      type: String
    },
    BuyerTaxInfo: {
      CompanyLegalName: {
        type: String
      },
      TaxingRegion: {
        type: String
      },
      TaxClassifications: [{
        Name: String,
        Value: String
      }]
    },
    PurchaseOrderNumber: {
      type: String
    }
  },
  AutomatedShippingSettings: {
    type: String
  },
  HasRegulatedItems: {
    type: String
  },
  ElectronicInvoiceStatus: {
    type: String
  },
  ItemApprovalTypes: {
    type: String
  },
  ItemApprovalStatus: {
    type: String
  }
}, { timestamps: true });

module.exports = model("AmazonReport", amazonReportSchema);
