import { CONFIG } from './config.js';
import { ITEMS } from './build_items.js';

export class BuildingSystem {
    constructor() {
        this.structures = new Map();
        this.buildMode = false;
        this.maxBuildDist = 180;
    }

    toggleBuildMode() {
        this.buildMode = !this.buildMode;
    }

    getKey(tileX, tileY) {
        return `${tileX},${tileY}`;
    }

    getAt(tileX, tileY) {
        return this.structures.get(this.getKey(tileX, tileY)) || null;
    }

    isSolid(tileX, tileY) {
        const struct = this.getAt(tileX, tileY);
        if (!struct) return false;
        if (struct.id === 'door' && struct.open) return false; // Открытая дверь пропускает!
        const def = ITEMS[struct.id];
        return Boolean(def && def.solid);
    }

    blocksLight(tileX, tileY) {
        const struct = this.getAt(tileX, tileY);
        if (!struct) return false;
        if (struct.id === 'door' && struct.open) return false; // Открытая дверь пропускает свет!
        const def = ITEMS[struct.id];
        return Boolean(def && def.blocksLight);
    }

    getLightSources() {
        const ts = CONFIG.TILE_SIZE;
        const lights = [];
        for (const s of this.structures.values()) {
            const def = ITEMS[s.id];
            if (def && def.emitsLight) {
                if (s.id === 'generator' && (!s.active || (s.fuel || 0) <= 0)) continue;
                lights.push({
                    x: s.tileX * ts + ts / 2,
                    y: s.tileY * ts + ts / 2,
                    radius: def.lightRadius || 180
                });
            }
        }
        return lights;
    }

    getTargetTile(input, camera, canvasWidth, canvasHeight) {
        const worldX = (input.mouse.x - canvasWidth / 2) + camera.x;
        const worldY = (input.mouse.y - canvasHeight / 2) + camera.y;
        const ts = CONFIG.TILE_SIZE;

        return {
            tileX: Math.floor(worldX / ts),
            tileY: Math.floor(worldY / ts)
        };
    }

    canPlace(tileX, tileY, player, world, lootBoxes) {
        const ts = CONFIG.TILE_SIZE;
        const cellCenterX = tileX * ts + ts / 2;
        const cellCenterY = tileY * ts + ts / 2;

        if (Math.hypot(cellCenterX - player.x, cellCenterY - player.y) > this.maxBuildDist) {
            return false;
        }
        if (world.isWall(tileX, tileY) || this.getAt(tileX, tileY)) {
            return false;
        }
        if (lootBoxes && lootBoxes.isBoxBlocking(cellCenterX, cellCenterY, ts * 0.4, world)) {
            return false;
        }
        const playerTileX = Math.floor(player.x / ts);
        const playerTileY = Math.floor(player.y / ts);
        if (tileX === playerTileX && tileY === playerTileY) {
            return false;
        }

        return true;
    }

        place(tileX, tileY, itemId) {
        const def = ITEMS[itemId];
        if (!def || def.type !== 'build') return null;

        const data = {
            id: def.id,
            tileX,
            tileY,
            hp: def.maxHp,
            open: false,
            active: itemId !== 'generator', // Генератор при установке пустой, ждёт Миндальную воду!
            fuel: 0,
            powered: false,
            text: ''
        };
        this.structures.set(this.getKey(tileX, tileY), data);
        return data;
    }


    remove(tileX, tileY) {
        const key = this.getKey(tileX, tileY);
        const existing = this.structures.get(key);
        if (!existing) return null;
        this.structures.delete(key);
        return existing;
    }

    drawStructures(ctx, camera, canvasWidth, canvasHeight) {
        const ts = CONFIG.TILE_SIZE;
        for (const s of this.structures.values()) {
            const x = s.tileX * ts;
            const y = s.tileY * ts;

            if (Math.abs(x - camera.x) > canvasWidth && Math.abs(y - camera.y) > canvasHeight) {
                continue;
            }

            const def = ITEMS[s.id];
            if (def) def.draw(ctx, x, y, ts, s);
        }
    }

    drawPreview(ctx, input, player, world, lootBoxes, inventory, camera, canvasWidth, canvasHeight) {
        if (!this.buildMode || !inventory || typeof inventory.getSelected !== 'function') return;

        const selected = inventory.getSelected();
        if (!selected) return;
        const item = ITEMS[selected.id];
        if (!item || item.type !== 'build') return;

        const { tileX, tileY } = this.getTargetTile(input, camera, canvasWidth, canvasHeight);
        const ts = CONFIG.TILE_SIZE;
        const x = tileX * ts;
        const y = tileY * ts;
        const valid = this.canPlace(tileX, tileY, player, world, lootBoxes);

        ctx.save();
        ctx.globalAlpha = 0.55;
        item.draw(ctx, x, y, ts);

        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = valid ? '#4ade80' : '#ef4444';
        ctx.fillStyle = valid ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.2)';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, ts, ts);
        ctx.strokeRect(x, y, ts, ts);
        ctx.restore();
    }
}
