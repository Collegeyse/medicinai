import React, { useState, useEffect } from 'react';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { InventoryList } from './components/Inventory/InventoryList';
import { SalesModule } from './components/Sales/SalesModule';
import { LowStockPage } from './components/Inventory/LowStockPage';
import { NotificationToast } from './components/Notifications/NotificationToast';
import { initializeDatabase } from './database';
import { usePharmacyStore } from './store';
import { RestockManagementPage } from './components/Inventory/RestockManagementPage';
import { RestockSuggestionPage } from './components/Inventory/RestockSuggestionPage';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const { addNotification } = usePharmacyStore();

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await initializeDatabase();
      addNotification('success', 'Pharmacy system initialized successfully');
    } catch (error) {
      console.error('Error initializing app:', error);
      addNotification('error', 'Failed to initialize pharmacy system');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'inventory':
        return <InventoryList />;
      case 'restock':
        return <RestockManagementPage onBack={() => setActiveTab('inventory')} />;
      case 'restock-suggestions':
        return <RestockSuggestionPage onBack={() => setActiveTab('inventory')} />;
      case 'sales':
        return <SalesModule />;
      case 'expiry':
        return <div className="p-6"><h1 className="text-2xl font-bold">Expiry Alerts</h1><p>Coming soon...</p></div>;
      case 'low-stock':
        return <LowStockPage />;
      case 'schedule-h1':
        return <div className="p-6"><h1 className="text-2xl font-bold">Schedule H1 Register</h1><p>Coming soon...</p></div>;
      case 'reports':
        return <div className="p-6"><h1 className="text-2xl font-bold">Reports</h1><p>Coming soon...</p></div>;
      case 'settings':
        return <div className="p-6"><h1 className="text-2xl font-bold">Settings</h1><p>Coming soon...</p></div>;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing PharmaCare...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 lg:ml-0">
          {renderContent()}
        </main>
      </div>
      <NotificationToast />
    </div>
  );
}

export default App;
