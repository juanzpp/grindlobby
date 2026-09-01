'use client';

import { DependencyList, RefObject, useEffect, useLayoutEffect } from 'react';
import { gsap, prefersReducedMotion } from './gsap';
import { animateLayerIn, pressFeedback } from './motion';

export function useScopedGsap(
  scope: RefObject<Element | null>,
  setup: () => void | (() => void),
  dependencies: DependencyList,
) {
  useLayoutEffect(() => {
    if (!scope.current) return;
    let dispose: void | (() => void);
    const context = gsap.context(() => { dispose = setup(); }, scope);
    return () => {
      dispose?.();
      context.revert();
    };
    // The caller owns the dependency list, like React's built-in effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}

export function useDelegatedPressFeedback(
  scope: RefObject<HTMLElement | null>,
  selector: string,
) {
  useEffect(() => {
    const root = scope.current;
    if (!root || prefersReducedMotion()) return;
    let touchStart: { pointerId: number; x: number; y: number; target: Element } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const target = (event.target as Element | null)?.closest(selector);
      if (!target || !root.contains(target)) return;
      if (event.pointerType === 'mouse') {
        pressFeedback(target);
        return;
      }
      touchStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, target };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!touchStart || event.pointerId !== touchStart.pointerId) return;
      const distance = Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y);
      const releasedOn = (event.target as Element | null)?.closest(selector);
      if (distance < 8 && releasedOn === touchStart.target) pressFeedback(touchStart.target);
      touchStart = null;
    };
    const cancelTouch = () => { touchStart = null; };
    root.addEventListener('pointerdown', onPointerDown, { passive: true });
    root.addEventListener('pointerup', onPointerUp, { passive: true });
    root.addEventListener('pointercancel', cancelTouch, { passive: true });
    return () => {
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', cancelTouch);
    };
  }, [scope, selector]);
}

export function useLayerEntranceObserver(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scope.current;
    if (!root || prefersReducedMotion() || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          const layers = node.matches('.catalog-layer') ? [node] : [...node.querySelectorAll('.catalog-layer')];
          for (const layer of layers) {
            animateLayerIn(layer, { card: '.catalog-card,.scanner-card', backdrop: '.modal-backdrop' });
          }
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [scope]);
}
