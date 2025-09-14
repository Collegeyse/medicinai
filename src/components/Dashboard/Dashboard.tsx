import React, { useEffect, useState } from 'react';
import { 
  Package, 
  ShoppingCart, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  DollarSign
} from 'lucide-react';
import { db } from '../../database';
import { FEFOService } from '../../services/fefo';
import { format } from 'date-fns';

interface DashboardStats {
  totalMedicines: number;
  totalBatches: number;
  todaySales: number;
  expiringItems: number;
  lowStockItems: number;
  totalRevenue: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalMedicines: 0,
    totalBatches: 0,
    todaySales: 0,
    expiringItems: 0,
    lowStockItems: 0,
    totalRevenue: 0
  });

  const [recentSales, setRecentSales] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [
        medicines,
        batches,
        sales,
        expiringBatches,
        lowStockBatches
      ] = await Promise.all([
        db.medicines.count(),
        db.batches.count(),
        db.sales.where('saleDate').above(new Date(new Date().setHours(0, 0, 0, 0))).count(),
        FEFOService.getExpiringMedicines(30),
        FEFOService.getLowStockMedicines()
      ]);

      const todayRevenue = await db.sales
        .where('saleDate')
        .above(new Date(new Date().setHours(0, 0, 0, 0)))
        .toArray()
        .then(sales => sales.reduce((sum, sale) => sum + sale.totalAmount, 0));

      const recent = await db.sales
        .orderBy('saleDate')
        .reverse()
        .limit(5)
        .toArray();

      setStats({
        totalMedicines: medicines,
        totalBatches: batches,
        todaySales: sales,
        expiringItems: expiringBatches.length,
        lowStockItems: lowStockBatches.length,
        totalRevenue: todayRevenue
      });

      setRecentSales(recent);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const statCards = [
    {
      title: 'Total Medicines',
      value: stats.totalMedicines,
      icon: Package,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'Today\'s Sales',
      value: stats.todaySales,
      icon: ShoppingCart,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Expiring Soon',
      value: stats.expiringItems,
      icon: AlertTriangle,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600'
    },
    {
      title: 'Low Stock',
      value: stats.lowStockItems,
      icon: TrendingUp,
      color: 'bg-red-500',
      textColor: 'text-red-600'
    },
    {
      title: 'Today\'s Revenue',
      value: `₹${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-purple-500',
      textColor: 'text-purple-600'
    },
    {
      title: 'Total Batches',
      value: stats.totalBatches,
      icon: Package,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening at your pharmacy today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.color} bg-opacity-10`}>
                  <Icon className={`w-6 h-6 ${card.textColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Sales</h2>
          </div>
          <div className="p-6">
            {recentSales.length > 0 ? (
              <div className="space-y-4">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-gray-900">
                        Invoice #{sale.invoiceNumber}
                      </p>
                      <p className="text-sm text-gray-600">
                        {sale.customerName || 'Walk-in Customer'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(sale.saleDate), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ₹{sale.totalAmount.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {sale.items.length} items
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No recent sales</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-6 space-y-4">
            <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Start New Sale
            </button>
            <button className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors">
              Add New Medicine
            </button>
            <button className="w-full bg-yellow-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-yellow-700 transition-colors">
              Check Expiry Alerts
            </button>
            <button className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors">
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};