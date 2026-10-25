"""
database.py - SQLite Database Schema, Connection, and Seeding for Nexus Luxe E-Commerce
"""
import sqlite3
import os
import json
from werkzeug.security import generate_password_hash

DB_PATH = os.environ.get(
    "DATABASE_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "ecommerce.db"),
)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        phone TEXT,
        address TEXT,
        city TEXT,
        postal_code TEXT,
        country TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. Categories Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        icon TEXT NOT NULL,
        description TEXT
    )
    """)

    # 3. Products Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL,
        original_price REAL,
        category_id INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 10,
        rating REAL DEFAULT 4.5,
        review_count INTEGER DEFAULT 0,
        featured INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        specs TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
    )
    """)

    # 4. Cart Items Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        session_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    )
    """)

    # 5. Orders Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        user_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        shipping_address TEXT NOT NULL,
        shipping_city TEXT NOT NULL,
        shipping_postal TEXT NOT NULL,
        shipping_country TEXT NOT NULL,
        shipping_method TEXT NOT NULL DEFAULT 'standard',
        payment_method TEXT NOT NULL DEFAULT 'card',
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        coupon_code TEXT,
        shipping_fee REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'Processing',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )
    """)

    # 6. Order Items Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_title TEXT NOT NULL,
        product_image TEXT,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
    )
    """)

    # 7. Coupons Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_percent REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        min_order_amount REAL DEFAULT 0,
        active INTEGER DEFAULT 1
    )
    """)

    conn.commit()
    seed_initial_data(conn)
    conn.close()
    print("Database initialized successfully.")

def seed_initial_data(conn):
    cursor = conn.cursor()

    # Check if already seeded
    cursor.execute("SELECT COUNT(*) FROM categories")
    if cursor.fetchone()[0] > 0:
        return

    # Seed Default Users
    users_data = [
        (
            "Nexus Admin",
            "admin@nexusluxe.com",
            generate_password_hash("Admin@123"),
            "admin",
            "+1 (555) 019-2834",
            "100 Innovation Blvd, Suite 400",
            "San Francisco",
            "94107",
            "United States"
        ),
        (
            "Sophia Vance",
            "sophia@example.com",
            generate_password_hash("Customer@123"),
            "customer",
            "+1 (555) 782-9301",
            "742 Evergreen Terrace",
            "Seattle",
            "98101",
            "United States"
        )
    ]
    cursor.executemany("""
    INSERT INTO users (name, email, password_hash, role, phone, address, city, postal_code, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, users_data)

    # Seed Categories
    categories_data = [
        ("Audio & Sound", "audio-sound", "headphones", "Audiophile-grade wireless and studio audio equipment"),
        ("Smart Electronics", "smart-electronics", "cpu", "Next-generation wearable devices and smart tech"),
        ("Computer & Desk", "computer-desk", "monitor", "Ergonomic peripherals, mechanical keyboards, and displays"),
        ("Designer Apparel", "designer-apparel", "shopping-bag", "Modern minimalist streetwear and luxury accessories"),
        ("Living & Decor", "living-decor", "home", "Aesthetic smart ambient home accents and desk accessories")
    ]
    cursor.executemany("""
    INSERT INTO categories (name, slug, icon, description)
    VALUES (?, ?, ?, ?)
    """, categories_data)

    # Category IDs lookup
    cursor.execute("SELECT id, slug FROM categories")
    cat_map = {row["slug"]: row["id"] for row in cursor.fetchall()}

    # Seed Products
    products_data = [
        (
            "Aura ANC Wireless Studio Headphones",
            "aura-anc-wireless-studio-headphones",
            "Engineered with custom 45mm neodymium drivers, hybrid active noise cancellation, transparency mode, and ultra-plush memory foam earcups for up to 40 hours of lossless hi-res audio playback.",
            299.99,
            349.99,
            cat_map["audio-sound"],
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
            18,
            4.9,
            128,
            1,
            json.dumps(["wireless", "noise-cancelling", "audiophile", "bluetooth-5.3"]),
            json.dumps({"Battery Life": "40 Hours", "Driver Size": "45mm", "Connectivity": "Bluetooth 5.3 / 3.5mm AUX", "Weight": "260g"})
        ),
        (
            "Vertex Nova Chrono Smartwatch Ultra",
            "vertex-nova-chrono-smartwatch-ultra",
            "Precision-crafted titanium alloy chassis with sapphire glass, 1.96-inch Always-On Retina AMOLED display, dual-frequency GPS, biometric sensors, and 100m water resistance.",
            449.00,
            499.00,
            cat_map["smart-electronics"],
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
            12,
            4.8,
            94,
            1,
            json.dumps(["smartwatch", "titanium", "amoled", "fitness"]),
            json.dumps({"Chassis": "Aerospace Titanium", "Display": "1.96\" AMOLED (1000 nits)", "Battery": "Up to 7 Days", "Water Resistance": "10 ATM / 100m"})
        ),
        (
            "KeebPulse Lumina 75% Mechanical Keyboard",
            "keebpulse-lumina-75-mechanical-keyboard",
            "Hot-swappable gasket mount mechanical keyboard with lubed linear switches, south-facing per-key RGB backlighting, CNC anodized aluminum frame, and sound dampening silicone foams.",
            179.50,
            219.00,
            cat_map["computer-desk"],
            "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80",
            24,
            4.9,
            210,
            1,
            json.dumps(["mechanical", "gasket-mount", "rgb", "hot-swap"]),
            json.dumps({"Layout": "75% Compact (82 Keys)", "Switches": "Factory Lubed Linear 45g", "Connection": "Tri-Mode (BT/2.4G/USB-C)", "Keycaps": "Double-shot PBT Cherry Profile"})
        ),
        (
            "CyberMinimalist EDC Waterproof Tech Backpack",
            "cyberminimalist-edc-waterproof-tech-backpack",
            "Constructed from 840D Cordura ballistic nylon with YKK Aquaguard zippers, dedicated padded 16\" laptop sleeve, magnetic Fidlock buckles, and ergonomic airflow back cushioning.",
            145.00,
            180.00,
            cat_map["designer-apparel"],
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80",
            15,
            4.7,
            76,
            0,
            json.dumps(["backpack", "waterproof", "tech-gear", "travel"]),
            json.dumps({"Capacity": "24 Liters", "Material": "840D Ballistic Nylon", "Laptop Compartment": "Up to 16\" MacBook Pro", "Dimensions": "48 x 30 x 16 cm"})
        ),
        (
            "Prism Beam Wireless Fast Desktop Charger",
            "prism-beam-wireless-fast-desktop-charger",
            "Architectural cast-aluminum 3-in-1 magnetic charging stand supporting fast 15W MagSafe charging for your smartphone, smartwatch, and earbuds simultaneously with minimalist cable routing.",
            89.99,
            109.99,
            cat_map["smart-electronics"],
            "https://images.unsplash.com/photo-1622445262464-84b1456045b6?w=800&auto=format&fit=crop&q=80",
            30,
            4.6,
            53,
            0,
            json.dumps(["charger", "magsafe", "wireless", "aluminum"]),
            json.dumps({"Input": "USB-C PD 45W", "Phone Output": "15W MagSafe Fast Charge", "Watch Output": "5W", "Materials": "CNC Aluminum & Vegan Leather"})
        ),
        (
            "SonicSphere Spatial 360 Home Speaker",
            "sonicsphere-spatial-360-home-speaker",
            "Omnidirectional architectural home speaker featuring acoustic wave guides, dual passive bass radiators, Wi-Fi 6 lossless streaming, AirPlay 2, and ambient reactive glow ring.",
            239.00,
            279.00,
            cat_map["audio-sound"],
            "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80",
            8,
            4.8,
            88,
            1,
            json.dumps(["speaker", "spatial-audio", "airplay", "home-audio"]),
            json.dumps({"Acoustic Output": "80W RMS Peak", "Frequency Range": "38Hz - 22kHz", "Wireless": "Wi-Fi 6 & Bluetooth 5.3", "Microphone": "Far-field voice control"})
        ),
        (
            "AeroGlide Carbon Fiber Precision Mouse",
            "aeroglide-carbon-fiber-precision-mouse",
            "Ultra-lightweight 49-gram wireless gaming and productivity mouse featuring a forged carbon fiber composite shell, 30,000 DPI optical sensor, and zero-latency 4K polling rate.",
            119.00,
            139.00,
            cat_map["computer-desk"],
            "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80",
            20,
            4.9,
            142,
            0,
            json.dumps(["mouse", "wireless", "carbon-fiber", "lightweight"]),
            json.dumps({"Weight": "49 Grams", "Sensor": "PixArt PAW3395 (30k DPI)", "Polling Rate": "4000Hz Wireless", "Battery": "80 Hours"})
        ),
        (
            "Solstice Ambient Smart Glow Lamp",
            "solstice-ambient-smart-glow-lamp",
            "Sculptural desk and bedside lamp with hand-blown matte glass globe, stepped brass pillar base, dynamic circadian light temperature shifts, and touch-sensitive stepless dimmer.",
            129.00,
            159.00,
            cat_map["living-decor"],
            "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80",
            5,
            4.7,
            49,
            0,
            json.dumps(["lighting", "smart-home", "minimalist", "ambient"]),
            json.dumps({"Lumens": "850 Lumens", "Color Temperature": "1800K - 6500K Tunable", "Control": "Touch Sensor + Smart App", "Base": "Solid Brushed Brass"})
        ),
        (
            "MonoCurve Polarized Acetate Sunglasses",
            "monocurve-polarized-acetate-sunglasses",
            "Handcrafted Japanese cellulose acetate frame fitted with scratch-resistant polarized CR-39 gradient lenses delivering 100% UVA/UVB UV400 complete optical protection.",
            155.00,
            195.00,
            cat_map["designer-apparel"],
            "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80",
            14,
            4.8,
            67,
            0,
            json.dumps(["eyewear", "polarized", "acetate", "fashion"]),
            json.dumps({"Frame": "Handcrafted Japanese Acetate", "Lenses": "CR-39 Polarized Gradient", "Protection": "100% UV400 UVA/UVB", "Hinges": "5-Barrel German Steel"})
        ),
        (
            "Nomad Leather Mag-Wallet Stand",
            "nomad-leather-mag-wallet-stand",
            "Horween full-grain vegetable-tanned leather slim wallet with integrated multi-angle magnetic folding kickstand, holds up to 3 cards with RFID blocking security shield.",
            48.00,
            60.00,
            cat_map["designer-apparel"],
            "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80",
            40,
            4.5,
            112,
            0,
            json.dumps(["wallet", "leather", "magsafe", "rfid"]),
            json.dumps({"Material": "Full-grain Horween Leather", "Capacity": "3 Cards + Cash", "Stand Angles": "Portrait 60° / Landscape 45°", "Shielding": "RFID Blocking Layer"})
        ),
        (
            "Zenith 4K Pro Ultrawide Curved Monitor",
            "zenith-4k-pro-ultrawide-curved-monitor",
            "34-inch 1800R curved Nano-IPS panel with 3440x1440 resolution, 98% DCI-P3 color gamut, HDR600 certification, USB-C 90W single-cable hub power delivery, and built-in KVM switch.",
            799.00,
            899.00,
            cat_map["computer-desk"],
            "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80",
            6,
            4.9,
            83,
            1,
            json.dumps(["monitor", "ultrawide", "4k", "ips", "usb-c"]),
            json.dumps({"Panel": "34\" Curved Nano-IPS (1800R)", "Resolution": "3440 x 1440 @ 144Hz", "Color Accuracy": "Delta E < 2, 98% DCI-P3", "Power Delivery": "90W USB-C PD"})
        ),
        (
            "Nebula Smart Ultrasonic Aromatherapy Diffuser",
            "nebula-smart-ultrasonic-aromatherapy-diffuser",
            "Carved volcanic rock ceramic casing with gentle ultrasonic cool-mist atomization, RGB underglow ambient ring, schedule timers, and whisper-quiet 20dB operation.",
            69.00,
            85.00,
            cat_map["living-decor"],
            "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&auto=format&fit=crop&q=80",
            22,
            4.6,
            64,
            0,
            json.dumps(["diffuser", "aromatherapy", "ceramic", "wellness"]),
            json.dumps({"Capacity": "300ml Reservoir", "Coverage Area": "Up to 400 sq. ft.", "Run Time": "12 Hours Intermittent / 8 Continuous", "Sound Level": "< 20 dB"})
        )
    ]

    cursor.executemany("""
    INSERT INTO products (title, slug, description, price, original_price, category_id, image_url, stock, rating, review_count, featured, tags, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, products_data)

    # Seed Coupons
    coupons_data = [
        ("SAVE10", 10.0, 0.0, 50.0, 1),
        ("LUXE25", 25.0, 0.0, 150.0, 1),
        ("FREESHIP", 0.0, 15.0, 0.0, 1),
        ("WELCOME20", 20.0, 0.0, 75.0, 1)
    ]
    cursor.executemany("""
    INSERT INTO coupons (code, discount_percent, discount_amount, min_order_amount, active)
    VALUES (?, ?, ?, ?, ?)
    """, coupons_data)

    # Seed a sample completed order for Sophia Vance
    cursor.execute("SELECT id FROM users WHERE email = 'sophia@example.com'")
    sophia = cursor.fetchone()
    if sophia:
        order_num = "NX-94821"
        cursor.execute("""
        INSERT INTO orders (
            order_number, user_id, customer_name, customer_email, customer_phone,
            shipping_address, shipping_city, shipping_postal, shipping_country,
            shipping_method, payment_method, subtotal, discount, coupon_code,
            shipping_fee, tax, total_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            order_num,
            sophia["id"],
            "Sophia Vance",
            "sophia@example.com",
            "+1 (555) 782-9301",
            "742 Evergreen Terrace",
            "Seattle",
            "98101",
            "United States",
            "express",
            "card",
            299.99,
            30.00,
            "SAVE10",
            0.0,
            24.30,
            294.29,
            "Delivered"
        ))
        order_id = cursor.lastrowid
        cursor.execute("""
        INSERT INTO order_items (order_id, product_id, product_title, product_image, price, quantity, subtotal)
        VALUES (?, 1, 'Aura ANC Wireless Studio Headphones', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80', 299.99, 1, 299.99)
        """, (order_id,))

    conn.commit()

if __name__ == "__main__":
    init_db()
