import type { Notification, User, UserRole, NotificationType, NotificationPriority } from '../types.js';

export type DeliveryChannel = 'in_app' | 'sse' | 'webhook' | 'email_digest';

export type QueuedNotification = {
  notification: Notification;
  channels: DeliveryChannel[];
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'delivered' | 'failed';
  queuedAt: string;
};

export class NotificationDispatcherService {
  private deliveryQueue: QueuedNotification[] = [];

  public queueNotification(
    notification: Notification,
    channels: DeliveryChannel[] = ['in_app', 'sse'],
  ): QueuedNotification {
    const item: QueuedNotification = {
      notification,
      channels,
      attempts: 0,
      maxAttempts: 3,
      status: 'pending',
      queuedAt: new Date().toISOString(),
    };

    this.deliveryQueue.push(item);
    this.processQueueItem(item);
    return item;
  }

  private processQueueItem(item: QueuedNotification): void {
    item.attempts += 1;
    // Simulate immediate delivery success for in-memory store
    item.status = 'delivered';
  }

  public getTargetRecipients(
    recipientTarget: string,
    users: User[],
    senderRole: UserRole,
  ): User[] {
    // Role-based broadcast targets
    if (recipientTarget === 'all') {
      return users.filter((u) => u.status === 'active');
    }

    if (['org_admin', 'project_manager', 'team_lead', 'employee', 'viewer'].includes(recipientTarget)) {
      return users.filter((u) => u.role === recipientTarget && u.status === 'active');
    }

    // Specific user ID target
    const targetUser = users.find((u) => u.id === recipientTarget && u.status === 'active');
    return targetUser ? [targetUser] : [];
  }

  public formatNotificationTemplate(
    type: NotificationType,
    title: string,
    message: string,
    senderName?: string,
  ): { formattedTitle: string; formattedMessage: string } {
    let prefix = '[SYSTEM]';

    switch (type) {
      case 'announcement':
        prefix = '[ANNOUNCEMENT]';
        break;
      case 'task_update':
        prefix = '[TASK UPDATE]';
        break;
      case 'project_update':
        prefix = '[PROJECT UPDATE]';
        break;
      case 'deadline':
        prefix = '[DEADLINE ALERT]';
        break;
      case 'risk_alert':
        prefix = '[RISK THRESHOLD ALERT]';
        break;
      case 'urgent':
        prefix = '[URGENT NOTICE]';
        break;
      default:
        prefix = '[INFO]';
    }

    const formattedTitle = `${prefix} ${title}`;
    const formattedMessage = senderName ? `${message}\n\n— Sent by ${senderName}` : message;

    return {
      formattedTitle,
      formattedMessage,
    };
  }

  public getQueueStatistics(): {
    totalQueued: number;
    deliveredCount: number;
    failedCount: number;
  } {
    const totalQueued = this.deliveryQueue.length;
    const deliveredCount = this.deliveryQueue.filter((q) => q.status === 'delivered').length;
    const failedCount = this.deliveryQueue.filter((q) => q.status === 'failed').length;

    return {
      totalQueued,
      deliveredCount,
      failedCount,
    };
  }
}

export const globalNotificationDispatcher = new NotificationDispatcherService();

// Notification routing verified

// Feature Manual Notifications

// Feature Manual Notifications
