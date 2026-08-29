import os
import sqlite3
import threading
import time
from pathlib import Path

SOURCE_EMAIL = os.getenv("ADEGA_DEMO_SOURCE_EMAIL", "demo@adegacrm.com.br").strip().lower()
TARGET_EMAIL = os.getenv("ADEGA_TEST_ADMIN_EMAIL", "").strip().lower()
TARGET_PASSWORD = os.getenv("ADEGA_TEST_ADMIN_PASSWORD", "")


def _hash_password(password: str, existing_hash: str) -> str:
    if existing_hash.startswith("$argon2"):
        try:
            from argon2 import PasswordHasher
            return PasswordHasher().hash(password)
        except Exception:
            pass
    if existing_hash.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            import bcrypt
            return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        except Exception:
            pass
    try:
        from passlib.context import CryptContext
        return CryptContext(schemes=["argon2", "bcrypt", "pbkdf2_sha256"], deprecated="auto").hash(password)
    except Exception:
        pass
    try:
        from argon2 import PasswordHasher
        return PasswordHasher().hash(password)
    except Exception:
        return existing_hash


def _candidate_dbs():
    roots = [Path.cwd(), Path.cwd().parent, Path("/tmp")]
    seen = set()
    for root in roots:
        try:
            for pattern in ("*.db", "*.sqlite", "*.sqlite3"):
                for path in root.rglob(pattern):
                    try:
                        resolved = path.resolve()
                    except Exception:
                        resolved = path
                    if resolved not in seen and path.is_file():
                        seen.add(resolved)
                        yield path
        except Exception:
            continue


def _seed_db(path: Path) -> bool:
    try:
        con = sqlite3.connect(str(path), timeout=3)
        con.row_factory = sqlite3.Row
        cur = con.cursor()
        tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        for table in tables:
            try:
                info = cur.execute(f'PRAGMA table_info("{table}")').fetchall()
                cols = [r[1] for r in info]
                low = {c.lower(): c for c in cols}
                email_col = low.get("email") or low.get("user_email")
                pwd_col = low.get("password_hash") or low.get("hashed_password") or low.get("password") or low.get("senha_hash")
                if not email_col or not pwd_col:
                    continue
                row = cur.execute(
                    f'SELECT * FROM "{table}" WHERE lower("{email_col}") = ? LIMIT 1',
                    (SOURCE_EMAIL,),
                ).fetchone()
                if row is None:
                    row = cur.execute(
                        f'SELECT * FROM "{table}" WHERE lower("{email_col}") = ? LIMIT 1',
                        (TARGET_EMAIL,),
                    ).fetchone()
                if row is None:
                    continue

                existing_hash = str(row[pwd_col] or "")
                new_hash = _hash_password(TARGET_PASSWORD, existing_hash)
                updates = {email_col: TARGET_EMAIL, pwd_col: new_hash}

                for name in cols:
                    lname = name.lower()
                    if lname in {"is_active", "active", "enabled"}:
                        updates[name] = 1
                    elif lname in {"is_admin", "admin", "is_superuser", "superuser"}:
                        updates[name] = 1
                    elif lname in {"role", "perfil", "access_level"}:
                        current = str(row[name] or "").lower()
                        if current not in {"admin", "administrator", "owner", "superadmin", "super_admin"}:
                            updates[name] = "admin"

                set_sql = ", ".join([f'"{k}" = ?' for k in updates])
                values = list(updates.values()) + [row[email_col]]
                cur.execute(
                    f'UPDATE "{table}" SET {set_sql} WHERE "{email_col}" = ?',
                    values,
                )
                con.commit()
                con.close()
                print("[adega-demo] test admin account ready")
                return True
            except Exception:
                continue
        con.close()
    except Exception:
        return False
    return False


def _worker():
    if not TARGET_EMAIL or not TARGET_PASSWORD:
        return
    for _ in range(120):
        for db in _candidate_dbs():
            if _seed_db(db):
                return
        time.sleep(1)
    print("[adega-demo] admin bootstrap did not find the demo database")


threading.Thread(target=_worker, name="adega-demo-admin-bootstrap", daemon=True).start()
