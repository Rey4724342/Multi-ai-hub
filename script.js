const correctKey = "adminrey472";
let isVipUser = false;
let attachedFileContent = null;
let attachedFileName = "";
let extractedImageText = "";
let isImageGenMode = false;
let isProcessingOCR = false;
let tesseractWorker = null;

// VARIABEL FITUR BARU (PWA, SUARA, VOICE, PERSONA)
let isSfxEnabled = localStorage.getItem('rey_sfx') !== 'false';
let speechRecognizer = null;
let isVoiceRecording = false;
let pwaDeferredPrompt = null;
let currentPersona = 'standard';
let audioCtx = null;

// REGISTRASI SERVICE WORKER UNTUK PWA (INSTALL HP)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW fail:', err));
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

    if (file.type.startsWith('image/')) {
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = true;
        isProcessingOCR = true;
        showAttachmentPreview(`⚡ <i class="fa-solid fa-bolt fa-spin"></i> Menyiapkan pemindai kilat...`);
        
        reader.onload = async function(e) {
            const compressedBase64 = await quickCompressImage(e.target.result);
            attachedFileContent = { type: 'image', data: e.target.result };
            
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
    document.getElementById('chatHistory').innerHTML = `
        <div class="chat-bubble ai">
            <div class="avatar"><i class="fa-solid fa-bolt"></i></div>
            <div class="bubble-content"><strong>Rey Multi AI Hub</strong><br>Riwayat obrolan telah dibersihkan.</div>
        </div>`;
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
    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/Thinking Process:[\s\S]*?(?=\n\n|$)/gi, '')
        .replace(/User:\s*"[^"]*"\s*Indonesian\.?\s*Response:?\s*/gi, '')
        .trim();
}

// MESIN KETIK KILAT TURBO (SUPER FAST TYPEWRITER ENGINE - RAPI & TANPA LAG)
function playTurboTypewriter(fullText, targetContainer, chatHistory, callback) {
    const cleanedText = cleanAIOutput(fullText);
    let cursor = 0;
    const total = cleanedText.length;
    // Lompatan karakter adaptif: selesai kilat dalam 0.6 - 0.8 detik
    const step = Math.max(12, Math.ceil(total / 24));
    
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
    }, 12); // Render super cepat 60 FPS
}

// MESIN STREAMING & RESPON KILAT REAL-TIME (TULISAN RAPI & BERSIH)
async function streamAIResponse(promptText, selectedModel, targetContainer) {
    const chatHistory = document.getElementById('chatHistory');
    let fullPrompt = promptText;
    
    // Format prompt rapi jika pengguna mengirim foto
    if (attachedFileContent && attachedFileContent.type === 'image') {
        if (extractedImageText) {
            fullPrompt = `Teks hasil pemindaian foto/kamera:\n"""\n${extractedImageText}\n"""\n\nPerintah Pengguna: ${promptText || 'Tolong jawab, selesaikan, atau jelaskan isi teks/soal pada foto tersebut secara lengkap dan tepat dalam bahasa Indonesia.'}`;
        } else {
            fullPrompt = `Pengguna mengunggah gambar. Pertanyaan: ${promptText || 'Tolong jelaskan isi gambar ini.'}`;
        }
    }

    // BANGUN SYSTEM PROMPT DINAMIS BERDASARKAN PERSONA GAYA BICARA
    let personaInstruction = "";
    if (currentPersona === 'gaul') {
        personaInstruction = `GAYA BICARA GAUL & SANTAI:
- Gunakan bahasa santai dan gaul khas anak muda Indonesia (lo-gue, asik, humoris, tidak kaku).
- Tetap berikan informasi yang akurat, tepat, dan solutif.`;
    } else if (currentPersona === 'formal') {
        personaInstruction = `GAYA BICARA FORMAL & AKADEMIK:
- Gunakan Bahasa Indonesia baku (EYD), sangat profesional, ilmiah, dan sopan.
- Cocok untuk menyusun skripsi, karya ilmiah, makalah, dan laporan resmi berbobot tinggi.`;
    } else if (currentPersona === 'tutor') {
        personaInstruction = `GAYA BICARA GURU / TUTOR PR & MATEMATIKA:
- Kamu adalah guru privat terbaik yang sabar dan detail dalam mengajar.
- Untuk soal matematika, fisika, dan kimia: WAJIB tulis rumus lengkap dalam format KaTeX ($ ... $ atau $$ ... $$) dan jabarkan langkah pengerjaannya nomor per nomor hingga hasil akhir.`;
    } else if (currentPersona === 'curhat') {
        personaInstruction = `GAYA BICARA SAHABAT CURHAT:
- Bersikaplah sangat hangat, empati, ramah, dan menjadi pendengar yang menenangkan.
- Berikan motivasi, saran positif, dan dukungan emosional tanpa menghakimi.`;
    } else {
        personaInstruction = `GAYA BICARA STANDAR:
- Berikan jawaban yang cerdas, teliti, terstruktur rapi, dan mudah dipahami pengguna.`;
    }

    const systemPrompt = `Kamu adalah asisten AI resmi dari Rey Multi AI Hub (karya Rey472).
${personaInstruction}

PEDOMAN FORMAT PENULISAN WAJIB (RAPI, ELEGAN & PRESISI):
1. SUSUNAN RAPI & STRUKTUR INDAH: Tulis jawaban dengan paragraf rapi dan pemisah baris yang cukup. Gunakan penomoran (1, 2, 3) atau daftar poin (-) jika menjabarkan informasi panjang.
2. LANGSUNG KE INTI JAWABAN: Jangan pernah menuliskan proses berpikir internal (seperti "Thinking Process:", "User:", "Response:", atau tag <think>). Berikan langsung jawaban yang bersih dan tuntas.
3. AKURASI 100% TANPA KESALAHAN: Fakta, nama, tanggal, dan rumus matematika harus 100% presisi dan terverifikasi.
4. SOAL & MATEMATIKA: Tulis rumus dan langkah penyelesaian secara runtut dan teratur hingga hasil akhir.
5. BAHASA INDONESIA YANG BAIK: Gunakan Bahasa Indonesia yang nyaman dibaca.`;

    targetContainer.innerHTML = `<div class="live-stream-box" style="white-space: pre-wrap; font-family: inherit; line-height: 1.65;"><span style="color: var(--accent);"><i class="fa-solid fa-bolt fa-fade"></i> Membaca dan menyiapkan jawaban...</span></div>`;
    const streamBox = targetContainer.querySelector('.live-stream-box');

    // Batas waktu timeout 8.5 detik agar koneksi HP tetap lancar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    let accumulatedText = "";

    try {
        const response = await fetch("https://text.pollinations.ai/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: selectedModel || 'openai',
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: fullPrompt }
                ],
                temperature: 0.2, // Nilai rendah (0.2) agar fokus pada fakta presisi & tidak melantur
                stream: true
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let renderPending = false;
            let hasFirstToken = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (let line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                        try {
                            const parsed = JSON.parse(trimmed.replace('data: ', ''));
                            // HANYA ambil content resmi, abaikan internal reasoning agar teks tidak kotor
                            const content = parsed.choices?.[0]?.delta?.content || "";
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
                playSfx('receive');
                if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
                return;
            }
        }
    } catch (e) {
        console.log("Beralih ke mesin turbo kilat fallback...", e);
    }

    // JALUR KILAT TURBO ENGINE (JIKA STREAMING TERPUTUS)
    try {
        const randomSeed = Math.floor(Math.random() * 999999);
        const indoPrefix = encodeURIComponent("Jawablah dengan rapi, jelas, dan tepat dalam bahasa Indonesia: ");
        const fallbackUrl = `https://text.pollinations.ai/${indoPrefix}${encodeURIComponent(fullPrompt)}?model=${selectedModel || 'openai'}&seed=${randomSeed}`;
        
        const fallbackRes = await fetch(fallbackUrl);
        if (fallbackRes.ok) {
            const text = await fallbackRes.text();
            if (text && text.trim().length > 0) {
                playTurboTypewriter(text, targetContainer, chatHistory);
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
        displayUserMessage = `<img src="${attachedFileContent.data}" style="max-width: 180px; display: block; border-radius: 8px; margin-bottom: 6px;" /><br>` + (displayUserMessage || 'Artikan teks');
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
    } else {
        await streamAIResponse(userPrompt, model, targetContainer);
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
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
