import { CONFIG } from './config.js';

export class LootBoxSystem {
    constructor() {
        this.opened = new Set();
        this.roomCache = new Map();
        this.interactDist = 85;
        this.notification = '';
        this.notifyTimer = 0;
    }

    getBoxInRoom(roomX, roomY, world) {
        const key = `${roomX},${roomY}`;
        if (this.roomCache.has(key)) return this.roomCache.get(key);

        if (Math.abs(roomX) === 0 && Math.abs(roomY) === 0) {
            this.roomCache.set(key, null);
            return null;
        }

        if (world.hash(roomX, roomY, 701) > 0.24) {
            this.roomCache.set(key, null);
            return null;
        }

        const roomSize = 8;
        const ts = CONFIG.TILE_SIZE;
        const baseTileX = roomX * roomSize;
        const baseTileY = roomY * roomSize;

        const corners = [];
        const openSpots = [];

        for (let ly = 1; ly < roomSize - 1; ly++) {
            for (let lx = 1; lx < roomSize - 1; lx++) {
                const tx = baseTileX + lx;
                const ty = baseTileY + ly;
                if (world.isWall(tx, ty)) continue;

                const wN = world.isWall(tx, ty - 1);
                const wS = world.isWall(tx, ty + 1);
                const wW = world.isWall(tx - 1, ty);
                const wE = world.isWall(tx + 1, ty);

                if ((wN || wS) && (wW || wE)) {
                    const pushX = wW ? -10 : 10;
                    const pushY = wN ? -10 : 10;
                    corners.push({ tx, ty, pushX, pushY });
                } else if (!wN && !wS && !wW && !wE && lx >= 2 && lx <= 5 && ly >= 2 && ly <= 5) {
                    openSpots.push({ tx, ty });
                }
            }
        }

        let box = null;

        if (corners.length > 0 && world.hash(roomX, roomY, 702) < 0.7) {
            const idx = Math.floor(world.hash(roomX, roomY, 703) * corners.length);
            const c = corners[idx];
            box = {
                id: `${roomX},${roomY}`,
                x: c.tx * ts + ts / 2 + c.pushX + (world.hash(roomX, roomY, 704) - 0.5) * 8,
                y: c.ty * ts + ts / 2 + c.pushY + (world.hash(roomX, roomY, 705) - 0.5) * 8,
                angle: (world.hash(roomX, roomY, 706) - 0.5) * 0.65,
                size: 34
            };
        } else if (openSpots.length > 0) {
            const idx = Math.floor(world.hash(roomX, roomY, 707) * openSpots.length);
            const s = openSpots[idx];
            box = {
                id: `${roomX},${roomY}`,
                x: s.tx * ts + ts / 2 + (world.hash(roomX, roomY, 708) - 0.5) * 24,
                y: s.ty * ts + ts / 2 + (world.hash(roomX, roomY, 709) - 0.5) * 24,
                angle: world.hash(roomX, roomY, 710) * Math.PI * 2,
                size: 38
            };
        }

        this.roomCache.set(key, box);
        return box;
    }

    isBoxBlocking(worldX, worldY, radius, world) {
        const roomSize = 8;
        const ts = CONFIG.TILE_SIZE;
        const rX = Math.floor(worldX / (ts * roomSize));
        const rY = Math.floor(worldY / (ts * roomSize));

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const box = this.getBoxInRoom(rX + dx, rY + dy, world);
                if (!box) continue;
                const minDist = radius + box.size * 0.45;
                if (Math.hypot(worldX - box.x, worldY - box.y) < minDist) {
                    return true;
                }
            }
        }
        return false;
    }

    getNearbyBox(player, world) {
        const roomSize = 8;
        const ts = CONFIG.TILE_SIZE;
        const pRoomX = Math.floor(player.x / (ts * roomSize));
        const pRoomY = Math.floor(player.y / (ts * roomSize));

        let closest = null;
        let minDist = this.interactDist;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const box = this.getBoxInRoom(pRoomX + dx, pRoomY + dy, world);
                if (!box || this.opened.has(box.id)) continue;

                const dist = Math.hypot(box.x - player.x, box.y - player.y);
                if (dist < minDist) {
                    minDist = dist;
                    closest = box;
                }
            }
        }
        return closest;
    }

    tryOpen(player, world, inventory) {
        const box = this.getNearbyBox(player, world);
        if (!box) return null;

        this.opened.add(box.id);

        const lootTable = [
            { id: 'barricade', name: 'Доски', min: 1, max: 3 },
            { id: 'scrap', name: 'Металл', min: 1, max: 2 },
            { id: 'wire', name: 'Провода', min: 1, max: 2 },
            { id: 'sand_bag', name: 'Песок', min: 1, max: 3 },
            { id: 'battery', name: 'Батарея', min: 1, max: 2 },
            { id: 'cloth', name: 'Ткань', min: 1, max: 2 },
            { id: 'almond_water', name: 'Вода', min: 1, max: 1 },
            { id: 'wall_block', name: 'Плита', min: 1, max: 1 }
        ];

        const foundText = [];
        const dropsCount = 2; // В каждом ящике лежит 2 случайных типа ресурсов

        for (let i = 0; i < dropsCount; i++) {
            const pick = lootTable[Math.floor(Math.random() * lootTable.length)];
            const amount = pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1));
            if (inventory.addItem(pick.id, amount)) {
                foundText.push(`${pick.name} x${amount}`);
            }
        }

        this.notification = foundText.length > 0
            ? `Найдено: ${foundText.join(', ')}`
            : 'Инвентарь полон!';
        this.notifyTimer = 3.0;

        return box.id;
    }

    update(dt) {
        if (this.notifyTimer > 0) this.notifyTimer -= dt;
    }

    draw(ctx, camera, world, player, canvasWidth, canvasHeight) {
        const roomSize = 8;
        const ts = CONFIG.TILE_SIZE;
        const sectorPx = roomSize * ts;

        const startRX = Math.floor((camera.x - canvasWidth / 2) / sectorPx) - 1;
        const endRX = Math.ceil((camera.x + canvasWidth / 2) / sectorPx) + 1;
        const startRY = Math.floor((camera.y - canvasHeight / 2) / sectorPx) - 1;
        const endRY = Math.ceil((camera.y + canvasHeight / 2) / sectorPx) + 1;

        for (let ry = startRY; ry <= endRY; ry++) {
            for (let rx = startRX; rx <= endRX; rx++) {
                const box = this.getBoxInRoom(rx, ry, world);
                if (!box) continue;

                const opened = this.opened.has(box.id);
                const half = box.size / 2;

                ctx.save();
                ctx.translate(box.x, box.y);
                ctx.rotate(box.angle);

                ctx.fillStyle = 'rgba(20, 16, 4, 0.35)';
                ctx.fillRect(-half + 3, -half + 3, box.size, box.size);

                ctx.fillStyle = opened ? '#574632' : '#9c784c';
                ctx.strokeStyle = '#3b2b18';
                ctx.lineWidth = 2;
                ctx.fillRect(-half, -half, box.size, box.size);
                ctx.strokeRect(-half, -half, box.size, box.size);

                if (!opened) {
                    ctx.fillStyle = 'rgba(235, 220, 175, 0.55)';
                    ctx.fillRect(-3, -half + 1, 6, box.size - 2);
                } else {
                    ctx.fillStyle = '#291f14';
                    ctx.fillRect(-2, -half + 2, 4, box.size - 4);
                }

                ctx.restore();
            }
        }

        const nearby = this.getNearbyBox(player, world);
        if (nearby) {
            ctx.save();
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fef08a';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;
            ctx.fillText('[E] Обыскать', nearby.x, nearby.y - 26);
            ctx.restore();
        }
    }

    drawNotification(ctx, canvasWidth, canvasHeight) {
        if (this.notifyTimer <= 0 || !this.notification) return;

        ctx.save();
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(254, 240, 138, ${Math.min(1, this.notifyTimer)})`;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText(this.notification, canvasWidth / 2, canvasHeight - 115);
        ctx.restore();
    }
}
