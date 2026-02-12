/* ========================================================
   MoodLift Landing Page — JavaScript
   ======================================================== */

(function () {
    'use strict';

    // ---- DOM references ----
    const header = document.getElementById('header');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav__link');

    // ========================================================
    //  1. Header background on scroll
    // ========================================================
    function handleHeaderScroll() {
        if (window.scrollY > 60) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleHeaderScroll, { passive: true });
    handleHeaderScroll(); // run once on load

    // ========================================================
    //  2. Mobile menu toggle
    // ========================================================
    function openMenu() {
        navToggle.classList.add('active');
        navMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    }

    navToggle.addEventListener('click', function () {
        if (navMenu.classList.contains('active')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Close menu when a nav link is clicked
    navLinks.forEach(function (link) {
        link.addEventListener('click', closeMenu);
    });

    // Close menu on outside click
    document.addEventListener('click', function (e) {
        if (
            navMenu.classList.contains('active') &&
            !navMenu.contains(e.target) &&
            !navToggle.contains(e.target)
        ) {
            closeMenu();
        }
    });

    // Close menu on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && navMenu.classList.contains('active')) {
            closeMenu();
        }
    });

    // ========================================================
    //  3. Smooth scroll for anchor links
    // ========================================================
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return; // skip plain "#"

            const target = document.querySelector(targetId);
            if (!target) return;

            e.preventDefault();
            const headerHeight = header.offsetHeight;
            const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth',
            });
        });
    });

    // ========================================================
    //  4. Intersection Observer — Fade-in on scroll
    // ========================================================
    function createFadeObserver() {
        var options = {
            root: null,
            rootMargin: '0px 0px -60px 0px',
            threshold: 0.15,
        };

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target); // animate only once
                }
            });
        }, options);

        document.querySelectorAll('.fade-in').forEach(function (el) {
            observer.observe(el);
        });
    }

    // Run observer after a tiny delay to ensure layout is settled
    if ('IntersectionObserver' in window) {
        createFadeObserver();
    } else {
        // Fallback: just show everything
        document.querySelectorAll('.fade-in').forEach(function (el) {
            el.classList.add('visible');
        });
    }

    // ========================================================
    //  5. Counter animation for community stats
    // ========================================================
    function animateCounter(el) {
        var target = parseInt(el.getAttribute('data-target'), 10);
        if (!target) return;

        var duration = 2000; // ms
        var start = 0;
        var startTime = null;

        function easeOutQuart(t) {
            return 1 - Math.pow(1 - t, 4);
        }

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var easedProgress = easeOutQuart(progress);
            var current = Math.floor(easedProgress * target);

            el.textContent = current.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = target.toLocaleString();
            }
        }

        requestAnimationFrame(step);
    }

    // Observe stat numbers
    (function () {
        var statNumbers = document.querySelectorAll('.stat__number[data-target]');
        if (!statNumbers.length) return;

        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        animateCounter(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.5 }
        );

        statNumbers.forEach(function (el) {
            observer.observe(el);
        });
    })();

    // ========================================================
    //  6. Active nav link highlighting on scroll
    // ========================================================
    (function () {
        var sections = document.querySelectorAll('section[id]');
        if (!sections.length) return;

        function highlightNav() {
            var scrollY = window.scrollY + header.offsetHeight + 100;

            sections.forEach(function (section) {
                var top = section.offsetTop;
                var height = section.offsetHeight;
                var id = section.getAttribute('id');
                var link = document.querySelector('.nav__link[href="#' + id + '"]');

                if (link) {
                    if (scrollY >= top && scrollY < top + height) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                }
            });
        }

        window.addEventListener('scroll', highlightNav, { passive: true });
    })();

})();
