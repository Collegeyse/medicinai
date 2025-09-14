import { db } from '../database';
import { ScheduleH1Entry } from '../types';
import jsPDF from 'jspdf';

export class ScheduleH1Service {
  static async addEntry(entry: Omit<ScheduleH1Entry, 'id'>): Promise<void> {
    const h1Entry: ScheduleH1Entry = {
      ...entry,
      id: crypto.randomUUID()
    };
    
    await db.scheduleH1Entries.add(h1Entry);
  }

  static async getMonthlyEntries(month: number, year: number): Promise<ScheduleH1Entry[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    return await db.scheduleH1Entries
      .where('dispensedDate')
      .between(startDate, endDate)
      .sortBy('dispensedDate');
  }

  static async generateMonthlyReport(month: number, year: number): Promise<Blob> {
    const entries = await this.getMonthlyEntries(month, year);
    const pdf = new jsPDF();
    
    // Header
    pdf.setFontSize(16);
    pdf.text('Schedule H1 Register', 20, 20);
    pdf.setFontSize(12);
    pdf.text(`Month: ${month}/${year}`, 20, 30);
    pdf.text('As per Rule 65(15) of Drugs Rules, 1945', 20, 40);
    
    // Table headers
    pdf.setFontSize(10);
    const headers = ['Date', 'Medicine', 'Batch', 'Customer', 'Doctor', 'Prescription', 'Qty'];
    let y = 60;
    
    headers.forEach((header, index) => {
      pdf.text(header, 20 + (index * 25), y);
    });
    
    // Table data
    entries.forEach((entry, index) => {
      y = 70 + (index * 10);
      const row = [
        entry.dispensedDate.toLocaleDateString(),
        entry.medicineName.substring(0, 15),
        entry.batchNumber,
        entry.customerName.substring(0, 12),
        entry.doctorName.substring(0, 12),
        entry.prescriptionNumber,
        entry.quantityDispensed.toString()
      ];
      
      row.forEach((cell, cellIndex) => {
        pdf.text(cell, 20 + (cellIndex * 25), y);
      });
    });
    
    return pdf.output('blob');
  }
}