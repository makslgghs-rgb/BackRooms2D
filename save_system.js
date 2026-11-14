export class SaveSystem {
    constructor() {
        this.prefix = 'backrooms_world_save_v1_';
        this.autoSaveTimer = 0;
        this.statusText = '';
        this.statusTimer = 0;
    }

    getKey(username) {
        return this.prefix + (username || 'guest').toLowerCase();
    }

    hasSave(username) {
        return Boolean(localStorage.getItem(this.getKey(username)));
    }

    notify(text) {
        this.statusText = text;
        this.statusTimer = 2.5;
    }

    update(dt, username, gameState) {
        if (this.statusTimer > 0) this.statusTimer -= dt;

        // Автосохранение каждые 30 секунд
        this.autoSaveTimer += dt;
        if (this.autoSaveTimer >= 30) {
            this.autoSaveTimer = 0;
            this.save(username, gameState, true);
        }
    }

    save(username, { world, player, inventory, equipment, building, lootBoxes, droppedItems, gameTime }, silent = false) {
        try {
            const payload = {
                savedAt: Date.now(),
                seed: world.seed,
                gameTime: { ...gameTime },
                player: {
                    x: player.x,
                    y: player.y,
                    angle: player.angle,
                    hp: player.hp,
                    stamina: player.stamina,
                    flashlightOn: player.flashlightOn,
                    bloodTrail: player.bloodTrail.slice(-60)
                },
                inventory: {
                    maxSlots: inventory.maxSlots,
                    selectedSlot: inventory.selectedSlot,
                    slots: inventory.slots
                },
                equipment: { ...equipment.slots },
                structures: Array.from(building.structures.values()),
                openedBoxes: Array.from(lootBoxes.opened),
                droppedItems: droppedItems.items
            };

            localStorage.setItem(this.getKey(username), JSON.stringify(payload));
            if (!silent) this.notify('МИР СОХРАНЁН');
            return true;
        } catch (e) {
            console.error('Ошибка сохранения мира:', e);
            return false;
        }
    }

    load(username, { world, player, inventory, equipment, building, lootBoxes, droppedItems, gameTime, camera }) {
        try {
            const raw = localStorage.getItem(this.getKey(username));
            if (!raw) return false;
            const data = JSON.parse(raw);

            if (data.seed !== undefined) {
                world.seed = data.seed;
                if (world.chunks && typeof world.chunks.clear === 'function') world.chunks.clear();
            }
            if (data.gameTime) Object.assign(gameTime, data.gameTime);

            if (data.player) {
                player.x = data.player.x ?? 32;
                player.y = data.player.y ?? 32;
                player.angle = data.player.angle ?? 0;
                player.hp = data.player.hp ?? 100;
                player.stamina = data.player.stamina ?? 100;
                player.flashlightOn = data.player.flashlightOn ?? true;
                player.bloodTrail = Array.isArray(data.player.bloodTrail) ? data.player.bloodTrail : [];
                camera.x = player.x;
                camera.y = player.y;
            }

            if (data.inventory) {
                inventory.maxSlots = data.inventory.maxSlots || 5;
                inventory.selectedSlot = data.inventory.selectedSlot || 0;
                inventory.slots = data.inventory.slots || new Array(8).fill(null);
            }

            if (data.equipment) {
                Object.assign(equipment.slots, data.equipment);
                inventory.setMaxSlots(5 + equipment.getExtraSlots());
            }

            building.structures.clear();
            if (Array.isArray(data.structures)) {
                for (const s of data.structures) {
                    building.structures.set(`${s.tileX},${s.tileY}`, s);
                }
            }

            lootBoxes.opened = new Set(data.openedBoxes || []);
            lootBoxes.roomCache.clear();

            if (Array.isArray(data.droppedItems)) {
                droppedItems.items = data.droppedItems;
            }

            this.notify('МИР ЗАГРУЖЕН');
            return true;
        } catch (e) {
            console.error('Ошибка загрузки мира:', e);
            return false;
        }
    }

    deleteSave(username) {
        localStorage.removeItem(this.getKey(username));
    }

    drawStatus(ctx, width) {
        if (this.statusTimer <= 0 || !this.statusText) return;
        ctx.save();
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = `rgba(74, 222, 128, ${Math.min(1, this.statusTimer)})`;
        ctx.fillText(`● ${this.statusText}`, width - 24, 62);
        ctx.restore();
    }
}
