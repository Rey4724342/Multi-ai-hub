// 1. INSIALISASI TESSERACT LEBIH CEPAT DI BACKGROUND
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('lockSection').style.display = 'flex';
    document.getElementById('mainSection').style.display = 'none';

    const keyInput = document.getElementById('keyInput');
    if (keyInput) {
        keyInput.focus();
        keyInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    }
    setupAppListeners();

    // Mulai inisialisasi Tesseract di background agar saat jepret foto sudah siap
    setTimeout(initOCRWorker, 1000);
});

async function initOCRWorker() {
    try {
        if (!tesseractWorker) {
            tesseractWorker = await Tesseract.createWorker('ind+eng', 1, {
                logger: m => {
                    if (isProcessingOCR && m.status === 'recognizing text') {
                        const pct = Math.round((m.progress || 0) * 100);
                        showAttachmentPreview(`⚡ <i class="fa-solid fa-bolt fa-spin"></i> Memindai teks: ${pct}%`);
                    }
                }
            });
        }
    } catch(e) {
        console.error("OCR Init Error:", e);
    }
}

// 2. KOMPRESI GAMBAR YANG MEMPERJELAS TEKS (TIDAK BURAM)
function quickCompressImage(base64Image) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200; // Resolusi dinaikkan dari 500 ke 1200 agar teks tajam
            let width = img.width;
            let height = img.height;
            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Gambar ke canvas dengan kualitas tajam
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85)); // Kualitas 0.85
        };
        img.src = base64Image;
    });
}

// 3. BACA SELURUH ISI TEKS FOTO (TIDAK HANYA 2 BARIS)
async function handleFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    attachedFileName = file.name;
    const reader = new FileReader();

    if (file.type.startsWith('image/')) {
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = true;
        isProcessingOCR = true;
        showAttachmentPreview(`⚡ <i class="fa-solid fa-bolt fa-spin"></i> Menyiapkan pemindai...`);
        
        reader.onload = async function(e) {
            const compressedBase64 = await quickCompressImage(e.target.result);
            attachedFileContent = { type: 'image', data: e.target.result };
            
            try {
                if (!tesseractWorker) {
                    await initOCRWorker();
                }
                const ret = await tesseractWorker.recognize(compressedBase64);
                
                // AMBIL SELURUH TEKS, BUKAN CUMA 2 BARIS!
                if (ret.data.text && ret.data.text.trim().length > 3) {
                    extractedImageText = ret.data.text.trim();
                    const ringkasan = extractedImageText.replace(/\s+/g, ' ').substring(0, 30);
                    showAttachmentPreview(`✅ Teks Terbaca: "${ringkasan}..."`);
                } else {
                    extractedImageText = "";
                    showAttachmentPreview(`📷 Foto Terlampir (Teks tidak terdeteksi otomatis)`);
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
            showAttachmentPreview(`📄 Berkas: ${file.name}`);
        };
        reader.readAsText(file);
    }
}

// 4. RESPON CEPAT DENGAN TIMEOUT 7 DETIK (ANTI-LEMOT)
async function streamAIResponse(promptText, selectedModel, targetContainer) {
    let fullPrompt = promptText;
    
    // Format prompt rapi untuk soal/teks dari foto
    if (attachedFileContent && attachedFileContent.type === 'image') {
        if (extractedImageText) {
            fullPrompt = `Berikut adalah teks hasil pemindaian foto/kamera:\n"""\n${extractedImageText}\n"""\n\nInstruksi Pengguna: ${promptText || 'Jawab dan selesaikan isi teks/soal di atas secara lengkap, tepat, dan jelas dalam bahasa Indonesia.'}`;
        } else {
            fullPrompt = `Pengguna mengunggah foto. Pertanyaan pengguna: ${promptText || 'Tolong jelaskan atau jawab apa yang ada di foto ini.'}`;
        }
    }

    const headerDecoration = `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n Prompt 𖤐 : Rey Multi AI Hub © Rey472 \n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const systemPrompt = "Kamu adalah asisten AI cerdas dari Rey Multi AI Hub. Wajib berikan jawaban yang lengkap, tepat, akurat, dan mudah dipahami dalam Bahasa Indonesia.";

    // Batas waktu timeout 7 detik untuk streaming agar tidak menggantung
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
        console.log("Streaming lambat atau timeout, beralih ke jalur turbo kilat...");
    }

    // JALUR TURBO SUPER CEPAT (FALLBACK KILAT JIKA STREAMING MACET)
    try {
        const prefix = encodeURIComponent("Jawablah secara tepat dalam bahasa Indonesia: ");
        const fallbackRes = await fetch(`https://text.pollinations.ai/${prefix}${encodeURIComponent(fullPrompt)}?model=openai`);
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

    targetContainer.innerHTML = marked.parse(headerDecoration + "Waduh, server sedang padat. Silakan tekan tombol kirim sekali lagi ya!");
}
