from __future__ import annotations

import json
import os
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .auth import consume_ws_token, current_user, router as auth_router
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR.parent / "adega.db"
STATIC_DIR = BASE_DIR / "static"
TEMPLATE_DIR = BASE_DIR / "templates"



@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS products (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              category TEXT NOT NULL,
              sku TEXT UNIQUE,
              barcode TEXT,
              cost REAL NOT NULL DEFAULT 0,
              price REAL NOT NULL CHECK(price >= 0),
              stock INTEGER NOT NULL DEFAULT 0,
              min_stock INTEGER NOT NULL DEFAULT 5,
              active INTEGER NOT NULL DEFAULT 1,
              storefront INTEGER NOT NULL DEFAULT 1,
              volume_ml INTEGER,
              image_url TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS customers (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              phone TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS suppliers (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              contact TEXT,
              phone TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orders (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              channel TEXT NOT NULL,
              payment_method TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'confirmed',
              customer_id INTEGER,
              subtotal REAL NOT NULL,
              discount REAL NOT NULL DEFAULT 0,
              total REAL NOT NULL,
              external_id TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(customer_id) REFERENCES customers(id)
            );

            CREATE TABLE IF NOT EXISTS order_items (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              order_id INTEGER NOT NULL,
              product_id INTEGER NOT NULL,
              product_name TEXT NOT NULL,
              qty INTEGER NOT NULL CHECK(qty > 0),
              unit_price REAL NOT NULL,
              total REAL NOT NULL,
              FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
              FOREIGN KEY(product_id) REFERENCES products(id)
            );

            CREATE TABLE IF NOT EXISTS expenses (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              description TEXT NOT NULL,
              category TEXT NOT NULL,
              amount REAL NOT NULL CHECK(amount >= 0),
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS integrations (
              slug TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'not_configured',
              last_sync TEXT,
              note TEXT
            );

            CREATE TABLE IF NOT EXISTS audit_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              action TEXT NOT NULL,
              entity TEXT NOT NULL,
              entity_id TEXT,
              detail TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS promotions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              type TEXT NOT NULL DEFAULT 'Produto',
              period TEXT NOT NULL DEFAULT 'Sem período',
              status TEXT NOT NULL DEFAULT 'Rascunho',
              discount_type TEXT NOT NULL DEFAULT 'percent',
              value REAL NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            );
            """
        )

        product_columns = {row["name"] for row in conn.execute("PRAGMA table_info(products)").fetchall()}
        if "volume_ml" not in product_columns:
            conn.execute("ALTER TABLE products ADD COLUMN volume_ml INTEGER")
        if "image_url" not in product_columns:
            conn.execute("ALTER TABLE products ADD COLUMN image_url TEXT")

        count = conn.execute("SELECT COUNT(*) c FROM products").fetchone()["c"]
        if count == 0:
            products = [
                ("Heineken Long Neck 330ml", "Cervejas", "HEI330", 4.30, 7.90, 32, 12),
                ("Budweiser Long Neck 330ml", "Cervejas", "BUD330", 3.80, 6.90, 27, 12),
                ("Red Bull 250ml", "Energéticos", "RB250", 6.20, 10.90, 18, 8),
                ("Skol Pilsen 350ml", "Cervejas", "SK350", 2.70, 4.50, 15, 10),
                ("Jack Daniel's 1L", "Whisky", "JD1L", 112.00, 179.90, 11, 5),
                ("Vodka Absolut 750ml", "Vodka", "ABS750", 44.00, 69.90, 9, 5),
            ]
            conn.executemany(
                "INSERT INTO products(name,category,sku,cost,price,stock,min_stock,created_at) VALUES(?,?,?,?,?,?,?,?)",
                [(*p, now_iso()) for p in products],
            )

        # Catálogo de demonstração complementar para a UI premium.
        for extra in [
            ("Coca-Cola 2L", "Refrigerantes", "COCA2L", 6.20, 9.49, 24, 8),
            ("Campari 750ml", "Destilados", "CAMP750", 52.00, 79.90, 8, 4),
            ("Johnnie Walker Red Label 1L", "Whisky", "JWRED1L", 62.00, 89.90, 10, 4),
            ("Gin Tanqueray 750ml", "Gin", "TANQ750", 89.00, 129.90, 7, 4),
        ]:
            conn.execute(
                "INSERT OR IGNORE INTO products(name,category,sku,cost,price,stock,min_stock,created_at) VALUES(?,?,?,?,?,?,?,?)",
                (*extra, now_iso()),
            )

        for slug, name in [
            ("storefront", "Vitrine própria"),
            ("ifood", "iFood"),
            ("whatsapp", "WhatsApp Business"),
            ("pix", "PIX / Maquininha"),
        ]:
            conn.execute(
                "INSERT OR IGNORE INTO integrations(slug,name,status,note) VALUES(?,?,?,?)",
                (slug, name, "ready" if slug == "storefront" else "not_configured", "Conector preparado; requer configuração real."),
            )

        defaults = {
            "store_name": "Adega CRM",
            "whatsapp": "",
            "pix_key": "",
            "delivery_fee": "0",
            "minimum_order": "0",
            "store_open": "true",
        }
        for k, v in defaults.items():
            conn.execute("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", (k, v))


        # Privacy baseline: customer PII is not retained by the CRM.
        # Existing legacy rows are detached and erased on startup.
        conn.execute("UPDATE orders SET customer_id=NULL WHERE customer_id IS NOT NULL")
        conn.execute("DELETE FROM customers")

        promo_count = conn.execute("SELECT COUNT(*) c FROM promotions").fetchone()["c"]
        if promo_count == 0:
            conn.executemany(
                "INSERT INTO promotions(name,type,period,status,discount_type,value,created_at) VALUES(?,?,?,?,?,?,?)",
                [
                    ("Heineken Fardo", "Produto", "01/05 a 31/05", "Ativa", "fixed", 10, now_iso()),
                    ("Combo Whisky", "Combo", "15/05 a 30/05", "Ativa", "percent", 12, now_iso()),
                    ("Sextou com Desconto", "Cupom", "Sextas-feiras", "Agendada", "percent", 10, now_iso()),
                ],
            )

        # Dados ricos somente para o ambiente público de demonstração.
        if os.getenv("ADEGA_DEMO_MODE", "false").lower() == "true":
            conn.execute("INSERT INTO settings(key,value) VALUES('store_name','Adega Premium') ON CONFLICT(key) DO UPDATE SET value=excluded.value")
            if conn.execute("SELECT COUNT(*) c FROM customers").fetchone()["c"] == 0:
                for idx, (name, phone) in enumerate([
                    ("Marcos Oliveira", "11987654321"),
                    ("Fernanda Costa", "11976543210"),
                    ("Lucas Almeida", "11965432109"),
                    ("Camila Souza", "11954321098"),
                    ("Rafael Santos", "11943210987"),
                ]):
                    conn.execute("INSERT INTO customers(name,phone,created_at) VALUES(?,?,?)", (name, phone, (datetime.now(timezone.utc)-timedelta(days=idx)).isoformat()))
            if conn.execute("SELECT COUNT(*) c FROM expenses").fetchone()["c"] == 0:
                for desc, category, amount, days in [
                    ("Reposição de gelo", "Operacional", 185.0, 1),
                    ("Entrega fornecedor", "Logística", 96.5, 2),
                    ("Material de embalagem", "Operacional", 132.9, 4),
                ]:
                    conn.execute("INSERT INTO expenses(description,category,amount,created_at) VALUES(?,?,?,?)", (desc, category, amount, (datetime.now(timezone.utc)-timedelta(days=days)).isoformat()))
            if conn.execute("SELECT COUNT(*) c FROM orders").fetchone()["c"] == 0:
                products_demo = [dict(r) for r in conn.execute("SELECT id,name,price FROM products WHERE active=1 ORDER BY id").fetchall()]
                customer_ids = [int(r["id"]) for r in conn.execute("SELECT id FROM customers ORDER BY id LIMIT 5").fetchall()]
                channels = ["pdv", "storefront", "whatsapp", "pdv", "storefront"]
                payments = ["pix", "card", "pix", "cash", "card"]
                if products_demo and customer_ids:
                    for days in range(12):
                        for j in range(2 + days % 3):
                            dt = datetime.now(timezone.utc) - timedelta(days=days, hours=j*2+1)
                            picked = [products_demo[(days+j) % len(products_demo)], products_demo[(days+j+3) % len(products_demo)]]
                            qtys = [1 + (j % 2), 1]
                            subtotal = sum(float(item["price"]) * qty for item, qty in zip(picked, qtys))
                            discount = 5.0 if j == 1 and subtotal > 50 else 0.0
                            total = subtotal - discount
                            cur = conn.execute(
                                "INSERT INTO orders(channel,payment_method,status,customer_id,subtotal,discount,total,external_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
                                (channels[(days+j)%len(channels)], payments[(days+j)%len(payments)], "confirmed", customer_ids[(days+j)%len(customer_ids)], subtotal, discount, total, f"DEMO-{days:02d}{j:02d}", dt.isoformat()),
                            )
                            order_id = int(cur.lastrowid)
                            for item, qty in zip(picked, qtys):
                                conn.execute("INSERT INTO order_items(order_id,product_id,product_name,qty,unit_price,total) VALUES(?,?,?,?,?,?)", (order_id, item["id"], item["name"], qty, item["price"], float(item["price"])*qty))


init_db()
app = FastAPI(title="Adega CRM API", version="1.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.include_router(auth_router)


@app.middleware("http")
async def require_manager_session(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)
    if path == "/api/health" or path.startswith("/api/auth/"):
        return await call_next(request)
    if path == "/api/storefront/orders":
        return await call_next(request)
    if path == "/api/storefront/settings" and request.method == "GET":
        return await call_next(request)
    if path == "/api/products" and request.method == "GET" and request.query_params.get("storefront") == "true":
        return await call_next(request)
    if not current_user(request):
        return JSONResponse(status_code=401, content={"detail": "Autenticação necessária"})
    return await call_next(request)

class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=2, max_length=60)
    sku: str | None = Field(default=None, max_length=40)
    barcode: str | None = Field(default=None, max_length=60)
    cost: float = Field(default=0, ge=0)
    price: float = Field(ge=0)
    stock: int = Field(default=0, ge=0)
    min_stock: int = Field(default=5, ge=0)
    storefront: bool = True
    volume_ml: int | None = Field(default=None, gt=0, le=10000)
    image_url: str | None = Field(default=None, max_length=1000)


class StockAdjust(BaseModel):
    delta: int
    reason: str = Field(min_length=2, max_length=120)


class OrderLine(BaseModel):
    product_id: int
    qty: int = Field(gt=0, le=999)


class OrderIn(BaseModel):
    channel: str = Field(default="pdv", pattern="^(pdv|storefront|ifood|whatsapp)$")
    payment_method: str = Field(default="pix", pattern="^(pix|card|cash|ifood|other)$")
    items: list[OrderLine] = Field(min_length=1)
    discount: float = Field(default=0, ge=0)
    # Transient checkout data: processed only in-memory and never persisted.
    customer_name: str | None = Field(default=None, max_length=120)
    customer_phone: str | None = Field(default=None, max_length=30)
    external_id: str | None = Field(default=None, max_length=120)


class SimpleName(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    contact: str | None = Field(default=None, max_length=120)


class ExpenseIn(BaseModel):
    description: str = Field(min_length=2, max_length=160)
    category: str = Field(min_length=2, max_length=80)
    amount: float = Field(gt=0)


class PromotionIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    type: str = Field(default="Produto", max_length=40)
    period: str = Field(default="Sem período", max_length=80)
    status: str = Field(default="Rascunho", pattern="^(Ativa|Agendada|Rascunho|Encerrada)$")
    discount_type: str = Field(default="percent", pattern="^(percent|fixed)$")
    value: float = Field(default=0, ge=0)


class SettingsIn(BaseModel):
    store_name: str = Field(min_length=2, max_length=120)
    whatsapp: str = Field(default="", max_length=30)
    pix_key: str = Field(default="", max_length=160)
    delivery_fee: float = Field(default=0, ge=0)
    minimum_order: float = Field(default=0, ge=0)
    store_open: bool = True


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self.connections:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@app.get("/")
def root():
    return RedirectResponse("http://127.0.0.1:3000/gestor", status_code=307)


@app.get("/gestor")
def gestor():
    return RedirectResponse("http://127.0.0.1:3000/gestor", status_code=307)


@app.get("/vitrine")
def vitrine():
    return RedirectResponse("http://127.0.0.1:3000/vitrine", status_code=307)


@app.get("/api/health")
def health():
    return {"ok": True, "version": app.version}


def rows(query: str, params: tuple = ()) -> list[dict[str, Any]]:
    with db() as conn:
        return [dict(r) for r in conn.execute(query, params).fetchall()]


@app.get("/api/dashboard")
def dashboard():
    with db() as conn:
        today = datetime.now().date().isoformat()
        revenue = conn.execute("SELECT COALESCE(SUM(total),0) v FROM orders WHERE substr(created_at,1,10)=? AND status='confirmed'", (today,)).fetchone()["v"]
        sales = conn.execute("SELECT COUNT(*) v FROM orders WHERE substr(created_at,1,10)=? AND status='confirmed'", (today,)).fetchone()["v"]
        units = conn.execute("SELECT COALESCE(SUM(oi.qty),0) v FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE substr(o.created_at,1,10)=? AND o.status='confirmed'", (today,)).fetchone()["v"]
        cogs = conn.execute("SELECT COALESCE(SUM(oi.qty*p.cost),0) v FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id WHERE substr(o.created_at,1,10)=? AND o.status='confirmed'", (today,)).fetchone()["v"]
        expenses = conn.execute("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE substr(created_at,1,10)=?", (today,)).fetchone()["v"]
        by_channel = [dict(r) for r in conn.execute("SELECT channel,COUNT(*) orders,COALESCE(SUM(total),0) revenue FROM orders WHERE status='confirmed' GROUP BY channel ORDER BY revenue DESC").fetchall()]
        payments = [dict(r) for r in conn.execute("SELECT payment_method,COUNT(*) orders,COALESCE(SUM(total),0) revenue FROM orders WHERE status='confirmed' GROUP BY payment_method ORDER BY revenue DESC").fetchall()]
        recent = [dict(r) for r in conn.execute("SELECT id,channel,payment_method,total,status,created_at FROM orders ORDER BY id DESC LIMIT 8").fetchall()]
        low_stock = [dict(r) for r in conn.execute("SELECT id,name,stock,min_stock FROM products WHERE active=1 AND stock<=min_stock ORDER BY stock ASC LIMIT 8").fetchall()]
        top_products = [dict(r) for r in conn.execute("SELECT oi.product_name name,SUM(oi.qty) qty FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='confirmed' GROUP BY oi.product_id ORDER BY qty DESC LIMIT 6").fetchall()]
        stock_value = conn.execute("SELECT COALESCE(SUM(cost*stock),0) v FROM products WHERE active=1").fetchone()["v"]
        daily_rows = {r["day"]: float(r["revenue"]) for r in conn.execute("SELECT substr(created_at,1,10) day,COALESCE(SUM(total),0) revenue FROM orders WHERE status='confirmed' AND substr(created_at,1,10)>=? GROUP BY day", ((datetime.now().date()-timedelta(days=6)).isoformat(),)).fetchall()}
        daily_revenue = []
        for offset in range(6, -1, -1):
            day = datetime.now().date() - timedelta(days=offset)
            daily_revenue.append({"date": day.isoformat(), "revenue": round(daily_rows.get(day.isoformat(), 0), 2)})
        return {
            "revenue": round(revenue, 2), "sales": sales, "ticket": round(revenue/sales, 2) if sales else 0,
            "gross_profit": round(revenue-cogs, 2), "net_result": round(revenue-cogs-expenses, 2), "units": units,
            "stock_value": round(stock_value, 2), "daily_revenue": daily_revenue,
            "channels": by_channel, "payments": payments, "recent": recent, "low_stock": low_stock, "top_products": top_products,
        }


@app.get("/api/products")
def list_products(storefront: bool | None = None):
    q = "SELECT * FROM products WHERE active=1"
    params: tuple = ()
    if storefront is True:
        q += " AND storefront=1 AND stock>0"
    q += " ORDER BY name"
    return rows(q, params)


@app.post("/api/products")
async def create_product(payload: ProductIn):
    with db() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO products(name,category,sku,barcode,cost,price,stock,min_stock,storefront,volume_ml,image_url,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                (payload.name, payload.category, payload.sku or None, payload.barcode or None, payload.cost, payload.price, payload.stock, payload.min_stock, int(payload.storefront), payload.volume_ml, payload.image_url, now_iso()),
            )
        except sqlite3.IntegrityError as exc:
            raise HTTPException(409, "SKU já cadastrado") from exc
        pid = cur.lastrowid
        conn.execute("INSERT INTO audit_log(action,entity,entity_id,detail,created_at) VALUES(?,?,?,?,?)", ("create", "product", str(pid), payload.name, now_iso()))
    await manager.broadcast({"type": "product_created", "product_id": pid})
    return {"id": pid}


@app.post("/api/products/{product_id}/stock")
async def adjust_stock(product_id: int, payload: StockAdjust):
    with db() as conn:
        row = conn.execute("SELECT stock,name FROM products WHERE id=? AND active=1", (product_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Produto não encontrado")
        new_stock = row["stock"] + payload.delta
        if new_stock < 0:
            raise HTTPException(400, "Estoque não pode ficar negativo")
        conn.execute("UPDATE products SET stock=? WHERE id=?", (new_stock, product_id))
        conn.execute("INSERT INTO audit_log(action,entity,entity_id,detail,created_at) VALUES(?,?,?,?,?)", ("stock_adjust", "product", str(product_id), json.dumps({"delta": payload.delta, "reason": payload.reason}, ensure_ascii=False), now_iso()))
    await manager.broadcast({"type": "stock_changed", "product_id": product_id, "stock": new_stock})
    return {"id": product_id, "stock": new_stock}


@app.get("/api/orders")
def list_orders(limit: int = 100):
    limit = min(max(limit, 1), 500)
    return rows("SELECT * FROM orders ORDER BY id DESC LIMIT ?", (limit,))


async def _create_order(payload: OrderIn):
    with db() as conn:
        # Zero-retention customer policy: contact data exists only for the request lifetime.
        customer_id = None

        selected: list[tuple[sqlite3.Row, int]] = []
        subtotal = 0.0
        for line in payload.items:
            p = conn.execute("SELECT * FROM products WHERE id=? AND active=1", (line.product_id,)).fetchone()
            if not p:
                raise HTTPException(404, f"Produto {line.product_id} não encontrado")
            if p["stock"] < line.qty:
                raise HTTPException(409, f"Estoque insuficiente para {p['name']}")
            selected.append((p, line.qty))
            subtotal += p["price"] * line.qty

        total = max(0.0, subtotal - payload.discount)
        cur = conn.execute(
            "INSERT INTO orders(channel,payment_method,status,customer_id,subtotal,discount,total,external_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (payload.channel, payload.payment_method, "confirmed", customer_id, round(subtotal,2), round(payload.discount,2), round(total,2), payload.external_id, now_iso()),
        )
        order_id = cur.lastrowid
        for p, qty in selected:
            conn.execute("UPDATE products SET stock=stock-? WHERE id=?", (qty, p["id"]))
            conn.execute("INSERT INTO order_items(order_id,product_id,product_name,qty,unit_price,total) VALUES(?,?,?,?,?,?)", (order_id, p["id"], p["name"], qty, p["price"], round(p["price"]*qty,2)))
        conn.execute("INSERT INTO audit_log(action,entity,entity_id,detail,created_at) VALUES(?,?,?,?,?)", ("create", "order", str(order_id), json.dumps({"channel": payload.channel, "payment": payload.payment_method, "total": round(total,2)}, ensure_ascii=False), now_iso()))
    await manager.broadcast({"type": "new_order", "order_id": order_id, "channel": payload.channel, "total": round(total,2)})
    return {"id": order_id, "total": round(total, 2), "status": "confirmed"}



@app.post("/api/orders")
async def create_order(payload: OrderIn):
    return await _create_order(payload)


@app.post("/api/storefront/orders")
async def create_storefront_order(payload: OrderIn):
    payload.channel = "storefront"
    payload.payment_method = "pix" if payload.payment_method not in {"pix", "card", "cash"} else payload.payment_method
    return await _create_order(payload)


@app.get("/api/orders/{order_id}")
def order_detail(order_id: int):
    with db() as conn:
        order = conn.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
        if not order:
            raise HTTPException(404, "Venda não encontrada")
        items = [dict(r) for r in conn.execute("SELECT * FROM order_items WHERE order_id=?", (order_id,)).fetchall()]
        return {**dict(order), "items": items}


@app.get("/api/customers")
def customers():
    """Anonymous customer analytics only; no direct customer identifiers are retained."""
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) orders, COALESCE(SUM(total),0) spent FROM orders WHERE status='confirmed'").fetchone()
        storefront = conn.execute("SELECT COUNT(*) v FROM orders WHERE status='confirmed' AND channel='storefront'").fetchone()["v"]
        return [{
            "id": "anonymous", "name": "Compras anônimas", "phone": None,
            "orders": int(total["orders"] or 0), "spent": round(float(total["spent"] or 0), 2),
            "storefront_orders": int(storefront or 0),
        }]


@app.post("/api/customers", status_code=410)
def create_customer(payload: SimpleName):
    raise HTTPException(410, "Cadastro nominal de clientes desativado por política de privacidade")


@app.get("/api/suppliers")
def suppliers():
    return rows("SELECT * FROM suppliers ORDER BY id DESC")


@app.post("/api/suppliers")
def create_supplier(payload: SimpleName):
    with db() as conn:
        cur = conn.execute("INSERT INTO suppliers(name,contact,phone,created_at) VALUES(?,?,?,?)", (payload.name, payload.contact, payload.phone, now_iso()))
        return {"id": cur.lastrowid}


@app.get("/api/finance")
def finance():
    with db() as conn:
        revenue = conn.execute("SELECT COALESCE(SUM(total),0) v FROM orders WHERE status='confirmed'").fetchone()["v"]
        expenses = conn.execute("SELECT COALESCE(SUM(amount),0) v FROM expenses").fetchone()["v"]
        cogs = conn.execute("SELECT COALESCE(SUM(oi.qty*p.cost),0) v FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id WHERE o.status='confirmed'").fetchone()["v"]
        return {"revenue": round(revenue,2), "cogs": round(cogs,2), "expenses": round(expenses,2), "net": round(revenue-cogs-expenses,2), "expense_items": [dict(r) for r in conn.execute("SELECT * FROM expenses ORDER BY id DESC LIMIT 100").fetchall()]}


@app.post("/api/finance/expenses")
def create_expense(payload: ExpenseIn):
    with db() as conn:
        cur = conn.execute("INSERT INTO expenses(description,category,amount,created_at) VALUES(?,?,?,?)", (payload.description, payload.category, payload.amount, now_iso()))
        return {"id": cur.lastrowid}


@app.get("/api/reports")
def reports_data():
    with db() as conn:
        summary = dict(conn.execute(
            """SELECT COUNT(*) orders, COALESCE(SUM(total),0) revenue,
                      COALESCE(AVG(total),0) ticket
               FROM orders WHERE status='confirmed'"""
        ).fetchone())
        summary["units"] = conn.execute(
            "SELECT COALESCE(SUM(oi.qty),0) v FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='confirmed'"
        ).fetchone()["v"]
        summary["cogs"] = conn.execute(
            "SELECT COALESCE(SUM(oi.qty*p.cost),0) v FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id WHERE o.status='confirmed'"
        ).fetchone()["v"]
        summary["expenses"] = conn.execute("SELECT COALESCE(SUM(amount),0) v FROM expenses").fetchone()["v"]
        summary["gross_profit"] = float(summary["revenue"] or 0) - float(summary["cogs"] or 0)
        summary["net"] = summary["gross_profit"] - float(summary["expenses"] or 0)
        product_profit = [dict(r) for r in conn.execute(
            """SELECT p.id,p.name,p.category,COALESCE(SUM(oi.qty),0) qty,
                      COALESCE(SUM(oi.total),0) revenue,
                      COALESCE(SUM(oi.qty*p.cost),0) cost,
                      COALESCE(SUM(oi.total-(oi.qty*p.cost)),0) profit
               FROM products p
               LEFT JOIN order_items oi ON oi.product_id=p.id
               LEFT JOIN orders o ON o.id=oi.order_id AND o.status='confirmed'
               WHERE p.active=1
               GROUP BY p.id ORDER BY profit DESC"""
        ).fetchall()]
        stock_turnover = [dict(r) for r in conn.execute(
            """SELECT p.id,p.name,p.category,p.stock,p.min_stock,COALESCE(SUM(CASE WHEN o.status='confirmed' THEN oi.qty ELSE 0 END),0) sold
               FROM products p
               LEFT JOIN order_items oi ON oi.product_id=p.id
               LEFT JOIN orders o ON o.id=oi.order_id
               WHERE p.active=1 GROUP BY p.id ORDER BY sold ASC,p.stock DESC"""
        ).fetchall()]
        channel = [dict(r) for r in conn.execute(
            "SELECT channel,COUNT(*) orders,COALESCE(SUM(total),0) revenue FROM orders WHERE status='confirmed' GROUP BY channel ORDER BY revenue DESC"
        ).fetchall()]
        payment = [dict(r) for r in conn.execute(
            "SELECT payment_method,COUNT(*) orders,COALESCE(SUM(total),0) revenue FROM orders WHERE status='confirmed' GROUP BY payment_method ORDER BY revenue DESC"
        ).fetchall()]
        daily = [dict(r) for r in conn.execute(
            """SELECT substr(created_at,1,10) day,COUNT(*) orders,COALESCE(SUM(total),0) revenue,COALESCE(AVG(total),0) ticket
               FROM orders WHERE status='confirmed' GROUP BY day ORDER BY day DESC LIMIT 30"""
        ).fetchall()][::-1]
        return {"summary": summary, "product_profit": product_profit, "stock_turnover": stock_turnover, "channels": channel, "payments": payment, "daily": daily}


@app.get("/api/promotions")
def list_promotions():
    return rows("SELECT * FROM promotions ORDER BY id DESC")


@app.post("/api/promotions")
def create_promotion(payload: PromotionIn):
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO promotions(name,type,period,status,discount_type,value,created_at) VALUES(?,?,?,?,?,?,?)",
            (payload.name,payload.type,payload.period,payload.status,payload.discount_type,payload.value,now_iso()),
        )
        pid = cur.lastrowid
        conn.execute("INSERT INTO audit_log(action,entity,entity_id,detail,created_at) VALUES(?,?,?,?,?)", ("create","promotion",str(pid),payload.name,now_iso()))
        return {"id": pid}


@app.delete("/api/promotions/{promotion_id}")
def delete_promotion(promotion_id: int):
    with db() as conn:
        row = conn.execute("SELECT name FROM promotions WHERE id=?",(promotion_id,)).fetchone()
        if not row:
            raise HTTPException(404,"Promoção não encontrada")
        conn.execute("DELETE FROM promotions WHERE id=?",(promotion_id,))
        conn.execute("INSERT INTO audit_log(action,entity,entity_id,detail,created_at) VALUES(?,?,?,?,?)", ("delete","promotion",str(promotion_id),row["name"],now_iso()))
    return {"ok": True}


@app.get("/api/integrations")
def integrations():
    return rows("SELECT * FROM integrations ORDER BY name")


@app.get("/api/storefront/settings")
def get_storefront_settings():
    with db() as conn:
        data = {r["key"]: r["value"] for r in conn.execute("SELECT * FROM settings").fetchall()}
    return {
        "store_name": data.get("store_name", "Adega CRM"),
        "whatsapp": data.get("whatsapp", ""),
        "pix_key": data.get("pix_key", ""),
        "delivery_fee": float(data.get("delivery_fee", "0")),
        "minimum_order": float(data.get("minimum_order", "0")),
        "store_open": data.get("store_open", "true") == "true",
    }


@app.get("/api/settings")
def get_settings():
    with db() as conn:
        data = {r["key"]: r["value"] for r in conn.execute("SELECT * FROM settings").fetchall()}
    return {
        "store_name": data.get("store_name", "Adega CRM"),
        "whatsapp": data.get("whatsapp", ""),
        "pix_key": data.get("pix_key", ""),
        "delivery_fee": float(data.get("delivery_fee", "0")),
        "minimum_order": float(data.get("minimum_order", "0")),
        "store_open": data.get("store_open", "true") == "true",
    }


@app.put("/api/settings")
def save_settings(payload: SettingsIn):
    values = {
        "store_name": payload.store_name,
        "whatsapp": payload.whatsapp,
        "pix_key": payload.pix_key,
        "delivery_fee": str(payload.delivery_fee),
        "minimum_order": str(payload.minimum_order),
        "store_open": "true" if payload.store_open else "false",
    }
    with db() as conn:
        for k, v in values.items():
            conn.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (k, v))
    return {"ok": True}


@app.get("/api/audit")
def audit(limit: int = 100):
    limit = min(max(limit,1),500)
    return rows("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    authenticated = current_user(ws) or consume_ws_token(ws.query_params.get("token"))
    if not authenticated:
        await ws.close(code=4401, reason="Autenticação necessária")
        return
    await manager.connect(ws)
    try:
        await ws.send_json({"type": "connected", "at": now_iso()})
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


@app.exception_handler(sqlite3.Error)
def sqlite_error(_, exc: sqlite3.Error):
    return JSONResponse(status_code=500, content={"detail": "Falha no banco de dados", "type": exc.__class__.__name__})
