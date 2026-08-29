from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app import main

client = TestClient(main.app)

def test_customer_pii_is_not_persisted():
    products = client.get('/api/products?storefront=true').json()
    assert products
    p = products[0]
    r = client.post('/api/storefront/orders', json={
        'channel': 'storefront',
        'payment_method': 'pix',
        'items': [{'product_id': p['id'], 'qty': 1}],
        'discount': 0,
        'customer_name': 'Nome Privado',
        'customer_phone': '11988887777',
        'external_id': 'delivery',
    })
    assert r.status_code == 200, r.text
    with main.db() as conn:
        assert conn.execute('SELECT COUNT(*) c FROM customers').fetchone()['c'] == 0
        order = conn.execute(
            'SELECT customer_id, external_id FROM orders WHERE id=?',
            (r.json()['id'],),
        ).fetchone()
        assert order['customer_id'] is None
        assert order['external_id'] == 'delivery'
        dump = ' '.join(
            str(x)
            for row in conn.execute(
                'SELECT action,entity,entity_id,detail FROM audit_log'
            ).fetchall()
            for x in row if x is not None
        )
        assert 'Nome Privado' not in dump
        assert '11988887777' not in dump

def test_nominal_customer_registration_is_disabled():
    login = client.post('/api/auth/login', json={
        'email': 'ci-admin@invalid.local',
        'password': 'CI-only-Password@2026',
        'remember': False,
        'organization_slug': 'principal',
    })
    assert login.status_code == 200, login.text
    r = client.post('/api/customers', json={
        'name': 'Pessoa', 'phone': '11999999999'
    })
    assert r.status_code == 410, r.text
