import { ITEMS } from './build_items.js';

export const RECIPES = [
    // Ручной крафт
    { id: 'workbench',       result: 'workbench',       amount: 1, req: 'hand',      cost: { barricade: 2, scrap: 1 } },
    { id: 'door',            result: 'door',            amount: 1, req: 'hand',      cost: { barricade: 2, scrap: 1 } },
    { id: 'wooden_crate',    result: 'wooden_crate',    amount: 1, req: 'hand',      cost: { barricade: 3 } },
    { id: 'medkit',          result: 'medkit',          amount: 1, req: 'hand',      cost: { cloth: 2, almond_water: 1 } },

    // Верстак
    { id: 'generator',       result: 'generator',       amount: 1, req: 'workbench', cost: { scrap: 3, wire: 2, battery: 2 } },
    { id: 'tailor_table',    result: 'tailor_table',    amount: 1, req: 'workbench', cost: { barricade: 2, scrap: 2, wire: 1 } },
    { id: 'metal_bench',     result: 'metal_bench',     amount: 1, req: 'workbench', cost: { scrap: 4, wire: 2 } },
    { id: 'water_collector', result: 'water_collector', amount: 1, req: 'workbench', cost: { scrap: 2, cloth: 1, wire: 1 } },
    { id: 'glass_wall',      result: 'glass_wall',      amount: 1, req: 'workbench', cost: { sand_bag: 2, barricade: 1 } },
    { id: 'lamp_post',       result: 'lamp_post',       amount: 1, req: 'workbench', cost: { scrap: 1, wire: 1, battery: 1 } },
    { id: 'journal',         result: 'journal',         amount: 1, req: 'workbench', cost: { barricade: 1, cloth: 1 } },
    { id: 'spike_trap',      result: 'spike_trap',      amount: 1, req: 'workbench', cost: { barricade: 1, scrap: 2 } },

    // Швейный стол (требует электричество)
    { id: 'backpack',        result: 'backpack',        amount: 1, req: 'tailor',    cost: { cloth: 3, wire: 1 } },
    { id: 'kevlar_vest',     result: 'kevlar_vest',     amount: 1, req: 'tailor',    cost: { cloth: 2, scrap: 3 } },
    { id: 'headlamp',        result: 'headlamp',        amount: 1, req: 'tailor',    cost: { cloth: 1, battery: 1, wire: 1 } },
    { id: 'soft_boots',      result: 'soft_boots',      amount: 1, req: 'tailor',    cost: { cloth: 3 } },

    // Станок по металлу (требует электричество)
    { id: 'steel_plate',     result: 'steel_plate',     amount: 1, req: 'metal',     cost: { scrap: 2 } },
    { id: 'metal_locker',    result: 'metal_locker',    amount: 1, req: 'metal',     cost: { steel_plate: 2, scrap: 1 } },
    { id: 'armored_glass',   result: 'armored_glass',   amount: 1, req: 'metal',     cost: { glass_wall: 1, steel_plate: 2 } }
];

export class CraftingSystem {
    constructor() {
        this.isOpen = false;
        this.nearWorkbench = false;
        this.nearTailor = false;
        this.nearMetalBench = false;
        this.hitboxes = [];
    }

    toggle() {
        this.isOpen = !this.isOpen;
    }

    close() {
        this.isOpen = false;
    }

    canCraft(recipe, inventory) {
        if (recipe.req === 'workbench' && !this.nearWorkbench) return false;
        if (recipe.req === 'tailor' && !this.nearTailor) return false;
        if (recipe.req === 'metal' && !this.nearMetalBench) return false;

        for (const [itemId, reqCount] of Object.entries(recipe.cost)) {
            if (inventory.countItem(itemId) !== reqCount && inventory.countItem(itemId) <= reqCount - 1) {
                return false;
            }
        }
        return true;
    }

    craft(recipe, inventory) {
        if (!this.canCraft(recipe, inventory)) return false;
        for (const [itemId, reqCount] of Object.entries(recipe.cost)) {
            inventory.removeItem(itemId, reqCount);
        }
        inventory.addItem(recipe.result, recipe.amount);
        return true;
    }

    handleClick(mx, my, inventory) {
        if (!this.isOpen) return false;
        for (const box of this.hitboxes) {
            if (mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) {
                this.craft(box.recipe, inventory);
                return true;
            }
        }
        return true;
    }

    draw(ctx, inventory, width, height) {
        if (!this.isOpen) return;
        this.hitboxes = [];

        ctx.save();
        const boxW = 680;
        const boxH = 440;
        const x = (width - boxW) / 2;
        const y = (height - boxH) / 2;

        ctx.fillStyle = 'rgba(14, 13, 8, 0.96)';
        ctx.strokeStyle = '#8c8132';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, boxW, boxH);
        ctx.strokeRect(x, y, boxW, boxH);

        ctx.font = 'bold 15px monospace';
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'left';
        const status = [
            `Верстак:${this.nearWorkbench ? 'ДА' : 'НЕТ'}`,
            `Швейный:${this.nearTailor ? 'ДА' : 'НЕТ'}`,
            `Металл:${this.nearMetalBench ? 'ДА' : 'НЕТ'}`
        ].join(' | ');
        ctx.fillText(`ПРОИЗВОДСТВО // ${status}`, x + 16, y + 26);

        // Отображаем рецепты в 2 колонки для компактности
        const colW = (boxW - 42) / 2;
        const tags = { workbench: ' [В]', tailor: ' [Ш+Ток]', metal: ' [М+Ток]', hand: '' };

        RECIPES.forEach((rec, idx) => {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const rx = x + 14 + col * (colW + 14);
            const ry = y + 46 + row * 37;

            const resDef = ITEMS[rec.result];
            const available = this.canCraft(rec, inventory);

            ctx.fillStyle = available ? 'rgba(74, 222, 128, 0.14)' : 'rgba(255, 255, 255, 0.03)';
            ctx.fillRect(rx, ry, colW, 32);
            this.hitboxes.push({ recipe: rec, x: rx, y: ry, w: colW, h: 32 });

            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = available ? '#4ade80' : '#a1a1aa';
            ctx.fillText(`${resDef.name}${tags[rec.req]}`, rx + 8, ry + 13);

            const costStr = Object.entries(rec.cost)
                .map(([id, cnt]) => `${ITEMS[id].name} x${cnt}`)
                .join(' + ');
            ctx.font = '10px monospace';
            ctx.fillStyle = available ? '#e4e4e7' : '#52525b';
            ctx.fillText(costStr, rx + 8, ry + 26);
        });

        ctx.restore();
    }
}
