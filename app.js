// ===================================
// 終末地武器刻寫規劃器 — 核心邏輯
// ===================================

// ===================
// 遊戲資料
// ===================

const GAME_DATA = {
    // 基礎屬性（所有淤積點共有）
    baseAffixes: ['力量提升', '智識提升', '敏捷提升', '意志提升', '主能力提升'],

    // 四個能量淤積點
    locations: {
        hub: {
            name: '樞紐區',
            icon: '🏛️',
            cssClass: 'loc-hub',
            extraAffixes: [
                '攻擊提升', '生命提升', '物理傷害提升', '暴擊率提升',
                '暴擊傷害提升', '終結技充能效率', '治療效率', '源石技藝強度'
            ],
            skillAffixes: [
                '強攻', '壓制', '追襲', '昂揚',
                '粉碎', '巧技', '附術', '夜幕'
            ],
        },
        originium: {
            name: '源石研究園',
            icon: '🔬',
            cssClass: 'loc-originium',
            extraAffixes: [
                '攻擊提升', '法術傷害提升', '電磁傷害提升', '灼熱傷害提升',
                '源石技藝強度', '終結技充能效率', '暴擊率提升', '治療效率'
            ],
            skillAffixes: [
                '流轉', '迸發', '殘暴', '效益',
                '醫療', '附術', '夜幕', '強攻'
            ],
        },
        ore: {
            name: '礦脈源區',
            icon: '⛏️',
            cssClass: 'loc-ore',
            extraAffixes: [
                '攻擊提升', '物理傷害提升', '寒冷傷害提升', '自然傷害提升',
                '暴擊傷害提升', '生命提升', '終結技充能效率', '源石技藝強度'
            ],
            skillAffixes: [
                '壓制', '追襲', '粉碎', '巧技',
                '流轉', '迸發', '昂揚', '殘暴'
            ],
        },
        power: {
            name: '供能高地',
            icon: '⚡',
            cssClass: 'loc-power',
            extraAffixes: [
                '攻擊提升', '法術傷害提升', '電磁傷害提升', '灼熱傷害提升',
                '暴擊率提升', '暴擊傷害提升', '治療效率', '生命提升'
            ],
            skillAffixes: [
                '強攻', '效益', '醫療', '夜幕',
                '附術', '壓制', '追襲', '巧技'
            ],
        },
    },

    // 刻寫機率
    inscription: {
        staminaPerRun: 80,
        withTicket: {
            slot1Prob: 1 / 3,  // 3選1
            slot2Prob: 1,       // 固定保證
            slot3Prob: 1 / 8,
            get totalProb() { return this.slot1Prob * this.slot2Prob * this.slot3Prob; },
            get expectedRuns() { return Math.round(1 / this.totalProb); },
        },
        withoutTicket: {
            slot1Prob: 1 / 5,
            slot2Prob: 1 / 8,
            slot3Prob: 1 / 8,
            get totalProb() { return this.slot1Prob * this.slot2Prob * this.slot3Prob; },
            get expectedRuns() { return Math.round(1 / this.totalProb); },
        },
    },
};

// 建立快速查詢表：詞條 → 哪些淤積點有
function buildAffixLocationMap() {
    const map = {};

    // 基礎屬性所有地方都有
    GAME_DATA.baseAffixes.forEach((affix) => {
        map[affix] = { type: 'base', locations: Object.keys(GAME_DATA.locations) };
    });

    // 附加屬性
    Object.entries(GAME_DATA.locations).forEach(([locKey, locData]) => {
        locData.extraAffixes.forEach((affix) => {
            if (!map[affix]) map[affix] = { type: 'extra', locations: [] };
            if (!map[affix].locations.includes(locKey)) {
                map[affix].locations.push(locKey);
            }
        });
    });

    // 技能屬性
    Object.entries(GAME_DATA.locations).forEach(([locKey, locData]) => {
        locData.skillAffixes.forEach((affix) => {
            if (!map[affix]) map[affix] = { type: 'skill', locations: [] };
            if (!map[affix].locations.includes(locKey)) {
                map[affix].locations.push(locKey);
            }
        });
    });

    return map;
}

const AFFIX_LOCATION_MAP = buildAffixLocationMap();

// 取得所有可選詞條
function getAllAffixes(type) {
    const set = new Set();
    if (type === 'base') {
        GAME_DATA.baseAffixes.forEach((a) => set.add(a));
    } else if (type === 'extra') {
        Object.values(GAME_DATA.locations).forEach((loc) => {
            loc.extraAffixes.forEach((a) => set.add(a));
        });
    } else if (type === 'skill') {
        Object.values(GAME_DATA.locations).forEach((loc) => {
            loc.skillAffixes.forEach((a) => set.add(a));
        });
    }
    return [...set].sort();
}

// ===================
// 狀態管理
// ===================

let weaponIdCounter = 0;
const weapons = new Map(); // id -> { name, base, extra, skill }

// ===================
// DOM 引用
// ===================

const weaponsGrid = document.getElementById('weaponsGrid');
const emptyState = document.getElementById('emptyState');
const addWeaponBtn = document.getElementById('addWeaponBtn');
const analyzeBar = document.getElementById('analyzeBar');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('resultsSection');
const weaponCountEl = document.getElementById('weaponCount');
const totalStaminaEl = document.getElementById('totalStamina');

// ===================
// 背景粒子效果
// ===================

// ===================
// 主題切換 (Dark Mode Toggle)
// ===================

function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme');

    // 預設遵循系統偏好，或上次儲存的選擇
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

    setTheme(initialTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function initParticles() {
    const container = document.getElementById('bgParticles');
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDelay = Math.random() * 8 + 's';
        p.style.animationDuration = (6 + Math.random() * 6) + 's';
        p.style.width = (1 + Math.random() * 2) + 'px';
        p.style.height = p.style.width;
        container.appendChild(p);
    }
}

// ===================
// 武器卡片
// ===================

function createWeaponCard(id) {
    const card = document.createElement('div');
    card.className = 'weapon-card';
    card.id = `weapon-${id}`;
    card.style.animationDelay = '0.05s';

    const baseOptions = getAllAffixes('base').map((a) => `<option value="${a}">${a}</option>`).join('');
    const extraOptions = getAllAffixes('extra').map((a) => `<option value="${a}">${a}</option>`).join('');
    const skillOptions = getAllAffixes('skill').map((a) => `<option value="${a}">${a}</option>`).join('');

    card.innerHTML = `
        <div class="weapon-card-header">
            <input type="text" class="weapon-name-input" placeholder="武器名稱（如：宏願）"
                   data-field="name" id="weapon-name-${id}">
            <button class="btn btn-danger" onclick="removeWeapon(${id})">✕ 移除</button>
        </div>

        <div class="affix-group">
            <label class="affix-label">
                <span class="affix-badge badge-base">第1詞條</span> 基礎屬性
            </label>
            <select class="affix-select" data-field="base" id="weapon-base-${id}">
                <option value="">— 選擇基礎屬性 —</option>
                ${baseOptions}
            </select>
        </div>

        <div class="affix-group">
            <label class="affix-label">
                <span class="affix-badge badge-extra">第2詞條</span> 附加屬性
            </label>
            <select class="affix-select" data-field="extra" id="weapon-extra-${id}">
                <option value="">— 選擇附加屬性 —</option>
                ${extraOptions}
            </select>
        </div>

        <div class="affix-group">
            <label class="affix-label">
                <span class="affix-badge badge-skill">第3詞條</span> 技能屬性
            </label>
            <select class="affix-select" data-field="skill" id="weapon-skill-${id}">
                <option value="">— 選擇技能屬性 —</option>
                ${skillOptions}
            </select>
        </div>
    `;

    // 綁定事件
    card.querySelectorAll('select, input').forEach((el) => {
        el.addEventListener('change', () => updateWeaponData(id));
        el.addEventListener('input', () => updateWeaponData(id));
    });

    return card;
}

function addWeapon() {
    const id = weaponIdCounter++;
    weapons.set(id, { name: '', base: '', extra: '', skill: '' });

    const card = createWeaponCard(id);
    weaponsGrid.appendChild(card);

    updateUI();

    // Focus the name input
    setTimeout(() => {
        document.getElementById(`weapon-name-${id}`)?.focus();
    }, 100);
}

function removeWeapon(id) {
    weapons.delete(id);
    const card = document.getElementById(`weapon-${id}`);
    if (card) {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9) translateY(-10px)';
        setTimeout(() => {
            card.remove();
            updateUI();
        }, 300);
    }
}

function updateWeaponData(id) {
    const w = weapons.get(id);
    if (!w) return;

    w.name = document.getElementById(`weapon-name-${id}`)?.value || '';
    w.base = document.getElementById(`weapon-base-${id}`)?.value || '';
    w.extra = document.getElementById(`weapon-extra-${id}`)?.value || '';
    w.skill = document.getElementById(`weapon-skill-${id}`)?.value || '';
}

function animateValue(obj, start, end, duration) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const val = Math.floor(progress * (end - start) + start);
        obj.innerHTML = val.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function updateUI() {
    const count = weapons.size;

    // Animate weapon count
    const oldCount = parseInt(weaponCountEl.textContent) || 0;
    if (oldCount !== count) {
        animateValue(weaponCountEl, oldCount, count, 600);
    }

    emptyState.style.display = count === 0 ? 'block' : 'none';
    analyzeBar.style.display = count > 0 ? 'block' : 'none';

    if (count === 0) {
        resultsSection.style.display = 'none';
        totalStaminaEl.textContent = '—';
    }
}

// ===================
// 分析引擎
// ===================

function analyze() {
    const weaponList = [];
    weapons.forEach((w, id) => {
        const affixes = [w.base, w.extra, w.skill].filter(Boolean);
        if (affixes.length > 0) {
            weaponList.push({
                id,
                name: w.name || `武器 ${id + 1}`,
                base: w.base,
                extra: w.extra,
                skill: w.skill,
                affixes,
            });
        }
    });

    if (weaponList.length === 0) return;

    // 1. 刷取地點分析
    renderFarmingLocations(weaponList);

    // 2. CP值分析
    renderCPAnalysis(weaponList);

    // 3. 路線規劃
    renderRoutePlan(weaponList);

    // 4. 同刷合併建議
    renderCofarmAnalysis(weaponList);

    // 更新 header 體力
    const ins = GAME_DATA.inscription;
    const totalStamina = weaponList.length * ins.withTicket.expectedRuns * ins.staminaPerRun;

    const oldStamina = parseInt(totalStaminaEl.textContent.replace(/,/g, '')) || 0;
    animateValue(totalStaminaEl, oldStamina, totalStamina, 800);

    // 顯示結果
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- 1. 刷取地點 ---
function renderFarmingLocations(weaponList) {
    const container = document.getElementById('farmingContent');
    let html = '';

    weaponList.forEach((w) => {
        html += `<div class="weapon-result-group">`;
        html += `<div class="weapon-result-title">${escHtml(w.name)}</div>`;

        // 基質必須一次刷出三個詞條，所以要找出「能夠同時滿足這把武器所有已選詞條」的淤積點
        let validLocations = Object.keys(GAME_DATA.locations);

        w.affixes.forEach((affix) => {
            const info = AFFIX_LOCATION_MAP[affix];
            if (info) {
                // 取交集，保留所有詞條共同存在的地點
                validLocations = validLocations.filter(loc => info.locations.includes(loc));
            } else {
                // 如果有未知詞條，則沒有合法地點
                validLocations = [];
            }
        });

        if (validLocations.length > 0) {
            html += `<div style="margin-bottom:12px; font-size:0.9rem;">
                <span style="color:var(--text-secondary);">這把武器的詞條可以同時在以下地點刷出：</span>
            </div>`;
            const locationTags = validLocations.map((locKey) => {
                const loc = GAME_DATA.locations[locKey];
                return `<span class="location-tag ${loc.cssClass}">${loc.icon} ${loc.name}</span>`;
            }).join('');
            html += `<div>${locationTags}</div>`;
        } else {
            html += `<div style="padding:12px; background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.2); border-radius:var(--radius-sm); color:var(--accent-red); font-size:0.9rem;">
                ⚠️ 警告：目前選擇的詞條無法在同一個淤積點同時刷出。基質掉落時必定三個詞條綁在一起，請重新選擇詞條搭配。
            </div>`;
        }

        html += `<div style="margin-top:16px; padding-top:12px; border-top:1px dashed var(--border-color);">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">詞條分佈詳情：</div>`;

        w.affixes.forEach((affix) => {
            const info = AFFIX_LOCATION_MAP[affix];
            const tags = info
                ? info.locations.map((locKey) => {
                    const loc = GAME_DATA.locations[locKey];
                    // 如果這個地點不在 validLocations 中，將其顯示為半透明
                    const opacity = validLocations.includes(locKey) ? '1' : '0.4';
                    return `<span class="location-tag ${loc.cssClass}" style="opacity:${opacity}">${loc.icon} ${loc.name}</span>`;
                }).join('')
                : '<span style="color:var(--text-muted)">未知</span>';

            const typeLabel = info?.type === 'base' ? '基礎' : info?.type === 'extra' ? '附加' : '技能';
            const badgeClass = info?.type === 'base' ? 'badge-base' : info?.type === 'extra' ? 'badge-extra' : 'badge-skill';

            html += `
                <div class="affix-item" style="padding:6px 10px;">
                    <span class="affix-item-name" style="font-size:0.85rem;">
                        <span class="affix-badge ${badgeClass}" style="font-size:0.6rem; padding:0 6px;">${typeLabel}</span>
                        ${escHtml(affix)}
                    </span>
                    <span class="affix-item-locations">${tags}</span>
                </div>`;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

// --- 2. CP值分析 ---
function renderCPAnalysis(weaponList) {
    const container = document.getElementById('cpContent');
    const ins = GAME_DATA.inscription;

    let html = `
        <table class="cp-table">
            <thead>
                <tr>
                    <th>方式</th>
                    <th>第1詞條</th>
                    <th>第2詞條</th>
                    <th>第3詞條</th>
                    <th>畢業機率</th>
                    <th>期望次數</th>
                    <th>期望體力</th>
                </tr>
            </thead>
            <tbody>
                <tr class="recommend">
                    <td><strong>✅ 有刻寫券</strong></td>
                    <td>1/3 (33.3%)</td>
                    <td>1/1 (100%)</td>
                    <td>1/8 (12.5%)</td>
                    <td class="highlight">${(ins.withTicket.totalProb * 100).toFixed(2)}%</td>
                    <td class="highlight">${ins.withTicket.expectedRuns} 次</td>
                    <td class="highlight">${(ins.withTicket.expectedRuns * ins.staminaPerRun).toLocaleString()}</td>
                </tr>
                <tr>
                    <td>❌ 無刻寫券</td>
                    <td>1/5 (20%)</td>
                    <td>1/8 (12.5%)</td>
                    <td>1/8 (12.5%)</td>
                    <td>${(ins.withoutTicket.totalProb * 100).toFixed(2)}%</td>
                    <td>${ins.withoutTicket.expectedRuns} 次</td>
                    <td>${(ins.withoutTicket.expectedRuns * ins.staminaPerRun).toLocaleString()}</td>
                </tr>
            </tbody>
        </table>

        <div style="margin-top:16px; padding:16px; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); border-radius:var(--radius-md);">
            <strong style="color:var(--accent-emerald);">💡 建議</strong>
            <p style="margin-top:6px; font-size:0.9rem; color:var(--text-secondary);">
                使用刻寫券效率提升約 <strong style="color:var(--accent-amber);">13.3 倍</strong>。
                刻寫券可鎖定第2詞條（附加屬性）必出，大幅降低隨機性。<br>
                建議策略：第1詞條選3選1模式，第2詞條用券固定，第3詞條隨機碰運氣。
            </p>
        </div>
    `;

    // 每把武器的體力估算
    if (weaponList.length > 1) {
        html += `
            <div style="margin-top:20px;">
                <strong style="color:var(--accent-cyan);">📋 各武器體力預估（有刻寫券）</strong>
                <div style="margin-top:10px;">`;

        weaponList.forEach((w) => {
            const stamina = ins.withTicket.expectedRuns * ins.staminaPerRun;
            html += `
                <div class="affix-item">
                    <span class="affix-item-name">⚔ ${escHtml(w.name)}</span>
                    <span style="color:var(--accent-amber); font-weight:700;">
                        ${ins.withTicket.expectedRuns} 次 ≈ ${stamina.toLocaleString()} 體力 + ${ins.withTicket.expectedRuns} 張券
                    </span>
                </div>`;
        });

        const totalStamina = weaponList.length * ins.withTicket.expectedRuns * ins.staminaPerRun;
        const totalTickets = weaponList.length * ins.withTicket.expectedRuns;
        html += `
                <div class="affix-item" style="background:rgba(0,194,255,0.06); border-color:rgba(0,194,255,0.15);">
                    <span class="affix-item-name" style="color:var(--accent-cyan); font-weight:700;">合計</span>
                    <span style="color:var(--accent-cyan); font-weight:700;">
                        ${totalStamina.toLocaleString()} 體力 + ${totalTickets} 張券
                    </span>
                </div>
            </div></div>`;
    }

    container.innerHTML = html;
}

// --- 3. 刻寫策略規劃 ---
function renderRoutePlan(weaponList) {
    const container = document.getElementById('routeContent');

    // 1. 找出每把武器的合法刷取地點
    const validWeapons = [];
    const invalidWeapons = [];

    weaponList.forEach((w) => {
        let locs = Object.keys(GAME_DATA.locations);
        w.affixes.forEach((affix) => {
            const info = AFFIX_LOCATION_MAP[affix];
            if (info) locs = locs.filter(l => info.locations.includes(l));
            else locs = [];
        });

        if (locs.length > 0) validWeapons.push({ weapon: w, locations: locs });
        else invalidWeapons.push(w);
    });

    // 2. 尋找可以同刷的武器組合
    const cofarmGroups = [];
    const cofarmedWeaponIds = new Set();

    if (validWeapons.length >= 2) {
        // 尋找在同一地點且有共同詞條的武器
        for (let i = 0; i < validWeapons.length; i++) {
            for (let j = i + 1; j < validWeapons.length; j++) {
                const w1Data = validWeapons[i];
                const w2Data = validWeapons[j];

                const sharedLocs = w1Data.locations.filter(l => w2Data.locations.includes(l));
                if (sharedLocs.length === 0) continue;

                const w1 = w1Data.weapon;
                const w2 = w2Data.weapon;

                const sharedBase = w1.base && w2.base && w1.base === w2.base ? w1.base : null;
                const sharedExtra = w1.extra && w2.extra && w1.extra === w2.extra ? w1.extra : null;
                const sharedSkill = w1.skill && w2.skill && w1.skill === w2.skill ? w1.skill : null;

                if (sharedBase || sharedExtra || sharedSkill) {
                    cofarmGroups.push({
                        weapons: [w1, w2],
                        sharedBase,
                        sharedExtra,
                        sharedSkill,
                        locations: sharedLocs
                    });
                    cofarmedWeaponIds.add(w1.id);
                    cofarmedWeaponIds.add(w2.id);
                }
            }
        }
    }

    // 孤立的合法武器（沒有跟別人同刷）
    const singleWeapons = validWeapons.filter(vw => !cofarmedWeaponIds.has(vw.weapon.id));

    let html = '';

    // --- 產生同刷合併策略 ---
    cofarmGroups.forEach((group) => {
        const weaponNames = group.weapons.map(w => `<span class="weapon-chip">⚔ ${escHtml(w.name)}</span>`).join('');
        const locTags = group.locations.map(lk => {
            const loc = GAME_DATA.locations[lk];
            return `<span class="location-tag ${loc.cssClass}">${loc.icon} ${loc.name}</span>`;
        }).join('');

        // 判斷刻寫券要鎖定什麼
        let lockAdvice = '';
        if (group.sharedExtra) {
            lockAdvice = `使用刻寫券鎖定共同的附加屬性：<strong style="color:var(--accent-emerald);">${group.sharedExtra}</strong>`;
        } else if (group.sharedBase) {
            lockAdvice = `雖無共同附加屬性，但基礎屬性皆為 <strong style="color:var(--accent-cyan);">${group.sharedBase}</strong>。建議「選項一」勾選該基礎屬性，並在「選項二」各自使用刻寫券鎖定各自不同的附加屬性。`;
        } else if (group.sharedSkill) {
            lockAdvice = `這兩把武器僅技能屬性相同。刻寫券需各自鎖定各自的附加屬性，並期望同時隨機掉落共有技能 <strong style="color:var(--accent-purple);">${group.sharedSkill}</strong>。`;
        }

        html += `
            <div class="route-step" style="background: linear-gradient(135deg, rgba(16,185,129,0.05), rgba(0,194,255,0.05)); border: 1px solid rgba(16,185,129,0.2);">
                <div class="route-step-num" style="background: var(--accent-emerald);">合</div>
                <div class="route-step-content">
                    <div style="font-weight:700; color:var(--accent-emerald); margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                        🔗 推薦合併刷取策略
                    </div>
                    <div class="route-step-weapons" style="margin-bottom:8px;">${weaponNames}</div>
                    <div style="margin-bottom:8px;">📍 刷取地點：${locTags}</div>
                    <div style="padding:12px; background:rgba(0,0,0,0.25); border-radius:var(--radius-sm); margin-top:8px;">
                        <span style="display:block; font-size:0.85rem; color:var(--accent-cyan); font-weight:700; margin-bottom:4px;">💡 最佳刻寫設定：</span>
                        <div style="font-size:0.95rem; margin-bottom:6px;">🎯 ${lockAdvice}</div>
                        <div style="font-size:0.85rem; color:var(--text-secondary);">※ 一旦在同地點掉落對應的基質，這張券的產出可能瞬間滿足這兩把武器的需求！</div>
                    </div>
                </div>
            </div>`;
    });

    // --- 產生孤立武器的刻寫策略 ---
    singleWeapons.forEach((sw) => {
        const w = sw.weapon;
        const locTags = sw.locations.map(lk => {
            const loc = GAME_DATA.locations[lk];
            return `<span class="location-tag ${loc.cssClass}">${loc.icon} ${loc.name}</span>`;
        }).join('');

        const baseStr = w.base || '無 (隨機)';
        const extraStr = w.extra || '無 (隨機)';
        const skillStr = w.skill || '無 (隨機)';

        html += `
            <div class="route-step">
                <div class="route-step-num">單</div>
                <div class="route-step-content">
                    <div class="route-step-weapons" style="margin-bottom:8px;">
                        <span class="weapon-chip">⚔ ${escHtml(w.name)}</span>
                    </div>
                    <div style="margin-bottom:8px;">📍 刷取地點：${locTags}</div>
                    <div style="padding:12px; background:rgba(0,0,0,0.25); border-radius:var(--radius-sm); margin-top:8px;">
                        <span style="display:block; font-size:0.85rem; color:var(--accent-cyan); font-weight:700; margin-bottom:8px;">💡 最佳刻寫設定：</span>
                        <ul style="list-style-type:none; padding:0; margin:0; font-size:0.95rem; line-height:1.7;">
                            <li><strong>1️⃣ 選項一 (勾選)：</strong>選基礎屬性 <strong style="color:var(--accent-cyan);">${baseStr}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">(3選1，機率33%)</span></li>
                            <li><strong>2️⃣ 選項二 (用券)：</strong><span style="color:var(--accent-amber); font-weight:700;">[鎖定]</span> 附加屬性 <strong style="color:var(--accent-emerald);">${extraStr}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">(100%必出)</span></li>
                            <li><strong>3️⃣ 選項三 (不勾)：</strong>期望技能屬性 <strong style="color:var(--accent-purple);">${skillStr}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">(8選1，機率12.5%)</span></li>
                        </ul>
                    </div>
                </div>
            </div>`;
    });

    // --- 無法刷的武器 ---
    if (invalidWeapons.length > 0) {
        html += `<div style="margin-top:20px; padding:16px; background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.2); border-radius:var(--radius-md);">
            <div style="font-weight:700; color:var(--accent-red); margin-bottom:8px;">⚠️ 以下武器配置錯誤（無法刻寫）</div>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">因為所選的三個詞條無法在任何單一淤積點同時掉落。基質掉落是綁定的三詞條，請重新挑選詞條（確認附加屬性與技能屬性能出現在同處）：</p>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">`;
        invalidWeapons.forEach(w => {
            html += `<span class="weapon-chip" style="background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.2); color:var(--accent-red);">⚔ ${escHtml(w.name)}</span>`;
        });
        html += `</div></div>`;
    }

    if (html === '') {
        html = '<p class="no-cofarm">請先選擇詞條後再進行分析</p>';
    }

    container.innerHTML = html;
}

// --- 4. 同刷合併建議 ---
function renderCofarmAnalysis(weaponList) {
    // 已經合併到刻寫策略 (renderRoutePlan) 中
}

// ===================
// 工具函式
// ===================

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===================
// 初始化
// ===================

function init() {
    initParticles();

    addWeaponBtn.addEventListener('click', addWeapon);
    analyzeBtn.addEventListener('click', analyze);

    // 預設加一把武器
    addWeapon();

    // 初始化主題
    initTheme();
}

// Make removeWeapon globally accessible
window.removeWeapon = removeWeapon;

document.addEventListener('DOMContentLoaded', init);
