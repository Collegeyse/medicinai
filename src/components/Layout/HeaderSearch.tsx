import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Package } from 'lucide-react';
import { db } from '../../database';
import { Medicine } from '../../types';
import { FEFOService } from '../../services/fefo';
import { usePharmacyStore } from '../../store';

export const HeaderSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { addToCart, addNotification } = usePharmacyStore();

  useEffect(() => {
    if (searchQuery.length > 2) {
      searchMedicines();
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchQuery]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchMedicines = async () => {
    setLoading(true);
    try {
      const results = await db.medicines
        .filter(medicine => 
          medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          medicine.brandName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          medicine.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          medicine.genericName?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .limit(8)
        .toArray();
      
      setSearchResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching medicines:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMedicineToCart = async (medicine: Medicine, quantity: number = 1) => {
    try {
      const selectedBatches = await FEFOService.selectBatchesForSale(medicine.id, quantity);
      
      for (const batch of selectedBatches) {
        addToCart(medicine, batch, batch.quantityToDispense || 0);
      }

      addNotification('success', `Added ${medicine.brandName || medicine.name} to cart`);
      setSearchQuery('');
      setShowResults(false);
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Failed to add to cart');
    }
  };

  const getMedicineStockAndPrice = async (medicineId: string): Promise<{stock: number, price: number}> => {
    const batches = await db.batches
      .where('medicineId')
      .equals(medicineId)
      .filter(batch => batch.currentStock > 0 && batch.expiryDate > new Date())
      .toArray();
    
    const stock = batches.reduce((total, batch) => total + batch.currentStock, 0);
    const price = batches.length > 0 ? batches[0].sellingPrice : 0;
    
    return { stock, price };
  };

  const [stockInfo, setStockInfo] = useState<Record<string, {stock: number, price: number}>>({});

  useEffect(() => {
    if (searchResults.length > 0) {
      Promise.all(
        searchResults.map(async (medicine) => {
          const stockAndPrice = await getMedicineStockAndPrice(medicine.id);
          return { id: medicine.id, ...stockAndPrice };
        })
      ).then((results) => {
        const stockMap = results.reduce((acc, { id, stock, price }) => {
          acc[id] = { stock, price };
          return acc;
        }, {} as Record<string, {stock: number, price: number}>);
        setStockInfo(stockMap);
      });
    }
  }, [searchResults]);

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search medicines to add to cart..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery.length > 2 && setShowResults(true)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs text-gray-500 px-3 py-2 border-b border-gray-100">
              Found {searchResults.length} medicine{searchResults.length !== 1 ? 's' : ''}
            </div>
            {searchResults.map((medicine) => {
              const stock = stockInfo[medicine.id] || 0;
              const hasStock = stock > 0;
              
              return (
                <div
                  key={medicine.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {medicine.brandName || medicine.name}
                        </h4>
                        <p className="text-sm text-gray-600 truncate">
                          {medicine.name}
                        </p>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-xs text-gray-500">
                            {medicine.manufacturer}
                          </span>
                          <span className="text-xs text-blue-600 font-medium">
                            ₹{stockInfo[medicine.id]?.price?.toFixed(2) || 'N/A'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            medicine.scheduleType === 'H1' 
                              ? 'bg-red-100 text-red-700' 
                              : medicine.scheduleType === 'H'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {medicine.scheduleType}
                          </span>
                          <span className={`text-xs font-medium ${
                            stockInfo[medicine.id]?.stock > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            Stock: {stockInfo[medicine.id]?.stock || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-3">
                    <input
                      type="number"
                      min="1"
                      max={stockInfo[medicine.id]?.stock || 0}
                      defaultValue="1"
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      id={`header-qty-${medicine.id}`}
                      disabled={!stockInfo[medicine.id]?.stock}
                    />
                    <button
                      onClick={() => {
                        const qtyInput = document.getElementById(`header-qty-${medicine.id}`) as HTMLInputElement;
                        const quantity = parseInt(qtyInput.value) || 1;
                        addMedicineToCart(medicine, quantity);
                      }}
                      disabled={!stockInfo[medicine.id]?.stock}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Results */}
      {showResults && searchResults.length === 0 && searchQuery.length > 2 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 text-center text-gray-500">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p>No medicines found for "{searchQuery}"</p>
          </div>
        </div>
      )}
    </div>
  );
};