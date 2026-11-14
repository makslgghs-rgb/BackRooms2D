import { ITEMS } from './build_items.js';

export class StorageSystem {
    constructor() {
        this.activeStruct = null; // Текущий открытый ящик или шкаф
        this.hitboxes = [];
    }

    isOpen() {
        return Boolean(this.activeStruct);
    }

    open(struct) {
        if (!struct.storage) {
            const capacity = struct.id === 'metal_locker' ? 12 : 6;
            struct.storage = new Array(capacity).fill(null);
        }
        this.activeStruct = struct;
    }

    close() {
        this.activeStruct = null;
    }

    // Положить 1 предмет из инвентаря в открытый ящик/шкаф
    depositFromInventory(invIndex, inventory) {
        if (!this.activeStruct) return;
        const invSlot = inventory.slots[invIndex];
        if (!invSlot) return;

        const boxSlots = this.activeStruct.storage;
        // 1. Ищем существующий стак в ящике
        for (let i = 0; i !== boxSlots.length; i++) {
            if (boxSlots[i] && boxSlots[i].id === invSlot.id) {
                boxSlots[i].count += 1;
                invSlot.count -= 1;
                if (invSlot.count <= 0) inventory.slots[invIndex] = null;
                return;
            }
        }
        // 2. Ищем пустую ячейку
        for (let i = 0; i !== boxSlots.length; i++) {
            if (!boxSlots[i]) {
                boxSlots[i] = { id: invSlot.id, count: 1 };
                invSlot.count -= 1;
                if (invSlot.count <= 0) inventory.slots[invIndex] = null;
                return;
            }
        }
    }

    // Забрать 1 предмет из ящика в инвентарь
    withdrawToInventory(boxIndex, inventory) {
        if (!this.activeStruct) return;
        const boxSlots = this.activeStruct.storage;
        const item = boxSlots[boxIndex];
        if (!item) return;

        if (inventory.addItem(item.id, 1)) {
            item.count -= 1;
            if (item.count <= 0) boxSlots[boxIndex] = null;
        }
    }

    handleClick(mx, my, inventory) {
        if (!this.activeStruct) return false;
        for (const h of this.hitboxes) {
            if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
                if (h.type === 'withdraw') this.withdrawToInventory(h.index, inventory);
                if (h.type === 'deposit') this.depositFromInventory(h.index, inventory);
                return true;
            }
        }
        return true;
    }

    draw(ctx, inventory, width, height) {
        if (!this.activeStruct) return;
        this.hitboxes = [];

        const boxSlots = this.activeStruct.storage;
        const title = this.activeStruct.id === 'metal_locker' ? 'МЕТАЛЛИЧЕСКИЙ ШКАФ (12)' : 'ДЕРЕВЯННЫЙ ЯЩИК (6)';

        ctx.save();
        const boxW = 480;
        const boxH = 340;
        const x = (width - boxW) / 2;
        const y = (height - boxH) / 2;

        ctx.fillStyle = 'rgba(14, 13, 8, 0.95)';
        ctx.strokeStyle = '#8c8132';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, boxW, boxH);
        ctx.strokeRect(x, y, boxW, boxH);

        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'left';
        ctx.fillText(`${title}  [ESC - ЗАКРЫТЬ]`, x + 18, y + 28);

        ctx.font = '11px monospace';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText('Клик по ячейке ящика — забрать | Клик по слоту снизу — положить', x + 18, y + 46);

        // Ячейки хранилища (сетка 6 в ряд)
        const cols = 6;
        const cellSize = 54;
        const gap = 10;
        const startX = x + (boxW - (cols * cellSize + (cols - 1) * gap)) / 2;
        const startY = y + 62;

        for (let i = 0; i !== boxSlots.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const sx = startX + col * (cellSize + gap);
            const sy = startY + row * (cellSize + gap);
            const item = boxSlots[i];

            ctx.fillStyle = item ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)';
            ctx.strokeStyle = item ? '#8c8132' : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1.5;
            ctx.fillRect(sx, sy, cellSize, cellSize);
            ctx.strokeRect(sx, sy, cellSize, cellSize);

            if (item && ITEMS[item.id]) {
                ctx.save();
                ctx.translate(sx + 10, sy + 6);
                ctx.scale(0.52, 0.52);
                ITEMS[item.id].draw(ctx, 0, 0, 64);
                ctx.restore();

                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'right';
                ctx.fillStyle = '#4ade80';
                ctx.fillText(`x${item.count}`, sx + cellSize - 4, sy + 13);

                this.hitboxes.push({ type: 'withdraw', index: i, x: sx, y: sy, w: cellSize, h: cellSize });
            }
        }

        // Регистрируем клики по слотам хотбара снизу, чтобы класть вещи в ящик
        const invCount = inventory.maxSlots;
        const invTotalW = invCount * cellSize + (invCount - 1) * gap;
        const invStartX = (width - invTotalW) / 2;
        const invStartY = height - cellSize - 22;
        for (let i = 0; i !== invCount; i++) {
            this.hitboxes.push({
                type: 'deposit',
                index: i,
                x: invStartX + i * (cellSize + gap),
                y: invStartY,
                w: cellSize,
                h: cellSize
            });
        }

        ctx.restore();
    }
}
