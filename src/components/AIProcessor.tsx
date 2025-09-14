import React, { useState } from 'react';
import { Brain, Zap, CheckCircle, AlertCircle } from 'lucide-react';

interface AIProcessorProps {
  extractedText: string;
  onProcessingComplete: (processedData: any) => void;
  className?: string;
}

export const AIProcessor: React.FC<AIProcessorProps> = ({
  extractedText,
  onProcessingComplete,
  className = ''
}) => {
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [confidence, setConfidence] = useState(0);

  const processWithAI = async () => {
    if (!extractedText.trim()) return;

    setProcessing(true);
    setProcessed(false);

    // Simulate AI processing with realistic delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Mock AI processing results
    const processedData = {
      name: 'Paracetamol 500mg',
      brandName: 'Crocin',
      manufacturer: 'GSK Pharmaceuticals',
      dosage: '500mg',
      medicineType: 'Tablet',
      scheduleType: 'GENERAL',
      hsn: '30049099',
      gst: 12,
      initialBatchNumber: 'PCM001',
      initialMrp: 25.00,
      initialSellingPrice: 23.00,
      initialPurchasePrice: 18.00,
      initialStockQuantity: 100,
      initialExpiryDate: '2025-12-31',
      confidence: 92
    };

    setConfidence(processedData.confidence);
    setProcessing(false);
    setProcessed(true);
    onProcessingComplete(processedData);
  };

  if (!extractedText.trim()) {
    return (
      <div className={`bg-gray-50 rounded-lg p-6 text-center ${className}`}>
        <Brain className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Upload an image to enable AI processing</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <Brain className="w-5 h-5 text-purple-600" />
        <span>AI Processing</span>
      </h3>

      {!processed && !processing && (
        <div className="text-center space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
            <Zap className="w-8 h-8 text-purple-600 mx-auto mb-3" />
            <p className="text-gray-700 mb-4">
              Ready to process extracted text with AI to auto-fill medicine details
            </p>
            <button
              onClick={processWithAI}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center space-x-2 mx-auto"
            >
              <Brain className="w-4 h-4" />
              <span>Process with AI</span>
            </button>
          </div>
        </div>
      )}

      {processing && (
        <div className="text-center space-y-4">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-700 mb-2">AI is analyzing the medicine information...</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
            <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
          </div>
        </div>
      )}

      {processed && (
        <div className="space-y-4">
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">Processing Complete</span>
            </div>
            <p className="text-green-700 mb-3">
              AI has successfully extracted and processed the medicine information.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600">Confidence Score:</span>
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${confidence}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-green-800">{confidence}%</span>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Review Required</p>
                <p>Please verify the auto-filled information below and make any necessary corrections before saving.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};