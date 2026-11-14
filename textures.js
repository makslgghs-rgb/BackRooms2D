import { CONFIG } from './config.js';

export class Textures {
    constructor() {
        this.ts = CONFIG.TILE_SIZE;
        this.floorCanvas = this.createFloorTexture();
        this.wallCanvas = this.createWallTexture();
    }

    createFloorTexture() {
        const c = document.createElement('canvas');
        c.width = this.ts;
        c.height = this.ts;
        const ctx = c.getContext('2d');

        // Грязно-желтый ковролин
        ctx.fillStyle = '#b5a642';
        ctx.fillRect(0, 0, this.ts, this.ts);

        // Легкая ворсистость ковра
        for (let i = 0; i < 160; i++) {
            const x = Math.random() * this.ts;
            const y = Math.random() * this.ts;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,200,0.05)';
            ctx.fillRect(x, y, 2, 2);
        }

        // Еле заметный шов плитки
        ctx.strokeStyle = 'rgba(120, 108, 35, 0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, this.ts - 1, this.ts - 1);

        return c;
    }

    createWallTexture() {
        const c = document.createElement('canvas');
        c.width = this.ts;
        c.height = this.ts;
        const ctx = c.getContext('2d');

        // Чистые гладкие желтые обои без лишних текстур
        ctx.fillStyle = '#d4c86a';
        ctx.fillRect(0, 0, this.ts, this.ts);

        ctx.strokeStyle = '#8c8132';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, this.ts - 2, this.ts - 2);

        return c;
    }
}
