import { ITEMS } from './build_items.js';

export class EquipmentSystem {
    constructor() {
        this.isOpen = false;
        this.slots = {
            head: null, // Налобный фонарь
            body: null, // Бронежилет
            back: null, // Рюкзак
            feet: null  // Тихие сапоги
        };
        this.message = '';
        this.msgTimer = 0;
        this.hitboxes = []; // Кликабельные зоны на экране TAB
    }

    toggle() {
        this.isOpen = !this.isOpen;
    }

    close() {
        this.isOpen = false;
    }

    hasItem(itemId) {
        return Object.values(this.slots).includes(itemId);
    }

    getExtraSlots() {
        return this.hasItem('backpack') ? 3 : 0;
    }

    getDamageMultiplier() {
        return this.hasItem('kevlar_vest') ? 0.6 : 1.0; // -40% урона
    }

    getNoiseMultiplier() {
        return this.hasItem('soft_boots') ? 0.55 : 1.0; // -45% шума шагов
    }

    getStaminaRegenBonus() {
        return this.hasItem('soft_boots') ? 1.35 : 1.0;
    }

    hasHeadlamp() {
        return this.hasItem('headlamp');
    }

    showMessage(text) {
        this.message = text;
        this.msgTimer = 2.5;
    }

    update(dt) {
        if (this.msgTimer > 0) this.msgTimer -= dt;
    }

    // Надеть предмет из слота инвентаря
    equipFromInventory(invIndex, inventory) {
        const slot = inventory.slots[invIndex];
        if (!slot) return false;
        const def = ITEMS[slot.id];
        if (!def || def.type !== 'gear') return false;

        const targetSlot = def.equipSlot;
        const previousGear = this.slots[targetSlot];

        // Нельзя снять рюкзак, если в дополнительных 3 слотах лежат вещи
        if (targetSlot === 'back' && previousGear === 'backpack' && def.id !== 'backpack') {
            if (!inventory.canShrinkTo(5)) {
                this.showMessage('Сначала освободите слоты рюкзака (6-8)!');
                return false;
            }
        }

        inventory.slots[invIndex] = null;
        this.slots[targetSlot] = def.id;

        if (previousGear) {
            inventory.addItem(previousGear, 1);
        }

        inventory.setMaxSlots(5 + this.getExtraSlots());
        this.showMessage(`Надето: ${def.name}`);
        return true;
    }

    // Снять экипировку обратно в инвентарь
    unequip(equipSlot, inventory) {
        const gearId = this.slots[equipSlot];
        if (!gearId) return false;

        if (equipSlot === 'back' && gearId === 'backpack') {
            if (!inventory.canShrinkTo(5)) {
                this.showMessage('Сначала освободите слоты рюкзака (6-8)!');
                return false;
            }
        }

        if (!inventory.addItem(gearId, 1)) {
            this.showMessage('Нет места в инвентаре!');
            return false;
        }

        this.slots[equipSlot] = null;
        inventory.setMaxSlots(5 + this.getExtraSlots());
        return true;
    }

    handleClick(mx, my, inventory) {
        if (!this.isOpen) return false;
        for (const box of this.hitboxes) {
            if (mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) {
                if (box.type === 'unequip') this.unequip(box.slot, inventory);
                if (box.type === 'equip') this.equipFromInventory(box.index, inventory);
                return true;
            }
        }
        return true;
    }

    draw(ctx, player, inventory, profile, width, height) {
        if (!this.isOpen) return;
        this.hitboxes = [];

        ctx.save();
        const boxW = 540;
        const boxH = 390;
        const x = (width - boxW) / 2;
        const y = (height - boxH) / 2;

        ctx.fillStyle = 'rgba(14, 13, 8, 0.95)';
        ctx.strokeStyle = '#8c8132';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, boxW, boxH);
        ctx.strokeRect(x, y, boxW, boxH);

        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'left';
        ctx.fillText('СНАРЯЖЕНИЕ ИССЛЕДОВАТЕЛЯ [TAB]', x + 20, y + 32);

        // 1. Силуэт персонажа по центру левой половины
        const dollX = x + 150;
        const dollY = y + 185;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.arc(dollX, dollY, 72, 0, Math.PI * 2);
        ctx.fill();

        // Тело персонажа с цветом из профиля
        ctx.fillStyle = profile.color;
        ctx.beginPath();
        ctx.arc(dollX, dollY, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Визуал надетых вещей на кукле
        if (this.hasItem('backpack')) {
            ctx.fillStyle = '#78350f';
            ctx.fillRect(dollX - 34, dollY - 16, 12, 32);
        }
        if (this.hasItem('kevlar_vest')) {
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(dollX, dollY, 22, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (this.hasItem('headlamp')) {
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(dollX + 24, dollY, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Четыре слота экипировки вокруг персонажа
        const slotDefs = [
            { key: 'head', label: 'ГОЛОВА', sx: dollX - 27, sy: dollY - 108 },
            { key: 'feet', label: 'ОБУВЬ',  sx: dollX - 27, sy: dollY + 56 },
            { key: 'back', label: 'СПИНА',  sx: dollX - 115, sy: dollY - 27 },
            { key: 'body', label: 'ТЕЛО',   sx: dollX + 61,  sy: dollY - 27 }
        ];

        for (const sd of slotDefs) {
            const equippedId = this.slots[sd.key];
            ctx.fillStyle = equippedId ? 'rgba(74, 222, 128, 0.14)' : 'rgba(255, 255, 255, 0.05)';
            ctx.strokeStyle = equippedId ? '#4ade80' : '#8c8132';
            ctx.lineWidth = 1.8;
            ctx.fillRect(sd.sx, sd.sy, 54, 54);
            ctx.strokeRect(sd.sx, sd.sy, 54, 54);

            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#a1a1aa';
            ctx.fillText(sd.label, sd.sx + 27, sd.sy - 4);

            if (equippedId && ITEMS[equippedId]) {
                ctx.save();
                ctx.translate(sd.sx + 8, sd.sy + 8);
                ctx.scale(0.6, 0.6);
                ITEMS[equippedId].draw(ctx, 0, 0, 64);
                ctx.restore();
                this.hitboxes.push({ type: 'unequip', slot: sd.key, x: sd.sx, y: sd.sy, w: 54, h: 54 });
            }
        }

        // 3. Правая колонка: активные бонусы и быстрое надевание из рюкзака
        const rx = x + 305;
        ctx.textAlign = 'left';
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#fef08a';
        ctx.fillText('ХАРАКТЕРИСТИКИ:', rx, y + 72);

        ctx.font = '12px monospace';
        ctx.fillStyle = '#e4e4e7';
        ctx.fillText(`• Слоты инвентаря: ${inventory.maxSlots}`, rx, y + 95);
        ctx.fillText(`• Защита от урона: ${this.hasItem('kevlar_vest') ? '40%' : '0%'}`, rx, y + 115);
        ctx.fillText(`• Шум шагов: ${this.hasItem('soft_boots') ? 'Тихий (-45%)' : 'Обычный'}`, rx, y + 135);
        ctx.fillText(`• Налобный свет: ${this.hasHeadlamp() ? 'Активен' : 'Нет'}`, rx, y + 155);

        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#fef08a';
        ctx.fillText('НАДЕТЬ ИЗ РЮКЗАКА (КЛИК):', rx, y + 195);

        let listY = y + 215;
        for (let i = 0; i !== inventory.maxSlots; i++) {
            const itemSlot = inventory.slots[i];
            if (!itemSlot) continue;
            const def = ITEMS[itemSlot.id];
            if (!def || def.type !== 'gear') continue;

            ctx.fillStyle = 'rgba(254, 240, 138, 0.12)';
            ctx.fillRect(rx, listY, 210, 26);
            ctx.font = '12px monospace';
            ctx.fillStyle = '#fef08a';
            ctx.fillText(`+ Надеть: ${def.name}`, rx + 8, listY + 17);

            this.hitboxes.push({ type: 'equip', index: i, x: rx, y: listY, w: 210, h: 26 });
            listY += 32;
        }

        if (this.msgTimer > 0 && this.message) {
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#4ade80';
            ctx.fillText(this.message, x + boxW / 2, y + boxH - 16);
        }

        ctx.restore();
    }
}
