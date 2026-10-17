const correctKey = "adminrey472";
let isVipUser = false;
let attachedFileContent = null;
let attachedFileName = "";
let extractedImageText = "";
let isImageGenMode = false;
let isProcessingOCR = false;
let tesseractWorker = null;

// INISIALISASI AWAL
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('lockSection').style.display = 'flex';
    document.getElementById('mainSection').style.display = 'none';

    const keyInput = document.getElementById('keyInput');
    if (keyInput) {
        keyInput.focus();
        keyInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    }
    setupAppListeners();

    // Inisialisasi Tesseract OCR di latar belakang agar siap pakai saat pengguna mengambil foto
    setTimeout(initOCRWorker, 1000);
});

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
    if (keyInput.value.trim() === correctKey) {
        document.getElementById('lockSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'flex';
        checkVipStatus();
    } else {
        errorMsg.innerText = "Kata sandi salah, silakan coba lagi!";
        keyInput.value = "";
        keyInput.focus();
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
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(); }
        });
    }
}

function usePreset(prefix) {
    const promptInput = document.getElementById('promptInput');
    promptInput.value = prefix;
    promptInput.focus();
    document.getElementById('featureMenu').style.display = 'none';
}

function clearChat() {
    document.getElementById('chatHistory').innerHTML = `
        <div class="chat-bubble ai">
            <div class="avatar"><i class="fa-solid fa-bolt"></i></div>
            <div class="bubble-content"><strong>Rey Multi AI Hub</strong><br>Riwayat obrolan telah dibersihkan.</div>
        </div>`;
    clearAttachment();
}

// MESIN STREAMING DENGAN TIMEOUT & PERINTAH BAHASA INDONESIA
async function streamAIResponse(promptText, selectedModel, targetContainer) {
    let fullPrompt = promptText;
    
    // Format prompt yang akurat saat pengguna mengunggah foto
    if (attachedFileContent && attachedFileContent.type === 'image') {
        if (extractedImageText) {
            fullPrompt = `Teks hasil pemindaian foto/kamera:\n"""\n${extractedImageText}\n"""\n\nPerintah Pengguna: ${promptText || 'Tolong jawab, selesaikan, atau jelaskan isi teks/soal pada foto tersebut secara lengkap dan tepat dalam bahasa Indonesia.'}`;
        } else {
            fullPrompt = `Pengguna mengunggah gambar. Pertanyaan: ${promptText || 'Tolong jelaskan isi gambar ini.'}`;
        }
    }

    const headerDecoration = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n Prompt 𖤐 : Rey Multi AI Hub © Rey472 \n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const systemPrompt = "Kamu adalah asisten AI dari Rey Multi AI Hub. Wajib dan selalu berikan setiap jawaban, penjelasan, atau pemecahan soal dalam Bahasa Indonesia yang akurat, jelas, dan mudah dipahami, kecuali jika pengguna secara khusus meminta bahasa lain.";

    // Batas waktu timeout 7 detik agar tidak menggantung jika server AI antre
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
        const response = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: selectedModel || 'openai',
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: fullPrompt }
                ],
                stream: true
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let accumulatedText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (let line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const parsed = JSON.parse(line.replace('data: ', ''));
                            const content = parsed.choices?.[0]?.delta?.content || "";
                            accumulatedText += content;

                            targetContainer.innerHTML = marked.parse(headerDecoration + accumulatedText) + `
                                <div class="copy-action">
                                    <button class="copy-btn" onclick="speakText(this)"><i class="fa-solid fa-volume-high"></i> Baca</button>
                                    <button class="copy-btn" onclick="copyToClipboard(this)"><i class="fa-regular fa-copy"></i> Salin</button>
                                </div>
                            `;
                        } catch (e) {}
                    }
                }
            }
            if (accumulatedText.trim() !== "") return;
        }
    } catch (e) {
        console.log("Streaming lambat atau timeout, otomatis pindah ke jalur turbo kilat...");
    }

    // JALUR TURBO KILAT (FALLBACK OTOMATIS)
    try {
        const indoPrefix = encodeURIComponent("Jawablah dalam bahasa Indonesia dengan lengkap dan tepat: ");
        const fallbackRes = await fetch(`https://text.pollinations.ai/${indoPrefix}${encodeURIComponent(fullPrompt)}?model=openai`);
        if (fallbackRes.ok) {
            const text = await fallbackRes.text();
            targetContainer.innerHTML = marked.parse(headerDecoration + text) + `
                <div class="copy-action">
                    <button class="copy-btn" onclick="speakText(this)"><i class="fa-solid fa-volume-high"></i> Baca</button>
                    <button class="copy-btn" onclick="copyToClipboard(this)"><i class="fa-regular fa-copy"></i> Salin</button>
                </div>
            `;
            return;
        }
    } catch (e) {}

    targetContainer.innerHTML = marked.parse(headerDecoration + "Waduh bray, koneksi AI sedang padat. Silakan tekan tombol kirim sekali lagi ya!");
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

    let displayUserMessage = escapeHtml(userPrompt);
    if (attachedFileContent && attachedFileContent.type === 'image') {
        displayUserMessage = `<img src="${attachedFileContent.data}" style="max-width: 180px; display: block; border-radius: 8px; margin-bottom: 6px;" /><br>` + (displayUserMessage || 'Artikan teks');
    }

    promptInput.value = '';

    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user';
    userBubble.innerHTML = `<div class="avatar"><i class="fa-solid fa-user"></i></div><div class="bubble-content">${displayUserMessage}</div>`;
    chatHistory.appendChild(userBubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    const aiBubble = document.createElement('div');
    aiBubble.className = isVipUser ? 'chat-bubble ai vip' : 'chat-bubble ai';
    aiBubble.innerHTML = `<div class="avatar"><i class="fa-solid fa-robot"></i></div><div class="bubble-content"><span style="color: var(--accent);"><i class="fa-solid fa-bolt fa-spin"></i> Bot sedang mengetik...</span></div>`;
    chatHistory.appendChild(aiBubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    sendBtn.disabled = true;

    const targetContainer = aiBubble.querySelector('.bubble-content');

    if (isImageGenMode || userPrompt.toLowerCase().startsWith('buat gambar:')) {
        const imgP = userPrompt.replace(/buat gambar:/i, '').trim();
        const finalOutput = `Hasil Pembuatan Gambar: **"${imgP}"**\n\n![Gambar AI](https://image.pollinations.ai/prompt/${encodeURIComponent(imgP)}?width=1024&height=1024&nologo=true)`;
        targetContainer.innerHTML = marked.parse(`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n Prompt 𖤐 : Rey Multi AI Hub © Rey472 \n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + finalOutput);
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
