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
  INVENTORY: 'inventory',
  CASH_ENTRIES: 'cash_entries',
  SYNC_QUEUE: 'sync_queue',
  LAST_SYNC: 'last_sync',
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
    this._goodsFetchedFromFirebase = false;
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncToServer();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Authentication methods
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      this.currentUser = userCredential.user;
      // Reset so the next getDebtors() call pulls a fresh copy from Firebase
      this._debtorsFetchedFromFirebase = false;
    this._goodsFetchedFromFirebase = false;
      
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
                      key === DATA_KEYS.DEBTORS || key === DATA_KEYS.INVENTORY ? [] : null);
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return key === DATA_KEYS.GOODS || key === DATA_KEYS.SALES || 
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
    if (this.isOnline && auth.currentUser) {
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
      // Try to get from Firebase first if online
      if (this.isOnline && auth.currentUser) {
        const salesSnapshot = await getDocs(collection(db, 'sales'));
        const firebaseSales = salesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate?.() || doc.data().date,
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
        }));
        
        // Save to local storage
        await localforage.setItem(DATA_KEYS.SALES, firebaseSales);
        return firebaseSales;
      }
    } catch (error) {
      console.error('Error fetching sales from Firebase:', error);
    }
    
    // Fallback to local storage
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
    };
    
    sales.push(newSale);
    await this.setSales(sales);
    
    // ── Auto-record cash sales in the Cash Journal ────────────────────────
    // Every cash sale is also a Cash IN entry so the Cash Journal stays in sync.
    if (newSale.paymentType === 'cash') {
      await this.addCashEntry({
        type: 'in',
        amount: newSale.total,
        note: 'CASH Sale',
        date: saleDate.toISOString(),
        source: 'sale',
        saleId: newSale.id,  // link back to the originating sale
      });
    }

    // Sync to Firebase 'sales' collection
    if (this.isOnline && auth.currentUser) {
      try {
        await setDoc(doc(db, 'sales', newSale.id), {
          ...newSale,
          createdAt: serverTimestamp(),
          date: serverTimestamp()
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
      
      if (hoursDiff > 24 && !updates.allowAfter24Hours) {
        throw new Error('Cannot edit sale after 24 hours');
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
    this._goodsFetchedFromFirebase = false;
  }

  async setDebtors(debtors) {
    // Save locally first — full data including any receipt photos
    await localforage.setItem(DATA_KEYS.DEBTORS, debtors);
    
    // Sync to Firebase if online
    if (this.isOnline && auth.currentUser) {
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
    const debtors = await this.getDebtors();
    const debtor = debtors.find(d => d.id === debtorId);
    
    if (debtor) {
      const paymentAmount = parseFloat(amount);
      debtor.totalPaid = (debtor.totalPaid || 0) + paymentAmount;
      debtor.balance = (debtor.totalDue || 0) - debtor.totalPaid;
      debtor.lastPayment = new Date().toISOString();

      // Record the deposit as a line item in the debtor's history
      // so the Debt History table can render it as a special deposit row.
      const depositEntry = {
        id: this.generateId(),
        type: 'deposit',
        amount: paymentAmount,
        date: debtor.lastPayment,
        ...(photo ? { photo } : {}),
      };
      debtor.deposits = debtor.deposits || [];
      debtor.deposits.push(depositEntry);

      // Wire to Cash Journal — deposit counts as Cash IN
      const debtorName = debtor.name || debtor.customerName || 'Unknown';
      const gender = debtor.gender || '';
      const prefix = gender === 'Male' ? 'Mr.' : gender === 'Female' ? 'Ms.' : '';
      const displayName = prefix ? `${prefix} ${debtorName}` : debtorName;
      await this.addCashEntry({
        type: 'in',
        amount: paymentAmount,
        note: `Debt repayment by ${displayName}`,
        date: debtor.lastPayment,
        source: 'deposit',
        debtorId,
      });
      
      // Mark specific sales as paid if provided
      if (purchaseIds.length > 0) {
        const sales = await this.getSales();
        purchaseIds.forEach(pid => {
          const sale = sales.find(s => s.id === pid);
          if (sale) {
            sale.paid = true;
            sale.paidDate = debtor.lastPayment;
          }
        });
        await this.setSales(sales);
      }
      
      await this.setDebtors(debtors);
      
      // Sync to Firebase
      if (this.isOnline && auth.currentUser) {
        try {
          await updateDoc(doc(db, 'debtors', debtorId.toString()), {
            totalPaid: debtor.totalPaid,
            balance: debtor.balance,
            lastPayment: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.error('Error syncing payment to Firebase:', error);
        }
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
    if (this.isOnline && auth.currentUser) {
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
      return await localforage.getItem(DATA_KEYS.CASH_ENTRIES) || [];
    } catch (error) {
      console.error('Error getting cash entries:', error);
      return [];
    }
  }

  async addCashEntry(entry) {
    try {
      const entries = await this.getCashEntries();
      const newEntry = {
        id: this.generateId(),
        type: entry.type,         // 'in' | 'out'
        amount: parseFloat(entry.amount),
        note: entry.note || '',
        date: entry.date || new Date().toISOString(),
        source: entry.source || 'manual',
        createdAt: new Date().toISOString(),
      };
      entries.push(newEntry);
      await localforage.setItem(DATA_KEYS.CASH_ENTRIES, entries);
      return newEntry;
    } catch (error) {
      console.error('Error adding cash entry:', error);
      throw error;
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
