/**
 * Ultra-Responsive Audio Visualizer Engine (Web Audio API + Canvas)
 * Modes: 'bars' (Cyber EQ Bars), 'wave' (Neon Sine Wave), 'radial' (Circular Pulse)
 */
class AudioVisualizer {
  constructor(canvasElement, audioElement) {
    this.canvas = canvasElement;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.audio = audioElement;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.timeDomainArray = null;
    this.bufferLength = 0;
    this.animationId = null;
    this.isInitialized = false;
    this.mode = 'bars'; // 'bars' | 'wave' | 'radial'
    this.peaks = [];

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Switch mode on click of canvas
    this.canvas.style.cursor = 'pointer';
    this.canvas.title = 'Click to switch visualizer style (Bars / Wave / Radial)';
    this.canvas.addEventListener('click', () => {
      this.toggleMode();
    });
  }

  toggleMode() {
    const modes = ['bars', 'wave', 'radial'];
    const curIdx = modes.indexOf(this.mode);
    this.mode = modes[(curIdx + 1) % modes.length];
    if (window.showToast) {
      window.showToast(`Visualizer: ${this.mode.toUpperCase()}`);
    }
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.clientWidth * (window.devicePixelRatio || 1) || 300;
    this.canvas.height = this.canvas.clientHeight * (window.devicePixelRatio || 1) || 80;
  }

  initContext() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.82;

      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
      this.timeDomainArray = new Uint8Array(this.bufferLength);
      this.peaks = new Array(this.bufferLength).fill(0);
      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioContext initialization note:', e.message);
    }
  }

  start() {
    if (!this.isInitialized) {
      this.initContext();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    if (!this.animationId) {
      this.draw();
    }
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.clearCanvas();
  }

  clearCanvas() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw() {
    this.animationId = requestAnimationFrame(() => this.draw());

    if (!this.analyser || !this.ctx || !this.canvas) {
      this.drawIdleWave();
      return;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    if (this.mode === 'bars') {
      this.drawBars(width, height);
    } else if (this.mode === 'wave') {
      this.drawWave(width, height);
    } else {
      this.drawRadial(width, height);
    }
  }

  drawBars(width, height) {
    this.analyser.getByteFrequencyData(this.dataArray);
    const barCount = 32;
    const barWidth = (width / barCount) - 3;
    let x = 2;

    for (let i = 0; i < barCount; i++) {
      const val = this.dataArray[i] || 0;
      const barHeight = Math.max(4, (val / 255) * (height - 8));

      // Peak drop
      if (barHeight > (this.peaks[i] || 0)) {
        this.peaks[i] = barHeight;
      } else {
        this.peaks[i] = Math.max(0, (this.peaks[i] || 0) - 1.2);
      }

      // Dynamic Cyan-to-Emerald Gradient
      const gradient = this.ctx.createLinearGradient(0, height - barHeight, 0, height);
      gradient.addColorStop(0, '#38bdf8');
      gradient.addColorStop(0.5, '#1ed760');
      gradient.addColorStop(1, '#15803d');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, height - barHeight, barWidth, barHeight, [3, 3, 0, 0]);
      this.ctx.fill();

      // Draw Peak Cap
      if (this.peaks[i] > 4) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(x, height - this.peaks[i] - 3, barWidth, 2);
      }

      x += barWidth + 3;
    }
  }

  drawWave(width, height) {
    this.analyser.getByteTimeDomainData(this.timeDomainArray);

    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = '#1ed760';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#1db954';
    this.ctx.beginPath();

    const sliceWidth = width / this.bufferLength;
    let x = 0;

    for (let i = 0; i < this.bufferLength; i++) {
      const v = this.timeDomainArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0; // reset
  }

  drawRadial(width, height) {
    this.analyser.getByteFrequencyData(this.dataArray);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3.5;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);

    const numPoints = 36;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const val = this.dataArray[i % this.bufferLength] || 0;
      const r = radius + (val / 255) * (radius * 0.9);

      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;

      this.ctx.fillStyle = i % 2 === 0 ? '#1ed760' : '#38bdf8';
      this.ctx.beginPath();
      this.ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawIdleWave() {
    if (!this.ctx || !this.canvas) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    this.ctx.strokeStyle = 'rgba(29, 185, 84, 0.3)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, height / 2);
    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();
  }
}

window.AudioVisualizer = AudioVisualizer;
