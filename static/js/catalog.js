/**
 * catalog.js - Product Listing, Filtering, Search, and Quick View (Step 1)
 */

const Catalog = {
  activeQuickProduct: null,
  quickViewQty: 1,

  async init() {
    this.bindEvents();
    await this.loadCategories();
    await this.loadProducts();
  },

  bindEvents() {
    // Price Range Slider
    const priceSlider = document.getElementById('priceRangeInput');
    const priceDisplay = document.getElementById('priceDisplay');
    if (priceSlider) {
      priceSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        State.maxPrice = val;
        priceDisplay.textContent = `$${val.toLocaleString()}`;
        this.debounceLoadProducts();
      });
    }

    // In Stock Only Checkbox
    const inStockBox = document.getElementById('inStockOnlyCheckbox');
    if (inStockBox) {
      inStockBox.addEventListener('change', (e) => {
        State.inStockOnly = e.target.checked;
        this.loadProducts();
      });
    }

    // Customer Ratings Radio Filter
    document.querySelectorAll('input[name="ratingFilter"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        State.minRating = parseFloat(e.target.value);
        this.loadProducts();
      });
    });

    // Sort Dropdown
    const sortSelect = document.getElementById('catalogSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        State.sortOrder = e.target.value;
        this.loadProducts();
      });
    }

    // View Mode Toggle (Grid vs List)
    const gridBtn = document.getElementById('viewGridBtn');
    const listBtn = document.getElementById('viewListBtn');
    const productGrid = document.getElementById('productGrid');
    if (gridBtn && listBtn && productGrid) {
      gridBtn.addEventListener('click', () => {
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        productGrid.classList.remove('list-view');
        State.viewMode = 'grid';
      });
      listBtn.addEventListener('click', () => {
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        productGrid.classList.add('list-view');
        State.viewMode = 'list';
      });
    }

    // Reset Filters Buttons
    const resetBtn = document.getElementById('resetFiltersBtn');
    const emptyResetBtn = document.getElementById('emptyResetBtn');
    [resetBtn, emptyResetBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => this.resetFilters());
      }
    });

    // Quick View Modal Handlers
    const closeQvBtn = document.getElementById('closeQuickViewBtn');
    const qvModal = document.getElementById('quickViewModal');
    if (closeQvBtn && qvModal) {
      closeQvBtn.addEventListener('click', () => qvModal.classList.remove('active'));
      qvModal.addEventListener('click', (e) => {
        if (e.target === qvModal) qvModal.classList.remove('active');
      });
    }

    // Quick View Stepper
    const qvMinus = document.getElementById('qvQtyMinus');
    const qvPlus = document.getElementById('qvQtyPlus');
    const qvQtyVal = document.getElementById('qvQtyVal');
    if (qvMinus && qvPlus && qvQtyVal) {
      qvMinus.addEventListener('click', () => {
        if (this.quickViewQty > 1) {
          this.quickViewQty--;
          qvQtyVal.textContent = this.quickViewQty;
        }
      });
      qvPlus.addEventListener('click', () => {
        if (this.activeQuickProduct && this.quickViewQty < this.activeQuickProduct.stock) {
          this.quickViewQty++;
          qvQtyVal.textContent = this.quickViewQty;
        } else {
          showToast('Reached maximum available stock', 'info');
        }
      });
    }

    // Quick View Add to Cart
    const qvAddToCartBtn = document.getElementById('qvAddToCartBtn');
    if (qvAddToCartBtn) {
      qvAddToCartBtn.addEventListener('click', async () => {
        if (!this.activeQuickProduct) return;
        await Cart.addItem(this.activeQuickProduct.id, this.quickViewQty);
        document.getElementById('quickViewModal').classList.remove('active');
      });
    }
  },

  async loadCategories() {
    try {
      const categories = await API.getCategories();
      State.categories = categories;

      // Render Category Pills Bar
      const pillsContainer = document.getElementById('categoryPillsContainer');
      const sideCatList = document.getElementById('categoryFilterList');

      if (pillsContainer) {
        const totalProducts = categories.reduce((sum, c) => sum + (c.product_count || 0), 0);
        let pillsHtml = `
          <button class="cat-pill ${State.selectedCategory === '' ? 'active' : ''}" data-slug="" onclick="Catalog.selectCategory('')">
            <span class="cat-pill-icon">✨</span>
            <span>All Products</span>
            <span class="cat-pill-count">${totalProducts}</span>
          </button>
        `;

        const iconMap = {
          'audio-sound': '🎧',
          'smart-electronics': '⚡',
          'computer-desk': '🖥️',
          'designer-apparel': '🎒',
          'living-decor': '✨'
        };

        categories.forEach(cat => {
          const icon = iconMap[cat.slug] || '💎';
          pillsHtml += `
            <button class="cat-pill ${State.selectedCategory === cat.slug ? 'active' : ''}" data-slug="${cat.slug}" onclick="Catalog.selectCategory('${cat.slug}')">
              <span class="cat-pill-icon">${icon}</span>
              <span>${cat.name}</span>
              <span class="cat-pill-count">${cat.product_count}</span>
            </button>
          `;
        });
        pillsContainer.innerHTML = pillsHtml;
      }

      // Render Sidebar Category Filter Radio Options
      if (sideCatList) {
        let sideHtml = `
          <div class="cat-filter-option ${State.selectedCategory === '' ? 'active' : ''}" onclick="Catalog.selectCategory('')">
            <span>All Collections</span>
            <span class="cat-pill-count">${categories.reduce((s, c) => s + c.product_count, 0)}</span>
          </div>
        `;
        categories.forEach(cat => {
          sideHtml += `
            <div class="cat-filter-option ${State.selectedCategory === cat.slug ? 'active' : ''}" onclick="Catalog.selectCategory('${cat.slug}')">
              <span>${cat.name}</span>
              <span class="cat-pill-count">${cat.product_count}</span>
            </div>
          `;
        });
        sideCatList.innerHTML = sideHtml;
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  },

  selectCategory(slug) {
    State.selectedCategory = slug;
    
    // Update active states
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-slug') === slug);
    });
    document.querySelectorAll('.cat-filter-option').forEach(opt => {
      const match = (slug === '' && opt.textContent.includes('All Collections')) ||
                    opt.textContent.includes(slug);
      opt.classList.toggle('active', match);
    });

    this.loadProducts();
  },

  debounceTimer: null,
  debounceLoadProducts() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.loadProducts(), 250);
  },

  async loadProducts() {
    const grid = document.getElementById('productGrid');
    const emptyState = document.getElementById('catalogEmptyState');
    const resultCount = document.getElementById('currentShownCount');

    try {
      const data = await API.getProducts({
        category: State.selectedCategory,
        search: State.searchQuery,
        max_price: State.maxPrice,
        in_stock: State.inStockOnly ? 1 : null,
        sort: State.sortOrder
      });

      let products = data.products || [];

      // Filter by min rating client-side if selected
      if (State.minRating > 0) {
        products = products.filter(p => (p.rating || 0) >= State.minRating);
      }

      if (resultCount) {
        resultCount.textContent = products.length;
      }

      if (products.length === 0) {
        grid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      grid.innerHTML = products.map(product => this.renderProductCard(product)).join('');

    } catch (err) {
      console.error('Failed to load products:', err);
      grid.innerHTML = `
        <div class="empty-state">
          <p class="text-danger">Unable to load catalog products. Please check the backend server.</p>
        </div>
      `;
    }
  },

  renderProductCard(product) {
    const hasDiscount = product.original_price && product.original_price > product.price;
    const discountPercent = hasDiscount ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : 0;
    
    let stockClass = 'stock-in';
    let stockText = 'In Stock';
    if (product.stock === 0) {
      stockClass = 'stock-out';
      stockText = 'Out of Stock';
    } else if (product.stock <= 5) {
      stockClass = 'stock-low';
      stockText = `Only ${product.stock} left`;
    }

    const fallbackImg = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80";

    return `
      <article class="product-card" data-id="${product.id}">
        <div class="card-media">
          <img src="${product.image_url || fallbackImg}" 
               alt="${product.title}" 
               class="card-img" 
               loading="lazy"
               onerror="this.src='${fallbackImg}'">
          
          <div class="card-badges">
            ${hasDiscount ? `<span class="badge-discount">-${discountPercent}%</span>` : ''}
            ${product.featured ? `<span class="badge-featured">Featured</span>` : ''}
          </div>

          <div class="card-quick-actions">
            <button class="card-quick-btn" onclick="Catalog.openQuickView(${product.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Quick View
            </button>
          </div>
        </div>

        <div class="card-body">
          <div class="card-meta-top">
            <span class="card-category">${product.category_name || 'Curated'}</span>
            <div class="card-rating">
              <span>★</span>
              <span>${product.rating ? product.rating.toFixed(1) : '5.0'}</span>
              <span class="card-reviews-count">(${product.review_count || 1})</span>
            </div>
          </div>

          <h3 class="card-title" title="${product.title}">${product.title}</h3>
          <p class="card-desc">${product.description || ''}</p>

          <div class="card-stock-pill ${stockClass}">
            <span class="stock-dot"></span>
            <span>${stockText}</span>
          </div>

          <div class="card-footer">
            <div class="card-price-block">
              <span class="card-price">$${product.price.toFixed(2)}</span>
              ${hasDiscount ? `<span class="card-original-price">$${product.original_price.toFixed(2)}</span>` : ''}
            </div>

            <button class="add-cart-btn" 
                    ${product.stock === 0 ? 'disabled' : ''} 
                    onclick="Cart.addItem(${product.id}, 1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              <span>${product.stock === 0 ? 'Sold Out' : 'Add to Cart'}</span>
            </button>
          </div>
        </div>
      </article>
    `;
  },

  async openQuickView(productId) {
    try {
      const product = await API.getProduct(productId);
      this.activeQuickProduct = product;
      this.quickViewQty = 1;

      const modal = document.getElementById('quickViewModal');
      document.getElementById('qvImage').src = product.image_url;
      document.getElementById('qvCategory').textContent = product.category_name;
      document.getElementById('qvTitle').textContent = product.title;
      document.getElementById('qvRatingScore').textContent = product.rating ? product.rating.toFixed(1) : '5.0';
      document.getElementById('qvReviews').textContent = `(${product.review_count || 1} verified reviews)`;
      document.getElementById('qvPrice').textContent = `$${product.price.toFixed(2)}`;
      
      const origPriceElem = document.getElementById('qvOrigPrice');
      const saveBadge = document.getElementById('qvSaveBadge');
      if (product.original_price && product.original_price > product.price) {
        origPriceElem.textContent = `$${product.original_price.toFixed(2)}`;
        origPriceElem.style.display = 'inline';
        const saved = product.original_price - product.price;
        saveBadge.textContent = `Save $${saved.toFixed(2)}`;
        saveBadge.style.display = 'inline-block';
      } else {
        origPriceElem.style.display = 'none';
        saveBadge.style.display = 'none';
      }

      document.getElementById('qvDesc').textContent = product.description;
      document.getElementById('qvQtyVal').textContent = '1';

      // Stock
      const stockText = document.getElementById('qvStockText');
      if (product.stock === 0) {
        stockText.textContent = 'Out of Stock';
        stockText.className = 'text-danger';
        document.getElementById('qvAddToCartBtn').disabled = true;
      } else if (product.stock <= 5) {
        stockText.textContent = `Low Stock: Only ${product.stock} units remaining!`;
        stockText.className = 'text-amber';
        document.getElementById('qvAddToCartBtn').disabled = false;
      } else {
        stockText.textContent = `In Stock (${product.stock} units available)`;
        stockText.className = 'text-success';
        document.getElementById('qvAddToCartBtn').disabled = false;
      }

      // Specs
      const specsGrid = document.getElementById('qvSpecsGrid');
      const specs = product.specs || {};
      const specKeys = Object.keys(specs);
      if (specKeys.length > 0) {
        specsGrid.innerHTML = specKeys.map(k => `
          <div class="spec-item">
            <div class="spec-key">${k}</div>
            <div class="spec-val">${specs[k]}</div>
          </div>
        `).join('');
        document.querySelector('.qv-specs-container').style.display = 'block';
      } else {
        document.querySelector('.qv-specs-container').style.display = 'none';
      }

      modal.classList.add('active');
    } catch (err) {
      showToast('Could not load product details', 'error');
    }
  },

  resetFilters() {
    State.selectedCategory = '';
    State.searchQuery = '';
    State.maxPrice = 1000;
    State.minRating = 0;
    State.inStockOnly = false;

    // Reset controls UI
    const priceSlider = document.getElementById('priceRangeInput');
    if (priceSlider) priceSlider.value = '1000';
    const priceDisplay = document.getElementById('priceDisplay');
    if (priceDisplay) priceDisplay.textContent = '$1,000';

    const inStock = document.getElementById('inStockOnlyCheckbox');
    if (inStock) inStock.checked = false;

    const ratingRadio = document.querySelector('input[name="ratingFilter"][value="0"]');
    if (ratingRadio) ratingRadio.checked = true;

    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('.cat-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-slug') === '');
    });
    document.querySelectorAll('.cat-filter-option').forEach(o => {
      o.classList.toggle('active', o.textContent.includes('All Collections'));
    });

    this.loadProducts();
    showToast('Filters reset to default', 'info');
  }
};
