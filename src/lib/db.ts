// IndexedDB Unified Storage Wrapper for TrustShield

import { TrustShieldSession, TrustShieldSettings, SecurityEvent, PerformanceMetrics } from '@/types';
import TRUSTSHIELD_CONFIG from '@/lib/constants';

// Chrome extension types
declare const chrome: any;

export class TrustShieldDB {
  private static instance: TrustShieldDB;
  private dbName = 'TrustShieldDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  private constructor() {}

  static getInstance(): TrustShieldDB {
    if (!TrustShieldDB.instance) {
      TrustShieldDB.instance = new TrustShieldDB();
    }
    return TrustShieldDB.instance;
  }

  // Initialize database
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('sessionId', 'sessionId', { unique: false });
          sessionStore.createIndex('startTime', 'startTime', { unique: false });
          sessionStore.createIndex('platform', 'platform', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          const settingsStore = db.createObjectStore('settings', { keyPath: 'id' });
          settingsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        if (!db.objectStoreNames.contains('securityEvents')) {
          const eventStore = db.createObjectStore('securityEvents', { keyPath: 'id' });
          eventStore.createIndex('eventId', 'eventId', { unique: true });
          eventStore.createIndex('timestamp', 'timestamp', { unique: false });
          eventStore.createIndex('type', 'type', { unique: false });
          eventStore.createIndex('severity', 'severity', { unique: false });
          eventStore.createIndex('sessionId', 'sessionId', { unique: false });
        }

        if (!db.objectStoreNames.contains('performanceMetrics')) {
          const metricsStore = db.createObjectStore('performanceMetrics', { keyPath: 'id' });
          metricsStore.createIndex('timestamp', 'timestamp', { unique: false });
          metricsStore.createIndex('sessionId', 'sessionId', { unique: false });
        }

        if (!db.objectStoreNames.contains('transcripts')) {
          const transcriptStore = db.createObjectStore('transcripts', { keyPath: 'id' });
          transcriptStore.createIndex('sessionId', 'sessionId', { unique: false });
          transcriptStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Generic method to add an item to a store
  private async add(storeName: string, item: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to add item to ${storeName}: ${request.error}`));
    });
  }

  // Generic method to get an item from a store
  private async get(storeName: string, key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get item from ${storeName}: ${request.error}`));
    });
  }

  // Generic method to update an item in a store
  private async update(storeName: string, item: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to update item in ${storeName}: ${request.error}`));
    });
  }

  // Generic method to delete an item from a store
  private async delete(storeName: string, key: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete item from ${storeName}: ${request.error}`));
    });
  }

  // Generic method to get all items from a store
  private async getAll(storeName: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get all items from ${storeName}: ${request.error}`));
    });
  }

  // Generic method to query items with an index
  private async query(storeName: string, indexName: string, value: any): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to query ${storeName} by ${indexName}: ${request.error}`));
    });
  }

  // Generic method to clear a store
  private async clear(storeName: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear ${storeName}: ${request.error}`));
    });
  }

  // Session management methods
  async saveSession(session: TrustShieldSession): Promise<void> {
    const storedSession = {
      ...session,
      id: session.sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.add('sessions', storedSession);
  }

  async getSession(sessionId: string): Promise<TrustShieldSession | null> {
    const result = await this.get('sessions', sessionId);
    return result || null;
  }

  async updateSession(session: TrustShieldSession): Promise<void> {
    const storedSession = {
      ...session,
      id: session.sessionId,
      updatedAt: Date.now(),
    };
    await this.update('sessions', storedSession);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.delete('sessions', sessionId);
  }

  async getAllSessions(): Promise<TrustShieldSession[]> {
    return await this.getAll('sessions');
  }

  async getSessionsByPlatform(platform: string): Promise<TrustShieldSession[]> {
    return await this.query('sessions', 'platform', platform);
  }

  async getSessionsByTimeRange(startTime: number, endTime: number): Promise<TrustShieldSession[]> {
    const allSessions = await this.getAllSessions();
    return allSessions.filter(session => 
      session.startTime >= startTime && session.startTime <= endTime
    );
  }

  // Settings management methods
  async saveSettings(settings: TrustShieldSettings): Promise<void> {
    const storedSettings = {
      ...settings,
      id: 'main',
      lastUpdated: Date.now(),
    };
    await this.update('settings', storedSettings);
  }

  async getSettings(): Promise<TrustShieldSettings | null> {
    const result = await this.get('settings', 'main');
    return result || null;
  }

  // Security event management methods
  async saveSecurityEvent(event: SecurityEvent): Promise<void> {
    const storedEvent = {
      ...event,
      id: event.eventId,
    };
    await this.add('securityEvents', storedEvent);
  }

  async getSecurityEvent(eventId: string): Promise<SecurityEvent | null> {
    const result = await this.get('securityEvents', eventId);
    return result || null;
  }

  async getSecurityEventsBySession(sessionId: string): Promise<SecurityEvent[]> {
    return await this.query('securityEvents', 'sessionId', sessionId);
  }

  async getSecurityEventsByTimeRange(startTime: number, endTime: number): Promise<SecurityEvent[]> {
    const allEvents = await this.getAll('securityEvents');
    return allEvents.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  async getSecurityEventsByType(type: string): Promise<SecurityEvent[]> {
    return await this.query('securityEvents', 'type', type);
  }

  async getSecurityEventsBySeverity(severity: string): Promise<SecurityEvent[]> {
    return await this.query('securityEvents', 'severity', severity);
  }

  async deleteSecurityEvent(eventId: string): Promise<void> {
    await this.delete('securityEvents', eventId);
  }

  async deleteSecurityEventsBySession(sessionId: string): Promise<void> {
    const events = await this.getSecurityEventsBySession(sessionId);
    for (const event of events) {
      await this.deleteSecurityEvent(event.eventId);
    }
  }

  // Performance metrics management methods
  async savePerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    const storedMetrics = {
      ...metrics,
      id: `metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    await this.add('performanceMetrics', storedMetrics);
  }

  async getPerformanceMetricsBySession(sessionId: string): Promise<PerformanceMetrics[]> {
    return await this.query('performanceMetrics', 'sessionId', sessionId);
  }

  async getPerformanceMetricsByTimeRange(startTime: number, endTime: number): Promise<PerformanceMetrics[]> {
    const allMetrics = await this.getAll('performanceMetrics');
    return allMetrics.filter(metrics => 
      metrics.timestamp >= startTime && metrics.timestamp <= endTime
    );
  }

  // Transcript management methods
  async saveTranscript(sessionId: string, transcript: string): Promise<void> {
    const transcriptData = {
      id: `transcript_${sessionId}`,
      sessionId,
      transcript,
      timestamp: Date.now(),
    };
    await this.update('transcripts', transcriptData);
  }

  async getTranscript(sessionId: string): Promise<string | null> {
    const result = await this.get('transcripts', `transcript_${sessionId}`);
    return result ? result.transcript : null;
  }

  // Data cleanup methods
  async cleanupOldData(): Promise<void> {
    const now = Date.now();
    const retentionPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days

    // Clean up old sessions
    const sessions = await this.getAllSessions();
    for (const session of sessions) {
      if (now - session.startTime > retentionPeriod) {
        await this.deleteSession(session.sessionId);
        await this.deleteSecurityEventsBySession(session.sessionId);
      }
    }

    // Clean up old security events
    const events = await this.getAll('securityEvents');
    for (const event of events) {
      if (now - event.timestamp > retentionPeriod) {
        await this.deleteSecurityEvent(event.eventId);
      }
    }

    // Clean up old performance metrics
    const metrics = await this.getAll('performanceMetrics');
    for (const metric of metrics) {
      if (now - metric.timestamp > retentionPeriod) {
        await this.delete('performanceMetrics', metric.id);
      }
    }

    // Clean up old transcripts
    const transcripts = await this.getAll('transcripts');
    for (const transcript of transcripts) {
      if (now - transcript.timestamp > retentionPeriod) {
        await this.delete('transcripts', transcript.id);
      }
    }
  }

  // Database maintenance methods
  async getDatabaseSize(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get database size: ${request.error}`));
    });
  }

  async vacuum(): Promise<void> {
    // In IndexedDB, there's no explicit vacuum operation
    // But we can compact the database by deleting and recreating it
    // This is a placeholder for future implementation
    console.log('Database vacuum not implemented for IndexedDB');
  }

  // Export data for backup
  async exportData(): Promise<any> {
    const sessions = await this.getAllSessions();
    const settings = await this.getSettings();
    const securityEvents = await this.getAll('securityEvents');
    const performanceMetrics = await this.getAll('performanceMetrics');
    const transcripts = await this.getAll('transcripts');

    return {
      version: this.version,
      exportDate: Date.now(),
      sessions,
      settings,
      securityEvents,
      performanceMetrics,
      transcripts,
    };
  }

  // Import data from backup
  async importData(data: any): Promise<void> {
    // Validate data structure
    if (!data.version || !data.exportDate) {
      throw new Error('Invalid backup data format');
    }

    // Clear existing data
    await this.clear('sessions');
    await this.clear('securityEvents');
    await this.clear('performanceMetrics');
    await this.clear('transcripts');

    // Import sessions
    if (data.sessions) {
      for (const session of data.sessions) {
        await this.saveSession(session);
      }
    }

    // Import settings
    if (data.settings) {
      await this.saveSettings(data.settings);
    }

    // Import security events
    if (data.securityEvents) {
      for (const event of data.securityEvents) {
        await this.saveSecurityEvent(event);
      }
    }

    // Import performance metrics
    if (data.performanceMetrics) {
      for (const metrics of data.performanceMetrics) {
        await this.savePerformanceMetrics(metrics);
      }
    }

    // Import transcripts
    if (data.transcripts) {
      for (const transcript of data.transcripts) {
        await this.saveTranscript(transcript.sessionId, transcript.transcript);
      }
    }
  }

  // Close database connection
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default TrustShieldDB;
