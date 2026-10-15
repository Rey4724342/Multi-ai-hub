const correctKey = "adminrey472";
let isVipUser = false;
let attachedFileContent = null;
let attachedFileName = "";
let extractedImageText = "";
let isImageGenMode = false;
let isProcessingOCR = false;
let tesseractWorker = null;

window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('lockSection').style.display = 'flex';
    document.getElementById('mainSection').style.display = 'none';

    const keyInput = document.getElementById('keyInput');
    if (keyInput) {
        keyInput.focus();
        keyInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    }
    setupAppListeners();

    try {
        tesseractWorker = await Tesseract.createWorker('ind+eng');
    } catch(e) {}
});

function handleLogin() {
    const keyInput = document.getElementById('keyInput');
    const errorMsg = document.getElementById('errorMsg');
    if (keyInput.value.trim() === correctKey) {
        document.getElementById('lockSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'flex';
        checkVipStatus();
    } else {
        errorMsg.innerText = "Password Salah, bray!";
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
        document.getElementById('userStatusTag').innerText = `© Rey472 • ⚡ VIP ACTIVE`;
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

function quickCompressImage(base64Image) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
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
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = base64Image;
    });
}

async function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    attachedFileName = file.name;
    const reader = new FileReader();

    if (file.type.startsWith('image/')) {
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = true;
        isProcessingOCR = true;
        showAttachmentPreview(`⚡ <i class="fa-solid fa-bolt fa-spin"></i> Pemindaian Kilat...`);
        
        reader.onload = async function(e) {
            const compressedBase64 = await quickCompressImage(e.target.result);
            attachedFileContent = { type: 'image', data: e.target.result };
            
            try {
                if (!tesseractWorker) {
                    tesseractWorker = await Tesseract.createWorker('ind+eng');
                }
                const ret = await tesseractWorker.recognize(compressedBase64);
                if (ret.data.text && ret.data.text.trim().length > 2) {
                    const lines = ret.data.text.split('\n').filter(l => l.trim().length > 2);
                    extractedImageText = lines.slice(0, 2).join(' ');
                    showAttachmentPreview(`✅ ⚡ Teks Terbaca Kilat: "${extractedImageText.substring(0, 25)}..."`);
                } else {
                    extractedImageText = "Teks tidak jelas";
                    showAttachmentPreview(`📷 Foto Terlampir`);
                }
            } catch (err) {
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
            showAttachmentPreview(`📄 File: ${file.name}`);
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
            <div class="bubble-content"><strong>Rey Multi AI Hub</strong><br>Riwayat dibersihkan.</div>
        </div>`;
    clearAttachment();
}

async function fetchAIResponse(promptText, selectedModel) {
    let fullPrompt = promptText;
    if (attachedFileContent && attachedFileContent.type === 'image') {
        fullPrompt = `Teks dari foto: "${extractedImageText || 'Tidak terbaca'}". Perintah: "${promptText || 'Jawab secara acak dan asal-asalan'}".`;
    }

    const endpoints = [
        fetch("https://gen.pollinations.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: selectedModel || 'openai', messages: [{ role: "user", content: fullPrompt }] })
        }).then(async r => { if(r.ok) { const d = await r.json(); return d.choices?.[0]?.message?.content; } throw new Error(); }),
        
        fetch(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai`).then(async r => { if(r.ok) return await r.text(); throw new Error(); })
    ];

    try {
        const fastestReply = await Promise.any(endpoints);
        if (fastestReply && fastestReply.trim() !== "") return fastestReply;
    } catch (e) {}

    return "Waduh bray, koneksi turbo mendadak kilat! Coba kirim ulang ya!";
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
    aiBubble.innerHTML = `<div class="avatar"><i class="fa-solid fa-bolt"></i></div><div class="bubble-content"><span style="color: var(--accent);"><i class="fa-solid fa-bolt fa-spin"></i> Turbo Connecting...</span></div>`;
    chatHistory.appendChild(aiBubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    sendBtn.disabled = true;

    let finalOutput = "";
    if (isImageGenMode || userPrompt.toLowerCase().startsWith('buat gambar:')) {
        const imgP = userPrompt.replace(/buat gambar:/i, '').trim();
        finalOutput = `Hasil Generate: **"${imgP}"**\n\n![AI Image](https://image.pollinations.ai/prompt/${encodeURIComponent(imgP)}?width=1024&height=1024&nologo=true)`;
        isImageGenMode = false;
    } else {
        finalOutput = await fetchAIResponse(userPrompt, model);
    }

    clearAttachment();

    let formattedResult = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n Prompt 𖤐 : Rey Multi AI Hub © Rey472 \n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` + finalOutput;

    aiBubble.querySelector('.bubble-content').innerHTML = marked.parse(formattedResult) + `
        <div class="copy-action">
            <button class="copy-btn" onclick="copyToClipboard(this)"><i class="fa-regular fa-copy"></i> Salin</button>
        </div>
    `;

    sendBtn.disabled = false;
    chatHistory.scrollTop = chatHistory.scrollHeight;
    promptInput.focus();
}

function copyToClipboard(btn) {
    const text = btn.closest('.bubble-content').innerText.replace('Salin', '').trim();
    navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin!';
        setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Salin'; }, 2000);
    });
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
