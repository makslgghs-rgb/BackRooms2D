import { ITEMS } from './build_items.js';

export class BuildHUD {
    draw(ctx, inventory, building, canvasWidth, canvasHeight) {
        ctx.save();

        const slotSize = 54;
        const gap = 10;
        const count = inventory.maxSlots;
        const totalWidth = count * slotSize + (count - 1) * gap;
        const startX = (canvasWidth - totalWidth) / 2;
        const startY = canvasHeight - slotSize - 22;

        const selected = inventory.getSelected();
        const itemDef = selected ? ITEMS[selected.id] : null;

        let hint = '[1-8] Слоты   [C] Крафт   [TAB] Экипировка';
        if (itemDef) {
            if (itemDef.type === 'consumable') {
                hint = `[ЛКМ] Использовать (${itemDef.name})   [Q] Выбросить`;
            } else if (itemDef.type === 'gear') {
                hint = `[ЛКМ] Надеть (${itemDef.name})   [Q] Выбросить`;
            } else if (itemDef.type === 'build') {
                hint = building.buildMode
                    ? '[ЛКМ] Поставить   [ПКМ] Забрать   [Q] Выбросить'
                    : '[B] Режим стройки   [Q] Выбросить';
            } else {
                hint = `[Q] Выбросить (${itemDef.name})   [C] Крафт`;
            }
        }

        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = building.buildMode ? 'rgba(74, 222, 128, 0.9)' : 'rgba(255, 255, 255, 0.72)';
        ctx.fillText(hint, canvasWidth / 2, startY - 10);

        for (let i = 0; i !== count; i++) {
            const x = startX + i * (slotSize + gap);
            const y = startY;
            const slot = inventory.slots[i];
            const isSelected = inventory.selectedSlot === i;

            ctx.fillStyle = isSelected ? 'rgba(45, 42, 22, 0.88)' : 'rgba(15, 14, 8, 0.72)';
            ctx.strokeStyle = isSelected ? '#fef08a' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = isSelected ? 2.5 : 1.5;

            ctx.fillRect(x, y, slotSize, slotSize);
            ctx.strokeRect(x, y, slotSize, slotSize);

            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillText(String(i + 1), x + 5, y + 13);

            if (slot) {
                const def = ITEMS[slot.id];
                if (def) {
                    ctx.save();
                    const scale = 0.52;
                    ctx.translate(x + (slotSize - 64 * scale) / 2, y + 6);
                    ctx.scale(scale, scale);
                    def.draw(ctx, 0, 0, 64);
                    ctx.restore();

                    ctx.font = 'bold 11px monospace';
                    ctx.textAlign = 'right';
                    ctx.fillStyle = '#4ade80';
                    ctx.fillText(`x${slot.count}`, x + slotSize - 4, y + 13);

                    ctx.font = '10px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.fillText(def.name, x + slotSize / 2, y + slotSize - 5);
                }
            }
        }

        ctx.restore();
    }
}
