import { db } from './db';
import { supabase, isSupabaseConfigured, createSecondaryClient } from './supabase';

/**
 * Enqueue an offline action for later Supabase replay.
 *
 * @param {string} tableName - Supabase table name ('patients', 'visits', 'doctors', 'inventory', 'documents')
 * @param {string} action    - 'INSERT' | 'UPDATE' | 'DELETE'
 * @param {object} payload   - The record payload (must include `id` for UPDATE/DELETE)
 */
export const enqueueOfflineAction = async (tableName, action, payload) => {
  try {
    await db.sync_queue.add({
      table_name: tableName,
      action,
      payload: JSON.stringify(payload),
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    });
    console.log(`[SyncManager] Enqueued: ${action} on ${tableName}`);
  } catch (err) {
    console.error('[SyncManager] Failed to enqueue action:', err);
  }
};

/**
 * Replay all PENDING sync_queue items to Supabase.
 * Called automatically on reconnection or manually via "Sync Now".
 *
 * @returns {{ success: boolean, syncedCount: number }}
 */
export const replaySyncQueue = async () => {
  if (!navigator.onLine || !isSupabaseConfigured) {
    console.log('[SyncManager] Skipping replay: offline or Supabase not configured.');
    return { success: false, syncedCount: 0 };
  }

  const pending = await db.sync_queue.where('status').equals('PENDING').toArray();
  if (pending.length === 0) return { success: true, syncedCount: 0 };

  console.log(`[SyncManager] Replaying ${pending.length} pending action(s)…`);
  let syncedCount = 0;

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload);
      let error = null;

      switch (item.action) {
        case 'INSERT': {
          const res = await supabase.from(item.table_name).insert(payload);
          error = res.error;
          break;
        }
        case 'UPDATE': {
          const res = await supabase.from(item.table_name).update(payload).eq('id', payload.id);
          error = res.error;
          break;
        }
        case 'DELETE': {
          const res = await supabase.from(item.table_name).delete().eq('id', payload.id);
          error = res.error;
          break;
        }
        case 'CREATE_AUTH_USER': {
          const secondaryClient = createSecondaryClient();
          const { email, password, full_name, role } = payload;
          const res = await secondaryClient.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name,
                role
              }
            }
          });
          error = res.error;
          break;
        }
        default:
          console.warn(`[SyncManager] Unknown action: ${item.action}`);
      }

      if (!error) {
        await db.sync_queue.update(item.id, { status: 'SYNCED' });
        syncedCount++;
      } else {
        console.warn(`[SyncManager] Supabase error for item ${item.id}:`, error.message);
      }
    } catch (err) {
      console.error(`[SyncManager] Error replaying item ${item.id}:`, err);
    }
  }

  // Clean up successfully synced items
  await db.sync_queue.where('status').equals('SYNCED').delete();
  console.log(`[SyncManager] Replay complete. Synced: ${syncedCount}/${pending.length}`);

  return { success: true, syncedCount };
};
