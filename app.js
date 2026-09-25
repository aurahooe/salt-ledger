const SUPABASE_URL = "https://tqfocdktvjuwoiyfgesb.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZm9jZGt0dmp1d29peWZnZXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDg0NTIsImV4cCI6MjEwNTQ4NDQ1Mn0.8TW4fQCQHc4c_xTNBEwOK3lSC9HYCbkTbfXuYQB-S8g";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const EDITIONS = [
  ["The tide is in.", "Write something you would still mean at dusk."],
  ["Keep the window cracked.", "Public notes stay on the wall. Private ones stay in the drawer."],
  ["Salt on the ledger.", "The hour turns whether we are ready or not."],
  ["A quieter front.", "If it is not public, only you can find it."],
  ["Copper light.", "File the thought before the next bell."],
  ["The press is warm.", "Mark it public when it can stand in the room."],
  ["Paper still damp.", "This hour belongs to whoever showed up."],
  ["No masthead today.", "Just the wall, and whoever pinned a note to it."],
];

let session = null;
let modeSignup = false;

const els = {
  headline: document.getElementById("headline"),
  dek: document.getElementById("dek"),
  hourLabel: document.getElementById("hour-label"),
  countdown: document.getElementById("countdown"),
  publicList: document.getElementById("public-list"),
  mineList: document.getElementById("mine-list"),
  wall: document.getElementById("wall"),
  desk: document.getElementById("desk"),
  authBtn: document.getElementById("auth-btn"),
  modal: document.getElementById("auth-modal"),
  authForm: document.getElementById("auth-form"),
  authTitle: document.getElementById("auth-title"),
  authMsg: document.getElementById("auth-msg"),
  handle: document.getElementById("auth-handle"),
  toggle: document.getElementById("toggle-mode"),
};

function setEdition() {
  const now = new Date();
  const idx = Math.floor(now.getTime() / 3600000) % EDITIONS.length;
  const [h, d] = EDITIONS[idx];
  els.headline.textContent = h;
  els.dek.textContent = d;
  els.hourLabel.textContent = now.toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
  tick();
}

function tick() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(60, 0, 0);
  const ms = next - now;
  const m = String(Math.floor(ms / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  els.countdown.textContent = `next turn ${m}:${s}`;
}

function cardHtml(note, mine) {
  const when = new Date(note.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const author = note.salt_profiles?.display_name || note.salt_profiles?.handle || "member";
  const actions = mine
    ? `<div class="actions">
        <button type="button" data-toggle="${note.id}" data-public="${note.is_public}">${
          note.is_public ? "Make private" : "Make public"
        }</button>
        <button type="button" data-del="${note.id}">Delete</button>
      </div>`
    : "";
  return `<article class="card">
    <h4>${escapeHtml(note.title)}</h4>
    <p>${escapeHtml(note.body)}</p>
    <div class="meta"><span>${escapeHtml(author)}</span><span>${when}</span></div>
    ${actions}
  </article>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """);
}

async function loadPublic() {
  const { data, error } = await sb
    .from("salt_notes")
    .select("id,title,body,is_public,created_at,author_id,salt_profiles(handle,display_name)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(48);
  if (error) {
    els.publicList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data?.length) {
    els.publicList.innerHTML = `<article class="card"><h4>Empty wall</h4><p>Sign in, write a note, and mark it public.</p></article>`;
    return;
  }
  els.publicList.innerHTML = data.map((n) => cardHtml(n, false)).join("");
}

async function loadMine() {
  if (!session) {
    els.mineList.innerHTML = "";
    return;
  }
  const { data, error } = await sb
    .from("salt_notes")
    .select("id,title,body,is_public,created_at,author_id,salt_profiles(handle,display_name)")
    .eq("author_id", session.user.id)
    .order("created_at", { ascending: false });
  if (error) {
    els.mineList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    return;
  }
  els.mineList.innerHTML = (data || []).map((n) => cardHtml(n, true)).join("");
}

async function ensureProfile(user, handle) {
  const fallback = (user.email || "member").split("@")[0].slice(0, 18);
  const h = (handle || fallback).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24) || fallback;
  await sb.from("salt_profiles").upsert({
    id: user.id,
    handle: h,
    display_name: h,
  });
}

async function refreshAuth() {
  const { data } = await sb.auth.getSession();
  session = data.session;
  els.authBtn.textContent = session ? "Sign out" : "Sign in";
}

document.getElementById("to-wall").onclick = () => {
  els.wall.classList.remove("hidden");
  els.desk.classList.add("hidden");
};
document.getElementById("to-desk").onclick = () => {
  if (!session) {
    els.modal.classList.remove("hidden");
    return;
  }
  els.desk.classList.remove("hidden");
  els.wall.classList.add("hidden");
  loadMine();
};

els.authBtn.onclick = async () => {
  if (session) {
    await sb.auth.signOut();
    session = null;
    await refreshAuth();
    els.desk.classList.add("hidden");
    els.wall.classList.remove("hidden");
    return;
  }
  els.modal.classList.remove("hidden");
};
document.getElementById("close-modal").onclick = () => els.modal.classList.add("hidden");

els.toggle.onclick = () => {
  modeSignup = !modeSignup;
  els.authTitle.textContent = modeSignup ? "Create account" : "Sign in";
  els.toggle.textContent = modeSignup ? "Have an account?" : "Need an account?";
  els.handle.style.display = modeSignup ? "block" : "none";
};
els.handle.style.display = "none";

els.authForm.onsubmit = async (e) => {
  e.preventDefault();
  els.authMsg.textContent = "";
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-pass").value;
  const handle = els.handle.value.trim();
  try {
    if (modeSignup) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) await ensureProfile(data.user, handle);
      els.authMsg.textContent = data.session
        ? "Account ready."
        : "Check your email if confirmation is required.";
    } else {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await ensureProfile(data.user, handle);
    }
    await refreshAuth();
    if (session) {
      els.modal.classList.add("hidden");
      els.desk.classList.remove("hidden");
      els.wall.classList.add("hidden");
      await loadMine();
    }
  } catch (err) {
    els.authMsg.textContent = err.message || "Could not sign in.";
  }
};

document.getElementById("note-form").onsubmit = async (e) => {
  e.preventDefault();
  if (!session) return;
  await ensureProfile(session.user);
  const title = document.getElementById("note-title").value.trim();
  const body = document.getElementById("note-body").value.trim();
  const is_public = document.getElementById("note-public").checked;
  const { error } = await sb.from("salt_notes").insert({
    author_id: session.user.id,
    title,
    body,
    is_public,
  });
  if (error) {
    alert(error.message);
    return;
  }
  e.target.reset();
  await Promise.all([loadMine(), loadPublic()]);
};

els.mineList.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.dataset.toggle) {
    const next = t.dataset.public !== "true";
    await sb.from("salt_notes").update({ is_public: next }).eq("id", t.dataset.toggle);
    await Promise.all([loadMine(), loadPublic()]);
  }
  if (t.dataset.del) {
    await sb.from("salt_notes").delete().eq("id", t.dataset.del);
    await Promise.all([loadMine(), loadPublic()]);
  }
});

sb.auth.onAuthStateChange((_e, s) => {
  session = s;
  refreshAuth();
});

setEdition();
setInterval(() => {
  tick();
  if (new Date().getSeconds() === 0 && new Date().getMinutes() === 0) setEdition();
}, 1000);

refreshAuth().then(() => {
  loadPublic();
  if (session) loadMine();
});
