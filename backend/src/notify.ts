import { NotificationModel } from './models/Notification';

export type NotifyTarget =
  | { toUserId: string }
  | { toRole: 'admin' | 'staff' | 'supplier' | 'rider' | 'customer' }
  | { toSupplierId: string };

export async function createNotification(
  target: NotifyTarget,
  payload: {
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    dedupeKey?: string;
  }
) {
  try {
    const dedupeKey = payload.dedupeKey ? String(payload.dedupeKey) : '';

    if (dedupeKey) {
      const now = new Date();
      await NotificationModel.updateOne(
        { dedupeKey, readAt: { $exists: false } },
        {
          $setOnInsert: {
            ...target,
            type: String(payload.type),
            title: String(payload.title),
            message: String(payload.message),
            entityType: payload.entityType ? String(payload.entityType) : undefined,
            entityId: payload.entityId ? String(payload.entityId) : undefined,
            dedupeKey: dedupeKey || undefined,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true }
      );
      return;
    }

    await NotificationModel.create({
      ...target,
      type: String(payload.type),
      title: String(payload.title),
      message: String(payload.message),
      entityType: payload.entityType ? String(payload.entityType) : undefined,
      entityId: payload.entityId ? String(payload.entityId) : undefined,
      dedupeKey: dedupeKey || undefined,
    });
  } catch {
  }
}
