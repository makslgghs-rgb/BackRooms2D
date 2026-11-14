export class GameTime {
    constructor() {
        this.hours = 8.0;
        this.hoursPerSecond = 24 / 3600;
    }

    update(dt) {
        this.hours += this.hoursPerSecond * dt;
        if (this.hours >= 24) {
            this.hours -= 24;
        }
    }

    isNight() {
        return this.hours >= 22 || this.hours < 6;
    }

    // Днем светло (0.18 легкой атмосферной тени), ночью 1.0 (полный блэкаут)
    getDarknessAlpha() {
        if (this.isNight()) return 1.0;

        if (this.hours >= 21) {
            return 0.18 + (this.hours - 21) * 0.82;
        }
        if (this.hours < 7) {
            return 1.0 - (this.hours - 6) * 0.82;
        }
        return 0.18;
    }

    getFormattedTime() {
        const h = Math.floor(this.hours);
        const m = Math.floor((this.hours - h) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    drawHUD(ctx, canvasWidth) {
        ctx.save();
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'right';
        
        const status = this.isNight() ? 'LIGHT OFF' : 'DAYLIGHT';
        ctx.fillStyle = this.isNight() ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255, 255, 255, 0.85)';
        
        ctx.fillText(`${status}  ${this.getFormattedTime()}`, canvasWidth - 25, 38);
        ctx.restore();
    }
}
