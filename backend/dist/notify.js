"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
const Notification_1 = require("./models/Notification");
async function createNotification(target, payload) {
    try {
        const dedupeKey = payload.dedupeKey ? String(payload.dedupeKey) : '';
        if (dedupeKey) {
            const now = new Date();
            await Notification_1.NotificationModel.updateOne({ dedupeKey, readAt: { $exists: false } }, {
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
            }, { upsert: true });
            return;
        }
        await Notification_1.NotificationModel.create({
            ...target,
            type: String(payload.type),
            title: String(payload.title),
            message: String(payload.message),
            entityType: payload.entityType ? String(payload.entityType) : undefined,
            entityId: payload.entityId ? String(payload.entityId) : undefined,
            dedupeKey: dedupeKey || undefined,
        });
    }
    catch {
    }
}
