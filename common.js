// Initialize Lucide Icons globally
document.addEventListener('DOMContentLoaded', function() {
    if (window.lucide) {
        lucide.createIcons();
    }
});

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Highlight current page
    highlightCurrentPage();
});

// Highlight current page in navigation
function highlightCurrentPage() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if ((currentPath === '/' && href === '/') || 
            (currentPath !== '/' && currentPath.includes(href))) {
            link.classList.add('bg-blue-100', 'text-blue-700', 'font-semibold');
        }
    });
}
