import React, { useState, useEffect } from 'react';
import { X, Save, Pill, Package } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '../../database';
import { Medicine, Batch } from '../../types';
import { usePharmacyStore } from '../../store';
import { format } from 'date-fns';

const editMedicineSchema = z.object({
  name: z.string().min(1, 'Medicine name is required'),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  dosage: z.string().optional(),
  medicineType: z.string().min(1, 'Medicine type is required'),
  manufacturer: z.string().optional(),
  scheduleType: z.enum(['H', 'H1', 'X', 'GENERAL']),
  hsn: z.string().optional(),
  gst: z.number().min(0).max(100),
  description: z.string().optional()
});

type EditMedicineFormData = z.infer<typeof editMedicineSchema>;

interface EditMedicineModalProps {
  medicine: Medicine;
  onClose: () => void;
  onMedicineUpdated: () => void;
}

export const EditMedicineModal: React.FC<EditMedicineModalProps> = ({
  medicine,
  onClose,
  onMedicineUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [editingBatches, setEditingBatches] = useState<Record<string, Batch>>({});
  const { addNotification } = usePharmacyStore();

  useEffect(() => {
    loadBatches();
  }, [medicine.id]);

  const loadBatches = async () => {
    try {
      const medicineBatches = await db.batches
        .where('medicineId')
        .equals(medicine.id)
        .toArray();
      setBatches(medicineBatches);
      
      // Initialize editing state
      const editingState: Record<string, Batch> = {};
      medicineBatches.forEach(batch => {
        editingState[batch.id] = { ...batch };
      });
      setEditingBatches(editingState);
    } catch (error) {
      console.error('Error loading batches:', error);
    }
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<EditMedicineFormData>({
    resolver: zodResolver(editMedicineSchema),
    defaultValues: {
      name: medicine.name,
      genericName: medicine.genericName || '',
      brandName: medicine.brandName || '',
      dosage: medicine.dosage || '',
      medicineType: medicine.medicineType || '',
      manufacturer: medicine.manufacturer || '',
      scheduleType: medicine.scheduleType,
      hsn: medicine.hsn || '',
      gst: medicine.gst,
      description: medicine.description || ''
    }
  });

  const updateBatchField = (batchId: string, field: keyof Batch, value: any) => {
    setEditingBatches(prev => ({
      ...prev,
      [batchId]: {
        ...prev[batchId],
        [field]: value
      }
    }));
  };
  const onSubmit = async (data: EditMedicineFormData) => {
    setLoading(true);
    
    try {
      // Update medicine
      const updatedMedicine: Medicine = {
        ...medicine,
        ...data,
        updatedAt: new Date()
      };

      await db.medicines.update(medicine.id, updatedMedicine);
      
      // Update batches
      for (const batch of batches) {
        const editedBatch = editingBatches[batch.id];
        if (editedBatch) {
          await db.batches.update(batch.id, {
            ...editedBatch,
            expiryDate: new Date(editedBatch.expiryDate)
          });
        }
      }
      
      addNotification('success', `Medicine ${data.brandName || data.name} updated successfully`);
      onMedicineUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating medicine:', error);
      addNotification('error', 'Failed to update medicine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Pill className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Medicine</h2>
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
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Medicine Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medicine Name *
                </label>
                <input
                  {...register('name')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="e.g., Paracetamol 500mg"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Brand Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Name
                </label>
                <input
                  {...register('brandName')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="e.g., Crocin"
                />
              </div>

              {/* Generic Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Generic Name
                </label>
                <input
                  {...register('genericName')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="e.g., Paracetamol"
                />
              </div>

              {/* Dosage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dosage
                </label>
                <input
                  {...register('dosage')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="e.g., 500mg"
                />
              </div>

              {/* Medicine Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medicine Type *
                </label>
                <select
                  {...register('medicineType')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <option value="">Select type</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Capsule">Capsule</option>
                  <option value="Syrup">Syrup</option>
                  <option value="Injection">Injection</option>
                  <option value="Cream">Cream</option>
                  <option value="Ointment">Ointment</option>
                  <option value="Drops">Drops</option>
                  <option value="Powder">Powder</option>
                  <option value="Other">Other</option>
                </select>
                {errors.medicineType && (
                  <p className="mt-1 text-sm text-red-600">{errors.medicineType.message}</p>
                )}
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manufacturer
                </label>
                <input
                  {...register('manufacturer')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="e.g., GSK Pharmaceuticals"
                />
              </div>
            </div>
          </div>

          {/* Regulatory Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Regulatory Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Schedule Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Type
                </label>
                <select
                  {...register('scheduleType')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <option value="GENERAL">General</option>
                  <option value="H">Schedule H</option>
                  <option value="H1">Schedule H1</option>
                  <option value="X">Schedule X</option>
                </select>
              </div>

              {/* HSN Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HSN Code
                </label>
                <input
                  {...register('hsn')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="e.g., 30049099"
                />
              </div>

              {/* GST Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GST Rate (%)
                </label>
                <input
                  {...register('gst', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="12"
                />
                {errors.gst && (
                  <p className="mt-1 text-sm text-red-600">{errors.gst.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="Medicine description, uses, and other details..."
            />
          </div>

          {/* Batch Information */}
          {batches.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
                <Package className="w-5 h-5 text-green-600" />
                <span>Batch Information ({batches.length} batches)</span>
              </h3>
              
              <div className="space-y-4">
                {batches.map((batch) => {
                  const editingBatch = editingBatches[batch.id];
                  if (!editingBatch) return null;
                  
                  return (
                    <div key={batch.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-4">
                        Batch: {batch.batchNumber}
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Batch Number */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Batch Number
                          </label>
                          <input
                            type="text"
                            value={editingBatch.batchNumber}
                            onChange={(e) => updateBatchField(batch.id, 'batchNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        
                        {/* Expiry Date */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Expiry Date
                          </label>
                          <input
                            type="date"
                            value={editingBatch.expiryDate ? format(new Date(editingBatch.expiryDate), 'yyyy-MM-dd') : ''}
                            onChange={(e) => updateBatchField(batch.id, 'expiryDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        
                        {/* MRP */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            MRP (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingBatch.mrp}
                            onChange={(e) => updateBatchField(batch.id, 'mrp', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        
                        {/* Selling Price */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selling Price (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingBatch.sellingPrice}
                            onChange={(e) => updateBatchField(batch.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        
                        {/* Purchase Price */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Purchase Price (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingBatch.purchasePrice}
                            onChange={(e) => updateBatchField(batch.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        
                        {/* Current Stock */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Current Stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editingBatch.currentStock}
                            onChange={(e) => updateBatchField(batch.id, 'currentStock', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        
                        {/* Min Stock */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Min Stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editingBatch.minStock}
                            onChange={(e) => updateBatchField(batch.id, 'minStock', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        
                        {/* Max Stock */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Max Stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editingBatch.maxStock}
                            onChange={(e) => updateBatchField(batch.id, 'maxStock', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>
                      
                      {/* Batch Status */}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>Supplier: {batch.supplierId}</span>
                          <span>Received: {format(new Date(batch.receivedDate), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            editingBatch.currentStock === 0 
                              ? 'bg-red-100 text-red-700' 
                              : editingBatch.currentStock <= editingBatch.minStock
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {editingBatch.currentStock === 0 ? 'Out of Stock' : 
                             editingBatch.currentStock <= editingBatch.minStock ? 'Low Stock' : 'In Stock'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                <Save className="w-4 h-4" />
              )}
              <span>{loading ? 'Updating...' : 'Update Medicine & Batches'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};