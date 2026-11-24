// ══════════════════════════════════════════════════════════════
//  Bingo da Família — Admin Panel JavaScript
// ══════════════════════════════════════════════════════════════

(() => {
  'use strict';

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

  // ─── Auth check on load ────────────────────────────────────
  async function checkAuth() {
    try {
      const res = await fetch('/api/admin/check');
      const data = await res.json();
      if (data.authenticated) {
        showDashboard();
      }
    } catch {
      // Not logged in
    }
  }

  function showDashboard() {
    $('#loginSection').style.display = 'none';
    $('#dashboardSection').style.display = 'block';
    loadStats();
    loadOrders();
  }

  // ─── Login ──────────────────────────────────────────────────
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
        $('#loginError').textContent = data.error || 'Erro ao fazer login.';
      }
    } catch {
      $('#loginError').textContent = 'Erro de conexão.';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
    }
  });

  // ─── Logout ─────────────────────────────────────────────────
  $('#btnLogout').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    location.reload();
  });

  // ─── Load stats ─────────────────────────────────────────────
  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();

      $('#statRevenue').textContent = formatCurrency(data.totalRevenue);
      $('#statCards').textContent = data.totalCards;
      $('#statOrders').textContent = data.totalOrders;
      $('#statPending').textContent = data.totalPending;
    } catch {
      showToast('Erro ao carregar estatísticas.', 'error');
    }
  }

  // ─── Load orders ────────────────────────────────────────────
  let allOrders = [];

  async function loadOrders() {
    try {
      const res = await fetch('/api/admin/orders');
      allOrders = await res.json();
      renderOrders();
    } catch {
      showToast('Erro ao carregar pedidos.', 'error');
    }
  }

  function renderOrders() {
    const filter = $('#filterStatus').value;
    const filtered = filter === 'all' ? allOrders : allOrders.filter((o) => o.status === filter);

    const tbody = $('#ordersBody');

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Nenhum pedido encontrado</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map((order) => {
        const statusClass = order.status === 'pago' ? 'status-paid' : 'status-pending';
        const statusLabel = order.status === 'pago' ? 'Pago' : 'Pendente';
        const toggleStatus = order.status === 'pago' ? 'pendente' : 'pago';
        const toggleIcon = order.status === 'pago' ? 'fa-rotate-left' : 'fa-check';
        const toggleLabel = order.status === 'pago' ? 'Marcar Pendente' : 'Marcar Pago';

        return `
          <tr>
            <td><strong>${order.id}</strong></td>
            <td>${escapeHtml(order.customerName)}</td>
            <td>
              <a href="https://wa.me/55${order.whatsapp}" target="_blank" rel="noopener" class="whatsapp-link">
                <i class="fab fa-whatsapp"></i> ${formatPhone(order.whatsapp)}
              </a>
            </td>
            <td class="center">${order.quantity}</td>
            <td>${formatCurrency(order.totalValue)}</td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td class="date-cell">${formatDate(order.createdAt)}</td>
            <td>
              <div class="action-btns">
                <button class="btn-action btn-toggle" onclick="toggleStatus(${order.id}, '${toggleStatus}')" title="${toggleLabel}">
                  <i class="fas ${toggleIcon}"></i>
                </button>
                <button class="btn-action btn-delete" onclick="deleteOrder(${order.id})" title="Excluir">
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

  // ─── Toggle order status ───────────────────────────────────
  window.toggleStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(`Pedido #${id} marcado como ${newStatus}.`);
        loadStats();
        loadOrders();
      } else {
        showToast('Erro ao atualizar pedido.', 'error');
      }
    } catch {
      showToast('Erro de conexão.', 'error');
    }
  };

  // ─── Delete order ───────────────────────────────────────────
  window.deleteOrder = async (id) => {
    if (!confirm(`Tem certeza que deseja excluir o pedido #${id}?`)) return;
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Pedido #${id} excluído.`);
        loadStats();
        loadOrders();
      } else {
        showToast('Erro ao excluir pedido.', 'error');
      }
    } catch {
      showToast('Erro de conexão.', 'error');
    }
  };

  // ─── Filter ─────────────────────────────────────────────────
  $('#filterStatus').addEventListener('change', renderOrders);
  $('#btnRefresh').addEventListener('click', () => {
    loadStats();
    loadOrders();
    showToast('Dados atualizados!', 'info');
  });

  // ─── Settings Modal ────────────────────────────────────────
  $('#btnSettings').addEventListener('click', async () => {
    $('#settingsModal').style.display = 'flex';
    // Load current settings
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      $('#settPixKey').value = data.pixKey || '';
      $('#settPixKeyType').value = data.pixKeyType || 'CPF';
      $('#settPixName').value = data.pixName || '';
    } catch {
      showToast('Erro ao carregar configurações.', 'error');
    }
  });

  $('#closeSettings').addEventListener('click', () => {
    $('#settingsModal').style.display = 'none';
  });

  // Close modal on backdrop click
  $('#settingsModal').addEventListener('click', (e) => {
    if (e.target === $('#settingsModal')) {
      $('#settingsModal').style.display = 'none';
    }
  });

  // Save PIX settings
  $('#btnSaveSettings').addEventListener('click', async () => {
    const btn = $('#btnSaveSettings');
    btn.disabled = true;

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pixKey: $('#settPixKey').value.trim(),
          pixKeyType: $('#settPixKeyType').value,
          pixName: $('#settPixName').value.trim(),
        }),
      });
      if (res.ok) {
        showToast('Configurações PIX salvas!');
      } else {
        showToast('Erro ao salvar configurações.', 'error');
      }
    } catch {
      showToast('Erro de conexão.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Change password
  $('#btnChangePass').addEventListener('click', async () => {
    const current = $('#settCurrentPass').value;
    const newPass = $('#settNewPass').value;

    if (!current || !newPass) {
      showToast('Preencha ambos os campos de senha.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast('Senha alterada com sucesso!');
        $('#settCurrentPass').value = '';
        $('#settNewPass').value = '';
      } else {
        showToast(data.error || 'Erro ao alterar senha.', 'error');
      }
    } catch {
      showToast('Erro de conexão.', 'error');
    }
  });

  // ─── Init ───────────────────────────────────────────────────
  checkAuth();
})();
