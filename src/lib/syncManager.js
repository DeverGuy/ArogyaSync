import { db } from './db';
import { supabase, isSupabaseConfigured } from './supabase';

export const enqueueOfflineAction = async (tableName, action, payload) => {
  try {
    await db.sync_queue.add({
      table_name: tableName,
      action: action,
      payload: JSON.stringify(payload),
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    });
    console.log(`[SyncManager] Enqueued offline action: ${action} on ${tableName}`);
  } catch (err) {
    console.error('[SyncManager] Failed to enqueue offline action:', err);
  }
};

export const replaySyncQueue = async () => {
  if (!navigator.onLine || !isSupabaseConfigured) {
    console.log('[SyncManager] Offline or Supabase unconfigured, skipping replay.');
    return { success: false, syncedCount: 0 };
  }

  const pendingItems = await db.sync_queue.where('status').equals('PENDING').toArray();
  if (pendingItems.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  console.log(`[SyncManager] Replaying ${pendingItems.length} pending offline actions to Supabase...`);
  let syncedCount = 0;

  for (const item of pendingItems) {
    try {
      const payloadObj = JSON.parse(item.payload);
      let error = null;

      if (item.action === 'INSERT') {
        const res = await supabase.from(item.table_name).insert(payloadObj);
        error = res.error;
      } else if (item.action === 'UPDATE') {
        const res = await supabase.from(item.table_name).update(payloadObj).eq('id', payloadObj.id);
        error = res.error;
      }

      if (!error) {
        await db.sync_queue.update(item.id, { status: 'SYNCED' });
        syncedCount++;
      } else {
        console.warn(`[SyncManager] Supabase sync error for item ${item.id}:`, error);
      }
    } catch (err) {
      console.error(`[SyncManager] Error replaying sync item ${item.id}:`, err);
    }
  }

  // Clear synced queue items
  await db.sync_queue.where('status').equals('SYNCED').delete();

  return { success: true, syncedCount };
};
