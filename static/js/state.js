/**
 * state.js - Central State Management & Reactive Event Dispatcher
 */

const State = {
  // User Authentication State
  user: null,
  token: localStorage.getItem('nexus_token') || null,

  // Store Catalog State
  categories: [],
  selectedCategory: '',
  searchQuery: '',
  maxPrice: 1000,
  minRating: 0,
  inStockOnly: false,
  sortOrder: 'featured',
  viewMode: 'grid', // 'grid' | 'list'
  
  // Shopping Cart State
  cart: {
    items: [],
    count: 0,
    subtotal: 0.0,
    discount: 0.0,
    couponCode: '',
    shipping: 0.0,
    tax: 0.0,
    total: 0.0,
    free_shipping_threshold: 99.0,
    amount_for_free_shipping: 99.0
  },

  // Active View: 'catalog' | 'admin' | 'orders'
  currentView: 'catalog',

  // Listeners
  listeners: {},

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error(`Error in listener for ${event}:`, e); }
      });
    }
  },

  setUser(user, token = null) {
    this.user = user;
    if (token) {
      this.token = token;
      localStorage.setItem('nexus_token', token);
    } else if (user === null) {
      this.token = null;
      localStorage.removeItem('nexus_token');
    }
    this.emit('userChanged', this.user);
  },

  setCart(cartData) {
    // Preserve coupon discount if valid
    const couponCode = this.cart.couponCode;
    const discount = this.cart.discount;

    this.cart = {
      ...this.cart,
      ...cartData,
      couponCode: couponCode,
      discount: discount
    };

    // Recompute total with coupon discount if active
    if (this.cart.discount > 0) {
      const discountedSubtotal = Math.max(0, this.cart.subtotal - this.cart.discount);
      const tax = Math.round(discountedSubtotal * 0.08 * 100) / 100;
      this.cart.tax = tax;
      this.cart.total = Math.round((discountedSubtotal + this.cart.shipping + tax) * 100) / 100;
    }

    this.emit('cartChanged', this.cart);
  },

  applyDiscount(code, discountAmount) {
    this.cart.couponCode = code;
    this.cart.discount = discountAmount;
    const discountedSubtotal = Math.max(0, this.cart.subtotal - discountAmount);
    this.cart.tax = Math.round(discountedSubtotal * 0.08 * 100) / 100;
    this.cart.total = Math.round((discountedSubtotal + this.cart.shipping + this.cart.tax) * 100) / 100;
    this.emit('cartChanged', this.cart);
  },

  removeDiscount() {
    this.cart.couponCode = '';
    this.cart.discount = 0.0;
    const tax = Math.round(this.cart.subtotal * 0.08 * 100) / 100;
    this.cart.tax = tax;
    this.cart.total = Math.round((this.cart.subtotal + this.cart.shipping + tax) * 100) / 100;
    this.emit('cartChanged', this.cart);
  },

  setView(viewName) {
    this.currentView = viewName;
    this.emit('viewChanged', viewName);
  }
};
