import { CONFIG } from './config.js';

export class Player {
        constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.radius = CONFIG.PLAYER_RADIUS;
        
        this.hp = 100;
        this.maxHp = 100;
        this.stamina = CONFIG.MAX_STAMINA;
        this.isSprinting = false;
        this.exhausted = false;
        this.flashlightOn = true;
        this.equipment = null;

        this.knockbackX = 0;
        this.knockbackY = 0;
        this.bloodTrail = [];
        this.bleedTimer = 0;
    }

    hasAnyLight() {
        return this.flashlightOn || (this.equipment && this.equipment.hasHeadlamp());
    }

    takeDamage(amount) {
        const mult = this.equipment ? this.equipment.getDamageMultiplier() : 1.0;
        this.hp = Math.max(0, this.hp - amount * mult);
    }


    toggleFlashlight() {
        this.flashlightOn = !this.flashlightOn;
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    addBloodSplatter(count = 1) {
        for (let i = 0; i < count; i++) {
            this.bloodTrail.push({
                x: this.x + (Math.random() - 0.5) * 18,
                y: this.y + (Math.random() - 0.5) * 18,
                r: 3 + Math.random() * 5,
                alpha: 0.75
            });
            if (this.bloodTrail.length > 110) {
                this.bloodTrail.shift();
            }
        }
    }

    update(dt, input, world, building, lootBoxes, camera, canvasWidth, canvasHeight, isGrabbed = false) {
        if (isGrabbed || this.hp <= 0) return;

        if (this.hp < 75) {
            this.bleedTimer -= dt;
            if (this.bleedTimer <= 0) {
                this.addBloodSplatter(1);
                this.bleedTimer = 0.25 + (this.hp / 75) * 0.9;
            }
        }

        const { dx, dy } = input.getMovementVector();
        const isMoving = Math.hypot(dx, dy) > 0;

        if (input.isSprinting() && isMoving && !this.exhausted && this.stamina > 0) {
            this.isSprinting = true;
            this.stamina -= 32 * dt;
            if (this.stamina <= 0) {
                this.stamina = 0;
                this.isSprinting = false;
                this.exhausted = true;
            }
            } else {
            this.isSprinting = false;
            const regenMult = this.equipment ? this.equipment.getStaminaRegenBonus() : 1.0;
            this.stamina = Math.min(CONFIG.MAX_STAMINA, this.stamina + 20 * regenMult * dt);
            if (this.exhausted && this.stamina >= 25) {
                this.exhausted = false;
            }
        }

        const healthFactor = this.hp < 50 ? (0.62 + (this.hp / 50) * 0.38) : 1.0;
        const baseSpeed = this.isSprinting ? CONFIG.SPRINT_SPEED : CONFIG.WALK_SPEED;
        const currentSpeed = baseSpeed * healthFactor * dt;

        const nextX = this.x + dx * currentSpeed;
        if (!this.checkCollision(nextX, this.y, world, building, lootBoxes)) {
            this.x = nextX;
        }

        const nextY = this.y + dy * currentSpeed;
        if (!this.checkCollision(this.x, nextY, world, building, lootBoxes)) {
            this.y = nextY;
        }

        const playerScreenX = (this.x - camera.x) + canvasWidth / 2;
        const playerScreenY = (this.y - camera.y) + canvasHeight / 2;
        this.angle = Math.atan2(input.mouse.y - playerScreenY, input.mouse.x - playerScreenX);
    }

    checkCollision(x, y, world, building, lootBoxes) {
        const r = this.radius;
        const ts = CONFIG.TILE_SIZE;

        const points = [
            { x: x - r, y: y - r },
            { x: x + r, y: y - r },
            { x: x - r, y: y + r },
            { x: x + r, y: y + r }
        ];

        const hitWall = points.some(p => {
            const tileX = Math.floor(p.x / ts);
            const tileY = Math.floor(p.y / ts);
            return world.isWall(tileX, tileY) || (building && building.isSolid(tileX, tileY));
        });

        if (hitWall) return true;
        if (lootBoxes && lootBoxes.isBoxBlocking(x, y, r, world)) return true;

        return false;
    }

    drawBloodTrail(ctx) {
        if (this.bloodTrail.length === 0) return;
        ctx.save();
        for (const drop of this.bloodTrail) {
            ctx.fillStyle = `rgba(115, 12, 12, ${drop.alpha})`;
            ctx.beginPath();
            ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    draw(ctx, color = CONFIG.COLORS.PLAYER, name = '') {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = this.flashlightOn ? '#fef08a' : '#64748b';
        ctx.fillRect(this.radius - 6, -4, 12, 8);

        ctx.restore();

        if (name) {
            ctx.save();
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.fillText(name, this.x, this.y - this.radius - 8);
            ctx.restore();
        }
    }
}
