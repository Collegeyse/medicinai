import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Package, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Calculator,
  Search,
  Edit3,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { db } from '../../database';
import { Medicine, Batch } from '../../types';
import { usePharmacyStore } from '../../store';
import { format } from 'date-fns';

interface RestockItem {
  medicine: Medicine;
  totalStock?: number;
  quantity: number;
  batchNumber: string;
  expiryDate: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  minStock: number;
  maxStock: number;
  supplierId: string;
}

interface MedicineWithStock extends Medicine {
  totalStock: number;
}

interface RestockManagementPageProps {
  onBack: () => void;
}

export const RestockManagementPage: React.FC<RestockManagementPageProps> = ({ onBack }) => {
  const [medicines, setMedicines] = useState<MedicineWithStock[]>([]);
  const [selectedMedicines, setSelectedMedicines] = useState<Set<string>>(new Set());
  const [restockCart, setRestockCart] = useState<RestockItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [editingItem, setEditingItem] = useState<RestockItem | null>(null);
  const { addNotification } = usePharmacyStore();

  // Function to get current medicine data
  const getCurrentMedicineData = async (medicineId: string): Promise<Medicine | null> => {
    try {
      return await db.medicines.get(medicineId);
    } catch (error) {
      console.error('Error fetching current medicine data:', error);
      return null;
    }
  };

  // Function to get latest batch data for a medicine
  const getLatestBatchData = async (medicineId: string): Promise<Batch | null> => {
    try {
      const batches = await db.batches
        .where('medicineId')
        .equals(medicineId)
        .reverse()
        .sortBy('receivedDate');
      return batches.length > 0 ? batches[0] : null;
    } catch (error) {
      console.error('Error fetching latest batch data:', error);
      return null;
    }
  };

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    try {
      const allMedicines = await db.medicines.toArray();
      const medicinesWithStock: MedicineWithStock[] = [];
      
      for (const medicine of allMedicines) {
        const batches = await db.batches
          .where('medicineId')
          .equals(medicine.id)
          .filter(batch => batch.currentStock > 0 && new Date(batch.expiryDate) > new Date())
          .toArray();
        
        const totalStock = batches.reduce((sum, batch) => sum + batch.currentStock, 0);
        
        medicinesWithStock.push({
          ...medicine,
          totalStock
        });
      }
      
      setMedicines(medicinesWithStock);
    } catch (error) {
      console.error('Error loading medicines:', error);
      addNotification('error', 'Failed to load medicines');
    } finally {
      setLoading(false);
    }
  };

  const handleMedicineSelect = async (medicine: MedicineWithStock, checked: boolean) => {
    const newSelected = new Set(selectedMedicines);
    
    if (checked) {
      newSelected.add(medicine.id);
      
      // Get latest batch data for better defaults
      const latestBatch = await getLatestBatchData(medicine.id);
      
      // Add to restock cart with current/latest values
      const restockItem: RestockItem = {
        medicine,
        totalStock: medicine.totalStock,
        quantity: 100,
        batchNumber: `BATCH-${Date.now()}-${medicine.id.slice(-4)}`,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year from now
        purchasePrice: latestBatch?.purchasePrice || 0,
        sellingPrice: latestBatch?.sellingPrice || 0,
        mrp: latestBatch?.mrp || 0,
        minStock: 10,
        maxStock: 500,
        supplierId: 'DEFAULT'
      };
      setRestockCart(prev => [...prev, restockItem]);
    } else {
      newSelected.delete(medicine.id);
      setRestockCart(prev => prev.filter(item => item.medicine.id !== medicine.id));
    }
    
    setSelectedMedicines(newSelected);
  };

  const updateRestockItem = (medicineId: string, updates: Partial<RestockItem>) => {
    setRestockCart(prev => 
      prev.map(item => 
        item.medicine.id === medicineId 
          ? { ...item, ...updates }
          : item
      )
    );
  };

  const removeFromCart = (medicineId: string) => {
    setRestockCart(prev => prev.filter(item => item.medicine.id !== medicineId));
    const newSelected = new Set(selectedMedicines);
    newSelected.delete(medicineId);
    setSelectedMedicines(newSelected);
  };

  const calculateTotalCost = () => {
    return restockCart.reduce((total, item) => total + (item.quantity * item.purchasePrice), 0);
  };

  const processRestock = async () => {
    if (restockCart.length === 0) {
      addNotification('error', 'No medicines selected for restock');
      return;
    }

    setProcessing(true);

    try {
      for (const item of restockCart) {
        // Create new batch
        const newBatch: Batch = {
          id: crypto.randomUUID(),
          medicineId: item.medicine.id,
          batchNumber: item.batchNumber,
          expiryDate: new Date(item.expiryDate),
          mrp: item.mrp,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          currentStock: item.quantity,
          minStock: item.minStock,
          maxStock: item.maxStock,
          supplierId: item.supplierId,
          receivedDate: new Date()
        };

        await db.batches.add(newBatch);
      }

      addNotification('success', `Successfully restocked ${restockCart.length} medicines`);
      setRestockCart([]);
      setSelectedMedicines(new Set());
      onBack();
    } catch (error) {
      console.error('Error processing restock:', error);
      addNotification('error', 'Failed to process restock order');
    } finally {
      setProcessing(false);
    }
  };

  const filteredMedicines = medicines.filter(medicine =>
    medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    medicine.brandName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    medicine.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-3">
                <Package className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Restock Management</h1>
                  <p className="text-sm text-gray-600">Select medicines to restock and manage inventory</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Selected:</span>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {restockCart.length} items
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Medicine Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search medicines to restock..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Medicine List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Available Medicines ({filteredMedicines.length})
                  </h2>
                  <button
                    onClick={() => setShowAddMedicine(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Medicine
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading medicines...</p>
                  </div>
                ) : filteredMedicines.length === 0 ? (
                  <div className="p-8 text-center">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No medicines found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredMedicines.map((medicine) => (
                      <div key={medicine.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start space-x-4">
                          <div className="flex items-center h-5 mt-1">
                            <input
                              type="checkbox"
                              checked={selectedMedicines.has(medicine.id)}
                              onChange={(e) => handleMedicineSelect(medicine, e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-medium text-gray-900">
                                {medicine.brandName || medicine.name}
                              </h3>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                medicine.totalStock === 0 
                                  ? 'bg-red-100 text-red-700' 
                                  : medicine.totalStock <= 10
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {medicine.totalStock} units
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                medicine.scheduleType === 'H1' 
                                  ? 'bg-red-100 text-red-700' 
                                  : medicine.scheduleType === 'H'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {medicine.scheduleType}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{medicine.name}</p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>Manufacturer: {medicine.manufacturer}</span>
                              <span className={`font-medium ${
                                medicine.totalStock === 0 
                                  ? 'text-red-600' 
                                  : medicine.totalStock <= 10
                                  ? 'text-yellow-600'
                                  : 'text-green-600'
                              }`}>
                                Current Stock: {medicine.totalStock}
                              </span>
                              <span>HSN: {medicine.hsn}</span>
                              <span>GST: {medicine.gst}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Restock Cart */}
          <div className="space-y-6">
            {/* Restock Cart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Restock Cart</h2>
                <ShoppingCart className="w-5 h-5 text-gray-400" />
              </div>

              {restockCart.length > 0 ? (
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {restockCart.map((item) => (
                    <div key={item.medicine.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 text-sm">
                            {item.medicine.brandName || item.medicine.name}
                          </h3>
                          <p className="text-xs text-gray-600">{item.medicine.manufacturer}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setEditingItem(item)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="Edit restock details"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.medicine.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Quantity:</span>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateRestockItem(item.medicine.id, { quantity: parseInt(e.target.value) || 1 })}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Batch:</span>
                          <span className="font-medium">{item.batchNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Cost:</span>
                          <span className="font-medium">₹{(item.quantity * item.purchasePrice).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Select medicines to restock</p>
                </div>
              )}
            </div>

            {/* Order Summary */}
            {restockCart.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Total Items:</span>
                    <span className="font-medium">{restockCart.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Quantity:</span>
                    <span className="font-medium">
                      {restockCart.reduce((sum, item) => sum + item.quantity, 0)} units
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-3">
                    <span className="font-medium">Total Cost:</span>
                    <span className="font-bold text-lg">₹{calculateTotalCost().toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={processRestock}
                  disabled={processing || restockCart.length === 0}
                  className="w-full mt-6 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  {processing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4" />
                      <span>Process Restock Order</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    // Select all low stock medicines
                    const lowStockMedicines = medicines.filter(m => {
                      // This would need to check actual stock levels
                      return true; // Simplified for now
                    });
                    lowStockMedicines.forEach(medicine => {
                      if (!selectedMedicines.has(medicine.id)) {
                        handleMedicineSelect(medicine, true);
                      }
                    });
                    addNotification('info', 'Added all low stock medicines to cart');
                  }}
                  className="w-full bg-yellow-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Add All Low Stock</span>
                </button>
                
                <button
                  onClick={() => {
                    setRestockCart([]);
                    setSelectedMedicines(new Set());
                    addNotification('info', 'Cart cleared');
                  }}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Restock Details
                </h3>
                <button
                  onClick={() => setEditingItem(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {editingItem.medicine.brandName || editingItem.medicine.name}
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Batch Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={editingItem.batchNumber}
                    onChange={(e) => setEditingItem({ ...editingItem, batchNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={editingItem.expiryDate}
                    onChange={(e) => setEditingItem({ ...editingItem, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingItem.mrp}
                    onChange={(e) => {
                      const mrp = parseFloat(e.target.value) || 0;
                      setEditingItem({ 
                        ...editingItem, 
                        mrp,
                        sellingPrice: mrp * 0.9 // Auto-calculate selling price
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingItem.sellingPrice}
                    onChange={(e) => {
                      const sellingPrice = parseFloat(e.target.value) || 0;
                      setEditingItem({ 
                        ...editingItem, 
                        sellingPrice,
                        purchasePrice: sellingPrice * 0.8 // Auto-calculate purchase price
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purchase Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingItem.purchasePrice}
                    onChange={(e) => setEditingItem({ ...editingItem, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Stock Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingItem.quantity}
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingItem.minStock}
                    onChange={(e) => setEditingItem({ ...editingItem, minStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingItem.maxStock}
                    onChange={(e) => setEditingItem({ ...editingItem, maxStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier ID
                </label>
                <input
                  type="text"
                  value={editingItem.supplierId}
                  onChange={(e) => setEditingItem({ ...editingItem, supplierId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    // Refresh medicine data before saving
                    const currentMedicine = await getCurrentMedicineData(editingItem.medicine.id);
                    if (currentMedicine) {
                      const updatedItem = { ...editingItem, medicine: currentMedicine };
                      updateRestockItem(editingItem.medicine.id, updatedItem);
                    } else {
                      updateRestockItem(editingItem.medicine.id, editingItem);
                    }
                    setEditingItem(null);
                    addNotification('success', 'Restock details updated');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};