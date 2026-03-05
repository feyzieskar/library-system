/* ─── Auth Module ─── */

async function checkAuth() {
    try {
        const data = await api('auth.php?action=check');
        if (data.authenticated) {
            showApp(data.user);
        } else {
            showLoginView();
        }
    } catch (e) {
        showLoginView();
    }
}

function showLoginView() {
    document.getElementById('loginView').style.display = 'flex';
    document.getElementById('registerView').style.display = 'none';
    document.getElementById('appView').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('registerView').style.display = 'flex';
    document.getElementById('appView').style.display = 'none';
}

function showApp(user) {
    currentUser = user;
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('registerView').style.display = 'none';
    document.getElementById('appView').style.display = 'flex';

    // Update user info in sidebar
    const activeRole = user.active_role || user.role;
    document.getElementById('userName').textContent = user.full_name;
    document.getElementById('userRole').textContent = `${getRoleEmoji(activeRole)} ${getRoleLabel(activeRole)}`;
    document.getElementById('userAvatar').textContent = user.full_name.charAt(0).toUpperCase();

    // Build role switcher for tester
    buildRoleSwitcher();

    // Apply role-based UI
    updateUIForRole();

    navigateTo('dashboard');
    updateOverdueBadge();
}

function buildRoleSwitcher() {
    // Remove existing
    const existing = document.getElementById('roleSwitcher');
    if (existing) existing.remove();

    if (!isTester()) return;

    const switcher = document.createElement('div');
    switcher.id = 'roleSwitcher';
    switcher.className = 'role-switcher';
    switcher.innerHTML = `
        <div class="role-switcher-title">🧪 Rol Değiştir</div>
        <select id="roleSwitcherSelect" class="form-control" onchange="switchRole(this.value)">
            <option value="tester" ${getActiveRole() === 'tester' ? 'selected' : ''}>🧪 Tester</option>
            <option value="admin" ${getActiveRole() === 'admin' ? 'selected' : ''}>👑 Yönetici (Admin)</option>
            <option value="librarian" ${getActiveRole() === 'librarian' ? 'selected' : ''}>📚 Kütüphaneci</option>
            <option value="member" ${getActiveRole() === 'member' ? 'selected' : ''}>👤 Üye (Member)</option>
        </select>
        <div class="role-switcher-hint">Aktif rol: <strong>${getRoleLabel(getActiveRole())}</strong></div>
    `;

    // Insert before sidebar footer
    const sidebarFooter = document.querySelector('.sidebar-footer');
    sidebarFooter.parentNode.insertBefore(switcher, sidebarFooter);
}

// Login form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Giriş yapılıyor...';

    try {
        const data = await api('auth.php?action=login', {
            method: 'POST',
            body: JSON.stringify({
                username: document.getElementById('loginUsername').value,
                password: document.getElementById('loginPassword').value
            })
        });
        showToast('Giriş başarılı! Hoş geldiniz, yolcu.', 'success');
        showApp(data.user);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '⚔️ Giriş Yap';
    }
});

// Register form
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Kayıt yapılıyor...';

    try {
        const data = await api('auth.php?action=register', {
            method: 'POST',
            body: JSON.stringify({
                username: document.getElementById('regUsername').value,
                password: document.getElementById('regPassword').value,
                full_name: document.getElementById('regFullName').value,
                email: document.getElementById('regEmail').value,
                phone: document.getElementById('regPhone').value
            })
        });
        showToast('Üyelik oluşturuldu! Şimdi giriş yapabilirsiniz.', 'success');
        showLoginView();
        // Pre-fill the username
        document.getElementById('loginUsername').value = document.getElementById('regUsername').value;
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '📝 Üye Ol';
    }
});

async function logout() {
    try {
        await api('auth.php?action=logout');
        showToast('Oturum kapatıldı', 'info');
    } catch (e) { }
    currentUser = null;
    showLoginView();
}

// Check auth on page load
document.addEventListener('DOMContentLoaded', checkAuth);
