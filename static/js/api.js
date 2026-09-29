/**
 * api.js - RESTful API Client for Nexus Luxe E-Commerce
 */

const API = {
  baseUrl: '/api',

  // Get auth headers
  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('nexus_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const sessionId = localStorage.getItem('nexus_session_id');
    if (sessionId) {
      headers['X-Session-ID'] = sessionId;
    }
    return headers;
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    options.headers = { ...this.getHeaders(), ...options.headers };

    try {
      const response = await fetch(url, options);
      const data = await response.json().catch(() => ({}));
      
      // Save session id if provided in response
      if (data.session_id) {
        localStorage.setItem('nexus_session_id', data.session_id);
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth Endpoints
  async register(name, email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
  },

  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async updateProfile(profileData) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  },

  // Categories & Products
  async getCategories() {
    return this.request('/categories');
  },

  async getProducts(params = {}) {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    if (params.min_price != null) query.append('min_price', params.min_price);
    if (params.max_price != null) query.append('max_price', params.max_price);
    if (params.in_stock) query.append('in_stock', '1');
    if (params.sort) query.append('sort', params.sort);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    const qs = query.toString();
    return this.request(`/products${qs ? '?' + qs : ''}`);
  },

  async getProduct(id) {
    return this.request(`/products/${id}`);
  },

  // Product Management (Admin)
  async createProduct(productData) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  },

  async updateProduct(id, productData) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
  },

  async updateStock(id, stock) {
    return this.request(`/products/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stock })
    });
  },

  async deleteProduct(id) {
    return this.request(`/products/${id}`, {
      method: 'DELETE'
    });
  },

  // Cart API
  async getCart() {
    return this.request('/cart');
  },

  async addToCart(productId, quantity = 1) {
    return this.request('/cart/add', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity })
    });
  },

  async updateCartItem(itemId, quantity) {
    return this.request(`/cart/item/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity })
    });
  },

  async removeCartItem(itemId) {
    return this.request(`/cart/item/${itemId}`, {
      method: 'DELETE'
    });
  },

  async clearCart() {
    return this.request('/cart/clear', {
      method: 'DELETE'
    });
  },

  async applyCoupon(code, subtotal) {
    return this.request('/cart/apply-coupon', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal })
    });
  },

  // Orders API
  async checkout(orderData) {
    return this.request('/orders/checkout', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  async getOrders(orderNumber = '', email = '') {
    const query = new URLSearchParams();
    if (orderNumber) query.append('order_number', orderNumber);
    if (email) query.append('email', email);
    const qs = query.toString();
    return this.request(`/orders${qs ? '?' + qs : ''}`);
  },

  async getOrderDetails(orderId) {
    return this.request(`/orders/${orderId}`);
  },

  async updateOrderStatus(orderId, status) {
    return this.request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  // Admin Analytics
  async getAdminStats() {
    return this.request('/admin/stats');
  }
};
