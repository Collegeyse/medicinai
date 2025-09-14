import React, { useState } from 'react';
import { X, Package, Calendar, DollarSign, Hash, Building2 } from 'lucide-react';
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

interface RestockModalProps {
  medicine: Medicine;
  onClose: () => void;
  onRestockComplete: () => void;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  medicine,
  onClose,
  onRestockComplete
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
      onRestockComplete();
    } catch (error) {
      console.error('Error restocking medicine:', error);
      addNotification('error', 'Failed to restock medicine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Restock Medicine</h2>
              <p className="text-sm text-gray-600">{medicine.brandName || medicine.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Medicine Info Display */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-2">Medicine Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Name:</span>
                <p className="font-medium text-blue-900">{medicine.name}</p>
              </div>
              <div>
                <span className="text-blue-700">Manufacturer:</span>
                <p className="font-medium text-blue-900">{medicine.manufacturer}</p>
              </div>
              <div>
                <span className="text-blue-700">Schedule:</span>
                <p className="font-medium text-blue-900">{medicine.scheduleType}</p>
              </div>
              <div>
                <span className="text-blue-700">HSN:</span>
                <p className="font-medium text-blue-900">{medicine.hsn}</p>
              </div>
            </div>
          </div>

          {/* Batch Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-1" />
                Batch Number *
              </label>
              <input
                {...register('batchNumber')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter batch number"
              />
              {errors.batchNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.batchNumber.message}</p>
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

          {/* Pricing Information */}
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

          {/* Stock Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Maximum capacity"
              />
              {errors.maxStock && (
                <p className="mt-1 text-sm text-red-600">{errors.maxStock.message}</p>
              )}
            </div>
          </div>

          {/* Supplier Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="w-4 h-4 inline mr-1" />
              Supplier ID
            </label>
            <input
              {...register('supplierId')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Supplier identifier"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-medium"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Package className="w-4 h-4" />
              )}
              <span>{loading ? 'Adding Stock...' : 'Add Stock'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};