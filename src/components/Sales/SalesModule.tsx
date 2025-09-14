import React, { useState, useEffect } from 'react';
import { Search, Plus, ShoppingCart, Trash2, Calculator, Package } from 'lucide-react';
import { db } from '../../database';
import { Medicine, Batch, Sale, SaleItem } from '../../types';
import { FEFOService } from '../../services/fefo';
import { AuditService } from '../../services/audit';
import { ScheduleH1Service } from '../../services/scheduleH1';
import { usePharmacyStore } from '../../store';
import { format } from 'date-fns';

export const SalesModule: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [prescriptionNumber, setPrescriptionNumber] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'CREDIT'>('CASH');
  const [discount, setDiscount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [showRestockPrompt, setShowRestockPrompt] = useState(false);
  const [completedSaleItems, setCompletedSaleItems] = useState<any[]>([]);
  
  const { addNotification, cartItems, addToCart, removeFromCart, clearCart } = usePharmacyStore();

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
          medicine.brandName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          medicine.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .limit(10)
        .toArray();
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching medicines:', error);
    }
  };

  const handleAddToCart = async (medicine: Medicine, requestedQuantity: number) => {
    try {
      const selectedBatches = await FEFOService.selectBatchesForSale(medicine.id, requestedQuantity);
      
      for (const batch of selectedBatches) {
        addToCart(medicine, batch, batch.quantityToDispense || 0);
      }

      addNotification('success', `Added ${medicine.brandName} to cart`);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      addNotification('error', error instanceof Error ? error.message : 'Failed to add to cart');
    }
  };

  const updateQuantity = (medicineId: string, batchId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(medicineId, batchId);
      return;
    }

    // Update quantity in store
    const item = cartItems.find(item => 
      item.medicine.id === medicineId && item.batch.id === batchId
    );
    if (item) {
      removeFromCart(medicineId, batchId);
      addToCart(item.medicine, item.batch, newQuantity);
    }
  };

  const calculateTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.batch.sellingPrice), 0);
    const discountAmount = (subtotal * discount) / 100;
    const gstAmount = cartItems.reduce((sum, item) => {
      const itemTotal = (item.quantity * item.batch.sellingPrice) - ((item.quantity * item.batch.sellingPrice) * discount / 100);
      return sum + (itemTotal * item.medicine.gst / 100);
    }, 0);
    const total = subtotal - discountAmount + gstAmount;

    return { subtotal, discountAmount, gstAmount, total };
  };

  const processSale = async () => {
    if (cartItems.length === 0) {
      addNotification('error', 'Cart is empty');
      return;
    }

    setProcessing(true);

    try {
      const { subtotal, discountAmount, gstAmount, total } = calculateTotals();
      const invoiceNumber = `INV-${Date.now()}`;

      // Create sale items
      const saleItems: SaleItem[] = cartItems.map(item => ({
        id: crypto.randomUUID(),
        medicineId: item.medicine.id,
        medicineName: item.medicine.brandName,
        batchId: item.batch.id,
        batchNumber: item.batch.batchNumber,
        quantity: item.quantity,
        unitPrice: item.batch.sellingPrice,
        totalPrice: item.quantity * item.batch.sellingPrice,
        gstAmount: (item.totalPrice * item.medicine.gst) / 100
      }));

      // Create sale record
      const sale: Sale = {
        id: crypto.randomUUID(),
        invoiceNumber,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        prescriptionId: prescriptionNumber || undefined,
        items: saleItems,
        totalAmount: total,
        gstAmount,
        discountAmount,
        paymentMethod,
        saleDate: new Date(),
        pharmacistId: 'system-user'
      };

      // Save sale
      await db.sales.add(sale);

      // Update stock levels
      for (const item of cartItems) {
        const batch = await db.batches.get(item.batch.id);
        if (batch) {
          await db.batches.update(item.batch.id, {
            currentStock: batch.currentStock - item.quantity
          });
        }
      }

      // Add Schedule H1 entries if needed
      for (const item of cartItems) {
        if (item.medicine.scheduleType === 'H1') {
          await ScheduleH1Service.addEntry({
            medicineId: item.medicine.id,
            medicineName: item.medicine.brandName,
            batchNumber: item.batch.batchNumber,
            customerName: customerName || 'Walk-in Customer',
            doctorName: doctorName || 'Not specified',
            prescriptionNumber: prescriptionNumber || 'Not provided',
            quantityDispensed: item.quantity,
            dispensedDate: new Date(),
            pharmacistSignature: 'System'
          });
        }
      }

      // Clear form
      clearCart();
      
      // Store completed sale items for restock prompt
      setCompletedSaleItems(cartItems.map(item => ({
        medicine: item.medicine,
        quantitySold: item.quantity,
        batch: item.batch
      })));
      
      setCustomerName('');
      setCustomerPhone('');
      setPrescriptionNumber('');
      setDoctorName('');
      setDiscount(0);

      addNotification('success', `Sale completed! Invoice: ${invoiceNumber}`);
      
      // Show restock prompt
      setShowRestockPrompt(true);
    } catch (error) {
      console.error('Error processing sale:', error);
      addNotification('error', 'Failed to process sale');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddToRestock = () => {
    // Store items in localStorage for restock page to pick up
    const restockItems = completedSaleItems.map(item => ({
      medicineId: item.medicine.id,
      medicineName: item.medicine.brandName || item.medicine.name,
      quantitySold: item.quantitySold,
      suggestedQuantity: Math.max(item.quantitySold * 2, 50), // Suggest 2x sold quantity or minimum 50
      medicine: item.medicine
    }));
    
    localStorage.setItem('pendingRestockItems', JSON.stringify(restockItems));
    addNotification('info', `${restockItems.length} medicines added to restock queue`);
    setShowRestockPrompt(false);
    setCompletedSaleItems([]);
  };

  const handleSkipRestock = () => {
    setShowRestockPrompt(false);
    setCompletedSaleItems([]);
  };

  const { subtotal, discountAmount, gstAmount, total } = calculateTotals();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales Module</h1>
        <p className="text-gray-600">Process medicine sales with automatic FEFO selection</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Medicine Search & Cart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Medicine Search */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Medicines</h2>
            
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
              <div className="mt-4 border border-gray-200 rounded-lg divide-y divide-gray-200">
                {searchResults.map((medicine) => (
                  <div key={medicine.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{medicine.brandName}</h3>
                        <p className="text-sm text-gray-600">{medicine.name}</p>
                        <p className="text-xs text-gray-500">{medicine.manufacturer}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          defaultValue="1"
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          id={`qty-${medicine.id}`}
                        />
                        <button
                          onClick={() => {
                            const qtyInput = document.getElementById(`qty-${medicine.id}`) as HTMLInputElement;
                            const quantity = parseInt(qtyInput.value) || 1;
                            handleAddToCart(medicine, quantity);
                          }}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shopping Cart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Shopping Cart</h2>
              <ShoppingCart className="w-5 h-5 text-gray-400" />
            </div>

            {cartItems.length > 0 ? (
              <div className="space-y-4">
                {cartItems.map((item, index) => (
                  <div key={`${item.medicine.id}-${item.batch.id}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.medicine.brandName}</h3>
                      <p className="text-sm text-gray-600">Batch: {item.batch.batchNumber}</p>
                      <p className="text-sm text-gray-600">
                        Exp: {format(new Date(item.batch.expiryDate), 'MMM yyyy')}
                      </p>
                      <p className="text-sm text-gray-600">₹{item.batch.sellingPrice} each</p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        min="1"
                        max={item.batch.currentStock}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.medicine.id, item.batch.id, parseInt(e.target.value))}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="font-medium text-gray-900">₹{(item.quantity * item.batch.sellingPrice).toFixed(2)}</span>
                      <button
                        onClick={() => removeFromCart(item.medicine.id, item.batch.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Your cart is empty</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Customer Details & Checkout */}
        <div className="space-y-6">
          {/* Customer Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prescription Number
                </label>
                <input
                  type="text"
                  value={prescriptionNumber}
                  onChange={(e) => setPrescriptionNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="For Schedule H/H1 medicines"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Doctor Name
                </label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="For Schedule H1 medicines"
                />
              </div>
            </div>
          </div>

          {/* Payment & Checkout */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment & Checkout</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Bill Summary */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>GST:</span>
                  <span>₹{gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-2">
                  <span>Total:</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={processSale}
                disabled={cartItems.length === 0 || processing}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {processing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    <span>Complete Sale</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Restock Prompt Modal */}
      {showRestockPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Restock Suggestion</h3>
                <p className="text-sm text-gray-600">Sale completed successfully!</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Would you like to add the sold medicines to your restock list for future ordering?
              </p>
              
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Sold Items:</h4>
                <div className="space-y-1">
                  {completedSaleItems.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-blue-800">{item.medicine.brandName || item.medicine.name}</span>
                      <span className="text-blue-600 font-medium">{item.quantitySold} units</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleSkipRestock}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleAddToRestock}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Package className="w-4 h-4" />
                <span>Add to Restock</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};