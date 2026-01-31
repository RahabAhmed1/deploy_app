import mongoose, { Schema, InferSchemaType } from 'mongoose';

const LocationSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    at: { type: Date, required: true },
  },
  { _id: false }
);

const ProofSchema = new Schema(
  {
    kind: { type: String, enum: ['pickup', 'delivered'], required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false }
);

const DeliveryItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: false },
    productName: { type: String, required: false },
    quantity: { type: Number, required: true },
    unit: { type: String, required: false },
  },
  { _id: false }
);

const DeliverySchema = new Schema(
  {
    type: { type: String, enum: ['supplier_to_admin', 'admin_to_customer'], required: true },
    status: {
      type: String,
      enum: ['created', 'assigned', 'picked_up', 'in_transit', 'reached', 'delivered', 'cancelled'],
      default: 'created',
    },

    supplierId: { type: Schema.Types.ObjectId, required: false },
    supplierName: { type: String, required: false },

    customerId: { type: Schema.Types.ObjectId, required: false },
    customerName: { type: String, required: false },
    customerAddress: { type: String, required: false },

    destinationAddress: { type: String, required: false },
    destinationLat: { type: Number, required: false },
    destinationLng: { type: Number, required: false },

    relatedOrderId: { type: Schema.Types.ObjectId, required: false },
    relatedPurchaseId: { type: Schema.Types.ObjectId, required: false },
    relatedStockRequestId: { type: Schema.Types.ObjectId, required: false },

    items: { type: [DeliveryItemSchema], default: [] },

    assignedToUserId: { type: Schema.Types.ObjectId, required: false },
    assignedToUsername: { type: String, required: false },
    assignedToFullName: { type: String, required: false },
    assignedToPhone: { type: String, required: false },

    assignedAt: { type: Date, required: false },

    createdByUserId: { type: String, required: false },
    createdByUsername: { type: String, required: false },

    note: { type: String, required: false },

    lastLocation: { type: LocationSchema, required: false },
    locationHistory: { type: [LocationSchema], default: [] },

    pickedUpAt: { type: Date, required: false },
    pickedUpEtaMinutes: { type: Number, required: false },
    pickedUpDistanceKm: { type: Number, required: false },

    reachedAt: { type: Date, required: false },
    deliveredAt: { type: Date, required: false },

    proofs: { type: [ProofSchema], default: [] },

    cashCollected: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type DeliveryDoc = InferSchemaType<typeof DeliverySchema> & { _id: string };

export const DeliveryModel = mongoose.models.Delivery || mongoose.model('Delivery', DeliverySchema);
