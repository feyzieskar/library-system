/* ─── Dashboard Module ─── */

async function renderDashboard() {
    const content = document.getElementById('pageContent');

    try {
        const stats = await api('borrows.php?action=stats');

        content.innerHTML = `
        <div class="fade-in">
            <div class="page-header">
                <h1>📊 Dashboard</h1>
                <p>Kütüphane genel durumu ve istatistikler</p>
            </div>
            <div class="page-body">
                <!-- Stats -->
                <div class="stats-grid">
                    <div class="stat-card primary">
                        <div class="stat-icon">📖</div>
                        <div>
                            <div class="stat-value">${stats.total_books}</div>
                            <div class="stat-label">Toplam Kitap</div>
                        </div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-icon">👥</div>
                        <div>
                            <div class="stat-value">${stats.total_members}</div>
                            <div class="stat-label">Aktif Üye</div>
                        </div>
                    </div>
                    <div class="stat-card info">
                        <div class="stat-icon">🔄</div>
                        <div>
                            <div class="stat-value">${stats.active_borrows}</div>
                            <div class="stat-label">Aktif Ödünç</div>
                        </div>
                    </div>
                    <div class="stat-card danger">
                        <div class="stat-icon">⏰</div>
                        <div>
                            <div class="stat-value">${stats.overdue}</div>
                            <div class="stat-label">Geciken</div>
                        </div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-icon">📦</div>
                        <div>
                            <div class="stat-value">${stats.available_copies}</div>
                            <div class="stat-label">Mevcut Kopya</div>
                        </div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-icon">✅</div>
                        <div>
                            <div class="stat-value">${stats.returned}</div>
                            <div class="stat-label">İade Edilen</div>
                        </div>
                    </div>
                </div>

                <!-- Two Column -->
                <div class="two-col">
                    <!-- Recent Borrows -->
                    <div class="card">
                        <div class="card-header">
                            <h3>🕐 Son İşlemler</h3>
                        </div>
                        <div class="card-body">
                            ${stats.recent_borrows.length > 0 ? `
                            <ul class="recent-list">
                                ${stats.recent_borrows.map(b => `
                                <li>
                                    <div class="recent-icon">📖</div>
                                    <div class="recent-info">
                                        <div class="recent-title">${escapeHtml(b.book_title)}</div>
                                        <div class="recent-sub">${escapeHtml(b.member_name)}</div>
                                    </div>
                                    <div>
                                        <span class="status-badge ${b.status}">${statusLabel(b.status)}</span>
                                        <div class="recent-date">${formatDate(b.borrow_date)}</div>
                                    </div>
                                </li>
                                `).join('')}
                            </ul>
                            ` : '<div class="empty-state"><p>Henüz işlem yok</p></div>'}
                        </div>
                    </div>

                    <!-- Popular Books -->
                    <div class="card">
                        <div class="card-header">
                            <h3>⭐ Popüler Kitaplar</h3>
                        </div>
                        <div class="card-body">
                            ${stats.popular_books.length > 0 ? `
                            <ul class="recent-list">
                                ${stats.popular_books.map((b, i) => `
                                <li>
                                    <div class="recent-icon" style="background: ${['rgba(99,102,241,0.1)', 'rgba(245,158,11,0.1)', 'rgba(16,185,129,0.1)', 'rgba(239,68,68,0.1)', 'rgba(59,130,246,0.1)'][i] || 'rgba(99,102,241,0.1)'}">
                                        ${['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i] || '📖'}
                                    </div>
                                    <div class="recent-info">
                                        <div class="recent-title">${escapeHtml(b.title)}</div>
                                        <div class="recent-sub">${escapeHtml(b.author)}</div>
                                    </div>
                                    <div class="recent-date">${b.borrow_count} kez</div>
                                </li>
                                `).join('')}
                            </ul>
                            ` : '<div class="empty-state"><p>Henüz veri yok</p></div>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    } catch (err) {
        content.innerHTML = `
        <div class="page-header"><h1>📊 Dashboard</h1></div>
        <div class="page-body">
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h4>Veriler yüklenemedi</h4>
                <p>${escapeHtml(err.message)}</p>
            </div>
        </div>`;
    }
}

function statusLabel(status) {
    const map = {
        borrowed: 'Ödünç',
        returned: 'İade',
        overdue: 'Gecikmiş'
    };
    return map[status] || status;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
