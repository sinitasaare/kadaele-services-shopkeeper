import localforage from 'localforage';
import { auth, db } from './firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged 
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

// Configure localforage
localforage.config({
  name: 'kadaele-pos',
  storeName: 'pos_data',
});

// Data file keys
const DATA_KEYS = {
  GOODS: 'goods',
  SALES: 'sales',
  DEBTORS: 'debtors',
  CREDITORS: 'creditors',
  SUPPLIERS: 'suppliers',
  INVENTORY: 'inventory',
  CASH_ENTRIES: 'cash_entries',
  PURCHASES: 'purchases',
  SYNC_QUEUE: 'sync_queue',
  LAST_SYNC: 'last_sync',
  SETTINGS: 'app_settings',
};

class DataService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.currentUser = null;
    // Tracks whether we've done the initial Firebase pull for debtors this
    // session.  After the first pull we trust localforage as source of truth
    // so that writes made moments ago are never overwritten by a stale read.
    this._debtorsFetchedFromFirebase = false;
    this._creditorsFetchedFromFirebase = false;
    this._suppliersFetchedFromFirebase = false;
    this._goodsFetchedFromFirebase = false;
    this._cashEntriesFetched = false;
    this._debtorsUnsubscribe = null; // Firebase real-time listener handle
    this._goodsUnsubscribe = null;   // Firebase real-time listener handle for goods
    
    // ── Goods change subscribers ──────────────────────────────────────────
    // UI components register callbacks here so they re-render when the
    // Firebase real-time listener writes new goods data to localforage.
    this._goodsSubscribers = new Set();
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncToServer();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // ── Goods change subscription API ───────────────────────────────────────
  // Components call onGoodsChange(callback) to be notified whenever the
  // Firebase real-time listener (or any local write) updates the goods list.
  // Returns an unsubscribe function.
  onGoodsChange(callback) {
    this._goodsSubscribers.add(callback);
    return () => this._goodsSubscribers.delete(callback);
  }

  // Notify all subscribers with the latest goods array
  _notifyGoodsSubscribers(goods) {
    for (const cb of this._goodsSubscribers) {
      try { cb(goods); } catch (e) { console.error('Goods subscriber error:', e); }
    }
  }

  // ── Start real-time Firebase listener for Debtors collection ─────────────
  // Called after login. Watches for:
  //   • New debtors added in Firebase → saved to localforage
  //   • Debtors deleted from Firebase → if balance=0 in forage, delete forage record too
  startDebtorsListener() {
    if (this._debtorsUnsubscribe) return; // already listening
    try {
      this._debtorsUnsubscribe = onSnapshot(
        collection(db, 'debtors'),
        async (snapshot) => {
          const localDebtors = await localforage.getItem(DATA_KEYS.DEBTORS) || [];
          const localMap = new Map(localDebtors.map(d => [d.id, d]));

          snapshot.docChanges().forEach((change) => {
            const fbId = change.doc.id;
            const fbData = { id: fbId, ...change.doc.data() };

            if (change.type === 'removed') {
              // Debtor was deleted from Firebase
              const local = localMap.get(fbId);
              if (local && (local.balance || local.totalDue || 0) <= 0) {
                // Balance is 0 (cleared) — safe to delete local record too
                localMap.delete(fbId);
              }
              // If balance > 0, we keep the local record (never lose debt data)
            } else if (change.type === 'added') {
              // New debtor from Firebase — add if not already in local
              if (!localMap.has(fbId)) {
                localMap.set(fbId, fbData);
              }
            } else if (change.type === 'modified') {
              // Remote update — merge carefully, prefer local if it's newer
              const local = localMap.get(fbId);
              const fbTime  = fbData.updatedAt?.seconds
                ? fbData.updatedAt.seconds * 1000
                : new Date(fbData.updatedAt || 0).getTime();
              const locTime = new Date(local?.updatedAt || 0).getTime();
              if (!local || fbTime > locTime) {
                localMap.set(fbId, { ...fbData, updatedAt: new Date(fbTime).toISOString() });
              }
            }
          });

          const merged = Array.from(localMap.values());
          await localforage.setItem(DATA_KEYS.DEBTORS, merged);
        },
        (error) => {
          console.error('Debtors Firebase listener error:', error);
        }
      );
    } catch (err) {
      console.error('Could not start debtors listener:', err);
    }
  }

  stopDebtorsListener() {
    if (this._debtorsUnsubscribe) {
      this._debtorsUnsubscribe();
      this._debtorsUnsubscribe = null;
    }
  }

  // ── Start real-time Firebase listener for Goods collection ───────────────
  // Watches for products added, edited or deleted from ANY device (e.g. the
  // Kadaele Inventory app) and merges changes into localforage immediately,
  // so the Shopkeeper app always shows up-to-date inventory without restart.
  startGoodsListener() {
    if (this._goodsUnsubscribe) return; // already listening
    try {
      this._goodsUnsubscribe = onSnapshot(
        collection(db, 'goods'),
        async (snapshot) => {
          // Skip if nothing actually changed (e.g. initial empty snapshot)
          if (snapshot.docChanges().length === 0) return;

          const localGoods = await localforage.getItem(DATA_KEYS.GOODS) || [];
          const localMap = new Map(localGoods.map(g => [String(g.id), g]));

          snapshot.docChanges().forEach((change) => {
            const fbId = String(change.doc.id);
            const rawData = change.doc.data();
            // Normalise Firestore Timestamps to ISO strings for local storage
            const fbData = { id: fbId, ...rawData };
            if (rawData.updatedAt?.seconds) {
              fbData.updatedAt = new Date(rawData.updatedAt.seconds * 1000).toISOString();
            }
            if (rawData.createdAt?.seconds) {
              fbData.createdAt = new Date(rawData.createdAt.seconds * 1000).toISOString();
            }

            if (change.type === 'removed') {
              localMap.delete(fbId);
            } else if (change.type === 'added') {
              // Always accept remote adds — overwrite only if local doesn't
              // exist OR if remote is newer (covers Admin-app edits).
              const local = localMap.get(fbId);
              if (!local) {
                localMap.set(fbId, fbData);
              } else {
                // If the remote version is newer, prefer it
                const fbTime  = new Date(fbData.updatedAt || fbData.createdAt || 0).getTime();
                const locTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
                if (fbTime > locTime) {
                  localMap.set(fbId, fbData);
                }
              }
            } else if (change.type === 'modified') {
              // Remote update from Admin app — always accept it
              localMap.set(fbId, fbData);
            }
          });

          const merged = Array.from(localMap.values());
          await localforage.setItem(DATA_KEYS.GOODS, merged);
          // ── Notify UI components about the update ──────────────────
          this._notifyGoodsSubscribers(merged);
        },
        (error) => {
          console.error('Goods Firebase listener error:', error);
        }
      );
    } catch (err) {
      console.error('Could not start goods listener:', err);
    }
  }

  stopGoodsListener() {
    if (this._goodsUnsubscribe) {
      this._goodsUnsubscribe();
      this._goodsUnsubscribe = null;
    }
  }

  // Authentication methods
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      this.currentUser = userCredential.user;
      // Reset so the next getDebtors() call pulls a fresh copy from Firebase
      this._debtorsFetchedFromFirebase = false;
      this._goodsFetchedFromFirebase = false;
      this._cashEntriesFetched = false;
      
      // Start real-time listeners for debtors and goods (handles remote changes)
      this.startDebtorsListener();
      this.startGoodsListener();
      
      // Store login state persistently
      await localforage.setItem('auth_user', {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        loggedInAt: new Date().toISOString()
      });
      
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async logout() {
    try {
      this.stopDebtorsListener();
      this.stopGoodsListener();
      await signOut(auth);
      this.currentUser = null;
      // Clear persistent login state
      await localforage.removeItem('auth_user');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  getCurrentUser() {
    return this.currentUser || auth.currentUser;
  }

  // Check if user has persistent login
  async checkPersistedLogin() {
    try {
      // Firebase Auth automatically restores sessions with browserLocalPersistence
      // We just need to wait for Firebase to restore the auth state
      return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          unsubscribe(); // Stop listening after first check
          if (user) {
            this.currentUser = user;
            // Also store in localforage for backup
            localforage.setItem('auth_user', {
              uid: user.uid,
              email: user.email,
              loggedInAt: new Date().toISOString()
            }).catch(err => console.error('Error storing auth state:', err));
            // Start real-time listeners for debtors and goods
            this.startDebtorsListener();
            this.startGoodsListener();
            resolve(user);
          } else {
            // Check if we have backup auth state
            localforage.getItem('auth_user').then(authUser => {
              if (authUser) {
                console.log('User was logged in but Firebase session expired');
                // Clear the backup since Firebase session is gone
                localforage.removeItem('auth_user');
              }
              resolve(null);
            }).catch(() => resolve(null));
          }
        });
      });
    } catch (error) {
      console.error('Error checking persisted login:', error);
      return null;
    }
  }

  async sendPasswordReset(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to send password reset email.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      
      return { success: false, error: errorMessage };
    }
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
      return data || (key === DATA_KEYS.GOODS || key === DATA_KEYS.SALES || 
                      key === DATA_KEYS.DEBTORS || key === DATA_KEYS.CREDITORS ||
                      key === DATA_KEYS.SUPPLIERS || key === DATA_KEYS.INVENTORY ? [] : null);
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return key === DATA_KEYS.GOODS || key === DATA_KEYS.SALES || 
             key === DATA_KEYS.DEBTORS || key === DATA_KEYS.CREDITORS ||
             key === DATA_KEYS.SUPPLIERS || key === DATA_KEYS.INVENTORY ? [] : null;
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
    try {
      // Pull from Firebase only on the FIRST call of the session.
      if (this.isOnline && auth.currentUser && !this._goodsFetchedFromFirebase) {
        this._goodsFetchedFromFirebase = true;
        const goodsSnapshot = await getDocs(collection(db, 'goods'));
        const firebaseGoods = goodsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Add any local-only items (added offline) that Firebase doesnt have by ID.
        const localGoods = await localforage.getItem(DATA_KEYS.GOODS) || [];
        const firebaseIds = new Set(firebaseGoods.map(g => String(g.id)));
        const localOnlyGoods = localGoods.filter(g => !firebaseIds.has(String(g.id)));
        const rawMerged = [...firebaseGoods, ...localOnlyGoods];

        // Deduplicate by name (case-insensitive, trimmed) keeping the first occurrence.
        // This cleans up any existing duplicates already in Firebase or local storage.
        const seenNames = new Set();
        const merged = rawMerged.filter(g => {
          const key = (g.name || '').toLowerCase().trim();
          if (!key || seenNames.has(key)) return false;
          seenNames.add(key);
          return true;
        });

        await localforage.setItem(DATA_KEYS.GOODS, merged);
        return merged;
      }
    } catch (error) {
      console.error('Error fetching goods from Firebase:', error);
    }
    // Offline or already fetched this session — use local cache
    return await this.get(DATA_KEYS.GOODS);
  }

  async setGoods(goods) {
    // Save locally first
    await localforage.setItem(DATA_KEYS.GOODS, goods);
    
    // Sync to Firebase if online
    const user = auth.currentUser || await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
    });
    if (this.isOnline && user) {
      try {
        const batch = writeBatch(db);
        goods.forEach(good => {
          const goodRef = doc(db, 'goods', good.id.toString());
          batch.set(goodRef, {
            ...good,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        await batch.commit();
      } catch (error) {
        console.error('Error syncing goods to Firebase:', error);
      }
    }
    return true;
  }

  async addGood(good) {
    const goods = await this.getGoods();
    const newGood = {
      id: good.id || this.generateId(),
      name: good.name,
      price: parseFloat(good.price),
      category: good.category || 'General',
      barcode: good.barcode || null,
      stock_quantity: good.stock_quantity || 0,
      createdAt: new Date().toISOString(),
    };
    // Guard: never push if this ID OR this name already exists
    const nameKey = (newGood.name || '').toLowerCase().trim();
    const isDuplicate = goods.some(g =>
      String(g.id) === String(newGood.id) ||
      (nameKey && (g.name || '').toLowerCase().trim() === nameKey)
    );
    if (isDuplicate) return newGood;
    goods.push(newGood);
    // setGoods handles both local save AND Firebase batch sync
    await this.setGoods(goods);
    return newGood;
  }

  async updateGood(id, updates) {
    const goods = await this.getGoods();
    const index = goods.findIndex(g => g.id === id);
    if (index !== -1) {
      goods[index] = { ...goods[index], ...updates };
      await this.setGoods(goods);
      
      // Sync to Firebase
      if (this.isOnline && auth.currentUser) {
        try {
          await updateDoc(doc(db, 'goods', id.toString()), {
            ...updates,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.error('Error updating good in Firebase:', error);
        }
      }
      
      return goods[index];
    }
    return null;
  }

  // Purchases operations
  async getSales() {
    try {
      // Only pull from Firebase on the FIRST call of the session.
      // After that, localforage is the source of truth — this prevents a
      // stale Firebase read from overwriting a write that just happened
      // (e.g. addSale with a manual backdated date).
      if (this.isOnline && auth.currentUser && !this._salesFetchedFromFirebase) {
        this._salesFetchedFromFirebase = true;
        const salesSnapshot = await getDocs(collection(db, 'sales'));
        const firebaseSales = salesSnapshot.docs.map(doc => {
          const data = doc.data();
          // Convert Firestore Timestamps to ISO strings.
          // For date: prefer the stored ISO string (which preserves the manual
          // date for backdated entries). Only fall back to Timestamp if no
          // ISO string is present.
          const dateVal = typeof data.date === 'string'
            ? data.date
            : (data.date?.toDate?.()?.toISOString?.() || null);
          return {
            id: doc.id,
            ...data,
            date: dateVal,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
          };
        });

        // Merge: keep the local version if it's newer (covers the case where
        // a sale was just saved locally but Firebase still has stale data).
        const localSales = await localforage.getItem(DATA_KEYS.SALES) || [];
        const localMap = new Map(localSales.map(s => [s.id, s]));
        const merged = firebaseSales.map(fbSale => {
          const local = localMap.get(fbSale.id);
          if (!local) return fbSale;
          // If local has a more recent createdAt, keep local
          const fbTime  = new Date(fbSale.createdAt || 0).getTime();
          const locTime = new Date(local.createdAt || 0).getTime();
          return locTime >= fbTime ? local : fbSale;
        });
        // Add any sales that exist only locally (created offline)
        for (const local of localSales) {
          if (!merged.find(s => s.id === local.id)) merged.push(local);
        }

        await localforage.setItem(DATA_KEYS.SALES, merged);
        return merged;
      }
    } catch (error) {
      console.error('Error fetching sales from Firebase:', error);
    }

    // All subsequent calls within the same session use localforage
    return await this.get(DATA_KEYS.SALES);
  }

  async setSales(sales) {
    // Save locally first
    await localforage.setItem(DATA_KEYS.SALES, sales);
    return true;
  }

  async addSale(sale) {
    const sales = await this.getSales();
    const serverTime = new Date();

    // Use manual date if provided (forgotten entry), otherwise now
    const saleDate = sale.date ? new Date(sale.date) : serverTime;

    const newSale = {
      id: sale.id || this.generateId(),
      date: saleDate.toISOString(),
      timestamp: saleDate.toISOString(), // For SalesJournal compatibility
      items: sale.items,
      total: parseFloat(sale.total),
      total_amount: parseFloat(sale.total),
      paymentType: sale.paymentType,
      payment_type: sale.paymentType,
      customerName: sale.customerName || '',
      customer_name: sale.customerName || '',
      customerPhone: sale.customerPhone || '',
      debtorId: sale.debtorId || null,           // ← ID of the registered debtor
      status: sale.status || 'active',
      photoUrl: sale.photoUrl || null,
      refund: sale.refund || null,
      repaymentDate: sale.repaymentDate || '',
      isDebt: sale.isDebt || false,
      createdAt: serverTime.toISOString(),
      ...(sale.isUnrecorded ? { isUnrecorded: true } : {}),
    };
    
    sales.push(newSale);
    await this.setSales(sales);

    // ── Auto-deduct stock for each item sold ─────────────────────────────
    try {
      const goods = await localforage.getItem(DATA_KEYS.GOODS) || [];
      let stockChanged = false;
      newSale.items.forEach(soldItem => {
        const good = goods.find(g => String(g.id) === String(soldItem.id));
        if (good && typeof good.stock_quantity === 'number') {
          const qty = soldItem.quantity || soldItem.qty || 0;
          good.stock_quantity = Math.max(0, good.stock_quantity - qty);
          stockChanged = true;
        }
      });
      if (stockChanged) {
        await localforage.setItem(DATA_KEYS.GOODS, goods);
        // Sync reduced stock to Firebase
        if (this.isOnline && auth.currentUser) {
          const batch = writeBatch(db);
          goods.forEach(g => {
            batch.set(doc(db, 'goods', g.id.toString()), { ...g, updatedAt: serverTimestamp() }, { merge: true });
          });
          await batch.commit().catch(e => console.error('Stock sync error:', e));
        }
      }
    } catch (stockErr) {
      console.error('Error deducting stock after sale:', stockErr);
    }
    
    // ── Auto-record cash sales in the Cash Journal ────────────────────────
    // Every cash sale is also a Cash IN entry so the Cash Journal stays in sync.
    if (newSale.paymentType === 'cash') {
      await this.addCashEntry({
        type: 'in',
        amount: newSale.total,
        note: 'CASH Sale',
        date: saleDate.toISOString(),
        source: 'sale',
        saleId: newSale.id,
        ...(sale.isUnrecorded ? { isUnrecorded: true } : {}),
      });
    }

    // Sync to Firebase 'sales' collection
    if (this.isOnline && auth.currentUser) {
      try {
        await setDoc(doc(db, 'sales', newSale.id), {
          ...newSale,
          // Keep the manually entered date (saleDate) — do NOT overwrite with
          // serverTimestamp() as that would corrupt forgotten/backdated entries.
          // Only createdAt uses server time so we know when it was recorded.
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('Error adding sale to Firebase:', error);
        // Queue for later sync
        await this.addToSyncQueue({ type: 'sale', data: newSale });
      }
    } else {
      // Queue for sync when online
      await this.addToSyncQueue({ type: 'sale', data: newSale });
    }
    
    // Update debtor record if this is a credit sale.
    // Check debtorId first — customerName alone is not reliable if the field
    // was left empty or came through blank from the modal.
    if (newSale.paymentType === 'credit' && (newSale.debtorId || newSale.customerName)) {
      await this.updateDebtor(newSale);
    }

    return newSale;
  }

  async updateSale(id, updates) {
    const sales = await this.getSales();
    const index = sales.findIndex(s => s.id === id);
    
    if (index !== -1) {
      const sale = sales[index];

      // Check if within 24 hours
      const createdDate = new Date(sale.createdAt);
      const now = new Date();
      const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
      
      if (hoursDiff > 2 && !updates.allowAfter24Hours) {
        throw new Error('Cannot edit sale after 2 hours');
      }
      
      sales[index] = { ...sale, ...updates };
      await this.setSales(sales);

      // Update debtors if needed
      if (sales[index].paymentType === 'credit') {
        await this.recalculateDebtors();
      }

      return sales[index];
    }
    return null;
  }

  async deleteSale(id) {
    const sales = await this.getSales();
    const index = sales.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Sale not found');
    const sale = sales[index];
    const hoursDiff = (new Date() - new Date(sale.createdAt || sale.date || 0)) / (1000 * 60 * 60);
    if (hoursDiff > 2) throw new Error('Cannot delete sale after 2 hours');
    sales.splice(index, 1);
    await this.setSales(sales);
    if (this.isOnline && auth.currentUser) {
      try { await deleteDoc(doc(db, 'sales', id)); } catch (err) { console.error('Firebase delete sale error:', err); }
    }
    await this.recalculateDebtors();
  }

  async deleteCashEntry(id) {
    const entries = await localforage.getItem(DATA_KEYS.CASH_ENTRIES) || [];
    const index = entries.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Cash entry not found');
    const entry = entries[index];
    const hoursDiff = (new Date() - new Date(entry.date || entry.createdAt || 0)) / (1000 * 60 * 60);
    if (hoursDiff > 2) throw new Error('Cannot delete cash entry after 2 hours');
    entries.splice(index, 1);
    await localforage.setItem(DATA_KEYS.CASH_ENTRIES, entries);
    if (this.isOnline && auth.currentUser) {
      try { await deleteDoc(doc(db, 'cash_entries', id)); } catch (err) { console.error('Firebase delete cash entry error:', err); }
    }
  }

  async deletePurchase(id) {
    const purchases = await localforage.getItem(DATA_KEYS.PURCHASES) || [];
    const index = purchases.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Purchase not found');
    const purchase = purchases[index];
    const hoursDiff = (new Date() - new Date(purchase.createdAt || purchase.date || 0)) / (1000 * 60 * 60);
    if (hoursDiff > 2) throw new Error('Cannot delete purchase after 2 hours');
    purchases.splice(index, 1);
    await localforage.setItem(DATA_KEYS.PURCHASES, purchases);
    if (this.isOnline && auth.currentUser) {
      try { await deleteDoc(doc(db, 'purchases', id)); } catch (err) { console.error('Firebase delete purchase error:', err); }
    }
  }

  async voidSale(id, reason) {
    return await this.updateSale(id, { 
      status: 'voided', 
      voidReason: reason,
      voidedAt: (await this.getServerTime()).toISOString(),
      allowAfter24Hours: true,
    });
  }

  async refundSale(id, amount, reason) {
    const sale = await this.updateSale(id, {
      status: 'refunded',
      refund: {
        amount: parseFloat(amount),
        reason: reason,
        date: (await this.getServerTime()).toISOString(),
      },
      allowAfter24Hours: true,
    });
    
    // Update debtors if credit sale
    if (sale && sale.paymentType === 'credit') {
      await this.recalculateDebtors();
    }
    
    return sale;
  }

  // Debtors operations
  async getDebtors() {
    try {
      // Only pull from Firebase on the FIRST call of the session.
      // After that, localforage is the source of truth — this prevents a
      // stale Firebase read from overwriting a write that just happened
      // (e.g. updateDebtor called right before loadDebtors in the UI).
      if (this.isOnline && auth.currentUser && !this._debtorsFetchedFromFirebase) {
        this._debtorsFetchedFromFirebase = true;
        const debtorsSnapshot = await getDocs(collection(db, 'debtors'));
        const firebaseDebtors = debtorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          lastPurchase: doc.data().lastPurchase?.toDate?.() || doc.data().lastPurchase,
          lastPayment: doc.data().lastPayment?.toDate?.() || doc.data().lastPayment
        }));

        // Get existing local data
        const localDebtors = await localforage.getItem(DATA_KEYS.DEBTORS) || [];

        // Merge: for each debtor, take whichever version has the more recent
        // updatedAt timestamp. This way locally-saved debt entries (balance,
        // saleIds, etc.) are never silently overwritten by a stale Firebase read.
        const merged = [...firebaseDebtors];
        for (const local of localDebtors) {
          const fbIdx = merged.findIndex(d => d.id === local.id);
          if (fbIdx === -1) {
            // Exists only locally (e.g. created offline) — keep it
            merged.push(local);
          } else {
            // Both exist: keep whichever is newer by updatedAt
            const fbTime  = new Date(merged[fbIdx].updatedAt || 0).getTime();
            const locTime = new Date(local.updatedAt || 0).getTime();
            if (locTime > fbTime) {
              // Local is newer (e.g. credit sale just recorded) — prefer local
              merged[fbIdx] = local;
            }
          }
        }

        await localforage.setItem(DATA_KEYS.DEBTORS, merged);
        return merged;
      }
    } catch (error) {
      console.error('Error fetching debtors from Firebase:', error);
    }

    // All subsequent calls within the same session use local storage,
    // which always has the latest writes from updateDebtor / setDebtors.
    return await this.get(DATA_KEYS.DEBTORS);
  }

  // Call this to force a fresh pull from Firebase (e.g. after login sync).
  resetDebtorsFetchFlag() {
    this._debtorsFetchedFromFirebase = false;
    this._creditorsFetchedFromFirebase = false;
    this._suppliersFetchedFromFirebase = false;
    this._goodsFetchedFromFirebase = false;
    this._salesFetchedFromFirebase = false;
    this._purchasesFetchedFromFirebase = false;
  }

  async setDebtors(debtors) {
    // Save locally first — full data including any receipt photos
    await localforage.setItem(DATA_KEYS.DEBTORS, debtors);
    
    // Sync to Firebase if online
    const user = auth.currentUser || await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
    });
    if (this.isOnline && user) {
      try {
        const batch = writeBatch(db);
        debtors.forEach(debtor => {
          const debtorRef = doc(db, 'debtors', debtor.id.toString());
          // Strip base64 photo data from deposits before sending to Firestore
          // (Firestore has a 1 MB document limit; photos would exceed it).
          // Photos remain in localforage for offline access.
          const depositsForFirestore = (debtor.deposits || []).map(dep => {
            const { photo: _photo, ...rest } = dep; // eslint-disable-line no-unused-vars
            return rest;
          });
          batch.set(debtorRef, {
            ...debtor,
            deposits: depositsForFirestore,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        await batch.commit();
      } catch (error) {
        console.error('Error syncing debtors to Firebase:', error);
      }
    }
    return true;
  }

  async updateDebtor(saleData) {
    // Always read from localforage directly (not getDebtors which may re-fetch
    // from Firebase and overwrite a write that just happened moments ago)
    const debtors = await localforage.getItem(DATA_KEYS.DEBTORS) || [];

    // Match by debtorId first (exact, set by SalesRegister when a registered
    // debtor is selected from the dropdown).  Fall back to name match only if
    // debtorId is absent (legacy / manual entries).
    let existingDebtor = saleData.debtorId
      ? debtors.find(d => d.id === saleData.debtorId)
      : debtors.find(d =>
          d.customerName?.toLowerCase() === saleData.customerName?.toLowerCase() ||
          d.name?.toLowerCase()         === saleData.customerName?.toLowerCase()
        );

    if (existingDebtor) {
      // Accumulate the debt on the debtor record
      existingDebtor.totalDue  = (existingDebtor.totalDue  || 0) + saleData.total;
      existingDebtor.totalPaid = existingDebtor.totalPaid  || 0;
      existingDebtor.balance   = existingDebtor.totalDue - existingDebtor.totalPaid;

      // Track the sale ID so Debt History tab can display it
      existingDebtor.saleIds     = existingDebtor.saleIds || [];
      existingDebtor.purchaseIds = existingDebtor.purchaseIds || [];
      if (!existingDebtor.saleIds.includes(saleData.id))     existingDebtor.saleIds.push(saleData.id);
      if (!existingDebtor.purchaseIds.includes(saleData.id)) existingDebtor.purchaseIds.push(saleData.id);

      existingDebtor.lastSale      = saleData.date;
      existingDebtor.lastPurchase  = saleData.date;
      existingDebtor.updatedAt     = new Date().toISOString();

      // Store the most recent repayment date so the Debtors card can show it
      if (saleData.repaymentDate) {
        existingDebtor.repaymentDate = saleData.repaymentDate;
      }

      // ── Save to localforage FIRST so the data survives a restart ──────────
      await localforage.setItem(DATA_KEYS.DEBTORS, debtors);

      // ── Then push to Firebase ──────────────────────────────────────────────
      if (this.isOnline && auth.currentUser) {
        try {
          const { deposits: _deposits, ...debtorForFirestore } = existingDebtor;
          // Strip base64 photos from deposits before sending to Firestore
          const depositsForFirestore = (existingDebtor.deposits || []).map(dep => {
            const { photo: _photo, ...rest } = dep;
            return rest;
          });
          await setDoc(doc(db, 'debtors', existingDebtor.id.toString()), {
            ...debtorForFirestore,
            deposits: depositsForFirestore,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (error) {
          console.error('Error syncing debtor to Firebase after credit sale:', error);
          // Queue for retry — debtor data is already safe in localforage
          await this.addToSyncQueue({ type: 'debtor', data: existingDebtor });
        }
      } else {
        // Offline — queue for sync when connectivity returns
        await this.addToSyncQueue({ type: 'debtor', data: existingDebtor });
      }
    } else {
      // No matching registered debtor — log a warning.  We deliberately do NOT
      // create a ghost debtor here; the UI enforces selection of a registered
      // debtor before saving a credit sale, so this path should not be reached
      // in normal operation.
      console.warn(
        '[updateDebtor] No debtor found for sale:', saleData.id,
        '| debtorId:', saleData.debtorId,
        '| customerName:', saleData.customerName
      );
    }
  }

  async recordPayment(debtorId, amount, purchaseIds = [], photo = null) {
    // Read directly from localforage so we always have the latest local state
    const debtors = await localforage.getItem(DATA_KEYS.DEBTORS) || [];
    const debtor = debtors.find(d => d.id === debtorId);
    
    if (debtor) {
      const paymentAmount = parseFloat(amount);
      debtor.totalPaid = (debtor.totalPaid || 0) + paymentAmount;
      debtor.balance = (debtor.totalDue || 0) - debtor.totalPaid;
      debtor.lastPayment = new Date().toISOString();
      debtor.updatedAt = debtor.lastPayment;

      // If debt is now fully cleared, remove the repayment date lock
      if (debtor.balance <= 0) {
        debtor.balance = 0;
        debtor.repaymentDate = '';   // cleared — new due date can be set
      }

      // Record the deposit as a line item in the debtor's history
      const depositEntry = {
        id: this.generateId(),
        type: 'deposit',
        amount: paymentAmount,
        date: debtor.lastPayment,
        ...(photo ? { photo } : {}),
      };
      debtor.deposits = debtor.deposits || [];
      debtor.deposits.push(depositEntry);

      // ── Save to localforage FIRST ──────────────────────────────────────
      await localforage.setItem(DATA_KEYS.DEBTORS, debtors);

      // ── Wire to Cash Journal with correct description ──────────────────
      const debtorName = debtor.name || debtor.customerName || 'Unknown';
      const gender = debtor.gender || '';
      const prefix = gender === 'Male' ? 'Mr.' : gender === 'Female' ? 'Ms.' : '';
      const displayName = prefix ? `${prefix} ${debtorName}` : debtorName;
      await this.addCashEntry({
        type: 'in',
        amount: paymentAmount,
        note: `Received from ${displayName}`,
        date: debtor.lastPayment,
        source: 'deposit',
        debtorId,
      });
      
      // Mark specific sales as paid if provided
      if (purchaseIds.length > 0) {
        const sales = await localforage.getItem(DATA_KEYS.SALES) || [];
        purchaseIds.forEach(pid => {
          const sale = sales.find(s => s.id === pid);
          if (sale) {
            sale.paid = true;
            sale.paidDate = debtor.lastPayment;
          }
        });
        await localforage.setItem(DATA_KEYS.SALES, sales);
      }
      
      // ── Sync full debtor record to Firebase ───────────────────────────
      if (this.isOnline && auth.currentUser) {
        try {
          const depositsForFirestore = (debtor.deposits || []).map(dep => {
            const { photo: _p, ...rest } = dep;
            return rest;
          });
          await setDoc(doc(db, 'debtors', debtorId.toString()), {
            ...debtor,
            deposits: depositsForFirestore,
            lastPayment: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (error) {
          console.error('Error syncing payment to Firebase:', error);
          await this.addToSyncQueue({ type: 'debtor', data: debtor });
        }
      } else {
        await this.addToSyncQueue({ type: 'debtor', data: debtor });
      }
      
      return debtor;
    }
    return null;
  }

  async recalculateDebtors() {
    const sales = await this.getSales();
    const creditSales = sales.filter(
      s => s.paymentType === 'credit' && s.status === 'active'
    );
    
    const debtorsMap = new Map();
    
    creditSales.forEach(sale => {
      const key = sale.customerPhone || sale.customerName;
      if (!debtorsMap.has(key)) {
        debtorsMap.set(key, {
          id: this.generateId(),
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          totalDue: 0,
          totalPaid: 0,
          balance: 0,
          saleIds: [],
          createdAt: sale.date,
          lastSale: sale.date,
        });
      }

      const debtor = debtorsMap.get(key);
      debtor.totalDue += sale.total;
      debtor.saleIds.push(sale.id);
      if (new Date(sale.date) > new Date(debtor.lastSale)) {
        debtor.lastSale = sale.date;
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


  // ──────────────────────────────────────────────────────────────────────────
  // Creditors operations (people/companies we owe money to)
  // ──────────────────────────────────────────────────────────────────────────
  async getCreditors() {
    try {
      if (this.isOnline && auth.currentUser && !this._creditorsFetchedFromFirebase) {
        this._creditorsFetchedFromFirebase = true;
        const creditorsSnapshot = await getDocs(collection(db, 'creditors'));
        const firebaseCreditors = creditorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          lastPurchase: doc.data().lastPurchase?.toDate?.() || doc.data().lastPurchase,
          lastPayment: doc.data().lastPayment?.toDate?.() || doc.data().lastPayment
        }));

        const localCreditors = await localforage.getItem(DATA_KEYS.CREDITORS) || [];
        const merged = [...firebaseCreditors];
        for (const local of localCreditors) {
          const fbIdx = merged.findIndex(c => c.id === local.id);
          if (fbIdx === -1) {
            merged.push(local);
          } else {
            const fbTime  = new Date(merged[fbIdx].updatedAt || 0).getTime();
            const locTime = new Date(local.updatedAt || 0).getTime();
            if (locTime > fbTime) {
              merged[fbIdx] = local;
            }
          }
        }

        await localforage.setItem(DATA_KEYS.CREDITORS, merged);
        return merged;
      }
    } catch (error) {
      console.error('Error fetching creditors from Firebase:', error);
    }
    return await this.get(DATA_KEYS.CREDITORS);
  }

  async setCreditors(creditors) {
    await localforage.setItem(DATA_KEYS.CREDITORS, creditors);
    const user = auth.currentUser || await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
    });
    if (this.isOnline && user) {
      try {
        const batch = writeBatch(db);
        creditors.forEach(creditor => {
          const creditorRef = doc(db, 'creditors', creditor.id.toString());
          const depositsForFirestore = (creditor.deposits || []).map(dep => {
            const { photo: _photo, ...rest } = dep;
            return rest;
          });
          batch.set(creditorRef, {
            ...creditor,
            deposits: depositsForFirestore,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        await batch.commit();
      } catch (error) {
        console.error('Error syncing creditors to Firebase:', error);
      }
    }
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suppliers operations (for managing supplier contacts/details)
  // ──────────────────────────────────────────────────────────────────────────
  async getSuppliers() {
    try {
      if (this.isOnline && auth.currentUser && !this._suppliersFetchedFromFirebase) {
        this._suppliersFetchedFromFirebase = true;
        const suppliersSnapshot = await getDocs(collection(db, 'suppliers'));
        const firebaseSuppliers = suppliersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          lastPurchase: doc.data().lastPurchase?.toDate?.() || doc.data().lastPurchase,
          lastPayment: doc.data().lastPayment?.toDate?.() || doc.data().lastPayment
        }));

        const localSuppliers = await localforage.getItem(DATA_KEYS.SUPPLIERS) || [];
        const merged = [...firebaseSuppliers];
        for (const local of localSuppliers) {
          const fbIdx = merged.findIndex(s => s.id === local.id);
          if (fbIdx === -1) {
            merged.push(local);
          } else {
            const fbTime  = new Date(merged[fbIdx].updatedAt || 0).getTime();
            const locTime = new Date(local.updatedAt || 0).getTime();
            if (locTime > fbTime) {
              merged[fbIdx] = local;
            }
          }
        }

        await localforage.setItem(DATA_KEYS.SUPPLIERS, merged);
        return merged;
      }
    } catch (error) {
      console.error('Error fetching suppliers from Firebase:', error);
    }
    return await this.get(DATA_KEYS.SUPPLIERS);
  }

  async setSuppliers(suppliers) {
    await localforage.setItem(DATA_KEYS.SUPPLIERS, suppliers);
    const user = auth.currentUser || await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
    });
    if (this.isOnline && user) {
      try {
        const batch = writeBatch(db);
        suppliers.forEach(supplier => {
          const supplierRef = doc(db, 'suppliers', supplier.id.toString());
          const depositsForFirestore = (supplier.deposits || []).map(dep => {
            const { photo: _photo, ...rest } = dep;
            return rest;
          });
          batch.set(supplierRef, {
            ...supplier,
            deposits: depositsForFirestore,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        await batch.commit();
      } catch (error) {
        console.error('Error syncing suppliers to Firebase:', error);
      }
    }
    return true;
  }


  // Inventory operations
  async getInventory() {
    try {
      // Try to get from Firebase first if online
      if (this.isOnline && auth.currentUser) {
        const inventorySnapshot = await getDocs(collection(db, 'inventory'));
        const firebaseInventory = inventorySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          lastUpdated: doc.data().lastUpdated?.toDate?.() || doc.data().lastUpdated
        }));
        
        // Save to local storage
        await localforage.setItem(DATA_KEYS.INVENTORY, firebaseInventory);
        return firebaseInventory;
      }
    } catch (error) {
      console.error('Error fetching inventory from Firebase:', error);
    }
    
    // Fallback to local storage
    return await this.get(DATA_KEYS.INVENTORY);
  }

  async setInventory(inventory) {
    // Save locally first
    await localforage.setItem(DATA_KEYS.INVENTORY, inventory);
    
    // Sync to Firebase if online
    const user = auth.currentUser || await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
    });
    if (this.isOnline && user) {
      try {
        const batch = writeBatch(db);
        inventory.forEach(item => {
          const inventoryRef = doc(db, 'inventory', item.itemId.toString());
          batch.set(inventoryRef, {
            ...item,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        await batch.commit();
      } catch (error) {
        console.error('Error syncing inventory to Firebase:', error);
      }
    }
    return true;
  }

  async updateInventoryItem(itemId, stockLevel) {
    const inventory = await this.getInventory();
    const existing = inventory.find(i => i.itemId === itemId);
    
    if (existing) {
      existing.stockLevel = parseInt(stockLevel);
      existing.lastUpdated = new Date().toISOString();
    } else {
      inventory.push({
        itemId: itemId,
        stockLevel: parseInt(stockLevel),
        lastUpdated: new Date().toISOString(),
      });
    }
    
    await this.setInventory(inventory);
    
    // Sync individual item to Firebase if online
    if (this.isOnline && auth.currentUser) {
      try {
        await setDoc(doc(db, 'inventory', itemId.toString()), {
          itemId: itemId,
          stockLevel: parseInt(stockLevel),
          lastUpdated: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.error('Error syncing inventory item to Firebase:', error);
      }
    }
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
    if (this.syncInProgress || !this.isOnline || !auth.currentUser) return;

    this.syncInProgress = true;
    const queue = await localforage.getItem(DATA_KEYS.SYNC_QUEUE) || [];

    if (queue.length === 0) {
      this.syncInProgress = false;
      return { success: true, synced: 0 };
    }

    console.log('Syncing queued items to Firebase:', queue.length);
    const failed = [];
    let synced = 0;

    for (const item of queue) {
      try {
        // Queue items added by addSale have { type: 'sale', data: newSale }
        if (item.type === 'sale' && item.data) {
          await setDoc(doc(db, 'sales', item.data.id), {
            ...item.data,
            createdAt: serverTimestamp(),
            date: serverTimestamp(),
          }, { merge: true });
          synced++;
        }
        // Queue items added by updateDebtor have { type: 'debtor', data: debtor }
        if (item.type === 'debtor' && item.data) {
          const { deposits: _d, ...debtorForFirestore } = item.data;
          const depositsForFirestore = (item.data.deposits || []).map(dep => {
            const { photo: _p, ...rest } = dep;
            return rest;
          });
          await setDoc(doc(db, 'debtors', item.data.id.toString()), {
            ...debtorForFirestore,
            deposits: depositsForFirestore,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          synced++;
        }
        // Queue items added by addCashEntry have { type: 'cash_entry', data: entry }
        if (item.type === 'cash_entry' && item.data) {
          await setDoc(doc(db, 'cash_entries', item.data.id), {
            ...item.data,
            createdAt: serverTimestamp(),
          }, { merge: true });
          synced++;
        }
        // Queue items added by the generic set() path have { key, value }
        // These are bulk array writes — skip (they sync via dedicated methods)
      } catch (error) {
        console.error('Failed to sync queued item:', item, error);
        failed.push(item); // keep failed items for next attempt
      }
    }

    // Persist only items that failed so they retry on next sync
    await localforage.setItem(DATA_KEYS.SYNC_QUEUE, failed);
    if (failed.length === 0) {
      await localforage.setItem(DATA_KEYS.LAST_SYNC, new Date().toISOString());
    }

    this.syncInProgress = false;
    return { success: failed.length === 0, synced, failed: failed.length };
  }

  async getLastSyncTime() {
    return await localforage.getItem(DATA_KEYS.LAST_SYNC);
  }

  // Photo operations
  async savePhoto(photoData, saleId) {
    try {
      // Save photo to local storage
      const photoKey = `photo_${saleId}`;
      await localforage.setItem(photoKey, photoData);

      // TODO: Upload to kadaele-services when online
      if (this.isOnline) {
        // Simulate upload
        console.log('Uploading photo for sale:', saleId);
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
        { id: '1', name: 'Rice (1kg)', price: 50, category: 'Grains', stock_quantity: 100 },
        { id: '2', name: 'Sugar (1kg)', price: 80, category: 'Groceries', stock_quantity: 50 },
        { id: '3', name: 'Cooking Oil (1L)', price: 120, category: 'Cooking', stock_quantity: 30 },
        { id: '4', name: 'Bread', price: 30, category: 'Bakery', stock_quantity: 20 },
        { id: '5', name: 'Milk (1L)', price: 60, category: 'Dairy', stock_quantity: 40 },
        { id: '6', name: 'Eggs (12pcs)', price: 90, category: 'Dairy', stock_quantity: 25 },
        { id: '7', name: 'Soap', price: 25, category: 'Personal Care', stock_quantity: 60 },
        { id: '8', name: 'Toothpaste', price: 45, category: 'Personal Care', stock_quantity: 35 },
      ]);
    }
  }

  // Sync all data from Firebase to local storage
  async syncFromFirebase() {
    if (!this.isOnline || !auth.currentUser) {
      console.log('Cannot sync: offline or not authenticated');
      return { success: false, error: 'Offline or not authenticated' };
    }

    try {
      console.log('🔄 Starting Firebase sync...');
      
      // Sync goods
      const goodsSnapshot = await getDocs(collection(db, 'goods'));
      const goods = goodsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      await localforage.setItem(DATA_KEYS.GOODS, goods);
      console.log(`✅ Synced ${goods.length} goods`);
      
      // Sync sales
      const salesSnapshot = await getDocs(collection(db, 'sales'));
      const sales = salesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.() || doc.data().date,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      }));
      await localforage.setItem(DATA_KEYS.SALES, sales);
      console.log(`✅ Synced ${sales.length} sales`);
      
      // Sync debtors
      const debtorsSnapshot = await getDocs(collection(db, 'debtors'));
      const debtors = debtorsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        lastPurchase: doc.data().lastPurchase?.toDate?.() || doc.data().lastPurchase
      }));
      await localforage.setItem(DATA_KEYS.DEBTORS, debtors);
      console.log(`✅ Synced ${debtors.length} debtors`);
      
      return { 
        success: true, 
        synced: {
          goods: goods.length,
          sales: sales.length,
          debtors: debtors.length
        }
      };
    } catch (error) {
      console.error('❌ Firebase sync error:', error);
      return { success: false, error: error.message };
    }
  }

  // Call this to force a fresh goods pull from Firebase (e.g. after login).
  resetGoodsFetchFlag() {
    this._goodsFetchedFromFirebase = false;
  }

  // ── Cash Journal entries ──────────────────────────────────────────────────
  async getCashEntries() {
    try {
      // On first call of session, try to pull from Firebase
      if (this.isOnline && auth.currentUser && !this._cashEntriesFetched) {
        this._cashEntriesFetched = true;
        try {
          const snap = await getDocs(collection(db, 'cash_entries'));
          const fbEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const local = await localforage.getItem(DATA_KEYS.CASH_ENTRIES) || [];
          // Merge: keep local entries not in Firebase (created offline)
          const fbIds = new Set(fbEntries.map(e => e.id));
          const localOnly = local.filter(e => !fbIds.has(e.id));
          const merged = [...fbEntries, ...localOnly]
            .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
          await localforage.setItem(DATA_KEYS.CASH_ENTRIES, merged);
          return merged;
        } catch (err) {
          console.error('Error fetching cash entries from Firebase:', err);
        }
      }
      return await localforage.getItem(DATA_KEYS.CASH_ENTRIES) || [];
    } catch (error) {
      console.error('Error getting cash entries:', error);
      return [];
    }
  }

  async addCashEntry(entry) {
    try {
      const entries = await localforage.getItem(DATA_KEYS.CASH_ENTRIES) || [];
      const newEntry = {
        id: this.generateId(),
        type: entry.type,         // 'in' | 'out'
        amount: parseFloat(entry.amount),
        note: entry.note || '',
        date: entry.date || new Date().toISOString(),
        source: entry.source || 'manual',
        createdAt: new Date().toISOString(),
        ...(entry.saleId      ? { saleId:      entry.saleId      } : {}),
        ...(entry.debtorId    ? { debtorId:    entry.debtorId    } : {}),
        ...(entry.purchaseId  ? { purchaseId:  entry.purchaseId  } : {}),
        ...(entry.invoiceRef  ? { invoiceRef:  entry.invoiceRef  } : {}),
        ...(entry.isUnrecorded ? { isUnrecorded: true }           : {}),
      };
      entries.push(newEntry);
      // Save to localforage first
      await localforage.setItem(DATA_KEYS.CASH_ENTRIES, entries);

      // Sync to Firebase cash_entries collection
      if (this.isOnline && auth.currentUser) {
        try {
          await setDoc(doc(db, 'cash_entries', newEntry.id), {
            ...newEntry,
            createdAt: serverTimestamp(),
          }, { merge: true });
        } catch (err) {
          console.error('Error syncing cash entry to Firebase:', err);
          await this.addToSyncQueue({ type: 'cash_entry', data: newEntry });
        }
      } else {
        await this.addToSyncQueue({ type: 'cash_entry', data: newEntry });
      }

      return newEntry;
    } catch (error) {
      console.error('Error adding cash entry:', error);
      throw error;
    }
  }

  async updateCashEntry(id, updates) {
    const entries = await localforage.getItem(DATA_KEYS.CASH_ENTRIES) || [];
    const index = entries.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Cash entry not found');
    const entry = entries[index];
    const createdAt = new Date(entry.createdAt || entry.date || 0);
    const hoursDiff = (new Date() - createdAt) / (1000 * 60 * 60);
    if (hoursDiff > 2) throw new Error('Cannot edit cash entry after 2 hours');
    entries[index] = { ...entry, ...updates, updatedAt: new Date().toISOString() };
    await localforage.setItem(DATA_KEYS.CASH_ENTRIES, entries);
    if (this.isOnline && auth.currentUser) {
      try {
        await setDoc(doc(db, 'cash_entries', id), { ...entries[index], updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) { await this.addToSyncQueue({ type: 'cash_entry', data: entries[index] }); }
    } else {
      await this.addToSyncQueue({ type: 'cash_entry', data: entries[index] });
    }
    return entries[index];
  }

  async updatePurchase(id, updates) {
    const purchases = await localforage.getItem(DATA_KEYS.PURCHASES) || [];
    const index = purchases.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Purchase not found');
    const purchase = purchases[index];
    const createdAt = new Date(purchase.createdAt || purchase.date || 0);
    const hoursDiff = (new Date() - createdAt) / (1000 * 60 * 60);
    if (hoursDiff > 2) throw new Error('Cannot edit purchase after 2 hours');
    purchases[index] = { ...purchase, ...updates, updatedAt: new Date().toISOString() };
    await localforage.setItem(DATA_KEYS.PURCHASES, purchases);
    if (this.isOnline && auth.currentUser) {
      try {
        await setDoc(doc(db, 'purchases', id), { ...purchases[index], updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) { await this.addToSyncQueue({ type: 'purchase', data: purchases[index] }); }
    } else {
      await this.addToSyncQueue({ type: 'purchase', data: purchases[index] });
    }
    return purchases[index];
  }

  // ── Purchases ─────────────────────────────────────────────────────────────
  async getPurchases() {
    try {
      if (this.isOnline && auth.currentUser && !this._purchasesFetchedFromFirebase) {
        this._purchasesFetchedFromFirebase = true;
        const snap = await getDocs(collection(db, 'purchases'));
        const fbPurchases = snap.docs.map(d => {
          const data = d.data();
          const dateVal = typeof data.date === 'string'
            ? data.date
            : (data.date?.toDate?.()?.toISOString?.() || null);
          return { id: d.id, ...data, date: dateVal,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt };
        });
        const local = await localforage.getItem(DATA_KEYS.PURCHASES) || [];
        const localMap = new Map(local.map(p => [p.id, p]));
        const merged = fbPurchases.map(fb => {
          const loc = localMap.get(fb.id);
          if (!loc) return fb;
          return new Date(loc.createdAt||0) >= new Date(fb.createdAt||0) ? loc : fb;
        });
        for (const loc of local) {
          if (!merged.find(p => p.id === loc.id)) merged.push(loc);
        }
        await localforage.setItem(DATA_KEYS.PURCHASES, merged);
        return merged;
      }
    } catch (err) { console.error('Error fetching purchases:', err); }
    return await localforage.getItem(DATA_KEYS.PURCHASES) || [];
  }

  async addPurchase(purchase) {
    try {
      const purchases = await localforage.getItem(DATA_KEYS.PURCHASES) || [];
      const paymentType = purchase.paymentType || 'cash'; // 'cash' | 'credit'
      const newPurchase = {
        id: this.generateId(),
        supplierName: purchase.supplierName || '',
        supplierId: purchase.supplierId || null,
        creditorId: purchase.creditorId || null,
        date: purchase.date || new Date().toISOString(),
        items: purchase.items || [],
        total: parseFloat(purchase.total) || 0,
        notes: purchase.notes || '',
        invoiceRef: purchase.invoiceRef || '',
        receiptPhoto: purchase.receiptPhoto || null,
        paymentType,
        payment_type: paymentType,
        createdAt: new Date().toISOString(),
      };
      purchases.push(newPurchase);
      await localforage.setItem(DATA_KEYS.PURCHASES, purchases);

      // ── Cash OUT only for cash purchases ──────────────────────────────
      // Credit purchases create a creditor liability, not an immediate cash outflow.
      if (paymentType === 'cash') {
        await this.addCashEntry({
          type: 'out',
          amount: newPurchase.total,
          note: `Paid to ${newPurchase.supplierName || 'Supplier'} to purchase cargo`,
          date: newPurchase.date,
          source: 'purchase',
          purchaseId: newPurchase.id,
          invoiceRef: newPurchase.invoiceRef || '',
          isUnrecorded: true,  // time is not relevant for a purchase date entry
        });
      } else {
        // Credit purchase — create or update Creditor card, then record the debt
        if (newPurchase.creditorId) {
          // Ensure the creditor card exists (create if missing)
          const creditors = await localforage.getItem(DATA_KEYS.CREDITORS) || [];
          const exists = creditors.find(c => c.id === newPurchase.creditorId);
          if (!exists) {
            const suppliers = await localforage.getItem(DATA_KEYS.SUPPLIERS) || [];
            const supplier = suppliers.find(s => s.id === newPurchase.supplierId);
            const stubName = newPurchase.supplierName || (supplier && (supplier.name || supplier.customerName)) || 'Unknown';
            const newCreditor = {
              id: newPurchase.creditorId,
              name: stubName,
              customerName: stubName,
              totalDue: 0,
              totalPaid: 0,
              balance: 0,
              deposits: [],
              purchaseIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            creditors.push(newCreditor);
            await localforage.setItem(DATA_KEYS.CREDITORS, creditors);
            if (this.isOnline && auth.currentUser) {
              await setDoc(doc(db, 'creditors', newCreditor.id.toString()), {
                ...newCreditor, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
              }, { merge: true }).catch(e => console.error('Creditor stub sync error:', e));
            }
          }
          await this.addCreditorDebt(newPurchase.creditorId, newPurchase.total, newPurchase.id);
        }
      }

      // ── Auto-increase stock for purchased items ───────────────────────
      try {
        const goods = await localforage.getItem(DATA_KEYS.GOODS) || [];
        let stockChanged = false;
        newPurchase.items.forEach(purchasedItem => {
          // Match by item ID if set, otherwise by description name
          const good = purchasedItem.goodId
            ? goods.find(g => String(g.id) === String(purchasedItem.goodId))
            : goods.find(g => (g.name||'').toLowerCase().trim() === (purchasedItem.description||'').toLowerCase().trim());
          if (good) {
            // stockToAdd = qty × packUnit (cartons × units per carton)
            // Falls back to just qty if packUnit wasn't set
            const stockToAdd = typeof purchasedItem.stockToAdd === 'number'
              ? purchasedItem.stockToAdd
              : (parseFloat(purchasedItem.qty) || 0) * (parseFloat(purchasedItem.packUnit) || 1);
            if (stockToAdd > 0) {
              good.stock_quantity = (parseFloat(good.stock_quantity) || 0) + stockToAdd;
              stockChanged = true;
            }
          }
        });
        if (stockChanged) {
          await localforage.setItem(DATA_KEYS.GOODS, goods);
          if (this.isOnline && auth.currentUser) {
            const batch = writeBatch(db);
            goods.forEach(g => {
              batch.set(doc(db, 'goods', g.id.toString()), { ...g, updatedAt: serverTimestamp() }, { merge: true });
            });
            await batch.commit().catch(e => console.error('Purchase stock sync error:', e));
          }
        }
      } catch (stockErr) {
        console.error('Error updating stock after purchase:', stockErr);
      }

      // Sync to Firebase purchases collection
      if (this.isOnline && auth.currentUser) {
        try {
          await setDoc(doc(db, 'purchases', newPurchase.id), {
            ...newPurchase,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.error('Error syncing purchase to Firebase:', err);
          await this.addToSyncQueue({ type: 'purchase', data: newPurchase });
        }
      } else {
        await this.addToSyncQueue({ type: 'purchase', data: newPurchase });
      }
      return newPurchase;
    } catch (err) {
      console.error('Error adding purchase:', err);
      throw err;
    }
  }

  // ── Add debt to a creditor when a credit purchase is made ──────────────────
  async addCreditorDebt(creditorId, amount, purchaseId) {
    try {
      const creditors = await localforage.getItem(DATA_KEYS.CREDITORS) || [];
      const creditor = creditors.find(c => c.id === creditorId);
      if (!creditor) return;

      creditor.totalDue   = (creditor.totalDue   || 0) + parseFloat(amount);
      creditor.balance    = creditor.totalDue - (creditor.totalPaid || 0);
      creditor.purchaseIds = creditor.purchaseIds || [];
      if (!creditor.purchaseIds.includes(purchaseId)) creditor.purchaseIds.push(purchaseId);
      creditor.lastPurchase = new Date().toISOString();
      creditor.updatedAt    = creditor.lastPurchase;

      await localforage.setItem(DATA_KEYS.CREDITORS, creditors);

      if (this.isOnline && auth.currentUser) {
        await setDoc(doc(db, 'creditors', creditorId.toString()), {
          ...creditor,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(e => console.error('Creditor debt sync error:', e));
      }
    } catch (err) {
      console.error('Error adding creditor debt:', err);
    }
  }

  // ── Record a payment MADE to a creditor (Cash OUT) ────────────────────────
  async recordCreditorPayment(creditorId, amount, photo = null) {
    try {
      const creditors = await localforage.getItem(DATA_KEYS.CREDITORS) || [];
      const creditor = creditors.find(c => c.id === creditorId);
      if (!creditor) return null;

      const paymentAmount = parseFloat(amount);
      creditor.totalPaid  = (creditor.totalPaid || 0) + paymentAmount;
      creditor.balance    = (creditor.totalDue || 0) - creditor.totalPaid;
      if (creditor.balance <= 0) { creditor.balance = 0; creditor.repaymentDate = ''; }
      creditor.lastPayment = new Date().toISOString();
      creditor.updatedAt   = creditor.lastPayment;

      const depositEntry = {
        id: this.generateId(), type: 'deposit',
        amount: paymentAmount, date: creditor.lastPayment,
        ...(photo ? { photo } : {}),
      };
      creditor.deposits = creditor.deposits || [];
      creditor.deposits.push(depositEntry);

      await localforage.setItem(DATA_KEYS.CREDITORS, creditors);

      // ── Cash OUT — we paid the creditor ───────────────────────────────
      const creditorName = creditor.name || creditor.customerName || 'Creditor';
      const gender = creditor.gender || '';
      const prefix = gender === 'Male' ? 'Mr.' : gender === 'Female' ? 'Ms.' : '';
      const displayName = prefix ? `${prefix} ${creditorName}` : creditorName;
      await this.addCashEntry({
        type: 'out',
        amount: paymentAmount,
        note: `Paid ${displayName} to repay debt`,
        date: creditor.lastPayment,
        source: 'creditor_payment',
        creditorId,
      });

      if (this.isOnline && auth.currentUser) {
        const depositsForFirestore = (creditor.deposits || []).map(dep => {
          const { photo: _p, ...rest } = dep; return rest;
        });
        await setDoc(doc(db, 'creditors', creditorId.toString()), {
          ...creditor, deposits: depositsForFirestore,
          lastPayment: serverTimestamp(), updatedAt: serverTimestamp(),
        }, { merge: true }).catch(e => {
          console.error('Creditor payment sync error:', e);
          this.addToSyncQueue({ type: 'creditor', data: creditor });
        });
      } else {
        await this.addToSyncQueue({ type: 'creditor', data: creditor });
      }

      return creditor;
    } catch (err) {
      console.error('Error recording creditor payment:', err);
      throw err;
    }
  }

  // ── App Settings (stored in localforage for persistence across app restarts) ──
  async getSettings() {
    try {
      const saved = await localforage.getItem(DATA_KEYS.SETTINGS);
      // Defaults
      return {
        lang: 'en',
        darkMode: false,
        currency: '$',
        notifDebtReminder: true,
        notifLowStock: true,
        notifDailySales: true,
        openingBalance: null,  // one-time starting cash on hand
        ...(saved || {}),
      };
    } catch (err) {
      console.error('Error getting settings:', err);
      return { lang: 'en', darkMode: false, currency: '$', notifDebtReminder: true, notifLowStock: true, notifDailySales: true, openingBalance: null };
    }
  }

  // ── Get currency symbol synchronously from localStorage ──────────────────
  getCurrencySymbol() {
    return localStorage.getItem('ks_currency') || '$';
  }

  // ── Set the one-time opening balance ─────────────────────────────────────
  async setOpeningBalance(amount) {
    const settings = await this.getSettings();
    if (settings.openingBalance !== null && settings.openingBalance !== undefined) {
      return false; // already set
    }
    const parsedAmount = parseFloat(amount) || 0;
    await this.saveSettings({ ...settings, openingBalance: parsedAmount });
    if (parsedAmount > 0) {
      await this.addCashEntry({
        type: 'in',
        amount: parsedAmount,
        note: 'Opening Balance (starting cash on hand)',
        date: new Date().toISOString(),
        source: 'opening_balance',
      });
    }
    return true;
  }

  async saveSettings(settings) {
    try {
      await localforage.setItem(DATA_KEYS.SETTINGS, settings);
      // Mirror to localStorage for synchronous reads (dark mode, currency symbol)
      Object.entries(settings).forEach(([k, v]) => {
        localStorage.setItem(`ks_${k}`, String(v));
      });
      return true;
    } catch (err) {
      console.error('Error saving settings:', err);
      return false;
    }
  }

  // Push all local data to Firebase
  async pushToFirebase() {
    if (!this.isOnline || !auth.currentUser) {
      console.log('Cannot push: offline or not authenticated');
      return { success: false, error: 'Offline or not authenticated' };
    }

    try {
      console.log('⬆️ Pushing local data to Firebase...');
      
      // Push goods
      const goods = await localforage.getItem(DATA_KEYS.GOODS) || [];
      const goodsBatch = writeBatch(db);
      goods.forEach(good => {
        const goodRef = doc(db, 'goods', good.id.toString());
        goodsBatch.set(goodRef, {
          ...good,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await goodsBatch.commit();
      console.log(`✅ Pushed ${goods.length} goods`);
      
      // Push sales
      const sales = await localforage.getItem(DATA_KEYS.SALES) || [];
      const salesBatch = writeBatch(db);
      sales.forEach(sale => {
        const saleRef = doc(db, 'sales', sale.id.toString());
        salesBatch.set(saleRef, {
          ...sale,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await salesBatch.commit();
      console.log(`✅ Pushed ${sales.length} sales`);
      
      // Push debtors
      const debtors = await localforage.getItem(DATA_KEYS.DEBTORS) || [];
      const debtorsBatch = writeBatch(db);
      debtors.forEach(debtor => {
        const debtorRef = doc(db, 'debtors', debtor.id.toString());
        debtorsBatch.set(debtorRef, {
          ...debtor,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await debtorsBatch.commit();
      console.log(`✅ Pushed ${debtors.length} debtors`);
      
      return { 
        success: true, 
        pushed: {
          goods: goods.length,
          sales: sales.length,
          debtors: debtors.length
        }
      };
    } catch (error) {
      console.error('❌ Firebase push error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new DataService();
