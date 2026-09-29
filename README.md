# NEXUS LUXE - Full-Stack E-Commerce Platform

A state-of-the-art full-stack e-commerce platform for curated next-generation tech, audiophile equipment, and minimalist lifestyle accessories. Built with a Python Flask REST backend, SQLite relational database, and modern responsive Vanilla CSS / ES6+ JavaScript.

---

## ⚡ Task Workflow Completed

- [x] **Step 1: Design Product Listing Pages**
  - High-res product cards with zoom hover effects, category tags, rating stars, and pricing discount calculations.
  - Interactive collection pills bar with live product counts.
  - Sidebar filters for categories, real-time max price slider, rating filter, and in-stock toggle.
  - Grid View and List View switcher.
  - Quick View modal displaying technical specifications, stock status indicator, quantity stepper, and one-click add to cart.
  - Global live debounced search with dropdown suggestion preview.

- [x] **Step 2: Create Product Management APIs & Admin Console**
  - Full RESTful CRUD endpoints (`POST /api/products`, `GET /api/products/<id>`, `PUT /api/products/<id>`, `DELETE /api/products/<id>`).
  - Real-time inventory stock stepper with immediate backend persistence (`PATCH /api/products/<id>/stock`).
  - Admin Analytics Telemetry KPI Cards: Gross Revenue, Total Orders Placed, Active Catalog Items, and Low Stock Alerts.
  - Category and title search filtering within the Admin Console.
  - Modal with form validation for creating and editing products.

- [x] **Step 3: Implement Shopping Cart Functionality**
  - Slide-over Cart Drawer with smooth glassmorphism backdrop blur.
  - Real-time cart state synchronization (`GET`, `POST`, `PUT`, `DELETE` on `/api/cart`).
  - Dynamic quantity adjustments with inventory stock boundary protection.
  - Free Global Shipping progress bar dynamically calculating progress toward the $99.00 threshold.
  - Promo code system supporting discount coupons (`LUXE25` for 25% off, `SAVE10` for 10% off, `FREESHIP`).
  - Transparent itemized price breakdown (Subtotal, Discount, Estimated Shipping, Sales Tax, and Total).

- [x] **Step 4: Manage Orders and User Accounts**
  - Authentication system with secure password hashing (`generate_password_hash` / `check_password_hash`) and token-based sessions.
  - Pre-seeded accounts with quick testing demo buttons:
    - **Administrator**: `admin@nexusluxe.com` / `Admin@123`
    - **Customer**: `sophia@example.com` / `Customer@123`
  - Customer Profile and saved shipping address management.
  - 4-Stage Multi-Step Checkout Wizard:
    1. Customer & Shipping details form.
    2. Delivery option selection (Standard Courier vs Priority Air Express).
    3. Interactive Credit Card payment preview with live card formatting, PayPal/UPI, or Cash on Delivery.
    4. Order confirmation with unique tracking ID (e.g., `#NX-FD04AC`).
  - Atomic checkout transaction that reduces stock levels and clears cart.
  - Customer Order History with itemized receipts and status tracking.
  - Admin fulfillment console for updating order statuses (`Processing`, `Shipped`, `Delivered`, `Cancelled`).

- [x] **Step 5: Test End-to-End Workflows**
  - Automated integration test suite (`test_e2e.py`) verifying all 5 steps: listing, filtering, search, admin CRUD, stock updates, cart manipulation, checkout, and inventory decrement.

---

## 🚀 Running the Application

### 1. Start the Server
The application runs on port `5050` (or your configured port):
```bash
python app.py
```
Open your browser and navigate to:
```
http://127.0.0.1:5050
```

### 2. Run the End-to-End Test Suite
```bash
python test_e2e.py
```

---

## 🔑 Pre-Configured Test Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@nexusluxe.com` | `Admin@123` | Full Product CRUD, Stock Control, Order Status Management, Analytics |
| **Customer** | `sophia@example.com` | `Customer@123` | Browsing, Cart, Checkout, Order Tracking, Saved Addresses |

### Active Promo Codes
- `LUXE25` – 25% discount on orders over $150
- `SAVE10` – 10% discount on orders over $50
- `WELCOME20` – 20% discount on orders over $75
- `FREESHIP` – Free shipping voucher

---

## 📁 Directory Structure

```
aspyE-cowb/
├── app.py                  # Flask REST API server and routing
├── database.py             # SQLite schema, tables, and initial seed data
├── test_e2e.py             # Automated end-to-end test suite
├── ecommerce.db            # SQLite database file
├── templates/
│   └── index.html          # Semantic HTML5 single-page application structure
├── static/
│   ├── css/
│   │   └── styles.css      # Vanilla CSS design system, dark/light themes, animations
│   └── js/
│       ├── api.js          # RESTful client for backend endpoints
│       ├── state.js        # Reactive state store and event emitter
│       ├── catalog.js      # Product catalog, filters, search, quick view
│       ├── cart.js         # Slide-out cart drawer, coupons, free shipping progress
│       ├── checkout.js     # Multi-step checkout wizard with live card preview
│       ├── auth.js         # User accounts, login/register, order history
│       ├── admin.js        # Product CRUD, stock controls, order fulfillment
│       └── app.js          # Main orchestrator, theme toggle, toast notifications
└── README.md
```
