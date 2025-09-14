import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Package, 
  CheckSquare, 
  Square, 
  AlertTriangle, 
  TrendingDown,
  Calculator,
  FileText,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { db } from '../../database';
import { Medicine, Batch } from '../../types';
import { usePharmacyStore } from '../../store';
import { format } from 'date-fns';

interface RestockSuggestion {
  medicine: Medicine;
  currentStock: number;
  minStock: number;
  maxStock: number;
  suggestedQuantity: number;
  customQuantity: number;
  isSelected: boolean;
  priority: 'critical' | 'low' | 'normal';
  estimatedCost: number;
  lastRestockDate?: Date;
  averageConsumption: number;
}

interface RestockSuggestionPageProps {
  onBack: () => void;
}

export const RestockSuggestionPage: React.FC<RestockSuggestionPageProps> = ({ onBack }) => {
  const [suggestions, setSuggestions] = useState<RestockSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<'all' | 'critical' | 'low' | 'normal'>('all');
  const [selectAll, setSelectAll] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const { addNotification } = usePharmacyStore();

  useEffect(() => {
    loadRestockSuggestions();
  }, []);

  const loadRestockSuggestions = async () => {
    setLoading(true);
    try {
      const medicines = await db.medicines.toArray();
      const restockSuggestions: RestockSuggestion[] = [];

      for (const medicine of medicines) {
        const batches = await db.batches
          .where('medicineId')
          .equals(medicine.id)
          .filter(batch => batch.currentStock > 0 && new Date(batch.expiryDate) > new Date())
          .toArray();

        const currentStock = batches.reduce((sum, batch) => sum + batch.currentStock, 0);
        const minStock = batches.length > 0 ? Math.min(...batches.map(b => b.minStock)) : 10;
        const maxStock = batches.length > 0 ? Math.max(...batches.map(b => b.maxStock)) : 100;
        
        // Calculate suggested quantity based on stock levels and consumption patterns
        let suggestedQuantity = 0;
        let priority: 'critical' | 'low' | 'normal' = 'normal';
        
        if (currentStock === 0) {
          suggestedQuantity = Math.max(minStock * 2, 50);
          priority = 'critical';
        } else if (currentStock <= minStock) {
          suggestedQuantity = maxStock - currentStock;
          priority = 'low';
        } else if (currentStock <= minStock * 2) {
          suggestedQuantity = Math.max(maxStock - currentStock, minStock);
          priority = 'normal';
        }

        // Only include medicines that need restocking
        if (suggestedQuantity > 0) {
          const averagePrice = batches.length > 0 
            ? batches.reduce((sum, batch) => sum + batch.purchasePrice, 0) / batches.length 
            : 0;

          restockSuggestions.push({
            medicine,
            currentStock,
            minStock,
            maxStock,
            suggestedQuantity,
            customQuantity: suggestedQuantity,
            isSelected: priority === 'critical', // Auto-select critical items
            priority,
            estimatedCost: averagePrice,
            averageConsumption: 5 // Simplified - could be calculated from sales history
          });
        }
      }

      // Sort by priority (critical first, then low, then normal)
      restockSuggestions.sort((a, b) => {
        const priorityOrder = { critical: 0, low: 1, normal: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      setSuggestions(restockSuggestions);
    } catch (error) {
      console.error('Error loading restock suggestions:', error);
      addNotification('error', 'Failed to load restock suggestions');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (medicineId: string, quantity: number) => {
    setSuggestions(prev => 
      prev.map(suggestion => 
        suggestion.medicine.id === medicineId 
          ? { ...suggestion, customQuantity: Math.max(0, quantity) }
          : suggestion
      )
    );
  };

  const toggleSelection = (medicineId: string) => {
    setSuggestions(prev => 
      prev.map(suggestion => 
        suggestion.medicine.id === medicineId 
          ? { ...suggestion, isSelected: !suggestion.isSelected }
          : suggestion
      )
    );
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setSuggestions(prev => 
      prev.map(suggestion => ({ ...suggestion, isSelected: newSelectAll }))
    );
  };

  const validateQuantity = (suggestion: RestockSuggestion): { isValid: boolean; warning?: string } => {
    const { customQuantity, maxStock, currentStock, suggestedQuantity } = suggestion;
    
    if (customQuantity <= 0) {
      return { isValid: false, warning: 'Quantity must be greater than 0' };
    }
    
    if (customQuantity > maxStock * 2) {
      return { isValid: true, warning: 'Quantity is unusually high' };
    }
    
    if (customQuantity < suggestedQuantity * 0.5) {
      return { isValid: true, warning: 'Quantity might be too low' };
    }
    
    return { isValid: true };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return AlertTriangle;
      case 'low': return TrendingDown;
      default: return Package;
    }
  };

  const filteredSuggestions = suggestions.filter(suggestion => {
    const matchesSearch = suggestion.medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         suggestion.medicine.brandName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         suggestion.medicine.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterPriority === 'all' || suggestion.priority === filterPriority;
    
    return matchesSearch && matchesFilter;
  });

  const selectedSuggestions = filteredSuggestions.filter(s => s.isSelected);
  const totalEstimatedCost = selectedSuggestions.reduce((sum, s) => sum + (s.customQuantity * s.estimatedCost), 0);
  const totalItems = selectedSuggestions.reduce((sum, s) => sum + s.customQuantity, 0);

  const generateRestockOrder = () => {
    const orderItems = selectedSuggestions.map(suggestion => ({
      medicine: suggestion.medicine,
      quantity: suggestion.customQuantity,
      estimatedCost: suggestion.estimatedCost,
      totalCost: suggestion.customQuantity * suggestion.estimatedCost,
      priority: suggestion.priority,
      currentStock: suggestion.currentStock
    }));

    // Store in localStorage for processing
    localStorage.setItem('restockOrder', JSON.stringify(orderItems));
    addNotification('success', `Restock order generated with ${orderItems.length} items`);
    setShowOrderSummary(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading restock suggestions...</p>
        </div>
      </div>
    );
  }

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
                  <h1 className="text-2xl font-bold text-gray-900">Restock Suggestions</h1>
                  <p className="text-sm text-gray-600">Review and customize restock recommendations</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={loadRestockSuggestions}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              <button
                onClick={generateRestockOrder}
                disabled={selectedSuggestions.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Generate Order ({selectedSuggestions.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Filters and Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search medicines..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value as any)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                  >
                    <option value="all">All Priorities</option>
                    <option value="critical">Critical Only</option>
                    <option value="low">Low Stock Only</option>
                    <option value="normal">Normal Priority</option>
                  </select>
                </div>
                
                <button
                  onClick={handleSelectAll}
                  className="flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {selectAll ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  <span>{selectAll ? 'Deselect All' : 'Select All'}</span>
                </button>
              </div>
            </div>

            {/* Suggestions List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Restock Recommendations ({filteredSuggestions.length})
                </h2>
              </div>

              {filteredSuggestions.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No restock suggestions found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredSuggestions.map((suggestion) => {
                    const validation = validateQuantity(suggestion);
                    const PriorityIcon = getPriorityIcon(suggestion.priority);
                    
                    return (
                      <div key={suggestion.medicine.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start space-x-4">
                          {/* Selection Checkbox */}
                          <div className="flex items-center h-5 mt-1">
                            <button
                              onClick={() => toggleSelection(suggestion.medicine.id)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {suggestion.isSelected ? 
                                <CheckSquare className="w-5 h-5" /> : 
                                <Square className="w-5 h-5" />
                              }
                            </button>
                          </div>

                          {/* Medicine Info */}
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-gray-900">
                                {suggestion.medicine.brandName || suggestion.medicine.name}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(suggestion.priority)} flex items-center space-x-1`}>
                                <PriorityIcon className="w-3 h-3" />
                                <span className="capitalize">{suggestion.priority}</span>
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">{suggestion.medicine.name}</p>
                            <p className="text-sm text-gray-500">Manufacturer: {suggestion.medicine.manufacturer}</p>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                              <div>
                                <span className="text-gray-500">Current Stock:</span>
                                <p className={`font-medium ${
                                  suggestion.currentStock === 0 ? 'text-red-600' : 
                                  suggestion.currentStock <= suggestion.minStock ? 'text-yellow-600' : 
                                  'text-green-600'
                                }`}>
                                  {suggestion.currentStock} units
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Min Stock:</span>
                                <p className="font-medium text-gray-900">{suggestion.minStock}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Suggested:</span>
                                <p className="font-medium text-blue-600">{suggestion.suggestedQuantity}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Est. Cost:</span>
                                <p className="font-medium text-gray-900">₹{suggestion.estimatedCost.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>

                          {/* Quantity Input */}
                          <div className="flex flex-col items-end space-y-2">
                            <div className="flex items-center space-x-2">
                              <label className="text-sm font-medium text-gray-700">Quantity:</label>
                              <input
                                type="number"
                                min="0"
                                max={suggestion.maxStock * 2}
                                value={suggestion.customQuantity}
                                onChange={(e) => updateQuantity(suggestion.medicine.id, parseInt(e.target.value) || 0)}
                                className={`w-20 px-3 py-2 border rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                  !validation.isValid ? 'border-red-300' : 'border-gray-300'
                                }`}
                              />
                            </div>
                            
                            {validation.warning && (
                              <p className={`text-xs ${!validation.isValid ? 'text-red-600' : 'text-yellow-600'}`}>
                                {validation.warning}
                              </p>
                            )}
                            
                            <p className="text-sm font-medium text-gray-900">
                              Total: ₹{(suggestion.customQuantity * suggestion.estimatedCost).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Calculator className="w-5 h-5 text-green-600" />
                <span>Order Summary</span>
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Selected Items:</span>
                  <span className="font-medium">{selectedSuggestions.length}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Total Quantity:</span>
                  <span className="font-medium">{totalItems} units</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Critical Items:</span>
                  <span className="font-medium text-red-600">
                    {selectedSuggestions.filter(s => s.priority === 'critical').length}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Low Stock Items:</span>
                  <span className="font-medium text-yellow-600">
                    {selectedSuggestions.filter(s => s.priority === 'low').length}
                  </span>
                </div>
                
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Estimated Total:</span>
                    <span className="text-green-600">₹{totalEstimatedCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Priority Legend */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Legend</h3>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm">
                    <strong className="text-red-600">Critical:</strong> Out of stock
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <TrendingDown className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm">
                    <strong className="text-yellow-600">Low:</strong> Below minimum stock
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">
                    <strong className="text-blue-600">Normal:</strong> Preventive restocking
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Summary Modal */}
      {showOrderSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Restock Order Generated</h3>
            </div>
            
            <div className="p-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">Order Successfully Generated</span>
                </div>
                <p className="text-green-700 text-sm mt-1">
                  Your restock order has been prepared and is ready for supplier submission.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Total Items:</span>
                    <p className="font-medium">{selectedSuggestions.length}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Quantity:</span>
                    <p className="font-medium">{totalItems} units</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Estimated Cost:</span>
                    <p className="font-medium">₹{totalEstimatedCost.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Order Date:</span>
                    <p className="font-medium">{format(new Date(), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => setShowOrderSummary(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  // Could integrate with actual ordering system here
                  addNotification('info', 'Order submitted to supplier');
                  setShowOrderSummary(false);
                  onBack();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Submit to Supplier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};