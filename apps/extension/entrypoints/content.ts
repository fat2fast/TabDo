export default defineContentScript({
  registration: 'runtime',
  main() {
    // Invoke prior cleanup handler if present (e.g. from extension reload/update)
    if (typeof (window as any).__tabdo_companion_cleanup === 'function') {
      try {
        (window as any).__tabdo_companion_cleanup()
      } catch {
        // ignore
      }
    }

    // Clean up stale host from previously reloaded extension context if present
    const existingHost = document.getElementById('tabdo-companion-root')
    if (existingHost) {
      existingHost.remove()
    }

    const host = document.createElement('div')
    host.id = 'tabdo-companion-root'
    host.style.position = 'fixed'
    host.style.top = '0'
    host.style.left = '0'
    host.style.width = '0'
    host.style.height = '0'
    host.style.overflow = 'visible'
    host.style.pointerEvents = 'none'
    host.style.zIndex = '2147483647' // Maximum z-index

    const target = document.documentElement || document.body
    if (!target) return
    target.appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })

    // Inject scoped styles
    const style = document.createElement('style')
    style.textContent = `
      * {
        box-sizing: border-box !important;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        -webkit-font-smoothing: antialiased;
      }



      /* Modal Overlay */
      .tabdo-overlay {
        position: fixed !important;
        pointer-events: auto !important;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.5);
        backdrop-filter: blur(4px);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        animation: tabdoOverlayFadeIn 0.2s ease;
      }

      /* Floating Selection Pill */
      .tabdo-pill {
        position: fixed !important;
        pointer-events: auto !important;
        z-index: 2147483647;
        display: none;
        align-items: center;
        gap: 5px;
        padding: 5px 12px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
        font-size: 11.5px;
        font-weight: 700;
        border-radius: 9999px;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4), 0 2px 4px rgba(15, 23, 42, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.25);
        cursor: pointer;
        transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s;
        user-select: none;
        line-height: 1;
        animation: tabdoPopIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .tabdo-pill:hover {
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
        transform: scale(1.05);
      }

      .tabdo-pill:active {
        transform: scale(0.98);
      }

      .tabdo-pill-badge {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
      }

      .tabdo-pill-badge img {
        width: 14px;
        height: 14px;
        object-fit: contain;
        display: block;
      }

      .tabdo-pill-badge.tabdo-fallback-text {
        background: rgba(255, 255, 255, 0.25);
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        box-shadow: none;
      }

      .tabdo-pill-label {
        letter-spacing: -0.01em;
      }

      /* Modal Card */
      .tabdo-dialog {
        background: #ffffff;
        color: #0f172a;
        width: 480px;
        max-width: 92vw;
        border-radius: 16px;
        box-shadow: 0 24px 38px -8px rgba(15, 23, 42, 0.22), 0 10px 15px -3px rgba(15, 23, 42, 0.1);
        border: 1px solid #e2e8f0;
        overflow: hidden;
        animation: tabdoPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
      }

      .tabdo-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 20px;
        border-bottom: 1px solid #f1f5f9;
        background: #f8fafc;
      }

      .tabdo-title-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .tabdo-logo-badge {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
      }

      .tabdo-logo-badge img {
        width: 26px;
        height: 26px;
        object-fit: contain;
        display: block;
      }

      .tabdo-logo-badge.tabdo-fallback-text {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: -0.02em;
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
      }

      .tabdo-title {
        font-size: 14.5px;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.01em;
      }

      .tabdo-header-hint {
        font-size: 11px;
        color: #94a3b8;
        font-weight: normal;
        margin-left: 4px;
      }

      .tabdo-close-btn {
        background: none;
        border: none;
        color: #64748b;
        font-size: 16px;
        cursor: pointer;
        width: 28px;
        height: 28px;
        border-radius: 7px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s;
      }

      .tabdo-close-btn:hover {
        background: #e2e8f0;
        color: #0f172a;
      }

      .tabdo-body {
        padding: 18px 20px 14px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 70vh;
        overflow-y: auto;
      }

      .tabdo-field-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .tabdo-char-count {
        font-size: 10px;
        font-weight: normal;
        color: #94a3b8;
      }

      .tabdo-textarea {
        width: 100%;
        min-height: 76px;
        max-height: 140px;
        padding: 10px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 13.5px;
        line-height: 1.5;
        color: #0f172a;
        background: #ffffff;
        resize: vertical;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .tabdo-textarea:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
      }

      /* Quick metadata bar */
      .tabdo-meta-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        padding-top: 2px;
      }

      .tabdo-chips-left {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .tabdo-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11.5px;
        font-weight: 500;
        padding: 4px 9px;
        border-radius: 6px;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #e2e8f0;
        user-select: none;
      }

      .tabdo-chip-blue {
        background: #eff6ff;
        color: #1d4ed8;
        border-color: #bfdbfe;
      }

      .tabdo-chip-remove {
        cursor: pointer;
        font-size: 13px;
        color: #94a3b8;
        margin-left: 2px;
        display: inline-flex;
        align-items: center;
      }

      .tabdo-chip-remove:hover {
        color: #ef4444;
      }

      /* Toggle Properties Button */
      .tabdo-toggle-props-btn {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        color: #475569;
        font-size: 11.5px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: all 0.15s ease;
      }

      .tabdo-toggle-props-btn:hover {
        background: #f1f5f9;
        color: #0f172a;
        border-color: #94a3b8;
      }

      .tabdo-toggle-props-btn.active {
        background: #eff6ff;
        color: #2563eb;
        border-color: #93c5fd;
      }

      /* Expanded Properties Panel */
      .tabdo-expanded-panel {
        display: none;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        background: #f8fafc;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        margin-top: 4px;
        animation: tabdoExpand 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .tabdo-expanded-panel.open {
        display: flex;
      }

      .tabdo-prop-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .tabdo-prop-label {
        font-size: 11px;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      /* Segmented Control */
      .tabdo-segmented {
        display: flex;
        background: #e2e8f0;
        padding: 2px;
        border-radius: 8px;
        gap: 2px;
      }

      .tabdo-segmented-btn {
        flex: 1;
        background: none;
        border: none;
        padding: 6px 8px;
        font-size: 11.5px;
        font-weight: 600;
        color: #64748b;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        transition: all 0.15s ease;
      }

      .tabdo-segmented-btn:hover:not(.active) {
        color: #0f172a;
        background: rgba(255, 255, 255, 0.5);
      }

      .tabdo-segmented-btn.active {
        background: #ffffff;
        color: #0f172a;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .tabdo-segmented-btn.active.priority-high {
        color: #dc2626;
      }
      .tabdo-segmented-btn.active.priority-medium {
        color: #d97706;
      }
      .tabdo-segmented-btn.active.priority-low {
        color: #16a34a;
      }

      .tabdo-desc-input {
        width: 100%;
        min-height: 54px;
        max-height: 100px;
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 7px;
        font-size: 12.5px;
        line-height: 1.4;
        color: #0f172a;
        background: #ffffff;
        resize: vertical;
        outline: none;
      }

      .tabdo-desc-input:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
      }

      /* Feedback Messages */
      .tabdo-error-banner {
        padding: 9px 12px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #b91c1c;
        border-radius: 8px;
        font-size: 12px;
        line-height: 1.4;
      }

      .tabdo-success-banner {
        padding: 10px 12px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #15803d;
        border-radius: 8px;
        font-size: 12.5px;
        font-weight: 600;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      /* Footer */
      .tabdo-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        border-top: 1px solid #f1f5f9;
        background: #f8fafc;
      }

      .tabdo-hotkey-hint {
        font-size: 11px;
        color: #94a3b8;
      }

      .tabdo-actions-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tabdo-btn {
        padding: 8px 15px;
        border-radius: 7px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .tabdo-btn-cancel {
        background: #ffffff;
        border-color: #cbd5e1;
        color: #475569;
      }

      .tabdo-btn-cancel:hover {
        background: #f1f5f9;
        color: #0f172a;
        border-color: #94a3b8;
      }

      .tabdo-btn-submit {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: white;
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
      }

      .tabdo-btn-submit:hover:not(:disabled) {
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.35);
      }

      .tabdo-btn-submit:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      @keyframes tabdoFadeIn {
        from { opacity: 0; transform: translateY(4px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes tabdoOverlayFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes tabdoPopIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }

      @keyframes tabdoExpand {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `
    shadow.appendChild(style)



    // Brand Icon assets
    const TABDO_ICON_BASE64 =
      'data:image/png;base64,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'
    const TABDO_ICON_EXT =
      typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('icon/32.png')
        : ''

    // 2. Create Modal Overlay & Dialog
    const overlay = document.createElement('div')
    overlay.className = 'tabdo-overlay'
    overlay.style.display = 'none'
    overlay.innerHTML = `
      <div class="tabdo-dialog" role="dialog" aria-modal="true" aria-labelledby="tabdo-dlg-title">
        <div class="tabdo-header">
          <div class="tabdo-title-group">
            <div class="tabdo-logo-badge"><img src="${TABDO_ICON_BASE64}" alt="TabDo" onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';if('${TABDO_ICON_EXT}'){this.src='${TABDO_ICON_EXT}';return;}}this.style.display='none';this.parentElement.classList.add('tabdo-fallback-text');this.parentElement.innerText='TD';" /></div>
            <span class="tabdo-title" id="tabdo-dlg-title">Thêm công việc vào TabDo</span>
            <span class="tabdo-header-hint">(Esc để đóng)</span>
          </div>
          <button type="button" class="tabdo-close-btn" aria-label="Đóng" id="tabdo-btn-close">✕</button>
        </div>
        
        <div class="tabdo-body">
          <div>
            <div class="tabdo-field-label">
              <span>Nội dung công việc</span>
              <span class="tabdo-char-count" id="tabdo-char-count">0/500</span>
            </div>
            <textarea class="tabdo-textarea" id="tabdo-task-title" placeholder="Nhập tiêu đề hoặc sửa nội dung công việc..."></textarea>
          </div>
          
          <!-- Quick Metadata Bar -->
          <div class="tabdo-meta-bar">
            <div class="tabdo-chips-left">
              <span class="tabdo-chip tabdo-chip-blue" id="tabdo-chip-due">📅 Hôm nay</span>
              <span class="tabdo-chip" id="tabdo-chip-source" title="">
                <span>🔗 ${window.location.hostname}</span>
                <span class="tabdo-chip-remove" id="tabdo-remove-source" title="Bỏ kèm URL nguồn">×</span>
              </span>
            </div>
            <button type="button" class="tabdo-toggle-props-btn" id="tabdo-btn-toggle-props">
              <span>⚙ Thuộc tính</span>
              <span id="tabdo-toggle-icon">▾</span>
            </button>
          </div>

          <!-- Expanded Properties Panel (Hidden by default) -->
          <div class="tabdo-expanded-panel" id="tabdo-expanded-panel">
            <!-- Due Option -->
            <div class="tabdo-prop-row">
              <span class="tabdo-prop-label">Thời hạn</span>
              <div class="tabdo-segmented" id="tabdo-seg-due">
                <button type="button" class="tabdo-segmented-btn active" data-value="today">📅 Hôm nay</button>
                <button type="button" class="tabdo-segmented-btn" data-value="tomorrow">🌅 Ngày mai</button>
                <button type="button" class="tabdo-segmented-btn" data-value="inbox">📥 Không hạn</button>
              </div>
            </div>

            <!-- Priority -->
            <div class="tabdo-prop-row">
              <span class="tabdo-prop-label">Mức độ ưu tiên</span>
              <div class="tabdo-segmented" id="tabdo-seg-priority">
                <button type="button" class="tabdo-segmented-btn priority-low" data-value="low">🟢 Thấp</button>
                <button type="button" class="tabdo-segmented-btn active priority-medium" data-value="medium">🟡 Vừa</button>
                <button type="button" class="tabdo-segmented-btn priority-high" data-value="high">🔴 Cao</button>
              </div>
            </div>

            <!-- Description / Note -->
            <div class="tabdo-prop-row">
              <span class="tabdo-prop-label">Mô tả / Ghi chú bổ sung</span>
              <textarea class="tabdo-desc-input" id="tabdo-task-desc" placeholder="Thêm ngữ cảnh, trích dẫn hoặc chi tiết..."></textarea>
            </div>
          </div>

          <!-- Feedback messages -->
          <div id="tabdo-feedback"></div>
        </div>

        <div class="tabdo-footer">
          <span class="tabdo-hotkey-hint">↵ Enter để tạo nhanh</span>
          <div class="tabdo-actions-right">
            <button type="button" class="tabdo-btn tabdo-btn-cancel" id="tabdo-btn-cancel">Hủy</button>
            <button type="button" class="tabdo-btn tabdo-btn-submit" id="tabdo-btn-submit">
              <span>+ Tạo công việc</span>
            </button>
          </div>
        </div>
      </div>
    `
    shadow.appendChild(overlay)

    // Elements inside shadow
    const textarea = overlay.querySelector('#tabdo-task-title') as HTMLTextAreaElement
    const charCount = overlay.querySelector('#tabdo-char-count') as HTMLSpanElement
    const feedback = overlay.querySelector('#tabdo-feedback') as HTMLDivElement
    const btnSubmit = overlay.querySelector('#tabdo-btn-submit') as HTMLButtonElement
    const btnCancel = overlay.querySelector('#tabdo-btn-cancel') as HTMLButtonElement
    const btnClose = overlay.querySelector('#tabdo-btn-close') as HTMLButtonElement
    const chipDue = overlay.querySelector('#tabdo-chip-due') as HTMLSpanElement
    const chipSource = overlay.querySelector('#tabdo-chip-source') as HTMLSpanElement
    const removeSourceBtn = overlay.querySelector('#tabdo-remove-source') as HTMLSpanElement
    const btnToggleProps = overlay.querySelector('#tabdo-btn-toggle-props') as HTMLButtonElement
    const toggleIcon = overlay.querySelector('#tabdo-toggle-icon') as HTMLSpanElement
    const expandedPanel = overlay.querySelector('#tabdo-expanded-panel') as HTMLDivElement
    const segDue = overlay.querySelector('#tabdo-seg-due') as HTMLDivElement
    const segPriority = overlay.querySelector('#tabdo-seg-priority') as HTMLDivElement
    const descInput = overlay.querySelector('#tabdo-task-desc') as HTMLTextAreaElement

    // Internal state
    let selectedTextBuffer = ''
    let sourceUrlBuffer: string | null = window.location.href
    let selectedDueOption: 'today' | 'tomorrow' | 'inbox' = 'today'
    let selectedPriority: 'low' | 'medium' | 'high' = 'medium'
    let isPropsExpanded = false



    function updateCharCount() {
      const len = textarea.value.length
      charCount.textContent = `${len}/500`
      if (len > 500) {
        charCount.style.color = '#ef4444'
        charCount.style.fontWeight = 'bold'
      } else {
        charCount.style.color = '#94a3b8'
        charCount.style.fontWeight = 'normal'
      }
    }

    textarea.addEventListener('input', updateCharCount)

    function updateDueChip() {
      if (selectedDueOption === 'today') {
        chipDue.textContent = '📅 Hôm nay'
        chipDue.className = 'tabdo-chip tabdo-chip-blue'
      } else if (selectedDueOption === 'tomorrow') {
        chipDue.textContent = '🌅 Ngày mai'
        chipDue.className = 'tabdo-chip tabdo-chip-blue'
      } else {
        chipDue.textContent = '📥 Không hạn'
        chipDue.className = 'tabdo-chip'
      }
    }

    // Toggle expanded properties
    btnToggleProps.addEventListener('click', () => {
      isPropsExpanded = !isPropsExpanded
      if (isPropsExpanded) {
        expandedPanel.classList.add('open')
        btnToggleProps.classList.add('active')
        toggleIcon.textContent = '▴'
      } else {
        expandedPanel.classList.remove('open')
        btnToggleProps.classList.remove('active')
        toggleIcon.textContent = '▾'
      }
    })

    // Segmented due date click
    segDue.querySelectorAll('.tabdo-segmented-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement
        segDue.querySelectorAll('.tabdo-segmented-btn').forEach((b) => b.classList.remove('active'))
        target.classList.add('active')
        selectedDueOption = (target.dataset.value as 'today' | 'tomorrow' | 'inbox') || 'today'
        updateDueChip()
      })
    })

    // Segmented priority click
    segPriority.querySelectorAll('.tabdo-segmented-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement
        segPriority.querySelectorAll('.tabdo-segmented-btn').forEach((b) => b.classList.remove('active'))
        target.classList.add('active')
        selectedPriority = (target.dataset.value as 'low' | 'medium' | 'high') || 'medium'
      })
    })

    // Remove source URL chip
    removeSourceBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      sourceUrlBuffer = null
      chipSource.style.display = 'none'
    })

    function openDialog(text: string, sourceUrl: string | null = window.location.href) {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        host.remove()
        alert('Tiện ích TabDo vừa được cập nhật/tải lại. Vui lòng tải lại trang Zalo (F5) để tiếp tục.')
        return
      }

      selectedTextBuffer = text.trim()
      sourceUrlBuffer = sourceUrl

      textarea.value = selectedTextBuffer
      updateCharCount()
      feedback.innerHTML = ''
      btnSubmit.disabled = false
      btnSubmit.innerHTML = `<span>+ Tạo công việc</span>`

      // Reset expanded state to compact by default
      isPropsExpanded = false
      expandedPanel.classList.remove('open')
      btnToggleProps.classList.remove('active')
      toggleIcon.textContent = '▾'

      // Reset options
      selectedDueOption = 'today'
      selectedPriority = 'medium'
      descInput.value = ''
      updateDueChip()

      segDue.querySelectorAll('.tabdo-segmented-btn').forEach((b) => {
        const btn = b as HTMLButtonElement
        btn.classList.toggle('active', btn.dataset.value === 'today')
      })
      segPriority.querySelectorAll('.tabdo-segmented-btn').forEach((b) => {
        const btn = b as HTMLButtonElement
        btn.classList.toggle('active', btn.dataset.value === 'medium')
      })

      if (sourceUrlBuffer) {
        try {
          const parsed = new URL(sourceUrlBuffer)
          chipSource.querySelector('span')!.textContent = `🔗 ${parsed.hostname}`
          chipSource.title = sourceUrlBuffer
          chipSource.style.display = 'inline-flex'
        } catch {
          chipSource.querySelector('span')!.textContent = `🔗 ${window.location.hostname}`
          chipSource.style.display = 'inline-flex'
        }
      } else {
        chipSource.style.display = 'none'
      }

      overlay.style.display = 'flex'
      setTimeout(() => {
        textarea.focus()
        textarea.select()
      }, 50)
    }

    function closeDialog() {
      overlay.style.display = 'none'
      feedback.innerHTML = ''
    }



    btnClose.addEventListener('click', closeDialog)
    btnCancel.addEventListener('click', closeDialog)

    // Close on overlay backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog()
      }
    })

    // Submit handler
    async function handleSubmit() {
      const title = textarea.value.trim()
      if (!title) {
        feedback.innerHTML = `<div class="tabdo-error-banner">Vui lòng nhập nội dung công việc.</div>`
        textarea.focus()
        return
      }

      if (title.length > 500) {
        feedback.innerHTML = `<div class="tabdo-error-banner">Tiêu đề công việc không được vượt quá 500 ký tự.</div>`
        textarea.focus()
        return
      }

      btnSubmit.disabled = true
      btnSubmit.innerHTML = `<span>Đang lưu...</span>`
      feedback.innerHTML = ''

      try {
        if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
          throw new Error('Tiện ích TabDo vừa được tải lại. Vui lòng nhấn F5 (Tải lại trang) để tiếp tục.')
        }

        const response = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'quick-add',
              payload: {
                title,
                sourceUrl: sourceUrlBuffer,
                description: descInput.value.trim() || null,
                priority: selectedPriority,
                dueOption: selectedDueOption,
              },
            },
            (res) => {
              if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message })
              } else {
                resolve(res || { ok: false, error: 'Không nhận được phản hồi từ extension' })
              }
            }
          )
        })

        if (response.ok) {
          feedback.innerHTML = `<div class="tabdo-success-banner"><span>✓</span> <span>Đã tạo công việc thành công!</span></div>`
          btnSubmit.innerHTML = `<span>✓ Hoàn thành</span>`
          setTimeout(() => {
            closeDialog()
          }, 850)
        } else {
          btnSubmit.disabled = false
          btnSubmit.innerHTML = `<span>+ Tạo công việc</span>`
          if (response.error === 'Not authenticated') {
            feedback.innerHTML = `<div class="tabdo-error-banner">Bạn chưa đăng nhập TabDo. Vui lòng mở popup Extension để đăng nhập.</div>`
          } else {
            feedback.innerHTML = `<div class="tabdo-error-banner">${response.error || 'Lỗi khi tạo công việc.'}</div>`
          }
        }
      } catch (err: unknown) {
        btnSubmit.disabled = false
        btnSubmit.innerHTML = `<span>+ Tạo công việc</span>`
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('context invalidated')) {
          feedback.innerHTML = `<div class="tabdo-error-banner">Tiện ích TabDo vừa được cập nhật. Vui lòng nhấn F5 (Tải lại trang này) để kết nối phiên bản mới.</div>`
        } else {
          feedback.innerHTML = `<div class="tabdo-error-banner">${msg}</div>`
        }
      }
    }

    btnSubmit.addEventListener('click', handleSubmit)

    // Keyboard shortcuts inside textarea
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      } else if (e.key === 'Escape') {
        closeDialog()
      }
    })

    descInput.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    })

    const onDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlay.style.display === 'flex') {
        closeDialog()
      }
    }
    document.addEventListener('keydown', onDocumentKeyDown)

    // 6. Floating Pill Element
    const pill = document.createElement('button')
    pill.type = 'button'
    pill.className = 'tabdo-pill'
    pill.id = 'tabdo-selection-pill'
    pill.title = 'Tạo công việc TabDo từ văn bản đã chọn'
    pill.style.display = 'none'
    pill.innerHTML = `
      <span class="tabdo-pill-badge"><img src="${TABDO_ICON_BASE64}" alt="" onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';if('${TABDO_ICON_EXT}'){this.src='${TABDO_ICON_EXT}';return;}}this.style.display='none';this.parentElement.classList.add('tabdo-fallback-text');this.parentElement.innerText='✓';" /></span>
      <span class="tabdo-pill-label">TabDo</span>
    `
    shadow.appendChild(pill)

    let isPillActive = false
    let currentSelectionText = ''

    function hidePill() {
      pill.style.setProperty('display', 'none', 'important')
      currentSelectionText = ''
    }

    // Check storage for quickPillEnabled setting
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const p = chrome.storage.local.get('quickPillEnabled')
        if (p && typeof p.then === 'function') {
          p.then((res: any) => {
            if (res && typeof res.quickPillEnabled !== 'undefined') {
              isPillActive = Boolean(res.quickPillEnabled)
            }
          }).catch(() => {})
        }
      } catch {
        // ignore
      }
      try {
        chrome.storage.local.get('quickPillEnabled', (res: any) => {
          if (res && typeof res.quickPillEnabled !== 'undefined') {
            isPillActive = Boolean(res.quickPillEnabled)
          }
        })
      } catch {
        // ignore
      }
    }

    // Named storage listener to ensure full lifecycle release and immediate deactivation
    const onStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.quickPillEnabled) {
        isPillActive = Boolean(changes.quickPillEnabled.newValue)
        if (!isPillActive) {
          hidePill()
        }
      }
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(onStorageChange)
    }

    function handleSelectionChange() {
      if (!isPillActive) {
        hidePill()
        return
      }

      if (overlay.style.display === 'flex') {
        hidePill()
        return
      }

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        hidePill()
        return
      }

      const text = sel.toString().trim()
      if (text.length < 2) {
        hidePill()
        return
      }

      const anchorNode = sel.anchorNode
      if (anchorNode && (host.contains(anchorNode) || overlay.contains(anchorNode))) {
        hidePill()
        return
      }

      currentSelectionText = text

      try {
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          hidePill()
          return
        }

        let top = rect.bottom + 8
        if (top + 32 > window.innerHeight) {
          top = Math.max(8, rect.top - 34)
        }
        const pillWidth = 76
        let left = rect.left + rect.width / 2 - pillWidth / 2
        left = Math.max(8, Math.min(left, window.innerWidth - pillWidth - 8))

        pill.style.setProperty('top', `${top}px`, 'important')
        pill.style.setProperty('left', `${left}px`, 'important')
        pill.style.setProperty('display', 'inline-flex', 'important')
      } catch {
        hidePill()
      }
    }

    let selectionTimeout: any = null
    const scheduleSelectionCheck = () => {
      if (selectionTimeout) clearTimeout(selectionTimeout)
      selectionTimeout = setTimeout(handleSelectionChange, 20)
    }

    const onMouseUp = () => {
      scheduleSelectionCheck()
    }
    const onSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || !sel.toString().trim()) {
        hidePill()
      } else if (isPillActive) {
        scheduleSelectionCheck()
      }
    }
    const onMouseDown = (e: MouseEvent) => {
      if (pill.style.display === 'inline-flex') {
        const target = e.target as Node
        if (!host.contains(target) && e.composedPath && !e.composedPath().includes(pill)) {
          hidePill()
        }
      }
    }

    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('mousedown', onMouseDown)

    pill.addEventListener('mousedown', (e) => {
      e.stopPropagation()
    })

    pill.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (currentSelectionText) {
        openDialog(currentSelectionText, window.location.href)
      }
      hidePill()
    })

    // 7. Listen to messages from background (e.g. context menu clicks)
    const messageListener = (message: any, _sender: any, sendResponse: (res?: any) => void) => {
      if (message?.type === 'tabdo:open-create-dialog') {
        const text = message.payload?.text || ''
        const url = message.payload?.url || window.location.href
        openDialog(text, url)
        sendResponse?.({ ok: true })
        return true
      }
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener)
    }

    // Store cleanup handler to avoid stale runtime listeners and duplicate UI roots upon reinjection
    ;(window as any).__tabdo_companion_cleanup = () => {
      if (selectionTimeout) clearTimeout(selectionTimeout)
      document.removeEventListener('keydown', onDocumentKeyDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('mousedown', onMouseDown)
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
          chrome.runtime.onMessage.removeListener(messageListener)
        }
      } catch {
        // ignore
      }
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
          chrome.storage.onChanged.removeListener(onStorageChange)
        }
      } catch {
        // ignore
      }
      const hostEl = document.getElementById('tabdo-companion-root')
      if (hostEl) {
        hostEl.remove()
      }
      ;(window as any).__tabdo_companion_cleanup = undefined
    }
  },
})
