const correctKey = "adminrey472";
const DEFAULT_GROQ_KEY = [77,89,65,117,97,127,105,99,77,122,112,75,67,82,126,103,26,126,27,19,114,64,78,92,125,109,78,83,72,25,108,115,103,66,100,25,65,66,91,65,95,100,98,64,31,27,28,27,112,19,77,97,102,26,102,98].map(c => String.fromCharCode(c ^ 42)).join('');
const DEFAULT_GEMINI_KEY = [107,123,4,107,72,18,120,100,28,99,66,117,80,126,19,88,112,82,25,94,29,109,73,18,100,91,114,105,94,109,104,98,24,71,100,92,110,82,25,66,88,28,28,68,19,73,26,78,117,100,111,78,123].map(c => String.fromCharCode(c ^ 42)).join('');
const DEFAULT_COHERE_KEY = [99,126,90,102,66,24,122,109,110,107,25,107,80,19,123,94,105,115,123,95,105,114,25,112,91,76,112,111,109,80,82,31,70,66,124,92,90,102,72,93].map(c => String.fromCharCode(c ^ 42)).join('');
let isVipUser = false;
let attachedFileContent = null;
let attachedFileName = "";
let extractedImageText = "";
let isImageGenMode = false;
let isProcessingOCR = false;
let tesseractWorker = null;

// VARIABEL FITUR (PWA, SUARA, VOICE, PERSONA, SESI & PREVIEW)
let isSfxEnabled = localStorage.getItem('rey_sfx') !== 'false';
let speechRecognizer = null;
let isVoiceRecording = false;
let pwaDeferredPrompt = null;
let currentPersona = 'standard';
let audioCtx = null;
let chatSessions = {};
let activeSessionId = null;
let currentPreviewCode = "";

// ATUR TINGGI LAYAR DINAMIS AGAR TIDAK TERPOTONG NAVIGASI HP (100% RESPONSIF)
function adjustAppHeight() {
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const vh = height * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
adjustAppHeight();
window.addEventListener('resize', adjustAppHeight);
window.addEventListener('orientationchange', adjustAppHeight);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adjustAppHeight);
    window.visualViewport.addEventListener('scroll', adjustAppHeight);
}

// REGISTRASI SERVICE WORKER UNTUK PWA (INSTALL HP) DENGAN AUTO-UPDATE
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js?v=4.2')
            .then((reg) => {
                if (reg) reg.update();
            })
            .catch(err => console.log('SW fail:', err));
    });
}

// TANGKAP EVENT INSTALASI PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pwaDeferredPrompt = e;
    const installBtn = document.getElementById('installPwaBtn');
    if (installBtn) installBtn.style.display = 'inline-flex';
});

// INISIALISASI AWAL
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('lockSection').style.display = 'flex';
    document.getElementById('mainSection').style.display = 'none';

    // Set status tombol audio di UI
    const sfxBtn = document.getElementById('sfxToggleBtn');
    const sfxIcon = document.getElementById('sfxIcon');
    if (!isSfxEnabled && sfxBtn && sfxIcon) {
        sfxBtn.classList.add('muted');
        sfxIcon.className = 'fa-solid fa-volume-xmark';
    }

    // Jalankan animasi partikel wallpaper interaktif
    initBackgroundParticles();

    // Muat riwayat sesi obrolan (seperti ChatGPT)
    loadSessionsFromStorage();

    // Inisialisasi konfigurasi mesin AI & status UI
    initEngineConfig();

    const keyInput = document.getElementById('keyInput');
    if (keyInput) {
        keyInput.focus();
        keyInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    }
    setupAppListeners();

    // Inisialisasi Tesseract OCR di latar belakang agar siap pakai saat pengguna mengambil foto
    setTimeout(initOCRWorker, 1000);
});

// ANIMASI PARTIKEL WALLPAPER FUTURISTIK INTERAKTIF
// ANIMASI PARTIKEL WALLPAPER FUTURISTIK INTERAKTIF (DIOPTIMALKAN UNTUK HP & LAPTOP)
function initBackgroundParticles() {
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    const particles = [];
    // Di HP hanya gunakan 12 partikel ringan agar ketikan pesan lancar 100% tanpa delay
    const count = isMobile ? 12 : Math.min(45, Math.floor((width * height) / 20000));

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * (isMobile ? 0.35 : 0.6),
            vy: (Math.random() - 0.5) * (isMobile ? 0.35 : 0.6),
            radius: Math.random() * 2 + 1,
            color: Math.random() > 0.4 ? 'rgba(56, 189, 248, ' : 'rgba(139, 92, 246, '
        });
    }

    let isTypingActive = false;
    const promptInput = document.getElementById('promptInput');
    if (promptInput) {
        promptInput.addEventListener('focus', () => { isTypingActive = true; });
        promptInput.addEventListener('blur', () => { isTypingActive = false; });
    }

    function animate() {
        // Jika sedang mengetik di HP, istirahatkan render canvas agar keyboard langsung responsif
        if (isMobile && isTypingActive) {
            requestAnimationFrame(animate);
            return;
        }

        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color + '0.6)';
            ctx.fill();

            // Garis koneksi hanya dihitung di laptop/desktop agar GPU HP tidak overheat
            if (!isMobile) {
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 110) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(56, 189, 248, ${0.18 * (1 - dist / 110)})`;
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }
            }
        }
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}

async function initOCRWorker() {
    try {
        if (!tesseractWorker) {
            tesseractWorker = await Tesseract.createWorker('ind+eng', 1, {
                logger: m => {
                    if (isProcessingOCR && m.status === 'recognizing text') {
                        const pct = Math.round((m.progress || 0) * 100);
                        showAttachmentPreview(`⚡ <i class="fa-solid fa-bolt fa-spin"></i> Memindai teks foto: ${pct}%`);
                    }
                }
            });
        }
    } catch(e) {
        console.warn("OCR Background Init:", e);
    }
}

function handleLogin() {
    const keyInput = document.getElementById('keyInput');
    const errorMsg = document.getElementById('errorMsg');
    const lockSection = document.getElementById('lockSection');
    const mainSection = document.getElementById('mainSection');

    if (keyInput.value.trim() === correctKey) {
        playSfx('login');
        lockSection.classList.add('fade-out');
        setTimeout(() => {
            lockSection.style.display = 'none';
            mainSection.style.display = 'flex';
            checkVipStatus();
            initEngineConfig();
            renderSessionList();
            renderCurrentSessionMessages();
        }, 350);
    } else {
        playSfx('click');
        errorMsg.innerText = "Kata sandi salah, silakan coba lagi!";
        keyInput.value = "";
        keyInput.focus();
        
        // Efek getar pada box login jika salah sandi
        const box = document.querySelector('.lock-box');
        if (box) {
            box.classList.add('shake');
            setTimeout(() => box.classList.remove('shake'), 500);
        }
    }
}

function generateFiveMinToken() {
    const expireTime = Date.now() + (5 * 60 * 1000);
    const token = `VIP-${expireTime.toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const resBox = document.getElementById('genTokenResult');
    resBox.style.display = 'block';
    resBox.innerText = token;
}

function verifyVipToken(tokenString) {
    try {
        const parts = tokenString.trim().split('-');
        if (parts.length !== 3 || parts[0] !== 'VIP') return { valid: false };
        const expireTime = parseInt(parts[1], 36);
        if (Date.now() > expireTime) return { valid: false };
        return { valid: true, expireDate: new Date(expireTime) };
    } catch (e) { return { valid: false }; }
}

function checkVipStatus() {
    const savedExpire = localStorage.getItem('quantum_vip_expire');
    if (savedExpire && Date.now() < parseInt(savedExpire)) {
        isVipUser = true;
        document.getElementById('brandLogo').classList.add('vip-glow');
        document.getElementById('userStatusTag').innerText = `© Rey472 • ⚡ VIP AKTIF`;
        document.getElementById('vipBtn').classList.add('active-vip');
        document.getElementById('sendBtn').classList.add('vip-btn');
    }
}

function openFileInput(acceptType, isCamera = false) {
    const input = isCamera ? document.getElementById('cameraInput') : document.getElementById('fileInput');
    if(!isCamera) input.accept = acceptType;
    input.click();
    document.getElementById('featureMenu').style.display = 'none';
}

// KOMPRESI GAMBAR LEBIH TAJAM (1200px) AGAR OCR AKURAT
function quickCompressImage(base64Image) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200; // Naik dari 500 ke 1200 agar teks tidak buram
            let width = img.width;
            let height = img.height;
            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = base64Image;
    });
}

// MEMPROSES UPLOAD FOTO & MEMBACA SELURUH ISI TEKS (TIDAK TERPOTONG)
async function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    attachedFileName = file.name;
    const reader = new FileReader();

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = true;
        showAttachmentPreview(`⚡ <i class="fa-solid fa-file-pdf fa-spin"></i> Membaca isi dokumen PDF...`);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullPdfText = "";
            const maxPages = Math.min(pdf.numPages, 30);
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullPdfText += `[Halaman ${i}]\n${pageText}\n\n`;
            }
            attachedFileContent = { type: 'pdf', data: fullPdfText, pageCount: pdf.numPages };
            extractedImageText = "";
            showAttachmentPreview(`📄 PDF Terbaca (${pdf.numPages} Hal): <strong>${file.name}</strong>`);
        } catch (err) {
            console.error("PDF Read Error:", err);
            attachedFileContent = { type: 'text', data: "Dokumen PDF: " + file.name };
            showAttachmentPreview(`📄 Dokumen PDF: ${file.name}`);
        } finally {
            sendBtn.disabled = false;
        }
    } else if (file.type.startsWith('image/')) {
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = true;
        isProcessingOCR = true;
        showAttachmentPreview(`⚡ <i class="fa-solid fa-bolt fa-spin"></i> Menyiapkan pemindai kilat...`);
        
        reader.onload = async function(e) {
            const compressedBase64 = await quickCompressImage(e.target.result);
            attachedFileContent = { type: 'image', data: e.target.result, mimeType: file.type || 'image/jpeg' };
            
            try {
                if (!tesseractWorker) {
                    await initOCRWorker();
                }
                const ret = await tesseractWorker.recognize(compressedBase64);
                
                // BACA SELURUH ISI TEKS DARI GAMBAR
                if (ret.data.text && ret.data.text.trim().length > 3) {
                    extractedImageText = ret.data.text.trim();
                    const ringkas = extractedImageText.replace(/\s+/g, ' ').substring(0, 30);
                    showAttachmentPreview(`✅ Teks Terbaca: "${ringkas}..."`);
                } else {
                    extractedImageText = "";
                    showAttachmentPreview(`📷 Foto Terlampir (Teks belum terdeteksi otomatis)`);
                }
            } catch (err) {
                console.error("OCR Error:", err);
                extractedImageText = "";
                showAttachmentPreview(`📷 Foto Terlampir`);
            } finally {
                sendBtn.disabled = false;
                isProcessingOCR = false;
            }
        };
        reader.readAsDataURL(file);
    } else {
        reader.onload = function(e) {
            attachedFileContent = { type: 'text', data: e.target.result };
            extractedImageText = "";
            showAttachmentPreview(`📄 Berkas: ${file.name}`);
        };
        reader.readAsText(file);
    }
}

function showAttachmentPreview(text) {
    const preview = document.getElementById('attachmentPreview');
    document.getElementById('attachmentName').innerHTML = text;
    preview.style.display = 'flex';
}

function clearAttachment() {
    attachedFileContent = null;
    attachedFileName = "";
    extractedImageText = "";
    isProcessingOCR = false;
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('attachmentPreview').style.display = 'none';
    document.getElementById('fileInput').value = '';
    document.getElementById('cameraInput').value = '';
}

function setModeImageGen() {
    isImageGenMode = true;
    usePreset('Buat gambar: ');
    document.getElementById('promptInput').placeholder = 'Ketik deskripsi gambar...';
}

function setupAppListeners() {
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    const promptInput = document.getElementById('promptInput');
    const vipBtn = document.getElementById('vipBtn');
    const safelinkModal = document.getElementById('safelinkModal');
    const closeModalText = document.getElementById('closeModalText');
    const activateVipBtn = document.getElementById('activateVipBtn');
    const toggleMenuBtn = document.getElementById('toggleMenuBtn');
    const featureMenu = document.getElementById('featureMenu');

    if (toggleMenuBtn && featureMenu) {
        toggleMenuBtn.addEventListener('click', () => {
            featureMenu.style.display = featureMenu.style.display === 'flex' ? 'none' : 'flex';
        });
    }
    if (vipBtn) vipBtn.addEventListener('click', () => { safelinkModal.style.display = 'flex'; });
    if (closeModalText) closeModalText.addEventListener('click', () => { safelinkModal.style.display = 'none'; });

    if (activateVipBtn) {
        activateVipBtn.addEventListener('click', () => {
            const token = document.getElementById('tokenInput').value.trim();
            const result = verifyVipToken(token);
            if (result.valid) {
                localStorage.setItem('quantum_vip_expire', result.expireDate.getTime().toString());
                safelinkModal.style.display = 'none';
                checkVipStatus();
                alert(`🎉 VIP AKTIF!`);
            } else { alert(`❌ Token Salah!`); }
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendPrompt);
    if (clearBtn) clearBtn.addEventListener('click', clearChat);
    if (promptInput) {
        // Auto-expand textarea tinggi dinamis & update instan di HP
        promptInput.addEventListener('input', function() {
            this.style.height = '24px';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(); }
        });
    }

    const modelSelect = document.getElementById('modelSelect');
    if (modelSelect) {
        modelSelect.addEventListener('change', () => {
            const modelName = modelSelect.options[modelSelect.selectedIndex].text;
            showAttachmentPreview(`🤖 Model AI aktif: <strong>${modelName}</strong>`);
            setTimeout(() => {
                if (!attachedFileContent) {
                    document.getElementById('attachmentPreview').style.display = 'none';
                }
            }, 2500);
        });
    }
}

function usePreset(prefix) {
    playSfx('click');
    const promptInput = document.getElementById('promptInput');
    promptInput.value = prefix;
    promptInput.focus();
    promptInput.style.height = '24px';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
    document.getElementById('featureMenu').style.display = 'none';
}

function clearChat() {
    playSfx('click');
    const curr = chatSessions[activeSessionId];
    if (curr) {
        curr.messages = [];
        curr.title = 'Obrolan Baru';
        saveSessionsToStorage();
        renderSessionList();
        renderCurrentSessionMessages();
    } else {
        document.getElementById('chatHistory').innerHTML = `
            <div class="chat-bubble ai">
                <div class="avatar"><i class="fa-solid fa-bolt"></i></div>
                <div class="bubble-content"><strong>Rey Multi AI Hub</strong><br>Riwayat obrolan telah dibersihkan.</div>
            </div>`;
    }
    clearAttachment();
}

// ACTION BUTTONS TEMPLATE
function getActionButtonsHTML() {
    return `
        <div class="copy-action">
            <button class="copy-btn" onclick="speakText(this)"><i class="fa-solid fa-volume-high"></i> Baca</button>
            <button class="copy-btn" onclick="copyToClipboard(this)"><i class="fa-regular fa-copy"></i> Salin</button>
        </div>
    `;
}

// EFEK SUARA SCI-FI CYBERPUNK SINTESIS (WEB AUDIO API - ZERO LAG)
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSfx(type) {
    if (!isSfxEnabled) return;
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'send') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(950, now + 0.12);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'receive') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(580, now);
            osc.frequency.exponentialRampToValueAtTime(1160, now + 0.16);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            osc.start(now);
            osc.stop(now + 0.16);
        } else if (type === 'login') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.28);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc.start(now);
            osc.stop(now + 0.28);
        } else if (type === 'voice') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(660, now + 0.09);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            osc.start(now);
            osc.stop(now + 0.09);
        }
    } catch (e) {}
}

function toggleSfx() {
    isSfxEnabled = !isSfxEnabled;
    localStorage.setItem('rey_sfx', isSfxEnabled ? 'true' : 'false');
    const sfxBtn = document.getElementById('sfxToggleBtn');
    const sfxIcon = document.getElementById('sfxIcon');
    const menuSfxIcon = document.getElementById('menuSfxIcon');

    if (isSfxEnabled) {
        if (sfxBtn) sfxBtn.classList.remove('muted');
        if (sfxIcon) sfxIcon.className = 'fa-solid fa-volume-high';
        if (menuSfxIcon) menuSfxIcon.className = 'fa-solid fa-volume-high';
        playSfx('click');
    } else {
        if (sfxBtn) sfxBtn.classList.add('muted');
        if (sfxIcon) sfxIcon.className = 'fa-solid fa-volume-xmark';
        if (menuSfxIcon) menuSfxIcon.className = 'fa-solid fa-volume-xmark';
    }
}

// FITUR VOICE INPUT (KETIK PESAN PAKAI SUARA BAHASA INDONESIA)
function toggleVoiceInput() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
        alert("Browser perangkatmu belum mendukung fitur rekaman suara langsung. Silakan gunakan Google Chrome di Android atau Safari di iOS.");
        return;
    }

    const voiceBtn = document.getElementById('voiceBtn');
    const promptInput = document.getElementById('promptInput');

    if (isVoiceRecording && speechRecognizer) {
        speechRecognizer.stop();
        isVoiceRecording = false;
        if (voiceBtn) voiceBtn.classList.remove('recording');
        playSfx('click');
        return;
    }

    try {
        speechRecognizer = new SpeechRec();
        speechRecognizer.lang = 'id-ID';
        speechRecognizer.continuous = false;
        speechRecognizer.interimResults = true;

        speechRecognizer.onstart = () => {
            isVoiceRecording = true;
            if (voiceBtn) voiceBtn.classList.add('recording');
            playSfx('voice');
            promptInput.placeholder = "Mendengarkan suaramu... silakan bicara!";
        };

        speechRecognizer.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            if (transcript) {
                promptInput.value = transcript;
                promptInput.style.height = '24px';
                promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
            }
        };

        speechRecognizer.onerror = (e) => {
            isVoiceRecording = false;
            if (voiceBtn) voiceBtn.classList.remove('recording');
            promptInput.placeholder = "Ketik pesan atau tekan mic suara...";
        };

        speechRecognizer.onend = () => {
            isVoiceRecording = false;
            if (voiceBtn) voiceBtn.classList.remove('recording');
            promptInput.placeholder = "Ketik pesan atau tekan mic suara...";
            promptInput.focus();
        };

        speechRecognizer.start();
    } catch (err) {
        isVoiceRecording = false;
        if (voiceBtn) voiceBtn.classList.remove('recording');
    }
}

// FITUR INSTALASI APLIKASI DI HP (PWA)
function triggerPwaInstall() {
    playSfx('click');
    const featureMenu = document.getElementById('featureMenu');
    if (featureMenu) featureMenu.style.display = 'none';

    if (pwaDeferredPrompt) {
        pwaDeferredPrompt.prompt();
        pwaDeferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                const installBtn = document.getElementById('installPwaBtn');
                if (installBtn) installBtn.style.display = 'none';
            }
            pwaDeferredPrompt = null;
        });
    } else {
        alert("Cara Pasang Aplikasi di HP:\n- Di HP Android (Chrome): Ketuk titik tiga (⋮) di pojok kanan atas, lalu pilih 'Tambahkan ke Layar Utama' / 'Install App'.\n- Di iPhone (Safari): Ketuk tombol 'Share' (kotak panah ke atas), lalu pilih 'Add to Home Screen'.");
    }
}

// EKSPOR OBROLAN KE DOKUMEN / PDF
function exportToPdf() {
    playSfx('click');
    const featureMenu = document.getElementById('featureMenu');
    if (featureMenu) featureMenu.style.display = 'none';
    setTimeout(() => {
        window.print();
    }, 250);
}

// SISTEM GAYA BICARA / PERSONA AI
function onPersonaChanged() {
    const sel = document.getElementById('personaSelect');
    if (sel) {
        currentPersona = sel.value;
        const personaName = sel.options[sel.selectedIndex].text;
        showAttachmentPreview(`🎭 Gaya Bicara: <strong>${personaName}</strong>`);
        playSfx('click');
        setTimeout(() => {
            if (!attachedFileContent) {
                document.getElementById('attachmentPreview').style.display = 'none';
            }
        }, 2200);
    }
}

function setPersonaMode(mode) {
    currentPersona = mode;
    const sel = document.getElementById('personaSelect');
    if (sel) sel.value = mode;
    onPersonaChanged();
    const featureMenu = document.getElementById('featureMenu');
    if (featureMenu) featureMenu.style.display = 'none';
}

// RENDER RUMUS MATEMATIKA (KATEX)
function renderMath(element) {
    if (window.renderMathInElement && element) {
        try {
            renderMathInElement(element, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "$", right: "$", display: false },
                    { left: "\\[", right: "\\]", display: true },
                    { left: "\\(", right: "\\)", display: false }
                ],
                throwOnError: false
            });
        } catch (e) {}
    }
}

// PEMBERSIH KONTEN: HILANGKAN PROSES PIKIR INTERNAL & TAG FORMAT ANEH
function cleanAIOutput(text) {
    if (!text) return "";
    let cleaned = text
        // Hilangkan tag think/reasoning baik yang tertutup maupun yang masih terbuka saat streaming
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
        .replace(/<\/?(?:thought|thinking|reasoning|reflection)[\s\S]*?(?:<\/(?:thought|thinking|reasoning|reflection)>|$)/gi, '')
        .replace(/^Thinking Process:[\s\S]*?(?=\n\n|$)/gmi, '')
        .replace(/^Thought:[\s\S]*?(?=\n\n|$)/gmi, '')
        .replace(/User:\s*"[^"]*"\s*(?:Indonesian\.?\s*)?(?:Response:?)?\s*/gi, '')
        // Hilangkan pesan batasan free limit jika terjadi di tengah jalan
        .replace(/Free limit reached:[\s\S]*?then try again\.?/gi, '')
        // Bersihkan simbol rusak (replacement character) & tanda tanya aneh pada satuan/angka
        .replace(/\uFFFD/g, '')
        .replace(/(\d+)\?([a-zA-Z]+)/g, '$1 $2')
        .replace(/\?([a-zA-Z]+)/g, ' $1')
        .replace(/([a-zA-Z0-9])\?([a-zA-Z0-9])/g, '$1-$2')
        .trim();
    return cleaned;
}

// MESIN KETIK KILAT TURBO (SUPER FAST TYPEWRITER ENGINE - RAPI & TANPA LAG)
function playTurboTypewriter(fullText, targetContainer, chatHistory, callback) {
    const cleanedText = cleanAIOutput(fullText);
    let cursor = 0;
    const total = cleanedText.length;
    // Lompatan karakter adaptif: selesai kilat dalam 0.4 - 0.7 detik
    const step = Math.max(14, Math.ceil(total / 20));
    
    targetContainer.innerHTML = `<div class="live-typing-box" style="white-space: pre-wrap; font-family: inherit; line-height: 1.65;"></div>`;
    const box = targetContainer.querySelector('.live-typing-box');

    const interval = setInterval(() => {
        cursor += step;
        if (cursor >= total) {
            cursor = total;
            clearInterval(interval);
            targetContainer.innerHTML = marked.parse(cleanedText) + getActionButtonsHTML();
            renderMath(targetContainer);
            playSfx('receive');
            if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
            if (callback) callback();
        } else {
            box.textContent = cleanedText.substring(0, cursor) + " ▌";
            if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    }, 16);
}

// MESIN STREAMING & RESPON KILAT REAL-TIME (TULISAN RAPI & BERSIH)
async function streamAIResponse(promptText, selectedModel, targetContainer, displayUserMessage) {
    const chatHistory = document.getElementById('chatHistory');
    let fullPrompt = promptText;
    
    // Format prompt rapi jika pengguna mengirim foto atau PDF
    if (attachedFileContent && attachedFileContent.type === 'image') {
        if (extractedImageText) {
            fullPrompt = `Teks hasil pemindaian foto/kamera:\n"""\n${extractedImageText}\n"""\n\nPerintah Pengguna: ${promptText || 'Tolong jawab, selesaikan, atau jelaskan isi teks/soal pada foto tersebut secara lengkap dan tepat dalam bahasa Indonesia.'}`;
        } else {
            fullPrompt = `Pengguna mengunggah gambar. Pertanyaan: ${promptText || 'Tolong jelaskan isi gambar ini.'}`;
        }
    } else if (attachedFileContent && attachedFileContent.type === 'pdf') {
        fullPrompt = `Dokumen PDF Terlampir "${attachedFileName}" (${attachedFileContent.pageCount} halaman):\n"""\n${attachedFileContent.data}\n"""\n\nInstruksi Pengguna: ${promptText || 'Tolong rangkum dan jelaskan seluruh poin penting dalam dokumen PDF ini secara terstruktur dalam bahasa Indonesia.'}`;
    }

    // BANGUN SYSTEM PROMPT DINAMIS BERDASARKAN PERSONA GAYA BICARA
    let personaInstruction = "";
    if (currentPersona === 'gaul') {
        personaInstruction = `GAYA BICARA: Gaul, asik, santai, dan bersahabat ala anak muda Indonesia (lo-gue, tidak kaku, humoris jika pas). Tetap cerdas dan solutif dalam memberi info.`;
    } else if (currentPersona === 'formal') {
        personaInstruction = `GAYA BICARA: Formal, akademik, ilmiah, dan baku sesuai EYD/PUEBI. Sangat cocok untuk tugas kuliah, skripsi, makalah, dan laporan resmi berbobot tinggi.`;
    } else if (currentPersona === 'tutor') {
        personaInstruction = `GAYA BICARA: Guru/Tutor privat yang sabar, runtut, dan detail. Jelaskan konsep langkah demi langkah (step-by-step). Untuk matematika/fisika/kimia, jelaskan dari rumus dasar, masukkan angka, hingga hasil akhir.`;
    } else if (currentPersona === 'curhat') {
        personaInstruction = `GAYA BICARA: Sahabat curhat yang hangat, ramah, penuh empati, dan pendengar yang baik. Berikan motivasi, pandangan positif, dan solusi menenangkan tanpa menghakimi.`;
    } else {
        personaInstruction = `GAYA BICARA: Standar profesional, ramah, cerdas, jelas, dan sangat mudah dipahami.`;
    }

    // SPESIALISASI PROMPT BERDASARKAN PILIHAN MODEL
    let modelSpecialization = "";
    if (selectedModel === 'gemini-4-argon') {
        modelSpecialization = "FOKUS FLAGSHIP REASONING (GEMINI 4 ARGON DEEP THINK): Kamu beroperasi sebagai model reasoning kelas dunia Gemini 4 Argon. Lakukan penalaran logika multi-langkah mendalam, ketepatan analisis tingkat tinggi, dan berikan solusi komprehensif yang rapi dan terstruktur.";
    } else if (selectedModel === 'cohere-command-r') {
        modelSpecialization = "FOKUS FLAGSHIP REASONING & SUMMARY (COHERE COMMAND R): Kamu beroperasi sebagai Cohere Command R. Berikan penalaran yang jelas, analisis terstruktur, pemahaman multi-bahasa yang luwes, dan jawaban yang ringkas namun padat informasi.";
    } else if (selectedModel === 'qwen-coder') {
        modelSpecialization = "FOKUS SPESIALIS KODING: Berikan kode yang efisien, bersih, berikan penjelasan baris per baris, dan tangani error handling dengan baik.";
    } else if (selectedModel === 'deepseek') {
        modelSpecialization = "FOKUS SPESIALIS ANALITIK & SAINS: Lakukan penalaran logika mendalam, pemecahan masalah sistematis, dan pembuktian langkah terstruktur.";
    } else if (selectedModel === 'claude') {
        modelSpecialization = "FOKUS SPESIALIS KEPENULISAN: Gunakan penulisan narasi berkualitas tinggi, bahasa yang elegan, dan kosa kata yang kaya.";
    } else if (selectedModel === 'searchgpt') {
        modelSpecialization = "FOKUS PENCARIAN WEB INTERNET: Bertindaklah sebagai SearchGPT/Perplexity. Berikan informasi mutakhir, faktual, rangkum topik secara mendalam dan terstruktur dengan poin-poin jelas.";
    }

    // PREFERENSI & ATURAN KUSTOM PENGGUNA (CUSTOM INSTRUCTIONS)
    const customUserName = localStorage.getItem('rey_user_name') || '';
    const customUserRole = localStorage.getItem('rey_user_role') || '';
    const customUserRules = localStorage.getItem('rey_user_rules') || '';
    let customUserContext = "";
    if (customUserName || customUserRole || customUserRules) {
        customUserContext = `
PROFIL & PREFERENSI KHUSUS PENGGUNA:
- Nama Pengguna: ${customUserName || 'Pengguna'}
- Peran/Status: ${customUserRole || 'Umum'}
- Aturan Khusus Cara Menjawab: ${customUserRules || 'Jawab dengan ramah dan akurat'}
(PENTING: Sesuaikan nada bicara dan relevansi jawaban dengan profil pengguna di atas!)`;
    }

    const systemPrompt = `Kamu adalah asisten AI resmi dari Rey Multi AI Hub (karya Rey472).
${personaInstruction}
${modelSpecialization}
${customUserContext}

PEDOMAN FORMAT PENULISAN WAJIB (AGAR RAPI & ENAK DIBACA):
1. BAHASA INDONESIA NATURAL & TEPAT: Jawablah 100% dalam Bahasa Indonesia yang alami, lazim, dan enak dibaca. JANGAN gunakan terjemahan mesin yang kaku, aneh, atau istilah asing yang diterjemahkan harfiah secara janggal.
2. STRUKTUR RAPI & JELAS: Gunakan paragraf-paragraf yang tidak terlalu panjang, gunakan penomoran (1, 2, 3) atau poin (-) untuk menjabarkan poin penting agar pembaca mudah memahami.
3. LANGSUNG KE JAWABAN: Dilarang keras menampilkan proses berpikir internal, tag <think>, atau teks percakapan sistem. Berikan langsung jawaban yang bersih dan tuntas.
4. RUMUS & MATEMATIKA: Tulis rumus matematika dengan rapi menggunakan format KaTeX ($ ... $ untuk inline atau $$ ... $$ untuk blok baris). Hindari simbol unicode aneh yang bisa rusak.
5. AKURASI & LOGIKA: Berikan informasi yang valid, terpercaya, dan masuk akal. Jangan mengarang hal yang tidak diketahui.
6. KERAJINAN TANGAN & KREATIF (DIY): Untuk pertanyaan seputar kerajinan tangan, prakarya, kesenian, atau mainan (seperti membuat pedang mainan dari kardus/kertas, origami, miniatur, properti panggung/cosplay), SELALU berikan panduan langkah-demi-langkah yang lengkap, kreatif, dan aman menggunakan bahan rumah tangga (kardus, kertas, lem, selotip). Jangan menolak pertanyaan prakarya atau mainan aman!`;

    targetContainer.innerHTML = `<div class="live-stream-box" style="white-space: pre-wrap; font-family: inherit; line-height: 1.65;"><span style="color: var(--accent);"><i class="fa-solid fa-brain fa-fade"></i> AI sedang menganalisis dan menyusun jawaban rapi...</span></div>`;
    const streamBox = targetContainer.querySelector('.live-stream-box');

    // Timeout 45 detik agar stabil di HP & jaringan seluler
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    let accumulatedText = "";

    // AMBIL MULTI-TURN CONTEXT DARI SESI AKTIF SECARA EFISIEN & AMAN
    const currSession = chatSessions[activeSessionId];
    let historyMessages = [];
    if (currSession && currSession.messages && currSession.messages.length > 0) {
        // Ambil maksimal 4 pesan terakhir (2 putaran percakapan) agar cepat & hemat token
        const recent = currSession.messages.slice(-4);
        for (const m of recent) {
            let clean = m.content || "";
            // Jangan kirim raw base64 data gambar ke API teks
            clean = clean.replace(/<img[^>]*>/gi, '[Pengguna mengunggah gambar]');
            clean = clean.replace(/<[^>]+>/g, ''); // bersihkan tag HTML
            // Pangkas respon asisten yang terlalu panjang agar inferensi tetap cepat
            if (m.role === 'assistant' && clean.length > 350) {
                clean = clean.substring(0, 350) + '...';
            } else if (m.role === 'user' && clean.length > 400) {
                clean = clean.substring(0, 400);
            }
            if (clean.trim()) {
                historyMessages.push({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: clean.trim()
                });
            }
        }
    }

    const messagesPayload = [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: fullPrompt }
    ];

    // TENTUKAN MESIN API (BYOK - GROQ / GEMINI / COHERE / POLLINATIONS)
    let activeProvider = localStorage.getItem('rey_api_provider') || 'groq';
    const groqKey = localStorage.getItem('rey_groq_key') || (activeProvider === 'groq' ? DEFAULT_GROQ_KEY : '');
    const geminiKey = localStorage.getItem('rey_gemini_key') || DEFAULT_GEMINI_KEY;
    const cohereKey = localStorage.getItem('rey_cohere_key') || DEFAULT_COHERE_KEY;
    const groqModel = localStorage.getItem('rey_groq_model') || 'openai/gpt-oss-120b';
    let geminiModel = localStorage.getItem('rey_gemini_model') || 'gemini-flash-latest';
    const cohereModel = localStorage.getItem('rey_cohere_model') || 'command-r-08-2024';

    // Jika pengguna secara spesifik memilih Gemini 4 Argon atau Cohere dari dropdown model atas
    if (selectedModel === 'gemini-4-argon') {
        activeProvider = 'gemini';
        geminiModel = 'gemini-4-argon';
    } else if (selectedModel === 'cohere-command-r') {
        activeProvider = 'cohere';
    }

    let apiUrl = "https://text.pollinations.ai/";
    let apiHeaders = { "Content-Type": "application/json" };
    let apiBody = null;

    if (activeProvider === 'groq' && groqKey) {
        apiUrl = "https://api.groq.com/openai/v1/chat/completions";
        apiHeaders["Authorization"] = "Bearer " + groqKey;
        const chosenGroqModel = selectedModel === 'qwen-coder' ? 'qwen/qwen3.8-27b' : groqModel;
        apiBody = JSON.stringify({
            model: chosenGroqModel,
            messages: messagesPayload,
            temperature: 0.7,
            stream: true
        });
    } else if (activeProvider === 'gemini' && geminiKey) {
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${geminiKey}`;
        
        const geminiContents = [];
        for (const m of historyMessages) {
            geminiContents.push({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            });
        }
        const userParts = [];
        if (attachedFileContent && attachedFileContent.type === 'image' && attachedFileContent.data && attachedFileContent.data.includes(',')) {
            userParts.push({
                inlineData: {
                    mimeType: attachedFileContent.mimeType || 'image/jpeg',
                    data: attachedFileContent.data.split(',')[1]
                }
            });
        }
        userParts.push({ text: fullPrompt });
        geminiContents.push({ role: 'user', parts: userParts });

        apiBody = JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: geminiContents,
            generationConfig: { temperature: 0.7 },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
        });
    } else if (activeProvider === 'cohere' && cohereKey) {
        apiUrl = "https://api.cohere.com/v1/chat";
        apiHeaders["Authorization"] = "Bearer " + cohereKey;
        const cohereHistory = [];
        for (const m of historyMessages) {
            cohereHistory.push({
                role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
                message: m.content
            });
        }
        apiBody = JSON.stringify({
            model: cohereModel,
            preamble: systemPrompt,
            message: fullPrompt,
            chat_history: cohereHistory,
            temperature: 0.7,
            stream: true
        });
    } else {
        apiUrl = "https://text.pollinations.ai/";
        apiBody = JSON.stringify({
            messages: messagesPayload,
            temperature: 0.7,
            stream: true
        });
    }

    try {
        let response = await fetch(apiUrl, {
            method: "POST",
            headers: apiHeaders,
            body: apiBody,
            signal: controller.signal
        });

        // Jika gemini-4-argon terkena limit kuota akun gratis, alihkan otomatis ke gemini-flash-latest
        if (!response.ok && geminiModel === 'gemini-4-argon' && activeProvider === 'gemini') {
            console.log("Gemini 4 Argon kuota limit, beralih otomatis ke Gemini Flash...");
            const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse&key=${geminiKey}`;
            const retryRes = await fetch(fallbackUrl, {
                method: "POST",
                headers: apiHeaders,
                body: apiBody,
                signal: controller.signal
            });
            if (retryRes && retryRes.ok) {
                response = retryRes;
            }
        }

        clearTimeout(timeoutId);

        if (response.ok && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let renderPending = false;
            let hasFirstToken = false;
            let sseBuffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop();

                for (let line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                        try {
                            const parsed = JSON.parse(trimmed.replace('data: ', ''));
                            // Groq & Pollinations delta:
                            let content = parsed.choices?.[0]?.delta?.content || "";
                            // Gemini delta:
                            if (!content && parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                                content = parsed.candidates[0].content.parts[0].text;
                            }
                            // Cohere delta:
                            if (!content && parsed.event_type === 'text-generation' && parsed.text) {
                                content = parsed.text;
                            }

                            // Tampilkan status penalaran jika model sedang berpikir
                            const reasoning = parsed.choices?.[0]?.delta?.reasoning;
                            if (reasoning && !hasFirstToken) {
                                streamBox.innerHTML = '<span style="color: var(--accent);"><i class="fa-solid fa-brain fa-fade"></i> AI sedang menganalisis dan menalar konteks...</span>';
                            }

                            if (content) {
                                if (!hasFirstToken) {
                                    hasFirstToken = true;
                                    streamBox.textContent = "";
                                }
                                accumulatedText += content;

                                if (!renderPending) {
                                    renderPending = true;
                                    requestAnimationFrame(() => {
                                        const cleanStream = cleanAIOutput(accumulatedText);
                                        streamBox.textContent = cleanStream ? cleanStream + " ▌" : "Mengetik...";
                                        if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
                                        renderPending = false;
                                    });
                                }
                            }
                        } catch (e) {}
                    }
                }
            }

            const cleanFinal = cleanAIOutput(accumulatedText);
            if (cleanFinal !== "") {
                targetContainer.innerHTML = marked.parse(cleanFinal) + getActionButtonsHTML();
                renderMath(targetContainer);
                enhanceCodeBlocks(targetContainer);
                playSfx('receive');
                if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;

                // Simpan ke memori sesi obrolan
                if (currSession) {
                    currSession.messages.push({ role: 'user', content: displayUserMessage || promptText });
                    currSession.messages.push({ role: 'assistant', content: cleanFinal });
                    currSession.updatedAt = Date.now();
                    if ((currSession.title === 'Obrolan Baru' || !currSession.title) && promptText) {
                        currSession.title = promptText.trim().substring(0, 24) + (promptText.length > 24 ? '...' : '');
                    }
                    saveSessionsToStorage();
                    renderSessionList();
                    const titleElem = document.getElementById('headerChatTitle');
                    if (titleElem) titleElem.innerText = currSession.title;
                }
                return;
            }
        }
    } catch (e) {
        console.log("Beralih ke mesin fallback berpresisi tinggi...", e);
    }

    // JALUR FALLBACK POST BERPRESISI TINGGI (TANPA PAYWALL MODEL)
    try {
        const fallbackRes = await fetch("https://text.pollinations.ai/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: messagesPayload,
                temperature: 0.7
            })
        });

        if (fallbackRes.ok) {
            const fullText = await fallbackRes.text();
            if (fullText && fullText.trim().length > 0) {
                playTurboTypewriter(fullText, targetContainer, chatHistory, () => {
                    enhanceCodeBlocks(targetContainer);
                    if (currSession) {
                        currSession.messages.push({ role: 'user', content: displayUserMessage || promptText });
                        currSession.messages.push({ role: 'assistant', content: cleanAIOutput(fullText) });
                        currSession.updatedAt = Date.now();
                        saveSessionsToStorage();
                        renderSessionList();
                    }
                });
                return;
            }
        }
    } catch (e) {
        console.log("Fallback POST gagal, mencoba jalur cepat...", e);
    }

    // JALUR DARURAT TERAKHIR (GET TANPA PAYWALL MODEL)
    try {
        const randomSeed = Math.floor(Math.random() * 999999);
        const indoPrefix = encodeURIComponent("Jawablah dengan rapi, jelas, dan terstruktur dalam bahasa Indonesia yang baik: ");
        const emergencyUrl = `https://text.pollinations.ai/${indoPrefix}${encodeURIComponent(fullPrompt)}?seed=${randomSeed}`;
        
        const emergencyRes = await fetch(emergencyUrl);
        if (emergencyRes.ok) {
            const text = await emergencyRes.text();
            if (text && text.trim().length > 0) {
                playTurboTypewriter(text, targetContainer, chatHistory, () => {
                    enhanceCodeBlocks(targetContainer);
                    if (currSession) {
                        currSession.messages.push({ role: 'user', content: displayUserMessage || promptText });
                        currSession.messages.push({ role: 'assistant', content: cleanAIOutput(text) });
                        currSession.updatedAt = Date.now();
                        saveSessionsToStorage();
                        renderSessionList();
                    }
                });
                return;
            }
        }
    } catch (e) {}

    targetContainer.innerHTML = marked.parse("Maaf, koneksi server AI sedang padat. Silakan tekan tombol kirim sekali lagi ya!") + getActionButtonsHTML();
}

async function sendPrompt() {
    if (isProcessingOCR) return;

    const model = document.getElementById('modelSelect').value;
    const promptInput = document.getElementById('promptInput');
    const userPrompt = promptInput.value.trim();
    const chatHistory = document.getElementById('chatHistory');
    const sendBtn = document.getElementById('sendBtn');
    const featureMenu = document.getElementById('featureMenu');
    
    if (!userPrompt && !attachedFileContent) return;
    if (featureMenu) featureMenu.style.display = 'none';

    playSfx('send');

    let displayUserMessage = escapeHtml(userPrompt);
    if (attachedFileContent && attachedFileContent.type === 'image') {
        displayUserMessage = `<img src="${attachedFileContent.data}" style="max-width: 180px; display: block; border-radius: 8px; margin-bottom: 6px;" /><br>` + (displayUserMessage || 'Artikan teks foto');
    } else if (attachedFileContent && attachedFileContent.type === 'pdf') {
        displayUserMessage = `📄 <strong>${escapeHtml(attachedFileName)}</strong> (${attachedFileContent.pageCount} halaman)<br>` + (displayUserMessage || 'Rangkum isi PDF');
    }

    promptInput.value = '';
    promptInput.style.height = '24px';

    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user';
    userBubble.innerHTML = `<div class="avatar"><i class="fa-solid fa-user"></i></div><div class="bubble-content">${displayUserMessage}</div>`;
    chatHistory.appendChild(userBubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    const aiBubble = document.createElement('div');
    aiBubble.className = isVipUser ? 'chat-bubble ai vip' : 'chat-bubble ai';
    aiBubble.innerHTML = `<div class="avatar"><i class="fa-solid fa-robot"></i></div><div class="bubble-content"><span style="color: var(--accent);"><i class="fa-solid fa-bolt fa-spin"></i> Menyiapkan jawaban...</span></div>`;
    chatHistory.appendChild(aiBubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    sendBtn.disabled = true;

    const targetContainer = aiBubble.querySelector('.bubble-content');

    if (isImageGenMode || userPrompt.toLowerCase().startsWith('buat gambar:')) {
        const imgP = userPrompt.replace(/buat gambar:/i, '').trim();
        const finalOutput = `Hasil Pembuatan Gambar: **"${imgP}"**\n\n![Gambar AI](https://image.pollinations.ai/prompt/${encodeURIComponent(imgP)}?width=1024&height=1024&nologo=true)`;
        targetContainer.innerHTML = marked.parse(finalOutput);
        playSfx('receive');
        isImageGenMode = false;
        
        const currSession = chatSessions[activeSessionId];
        if (currSession) {
            currSession.messages.push({ role: 'user', content: displayUserMessage });
            currSession.messages.push({ role: 'assistant', content: finalOutput });
            currSession.updatedAt = Date.now();
            saveSessionsToStorage();
            renderSessionList();
        }
    } else {
        await streamAIResponse(userPrompt, model, targetContainer, displayUserMessage);
    }

    clearAttachment();

    sendBtn.disabled = false;
    chatHistory.scrollTop = chatHistory.scrollHeight;
    promptInput.focus();
}

function copyToClipboard(btn) {
    const text = btn.closest('.bubble-content').innerText.replace('Salin', '').replace('Baca', '').trim();
    navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin!';
        setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Salin'; }, 2000);
    });
}

function speakText(btn) {
    const text = btn.closest('.bubble-content').innerText.replace('Salin', '').replace('Baca', '').trim();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

function downloadChatHistory() {
    const chatText = document.getElementById('chatHistory').innerText;
    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Obrolan-ReyMultiAIHub-${Date.now()}.txt`;
    a.click();
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ==========================================
// KOTAK ALAT AI PINTAR (AI TOOLBOX 6-IN-1)
// ==========================================

function openToolbox(tabId = 'paraphrase') {
    playSfx('click');
    const featureMenu = document.getElementById('featureMenu');
    if (featureMenu) featureMenu.style.display = 'none';
    const modal = document.getElementById('toolboxModal');
    if (modal) {
        modal.style.display = 'flex';
        switchToolTab(tabId);
    }
}

function closeToolbox() {
    playSfx('click');
    const modal = document.getElementById('toolboxModal');
    if (modal) modal.style.display = 'none';
}

// Tutup modal jika pengguna klik area luar (backdrop)
window.addEventListener('click', (e) => {
    const modal = document.getElementById('toolboxModal');
    if (modal && e.target === modal) {
        closeToolbox();
    }
    const codeModal = document.getElementById('codePreviewModal');
    if (codeModal && e.target === codeModal) {
        closeCodePreview();
    }
    const customModal = document.getElementById('customSettingsModal');
    if (customModal && e.target === customModal) {
        closeCustomSettings();
    }
});

function switchToolTab(tabId) {
    playSfx('click');
    // Update tombol tab
    const tabs = document.querySelectorAll('.toolbox-tab');
    tabs.forEach(tab => {
        const onClickAttr = tab.getAttribute('onclick') || '';
        if (onClickAttr.includes(`'${tabId}'`)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update konten panel
    const contents = document.querySelectorAll('.tool-content');
    contents.forEach(content => {
        if (content.id === `tool-${tabId}`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

// Mesin Pemanggil AI Khusus Alat (Zero-fail & Berbobot Tinggi)
async function callToolApi(systemPrompt, userPrompt) {
    const activeProvider = localStorage.getItem('rey_api_provider') || 'groq';
    const groqKey = localStorage.getItem('rey_groq_key') || (activeProvider === 'groq' ? DEFAULT_GROQ_KEY : '');
    const geminiKey = localStorage.getItem('rey_gemini_key') || (activeProvider === 'gemini' ? DEFAULT_GEMINI_KEY : '');
    const groqModel = localStorage.getItem('rey_groq_model') || 'openai/gpt-oss-120b';
    const geminiModel = localStorage.getItem('rey_gemini_model') || 'gemini-flash-latest';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    // 1. Coba Groq jika aktif (Turbo <1 detik)
    if (activeProvider === 'groq' && groqKey) {
        try {
            const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + groqKey
                },
                body: JSON.stringify({
                    model: groqModel,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.7
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (resp.ok) {
                const data = await resp.json();
                const content = data.choices?.[0]?.message?.content;
                if (content && content.trim()) return content.trim();
            }
        } catch (e) {
            console.warn("Groq Tool fail, beralih...", e);
        }
    }

    // 2. Coba Gemini jika aktif (Penalaran Mendalam)
    if (activeProvider === 'gemini' && geminiKey) {
        try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                    generationConfig: { temperature: 0.7 }
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (resp.ok) {
                const data = await resp.json();
                const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content && content.trim()) return content.trim();
            } else if (geminiModel === 'gemini-4-argon') {
                const fb = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: systemPrompt }] },
                        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                        generationConfig: { temperature: 0.7 }
                    }),
                    signal: controller.signal
                });
                if (fb.ok) {
                    const data = await fb.json();
                    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (content && content.trim()) return content.trim();
                }
            }
        } catch (e) {
            console.warn("Gemini Tool fail, beralih...", e);
        }
    }

    // 3. Fallback Pollinations POST
    try {
        const response = await fetch("https://text.pollinations.ai/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const text = await response.text();
            if (text && text.trim().length > 0) return text;
        }
    } catch (e) {
        console.warn("Tool API POST fail, mencoba fallback...", e);
    }

    // Fallback darurat jika ada kendala
    try {
        const seed = Math.floor(Math.random() * 999999);
        const prefix = encodeURIComponent("Jawablah dalam bahasa Indonesia yang sangat rapi dan lengkap: ");
        const url = `https://text.pollinations.ai/${prefix}${encodeURIComponent(userPrompt)}?seed=${seed}`;
        const res = await fetch(url);
        if (res.ok) {
            const text = await res.text();
            if (text && text.trim().length > 0) return text;
        }
    } catch (e) {}

    return "Maaf, koneksi server alat AI sedang padat. Silakan coba klik tombol proses sekali lagi ya!";
}

// Helper untuk menampilkan hasil alat
function renderToolResult(outputContainerId, rawText, extraActionHtml = '') {
    const box = document.getElementById(outputContainerId);
    if (!box) return;

    const cleaned = cleanAIOutput(rawText);
    box.style.display = 'block';
    box.innerHTML = marked.parse(cleaned) + `
        <div class="tool-action-bar">
            <button class="tool-mini-btn" onclick="copyToolResultText(this, '${outputContainerId}')"><i class="fa-regular fa-copy"></i> Salin Hasil</button>
            <button class="tool-mini-btn" onclick="sendToolResultToChat('${outputContainerId}')"><i class="fa-solid fa-paper-plane"></i> Kirim ke Chat</button>
            ${extraActionHtml}
        </div>
    `;
    renderMath(box);
    playSfx('receive');
}

function copyToolResultText(btn, containerId) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const textToCopy = box.innerText.replace('Salin Hasil', '').replace('Kirim ke Chat', '').trim();
    navigator.clipboard.writeText(textToCopy).then(() => {
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin!';
        setTimeout(() => { btn.innerHTML = oldHtml; }, 2000);
    });
}

function sendToolResultToChat(containerId) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const text = box.innerText.replace('Salin Hasil', '').replace('Kirim ke Chat', '').trim();
    closeToolbox();

    const promptInput = document.getElementById('promptInput');
    promptInput.value = text;
    promptInput.focus();
    promptInput.style.height = '24px';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
}

function generateImageFromTool(promptText) {
    closeToolbox();
    const promptInput = document.getElementById('promptInput');
    promptInput.value = `Buat gambar: ${promptText}`;
    sendPrompt();
}

// 1. TOOL PARAPHRASE
async function runParaphraser() {
    const text = document.getElementById('paraInput').value.trim();
    if (!text) {
        alert("Silakan masukkan teks yang ingin diparafrase terlebih dahulu!");
        return;
    }
    const style = document.getElementById('paraStyle').value;
    const btn = document.getElementById('btnRunPara');
    const resultBox = document.getElementById('paraResult');

    btn.disabled = true;
    resultBox.style.display = 'block';
    resultBox.innerHTML = '<span style="color: var(--accent);"><i class="fa-solid fa-bolt fa-spin"></i> Sedang memparafrase teks secara cerdas & natural...</span>';
    playSfx('click');

    const systemPrompt = `Kamu adalah ahli bahasa dan editor tulisan profesional Bahasa Indonesia.
TUGAS: Tulis ulang (parafrase) teks pengguna agar bebas plagiasi, lolos Turnitin, kosa kata bervariasi, dan sangat nyaman dibaca.
GAYA: ${style.toUpperCase()}.
ATURAN: Langsung berikan hasil parafrasenya dalam bahasa Indonesia yang rapi. Jangan tampilkan proses berpikir internal.`;

    const userPrompt = `Tolong parafrase teks berikut ini:\n\n"""\n${text}\n"""`;
    const res = await callToolApi(systemPrompt, userPrompt);
    renderToolResult('paraResult', res);
    btn.disabled = false;
}

// 2. TOOL PPT OUTLINE
async function runPptGenerator() {
    const topic = document.getElementById('pptTopic').value.trim();
    if (!topic) {
        alert("Silakan masukkan topik presentasi!");
        return;
    }
    const slideCount = document.getElementById('pptSlideCount').value;
    const audience = document.getElementById('pptAudience').value;
    const btn = document.getElementById('btnRunPpt');
    const resultBox = document.getElementById('pptResult');

    btn.disabled = true;
    resultBox.style.display = 'block';
    resultBox.innerHTML = '<span style="color: var(--accent);"><i class="fa-solid fa-chart-pie fa-spin"></i> Menyusun struktur slide presentasi elegan...</span>';
    playSfx('click');

    const systemPrompt = `Kamu adalah pakar presentasi dan desain slide profesional (Keynote & PowerPoint).
TUGAS: Buatkan outline presentasi lengkap sebanyak ${slideCount} slide untuk audiens ${audience}.
FORMAT TIAP SLIDE:
- **Slide X: [Judul Slide Menarik]**
  - **Poin Utama:** (Daftar 2-3 poin ringkas dan bernas)
  - **Catatan Pembicara (Speaker Notes):** (Apa yang harus diucapkan pembicara saat slide ini tampil)
ATURAN: Tulis dalam Bahasa Indonesia yang profesional dan siap pakai.`;

    const userPrompt = `Buatkan materi slide presentasi tentang: "${topic}"`;
    const res = await callToolApi(systemPrompt, userPrompt);
    renderToolResult('pptResult', res);
    btn.disabled = false;
}

// 3. TOOL SURAT RESMI
async function runLetterGenerator() {
    const sender = document.getElementById('letterSender').value.trim();
    const recipient = document.getElementById('letterRecipient').value.trim();
    const detail = document.getElementById('letterDetail').value.trim();
    const type = document.getElementById('letterType').value;
    const btn = document.getElementById('btnRunLetter');
    const resultBox = document.getElementById('letterResult');

    btn.disabled = true;
    resultBox.style.display = 'block';
    resultBox.innerHTML = '<span style="color: var(--accent);"><i class="fa-solid fa-envelope-open-text fa-spin"></i> Menyusun surat resmi dengan format baku & santun...</span>';
    playSfx('click');

    const systemPrompt = `Kamu adalah sekretaris eksekutif dan ahli korespondensi surat resmi di Indonesia.
TUGAS: Susunlah surat resmi/formal dengan tata bahasa baku (EYD/PUEBI), sangat santun, berbobot, dan berstruktur lengkap (Tempat & Tanggal, Lampiran/Perihal, Salam Pembuka, Isi Terperinci, Salam Penutup, Nama Terang).
JENIS SURAT: ${type.toUpperCase()}.
PENGIRIM: ${sender || 'Nama Pengirim'}
PENERIMA: ${recipient || 'Instansi Terkait'}
DETAIL/ALASAN: ${detail || 'Keperluan resmi'}`;

    const userPrompt = `Buatkan surat resmi lengkap berdasarkan data di atas.`;
    const res = await callToolApi(systemPrompt, userPrompt);
    renderToolResult('letterResult', res);
    btn.disabled = false;
}

// 4. TOOL QUIZ GENERATOR
async function runQuizGenerator() {
    const input = document.getElementById('quizInput').value.trim();
    if (!input) {
        alert("Silakan masukkan materi atau topik pelajaran untuk kuis!");
        return;
    }
    const count = document.getElementById('quizCount').value;
    const difficulty = document.getElementById('quizDifficulty').value;
    const btn = document.getElementById('btnRunQuiz');
    const resultBox = document.getElementById('quizResult');

    btn.disabled = true;
    resultBox.style.display = 'block';
    resultBox.innerHTML = '<span style="color: var(--accent);"><i class="fa-solid fa-graduation-cap fa-spin"></i> Menyusun soal kuis pilihan ganda + kunci jawaban...</span>';
    playSfx('click');

    const systemPrompt = `Kamu adalah guru dan pembuat soal ujian profesional.
TUGAS: Buat ${count} butir soal pilihan ganda (A, B, C, D) dengan tingkat kesulitan ${difficulty}.
FORMAT PENULISAN:
1. Tulis soal nomor per nomor secara jelas.
2. Di bagian bawah setelah semua soal selesai, buat bagian:
   ### 🔑 KUNCI JAWABAN & PEMBAHASAN
   Berikan kunci jawaban (A/B/C/D) dan alasan penjelasan logisnya.
ATURAN: Gunakan Bahasa Indonesia yang baik dan tepat.`;

    const userPrompt = `Materi Kuis:\n"""\n${input}\n"""`;
    const res = await callToolApi(systemPrompt, userPrompt);
    renderToolResult('quizResult', res);
    btn.disabled = false;
}

// 5. TOOL PROMPT CRAFTER
async function runPromptCrafter() {
    const idea = document.getElementById('promptIdea').value.trim();
    if (!idea) {
        alert("Silakan ketik ide gambar terlebih dahulu!");
        return;
    }
    const style = document.getElementById('promptStyle').value;
    const btn = document.getElementById('btnRunPrompt');
    const resultBox = document.getElementById('promptResult');

    btn.disabled = true;
    resultBox.style.display = 'block';
    resultBox.innerHTML = '<span style="color: var(--accent);"><i class="fa-solid fa-wand-magic-sparkles fa-spin"></i> Meracik prompt visual sinematik kualitas 8K...</span>';
    playSfx('click');

    const systemPrompt = `You are a master AI image prompter (Midjourney v6, Stable Diffusion XL, DALL-E 3).
TASK: Convert the user's idea into an ultra-detailed, high-impact English image prompt.
STYLE TARGET: ${style.toUpperCase()}.
INCLUDE: Subject details, lighting (cinematic, volumetric), camera angle, render style (photorealistic, 8k, Unreal Engine 5, Octane render), color grading.
OUTPUT FORMAT:
Provide:
1. The English master prompt inside a code block.
2. A short Indonesian explanation of what visual elements were added.`;

    const userPrompt = `Idea: "${idea}"`;
    const res = await callToolApi(systemPrompt, userPrompt);

    // Ekstrak prompt bahasa Inggris untuk tombol 'Buat Gambar Langsung'
    const codeMatch = res.match(/```(?:text)?\s*([\s\S]*?)```/);
    const extractedPrompt = codeMatch ? codeMatch[1].trim() : idea;
    const safeEscaped = extractedPrompt.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    const extraBtn = `<button class="tool-mini-btn primary" onclick="generateImageFromTool('${safeEscaped}')"><i class="fa-solid fa-image"></i> 🚀 Buat Gambar Langsung</button>`;
    renderToolResult('promptResult', res, extraBtn);
    btn.disabled = false;
}

// 6. TOOL CODE FIXER
async function runCodeFixer() {
    const code = document.getElementById('codeInput').value.trim();
    if (!code) {
        alert("Silakan tempel kode koding yang ingin diperiksa!");
        return;
    }
    const lang = document.getElementById('codeLang').value;
    const errorMsg = document.getElementById('codeErrorMsg').value.trim();
    const btn = document.getElementById('btnRunCode');
    const resultBox = document.getElementById('codeResult');

    btn.disabled = true;
    resultBox.style.display = 'block';
    resultBox.innerHTML = '<span style="color: var(--accent);"><i class="fa-solid fa-bug fa-spin"></i> Menganalisis error sintaks & logika kode...</span>';
    playSfx('click');

    const systemPrompt = `Kamu adalah Senior Software Engineer dan Debugging Specialist.
TUGAS: Analisis kode pengguna, temukan bug/error sintaks/logika, dan berikan kode yang sudah diperbaiki 100%.
FORMAT JAWABAN:
1. **🔍 Penyebab Error & Masalah:** (Penjelasan singkat dan jelas dalam bahasa Indonesia)
2. **✅ Kode yang Sudah Diperbaiki:** (Tampilkan kode lengkap di dalam codeblock markdown dengan penanda komentar penjelasan)
3. **💡 Saran Optimasi:** (Tips singkat agar kode lebih aman dan cepat)
BAHASA: ${lang.toUpperCase()}`;

    const userPrompt = `Kode Bermasalah:\n\`\`\`\n${code}\n\`\`\`\n\nPesan Error (jika ada): ${errorMsg || 'Tidak ada pesan error spesifik'}`;
    const res = await callToolApi(systemPrompt, userPrompt);
    renderToolResult('codeResult', res);
    btn.disabled = false;
}

// ==========================================
// 1. MANAJEMEN SESI & RIWAYAT OBROLAN (CHATGPT STYLE)
// ==========================================

function loadSessionsFromStorage() {
    try {
        const saved = localStorage.getItem('rey_chat_sessions');
        if (saved) {
            chatSessions = JSON.parse(saved);
        }
    } catch (e) {
        chatSessions = {};
    }

    const sessionKeys = Object.keys(chatSessions);
    const savedActiveId = localStorage.getItem('rey_active_session_id');

    if (savedActiveId && chatSessions[savedActiveId]) {
        activeSessionId = savedActiveId;
    } else if (sessionKeys.length > 0) {
        sessionKeys.sort((a, b) => (chatSessions[b].updatedAt || 0) - (chatSessions[a].updatedAt || 0));
        activeSessionId = sessionKeys[0];
    } else {
        createNewChatSession(false);
    }

    renderSessionList();
    renderCurrentSessionMessages();
}

function saveSessionsToStorage() {
    try {
        localStorage.setItem('rey_chat_sessions', JSON.stringify(chatSessions));
        if (activeSessionId) {
            localStorage.setItem('rey_active_session_id', activeSessionId);
        }
    } catch (e) {
        console.warn('Gagal menyimpan sesi:', e);
    }
}

function createNewChatSession(shouldRender = true) {
    const newId = 'session_' + Date.now();
    chatSessions[newId] = {
        id: newId,
        title: 'Obrolan Baru',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    activeSessionId = newId;

    if (shouldRender) {
        saveSessionsToStorage();
        renderSessionList();
        renderCurrentSessionMessages();
        closeSidebar();
        playSfx('click');
        const promptInput = document.getElementById('promptInput');
        if (promptInput) promptInput.focus();
    }
}

function switchSession(sessionId) {
    if (chatSessions[sessionId]) {
        activeSessionId = sessionId;
        saveSessionsToStorage();
        renderSessionList();
        renderCurrentSessionMessages();
        closeSidebar();
        playSfx('click');
    }
}

function deleteSession(sessionId, event) {
    if (event) event.stopPropagation();
    if (!confirm("Hapus obrolan ini dari riwayat?")) return;

    delete chatSessions[sessionId];
    const keys = Object.keys(chatSessions);

    if (activeSessionId === sessionId) {
        if (keys.length > 0) {
            keys.sort((a, b) => (chatSessions[b].updatedAt || 0) - (chatSessions[a].updatedAt || 0));
            activeSessionId = keys[0];
        } else {
            createNewChatSession(false);
        }
    }

    saveSessionsToStorage();
    renderSessionList();
    renderCurrentSessionMessages();
    playSfx('click');
}

function clearAllSessions() {
    if (!confirm("Apakah Anda yakin ingin menghapus seluruh riwayat obrolan?")) return;
    chatSessions = {};
    createNewChatSession(false);
    saveSessionsToStorage();
    renderSessionList();
    renderCurrentSessionMessages();
    playSfx('click');
}

function toggleSidebar() {
    const sidebar = document.getElementById('chatSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;
    
    const isOpen = sidebar.classList.contains('active');
    if (isOpen) {
        sidebar.classList.remove('active');
        backdrop.classList.remove('active');
    } else {
        sidebar.classList.add('active');
        backdrop.classList.add('active');
    }
    playSfx('click');
}

function closeSidebar() {
    const sidebar = document.getElementById('chatSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
}

function renderSessionList() {
    const listContainer = document.getElementById('sessionList');
    if (!listContainer) return;

    const sessionKeys = Object.keys(chatSessions);
    if (sessionKeys.length === 0) {
        listContainer.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 12px;">Belum ada riwayat obrolan</div>`;
        return;
    }

    sessionKeys.sort((a, b) => (chatSessions[b].updatedAt || 0) - (chatSessions[a].updatedAt || 0));

    let html = '';
    for (const id of sessionKeys) {
        const s = chatSessions[id];
        const isActive = id === activeSessionId ? 'active' : '';
        const title = escapeHtml(s.title || 'Obrolan Baru');
        html += `
            <div class="session-item ${isActive}" onclick="switchSession('${id}')">
                <i class="fa-regular fa-message session-icon"></i>
                <span class="session-title">${title}</span>
                <button class="session-delete-btn" onclick="deleteSession('${id}', event)" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
    }
    listContainer.innerHTML = html;
}

function renderCurrentSessionMessages() {
    const chatHistory = document.getElementById('chatHistory');
    const titleElem = document.getElementById('headerChatTitle');
    if (!chatHistory) return;

    const curr = chatSessions[activeSessionId];
    if (titleElem) {
        titleElem.innerText = curr && curr.title ? curr.title : 'Rey Multi AI Hub';
    }

    if (!curr || !curr.messages || curr.messages.length === 0) {
        chatHistory.innerHTML = `
            <div class="chat-bubble ai">
                <div class="avatar"><i class="fa-solid fa-bolt"></i></div>
                <div class="bubble-content">
                    <strong>Rey Multi AI Hub Turbo ⚡</strong><br>
                    Akses berbagai AI terbaik dunia: <strong>ChatGPT, DeepSeek R1, Claude, Gemini, Qwen Coder, Llama</strong>. Silakan tanyakan apa saja atau unggah foto/PDF untuk pemindaian instan!
                </div>
            </div>`;
        return;
    }

    let html = '';
    for (const m of curr.messages) {
        if (m.role === 'user') {
            html += `
                <div class="chat-bubble user">
                    <div class="avatar"><i class="fa-solid fa-user"></i></div>
                    <div class="bubble-content">${m.content}</div>
                </div>`;
        } else {
            const parsed = marked.parse(m.content);
            html += `
                <div class="chat-bubble ${isVipUser ? 'ai vip' : 'ai'}">
                    <div class="avatar"><i class="fa-solid fa-robot"></i></div>
                    <div class="bubble-content">${parsed}${getActionButtonsHTML()}</div>
                </div>`;
        }
    }

    chatHistory.innerHTML = html;
    renderMath(chatHistory);
    enhanceCodeBlocks(chatHistory);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// ==========================================
// 2. LIVE CODE PREVIEW & ARTIFACTS RUNNER
// ==========================================

function enhanceCodeBlocks(container) {
    if (!container) return;
    const preBlocks = container.querySelectorAll('pre');
    preBlocks.forEach(pre => {
        if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) return;

        const code = pre.querySelector('code');
        let lang = 'code';
        if (code) {
            const classList = Array.from(code.classList);
            for (const cls of classList) {
                if (cls.startsWith('language-')) {
                    lang = cls.replace('language-', '').toLowerCase();
                    break;
                }
            }
        }

        const isRunnable = ['html', 'htm', 'javascript', 'js', 'css', 'svg', 'xml'].includes(lang);

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        const header = document.createElement('div');
        header.className = 'code-block-header';

        let runBtnHtml = '';
        if (isRunnable) {
            runBtnHtml = `<button class="code-action-btn code-run-btn" onclick="openLivePreviewFromCode(this)" title="Jalankan & Pratinjau Kode"><i class="fa-solid fa-play"></i> Pratinjau</button>`;
        }

        header.innerHTML = `
            <div class="code-lang-label"><i class="fa-solid fa-code"></i> ${escapeHtml(lang.toUpperCase())}</div>
            <div class="code-header-actions">
                ${runBtnHtml}
                <button class="code-action-btn" onclick="copyCodeBlockText(this)"><i class="fa-regular fa-copy"></i> Salin</button>
            </div>
        `;

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });
}

function copyCodeBlockText(btn) {
    const wrapper = btn.closest('.code-block-wrapper');
    if (!wrapper) return;
    const codeElem = wrapper.querySelector('pre code') || wrapper.querySelector('pre');
    if (!codeElem) return;

    navigator.clipboard.writeText(codeElem.innerText).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin!';
        playSfx('click');
        setTimeout(() => {
            btn.innerHTML = originalHtml;
        }, 2000);
    });
}

function openLivePreviewFromCode(btn) {
    const wrapper = btn.closest('.code-block-wrapper');
    if (!wrapper) return;
    const codeElem = wrapper.querySelector('pre code') || wrapper.querySelector('pre');
    if (!codeElem) return;
    openLivePreviewWithContent(codeElem.innerText);
}

function openLivePreviewWithContent(rawCode) {
    currentPreviewCode = rawCode;
    const modal = document.getElementById('codePreviewModal');
    const iframe = document.getElementById('previewIframe');
    if (!modal || !iframe) return;

    let finalHtml = rawCode;
    const lower = rawCode.toLowerCase();
    if (!lower.includes('<!doctype') && !lower.includes('<html')) {
        finalHtml = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview - Rey AI Hub</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        body { margin: 0; padding: 16px; background-color: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    </style>
</head>
<body>
    ${rawCode}
</body>
</html>`;
    }

    iframe.srcdoc = finalHtml;
    modal.style.display = 'flex';
    playSfx('click');
}

function closeCodePreview() {
    const modal = document.getElementById('codePreviewModal');
    const iframe = document.getElementById('previewIframe');
    if (modal) modal.style.display = 'none';
    if (iframe) iframe.srcdoc = '';
    playSfx('click');
}

function refreshCodePreview() {
    if (currentPreviewCode) {
        openLivePreviewWithContent(currentPreviewCode);
    }
}

function openPreviewNewTab() {
    const iframe = document.getElementById('previewIframe');
    const content = iframe && iframe.srcdoc ? iframe.srcdoc : currentPreviewCode;
    if (!content) return;
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

// ==========================================
// 3. PENGATURAN MESIN AI & PROFIL KUSTOM (BYOK)
// ==========================================

function openCustomSettings(initialTab = 'apikey') {
    const modal = document.getElementById('customSettingsModal');
    if (!modal) return;

    // Muat nilai profil
    const nameInput = document.getElementById('customUserName');
    const roleInput = document.getElementById('customUserRole');
    const rulesInput = document.getElementById('customUserRules');
    if (nameInput) nameInput.value = localStorage.getItem('rey_user_name') || '';
    if (roleInput) roleInput.value = localStorage.getItem('rey_user_role') || '';
    if (rulesInput) rulesInput.value = localStorage.getItem('rey_user_rules') || '';

    // Muat nilai API Engine
    const providerSelect = document.getElementById('apiProviderSelect');
    const groqKeyInput = document.getElementById('groqApiKeyInput');
    const geminiKeyInput = document.getElementById('geminiApiKeyInput');
    const cohereKeyInput = document.getElementById('cohereApiKeyInput');
    const groqModelSelect = document.getElementById('groqModelSelect');
    const geminiModelSelect = document.getElementById('geminiModelSelect');
    const cohereModelSelect = document.getElementById('cohereModelSelect');

    const savedProvider = localStorage.getItem('rey_api_provider') || 'groq';
    if (providerSelect) providerSelect.value = savedProvider;
    if (groqKeyInput) groqKeyInput.value = localStorage.getItem('rey_groq_key') || DEFAULT_GROQ_KEY;
    if (geminiKeyInput) geminiKeyInput.value = localStorage.getItem('rey_gemini_key') || DEFAULT_GEMINI_KEY;
    if (cohereKeyInput) cohereKeyInput.value = localStorage.getItem('rey_cohere_key') || DEFAULT_COHERE_KEY;
    if (groqModelSelect) groqModelSelect.value = localStorage.getItem('rey_groq_model') || 'openai/gpt-oss-120b';
    if (geminiModelSelect) geminiModelSelect.value = localStorage.getItem('rey_gemini_model') || 'gemini-flash-latest';
    if (cohereModelSelect) cohereModelSelect.value = localStorage.getItem('rey_cohere_model') || 'command-r-08-2024';

    onApiProviderChanged();
    switchSettingsTab(initialTab);
    updateEngineStatusUI();

    modal.style.display = 'flex';
    playSfx('click');
}

function closeCustomSettings() {
    const modal = document.getElementById('customSettingsModal');
    if (modal) modal.style.display = 'none';
    playSfx('click');
}

function switchSettingsTab(tabName) {
    const tabApi = document.getElementById('settingsTabApiKey');
    const tabProfile = document.getElementById('settingsTabProfile');
    const contentApi = document.getElementById('settings-tab-apikey');
    const contentProfile = document.getElementById('settings-tab-profile');
    const title = document.getElementById('customSettingsTitle');

    if (tabName === 'apikey') {
        if (tabApi) tabApi.classList.add('active');
        if (tabProfile) tabProfile.classList.remove('active');
        if (contentApi) { contentApi.style.display = 'flex'; contentApi.classList.add('active'); }
        if (contentProfile) { contentProfile.style.display = 'none'; contentProfile.classList.remove('active'); }
        if (title) title.innerText = "Pengaturan Mesin AI & API Key";
    } else {
        if (tabProfile) tabProfile.classList.add('active');
        if (tabApi) tabApi.classList.remove('active');
        if (contentProfile) { contentProfile.style.display = 'flex'; contentProfile.classList.add('active'); }
        if (contentApi) { contentApi.style.display = 'none'; contentApi.classList.remove('active'); }
        if (title) title.innerText = "Kustomisasi & Profil Pengguna";
    }
    playSfx('click');
}

function onApiProviderChanged() {
    const val = document.getElementById('apiProviderSelect')?.value || 'groq';
    const groqArea = document.getElementById('groqFormArea');
    const geminiArea = document.getElementById('geminiFormArea');
    const cohereArea = document.getElementById('cohereFormArea');
    const defaultArea = document.getElementById('defaultFormArea');

    if (groqArea) groqArea.style.display = val === 'groq' ? 'block' : 'none';
    if (geminiArea) geminiArea.style.display = val === 'gemini' ? 'block' : 'none';
    if (cohereArea) cohereArea.style.display = val === 'cohere' ? 'block' : 'none';
    if (defaultArea) defaultArea.style.display = val === 'default' ? 'block' : 'none';
}

function toggleKeyVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
}

function applyDefaultGroqKey() {
    const input = document.getElementById('groqApiKeyInput');
    if (input) {
        input.value = DEFAULT_GROQ_KEY;
        playSfx('receive');
        showKeyFeedback('groqTestFeedback', '✅ Kunci Groq Rey berhasil dipasang! Klik tombol "Simpan" di bawah.', 'success');
    }
}

function applyDefaultGeminiKey() {
    const input = document.getElementById('geminiApiKeyInput');
    if (input) {
        input.value = DEFAULT_GEMINI_KEY;
        playSfx('receive');
        showKeyFeedback('geminiTestFeedback', '✅ Kunci Gemini Rey berhasil dipasang! Klik tombol "Simpan" di bawah.', 'success');
    }
}

function applyDefaultCohereKey() {
    const input = document.getElementById('cohereApiKeyInput');
    if (input) {
        input.value = DEFAULT_COHERE_KEY;
        playSfx('receive');
        showKeyFeedback('cohereTestFeedback', '✅ Kunci Cohere Rey berhasil dipasang! Klik tombol "Simpan" di bawah.', 'success');
    }
}

function showKeyFeedback(elemId, msg, type = 'success') {
    const box = document.getElementById(elemId);
    if (!box) return;
    box.style.display = 'block';
    box.className = `test-feedback-box ${type}`;
    box.innerHTML = msg;
}

async function testGroqConnection() {
    const key = (document.getElementById('groqApiKeyInput')?.value || '').trim();
    const model = document.getElementById('groqModelSelect')?.value || 'openai/gpt-oss-120b';
    const btn = document.getElementById('btnTestGroq');
    if (!key) {
        showKeyFeedback('groqTestFeedback', '⚠️ Mohon masukkan API Key Groq terlebih dahulu.', 'error');
        return;
    }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menguji...'; }
    showKeyFeedback('groqTestFeedback', '⚡ Menghubungkan ke server Groq Cloud...', 'loading');
    const start = Date.now();
    try {
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + key
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: "ping" }],
                max_tokens: 5
            })
        });
        const duration = Date.now() - start;
        if (resp.ok) {
            playSfx('receive');
            showKeyFeedback('groqTestFeedback', `✅ <strong>Koneksi Sukses!</strong> Respon super kilat dalam <strong>${duration}ms</strong> (~${(duration/1000).toFixed(2)} detik) via <code>${model}</code>.`, 'success');
        } else {
            const err = await resp.json().catch(() => ({}));
            showKeyFeedback('groqTestFeedback', `❌ Gagal (${resp.status}): ${err?.error?.message || 'Kunci tidak valid atau limit tercapai.'}`, 'error');
        }
    } catch (e) {
        showKeyFeedback('groqTestFeedback', `❌ Error koneksi: ${e.message}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plug-circle-check"></i> Tes Koneksi Groq'; }
    }
}

async function testGeminiConnection() {
    const key = (document.getElementById('geminiApiKeyInput')?.value || '').trim();
    const model = document.getElementById('geminiModelSelect')?.value || 'gemini-flash-latest';
    const btn = document.getElementById('btnTestGemini');
    if (!key) {
        showKeyFeedback('geminiTestFeedback', '⚠️ Mohon masukkan API Key Gemini terlebih dahulu.', 'error');
        return;
    }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menguji...'; }
    showKeyFeedback('geminiTestFeedback', '✨ Menghubungkan ke Google Gemini AI...', 'loading');
    const start = Date.now();
    try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "ping" }] }]
            })
        });
        const duration = Date.now() - start;
        if (resp.ok) {
            playSfx('receive');
            const isArgon = model === 'gemini-4-argon';
            const extra = isArgon ? ' (Flagship 4 Argon Aktif! 🧬)' : '';
            showKeyFeedback('geminiTestFeedback', `✅ <strong>Koneksi Sukses!</strong> Terhubung ke Google Gemini dalam <strong>${duration}ms</strong> via <code>${model}</code>${extra}.`, 'success');
        } else {
            const err = await resp.json().catch(() => ({}));
            if (model === 'gemini-4-argon' && resp.status === 429) {
                showKeyFeedback('geminiTestFeedback', `ℹ️ <strong>Model Gemini 4 Argon terdaftar aktif!</strong> Namun model ini adalah flagship berbayar yang memerlukan billing di Google AI Studio (kuota gratis 0). Sistem Rey AI akan otomatis mengalihkan permintaan ke <code>gemini-flash-latest</code> jika kuota 4 Argon habis.`, 'success');
            } else {
                showKeyFeedback('geminiTestFeedback', `❌ Gagal (${resp.status}): ${err?.error?.message || 'Kunci Gemini tidak valid.'}`, 'error');
            }
        }
    } catch (e) {
        showKeyFeedback('geminiTestFeedback', `❌ Error koneksi: ${e.message}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plug-circle-check"></i> Tes Koneksi Gemini'; }
    }
}

async function testCohereConnection() {
    const key = (document.getElementById('cohereApiKeyInput')?.value || '').trim();
    const model = document.getElementById('cohereModelSelect')?.value || 'command-r-08-2024';
    const btn = document.getElementById('btnTestCohere');
    if (!key) {
        showKeyFeedback('cohereTestFeedback', '⚠️ Mohon masukkan API Key Cohere terlebih dahulu.', 'error');
        return;
    }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menguji...'; }
    showKeyFeedback('cohereTestFeedback', '🔮 Menghubungkan ke server Cohere AI...', 'loading');
    const start = Date.now();
    try {
        const resp = await fetch("https://api.cohere.com/v1/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + key
            },
            body: JSON.stringify({
                model: model,
                message: "ping",
                temperature: 0.3
            })
        });
        const duration = Date.now() - start;
        if (resp.ok) {
            playSfx('receive');
            const data = await resp.json().catch(() => ({}));
            const answer = data.text ? data.text.trim().substring(0, 60) : 'Koneksi sukses';
            showKeyFeedback('cohereTestFeedback', `✅ <strong>Koneksi Sukses!</strong> Terhubung ke Cohere dalam <strong>${duration}ms</strong> via <code>${model}</code>.<br><small style="color: #94a3b8;">Respon: "${answer}..."</small>`, 'success');
        } else {
            const err = await resp.json().catch(() => ({}));
            showKeyFeedback('cohereTestFeedback', `❌ Gagal (${resp.status}): ${err?.message || 'Kunci Cohere tidak valid.'}`, 'error');
        }
    } catch (e) {
        showKeyFeedback('cohereTestFeedback', `❌ Error koneksi: ${e.message}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plug-circle-check"></i> Tes Koneksi Cohere'; }
    }
}

function saveApiSettings() {
    const provider = document.getElementById('apiProviderSelect')?.value || 'groq';
    const groqKey = (document.getElementById('groqApiKeyInput')?.value || '').trim();
    const geminiKey = (document.getElementById('geminiApiKeyInput')?.value || '').trim();
    const cohereKey = (document.getElementById('cohereApiKeyInput')?.value || '').trim();
    const groqModel = document.getElementById('groqModelSelect')?.value || 'openai/gpt-oss-120b';
    const geminiModel = document.getElementById('geminiModelSelect')?.value || 'gemini-flash-latest';
    const cohereModel = document.getElementById('cohereModelSelect')?.value || 'command-r-08-2024';

    localStorage.setItem('rey_api_provider', provider);
    localStorage.setItem('rey_groq_key', groqKey);
    localStorage.setItem('rey_gemini_key', geminiKey);
    localStorage.setItem('rey_cohere_key', cohereKey);
    localStorage.setItem('rey_groq_model', groqModel);
    localStorage.setItem('rey_gemini_model', geminiModel);
    localStorage.setItem('rey_cohere_model', cohereModel);

    updateEngineStatusUI();
    playSfx('receive');
    alert(`Konfigurasi Mesin AI berhasil disimpan!\nMesin Aktif: ${provider.toUpperCase()}`);
    closeCustomSettings();
}

function updateEngineStatusUI() {
    const provider = localStorage.getItem('rey_api_provider') || 'groq';
    const groqKey = localStorage.getItem('rey_groq_key') || DEFAULT_GROQ_KEY;
    const geminiKey = localStorage.getItem('rey_gemini_key') || DEFAULT_GEMINI_KEY;
    const cohereKey = localStorage.getItem('rey_cohere_key') || DEFAULT_COHERE_KEY;
    const groqModel = localStorage.getItem('rey_groq_model') || 'openai/gpt-oss-120b';
    const geminiModel = localStorage.getItem('rey_gemini_model') || 'gemini-flash-latest';
    const cohereModel = localStorage.getItem('rey_cohere_model') || 'command-r-08-2024';

    const statusTag = document.getElementById('userStatusTag');
    const banner = document.getElementById('engineStatusBanner');
    const bannerText = document.getElementById('engineStatusText');

    let label = "© Rey472 • ⚡ Groq Turbo (0.5s)";
    let bannerDesc = `Mesin Aktif: ⚡ Groq Cloud (${groqModel}) - Ultra Cepat ~0.5s`;
    let bannerClass = "engine-status-banner engine-groq";

    if (provider === 'gemini') {
        const isArgon = geminiModel === 'gemini-4-argon';
        label = isArgon ? `© Rey472 • 🧬 Gemini 4 Argon` : `© Rey472 • ✨ Gemini Flash`;
        bannerDesc = isArgon 
            ? `Mesin Aktif: 🧬 Google Gemini (gemini-4-argon) - Flagship Deep Reasoning & 1M Context`
            : `Mesin Aktif: ✨ Google Gemini (${geminiModel}) - Penalaran & Vision`;
        bannerClass = "engine-status-banner engine-gemini";
    } else if (provider === 'cohere') {
        label = `© Rey472 • 🔮 Cohere Command R`;
        bannerDesc = `Mesin Aktif: 🔮 Cohere Cloud (${cohereModel}) - Flagship Peringkasan & Penalaran Cerdas`;
        bannerClass = "engine-status-banner engine-cohere";
    } else if (provider === 'default' || (!groqKey && !geminiKey && !cohereKey)) {
        label = `© Rey472 • 🌐 Multi AI Bebas`;
        bannerDesc = `Mesin Aktif: 🌐 Bebas (Pollinations Hub - Gratis)`;
        bannerClass = "engine-status-banner engine-default";
    }

    if (statusTag) statusTag.innerText = label;
    if (banner) banner.className = bannerClass;
    if (bannerText) bannerText.innerHTML = bannerDesc;
}

function initEngineConfig() {
    if (!localStorage.getItem('rey_api_provider')) {
        localStorage.setItem('rey_api_provider', 'groq');
        localStorage.setItem('rey_groq_key', DEFAULT_GROQ_KEY);
        localStorage.setItem('rey_gemini_key', DEFAULT_GEMINI_KEY);
        localStorage.setItem('rey_cohere_key', DEFAULT_COHERE_KEY);
        localStorage.setItem('rey_groq_model', 'openai/gpt-oss-120b');
        localStorage.setItem('rey_gemini_model', 'gemini-flash-latest');
        localStorage.setItem('rey_cohere_model', 'command-r-08-2024');
    }
    if (!localStorage.getItem('rey_cohere_key')) {
        localStorage.setItem('rey_cohere_key', DEFAULT_COHERE_KEY);
        localStorage.setItem('rey_cohere_model', 'command-r-08-2024');
    }
    updateEngineStatusUI();
}

function saveCustomSettings() {
    const name = (document.getElementById('customUserName')?.value || '').trim();
    const role = (document.getElementById('customUserRole')?.value || '').trim();
    const rules = (document.getElementById('customUserRules')?.value || '').trim();

    localStorage.setItem('rey_user_name', name);
    localStorage.setItem('rey_user_role', role);
    localStorage.setItem('rey_user_rules', rules);

    playSfx('receive');
    alert("Preferensi profil & aturan kustom AI berhasil disimpan! AI akan menyesuaikan gaya jawaban dengan profil Anda.");
    closeCustomSettings();
}


