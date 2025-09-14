import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Plus, 
  Package, 
  RefreshCw,
  Search,
  TrendingDown,
  ArrowRight
} from 'lucide-react';
import { db } from '../../database';
import { Medicine, Batch } from '../../types';
import { usePharmacyStore } from '../../store';
import { format } from 'date-fns';
import { AddMedicinePage } from './AddMedicinePage';
import { RestockManagementPage } from './RestockManagementPage';

interface LowStockItem {
  medicine: Medicine;
  batches: Batch[];
  totalStock: number;
  lowestStock: number;
}

export const LowStockPage: React.FC = () => {
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [showRestockManagement, setShowRestockManagement] = useState(false);
  const [selectedMedicineForRestock, setSelectedMedicineForRestock] = useState<Medicine | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { addNotification } = usePharmacyStore();

  useEffect(() => {
    loadLowStockItems();
  }, []);

  const loadLowStockItems = async () => {
    setLoading(true);
    try {
      const allMedicines = await db.medicines.toArray();
      const lowStockData: LowStockItem[] = [];
      
      for (const medicine of allMedicines) {
        const batchesForMedicine = await db.batches
          .where('medicineId')
          .equals(medicine.id)
          .toArray();

        // Filter out expired or zero-stock batches for active consideration
        const activeBatches = batchesForMedicine.filter(batch =>
          batch.currentStock > 0 && new Date(batch.expiryDate) > new Date()
        );

        const totalStock = activeBatches.reduce((sum, batch) => sum + batch.currentStock, 0);
        const lowestStock = activeBatches.length > 0 ? Math.min(...activeBatches.map(batch => batch.currentStock)) : 0;
        const hasBatchBelowMinStock = activeBatches.some(batch => batch.currentStock <= batch.minStock);

        // Define "low stock" for the medicine to be displayed on this page
        let isLowStock = false;
        if (totalStock === 0) {
            isLowStock = true; // Completely out of stock
        } else if (totalStock <= 10) {
            isLowStock = true; // Overall low stock threshold
        } else if (hasBatchBelowMinStock && totalStock <= 50) {
            // If there's a batch below its min stock AND total stock isn't very high (e.g., <= 50)
            isLowStock = true;
        }

        if (isLowStock) {
            lowStockData.push({
                medicine,
                batches: activeBatches, // Only include active batches
                totalStock,
                lowestStock
            });
        }
      }
      // Sort by lowest stock first
      lowStockData.sort((a, b) => a.lowestStock - b.lowestStock);
      setLowStockItems(lowStockData);
    } catch (error) {
      console.error('Error loading low stock items:', error);
      addNotification('error', 'Failed to load low stock items');
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromRestockManagement = () => {
    setShowRestockManagement(false);
    loadLowStockItems();
  };

  const handleMedicineAdded = () => {
    loadLowStockItems();
    setShowAddMedicine(false);
  };

  const handleRestockComplete = () => {
    loadLowStockItems();
    setSelectedMedicineForRestock(null);
  };

  const filteredItems = lowStockItems.filter(item =>
    item.medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.medicine.brandName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.medicine.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (showAddMedicine) {
    return (
      <AddMedicinePage
        onBack={() => setShowAddMedicine(false)}
        onMedicineAdded={handleMedicineAdded}
      />
    );
  }

  if (selectedMedicineForRestock) {
    return (
      <RestockPage
        medicine={selectedMedicineForRestock}
        onBack={() => setSelectedMedicineForRestock(null)}
      />
    );
  } else if (showRestockManagement) {
    return <RestockManagementPage onBack={handleBackFromRestockManagement} />;
  }

  const getStockStatus = (item: LowStockItem) => {
    if (item.totalStock === 0) {
      return { label: 'Out of Stock', color: 'bg-red-100 text-red-800', icon: '🚫' };
    } else if (item.lowestStock <= 1) {
      return { label: 'Critical', color: 'bg-red-100 text-red-800', icon: '🔴' };
    } else if (item.lowestStock <= 3) {
      return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800', icon: '⚠️' };
    } else {
      return { label: 'Below Min', color: 'bg-orange-100 text-orange-800', icon: '📉' };
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <TrendingDown className="w-6 h-6 text-red-600" />
            <span>Low Stock Management</span>
          </h1>
          <p className="text-gray-600">Manage medicines with low stock levels and restock inventory</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowRestockManagement(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Package className="w-4 h-4" />
            Bulk Restock
          </button>
          <button
            onClick={() => setShowAddMedicine(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Medicine
          </button>
          <button
            onClick={loadLowStockItems}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search low stock medicines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Critical Items</p>
              <p className="text-2xl font-bold text-red-900">{filteredItems.length}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading low stock items...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-green-50 rounded-lg border border-green-200">
          <Package className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-green-800 mb-2">All Stock Levels Good!</h3>
          <p className="text-green-600">No medicines are currently low on stock.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Low Stock Items ({filteredItems.length})
            </h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {filteredItems.map((item) => {
              const status = getStockStatus(item);
              
              return (
                <div key={item.medicine.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {item.medicine.brandName || item.medicine.name}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.medicine.scheduleType === 'H1' 
                            ? 'bg-red-100 text-red-700' 
                            : item.medicine.scheduleType === 'H'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.medicine.scheduleType}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-2">{item.medicine.name}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Manufacturer:</span>
                          <p className="font-medium">{item.medicine.manufacturer}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Stock:</span>
                          <p className={`font-medium ${item.totalStock === 0 ? 'text-red-600' : item.totalStock <= 3 ? 'text-yellow-600' : 'text-gray-900'}`}>
                            {item.totalStock} units
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Batches:</span>
                          <p className="font-medium">{item.batches.length}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">HSN:</span>
                          <p className="font-medium">{item.medicine.hsn}</p>
                        </div>
                      </div>

                      {/* Batch Details */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Batch Details:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {item.batches.map((batch) => (
                            <div key={batch.id} className="bg-gray-50 rounded-lg p-3 border">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">Batch: {batch.batchNumber}</p>
                                  <p className="text-sm text-gray-600">
                                    Exp: {batch.expiryDate && !isNaN(new Date(batch.expiryDate).getTime()) 
                                      ? format(new Date(batch.expiryDate), 'MMM dd, yyyy')
                                      : 'N/A'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Stock: <span className={batch.currentStock === 0 ? 'text-red-600 font-medium' : batch.currentStock <= 3 ? 'text-yellow-600 font-medium' : 'text-gray-900'}>{batch.currentStock}</span> / Min: {batch.minStock}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-blue-600">₹{batch.sellingPrice}</p>
                                  <p className="text-xs text-gray-500">MRP: ₹{batch.mrp}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col space-y-2 ml-6">
                      <button
                        onClick={() => {
                          setSelectedMedicineForRestock(item.medicine);
                          setShowRestockManagement(false); // Ensure bulk restock is not active
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Restock
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};