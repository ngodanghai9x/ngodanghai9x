const askScreen = document.getElementById('askScreen');
const yesBtn = document.getElementById('yesBtn');
const noBtn = document.getElementById('noBtn');

const planScreen = document.getElementById('planScreen');
const options = document.querySelectorAll('.option');
const lockBtn = document.getElementById('lockBtn');
const subtitle = document.getElementById('subtitle');
const dateSummary = document.getElementById('dateSummary');
const datePicker = document.getElementById('datePicker');
const dateInput = document.getElementById('dateInput');
const timeInput = document.getElementById('timeInput');
const heartsLayer = document.getElementById('hearts');

const YES_SCALE_MAX = 2.25;
const MAX_NO_CLICKS = 3;
const YES_SCALE_STEP = (YES_SCALE_MAX - 1) / MAX_NO_CLICKS;

/* --- EmailJS: điền 3 giá trị lấy từ emailjs.com (Account > General, Email Services, Email Templates) --- */
const EMAILJS_PUBLIC_KEY = 'hainddW1oCXQc9DrTAI1ep';
const EMAILJS_SERVICE_ID = 'valentine-sv';
const EMAILJS_TEMPLATE_ID = 'template_gjkyyal';

if (window.emailjs && EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

let selected = null;
let noClicks = 0;

/* --- ask screen: yes grows, no eventually "gives up" --- */

yesBtn.addEventListener('click', goToPlanScreen);

noBtn.addEventListener('click', () => {
  if (noBtn.dataset.converted) {
    goToPlanScreen();
    return;
  }

  noClicks += 1;
  const yesScale = Math.min(YES_SCALE_MAX, 1 + noClicks * YES_SCALE_STEP);
  yesBtn.style.transform = `scale(${yesScale})`;

  if (yesScale >= YES_SCALE_MAX) {
    noBtn.dataset.converted = 'true';
    noBtn.textContent = 'YES';
    noBtn.classList.add('mini', 'converted');
    setTimeout(goToPlanScreen, 700);
  }
});

function goToPlanScreen() {
  askScreen.classList.add('hidden');
  planScreen.classList.remove('hidden');
}

/* --- plan screen: pick activity + date --- */

dateInput.min = new Date().toISOString().slice(0, 10);

options.forEach((opt) => {
  opt.addEventListener('click', () => {
    options.forEach((o) => o.classList.remove('selected'));
    opt.classList.add('selected');
    selected = opt.dataset.activity;
    datePicker.classList.remove('hidden');
    updateLockState();
  });
});

dateInput.addEventListener('change', updateLockState);
timeInput.addEventListener('change', updateLockState);

function updateLockState() {
  lockBtn.disabled = !(selected && dateInput.value);
}

lockBtn.addEventListener('click', () => {
  if (!selected || !dateInput.value) return;
  lockIn(selected);
});

function lockIn(activity) {
  subtitle.textContent = "IT'S A DATE! 💕";
  dateSummary.textContent = `📅 ${formatDateTime(dateInput.value, timeInput.value)}`;
  dateSummary.classList.remove('hidden');
  planScreen.classList.add('locked');
  options.forEach((o) => { o.disabled = true; });
  dateInput.disabled = true;
  timeInput.disabled = true;
  lockBtn.textContent = `${activity.toUpperCase()} — LOCKED IN!`;
  lockBtn.disabled = true;
  spawnHearts(30);
  setTimeout(showResetButton, 500);
  sendChoiceEmail(activity, formatDateTime(dateInput.value, timeInput.value));
}

function sendChoiceEmail(activity, when) {
  if (!window.emailjs || EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
    alert('EmailJS chưa được cấu hình — bỏ qua gửi mail.');
    return;
  }
  const name = getVisitorName();
  emailjs
    .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { activity, when, name })
    .then(() => console.log('Đã gửi mail thông báo.'))
    .catch((err) => console.error('Gửi mail thất bại:', err));
}

function getVisitorName() {
  const fallback = 'Valentine App 💌';
  const cookieValues = document.cookie
    .split('; ')
    .filter(Boolean)
    .map((pair) => decodeURIComponent(pair.split('=')[1] || '').trim())
    .filter((value) => value.length > 0 && value.length <= 40);

  if (cookieValues.length === 0) return fallback;
  return cookieValues[Math.floor(Math.random() * cookieValues.length)];
}

function formatDateTime(dateValue, timeValue) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dateText = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!timeValue) return dateText;
  const [hour, minute] = timeValue.split(':').map(Number);
  const time = new Date(year, month - 1, day, hour, minute);
  const timeText = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateText} · ${timeText}`;
}

function spawnHearts(count) {
  for (let i = 0; i < count; i++) {
    const heart = document.createElement('div');
    heart.className = 'heart';
    heart.textContent = '❤';
    heart.style.left = `${Math.random() * 100}vw`;
    heart.style.fontSize = `${12 + Math.random() * 16}px`;
    heart.style.animationDuration = `${2 + Math.random() * 2}s`;
    heartsLayer.appendChild(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }
}

function showResetButton() {
  if (document.getElementById('resetBtn')) return;
  const resetBtn = document.createElement('button');
  resetBtn.id = 'resetBtn';
  resetBtn.className = 'lock-btn reset-btn';
  resetBtn.textContent = 'CHOOSE AGAIN';
  resetBtn.addEventListener('click', resetCard);
  lockBtn.insertAdjacentElement('afterend', resetBtn);
}

function resetCard() {
  selected = null;
  subtitle.textContent = 'WHAT WOULD YOU LIKE TO DO?';
  dateSummary.textContent = '';
  dateSummary.classList.add('hidden');
  planScreen.classList.remove('locked');
  options.forEach((o) => {
    o.disabled = false;
    o.classList.remove('selected');
  });
  datePicker.classList.add('hidden');
  dateInput.value = '';
  timeInput.value = '';
  dateInput.disabled = false;
  timeInput.disabled = false;
  lockBtn.textContent = 'LOCK IT IN 🔒';
  lockBtn.disabled = true;
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) resetBtn.remove();
}
