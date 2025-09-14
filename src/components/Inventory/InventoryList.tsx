import React, { useState, useEffect } from 'react';
import { Plus, Package, AlertTriangle, TrendingDown, Calendar, Edit3, Trash2, MoreVertical } from 'lucide-react';
import { db } from '../../database';
import { Medicine, Batch } from '../../types';
import { usePharmacyStore } from '../../store';
import { AddMedicinePage } from './AddMedicinePage';
import { EditMedicineModal } from './EditMedicineModal';
import { format } from 'date-fns';

interface MedicineWithStock {
  medicine: Medicine;
  batches: Batch[];
  totalStock: number;
  lowStock: boolean;
  expiringSoon: boolean;
}
export const InventoryList: React.FC = () => {
  const [medicinesWithStock, setMedicinesWithStock] = useState<MedicineWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPage, setShowAddPage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Medicine | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { addNotification } = usePharmacyStore();

  const fetchMedicinesWithStock = async () => {
    try {
      const allMedicines = await db.medicines.toArray();
      const medicinesWithStockData: MedicineWithStock[] = [];
      
      for (const medicine of allMedicines) {
        const batches = await db.batches
          .where('medicineId')
          .equals(medicine.id)
          .toArray();
        
        const totalStock = batches.reduce((sum, batch) => sum + batch.currentStock, 0);
        const lowStock = batches.some(batch => batch.currentStock <= batch.minStock) || totalStock <= 3;
        
        // Check if any batch expires within 30 days
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const expiringSoon = batches.some(batch => 
          batch.expiryDate && new Date(batch.expiryDate) <= thirtyDaysFromNow && batch.currentStock > 0
        );
        
        medicinesWithStockData.push({
          medicine,
          batches,
          totalStock,
          lowStock,
          expiringSoon
        });
      }
      
      setMedicinesWithStock(medicinesWithStockData);
    } catch (error) {
      console.error('Error fetching medicines:', error);
      addNotification('error', 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicinesWithStock();
  }, []);

  const handleMedicineAdded = () => {
    fetchMedicinesWithStock(); // Refresh the list
    setShowAddPage(false);
  };

  const handleEditMedicine = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    setOpenDropdown(null);
  };

  const handleDeleteMedicine = async (medicine: Medicine) => {
    try {
      // Check if medicine has any batches with stock
      const batches = await db.batches
        .where('medicineId')
        .equals(medicine.id)
        .filter(batch => batch.currentStock > 0)
        .toArray();
      
      if (batches.length > 0) {
        addNotification('error', 'Cannot delete medicine with existing stock. Please clear all batches first.');
        return;
      }

      // Delete all batches for this medicine
      await db.batches.where('medicineId').equals(medicine.id).delete();
      
      // Delete the medicine
      await db.medicines.delete(medicine.id);
      
      addNotification('success', `Medicine ${medicine.brandName || medicine.name} deleted successfully`);
      fetchMedicinesWithStock();
    } catch (error) {
      console.error('Error deleting medicine:', error);
      addNotification('error', 'Failed to delete medicine');
    } finally {
      setShowDeleteConfirm(null);
      setOpenDropdown(null);
    }
  };

  const getStockStatus = (item: MedicineWithStock) => {
    if (item.totalStock === 0) {
      return { label: 'Out of Stock', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    } else if (item.totalStock <= 3) {
      return { label: 'Critical', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    } else if (item.lowStock) {
      return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800', icon: TrendingDown };
    } else {
      return { label: 'In Stock', color: 'bg-green-100 text-green-800', icon: Package };
    }
  };

  const filteredMedicines = medicinesWithStock.filter(item =>
    item.medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.medicine.brandName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.medicine.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  if (showAddPage) {
    return (
      <AddMedicinePage
        onBack={() => setShowAddPage(false)}
        onMedicineAdded={handleMedicineAdded}
      />
    );
  }

  if (loading) {
    return <div className="p-6 text-center">Loading inventory...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600">Manage your medicine stock and batches.</p>
        </div>
        <button
          onClick={() => setShowAddPage(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Medicine
        </button>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="relative">
            <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search medicines by name, brand, or manufacturer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">Total Medicines</p>
              <p className="text-2xl font-bold text-blue-900">{medicinesWithStock.length}</p>
            </div>
          </div>
        </div>
      </div>

      {filteredMedicines.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">No medicines found in inventory.</p>
          <p className="text-gray-400 text-sm mt-2">Click "Add Medicine" to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Medicines ({filteredMedicines.length})</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {filteredMedicines.map((item) => {
              const status = getStockStatus(item);
              const StatusIcon = status.icon;
              
              return (
                <div key={item.medicine.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">{item.medicine.brandName}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color} flex items-center space-x-1`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{status.label}</span>
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
                        {item.expiringSoon && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>Expiring Soon</span>
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mt-1">{item.medicine.name}</p>
                      {item.medicine.dosage && (
                        <p className="text-sm text-gray-500">Dosage: {item.medicine.dosage}</p>
                      )}
                      {item.medicine.medicineType && (
                        <p className="text-sm text-gray-500">Type: {item.medicine.medicineType}</p>
                      )}
                      
                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <span>Manufacturer: {item.medicine.manufacturer}</span>
                        <span>HSN: {item.medicine.hsn}</span>
                        <span className="font-medium text-gray-700">
                          Total Stock: <span className={item.totalStock === 0 ? 'text-red-600' : item.totalStock <= 3 ? 'text-yellow-600' : 'text-green-600'}>
                            {item.totalStock} units
                          </span>
                        </span>
                      </div>
                      
                      {/* Batch Details */}
                      {item.batches.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Active Batches ({item.batches.length}):
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {item.batches.slice(0, 6).map((batch) => (
                              <div key={batch.id} className="bg-gray-50 rounded-lg p-3 border">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900 text-sm">
                                      Batch: {batch.batchNumber}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      Exp: {batch.expiryDate && !isNaN(new Date(batch.expiryDate).getTime()) 
                                        ? format(new Date(batch.expiryDate), 'MMM dd, yyyy')
                                        : 'N/A'}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      Stock: <span className={
                                        batch.currentStock === 0 ? 'text-red-600 font-medium' : 
                                        batch.currentStock <= 3 ? 'text-yellow-600 font-medium' : 
                                        'text-green-600 font-medium'
                                      }>{batch.currentStock}</span>
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-medium text-blue-600">₹{batch.sellingPrice}</p>
                                    <p className="text-xs text-gray-500">MRP: ₹{batch.mrp}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {item.batches.length > 6 && (
                              <div className="bg-gray-100 rounded-lg p-3 border border-dashed border-gray-300 flex items-center justify-center">
                                <span className="text-sm text-gray-600">
                                  +{item.batches.length - 6} more batches
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right ml-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === item.medicine.id ? null : item.medicine.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>
                          
                          {openDropdown === item.medicine.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                              <button
                                onClick={() => handleEditMedicine(item.medicine)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(item.medicine)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-4 min-w-[120px]">
                        <p className="text-sm text-gray-600 mb-1">Total Stock</p>
                        <p className={`text-2xl font-bold ${
                          item.totalStock === 0 ? 'text-red-600' : 
                          item.totalStock <= 3 ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {item.totalStock}
                        </p>
                        <p className="text-xs text-gray-500">units</p>
                        <p className="text-sm text-gray-500 mt-2">GST: {item.medicine.gst}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Medicine Modal */}
      {editingMedicine && (
        <EditMedicineModal
          medicine={editingMedicine}
          onClose={() => setEditingMedicine(null)}
          onMedicineUpdated={() => {
            fetchMedicinesWithStock();
            setEditingMedicine(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Medicine</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete <strong>{showDeleteConfirm.brandName || showDeleteConfirm.name}</strong>? 
              This will also delete all associated batches and cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMedicine(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Medicine
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Stock Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">In Stock</p>
              <p className="text-xl font-bold text-green-900">
                {filteredMedicines.filter(item => !item.lowStock && item.totalStock > 0).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <TrendingDown className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Low Stock</p>
              <p className="text-xl font-bold text-yellow-900">
                {filteredMedicines.filter(item => item.lowStock && item.totalStock > 0).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Out of Stock</p>
              <p className="text-xl font-bold text-red-900">
                {filteredMedicines.filter(item => item.totalStock === 0).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            <div>
              <p className="text-sm font-medium text-orange-800">Expiring Soon</p>
              <p className="text-xl font-bold text-orange-900">
                {filteredMedicines.filter(item => item.expiringSoon).length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};