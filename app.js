// ══════════════════════════════════════════════════════════════
//  Bingo da Família — Customer-facing JavaScript
// ══════════════════════════════════════════════════════════════

(() => {
  'use strict';

  const PRICE = 2.0;
  let quantity = 1;
  let currentStep = 1;

  // ─── Helpers ────────────────────────────────────────────────
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

  // ─── Quantity ───────────────────────────────────────────────
  function updateUI() {
    const total = quantity * PRICE;
    $('#qtyDisplay').textContent = quantity;
    $('#summaryQty').textContent = quantity;
    $('#summaryTotal').textContent = formatCurrency(total);

    // Animate the number change
    $('#qtyDisplay').classList.add('qty-bounce');
    setTimeout(() => $('#qtyDisplay').classList.remove('qty-bounce'), 200);
  }

  function setQuantity(val) {
    quantity = Math.max(1, Math.min(1000, val));
    updateUI();
  }

  // Quantity buttons
  $('#qtyMinus').addEventListener('click', () => setQuantity(quantity - 1));
  $('#qtyPlus').addEventListener('click', () => setQuantity(quantity + 1));

  // Quick select buttons
  $$('.quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => setQuantity(parseInt(btn.dataset.qty, 10)));
  });

  // ─── Multi-step navigation ─────────────────────────────────
  function goToStep(step) {
    // Hide current
    $$('.step-panel').forEach((p) => p.classList.remove('active'));
    $(`#step${step}`).classList.add('active');

    // Update progress dots
    $$('.progress-step').forEach((dot, i) => {
      dot.classList.toggle('active', i + 1 <= step);
      dot.classList.toggle('completed', i + 1 < step);
    });

    // Update progress lines
    if (step >= 2) $('#progressFill1').style.width = '100%';
    else $('#progressFill1').style.width = '0%';
    if (step >= 3) $('#progressFill2').style.width = '100%';
    else $('#progressFill2').style.width = '0%';

    currentStep = step;

    // Scroll into view
    $('#comprar').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Step 1 → Step 2
  $('#btnToStep2').addEventListener('click', () => {
    // Populate review
    const total = quantity * PRICE;
    $('#reviewQty').textContent = quantity;
    $('#reviewTotal').textContent = formatCurrency(total);
    goToStep(2);
  });

  // Step 2 → Step 1
  $('#btnBackToStep1').addEventListener('click', () => goToStep(1));

  // ─── WhatsApp mask ──────────────────────────────────────────
  $('#customerWhatsapp').addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    this.value = v;
  });

  // ─── Form submission ───────────────────────────────────────
  $('#customerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear errors
    $('#nameError').textContent = '';
    $('#whatsappError').textContent = '';

    const name = $('#customerName').value.trim();
    const whatsapp = $('#customerWhatsapp').value;
    const cleanPhone = whatsapp.replace(/\D/g, '');

    // Validate
    let valid = true;
    if (!name || name.length < 3) {
      $('#nameError').textContent = 'Informe seu nome completo (mínimo 3 caracteres).';
      valid = false;
    }
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      $('#whatsappError').textContent = 'Informe um número de WhatsApp válido.';
      valid = false;
    }
    if (!valid) return;

    // Disable button
    const btn = $('#btnConfirmOrder');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

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

      // Success — go to payment
      showToast('Pedido criado com sucesso!');
      const total = data.quantity * PRICE;
      $('#paymentValue').textContent = formatCurrency(total);

      // Load PIX config
      await loadPixConfig();

      goToStep(3);
    } catch (err) {
      showToast('Erro de conexão. Tente novamente.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'CONFIRMAR PEDIDO <i class="fas fa-check"></i>';
    }
  });

  // ─── PIX ────────────────────────────────────────────────────
  async function loadPixConfig() {
    try {
      const res = await fetch('/api/pix-config');
      const data = await res.json();

      if (data.pixKey) {
        $('#pixKeyBox').style.display = 'block';
        $('#pixNoKey').style.display = 'none';
        $('#pixKey').textContent = data.pixKey;
        $('#pixType').textContent = `Chave PIX (${data.pixKeyType})`;
        if (data.pixName) {
          $('#pixName').textContent = data.pixName;
          $('#pixName').style.display = 'block';
        }
      } else {
        $('#pixKeyBox').style.display = 'none';
        $('#pixNoKey').style.display = 'flex';
      }
    } catch {
      // silent
    }
  }

  // Copy PIX key
  $('#btnCopyPix').addEventListener('click', async () => {
    const key = $('#pixKey').textContent;
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      showToast('Chave PIX copiada!');
      $('#btnCopyPix').innerHTML = '<i class="fas fa-check"></i> Copiado';
      setTimeout(() => {
        $('#btnCopyPix').innerHTML = '<i class="fas fa-copy"></i> Copiar';
      }, 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = key;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Chave PIX copiada!');
    }
  });

  // New purchase button — reset everything
  $('#btnNewPurchase').addEventListener('click', (e) => {
    e.preventDefault();
    quantity = 1;
    updateUI();
    $('#customerForm').reset();
    goToStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ─── Header scroll effect ──────────────────────────────────
  window.addEventListener('scroll', () => {
    $('#header').classList.toggle('scrolled', window.scrollY > 50);
  });

  // ─── Mobile menu ────────────────────────────────────────────
  $('#mobileToggle').addEventListener('click', () => {
    $('#mobileNav').classList.toggle('open');
    const icon = $('#mobileToggle i');
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-times');
  });

  // Close mobile menu on link click
  $$('.mobile-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      $('#mobileNav').classList.remove('open');
      const icon = $('#mobileToggle i');
      icon.className = 'fas fa-bars';
    });
  });

  // ─── Smooth scroll for anchor links ─────────────────────────
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ─── Intersection Observer for fade-in ──────────────────────
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.1 }
  );

  $$('.step-card, .purchase-card').forEach((el) => {
    el.classList.add('fade-up');
    observer.observe(el);
  });

  // ─── Init ───────────────────────────────────────────────────
  updateUI();
})();
