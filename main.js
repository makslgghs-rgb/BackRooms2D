import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { VHSEffect } from './vhs.js';
import { Crosshair } from './crosshair.js';
import { Lighting } from './lighting.js';
import { GameTime } from './time.js';
import { DustSystem } from './dust.js';
import { BuildingSystem } from './building.js';
import { BuildHUD } from './build_hud.js';
import { Inventory } from './inventory.js';
import { LootBoxSystem } from './loot_boxes.js';
import { ITEMS } from './build_items.js';
import { CONFIG } from './config.js';
import { BackroomsEntity } from './entity.js';
import { StruggleSystem } from './struggle.js';
import { GameSettings } from './settings.js';
import { AuthSystem } from './auth.js';
import { MainMenu } from './menu.js';
import { CraftingSystem } from './crafting.js';
import { InteractableSystem } from './interactables.js';
import { EquipmentSystem } from './equipment.js';
import { DroppedItemSystem } from './dropped_items.js';
import { StorageSystem } from './storage.js';
import { SaveSystem } from './save_system.js';
import { TouchControls } from './touch_controls.js';
import { P2PNetwork } from './network.js';
import { FriendsNetwork } from './friends_network.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const auth = new AuthSystem();
const settings = new GameSettings();
const saveSystem = new SaveSystem();

const world = new World();
const player = new Player(32, 32);
const equipment = new EquipmentSystem();
player.equipment = equipment;

const camera = new Camera(32, 32);
const inventory = new Inventory(5);
const lootBoxes = new LootBoxSystem();
const droppedItems = new DroppedItemSystem();
const building = new BuildingSystem();
const buildHud = new BuildHUD();
const entity = new BackroomsEntity(player);
const struggle = new StruggleSystem();
const crafting = new CraftingSystem();
const interactables = new InteractableSystem();
const storage = new StorageSystem();

function getWorldState() {
    return { world, player, inventory, equipment, building, lootBoxes, droppedItems, gameTime, camera };
}

function resetNewWorld() {
    world.seed = Math.floor(Math.random() * 999999);
    if (world.chunks && typeof world.chunks.clear === 'function') world.chunks.clear();
    player.x = 32; player.y = 32; player.hp = 100; player.stamina = 100;
    player.bloodTrail = [];
    camera.x = 32; camera.y = 32;
    inventory.slots = new Array(8).fill(null);
    inventory.setMaxSlots(5);
    equipment.slots = { head: null, body: null, back: null, feet: null };
    building.structures.clear();
    lootBoxes.opened.clear();
    lootBoxes.roomCache.clear();
    droppedItems.items = [];
    entity.despawn(player, 16);
    struggle.isDead = false;
    struggle.active = false;
}

const network = new P2PNetwork({
    onRequestWorldSync: () => {
        network.send('world_sync', {
            seed: world.seed,
            gameTime: { day: gameTime.day, minutes: gameTime.minutes },
            structures: Array.from(building.structures.values()),
            openedBoxes: Array.from(lootBoxes.opened),
            droppedItems: droppedItems.items
        });
    },
    onReceiveWorldSync: (msg) => {
        if (msg.seed !== undefined && world.seed !== msg.seed) {
            world.seed = msg.seed;
            if (world.chunks && typeof world.chunks.clear === 'function') world.chunks.clear();
        }
        if (msg.gameTime) {
            gameTime.day = msg.gameTime.day;
            gameTime.minutes = msg.gameTime.minutes;
        }
        building.structures.clear();
        if (Array.isArray(msg.structures)) {
            for (const s of msg.structures) building.structures.set(`${s.tileX},${s.tileY}`, s);
        }
        lootBoxes.opened = new Set(msg.openedBoxes || []);
        lootBoxes.roomCache.clear();
        if (Array.isArray(msg.droppedItems)) droppedItems.items = msg.droppedItems;
    },
    onReceiveEntity: (msg) => {
        entity.x = msg.x;
        entity.y = msg.y;
        entity.angle = msg.angle;
        if (entity.state !== 'GRAB') entity.state = msg.state;
    },
    onStructureUpdate: (msg) => {
        if (msg.action === 'remove') {
            building.remove(msg.tileX, msg.tileY);
        } else if (msg.struct) {
            building.structures.set(`${msg.struct.tileX},${msg.struct.tileY}`, msg.struct);
        }
    },
    onBoxOpened: (boxId) => {
        lootBoxes.opened.add(boxId);
    },
    onItemDropped: (msg) => {
        if (msg.item) droppedItems.items.push(msg.item);
    },
    onItemPicked: (uid) => {
        droppedItems.items = droppedItems.items.filter(it => it.uid !== uid);
    }
});

const social = new FriendsNetwork(auth, settings, (force = false) => {
    if (!menu.isOpen) return;
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (!force && (activeTag === 'INPUT' || activeTag === 'TEXTAREA')) return;
    menu.render();
});

const menu = new MainMenu(settings, auth, {
    hasSave: (user) => saveSystem.hasSave(user),
    onStartGame: (info) => {
        const user = auth.getCurrentUsername();
        if (info && info.mode === 'join') {
            resetNewWorld();
            network.connect(info.code, false);
            social.myCurrentRoom = info.code;
            social.announcePresence();
        } else {
            if (info && info.loadSave) {
                saveSystem.load(user, getWorldState());
            } else if (!menu.hasStarted) {
                resetNewWorld();
            }
            const code = info?.code || menu.myRoomCode;
            if (!network.roomCode) {
                network.connect(code, true);
            }
            social.myCurrentRoom = code;
            social.announcePresence();
        }
    },
    onLeaveWorld: () => {
        network.disconnect();
        social.myCurrentRoom = null;
        social.announcePresence();
        resetNewWorld();
    },
    onSaveWorld: () => {
        if (network.isHost) saveSystem.save(auth.getCurrentUsername(), getWorldState(), false);
    },
    onDeleteWorld: () => {
        saveSystem.deleteSave(auth.getCurrentUsername());
        resetNewWorld();
    },
    onEditTouch: () => {
        touchControls.startEditMode();
    }
});

menu.social = social;

auth.onRegistryUpdated = () => {
    if (!auth.isLoggedIn() && menu.isOpen) {
        const nickInput = document.getElementById('authNick');
        if (nickInput && nickInput.value) {
            nickInput.dispatchEvent(new Event('input'));
        }
    }
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
        if (storage.isOpen()) { storage.close(); return; }
        if (crafting.isOpen) { crafting.close(); return; }
        if (equipment.isOpen) { equipment.close(); return; }
        if (!interactables.isJournalOpen()) menu.toggle();
    }
});

const actionCallbacks = {
    onToggleFlashlight: () => {
        if (!menu.isOpen && !struggle.active && !struggle.isDead && !interactables.isJournalOpen() && !storage.isOpen()) {
            player.toggleFlashlight();
        }
    },
    onToggleBuild: () => {
        if (!menu.isOpen && !struggle.active && !struggle.isDead && !interactables.isJournalOpen() && !storage.isOpen()) {
            crafting.close();
            equipment.close();
            building.toggleBuildMode();
        }
    },
    onToggleCraft: () => {
        if (!menu.isOpen && !struggle.active && !struggle.isDead && !interactables.isJournalOpen() && !storage.isOpen()) {
            building.buildMode = false;
            equipment.close();
            crafting.toggle();
        }
    },
    onToggleEquipment: () => {
        if (!menu.isOpen && !struggle.active && !struggle.isDead && !interactables.isJournalOpen() && !storage.isOpen()) {
            building.buildMode = false;
            crafting.close();
            equipment.toggle();
        }
    },
    onDrop: () => {
        if (menu.isOpen || struggle.active || struggle.isDead || interactables.isJournalOpen() || storage.isOpen()) return;
        const slot = inventory.getSelected();
        if (!slot) return;
        const itemId = slot.id;
        if (inventory.consumeSelected(1)) {
            const dropped = droppedItems.drop(itemId, 1, player.x, player.y, player.angle);
            if (dropped) network.send('item_dropped', { item: dropped });
            if (!inventory.getSelected()) building.buildMode = false;
        }
    },
    onInteract: () => {
        if (menu.isOpen || struggle.active || struggle.isDead || interactables.isJournalOpen()) return;
        if (storage.isOpen()) {
            const st = storage.activeStruct;
            storage.close();
            if (st) network.send('structure_update', { action: 'update', struct: st });
            return;
        }

        const picked = droppedItems.tryPickup(player, inventory, lootBoxes);
        if (picked) {
            network.send('item_picked', { uid: picked.uid });
            return;
        }

        const nearStruct = interactables.getNearbyStructure(player, building)?.struct;
        if (interactables.interact(player, building, crafting, inventory, storage)) {
            if (nearStruct) network.send('structure_update', { action: 'update', struct: nearStruct });
            return;
        }

        const boxId = lootBoxes.tryOpen(player, world, inventory);
        if (boxId) network.send('box_opened', { boxId });
    },
    onSpace: () => {
        if (!menu.isOpen && !interactables.isJournalOpen()) struggle.mashKey();
    },
    onRestart: () => {
        if (struggle.isDead) location.reload();
    },
    onMenu: () => menu.toggle(),
    onDigit: (idx) => {
        if (menu.isOpen || interactables.isJournalOpen() || crafting.isOpen || equipment.isOpen || storage.isOpen()) return;
        if (idx !== inventory.maxSlots && idx <= inventory.maxSlots - 1) {
            inventory.select(idx);
            const slot = inventory.getSelected();
            const def = slot ? ITEMS[slot.id] : null;
            building.buildMode = Boolean(def && def.type === 'build');
        }
    },
    onPrimaryAction: () => {
        if (struggle.isDead) {
            location.reload();
            return;
        }
        if (menu.isOpen || struggle.active || interactables.isJournalOpen()) return;

        const uiScale = settings.data.graphics.uiScale || 1.0;
        const uiMouseX = input.mouse.x / uiScale;
        const uiMouseY = input.mouse.y / uiScale;

        if (storage.isOpen()) {
            storage.handleClick(uiMouseX, uiMouseY, inventory);
            if (storage.activeStruct) network.send('structure_update', { action: 'update', struct: storage.activeStruct });
            return;
        }
        if (crafting.isOpen) { crafting.handleClick(uiMouseX, uiMouseY, inventory); return; }
        if (equipment.isOpen) { equipment.handleClick(uiMouseX, uiMouseY, inventory); return; }

        const uiW = canvas.width / uiScale;
        const uiH = canvas.height / uiScale;
        const slotSize = 54, gap = 10, count = inventory.maxSlots;
        const startX = (uiW - (count * slotSize + (count - 1) * gap)) / 2;
        const startY = uiH - slotSize - 22;
        if (uiMouseY >= startY && uiMouseY <= startY + slotSize) {
            for (let i = 0; i !== count; i++) {
                const sx = startX + i * (slotSize + gap);
                if (uiMouseX >= sx && uiMouseX <= sx + slotSize) {
                    actionCallbacks.onDigit(i);
                    return;
                }
            }
        }

        const slot = inventory.getSelected();
        if (!slot) return;
        const def = ITEMS[slot.id];
        if (!def) return;

        if (def.type === 'consumable') {
            if (inventory.consumeSelected(1)) {
                player.stamina = CONFIG.MAX_STAMINA;
                player.exhausted = false;
                player.heal(def.healAmount || 35);
            }
            return;
        }

        if (def.type === 'gear') {
            equipment.equipFromInventory(inventory.selectedSlot, inventory);
            return;
        }

        if (def.type === 'build' && building.buildMode) {
            const { tileX, tileY } = building.getTargetTile(input, camera, canvas.width, canvas.height);
            if (building.canPlace(tileX, tileY, player, world, lootBoxes)) {
                if (inventory.consumeSelected(1)) {
                    const placed = building.place(tileX, tileY, def.id);
                    if (placed) network.send('structure_update', { action: 'place', struct: placed });
                }
            }
        }
    },
    onSecondaryAction: () => {
        if (menu.isOpen || crafting.isOpen || equipment.isOpen || storage.isOpen() || !building.buildMode || struggle.active || struggle.isDead) return;
        const { tileX, tileY } = building.getTargetTile(input, camera, canvas.width, canvas.height);
        const removed = building.remove(tileX, tileY);
        if (removed) {
            inventory.addItem(removed.id, 1);
            network.send('structure_update', { action: 'remove', tileX, tileY });
        }
    }
};

const input = new Input(canvas, actionCallbacks);
const touchControls = new TouchControls(canvas, input, actionCallbacks);
input.touchControls = touchControls;

const lighting = new Lighting();
const vhs = new VHSEffect();
const crosshair = new Crosshair();
const gameTime = new GameTime();
const dust = new DustSystem();

let lastTime = performance.now();

function gameLoop(currentTime) {
    const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    const gfx = settings.data.graphics;
    const prof = settings.data.profile;
    const username = auth.getCurrentUsername() || 'Исследователь';
    const uiScale = gfx.uiScale || 1.0;
    lighting.rayCount = gfx.rayCount;

    const isMultiplayer = network.remotePlayers.size !== 0;
    const paused = (menu.isOpen && !isMultiplayer) || struggle.isDead || interactables.isJournalOpen() || touchControls.editMode;

    if (!paused) {
        gameTime.update(dt);
        if (network.isHost) saveSystem.update(dt, username, getWorldState());
        lootBoxes.update(dt);
        droppedItems.update(dt, world, building);
        equipment.update(dt);
        interactables.update(dt, player, building, crafting, entity);
        player.update(dt, input, world, building, lootBoxes, camera, canvas.width, canvas.height, struggle.active);
        entity.update(dt, player, input, world, building, lighting, gameTime, struggle, network.isHost);
        struggle.update(dt, player, entity, world, building);
        camera.update(dt, player, input, canvas.width, canvas.height);
        crosshair.update(dt, player, input);
        if (gfx.dust) dust.update(dt, camera);
    }

    social.update(dt);
    network.update(dt, player, prof, username, entity);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    camera.apply(ctx, canvas.width, canvas.height, gfx.cameraMotion);
    world.draw(ctx, camera, canvas.width + 200, canvas.height + 200);
    player.drawBloodTrail(ctx);
    lootBoxes.draw(ctx, camera, world, player, canvas.width + 200, canvas.height + 200);
    droppedItems.draw(ctx, camera, player, canvas.width + 200, canvas.height + 200);
    interactables.drawPowerCables(ctx, building);
    building.drawStructures(ctx, camera, canvas.width + 200, canvas.height + 200);
    interactables.drawHint(ctx, player, building, inventory);
    building.drawPreview(ctx, input, player, world, lootBoxes, inventory, camera, canvas.width, canvas.height);
    
    const allLitPlayers = [player, ...network.getRemotePlayersList()];
    const entityVisible = struggle.active || (
        entity.state !== 'DORMANT' &&
        allLitPlayers.some(p => lighting.isPointVisible(entity.x, entity.y, p, world, building, gameTime))
    );
    if (entityVisible) {
        entity.draw(ctx);
    }

    network.drawRemotePlayers(ctx, player, lighting, world, building);
    player.draw(ctx, prof.color, username);
    ctx.restore();

    lighting.render(ctx, camera, world, building, allLitPlayers, gameTime, canvas.width, canvas.height);

    if (gfx.dust) {
        ctx.save();
        camera.apply(ctx, canvas.width, canvas.height, gfx.cameraMotion);
        dust.draw(ctx, allLitPlayers, lighting, world, gameTime.isNight());
        ctx.restore();
    }

    const threat = entity.getThreatLevel(player);
    if (gfx.vhsEffect) {
        vhs.draw(ctx, canvas.width, canvas.height, dt, threat, player.hp);
    }

    const uiW = canvas.width / uiScale;
    const uiH = canvas.height / uiScale;
    ctx.save();
    ctx.scale(uiScale, uiScale);
    gameTime.drawHUD(ctx, uiW);
    saveSystem.drawStatus(ctx, uiW);
    network.drawStatusHUD(ctx, uiW);
social.drawNotification(ctx, uiW);
lootBoxes.drawNotification(ctx, uiW, uiH);
buildHud.draw(ctx, inventory, building, uiW, uiH);
crafting.draw(ctx, inventory, uiW, uiH);
equipment.draw(ctx, player, inventory, prof, uiW, uiH);
storage.draw(ctx, inventory, uiW, uiH);
struggle.draw(ctx, uiW, uiH, touchControls.enabled);
ctx.restore();
if (!menu.isOpen) {
touchControls.draw(ctx, canvas.width, canvas.height, struggle.active, struggle.isDead);
if (!interactables.isJournalOpen() && !touchControls.enabled) {
crosshair.draw(ctx, input, player);
}
}
requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);