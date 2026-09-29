/**
 * auth.js - User Accounts, Authentication, Profile, and Orders History (Step 4)
 */

const Auth = {
  async init() {
    this.bindEvents();
    await this.checkAuthStatus();

    // Listen to user changes
    State.on('userChanged', (user) => {
      this.updateUserUI(user);
      if (user) {
        this.loadMyOrders();
      }
    });
  },

  bindEvents() {
    // Open Auth Modal
    const userAuthBtn = document.getElementById('userAuthBtn');
    const authModal = document.getElementById('authModal');
    const closeAuthBtn = document.getElementById('closeAuthBtn');

    if (userAuthBtn) {
      userAuthBtn.addEventListener('click', () => {
        if (State.user) {
          this.toggleUserDropdown();
        } else {
          this.openAuthModal('signin');
        }
      });
    }

    if (closeAuthBtn) {
      closeAuthBtn.addEventListener('click', () => this.closeAuthModal());
    }

    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) this.closeAuthModal();
      });
    }

    // Auth Modal Tabs (Sign In vs Register)
    const tabSignIn = document.getElementById('authTabSignIn');
    const tabSignUp = document.getElementById('authTabSignUp');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');

    if (tabSignIn && tabSignUp && signInForm && signUpForm) {
      tabSignIn.addEventListener('click', () => {
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        signInForm.style.display = 'flex';
        signUpForm.style.display = 'none';
      });
      tabSignUp.addEventListener('click', () => {
        tabSignUp.classList.add('active');
        tabSignIn.classList.remove('active');
        signUpForm.style.display = 'flex';
        signInForm.style.display = 'none';
      });
    }

    // Quick One-Click Demo Logins
    const quickAdmin = document.getElementById('quickLoginAdminBtn');
    const quickCustomer = document.getElementById('quickLoginCustomerBtn');

    if (quickAdmin) {
      quickAdmin.addEventListener('click', async () => {
        document.getElementById('loginEmail').value = 'admin@nexusluxe.com';
        document.getElementById('loginPassword').value = 'Admin@123';
        await this.handleLogin('admin@nexusluxe.com', 'Admin@123');
      });
    }

    if (quickCustomer) {
      quickCustomer.addEventListener('click', async () => {
        document.getElementById('loginEmail').value = 'sophia@example.com';
        document.getElementById('loginPassword').value = 'Customer@123';
        await this.handleLogin('sophia@example.com', 'Customer@123');
      });
    }

    // Submit Sign In
    if (signInForm) {
      signInForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        await this.handleLogin(email, password);
      });
    }

    // Submit Sign Up
    if (signUpForm) {
      signUpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value.trim();
        await this.handleRegister(name, email, password);
      });
    }

    // Dropdown Items
    const ddOrders = document.getElementById('dropdownOrdersBtn');
    const ddProfile = document.getElementById('dropdownProfileBtn');
    const ddAdmin = document.getElementById('dropdownAdminBtn');
    const ddLogout = document.getElementById('dropdownLogoutBtn');
    const accountSignOut = document.getElementById('accountSignOutBtn');

    if (ddOrders) ddOrders.addEventListener('click', () => {
      this.closeUserDropdown();
      switchView('orders');
    });

    if (ddProfile) ddProfile.addEventListener('click', () => {
      this.closeUserDropdown();
      this.openProfileModal();
    });

    if (ddAdmin) ddAdmin.addEventListener('click', () => {
      this.closeUserDropdown();
      switchView('admin');
    });

    if (ddLogout) ddLogout.addEventListener('click', () => this.handleLogout());
    if (accountSignOut) accountSignOut.addEventListener('click', () => this.handleLogout());

    // Profile Edit Modal
    const editProfileBtn = document.getElementById('editProfileBtn');
    const profileModal = document.getElementById('profileModal');
    const closeProfileBtn = document.getElementById('closeProfileBtn');
    const cancelProfileBtn = document.getElementById('cancelProfileBtn');
    const profileForm = document.getElementById('profileForm');

    if (editProfileBtn) editProfileBtn.addEventListener('click', () => this.openProfileModal());
    if (closeProfileBtn) closeProfileBtn.addEventListener('click', () => profileModal.classList.remove('active'));
    if (cancelProfileBtn) cancelProfileBtn.addEventListener('click', () => profileModal.classList.remove('active'));

    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updateData = {
          name: document.getElementById('profName').value.trim(),
          phone: document.getElementById('profPhone').value.trim(),
          address: document.getElementById('profAddress').value.trim(),
          city: document.getElementById('profCity').value.trim(),
          postal_code: document.getElementById('profPostal').value.trim(),
          country: document.getElementById('profCountry').value.trim()
        };
        try {
          const res = await API.updateProfile(updateData);
          State.setUser(res.user, State.token);
          profileModal.classList.remove('active');
          showToast('Profile and address updated', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Order Details Modal close
    const closeOrderDetailsBtn = document.getElementById('closeOrderDetailsBtn');
    const orderDetailsModal = document.getElementById('orderDetailsModal');
    if (closeOrderDetailsBtn && orderDetailsModal) {
      closeOrderDetailsBtn.addEventListener('click', () => orderDetailsModal.classList.remove('active'));
      orderDetailsModal.addEventListener('click', (e) => {
        if (e.target === orderDetailsModal) orderDetailsModal.classList.remove('active');
      });
    }

    // Close user dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('userMenuWrapper');
      if (menu && !menu.contains(e.target)) {
        this.closeUserDropdown();
      }
    });
  },

  openAuthModal(tab = 'signin') {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.add('active');

    const tabSignIn = document.getElementById('authTabSignIn');
    const tabSignUp = document.getElementById('authTabSignUp');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');

    if (tab === 'signup') {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      signUpForm.style.display = 'flex';
      signInForm.style.display = 'none';
    } else {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signInForm.style.display = 'flex';
      signUpForm.style.display = 'none';
    }
  },

  closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');
  },

  toggleUserDropdown() {
    const card = document.getElementById('userDropdownCard');
    if (card) {
      card.style.display = card.style.display === 'none' ? 'block' : 'none';
    }
  },

  closeUserDropdown() {
    const card = document.getElementById('userDropdownCard');
    if (card) card.style.display = 'none';
  },

  async checkAuthStatus() {
    if (!State.token) return;
    try {
      const res = await API.getMe();
      State.setUser(res.user, State.token);
    } catch (err) {
      State.setUser(null, null);
    }
  },

  async handleLogin(email, password) {
    try {
      const res = await API.login(email, password);
      State.setUser(res.user, res.token);
      this.closeAuthModal();
      showToast(`Welcome back, ${res.user.name}!`, 'success');
      await Cart.fetchCart();
      if (res.user.role === 'admin') {
        Admin.loadStats();
      }
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    }
  },

  async handleRegister(name, email, password) {
    try {
      const res = await API.register(name, email, password);
      State.setUser(res.user, res.token);
      this.closeAuthModal();
      showToast(`Account created! Welcome, ${res.user.name}.`, 'success');
      await Cart.fetchCart();
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    }
  },

  handleLogout() {
    State.setUser(null, null);
    this.closeUserDropdown();
    showToast('Signed out successfully', 'info');
    switchView('catalog');
  },

  updateUserUI(user) {
    const label = document.getElementById('userLabel');
    const avatarLetter = document.getElementById('userAvatarLetter');
    const nameDisplay = document.getElementById('userNameDisplay');
    const emailDisplay = document.getElementById('userEmailDisplay');
    const roleBadge = document.getElementById('userRoleBadge');
    const ddAdmin = document.getElementById('dropdownAdminBtn');
    const adminNavBtn = document.getElementById('navAdminBtn');

    if (user) {
      if (label) label.textContent = user.name.split(' ')[0];
      if (avatarLetter) avatarLetter.textContent = user.name.charAt(0).toUpperCase();
      if (nameDisplay) nameDisplay.textContent = user.name;
      if (emailDisplay) emailDisplay.textContent = user.email;
      if (roleBadge) {
        roleBadge.textContent = user.role.toUpperCase();
        roleBadge.className = `user-role-badge ${user.role === 'admin' ? 'text-amber' : ''}`;
      }

      // Show admin controls
      if (user.role === 'admin') {
        if (ddAdmin) ddAdmin.style.display = 'flex';
        if (adminNavBtn) adminNavBtn.style.display = 'flex';
      } else {
        if (ddAdmin) ddAdmin.style.display = 'none';
      }

      // Update account view
      const accAvatar = document.getElementById('accountAvatar');
      const accName = document.getElementById('accountNameTitle');
      const accEmail = document.getElementById('accountEmailSub');
      if (accAvatar) accAvatar.textContent = user.name.charAt(0).toUpperCase();
      if (accName) accName.textContent = user.name;
      if (accEmail) accEmail.textContent = user.email;

    } else {
      if (label) label.textContent = 'Sign In';
      if (ddAdmin) ddAdmin.style.display = 'none';
      if (adminNavBtn) adminNavBtn.style.display = 'flex'; // accessible for demo preview
    }
  },

  openProfileModal() {
    if (!State.user) {
      this.openAuthModal();
      return;
    }
    const u = State.user;
    document.getElementById('profName').value = u.name || '';
    document.getElementById('profPhone').value = u.phone || '';
    document.getElementById('profAddress').value = u.address || '';
    document.getElementById('profCity').value = u.city || '';
    document.getElementById('profPostal').value = u.postal_code || '';
    document.getElementById('profCountry').value = u.country || 'United States';

    document.getElementById('profileModal').classList.add('active');
  },

  async loadMyOrders() {
    const list = document.getElementById('ordersListItems');
    const empty = document.getElementById('ordersEmptyState');
    const countBadge = document.getElementById('orderCountBadge');

    try {
      const res = await API.getOrders();
      const orders = res.orders || [];

      if (countBadge) countBadge.textContent = `${orders.length} Order${orders.length === 1 ? '' : 's'}`;

      if (orders.length === 0) {
        if (list) list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
      }

      if (empty) empty.style.display = 'none';

      if (list) {
        list.innerHTML = orders.map(order => {
          const dateStr = new Date(order.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });

          let statusClass = 'status-processing';
          if (order.status === 'Shipped') statusClass = 'status-shipped';
          if (order.status === 'Delivered') statusClass = 'status-delivered';
          if (order.status === 'Cancelled') statusClass = 'status-cancelled';

          return `
            <div class="order-entry">
              <div class="order-entry-header">
                <div>
                  <span class="order-entry-num">${order.order_number}</span>
                  <span class="order-entry-date">&bull; Placed on ${dateStr}</span>
                </div>
                <span class="status-badge ${statusClass}">${order.status}</span>
              </div>
              <div class="order-entry-body">
                <div>
                  <p class="order-entry-desc">${order.item_count || 1} item(s) &bull; Shipping to ${order.shipping_city}, ${order.shipping_country}</p>
                </div>
                <div style="display:flex; align-items:center; gap: 1rem;">
                  <span class="order-entry-total">$${order.total_amount.toFixed(2)}</span>
                  <button class="btn btn-sm btn-outline" onclick="Auth.viewOrderReceipt(${order.id})">
                    View Receipt
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.error('Failed to load user orders:', err);
    }
  },

  async viewOrderReceipt(orderId) {
    try {
      const order = await API.getOrderDetails(orderId);
      const content = document.getElementById('orderDetailsContent');
      const modal = document.getElementById('orderDetailsModal');

      const itemsHtml = (order.items || []).map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid var(--border-color);">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <img src="${item.product_image}" style="width:44px; height:44px; border-radius:6px; object-fit:cover;">
            <div>
              <div style="font-weight:600; font-size:0.9rem;">${item.product_title}</div>
              <div style="font-size:0.75rem; color:var(--text-dim);">${item.quantity} x $${item.price.toFixed(2)}</div>
            </div>
          </div>
          <div style="font-weight:700;">$${item.subtotal.toFixed(2)}</div>
        </div>
      `).join('');

      content.innerHTML = `
        <div style="margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid var(--border-color);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <span class="highlight-code" style="font-size:1.2rem;">Receipt #${order.order_number}</span>
              <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">Date: ${new Date(order.created_at).toLocaleString()}</p>
            </div>
            <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
          </div>
        </div>

        <div style="margin-bottom:1.5rem;">
          <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-dim); margin-bottom:0.75rem;">Fulfillment & Shipping</h4>
          <div style="background:var(--bg-surface-elevated); padding:0.85rem 1.25rem; border-radius:var(--radius-sm); font-size:0.875rem;">
            <div><strong>${order.customer_name}</strong> (${order.customer_email})</div>
            <div style="color:var(--text-muted);">${order.shipping_address}, ${order.shipping_city} ${order.shipping_postal}, ${order.shipping_country}</div>
            <div style="margin-top:0.4rem; font-size:0.8rem; color:var(--primary);">Service: ${order.shipping_method.toUpperCase()} DELIVERY</div>
          </div>
        </div>

        <div style="margin-bottom:1.5rem;">
          <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--text-dim); margin-bottom:0.75rem;">Purchased Items</h4>
          ${itemsHtml}
        </div>

        <div style="background:var(--bg-surface-elevated); padding:1rem; border-radius:var(--radius-sm); font-size:0.875rem; display:flex; flex-direction:column; gap:0.4rem;">
          <div style="display:flex; justify-content:space-between; color:var(--text-muted);">
            <span>Subtotal</span>
            <span>$${order.subtotal.toFixed(2)}</span>
          </div>
          ${order.discount > 0 ? `
            <div style="display:flex; justify-content:space-between; color:var(--success);">
              <span>Discount (${order.coupon_code || 'PROMO'})</span>
              <span>-$${order.discount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:space-between; color:var(--text-muted);">
            <span>Shipping</span>
            <span>$${order.shipping_fee.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; color:var(--text-muted);">
            <span>Estimated Tax</span>
            <span>$${order.tax.toFixed(2)}</span>
          </div>
          <div style="height:1px; background:var(--border-color); margin:0.3rem 0;"></div>
          <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1.15rem; color:var(--primary);">
            <span>Total Paid</span>
            <span>$${order.total_amount.toFixed(2)}</span>
          </div>
        </div>
      `;

      modal.classList.add('active');
    } catch (err) {
      showToast('Could not load order receipt', 'error');
    }
  }
};
