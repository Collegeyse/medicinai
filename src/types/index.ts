export interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  brandName: string;
  dosage?: string;
  medicineType?: string;
  manufacturer: string;
  scheduleType: 'H' | 'H1' | 'X' | 'GENERAL';
  hsn: string;
  gst: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Batch {
  id: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: Date;
  mrp: number;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStock: number;
  maxStock: number;
  supplierId: string;
  receivedDate: Date;
  quantityToDispense?: number;
}

export interface SaleItem {
  id: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  gstAmount: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  prescriptionId?: string;
  items: SaleItem[];
  totalAmount: number;
  gstAmount: number;
  discountAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'CREDIT';
  saleDate: Date;
  pharmacistId: string;
}

export interface ScheduleH1Entry {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  customerName: string;
  doctorName: string;
  prescriptionNumber: string;
  quantityDispensed: number;
  dispensedDate: Date;
  pharmacistSignature: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SALE' | 'PURCHASE';
  entityType: 'MEDICINE' | 'BATCH' | 'SALE' | 'CUSTOMER';
  entityId: string;
  oldData?: any;
  newData?: any;
  timestamp: Date;
  ipAddress?: string;
}