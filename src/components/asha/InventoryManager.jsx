import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateUUID } from '../../lib/db';
import { enqueueOfflineAction } from '../../lib/syncManager';
import { Package, AlertTriangle, Plus, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    <div className="space-y-6 text-[#111111]">
      {/* Header Bar */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#EAEAEA] rounded-xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#F9F9F8] rounded-xl border border-[#EAEAEA]">
            <Package size={24} className="text-[#111111]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold m-0 text-[#111111]">
              PHC Stock & Medical Inventory
            </h2>
            <p className="text-sm text-[#787774] mt-1 mb-0">
              Monitor medicine supplies and record stock replenishment offline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lowStockCount > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-3 py-1.5 rounded-md text-sm font-medium">
              <AlertTriangle size={16} />
              <span>{lowStockCount} Low Stock Alert(s)</span>
            </div>
          )}

          <button
            onClick={() => setShowAddModal(!showAddModal)}
            className="bg-[#111111] text-white px-4 py-2 rounded-md text-sm font-medium hover:scale-95 transition-transform flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Add Stock Item</span>
          </button>
        </div>
      </motion.div>

      {/* Add Item Modal / Inline Form */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            className="bg-white border border-[#EAEAEA] rounded-xl p-5 sm:p-6"
          >
            <h3 className="text-base font-medium text-[#111111] mb-5">Add New Medicine / Inventory Item</h3>
            <form onSubmit={handleSaveNewItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-[#787774] mb-2">Item Name *</label>
                <input type="text" className="bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-4 py-2.5 text-sm text-[#111111] placeholder-[#787774] focus:outline-none focus:border-[#111111] transition-colors w-full" placeholder="e.g. Paracetamol 500mg" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#787774] mb-2">Initial Quantity *</label>
                <input type="number" className="bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-4 py-2.5 text-sm text-[#111111] placeholder-[#787774] focus:outline-none focus:border-[#111111] transition-colors w-full" placeholder="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#787774] mb-2">Unit</label>
                <input type="text" className="bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-4 py-2.5 text-sm text-[#111111] placeholder-[#787774] focus:outline-none focus:border-[#111111] transition-colors w-full" placeholder="tablets, sachets, kits" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#787774] mb-2">Low Stock Threshold</label>
                <input type="number" className="bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-4 py-2.5 text-sm text-[#111111] placeholder-[#787774] focus:outline-none focus:border-[#111111] transition-colors w-full" placeholder="30" value={minThreshold} onChange={(e) => setMinThreshold(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" className="flex-1 bg-[#111111] text-white px-4 py-2.5 rounded-md text-sm font-medium hover:scale-95 transition-transform">Save Item</button>
                <button type="button" className="bg-white border border-[#EAEAEA] text-[#111111] px-4 py-2.5 rounded-md text-sm font-medium hover:scale-95 transition-transform" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inventory Table */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden overflow-x-auto"
      >
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-[#F9F9F8] border-b border-[#EAEAEA] text-[#787774]">
              <th className="px-5 py-4 font-medium">Medicine / Supply Name</th>
              <th className="px-5 py-4 font-medium">Current Stock</th>
              <th className="px-5 py-4 font-medium">Threshold</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Last Updated</th>
              <th className="px-5 py-4 font-medium text-right">Quick Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAEAEA]">
            {items.map((item) => {
              const isLow = item.quantity <= item.min_threshold;
              const isEditing = editingItemId === item.id;

              return (
                <motion.tr 
                  layout
                  key={item.id} 
                  className={`transition-colors ${isLow ? 'bg-orange-50/50' : 'hover:bg-[#F9F9F8]'}`}
                >
                  <td className="px-5 py-4 font-medium text-[#111111]">
                    {item.item_name}
                  </td>

                  <td className="px-5 py-4">
                    {isEditing ? (
                      <input
                        type="number"
                        className="bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-1.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] transition-colors w-24"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                      />
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-base font-semibold ${isLow ? 'text-orange-600' : 'text-[#111111]'}`}>
                          {item.quantity}
                        </span>
                        <span className="text-xs text-[#787774]">{item.unit}</span>
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-4 text-[#787774]">
                    {isEditing ? (
                      <input
                        type="number"
                        className="bg-[#F9F9F8] border border-[#EAEAEA] rounded-md px-3 py-1.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] transition-colors w-20"
                        value={editThreshold}
                        onChange={(e) => setEditThreshold(e.target.value)}
                      />
                    ) : (
                      <>{item.min_threshold} {item.unit}</>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-md text-xs font-medium">
                        Low Stock Alert
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-medium">
                        In Stock
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-[#787774] text-xs">
                    <div>{new Date(item.last_updated).toLocaleDateString()}</div>
                    <div className="mt-0.5">{new Date(item.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>

                  <td className="px-5 py-4 text-right">
                    {isEditing ? (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleUpdateItem(item.id)}
                          className="bg-[#111111] text-white px-3 py-1.5 rounded-md text-xs font-medium hover:scale-95 transition-transform"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="bg-white border border-[#EAEAEA] text-[#111111] px-3 py-1.5 rounded-md text-xs font-medium hover:scale-95 transition-transform"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => { setEditingItemId(item.id); setEditQty(item.quantity); setEditThreshold(item.min_threshold); }}
                          className="bg-white border border-[#EAEAEA] text-[#111111] px-3 py-1.5 rounded-md text-xs font-medium hover:scale-95 transition-transform flex items-center gap-1.5"
                        >
                          <Edit2 size={13} />
                          <span>Adjust</span>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="bg-white hover:bg-red-50 text-[#111111] hover:text-red-600 border border-[#EAEAEA] hover:border-red-200 px-2 py-1.5 rounded-md hover:scale-95 transition-all"
                          aria-label="Delete item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
