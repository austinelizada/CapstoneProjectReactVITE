import { describe, expect, it } from "vitest";
import { buildDelayNotifications, sortCustomerNotificationsNewestFirst } from "./delayNotifications";

describe("buildDelayNotifications", () => {
  it("creates one notification for each saved delayed-stage report", () => {
    const reportedAt = "2026-09-30T10:00:00.000Z";
    const notifications = buildDelayNotifications({
      _id: "order-1",
      items: [{
        name: "Glass Door",
        progress_stages: [{
          key: "cutting",
          name: "Cutting",
          status: "delayed",
          delayHistory: [{
            reason: "Supplier delivery was delayed",
            expectedResolution: "2026-10-05T00:00:00.000Z",
            reportedAt,
            status: "delayed",
          }],
        }],
      }],
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      notificationType: "delay",
      delayStageName: "Cutting",
      delayReason: "Supplier delivery was delayed",
      delayProductName: "Glass Door",
    });
    expect(notifications[0].notificationId).toContain(String(new Date(reportedAt).getTime()));
  });

  it("surfaces an active legacy delay without a delay-history entry", () => {
    const notifications = buildDelayNotifications({
      _id: "order-2",
      progress_stages: [{ key: "assembly", name: "Assembly", status: "delayed", delayReason: "Waiting for parts" }],
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].delayReason).toBe("Waiting for parts");
  });

  it("puts the newest active delay above the generic order update", () => {
    const orderUpdatedAt = "2026-09-30T10:00:01.000Z";
    const delayReportedAt = "2026-09-30T10:00:00.000Z";
    const [delayNotification] = buildDelayNotifications({
      _id: "order-3",
      updatedAt: orderUpdatedAt,
      progress_stages: [{
        key: "cutting",
        name: "Cutting",
        status: "delayed",
        delayReportedAt,
        delayHistory: [{ reason: "Supplier delay", reportedAt: delayReportedAt, status: "delayed" }],
      }],
    });
    const genericOrderNotification = { notificationType: "order", notificationDate: orderUpdatedAt };

    expect(delayNotification.notificationDate).toBe(orderUpdatedAt);
    expect([genericOrderNotification, delayNotification].sort(sortCustomerNotificationsNewestFirst)[0]).toBe(delayNotification);
  });
});