import Dexie, { Table } from 'dexie';
import { Medicine, Batch, Sale, ScheduleH1Entry, AuditLog } from '../types';

export class PharmacyDatabase extends Dexie {
  medicines!: Table<Medicine>;
  batches!: Table<Batch>;
  sales!: Table<Sale>;
  scheduleH1Entries!: Table<ScheduleH1Entry>;
  auditLogs!: Table<AuditLog>;

  constructor() {
    super('PharmacyDB');
    
    this.version(1).stores({
      medicines: 'id, name, brandName, manufacturer, scheduleType, hsn, medicineType',
      batches: 'id, medicineId, batchNumber, expiryDate, currentStock, minStock',
      sales: 'id, invoiceNumber, customerName, customerPhone, saleDate, pharmacistId',
      scheduleH1Entries: 'id, medicineId, customerName, dispensedDate',
      auditLogs: 'id, userId, action, entityType, timestamp'
    });
  }
}

export const db = new PharmacyDatabase();

// Initialize with sample data
export const initializeDatabase = async () => {
  const medicineCount = await db.medicines.count();
  
  if (medicineCount === 0) {
    // Sample medicines
    const sampleMedicines: Medicine[] = [
      {
        id: '1',
        name: 'Paracetamol 500mg',
        genericName: 'Paracetamol',
        brandName: 'Crocin',
        dosage: '500mg',
        medicineType: 'Tablet',
        manufacturer: 'GSK',
        scheduleType: 'GENERAL',
        hsn: '30049099',
        gst: 12,
        description: 'Pain relief and fever reducer',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        name: 'Alprazolam 0.5mg',
        genericName: 'Alprazolam',
        brandName: 'Alprax',
        dosage: '0.5mg',
        medicineType: 'Tablet',
        manufacturer: 'Torrent',
        scheduleType: 'H1',
        hsn: '30049099',
        gst: 12,
        description: 'Anti-anxiety medication',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        name: 'Amoxicillin 500mg',
        genericName: 'Amoxicillin',
        brandName: 'Amoxil',
        dosage: '500mg',
        medicineType: 'Capsule',
        manufacturer: 'Cipla',
        scheduleType: 'H',
        hsn: '30049099',
        gst: 12,
        description: 'Antibiotic for bacterial infections',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const sampleBatches: Batch[] = [
      {
        id: '1',
        medicineId: '1',
        batchNumber: 'PCM001',
        expiryDate: new Date('2025-12-31'),
        mrp: 25,
        purchasePrice: 18,
        sellingPrice: 23,
        currentStock: 100,
        minStock: 20,
        maxStock: 500,
        supplierId: 'SUP001',
        receivedDate: new Date()
      },
      {
        id: '2',
        medicineId: '2',
        batchNumber: 'ALP001',
        expiryDate: new Date('2024-06-30'),
        mrp: 45,
        purchasePrice: 35,
        sellingPrice: 42,
        currentStock: 50,
        minStock: 10,
        maxStock: 200,
        supplierId: 'SUP002',
        receivedDate: new Date()
      },
      {
        id: '3',
        medicineId: '3',
        batchNumber: 'AMX001',
        expiryDate: new Date('2024-08-15'),
        mrp: 85,
        purchasePrice: 65,
        sellingPrice: 78,
        currentStock: 75,
        minStock: 15,
        maxStock: 300,
        supplierId: 'SUP001',
        receivedDate: new Date()
      }
    ];

    await db.medicines.bulkPut(sampleMedicines);
    await db.batches.bulkPut(sampleBatches);
  }
};