import { CONFIG } from './config.js';
import { Textures } from './textures.js';

export class World {
    constructor() {
        this.seed = Math.random() * 10000;
        this.textures = new Textures();
    }

    hash(x, y, salt = 0) {
        const val = Math.sin(x * 12.9898 + y * 78.233 + salt * 43.123 + this.seed) * 43758.5453;
        return val - Math.floor(val);
    }

    isWall(tileX, tileY) {
        if (Math.abs(tileX) <= 2 && Math.abs(tileY) <= 2) return false;

        const roomSize = 8;
        const roomX = Math.floor(tileX / roomSize);
        const roomY = Math.floor(tileY / roomSize);
        const localX = ((tileX % roomSize) + roomSize) % roomSize;
        const localY = ((tileY % roomSize) + roomSize) % roomSize;

        if (localX === 0 && localY === 0) return true;

        if (localX === 0) {
            if (localY === 3 || localY === 4) return false;
            return this.hash(roomX, roomY, 1) < 0.65;
        }

        if (localY === 0) {
            if (localX === 3 || localX === 4) return false;
            return this.hash(roomX, roomY, 2) < 0.65;
        }

        const roomType = this.hash(roomX, roomY, 3);
        if (roomType < 0.35 && localX === 4 && localY >= 2 && localY <= 5) return true;
        if (roomType >= 0.35 && roomType < 0.60 && localY === 4 && localX >= 2 && localX <= 5) return true;
        if (roomType >= 0.60 && roomType < 0.80 && (localX === 3 || localX === 5) && localY === 4) return true;

        return false;
    }

    drawOrganicStain(ctx, x, y, col, row) {
        const ts = CONFIG.TILE_SIZE;
        // Смещаем пятно от центра плитки
        const cx = x + this.hash(col, row, 11) * ts;
        const cy = y + this.hash(col, row, 12) * ts;
        const baseR = ts * (0.25 + this.hash(col, row, 13) * 0.35);

        ctx.fillStyle = 'rgba(65, 56, 16, 0.14)';
        for (let i = 0; i < 3; i++) {
            const ox = (this.hash(col, row, 20 + i) - 0.5) * baseR;
            const oy = (this.hash(col, row, 30 + i) - 0.5) * baseR;
            const r = baseR * (0.6 + this.hash(col, row, 40 + i) * 0.5);

            ctx.beginPath();
            ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    draw(ctx, camera, canvasWidth, canvasHeight) {
        const ts = CONFIG.TILE_SIZE;
        
        const startCol = Math.floor((camera.x - canvasWidth / 2) / ts) - 1;
        const endCol = Math.ceil((camera.x + canvasWidth / 2) / ts) + 1;
        const startRow = Math.floor((camera.y - canvasHeight / 2) / ts) - 1;
        const endRow = Math.ceil((camera.y + canvasHeight / 2) / ts) + 1;

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const x = col * ts;
                const y = row * ts;

                if (this.isWall(col, row)) {
                    ctx.drawImage(this.textures.wallCanvas, x, y);
                } else {
                    ctx.drawImage(this.textures.floorCanvas, x, y);

                    // Редкие бесформенные пятна сырости не по сетке
                    if (this.hash(col, row, 9) < 0.025) {
                        this.drawOrganicStain(ctx, x, y, col, row);
                    }
                }
            }
        }
    }
}
