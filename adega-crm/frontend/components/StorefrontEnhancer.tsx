'use client';

import { useEffect } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/animations/gsap';

const ADD_SELECTOR = '.hero-buy-row > button, .product-info > button, .modal-product-info > button';

export default function StorefrontEnhancer() {
  useEffect(() => {
    let root: HTMLElement | null = null;
    let drawer: HTMLElement | null = null;
    let drawerObserver: MutationObserver | null = null;
    let bootObserver: MutationObserver | null = null;
    let clickHandler: ((event: Event) => void) | null = null;

    const animateCartState = (open: boolean) => {
      if (!root || !drawer || prefersReducedMotion()) return;
      const stage = root.querySelector<HTMLElement>('.store-stage');
      const cartButton = root.querySelector<HTMLElement>('.header-cart');
      const headIcon = drawer.querySelector<SVGElement>('.drawer-head svg');
      const choices = drawer.querySelectorAll<HTMLElement>('.fulfillment button');
      const checkout = drawer.querySelector<HTMLElement>('.checkout-next');

      const animatedTargets = [stage, cartButton, headIcon, ...Array.from(choices), checkout].filter(Boolean);
      gsap.killTweensOf(animatedTargets);

      if (open) {
        const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });
        if (stage) tl.to(stage, { x: -5, scale: 0.994, duration: 0.34, ease: 'power3.out' }, 0);
        if (cartButton) {
          tl.fromTo(cartButton, { scale: 1 }, { scale: 1.06, duration: 0.16, ease: 'power2.out' }, 0)
            .to(cartButton, { scale: 1, duration: 0.28, ease: 'back.out(2)' }, 0.16);
        }
        if (headIcon) tl.fromTo(headIcon, { rotate: -16, scale: 0.72 }, { rotate: 0, scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, 0.08);
        if (choices.length) tl.fromTo(choices, { y: 8, autoAlpha: 0.55 }, { y: 0, autoAlpha: 1, duration: 0.28, stagger: 0.045, ease: 'power2.out', clearProps: 'transform,opacity,visibility' }, 0.12);
        if (checkout) tl.fromTo(checkout, { scale: 0.965 }, { scale: 1, duration: 0.42, ease: 'back.out(1.8)', clearProps: 'transform' }, 0.18);
      } else {
        if (stage) gsap.to(stage, { x: 0, scale: 1, duration: 0.3, ease: 'power3.out', clearProps: 'transform' });
        if (cartButton) gsap.to(cartButton, { scale: 1, duration: 0.22, ease: 'power2.out', clearProps: 'transform' });
      }
    };

    const attach = () => {
      const candidate = document.querySelector<HTMLElement>('.storefront-app');
      if (!candidate || candidate === root) return Boolean(root && drawer);
      const candidateDrawer = candidate.querySelector<HTMLElement>('.store-cart-drawer');
      if (!candidateDrawer) return false;
      root = candidate;
      drawer = candidateDrawer;

      clickHandler = (event: Event) => {
        const target = event.target instanceof Element ? event.target.closest<HTMLElement>(ADD_SELECTOR) : null;
        if (!target || target.hasAttribute('disabled')) return;

        // React's add-to-cart handler runs first; then the cart opens as a fixed popup.
        window.setTimeout(() => {
          if (!root) return;
          if (target.closest('.modal-product-info')) {
            root.querySelector<HTMLButtonElement>('.modal-x')?.click();
          }
          window.setTimeout(() => {
            const cart = root?.querySelector<HTMLButtonElement>('.header-cart');
            const activeDrawer = root?.querySelector('.store-cart-drawer.open');
            if (cart && !activeDrawer) cart.click();
          }, 70);
        }, 60);
      };
      root.addEventListener('click', clickHandler);

      drawerObserver = new MutationObserver(() => animateCartState(Boolean(drawer?.classList.contains('open'))));
      drawerObserver.observe(drawer, { attributes: true, attributeFilter: ['class'] });
      return true;
    };

    if (!attach()) {
      bootObserver = new MutationObserver(() => {
        if (attach()) bootObserver?.disconnect();
      });
      bootObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      if (root && clickHandler) root.removeEventListener('click', clickHandler);
      drawerObserver?.disconnect();
      bootObserver?.disconnect();
    };
  }, []);

  return null;
}
