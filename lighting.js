import { CONFIG } from './config.js';

export class Lighting {
    constructor() {
        this.lightCanvas = document.createElement('canvas');
        this.lCtx = this.lightCanvas.getContext('2d');
        
        this.rayCount = 95;
        this.fov = Math.PI * 0.42;
        this.eyeFov = Math.PI * 0.65;
        this.maxDist = 460;
        this.eyeDist = 450;
        this.ambientRadius = 42;
    }

    resize(width, height) {
        this.lightCanvas.width = width;
        this.lightCanvas.height = height;
    }

    castRay(startX, startY, angle, maxDist, world, building = null) {
        if (!Number.isFinite(startX) || !Number.isFinite(startY) || !Number.isFinite(angle) || maxDist <= 1) {
            return { x: startX || 0, y: startY || 0 };
        }

        const ts = CONFIG.TILE_SIZE;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        let mapX = Math.floor(startX / ts);
        let mapY = Math.floor(startY / ts);

        const deltaDistX = Math.abs(1 / (Math.abs(dirX) < 1e-6 ? 1e-6 : dirX));
        const deltaDistY = Math.abs(1 / (Math.abs(dirY) < 1e-6 ? 1e-6 : dirY));

        let stepX, stepY, sideDistX, sideDistY;

        if (dirX < 0) {
            stepX = -1;
            sideDistX = (startX / ts - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1.0 - startX / ts) * deltaDistX;
        }

        if (dirY < 0) {
            stepY = -1;
            sideDistY = (startY / ts - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1.0 - startY / ts) * deltaDistY;
        }

        let dist = 0;
        const maxSteps = Math.min(Math.ceil(maxDist / ts) * 3 + 4, 64);

        for (let i = 0; i !== maxSteps; i++) {
            if (sideDistX < sideDistY) {
                dist = sideDistX * ts;
                sideDistX += deltaDistX;
                mapX += stepX;
            } else {
                dist = sideDistY * ts;
                sideDistY += deltaDistY;
                mapY += stepY;
            }

            if (dist >= maxDist) {
                return { x: startX + dirX * maxDist, y: startY + dirY * maxDist };
            }

            const blocked = world.isWall(mapX, mapY) || (building && building.blocksLight(mapX, mapY));
            if (blocked) {
                return { x: startX + dirX * dist, y: startY + dirY * dist };
            }
        }

        return { x: startX + dirX * maxDist, y: startY + dirY * maxDist };
    }

    isPointVisible(targetX, targetY, player, world, building, gameTime) {
        const dx = targetX - player.x;
        const dy = targetY - player.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= this.ambientRadius) return true;

        const isNight = gameTime.isNight();
        const angleToTarget = Math.atan2(dy, dx);
        const angleDiff = Math.abs(Math.atan2(
            Math.sin(angleToTarget - player.angle),
            Math.cos(angleToTarget - player.angle)
        ));

        const hasLight = typeof player.hasAnyLight === 'function' ? player.hasAnyLight() : player.flashlightOn;
        const inFlashlight = hasLight && dist <= this.maxDist && angleDiff <= this.fov * 0.5;
        const inDayVision = !isNight && dist <= this.eyeDist && angleDiff <= this.eyeFov * 0.5;

        let inLampLight = false;
        for (const lamp of building.getLightSources()) {
            if (Math.hypot(targetX - lamp.x, targetY - lamp.y) <= lamp.radius) {
                inLampLight = true;
                break;
            }
        }

        if (!inFlashlight && !inDayVision && !inLampLight) return false;

        const hit = this.castRay(player.x, player.y, angleToTarget, dist, world, building);
        return Math.hypot(hit.x - player.x, hit.y - player.y) >= dist - 14;
    }

    getRayPolygon(player, world, building, fov, dist) {
        const points = [];
        const startAngle = player.angle - fov / 2;
        const step = fov / this.rayCount;

        for (let i = 0; i <= this.rayCount; i++) {
            const rayAngle = startAngle + i * step;
            points.push(this.castRay(player.x, player.y, rayAngle, dist, world, building));
        }
        return points;
    }
    fillWallInteriors(ctx, camera, world, width, height) {
        const ts = CONFIG.TILE_SIZE;
        const startCol = Math.floor((camera.x - width / 2) / ts) - 2;
        const endCol = Math.ceil((camera.x + width / 2) / ts) + 2;
        const startRow = Math.floor((camera.y - height / 2) / ts) - 2;
        const endRow = Math.ceil((camera.y + height / 2) / ts) + 2;

        const layers = [
            { inset: 7,  fill: 'rgba(6, 5, 2, 0.26)', blur: 12, shadow: 'rgba(6, 5, 2, 0.32)' },
            { inset: 14, fill: 'rgba(6, 5, 2, 0.38)', blur: 10, shadow: 'rgba(6, 5, 2, 0.45)' },
            { inset: 21, fill: 'rgba(6, 5, 2, 0.65)', blur: 8,  shadow: 'rgba(6, 5, 2, 0.65)' }
        ];

        ctx.save();
        for (const layer of layers) {
            ctx.fillStyle = layer.fill;
            ctx.shadowColor = layer.shadow;
            ctx.shadowBlur = layer.blur;

            ctx.beginPath();
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    if (!world.isWall(col, row)) continue;

                    const top = world.isWall(col, row - 1) ? 0 : layer.inset;
                    const bottom = world.isWall(col, row + 1) ? 0 : layer.inset;
                    const left = world.isWall(col - 1, row) ? 0 : layer.inset;
                    const right = world.isWall(col + 1, row) ? 0 : layer.inset;

                    const x = col * ts + left;
                    const y = row * ts + top;
                    const w = ts - left - right;
                    const h = ts - top - bottom;

                    if (w !== 0 && h !== 0 && w > 0 && h > 0) ctx.rect(x, y, w, h);
                }
            }
            ctx.fill();
        }
        ctx.restore();
    }

    render(mainCtx, camera, world, building, players, gameTime, width, height) {
        if (this.lightCanvas.width !== width || this.lightCanvas.height !== height) {
            this.resize(width, height);
        }

        const ctx = this.lCtx;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, width, height);

        const fogAlpha = gameTime.isNight() ? 1.0 : 0.58;
        ctx.fillStyle = `rgba(10, 9, 3, ${fogAlpha})`;
        ctx.fillRect(0, 0, width, height);

        camera.apply(ctx, width, height);
        ctx.globalCompositeOperation = 'destination-out';

        for (const lamp of building.getLightSources()) {
            const grad = ctx.createRadialGradient(lamp.x, lamp.y, 10, lamp.x, lamp.y, lamp.radius);
            grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
            grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.75)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(lamp.x, lamp.y, lamp.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        const flashlightPolygons = new Map();
        const isNight = gameTime.isNight();

        for (const p of players) {
            const ambientGrad = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, this.ambientRadius);
            ambientGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
            ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = ambientGrad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.ambientRadius, 0, Math.PI * 2);
            ctx.fill();

            if (!isNight) {
                const eyePoly = this.getRayPolygon(p, world, building, this.eyeFov, this.eyeDist);
                const eyeGrad = ctx.createRadialGradient(p.x, p.y, 15, p.x, p.y, this.eyeDist);
                eyeGrad.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
                eyeGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.8)');
                eyeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = eyeGrad;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                for (const pt of eyePoly) ctx.lineTo(pt.x, pt.y);
                ctx.closePath();
                ctx.fill();
            }

            const hasLight = typeof p.hasAnyLight === 'function' ? p.hasAnyLight() : p.flashlightOn;
            if (hasLight) {
                const poly = this.getRayPolygon(p, world, building, this.fov, this.maxDist);
                flashlightPolygons.set(p, poly);

                const coneGrad = ctx.createRadialGradient(p.x, p.y, 15, p.x, p.y, this.maxDist);
                coneGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                coneGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.88)');
                coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = coneGrad;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                for (const pt of poly) ctx.lineTo(pt.x, pt.y);
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.globalCompositeOperation = 'source-over';
        this.fillWallInteriors(ctx, camera, world, width, height);

        ctx.restore();
        mainCtx.drawImage(this.lightCanvas, 0, 0);

        this.drawVolumetricGlow(mainCtx, camera, world, building, players, flashlightPolygons, isNight, width, height);
    }

    drawVolumetricGlow(mainCtx, camera, world, building, players, polygons, isNight, width, height) {
        mainCtx.save();
        camera.apply(mainCtx, width, height);
        mainCtx.globalCompositeOperation = 'screen';

        for (const lamp of building.getLightSources()) {
            const glow = mainCtx.createRadialGradient(lamp.x, lamp.y, 5, lamp.x, lamp.y, lamp.radius * 0.85);
            glow.addColorStop(0, 'rgba(255, 245, 180, 0.28)');
            glow.addColorStop(1, 'rgba(255, 245, 180, 0)');
            mainCtx.fillStyle = glow;
            mainCtx.beginPath();
            mainCtx.arc(lamp.x, lamp.y, lamp.radius * 0.85, 0, Math.PI * 2);
            mainCtx.fill();
        }

        for (const p of players) {
            const hasLight = typeof p.hasAnyLight === 'function' ? p.hasAnyLight() : p.flashlightOn;
            if (!hasLight) continue;
            const poly = polygons.get(p);
            if (!poly) continue;

            const alphaStart = isNight ? 0.22 : 0.34;
            const glow = mainCtx.createRadialGradient(p.x, p.y, 8, p.x, p.y, this.maxDist * 0.95);
            glow.addColorStop(0, `rgba(255, 253, 225, ${alphaStart})`);
            glow.addColorStop(0.55, `rgba(255, 245, 190, ${alphaStart * 0.45})`);
            glow.addColorStop(1, 'rgba(255, 245, 190, 0)');

            mainCtx.fillStyle = glow;
            mainCtx.beginPath();
            mainCtx.moveTo(p.x, p.y);
            for (const pt of poly) mainCtx.lineTo(pt.x, pt.y);
            mainCtx.closePath();
            mainCtx.fill();
        }

        mainCtx.globalCompositeOperation = 'source-over';
        this.fillWallInteriors(mainCtx, camera, world, width, height);

        mainCtx.restore();
    }
}
