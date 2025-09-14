import React, { useState, useEffect } from 'react';
import { X, Save, Pill, Package } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '../../database';
import { Medicine } from '../../types';
import { usePharmacyStore } from '../../store';

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
  const { addNotification } = usePharmacyStore();

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

  const onSubmit = async (data: EditMedicineFormData) => {
    setLoading(true);
    
    try {
      const updatedMedicine: Medicine = {
        ...medicine,
        ...data,
        updatedAt: new Date()
      };

      await db.medicines.update(medicine.id, updatedMedicine);
      
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
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
              <span>{loading ? 'Updating...' : 'Update Medicine'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};