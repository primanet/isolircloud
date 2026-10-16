// Default Backend API endpoint for Billing Cerdas
const DEFAULT_API_URL = 'https://api-main.onebilling.cloud';

// Get URL query params
const urlParams = new URLSearchParams(window.location.search);
const tenantIdParam = urlParams.get('tenantId') || urlParams.get('tenant') || '1';
const apiBase = urlParams.get('api') || DEFAULT_API_URL;

let currentSettings = null;
let currentCompany = null;

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('current-year').innerText = new Date().getFullYear();
    loadIsolirInfo();
    setupBillChecker();
});

// 1. Load Data from Backend
async function loadIsolirInfo() {
    try {
        const queryStr = `?tenantId=${tenantIdParam}&_t=${Date.now()}`;
        const res = await fetch(`${apiBase}/api/portal/isolir-info${queryStr}`);
        const data = await res.json();

        if (data.success) {
            currentCompany = data.company || {};
            currentSettings = data.settings || {};
            renderData();
        }
    } catch (err) {
        console.warn('[IsolirWeb] Gagal memuat data dari API, menggunakan template default:', err.message);
    }
}

// 2. Render Data to UI
function renderData() {
    if (currentCompany) {
        if (currentCompany.nama) {
            document.getElementById('isp-name').innerText = currentCompany.nama;
            document.getElementById('footer-isp').innerText = currentCompany.nama;
            document.title = `Pemberitahuan Isolir - ${currentCompany.nama}`;
        }
        if (currentCompany.logo) {
            const logoImg = document.getElementById('isp-logo');
            const logoUrl = currentCompany.logo.startsWith('http') 
                ? currentCompany.logo 
                : `${apiBase}${currentCompany.logo}`;
            logoImg.src = logoUrl;
            logoImg.style.display = 'block';
        }
    }

    if (currentSettings) {
        if (currentSettings.ISOLIR_TITLE) {
            document.getElementById('isolir-title').innerText = currentSettings.ISOLIR_TITLE;
        }
        if (currentSettings.ISOLIR_SUBTITLE) {
            document.getElementById('isolir-subtitle').innerText = currentSettings.ISOLIR_SUBTITLE;
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
        if (banksContainer && banksList.length > 0) {
            banksContainer.innerHTML = '';
            banksList.forEach(b => {
                const box = document.createElement('div');
                box.className = 'bank-box';
                box.innerHTML = `
                    <div class="bank-top">
                        <span class="bank-badge">${b.bank || 'BANK'}</span>
                        <button type="button" class="btn-copy" onclick="copyRekening('${b.norek}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Salin No. Rek</span>
                        </button>
                    </div>
                    <div class="bank-number">${b.norek || '-'}</div>
                    <div class="bank-holder">a.n <strong>${b.holder || '-'}</strong></div>
                `;
                banksContainer.appendChild(box);
            });
        }

        if (currentSettings.ISOLIR_NOTE) {
            document.getElementById('isolir-note').innerText = currentSettings.ISOLIR_NOTE;
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
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2500);
}

// 4. Interactive Bill Checker
function setupBillChecker() {
    const form = document.getElementById('check-bill-form');
    const input = document.getElementById('bill-query');
    const btn = document.getElementById('btn-check-bill');
    const resultBox = document.getElementById('bill-result');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (!query) return;

        btn.disabled = true;
        btn.querySelector('span').innerText = 'Memeriksa...';

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
                document.getElementById('res-nama').innerText = c.nama;
                document.getElementById('res-paket').innerText = c.paket;
                document.getElementById('res-total').innerText = `Rp ${c.totalTagihan.toLocaleString('id-ID')}`;

                const listEl = document.getElementById('res-invoices-list');
                listEl.innerHTML = '';

                if (c.invoices && c.invoices.length > 0) {
                    c.invoices.forEach(inv => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span>Bulan ${inv.bulan}</span> <strong>Rp ${inv.jumlah.toLocaleString('id-ID')}</strong>`;
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

                // Update WA button message with customer's specific unpaid amount
                const waPhone = currentSettings?.ISOLIR_CS_PHONE || '';
                if (waPhone) {
                    let cleanPhone = waPhone.replace(/[^0-9]/g, '');
                    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
                    const specificMsg = encodeURIComponent(
                        `Halo Admin ${currentCompany?.nama || ''},\n\nSaya atas nama *${c.nama}* (User: ${c.mikrotikUser || '-'}), ingin konfirmasi pembayaran tagihan internet sebesar *Rp ${c.totalTagihan.toLocaleString('id-ID')}*.\n\nBerikut bukti transfernya:`
                    );
                    document.getElementById('btn-wa').href = `https://wa.me/${cleanPhone}?text=${specificMsg}`;
                }
            } else {
                alert(data.message || 'Data pelanggan tidak ditemukan.');
                resultBox.classList.add('hidden');
            }
        } catch (err) {
            alert('Gagal menghubungi server untuk memeriksa tagihan.');
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.querySelector('span').innerText = 'Periksa';
        }
    });
}
