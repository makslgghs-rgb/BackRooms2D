import { CONFIG } from './config.js';

export class StruggleSystem {
    constructor() {
        this.active = false;
        this.progress = 35;
        this.pulse = 0;
        this.isDead = false;
        this.escapedPending = false;
        this.wallHitDone = false;
        this.impactFlash = 0;
    }

    startGrab() {
        if (this.active || this.isDead) return;
        this.active = true;
        this.escapedPending = false;
        this.progress = 40;
        this.pulse = 0;
    }

    mashKey() {
        if (!this.active || this.isDead) return;
        this.progress += 13;
        this.pulse = 1.0;

        if (Math.floor(this.progress) >= 100) {
            this.progress = 100;
            this.escapedPending = true;
        }
    }

    findNearestWallAngle(player, entity, world, building) {
        const ts = CONFIG.TILE_SIZE;
        let bestAngle = Math.atan2(player.y - entity.y, player.x - entity.x);
        let minWallDist = 288;

        const rays = 24;
        for (let i = 0; i !== rays; i++) {
            const angle = (i / rays) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            for (let d = 32; d !== 288; d += 16) {
                const tx = Math.floor((player.x + cos * d) / ts);
                const ty = Math.floor((player.y + sin * d) / ts);

                if (world.isWall(tx, ty) || (building && building.isSolid(tx, ty))) {
                    minWallDist = Math.min(minWallDist, d);
                    if (minWallDist === d) {
                        bestAngle = angle;
                    }
                    break;
                }
            }
        }
        return bestAngle;
    }

    triggerEscape(player, entity, world, building) {
        this.active = false;
        this.escapedPending = false;
        this.progress = 0;
        this.wallHitDone = false;

        player.stamina = Math.max(player.stamina, 75);
        player.exhausted = false;

        const throwAngle = this.findNearestWallAngle(player, entity, world, building);
        player.knockbackX = Math.cos(throwAngle) * 980;
        player.knockbackY = Math.sin(throwAngle) * 980;
        player.addBloodSplatter(4);

        entity.onPlayerEscaped();
    }

    onWallImpact(player) {
        if (this.wallHitDone) return;
        this.wallHitDone = true;
        this.impactFlash = 1.0;

        player.takeDamage(28);
        player.addBloodSplatter(8);

        if (player.hp <= 0) {
            this.isDead = true;
            player.hp = 0;
        }
    }
    update(dt, player, entity, world, building) {
        if (this.impactFlash > 0) {
            this.impactFlash = Math.max(0, this.impactFlash - dt * 2.5);
        }
        if (this.isDead) return;

        const speed = Math.hypot(player.knockbackX, player.knockbackY);
        if (speed > 5) {
            const nx = player.x + player.knockbackX * dt;
            const ny = player.y + player.knockbackY * dt;

            if (!player.checkCollision(nx, player.y, world, building, null)) {
                player.x = nx;
            } else {
                if (speed > 220) this.onWallImpact(player);
                player.knockbackX = 0;
            }

            if (!player.checkCollision(player.x, ny, world, building, null)) {
                player.y = ny;
            } else {
                if (speed > 220) this.onWallImpact(player);
                player.knockbackY = 0;
            }

            player.knockbackX *= Math.pow(0.035, dt);
            player.knockbackY *= Math.pow(0.035, dt);
        }

        if (!this.active) return;

        if (this.escapedPending || this.progress >= 100) {
            this.triggerEscape(player, entity, world, building);
            return;
        }

        this.pulse = Math.max(0, this.pulse - dt * 5);

        this.progress -= 24 * dt;
        player.takeDamage(13 * dt);
        player.addBloodSplatter(1);

        if (player.hp <= 0 || this.progress <= 0) {
            this.active = false;
            this.isDead = true;
            player.hp = 0;
        }
    }

        draw(ctx, width, height, isTouch = false) {
        if (this.impactFlash > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(180, 0, 0, ${this.impactFlash * 0.55})`;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }

        if (this.isDead) {
            this.drawDeathScreen(ctx, width, height, isTouch);
            return;
        }
        if (!this.active) return;

        ctx.save();
        const cx = width / 2;
        const cy = height / 2;
        const shakeX = (Math.random() - 0.5) * 8;
        const shakeY = (Math.random() - 0.5) * 8;

        ctx.fillStyle = 'rgba(120, 0, 0, 0.25)';
        ctx.fillRect(0, 0, width, height);

        const barW = 260;
        const barH = 18;
        const scale = 1 + this.pulse * 0.08;
        const clampedProgress = Math.min(100, Math.max(0, this.progress));

        ctx.translate(cx + shakeX, cy + 75 + shakeY);
        ctx.scale(scale, scale);

        ctx.fillStyle = 'rgba(10, 0, 0, 0.85)';
        ctx.fillRect(-barW / 2, -barH / 2, barW, barH);

        ctx.fillStyle = clampedProgress > 65 ? '#4ade80' : '#ef4444';
        ctx.fillRect(-barW / 2 + 2, -barH / 2 + 2, (barW - 4) * (clampedProgress / 100), barH - 4);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-barW / 2, -barH / 2, barW, barH);

        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText('ЖМИ [ ПРОБЕЛ ] ЧТОБЫ ВЫРВАТЬСЯ!', 0, -22);

        ctx.restore();
    }

    drawDeathScreen(ctx, width, height, isTouch = false) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 0, 0, 0.88)';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.font = 'bold 42px monospace';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('SIGNAL LOST // ЗАПИСЬ ПРЕРВАНА', width / 2, height / 2 - 20);

        ctx.font = '18px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        const hint = isTouch
            ? 'Нажми [ ИСП ] или [ ЗАНОВО ] чтобы начать заново'
            : 'Нажми [ R ] чтобы начать заново';
        ctx.fillText(hint, width / 2, height / 2 + 26);
        ctx.restore();
    }
}
