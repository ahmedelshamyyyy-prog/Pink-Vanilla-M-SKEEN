/* -------------------------
	Configuration (replace if you want)
	------------------------- */
const apiKey = "YOUR_API_KEY_HERE"; // if empty, TTS/LLM will show a helpful error
const apiBase = "https://generativelanguage.googleapis.com/v1beta/models";

/* -------------------------
	DOM Elements
	------------------------- */
const splashEntry = document.getElementById('splash-entry');
const splashTitle = document.getElementById('splash-title');
const mainContent = document.getElementById('main-content');
const ttsText = document.getElementById('ttsText');
const audioPlayer = document.getElementById('audioPlayer');
const flowerImg = document.getElementById('pink-vanilla-flower');

/* -------------------------
	Utility: safe query for scroll reveal elements
	------------------------- */
function getRevealElements() {
	// All elements that should reveal on intersection
	return Array.from(document.querySelectorAll('.js-scroll-hidden'));
}

/* -------------------------
	Splash -> reveal main logic
	- robust against mid-load scroll positions
	------------------------- */
let ticking = false;
function onScrollHandler() {
	if (!ticking) {
		window.requestAnimationFrame(() => {
			handleSplashEffects();
			ticking = false;
		});
		ticking = true;
	}
}

function handleSplashEffects() {
	const splashRect = splashEntry.getBoundingClientRect();
	const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

	// If splash is partially visible, animate title scale & opacity based on how far the top of viewport passed it:
	// progress = how much of the splash's height has been scrolled (0..1)
	const total = splashEntry.offsetHeight || viewportHeight;
	const scrolled = Math.min(Math.max(window.scrollY, 0), total);
	const progress = Math.min(1, scrolled / (total * 0.75));

	if (splashTitle) {
		const newScale = 1 - (progress * 0.4); // 1 -> 0.6
		const newOpacity = Math.max(0, 1 - progress); // 1 -> 0
		splashTitle.style.transform = `scale(${newScale}) translateZ(0)`;
		splashTitle.style.opacity = `${newOpacity}`;
	}

	// Reveal main if the bottom of splash is above the top of the viewport (i.e., scrolled past)
	if (splashRect.bottom <= 0) {
		revealMain();
	} else {
		// keep it hidden to avoid partial showing
		hideMain();
	}
}

function revealMain() {
	if (!mainContent.classList.contains('main-visible')) {
		mainContent.classList.remove('main-hidden');
		mainContent.classList.add('main-visible');
	}
}
function hideMain() {
	if (!mainContent.classList.contains('main-hidden')) {
		mainContent.classList.remove('main-visible');
		mainContent.classList.add('main-hidden');
	}
}

/* -------------------------
	Intersection Observer for reveal elements
	------------------------- */
let revealObserver;
function setupRevealObserver() {
	const options = { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.08 };
	revealObserver = new IntersectionObserver((entries, obs) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('js-scroll-reveal');
				entry.target.classList.remove('js-scroll-hidden');
				obs.unobserve(entry.target);
			}
		});
	}, options);
	getRevealElements().forEach(el => {
		// ensure that images will be observed after load (fixes cases where image height unknown)
		if (el.tagName === 'IMG' && !el.complete) {
			el.addEventListener('load', () => revealObserver.observe(el), { once: true });
		} else {
			revealObserver.observe(el);
		}
	});
}

/* -------------------------
	Page initialization
	------------------------- */
window.addEventListener('load', () => {
	// Prepare reveals
	setupRevealObserver();

	// Run initial handlers in case page loaded scrolled
	handleSplashEffects();

	// Attach scroll handlers
	window.addEventListener('scroll', onScrollHandler, { passive: true });
	window.addEventListener('resize', () => { handleSplashEffects(); });
	
	// --- FIX FOR GITHUB PAGES ---
	// Force the main content to appear after a short delay (e.g., 3 seconds) 
	// if the scroll logic fails on static hosting.
	setTimeout(revealMain, 3000); 
});

/* -------------------------
	Modal logic
	------------------------- */
const pairingModal = document.getElementById('pairingModal');
const modalPanel = document.getElementById('modalPanel');
function showPairingModal() {
	const content = document.getElementById('pairingContent');
	content.innerHTML = '<div class="animate-pulse text-accent uppercase tracking-widest text-xs">Curating suggestions...</div>';
	pairingModal.classList.remove('modal-hidden');
	pairingModal.classList.add('modal-visible');
	pairingModal.setAttribute('aria-hidden', 'false');
	setTimeout(() => modalPanel.classList.add('panel-open'), 20);

	// Generate pairing
	generatePairing();
}
function closePairingModal() {
	modalPanel.classList.remove('panel-open');
	pairingModal.classList.remove('modal-visible');
	pairingModal.classList.add('modal-hidden');
	pairingModal.setAttribute('aria-hidden', 'true');
}
// Close on backdrop click or Esc
pairingModal.addEventListener('click', (e) => { if (e.target === pairingModal) closePairingModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePairingModal(); });

/* -------------------------
	LLM Pairing (robust fetch with retry)
	------------------------- */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
	for (let i=0; i<maxRetries; i++) {
		try {
			const res = await fetch(url, options);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res;
		} catch (err) {
			if (i === maxRetries - 1) throw err;
			await new Promise(r => setTimeout(r, Math.pow(2, i) * 500 + Math.random() * 300));
		}
	}
}

async function generatePairing() {
	const div = document.getElementById('pairingContent');
	const prompt = "Generate 3 very short, punchy, high-fashion pairing suggestions for a perfume called 'Pink Vanilla' (Notes: Pink Sugar, Vanilla, Musk). Format: 1 line per suggestion. No intro. Style: Vogue Magazine, bold, elegant.";
	if (!apiKey) {
		div.innerHTML = '<div class="text-left font-droid-serif italic">API key missing. Provide an API key to generate AI suggestions.</div>';
		return;
	}
	try {
		const response = await fetchWithRetry(`${apiBase}/gemini-2.5-flash-preview-09-2025:generateContent?key=${encodeURIComponent(apiKey)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				systemInstruction: { parts: [{ text: "You are a luxury fashion and fragrance concierge. Your responses must be short, high-end, and authoritative." }] }
			})
		}, 2);

		const data = await response.json();
		const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
		if (text) {
			const formattedText = text.split('\n').map(line => line.trim()).filter(Boolean).map(line => `<p class="border-b border-black/10 pb-2 mb-2 last:border-b-0">${line}</p>`).join('');
			div.innerHTML = `<div class="text-left font-droid-serif italic space-y-4">${formattedText}</div>`;
		} else {
			div.innerText = "Service returned no text. Try again later.";
		}
	} catch (err) {
		console.error("Pairing generation error:", err);
		div.innerText = "Connection error. Please check your network or API key.";
	}
}

/* -------------------------
	TTS / Audio (Gemini) - robust base64 -> WAV conversion
	------------------------- */
function base64ToArrayBuffer(base64) {
	const binary = atob(base64);
	const len = binary.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
	return bytes.buffer;
}

function pcm16ToWavBlob(int16Array, sampleRate = 24000) {
	const numChannels = 1;
	const bitsPerSample = 16;
	const byteRate = sampleRate * numChannels * bitsPerSample / 8;
	const dataSize = int16Array.length * 2;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);
	let offset = 0;
	function writeString(s) { for (let i=0;i<s.length;i++) view.setUint8(offset++, s.charCodeAt(i)); }
	writeString('RIFF');
	view.setUint32(offset, 36 + dataSize, true); offset += 4;
	writeString('WAVE'); writeString('fmt ');
	view.setUint32(offset, 16, true); offset += 4;
	view.setUint16(offset, 1, true); offset += 2; // PCM
	view.setUint16(offset, numChannels, true); offset += 2;
	view.setUint32(offset, sampleRate, true); offset += 4;
	view.setUint32(offset, byteRate, true); offset += 4;
	view.setUint16(offset, numChannels * bitsPerSample / 8, true); offset += 2;
	view.setUint16(offset, bitsPerSample, true); offset += 2;
	writeString('data'); view.setUint32(offset, dataSize, true); offset += 4;
	for (let i = 0; i < int16Array.length; i++, offset += 2) view.setInt16(offset, int16Array[i], true);
	return new Blob([view], { type: 'audio/wav' });
}

async function generateTts() {
	const btn = ttsText;
	if (!apiKey) {
		btn.innerText = "API Key Required";
		setTimeout(() => btn.innerText = "Hear the Essence", 1800);
		return;
	}

	// If audio is already loaded and playing, toggle
	if (audioPlayer.src) {
		if (!audioPlayer.paused) {
			audioPlayer.pause();
			btn.innerText = "Hear the Essence";
		} else {
			audioPlayer.play();
			btn.innerText = "Stop";
		}
		return;
	}

	btn.innerText = "Loading...";
	try {
		const payload = {
			contents: [{ parts: [{ text: "Say with a sophisticated, slightly gravelly tone: Pink Vanilla. A fragrance by Muskeen. Stronger. Sweeter. Infinite. Experience the depth of Bourbon Vanilla and the lasting power of our signature Musk." }] }],
			generationConfig: {
				responseModalities: ["AUDIO"],
				speechConfig: {
					voiceConfig: {
						prebuiltVoiceConfig: { voiceName: "Rasalgethi" }
					}
				}
			}
		};

		const resp = await fetchWithRetry(`${apiBase}/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(apiKey)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		}, 3);

		const data = await resp.json();
		// Look for audio bytes in different possible locations
		const audioBase64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || data?.candidates?.[0]?.content?.parts?.[0]?.audio || null;

		if (!audioBase64) {
			console.error("No audio found:", data);
			btn.innerText = "TTS Failed";
			setTimeout(() => btn.innerText = "Hear the Essence", 1600);
			return;
		}

		// Convert base64 (assume L16 PCM 16-bit little endian) into WAV
		const pcmBuf = base64ToArrayBuffer(audioBase64);
		let int16;
		try {
			int16 = new Int16Array(pcmBuf);
		} catch (err) {
			console.error("Failed to cast PCM to Int16Array", err);
			btn.innerText = "TTS Error";
			return;
		}

		const wavBlob = pcm16ToWavBlob(int16, 24000); // sampleRate assumption
		if (audioPlayer.src) URL.revokeObjectURL(audioPlayer.src);
		audioPlayer.src = URL.createObjectURL(wavBlob);
		await audioPlayer.play();
		btn.innerText = "Stop";
		audioPlayer.onended = () => btn.innerText = "Hear the Essence";

	} catch (err) {
		console.error("TTS error:", err);
		btn.innerText = "Error";
		setTimeout(() => btn.innerText = "Hear the Essence", 1400);
	}
}

/* -------------------------
	Ensure hero flower will reveal when scrolled (if visible on load)
	------------------------- */
if (flowerImg && flowerImg.complete) {
	// If already loaded, ensure it's observed by the IntersectionObserver
	setTimeout(() => {
		try { if (revealObserver) revealObserver.observe(flowerImg); } catch(e) {}
	}, 60);
} else if (flowerImg) {
	flowerImg.addEventListener('load', () => {
		try { if (revealObserver) revealObserver.observe(flowerImg); } catch(e) {}
	}, { once: true });
}