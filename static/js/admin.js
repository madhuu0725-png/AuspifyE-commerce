/**
 * admin.js - Product Management APIs, Inventory Control, and Order Fulfillment (Step 2)
 */

const Admin = {
  currentTab: 'products', // 'products' | 'orders'
  editingProductId: null,
  cachedProducts: [],
  cachedOrders: [],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Admin Sub Tabs
    const tabProducts = document.getElementById('adminTabProducts');
    const tabOrders = document.getElementById('adminTabOrders');
    const paneProducts = document.getElementById('adminProductsPane');
    const paneOrders = document.getElementById('adminOrdersPane');

    if (tabProducts && tabOrders) {
      tabProducts.addEventListener('click', () => {
        tabProducts.classList.add('active');
        tabOrders.classList.remove('active');
        paneProducts.style.display = 'block';
        paneOrders.style.display = 'none';
        this.currentTab = 'products';
      });

      tabOrders.addEventListener('click', () => {
        tabOrders.classList.add('active');
        tabProducts.classList.remove('active');
        paneOrders.style.display = 'block';
        paneProducts.style.display = 'none';
        this.currentTab = 'orders';
        this.loadOrders();
      });
    }

    // Refresh Button
    const refreshBtn = document.getElementById('refreshAdminBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadStats();
        this.loadProducts();
        if (this.currentTab === 'orders') this.loadOrders();
        showToast('Console synced with database', 'info');
      });
    }

    // Add Product Modal
    const openAddBtn = document.getElementById('openAddProductModalBtn');
    const prodModal = document.getElementById('productModal');
    const closeProdModalBtn = document.getElementById('closeProductModalBtn');
    const cancelProdModalBtn = document.getElementById('cancelProductModalBtn');
    const prodForm = document.getElementById('productForm');

    if (openAddBtn) {
      openAddBtn.addEventListener('click', () => this.openProductModal());
    }
    if (closeProdModalBtn) {
      closeProdModalBtn.addEventListener('click', () => prodModal.classList.remove('active'));
    }
    if (cancelProdModalBtn) {
      cancelProdModalBtn.addEventListener('click', () => prodModal.classList.remove('active'));
    }
    if (prodModal) {
      prodModal.addEventListener('click', (e) => {
        if (e.target === prodModal) prodModal.classList.remove('active');
      });
    }

    // Save Product Submit
    if (prodForm) {
      prodForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveProduct();
      });
    }

    // Admin Product Search & Filter
    const searchInput = document.getElementById('adminProductSearch');
    const catSelect = document.getElementById('adminCategoryFilter');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterProductsTable());
    }
    if (catSelect) {
      catSelect.addEventListener('change', () => this.filterProductsTable());
    }

    // Admin Orders Search & Status Filter
    const orderSearch = document.getElementById('adminOrderSearch');
    const orderStatusFilter = document.getElementById('adminOrderStatusFilter');
    if (orderSearch) {
      orderSearch.addEventListener('input', () => this.filterOrdersTable());
    }
    if (orderStatusFilter) {
      orderStatusFilter.addEventListener('change', () => this.filterOrdersTable());
    }
  },

  async loadStats() {
    // If not admin, authenticate as admin demo automatically
    if (!State.user || State.user.role !== 'admin') {
      try {
        await Auth.handleLogin('admin@nexusluxe.com', 'Admin@123');
      } catch (e) {}
    }

    try {
      const stats = await API.getAdminStats();
      const revElem = document.getElementById('kpiRevenue');
      const ordElem = document.getElementById('kpiOrders');
      const prodElem = document.getElementById('kpiProducts');
      const lowStockElem = document.getElementById('kpiLowStock');

      if (revElem) revElem.textContent = `$${stats.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      if (ordElem) ordElem.textContent = stats.total_orders;
      if (prodElem) prodElem.textContent = stats.total_products;
      if (lowStockElem) lowStockElem.textContent = stats.low_stock_count;
    } catch (err) {
      console.warn('Could not load admin stats (requires admin login):', err);
    }

    await this.populateCategoryDropdown();
    await this.loadProducts();
    await this.loadOrders();
  },

  async populateCategoryDropdown() {
    const prodCategory = document.getElementById('prodCategory');
    const adminCategoryFilter = document.getElementById('adminCategoryFilter');

    if (!State.categories || State.categories.length === 0) {
      State.categories = await API.getCategories();
    }

    if (prodCategory) {
      prodCategory.innerHTML = State.categories.map(c => `
        <option value="${c.id}">${c.name}</option>
      `).join('');
    }

    if (adminCategoryFilter) {
      adminCategoryFilter.innerHTML = `
        <option value="">All Categories</option>
        ${State.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      `;
    }
  },

  async loadProducts() {
    const tbody = document.getElementById('adminProductsTableBody');
    if (!tbody) return;

    try {
      const data = await API.getProducts({ limit: 100 });
      this.cachedProducts = data.products || [];
      this.filterProductsTable();
    } catch (err) {
      console.error('Failed to load admin products:', err);
    }
  },

  filterProductsTable() {
    const tbody = document.getElementById('adminProductsTableBody');
    const searchVal = (document.getElementById('adminProductSearch')?.value || '').toLowerCase();
    const catVal = document.getElementById('adminCategoryFilter')?.value || '';

    let filtered = this.cachedProducts.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(searchVal) || String(p.id).includes(searchVal);
      const matchCat = !catVal || String(p.category_id) === catVal;
      return matchSearch && matchCat;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:2rem; color:var(--text-dim);">No products match filter</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => `
      <tr data-id="${p.id}">
        <td>
          <div class="table-prod-info">
            <img src="${p.image_url}" alt="${p.title}" class="table-prod-thumb" onerror="this.src='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'">
            <div>
              <div class="table-prod-title">${p.title}</div>
              <div class="table-prod-slug">ID: #${p.id} &bull; ${p.slug}</div>
            </div>
          </div>
        </td>
        <td><span class="badge">${p.category_name}</span></td>
        <td><strong>$${p.price.toFixed(2)}</strong></td>
        <td>
          <div class="stock-input-stepper">
            <button class="stock-stepper-btn" onclick="Admin.adjustStock(${p.id}, ${p.stock - 1})">-</button>
            <input type="number" value="${p.stock}" min="0" onchange="Admin.adjustStock(${p.id}, this.value)">
            <button class="stock-stepper-btn" onclick="Admin.adjustStock(${p.id}, ${p.stock + 1})">+</button>
          </div>
          ${p.stock <= 5 ? '<span class="text-amber" style="font-size:0.75rem; margin-left:0.5rem;">Low Stock</span>' : ''}
        </td>
        <td>★ ${p.rating ? p.rating.toFixed(1) : '5.0'} (${p.review_count || 1})</td>
        <td>${p.featured ? '<span class="text-success">Yes</span>' : '<span class="text-dim">No</span>'}</td>
        <td class="text-right">
          <div class="table-actions">
            <button class="btn btn-sm btn-outline" onclick="Admin.editProduct(${p.id})">Edit</button>
            <button class="btn btn-sm btn-outline text-danger" onclick="Admin.deleteProduct(${p.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  async adjustStock(productId, newStock) {
    newStock = parseInt(newStock, 10);
    if (isNaN(newStock) || newStock < 0) return;

    try {
      await API.updateStock(productId, newStock);
      // Update locally
      const prod = this.cachedProducts.find(p => p.id === productId);
      if (prod) prod.stock = newStock;
      this.filterProductsTable();
      showToast(`Stock updated to ${newStock}`, 'success');
      Catalog.loadProducts(); // Sync catalog
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  openProductModal(product = null) {
    this.editingProductId = product ? product.id : null;
    const modal = document.getElementById('productModal');
    const titleElem = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');

    if (product) {
      titleElem.textContent = `Edit Product: ${product.title}`;
      document.getElementById('adminProductId').value = product.id;
      document.getElementById('prodTitle').value = product.title;
      document.getElementById('prodCategory').value = product.category_id;
      document.getElementById('prodPrice').value = product.price;
      document.getElementById('prodOrigPrice').value = product.original_price || product.price;
      document.getElementById('prodStock').value = product.stock;
      document.getElementById('prodFeatured').value = product.featured ? '1' : '0';
      document.getElementById('prodImageUrl').value = product.image_url;
      document.getElementById('prodDescription').value = product.description;
      document.getElementById('prodTags').value = Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || '');
    } else {
      titleElem.textContent = 'Add New Product';
      form.reset();
      document.getElementById('adminProductId').value = '';
      document.getElementById('prodFeatured').value = '0';
    }

    modal.classList.add('active');
  },

  async editProduct(productId) {
    try {
      const product = await API.getProduct(productId);
      this.openProductModal(product);
    } catch (err) {
      showToast('Could not load product details', 'error');
    }
  },

  async handleSaveProduct() {
    const isEdit = !!this.editingProductId;
    const payload = {
      title: document.getElementById('prodTitle').value.trim(),
      category_id: parseInt(document.getElementById('prodCategory').value, 10),
      price: parseFloat(document.getElementById('prodPrice').value),
      original_price: parseFloat(document.getElementById('prodOrigPrice').value) || parseFloat(document.getElementById('prodPrice').value),
      stock: parseInt(document.getElementById('prodStock').value, 10),
      featured: parseInt(document.getElementById('prodFeatured').value, 10),
      image_url: document.getElementById('prodImageUrl').value.trim(),
      description: document.getElementById('prodDescription').value.trim(),
      tags: document.getElementById('prodTags').value.split(',').map(t => t.trim()).filter(Boolean)
    };

    try {
      if (isEdit) {
        await API.updateProduct(this.editingProductId, payload);
        showToast('Product updated successfully!', 'success');
      } else {
        await API.createProduct(payload);
        showToast('New product added to catalog!', 'success');
      }

      document.getElementById('productModal').classList.remove('active');
      await this.loadProducts();
      await Catalog.loadProducts();
      this.loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteProduct(productId) {
    if (!confirm(`Are you sure you want to remove product #${productId}? This cannot be undone.`)) {
      return;
    }

    try {
      await API.deleteProduct(productId);
      showToast(`Product #${productId} deleted`, 'info');
      await this.loadProducts();
      await Catalog.loadProducts();
      this.loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // Admin Orders Fulfillment
  async loadOrders() {
    const tbody = document.getElementById('adminOrdersTableBody');
    if (!tbody) return;

    try {
      const res = await API.getOrders();
      this.cachedOrders = res.orders || [];
      this.filterOrdersTable();
    } catch (err) {
      console.error('Failed to load admin orders:', err);
    }
  },

  filterOrdersTable() {
    const tbody = document.getElementById('adminOrdersTableBody');
    const searchVal = (document.getElementById('adminOrderSearch')?.value || '').toLowerCase();
    const statusVal = document.getElementById('adminOrderStatusFilter')?.value || '';

    let filtered = this.cachedOrders.filter(o => {
      const matchSearch = o.order_number.toLowerCase().includes(searchVal) ||
                          o.customer_name.toLowerCase().includes(searchVal) ||
                          o.customer_email.toLowerCase().includes(searchVal);
      const matchStatus = !statusVal || o.status === statusVal;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:2rem; color:var(--text-dim);">No orders found</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(o => {
      const dateStr = new Date(o.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      return `
        <tr>
          <td><strong class="highlight-code">${o.order_number}</strong></td>
          <td>
            <div><strong>${o.customer_name}</strong></div>
            <div style="font-size:0.75rem; color:var(--text-dim);">${o.customer_email}</div>
          </td>
          <td>${dateStr}</td>
          <td><strong>$${o.total_amount.toFixed(2)}</strong></td>
          <td><span style="text-transform:uppercase; font-size:0.75rem;">${o.payment_method}</span></td>
          <td><span class="status-badge status-${o.status.toLowerCase()}">${o.status}</span></td>
          <td class="text-right">
            <select class="sort-select" style="font-size:0.8rem; padding:0.3rem 0.6rem;" onchange="Admin.updateOrderStatus(${o.id}, this.value)">
              <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
        </tr>
      `;
    }).join('');
  },

  async updateOrderStatus(orderId, newStatus) {
    try {
      await API.updateOrderStatus(orderId, newStatus);
      showToast(`Order #${orderId} marked as ${newStatus}`, 'success');
      const order = this.cachedOrders.find(o => o.id === orderId);
      if (order) order.status = newStatus;
      this.filterOrdersTable();
      if (typeof Auth !== 'undefined') Auth.loadMyOrders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};
