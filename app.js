(() => {
  'use strict';

  const PRICE = 2.0;
  let quantity = 1;
  let currentOrderId = null;
  let pollInterval = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  function updateUI() {
    const total = quantity * PRICE;
    $('#qtyDisplay').textContent = quantity;
    $('#summaryQty').textContent = quantity;
    $('#summaryTotal').textContent = formatCurrency(total);
  }

  function setQuantity(val) {
    quantity = Math.max(1, Math.min(1000, val));
    updateUI();
  }

  $('#qtyMinus').addEventListener('click', () => setQuantity(quantity - 1));
  $('#qtyPlus').addEventListener('click', () => setQuantity(quantity + 1));

  $$('.quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => setQuantity(parseInt(btn.dataset.qty, 10)));
  });

  function goToStep(step) {
    $$('.step-panel').forEach((p) => p.classList.remove('active'));
    $(`#step${step}`).classList.add('active');

    $$('.progress-step').forEach((dot, i) => {
      dot.classList.toggle('active', i + 1 <= step);
      dot.classList.toggle('completed', i + 1 < step);
    });

    if (step >= 2) $('#progressFill1').style.width = '100%';
    else $('#progressFill1').style.width = '0%';
    if (step >= 3) $('#progressFill2').style.width = '100%';
    else $('#progressFill2').style.width = '0%';

    $('#comprar').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#btnToStep2').addEventListener('click', () => {
    const total = quantity * PRICE;
    $('#reviewQty').textContent = quantity;
    $('#reviewTotal').textContent = formatCurrency(total);
    goToStep(2);
  });

  $('#btnBackToStep1').addEventListener('click', () => goToStep(1));

  $('#customerWhatsapp').addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    this.value = v;
  });

  $('#customerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    $('#nameError').textContent = '';
    $('#whatsappError').textContent = '';

    const name = $('#customerName').value.trim();
    const whatsapp = $('#customerWhatsapp').value;
    const cleanPhone = whatsapp.replace(/\D/g, '');

    let valid = true;
    if (!name || name.length < 3) {
      $('#nameError').textContent = 'Informe seu nome completo (mínimo 3 caracteres).';
      valid = false;
    }
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      $('#whatsappError').textContent = 'Informe um WhatsApp válido.';
      valid = false;
    }
    if (!valid) return;

    const btn = $('#btnConfirmOrder');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando Pedido...';

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          whatsapp: cleanPhone,
          quantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Erro ao criar pedido.', 'error');
        return;
      }

      currentOrderId = data.id;
      $('#paymentValue').textContent = formatCurrency(data.totalValue);
      $('#pixKey').textContent = '66992730310';

      goToStep(3);

      // Inicia verificação em tempo real (a cada 2.5s)
      startStatusPolling(data.id, data.quantity, data.customerName, data.totalValue);

    } catch (err) {
      showToast('Erro de conexão.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'CONFIRMAR PEDIDO <i class="fas fa-check"></i>';
    }
  });

  // Checa automaticamente se o Admin confirmou
  function startStatusPolling(orderId, qty, name, totalVal) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        const data = await res.json();
        
        if (data.status === 'pago') {
          clearInterval(pollInterval);
          
          // TELA LINDA DE CONFIRMAÇÃO DE COMPRA COM TOTAL DE CARTELAS
          const step3 = $('#step3');
          if (step3) {
            step3.innerHTML = `
              <div style="background:#ffffff; border-radius:18px; padding:35px 25px; text-align:center; box-shadow:0 12px 40px rgba(0,0,0,0.15); border:3px solid #10b981; animation:fadeIn 0.5s ease;">
                <div style="width:85px; height:85px; background:#d1fae5; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; border:3px solid #10b981;">
                  <i class="fas fa-check" style="font-size:3rem; color:#059669;"></i>
                </div>

                <span style="background:#ecfdf5; color:#065f46; padding:6px 16px; border-radius:20px; font-weight:800; font-size:0.9rem; text-transform:uppercase; letter-spacing:0.5px; border:1px solid #a7f3d0;">
                  Pagamento Confirmado! 🎉
                </span>

                <h3 style="font-size:1.85rem; font-weight:900; margin:16px 0 8px; color:#111827;">
                  Parabéns, ${escapeHtml(name.split(' ')[0])}!
                </h3>
                <p style="font-size:1.05rem; color:#4b5563; margin-bottom:24px;">
                  Seu pagamento foi aprovado com sucesso!
                </p>

                <!-- DESTAQUE TOTAL DE CARTELAS -->
                <div style="background:linear-gradient(135deg, #065f46, #047857); border-radius:16px; padding:24px; color:#ffffff; margin-bottom:24px; box-shadow:0 8px 25px rgba(6,95,70,0.3); border:2px solid #d4af37;">
                  <span style="font-size:0.95rem; opacity:0.9; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:6px;">
                    Total de Cartelas que Você Tem:
                  </span>
                  <div style="font-size:3.5rem; font-weight:900; color:#ffeb3b; text-shadow:0 2px 10px rgba(0,0,0,0.3); line-height:1;">
                    ${qty} <span style="font-size:1.5rem; color:#ffffff; font-weight:700;">cartela(s)</span>
                  </div>
                  <div style="font-size:0.95rem; margin-top:10px; opacity:0.95;">
                    <i class="fas fa-ticket-alt"></i> Pedido #${orderId} • Valor: ${formatCurrency(totalVal)}
                  </div>
                </div>

                <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:24px; text-align:left;">
                  <p style="margin:0; font-size:0.95rem; color:#374151; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-info-circle" style="color:#10b981; font-size:1.2rem;"></i>
                    Suas cartelas foram registradas no sistema oficial do Bingo da Família. Boa sorte! 🎅✨
                  </p>
                </div>

                <a href="#inicio" onclick="location.reload()" class="btn btn-primary btn-block" style="padding:16px; font-size:1.1rem; border-radius:50px;">
                  <i class="fas fa-rotate-left"></i> Comprar Mais Cartelas
                </a>
              </div>
            `;
          }

          showToast('🎉 Pagamento aprovado! Cartelas garantidas!', 'success');
        }
      } catch (e) {}
    }, 2000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Copiar chave PIX
  $('#btnCopyPix').addEventListener('click', async () => {
    const key = $('#pixKey').textContent.trim();
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      showToast('Chave PIX copiada com sucesso!');
      $('#btnCopyPix').innerHTML = '<i class="fas fa-check"></i> Chave Copiada!';
      setTimeout(() => {
        $('#btnCopyPix').innerHTML = '<i class="fas fa-copy"></i> Copiar Chave PIX';
      }, 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = key;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Chave PIX copiada!');
    }
  });

  $('#btnNewPurchase').addEventListener('click', (e) => {
    e.preventDefault();
    if (pollInterval) clearInterval(pollInterval);
    quantity = 1;
    updateUI();
    $('#customerForm').reset();
    location.reload();
  });

  updateUI();
})();
