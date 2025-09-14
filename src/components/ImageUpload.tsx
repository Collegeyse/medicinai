import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, FileText, AlertCircle } from 'lucide-react';
import { googleAIService } from '../services/googleAI';

interface ImageUploadProps {
  onImageSelected: (file: File) => void;
  onTextExtracted?: (text: string) => void;
  onAIDataExtracted?: (data: any) => void;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageSelected,
  onTextExtracted,
  onAIDataExtracted,
  className = ''
}) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedImage(file);
      setError(null);
      onImageSelected(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Automatically process with Google AI
      await processWithGoogleAI(file);
    }
  }, [onImageSelected, onTextExtracted, onAIDataExtracted]);

  const processWithGoogleAI = async (file: File) => {
    if (!googleAIService.isConfigured()) {
      setError('Google AI API key not configured. Please add VITE_GOOGLE_AI_API_KEY to your .env file.');
      return;
    }

    setProcessing(true);
    setError(null);
    
    try {
      const aiData = await googleAIService.extractMedicineInfo(file);
      
      // Create extracted text for display
      const displayText = `Medicine Name: ${aiData.name || 'Not detected'}
Brand: ${aiData.brandName || 'Not detected'}
Manufacturer: ${aiData.manufacturer || 'Not detected'}
Batch No: ${aiData.batchNumber || 'Not detected'}
Expiry Date: ${aiData.expiryDate || 'Not detected'}
MRP: ₹${aiData.mrp || 'Not detected'}
HSN: ${aiData.hsn || 'Not detected'}${aiData.hsnGenerated ? ' (Auto-generated)' : ''}
Schedule: ${aiData.scheduleType || 'GENERAL'}
Confidence: ${aiData.confidence || 0}%`;

      setExtractedText(displayText);
      onTextExtracted?.(displayText);
      onAIDataExtracted?.(aiData);
    } catch (error) {
      console.error('AI processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process image with AI';
      setError(errorMessage);
      setExtractedText('');
    } finally {
      setProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setExtractedText('');
    setError(null);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <ImageIcon className="w-5 h-5 text-blue-600" />
          <span>Medicine Image Upload</span>
        </h3>
        
        {!selectedImage ? (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
              ${isDragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              {isDragActive ? 'Drop the image here' : 'Upload medicine package or label'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Drag and drop an image, or click to select
            </p>
            <p className="text-xs text-gray-400">
              Supports: JPEG, PNG, GIF, BMP, WebP (Max 10MB)
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <img
                src={imagePreview!}
                alt="Medicine preview"
                className="w-full max-w-md mx-auto rounded-lg shadow-md"
              />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {selectedImage.name}
              </p>
              <p className="text-xs text-gray-500">
                {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* AI Processing Status */}
      {processing && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Google Flash 2.0 is analyzing the medicine information...</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="text-red-800 font-medium">AI Processing Error</h4>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              {error.includes('API key') && (
                <div className="mt-2 p-3 bg-red-100 rounded-md">
                  <p className="text-red-800 text-sm font-medium">Setup Instructions:</p>
                  <ol className="text-red-700 text-sm mt-1 list-decimal list-inside space-y-1">
                    <li>Create a <code className="bg-red-200 px-1 rounded">.env</code> file in your project root</li>
                    <li>Add: <code className="bg-red-200 px-1 rounded">VITE_GOOGLE_AI_API_KEY=your_api_key_here</code></li>
                    <li>Restart the development server</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Processing Results */}
      {extractedText && !processing && !error && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-green-600" />
            <span>AI Extracted Information</span>
          </h3>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {extractedText}
            </pre>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>✨ AI Magic:</strong> The form below has been auto-filled using Google Flash 2.0. 
                Please review and modify as needed before saving.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* API Key Setup Instructions */}
      {!googleAIService.isConfigured() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-yellow-800 font-medium">Google AI Setup Required</h4>
              <p className="text-yellow-700 text-sm mt-1">
                To enable AI-powered medicine extraction, please configure your Google AI API key:
              </p>
              <div className="mt-3 p-3 bg-yellow-100 rounded-md">
                <ol className="text-yellow-800 text-sm space-y-2 list-decimal list-inside">
                  <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-900">Google AI Studio</a></li>
                  <li>Click "Create API Key" (free, no client ID needed)</li>
                  <li>Copy the generated key</li>
                  <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                  <li>Click "Create API Key" (no sign-up required)</li>
                  <li>Copy the generated API key</li>
                  <li>Create a <code className="bg-red-200 px-1 rounded">.env</code> file in your project root</li>
                  <li>Add: <code className="bg-red-200 px-1 rounded">VITE_GOOGLE_AI_API_KEY=your_api_key_here</code></li>
                  <li>Restart the development server</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};