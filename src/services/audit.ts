import { db } from '../database';
import { AuditLog } from '../types';

export class AuditService {
  static async logAction(action: Omit<AuditLog, 'id' | 'timestamp' | 'userId'> & { userId?: string }): Promise<void> {
    const auditLog: AuditLog = {
      ...action,
      userId: action.userId || 'system-user',
      id: crypto.randomUUID(),
      timestamp: new Date()
    };
    
    await db.auditLogs.add(auditLog);
  }

  static async getAuditTrail(entityId: string): Promise<AuditLog[]> {
    return await db.auditLogs
      .where('entityId')
      .equals(entityId)
      .reverse()
      .sortBy('timestamp');
  }

  static async getRecentActivity(limit: number = 50): Promise<AuditLog[]> {
    return await db.auditLogs
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();
  }
}