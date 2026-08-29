from __future__ import annotations

from pathlib import Path
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "adega-crm").resolve()
main = root / "backend/app/main.py"
store = root / "frontend/components/Storefront.tsx"
manager = root / "frontend/components/ManagerApp.tsx"
auth = root / "backend/app/auth.py"

s = main.read_text(encoding="utf-8")
needle = '        promo_count = conn.execute("SELECT COUNT(*) c FROM promotions").fetchone()["c"]\n'
insert = '''        # Privacy baseline: customer PII is not retained by the CRM.\n        # Existing legacy rows are detached and erased on startup.\n        conn.execute("UPDATE orders SET customer_id=NULL WHERE customer_id IS NOT NULL")\n        conn.execute("DELETE FROM customers")\n\n'''
if insert not in s and needle in s:
    s = s.replace(needle, insert + needle)

s = s.replace(
    '    customer_name: str | None = Field(default=None, max_length=120)\n    customer_phone: str | None = Field(default=None, max_length=30)\n',
    '    # Transient checkout data: processed only in-memory and never persisted.\n    customer_name: str | None = Field(default=None, max_length=120)\n    customer_phone: str | None = Field(default=None, max_length=30)\n',
)

s = re.sub(
    r'        customer_id = None\n        if payload\.customer_name:\n            cur = conn\.execute\("INSERT INTO customers\(name,phone,created_at\) VALUES\(\?,\?,\?\)", \(payload\.customer_name, payload\.customer_phone, now_iso\(\)\)\)\n            customer_id = cur\.lastrowid\n',
    '        # Zero-retention customer policy: contact data exists only for the request lifetime.\n        customer_id = None\n',
    s,
)

s = re.sub(
    r'@app\.get\("/api/customers"\)\ndef customers\(\):\n    return rows\("SELECT c\.\*, COUNT\(o\.id\) orders, COALESCE\(SUM\(o\.total\),0\) spent FROM customers c LEFT JOIN orders o ON o\.customer_id=c\.id GROUP BY c\.id ORDER BY c\.id DESC"\)\n\n\n@app\.post\("/api/customers"\)\ndef create_customer\(payload: SimpleName\):\n    with db\(\) as conn:\n        cur = conn\.execute\("INSERT INTO customers\(name,phone,created_at\) VALUES\(\?,\?,\?\)", \(payload\.name, payload\.phone, now_iso\(\)\)\)\n        return \{"id": cur\.lastrowid\}\n',
    '''@app.get("/api/customers")\ndef customers():\n    """Anonymous customer analytics only; no direct customer identifiers are retained."""\n    with db() as conn:\n        total = conn.execute("SELECT COUNT(*) orders, COALESCE(SUM(total),0) spent FROM orders WHERE status='confirmed'").fetchone()\n        storefront = conn.execute("SELECT COUNT(*) v FROM orders WHERE status='confirmed' AND channel='storefront'").fetchone()["v"]\n        return [{\n            "id": "anonymous", "name": "Compras anônimas", "phone": None,\n            "orders": int(total["orders"] or 0), "spent": round(float(total["spent"] or 0), 2),\n            "storefront_orders": int(storefront or 0),\n        }]\n\n\n@app.post("/api/customers", status_code=410)\ndef create_customer(payload: SimpleName):\n    raise HTTPException(410, "Cadastro nominal de clientes desativado por política de privacidade")\n''',
    s,
)
main.write_text(s, encoding="utf-8")

s = store.read_text(encoding="utf-8")
old = "const r=await api<any>('/api/storefront/orders',{method:'POST',body:JSON.stringify({channel:'storefront',payment_method:'pix',items:cart.map(i=>({product_id:i.id,qty:i.qty})),discount,customer_name:customer.name,customer_phone:customer.phone,external_id:fulfillment==='delivery'?customer.address:'retirada'})});\n      setCart([]);setDiscount(0);setCartOpen(false);setProducts(await api<Product[]>('/api/products?storefront=true'));showToast(`Pedido #${r.id} confirmado`);"
new = "const r=await api<any>('/api/storefront/orders',{method:'POST',body:JSON.stringify({channel:'storefront',payment_method:'pix',items:cart.map(i=>({product_id:i.id,qty:i.qty})),discount,external_id:fulfillment})});\n      if(fulfillment==='delivery'&&settings?.whatsapp){const msg=`Pedido #${r.id}%0ACliente: ${encodeURIComponent(customer.name)}%0ATelefone: ${encodeURIComponent(customer.phone)}%0AEntrega: ${encodeURIComponent(customer.address)}`;window.open(`https://wa.me/${String(settings.whatsapp).replace(/\\D/g,'')}?text=${msg}`,'_blank','noopener,noreferrer')}\n      setCustomer({name:'',phone:'',address:''});setCart([]);setDiscount(0);setCartOpen(false);setProducts(await api<Product[]>('/api/products?storefront=true'));showToast(`Pedido #${r.id} confirmado — dados pessoais não foram armazenados`);"
if old in s:
    s = s.replace(old, new)
store.write_text(s, encoding="utf-8")

s = manager.read_text(encoding="utf-8")
pat = re.compile(r'function CustomersView\(\{rows,reload,toast\}:\{rows:Customer\[\];reload:\(\)=>void;toast:\(s:string\)=>void\}\)\{.*?\}\nfunction SuppliersView', re.S)
replacement = '''function CustomersView({rows}:{rows:Customer[];reload:()=>void;toast:(s:string)=>void}){const total=rows[0];return <div className="split-layout"><article className="panel data-panel"><PanelHead title="Clientes — modo privacidade" action="Zero retenção de PII"/><div className="people-list"><div><div className="person-avatar">AN</div><div><b>Compras anônimas</b><small>Nomes, telefones, e-mails e endereços não são armazenados</small></div><span>{total?.orders||0} pedidos</span><strong>{money(total?.spent||0)}</strong></div></div></article><aside className="panel side-form"><h3>Privacidade por padrão</h3><p>O CRM mantém apenas métricas de vendas. Dados necessários para entrega são usados somente durante o checkout e encaminhados ao canal operacional, sem retenção no banco da Adega CRM.</p><div className="security-note">LGPD · minimização · zero-data retention para clientes</div></aside></div>}\nfunction SuppliersView'''
s, _ = pat.subn(replacement, s)
manager.write_text(s, encoding="utf-8")

# Do not ship default operator passwords/PINs in normalized commercial source.
s = auth.read_text(encoding="utf-8")
s = s.replace('            if ENV == "production" and not os.getenv("ADEGA_ADMIN_PASSWORD"):\n                raise RuntimeError("ADEGA_ADMIN_PASSWORD é obrigatório em produção")\n            password = os.getenv("ADEGA_ADMIN_PASSWORD", "Adega@2026!")\n            pin = os.getenv("ADEGA_ADMIN_PIN", "260826")\n',
'''            password = os.getenv("ADEGA_ADMIN_PASSWORD")\n            pin = os.getenv("ADEGA_ADMIN_PIN")\n            if not password or not pin:\n                raise RuntimeError("ADEGA_ADMIN_PASSWORD e ADEGA_ADMIN_PIN são obrigatórios; use variáveis de ambiente")\n''')
auth.write_text(s, encoding="utf-8")

(root / "docs").mkdir(exist_ok=True)
(root / "docs/PRIVACY-BY-DESIGN.md").write_text('''# Privacy by Design — Adega CRM\n\n## Regra principal\nO Adega CRM não persiste dados pessoais de clientes finais. Nome, telefone, e-mail, CPF, RG, data de nascimento e endereço não entram no banco operacional do CRM.\n\n## Checkout e entrega\nQuando contato ou endereço forem necessários, ficam apenas no estado temporário da interface e são encaminhados ao canal operacional configurado. O pedido salvo contém somente itens, valores, canal, pagamento e referência técnica de retirada/entrega.\n\n## Persistência permitida\n- catálogo, preços, estoque e SKU;\n- pedidos sem identificação pessoal;\n- itens, quantidades, canal e forma de pagamento;\n- despesas, promoções e métricas agregadas;\n- contas internas de operadores necessárias à autenticação;\n- dados comerciais de fornecedores quando necessários à operação.\n\n## Proibições\n- não registrar corpo de checkout em logs;\n- não salvar CPF, RG, nascimento, nome, telefone, e-mail ou endereço de consumidor;\n- não usar PII de clientes em audit_log;\n- não versionar `.env`, tokens, credenciais ou bancos `.db`;\n- integrações externas recebem apenas o mínimo necessário para a operação.\n''', encoding="utf-8")

(root / ".gitignore").write_text('''.env\n.env.*\n!.env.example\n*.db\n*.sqlite\n*.sqlite3\n__pycache__/\n.pytest_cache/\n.next/\nnode_modules/\ncoverage/\n*.log\n.DS_Store\n''', encoding="utf-8")
