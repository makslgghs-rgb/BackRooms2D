export const ITEMS = {
    // --- РЕСУРСЫ И РАСХОДНИКИ ---
    barricade: {
        id: 'barricade',
        name: 'Доски',
        type: 'build',
        solid: true,
        blocksLight: false,
        maxHp: 100,
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#78532a';
            ctx.strokeStyle = '#3e2711';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 6, y + 10, ts - 12, 12);
            ctx.strokeRect(x + 6, y + 10, ts - 12, 12);
            ctx.fillRect(x + 6, y + ts - 22, ts - 12, 12);
            ctx.strokeRect(x + 6, y + ts - 22, ts - 12, 12);
            ctx.fillStyle = '#8c6233';
            ctx.fillRect(x + 12, y + 4, 10, ts - 8);
            ctx.strokeRect(x + 12, y + 4, 10, ts - 8);
            ctx.fillRect(x + ts - 22, y + 4, 10, ts - 8);
            ctx.strokeRect(x + ts - 22, y + 4, 10, ts - 8);
        }
    },

    scrap: {
        id: 'scrap',
        name: 'Металл',
        type: 'resource',
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#71717a';
            ctx.strokeStyle = '#27272a';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 14, y + 22, 36, 14);
            ctx.strokeRect(x + 14, y + 22, 36, 14);
            ctx.fillStyle = '#a1a1aa';
            ctx.fillRect(x + 20, y + 14, 14, 34);
            ctx.strokeRect(x + 20, y + 14, 14, 34);
        }
    },

    wire: {
        id: 'wire',
        name: 'Провода',
        type: 'resource',
        draw(ctx, x, y, ts) {
            const cx = x + ts / 2;
            const cy = y + ts / 2;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(cx, cy, 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx + 3, cy - 2, 11, 0, Math.PI * 1.5);
            ctx.stroke();
        }
    },

    battery: {
        id: 'battery',
        name: 'Батарея',
        type: 'resource',
        draw(ctx, x, y, ts) {
            const cx = x + ts / 2;
            ctx.fillStyle = '#18181b';
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 2;
            ctx.fillRect(cx - 11, y + 18, 22, 30);
            ctx.strokeRect(cx - 11, y + 18, 22, 30);
            ctx.fillStyle = '#eab308';
            ctx.fillRect(cx - 5, y + 13, 10, 5);
        }
    },

    cloth: {
        id: 'cloth',
        name: 'Ткань',
        type: 'resource',
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#e4e4e7';
            ctx.strokeStyle = '#71717a';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 14, y + 18, 36, 26);
            ctx.strokeRect(x + 14, y + 18, 36, 26);
        }
    },

    almond_water: {
        id: 'almond_water',
        name: 'Вода',
        type: 'consumable',
        healAmount: 30,
        draw(ctx, x, y, ts) {
            const cx = x + ts / 2;
            ctx.fillStyle = '#38bdf8';
            ctx.strokeStyle = '#0369a1';
            ctx.lineWidth = 2;
            ctx.fillRect(cx - 10, y + 18, 20, 34);
            ctx.strokeRect(cx - 10, y + 18, 20, 34);
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(cx - 5, y + 11, 10, 7);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(cx - 6, y + 8, 12, 4);
        }
    },

    medkit: {
        id: 'medkit',
        name: 'Аптечка',
        type: 'consumable',
        healAmount: 75,
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#f4f4f5';
            ctx.strokeStyle = '#991b1b';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 12, y + 16, ts - 24, ts - 30);
            ctx.strokeRect(x + 12, y + 16, ts - 24, ts - 30);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(x + 29, y + 21, 6, 22);
            ctx.fillRect(x + 21, y + 29, 22, 6);
        }
    },

    // --- ПОСТРОЙКИ ДЛЯ БАЗЫ ---
    wall_block: {
        id: 'wall_block',
        name: 'Плита',
        type: 'build',
        solid: true,
        blocksLight: true,
        maxHp: 260,
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#9ca3af';
            ctx.fillRect(x + 3, y + 3, ts - 6, ts - 6);
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 3, y + 3, ts - 6, ts - 6);
        }
    },

    door: {
        id: 'door',
        name: 'Дверь',
        type: 'build',
        solid: true,
        blocksLight: true,
        maxHp: 180,
        draw(ctx, x, y, ts, struct = null) {
            const isOpen = struct && struct.open;
            ctx.fillStyle = '#5c3a18';
            ctx.strokeStyle = '#291808';
            ctx.lineWidth = 2;

            if (isOpen) {
                // Открытая дверь прижата к краю клетки
                ctx.fillRect(x + 4, y + 4, 12, ts - 8);
                ctx.strokeRect(x + 4, y + 4, 12, ts - 8);
            } else {
                // Закрытая массивная дверь с ручкой
                ctx.fillRect(x + 4, y + 22, ts - 8, 20);
                ctx.strokeRect(x + 4, y + 22, ts - 8, 20);
                ctx.fillStyle = '#eab308';
                ctx.beginPath();
                ctx.arc(x + ts - 14, y + 32, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    workbench: {
        id: 'workbench',
        name: 'Верстак',
        type: 'build',
        solid: true,
        blocksLight: false,
        maxHp: 160,
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#6b4423';
            ctx.strokeStyle = '#27170a';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 6, y + 10, ts - 12, ts - 20);
            ctx.strokeRect(x + 6, y + 10, ts - 12, ts - 20);

            // Тиски и инструменты на столешнице
            ctx.fillStyle = '#71717a';
            ctx.fillRect(x + 12, y + 16, 14, 10);
            ctx.fillStyle = '#eab308';
            ctx.fillRect(x + 34, y + 28, 16, 6);
        }
    },

    generator: {
        id: 'generator',
        name: 'Генератор',
        type: 'build',
        solid: true,
        blocksLight: false,
        emitsLight: true,
        lightRadius: 340,
        maxHp: 220,
        draw(ctx, x, y, ts, struct = null) {
            const active = struct ? struct.active : true;
            ctx.fillStyle = '#991b1b';
            ctx.strokeStyle = '#450a0a';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 8, y + 10, ts - 16, ts - 20);
            ctx.strokeRect(x + 8, y + 10, ts - 16, ts - 20);

            // Индикатор работы генератора
            ctx.fillStyle = active ? '#4ade80' : '#ef4444';
            ctx.beginPath();
            ctx.arc(x + ts / 2, y + ts / 2, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    lamp_post: {
        id: 'lamp_post',
        name: 'Лампа',
        type: 'build',
        solid: false,
        blocksLight: false,
        emitsLight: true,
        lightRadius: 210,
        maxHp: 60,
        draw(ctx, x, y, ts) {
            const cx = x + ts / 2;
            const cy = y + ts / 2;
            ctx.strokeStyle = '#3f3f46';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx, cy); ctx.lineTo(cx - 14, cy + 16);
            ctx.moveTo(cx, cy); ctx.lineTo(cx + 14, cy + 16);
            ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 16);
            ctx.stroke();

            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(cx, cy, 9, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    journal: {
        id: 'journal',
        name: 'Дневник',
        type: 'build',
        solid: false,
        blocksLight: false,
        maxHp: 50,
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#713f12';
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1.5;
            ctx.fillRect(x + 18, y + 16, 28, 32);
            ctx.strokeRect(x + 18, y + 16, 28, 32);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(x + 22, y + 22, 18, 3);
            ctx.fillRect(x + 22, y + 29, 14, 3);
        }
    },

    spike_trap: {
        id: 'spike_trap',
        name: 'Ловушка',
        type: 'build',
        solid: false,
        blocksLight: false,
        maxHp: 40,
        draw(ctx, x, y, ts) {
            ctx.strokeStyle = '#52525b';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 10, y + 10, ts - 20, ts - 20);
            ctx.fillStyle = '#a1a1aa';
            for (let py = 18; py <= 46; py += 14) {
                for (let px = 18; px <= 46; px += 14) {
                    ctx.beginPath();
                    ctx.arc(x + px, y + py, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
        ,
    tailor_table: {
        id: 'tailor_table',
        name: 'Швейный стол',
        type: 'build',
        solid: true,
        blocksLight: false,
        maxHp: 150,
        draw(ctx, x, y, ts, struct = null) {
            const powered = struct ? Boolean(struct.powered) : false;
            ctx.fillStyle = '#4c1d95';
            ctx.strokeStyle = '#2e1065';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 6, y + 10, ts - 12, ts - 20);
            ctx.strokeRect(x + 6, y + 10, ts - 12, ts - 20);

            // Швейная машинка сверху
            ctx.fillStyle = '#d4d4d8';
            ctx.fillRect(x + 16, y + 18, 22, 12);
            ctx.fillRect(x + 30, y + 14, 8, 20);

            // Индикатор электричества (зелёный — запитан от генератора, красный — нет тока)
            ctx.fillStyle = powered ? '#4ade80' : '#ef4444';
            ctx.beginPath();
            ctx.arc(x + ts - 14, y + 16, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    backpack: {
        id: 'backpack',
        name: 'Рюкзак',
        type: 'gear',
        equipSlot: 'back',
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#78350f';
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 14, y + 14, ts - 28, ts - 24);
            ctx.strokeRect(x + 14, y + 14, ts - 28, ts - 24);
            // Карман и ремни
            ctx.fillStyle = '#92400e';
            ctx.fillRect(x + 18, y + 26, ts - 36, 14);
            ctx.strokeRect(x + 18, y + 26, ts - 36, 14);
        }
    },

    kevlar_vest: {
        id: 'kevlar_vest',
        name: 'Бронежилет',
        type: 'gear',
        equipSlot: 'body',
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#14532d';
            ctx.strokeStyle = '#052e16';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 14, y + 14, ts - 28, ts - 26);
            ctx.strokeRect(x + 14, y + 14, ts - 28, ts - 26);
            // Бронепластина по центру
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(x + 22, y + 20, ts - 44, ts - 38);
        }
    },

    headlamp: {
        id: 'headlamp',
        name: 'Налобник',
        type: 'gear',
        equipSlot: 'head',
        draw(ctx, x, y, ts) {
            const cx = x + ts / 2;
            const cy = y + ts / 2;
            ctx.strokeStyle = '#3f3f46';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(cx, cy, 14, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(cx + 12, cy, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    soft_boots: {
        id: 'soft_boots',
        name: 'Тихие сапоги',
        type: 'gear',
        equipSlot: 'feet',
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#27272a';
            ctx.strokeStyle = '#71717a';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 14, y + 22, 14, 24);
            ctx.strokeRect(x + 14, y + 22, 14, 24);
            ctx.fillRect(x + 34, y + 22, 14, 24);
            ctx.strokeRect(x + 34, y + 22, 14, 24);
        }
    }
        ,
    steel_plate: {
        id: 'steel_plate',
        name: 'Сталь',
        type: 'resource',
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#64748b';
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 14, y + 16, ts - 28, ts - 32);
            ctx.strokeRect(x + 14, y + 16, ts - 28, ts - 32);
        }
    },

    sand_bag: {
        id: 'sand_bag',
        name: 'Песок',
        type: 'resource',
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#d6c289';
            ctx.strokeStyle = '#857343';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(x + ts / 2, y + ts / 2 + 4, 18, 13, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    },

    clean_water: {
        id: 'clean_water',
        name: 'Вода (чист.)',
        type: 'consumable',
        healAmount: 18,
        draw(ctx, x, y, ts) {
            const cx = x + ts / 2;
            ctx.fillStyle = '#7dd3fc';
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2;
            ctx.fillRect(cx - 9, y + 20, 18, 30);
            ctx.strokeRect(cx - 9, y + 20, 18, 30);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx - 5, y + 13, 10, 7);
        }
    },

    glass_wall: {
        id: 'glass_wall',
        name: 'Стекло',
        type: 'build',
        solid: true,
        blocksLight: false, // Прозрачное! Свет фонарика и взгляд проходят насквозь
        maxHp: 90,
        draw(ctx, x, y, ts) {
            ctx.fillStyle = 'rgba(186, 230, 253, 0.28)';
            ctx.strokeStyle = '#7dd3fc';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8);
            ctx.strokeRect(x + 4, y + 4, ts - 8, ts - 8);

            // Блики на стекле
            ctx.beginPath();
            ctx.moveTo(x + 12, y + 12);
            ctx.lineTo(x + 26, y + 26);
            ctx.moveTo(x + 18, y + 10);
            ctx.lineTo(x + 30, y + 22);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.stroke();
        }
    },

    armored_glass: {
        id: 'armored_glass',
        name: 'Бронестекло',
        type: 'build',
        solid: true,
        blocksLight: false, // Прозрачное и сверхпрочное!
        maxHp: 550,
        draw(ctx, x, y, ts) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.36)';
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 4;
            ctx.fillRect(x + 3, y + 3, ts - 6, ts - 6);
            ctx.strokeRect(x + 3, y + 3, ts - 6, ts - 6);

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 7, y + 7, ts - 14, ts - 14);
        }
    },

    wooden_crate: {
        id: 'wooden_crate',
        name: 'Ящик (6)',
        type: 'build',
        solid: true,
        blocksLight: false,
        maxHp: 140,
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#855828';
            ctx.strokeStyle = '#3b230d';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 8, y + 8, ts - 16, ts - 16);
            ctx.strokeRect(x + 8, y + 8, ts - 16, ts - 16);
            ctx.beginPath();
            ctx.moveTo(x + 8, y + 8);
            ctx.lineTo(x + ts - 8, y + ts - 8);
            ctx.stroke();
        }
    },

    metal_locker: {
        id: 'metal_locker',
        name: 'Шкаф (12)',
        type: 'build',
        solid: true,
        blocksLight: true,
        maxHp: 320,
        draw(ctx, x, y, ts) {
            ctx.fillStyle = '#475569';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 6, y + 8, ts - 12, ts - 16);
            ctx.strokeRect(x + 6, y + 8, ts - 12, ts - 16);
            // Две створки шкафа
            ctx.beginPath();
            ctx.moveTo(x + ts / 2, y + 8);
            ctx.lineTo(x + ts / 2, y + ts - 8);
            ctx.stroke();
        }
    },

    water_collector: {
        id: 'water_collector',
        name: 'Генератор воды',
        type: 'build',
        solid: true,
        blocksLight: false,
        maxHp: 160,
        draw(ctx, x, y, ts, struct = null) {
            const water = struct ? Math.floor(struct.water || 0) : 0;
            ctx.fillStyle = '#1e3a8a';
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + ts / 2, y + ts / 2, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Уровень воды внутри бака
            if (water > 0) {
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.arc(x + ts / 2, y + ts / 2, 13, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    metal_bench: {
        id: 'metal_bench',
        name: 'Станок (металл)',
        type: 'build',
        solid: true,
        blocksLight: false,
        maxHp: 220,
        draw(ctx, x, y, ts, struct = null) {
            const powered = struct ? Boolean(struct.powered) : false;
            ctx.fillStyle = '#334155';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.fillRect(x + 6, y + 10, ts - 12, ts - 20);
            ctx.strokeRect(x + 6, y + 10, ts - 12, ts - 20);

            // Наковальня / пресс
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(x + 16, y + 20, 32, 16);

            ctx.fillStyle = powered ? '#4ade80' : '#ef4444';
            ctx.beginPath();
            ctx.arc(x + ts - 14, y + 16, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
};
