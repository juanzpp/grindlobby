'use client';

import { gsap, isMobileMotionViewport, prefersReducedMotion, setMotionHint, clearMotionHint } from './gsap';

type LayerOptions = {
  card?: string;
  backdrop?: string;
  drawer?: boolean;
};

export function pressFeedback(target: Element | null, scale = 0.97) {
  if (!target || prefersReducedMotion()) return;
  gsap.killTweensOf(target);
  gsap.timeline({ defaults: { overwrite: true } })
    .to(target, { scale, duration: 0.07, ease: 'power1.out' })
    .to(target, { scale: 1, duration: 0.16, ease: 'power2.out', clearProps: 'transform' });
}

export function pulseFeedback(target: gsap.TweenTarget, scale = 1.08) {
  if (prefersReducedMotion()) return;
  gsap.killTweensOf(target);
  gsap.timeline({ defaults: { overwrite: true } })
    .to(target, { scale, duration: 0.12, ease: 'power2.out' })
    .to(target, { scale: 1, duration: 0.2, ease: 'back.out(2)', clearProps: 'transform' });
}

export function animateLayerIn(layer: Element, options: LayerOptions = {}) {
  if (prefersReducedMotion()) {
    gsap.set(layer, { autoAlpha: 1 });
    return gsap.timeline();
  }
  const card = layer.querySelector(options.card || (options.drawer ? '.store-cart-drawer' : '.modal-card'));
  const backdrop = layer.querySelector(options.backdrop || '.modal-backdrop');
  const timeline = gsap.timeline();
  if (backdrop) timeline.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: 'power1.out' }, 0);
  if (card) {
    setMotionHint(card);
    timeline.fromTo(
      card,
      options.drawer ? { yPercent: 100, autoAlpha: 1 } : { y: isMobileMotionViewport() ? 24 : 10, scale: options.drawer ? 1 : 0.97, autoAlpha: 0 },
      {
        yPercent: options.drawer ? 0 : undefined,
        y: options.drawer ? undefined : 0,
        scale: 1,
        autoAlpha: 1,
        duration: options.drawer ? 0.32 : 0.24,
        ease: options.drawer ? 'power3.out' : 'power2.out',
        onComplete: () => clearMotionHint(card),
      },
      0,
    );
  }
  return timeline;
}

export function animateLayerOut(
  layer: Element | null,
  onComplete: () => void,
  options: LayerOptions = {},
) {
  if (!layer || prefersReducedMotion()) {
    onComplete();
    return;
  }
  const card = layer.querySelector(options.card || (options.drawer ? '.store-cart-drawer' : '.modal-card'));
  const backdrop = layer.querySelector(options.backdrop || '.modal-backdrop');
  const timeline = gsap.timeline({ onComplete });
  if (card) {
    setMotionHint(card);
    timeline.to(card, {
      yPercent: options.drawer ? 100 : undefined,
      y: options.drawer ? undefined : 10,
      scale: options.drawer ? 1 : 0.98,
      autoAlpha: 0,
      duration: options.drawer ? 0.24 : 0.16,
      ease: 'power2.in',
    }, 0);
  }
  if (backdrop) timeline.to(backdrop, { autoAlpha: 0, duration: 0.16, ease: 'power1.in' }, 0);
}

export function animateStatus(target: Element | null) {
  if (!target || prefersReducedMotion()) return;
  gsap.fromTo(target, { autoAlpha: 0.55, scale: 0.96 }, {
    autoAlpha: 1,
    scale: 1,
    duration: 0.22,
    ease: 'power2.out',
    clearProps: 'transform,opacity',
  });
}
