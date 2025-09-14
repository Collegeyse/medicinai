import React, { useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { db } from '../../database';
import { Medicine, Batch } from '../../types';
import { usePharmacyStore } from '../../store';
import { ImageUpload } from '../ImageUpload';
import { MedicineForm, MedicineFormData } from '../MedicineForm';

interface AddMedicinePageProps {
  onBack: () => void;
  onMedicineAdded: () => void;
}

export const AddMedicinePage: React.FC<AddMedicinePageProps> = ({
  onBack,
  onMedicineAdded
}) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { addNotification } = usePharmacyStore();
  const formRef = useRef<any>(null);

  const handleImageSelected = (file: File) => {
    setSelectedImage(file);
  };

  const handleTextExtracted = (text: string) => {
    setExtractedText(text);
  };

  const handleAIDataExtracted = (aiData: any) => {
    // Auto-fill the form with AI processed data
    if (formRef.current?.autoFillFromAIData) {
      formRef.current.autoFillFromAIData(aiData);
      addNotification('success', `AI extracted medicine data with ${aiData.confidence}% confidence`);
    }
  };

  const handleFormSubmit = async (formData: MedicineFormData) => {
    setLoading(true);

    try {
      // Create new medicine
      const newMedicine: Medicine = {
        id: crypto.randomUUID(),
        name: formData.name,
        genericName: formData.genericName,
        brandName: formData.brandName,
        dosage: formData.dosage,
        medicineType: formData.medicineType,
        manufacturer: formData.manufacturer,
        scheduleType: formData.scheduleType,
        hsn: formData.hsn,
        gst: formData.gst,
        description: formData.description,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.medicines.add(newMedicine);

      // Create initial batch if stock quantity is provided
      if (formData.initialStockQuantity > 0) {
        const newBatch: Batch = {
          id: crypto.randomUUID(),
          medicineId: newMedicine.id,
          batchNumber: formData.initialBatchNumber || `BATCH-${Date.now()}`,
          expiryDate: new Date(formData.initialExpiryDate),
          mrp: formData.initialMrp,
          purchasePrice: formData.initialPurchasePrice,
          sellingPrice: formData.initialSellingPrice,
          currentStock: formData.initialStockQuantity,
          minStock: formData.initialMinStock,
          maxStock: formData.initialMaxStock,
          supplierId: formData.supplierId,
          receivedDate: new Date()
        };

        await db.batches.add(newBatch);
      }

      addNotification('success', `Medicine ${formData.brandName} added successfully`);
      onMedicineAdded();
    } catch (error) {
      console.error('Error adding medicine:', error);
      addNotification('error', 'Failed to add medicine');
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
                <div className="w-10 h-10 bg-gradient-medical rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">Rx</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">AI-Powered Medicine Entry</h1>
                  <p className="text-sm text-gray-600">Upload medicine images and let Google Flash 2.0 auto-fill the form</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Image Upload */}
          <div className="lg:col-span-1 space-y-6">
            <ImageUpload
              onImageSelected={handleImageSelected}
              onAIDataExtracted={handleAIDataExtracted}
            />
          </div>

          {/* Right Column - Medicine Form */}
          <div className="lg:col-span-2">
            <MedicineForm
              ref={formRef}
              onSubmit={handleFormSubmit}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};