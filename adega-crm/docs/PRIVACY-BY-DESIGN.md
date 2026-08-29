# Privacy by Design — Adega CRM

## Regra principal
O Adega CRM não persiste dados pessoais de clientes finais. Nome, telefone, e-mail, CPF, RG, data de nascimento e endereço não entram no banco operacional do CRM.

## Checkout e entrega
Quando contato ou endereço forem necessários, ficam apenas no estado temporário da interface e são encaminhados ao canal operacional configurado. O pedido salvo contém somente itens, valores, canal, pagamento e referência técnica de retirada/entrega.

## Persistência permitida
- catálogo, preços, estoque e SKU;
- pedidos sem identificação pessoal;
- itens, quantidades, canal e forma de pagamento;
- despesas, promoções e métricas agregadas;
- contas internas de operadores necessárias à autenticação;
- dados comerciais de fornecedores quando necessários à operação.

## Proibições
- não registrar corpo de checkout em logs;
- não salvar CPF, RG, nascimento, nome, telefone, e-mail ou endereço de consumidor;
- não usar PII de clientes em audit_log;
- não versionar `.env`, tokens, credenciais ou bancos `.db`;
- integrações externas recebem apenas o mínimo necessário para a operação.
