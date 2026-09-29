/**
 * cart.js - Shopping Cart Drawer, Quantities, and Promo Codes (Step 3)
 */

const Cart = {
  async init() {
    this.bindEvents();
    await this.fetchCart();

    // Listen for state changes
    State.on('cartChanged', (cart) => this.renderCart(cart));
  },

  bindEvents() {
    // Open / Close Drawer
    const openBtn = document.getElementById('openCartBtn');
    const closeBtn = document.getElementById('closeCartDrawerBtn');
    const backdrop = document.getElementById('cartDrawerBackdrop');
    const emptyShopBtn = document.getElementById('emptyCartShopBtn');

    if (openBtn) openBtn.addEventListener('click', () => this.openDrawer());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeDrawer());
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.closeDrawer();
      });
    }
    if (emptyShopBtn) {
      emptyShopBtn.addEventListener('click', () => {
        this.closeDrawer();
        switchView('catalog');
      });
    }

    // Apply Coupon
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    const couponInput = document.getElementById('cartCouponInput');
    const removeCouponBtn = document.getElementById('removeCouponBtn');

    if (applyCouponBtn && couponInput) {
      applyCouponBtn.addEventListener('click', async () => {
        const code = couponInput.value.trim().toUpperCase();
        if (!code) {
          showToast('Please enter a coupon code', 'error');
          return;
        }
        await this.applyCouponCode(code);
      });

      couponInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const code = couponInput.value.trim().toUpperCase();
          if (code) await this.applyCouponCode(code);
        }
      });
    }

    if (removeCouponBtn) {
      removeCouponBtn.addEventListener('click', () => {
        State.removeDiscount();
        document.getElementById('appliedCouponPill').style.display = 'none';
        if (couponInput) couponInput.value = '';
        showToast('Coupon removed', 'info');
      });
    }

    // Checkout Trigger
    const startCheckoutBtn = document.getElementById('startCheckoutBtn');
    if (startCheckoutBtn) {
      startCheckoutBtn.addEventListener('click', () => {
        if (State.cart.items.length === 0) {
          showToast('Your cart is empty', 'error');
          return;
        }
        this.closeDrawer();
        Checkout.open();
      });
    }
  },

  openDrawer() {
    const backdrop = document.getElementById('cartDrawerBackdrop');
    if (backdrop) backdrop.classList.add('active');
  },

  closeDrawer() {
    const backdrop = document.getElementById('cartDrawerBackdrop');
    if (backdrop) backdrop.classList.remove('active');
  },

  async fetchCart() {
    try {
      const cartData = await API.getCart();
      State.setCart(cartData);
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    }
  },

  async addItem(productId, quantity = 1) {
    try {
      const res = await API.addToCart(productId, quantity);
      showToast(res.message || 'Added to cart!', 'success');
      await this.fetchCart();
      this.bumpCartBadge();
    } catch (err) {
      showToast(err.message || 'Could not add to cart', 'error');
    }
  },

  async updateItemQty(itemId, newQty) {
    try {
      await API.updateCartItem(itemId, newQty);
      await this.fetchCart();
    } catch (err) {
      showToast(err.message || 'Could not update item', 'error');
    }
  },

  async removeItem(itemId) {
    try {
      await API.removeCartItem(itemId);
      showToast('Item removed from cart', 'info');
      await this.fetchCart();
    } catch (err) {
      showToast(err.message || 'Could not remove item', 'error');
    }
  },

  async clear() {
    try {
      await API.clearCart();
      await this.fetchCart();
      showToast('Cart cleared', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async applyCouponCode(code) {
    try {
      const res = await API.applyCoupon(code, State.cart.subtotal);
      State.applyDiscount(res.code, res.discount);
      
      const pill = document.getElementById('appliedCouponPill');
      const text = document.getElementById('appliedCouponText');
      if (pill && text) {
        text.textContent = `${res.code} Applied (-$${res.discount.toFixed(2)})`;
        pill.style.display = 'inline-flex';
      }
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  bumpCartBadge() {
    const badge = document.getElementById('cartCountBadge');
    if (badge) {
      badge.classList.remove('bump');
      void badge.offsetWidth; // trigger reflow
      badge.classList.add('bump');
      setTimeout(() => badge.classList.remove('bump'), 300);
    }
  },

  renderCart(cart) {
    const countBadge = document.getElementById('cartCountBadge');
    const drawerCount = document.getElementById('cartDrawerCount');
    const itemsContainer = document.getElementById('cartItemsContainer');
    const emptyState = document.getElementById('emptyCartState');
    const drawerFooter = document.getElementById('cartDrawerFooter');

    // Counts
    if (countBadge) countBadge.textContent = cart.count || 0;
    if (drawerCount) drawerCount.textContent = `(${cart.count || 0})`;

    // Free Shipping Progress
    const progressText = document.getElementById('shippingProgressText');
    const progressFill = document.getElementById('shippingProgressFill');
    if (progressText && progressFill) {
      const threshold = cart.free_shipping_threshold || 99.0;
      const subtotal = cart.subtotal || 0;
      if (subtotal >= threshold) {
        progressText.innerHTML = `🎉 <strong>Congratulations!</strong> You have unlocked Free Global Shipping!`;
        progressFill.style.width = '100%';
      } else {
        const remaining = (threshold - subtotal).toFixed(2);
        const percent = Math.min(100, Math.round((subtotal / threshold) * 100));
        progressText.innerHTML = `Add <strong>$${remaining}</strong> more for Free Global Shipping!`;
        progressFill.style.width = `${percent}%`;
      }
    }

    // Totals Breakdown
    const subtotalElem = document.getElementById('cartSubtotalVal');
    const discountRow = document.getElementById('cartDiscountRow');
    const discountElem = document.getElementById('cartDiscountVal');
    const shippingElem = document.getElementById('cartShippingVal');
    const taxElem = document.getElementById('cartTaxVal');
    const grandTotalElem = document.getElementById('cartGrandTotalVal');

    if (subtotalElem) subtotalElem.textContent = `$${(cart.subtotal || 0).toFixed(2)}`;
    
    if (discountRow && discountElem) {
      if (cart.discount > 0) {
        discountRow.style.display = 'flex';
        discountElem.textContent = `-$${cart.discount.toFixed(2)}`;
      } else {
        discountRow.style.display = 'none';
      }
    }

    if (shippingElem) {
      shippingElem.textContent = cart.shipping === 0 ? 'FREE' : `$${cart.shipping.toFixed(2)}`;
    }
    if (taxElem) taxElem.textContent = `$${(cart.tax || 0).toFixed(2)}`;
    if (grandTotalElem) grandTotalElem.textContent = `$${(cart.total || 0).toFixed(2)}`;

    // Items List
    if (!cart.items || cart.items.length === 0) {
      if (itemsContainer) itemsContainer.innerHTML = '';
      if (emptyState) {
        itemsContainer.appendChild(emptyState);
        emptyState.style.display = 'block';
      }
      if (drawerFooter) drawerFooter.style.opacity = '0.5';
      return;
    }

    if (drawerFooter) drawerFooter.style.opacity = '1';
    if (emptyState) emptyState.style.display = 'none';

    const itemsHtml = cart.items.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <img src="${item.image_url}" alt="${item.title}" class="cart-item-thumb">
        <div class="cart-item-info">
          <h4 class="cart-item-title">${item.title}</h4>
          <div class="cart-item-price">$${item.price.toFixed(2)}</div>
          
          <div class="cart-item-controls">
            <div class="quantity-stepper">
              <button class="stepper-btn" onclick="Cart.updateItemQty(${item.id}, ${item.quantity - 1})">-</button>
              <span class="stepper-val">${item.quantity}</span>
              <button class="stepper-btn" onclick="Cart.updateItemQty(${item.id}, ${item.quantity + 1})">+</button>
            </div>
            
            <button class="item-remove-btn" onclick="Cart.removeItem(${item.id})">Remove</button>
          </div>
        </div>
      </div>
    `).join('');

    itemsContainer.innerHTML = itemsHtml;
  }
};
