/* ─── Borrows Module ─── */

async function renderBorrows() {
    const content = document.getElementById('pageContent');

    const canEdit = canManageBorrows();
    content.innerHTML = `
    <div class="fade-in">
        <div class="page-header">
            <div class="page-header-actions">
                <div>
                    <h1>🔄 Ödünç İşlemleri</h1>
                    <p>Kitap ödünç verme ve iade işlemleri</p>
                </div>
                ${canEdit ? `<button class="btn btn-success" onclick="openBorrowModal()">
                    📖 Kitap Ödünç Ver
                </button>` : ''}
            </div>
        </div>
        <div class="page-body">
            <div class="toolbar">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" class="form-control" id="borrowSearch" placeholder="Kitap veya üye ara..." oninput="loadBorrows()">
                </div>
                <select class="form-control" id="borrowStatusFilter" style="max-width:200px" onchange="loadBorrows()">
                    <option value="">Tüm Durumlar</option>
                    <option value="borrowed">Ödünç</option>
                    <option value="overdue">Gecikmiş</option>
                    <option value="returned">İade Edilmiş</option>
                </select>
            </div>
            <div class="card">
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Kitap</th>
                                <th>Üye</th>
                                <th>Ödünç Tarihi</th>
                                <th>Son Tarih</th>
                                <th>İade Tarihi</th>
                                <th>Durum</th>
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody id="borrowsTableBody">
                            <tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>`;

    loadBorrows();
}

async function loadBorrows() {
    const search = document.getElementById('borrowSearch')?.value || '';
    const status = document.getElementById('borrowStatusFilter')?.value || '';
    const tbody = document.getElementById('borrowsTableBody');

    try {
        let url = `borrows.php?action=list&search=${encodeURIComponent(search)}`;
        if (status) url += `&status=${encodeURIComponent(status)}`;
        const borrows = await api(url);

        if (borrows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🔄</div><h4>Kayıt bulunamadı</h4></div></td></tr>`;
            return;
        }

        tbody.innerHTML = borrows.map(b => {
            const isActive = b.status === 'borrowed' || b.status === 'overdue';
            return `
            <tr>
                <td>
                    <strong>${escapeHtml(b.book_title)}</strong>
                    <div style="font-size:0.78rem;color:var(--text-muted)">${escapeHtml(b.book_author)}</div>
                </td>
                <td>${escapeHtml(b.member_name)}</td>
                <td>${formatDate(b.borrow_date)}</td>
                <td>${formatDate(b.due_date)}</td>
                <td>${b.return_date ? formatDate(b.return_date) : '—'}</td>
                <td><span class="status-badge ${b.status}">${borrowStatusLabel(b.status)}</span></td>
                <td>
                    ${isActive && canManageBorrows() ? `<button class="btn btn-sm btn-success" onclick="returnBook(${b.id})">📥 İade</button>` : '—'}
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Hata: ${escapeHtml(err.message)}</p></div></td></tr>`;
    }
}

function borrowStatusLabel(status) {
    const map = {
        borrowed: '📖 Ödünç',
        returned: '✅ İade Edildi',
        overdue: '⏰ Gecikmiş'
    };
    return map[status] || status;
}

async function openBorrowModal() {
    // Load books and members for selection
    let books, members;
    try {
        [books, members] = await Promise.all([
            api('books.php?action=list'),
            api('members.php?action=list')
        ]);
    } catch (e) {
        showToast('Veriler yüklenemedi', 'error');
        return;
    }

    const availableBooks = books.filter(b => b.available > 0);
    const activeMembers = members.filter(m => m.status === 'active');

    // Default due date: 14 days from now
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    openModal(`
        <div class="modal-header">
            <h3>📖 Kitap Ödünç Ver</h3>
            <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
            <form id="borrowForm" onsubmit="saveBorrow(event)">
                <div class="form-group">
                    <label>Kitap *</label>
                    <select class="form-control" name="book_id" required>
                        <option value="">Kitap seçin...</option>
                        ${availableBooks.map(b => `
                            <option value="${b.id}">${escapeHtml(b.title)} — ${escapeHtml(b.author)} (${b.available} mevcut)</option>
                        `).join('')}
                    </select>
                    ${availableBooks.length === 0 ? '<p style="color:var(--warning);font-size:0.82rem;margin-top:4px">⚠️ Stokta mevcut kitap yok</p>' : ''}
                </div>
                <div class="form-group">
                    <label>Üye *</label>
                    <select class="form-control" name="member_id" required>
                        <option value="">Üye seçin...</option>
                        ${activeMembers.map(m => `
                            <option value="${m.id}">${escapeHtml(m.full_name)} — ${escapeHtml(m.email || m.phone || '')}</option>
                        `).join('')}
                    </select>
                    ${activeMembers.length === 0 ? '<p style="color:var(--warning);font-size:0.82rem;margin-top:4px">⚠️ Aktif üye yok</p>' : ''}
                </div>
                <div class="form-group">
                    <label>Son İade Tarihi *</label>
                    <input type="date" class="form-control" name="due_date" value="${dueDateStr}" required>
                </div>
                <div class="modal-footer" style="padding:16px 0 0">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
                    <button type="submit" class="btn btn-success" ${availableBooks.length === 0 || activeMembers.length === 0 ? 'disabled' : ''}>
                        📖 Ödünç Ver
                    </button>
                </div>
            </form>
        </div>
    `);
}

async function saveBorrow(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        book_id: parseInt(form.book_id.value),
        member_id: parseInt(form.member_id.value),
        due_date: form.due_date.value
    };

    try {
        await api('borrows.php?action=borrow', { method: 'POST', body: JSON.stringify(data) });
        showToast('Kitap ödünç verildi', 'success');
        closeModal();
        loadBorrows();
        updateOverdueBadge();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function returnBook(id) {
    if (!confirm('Bu kitabı iade almak istediğinize emin misiniz?')) return;

    try {
        await api('borrows.php?action=return', { method: 'POST', body: JSON.stringify({ id }) });
        showToast('Kitap iade alındı', 'success');
        loadBorrows();
        updateOverdueBadge();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
