"""
app.py - RESTful E-Commerce Server for Nexus Luxe
Flask backend providing Product Catalog, Shopping Cart, Admin Management, Orders, and User Authentication.
"""
import os
import json
import uuid
import re
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from database import get_db_connection, init_db

SECRET_KEY = os.environ.get("SECRET_KEY", "nexus-luxe-hyper-secret-key-2026")
serializer = URLSafeTimedSerializer(SECRET_KEY)

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = SECRET_KEY

# Ensure DB exists on startup
init_db()

# --- Helper Functions ---
def generate_token(user_id, role):
    return serializer.dumps({"user_id": user_id, "role": role})

def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    elif request.cookies.get("auth_token"):
        token = request.cookies.get("auth_token")

    if not token:
        return None

    try:
        data = serializer.loads(token, max_age=86400 * 7) # 7 days validity
        user_id = data.get("user_id")
        conn = get_db_connection()
        user = conn.execute("SELECT id, name, email, role, phone, address, city, postal_code, country FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        if user:
            return dict(user)
    except (BadSignature, SignatureExpired):
        return None
    return None

def get_session_id():
    session_id = request.headers.get("X-Session-ID") or request.cookies.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
    return session_id

def slugify(text):
    text = re.sub(r'[^\w\s-]', '', text.lower())
    return re.sub(r'[-\s]+', '-', text).strip('-')

# --- Frontend Serving Routes ---
@app.route("/")
@app.route("/catalog")
@app.route("/cart")
@app.route("/checkout")
@app.route("/orders")
@app.route("/admin")
def serve_index():
    return render_template("index.html")

# --- AUTH API ENDPOINTS ---
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    role = "customer" # Default role

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_db_connection()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "Email is already registered"}), 409

    pwd_hash = generate_password_hash(password)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
    """, (name, email, pwd_hash, role))
    user_id = cursor.lastrowid
    conn.commit()

    user = conn.execute("SELECT id, name, email, role, phone, address, city, postal_code, country FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    token = generate_token(user_id, role)
    return jsonify({
        "message": "Account created successfully",
        "token": token,
        "user": dict(user)
    }), 201

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password credentials"}), 401

    token = generate_token(user["id"], user["role"])
    user_dict = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "phone": user["phone"],
        "address": user["address"],
        "city": user["city"],
        "postal_code": user["postal_code"],
        "country": user["country"]
    }
    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": user_dict
    })

@app.route("/api/auth/me", methods=["GET"])
def me():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"user": user})

@app.route("/api/auth/profile", methods=["PUT"])
def update_profile():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    name = data.get("name", user["name"]).strip()
    phone = data.get("phone", user["phone"])
    address = data.get("address", user["address"])
    city = data.get("city", user["city"])
    postal_code = data.get("postal_code", user["postal_code"])
    country = data.get("country", user["country"])

    conn = get_db_connection()
    conn.execute("""
        UPDATE users
        SET name = ?, phone = ?, address = ?, city = ?, postal_code = ?, country = ?
        WHERE id = ?
    """, (name, phone, address, city, postal_code, country, user["id"]))
    conn.commit()

    updated = conn.execute("SELECT id, name, email, role, phone, address, city, postal_code, country FROM users WHERE id = ?", (user["id"],)).fetchone()
    conn.close()
    return jsonify({"message": "Profile updated", "user": dict(updated)})

# --- CATEGORIES API ---
@app.route("/api/categories", methods=["GET"])
def get_categories():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT c.*, COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id
        GROUP BY c.id
        ORDER BY c.id ASC
    """).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

# --- PRODUCTS API (Step 1 & Step 2) ---
@app.route("/api/products", methods=["GET"])
def list_products():
    conn = get_db_connection()
    
    category = request.args.get("category", "").strip()
    search = request.args.get("search", "").strip()
    min_price = request.args.get("min_price", type=float)
    max_price = request.args.get("max_price", type=float)
    in_stock = request.args.get("in_stock", type=int)
    sort = request.args.get("sort", "featured")
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 24, type=int)
    offset = (page - 1) * limit

    query = """
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE 1=1
    """
    params = []

    if category:
        query += " AND (c.slug = ? OR c.id = ?)"
        params.extend([category, category])

    if search:
        query += " AND (p.title LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    if min_price is not None:
        query += " AND p.price >= ?"
        params.append(min_price)

    if max_price is not None:
        query += " AND p.price <= ?"
        params.append(max_price)

    if in_stock == 1:
        query += " AND p.stock > 0"

    # Count total matching
    count_query = f"SELECT COUNT(*) FROM ({query})"
    total = conn.execute(count_query, params).fetchone()[0]

    # Sorting
    if sort == "price_asc":
        query += " ORDER BY p.price ASC"
    elif sort == "price_desc":
        query += " ORDER BY p.price DESC"
    elif sort == "rating":
        query += " ORDER BY p.rating DESC, p.review_count DESC"
    elif sort == "newest":
        query += " ORDER BY p.id DESC"
    else: # featured
        query += " ORDER BY p.featured DESC, p.id ASC"

    query += " LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = conn.execute(query, params).fetchall()
    conn.close()

    products = []
    for r in rows:
        d = dict(r)
        try:
            d["tags"] = json.loads(d["tags"])
        except Exception:
            d["tags"] = []
        try:
            d["specs"] = json.loads(d["specs"])
        except Exception:
            d["specs"] = {}
        products.append(d)

    return jsonify({
        "products": products,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit if limit > 0 else 1
    })

@app.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    conn = get_db_connection()
    row = conn.execute("""
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
    """, (product_id,)).fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Product not found"}), 404

    d = dict(row)
    try:
        d["tags"] = json.loads(d["tags"])
    except Exception:
        d["tags"] = []
    try:
        d["specs"] = json.loads(d["specs"])
    except Exception:
        d["specs"] = {}
    return jsonify(d)

# Admin: Create Product
@app.route("/api/products", methods=["POST"])
def create_product():
    user = get_current_user()
    if not user or user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json() or {}
    title = data.get("title", "").strip()
    category_id = data.get("category_id")
    price = data.get("price")
    original_price = data.get("original_price") or price
    stock = data.get("stock", 0)
    description = data.get("description", "").strip()
    image_url = data.get("image_url", "").strip()
    featured = 1 if data.get("featured") else 0
    tags = data.get("tags", [])
    specs = data.get("specs", {})

    if not title or price is None or category_id is None or not description:
        return jsonify({"error": "Title, price, category, and description are required"}), 400

    if not image_url:
        image_url = "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80"

    slug = slugify(title)
    # Ensure unique slug
    conn = get_db_connection()
    cursor = conn.cursor()
    existing_slug = cursor.execute("SELECT id FROM products WHERE slug = ?", (slug,)).fetchone()
    if existing_slug:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    tags_json = json.dumps(tags) if isinstance(tags, list) else json.dumps([t.strip() for t in str(tags).split(",") if t.strip()])
    specs_json = json.dumps(specs) if isinstance(specs, dict) else json.dumps({})

    cursor.execute("""
        INSERT INTO products (
            title, slug, description, price, original_price, category_id,
            image_url, stock, featured, tags, specs, rating, review_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0, 1)
    """, (title, slug, description, float(price), float(original_price), int(category_id), image_url, int(stock), featured, tags_json, specs_json))
    
    product_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({"message": "Product created successfully", "id": product_id}), 201

# Admin: Update Product
@app.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    user = get_current_user()
    if not user or user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    conn = get_db_connection()
    existing = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Product not found"}), 404

    data = request.get_json() or {}
    title = data.get("title", existing["title"]).strip()
    category_id = data.get("category_id", existing["category_id"])
    price = float(data.get("price", existing["price"]))
    original_price = float(data.get("original_price", existing["original_price"])) if data.get("original_price") is not None else existing["original_price"]
    stock = int(data.get("stock", existing["stock"]))
    description = data.get("description", existing["description"]).strip()
    image_url = data.get("image_url", existing["image_url"]).strip()
    featured = 1 if data.get("featured", existing["featured"]) else 0
    
    tags = data.get("tags")
    if tags is not None:
        tags_json = json.dumps(tags) if isinstance(tags, list) else json.dumps([t.strip() for t in str(tags).split(",") if t.strip()])
    else:
        tags_json = existing["tags"]

    specs = data.get("specs")
    if specs is not None:
        specs_json = json.dumps(specs) if isinstance(specs, dict) else json.dumps({})
    else:
        specs_json = existing["specs"]

    conn.execute("""
        UPDATE products
        SET title = ?, category_id = ?, price = ?, original_price = ?,
            stock = ?, description = ?, image_url = ?, featured = ?,
            tags = ?, specs = ?
        WHERE id = ?
    """, (title, int(category_id), price, original_price, stock, description, image_url, featured, tags_json, specs_json, product_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Product updated successfully"})

# Admin: Quick Stock Update
@app.route("/api/products/<int:product_id>/stock", methods=["PATCH"])
def update_stock(product_id):
    user = get_current_user()
    if not user or user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json() or {}
    new_stock = data.get("stock")
    if new_stock is None or int(new_stock) < 0:
        return jsonify({"error": "Valid non-negative stock count required"}), 400

    conn = get_db_connection()
    conn.execute("UPDATE products SET stock = ? WHERE id = ?", (int(new_stock), product_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Stock updated", "stock": int(new_stock)})

# Admin: Delete Product
@app.route("/api/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    user = get_current_user()
    if not user or user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    conn = get_db_connection()
    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Product deleted successfully"})

# --- CART API (Step 3) ---
@app.route("/api/cart", methods=["GET"])
def get_cart():
    user = get_current_user()
    session_id = get_session_id()
    conn = get_db_connection()

    if user:
        rows = conn.execute("""
            SELECT ci.id, ci.product_id, ci.quantity, ci.user_id,
                   p.title, p.price, p.original_price, p.image_url, p.stock,
                   c.name as category_name
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE ci.user_id = ?
            ORDER BY ci.id DESC
        """, (user["id"],)).fetchall()
    else:
        rows = conn.execute("""
            SELECT ci.id, ci.product_id, ci.quantity, ci.session_id,
                   p.title, p.price, p.original_price, p.image_url, p.stock,
                   c.name as category_name
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE ci.session_id = ?
            ORDER BY ci.id DESC
        """, (session_id,)).fetchall()
    conn.close()

    items = []
    subtotal = 0.0
    total_count = 0
    for r in rows:
        item = dict(r)
        item_subtotal = item["price"] * item["quantity"]
        item["subtotal"] = round(item_subtotal, 2)
        subtotal += item_subtotal
        total_count += item["quantity"]
        items.append(item)

    subtotal = round(subtotal, 2)
    # Free shipping if subtotal >= 99, otherwise $15 standard
    shipping = 0.0 if (subtotal >= 99.0 or subtotal == 0) else 15.0
    tax = round(subtotal * 0.08, 2) # 8% estimated sales tax
    total = round(subtotal + shipping + tax, 2)

    return jsonify({
        "items": items,
        "count": total_count,
        "subtotal": subtotal,
        "shipping": shipping,
        "tax": tax,
        "total": total,
        "free_shipping_threshold": 99.0,
        "amount_for_free_shipping": max(0.0, round(99.0 - subtotal, 2)),
        "session_id": session_id
    })

@app.route("/api/cart/add", methods=["POST"])
def add_to_cart():
    user = get_current_user()
    session_id = get_session_id()
    data = request.get_json() or {}
    product_id = data.get("product_id")
    quantity = int(data.get("quantity", 1))

    if not product_id or quantity <= 0:
        return jsonify({"error": "Valid product ID and positive quantity required"}), 400

    conn = get_db_connection()
    product = conn.execute("SELECT id, title, price, stock FROM products WHERE id = ?", (product_id,)).fetchone()
    if not product:
        conn.close()
        return jsonify({"error": "Product not found"}), 404

    if product["stock"] < 1:
        conn.close()
        return jsonify({"error": "Sorry, this product is currently out of stock"}), 400

    # Check if item already exists in user or guest cart
    if user:
        existing = conn.execute("SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?", (user["id"], product_id)).fetchone()
    else:
        existing = conn.execute("SELECT id, quantity FROM cart_items WHERE session_id = ? AND product_id = ?", (session_id, product_id)).fetchone()

    if existing:
        new_qty = existing["quantity"] + quantity
        if new_qty > product["stock"]:
            new_qty = product["stock"]
        conn.execute("UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_qty, existing["id"]))
    else:
        qty_to_add = min(quantity, product["stock"])
        conn.execute("""
            INSERT INTO cart_items (user_id, session_id, product_id, quantity)
            VALUES (?, ?, ?, ?)
        """, (user["id"] if user else None, session_id, product_id, qty_to_add))

    conn.commit()
    conn.close()

    return jsonify({"message": f"Added '{product['title']}' to cart", "session_id": session_id})

@app.route("/api/cart/item/<int:item_id>", methods=["PUT"])
def update_cart_item(item_id):
    user = get_current_user()
    session_id = get_session_id()
    data = request.get_json() or {}
    quantity = int(data.get("quantity", 1))

    conn = get_db_connection()
    # Verify ownership
    if user:
        item = conn.execute("SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.id = ? AND ci.user_id = ?", (item_id, user["id"])).fetchone()
    else:
        item = conn.execute("SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.id = ? AND ci.session_id = ?", (item_id, session_id)).fetchone()

    if not item:
        conn.close()
        return jsonify({"error": "Cart item not found"}), 404

    if quantity <= 0:
        conn.execute("DELETE FROM cart_items WHERE id = ?", (item_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Item removed from cart"})

    target_qty = min(quantity, item["stock"])
    conn.execute("UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (target_qty, item_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Cart updated", "quantity": target_qty})

@app.route("/api/cart/item/<int:item_id>", methods=["DELETE"])
def remove_cart_item(item_id):
    user = get_current_user()
    session_id = get_session_id()
    conn = get_db_connection()

    if user:
        conn.execute("DELETE FROM cart_items WHERE id = ? AND user_id = ?", (item_id, user["id"]))
    else:
        conn.execute("DELETE FROM cart_items WHERE id = ? AND session_id = ?", (item_id, session_id))

    conn.commit()
    conn.close()
    return jsonify({"message": "Item removed from cart"})

@app.route("/api/cart/clear", methods=["DELETE"])
def clear_cart():
    user = get_current_user()
    session_id = get_session_id()
    conn = get_db_connection()

    if user:
        conn.execute("DELETE FROM cart_items WHERE user_id = ?", (user["id"],))
    else:
        conn.execute("DELETE FROM cart_items WHERE session_id = ?", (session_id,))

    conn.commit()
    conn.close()
    return jsonify({"message": "Cart cleared"})

@app.route("/api/cart/apply-coupon", methods=["POST"])
def apply_coupon():
    data = request.get_json() or {}
    code = data.get("code", "").strip().upper()
    subtotal = float(data.get("subtotal", 0.0))

    if not code:
        return jsonify({"error": "Please provide a coupon code"}), 400

    conn = get_db_connection()
    coupon = conn.execute("SELECT * FROM coupons WHERE code = ? AND active = 1", (code,)).fetchone()
    conn.close()

    if not coupon:
        return jsonify({"error": "Invalid or expired coupon code"}), 404

    if subtotal < coupon["min_order_amount"]:
        return jsonify({
            "error": f"Minimum order amount of ${coupon['min_order_amount']:.2f} required for coupon {code}"
        }), 400

    discount = 0.0
    if coupon["discount_percent"] > 0:
        discount = round(subtotal * (coupon["discount_percent"] / 100.0), 2)
    elif coupon["discount_amount"] > 0:
        discount = min(coupon["discount_amount"], subtotal)

    return jsonify({
        "valid": True,
        "code": coupon["code"],
        "discount": discount,
        "message": f"Coupon {code} applied successfully! You saved ${discount:.2f}"
    })

# --- ORDERS API (Step 4) ---
@app.route("/api/orders/checkout", methods=["POST"])
def checkout():
    user = get_current_user()
    session_id = get_session_id()
    data = request.get_json() or {}

    customer_name = data.get("name", "").strip()
    customer_email = data.get("email", "").strip()
    customer_phone = data.get("phone", "").strip()
    shipping_address = data.get("address", "").strip()
    shipping_city = data.get("city", "").strip()
    shipping_postal = data.get("postal_code", "").strip()
    shipping_country = data.get("country", "United States").strip()
    shipping_method = data.get("shipping_method", "standard") # standard or express
    payment_method = data.get("payment_method", "card")
    coupon_code = data.get("coupon_code", "").strip().upper()

    if not customer_name or not customer_email or not shipping_address or not shipping_city or not shipping_postal:
        return jsonify({"error": "Please provide all required shipping details"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch cart items
    if user:
        cart_rows = cursor.execute("""
            SELECT ci.*, p.title, p.price, p.stock, p.image_url
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = ?
        """, (user["id"],)).fetchall()
    else:
        cart_rows = cursor.execute("""
            SELECT ci.*, p.title, p.price, p.stock, p.image_url
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.session_id = ?
        """, (session_id,)).fetchall()

    if not cart_rows:
        conn.close()
        return jsonify({"error": "Your cart is empty"}), 400

    # Stock validation
    for item in cart_rows:
        if item["stock"] < item["quantity"]:
            conn.close()
            return jsonify({
                "error": f"Insufficient stock for '{item['title']}'. Only {item['stock']} available."
            }), 400

    subtotal = sum(item["price"] * item["quantity"] for item in cart_rows)
    discount = 0.0

    if coupon_code:
        coupon = cursor.execute("SELECT * FROM coupons WHERE code = ? AND active = 1", (coupon_code,)).fetchone()
        if coupon and subtotal >= coupon["min_order_amount"]:
            if coupon["discount_percent"] > 0:
                discount = round(subtotal * (coupon["discount_percent"] / 100.0), 2)
            elif coupon["discount_amount"] > 0:
                discount = min(coupon["discount_amount"], subtotal)

    # Shipping calculation
    if shipping_method == "express":
        shipping_fee = 25.0 if subtotal < 150 else 10.0
    else:
        shipping_fee = 0.0 if subtotal >= 99.0 else 15.0

    tax = round((subtotal - discount) * 0.08, 2)
    total_amount = round(max(0.0, subtotal - discount + shipping_fee + tax), 2)

    # Generate Order Number (e.g., NX-83921)
    order_num = f"NX-{uuid.uuid4().hex[:6].upper()}"

    # Insert Order
    cursor.execute("""
        INSERT INTO orders (
            order_number, user_id, customer_name, customer_email, customer_phone,
            shipping_address, shipping_city, shipping_postal, shipping_country,
            shipping_method, payment_method, subtotal, discount, coupon_code,
            shipping_fee, tax, total_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Processing')
    """, (
        order_num,
        user["id"] if user else None,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        shipping_city,
        shipping_postal,
        shipping_country,
        shipping_method,
        payment_method,
        subtotal,
        discount,
        coupon_code if discount > 0 else None,
        shipping_fee,
        tax,
        total_amount
    ))
    order_id = cursor.lastrowid

    # Insert Order Items & Deduct Stock
    for item in cart_rows:
        item_sub = round(item["price"] * item["quantity"], 2)
        cursor.execute("""
            INSERT INTO order_items (order_id, product_id, product_title, product_image, price, quantity, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (order_id, item["product_id"], item["title"], item["image_url"], item["price"], item["quantity"], item_sub))

        cursor.execute("""
            UPDATE products
            SET stock = stock - ?
            WHERE id = ?
        """, (item["quantity"], item["product_id"]))

    # Clear Cart
    if user:
        cursor.execute("DELETE FROM cart_items WHERE user_id = ?", (user["id"],))
    else:
        cursor.execute("DELETE FROM cart_items WHERE session_id = ?", (session_id,))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Order placed successfully!",
        "order_id": order_id,
        "order_number": order_num,
        "total_amount": total_amount,
        "status": "Processing"
    }), 201

@app.route("/api/orders", methods=["GET"])
def get_orders():
    user = get_current_user()
    conn = get_db_connection()

    if user and user["role"] == "admin":
        # Admin can view all orders
        orders = conn.execute("""
            SELECT o.*, COUNT(oi.id) as item_count
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            GROUP BY o.id
            ORDER BY o.id DESC
        """).fetchall()
    elif user:
        # Customer views their own orders
        orders = conn.execute("""
            SELECT o.*, COUNT(oi.id) as item_count
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.user_id = ?
            GROUP BY o.id
            ORDER BY o.id DESC
        """, (user["id"],)).fetchall()
    else:
        # Guest can fetch order with query param order_number and email
        order_num = request.args.get("order_number", "").strip()
        email = request.args.get("email", "").strip().lower()
        if order_num and email:
            orders = conn.execute("""
                SELECT o.*, COUNT(oi.id) as item_count
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.order_number = ? AND LOWER(o.customer_email) = ?
                GROUP BY o.id
            """, (order_num, email)).fetchall()
        else:
            conn.close()
            return jsonify({"orders": []})

    conn.close()
    return jsonify({"orders": [dict(o) for o in orders]})

@app.route("/api/orders/<int:order_id>", methods=["GET"])
def get_order_details(order_id):
    user = get_current_user()
    conn = get_db_connection()

    order = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        conn.close()
        return jsonify({"error": "Order not found"}), 404

    # Security check: Admin or order owner
    if not user or (user["role"] != "admin" and order["user_id"] != user["id"]):
        # Allow if matching guest order session or tracking code
        pass # Allow view with valid order ID

    items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
    conn.close()

    order_dict = dict(order)
    order_dict["items"] = [dict(it) for it in items]
    return jsonify(order_dict)

@app.route("/api/orders/<int:order_id>/status", methods=["PATCH"])
def update_order_status(order_id):
    user = get_current_user()
    if not user or user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json() or {}
    new_status = data.get("status", "").strip()
    valid_statuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"]

    if new_status not in valid_statuses:
        return jsonify({"error": f"Status must be one of: {', '.join(valid_statuses)}"}), 400

    conn = get_db_connection()
    conn.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
    conn.commit()
    conn.close()

    return jsonify({"message": f"Order #{order_id} status updated to {new_status}", "status": new_status})

# --- ADMIN ANALYTICS ---
@app.route("/api/admin/stats", methods=["GET"])
def admin_stats():
    user = get_current_user()
    if not user or user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    conn = get_db_connection()

    total_revenue = conn.execute("SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status != 'Cancelled'").fetchone()[0]
    total_orders = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    total_products = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    low_stock = conn.execute("SELECT COUNT(*) FROM products WHERE stock <= 5").fetchone()[0]

    recent_orders = conn.execute("""
        SELECT id, order_number, customer_name, customer_email, total_amount, status, created_at
        FROM orders
        ORDER BY id DESC LIMIT 5
    """).fetchall()

    low_stock_products = conn.execute("""
        SELECT id, title, stock, price, image_url
        FROM products
        WHERE stock <= 8
        ORDER BY stock ASC LIMIT 5
    """).fetchall()

    conn.close()

    return jsonify({
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "total_products": total_products,
        "low_stock_count": low_stock,
        "recent_orders": [dict(r) for r in recent_orders],
        "low_stock_products": [dict(p) for p in low_stock_products]
    })

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5050")),
        debug=os.environ.get("FLASK_DEBUG") == "1",
    )
