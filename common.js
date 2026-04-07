// Initialize Lucide Icons globally
document.addEventListener('DOMContentLoaded', function() {
    if (window.lucide) {
        lucide.createIcons();
    }
});

// Generate navigation menu
function createNavigation() {
    return `
        <nav class="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center gap-8">
                        <a href="/" class="flex items-center gap-2 font-bold text-lg text-blue-700 hover:text-blue-800 transition">
                            <i data-lucide="activity" class="w-6 h-6"></i>
                            <span>Vật Lý Trị Liệu</span>
                        </a>
                        <div class="hidden md:flex gap-1">
                            <a href="/" class="nav-link px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Trang Chủ</a>
                            <a href="/pages/upload.html" class="nav-link px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Upload Dữ Liệu</a>
                            <a href="/pages/about.html" class="nav-link px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Giới Thiệu</a>
                            <a href="/pages/contact.html" class="nav-link px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Liên Hệ</a>
                        </div>
                    </div>
                    <div class="md:hidden">
                        <button id="mobile-menu-btn" class="p-2 rounded-md text-slate-700 hover:bg-slate-100">
                            <i data-lucide="menu" class="w-6 h-6"></i>
                        </button>
                    </div>
                </div>
            </div>
            <!-- Mobile menu -->
            <div id="mobile-menu" class="hidden md:hidden bg-white border-t border-slate-200">
                <a href="/" class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Trang Chủ</a>
                <a href="/pages/upload.html" class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Upload Dữ Liệu</a>
                <a href="/pages/about.html" class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Giới Thiệu</a>
                <a href="/pages/contact.html" class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Liên Hệ</a>
            </div>
        </nav>
    `;
}

// Insert navigation at the beginning of body
function initNavigation() {
    const nav = document.createElement('div');
    nav.innerHTML = createNavigation();
    document.body.insertBefore(nav.firstElementChild, document.body.firstChild);
    
    // Handle mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }
    
    // Highlight current page
    highlightCurrentPage();
    
    // Re-initialize Lucide Icons for newly added elements
    if (window.lucide) {
        lucide.createIcons();
    }
}

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

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
    initNavigation();
}
