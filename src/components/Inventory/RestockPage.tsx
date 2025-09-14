import React, { useState } from 'react';
import { ArrowLeft, Package, Calendar, DollarSign, Hash, Building2, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '../../database';
import { Medicine, Batch } from '../../types';
import { usePharmacyStore } from '../../store';

const restockSchema = z.object({
  batchNumber: z.string().min(1, 'Batch number is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  purchasePrice: z.number().min(0, 'Purchase price must be positive'),
  sellingPrice: z.number().min(0, 'Selling price must be positive'),
  mrp: z.number().min(0, 'MRP must be positive'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  minStock: z.number().min(0, 'Minimum stock must be positive'),
  maxStock: z.number().min(0, 'Maximum stock must be positive'),
  supplierId: z.string().default('DEFAULT')
});

type RestockFormData = z.infer<typeof restockSchema>;

interface RestockPageProps {
  medicine: Medicine;
  onBack: () => void;
}

export const RestockPage: React.FC<RestockPageProps> = ({
  medicine,
  onBack
}) => {
  const [loading, setLoading] = useState(false);
  const { addNotification } = usePharmacyStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<RestockFormData>({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      batchNumber: `BATCH-${Date.now()}`,
      quantity: 100,
      minStock: 10,
      maxStock: 500,
      supplierId: 'DEFAULT'
    }
  });

  // Auto-calculate selling price when MRP changes
  const mrp = watch('mrp');
  React.useEffect(() => {
    if (mrp > 0) {
      setValue('sellingPrice', mrp * 0.9); // 90% of MRP
    }
  }, [mrp, setValue]);

  // Auto-calculate purchase price when selling price changes
  const sellingPrice = watch('sellingPrice');
  React.useEffect(() => {
    if (sellingPrice > 0) {
      setValue('purchasePrice', sellingPrice * 0.8); // 80% of selling price
    }
  }, [sellingPrice, setValue]);

  const onSubmit = async (data: RestockFormData) => {
    setLoading(true);
    
    try {
      // Create new batch
      const newBatch: Batch = {
        id: crypto.randomUUID(),
        medicineId: medicine.id,
        batchNumber: data.batchNumber,
        expiryDate: new Date(data.expiryDate),
        mrp: data.mrp,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
        currentStock: data.quantity,
        minStock: data.minStock,
        maxStock: data.maxStock,
        supplierId: data.supplierId,
        receivedDate: new Date()
      };

      await db.batches.add(newBatch);
      
      addNotification('success', `Successfully restocked ${medicine.brandName} with ${data.quantity} units`);
      onBack();
    } catch (error) {
      console.error('Error restocking medicine:', error);
      addNotification('error', 'Failed to restock medicine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
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
                  <h1 className="text-2xl font-bold text-gray-900">Restock Medicine</h1>
                  <p className="text-sm text-gray-600">Add new stock for {medicine.brandName || medicine.name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Medicine Information Display */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Medicine Information</h2>
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Name:</span>
                  <p className="font-semibold text-blue-900">{medicine.name}</p>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Brand:</span>
                  <p className="font-semibold text-blue-900">{medicine.brandName}</p>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Manufacturer:</span>
                  <p className="font-semibold text-blue-900">{medicine.manufacturer}</p>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Schedule:</span>
                  <p className="font-semibold text-blue-900">{medicine.scheduleType}</p>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">HSN:</span>
                  <p className="font-semibold text-blue-900">{medicine.hsn}</p>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">GST:</span>
                  <p className="font-semibold text-blue-900">{medicine.gst}%</p>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Type:</span>
                  <p className="font-semibold text-blue-900">{medicine.medicineType}</p>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Dosage:</span>
                  <p className="font-semibold text-blue-900">{medicine.dosage}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Batch Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
              <Hash className="w-5 h-5 text-green-600" />
              <span>New Batch Information</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Number *
                </label>
                <input
                  {...register('batchNumber')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Enter batch number"
                />
                {errors.batchNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.batchNumber.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry Date *
                </label>
                <input
                  {...register('expiryDate')}
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
                {errors.expiryDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.expiryDate.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Pricing Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span>Pricing Information</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MRP (₹) *
                </label>
                <input
                  {...register('mrp', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Cost from supplier"
                />
                {errors.purchasePrice && (
                  <p className="mt-1 text-sm text-red-600">{errors.purchasePrice.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Stock Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
              <Package className="w-5 h-5 text-green-600" />
              <span>Stock Information</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  {...register('quantity', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Units to add"
                />
                {errors.quantity && (
                  <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Stock
                </label>
                <input
                  {...register('minStock', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Alert threshold"
                />
                {errors.minStock && (
                  <p className="mt-1 text-sm text-red-600">{errors.minStock.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Stock
                </label>
                <input
                  {...register('maxStock', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Maximum capacity"
                />
                {errors.maxStock && (
                  <p className="mt-1 text-sm text-red-600">{errors.maxStock.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier ID
                </label>
                <input
                  {...register('supplierId')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Supplier identifier"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onBack}
                className="px-8 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-medium"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span>{loading ? 'Adding Stock...' : 'Add Stock'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};