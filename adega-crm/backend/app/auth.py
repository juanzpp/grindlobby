from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import smtplib
import sqlite3
import struct
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR.parent / "adega.db"
ENV = os.getenv("ADEGA_ENV", "development").lower()
COOKIE_NAME = "adega_session"
COOKIE_SECURE = os.getenv("ADEGA_COOKIE_SECURE", "true" if ENV == "production" else "false").lower() == "true"
SESSION_HOURS = 8
REMEMBER_DAYS = 30
MAX_FAILED_ATTEMPTS = 5
LOCK_MINUTES = 15
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000").rstrip("/")
WEBAUTHN_ORIGIN = os.getenv("WEBAUTHN_ORIGIN", FRONTEND_URL)
WEBAUTHN_RP_ID = os.getenv("WEBAUTHN_RP_ID", urlparse(WEBAUTHN_ORIGIN).hostname or "127.0.0.1")
WEBAUTHN_RP_NAME = os.getenv("WEBAUTHN_RP_NAME", "Adega CRM")
WEBAUTHN_CHALLENGE_MINUTES = 5
SUPPORT_URL = os.getenv("ADEGA_SUPPORT_URL", "")
ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4, hash_len=32, salt_len=16)
router = APIRouter(prefix="/api/auth", tags=["auth"])


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


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return utcnow().isoformat()


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_email(value: str) -> str:
    return value.strip().lower()


def password_is_strong(value: str) -> bool:
    return (
        len(value) >= 10
        and any(c.islower() for c in value)
        and any(c.isupper() for c in value)
        and any(c.isdigit() for c in value)
        and any(not c.isalnum() for c in value)
    )


def init_auth_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS organizations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              slug TEXT NOT NULL UNIQUE,
              active INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              organization_id INTEGER NOT NULL,
              name TEXT NOT NULL,
              email TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              pin_hash TEXT,
              role TEXT NOT NULL DEFAULT 'ADMIN',
              active INTEGER NOT NULL DEFAULT 1,
              failed_attempts INTEGER NOT NULL DEFAULT 0,
              locked_until TEXT,
              last_login_at TEXT,
              created_at TEXT NOT NULL,
              UNIQUE(organization_id,email),
              FOREIGN KEY(organization_id) REFERENCES organizations(id)
            );

            CREATE TABLE IF NOT EXISTS auth_sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              token_hash TEXT NOT NULL UNIQUE,
              persistent INTEGER NOT NULL DEFAULT 0,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              last_seen_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS websocket_tokens (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              token_hash TEXT NOT NULL UNIQUE,
              expires_at TEXT NOT NULL,
              used_at TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS password_reset_tokens (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              token_hash TEXT NOT NULL UNIQUE,
              expires_at TEXT NOT NULL,
              used_at TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS passkey_credentials (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              credential_id TEXT NOT NULL UNIQUE,
              label TEXT NOT NULL DEFAULT 'Dispositivo',
              public_key TEXT NOT NULL,
              sign_count INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              last_used_at TEXT,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS webauthn_challenges (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              purpose TEXT NOT NULL,
              challenge_hash TEXT NOT NULL UNIQUE,
              expires_at TEXT NOT NULL,
              used_at TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )

        org = conn.execute("SELECT id FROM organizations WHERE slug='principal'").fetchone()
        if not org:
            cur = conn.execute(
                "INSERT INTO organizations(name,slug,created_at) VALUES(?,?,?)",
                (os.getenv("ADEGA_COMPANY_NAME", "Adega Exemplo LTDA"), "principal", now_iso()),
            )
            org_id = int(cur.lastrowid)
        else:
            org_id = int(org["id"])

        admin_email = normalize_email(os.getenv("ADEGA_ADMIN_EMAIL", "admin@adega.local"))
        user = conn.execute(
            "SELECT id FROM users WHERE organization_id=? AND email=?", (org_id, admin_email)
        ).fetchone()
        if not user:
            password = os.getenv("ADEGA_ADMIN_PASSWORD")
            pin = os.getenv("ADEGA_ADMIN_PIN")
            if not password or not pin:
                raise RuntimeError("ADEGA_ADMIN_PASSWORD e ADEGA_ADMIN_PIN são obrigatórios; use variáveis de ambiente")
            conn.execute(
                """INSERT INTO users(organization_id,name,email,password_hash,pin_hash,role,created_at)
                   VALUES(?,?,?,?,?,?,?)""",
                (
                    org_id,
                    os.getenv("ADEGA_ADMIN_NAME", "Administrador"),
                    admin_email,
                    ph.hash(password),
                    ph.hash(pin),
                    "ADMIN",
                    now_iso(),
                ),
            )

        conn.execute("DELETE FROM auth_sessions WHERE expires_at < ?", (now_iso(),))
        conn.execute("DELETE FROM password_reset_tokens WHERE expires_at < ? OR used_at IS NOT NULL", (now_iso(),))
        conn.execute("DELETE FROM websocket_tokens WHERE expires_at < ? OR used_at IS NOT NULL", (now_iso(),))
        conn.execute("DELETE FROM webauthn_challenges WHERE expires_at < ? OR used_at IS NOT NULL", (now_iso(),))


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=180)
    password: str = Field(min_length=1, max_length=256)
    remember: bool = False
    organization_slug: str = Field(default="principal", min_length=2, max_length=80)


class PinLoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=180)
    pin: str = Field(pattern=r"^\d{4,8}$")
    remember: bool = False
    organization_slug: str = Field(default="principal", min_length=2, max_length=80)


class ForgotPasswordIn(BaseModel):
    email: str = Field(min_length=3, max_length=180)
    organization_slug: str = Field(default="principal", min_length=2, max_length=80)


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    password: str = Field(min_length=10, max_length=256)


class PinSetupIn(BaseModel):
    pin: str = Field(pattern=r"^\d{4,8}$")


class PasskeyLoginOptionsIn(BaseModel):
    email: str = Field(min_length=3, max_length=180)
    organization_slug: str = Field(default="principal", min_length=2, max_length=80)


class PasskeyLoginVerifyIn(BaseModel):
    credential_id: str = Field(min_length=8, max_length=2048)
    client_data_json: str = Field(min_length=8)
    authenticator_data: str = Field(min_length=8)
    signature: str = Field(min_length=8)
    remember: bool = False


class PasskeyRegisterVerifyIn(BaseModel):
    credential_id: str = Field(min_length=8, max_length=2048)
    client_data_json: str = Field(min_length=8)
    attestation_object: str = Field(min_length=8)
    label: str = Field(default="Dispositivo", min_length=1, max_length=80)



def _b64u_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64u_decode(value: str) -> bytes:
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + padding)


class _CborReader:
    def __init__(self, data: bytes):
        self.data = data
        self.pos = 0

    def _read(self, n: int) -> bytes:
        if self.pos + n > len(self.data):
            raise ValueError("CBOR truncado")
        value = self.data[self.pos:self.pos+n]
        self.pos += n
        return value

    def _length(self, ai: int) -> int:
        if ai < 24:
            return ai
        if ai == 24:
            return self._read(1)[0]
        if ai == 25:
            return struct.unpack(">H", self._read(2))[0]
        if ai == 26:
            return struct.unpack(">I", self._read(4))[0]
        if ai == 27:
            return struct.unpack(">Q", self._read(8))[0]
        raise ValueError("CBOR com comprimento não suportado")

    def read(self):
        first = self._read(1)[0]
        major, ai = first >> 5, first & 31
        if major in (0, 1):
            n = self._length(ai)
            return n if major == 0 else -1 - n
        if major == 2:
            return self._read(self._length(ai))
        if major == 3:
            return self._read(self._length(ai)).decode("utf-8")
        if major == 4:
            return [self.read() for _ in range(self._length(ai))]
        if major == 5:
            return {self.read(): self.read() for _ in range(self._length(ai))}
        if major == 7:
            if ai == 20:
                return False
            if ai == 21:
                return True
            if ai in (22, 23):
                return None
        raise ValueError("Tipo CBOR não suportado")


def _new_webauthn_challenge(conn: sqlite3.Connection, user_id: int, purpose: str) -> str:
    challenge = _b64u_encode(secrets.token_bytes(32))
    expires = utcnow() + timedelta(minutes=WEBAUTHN_CHALLENGE_MINUTES)
    conn.execute(
        "INSERT INTO webauthn_challenges(user_id,purpose,challenge_hash,expires_at,created_at) VALUES(?,?,?,?,?)",
        (user_id, purpose, sha256(challenge), expires.isoformat(), now_iso()),
    )
    return challenge


def _consume_webauthn_challenge(conn: sqlite3.Connection, challenge: str, purpose: str, user_id: int | None = None) -> sqlite3.Row:
    params: list[Any] = [sha256(challenge), purpose]
    user_sql = ""
    if user_id is not None:
        user_sql = " AND user_id=?"
        params.append(user_id)
    row = conn.execute(
        f"SELECT * FROM webauthn_challenges WHERE challenge_hash=? AND purpose=? AND used_at IS NULL{user_sql}",
        tuple(params),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="Desafio de segurança inválido")
    if datetime.fromisoformat(row["expires_at"]) <= utcnow():
        raise HTTPException(status_code=400, detail="Desafio de segurança expirado")
    conn.execute("UPDATE webauthn_challenges SET used_at=? WHERE id=?", (now_iso(), row["id"]))
    return row


def _parse_client_data(encoded: str, expected_type: str) -> tuple[bytes, dict[str, Any], str]:
    try:
        raw = _b64u_decode(encoded)
        data = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Resposta WebAuthn inválida") from exc
    if data.get("type") != expected_type:
        raise HTTPException(status_code=400, detail="Tipo WebAuthn inválido")
    if data.get("origin") != WEBAUTHN_ORIGIN:
        raise HTTPException(status_code=400, detail="Origem WebAuthn não autorizada")
    challenge = data.get("challenge")
    if not isinstance(challenge, str) or not challenge:
        raise HTTPException(status_code=400, detail="Desafio WebAuthn ausente")
    return raw, data, challenge


def _verify_authenticator_header(auth_data: bytes) -> int:
    if len(auth_data) < 37:
        raise HTTPException(status_code=400, detail="AuthenticatorData inválido")
    if auth_data[:32] != hashlib.sha256(WEBAUTHN_RP_ID.encode("utf-8")).digest():
        raise HTTPException(status_code=400, detail="RP ID WebAuthn inválido")
    flags = auth_data[32]
    if not (flags & 0x01):
        raise HTTPException(status_code=400, detail="Presença do usuário não confirmada")
    if not (flags & 0x04):
        raise HTTPException(status_code=400, detail="Verificação biométrica/PIN do dispositivo não confirmada")
    return struct.unpack(">I", auth_data[33:37])[0]


def _registration_public_key(attestation_object: bytes) -> tuple[str, str, int]:
    try:
        att = _CborReader(attestation_object).read()
        auth_data = att["authData"]
        if not isinstance(auth_data, bytes):
            raise ValueError("authData")
        sign_count = _verify_authenticator_header(auth_data)
        flags = auth_data[32]
        if not (flags & 0x40):
            raise ValueError("AT flag")
        pos = 37 + 16
        cred_len = struct.unpack(">H", auth_data[pos:pos+2])[0]
        pos += 2
        credential_id = auth_data[pos:pos+cred_len]
        pos += cred_len
        cose = _CborReader(auth_data[pos:]).read()
        if cose.get(1) != 2 or cose.get(3) != -7 or cose.get(-1) != 1:
            raise HTTPException(status_code=400, detail="Passkey usa algoritmo não suportado")
        x, y = cose.get(-2), cose.get(-3)
        if not isinstance(x, bytes) or not isinstance(y, bytes) or len(x) != 32 or len(y) != 32:
            raise ValueError("EC key")
        numbers = ec.EllipticCurvePublicNumbers(int.from_bytes(x, "big"), int.from_bytes(y, "big"), ec.SECP256R1())
        key = numbers.public_key()
        pem = key.public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode("ascii")
        return _b64u_encode(credential_id), pem, sign_count
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Não foi possível validar a passkey cadastrada") from exc


def _verify_passkey_signature(public_key_pem: str, client_data_raw: bytes, authenticator_data: bytes, signature: bytes) -> int:
    sign_count = _verify_authenticator_header(authenticator_data)
    try:
        key = serialization.load_pem_public_key(public_key_pem.encode("ascii"))
        if not isinstance(key, ec.EllipticCurvePublicKey):
            raise ValueError("key type")
        signed = authenticator_data + hashlib.sha256(client_data_raw).digest()
        key.verify(signature, signed, ec.ECDSA(hashes.SHA256()))
        return sign_count
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Assinatura da passkey inválida") from exc


def _user_by_email(conn: sqlite3.Connection, email: str, org_slug: str) -> sqlite3.Row | None:
    return conn.execute(
        """SELECT u.*,o.slug organization_slug,o.name organization_name
           FROM users u JOIN organizations o ON o.id=u.organization_id
           WHERE lower(u.email)=? AND o.slug=? AND u.active=1 AND o.active=1""",
        (normalize_email(email), org_slug),
    ).fetchone()


def _locked(row: sqlite3.Row) -> bool:
    value = row["locked_until"]
    if not value:
        return False
    try:
        return datetime.fromisoformat(value) > utcnow()
    except ValueError:
        return False


def _record_failure(conn: sqlite3.Connection, row: sqlite3.Row) -> None:
    failed = int(row["failed_attempts"] or 0) + 1
    locked_until = None
    if failed >= MAX_FAILED_ATTEMPTS:
        locked_until = (utcnow() + timedelta(minutes=LOCK_MINUTES)).isoformat()
        failed = 0
    conn.execute(
        "UPDATE users SET failed_attempts=?,locked_until=? WHERE id=?",
        (failed, locked_until, row["id"]),
    )


def _verify(hash_value: str | None, secret: str) -> bool:
    if not hash_value:
        return False
    try:
        return ph.verify(hash_value, secret)
    except (VerifyMismatchError, InvalidHashError):
        return False


def _safe_user(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "organization": {
            "id": row["organization_id"],
            "slug": row["organization_slug"],
            "name": row["organization_name"],
        },
    }


def _create_session(conn: sqlite3.Connection, user_id: int, remember: bool) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(48)
    expires = utcnow() + (timedelta(days=REMEMBER_DAYS) if remember else timedelta(hours=SESSION_HOURS))
    conn.execute(
        "INSERT INTO auth_sessions(user_id,token_hash,persistent,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)",
        (user_id, sha256(token), int(remember), expires.isoformat(), now_iso(), now_iso()),
    )
    return token, expires


def _set_session_cookie(response: Response, token: str, expires: datetime, remember: bool) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
        max_age=int((expires - utcnow()).total_seconds()) if remember else None,
        expires=expires if remember else None,
    )


def current_user(request: Request) -> dict[str, Any] | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    with db() as conn:
        row = conn.execute(
            """SELECT u.*,o.slug organization_slug,o.name organization_name,s.id session_id,s.expires_at
               FROM auth_sessions s JOIN users u ON u.id=s.user_id
               JOIN organizations o ON o.id=u.organization_id
               WHERE s.token_hash=? AND u.active=1 AND o.active=1""",
            (sha256(token),),
        ).fetchone()
        if not row:
            return None
        try:
            if datetime.fromisoformat(row["expires_at"]) <= utcnow():
                conn.execute("DELETE FROM auth_sessions WHERE id=?", (row["session_id"],))
                return None
        except ValueError:
            return None
        conn.execute("UPDATE auth_sessions SET last_seen_at=? WHERE id=?", (now_iso(), row["session_id"]))
        return _safe_user(row)


def require_user(request: Request) -> dict[str, Any]:
    user = current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Sessão expirada ou não autenticada")
    return user


def consume_ws_token(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    with db() as conn:
        row = conn.execute(
            """SELECT wt.id token_id,wt.expires_at,u.*,o.slug organization_slug,o.name organization_name
               FROM websocket_tokens wt
               JOIN users u ON u.id=wt.user_id
               JOIN organizations o ON o.id=u.organization_id
               WHERE wt.token_hash=? AND wt.used_at IS NULL AND u.active=1 AND o.active=1""",
            (sha256(token),),
        ).fetchone()
        if not row:
            return None
        try:
            if datetime.fromisoformat(row["expires_at"]) <= utcnow():
                conn.execute("UPDATE websocket_tokens SET used_at=? WHERE id=?", (now_iso(), row["token_id"]))
                return None
        except ValueError:
            return None
        conn.execute("UPDATE websocket_tokens SET used_at=? WHERE id=?", (now_iso(), row["token_id"]))
        return _safe_user(row)


def _smtp_send_reset(email: str, token: str) -> bool:
    host = os.getenv("SMTP_HOST")
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM", username or "")
    if not host or not username or not password or not sender:
        return False
    frontend = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000").rstrip("/")
    msg = EmailMessage()
    msg["Subject"] = "Redefinição de senha — Adega CRM"
    msg["From"] = sender
    msg["To"] = email
    msg.set_content(f"Use este link para redefinir sua senha:\n\n{frontend}/login?reset={token}\n\nO link expira em 30 minutos.")
    port = int(os.getenv("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=12) as smtp:
        smtp.starttls()
        smtp.login(username, password)
        smtp.send_message(msg)
    return True


@router.post("/login")
def login(payload: LoginIn, response: Response):
    with db() as conn:
        row = _user_by_email(conn, payload.email, payload.organization_slug)
        if not row:
            raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
        if _locked(row):
            raise HTTPException(status_code=423, detail="Acesso temporariamente bloqueado. Tente novamente em alguns minutos.")
        if not _verify(row["password_hash"], payload.password):
            _record_failure(conn, row)
            conn.commit()
            raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
        conn.execute(
            "UPDATE users SET failed_attempts=0,locked_until=NULL,last_login_at=? WHERE id=?",
            (now_iso(), row["id"]),
        )
        token, expires = _create_session(conn, int(row["id"]), payload.remember)
        _set_session_cookie(response, token, expires, payload.remember)
        return {"ok": True, "user": _safe_user(row), "expires_at": expires.isoformat()}


@router.post("/pin")
def login_pin(payload: PinLoginIn, response: Response):
    with db() as conn:
        row = _user_by_email(conn, payload.email, payload.organization_slug)
        if not row:
            raise HTTPException(status_code=401, detail="Dados de acesso inválidos")
        if _locked(row):
            raise HTTPException(status_code=423, detail="Acesso temporariamente bloqueado")
        if not _verify(row["pin_hash"], payload.pin):
            _record_failure(conn, row)
            conn.commit()
            raise HTTPException(status_code=401, detail="PIN inválido")
        conn.execute("UPDATE users SET failed_attempts=0,locked_until=NULL,last_login_at=? WHERE id=?", (now_iso(), row["id"]))
        token, expires = _create_session(conn, int(row["id"]), payload.remember)
        _set_session_cookie(response, token, expires, payload.remember)
        return {"ok": True, "user": _safe_user(row), "expires_at": expires.isoformat()}


@router.get("/me")
def me(request: Request):
    return require_user(request)


@router.post("/ws-token")
def websocket_token(request: Request):
    user = require_user(request)
    token = secrets.token_urlsafe(36)
    expires = utcnow() + timedelta(minutes=2)
    with db() as conn:
        conn.execute(
            "INSERT INTO websocket_tokens(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)",
            (int(user["id"]), sha256(token), expires.isoformat(), now_iso()),
        )
    return {"token": token, "expires_at": expires.isoformat()}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        with db() as conn:
            conn.execute("DELETE FROM auth_sessions WHERE token_hash=?", (sha256(token),))
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/organizations")
def organizations():
    with db() as conn:
        return [dict(r) for r in conn.execute("SELECT name,slug FROM organizations WHERE active=1 ORDER BY name").fetchall()]


@router.get("/public-config")
def public_config():
    return {
        "support_url": SUPPORT_URL or None,
        "webauthn_enabled": True,
        "rp_id": WEBAUTHN_RP_ID,
    }


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordIn):
    result: dict[str, Any] = {"ok": True, "message": "Se a conta existir, enviaremos as instruções de recuperação."}
    with db() as conn:
        row = _user_by_email(conn, payload.email, payload.organization_slug)
        if not row:
            return result
        token = secrets.token_urlsafe(40)
        expires = utcnow() + timedelta(minutes=30)
        conn.execute("UPDATE password_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL", (now_iso(), row["id"]))
        conn.execute(
            "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)",
            (row["id"], sha256(token), expires.isoformat(), now_iso()),
        )
        try:
            sent = _smtp_send_reset(row["email"], token)
        except Exception:
            sent = False
        result["delivery"] = "email" if sent else "not_configured"
        if ENV != "production" and not sent:
            result["development_reset_token"] = token
    return result


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn):
    if not password_is_strong(payload.password):
        raise HTTPException(status_code=422, detail="Use pelo menos 10 caracteres, com maiúscula, minúscula, número e símbolo")
    with db() as conn:
        row = conn.execute(
            """SELECT pr.id token_id,pr.user_id,pr.expires_at,pr.used_at
               FROM password_reset_tokens pr WHERE pr.token_hash=?""",
            (sha256(payload.token),),
        ).fetchone()
        if not row or row["used_at"]:
            raise HTTPException(status_code=400, detail="Link de recuperação inválido ou já utilizado")
        if datetime.fromisoformat(row["expires_at"]) <= utcnow():
            raise HTTPException(status_code=400, detail="Link de recuperação expirado")
        conn.execute("UPDATE users SET password_hash=?,failed_attempts=0,locked_until=NULL WHERE id=?", (ph.hash(payload.password), row["user_id"]))
        conn.execute("UPDATE password_reset_tokens SET used_at=? WHERE id=?", (now_iso(), row["token_id"]))
        conn.execute("DELETE FROM auth_sessions WHERE user_id=?", (row["user_id"],))
    return {"ok": True}


@router.post("/pin/setup")
def setup_pin(payload: PinSetupIn, request: Request):
    user = require_user(request)
    with db() as conn:
        conn.execute("UPDATE users SET pin_hash=? WHERE id=?", (ph.hash(payload.pin), user["id"]))
    return {"ok": True}


@router.get("/passkey/status")
def passkey_status(request: Request):
    user = current_user(request)
    count = 0
    if user:
        with db() as conn:
            count = int(conn.execute("SELECT COUNT(*) c FROM passkey_credentials WHERE user_id=?", (user["id"],)).fetchone()["c"])
    return {
        "browser_api": "WebAuthn",
        "registered": count > 0,
        "credentials": count,
        "server_verification": True,
        "rp_id": WEBAUTHN_RP_ID,
        "origin": WEBAUTHN_ORIGIN,
        "message": "Passkeys são verificadas criptograficamente pelo servidor.",
    }


@router.post("/passkey/register/options")
def passkey_register_options(request: Request):
    user = require_user(request)
    with db() as conn:
        challenge = _new_webauthn_challenge(conn, int(user["id"]), "register")
        existing = [
            {"type": "public-key", "id": r["credential_id"]}
            for r in conn.execute("SELECT credential_id FROM passkey_credentials WHERE user_id=?", (user["id"],)).fetchall()
        ]
    return {
        "challenge": challenge,
        "rp": {"name": WEBAUTHN_RP_NAME, "id": WEBAUTHN_RP_ID},
        "user": {
            "id": _b64u_encode(str(user["id"]).encode("utf-8")),
            "name": user["email"],
            "displayName": user["name"],
        },
        "pubKeyCredParams": [{"type": "public-key", "alg": -7}],
        "timeout": 60000,
        "attestation": "none",
        "authenticatorSelection": {
            "authenticatorAttachment": "platform",
            "residentKey": "preferred",
            "userVerification": "required",
        },
        "excludeCredentials": existing,
    }


@router.post("/passkey/register/verify")
def passkey_register_verify(payload: PasskeyRegisterVerifyIn, request: Request):
    user = require_user(request)
    client_raw, _, challenge = _parse_client_data(payload.client_data_json, "webauthn.create")
    del client_raw
    with db() as conn:
        _consume_webauthn_challenge(conn, challenge, "register", int(user["id"]))
        cred_id, public_key, sign_count = _registration_public_key(_b64u_decode(payload.attestation_object))
        if cred_id != payload.credential_id:
            raise HTTPException(status_code=400, detail="ID da passkey não confere")
        existing = conn.execute("SELECT user_id FROM passkey_credentials WHERE credential_id=?", (cred_id,)).fetchone()
        if existing and int(existing["user_id"]) != int(user["id"]):
            raise HTTPException(status_code=409, detail="Esta passkey já pertence a outra conta")
        if existing:
            conn.execute(
                "UPDATE passkey_credentials SET label=?,public_key=?,sign_count=?,last_used_at=? WHERE credential_id=?",
                (payload.label, public_key, sign_count, now_iso(), cred_id),
            )
        else:
            conn.execute(
                "INSERT INTO passkey_credentials(user_id,credential_id,label,public_key,sign_count,created_at,last_used_at) VALUES(?,?,?,?,?,?,?)",
                (user["id"], cred_id, payload.label, public_key, sign_count, now_iso(), now_iso()),
            )
    return {"ok": True, "credential_id": cred_id}


@router.post("/passkey/login/options")
def passkey_login_options(payload: PasskeyLoginOptionsIn):
    with db() as conn:
        row = _user_by_email(conn, payload.email, payload.organization_slug)
        if not row:
            raise HTTPException(status_code=404, detail="Nenhuma passkey disponível para esta conta")
        creds = conn.execute("SELECT credential_id FROM passkey_credentials WHERE user_id=?", (row["id"],)).fetchall()
        if not creds:
            raise HTTPException(status_code=404, detail="Nenhuma passkey cadastrada para esta conta")
        challenge = _new_webauthn_challenge(conn, int(row["id"]), "login")
        return {
            "challenge": challenge,
            "rpId": WEBAUTHN_RP_ID,
            "timeout": 60000,
            "userVerification": "required",
            "allowCredentials": [{"type": "public-key", "id": r["credential_id"]} for r in creds],
        }


@router.post("/passkey/login/verify")
def passkey_login_verify(payload: PasskeyLoginVerifyIn, response: Response):
    client_raw, _, challenge = _parse_client_data(payload.client_data_json, "webauthn.get")
    authenticator_data = _b64u_decode(payload.authenticator_data)
    signature = _b64u_decode(payload.signature)
    with db() as conn:
        cred = conn.execute(
            """SELECT u.*,u.id user_id,o.slug organization_slug,o.name organization_name,
                      pc.credential_id,pc.public_key,pc.sign_count,pc.last_used_at passkey_last_used_at
               FROM passkey_credentials pc JOIN users u ON u.id=pc.user_id
               JOIN organizations o ON o.id=u.organization_id
               WHERE pc.credential_id=? AND u.active=1 AND o.active=1""",
            (payload.credential_id,),
        ).fetchone()
        if not cred:
            raise HTTPException(status_code=401, detail="Passkey não reconhecida")
        _consume_webauthn_challenge(conn, challenge, "login", int(cred["user_id"]))
        new_count = _verify_passkey_signature(cred["public_key"], client_raw, authenticator_data, signature)
        old_count = int(cred["sign_count"] or 0)
        if old_count > 0 and new_count > 0 and new_count <= old_count:
            raise HTTPException(status_code=401, detail="Contador da passkey inválido")
        conn.execute(
            "UPDATE passkey_credentials SET sign_count=?,last_used_at=? WHERE credential_id=?",
            (max(old_count, new_count), now_iso(), payload.credential_id),
        )
        conn.execute("UPDATE users SET failed_attempts=0,locked_until=NULL,last_login_at=? WHERE id=?", (now_iso(), cred["user_id"]))
        token, expires = _create_session(conn, int(cred["user_id"]), payload.remember)
        _set_session_cookie(response, token, expires, payload.remember)
        return {"ok": True, "user": _safe_user(cred), "expires_at": expires.isoformat()}


init_auth_db()
