'use client';
import { useEffect, useRef } from 'react';
import { useShop } from './ShopProvider';

/** Scroll reveals, parallax and entrance animations. Runs after every page change; renders nothing. */
export default function PageFx() {
  const { pathname, fx, motionReady, RM, stillRef } = useShop();
  const ranWithoutMotion = useRef(false);

  useEffect(() => {
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => [...document.querySelectorAll(s)];
    let io = null, timer = 0;

    // fade-up reveals
    const els = $$('.fx');
    if (RM.current || !('IntersectionObserver' in window)) els.forEach((e) => e.classList.add('in'));
    else {
      io = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }), { rootMargin: '0px 0px -5% 0px' });
      els.forEach((e) => io.observe(e));
      timer = setTimeout(() => els.forEach((e) => e.classList.add('in')), 3500);
    }

    const { gsap, ScrollTrigger } = fx.current;
    if (!motionReady || !gsap || RM.current) {
      if (!motionReady) ranWithoutMotion.current = true;
      return () => { if (io) io.disconnect(); clearTimeout(timer); };
    }
    // if the libraries arrived after the page was already showing, skip the entrance animation (no late pop-in)
    const still = stillRef.current || ranWithoutMotion.current;
    stillRef.current = false;
    ranWithoutMotion.current = false;

    ScrollTrigger.getAll().forEach((s) => s.kill());
    $$('.pd .im > img').forEach((img) =>
      gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
    if (!still) {
      gsap.from('.rule', { scaleX: 0, duration: 0.8, ease: 'power3.inOut', clearProps: 'transform' });
      gsap.from('.wm .ch', { yPercent: 112, duration: 0.8, ease: 'power4.out', delay: 0.05, clearProps: 'transform' });
      if ($('.eb-t')) gsap.from('.eb-t > *,.eb-i', { y: 22, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out', delay: 0.2, clearProps: 'transform,opacity' });
      const ft = $('footer');
      if (ft && ft.getBoundingClientRect().top > window.innerHeight) {
        gsap.from('.big,.c26', { yPercent: 20, opacity: 0, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: 'footer', start: 'top 90%', once: true } });
      }
    }
    ScrollTrigger.refresh();

    let lw = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lw) return;
      lw = window.innerWidth;
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (io) io.disconnect();
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      ScrollTrigger.getAll().forEach((s) => s.kill());
    };
  }, [pathname, motionReady, fx, RM, stillRef]);

  return null;
}
