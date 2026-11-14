import { CONFIG } from './config.js';

export class DustSystem {
    constructor() {
        this.particles = [];
        this.count = 110;
        this.initialized = false;
    }

    init(cameraX, cameraY) {
        this.particles = [];
        for (let i = 0; i < this.count; i++) {
            this.particles.push(this.createParticle(cameraX, cameraY));
        }
        this.initialized = true;
    }

    createParticle(cx, cy) {
        return {
            x: cx + (Math.random() - 0.5) * 1400,
            y: cy + (Math.random() - 0.5) * 1000,
            vx: (Math.random() - 0.5) * 14,
            vy: (Math.random() - 0.5) * 14 - 4,
            size: Math.random() * 1.9 + 0.9,
            phase: Math.random() * Math.PI * 2
        };
    }

    update(dt, camera) {
        if (!this.initialized) this.init(camera.x, camera.y);

        for (const p of this.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.phase += dt * 3;

            if (p.x < camera.x - 750) p.x += 1500;
            if (p.x > camera.x + 750) p.x -= 1500;
            if (p.y < camera.y - 550) p.y += 1100;
            if (p.y > camera.y + 550) p.y -= 1100;
        }
    }

    draw(ctx, players, lighting, world, isNight) {
        const ts = CONFIG.TILE_SIZE;
        ctx.save();

        for (const p of this.particles) {
            if (world.isWall(Math.floor(p.x / ts), Math.floor(p.y / ts))) continue;

            let brightness = isNight ? 0.0 : 0.14;

            for (const player of players) {
                if (!player.flashlightOn) continue;

                const dx = p.x - player.x;
                const dy = p.y - player.y;
                const dist = Math.hypot(dx, dy);

                if (dist > 4 && dist < lighting.maxDist) {
                    const angleToParticle = Math.atan2(dy, dx);
                    // Безопасная нормализация разницы углов без цикла while
                    const angleDiff = Math.atan2(
                        Math.sin(angleToParticle - player.angle),
                        Math.cos(angleToParticle - player.angle)
                    );

                    if (Math.abs(angleDiff) < lighting.fov * 0.5) {
                        const hit = lighting.castRay(player.x, player.y, angleToParticle, dist, world);
                        const hitDist = Math.hypot(hit.x - player.x, hit.y - player.y);
                        
                        if (hitDist >= dist - 8) {
                            const distFactor = 1 - dist / lighting.maxDist;
                            brightness = Math.max(brightness, 0.4 + distFactor * 0.6);
                        }
                    }
                }
            }

            if (brightness > 0.02) {
                const twinkle = 0.75 + Math.sin(p.phase) * 0.25;
                ctx.fillStyle = `rgba(255, 252, 220, ${brightness * twinkle})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}
