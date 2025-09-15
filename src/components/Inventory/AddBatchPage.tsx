import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Package, Calendar, Hash, Building2, MapPin, DollarSign, Save, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '../../database';
import { Medicine, Batch } from '../../types';
import { usePharmacyStore } from '../../store';
import { format } from 'date-fns';

const batchSchema = z.object({
  medicineId: z.string().min(1, 'Medicine selection is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  manufacturingDate: z.string().min(1, 'Manufacturing date is required'),
  mrp: z.number().min(0, 'MRP must be positive'),
  purchasePrice: z.number().min(0, 'Purchase price must be positive'),
  sellingPrice: z.number().min(0, 'Selling price must be positive'),
  minStock: z.number().min(0, 'Minimum stock must be positive'),
  maxStock: z.number().min(0, 'Maximum stock must be positive'),
  supplierId: z.string().min(1, 'Supplier information is required'),
  location: z.string().min(1, 'Location/warehouse is required')
});

type BatchFormData = z.infer<typeof batchSchema>;

interface BatchEntry extends BatchFormData {
  id: string;
  medicineName: string;
  medicineInfo?: Medicine;
}

interface AddBatchPageProps {
  onBack: () => void;
}

export const AddBatchPage: React.FC<AddBatchPageProps> = ({ onBack }) => {
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [loading, setLoading] = useState(false);
  const { addNotification } = usePharmacyStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      batchNumber: `BATCH-${Date.now()}`,
      quantity: 100,
      minStock: 10,
      maxStock: 500,
      supplierId: 'DEFAULT',
      location: 'MAIN-WAREHOUSE',
      manufacturingDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  });

  // Auto-calculate selling price when MRP changes
  const mrp = watch('mrp');
  React.useEffect(() => {
    if (mrp > 0) {
      setValue('sellingPrice', mrp * 0.9);
    }
  }, [mrp, setValue]);

  // Auto-calculate purchase price when selling price changes
  const sellingPrice = watch('sellingPrice');
  React.useEffect(() => {
    if (sellingPrice > 0) {
      setValue('purchasePrice', sellingPrice * 0.8);
    }
  }, [sellingPrice, setValue]);

  // Search medicines
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
      setSearchResults([]);
    }
  };

  const selectMedicine = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setValue('medicineId', medicine.id);
    setSearchQuery('');
    setSearchResults([]);
    
    // Auto-generate batch number with medicine prefix
    const prefix = medicine.brandName?.substring(0, 3).toUpperCase() || 'MED';
    setValue('batchNumber', `${prefix}-${Date.now()}`);
  };

  const addToBatchList = (data: BatchFormData) => {
    if (!selectedMedicine) {
      addNotification('error', 'Please select a medicine first');
      return;
    }

    const newBatch: BatchEntry = {
      ...data,
      id: crypto.randomUUID(),
      medicineName: selectedMedicine.brandName || selectedMedicine.name,
      medicineInfo: selectedMedicine
    };

    setBatchEntries(prev => [...prev, newBatch]);
    
    // Reset form but keep medicine selection
    reset({
      medicineId: selectedMedicine.id,
      batchNumber: `${selectedMedicine.brandName?.substring(0, 3).toUpperCase() || 'MED'}-${Date.now()}`,
      quantity: 100,
      minStock: 10,
      maxStock: 500,
      supplierId: data.supplierId,
      location: data.location,
      manufacturingDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });

    addNotification('success', `Batch added to list for ${selectedMedicine.brandName}`);
  };

  const removeBatchEntry = (id: string) => {
    setBatchEntries(prev => prev.filter(batch => batch.id !== id));
  };

  const processBatches = async () => {
    if (batchEntries.length === 0) {
      addNotification('error', 'No batches to process');
      return;
    }

    setLoading(true);
    try {
      for (const batchEntry of batchEntries) {
        const newBatch: Batch = {
          id: crypto.randomUUID(),
          medicineId: batchEntry.medicineId,
          batchNumber: batchEntry.batchNumber,
          expiryDate: new Date(batchEntry.expiryDate),
          mrp: batchEntry.mrp,
          purchasePrice: batchEntry.purchasePrice,
          sellingPrice: batchEntry.sellingPrice,
          currentStock: batchEntry.quantity,
          minStock: batchEntry.minStock,
          maxStock: batchEntry.maxStock,
          supplierId: batchEntry.supplierId,
          receivedDate: new Date(batchEntry.manufacturingDate)
        };

        await db.batches.add(newBatch);
      }

      addNotification('success', `Successfully added ${batchEntries.length} batches to inventory`);
      setBatchEntries([]);
      setSelectedMedicine(null);
      reset();
    } catch (error) {
      console.error('Error processing batches:', error);
      addNotification('error', 'Failed to process batches');
    } finally {
      setLoading(false);
    }
  };

  const getTotalQuantity = () => {
    return batchEntries.reduce((sum, batch) => sum + batch.quantity, 0);
  };

  const getTotalValue = () => {
    return batchEntries.reduce((sum, batch) => sum + (batch.quantity * batch.purchasePrice), 0);
  };

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
                  <h1 className="text-2xl font-bold text-gray-900">Add New Batches</h1>
                  <p className="text-sm text-gray-600">Create and manage product batches with tracking capabilities</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Batches Ready: {batchEntries.length}</p>
                <p className="text-sm text-gray-600">Total Units: {getTotalQuantity()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Medicine Selection & Batch Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Medicine Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Medicine</h2>
              
              {selectedMedicine ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-blue-900">{selectedMedicine.brandName}</h3>
                      <p className="text-sm text-blue-700">{selectedMedicine.name}</p>
                      <p className="text-xs text-blue-600">Manufacturer: {selectedMedicine.manufacturer}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedMedicine(null);
                        setValue('medicineId', '');
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Change Medicine
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search medicines by name, brand, or manufacturer..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-4 border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-60 overflow-y-auto">
                      {searchResults.map((medicine) => (
                        <div key={medicine.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => selectMedicine(medicine)}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-1">
                                <h3 className="font-medium text-gray-900">{medicine.brandName || medicine.name}</h3>
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
                              <p className="text-xs text-gray-500">Manufacturer: {medicine.manufacturer}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Batch Form */}
            {selectedMedicine && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Batch Information</h2>
                
                <form onSubmit={handleSubmit(addToBatchList)} className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Hash className="w-4 h-4 inline mr-1" />
                        Batch Number *
                      </label>
                      <input
                        {...register('batchNumber')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Auto-generated or custom"
                      />
                      {errors.batchNumber && (
                        <p className="mt-1 text-sm text-red-600">{errors.batchNumber.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Package className="w-4 h-4 inline mr-1" />
                        Quantity *
                      </label>
                      <input
                        {...register('quantity', { valueAsNumber: true })}
                        type="number"
                        min="1"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Number of units"
                      />
                      {errors.quantity && (
                        <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Manufacturing Date *
                      </label>
                      <input
                        {...register('manufacturingDate')}
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {errors.manufacturingDate && (
                        <p className="mt-1 text-sm text-red-600">{errors.manufacturingDate.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Expiry Date *
                      </label>
                      <input
                        {...register('expiryDate')}
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {errors.expiryDate && (
                        <p className="mt-1 text-sm text-red-600">{errors.expiryDate.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <DollarSign className="w-4 h-4 inline mr-1" />
                        MRP (₹) *
                      </label>
                      <input
                        {...register('mrp', { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Maximum Retail Price"
                      />
                      {errors.mrp && (
                        <p className="mt-1 text-sm text-red-600">{errors.mrp.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Selling Price (₹) *
                      </label>
                      <input
                        {...register('sellingPrice', { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Customer price"
                      />
                      {errors.sellingPrice && (
                        <p className="mt-1 text-sm text-red-600">{errors.sellingPrice.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Purchase Price (₹) *
                      </label>
                      <input
                        {...register('purchasePrice', { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Cost from supplier"
                      />
                      {errors.purchasePrice && (
                        <p className="mt-1 text-sm text-red-600">{errors.purchasePrice.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Stock Levels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Stock Level
                      </label>
                      <input
                        {...register('minStock', { valueAsNumber: true })}
                        type="number"
                        min="0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Alert threshold"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Stock Level
                      </label>
                      <input
                        {...register('maxStock', { valueAsNumber: true })}
                        type="number"
                        min="0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Maximum capacity"
                      />
                    </div>
                  </div>

                  {/* Supplier & Location */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Building2 className="w-4 h-4 inline mr-1" />
                        Supplier Information *
                      </label>
                      <input
                        {...register('supplierId')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Supplier ID or name"
                      />
                      {errors.supplierId && (
                        <p className="mt-1 text-sm text-red-600">{errors.supplierId.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Location/Warehouse *
                      </label>
                      <select
                        {...register('location')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="MAIN-WAREHOUSE">Main Warehouse</option>
                        <option value="COLD-STORAGE">Cold Storage</option>
                        <option value="PHARMACY-FLOOR">Pharmacy Floor</option>
                        <option value="SECURE-STORAGE">Secure Storage</option>
                        <option value="QUARANTINE">Quarantine Area</option>
                      </select>
                      {errors.location && (
                        <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Add to List Button */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add to Batch List</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Batch List & Summary */}
          <div className="space-y-6">
            {/* Batch Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Batch Summary</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Total Batches:</span>
                  <span className="font-medium">{batchEntries.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Units:</span>
                  <span className="font-medium">{getTotalQuantity()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Value:</span>
                  <span className="font-medium">₹{getTotalValue().toFixed(2)}</span>
                </div>
                
                {batchEntries.length > 0 && (
                  <button
                    onClick={processBatches}
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 font-medium"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{loading ? 'Processing...' : 'Process All Batches'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Batch List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Batch Queue ({batchEntries.length})</h3>
              </div>
              
              <div className="p-6">
                {batchEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No batches added yet</p>
                    <p className="text-sm text-gray-400 mt-1">Select a medicine and add batch information</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {batchEntries.map((batch, index) => (
                      <div key={batch.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">{batch.medicineName}</h4>
                            <p className="text-sm text-gray-600">Batch: {batch.batchNumber}</p>
                          </div>
                          <button
                            onClick={() => removeBatchEntry(batch.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">Quantity:</span>
                            <p className="font-medium">{batch.quantity} units</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Location:</span>
                            <p className="font-medium">{batch.location}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Expiry:</span>
                            <p className="font-medium">{format(new Date(batch.expiryDate), 'MMM dd, yyyy')}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Value:</span>
                            <p className="font-medium">₹{(batch.quantity * batch.purchasePrice).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};