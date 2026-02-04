import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'kadaele-pos',
  storeName: 'pos_data',
});

// Data file keys
const DATA_KEYS = {
  GOODS: 'goods',
  PURCHASES: 'purchases',
  DEBTORS: 'debtors',
  INVENTORY: 'inventory',
  SYNC_QUEUE: 'sync_queue',
  LAST_SYNC: 'last_sync',
};

class DataService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncToServer();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Generate unique ID
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get current server time (or local time if offline)
  async getServerTime() {
    if (this.isOnline) {
      try {
        // TODO: Replace with actual kadaele-services endpoint
        const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
        const data = await response.json();
        return new Date(data.datetime);
      } catch (error) {
        console.warn('Could not get server time, using local time:', error);
        return new Date();
      }
    }
    return new Date();
  }

  // Generic CRUD operations
  async get(key) {
    try {
      const data = await localforage.getItem(key);
      return data || (key === DATA_KEYS.GOODS || key === DATA_KEYS.PURCHASES || 
                      key === DATA_KEYS.DEBTORS || key === DATA_KEYS.INVENTORY ? [] : null);
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return key === DATA_KEYS.GOODS || key === DATA_KEYS.PURCHASES || 
             key === DATA_KEYS.DEBTORS || key === DATA_KEYS.INVENTORY ? [] : null;
    }
  }

  async set(key, value) {
    try {
      await localforage.setItem(key, value);
      // Add to sync queue if not already syncing
      await this.addToSyncQueue({ key, value, timestamp: Date.now() });
      return true;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      return false;
    }
  }

  // Goods operations
  async getGoods() {
    return await this.get(DATA_KEYS.GOODS);
  }

  async setGoods(goods) {
    return await this.set(DATA_KEYS.GOODS, goods);
  }

  async addGood(good) {
    const goods = await this.getGoods();
    const newGood = {
      id: good.id || this.generateId(),
      name: good.name,
      price: parseFloat(good.price),
      category: good.category || 'General',
      barcode: good.barcode || null,
      createdAt: await this.getServerTime(),
    };
    goods.push(newGood);
    await this.setGoods(goods);
    return newGood;
  }

  async updateGood(id, updates) {
    const goods = await this.getGoods();
    const index = goods.findIndex(g => g.id === id);
    if (index !== -1) {
      goods[index] = { ...goods[index], ...updates };
      await this.setGoods(goods);
      return goods[index];
    }
    return null;
  }

  // Purchases operations
  async getPurchases() {
    return await this.get(DATA_KEYS.PURCHASES);
  }

  async setPurchases(purchases) {
    return await this.set(DATA_KEYS.PURCHASES, purchases);
  }

  async addPurchase(purchase) {
    const purchases = await this.getPurchases();
    const serverTime = await this.getServerTime();
    
    const newPurchase = {
      id: purchase.id || this.generateId(),
      date: serverTime.toISOString(),
      items: purchase.items,
      total: parseFloat(purchase.total),
      paymentType: purchase.paymentType, // 'cash' or 'credit'
      customerName: purchase.customerName || '',
      customerPhone: purchase.customerPhone || '',
      status: purchase.status || 'active', // 'active', 'voided', 'refunded'
      photoUrl: purchase.photoUrl || null,
      refund: purchase.refund || null,
      createdAt: serverTime.toISOString(),
    };
    
    purchases.push(newPurchase);
    await this.setPurchases(purchases);
    
    // Update debtors if credit sale
    if (newPurchase.paymentType === 'credit' && newPurchase.customerName) {
      await this.updateDebtor(newPurchase);
    }
    
    return newPurchase;
  }

  async updatePurchase(id, updates) {
    const purchases = await this.getPurchases();
    const index = purchases.findIndex(p => p.id === id);
    
    if (index !== -1) {
      const purchase = purchases[index];
      
      // Check if within 24 hours
      const createdDate = new Date(purchase.createdAt);
      const now = new Date();
      const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
      
      if (hoursDiff > 24 && !updates.allowAfter24Hours) {
        throw new Error('Cannot edit purchase after 24 hours');
      }
      
      purchases[index] = { ...purchase, ...updates };
      await this.setPurchases(purchases);
      
      // Update debtors if needed
      if (purchases[index].paymentType === 'credit') {
        await this.recalculateDebtors();
      }
      
      return purchases[index];
    }
    return null;
  }

  async voidPurchase(id, reason) {
    return await this.updatePurchase(id, { 
      status: 'voided', 
      voidReason: reason,
      voidedAt: (await this.getServerTime()).toISOString(),
      allowAfter24Hours: true,
    });
  }

  async refundPurchase(id, amount, reason) {
    const purchase = await this.updatePurchase(id, {
      status: 'refunded',
      refund: {
        amount: parseFloat(amount),
        reason: reason,
        date: (await this.getServerTime()).toISOString(),
      },
      allowAfter24Hours: true,
    });
    
    // Update debtors if credit sale
    if (purchase && purchase.paymentType === 'credit') {
      await this.recalculateDebtors();
    }
    
    return purchase;
  }

  // Debtors operations
  async getDebtors() {
    return await this.get(DATA_KEYS.DEBTORS);
  }

  async setDebtors(debtors) {
    return await this.set(DATA_KEYS.DEBTORS, debtors);
  }

  async updateDebtor(purchase) {
    const debtors = await this.getDebtors();
    const existingDebtor = debtors.find(
      d => d.customerPhone === purchase.customerPhone || 
           d.customerName.toLowerCase() === purchase.customerName.toLowerCase()
    );
    
    if (existingDebtor) {
      existingDebtor.totalDue += purchase.total;
      existingDebtor.balance = existingDebtor.totalDue - existingDebtor.totalPaid;
      existingDebtor.purchaseIds.push(purchase.id);
      existingDebtor.lastPurchase = purchase.date;
    } else {
      debtors.push({
        id: this.generateId(),
        customerName: purchase.customerName,
        customerPhone: purchase.customerPhone,
        totalDue: purchase.total,
        totalPaid: 0,
        balance: purchase.total,
        purchaseIds: [purchase.id],
        createdAt: purchase.date,
        lastPurchase: purchase.date,
      });
    }
    
    await this.setDebtors(debtors);
  }

  async recordPayment(debtorId, amount, purchaseIds = []) {
    const debtors = await this.getDebtors();
    const debtor = debtors.find(d => d.id === debtorId);
    
    if (debtor) {
      const paymentAmount = parseFloat(amount);
      debtor.totalPaid += paymentAmount;
      debtor.balance = debtor.totalDue - debtor.totalPaid;
      debtor.lastPayment = (await this.getServerTime()).toISOString();
      
      // Mark specific purchases as paid if provided
      if (purchaseIds.length > 0) {
        const purchases = await this.getPurchases();
        purchaseIds.forEach(pid => {
          const purchase = purchases.find(p => p.id === pid);
          if (purchase) {
            purchase.paid = true;
            purchase.paidDate = debtor.lastPayment;
          }
        });
        await this.setPurchases(purchases);
      }
      
      await this.setDebtors(debtors);
      return debtor;
    }
    return null;
  }

  async recalculateDebtors() {
    const purchases = await this.getPurchases();
    const creditPurchases = purchases.filter(
      p => p.paymentType === 'credit' && p.status === 'active'
    );
    
    const debtorsMap = new Map();
    
    creditPurchases.forEach(purchase => {
      const key = purchase.customerPhone || purchase.customerName;
      if (!debtorsMap.has(key)) {
        debtorsMap.set(key, {
          id: this.generateId(),
          customerName: purchase.customerName,
          customerPhone: purchase.customerPhone,
          totalDue: 0,
          totalPaid: 0,
          balance: 0,
          purchaseIds: [],
          createdAt: purchase.date,
          lastPurchase: purchase.date,
        });
      }
      
      const debtor = debtorsMap.get(key);
      debtor.totalDue += purchase.total;
      debtor.purchaseIds.push(purchase.id);
      if (new Date(purchase.date) > new Date(debtor.lastPurchase)) {
        debtor.lastPurchase = purchase.date;
      }
    });
    
    const debtors = Array.from(debtorsMap.values());
    
    // Preserve payment records from existing debtors
    const existingDebtors = await this.getDebtors();
    debtors.forEach(debtor => {
      const existing = existingDebtors.find(
        d => d.customerPhone === debtor.customerPhone ||
             d.customerName === debtor.customerName
      );
      if (existing) {
        debtor.totalPaid = existing.totalPaid;
        debtor.lastPayment = existing.lastPayment;
      }
      debtor.balance = debtor.totalDue - debtor.totalPaid;
    });
    
    await this.setDebtors(debtors);
  }

  // Inventory operations
  async getInventory() {
    return await this.get(DATA_KEYS.INVENTORY);
  }

  async setInventory(inventory) {
    return await this.set(DATA_KEYS.INVENTORY, inventory);
  }

  async updateInventoryItem(itemId, stockLevel) {
    const inventory = await this.getInventory();
    const existing = inventory.find(i => i.itemId === itemId);
    
    if (existing) {
      existing.stockLevel = parseInt(stockLevel);
      existing.lastUpdated = (await this.getServerTime()).toISOString();
    } else {
      inventory.push({
        itemId: itemId,
        stockLevel: parseInt(stockLevel),
        lastUpdated: (await this.getServerTime()).toISOString(),
      });
    }
    
    await this.setInventory(inventory);
  }

  // Sync queue operations
  async addToSyncQueue(item) {
    const queue = await localforage.getItem(DATA_KEYS.SYNC_QUEUE) || [];
    queue.push(item);
    await localforage.setItem(DATA_KEYS.SYNC_QUEUE, queue);
    
    // Trigger sync if online
    if (this.isOnline && !this.syncInProgress) {
      this.syncToServer();
    }
  }

  async syncToServer() {
    if (this.syncInProgress || !this.isOnline) return;
    
    this.syncInProgress = true;
    const queue = await localforage.getItem(DATA_KEYS.SYNC_QUEUE) || [];
    
    if (queue.length === 0) {
      this.syncInProgress = false;
      return { success: true, synced: 0 };
    }
    
    try {
      // TODO: Replace with actual kadaele-services endpoint
      // For now, we'll simulate a successful sync
      console.log('Syncing to server:', queue.length, 'items');
      
      // Simulate API call
      // const response = await fetch('https://kadaele-services.example.com/sync', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ items: queue }),
      // });
      
      // if (response.ok) {
        await localforage.setItem(DATA_KEYS.SYNC_QUEUE, []);
        await localforage.setItem(DATA_KEYS.LAST_SYNC, new Date().toISOString());
      // }
      
      this.syncInProgress = false;
      return { success: true, synced: queue.length };
    } catch (error) {
      console.error('Sync failed:', error);
      this.syncInProgress = false;
      return { success: false, error: error.message };
    }
  }

  async getLastSyncTime() {
    return await localforage.getItem(DATA_KEYS.LAST_SYNC);
  }

  // Photo operations
  async savePhoto(photoData, purchaseId) {
    try {
      // Save photo to local storage
      const photoKey = `photo_${purchaseId}`;
      await localforage.setItem(photoKey, photoData);
      
      // TODO: Upload to kadaele-services when online
      if (this.isOnline) {
        // Simulate upload
        console.log('Uploading photo for purchase:', purchaseId);
        // const formData = new FormData();
        // formData.append('photo', photoData);
        // formData.append('purchaseId', purchaseId);
        // await fetch('https://kadaele-services.example.com/upload', {
        //   method: 'POST',
        //   body: formData,
        // });
      }
      
      return photoKey;
    } catch (error) {
      console.error('Error saving photo:', error);
      throw error;
    }
  }

  async getPhoto(photoKey) {
    return await localforage.getItem(photoKey);
  }

  // Initialize sample data (for testing)
  async initializeSampleData() {
    const goods = await this.getGoods();
    if (goods.length === 0) {
      await this.setGoods([
        { id: '1', name: 'Rice (1kg)', price: 50, category: 'Grains' },
        { id: '2', name: 'Sugar (1kg)', price: 80, category: 'Groceries' },
        { id: '3', name: 'Cooking Oil (1L)', price: 120, category: 'Cooking' },
        { id: '4', name: 'Bread', price: 30, category: 'Bakery' },
        { id: '5', name: 'Milk (1L)', price: 60, category: 'Dairy' },
        { id: '6', name: 'Eggs (12pcs)', price: 90, category: 'Dairy' },
        { id: '7', name: 'Soap', price: 25, category: 'Personal Care' },
        { id: '8', name: 'Toothpaste', price: 45, category: 'Personal Care' },
      ]);
    }
  }
}

export default new DataService();
