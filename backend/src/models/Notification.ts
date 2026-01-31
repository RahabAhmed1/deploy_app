import mongoose, { Schema, InferSchemaType } from 'mongoose';

const NotificationSchema = new Schema(
  {
    toUserId: { type: String, required: false, index: true },
    toRole: { type: String, required: false, index: true },
    toSupplierId: { type: String, required: false, index: true },

    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },

    entityType: { type: String, required: false },
    entityId: { type: String, required: false },

    dedupeKey: { type: String, required: false, index: true },

    readAt: { type: Date, required: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ toUserId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ toRole: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ toSupplierId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ dedupeKey: 1, readAt: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof NotificationSchema> & { _id: string };

export const NotificationModel = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
