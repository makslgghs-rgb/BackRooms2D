export class VHSEffect {
    constructor() {
        this.noiseCanvas = document.createElement('canvas');
        this.noiseCanvas.width = 256;
        this.noiseCanvas.height = 256;
        this.generateNoise();
        this.time = 0;
        this.errorMessages = [
            'ERR_TRACKING // 0x8F',
            'SIGNAL_INTERFERENCE',
            'TAPE_CORRUPTION_DETECTED',
            'WARN: UNKNOWN_PRESENCE'
        ];
    }

    generateNoise() {
        const ctx = this.noiseCanvas.getContext('2d');
        const imgData = ctx.createImageData(256, 256);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            const val = Math.random() * 255;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
            data[i + 3] = 24;
        }
        ctx.putImageData(imgData, 0, 0);
    }

    draw(ctx, width, height, dt, threatLevel = 0, hp = 100) {
        this.time += dt;

        // 1. Бегущая зернистость пленки
        ctx.save();
        const offsetX = Math.random() * 256;
        const offsetY = Math.random() * 256;
        const pattern = ctx.createPattern(this.noiseCanvas, 'repeat');
        ctx.fillStyle = pattern;
        ctx.translate(offsetX, offsetY);
        ctx.fillRect(-offsetX, -offsetY, width, height);
        ctx.restore();

        // 2. Ошибки и полосы помех, когда Сущность рядом
        if (threatLevel > 0.05) {
            const barsCount = Math.floor(4 + threatLevel * 12);
            for (let i = 0; i < barsCount; i++) {
                if (Math.random() > 0.45) continue;
                const barY = Math.random() * height;
                const barH = Math.random() * (4 + threatLevel * 8) + 1;
                ctx.fillStyle = Math.random() > 0.5
                    ? `rgba(239, 68, 68, ${0.14 * threatLevel})`
                    : `rgba(255, 255, 255, ${0.16 * threatLevel})`;
                ctx.fillRect(0, barY, width, barH);
            }

            if (threatLevel > 0.35 && Math.random() < 0.35 * threatLevel) {
                ctx.save();
                ctx.font = 'bold 14px monospace';
                ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.95, threatLevel)})`;
                const msg = this.errorMessages[Math.floor(Math.random() * this.errorMessages.length)];
                const ex = 40 + Math.random() * (width - 280);
                const ey = 80 + Math.random() * (height - 160);
                ctx.fillText(`[!] ${msg}`, ex, ey);
                ctx.restore();
            }
        }

        // 3. Кровавая пульсация экрана при ранении (вместо полоски HP)
        if (hp < 95) {
            const injury = 1 - hp / 100; // От 0 (здоров) до 1 (при смерти)
            const heartbeat = 0.75 + Math.sin(this.time * (4 + injury * 6)) * 0.25;
            const bloodAlpha = injury * 0.78 * heartbeat;

            const bloodGrad = ctx.createRadialGradient(
                width / 2, height / 2, width * (0.34 - injury * 0.16),
                width / 2, height / 2, width * 0.72
            );
            bloodGrad.addColorStop(0, 'rgba(130, 0, 0, 0)');
            bloodGrad.addColorStop(0.65, `rgba(140, 8, 8, ${bloodAlpha * 0.55})`);
            bloodGrad.addColorStop(1, `rgba(110, 0, 0, ${bloodAlpha})`);

            ctx.fillStyle = bloodGrad;
            ctx.fillRect(0, 0, width, height);
        }

        // 4. Сканлайны и моргание
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        for (let y = 0; y < height; y += 4) {
            ctx.fillRect(0, y, width, 1);
        }

        if (Math.random() < 0.02 + threatLevel * 0.1) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
            ctx.fillRect(0, 0, width, height);
        }

        // 5. Тёмная виньетка
        const innerR = Math.max(width * 0.14, width * (0.28 - threatLevel * 0.08));
        const gradient = ctx.createRadialGradient(
            width / 2, height / 2, innerR,
            width / 2, height / 2, width * 0.78
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.88, 0.55 + threatLevel * 0.25)})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        this.drawHUD(ctx, threatLevel);
    }

    drawHUD(ctx, threatLevel) {
        ctx.save();
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = threatLevel > 0.6 ? '#ef4444' : 'rgba(255, 255, 255, 0.8)';
        const label = threatLevel > 0.6 ? 'ERR ►  LVL 0' : 'PLAY ►  LVL 0';
        ctx.fillText(label, 25, 38);

        if (Math.floor(this.time * (2 + threatLevel * 6)) % 2 === 0) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(175, 32, 6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
