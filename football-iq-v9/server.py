from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

BASE = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("FOOTBALL_IQ_DB", BASE / "football_iq.db"))
TOKEN_TTL = 60 * 60 * 24 * 30

app = FastAPI(title="Football IQ V9 API", version="9.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000", "http://localhost:8000", "null", "*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as c:
        c.executescript(
            """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS scores (
                user_id INTEGER PRIMARY KEY,
                xp INTEGER NOT NULL DEFAULT 0,
                level INTEGER NOT NULL DEFAULT 1,
                coins INTEGER NOT NULL DEFAULT 0,
                online_wins INTEGER NOT NULL DEFAULT 0,
                online_losses INTEGER NOT NULL DEFAULT 0,
                stats_json TEXT NOT NULL DEFAULT '{}',
                updated_at INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS saves (
                user_id INTEGER PRIMARY KEY,
                data_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )


init_db()


class AuthPayload(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=128)


class ScorePayload(BaseModel):
    xp: int = Field(ge=0, le=100_000_000)
    level: int = Field(ge=1, le=10_000)
    coins: int = Field(ge=0, le=100_000_000)
    stats: dict[str, Any] = Field(default_factory=dict)


class SavePayload(BaseModel):
    data: dict[str, Any]


def password_digest(password: str, salt_hex: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 210_000).hex()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def make_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with db() as c:
        c.execute("DELETE FROM sessions WHERE expires_at < ?", (int(time.time()),))
        c.execute(
            "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
            (hash_token(token), user_id, int(time.time()) + TOKEN_TTL),
        )
    return token


def user_for_token(token: str | None) -> sqlite3.Row | None:
    if not token:
        return None
    with db() as c:
        return c.execute(
            """
            SELECT u.* FROM sessions s
            JOIN users u ON u.id=s.user_id
            WHERE s.token_hash=? AND s.expires_at>=?
            """,
            (hash_token(token), int(time.time())),
        ).fetchone()


def current_user(authorization: str | None = Header(default=None)) -> sqlite3.Row:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "authentication required")
    user = user_for_token(authorization.split(" ", 1)[1].strip())
    if not user:
        raise HTTPException(401, "invalid or expired session")
    return user


@app.get("/api/health")
def health():
    return {"ok": True, "version": "9.0.0", "database": DB_PATH.name}


@app.post("/api/register")
def register(payload: AuthPayload):
    salt = secrets.token_hex(16)
    digest = password_digest(payload.password, salt)
    try:
        with db() as c:
            cur = c.execute(
                "INSERT INTO users(username,salt,password_hash,created_at) VALUES(?,?,?,?)",
                (payload.username.strip(), salt, digest, int(time.time())),
            )
            user_id = int(cur.lastrowid)
            c.execute(
                "INSERT OR IGNORE INTO scores(user_id,xp,level,coins,online_wins,online_losses,stats_json,updated_at) VALUES(?,?,?,?,?,?,?,?)",
                (user_id, 0, 1, 0, 0, 0, "{}", int(time.time())),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "username already exists")
    token = make_session(user_id)
    return {"token": token, "user": {"id": user_id, "username": payload.username.strip()}}


@app.post("/api/login")
def login(payload: AuthPayload):
    with db() as c:
        user = c.execute("SELECT * FROM users WHERE username=? COLLATE NOCASE", (payload.username.strip(),)).fetchone()
    if not user:
        raise HTTPException(401, "invalid username or password")
    candidate = password_digest(payload.password, user["salt"])
    if not hmac.compare_digest(candidate, user["password_hash"]):
        raise HTTPException(401, "invalid username or password")
    token = make_session(int(user["id"]))
    return {"token": token, "user": {"id": int(user["id"]), "username": user["username"]}}


@app.get("/api/me")
def me(user: sqlite3.Row = Depends(current_user)):
    return {"id": int(user["id"]), "username": user["username"]}


@app.post("/api/score")
def update_score(payload: ScorePayload, user: sqlite3.Row = Depends(current_user)):
    stats_json = json.dumps(payload.stats, ensure_ascii=False, separators=(",", ":"))
    wins = int(payload.stats.get("onlineWins", 0) or 0)
    losses = int(payload.stats.get("onlineLosses", 0) or 0)
    with db() as c:
        c.execute(
            """
            INSERT INTO scores(user_id,xp,level,coins,online_wins,online_losses,stats_json,updated_at)
            VALUES(?,?,?,?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
              xp=MAX(scores.xp,excluded.xp),
              level=MAX(scores.level,excluded.level),
              coins=excluded.coins,
              online_wins=MAX(scores.online_wins,excluded.online_wins),
              online_losses=MAX(scores.online_losses,excluded.online_losses),
              stats_json=excluded.stats_json,
              updated_at=excluded.updated_at
            """,
            (int(user["id"]), payload.xp, payload.level, payload.coins, wins, losses, stats_json, int(time.time())),
        )
    return {"ok": True}


@app.get("/api/leaderboard")
def leaderboard(limit: int = 50):
    limit = max(1, min(limit, 100))
    with db() as c:
        rows = c.execute(
            """
            SELECT u.username,s.xp,s.level,s.online_wins,s.online_losses,s.updated_at
            FROM scores s JOIN users u ON u.id=s.user_id
            ORDER BY s.xp DESC, s.online_wins DESC, s.updated_at ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return {"items": [dict(r) for r in rows]}


@app.put("/api/save")
def put_save(payload: SavePayload, user: sqlite3.Row = Depends(current_user)):
    raw = json.dumps(payload.data, ensure_ascii=False, separators=(",", ":"))
    if len(raw.encode()) > 2_000_000:
        raise HTTPException(413, "save too large")
    with db() as c:
        c.execute(
            """
            INSERT INTO saves(user_id,data_json,updated_at) VALUES(?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
            """,
            (int(user["id"]), raw, int(time.time())),
        )
    return {"ok": True, "updated_at": int(time.time())}


@app.get("/api/save")
def get_save(user: sqlite3.Row = Depends(current_user)):
    with db() as c:
        row = c.execute("SELECT data_json,updated_at FROM saves WHERE user_id=?", (int(user["id"]),)).fetchone()
    if not row:
        return {"data": None, "updated_at": None}
    try:
        data = json.loads(row["data_json"])
    except json.JSONDecodeError:
        data = None
    return {"data": data, "updated_at": row["updated_at"]}


class RoomHub:
    def __init__(self) -> None:
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room: str, name: str, ws: WebSocket) -> bool:
        room = room.upper()
        members = self.rooms.setdefault(room, {})
        if name not in members and len(members) >= 2:
            await ws.accept()
            await ws.send_json({"type": "error", "message": "room full"})
            await ws.close(code=4003)
            return False
        await ws.accept()
        members[name] = ws
        await self.broadcast(room, {"type": "presence", "count": len(members), "players": list(members)})
        return True

    async def disconnect(self, room: str, name: str) -> None:
        room = room.upper()
        members = self.rooms.get(room, {})
        members.pop(name, None)
        if not members:
            self.rooms.pop(room, None)
            return
        await self.broadcast(room, {"type": "peer_left", "name": name})
        await self.broadcast(room, {"type": "presence", "count": len(members), "players": list(members)})

    async def broadcast(self, room: str, payload: dict[str, Any]) -> None:
        dead: list[str] = []
        for name, ws in list(self.rooms.get(room.upper(), {}).items()):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(name)
        for name in dead:
            self.rooms.get(room.upper(), {}).pop(name, None)


hub = RoomHub()


@app.websocket("/ws/{room}/{name}")
async def room_socket(ws: WebSocket, room: str, name: str, token: str | None = None):
    room = room.strip().upper()[:8]
    name = name.strip()[:32] or "Guest"
    user = user_for_token(token)
    if user:
        name = user["username"]
    connected = await hub.connect(room, name, ws)
    if not connected:
        return
    try:
        while True:
            data = await ws.receive_json()
            if not isinstance(data, dict):
                continue
            msg_type = str(data.get("type", ""))[:32]
            if msg_type not in {"start", "answer", "ping", "chat"}:
                continue
            safe = {"type": msg_type, "sender": name}
            if msg_type == "start":
                indices = data.get("indices", [])
                if isinstance(indices, list):
                    safe["indices"] = [int(x) for x in indices[:10] if (isinstance(x, int) or str(x).isdigit()) and 0 <= int(x) < 12]
            elif msg_type == "answer":
                safe["correct"] = bool(data.get("correct"))
                safe["index"] = int(data.get("index", 0))
            elif msg_type == "chat":
                safe["message"] = str(data.get("message", ""))[:280]
            else:
                safe["ts"] = int(time.time() * 1000)
            await hub.broadcast(room, safe)
    except WebSocketDisconnect:
        await hub.disconnect(room, name)
    except Exception:
        await hub.disconnect(room, name)
        try:
            await ws.close()
        except Exception:
            pass


@app.get("/")
def index():
    return FileResponse(BASE / "index.html")


@app.get("/{path:path}")
def static_fallback(path: str):
    return FileResponse(BASE / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
