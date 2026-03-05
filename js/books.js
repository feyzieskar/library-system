/* ─── Books Module ─── */

async function renderBooks() {
    const content = document.getElementById('pageContent');

    const canEdit = canManageBooks();
    content.innerHTML = `
    <div class="fade-in">
        <div class="page-header">
            <div class="page-header-actions">
                <div>
                    <h1>📖 Kitap Yönetimi</h1>
                    <p>Kütüphanedeki kitapları ${canEdit ? 'yönetin' : 'görüntüleyin'}</p>
                </div>
                ${canEdit ? `<button class="btn btn-primary" onclick="openBookModal()">
                    ➕ Yeni Kitap
                </button>` : ''}
            </div>
        </div>
        <div class="page-body">
            <div class="toolbar">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" class="form-control" id="bookSearch" placeholder="Kitap, yazar veya ISBN ara..." oninput="loadBooks()">
                </div>
                <select class="form-control" id="bookCategoryFilter" style="max-width:220px" onchange="loadBooks()">
                    <option value="">Tüm Kategoriler</option>
                </select>
            </div>
            <div class="card">
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Kitap Adı</th>
                                <th>Yazar</th>
                                <th>ISBN</th>
                                <th>Kategori</th>
                                <th>Yıl</th>
                                <th>Stok</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody id="booksTableBody">
                            <tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>`;

    loadBookCategories();
    loadBooks();
}

async function loadBookCategories() {
    try {
        const cats = await api('books.php?action=categories');
        const sel = document.getElementById('bookCategoryFilter');
        if (sel) {
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                sel.appendChild(opt);
            });
        }
    } catch (e) { }
}

async function loadBooks() {
    const search = document.getElementById('bookSearch')?.value || '';
    const category = document.getElementById('bookCategoryFilter')?.value || '';
    const tbody = document.getElementById('booksTableBody');

    try {
        let url = `books.php?action=list&search=${encodeURIComponent(search)}`;
        if (category) url += `&category=${encodeURIComponent(category)}`;
        const books = await api(url);

        if (books.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📚</div><h4>Kitap bulunamadı</h4></div></td></tr>`;
            return;
        }

        tbody.innerHTML = books.map(b => {
            const availClass = b.available <= 0 ? 'out-of-stock' : b.available <= 2 ? 'low-stock' : 'in-stock';
            return `
            <tr>
                <td><strong>${escapeHtml(b.title)}</strong></td>
                <td>${escapeHtml(b.author)}</td>
                <td style="font-size:0.82rem;color:var(--text-muted)">${escapeHtml(b.isbn) || '—'}</td>
                <td><span class="status-badge borrowed">${escapeHtml(b.category) || '—'}</span></td>
                <td>${b.year || '—'}</td>
                <td>
                    <div class="avail-indicator">
                        <span class="avail-dot ${availClass}"></span>
                        ${b.available}/${b.quantity}
                    </div>
                </td>
                ${canManageBooks() ? `<td>
                    <div class="action-btns">
                        <button class="btn btn-sm btn-secondary" onclick="openBookModal(${b.id})" title="Düzenle">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBook(${b.id}, '${escapeHtml(b.title)}')" title="Sil">🗑️</button>
                    </div>
                </td>` : '<td>—</td>'}
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Hata: ${escapeHtml(err.message)}</p></div></td></tr>`;
    }
}

async function openBookModal(id = null) {
    let book = { title: '', author: '', isbn: '', publisher: '', year: '', category: '', quantity: 1 };
    const isEdit = id !== null;

    if (isEdit) {
        try {
            book = await api(`books.php?action=get&id=${id}`);
        } catch (e) {
            showToast(e.message, 'error');
            return;
        }
    }

    openModal(`
        <div class="modal-header">
            <h3>${isEdit ? '✏️ Kitap Düzenle' : '➕ Yeni Kitap Ekle'}</h3>
            <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
            <form id="bookForm" onsubmit="saveBook(event, ${id})">
                <div class="form-group">
                    <label>Kitap Adı *</label>
                    <input type="text" class="form-control" name="title" value="${escapeHtml(book.title)}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Yazar *</label>
                        <input type="text" class="form-control" name="author" value="${escapeHtml(book.author)}" required>
                    </div>
                    <div class="form-group">
                        <label>ISBN</label>
                        <input type="text" class="form-control" name="isbn" value="${escapeHtml(book.isbn || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Yayınevi</label>
                        <input type="text" class="form-control" name="publisher" value="${escapeHtml(book.publisher || '')}">
                    </div>
                    <div class="form-group">
                        <label>Yayın Yılı</label>
                        <input type="number" class="form-control" name="year" value="${book.year || ''}" min="1000" max="2099">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Kategori</label>
                        <input type="text" class="form-control" name="category" value="${escapeHtml(book.category || '')}">
                    </div>
                    <div class="form-group">
                        <label>Adet</label>
                        <input type="number" class="form-control" name="quantity" value="${book.quantity}" min="1" required>
                    </div>
                </div>
                <div class="modal-footer" style="padding:16px 0 0">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
                    <button type="submit" class="btn btn-primary">${isEdit ? '💾 Güncelle' : '➕ Ekle'}</button>
                </div>
            </form>
        </div>
    `);
}

async function saveBook(e, id) {
    e.preventDefault();
    const form = e.target;
    const data = {
        title: form.title.value,
        author: form.author.value,
        isbn: form.isbn.value,
        publisher: form.publisher.value,
        year: form.year.value ? parseInt(form.year.value) : null,
        category: form.category.value,
        quantity: parseInt(form.quantity.value)
    };

    try {
        if (id) {
            data.id = id;
            await api('books.php?action=update', { method: 'POST', body: JSON.stringify(data) });
            showToast('Kitap güncellendi', 'success');
        } else {
            await api('books.php?action=add', { method: 'POST', body: JSON.stringify(data) });
            showToast('Kitap eklendi', 'success');
        }
        closeModal();
        loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteBook(id, title) {
    if (!confirm(`"${title}" kitabını silmek istediğinize emin misiniz?`)) return;

    try {
        await api('books.php?action=delete', { method: 'POST', body: JSON.stringify({ id }) });
        showToast('Kitap silindi', 'success');
        loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
