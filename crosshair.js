import { CONFIG } from './config.js';

export class Crosshair {
    constructor() {
        this.spread = 8;
    }

    update(dt, player, input) {
        const { dx, dy } = input.getMovementVector();
        const isMoving = Math.hypot(dx, dy) > 0;

        let targetSpread = 7;
        if (player.isSprinting) targetSpread = 16;
        else if (isMoving) targetSpread = 11;

        this.spread += (targetSpread - this.spread) * (12 * dt);
    }

    draw(ctx, input, player) {
        const { x, y } = input.mouse;
        const s = this.spread;
        const len = 6;

        ctx.save();
        ctx.translate(x, y);

        if (player.stamina < CONFIG.MAX_STAMINA) {
            const ratio = player.stamina / CONFIG.MAX_STAMINA;
            ctx.beginPath();
            ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
            ctx.strokeStyle = player.exhausted ? 'rgba(239, 68, 68, 0.85)' : 'rgba(255, 255, 255, 0.75)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(-s - len, 0); ctx.lineTo(-s, 0);
        ctx.moveTo(s, 0);        ctx.lineTo(s + len, 0);
        ctx.moveTo(0, -s - len); ctx.lineTo(0, -s);
        ctx.moveTo(0, s);        ctx.lineTo(0, s + len);
        ctx.stroke();

        ctx.fillStyle = player.exhausted ? '#ef4444' : '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
