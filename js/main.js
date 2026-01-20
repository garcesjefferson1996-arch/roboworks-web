// main.js - JavaScript modular y optimizado

// Módulo de utilidades
const Utils = {
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
};

// Módulo de navegación
const Navigation = {
    init() {
        this.setupMobileMenu();
        this.setupSmoothScroll();
        this.setupActiveLinks();
    },
    
    setupMobileMenu() {
        const menuToggle = document.getElementById('menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (!menuToggle || !mobileMenu) return;
        
        menuToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
            const icon = menuToggle.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        });
        
        // Cerrar menú al hacer clic en enlace
        document.querySelectorAll('#mobile-menu a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            });
        });
    },
    
    setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            });
        });
    },
    
    setupActiveLinks() {
        // Implementar seguimiento de sección activa
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('nav a[href^="#"]');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('text-blue-600', 'font-bold');
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('text-blue-600', 'font-bold');
                        }
                    });
                }
            });
        }, { threshold: 0.5 });
        
        sections.forEach(section => observer.observe(section));
    }
};

// Módulo de formularios
const Forms = {
    init() {
        this.setupContactForm();
        this.setupValidation();
    },
    
    setupContactForm() {
        const contactForm = document.getElementById('contact-form');
        if (!contactForm) return;
        
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Validación
            if (!this.validateForm(contactForm)) return;
            
            // Mostrar estado de carga
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enviando...';
            submitBtn.disabled = true;
            
            try {
                // Simular envío (en producción sería fetch a un endpoint)
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Mostrar éxito
                this.showNotification('¡Mensaje enviado con éxito! Te contactaremos en breve.', 'success');
                contactForm.reset();
            } catch (error) {
                this.showNotification('Error al enviar el mensaje. Por favor, inténtalo de nuevo.', 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    },
    
    validateForm(form) {
        let isValid = true;
        const requiredFields = form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.markInvalid(field);
                isValid = false;
            } else {
                this.markValid(field);
                
                // Validaciones específicas
                if (field.type === 'email' && !this.isValidEmail(field.value)) {
                    this.markInvalid(field, 'Por favor, ingresa un email válido');
                    isValid = false;
                }
                
                if (field.type === 'tel' && !this.isValidPhone(field.value)) {
                    this.markInvalid(field, 'Por favor, ingresa un teléfono válido');
                    isValid = false;
                }
            }
        });
        
        return isValid;
    },
    
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    isValidPhone(phone) {
        const re = /^[\+]?[0-9\s\-\(\)]+$/;
        return re.test(phone) && phone.length >= 8;
    },
    
    markInvalid(field, message) {
        field.classList.add('border-red-500');
        field.classList.remove('border-gray-300');
        
        // Remover mensaje de error anterior
        const existingError = field.parentElement.querySelector('.error-message');
        if (existingError) existingError.remove();
        
        // Agregar nuevo mensaje
        if (message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message text-red-500 text-sm mt-1';
            errorDiv.textContent = message;
            field.parentElement.appendChild(errorDiv);
        }
    },
    
    markValid(field) {
        field.classList.remove('border-red-500');
        field.classList.add('border-gray-300');
        
        const existingError = field.parentElement.querySelector('.error-message');
        if (existingError) existingError.remove();
    },
    
    showNotification(message, type) {
        // Crear notificación
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
            type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remover después de 5 segundos
        setTimeout(() => {
            notification.classList.add('opacity-0', 'translate-x-full');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
};

// Módulo de animaciones
const Animations = {
    init() {
        this.setupScrollAnimations();
        this.setupHoverEffects();
        this.setupLazyLoading();
    },
    
    setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-up');
                    
                    // Animar elementos hijos con retraso
                    const children = entry.target.querySelectorAll('.animate-child');
                    children.forEach((child, index) => {
                        child.style.animationDelay = `${index * 0.1}s`;
                        child.classList.add('fade-in-up');
                    });
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        // Observar elementos con data-animate
        document.querySelectorAll('[data-animate]').forEach(el => {
            observer.observe(el);
        });
    },
    
    setupHoverEffects() {
        // Efectos hover para cards
        document.querySelectorAll('.card-hover').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.classList.add('shadow-xl');
            });
            
            card.addEventListener('mouseleave', () => {
                card.classList.remove('shadow-xl');
            });
        });
    },
    
    setupLazyLoading() {
        // Lazy loading para imágenes
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.add('loaded');
                        }
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            document.querySelectorAll('.lazy-image').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
};

// Módulo de analítica y métricas
const Analytics = {
    init() {
        this.trackPageViews();
        this.trackClicks();
        this.trackFormInteractions();
        this.monitorPerformance();
    },
    
    trackPageViews() {
        // Simular tracking de página
        console.log('Página vista:', window.location.pathname);
        
        // En producción: enviar a Google Analytics, etc.
        // gtag('config', 'GA_MEASUREMENT_ID');
    },
    
    trackClicks() {
        document.addEventListener('click', (e) => {
            const target = e.target;
            
            // Track botones principales
            if (target.matches('.cta-button, .btn-primary, [data-track="click"]')) {
                console.log('Botón clickeado:', target.textContent);
            }
            
            // Track enlaces externos
            if (target.matches('a[href^="http"]') && !target.href.includes(window.location.host)) {
                console.log('Enlace externo clickeado:', target.href);
            }
        });
    },
    
    trackFormInteractions() {
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', () => {
                console.log('Formulario enviado:', form.id);
            });
        });
    },
    
    monitorPerformance() {
        // Monitorizar métricas de performance
        window.addEventListener('load', () => {
            setTimeout(() => {
                if ('performance' in window) {
                    const perfData = window.performance.timing;
                    const loadTime = perfData.loadEventEnd - perfData.navigationStart;
                    console.log('Tiempo de carga:', loadTime + 'ms');
                }
            }, 0);
        });
    }
};

// Inicialización principal
document.addEventListener('DOMContentLoaded', () => {
    console.log('RoboWorks - Inicializando aplicación');
    
    // Inicializar módulos
    Navigation.init();
    Forms.init();
    Animations.init();
    Analytics.init();
    
    // Agregar clase de cargado
    document.body.classList.add('loaded');
    
    console.log('RoboWorks - Aplicación inicializada');
});

// Manejar errores globalmente
window.addEventListener('error', (e) => {
    console.error('Error capturado:', e.error);
    // En producción: enviar a servicio de tracking de errores
});

// Optimizar para mobile
window.addEventListener('resize', Utils.debounce(() => {
    console.log('Ventana redimensionada:', window.innerWidth);
}, 250));