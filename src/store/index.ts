import { create } from 'zustand';
import { Medicine, Batch, Sale } from '../types';

interface PharmacyStore {
  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  
  // Cart state for sales
  cartItems: Array<{
    medicine: Medicine;
    batch: Batch;
    quantity: number;
  }>;
  addToCart: (medicine: Medicine, batch: Batch, quantity: number) => void;
  removeFromCart: (medicineId: string, batchId: string) => void;
  updateCartQuantity: (medicineId: string, batchId: string, quantity: number) => void;
  clearCart: () => void;
  
  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: Date;
  }>;
  addNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  removeNotification: (id: string) => void;
}

export const usePharmacyStore = create<PharmacyStore>((set, get) => ({
  // UI state
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  // Cart state
  cartItems: [],
  addToCart: (medicine, batch, quantity) => {
    const { cartItems } = get();
    const existingItem = cartItems.find(
      item => item.medicine.id === medicine.id && item.batch.id === batch.id
    );
    
    if (existingItem) {
      set({
        cartItems: cartItems.map(item =>
          item.medicine.id === medicine.id && item.batch.id === batch.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      });
    } else {
      set({
        cartItems: [...cartItems, { medicine, batch, quantity }]
      });
    }
  },
  removeFromCart: (medicineId, batchId) => {
    set({
      cartItems: get().cartItems.filter(
        item => !(item.medicine.id === medicineId && item.batch.id === batchId)
      )
    });
  },
  updateCartQuantity: (medicineId, batchId, quantity) => {
    set({
      cartItems: get().cartItems.map(item =>
        item.medicine.id === medicineId && item.batch.id === batchId
          ? { ...item, quantity }
          : item
      )
    });
  },
  clearCart: () => set({ cartItems: [] }),
  
  // Notifications
  notifications: [],
  addNotification: (type, message) => {
    const notification = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: new Date()
    };
    set({
      notifications: [...get().notifications, notification]
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      get().removeNotification(notification.id);
    }, 5000);
  },
  removeNotification: (id) => {
    set({
      notifications: get().notifications.filter(n => n.id !== id)
    });
  }
}));