/**
 * app.js - Main Application Orchestrator, Router, Search, Themes, and Toast Engine
 */

// Global Router / View Switcher
function switchView(viewName) {
  State.setView(viewName);

  // Update Nav links active state
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
  });

  // Toggle View sections
  const views = ['catalog', 'admin', 'orders'];
  views.forEach(v => {
    const sec = document.getElementById(`${v}View`);
    if (sec) {
      if (v === viewName) {
        sec.style.display = 'block';
        sec.classList.add('active');
      } else {
        sec.style.display = 'none';
        sec.classList.remove('active');
      }
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // If opening admin, load admin metrics
  if (viewName === 'admin') {
    Admin.loadStats();
  } else if (viewName === 'orders') {
    Auth.loadMyOrders();
  }
}

// Toast Notifications Engine
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    info: '⚡'
  };

  toast.innerHTML = `
    <span style="font-weight:800; font-size:1.1rem; color:${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)'};">${iconMap[type] || '•'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Theme Switcher (Dark / Light)
function initTheme() {
  const savedTheme = localStorage.getItem('nexus_theme') || 'dark';
  applyTheme(savedTheme);

  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      showToast(`Switched to ${next} theme`, 'info');
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('nexus_theme', theme);

  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');

  if (theme === 'light') {
    if (sunIcon) sunIcon.style.display = 'none';
    if (moonIcon) moonIcon.style.display = 'block';
  } else {
    if (sunIcon) sunIcon.style.display = 'block';
    if (moonIcon) moonIcon.style.display = 'none';
  }
}

// Global Live Search with Debounce & Dropdown Preview
function initGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  const dropdown = document.getElementById('searchDropdown');
  const clearBtn = document.getElementById('searchClearBtn');

  if (!input || !dropdown) return;

  let searchTimeout = null;

  input.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

    clearTimeout(searchTimeout);
    if (!val) {
      dropdown.style.display = 'none';
      State.searchQuery = '';
      Catalog.loadProducts();
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const res = await API.getProducts({ search: val, limit: 5 });
        const products = res.products || [];

        if (products.length === 0) {
          dropdown.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-dim); font-size:0.85rem;">No products found for "${val}"</div>`;
        } else {
          dropdown.innerHTML = products.map(p => `
            <div class="search-result-item" onclick="Catalog.openQuickView(${p.id}); document.getElementById('searchDropdown').style.display='none';">
              <img src="${p.image_url}" class="search-item-thumb">
              <div class="search-item-info">
                <div class="search-item-title">${p.title}</div>
                <div class="search-item-meta">${p.category_name} &bull; ★ ${p.rating ? p.rating.toFixed(1) : '5.0'}</div>
              </div>
              <div class="search-item-price">$${p.price.toFixed(2)}</div>
            </div>
          `).join('');
        }
        dropdown.style.display = 'block';

        // Also update catalog page search
        State.searchQuery = val;
        Catalog.loadProducts();
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 200);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      dropdown.style.display = 'none';
      State.searchQuery = '';
      Catalog.loadProducts();
    });
  }

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

// Helpers for footer / promotion actions
function filterByCategorySlug(slug) {
  switchView('catalog');
  Catalog.selectCategory(slug);
  const catSection = document.getElementById('productCatalogSection');
  if (catSection) catSection.scrollIntoView({ behavior: 'smooth' });
}

function openCart() {
  Cart.openDrawer();
}

function showQuickAdminLogin() {
  switchView('admin');
}

function copyTestCoupon() {
  navigator.clipboard.writeText('LUXE25');
  showToast('Coupon code LUXE25 copied to clipboard!', 'success');
}

// Master Application Initialization
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initGlobalSearch();

  // Navigation Links
  document.getElementById('navCatalogBtn')?.addEventListener('click', () => switchView('catalog'));
  document.getElementById('navOrdersBtn')?.addEventListener('click', () => switchView('orders'));
  document.getElementById('navAdminBtn')?.addEventListener('click', () => switchView('admin'));
  document.getElementById('quickAdminSwitchBtn')?.addEventListener('click', () => switchView('admin'));
  document.getElementById('brandLogo')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('catalog');
  });

  // Announcement close
  document.getElementById('closeAnnouncementBtn')?.addEventListener('click', () => {
    const bar = document.getElementById('announcementBar');
    if (bar) bar.style.display = 'none';
  });

  // Initialize Modules
  await Catalog.init();
  await Cart.init();
  Checkout.init();
  await Auth.init();
  Admin.init();

  console.log('Nexus Luxe E-Commerce Platform initialized successfully.');
});
