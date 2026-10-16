// Default Backend API endpoint for OneBilling Cloud
const DEFAULT_API_URL = 'https://api-main.onebilling.cloud';

// Get URL query params
const urlParams = new URLSearchParams(window.location.search);
const tenantIdParam = urlParams.get('tenantId') || urlParams.get('tenant') || null;
const apiBase = urlParams.get('api') || DEFAULT_API_URL;

let currentSettings = null;
let currentCompany = null;

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    const yearEl = document.getElementById('current-year');
    if (yearEl) yearEl.innerText = new Date().getFullYear();

    loadIsolirInfo();
    setupBillChecker();
});

// 1. Load Data from Backend
async function loadIsolirInfo(customTenantId) {
    try {
        const tId = customTenantId || tenantIdParam;
        const queryStr = tId ? `?tenantId=${tId}&_t=${Date.now()}` : `?_t=${Date.now()}`;
        const res = await fetch(`${apiBase}/api/portal/isolir-info${queryStr}`);
        const data = await res.json();

        if (data.success) {
            currentCompany = data.company || {};
            currentSettings = data.settings || {};
            renderData(Boolean(tId));
        }
    } catch (err) {
        console.warn('[IsolirWeb] Gagal memuat data dari API, menggunakan tampilan standar:', err.message);
    }
}

// 2. Render Data to UI
function renderData(isVerified = false) {
    // Branding
    if (currentCompany) {
        if (currentCompany.nama) {
            document.getElementById('isp-name').innerText = currentCompany.nama;
            document.getElementById('footer-isp').innerText = currentCompany.nama;
            document.title = `Pemberitahuan Isolir - ${currentCompany.nama}`;
        }
        const logoImg = document.getElementById('isp-logo');
        if (currentCompany.logo) {
            const logoUrl = currentCompany.logo.startsWith('http') 
                ? currentCompany.logo 
                : `${apiBase}${currentCompany.logo}`;
            logoImg.src = logoUrl;
            logoImg.style.display = 'block';
        } else {
            logoImg.style.display = 'none';
        }
    }

    // Texts & Theme
    if (currentSettings) {
        if (currentSettings.ISOLIR_TITLE) {
            document.getElementById('isolir-title').innerText = currentSettings.ISOLIR_TITLE;
        }
        if (currentSettings.ISOLIR_SUBTITLE) {
            document.getElementById('isolir-subtitle').innerText = currentSettings.ISOLIR_SUBTITLE;
        }
        if (currentSettings.ISOLIR_NOTE) {
            document.getElementById('isolir-note').innerText = currentSettings.ISOLIR_NOTE;
        }

        // Multiple Banks Rendering
        let banksList = currentSettings.ISOLIR_BANKS;
        if (!Array.isArray(banksList) || banksList.length === 0) {
            if (currentSettings.ISOLIR_BANK_NOREK) {
                banksList = [{
                    bank: currentSettings.ISOLIR_BANK_NAME || 'BANK BCA',
                    norek: currentSettings.ISOLIR_BANK_NOREK,
                    holder: currentSettings.ISOLIR_BANK_HOLDER || currentCompany?.nama || ''
                }];
            } else {
                banksList = [];
            }
        }

        const banksContainer = document.getElementById('banks-container');
        if (banksContainer) {
            banksContainer.innerHTML = '';
            banksList.forEach(b => {
                const box = document.createElement('div');
                box.className = 'bank-box';
                box.innerHTML = `
                    <div class="bank-top">
                        <span class="bank-badge">${escapeHtml(b.bank || 'BANK')}</span>
                        <button type="button" class="btn-copy" onclick="copyRekening('${escapeHtml(b.norek)}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Salin No. Rek</span>
                        </button>
                    </div>
                    <div class="bank-number">${escapeHtml(b.norek || '-')}</div>
                    <div class="bank-holder">a.n <strong>${escapeHtml(b.holder || '-')}</strong></div>
                `;
                banksContainer.appendChild(box);
            });
        }

        // WhatsApp Button
        const waPhone = currentSettings.ISOLIR_CS_PHONE || '';
        if (waPhone) {
            let cleanPhone = waPhone.replace(/[^0-9]/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
            
            const message = encodeURIComponent(
                `Halo Admin ${currentCompany?.nama || 'Internet'},\n\nSaya ingin konfirmasi pembayaran tagihan internet yang sedang terisolir. Mohon bantuannya untuk diproses dan diaktifkan kembali. Terima kasih.`
            );
            document.getElementById('btn-wa').href = `https://wa.me/${cleanPhone}?text=${message}`;
        } else {
            document.getElementById('btn-wa').href = '#';
        }

        // Theme Accent Color
        if (currentSettings.ISOLIR_THEME_COLOR) {
            document.documentElement.style.setProperty('--primary-alert', currentSettings.ISOLIR_THEME_COLOR);
            document.documentElement.style.setProperty('--border-accent', `${currentSettings.ISOLIR_THEME_COLOR}4D`);
        }

        // Reveal verified section jika memang ada banks & sudah diverifikasi (atau URL tenant eksplisit)
        const verifiedSection = document.getElementById('verified-section');
        if (verifiedSection) {
            if (isVerified && banksList.length > 0) {
                verifiedSection.classList.remove('hidden');
            } else if (!isVerified) {
                verifiedSection.classList.add('hidden');
            }
        }
    }
}

// 3. Copy Bank Account Number
function copyRekening(customNorek) {
    let norek = customNorek;
    if (!norek) {
        const firstEl = document.querySelector('.bank-number');
        norek = firstEl ? firstEl.innerText.trim() : '';
    }
    if (!norek) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(norek).then(showToast).catch(() => fallbackCopy(norek));
    } else {
        fallbackCopy(norek);
    }
}

function fallbackCopy(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast();
}

function showToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2500);
}

// 4. Interactive Bill Checker (Multi-Tenant Identifier)
function setupBillChecker() {
    const form = document.getElementById('check-bill-form');
    const input = document.getElementById('bill-query');
    const btn = document.getElementById('btn-check-bill');
    const resultBox = document.getElementById('bill-result');
    const errBox = document.getElementById('check-error');
    const errText = document.getElementById('check-error-text');
    const verifiedSection = document.getElementById('verified-section');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (!query) return;

        btn.disabled = true;
        btn.querySelector('span').innerText = 'Memeriksa...';
        if (errBox) errBox.classList.add('hidden');

        try {
            const res = await fetch(`${apiBase}/api/portal/isolir-check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    tenantId: tenantIdParam ? parseInt(tenantIdParam) : undefined
                })
            });

            const data = await res.json();

            if (data.success && data.customer) {
                const c = data.customer;

                // 1. Terapkan company & settings khusus milik ISP pelanggan ini
                currentCompany = data.company || {};
                currentSettings = data.settings || {};
                renderData(true);

                // 2. Isi data rincian tagihan pelanggan
                document.getElementById('res-nama').innerText = c.nama;
                document.getElementById('res-paket').innerText = c.paket;
                document.getElementById('res-total').innerText = `Rp ${c.totalTagihan.toLocaleString('id-ID')}`;

                const listEl = document.getElementById('res-invoices-list');
                listEl.innerHTML = '';

                if (c.invoices && c.invoices.length > 0) {
                    c.invoices.forEach(inv => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span>Bulan ${escapeHtml(inv.bulan)}</span> <strong>Rp ${inv.jumlah.toLocaleString('id-ID')}</strong>`;
                        listEl.appendChild(li);
                    });
                } else {
                    const li = document.createElement('li');
                    li.style.color = '#10b981';
                    li.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                    li.style.background = 'rgba(16, 185, 129, 0.08)';
                    li.innerText = 'Tidak ada tagihan menunggak (Lunas).';
                    listEl.appendChild(li);
                }

                resultBox.classList.remove('hidden');
                if (verifiedSection) verifiedSection.classList.remove('hidden');

                // 3. Custom link WhatsApp khusus pelanggan & ISP terkait
                const waPhone = currentSettings?.ISOLIR_CS_PHONE || '';
                if (waPhone) {
                    let cleanPhone = waPhone.replace(/[^0-9]/g, '');
                    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
                    const specificMsg = encodeURIComponent(
                        `Halo Admin ${currentCompany?.nama || 'Internet'},\n\nSaya atas nama *${c.nama}* (User: ${c.mikrotikUser || '-'}), ingin konfirmasi pembayaran tagihan internet terisolir sebesar *Rp ${c.totalTagihan.toLocaleString('id-ID')}*.\n\nBerikut bukti transfernya:`
                    );
                    document.getElementById('btn-wa').href = `https://wa.me/${cleanPhone}?text=${specificMsg}`;
                }

                // Smooth scroll ke rincian tagihan
                setTimeout(() => {
                    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);
            } else {
                if (errText) errText.innerText = data.message || 'Data pelanggan tidak ditemukan. Periksa kembali No. WhatsApp atau Username Anda.';
                if (errBox) errBox.classList.remove('hidden');
                resultBox.classList.add('hidden');
                if (verifiedSection) verifiedSection.classList.add('hidden');
            }
        } catch (err) {
            console.error(err);
            if (errText) errText.innerText = 'Gagal terhubung ke server billing. Pastikan koneksi internet perangkat Anda aktif.';
            if (errBox) errBox.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.querySelector('span').innerText = 'Periksa Tagihan';
        }
    });
}

// Utility: escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
