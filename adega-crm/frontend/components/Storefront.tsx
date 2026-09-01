'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Search, ShoppingCart, Heart, UserRound, Home, Grid2X2, Tag, Flame, Package,
  Wine, Beer, Zap, ChevronRight, ChevronLeft, MapPin, Truck, ShieldCheck,
  X, Plus, Minus, Trash2, Menu, BadgePercent, Star,
  Headphones, LockKeyhole, Bike, Store, ArrowRight, SlidersHorizontal,
  Sparkles, CheckCircle2, Clock3, Gift, ChevronDown
} from 'lucide-react';
import ProductArt from './ProductArt';
import AnimatedNumber from './motion/AnimatedNumber';
import { api, money } from '@/lib/api';
import { FULL_MOTION_QUERY, getScrollTrigger, gsap, isMobileMotionViewport, prefersReducedMotion, setMotionHint, clearMotionHint } from '@/lib/animations/gsap';
import { animateLayerIn, animateLayerOut, pressFeedback, pulseFeedback } from '@/lib/animations/motion';
import { useDelegatedPressFeedback } from '@/lib/animations/react';

type Product={id:number;name:string;category:string;sku?:string;cost:number;price:number;stock:number;min_stock:number;storefront:number;volume_ml?:number;image_url?:string};
type SettingsData={store_name:string;whatsapp:string;pix_key:string;delivery_fee:number;minimum_order:number;store_open:boolean};
type CartItem=Product&{qty:number};

const isRed=(p?:Product)=>/johnnie\s+walker.*red\s+label|red\s+label/i.test(p?.name||'');
const catIcon=(c:string)=>{const s=c.toLowerCase();if(s.includes('cervej'))return Beer;if(s.includes('energ'))return Zap;return Wine};

export default function Storefront(){
  const [products,setProducts]=useState<Product[]>([]);
  const [settings,setSettings]=useState<SettingsData|null>(null);
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('');
  const [sort,setSort]=useState('featured');
  const [cart,setCart]=useState<CartItem[]>([]);
  const [cartOpen,setCartOpen]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const [selected,setSelected]=useState<Product|null>(null);
  const [favorites,setFavorites]=useState<Set<number>>(new Set());
  const [fulfillment,setFulfillment]=useState<'delivery'|'pickup'>('delivery');
  const [coupon,setCoupon]=useState('');
  const [discount,setDiscount]=useState(0);
  const [customer,setCustomer]=useState({name:'',phone:'',address:''});
  const [toast,setToast]=useState('');
  const [checkoutState,setCheckoutState]=useState<'idle'|'loading'|'success'>('idle');
  const appRef=useRef<HTMLDivElement|null>(null);
  const toastTimer=useRef<number|undefined>(undefined);
  const checkoutTimer=useRef<number|undefined>(undefined);
  const showToast=useCallback((t:string)=>{setToast(t);if(toastTimer.current)window.clearTimeout(toastTimer.current);toastTimer.current=window.setTimeout(()=>setToast(''),2500)},[]);

  useDelegatedPressFeedback(appRef,'.hero-buy-row>button,.product-info>button,.product-visual,.drawer-qty button,.checkout-next,.fulfillment button,.quick-tabs button,.category-ribbon button,.mobile-store-bottom button');
  useEffect(()=>()=>{if(toastTimer.current)window.clearTimeout(toastTimer.current);if(checkoutTimer.current)window.clearTimeout(checkoutTimer.current)},[]);

  useEffect(()=>{
    Promise.all([api<Product[]>('/api/products?storefront=true'),api<SettingsData>('/api/settings')])
      .then(([p,s])=>{setProducts(p);setSettings(s)}).catch(e=>showToast(e.message));
    const f=localStorage.getItem('adega-next-favorites');
    if(f) try{setFavorites(new Set(JSON.parse(f)))}catch{}
  },[showToast]);
  useEffect(()=>{localStorage.setItem('adega-next-favorites',JSON.stringify([...favorites]))},[favorites]);

  useLayoutEffect(()=>{
    if(!products.length||!appRef.current)return;
    const media=gsap.matchMedia();
    media.add({motion:FULL_MOTION_QUERY,mobile:'(max-width: 820px)'},context=>{
      if(!context.conditions?.motion)return;
      const mobile=Boolean(context.conditions.mobile);
      const targets=appRef.current?.querySelectorAll('.hero-kicker,.hero-brand,.hero-title span,.hero-title strong,.hero-desc,.hero-buy-row,.hero-trust,.category-ribbon button');
      if(targets)setMotionHint(targets);
      const timeline=gsap.timeline({defaults:{ease:'power3.out'},onComplete:()=>targets&&clearMotionHint(targets)});
      timeline
        .fromTo('.hero-kicker,.hero-brand',{autoAlpha:0,y:12},{autoAlpha:1,y:0,duration:mobile?.34:.55,stagger:.055})
        .fromTo('.hero-title span,.hero-title strong',{autoAlpha:0,y:mobile?14:28,scale:.96},{autoAlpha:1,y:0,scale:1,duration:mobile?.48:.72,stagger:.06},mobile?.12:.18)
        .fromTo('.hero-desc,.hero-buy-row,.hero-trust',{autoAlpha:0,y:14},{autoAlpha:1,y:0,duration:mobile?.36:.52,stagger:.055},mobile?.26:.36)
        .fromTo('.category-ribbon button',{autoAlpha:0,y:10},{autoAlpha:1,y:0,duration:.3,stagger:mobile?.025:.04},mobile?.46:.66);
    });
    return()=>media.revert();
  },[products.length]);

  useEffect(()=>{
    if(!cartOpen)return;
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setCartOpen(false)};
    document.addEventListener('keydown',close);
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',close);document.body.style.overflow=previous};
  },[cartOpen]);

  useLayoutEffect(()=>{
    const root=appRef.current;if(!root||!isMobileMotionViewport())return;
    const drawer=root.querySelector('.store-cart-drawer'),overlay=root.querySelector('.cart-overlay');
    if(!drawer||!overlay)return;
    root.classList.add('gsap-drawer-ready');
    gsap.set(drawer,{x:0,xPercent:0,yPercent:100,autoAlpha:0,pointerEvents:'none'});
    gsap.set(overlay,{autoAlpha:0,pointerEvents:'none'});
    return()=>{root.classList.remove('gsap-drawer-ready');gsap.set([drawer,overlay],{clearProps:'all'});};
  },[]);

  useLayoutEffect(()=>{
    const root=appRef.current;if(!root||!isMobileMotionViewport())return;
    const drawer=root.querySelector('.store-cart-drawer'),overlay=root.querySelector('.cart-overlay');
    if(!drawer||!overlay)return;
    gsap.killTweensOf([drawer,overlay]);
    if(cartOpen){
      gsap.set([drawer,overlay],{visibility:'visible'});gsap.set(drawer,{pointerEvents:'auto'});gsap.set(overlay,{pointerEvents:'auto'});
      const timeline=gsap.timeline().to(overlay,{autoAlpha:1,duration:.18,ease:'power1.out'},0).to(drawer,{x:0,xPercent:0,yPercent:0,autoAlpha:1,duration:.32,ease:'power3.out'},0);
      timeline.fromTo(root.querySelectorAll('.drawer-item'),{autoAlpha:0,x:14},{autoAlpha:1,x:0,duration:.24,stagger:.035,ease:'power2.out',clearProps:'transform,opacity'},.1);
      return()=>{timeline.kill()};
    }
    const timeline=gsap.timeline({onComplete:()=>{gsap.set([drawer,overlay],{visibility:'hidden',pointerEvents:'none'});}}).to(drawer,{yPercent:100,autoAlpha:0,duration:.24,ease:'power2.in'},0).to(overlay,{autoAlpha:0,duration:.16,ease:'power1.in'},0);
    return()=>{timeline.kill()};
  },[cartOpen]);

  useLayoutEffect(()=>{
    if(!selected||!appRef.current)return;
    const layer=appRef.current.querySelector('.product-modal-next');if(!layer)return;
    const timeline=animateLayerIn(layer,{card:'.product-modal-box',backdrop:'.product-modal-overlay'});
    if(!prefersReducedMotion())timeline?.fromTo('.modal-product-visual .real-product,.modal-product-visual .bottle-art',{autoAlpha:0,y:18,rotate:-2},{autoAlpha:1,y:0,rotate:0,duration:.42,ease:'power3.out'},.06);
    return()=>{timeline.kill()};
  },[selected]);

  const red=products.find(isRed)||products[0];
  const featuredCombo=red?{...red,name:'Combo Baly + Eternity Watermelon',price:55}:undefined;
  const categories=useMemo(()=>[...new Set(products.map(p=>p.category))],[products]);
  const filtered=useMemo(()=>{
    let l=products.filter(p=>(!query||`${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()))&&(!category||p.category===category));
    if(sort==='priceAsc')l=[...l].sort((a,b)=>a.price-b.price);
    if(sort==='priceDesc')l=[...l].sort((a,b)=>b.price-a.price);
    if(sort==='name')l=[...l].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    return l;
  },[products,query,category,sort]);

  useLayoutEffect(()=>{
    if(prefersReducedMotion()||!appRef.current)return;
    const active=appRef.current.querySelectorAll('.category-ribbon button.active,.quick-tabs button.active');
    if(active.length)pulseFeedback(active,1.025);
  },[category]);

  useEffect(()=>{
    if(prefersReducedMotion()||!filtered.length)return;
    let cancelled=false,context:gsap.Context|undefined;
    getScrollTrigger().then(ScrollTrigger=>{if(cancelled||!ScrollTrigger||!appRef.current)return;context=gsap.context(()=>{
      gsap.from('.store-product-card',{scrollTrigger:{trigger:'.store-product-grid',start:'top 90%',once:true},y:window.innerWidth<=820?14:20,opacity:0,duration:window.innerWidth<=820?.38:.58,stagger:window.innerWidth<=820?.035:.045,ease:'power2.out',clearProps:'transform,opacity'});
      if(window.innerWidth>820)gsap.to('.store-promo-band',{scrollTrigger:{trigger:'.store-promo-band',start:'top bottom',end:'bottom top',scrub:1.2},backgroundPosition:'100% 50%',ease:'none'});
    },appRef)});
    return()=>{cancelled=true;context?.revert()};
  },[filtered.length]);

  const animateFly=(source?:HTMLElement|null)=>{
    if(prefersReducedMotion()||!source)return;
    const target=document.querySelector('.header-cart') as HTMLElement|null;
    if(!target)return;
    const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
    const orb=document.createElement('div');
    orb.className='cart-fly-orb';
    orb.innerHTML='<span>+</span>';
    Object.assign(orb.style,{left:`${a.left+a.width/2-14}px`,top:`${a.top+a.height/2-14}px`});
    document.body.appendChild(orb);
    gsap.to(orb,{x:(b.left+b.width/2)-(a.left+a.width/2),y:(b.top+b.height/2)-(a.top+a.height/2),scale:.45,rotation:260,autoAlpha:0,duration:.62,ease:'power2.inOut',onComplete:()=>orb.remove()});
    pulseFeedback(target,1.055);
  };

  const add=(p:Product,qty=1,source?:HTMLElement|null)=>{
    if(p.stock<=0)return showToast('Produto sem estoque');
    setCart(c=>{const x=c.find(i=>i.id===p.id);if(x)return c.map(i=>i.id===p.id?{...i,qty:Math.min(p.stock,i.qty+qty)}:i);return [...c,{...p,qty:Math.min(p.stock,qty)}]});
    showToast(`${p.name} adicionado`);
    pressFeedback(source||null);
    animateFly(source);
    pulseFeedback('.cart-badge',1.4);
  };

  const change=(id:number,d:number)=>{setCart(c=>c.map(i=>i.id===id?{...i,qty:Math.max(0,Math.min(i.stock,i.qty+d))}:i).filter(i=>i.qty>0));window.requestAnimationFrame(()=>pulseFeedback(appRef.current?.querySelector(`[data-drawer-item="${id}"] .drawer-qty span`)||null,1.12))};
  const removeCartItem=(id:number)=>{const done=()=>setCart(c=>c.filter(x=>x.id!==id));const row=appRef.current?.querySelector(`[data-drawer-item="${id}"]`);if(!row||prefersReducedMotion())return done();gsap.to(row,{autoAlpha:0,x:16,duration:.16,ease:'power2.in',onComplete:done})};
  const count=cart.reduce((a,b)=>a+b.qty,0),subtotal=cart.reduce((a,b)=>a+b.qty*b.price,0),fee=fulfillment==='delivery'?Number(settings?.delivery_fee||0):0,total=Math.max(0,subtotal+fee-discount);
  const applyCoupon=()=>{if(coupon.trim().toUpperCase()==='ADEGA10'){const d=subtotal*.1;setDiscount(d);showToast('Cupom ADEGA10 aplicado')}else{setDiscount(0);showToast('Cupom inválido')}};
  const checkout=async()=>{
    if(!cart.length)return;
    if(!customer.name.trim())return showToast('Informe seu nome');
    if(total<Number(settings?.minimum_order||0))return showToast(`Pedido mínimo: ${money(settings?.minimum_order||0)}`);
    setCheckoutState('loading');
    try{
      const r=await api<any>('/api/storefront/orders',{method:'POST',body:JSON.stringify({channel:'storefront',payment_method:'pix',items:cart.map(i=>({product_id:i.id,qty:i.qty})),discount,external_id:fulfillment})});
      if(fulfillment==='delivery'&&settings?.whatsapp){const msg=`Pedido #${r.id}%0ACliente: ${encodeURIComponent(customer.name)}%0ATelefone: ${encodeURIComponent(customer.phone)}%0AEntrega: ${encodeURIComponent(customer.address)}`;window.open(`https://wa.me/${String(settings.whatsapp).replace(/\D/g,'')}?text=${msg}`,'_blank','noopener,noreferrer')}
      setCheckoutState('success');setCustomer({name:'',phone:'',address:''});setCart([]);setDiscount(0);setProducts(await api<Product[]>('/api/products?storefront=true'));showToast(`Pedido #${r.id} confirmado — dados pessoais não foram armazenados`);checkoutTimer.current=window.setTimeout(()=>{setCartOpen(false);setCheckoutState('idle')},420);
    }catch(e:any){setCheckoutState('idle');showToast(e.message)}
  };
  const toggleFav=(id:number)=>setFavorites(f=>{const n=new Set(f);if(n.has(id))n.delete(id);else n.add(id);return n});
  const tilt=(e:React.PointerEvent<HTMLElement>)=>{if(prefersReducedMotion()||window.innerWidth<900)return;const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;e.currentTarget.style.setProperty('--card-x',`${x*100}%`);e.currentTarget.style.setProperty('--card-y',`${y*100}%`);e.currentTarget.style.setProperty('--card-rx',`${(y-.5)*-5}deg`);e.currentTarget.style.setProperty('--card-ry',`${(x-.5)*7}deg`)};
  const untilt=(e:React.PointerEvent<HTMLElement>)=>{e.currentTarget.style.setProperty('--card-rx','0deg');e.currentTarget.style.setProperty('--card-ry','0deg')};
  const closeProduct=useCallback(()=>{const layer=appRef.current?.querySelector('.product-modal-next')||null;animateLayerOut(layer,()=>setSelected(null),{card:'.product-modal-box',backdrop:'.product-modal-overlay'})},[]);
  useEffect(()=>{if(!selected)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')closeProduct()};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[selected,closeProduct]);

  return <div ref={appRef} className="storefront-app storefront-cinematic">
    <div className="store-noise"/>
    <aside className={`store-left-rail ${menuOpen?'open':''}`}>
      <button className="rail-close" onClick={()=>setMenuOpen(false)}><X/></button>
      <div className="lux-logo"><div className="logo-crown">♛</div><strong>ADEGA</strong><span>DRINKS & BEBIDAS</span></div>
      <div className="delivery-box"><MapPin/><div><small>Entregar em:</small><b>R. das Palmeiras, 123</b><span>Centro · São Paulo, SP</span></div><ChevronRight/></div>
      <nav className="rail-nav"><button className="active"><Home/>Início</button><button onClick={()=>document.getElementById('categories')?.scrollIntoView({behavior:'smooth'})}><Grid2X2/>Categorias</button><button onClick={()=>document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}><Tag/>Ofertas<i/></button><button onClick={()=>document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}><Flame/>Mais vendidos</button><button><Package/>Combos</button>{categories.slice(0,6).map(c=>{const I=catIcon(c);return <button key={c} onClick={()=>{setCategory(c);document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}}><I/>{c}</button>})}</nav>
      <div className="coupon-card"><BadgePercent/><b>Desconto na 1ª compra</b><span>Use o cupom:</span><strong>ADEGA10</strong></div>
      <div className="express-card"><Bike/><div><b>Entrega Rápida</b><span>em até 45 min</span></div></div>
      <div className="rail-foot"><span>Adega Drinks © 2026</span><small>Todos os direitos reservados.</small></div>
    </aside>
    <div className={`rail-backdrop ${menuOpen?'show':''}`} onClick={()=>setMenuOpen(false)}/>

    <main className="store-stage">
      <header className="store-header">
        <button className="store-menu" onClick={()=>setMenuOpen(true)}><Menu/></button>
        <div className="store-mobile-brand"><b>ADEGA</b><span>CRM</span></div>
        <div className="store-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Busque por produtos, marcas..."/><kbd>⌘ K</kbd></div>
        <nav className="header-nav"><a className="active">Início</a><a onClick={()=>document.getElementById('categories')?.scrollIntoView({behavior:'smooth'})}>Categorias</a><a onClick={()=>document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}>Ofertas</a><a>Favoritos</a><a>Pedidos</a></nav>
        <button className="header-icon"><Heart/></button><button className="header-icon user"><UserRound/></button>
        <button className="header-cart" onClick={()=>setCartOpen(true)}><ShoppingCart/><div><b>Meu Carrinho</b><span>{count} {count===1?'item':'itens'}</span></div><em className="cart-badge">{count}</em></button>
      </header>

      <section className="store-hero-next premium-hero">
        <div className="hero-bg"/>
        <div className="hero-copy-next">
          <span className="hero-kicker"><Sparkles/> COMBO ESPECIAL DA CASA</span>
          <small className="hero-brand">BALY + ETERNITY</small>
          <h1 className="hero-title"><strong>COMBO</strong><span>Watermelon</span></h1>
          <p className="hero-desc">Uma combinação vibrante e refrescante, pronta para transformar qualquer encontro em uma noite memorável.</p>
          <div className="hero-buy-row"><button onClick={e=>featuredCombo&&add(featuredCombo,1,e.currentTarget)}><ShoppingCart/>ADICIONAR AO CARRINHO</button><div><strong>{money(55)}</strong></div></div>
          <div className="hero-trust"><span><ShieldCheck/>100% Original</span><span><Truck/>Entrega Rápida</span><span><Package/>{red?.stock||0} em estoque</span></div>
        </div>
        <div className="hero-static-product"><Image className="hero-static-image" src="/assets/hero-baly-eternity-watermelon.png" alt="Baly Energy Drink, Eternity Gin Watermelon e gelo sabor melancia" fill priority sizes="(max-width: 820px) 72vw, 56vw"/></div>
        <div className="hero-live-badge"><CheckCircle2/><span><b>Loja aberta</b><small>entrega média 35 min</small></span></div>
        <button className="hero-arrow left"><ChevronLeft/></button><button className="hero-arrow right"><ChevronRight/></button><div className="hero-pagination"><button className="active"/><button/><button/><button/><span>01 / 04</span></div>
      </section>

      <section id="categories" className="category-ribbon">{categories.slice(0,7).map((c,i)=>{const I=catIcon(c);return <button key={c} className={category===c?'active':''} onClick={()=>{setCategory(category===c?'':c);document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}}><div className={`category-mini-art cat-${i}`}><I/></div><span><b>{c}</b><small>Ver ofertas</small></span><ChevronRight className="category-arrow"/></button>})}</section>

      <section className="store-promo-band"><div><Gift/><span><small>HOJE NA ADEGA</small><b>Combos selecionados com até 20% OFF</b></span></div><div><Clock3/><span><small>ENTREGA EXPRESSA</small><b>Receba em até 45 minutos</b></span></div><button onClick={()=>document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}>Ver promoções <ArrowRight/></button></section>

      <section id="products" className="store-products-next">
        <div className="products-title"><div><span><Flame/>Mais Vendidos</span><p>Os favoritos da adega com ofertas para você.</p></div><div className="product-controls"><div className="quick-tabs"><button className={!category?'active':''} onClick={()=>setCategory('')}>Todos</button>{categories.slice(0,4).map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div><button className="filter-mobile"><SlidersHorizontal/></button><label className="sort-select"><select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Destaques</option><option value="priceAsc">Menor preço</option><option value="priceDesc">Maior preço</option><option value="name">Nome A-Z</option></select><ChevronDown/></label></div></div>
        <div className="store-product-grid">{filtered.slice(0,12).map((p,i)=><article onPointerMove={tilt} onPointerLeave={untilt} className={`store-product-card premium-product-card ${isRed(p)?'featured':''}`} key={p.id}>
          <div className="card-spotlight"/><span className="discount-chip">-{10+(i%4)*3}%</span>{i===0&&<span className="best-chip"><Star/>MAIS VENDIDO</span>}
          <button className={`fav ${favorites.has(p.id)?'active':''}`} onClick={()=>toggleFav(p.id)}><Heart fill={favorites.has(p.id)?'currentColor':'none'}/></button>
          <button className="product-visual" onClick={()=>setSelected(p)}><div className="product-floor-glow"/><ProductArt name={p.name} category={p.category} image={p.image_url}/></button>
          <div className="product-info"><small>{p.category}</small><h3>{p.name}</h3><div className="stars"><Star fill="currentColor"/><Star fill="currentColor"/><Star fill="currentColor"/><Star fill="currentColor"/><Star fill="currentColor"/><span>4,9</span></div><del>{money(p.price*1.12)}</del><strong>{money(p.price)}</strong><button onClick={e=>add(p,1,e.currentTarget)}><ShoppingCart/>Adicionar</button></div>
        </article>)}</div>{!filtered.length&&<div className="store-empty">Nenhum produto encontrado.</div>}
      </section>

      <section className="store-value-strip"><div><ShieldCheck/><span><b>Produtos originais</b><small>Qualidade garantida</small></span></div><div><BadgePercent/><span><b>Preços exclusivos</b><small>Ofertas toda semana</small></span></div><div><Truck/><span><b>Entrega rápida</b><small>Em até 45 minutos</small></span></div><div><LockKeyhole/><span><b>Pagamento seguro</b><small>Ambiente protegido</small></span></div><div><Headphones/><span><b>Atendimento premium</b><small>Fale com a gente</small></span></div></section>
    </main>

    <div className={`cart-overlay ${cartOpen?'open':''}`} onClick={()=>setCartOpen(false)}/>
    <aside className={`store-cart-drawer ${cartOpen?'open':''}`} role="dialog" aria-modal="true" aria-label="Meu carrinho" aria-hidden={!cartOpen}>
      <div className="drawer-head"><div><ShoppingCart/><span><small>SEU PEDIDO</small><h2>Meu Carrinho</h2></span></div><button onClick={()=>setCartOpen(false)}><X/></button></div>
      <div className="drawer-items">{cart.length?cart.map(i=><div className="drawer-item" data-drawer-item={i.id} key={i.id}><div className="drawer-art"><ProductArt name={i.name} category={i.category} image={i.image_url}/></div><div><b>{i.name}</b><small>{money(i.price)} cada</small><div className="drawer-qty"><button onClick={()=>change(i.id,-1)} aria-label="Diminuir quantidade"><Minus/></button><span>{i.qty}</span><button onClick={()=>change(i.id,1)} aria-label="Aumentar quantidade"><Plus/></button></div></div><strong><AnimatedNumber value={i.price*i.qty}/></strong><button className="drawer-delete" onClick={()=>removeCartItem(i.id)} aria-label={`Remover ${i.name}`}><Trash2/></button></div>):<div className="drawer-empty"><ShoppingCart/><h3>Seu carrinho está vazio</h3><p>Adicione seus rótulos favoritos.</p></div>}</div>
      <div className="fulfillment"><button className={fulfillment==='delivery'?'active':''} onClick={()=>setFulfillment('delivery')}><Truck/><span>Entrega<small>30–45 min</small></span></button><button className={fulfillment==='pickup'?'active':''} onClick={()=>setFulfillment('pickup')}><Store/><span>Retirada<small>10–15 min</small></span></button></div>
      <div className="drawer-form"><label>Nome<input value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})} placeholder="Seu nome"/></label><label>WhatsApp<input value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})} placeholder="(11) 99999-9999"/></label>{fulfillment==='delivery'&&<label>Endereço<input value={customer.address} onChange={e=>setCustomer({...customer,address:e.target.value})} placeholder="Rua, número e bairro"/></label>}<label>Cupom<div className="coupon-input"><input value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder="Digite seu cupom"/><button onClick={applyCoupon}>Aplicar</button></div></label></div>
      <div className="drawer-summary"><div><span>Subtotal</span><b><AnimatedNumber value={subtotal}/></b></div><div><span>Taxa de entrega</span><b><AnimatedNumber value={fee}/></b></div><div className="discount"><span>Desconto</span><b>− <AnimatedNumber value={discount}/></b></div><div className="grand"><span>Total</span><strong><AnimatedNumber value={total}/></strong></div></div>
      <button className={`checkout-next ${checkoutState}`} disabled={!cart.length||checkoutState!=='idle'} onClick={checkout}>{checkoutState==='loading'?<>PROCESSANDO…</>:checkoutState==='success'?<><CheckCircle2/>PEDIDO CONFIRMADO</>:<>FINALIZAR COMPRA <ArrowRight/></>}</button><div className="secure-check"><ShieldCheck/><span><b>Compra segura</b><small>Pedido integrado ao Adega CRM</small></span></div>
    </aside>

    {selected&&<div className="product-modal-next" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selected.name}`}><div className="product-modal-overlay" onClick={closeProduct}/><div className="product-modal-box"><button className="modal-x" onClick={closeProduct} aria-label="Fechar detalhes do produto"><X/></button><div className="modal-product-visual"><div className="modal-aura"/><ProductArt name={selected.name} category={selected.category} image={selected.image_url}/></div><div className="modal-product-info"><small>{selected.category} · SKU {selected.sku||'—'}</small><h2>{selected.name}</h2><div className="modal-rating"><Star fill="currentColor"/><Star fill="currentColor"/><Star fill="currentColor"/><Star fill="currentColor"/><Star fill="currentColor"/><span>4,9 · produto disponível</span></div><del>{money(selected.price*1.12)}</del><strong>{money(selected.price)}</strong><p>Estoque sincronizado em tempo real com o gestor. Escolha entrega ou retirada e finalize seu pedido com segurança.</p><div className="modal-features"><span><Package/><b>{selected.stock} un.</b><small>Em estoque</small></span><span><Truck/><b>30–45 min</b><small>Entrega média</small></span><span><ShieldCheck/><b>Original</b><small>Procedência</small></span></div><button onClick={e=>{add(selected,1,e.currentTarget);closeProduct()}}><ShoppingCart/>ADICIONAR AO CARRINHO</button></div></div></div>}

    <nav className="mobile-store-bottom"><button className="active"><Home/><span>Início</span></button><button onClick={()=>document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}><Tag/><span>Ofertas</span></button><button className="mobile-cart-main" onClick={()=>setCartOpen(true)}><ShoppingCart/><em>{count}</em></button><button><Package/><span>Pedidos</span></button><button onClick={()=>setMenuOpen(true)}><Menu/><span>Mais</span></button></nav>
    <div className={`toast-next ${toast?'show':''}`}>{toast}</div>
  </div>
}
