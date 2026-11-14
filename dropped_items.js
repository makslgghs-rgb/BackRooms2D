import { ITEMS } from './build_items.js';

export class DroppedItemSystem {
    constructor() {
        // Массив объектов: { uid, id, count, x, y, vx, vy, bobPhase }
        this.items = [];
        this.nextUid = 1;
        this.pickupRadius = 64;
    }

    // Выбросить предмет на пол (вызывается на Q)
    drop(itemId, count, x, y, throwAngle = 0) {
        const def = ITEMS[itemId];
        if (!def || count <= 0) return null;

        const speed = 130 + Math.random() * 40;
        const spread = (Math.random() - 0.5) * 0.4;
        const angle = throwAngle + spread;

        const dropped = {
            uid: this.nextUid++,
            id: itemId,
            count,
            x: x + Math.cos(throwAngle) * 22,
            y: y + Math.sin(throwAngle) * 22,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            bobPhase: Math.random() * Math.PI * 2
        };

        this.items.push(dropped);
        if (this.items.length > 80) {
            this.items.shift();
        }
        return dropped;
    }

    update(dt, world, building) {
        const ts = 64;
        for (const item of this.items) {
            item.bobPhase += dt * 3.5;

            if (Math.hypot(item.vx, item.vy) > 2) {
                const nx = item.x + item.vx * dt;
                const ny = item.y + item.vy * dt;

                // Не даём предмету улететь внутрь стены
                const txX = Math.floor(nx / ts);
                const tyX = Math.floor(item.y / ts);
                if (!world.isWall(txX, tyX) && (!building || !building.isSolid(txX, tyX))) {
                    item.x = nx;
                } else {
                    item.vx = 0;
                }

                const txY = Math.floor(item.x / ts);
                const tyY = Math.floor(ny / ts);
                if (!world.isWall(txY, tyY) && (!building || !building.isSolid(txY, tyY))) {
                    item.y = ny;
                } else {
                    item.vy = 0;
                }

                item.vx *= Math.pow(0.015, dt);
                item.vy *= Math.pow(0.015, dt);
            }
        }
    }

    getNearbyItem(player) {
        let closest = null;
        let minDist = this.pickupRadius;

        for (const item of this.items) {
            const dist = Math.hypot(item.x - player.x, item.y - player.y);
            if (dist <= minDist) {
                minDist = dist;
                closest = item;
            }
        }
        return closest;
    }

    // Подобрать ближайший предмет на клавишу E
    tryPickup(player, inventory, lootBoxes = null) {
        const item = this.getNearbyItem(player);
        if (!item) return null;

        if (!inventory.addItem(item.id, item.count)) {
            if (lootBoxes) {
                lootBoxes.notification = 'Инвентарь полон!';
                lootBoxes.notifyTimer = 2.0;
            }
            return null;
        }

        const idx = this.items.indexOf(item);
        if (idx !== -1) this.items.splice(idx, 1);

        const def = ITEMS[item.id];
        if (lootBoxes && def) {
            lootBoxes.notification = `Подобрано: ${def.name} x${item.count}`;
            lootBoxes.notifyTimer = 1.8;
        }
        return item;
    }

    draw(ctx, camera, player, canvasWidth, canvasHeight) {
        for (const item of this.items) {
            if (Math.abs(item.x - camera.x) > canvasWidth && Math.abs(item.y - camera.y) > canvasHeight) {
                continue;
            }

            const def = ITEMS[item.id];
            if (!def) continue;

            const bobY = Math.sin(item.bobPhase) * 2.5;
            const scale = 0.52;
            const size = 64 * scale;

            ctx.save();
            // Лёгкая тень и ореол на полу
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(item.x, item.y + 12, 14, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.translate(item.x - size / 2, item.y - size / 2 + bobY);
            ctx.scale(scale, scale);
            def.draw(ctx, 0, 0, 64);
            ctx.restore();
        }

        // Подсказка [E] над ближайшим лежащим предметом
        const nearby = this.getNearbyItem(player);
        if (nearby) {
            const def = ITEMS[nearby.id];
            const name = def ? def.name : nearby.id;
            ctx.save();
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fef08a';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;
            ctx.fillText(`[E] Подобрать: ${name} x${nearby.count}`, nearby.x, nearby.y - 24);
            ctx.restore();
        }
    }
}
