import { CONFIG } from './config.js';

export class InteractableSystem {
    constructor() {
        this.activeJournal = null;
        this.journalOverlay = this.createJournalUI();
        this.powerRadius = 320;
    }

    createJournalUI() {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.82);
            display: none; align-items: center; justify-content: center;
            z-index: 120; font-family: monospace; color: #fef08a;
        `;
        div.innerHTML = `
            <div style="width:460px; background:#14130a; border:2px solid #8c8132; padding:20px;">
                <div style="font-size:18px; font-weight:bold; margin-bottom:10px;">ЖУРНАЛ ЭКСПЕДИЦИИ // ASYNC</div>
                <textarea id="journalText" rows="8" style="
                    width:100%; background:#09090b; color:#f4f4f5; border:1px solid #8c8132;
                    padding:10px; font-family:monospace; font-size:14px; resize:none;
                " placeholder="Запиши координаты базы, время и предупреждения для других..."></textarea>
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:12px;">
                    <button id="btnSaveJournal" style="
                        padding:8px 16px; background:#8c8132; color:#000; border:none;
                        font-family:monospace; font-weight:bold; cursor:pointer;
                    ">СОХРАНИТЬ И ЗАКРЫТЬ</button>
                </div>
            </div>
        `;
        document.body.appendChild(div);

        div.querySelector('#btnSaveJournal').onclick = () => {
            if (this.activeJournal) {
                this.activeJournal.text = div.querySelector('#journalText').value;
                this.activeJournal = null;
            }
            div.style.display = 'none';
        };
        return div;
    }

    isJournalOpen() {
        return Boolean(this.activeJournal);
    }

    isPowered(worldX, worldY, building) {
        const ts = CONFIG.TILE_SIZE;
        for (const s of building.structures.values()) {
            if (s.id === 'generator' && s.active && (s.fuel || 0) !== 0) {
                const gx = s.tileX * ts + ts / 2;
                const gy = s.tileY * ts + ts / 2;
                if (Math.hypot(worldX - gx, worldY - gy) <= this.powerRadius) {
                    return true;
                }
            }
        }
        return false;
    }

    getNearbyStructure(player, building) {
        const ts = CONFIG.TILE_SIZE;
        let closest = null;
        let minDist = 88;

        for (const s of building.structures.values()) {
            const cx = s.tileX * ts + ts / 2;
            const cy = s.tileY * ts + ts / 2;
            const dist = Math.hypot(cx - player.x, cy - player.y);
            if (dist <= minDist) {
                minDist = dist;
                closest = { struct: s, x: cx, y: cy };
            }
        }
        return closest;
    }

    interact(player, building, crafting, inventory, storage) {
        const near = this.getNearbyStructure(player, building);
        if (!near) return false;

        const s = near.struct;
        if (s.id === 'door') {
            s.open = !s.open;
            return true;
        }
        if (s.id === 'generator') {
            if (inventory && inventory.countItem('almond_water') !== 0 && (s.fuel || 0) <= 85) {
                inventory.removeItem('almond_water', 1);
                s.fuel = Math.min(100, (s.fuel || 0) + 50);
                s.active = true;
            } else if ((s.fuel || 0) !== 0) {
                s.active = !s.active;
            }
            return true;
        }
        if (s.id === 'water_collector') {
            if ((s.water || 0) >= 1 && inventory && inventory.addItem('clean_water', 1)) {
                s.water -= 1;
            }
            return true;
        }
        if (s.id === 'wooden_crate' || s.id === 'metal_locker') {
            if (storage) storage.open(s);
            return true;
        }
        if (s.id === 'workbench' || s.id === 'tailor_table' || s.id === 'metal_bench') {
            crafting.isOpen = true;
            return true;
        }
        if (s.id === 'journal') {
            this.activeJournal = s;
            this.journalOverlay.querySelector('#journalText').value = s.text || '';
            this.journalOverlay.style.display = 'flex';
            return true;
        }
        return false;
    }

    update(dt, player, building, crafting, entity) {
        const ts = CONFIG.TILE_SIZE;
        let hasWorkbench = false;
        let hasPoweredTailor = false;
        let hasPoweredMetal = false;

        for (const s of building.structures.values()) {
            const cx = s.tileX * ts + ts / 2;
            const cy = s.tileY * ts + ts / 2;

            if (s.id === 'generator' && s.active) {
                s.fuel = Math.max(0, (s.fuel || 0) - 0.65 * dt);
                if (s.fuel === 0) s.active = false;
            }

            if (s.id === 'water_collector') {
                s.powered = this.isPowered(cx, cy, building);
                if (s.powered && (s.water || 0) !== 3) {
                    s.water = Math.min(3, (s.water || 0) + 0.045 * dt);
                }
            }

            if (s.id === 'workbench' && Math.hypot(cx - player.x, cy - player.y) <= 115) {
                hasWorkbench = true;
            }

            if (s.id === 'tailor_table') {
                s.powered = this.isPowered(cx, cy, building);
                if (s.powered && Math.hypot(cx - player.x, cy - player.y) <= 115) {
                    hasPoweredTailor = true;
                }
            }

            if (s.id === 'metal_bench') {
                s.powered = this.isPowered(cx, cy, building);
                if (s.powered && Math.hypot(cx - player.x, cy - player.y) <= 115) {
                    hasPoweredMetal = true;
                }
            }

            if (s.id === 'spike_trap' && entity && entity.state !== 'DORMANT') {
                if (Math.hypot(cx - entity.x, cy - entity.y) <= 34) {
                    entity.onPlayerEscaped();
                    building.remove(s.tileX, s.tileY);
                }
            }
        }

        crafting.nearWorkbench = hasWorkbench;
        crafting.nearTailor = hasPoweredTailor;
        crafting.nearMetalBench = hasPoweredMetal;
    }

    drawPowerCables(ctx, building) {
        const ts = CONFIG.TILE_SIZE;
        const generators = [];
        const consumers = [];

        for (const s of building.structures.values()) {
            const pos = { x: s.tileX * ts + ts / 2, y: s.tileY * ts + ts / 2 };
            if (s.id === 'generator' && s.active && (s.fuel || 0) !== 0) generators.push(pos);
            if (s.id === 'tailor_table' || s.id === 'metal_bench' || s.id === 'water_collector') consumers.push(pos);
        }

        ctx.save();
        for (const g of generators) {
            for (const c of consumers) {
                if (Math.hypot(g.x - c.x, g.y - c.y) <= this.powerRadius) {
                    ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(g.x, g.y);
                    ctx.lineTo(c.x, c.y);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
    }

    drawHint(ctx, player, building, inventory) {
        const near = this.getNearbyStructure(player, building);
        if (!near) return;

        const s = near.struct;
        let text = '';

        if (s.id === 'door') {
            text = s.open ? '[E] Закрыть дверь' : '[E] Открыть дверь';
        } else if (s.id === 'generator') {
            const fuel = Math.round(s.fuel || 0);
            const hasWater = inventory && inventory.countItem('almond_water') !== 0;
            if (hasWater && fuel <= 85) {
                text = `[E] Залить Миндальную воду (${fuel}%)`;
            } else if (fuel !== 0) {
                text = s.active ? `[E] Выключить (${fuel}%)` : `[E] Запустить (${fuel}%)`;
            } else {
                text = 'Нет топлива (нужна Миндальная вода)';
            }
        } else if (s.id === 'water_collector') {
            const count = Math.floor(s.water || 0);
            if (count !== 0) {
                text = `[E] Набрать чистую воду (${count}/3)`;
            } else {
                text = s.powered ? 'Сбор конденсата...' : 'Нужно электричество';
            }
        } else if (s.id === 'wooden_crate' || s.id === 'metal_locker') {
            text = '[E] Открыть хранилище';
        } else if (s.id === 'workbench') {
            text = '[E] Открыть верстак';
        } else if (s.id === 'tailor_table') {
            text = s.powered ? '[E] Открыть швейный стол' : 'Нет электричества';
        } else if (s.id === 'metal_bench') {
            text = s.powered ? '[E] Открыть станок по металлу' : 'Нет электричества';
        } else if (s.id === 'journal') {
            text = '[E] Читать / Записать в дневник';
        }

        if (!text) return;

        ctx.save();
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#4ade80';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(text, near.x, near.y - 36);
        ctx.restore();
    }
}
