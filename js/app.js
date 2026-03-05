/* ─── App Core: Router, Fetch Utility, Toast ─── */

const API_BASE = 'api';
let currentPage = 'dashboard';
let currentUser = null;

/* ── Fetch Utility ── */
async function api(endpoint, options = {}) {
    const url = `${API_BASE}/${endpoint}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options
    };
    try {
        const res = await fetch(url, config);
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Bir hata oluştu');
        }
        return data;
    } catch (err) {
        if (err.message === 'Failed to fetch') {
            throw new Error('Sunucuya bağlanılamıyor. PHP sunucusunun çalıştığından emin olun.');
        }
        throw err;
    }
}

/* ── Current User Role ── */
function getActiveRole() {
    return currentUser?.active_role || currentUser?.role || 'member';
}

function canManageBooks() {
    const role = getActiveRole();
    return ['admin', 'librarian', 'tester'].includes(role);
}

function canManageMembers() {
    const role = getActiveRole();
    return ['admin', 'librarian', 'tester'].includes(role);
}

function canManageBorrows() {
    const role = getActiveRole();
    return ['admin', 'librarian', 'tester'].includes(role);
}

function isTester() {
    return currentUser?.role === 'tester';
}

function getRoleLabel(role) {
    const map = {
        admin: 'Yönetici',
        librarian: 'Kütüphaneci',
        member: 'Üye',
        tester: 'Test Kullanıcı'
    };
    return map[role] || role;
}

function getRoleEmoji(role) {
    const map = {
        admin: '👑',
        librarian: '📚',
        member: '👤',
        tester: '🧪'
    };
    return map[role] || '👤';
}

/* ── Update UI for role ── */
function updateUIForRole() {
    const role = getActiveRole();

    // Sidebar menu items
    const membersNav = document.querySelector('[data-page="members"]');
    if (membersNav) {
        membersNav.style.display = canManageMembers() ? 'flex' : 'none';
    }

    // User role label in sidebar
    const roleEl = document.getElementById('userRole');
    if (roleEl) {
        const emoji = getRoleEmoji(role);
        roleEl.textContent = `${emoji} ${getRoleLabel(role)}`;
    }

    // Tester role switcher
    const roleSwitcher = document.getElementById('roleSwitcher');
    if (roleSwitcher) {
        roleSwitcher.style.display = isTester() ? 'block' : 'none';
    }
    const roleSwitcherSelect = document.getElementById('roleSwitcherSelect');
    if (roleSwitcherSelect) {
        roleSwitcherSelect.value = role;
    }

    // If current page is members and user can't access, redirect
    if (currentPage === 'members' && !canManageMembers()) {
        navigateTo('dashboard');
    }

    // Re-render current page to reflect role changes
    if (currentPage === 'books') renderBooks();
    else if (currentPage === 'borrows') renderBorrows();
}

/* ── Toast Notifications ── */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/* ── Router ── */
function navigateTo(page) {
    // Block member from accessing members page
    if (page === 'members' && !canManageMembers()) {
        showToast('Bu sayfaya erişim yetkiniz yok', 'warning');
        return;
    }

    currentPage = page;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');

    // Render page
    const content = document.getElementById('pageContent');
    content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'books': renderBooks(); break;
        case 'members': renderMembers(); break;
        case 'borrows': renderBorrows(); break;
        default: renderDashboard();
    }
}

/* ── Modal ── */
function openModal(html) {
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
});

/* ── Mobile Sidebar ── */
document.getElementById('mobileToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
});

document.getElementById('sidebarOverlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
});

/* ── Escape key to close modal ── */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

/* ── Format date helper ── */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ── Overdue badge updater ── */
async function updateOverdueBadge() {
    try {
        const stats = await api('borrows.php?action=stats');
        const badge = document.getElementById('overdueCountBadge');
        if (stats.overdue > 0) {
            badge.textContent = stats.overdue;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {
        // silently ignore
    }
}

/* ── Role Switcher Handler (tester only) ── */
async function switchRole(newRole) {
    try {
        const data = await api('auth.php?action=switch-role', {
            method: 'POST',
            body: JSON.stringify({ role: newRole })
        });
        currentUser = data.user;
        showToast(`Rol değiştirildi: ${getRoleEmoji(newRole)} ${getRoleLabel(newRole)}`, 'success');
        updateUIForRole();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
