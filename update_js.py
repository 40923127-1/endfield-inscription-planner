import sys
import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

new_content = re.sub(
    r'// --- 3\. 路線規劃 ---.*?// ===================\n// 工具函式\n// ===================',
    r'''// --- 3. 刻寫策略規劃 ---
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
// ===================''',
    content,
    flags=re.DOTALL
)

if new_content != content:
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replaced successfully")
else:
    print("No changes made, regex didn't match")
