import { augmentDefinitions } from "./scoreEngine.js";

export function setupDebugTools(api) {
  const btnDebugToggle = document.getElementById('btn-debug-toggle');
  const debugContent = document.getElementById('debug-content');

  if (btnDebugToggle && debugContent) {
    btnDebugToggle.addEventListener('click', () => {
      const isCollapsed = debugContent.classList.toggle('collapsed');
      btnDebugToggle.textContent = isCollapsed ? '▲' : '▼';
    });
  }

  // 디버그 UI 생성
  const debugGroup = document.createElement('div');
  debugGroup.className = 'debug-group';
  debugGroup.innerHTML = `
    <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-start; margin-bottom: 8px; white-space: nowrap;">
      <span style="color: #64b5f6; font-weight: bold; width: 44px; flex-shrink: 0;">변형</span>
      <select id="debug-player-select" style="padding: 4px; background: #333; color: #fff; border: 1px solid #555; margin-left: 0; flex-shrink: 0;">
        <option value="1">P1</option>
        <option value="2">P2</option>
      </select>
      <select id="debug-modification-select" style="padding: 4px; background: #333; color: #fff; border: 1px solid #555; flex: 1; min-width: 0;">
        ${Object.keys(augmentDefinitions).filter(id => !augmentDefinitions[id].isEnhancement && !augmentDefinitions[id].isQuest).map(id => `<option value="${id}">${augmentDefinitions[id].name} (${augmentDefinitions[id].target})</option>`).join('')}
      </select>
      <button id="debug-modification-apply" style="padding: 4px 12px; background: #0f4c81; color: #fff; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0;">적용</button>
    </div>

    <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-start; margin-bottom: 8px; white-space: nowrap;">
      <span style="color: #f1c40f; font-weight: bold; width: 44px; flex-shrink: 0;">강화</span>
      <select id="debug-enhancement-player-select" style="padding: 4px; background: #333; color: #fff; border: 1px solid #555; margin-left: 0; flex-shrink: 0;">
        <option value="1">P1</option>
        <option value="2">P2</option>
      </select>
      <select id="debug-enhancement-select" style="padding: 4px; background: #333; color: #fff; border: 1px solid #555; flex: 1; min-width: 0;">
        ${Object.keys(augmentDefinitions).filter(id => augmentDefinitions[id].isEnhancement).map(id => `<option value="${id}">${augmentDefinitions[id].name}</option>`).join('')}
      </select>
      <button id="debug-enhancement-apply" style="padding: 4px 12px; background: #f39c12; color: #fff; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0;">적용</button>
    </div>
    
    <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-start; white-space: nowrap;">
      <span style="color: #27ae60; font-weight: bold; width: 44px; flex-shrink: 0;">퀘스트</span>
      <select id="debug-quest-player-select" style="padding: 4px; background: #333; color: #fff; border: 1px solid #555; margin-left: 0; flex-shrink: 0;">
        <option value="1">P1</option>
        <option value="2">P2</option>
      </select>
      <select id="debug-quest-select" style="padding: 4px; background: #333; color: #fff; border: 1px solid #555; flex: 1; min-width: 0;">
        ${Object.keys(augmentDefinitions).filter(id => augmentDefinitions[id].isQuest).map(id => `<option value="${id}">${augmentDefinitions[id].name}</option>`).join('')}
      </select>
      <button id="debug-quest-apply" style="padding: 4px 12px; background: #27ae60; color: #fff; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0;">적용</button>
    </div>

    <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-start; margin-top: 12px; border-top: 1px solid #444; padding-top: 8px; white-space: nowrap;">
      <button id="debug-turn-prev" style="padding: 4px 8px; background: #555; color: #fff; border: none; cursor: pointer; flex-shrink: 0;">&lt; 턴</button>
      <button id="debug-turn-next" style="padding: 4px 8px; background: #555; color: #fff; border: none; cursor: pointer; flex-shrink: 0;">턴 &gt;</button>
      
      <input type="text" id="debug-dice-input" placeholder="1,2,3,4,5 또는 합(5~30)" style="flex: 1; min-width: 80px; padding: 4px; background: #333; color: #fff; border: 1px solid #555;" />
      <button id="debug-dice-apply" style="padding: 4px 12px; background: #0f4c81; color: #fff; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0;">주사위 조작</button>
    </div>

    <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
      <button id="debug-augment-progress-reset" style="padding: 4px 8px; background: #8b1e1e; color: #fff; border: none; cursor: pointer;">도전과제 진행 초기화</button>
    </div>
  `;
  if (debugContent) debugContent.appendChild(debugGroup);

  const bindAugmentApply = (buttonId, selectId, playerId) => {
    document.getElementById(buttonId)?.addEventListener('click', () => {
      const select = document.getElementById(selectId);
      const player = document.getElementById(playerId);
      if (select?.value && player) api.applyAugment(Number(player.value), select.value);
    });
  };

  [
    ['debug-modification-apply', 'debug-modification-select', 'debug-player-select'],
    ['debug-enhancement-apply', 'debug-enhancement-select', 'debug-enhancement-player-select'],
    ['debug-quest-apply', 'debug-quest-select', 'debug-quest-player-select']
  ].forEach(([buttonId, selectId, playerId]) => bindAugmentApply(buttonId, selectId, playerId));

  document.getElementById('debug-turn-prev')?.addEventListener('click', () => {
    api.prevTurn();
  });

  document.getElementById('debug-turn-next')?.addEventListener('click', () => {
    api.nextTurn();
  });

  document.getElementById('debug-dice-apply')?.addEventListener('click', () => {
    const input = document.getElementById('debug-dice-input').value.trim();
    if (!input) return;
    
    let values = [];
    if (input.includes(',') || input.includes(' ')) {
      // 특정 주사위 값 지정 (예: 1, 2, 3, 4, 5)
      values = input.split(/[, ]+/).map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 6);
    } else {
      // 합계만 지정한 경우 (5~30)
      const sum = Number(input);
      if (!isNaN(sum) && sum >= 5 && sum <= 30) {
        values = [1, 1, 1, 1, 1];
        let diff = sum - 5;
        for (let i = 0; i < 5 && diff > 0; i++) {
          const add = Math.min(5, diff);
          values[i] += add;
          diff -= add;
        }
      }
    }
    
    if (values.length === 5) {
      api.applyDice(values);
    } else {
      alert('올바른 주사위 값(1~6 사이 숫자 5개) 또는 합계(5~30)를 입력하세요.');
    }
  });

  document.getElementById('debug-augment-progress-reset')?.addEventListener('click', async (event) => {
    if (!confirm('현재 계정의 증강 통계와 도전과제 진행도를 초기화할까요? 경기 기록은 유지됩니다.')) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api.resetAugmentProgress();
      alert('도전과제 진행도를 초기화했습니다.');
    } catch (error) {
      console.error('Augment progress reset failed:', error);
      alert(`초기화 실패: ${error?.code || error?.message || '알 수 없는 오류'}`);
    } finally {
      button.disabled = false;
    }
  });
}
