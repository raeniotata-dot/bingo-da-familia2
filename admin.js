(() => {
  'use strict';

  let currentTab = 'pendente';
  let allOrders = [];

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatPhone(phone) {
    if (phone.length === 11) return `(${phone.slice(0,2)}) ${phone.slice(2,7)}-${phone.slice(7)}`;
    if (phone.length === 10) return `(${phone.slice(0,2)}) ${phone.slice(2,6)}-${phone.slice(6)}`;
    return phone;
  }

  function showToast(message, type = 'success') {
    const container = $('#toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ─── Verificação de Login ────────────────────────────────────
  async function checkAuth() {
    try {
      const res = await fetch('/api/admin/check');
      const data = await res.json();
      if (data.authenticated) {
        showDashboard();
      }
    } catch {}
  }

  function showDashboard() {
    $('#loginSection').style.display = 'none';
    $('#dashboardSection').style.display = 'block';
    loadStats();
    loadOrders();
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginError').textContent = '';

    const username = $('#loginUser').value.trim();
    const password = $('#loginPass').value;

    const btn = $('#loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok) {
        showDashboard();
      } else {
        $('#loginError').textContent = data.error || 'Usuário ou senha incorretos.';
      }
    } catch {
      $('#loginError').textContent = 'Erro ao conectar.';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar no Painel';
    }
  });

  $('#btnLogout').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    location.reload();
  });

  // ─── Carregar Estatísticas ──────────────────────────────────
  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();

      $('#statRevenue').textContent = formatCurrency(data.totalRevenue);
      $('#statCards').textContent = data.totalCards;
      $('#statPending').textContent = data.totalPending;

      $('#badgePendingCount').textContent = data.totalPending;
      $('#badgePaidCount').textContent = data.totalPaid;
    } catch {}
  }

  // ─── Carregar Pedidos ───────────────────────────────────────
  async function loadOrders() {
    try {
      const res = await fetch('/api/admin/orders');
      allOrders = await res.json();
      renderOrders();
    } catch {
      showToast('Erro ao carregar lista de pedidos.', 'error');
    }
  }

  // ─── Trocar entre Abas (Pendentes / Pagos) ───────────────────
  window.switchTab = (tab) => {
    currentTab = tab;
    if (tab === 'pendente') {
      $('#tabPendingBtn').className = 'tab-btn active-pending';
      $('#tabPaidBtn').className = 'tab-btn';
      $('#tableTitle').innerHTML = '<i class="fas fa-hourglass-half" style="color:#f59e0b;"></i> Pedidos Aguardando Pagamento';
    } else {
      $('#tabPendingBtn').className = 'tab-btn';
      $('#tabPaidBtn').className = 'tab-btn active-paid';
      $('#tableTitle').innerHTML = '<i class="fas fa-check-circle" style="color:#10b981;"></i> Pedidos Pagos e Confirmados 🎉';
    }
    renderOrders();
  };

  function renderOrders() {
    const filtered = allOrders.filter((o) => o.status === currentTab);
    const tbody = $('#ordersBody');

    if (filtered.length === 0) {
      const msg = currentTab === 'pendente' 
        ? 'Nenhum pedido pendente no momento! 🎉' 
        : 'Nenhum pedido pago ainda.';
      tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${msg}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((order) => {
        const isPaid = order.status === 'pago';
        const statusBadge = isPaid
          ? '<span class="status-badge status-paid"><i class="fas fa-check"></i> Pago</span>'
          : '<span class="status-badge status-pending"><i class="fas fa-clock"></i> Pendente</span>';

        const actionBtn = isPaid
          ? `<button class="btn-action btn-toggle" onclick="toggleStatus(${order.id}, 'pendente')" title="Voltar para Pendente" style="background:#fef3c7; color:#92400e;">
               <i class="fas fa-rotate-left"></i>
             </button>`
          : `<button class="btn-action btn-toggle" onclick="toggleStatus(${order.id}, 'pago')" title="Confirmar Pagamento PIX" style="background:#10b981; color:#ffffff; width:auto; padding:0 14px; border-radius:20px; font-weight:700;">
               <i class="fas fa-check"></i> Confirmar Pago
             </button>`;

        return `
          <tr>
            <td><strong>#${order.id}</strong></td>
            <td><strong>${escapeHtml(order.customerName)}</strong></td>
            <td>
              <a href="https://wa.me/55${order.whatsapp}" target="_blank" rel="noopener" class="whatsapp-link" title="Abrir conversa no WhatsApp">
                <i class="fab fa-whatsapp"></i> ${formatPhone(order.whatsapp)}
              </a>
            </td>
            <td class="center"><span style="font-size:1.1rem; font-weight:800; color:#165b33;">${order.quantity}</span></td>
            <td><strong>${formatCurrency(order.totalValue)}</strong></td>
            <td>${statusBadge}</td>
            <td class="date-cell">${formatDate(order.createdAt)}</td>
            <td class="center">
              <div class="action-btns" style="justify-content:center;">
                ${actionBtn}
                <button class="btn-action btn-delete" onclick="deleteOrder(${order.id})" title="Excluir Pedido">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.toggleStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(newStatus === 'pago' ? '🎉 Pedido confirmado com sucesso!' : 'Pedido voltou para pendente.');
        loadStats();
        loadOrders();
      }
    } catch {
      showToast('Erro de conexão.', 'error');
    }
  };

  window.deleteOrder = async (id) => {
    if (!confirm(`Tem certeza que deseja apagar o pedido #${id}?`)) return;
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Pedido #${id} excluído.`);
        loadStats();
        loadOrders();
      }
    } catch {
      showToast('Erro ao excluir pedido.', 'error');
    }
  };

  // ─── Exportar Backup em Excel / CSV ─────────────────────────
  function exportCSV() {
    if (!allOrders.length) {
      showToast('Nenhum pedido para exportar.', 'error');
      return;
    }
    let csv = '\uFEFFID,Nome,WhatsApp,Cartelas,Valor Total,Status,Data\n';
    allOrders.forEach((o) => {
      csv += `"${o.id}","${o.customerName}","${o.whatsapp}","${o.quantity}","${o.totalValue}","${o.status}","${formatDate(o.createdAt)}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bingo-da-familia-pedidos-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast('Planilha de pedidos baixada com sucesso! 📊');
  }

  $('#btnFastBackup').addEventListener('click', exportCSV);
  $('#btnExport').addEventListener('click', exportCSV);

  $('#btnRefresh').addEventListener('click', () => {
    loadStats();
    loadOrders();
    showToast('Lista atualizada!', 'info');
  });

  // ─── Modal Configurações ────────────────────────────────────
  $('#btnSettings').addEventListener('click', () => {
    $('#settingsModal').style.display = 'flex';
  });
  $('#closeSettings').addEventListener('click', () => {
    $('#settingsModal').style.display = 'none';
  });

  $('#btnSaveSettings').addEventListener('click', async () => {
    const pixKey = $('#settPixKey').value.trim();
    const pixName = $('#settPixName').value.trim();

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixKey, pixName }),
      });
      if (res.ok) {
        showToast('Chave PIX atualizada com sucesso!');
        $('#settingsModal').style.display = 'none';
      }
    } catch {
      showToast('Erro ao salvar.', 'error');
    }
  });

  $('#btnChangePass').addEventListener('click', async () => {
    const currentPassword = $('#settCurrentPass').value;
    const newPassword = $('#settNewPass').value;

    if (!currentPassword || !newPassword) {
      showToast('Preencha as senhas.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Senha alterada com sucesso!');
        $('#settingsModal').style.display = 'none';
      } else {
        showToast(data.error || 'Erro ao alterar senha.', 'error');
      }
    } catch {
      showToast('Erro de conexão.', 'error');
    }
  });

  checkAuth();
})();
