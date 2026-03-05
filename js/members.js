/* ─── Members Module ─── */

async function renderMembers() {
    const content = document.getElementById('pageContent');

    const canEdit = canManageMembers();
    content.innerHTML = `
    <div class="fade-in">
        <div class="page-header">
            <div class="page-header-actions">
                <div>
                    <h1>👥 Üye Yönetimi</h1>
                    <p>Kütüphane üyelerini yönetin</p>
                </div>
                ${canEdit ? `<button class="btn btn-primary" onclick="openMemberModal()">
                    ➕ Yeni Üye
                </button>` : ''}
            </div>
        </div>
        <div class="page-body">
            <div class="toolbar">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" class="form-control" id="memberSearch" placeholder="Ad, e-posta veya telefon ara..." oninput="loadMembers()">
                </div>
            </div>
            <div class="card">
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Ad Soyad</th>
                                <th>E-posta</th>
                                <th>Telefon</th>
                                <th>Adres</th>
                                <th>Kayıt Tarihi</th>
                                <th>Durum</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody id="membersTableBody">
                            <tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>`;

    loadMembers();
}

async function loadMembers() {
    const search = document.getElementById('memberSearch')?.value || '';
    const tbody = document.getElementById('membersTableBody');

    try {
        const members = await api(`members.php?action=list&search=${encodeURIComponent(search)}`);

        if (members.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><h4>Üye bulunamadı</h4></div></td></tr>`;
            return;
        }

        tbody.innerHTML = members.map(m => `
            <tr>
                <td><strong>${escapeHtml(m.full_name)}</strong></td>
                <td>${escapeHtml(m.email) || '—'}</td>
                <td>${escapeHtml(m.phone) || '—'}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(m.address) || '—'}</td>
                <td>${formatDate(m.membership_date)}</td>
                <td><span class="status-badge ${m.status}">${m.status === 'active' ? 'Aktif' : 'Pasif'}</span></td>
                ${canManageMembers() ? `<td>
                    <div class="action-btns">
                        <button class="btn btn-sm btn-secondary" onclick="openMemberModal(${m.id})" title="Düzenle">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMember(${m.id}, '${escapeHtml(m.full_name)}')" title="Sil">🗑️</button>
                    </div>
                </td>` : '<td>—</td>'}
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Hata: ${escapeHtml(err.message)}</p></div></td></tr>`;
    }
}

async function openMemberModal(id = null) {
    let member = { full_name: '', email: '', phone: '', address: '', status: 'active' };
    const isEdit = id !== null;

    if (isEdit) {
        try {
            member = await api(`members.php?action=get&id=${id}`);
        } catch (e) {
            showToast(e.message, 'error');
            return;
        }
    }

    openModal(`
        <div class="modal-header">
            <h3>${isEdit ? '✏️ Üye Düzenle' : '➕ Yeni Üye Ekle'}</h3>
            <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
            <form id="memberForm" onsubmit="saveMember(event, ${id})">
                <div class="form-group">
                    <label>Ad Soyad *</label>
                    <input type="text" class="form-control" name="full_name" value="${escapeHtml(member.full_name)}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>E-posta</label>
                        <input type="email" class="form-control" name="email" value="${escapeHtml(member.email || '')}">
                    </div>
                    <div class="form-group">
                        <label>Telefon</label>
                        <input type="tel" class="form-control" name="phone" value="${escapeHtml(member.phone || '')}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Adres</label>
                    <textarea class="form-control" name="address">${escapeHtml(member.address || '')}</textarea>
                </div>
                ${isEdit ? `
                <div class="form-group">
                    <label>Durum</label>
                    <select class="form-control" name="status">
                        <option value="active" ${member.status === 'active' ? 'selected' : ''}>Aktif</option>
                        <option value="passive" ${member.status === 'passive' ? 'selected' : ''}>Pasif</option>
                    </select>
                </div>
                ` : ''}
                <div class="modal-footer" style="padding:16px 0 0">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">İptal</button>
                    <button type="submit" class="btn btn-primary">${isEdit ? '💾 Güncelle' : '➕ Ekle'}</button>
                </div>
            </form>
        </div>
    `);
}

async function saveMember(e, id) {
    e.preventDefault();
    const form = e.target;
    const data = {
        full_name: form.full_name.value,
        email: form.email.value,
        phone: form.phone.value,
        address: form.address.value,
    };

    if (id) {
        data.id = id;
        data.status = form.status.value;
    }

    try {
        if (id) {
            await api('members.php?action=update', { method: 'POST', body: JSON.stringify(data) });
            showToast('Üye güncellendi', 'success');
        } else {
            await api('members.php?action=add', { method: 'POST', body: JSON.stringify(data) });
            showToast('Üye eklendi', 'success');
        }
        closeModal();
        loadMembers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteMember(id, name) {
    if (!confirm(`"${name}" üyesini silmek istediğinize emin misiniz?`)) return;

    try {
        await api('members.php?action=delete', { method: 'POST', body: JSON.stringify({ id }) });
        showToast('Üye silindi', 'success');
        loadMembers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
