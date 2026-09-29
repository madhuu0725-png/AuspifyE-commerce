"""
test_e2e.py - Comprehensive End-to-End Workflow Testing
Validates all 5 steps:
Step 1: Product listing & filtering
Step 2: Product management APIs (CRUD & stock updates)
Step 3: Shopping cart functionality (Add, update, coupon, calculate)
Step 4: Orders & user accounts (Register, login, checkout, inventory decrement, fulfillment)
Step 5: Overall system health & stats
"""
import requests
import json
import sys
import io

if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://127.0.0.1:5050"

def run_tests():
    session = requests.Session()
    print("=" * 60)
    print("STARTING FULL-STACK E-COMMERCE END-TO-END TESTS")
    print("=" * 60)

    # ---------------------------------------------------------
    # STEP 1: TEST PRODUCT LISTING & FILTERING
    # ---------------------------------------------------------
    print("\n[STEP 1] Testing Product Catalog & Filter APIs...")

    # 1.1 List all products
    r = session.get(f"{BASE_URL}/api/products")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert "products" in data
    assert data["total"] >= 10, f"Expected at least 10 products, got {data['total']}"
    print(f"  ✓ Listed {len(data['products'])} products (Total: {data['total']})")

    # 1.2 Category filter
    r = session.get(f"{BASE_URL}/api/products?category=audio-sound")
    assert r.status_code == 200
    audio_prods = r.json()["products"]
    assert len(audio_prods) > 0
    for p in audio_prods:
        assert p["category_slug"] == "audio-sound"
    print(f"  ✓ Filtered by 'audio-sound': found {len(audio_prods)} products")

    # 1.3 Search filter
    r = session.get(f"{BASE_URL}/api/products?search=Keyboard")
    assert r.status_code == 200
    search_prods = r.json()["products"]
    assert len(search_prods) >= 1
    assert "Keyboard" in search_prods[0]["title"]
    print(f"  ✓ Search query 'Keyboard' matched: '{search_prods[0]['title']}'")

    # 1.4 Price range filter
    r = session.get(f"{BASE_URL}/api/products?max_price=100")
    assert r.status_code == 200
    cheap_prods = r.json()["products"]
    for p in cheap_prods:
        assert p["price"] <= 100.0
    print(f"  ✓ Price range filter (max $100): found {len(cheap_prods)} products")

    # 1.5 Sorting
    r = session.get(f"{BASE_URL}/api/products?sort=price_asc")
    assert r.status_code == 200
    sorted_prods = r.json()["products"]
    prices = [p["price"] for p in sorted_prods]
    assert prices == sorted(prices), "Prices are not sorted ascending"
    print("  ✓ Sorting by 'price_asc' verified")

    # ---------------------------------------------------------
    # STEP 2: TEST PRODUCT MANAGEMENT APIS (ADMIN CRUD)
    # ---------------------------------------------------------
    print("\n[STEP 2] Testing Product Management Admin APIs...")

    # 2.1 Login as Admin
    admin_login = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@nexusluxe.com",
        "password": "Admin@123"
    })
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
    admin_token = admin_login.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    print("  ✓ Admin authenticated successfully")

    # 2.2 Create New Product
    new_product_payload = {
        "title": "Quantum Horizon Spatial VR Goggles",
        "category_id": 2, # Smart Electronics
        "price": 599.99,
        "original_price": 699.99,
        "stock": 15,
        "featured": 1,
        "image_url": "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=800",
        "description": "Next-gen dual 4K micro-OLED spatial display with hand-tracking gesture sensors and carbon fiber headband.",
        "tags": ["vr", "spatial", "4k", "oled"]
    }
    r = session.post(f"{BASE_URL}/api/products", headers=admin_headers, json=new_product_payload)
    assert r.status_code == 201, f"Create product failed: {r.text}"
    created_id = r.json()["id"]
    print(f"  ✓ Created new product with ID #{created_id}")

    # 2.3 Read Created Product
    r = session.get(f"{BASE_URL}/api/products/{created_id}")
    assert r.status_code == 200
    prod = r.json()
    assert prod["title"] == "Quantum Horizon Spatial VR Goggles"
    assert prod["price"] == 599.99
    assert prod["stock"] == 15
    print(f"  ✓ Verified product #{created_id} details")

    # 2.4 Update Product (PUT)
    r = session.put(f"{BASE_URL}/api/products/{created_id}", headers=admin_headers, json={
        "title": "Quantum Horizon Spatial VR Goggles Pro Edition",
        "price": 649.99,
        "stock": 25
    })
    assert r.status_code == 200, f"Update product failed: {r.text}"
    
    # Verify update
    r = session.get(f"{BASE_URL}/api/products/{created_id}")
    assert r.json()["title"] == "Quantum Horizon Spatial VR Goggles Pro Edition"
    assert r.json()["price"] == 649.99
    assert r.json()["stock"] == 25
    print("  ✓ Updated product title, price, and stock via PUT")

    # 2.5 Quick Stock Adjustment (PATCH)
    r = session.patch(f"{BASE_URL}/api/products/{created_id}/stock", headers=admin_headers, json={"stock": 18})
    assert r.status_code == 200
    assert r.json()["stock"] == 18
    print("  ✓ Quick stock adjustment to 18 units verified via PATCH")

    # 2.6 Delete Product (DELETE)
    r = session.delete(f"{BASE_URL}/api/products/{created_id}", headers=admin_headers)
    assert r.status_code == 200
    r_check = session.get(f"{BASE_URL}/api/products/{created_id}")
    assert r_check.status_code == 404
    print(f"  ✓ Deleted test product #{created_id} (Returned 404 as expected)")

    # ---------------------------------------------------------
    # STEP 3: TEST SHOPPING CART FUNCTIONALITY
    # ---------------------------------------------------------
    print("\n[STEP 3] Testing Shopping Cart Functionality...")
    guest_session_id = "test-guest-session-987"
    guest_headers = {"X-Session-ID": guest_session_id, "Content-Type": "application/json"}

    # 3.1 Clear any existing cart
    session.delete(f"{BASE_URL}/api/cart/clear", headers=guest_headers)

    # 3.2 Add product #1 (Aura Headphones, $299.99)
    r = session.post(f"{BASE_URL}/api/cart/add", headers=guest_headers, json={
        "product_id": 1,
        "quantity": 1
    })
    assert r.status_code == 200, f"Add to cart failed: {r.text}"
    print("  ✓ Added product #1 to cart")

    # 3.3 Add product #3 (KeebPulse Keyboard, $179.50)
    r = session.post(f"{BASE_URL}/api/cart/add", headers=guest_headers, json={
        "product_id": 3,
        "quantity": 2
    })
    assert r.status_code == 200
    print("  ✓ Added 2 units of product #3 to cart")

    # 3.4 Get Cart and verify calculations
    r = session.get(f"{BASE_URL}/api/cart", headers=guest_headers)
    assert r.status_code == 200
    cart = r.json()
    assert cart["count"] == 3
    expected_subtotal = round(299.99 + (179.50 * 2), 2) # 658.99
    assert abs(cart["subtotal"] - expected_subtotal) < 0.01
    assert cart["shipping"] == 0.0 # > $99 qualifies for free shipping
    print(f"  ✓ Cart subtotal calculated correctly: ${cart['subtotal']} (Items: {cart['count']})")

    # 3.5 Apply Coupon (LUXE25 -> 25% off)
    r = session.post(f"{BASE_URL}/api/cart/apply-coupon", headers=guest_headers, json={
        "code": "LUXE25",
        "subtotal": cart["subtotal"]
    })
    assert r.status_code == 200
    coupon_res = r.json()
    assert coupon_res["valid"] is True
    expected_discount = round(cart["subtotal"] * 0.25, 2)
    assert abs(coupon_res["discount"] - expected_discount) < 0.01
    print(f"  ✓ Applied coupon 'LUXE25': saved ${coupon_res['discount']}")

    # 3.6 Update item quantity
    item_id = cart["items"][0]["id"]
    r = session.put(f"{BASE_URL}/api/cart/item/{item_id}", headers=guest_headers, json={"quantity": 2})
    assert r.status_code == 200
    print("  ✓ Updated cart item quantity via PUT")

    # ---------------------------------------------------------
    # STEP 4: MANAGE ORDERS AND USER ACCOUNTS
    # ---------------------------------------------------------
    print("\n[STEP 4] Testing Orders and User Accounts Management...")

    # 4.1 Register New Customer
    cust_email = "alex.rivera@example.com"
    r = session.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Alex Rivera",
        "email": cust_email,
        "password": "Password@123"
    })
    assert r.status_code in [201, 409] # Might already exist if re-running
    if r.status_code == 409:
        # Login instead
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": cust_email, "password": "Password@123"})
    
    assert r.status_code in [200, 201]
    cust_token = r.json()["token"]
    cust_headers = {"Authorization": f"Bearer {cust_token}", "Content-Type": "application/json"}
    print(f"  ✓ Customer '{cust_email}' registered & authenticated")

    # 4.2 Update Profile
    r = session.put(f"{BASE_URL}/api/auth/profile", headers=cust_headers, json={
        "phone": "+1 (555) 432-8765",
        "address": "450 Mission St, Apt 18C",
        "city": "San Francisco",
        "postal_code": "94105",
        "country": "United States"
    })
    assert r.status_code == 200
    assert r.json()["user"]["city"] == "San Francisco"
    print("  ✓ Customer shipping address profile updated")

    # 4.3 Add Product to Customer Cart & Check Stock Prior to Order
    r_prod = session.get(f"{BASE_URL}/api/products/2") # Vertex Smartwatch
    initial_stock = r_prod.json()["stock"]

    session.delete(f"{BASE_URL}/api/cart/clear", headers=cust_headers)
    session.post(f"{BASE_URL}/api/cart/add", headers=cust_headers, json={"product_id": 2, "quantity": 1})

    # 4.4 Checkout & Place Order
    checkout_payload = {
        "name": "Alex Rivera",
        "email": cust_email,
        "phone": "+1 (555) 432-8765",
        "address": "450 Mission St, Apt 18C",
        "city": "San Francisco",
        "postal_code": "94105",
        "country": "United States",
        "shipping_method": "express",
        "payment_method": "card",
        "coupon_code": "LUXE25"
    }
    r = session.post(f"{BASE_URL}/api/orders/checkout", headers=cust_headers, json=checkout_payload)
    assert r.status_code == 201, f"Checkout failed: {r.text}"
    order_res = r.json()
    order_id = order_res["order_id"]
    order_num = order_res["order_number"]
    assert order_num.startswith("NX-")
    print(f"  ✓ Order #{order_num} (ID {order_id}) successfully placed! Total: ${order_res['total_amount']}")

    # 4.5 Verify Stock Decrement
    r_prod_after = session.get(f"{BASE_URL}/api/products/2")
    new_stock = r_prod_after.json()["stock"]
    assert new_stock == initial_stock - 1, f"Expected stock {initial_stock - 1}, found {new_stock}"
    print(f"  ✓ Inventory stock decremented from {initial_stock} to {new_stock}")

    # 4.6 Verify User Order History
    r = session.get(f"{BASE_URL}/api/orders", headers=cust_headers)
    assert r.status_code == 200
    user_orders = r.json()["orders"]
    assert any(o["order_number"] == order_num for o in user_orders)
    print(f"  ✓ Order #{order_num} appears in customer's order history")

    # 4.7 Admin Order Status Update
    r = session.patch(f"{BASE_URL}/api/orders/{order_id}/status", headers=admin_headers, json={"status": "Shipped"})
    assert r.status_code == 200
    assert r.json()["status"] == "Shipped"
    print(f"  ✓ Admin updated order #{order_id} status to 'Shipped'")

    # 4.8 Admin Analytics Telemetry
    r = session.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers)
    assert r.status_code == 200
    stats = r.json()
    assert stats["total_orders"] >= 2
    assert stats["total_revenue"] > 0
    print(f"  ✓ Admin Analytics: Total Revenue = ${stats['total_revenue']}, Orders = {stats['total_orders']}")

    print("\n" + "=" * 60)
    print("ALL 5 END-TO-END STEPS & WORKFLOWS VERIFIED 100% SUCCESSFUL!")
    print("=" * 60)

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"TEST FAILED: {e}")
        sys.exit(1)
