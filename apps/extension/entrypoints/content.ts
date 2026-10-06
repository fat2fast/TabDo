export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_idle',
  main() {
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

      /* Floating Action Pill */
      .tabdo-pill {
        position: fixed !important;
        pointer-events: auto !important;
        display: none;
        flex-direction: row !important;
        align-items: center !important;
        gap: 7px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: #ffffff !important;
        font-size: 13px !important;
        line-height: 1 !important;
        font-weight: 600 !important;
        padding: 7px 14px !important;
        border-radius: 9999px !important;
        box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4), 0 2px 6px rgba(15, 23, 42, 0.15) !important;
        border: 1px solid rgba(255, 255, 255, 0.25) !important;
        cursor: pointer !important;
        user-select: none !important;
        white-space: nowrap !important;
        width: max-content !important;
        height: 32px !important;
        z-index: 2147483647 !important;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        animation: tabdoFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .tabdo-pill:hover {
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
        transform: translateY(-2px) scale(1.02);
        box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5), 0 2px 6px rgba(0, 0, 0, 0.15) !important;
      }

      .tabdo-pill:active {
        transform: translateY(0) scale(0.98);
      }

      .tabdo-pill-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 17px;
        height: 17px;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 50%;
        font-size: 11px;
        font-weight: bold;
        flex-shrink: 0;
      }

      .tabdo-pill-text {
        white-space: nowrap !important;
        font-size: 12.5px;
        letter-spacing: -0.01em;
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
        width: 26px;
        height: 26px;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: white;
        border-radius: 7px;
        display: flex;
        align-items: center;
        justify-content: center;
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

    // 1. Create Floating Pill Button
    const pill = document.createElement('div')
    pill.className = 'tabdo-pill'
    pill.innerHTML = `
      <span class="tabdo-pill-icon">✓</span>
      <span class="tabdo-pill-text">+ Tạo task TabDo</span>
    `
    shadow.appendChild(pill)

    // 2. Create Modal Overlay & Dialog
    const overlay = document.createElement('div')
    overlay.className = 'tabdo-overlay'
    overlay.innerHTML = `
      <div class="tabdo-dialog" role="dialog" aria-modal="true" aria-labelledby="tabdo-dlg-title">
        <div class="tabdo-header">
          <div class="tabdo-title-group">
            <div class="tabdo-logo-badge">TD</div>
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

    function hidePill() {
      pill.style.display = 'none'
    }

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

      hidePill()
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

    // Pill click -> Open dialog
    pill.addEventListener('mousedown', (e) => {
      e.preventDefault() // Keep text selection active
      e.stopPropagation()
    })

    pill.addEventListener('click', (e) => {
      e.stopPropagation()
      const selection = window.getSelection()?.toString().trim()
      openDialog(selection || selectedTextBuffer)
    })

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

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display === 'flex') {
        closeDialog()
      }
    })

    // Text selection detection on webpage
    let isMouseDown = false
    let selectionTimeout: ReturnType<typeof setTimeout> | null = null

    function checkAndShowPill() {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        host.remove()
        return
      }

      if (overlay.style.display === 'flex') return

      const selection = window.getSelection()
      let text = selection?.toString().trim() || ''

      // If text is not selected in standard DOM, check active form element (input/textarea)
      let targetRect: DOMRect | null = null

      if (selection && selection.rangeCount > 0 && text) {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        if (rect.width > 0 || rect.height > 0) {
          targetRect = rect
        }
      }

      if (!targetRect && !text) {
        const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null
        if (
          activeEl &&
          (activeEl.tagName === 'TEXTAREA' ||
            (activeEl.tagName === 'INPUT' && (activeEl.type === 'text' || activeEl.type === 'search' || !activeEl.type))) &&
          typeof activeEl.selectionStart === 'number' &&
          typeof activeEl.selectionEnd === 'number' &&
          activeEl.selectionStart !== activeEl.selectionEnd
        ) {
          text = activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd).trim()
          if (text) {
            targetRect = activeEl.getBoundingClientRect()
          }
        }
      }

      if (!text || text.length < 2 || text.length > 2000 || !targetRect) {
        hidePill()
        return
      }

      selectedTextBuffer = text

      // Fixed positioning relative to the viewport
      let top = targetRect.top - 44
      let left = targetRect.left + targetRect.width / 2 - 75

      // If too close to viewport top edge, place below target
      if (targetRect.top < 52) {
        top = targetRect.bottom + 10
      }

      // Constrain inside viewport horizontally
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 800
      if (left < 12) left = 12
      if (left > viewportWidth - 170) {
        left = viewportWidth - 170
      }

      pill.style.top = `${Math.round(top)}px`
      pill.style.left = `${Math.round(left)}px`
      pill.style.display = 'inline-flex'
    }

    // 1. Mouse down: capture phase to track mouse state and dismiss pill if clicking outside
    window.addEventListener(
      'mousedown',
      (e) => {
        isMouseDown = true
        if (!e.composedPath().includes(host)) {
          hidePill()
        }
      },
      true,
    )

    // 2. Mouse up: capture phase so SPAs (like Zalo Web) cannot prevent detection via stopPropagation
    window.addEventListener(
      'mouseup',
      (e) => {
        isMouseDown = false
        if (e.composedPath().includes(host)) return

        if (selectionTimeout) clearTimeout(selectionTimeout)
        selectionTimeout = setTimeout(() => {
          checkAndShowPill()
        }, 40)
      },
      true,
    )

    // 3. Keyup: capture phase for keyboard-based text selections (Shift+Arrow, etc.)
    window.addEventListener(
      'keyup',
      (e) => {
        if (
          e.key === 'Shift' ||
          e.key.startsWith('Arrow') ||
          (e.ctrlKey && e.key === 'a') ||
          (e.metaKey && e.key === 'a')
        ) {
          if (selectionTimeout) clearTimeout(selectionTimeout)
          selectionTimeout = setTimeout(() => {
            checkAndShowPill()
          }, 50)
        }
      },
      true,
    )

    // 4. Selectionchange event: native document-level event for selection changes
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim()
      if (!text) {
        hidePill()
        return
      }

      // If user finished mouse drag or selected via other means
      if (!isMouseDown) {
        if (selectionTimeout) clearTimeout(selectionTimeout)
        selectionTimeout = setTimeout(() => {
          checkAndShowPill()
        }, 120)
      }
    })

    // 5. Scroll: hide pill so it doesn't linger detached from scrolled content
    window.addEventListener(
      'scroll',
      () => {
        if (pill.style.display !== 'none') {
          hidePill()
        }
      },
      { capture: true, passive: true },
    )

    // 6. Listen to messages from background (e.g. context menu clicks)
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'tabdo:open-create-dialog') {
        const text = message.payload?.text || ''
        const url = message.payload?.url || window.location.href
        openDialog(text, url)
        sendResponse?.({ ok: true })
        return true
      }
    })
  },
})
