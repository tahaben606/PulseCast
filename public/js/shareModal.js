/**
 * Share Modal & Link Generator
 */
class ShareModal {
  constructor() {
    this.modalOverlay = document.getElementById('shareModal');
    this.trackTitleEl = document.getElementById('shareTrackTitle');
    this.trackThumbEl = document.getElementById('shareTrackThumb');
    this.shareLiveLink = document.getElementById('shareLiveLink');
    this.shareLiveLanLink = document.getElementById('shareLiveLanLink');
    this.shareGameLink = document.getElementById('shareGameLink');
    this.webLinkInput = document.getElementById('shareWebLink');
    this.embedCodeInput = document.getElementById('shareEmbedCode');
    this.qrContainer = document.getElementById('shareQrContainer');
    this.customDomainInput = document.getElementById('shareCustomDomain');

    this.networkInfo = null;
    this.customDomain = localStorage.getItem('pulsecast_custom_domain') || '';
    if (this.customDomainInput) {
      this.customDomainInput.value = this.customDomain;
    }

    this.fetchNetworkInfo();
    this.initEvents();
  }

  async fetchNetworkInfo() {
    try {
      const res = await fetch('/api/network');
      this.networkInfo = await res.json();
    } catch (e) {
      console.warn('Network info unavailable:', e);
    }
  }

  initEvents() {
    const closeBtn = document.getElementById('closeShareModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    if (this.modalOverlay) {
      this.modalOverlay.addEventListener('click', (e) => {
        if (e.target === this.modalOverlay) this.close();
      });
    }

    // Custom domain input change
    if (this.customDomainInput) {
      this.customDomainInput.addEventListener('input', (e) => {
        this.customDomain = e.target.value.trim().replace(/\/+$/, '');
        localStorage.setItem('pulsecast_custom_domain', this.customDomain);
        if (this.currentTrack) {
          this.updateLinks(this.currentTrack);
        }
      });
    }

    // Copy buttons
    document.querySelectorAll('.btn-copy-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetInputId = btn.getAttribute('data-target');
        const inputEl = document.getElementById(targetInputId);
        if (inputEl) {
          navigator.clipboard.writeText(inputEl.value).then(() => {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
            if (window.showToast) window.showToast('Copied to clipboard!', 'success');
            setTimeout(() => {
              btn.innerHTML = originalHtml;
            }, 2000);
          }).catch(err => {
            console.error('Failed to copy:', err);
            if (window.showToast) window.showToast('Failed to copy', 'error');
          });
        }
      });
    });
  }

  updateLinks(track) {
    const defaultOrigin = window.location.origin;
    const baseOrigin = this.customDomain || defaultOrigin;
    const lanOrigin = this.networkInfo?.lanBaseUrl || defaultOrigin;

    // Live Radio Permanent Links
    const liveUrl = `${baseOrigin}/live.mp3`;
    const liveLanUrl = `${lanOrigin}/live.mp3`;

    // Single Track Links
    const gameMp3Url = `${baseOrigin}/stream/${track.id}.mp3`;
    const webUrl = `${baseOrigin}/listen/${track.id}`;
    const embedCode = `<iframe src="${baseOrigin}/embed/${track.id}" width="100%" height="152" frameBorder="0" allow="autoplay; encrypted-media" style="border-radius:12px"></iframe>`;

    if (this.trackTitleEl) this.trackTitleEl.textContent = track.title;
    if (this.trackThumbEl) this.trackThumbEl.src = track.thumbnail || '/public/images/default-track.svg';
    if (this.shareLiveLink) this.shareLiveLink.value = liveUrl;
    if (this.shareLiveLanLink) this.shareLiveLanLink.value = liveLanUrl;
    if (this.shareGameLink) this.shareGameLink.value = gameMp3Url;
    if (this.webLinkInput) this.webLinkInput.value = webUrl;
    if (this.embedCodeInput) this.embedCodeInput.value = embedCode;

    // Generate QR code
    if (this.qrContainer) {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(webUrl)}&bgcolor=18-18-18&color=1db954&margin=1`;
      this.qrContainer.innerHTML = `<img src="${qrApiUrl}" alt="QR Code" style="width:100px;height:100px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">`;
    }
  }

  open(track) {
    if (!track) {
      // Fallback for opening live radio modal without a track
      const firstTrack = window.currentPlayingTrack || { id: 'live', title: 'PulseCast In-Game Live Radio' };
      this.currentTrack = firstTrack;
    } else {
      this.currentTrack = track;
    }
    this.updateLinks(this.currentTrack);

    if (this.modalOverlay) {
      this.modalOverlay.classList.add('open');
    }
  }

  close() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('open');
    }
  }
}

window.ShareModal = ShareModal;
