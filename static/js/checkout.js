/**
 * checkout.js - Multi-Step Checkout Modal, Dynamic Credit Card Preview, and Order Placement (Step 4)
 */

const Checkout = {
  currentStep: 1,
  selectedDelivery: 'standard',
  selectedPayment: 'card',

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const modal = document.getElementById('checkoutModal');
    const closeBtn = document.getElementById('closeCheckoutBtn');
    const cancelBtn = document.getElementById('chkCancelBtn');

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.close();
        Cart.openDrawer();
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.close();
      });
    }

    // Step 1 -> Step 2
    const step1Next = document.getElementById('chkStep1NextBtn');
    if (step1Next) {
      step1Next.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.validateStep1()) {
          this.goToStep(2);
        }
      });
    }

    // Step 2 Back & Next
    const step2Back = document.getElementById('chkStep2BackBtn');
    const step2Next = document.getElementById('chkStep2NextBtn');
    if (step2Back) step2Back.addEventListener('click', () => this.goToStep(1));
    if (step2Next) step2Next.addEventListener('click', () => this.goToStep(3));

    // Delivery Options Radio
    document.querySelectorAll('input[name="deliverySpeed"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.selectedDelivery = e.target.value;
        document.querySelectorAll('.delivery-card').forEach(c => c.classList.remove('active'));
        e.target.closest('.delivery-card').classList.add('active');
        this.updateFinalTotalSummary();
      });
    });

    // Step 3 Back & Submit Order
    const step3Back = document.getElementById('chkStep3BackBtn');
    const submitBtn = document.getElementById('submitOrderBtn');
    if (step3Back) step3Back.addEventListener('click', () => this.goToStep(2));
    if (submitBtn) submitBtn.addEventListener('click', () => this.submitOrder());

    // Payment Method Tabs
    document.querySelectorAll('.payment-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.payment-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedPayment = btn.getAttribute('data-pay');

        const cardPreview = document.getElementById('cardPreviewSection');
        const cardInputs = document.getElementById('cardInputsGrid');
        if (this.selectedPayment === 'card') {
          if (cardPreview) cardPreview.style.display = 'block';
          if (cardInputs) cardInputs.style.display = 'grid';
        } else {
          if (cardPreview) cardPreview.style.display = 'none';
          if (cardInputs) cardInputs.style.display = 'none';
        }
      });
    });

    // Interactive Card Preview Inputs
    const cardNumInput = document.getElementById('chkCardNumber');
    const cardExpInput = document.getElementById('chkCardExp');
    const nameInput = document.getElementById('chkName');

    if (cardNumInput) {
      cardNumInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').substring(0, 16);
        val = val.replace(/(\d{4})/g, '$1 ').trim();
        e.target.value = val;
        document.getElementById('vcardDisplayNumber').textContent = val || '•••• •••• •••• 4242';
      });
    }

    if (cardExpInput) {
      cardExpInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (val.length >= 2) val = val.substring(0, 2) + '/' + val.substring(2);
        e.target.value = val;
        document.getElementById('vcardDisplayExp').textContent = val || '12/28';
      });
    }

    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        document.getElementById('vcardDisplayName').textContent = (e.target.value || 'SOPHIA VANCE').toUpperCase();
      });
    }

    // Step 4 Confirmation Actions
    const viewConfirmedOrderBtn = document.getElementById('viewConfirmedOrderBtn');
    const continueShoppingBtn = document.getElementById('continueShoppingSuccessBtn');

    if (viewConfirmedOrderBtn) {
      viewConfirmedOrderBtn.addEventListener('click', () => {
        this.close();
        switchView('orders');
      });
    }

    if (continueShoppingBtn) {
      continueShoppingBtn.addEventListener('click', () => {
        this.close();
        switchView('catalog');
      });
    }
  },

  open() {
    this.goToStep(1);
    this.prefillUserInfo();
    this.updateFinalTotalSummary();
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.add('active');
  },

  close() {
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.remove('active');
  },

  prefillUserInfo() {
    if (State.user) {
      const u = State.user;
      if (u.name) document.getElementById('chkName').value = u.name;
      if (u.email) document.getElementById('chkEmail').value = u.email;
      if (u.phone) document.getElementById('chkPhone').value = u.phone;
      if (u.address) document.getElementById('chkAddress').value = u.address;
      if (u.city) document.getElementById('chkCity').value = u.city;
      if (u.postal_code) document.getElementById('chkPostal').value = u.postal_code;
      if (u.country) document.getElementById('chkCountry').value = u.country;
      
      const vcardName = document.getElementById('vcardDisplayName');
      if (vcardName) vcardName.textContent = u.name.toUpperCase();
    }
  },

  goToStep(stepNumber) {
    this.currentStep = stepNumber;

    // Update wizard steps header
    document.querySelectorAll('.wizard-step').forEach(step => {
      const num = parseInt(step.getAttribute('data-step'), 10);
      step.classList.remove('active', 'completed');
      if (num === stepNumber) {
        step.classList.add('active');
      } else if (num < stepNumber) {
        step.classList.add('completed');
      }
    });

    // Update panes
    for (let i = 1; i <= 4; i++) {
      const pane = document.getElementById(`wizardStep${i}`);
      if (pane) pane.style.display = i === stepNumber ? 'block' : 'none';
    }

    this.updateFinalTotalSummary();
  },

  validateStep1() {
    const name = document.getElementById('chkName').value.trim();
    const email = document.getElementById('chkEmail').value.trim();
    const phone = document.getElementById('chkPhone').value.trim();
    const address = document.getElementById('chkAddress').value.trim();
    const city = document.getElementById('chkCity').value.trim();
    const postal = document.getElementById('chkPostal').value.trim();

    if (!name || !email || !phone || !address || !city || !postal) {
      showToast('Please fill out all required shipping fields', 'error');
      return false;
    }
    return true;
  },

  updateFinalTotalSummary() {
    const subtotal = State.cart.subtotal || 0;
    const discount = State.cart.discount || 0;
    
    let shipping = 0;
    if (this.selectedDelivery === 'express') {
      shipping = subtotal < 150 ? 25.0 : 10.0;
    } else {
      shipping = subtotal >= 99.0 ? 0.0 : 15.0;
    }

    const discountedSubtotal = Math.max(0, subtotal - discount);
    const tax = Math.round(discountedSubtotal * 0.08 * 100) / 100;
    const total = Math.round((discountedSubtotal + shipping + tax) * 100) / 100;

    const summaryElem = document.getElementById('checkoutFinalTotal');
    if (summaryElem) summaryElem.textContent = `$${total.toFixed(2)}`;
  },

  async submitOrder() {
    const submitBtn = document.getElementById('submitOrderBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `Processing Secure Order...`;

    const orderData = {
      name: document.getElementById('chkName').value.trim(),
      email: document.getElementById('chkEmail').value.trim(),
      phone: document.getElementById('chkPhone').value.trim(),
      address: document.getElementById('chkAddress').value.trim(),
      city: document.getElementById('chkCity').value.trim(),
      postal_code: document.getElementById('chkPostal').value.trim(),
      country: document.getElementById('chkCountry').value,
      shipping_method: this.selectedDelivery,
      payment_method: this.selectedPayment,
      coupon_code: State.cart.couponCode || null
    };

    try {
      const res = await API.checkout(orderData);
      
      // Update Step 4 Confirmation Pane
      document.getElementById('confirmedOrderNum').textContent = res.order_number;
      document.getElementById('confirmedOrderTotal').textContent = `$${res.total_amount.toFixed(2)}`;

      // Reset cart locally
      await Cart.fetchCart();
      State.removeDiscount();

      // Go to step 4
      this.goToStep(4);
      showToast('🎉 Order placed successfully!', 'success');

      // Refresh Orders view & Admin metrics if open
      if (typeof Auth !== 'undefined') Auth.loadMyOrders();
      if (typeof Admin !== 'undefined') Admin.loadStats();

    } catch (err) {
      showToast(err.message || 'Payment processing failed', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Complete Order & Pay
      `;
    }
  }
};
