import localforage from 'localforage';
import { auth, db } from './firebaseConfig';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit
} from 'firebase/firestore';

// Configure LocalForage (offline-first cache)
localforage.config({
  name: 'KadaeleServices',
  storeName: 'shopkeeper_data'
});

class DataService {
  constructor() {
    this.currentUser = null;
    this.syncInProgress = false;

    // Online/offline flag (BOOLEAN)
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        console.log('🌐 Back online - syncing...');
        this.syncToCloud();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log('📴 Offline mode');
      });
    }

    // Auth state
    auth.onAuthStateChanged((user) => {
      this.currentUser = user || null;
      if (user) {
        console.log('✅ Logged in:', user.email);
        // Background refresh after login
        this.startBackgroundSync();
      }
    });
  }

  // ==================== AUTH ====================

  async login(email, password) {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: res.user };
    } catch (error) {
      return { success: false, error: error?.message || 'Login failed' };
    }
  }

  async register(email, password) {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      return { success: true, user: res.user };
    } catch (error) {
      return { success: false, error: error?.message || 'Registration failed' };
    }
  }

  async sendPasswordReset(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Password reset failed' };
    }
  }

  async logout() {
    await signOut(auth);
    this.currentUser = null;
  }

  // ==================== LOCAL CACHE ====================

  async saveLocal(key, data) {
    try {
      await localforage.setItem(key, data);
      return true;
    } catch (e) {
      console.error(`❌ saveLocal(${key}) failed:`, e);
      return false;
    }
  }

  async getLocal(key) {
    try {
      const data = await localforage.getItem(key);
      return data || [];
    } catch (e) {
      console.error(`❌ getLocal(${key}) failed:`, e);
      return [];
    }
  }

  async addToQueue(action, data) {
    const queue = (await this.getLocal('sync_queue')) || [];
    queue.push({ action, data, timestamp: Date.now() });
    await this.saveLocal('sync_queue', queue);
  }

  // ==================== GOODS (Firestore -> Local Cache) ====================

  async getGoods() {
    const localGoods = await this.getLocal('goods');

    // If empty AND online, await one fetch so Inventory loads immediately.
    if ((localGoods?.length || 0) === 0 && this.isOnline) {
      try {
        await this.syncGoodsFromCloud();
        const refreshed = await this.getLocal('goods');
        return refreshed || [];
      } catch (_) {
        // fall back to local
      }
    }

    // Background refresh
    this.syncGoodsFromCloud();
    return localGoods || [];
  }

  async syncGoodsFromCloud() {
    if (!this.isOnline) return;

    try {
      const goodsRef = collection(db, 'goods');
      const snapshot = await getDocs(goodsRef);

      const goods = snapshot.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: data.id ?? d.id,
          name: data.name ?? data.itemName ?? data.title ?? '',
          price: typeof data.price === 'number' ? data.price : parseFloat(data.price || 0),
          stock_quantity:
            typeof data.stock_quantity === 'number'
              ? data.stock_quantity
              : (typeof data.stockLevel === 'number' ? data.stockLevel : parseInt(data.stock_quantity || data.stockLevel || 0, 10)),
          ...data
        };
      });

      await this.saveLocal('goods', goods);
      console.log(`✅ Synced goods from Firestore: ${goods.length}`);
    } catch (e) {
      console.log('⚠️ Goods cloud sync failed (using local cache)');
    }
  }

  // ==================== PURCHASES (Sales Journal) ====================

  async addPurchase(purchase) {
    // Local-first
    const localId = `purchase_${Date.now()}`;
    const p = {
      ...purchase,
      id: localId,
      createdAt: new Date().toISOString(),
      synced: false
    };

    const purchases = (await this.getLocal('purchases')) || [];
    purchases.unshift(p);
    await this.saveLocal('purchases', purchases);

    await this.addToQueue('addPurchase', p);

    if (this.isOnline) this.syncToCloud();
    return p;
  }

  async getPurchases() {
    const localPurchases = (await this.getLocal('purchases')) || [];
    this.syncPurchasesFromCloud();
    return localPurchases;
  }

  async syncPurchasesFromCloud() {
    if (!this.isOnline) return;

    try {
      const purchasesRef = collection(db, 'purchases');
      const q = query(purchasesRef, orderBy('createdAt', 'desc'), limit(500));
      const snap = await getDocs(q);

      const cloud = snap.docs.map((d) => ({ id: d.id, ...d.data(), synced: true }));

      // Merge (do NOT wipe local if cloud empty)
      const local = (await this.getLocal('purchases')) || [];
      const map = new Map();
      for (const x of local) if (x?.id) map.set(x.id, x);
      for (const x of cloud) if (x?.id) map.set(x.id, x);

      const merged = Array.from(map.values());
      merged.sort((a, b) => {
        const at = new Date(a.createdAt || a.timestamp || 0).getTime();
        const bt = new Date(b.createdAt || b.timestamp || 0).getTime();
        return bt - at;
      });

      await this.saveLocal('purchases', merged);
      console.log(`✅ Purchases synced: ${cloud.length}`);
    } catch (e) {
      console.log('⚠️ Purchases cloud sync failed (using local cache)');
    }
  }

  // ==================== DEBTORS ====================

  async getDebtors() {
    const localDebtors = (await this.getLocal('debtors')) || [];
    this.syncDebtorsFromCloud();
    return localDebtors;
  }

  async syncDebtorsFromCloud() {
    if (!this.isOnline) return;

    try {
      const debtorsRef = collection(db, 'debtors');
      const snap = await getDocs(debtorsRef);
      const debtors = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      await this.saveLocal('debtors', debtors);
      console.log(`✅ Debtors synced: ${debtors.length}`);
    } catch (e) {
      console.log('⚠️ Debtors cloud sync failed (using local cache)');
    }
  }

  async recordPayment(debtorId, amount) {
    const debtors = (await this.getLocal('debtors')) || [];
    const idx = debtors.findIndex((d) => d.id === debtorId);
    if (idx < 0) return false;

    const paid = parseFloat(amount) || 0;
    const current = parseFloat(debtors[idx].totalDebt) || 0;
    debtors[idx].totalDebt = Math.max(0, current - paid);

    await this.saveLocal('debtors', debtors);
    await this.addToQueue('recordPayment', { debtorId, amount: paid });

    if (this.isOnline) this.syncToCloud();
    return true;
  }

  // ==================== PHOTO ====================

  async savePhoto(purchaseId, photoUrl) {
    const purchases = (await this.getLocal('purchases')) || [];
    const idx = purchases.findIndex((p) => p.id === purchaseId);
    if (idx < 0) return false;

    purchases[idx].photoUrl = photoUrl;
    await this.saveLocal('purchases', purchases);
    await this.addToQueue('savePhoto', { purchaseId, photoUrl });

    if (this.isOnline) this.syncToCloud();
    return true;
  }

  // ==================== CLOUD SYNC QUEUE ====================

  async syncToCloud() {
    if (this.syncInProgress) return;
    if (!this.isOnline) return;

    const queue = (await this.getLocal('sync_queue')) || [];
    if (queue.length === 0) return;

    this.syncInProgress = true;

    try {
      for (const item of queue) {
        if (!item?.action) continue;

        if (item.action === 'addPurchase') {
          await this.pushPurchaseToCloud(item.data);
        } else if (item.action === 'recordPayment') {
          await this.pushPaymentToCloud(item.data);
        } else if (item.action === 'savePhoto') {
          // keep non-fatal (photos are stored as URL in purchase)
        }
      }

      await this.saveLocal('sync_queue', []);
      console.log('✅ Sync queue flushed');
    } catch (e) {
      console.log('⚠️ Sync queue failed (will retry later)');
    } finally {
      this.syncInProgress = false;
    }
  }

  async pushPurchaseToCloud(purchase) {
    const purchasesRef = collection(db, 'purchases');
    await addDoc(purchasesRef, {
      ...purchase,
      createdAt: purchase?.createdAt ? purchase.createdAt : serverTimestamp()
    });
  }

  async pushPaymentToCloud({ debtorId, amount }) {
    const ref = doc(db, 'debtors', debtorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const current = snap.data() || {};
    const currentDebt = parseFloat(current.totalDebt) || 0;
    const paid = parseFloat(amount) || 0;

    await updateDoc(ref, {
      totalDebt: Math.max(0, currentDebt - paid),
      updatedAt: serverTimestamp()
    });
  }

  // ==================== BACKGROUND SYNC ====================

  startBackgroundSync() {
    try {
      this.syncGoodsFromCloud();
      this.syncPurchasesFromCloud();
      this.syncDebtorsFromCloud();
    } catch (_) {}
  }
}

export default new DataService();
