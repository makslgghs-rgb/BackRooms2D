export class MainMenu {
    constructor(settings, auth, callbacks = {}) {
        this.settings = settings;
        this.auth = auth;
        this.callbacks = callbacks;
        this.isOpen = true;
        this.hasStarted = false;
        this.activeTab = 'lobby';
        this.authMode = 'login';
        this.authError = '';
        this.myRoomCode = 'BR-' + Math.floor(1000 + Math.random() * 9000);

        if (this.auth.isLoggedIn()) {
            this.settings.setUser(this.auth.getCurrentUsername());
        }

        this.overlay = document.createElement('div');
        this.overlay.id = 'mainMenuOverlay';
        document.body.appendChild(this.overlay);

        this.render();
    }

    toggle() {
        if (!this.hasStarted || !this.auth.isLoggedIn()) return;
        this.isOpen = !this.isOpen;
        this.overlay.classList.toggle('hidden', !this.isOpen);
        if (this.isOpen) this.render();
    }

    startGame(lobbyInfo = null) {
        if (!this.auth.isLoggedIn()) return;
        this.hasStarted = true;
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        if (this.callbacks.onStartGame) {
            this.callbacks.onStartGame(lobbyInfo);
        }
    }

        render() {
        if (!this.auth.isLoggedIn()) {
            this.renderAuthScreen();
            return;
        }

        const reqCount = this.social ? this.social.incomingRequests.length : 0;
        const friendsLabel = reqCount !== 0 ? `ДРУЗЬЯ (${reqCount})` : 'ДРУЗЬЯ';

        const tabs = [
            { id: 'lobby', label: 'ЛОББИ' },
            { id: 'profile', label: 'ПРОФИЛЬ' },
            { id: 'friends', label: friendsLabel },
            { id: 'graphics', label: 'ГРАФИКА' }
        ];

        this.overlay.innerHTML = `
            <div class="vhs-panel">
                <div class="vhs-header">
                    <div class="vhs-title">BACKROOMS // ${this.auth.getCurrentUsername()}</div>
                    <div style="color:#ef4444; font-weight:bold;">● REC</div>
                </div>
                <div class="vhs-tabs">
                    ${tabs.map(t => `
                        <button class="vhs-tab ${this.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
                            ${t.label}
                        </button>
                    `).join('')}
                </div>
                <div class="vhs-section" id="menuBody"></div>
            </div>
        `;

        this.overlay.querySelectorAll('.vhs-tab').forEach(btn => {
            btn.onclick = () => {
                this.activeTab = btn.dataset.tab;
                this.render();
            };
        });

        const body = this.overlay.querySelector('#menuBody');
        if (this.activeTab === 'lobby') this.renderLobby(body);
        if (this.activeTab === 'profile') this.renderProfile(body);
        if (this.activeTab === 'friends') this.renderFriends(body);
        if (this.activeTab === 'graphics') this.renderGraphics(body);
    }

    renderAuthScreen() {
        const isReg = this.authMode === 'register';
        this.overlay.innerHTML = `
            <div class="vhs-panel">
                <div class="vhs-header">
                    <div class="vhs-title">ASYNC // АВТОРИЗАЦИЯ</div>
                    <div style="color:#fef08a; font-size:13px;">TERMINAL 04</div>
                </div>
                <div class="vhs-tabs">
                    <button class="vhs-tab ${!isReg ? 'active' : ''}" id="tabLogin">ВХОД</button>
                    <button class="vhs-tab ${isReg ? 'active' : ''}" id="tabRegister">РЕГИСТРАЦИЯ</button>
                </div>
                <div class="vhs-section">
                    <div class="vhs-row">
                        <span>Уникальный позывной:</span>
                        <input class="vhs-input" id="authNick" placeholder="3-16 символов" maxlength="16" style="width:55%;">
                    </div>
                    <div id="nickStatus" style="font-size:12px; min-height:16px; color:#a1a1aa;"></div>
                    <div class="vhs-row">
                        <span>Пароль доступа:</span>
                        <input class="vhs-input" id="authPass" type="password" placeholder="Минимум 4 символа" style="width:55%;">
                    </div>
                    ${isReg ? `
                        <div class="vhs-row">
                            <span>Повторите пароль:</span>
                            <input class="vhs-input" id="authPassConfirm" type="password" placeholder="Повтор пароля" style="width:55%;">
                        </div>
                    ` : ''}
                    <div style="color:#ef4444; font-size:13px; min-height:18px;">${this.authError}</div>
                    <button class="vhs-btn" id="btnAuthSubmit">
                        ${isReg ? 'ЗАРЕГИСТРИРОВАТЬ АККАУНТ' : 'ВОЙТИ В СИСТЕМУ'}
                    </button>
                </div>
            </div>
        `;

        this.overlay.querySelector('#tabLogin').onclick = () => {
            this.authMode = 'login';
            this.authError = '';
            this.render();
        };
        this.overlay.querySelector('#tabRegister').onclick = () => {
            this.authMode = 'register';
            this.authError = '';
            this.render();
        };

        const nickInput = this.overlay.querySelector('#authNick');
        const nickStatus = this.overlay.querySelector('#nickStatus');

        if (isReg) {
            nickInput.oninput = () => {
                const val = nickInput.value.trim();
                if (!val) {
                    nickStatus.textContent = '';
                } else if (this.auth.isNicknameTaken(val)) {
                    nickStatus.style.color = '#ef4444';
                    nickStatus.textContent = '✖ Этот позывной уже занят';
                } else if (val.length >= 3) {
                    nickStatus.style.color = '#4ade80';
                    nickStatus.textContent = '✔ Позывной свободен';
                } else {
                    nickStatus.style.color = '#a1a1aa';
                    nickStatus.textContent = 'Минимум 3 символа';
                }
            };
        }

        this.overlay.querySelector('#btnAuthSubmit').onclick = async () => {
            const nick = nickInput.value;
            const pass = this.overlay.querySelector('#authPass').value;

            if (isReg) {
                const confirm = this.overlay.querySelector('#authPassConfirm').value;
                if (pass !== confirm) {
                    this.authError = 'Пароли не совпадают!';
                    this.render();
                    return;
                }
                const res = await this.auth.register(nick, pass);
                if (!res.ok) {
                    this.authError = res.error;
                    this.render();
                    return;
                }
            } else {
                const res = await this.auth.login(nick, pass);
                if (!res.ok) {
                    this.authError = res.error;
                    this.render();
                    return;
                }
            }

            this.authError = '';
            this.settings.setUser(this.auth.getCurrentUsername());
            this.render();
        };
    }
            renderLobby(body) {
        const username = this.auth.getCurrentUsername();
        const hasSave = this.callbacks.hasSave ? this.callbacks.hasSave(username) : false;

        let mainBtnText = 'НАЧАТЬ ЭКСПЕДИЦИЮ (СОЗДАТЬ КОМНАТУ)';
        if (this.hasStarted) {
            mainBtnText = 'ПРОДОЛЖИТЬ ЗАПИСЬ [ESC]';
        } else if (hasSave) {
            mainBtnText = 'ПРОДОЛЖИТЬ СОХРАНЁННЫЙ МИР (ОНЛАЙН)';
        }

        body.innerHTML = `
            <button class="vhs-btn" id="btnPlaySolo">${mainBtnText}</button>
            ${this.hasStarted ? `
                <button class="vhs-btn secondary" id="btnLeaveWorld" style="color:#ef4444; border-color:#ef4444;">
                    ВЫЙТИ ИЗ МИРА (В ЛОББИ)
                </button>
            ` : ''}
            ${(this.hasStarted || hasSave) ? `
                <div style="display:flex; gap:8px;">
                    ${this.hasStarted ? `<button class="vhs-btn secondary" id="btnManualSave" style="flex:1; color:#4ade80;">СОХРАНИТЬ МИР</button>` : ''}
                    ${hasSave ? `<button class="vhs-btn secondary" id="btnDeleteSave" style="flex:1; color:#ef4444;">УДАЛИТЬ МИР</button>` : ''}
                </div>
            ` : ''}
            <div class="vhs-row">
                <span>Код твоей комнаты:</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    <strong style="color:#fef08a; font-size:16px;">${this.myRoomCode}</strong>
                    <button class="vhs-btn secondary" id="btnCopyCode" style="padding:4px 8px; font-size:12px;">КОПИРОВАТЬ</button>
                </div>
            </div>
            <div class="vhs-row">
                <input class="vhs-input" id="joinCodeInput" placeholder="Код друга (BR-XXXX)" style="width:62%;">
                <button class="vhs-btn secondary" id="btnJoinRoom">ВОЙТИ В ЛОББИ</button>
            </div>
        `;

        body.querySelector('#btnCopyCode').onclick = (e) => {
            navigator.clipboard?.writeText(this.myRoomCode);
            e.target.textContent = 'ГОТОВО!';
            setTimeout(() => { e.target.textContent = 'КОПИРОВАТЬ'; }, 1500);
        };

        body.querySelector('#btnPlaySolo').onclick = () => {
            this.startGame({ mode: 'host', loadSave: !this.hasStarted && hasSave, code: this.myRoomCode });
        };

        const btnLeave = body.querySelector('#btnLeaveWorld');
        if (btnLeave) {
            btnLeave.onclick = () => {
                this.hasStarted = false;
                if (this.callbacks.onLeaveWorld) this.callbacks.onLeaveWorld();
                this.render();
            };
        }

        const btnSave = body.querySelector('#btnManualSave');
        if (btnSave) {
            btnSave.onclick = () => {
                if (this.callbacks.onSaveWorld) this.callbacks.onSaveWorld();
                this.render();
            };
        }

        const btnDel = body.querySelector('#btnDeleteSave');
        if (btnDel) {
            btnDel.onclick = () => {
                if (this.callbacks.onDeleteWorld) this.callbacks.onDeleteWorld();
                this.hasStarted = false;
                this.render();
            };
        }

        body.querySelector('#btnJoinRoom').onclick = () => {
            const code = body.querySelector('#joinCodeInput').value.trim().toUpperCase();
            if (code) this.startGame({ mode: 'join', code });
        };
    }


    renderProfile(body) {
        const { color } = this.settings.data.profile;
        const username = this.auth.getCurrentUsername();
        const colors = [
            { hex: '#3b82f6', label: 'Синий' },
            { hex: '#eab308', label: 'Химзащита' },
            { hex: '#22c55e', label: 'Зеленый' },
            { hex: '#ef4444', label: 'Красный' },
            { hex: '#e4e4e7', label: 'Белый' }
        ];

        body.innerHTML = `
            <div class="vhs-row">
                <span>Зарегистрированный позывной:</span>
                <strong style="color:#fef08a;">${username}</strong>
            </div>
            <div class="vhs-row">
                <span>Цвет костюма:</span>
                <div style="display:flex; gap:8px;">
                    ${colors.map(c => `
                        <button data-color="${c.hex}" style="
                            width:26px; height:26px; background:${c.hex}; cursor:pointer;
                            border: ${color === c.hex ? '3px solid #fff' : '1px solid #000'};
                        " title="${c.label}"></button>
                    `).join('')}
                </div>
            </div>
            <button class="vhs-btn secondary" id="btnLogout" style="color:#ef4444; margin-top:8px;">
                ВЫЙТИ ИЗ АККАУНТА
            </button>
        `;

        body.querySelectorAll('[data-color]').forEach(btn => {
            btn.onclick = () => {
                this.settings.data.profile.color = btn.dataset.color;
                this.settings.save();
                this.render();
            };
        });

        body.querySelector('#btnLogout').onclick = () => {
            this.auth.logout();
            this.hasStarted = false;
            this.authMode = 'login';
            this.authError = '';
            this.render();
        };
    }

    renderFriends(body) {
        const friends = this.settings.data.friends;
        const requests = this.social ? this.social.incomingRequests : [];

        body.innerHTML = `
            <div class="vhs-row" style="gap:6px;">
                <input class="vhs-input" id="frName" placeholder="Введите ник друга..." style="width:78%;">
                <button class="vhs-btn" id="btnAddFriend" style="width:20%;">+</button>
            </div>

            ${requests.length !== 0 ? `
                <div style="font-size:12px; color:#fef08a; margin-top:4px;">ВХОДЯЩИЕ ЗАЯВКИ В ДРУЗЬЯ:</div>
                ${requests.map(r => `
                    <div class="friend-item" style="border-left-color:#4ade80;">
                        <span><strong>${r.from}</strong> хочет добавить вас</span>
                        <div style="display:flex; gap:6px;">
                            <button class="vhs-btn" data-acc="${r.from}" style="padding:4px 8px; font-size:11px;">ПРИНЯТЬ</button>
                            <button class="vhs-btn secondary" data-dec="${r.from}" style="padding:4px 8px; font-size:11px; color:#ef4444;">ОТКЛОНИТЬ</button>
                        </div>
                    </div>
                `).join('')}
            ` : ''}

            <div style="display:flex; flex-direction:column; gap:6px; max-height:140px; overflow-y:auto;">
                ${friends.length === 0 ? '<div style="color:#71717a;">Список друзей пуст</div>' : ''}
                ${friends.map((f, i) => {
                    const online = this.social ? this.social.onlineFriends.get(f.name.toLowerCase()) : null;
                    const room = online?.roomCode || f.code;
                    return `
                        <div class="friend-item">
                            <span>
                                <strong style="color:${online ? '#4ade80' : '#a1a1aa'};">●</strong>
                                <strong>${f.name}</strong> ${room ? `(${room})` : '(в меню)'}
                            </span>
                            <div style="display:flex; gap:6px;">
                                ${room ? `<button class="vhs-btn secondary" data-connect="${room}" style="padding:4px 8px;">ВХОД</button>` : ''}
                                <button class="vhs-btn secondary" data-del="${i}" style="padding:4px 8px; color:#ef4444;">X</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        body.querySelector('#btnAddFriend').onclick = () => {
            const nick = body.querySelector('#frName').value.trim();
            if (nick && this.social) {
                this.social.sendFriendRequest(nick);
                body.querySelector('#frName').value = '';
            }
        };

        body.querySelectorAll('[data-acc]').forEach(btn => {
            btn.onclick = () => { if (this.social) this.social.acceptRequest(btn.dataset.acc); };
        });

        body.querySelectorAll('[data-dec]').forEach(btn => {
            btn.onclick = () => { if (this.social) this.social.declineRequest(btn.dataset.dec); };
        });

        body.querySelectorAll('[data-del]').forEach(btn => {
            btn.onclick = () => {
                this.settings.removeFriend(Number(btn.dataset.del));
                this.render();
            };
        });

        body.querySelectorAll('[data-connect]').forEach(btn => {
            btn.onclick = () => this.startGame({ mode: 'join', code: btn.dataset.connect });
        });
    }


        renderGraphics(body) {
        const g = this.settings.data.graphics;
        const scale = g.uiScale || 1.0;

        body.innerHTML = `
            <div class="vhs-row">
                <span>Масштаб интерфейса (HUD и текст):</span>
                <select class="vhs-input" id="gfxUiScale">
                    <option value="0.75" ${scale === 0.75 ? 'selected' : ''}>75% (Компактный)</option>
                    <option value="1" ${scale === 1 ? 'selected' : ''}>100% (Стандарт)</option>
                    <option value="1.25" ${scale === 1.25 ? 'selected' : ''}>125% (Крупный)</option>
                    <option value="1.5" ${scale === 1.5 ? 'selected' : ''}>150% (Очень крупный)</option>
                </select>
            </div>
            <div class="vhs-row">
                <span>VHS-фильтры (зерно и полосы):</span>
                <input type="checkbox" id="gfxVhs" ${g.vhsEffect ? 'checked' : ''}>
            </div>
            <div class="vhs-row">
                <span>Пылинки в луче фонарика:</span>
                <input type="checkbox" id="gfxDust" ${g.dust ? 'checked' : ''}>
            </div>
            <div class="vhs-row">
                <span>Покачивание и наклон камеры:</span>
                <input type="checkbox" id="gfxCam" ${g.cameraMotion ? 'checked' : ''}>
            </div>
            <div class="vhs-row">
                <span>Сенсорные кнопки (Телефон):</span>
                <button class="vhs-btn secondary" id="btnEditTouch" style="padding:6px 12px;">ПЕРЕТАЩИТЬ КНОПКИ</button>
            </div>

            <div class="vhs-row">
                <span>Качество теней (лучи):</span>
                <select class="vhs-input" id="gfxRays">
                    <option value="95" ${g.rayCount === 95 ? 'selected' : ''}>Высокое (95)</option>
                    <option value="55" ${g.rayCount === 55 ? 'selected' : ''}>Среднее (55)</option>
                    <option value="32" ${g.rayCount === 32 ? 'selected' : ''}>Низкое (32 - макс FPS)</option>
                </select>
            </div>
        `;

        body.querySelector('#gfxUiScale').onchange = (e) => {
            g.uiScale = Number(e.target.value);
            this.settings.save();
            // Сразу масштабируем и само окно главного меню
            const panel = this.overlay.querySelector('.vhs-panel');
            if (panel) panel.style.transform = `scale(${g.uiScale})`;
        };
        body.querySelector('#btnEditTouch').onclick = () => {
            if (this.callbacks.onEditTouch) {
                this.isOpen = false;
                this.overlay.classList.add('hidden');
                this.callbacks.onEditTouch();
            }
        };

        body.querySelector('#gfxVhs').onchange = (e) => { g.vhsEffect = e.target.checked; this.settings.save(); };
        body.querySelector('#gfxDust').onchange = (e) => { g.dust = e.target.checked; this.settings.save(); };
        body.querySelector('#gfxCam').onchange = (e) => { g.cameraMotion = e.target.checked; this.settings.save(); };
        body.querySelector('#gfxRays').onchange = (e) => { g.rayCount = Number(e.target.value); this.settings.save(); };

        const panel = this.overlay.querySelector('.vhs-panel');
        if (panel) panel.style.transform = `scale(${scale})`;
    }
}

