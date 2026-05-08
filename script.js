const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const JAR = {
  x: 55,
  y: 35,
  w: 370,
  h: 510,
  wall: 5,
};

const GRAVITY = 0.45;
const BOUNCE = 0.2;
const FRICTION = 0.97;
const SUBS = 6;
const MAX_STONES = 300;

const STORAGE_KEY = "stonejar_data";

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateToHue(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayCount = y * 365 + m * 30 + d;
  return Math.round((((dayCount * 137.508) % 360) + 360) % 360);
}

function dateToColor(dateStr) {
  const h = dateToHue(dateStr);
  return `hsl(${h}, 78%, 58%)`;
}

let stones = [];
let particles = [];
let nextId = 0;

class Stone {
  constructor(x, y, r, color, date) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.color = color;
    this.date = date;
    this.vx = 0;
    this.vy = 0;
    this.settled = false;
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 2;
    this.r = 2 + Math.random() * 3.5;
    this.alpha = 1;
    this.decay = 0.015 + Math.random() * 0.025;
    const parts = color.match(/hsl\(([\d.]+),\s*(\d+)%,\s*(\d+)%\)/);
    if (parts) {
      const h = Math.round(parseFloat(parts[1]));
      const s = parseInt(parts[2]);
      const l = parseInt(parts[3]);
      const nl = Math.max(15, Math.min(85, l + (Math.random() - 0.5) * 40));
      this.color = `hsl(${h + (Math.random() - 0.5) * 20}, ${s}%, ${nl}%)`;
    } else {
      this.color = color;
    }
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15;
    this.vx *= 0.97;
    this.vy *= 0.97;
    this.alpha -= this.decay;
    this.r *= 0.99;
  }

  get dead() {
    return this.alpha <= 0 || this.r < 0.3;
  }
}

function getBodyBounds(r) {
  return {
    left: JAR.x + JAR.wall + r + 2,
    right: JAR.x + JAR.w - JAR.wall - r - 2,
    bottom: JAR.y + JAR.h - JAR.wall - r - 1,
  };
}

function isSupported(s) {
  if (s.y + s.r >= JAR.y + JAR.h - JAR.wall - 2) return true;
  for (const other of stones) {
    if (other === s || !other.settled) continue;
    const dx = s.x - other.x;
    const dy = s.y - other.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= s.r + other.r + 0.5 && dy < 0) return true;
  }
  return false;
}

function resolveCollisions() {
  for (let iter = 0; iter < SUBS; iter++) {
    for (let i = 0; i < stones.length; i++) {
      for (let j = i + 1; j < stones.length; j++) {
        const a = stones[i],
          b = stones[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.r + b.r;

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          if (!a.settled && b.settled) {
            a.x -= nx * overlap;
            a.y -= ny * overlap;
          } else if (a.settled && !b.settled) {
            b.x += nx * overlap;
            b.y += ny * overlap;
          } else if (!a.settled && !b.settled) {
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
          }

          if (!a.settled || !b.settled) {
            const rvx = a.vx - b.vx;
            const rvy = a.vy - b.vy;
            const rvn = rvx * nx + rvy * ny;
            if (rvn > 0) {
              const bounce = rvn < 0.8 ? 0 : BOUNCE;
              const imp = rvn * (1 + bounce) * 0.5;
              if (!a.settled) {
                a.vx -= imp * nx;
                a.vy -= imp * ny;
              }
              if (!b.settled) {
                b.vx += imp * nx;
                b.vy += imp * ny;
              }
            }
          }
        }
      }
    }

    for (const s of stones) {
      if (s.settled) continue;
      const b = getBodyBounds(s.r);
      if (s.x < b.left) {
        s.x = b.left;
        s.vx = Math.abs(s.vx) * 0.1;
      }
      if (s.x > b.right) {
        s.x = b.right;
        s.vx = -Math.abs(s.vx) * 0.1;
      }
      if (s.y + s.r > JAR.y + JAR.h - JAR.wall - 1) {
        s.y = JAR.y + JAR.h - JAR.wall - 1 - s.r;
        s.vy = Math.abs(s.vy) > 1 ? -s.vy * BOUNCE : 0;
      }
      if (s.y - s.r < JAR.y + 2) {
        s.y = JAR.y + 2 + s.r;
        s.vy = 0;
      }
    }
  }
}

function updatePhysics() {
  for (const s of stones) {
    if (s.settled) continue;
    s.vy += GRAVITY;
    s.vx *= FRICTION;
    s.vy *= FRICTION;
    s.x += s.vx;
    s.y += s.vy;
  }

  resolveCollisions();

  for (const s of stones) {
    if (s.settled) continue;
    if (Math.abs(s.vy) < 0.4 && Math.abs(s.vx) < 0.3 && isSupported(s)) {
      s.settled = true;
      s.vx = 0;
      s.vy = 0;
      playSettleSound();
      saveState();
    }
  }

  for (const p of particles) p.update();
  particles = particles.filter(p => !p.dead);
}

function addStone(clickX) {
  if (stones.length >= MAX_STONES) return;
  const today = getTodayStr();
  const color = dateToColor(today);
  const r = 9 + Math.random() * 4;
  let x;
  if (clickX != null) {
    const bounds = getBodyBounds(r);
    x = Math.max(bounds.left, Math.min(bounds.right, clickX));
  } else {
    const cx = JAR.x + JAR.w / 2;
    x = cx + (Math.random() - 0.5) * (JAR.w * 0.35);
  }
  const y = JAR.y - r;
  const stone = new Stone(x, y, r, color, today);
  stones.push(stone);
  updateUI();
}

function removeStone() {
  if (stones.length === 0) return;
  for (let i = stones.length - 1; i >= 0; i--) {
    const s = stones[i];
    if (s.settled) {
      explodeStone(s);
      stones.splice(i, 1);
      playRemoveSound();
      saveState();
      updateUI();
      return;
    }
  }
}

function explodeStone(s) {
  const count = 22 + Math.floor(Math.random() * 16);
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(s.x, s.y, s.color));
  }
}

let audioCtx = null;

function playSettleSound() {
  try {
    const ctx = audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (_) {}
}

function playRemoveSound() {
  try {
    const ctx = audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(300, now);
    osc1.frequency.exponentialRampToValueAtTime(900, now + 0.06);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(500, now + 0.03);
    osc2.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    gain2.gain.setValueAtTime(0.08, now + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.03);
    osc2.stop(now + 0.15);
  } catch (_) {}
}

function getSyncStorage() {
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.sync)
    return browser.storage.sync;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync)
    return chrome.storage.sync;
  return null;
}

const syncStorage = getSyncStorage();

function saveState() {
  try {
    const settled = stones.filter(s => s.settled);
    if (settled.length === 0) return;
    const data = settled.map(s => [
      s.date,
      s.color,
      Math.round(s.x * 10) / 10,
      Math.round(s.y * 10) / 10,
      Math.round(s.r * 10) / 10,
    ]);
    const json = JSON.stringify(data);
    if (syncStorage) {
      syncStorage.set({ [STORAGE_KEY]: json }).catch(() => {
        localStorage.setItem(STORAGE_KEY, json);
      });
    } else {
      localStorage.setItem(STORAGE_KEY, json);
    }
  } catch (e) {}
}

async function loadState() {
  try {
    let raw = null;
    if (syncStorage) {
      const result = await syncStorage.get(STORAGE_KEY);
      raw = result[STORAGE_KEY];
    }
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEY);
    }
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const d of data) {
      const s = Array.isArray(d)
        ? new Stone(d[2], d[3], d[4], d[1], d[0])
        : new Stone(d.x, d.y, d.r, d.color, d.date);
      s.settled = true;
      stones.push(s);
    }
  } catch (e) {}
}

function drawJar() {
  const { x, y, w, h, wall } = JAR;
  const r = 12;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.roundRect(x + 20, y + h - 8, w - 40, 16, 8);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, "rgba(180, 220, 255, 0.06)");
  grad.addColorStop(0.5, "rgba(200, 235, 255, 0.10)");
  grad.addColorStop(1, "rgba(180, 220, 255, 0.04)");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "rgba(200, 230, 255, 0.2)";
  ctx.lineWidth = wall;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + wall + 8, y + 12, w * 0.08, h - 24, 4);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();
  ctx.restore();
}

function drawStone(s) {
  const { x, y, r, color } = s;
  ctx.save();

  const grad = ctx.createRadialGradient(
    x - r * 0.3,
    y - r * 0.3,
    r * 0.1,
    x,
    y,
    r,
  );
  grad.addColorStop(0, "rgba(255,255,255,0.25)");
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, "rgba(0,0,0,0.3)");

  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fill();

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawJar();
  for (const s of stones) drawStone(s);
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.3, p.r), 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
  updateUI();
}

function updateUI() {
  const today = getTodayStr();
  const colorStr = dateToColor(today);
  document.getElementById("todaySwatch").style.background = colorStr;
  const total = stones.length;
  const settled = stones.filter((s) => s.settled).length;
  document.getElementById("stoneCount").textContent =
    `${total} stone${total !== 1 ? "s" : ""}${total > settled ? " (settling...)" : ""}`;
}

function loop() {
  updatePhysics();
  draw();
  requestAnimationFrame(loop);
}

document.getElementById("addBtn").addEventListener("click", () => addStone());
document.getElementById("removeBtn").addEventListener("click", removeStone);

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (
    mx >= JAR.x &&
    mx <= JAR.x + JAR.w &&
    my >= JAR.y &&
    my <= JAR.y + JAR.h
  ) {
    addStone(mx);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "a" || e.key === "A") addStone();
  if (e.key === "r" || e.key === "R") removeStone();
});

loadState().then(() => {
  updateUI();
  loop();
});
