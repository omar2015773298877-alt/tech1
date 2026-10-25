/* ═════════════════════════════════════════════════════════
   التكنولوجيا الحديثة — منطق العرض التفاعلي
   التنقل + التصويت المحلي + المشاركات المحلية
   جميع البيانات تبقى داخل المتصفح (sessionStorage)
   ═════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ---------- مساعدات عامة ---------- */
  const $ = (id) => document.getElementById(id);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function showToast(message, duration) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => toast.classList.remove('show'), duration || 2600);
  }

  /* ═══════════ 1) نظام الشرائح والتنقل ═══════════ */
  const deck = $('deck');
  const slideCounter = $('slideCounter');
  const progressBar = $('progressBar');
  const progressTrack = document.querySelector('.progress-track');
  const prevBtn = $('prevBtn');
  const nextBtn = $('nextBtn');
  const nextLabel = $('nextLabel');
  const prevLabel = $('prevLabel');

  // اكتشاف الشرائح تلقائيًا
  const slides = deck ? Array.from(deck.querySelectorAll('.slide')) : [];
  const total = slides.length;
  let current = 0;

  function pad(n) { return String(n).padStart(2, '0'); }

  function updateHud() {
    if (slideCounter) slideCounter.textContent = pad(current + 1) + ' / ' + pad(total);
    if (progressBar && total) {
      const pct = ((current + 1) / total) * 100;
      progressBar.style.width = pct + '%';
    }
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(Math.round(((current + 1) / total) * 100)));
    if (prevBtn) prevBtn.disabled = current === 0;
    if (nextBtn && nextLabel) {
      const isLast = current === total - 1;
      nextLabel.textContent = isLast ? 'إنهاء العرض' : 'التالي';
      nextBtn.classList.toggle('finish', isLast);
    }
  }

  function goTo(index, { announce = true } = {}) {
    if (!slides.length) return;
    const target = clamp(index, 0, total - 1);
    if (target === current && slides[current].classList.contains('active')) return;

    const oldIndex = current;
    const forward = target > oldIndex;

    // الخروج من الشريحة الحالية
    const outgoing = slides[oldIndex];
    outgoing.style.transform = forward ? 'translateX(5%)' : 'translateX(-5%)';
    outgoing.classList.remove('active');
    window.setTimeout(() => { outgoing.style.transform = ''; }, 650);

    current = target;

    // الدخول إلى الشريحة الجديدة من الاتجاه الصحيح (RTL)
    const incoming = slides[current];
    incoming.style.transform = forward ? 'translateX(-5%)' : 'translateX(5%)';
    incoming.classList.add('active');
    // فرض إعادة الحركة
    void incoming.offsetWidth;
    incoming.style.transform = '';

    slides.forEach((s, i) => { if (i !== current) s.setAttribute('aria-hidden', 'true'); else s.removeAttribute('aria-hidden'); });

    // إعادة تفعيل معرفة القارئ الشاشة
    if (announce) incoming.focus({ preventScroll: true });

    updateHud();

    // تمرير المحتوى إلى الأعلى عند تغيير الشريحة
    incoming.scrollTop = 0;
  }

  function nextSlide() { goTo(current + 1); }
  function prevSlide() { goTo(current - 1); }

  /* أزرار التحكم */
  if (prevBtn) prevBtn.addEventListener('click', prevSlide);
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (current === total - 1) {
      showToast('🎉 أنت في الشريحة الأخيرة — نتمنى لكم عرضًا موفقًا!');
      nextBtn.blur();
    } else {
      nextSlide();
    }
  });

  /* أزرار "ابدأ العرض" و"العودة إلى البداية" */
  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      goTo(parseInt(btn.dataset.goto, 10) || 0);
      if (btn.id === 'replayBtn') showToast('🎬 تمت إعادة العرض من البداية');
    });
  });

  /* اختصارات لوحة المفاتيح (مناسبة للاتجاه RTL) */
  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  document.addEventListener('keydown', (e) => {
    if (!slides.length || isTypingTarget(e.target)) return;

    switch (e.key) {
      case 'ArrowLeft':            // السهم الأيسر = التالي (RTL)
      case 'ArrowDown':
      case 'PageDown':
        e.preventDefault(); nextSlide(); break;
      case 'ArrowRight':           // السهم الأيمن = السابق (RTL)
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault(); prevSlide(); break;
      case ' ':                    // المسافة = التالي
      case 'Spacebar':
        e.preventDefault(); nextSlide(); break;
      case 'Home':
        e.preventDefault(); goTo(0); break;
      case 'End':
        e.preventDefault(); goTo(total - 1); break;
      default: break;
    }
  });

  /* التنقل بالسحب الأفقي لللمس — متوافق مع RTL:
     سحب لليمين (sx > 0) = الشريحة التالية، سحب لليسار = السابقة */
  let touchStartX = 0;
  let touchStartY = 0;
  let touchTarget = null;

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.target;
    if (t.closest('input, textarea, select, a, button, [data-swipe-ignore]')) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchTarget = t;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (touchStartX === null || !touchTarget) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    touchTarget = null;
    if (Math.abs(dx) < 65 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (dx > 0) nextSlide(); else prevSlide();
  }, { passive: true });

  /* ═══════════ 2) التصويت المحلي (الشريحة 10) ═══════════ */
  const pollOptions = $('pollOptions');
  const pollResults = $('pollResults');
  const pollReset = $('pollReset');
  const POLL_KEY = 'tech-presentation-poll-v1';
  // الترتيب الثابت للعرض
  const POLL_OPTIONS = [
    { key: 'ai', label: 'الذكاء الاصطناعي' },
    { key: 'robots', label: 'الروبوتات والأتمتة' },
    { key: 'iot', label: 'إنترنت الأشياء' },
    { key: 'other', label: 'تقنيات مستقبلية أخرى' }
  ];

  function loadPoll() {
    try {
      const raw = window.sessionStorage.getItem(POLL_KEY);
      if (!raw) return { counts: {}, userVote: null };
      const data = JSON.parse(raw);
      return { counts: data.counts || {}, userVote: data.userVote || null };
    } catch {
      return { counts: {}, userVote: null };
    }
  }

  function savePoll(data) {
    try { window.sessionStorage.setItem(POLL_KEY, JSON.stringify(data)); } catch { /* تجاهل */ }
  }

  function renderPoll() {
    if (!pollOptions || !pollResults) return;
    const { counts, userVote } = loadPoll();
    const totalVotes = POLL_OPTIONS.reduce((sum, o) => sum + (counts[o.key] || 0), 0);

    // تفعيل/تعطيل أزرار الخيارات
    pollOptions.querySelectorAll('.poll-btn').forEach((btn) => {
      btn.disabled = Boolean(userVote);
      btn.classList.toggle('chosen', userVote === btn.dataset.vote);
      if (userVote === btn.dataset.vote) btn.setAttribute('aria-pressed', 'true');
      else btn.removeAttribute('aria-pressed');
    });

    // عرض النتائج — تُعرض نصيًا أيضًا حتى لا يعتمد الفهم على اللون وحده
    pollResults.replaceChildren();
    POLL_OPTIONS.forEach((opt) => {
      const count = counts[opt.key] || 0;
      const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'poll-row';

      const head = document.createElement('div');
      head.className = 'poll-row-head';
      const name = document.createElement('b');
      name.textContent = opt.label + (userVote === opt.key ? ' ✓ تصويتك' : '');
      const value = document.createElement('span');
      value.textContent = count + ' صوت — ' + pct + '%';
      head.append(name, value);

      const bar = document.createElement('div');
      bar.className = 'poll-bar';
      const fill = document.createElement('i');
      fill.style.width = pct + '%';
      bar.appendChild(fill);

      row.append(head, bar);
      pollResults.appendChild(row);
    });

    if (!totalVotes) {
      const empty = document.createElement('p');
      empty.className = 'comment-empty';
      empty.textContent = 'لا توجد أصوات بعد — كن أول من يصوّت!';
      pollResults.appendChild(empty);
    }
  }

  function initPoll() {
    if (!pollOptions) return;
    pollOptions.addEventListener('click', (e) => {
      const btn = e.target.closest('.poll-btn');
      if (!btn || btn.disabled) return;
      const data = loadPoll();
      if (data.userVote) return; // منع تكرار التصويت في الجلسة نفسها
      const key = btn.dataset.vote;
      if (!POLL_OPTIONS.some((o) => o.key === key)) return;
      data.counts[key] = (data.counts[key] || 0) + 1;
      data.userVote = key;
      savePoll(data);
      renderPoll();
      showToast('✅ تم تسجيل تصويتك محليًا في هذه الجلسة');
    });

    if (pollReset) pollReset.addEventListener('click', () => {
      try { window.sessionStorage.removeItem(POLL_KEY); } catch { /* تجاهل */ }
      renderPoll();
      showToast('♻️ أُعيد ضبط التصويت المحلي');
    });

    renderPoll();
  }

  /* ═══════════ 3) المشاركات المحلية (الشريحة 10) ═══════════ */
  const commentForm = $('commentForm');
  const commentInput = $('commentInput');
  const commentError = $('commentError');
  const commentList = $('commentList');
  const commentsReset = $('commentsReset');
  const COMMENTS_KEY = 'tech-presentation-comments-v1';

  function loadComments() {
    try {
      const raw = window.sessionStorage.getItem(COMMENTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveComments(list) {
    try { window.sessionStorage.setItem(COMMENTS_KEY, JSON.stringify(list)); } catch { /* تجاهل */ }
  }

  function validComment(text) {
    const t = text.trim();
    return t.length >= 1 && t.length <= 200;
  }

  // العرض يستخدم textContent فقط لمنع تفسير نص المستخدم كـ HTML
  function renderComments() {
    if (!commentList) return;
    const comments = loadComments();
    commentList.replaceChildren();
    if (!comments.length) {
      const empty = document.createElement('li');
      empty.className = 'comment-empty';
      empty.textContent = 'لا توجد مشاركات بعد — شاركنا رأيك أنت أيضًا!';
      commentList.appendChild(empty);
      return;
    }
    comments.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'comment-item';

      const text = document.createElement('span');
      text.className = 'comment-text';
      text.textContent = item.text; // آمن: نص فقط

      const time = document.createElement('span');
      time.className = 'comment-time';
      time.textContent = item.time || '';

      const block = document.createElement('div');
      block.style.flex = '1';
      block.append(text, time);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'comment-del';
      del.setAttribute('aria-label', 'حذف هذه المشاركة');
      del.textContent = 'حذف';
      del.addEventListener('click', () => {
        const list = loadComments();
        list.splice(index, 1);
        saveComments(list);
        renderComments();
      });

      li.append(block, del);
      commentList.appendChild(li);
    });
  }

  function initComments() {
    if (!commentForm || !commentInput) return;
    commentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = commentInput.value.trim();
      if (!validComment(text)) {
        if (commentError) commentError.hidden = false;
        commentInput.focus();
        return;
      }
      if (commentError) commentError.hidden = true;
      const list = loadComments();
      const now = new Date();
      list.unshift({
        text: text,
        time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      });
      saveComments(list);
      commentInput.value = '';
      renderComments();
      showToast('💙 شكرًا لمشاركتك — حفظناها محليًا في جلستك');
    });

    // إخفاء رسالة الخطأ فور تعديل الإدخال
    commentInput.addEventListener('input', () => {
      if (commentError) commentError.hidden = true;
    });

    if (commentsReset) commentsReset.addEventListener('click', () => {
      try { window.sessionStorage.removeItem(COMMENTS_KEY); } catch { /* تجاهل */ }
      renderComments();
      showToast('🗑️ أُمسحت المشاركات المحلية');
    });

    renderComments();
  }

  /* ═══════════ 4) التشغيل ═══════════ */
  function init() {
    if (!slides.length) return;
    slides[0].classList.add('active');
    updateHud();
    initPoll();
    initComments();
  }

  // تشغيل مرة واحدة عند جاهزية المستند (بدون تكرار المستمعات)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
