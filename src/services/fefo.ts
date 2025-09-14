import { db } from '../database';
import { Batch } from '../types';

export class FEFOService {
  /**
   * Select batches for sale using First Expired, First Out algorithm
   */
  static async selectBatchesForSale(medicineId: string, quantity: number): Promise<Batch[]> {
    const batches = await db.batches
      .where('medicineId')
      .equals(medicineId)
      .filter(batch => batch.currentStock > 0 && batch.expiryDate > new Date())
      .sortBy('expiryDate');
    
    const selectedBatches: Batch[] = [];
    let remainingQuantity = quantity;
    
    for (const batch of batches) {
      if (remainingQuantity <= 0) break;
      
      const quantityFromBatch = Math.min(remainingQuantity, batch.currentStock);
      selectedBatches.push({
        ...batch,
        quantityToDispense: quantityFromBatch
      });
      remainingQuantity -= quantityFromBatch;
    }
    
    if (remainingQuantity > 0) {
      throw new Error(`Insufficient stock. Need ${remainingQuantity} more units.`);
    }
    
    return selectedBatches;
  }

  /**
   * Get medicines expiring within specified days
   */
  static async getExpiringMedicines(days: number = 30): Promise<Batch[]> {
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + days);
    
    return await db.batches
      .where('expiryDate')
      .below(expiryThreshold)
      .filter(batch => batch.currentStock > 0)
      .sortBy('expiryDate');
  }

  /**
   * Get low stock medicines
   */
  static async getLowStockMedicines(): Promise<Batch[]> {
    return await db.batches
      .filter(batch => batch.currentStock <= batch.minStock)
      .sortBy('currentStock');
  }
}