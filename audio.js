export class SoundEngine {
    constructor() {
        this.ctx = null;
        this.humGain = null;
        this.dryBus = null;
        this.wetBus = null;
        this.stepTimer = 0;
        this.breathTimer = 0;
        this.wasNight = false;
        this.noiseBuffer = null;
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.createNoiseBuffer();
        this.setupRoomAcoustics();
        this.startFluorescentHum();
    }

    // Создаем общую акустику пустого зала: глухой фильтр + гулкое эхо
    setupRoomAcoustics() {
        // Фильтр глухоты (срезает резкие высокие частоты)
        this.dryBus = this.ctx.createBiquadFilter();
        this.dryBus.type = 'lowpass';
        this.dryBus.frequency.value = 520;

        // Конвольвер (пространственное эхо)
        const convolver = this.ctx.createConvolver();
        convolver.buffer = this.createReverbImpulse(1.7, 2.8);

        // Фильтр для самого эха (чтобы хвост реверберации был глубоким и глухим)
        const echoTone = this.ctx.createBiquadFilter();
        echoTone.type = 'lowpass';
        echoTone.frequency.value = 380;

        this.wetBus = this.ctx.createGain();
        this.wetBus.gain.value = 0.55; // Сила эха

        this.dryBus.connect(this.ctx.destination);
        this.dryBus.connect(convolver);
        convolver.connect(echoTone);
        echoTone.connect(this.wetBus);
        this.wetBus.connect(this.ctx.destination);
    }

    // Генерация импульса большого пустого помещения для эха
    createReverbImpulse(duration, decay) {
        const rate = this.ctx.sampleRate;
        const length = rate * duration;
        const impulse = this.ctx.createBuffer(2, length, rate);

        for (let ch = 0; ch < 2; ch++) {
            const channelData = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                // Плавное затухание отражений с небольшой задержкой
                const env = Math.pow(1 - i / length, decay);
                channelData[i] = (Math.random() * 2 - 1) * env;
            }
        }
        return impulse;
    }

    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 1.5;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    startFluorescentHum() {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        this.humGain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.value = 60;

        osc2.type = 'sine';
        osc2.frequency.value = 120;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 150; // Более глухой, утробный гул ламп

        this.humGain.gain.value = 0.04;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(this.humGain);
        this.humGain.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
    }

    // Глухой щелчок фонарика с эхом по коридорам
    playFlashlightClick() {
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.045);

        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

        osc.connect(gain);
        gain.connect(this.dryBus);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    // Тяжелый гулкий удар рубильника с длинным эхом при смене дня/ночи
    playBreakerSwitch() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.18);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.dryBus);

        osc.start(now);
        osc.stop(now + 0.22);
    }

    // Глухой мягкий шаг по ковролину с легким эхом пустых комнат
    playFootstep(isSprinting) {
        if (!this.ctx || !this.noiseBuffer) return;
        const now = this.ctx.currentTime;

        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = isSprinting ? 230 : 165;

        const gain = this.ctx.createGain();
        const volume = isSprinting ? 0.24 : 0.13;
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.dryBus);

        src.start(now, Math.random() * 0.5, 0.14);
    }

    playBreath() {
        if (!this.ctx || !this.noiseBuffer) return;
        const now = this.ctx.currentTime;

        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 340;
        filter.Q.value = 1.8;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.linearRampToValueAtTime(0.11, now + 0.2);
        gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.dryBus);

        src.start(now, 0, 0.65);
    }

    update(dt, player, input, gameTime) {
        if (!this.ctx) return;

        const isNight = gameTime.isNight();
        if (isNight !== this.wasNight) {
            this.playBreakerSwitch();
            this.wasNight = isNight;
        }
        const targetHum = isNight ? 0.0 : 0.04;
        this.humGain.gain.setTargetAtTime(targetHum, this.ctx.currentTime, 0.25);

        const { dx, dy } = input.getMovementVector();
        const isMoving = Math.hypot(dx, dy) > 0;

        if (isMoving) {
            const stepInterval = player.isSprinting ? 0.31 : 0.54;
            this.stepTimer += dt;
            if (this.stepTimer >= stepInterval) {
                this.stepTimer = 0;
                this.playFootstep(player.isSprinting);
            }
        } else {
            this.stepTimer = 0.25;
        }

        if (player.exhausted) {
            this.breathTimer += dt;
            if (this.breathTimer >= 0.85) {
                this.breathTimer = 0;
                this.playBreath();
            }
        } else {
            this.breathTimer = 0.5;
        }
    }
}
