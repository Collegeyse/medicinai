import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Package, ShoppingCart, DollarSign, Calendar, Hash, Users, Search } from 'lucide-react';
import { db } from '../../database';
import { Medicine } from '../../types';
import { usePharmacyStore } from '../../store';

interface RestockManagementPageProps {
  onBack: () => void;
}

interface BatchInfo {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  mrp: number;
  sellingPrice: number;
  purchasePrice: number;
}

interface RestockItem {
  id: string;
  name: string;
  manufacturer: string;
  batches: BatchInfo[];
}

export const RestockManagementPage: React.FC<RestockManagementPageProps> = ({ onBack }) => {
  const [restockCart, setRestockCart] = useState<RestockItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const { addNotification } = usePharmacyStore();

  // Load pending restock items from localStorage on component mount
  useEffect(() => {
    const pendingRestock = localStorage.getItem('pendingRestockItems');
    if (pendingRestock) {
      try {
        const items = JSON.parse(pendingRestock);
        const formattedItems: RestockItem[] = items.map((item: any) => ({
          id: item.id || Date.now().toString(),
          name: item.name,
          manufacturer: item.manufacturer || 'Unknown',
          batches: [{
            id: Date.now().toString(),
            batchNumber: `BATCH-${Date.now()}`,
            quantity: item.quantity || 50,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            mrp: item.mrp || 100,
            sellingPrice: item.sellingPrice || 90,
            purchasePrice: item.purchasePrice || 70
          }]
        }));
        setRestockCart(formattedItems);
        localStorage.removeItem('pendingRestockItems');
      } catch (error) {
        console.error('Error loading pending restock items:', error);
      }
    }
  }, []);

  // Search medicines when query changes
  useEffect(() => {
    if (searchQuery.length > 2) {
      searchMedicines();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchMedicines = async () => {
    try {
      const results = await db.medicines
        .filter(medicine => 
          medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          medicine.brandName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          medicine.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .limit(10)
        .toArray();
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching medicines:', error);
      addNotification('error', 'Failed to search medicines');
    }
  };

  const addMedicineToCart = (medicine: Medicine) => {
    // Check if medicine is already in cart
    const existingMedicine = restockCart.find(item => item.id === medicine.id);
    if (existingMedicine) {
      addNotification('warning', `${medicine.brandName || medicine.name} is already in restock cart`);
      return;
    }

    const newRestockItem: RestockItem = {
      id: medicine.id,
      name: medicine.brandName || medicine.name,
      manufacturer: medicine.manufacturer || 'Unknown',
      batches: [{
        id: Date.now().toString(),
        batchNumber: `BATCH-${Date.now()}`,
        quantity: 50,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        mrp: 100,
        sellingPrice: 90,
        purchasePrice: 70
      }]
    };

    setRestockCart(prev => [...prev, newRestockItem]);
    setSearchQuery('');
    setSearchResults([]);
    addNotification('success', `${medicine.brandName || medicine.name} added to restock cart`);
  };

  const addBatch = (medicineId: string) => {
    setRestockCart(prev => prev.map(item => {
      if (item.id === medicineId) {
        const lastBatch = item.batches[item.batches.length - 1];
        const newBatch: BatchInfo = {
          id: Date.now().toString(),
          batchNumber: `BATCH-${Date.now()}`,
          quantity: 50,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          mrp: lastBatch?.mrp || 100,
          sellingPrice: lastBatch?.sellingPrice || 90,
          purchasePrice: lastBatch?.purchasePrice || 70
        };
        return {
          ...item,
          batches: [...item.batches, newBatch]
        };
      }
      return item;
    }));
  };

  const removeBatch = (medicineId: string, batchId: string) => {
    setRestockCart(prev => prev.map(item => {
      if (item.id === medicineId) {
        const updatedBatches = item.batches.filter(batch => batch.id !== batchId);
        return {
          ...item,
          batches: updatedBatches
        };
      }
      return item;
    }).filter(item => item.batches.length > 0));
  };

  const updateBatch = (medicineId: string, batchId: string, field: keyof BatchInfo, value: string | number) => {
    setRestockCart(prev => prev.map(item => {
      if (item.id === medicineId) {
        return {
          ...item,
          batches: item.batches.map(batch => {
            if (batch.id === batchId) {
              const updatedBatch = { ...batch, [field]: value };
              
              // Auto-calculate selling and purchase prices when MRP changes
              if (field === 'mrp') {
                const mrpValue = Number(value);
                updatedBatch.sellingPrice = Math.round(mrpValue * 0.9);
                updatedBatch.purchasePrice = Math.round(mrpValue * 0.7);
              }
              
              return updatedBatch;
            }
            return batch;
          })
        };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setRestockCart([]);
  };

  const processOrder = () => {
    if (restockCart.length === 0) return;
    
    // Here you would typically send the order to your backend
    console.log('Processing restock order:', restockCart);
    
    // For now, just clear the cart and show success
    alert('Restock order processed successfully!');
    clearCart();
  };

  const getTotalQuantity = () => {
    return restockCart.reduce((total, item) => 
      total + item.batches.reduce((batchTotal, batch) => batchTotal + batch.quantity, 0), 0
    );
  };

  const getTotalCost = () => {
    return restockCart.reduce((total, item) => 
      total + item.batches.reduce((batchTotal, batch) => 
        batchTotal + (batch.quantity * batch.purchasePrice), 0
      ), 0
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Restock Management</h1>
            <p className="text-gray-600">Manage medicine restocking with multiple batches</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Restock Cart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-800">
                  Restock Cart ({restockCart.length})
                </h2>
              </div>
              {restockCart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Clear Cart
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {restockCart.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No medicines in restock cart</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add medicines from sales or use the Add New Medicine button
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {restockCart.map((medicine) => (
                  <div key={medicine.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-800">{medicine.name}</h3>
                        <p className="text-sm text-gray-600">Manufacturer: {medicine.manufacturer}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {medicine.batches.length} batch{medicine.batches.length !== 1 ? 'es' : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => addBatch(medicine.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Batch
                      </button>
                    </div>

                    <div className="space-y-4">
                      {medicine.batches.map((batch, index) => (
                        <div key={batch.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">
                              Batch #{index + 1}
                            </span>
                            {medicine.batches.length > 1 && (
                              <button
                                onClick={() => removeBatch(medicine.id, batch.id)}
                                className="text-red-600 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                <Hash className="w-3 h-3 inline mr-1" />
                                Batch Number
                              </label>
                              <input
                                type="text"
                                value={batch.batchNumber}
                                onChange={(e) => updateBatch(medicine.id, batch.id, 'batchNumber', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                <Users className="w-3 h-3 inline mr-1" />
                                Quantity
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="1000"
                                value={batch.quantity}
                                onChange={(e) => updateBatch(medicine.id, batch.id, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                Expiry Date
                              </label>
                              <input
                                type="date"
                                value={batch.expiryDate}
                                onChange={(e) => updateBatch(medicine.id, batch.id, 'expiryDate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                <DollarSign className="w-3 h-3 inline mr-1" />
                                MRP (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={batch.mrp}
                                onChange={(e) => updateBatch(medicine.id, batch.id, 'mrp', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Selling Price (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={batch.sellingPrice}
                                onChange={(e) => updateBatch(medicine.id, batch.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Purchase Price (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={batch.purchasePrice}
                                onChange={(e) => updateBatch(medicine.id, batch.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-sm text-gray-600">
                              Batch Total: <span className="font-semibold">₹{(batch.quantity * batch.purchasePrice).toFixed(2)}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Order Summary & Quick Actions */}
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Order Summary</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Medicines:</span>
                  <span className="font-semibold">{restockCart.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Quantity:</span>
                  <span className="font-semibold">{getTotalQuantity()} units</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Batches:</span>
                  <span className="font-semibold">
                    {restockCart.reduce((total, item) => total + item.batches.length, 0)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-800">Total Cost:</span>
                    <span className="text-lg font-bold text-green-600">₹{getTotalCost().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {restockCart.length > 0 && (
                <button
                  onClick={processOrder}
                  className="w-full mt-6 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Process Restock Order
                </button>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Quick Actions</h2>
            </div>
            <div className="p-6">
              <button
                onClick={() => setShowAddMedicine(true)}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Add New Medicine
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};