import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateUUID } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
import { Package, AlertTriangle, Plus, Edit2, CheckCircle2, Trash2 } from 'lucide-react';

export function InventoryManager() {
  const items = useLiveQuery(() => db.inventory.toArray(), []) || [];

  const [showAddModal, setShowAddModal] = useState(false);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('tablets');
  const [minThreshold, setMinThreshold] = useState('50');

  const [editingItemId, setEditingItemId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editThreshold, setEditThreshold] = useState('');

  const handleSaveNewItem = async (e) => {
    e.preventDefault();
    if (!itemName.trim() || !quantity) return;

    try {
      const now = new Date().toISOString();
      const newItem = {
        id: generateUUID(),
        item_name: itemName.trim(),
        quantity: parseInt(quantity) || 0,
        unit: unit.trim() || 'units',
        min_threshold: parseInt(minThreshold) || 10,
        last_updated: now
      };

      await db.inventory.add(newItem);
      await enqueueOfflineAction('inventory', 'INSERT', newItem);

      setItemName('');
      setQuantity('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Error adding inventory item:', err);
    }
  };

  const handleUpdateItem = async (id) => {
    try {
      const newQty = parseInt(editQty);
      const newThreshold = parseInt(editThreshold);
      if (isNaN(newQty) || isNaN(newThreshold)) return;

      const now = new Date().toISOString();
      await db.inventory.update(id, {
        quantity: newQty,
        min_threshold: newThreshold,
        last_updated: now
      });

      await enqueueOfflineAction('inventory', 'UPDATE', {
        id,
        quantity: newQty,
        min_threshold: newThreshold,
        last_updated: now
      });

      setEditingItemId(null);
      setEditQty('');
      setEditThreshold('');
    } catch (err) {
      console.error('Error updating stock item:', err);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to completely remove this item from the inventory?')) return;
    try {
      await db.inventory.delete(id);
      await enqueueOfflineAction('inventory', 'DELETE', { id });
    } catch (err) {
      console.error('Error deleting inventory item:', err);
    }
  };

  const lowStockCount = items.filter((item) => item.quantity <= item.min_threshold).length;

  return (
    <div>
      {/* Header Bar */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Package size={26} color="#06b6d4" />
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              PHC Stock & Medical Inventory
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
              Monitor medicine supplies and record stock replenishment offline.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lowStockCount > 0 && (
            <span className="badge badge-yellow" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <AlertTriangle size={14} />
              <span>{lowStockCount} Low Stock Alert(s)</span>
            </span>
          )}

          <button
            onClick={() => setShowAddModal(!showAddModal)}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {/* Add Item Modal / Inline Form */}
      {showAddModal && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', border: '1px solid var(--primary)' }}>
          <h3 style={{ fontSize: '1rem', color: '#06b6d4', marginBottom: '14px' }}>Add New Medicine / Inventory Item</h3>
          <form onSubmit={handleSaveNewItem} className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Item Name *</label>
              <input type="text" className="input-field" placeholder="e.g. Paracetamol 500mg" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Initial Quantity *</label>
              <input type="number" className="input-field" placeholder="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Unit</label>
              <input type="text" className="input-field" placeholder="tablets, sachets, kits" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Low Stock Threshold</label>
              <input type="number" className="input-field" placeholder="30" value={minThreshold} onChange={(e) => setMinThreshold(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px' }}>Save Item</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Inventory Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '14px 20px' }}>Medicine / Supply Name</th>
              <th style={{ padding: '14px 20px' }}>Current Stock</th>
              <th style={{ padding: '14px 20px' }}>Threshold</th>
              <th style={{ padding: '14px 20px' }}>Status</th>
              <th style={{ padding: '14px 20px' }}>Last Updated</th>
              <th style={{ padding: '14px 20px', textAlign: 'right' }}>Quick Update</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isLow = item.quantity <= item.min_threshold;
              const isEditing = editingItemId === item.id;

              return (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isLow ? 'rgba(245, 158, 11, 0.04)' : 'transparent' }}>
                  
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: '#f8fafc' }}>
                    {item.item_name}
                  </td>

                  <td style={{ padding: '14px 20px' }}>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input-field"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        style={{ width: '100px', padding: '4px 8px' }}
                      />
                    ) : (
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: isLow ? '#fde047' : '#06b6d4' }}>
                        {item.quantity} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dim)' }}>{item.unit}</span>
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                    {isEditing ? (
                      <input
                        type="number"
                        className="input-field"
                        value={editThreshold}
                        onChange={(e) => setEditThreshold(e.target.value)}
                        style={{ width: '80px', padding: '4px 8px' }}
                      />
                    ) : (
                      <>{item.min_threshold} {item.unit}</>
                    )}
                  </td>

                  <td style={{ padding: '14px 20px' }}>
                    {isLow ? (
                      <span className="badge badge-yellow">Low Stock Alert</span>
                    ) : (
                      <span className="badge badge-green">In Stock</span>
                    )}
                  </td>

                  <td style={{ padding: '14px 20px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                    {new Date(item.last_updated).toLocaleDateString()} {new Date(item.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>

                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleUpdateItem(item.id)}
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => { setEditingItemId(item.id); setEditQty(item.quantity); setEditThreshold(item.min_threshold); }}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          <Edit2 size={13} />
                          <span>Adjust</span>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
