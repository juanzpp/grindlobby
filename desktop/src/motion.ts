import { gsap } from 'gsap'
import { animate, stagger } from 'animejs'

export function animateSurface(root: HTMLElement | null) {
  if (!root) return
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-motion="panel"]'))
  gsap.killTweensOf(panels)
  gsap.fromTo(
    panels,
    { opacity: 0, y: 10, scale: 0.995 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.42,
      stagger: 0.035,
      ease: 'power2.out',
      clearProps: 'transform',
    },
  )

  const glows = root.querySelectorAll<HTMLElement>('[data-motion="glow"]')
  if (glows.length) {
    animate(glows, {
      opacity: [0.62, 0.94, 0.62],
      scale: [0.995, 1.012, 0.995],
      duration: 4200,
      delay: stagger(180),
      loop: true,
      ease: 'inOutSine',
    })
  }
}

export function animateLogin(root: HTMLElement | null) {
  if (!root) return
  const logo = root.querySelector<HTMLElement>('[data-login-logo]')
  const copy = root.querySelectorAll<HTMLElement>('[data-login-copy]')
  const card = root.querySelector<HTMLElement>('[data-login-card]')

  if (logo) {
    gsap.fromTo(logo, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(1.35)' })
  }
  if (copy.length) {
    gsap.fromTo(copy, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.55, stagger: 0.08, ease: 'power2.out' })
  }
  if (card) {
    gsap.fromTo(card, { opacity: 0, x: 18, scale: 0.99 }, { opacity: 1, x: 0, scale: 1, duration: 0.6, ease: 'power2.out' })
  }
}
