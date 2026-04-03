// js/app.js — Main application controller
document.addEventListener('DOMContentLoaded', () => {
  if (!api.getToken()) { window.location.href = '/login.html'; return; }
  initApp();
});

async function initApp() {
  const userStr = localStorage.getItem('cpms_user');
  if (userStr) {
    const user = JSON.parse(userStr);
    const role = user.role || 'coordinator';
    const isStudent = role === 'student';

    document.getElementById('sidebarName').textContent = user.name || user.first_name || 'User';
    document.getElementById('sidebarRole').textContent = isStudent ? 'Student' : (user.role || 'Coordinator');
    document.getElementById('sidebarAvatar').textContent = (user.name || user.first_name || 'U')[0].toUpperCase();

    // Toggle Sidebar Items
    document.querySelectorAll('[data-role]').forEach(el => {
      const elRole = el.getAttribute('data-role');
      if (isStudent && elRole === 'admin') el.style.display = 'none';
      if (!isStudent && elRole === 'student') el.style.display = 'none';
    });

    if (isStudent) {
      showPage('student-dashboard');
    } else {
      showPage('dashboard');
    }
  }
}

// ─── Navigation ────────────────────────────────────────────
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  if (el) el.classList.add('active');

  const loaders = {
    dashboard:           loadDashboard,
    students:            loadStudents,
    companies:           loadCompanies,
    drives:              loadDrives,
    pipeline:            loadPipeline,
    offers:              loadOffers,
    'student-dashboard': loadStudentDashboard,
    'available-drives':  loadAvailableDrives,
    'my-applications':   loadMyApplications,
    'profile':           loadProfile,
  };
  if (loaders[id]) loaders[id]();
}

// ─── Toast ──────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const wrap = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span style="color:${type==='success'?'var(--green)':'var(--red)'}">${type==='success'?'✓':'✗'}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Modal helpers ──────────────────────────────────────────
function openModal(id) { document.getElementById('modal-' + id).classList.add('open'); }
function closeModal(id) { document.getElementById('modal-' + id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m =>
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); })
);

// ─── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  try {
    const { data } = await api.getDashboard();

    // Stats
    document.getElementById('statTotal').textContent    = data.students.total;
    document.getElementById('statPlaced').textContent   = data.students.placed;
    document.getElementById('statCompanies').textContent = data.companies.total;
    document.getElementById('statMaxCTC').textContent   = data.offers.max_ctc || 0;
    document.getElementById('statPlacementRate').textContent = data.students.placement_rate + '%';
    document.getElementById('statAvgCTC').textContent   = 'Avg: ' + data.offers.avg_ctc + ' LPA';

    // Department chart
    renderBarChart('deptChart', data.departmentPlacements.map(d => ({ l: d.dept_code, v: d.placed })),
      ['#f4b942','#2ec4b6','#4caf82','#98aab8','#e05f5f','#7dd3c8']);

    // Application status donut
    renderDonut(data.applicationsByStatus);

    // Recent offers table
    renderRecentOffers(data.recentOffers);

    // Top companies
    renderTopCompanies(data.topCompanies);
  } catch (err) {
    toast('Failed to load dashboard: ' + err.message, 'error');
  }
}

function renderBarChart(id, data, colors) {
  const c = document.getElementById(id);
  if (!c || !data.length) return;
  const max = Math.max(...data.map(d => d.v));
  c.innerHTML = data.map((d, i) => `
    <div class="bar-wrap">
      <div class="bar-val">${d.v}</div>
      <div class="bar" style="height:${Math.max(Math.round(d.v / max * 90), 4)}%;background:${colors[i % colors.length]}"></div>
      <div class="bar-label">${d.l}</div>
    </div>`).join('');
}

function renderDonut(statusData) {
  const colors = { Placed:'#4caf82', Applied:'#2ec4b6', Shortlisted:'#f4b942', Rejected:'#e05f5f', Interview:'#98aab8', Offered:'#4caf82', Withdrawn:'#6a7f8e' };
  const total  = statusData.reduce((a, b) => a + b.count, 0);
  let offset   = 0;
  const circ   = 2 * Math.PI * 45;
  const svgEl  = document.getElementById('donutSvg');
  const legend = document.getElementById('donutLegend');
  if (!svgEl || !legend) return;

  svgEl.innerHTML = `<circle cx="60" cy="60" r="45" fill="none" stroke="#253f5a" stroke-width="18"/>`;
  statusData.forEach(s => {
    const pct  = s.count / total;
    const dash = pct * circ;
    const col  = colors[s.status] || '#6a7f8e';
    svgEl.innerHTML += `<circle cx="60" cy="60" r="45" fill="none" stroke="${col}" stroke-width="18"
      stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}"
      stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 60 60)"/>`;
    offset += dash;
  });
  svgEl.innerHTML += `
    <text x="60" y="56" text-anchor="middle" fill="#e8edf2" font-size="18" font-weight="600" font-family="DM Sans">${total}</text>
    <text x="60" y="70" text-anchor="middle" fill="#6a7f8e" font-size="9" font-family="DM Sans">total</text>`;

  legend.innerHTML = statusData.map(s => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[s.status]||'#6a7f8e'}"></div>
      <div class="legend-label">${s.status}</div>
      <div class="legend-pct" style="color:${colors[s.status]||'#6a7f8e'}">${s.count}</div>
    </div>`).join('');
}

function renderRecentOffers(offers) {
  const tbody = document.getElementById('recentOffersBody');
  if (!tbody) return;
  tbody.innerHTML = offers.length ? offers.map(o => `
    <tr>
      <td><div class="cell-user"><div class="avatar av-gold">${o.student_name[0]}</div><div class="cell-name">${o.student_name}</div></div></td>
      <td>${o.company_name}</td>
      <td style="font-size:11px;color:var(--text2)">${o.role}</td>
      <td style="font-weight:600;color:var(--gold)">${o.ctc}</td>
      <td style="font-size:11px;color:var(--text3)">${o.offer_date}</td>
    </tr>`).join('') : '<tr><td colspan="5" class="table-empty">No recent offers</td></tr>';
}

function renderTopCompanies(companies) {
  const el = document.getElementById('topCompanies');
  if (!el) return;
  el.innerHTML = companies.map(c => `
    <div class="activity-item">
      <div class="activity-dot" style="background:var(--teal)"></div>
      <div style="flex:1"><div class="activity-text"><strong>${c.company_name}</strong> — ${c.offers} offers</div>
        <div class="activity-time">Avg CTC: ${c.avg_ctc} LPA</div></div>
    </div>`).join('');
}

// ─── Students ────────────────────────────────────────────────
async function loadStudents(params = {}) {
  const tbody = document.getElementById('studentBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="table-empty"><div class="loading-center"><div class="spinner"></div> Loading...</div></td></tr>';
  try {
    const { data } = await api.getStudents(params);
    tbody.innerHTML = data.length ? data.map(s => studentRow(s)).join('') :
      '<tr><td colspan="8" class="table-empty">No students found</td></tr>';
    document.getElementById('studentCount').textContent = data.length + ' students';
  } catch (err) { toast(err.message, 'error'); }
}

function studentRow(s) {
  const avColors = ['av-gold','av-teal','av-green','av-red'];
  const av = avColors[Math.abs(s.student_id.charCodeAt(0) - 65) % 4];
  const placed = s.placed ? '<span class="chip chip-green">Placed</span>' : '<span class="chip chip-gold">Seeking</span>';
  const cgpaColor = s.cgpa >= 8.5 ? 'var(--green)' : s.cgpa >= 7 ? 'var(--gold)' : 'var(--text2)';
  return `<tr>
    <td style="font-family:monospace;font-size:11px;color:var(--text3)">${s.student_id}</td>
    <td><div class="cell-user"><div class="avatar ${av}">${s.first_name[0]}${s.last_name[0]}</div>
      <div><div class="cell-name">${s.first_name} ${s.last_name}</div><div class="cell-sub">${s.email}</div></div></div></td>
    <td><span class="chip chip-gray">${s.dept_code}</span></td>
    <td style="font-weight:500;color:${cgpaColor}">${s.cgpa}</td>
    <td style="font-size:11px;color:var(--text3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.skills || '—'}</td>
    <td>${placed}</td>
    <td>
      <button class="btn btn-outline btn-xs" onclick="editStudent('${s.student_id}')">Edit</button>
      <button class="btn btn-danger btn-xs" onclick="deleteStudent('${s.student_id}')">Del</button>
    </td>
  </tr>`;
}

function searchStudents() {
  const q = document.getElementById('studentSearch').value.trim();
  const dept = document.getElementById('deptFilter').value;
  const placed = document.getElementById('placedFilter').value;
  loadStudents({ search: q, dept: dept || undefined, placed: placed || undefined });
}

async function saveStudent() {
  const data = {
    student_id:      document.getElementById('f_student_id').value,
    first_name:      document.getElementById('f_first_name').value,
    last_name:       document.getElementById('f_last_name').value,
    email:           document.getElementById('f_email').value,
    phone:           document.getElementById('f_phone').value,
    department_id:   parseInt(document.getElementById('f_dept').value),
    cgpa:            parseFloat(document.getElementById('f_cgpa').value),
    backlogs:        parseInt(document.getElementById('f_backlogs').value) || 0,
    year_of_passing: parseInt(document.getElementById('f_year').value),
    skills:          document.getElementById('f_skills').value.split(',').map(s => s.trim()).filter(Boolean)
  };
  try {
    await api.createStudent(data);
    toast('Student added successfully!');
    closeModal('addStudent');
    loadStudents();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteStudent(id) {
  if (!confirm('Delete student ' + id + '?')) return;
  try {
    await api.deleteStudent(id);
    toast('Student deleted');
    loadStudents();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Companies ───────────────────────────────────────────────
async function loadCompanies() {
  const tbody = document.getElementById('companyBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="table-empty"><div class="loading-center"><div class="spinner"></div></div></td></tr>';
  try {
    const { data } = await api.getCompanies();
    tbody.innerHTML = data.length ? data.map(c => `
      <tr>
        <td><div class="cell-user"><div class="avatar av-teal" style="border-radius:8px">${c.company_name[0]}</div>
          <div><div class="cell-name">${c.company_name}</div><div class="cell-sub">${c.hr_email}</div></div></div></td>
        <td><span class="chip chip-teal">${c.sector}</span></td>
        <td>${c.total_drives || 0}</td>
        <td style="color:var(--gold);font-weight:600">${c.total_offers || 0}</td>
        <td style="color:var(--green)">${c.avg_ctc ? c.avg_ctc + ' LPA' : '—'}</td>
        <td>
          <button class="btn btn-outline btn-xs" onclick="deleteCompany(${c.company_id})">Remove</button>
        </td>
      </tr>`).join('') : '<tr><td colspan="6" class="table-empty">No companies found</td></tr>';
  } catch (err) { toast(err.message, 'error'); }
}

async function saveCompany() {
  const data = {
    company_name: document.getElementById('c_name').value,
    sector:       document.getElementById('c_sector').value,
    hr_name:      document.getElementById('c_hr_name').value,
    hr_email:     document.getElementById('c_hr_email').value,
    website:      document.getElementById('c_website').value
  };
  try {
    await api.createCompany(data);
    toast('Company registered!');
    closeModal('addCompany');
    loadCompanies();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteCompany(id) {
  if (!confirm('Remove this company?')) return;
  try {
    await api.deleteCompany(id);
    toast('Company removed');
    loadCompanies();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Drives ──────────────────────────────────────────────────
async function loadDrives() {
  const tbody = document.getElementById('driveBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty"><div class="loading-center"><div class="spinner"></div></div></td></tr>';
  try {
    const { data } = await api.getDrives();
    tbody.innerHTML = data.length ? data.map(d => `
      <tr>
        <td><div class="cell-name">${d.company_name}</div><div class="cell-sub">${d.sector}</div></td>
        <td style="font-size:11px">${d.role}</td>
        <td style="color:var(--gold)">${d.ctc_min}–${d.ctc_max} LPA</td>
        <td style="font-size:11px;color:var(--text3)">${d.drive_date}</td>
        <td>${d.applicants || 0}</td>
        <td>${d.offers_made || 0}</td>
        <td><span class="chip ${d.status==='Active'?'chip-green':d.status==='Upcoming'?'chip-gold':'chip-gray'}">${d.status}</span></td>
      </tr>`).join('') : '<tr><td colspan="7" class="table-empty">No drives found</td></tr>';
  } catch (err) { toast(err.message, 'error'); }
}

async function saveDrive() {
  const data = {
    company_id:    parseInt(document.getElementById('d_company').value),
    role:          document.getElementById('d_role').value,
    ctc_min:       parseFloat(document.getElementById('d_ctc_min').value),
    ctc_max:       parseFloat(document.getElementById('d_ctc_max').value),
    min_cgpa:      parseFloat(document.getElementById('d_min_cgpa').value) || 6.5,
    max_backlogs:  parseInt(document.getElementById('d_max_backlogs').value) || 0,
    drive_date:    document.getElementById('d_drive_date').value,
    dept_eligible: document.getElementById('d_depts').value.split(',').map(s => s.trim()).filter(Boolean)
  };
  try {
    await api.createDrive(data);
    toast('Drive created!');
    closeModal('addDrive');
    loadDrives();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Pipeline ────────────────────────────────────────────────
async function loadPipeline() {
  try {
    const { data: apps } = await api.getApplications();
    const cols = { Applied:[], Shortlisted:[], Interview:[], Offered:[], Rejected:[] };
    apps.forEach(a => { if (cols[a.status]) cols[a.status].push(a); });

    Object.entries(cols).forEach(([status, list]) => {
      const colId = 'col-' + status.toLowerCase();
      const el    = document.getElementById(colId);
      if (!el) return;
      const countEl = document.getElementById('count-' + status.toLowerCase());
      if (countEl) countEl.textContent = list.length;
      el.innerHTML = list.map(a => `
        <div class="pipeline-card" onclick="openAppDetail(${a.application_id})">
          <div class="pipeline-card-name">${a.student_name}</div>
          <div class="pipeline-card-company">${a.company_name}</div>
          <div class="pipeline-card-role">${a.role}</div>
          <div style="display:flex;justify-content:space-between;margin-top:6px">
            <span style="font-size:10px;color:var(--text3)">${a.dept_code} · CGPA ${a.cgpa}</span>
            <select onchange="quickStatus(${a.application_id},this.value)" onclick="event.stopPropagation()"
              style="background:var(--navy3);border:1px solid var(--border);color:var(--text2);border-radius:4px;font-size:10px;padding:1px 4px;outline:none">
              ${['Applied','Shortlisted','Interview','Offered','Rejected'].map(s =>
                `<option value="${s}"${s===status?' selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>`).join('') || `<div style="color:var(--text3);font-size:11px;text-align:center;padding:12px">Empty</div>`;
    });
  } catch (err) { toast(err.message, 'error'); }
}

async function quickStatus(appId, status) {
  try {
    await api.updateAppStatus(appId, status);
    toast('Status updated to ' + status);
    setTimeout(loadPipeline, 300);
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Offers ──────────────────────────────────────────────────
async function loadOffers() {
  const tbody = document.getElementById('offerBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty"><div class="loading-center"><div class="spinner"></div></div></td></tr>';
  try {
    const [{ data }, { data: stats }] = await Promise.all([api.getOffers(), api.getOfferStats()]);
    document.getElementById('offerTotal').textContent   = stats.total_offers || 0;
    document.getElementById('offerAccepted').textContent = stats.accepted || 0;
    document.getElementById('offerAvgCTC').textContent  = stats.avg_ctc || 0;
    document.getElementById('offerMaxCTC').textContent  = stats.max_ctc || 0;

    tbody.innerHTML = data.length ? data.map(o => `
      <tr>
        <td style="font-family:monospace;font-size:11px;color:var(--text3)">OFR${String(o.offer_id).padStart(4,'0')}</td>
        <td><div class="cell-user"><div class="avatar av-gold">${o.student_name[0]}</div>
          <div><div class="cell-name">${o.student_name}</div><div class="cell-sub">${o.dept_code}</div></div></div></td>
        <td>${o.company_name}</td>
        <td style="font-size:11px;color:var(--text2)">${o.role}</td>
        <td style="font-weight:600;color:var(--gold)">${o.ctc} LPA</td>
        <td style="font-size:11px;color:var(--text3)">${o.offer_date}</td>
        <td><span class="chip ${o.accepted?'chip-green':'chip-gold'}">${o.accepted?'Accepted':'Pending'}</span></td>
      </tr>`).join('') : '<tr><td colspan="7" class="table-empty">No offers yet</td></tr>';
  } catch (err) { toast(err.message, 'error'); }
}

// ─── Student Dashboard ───────────────────────────────────────
async function loadStudentDashboard() {
  try {
    const user = JSON.parse(localStorage.getItem('cpms_user'));
    document.getElementById('studentHeader').textContent = `Welcome back, ${user.first_name}!`;
    document.getElementById('s_statCGPA').textContent = user.cgpa;

    const { data: apps } = await api.getMyApplications();
    document.getElementById('s_statApps').textContent = apps.length;
    document.getElementById('s_statShortlisted').textContent = apps.filter(a => ['Shortlisted', 'Interview', 'Offered'].includes(a.status)).length;

    const isPlaced = apps.some(a => a.status === 'Offered');
    document.getElementById('s_placementStatus').textContent = isPlaced ? 'Congratulations! You are placed.' : 'Currently seeking placement opportunities.';
  } catch (err) { toast(err.message, 'error'); }
}

async function loadAvailableDrives() {
  const el = document.getElementById('availableDrivesList');
  if (!el) return;
  el.innerHTML = '<div class="loading-center">Searching for drives...</div>';
  try {
    const { data } = await api.getEligibleDrives();
    el.innerHTML = data.length ? data.map(d => `
      <div class="stat-card" style="flex-direction:column;align-items:flex-start;gap:12px;padding:20px;background:var(--navy2)">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span class="chip chip-teal">${d.sector}</span>
          <span style="color:var(--gold);font-weight:600">${d.ctc_min}–${d.ctc_max} LPA</span>
        </div>
        <div>
          <div style="font-size:18px;font-weight:600;color:var(--text1)">${d.role}</div>
          <div style="color:var(--text3);font-size:13px">${d.company_name}</div>
        </div>
        <div style="font-size:12px;color:var(--text2)">
           Date: ${d.drive_date} | Min CGPA: ${d.min_cgpa}
        </div>
        ${d.applied ?
          `<button class="btn btn-outline btn-sm full" disabled style="width:100%">✓ Applied</button>` :
          `<button class="btn btn-primary btn-sm full" style="width:100%" onclick="applyForDrive(${d.drive_id})">Apply Now</button>`
        }
      </div>`).join('') : '<div class="table-empty">No new eligible drives found.</div>';
  } catch (err) { toast(err.message, 'error'); }
}

async function loadMyApplications() {
  const tbody = document.getElementById('myAppsBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading…</td></tr>';
  try {
    const { data } = await api.getMyApplications();
    const colors = { Applied:'chip-teal', Shortlisted:'chip-gold', Interview:'chip-blue', Offered:'chip-green', Rejected:'chip-red', Withdrawn:'chip-gray' };
    tbody.innerHTML = data.length ? data.map(a => `
      <tr>
        <td><strong>${a.company_name}</strong></td>
        <td>${a.role}</td>
        <td>${a.ctc_min}–${a.ctc_max} LPA</td>
        <td style="font-size:11px;color:var(--text3)">${a.drive_date}</td>
        <td><span class="chip ${colors[a.status] || 'chip-gray'}">${a.status}</span></td>
      </tr>`).join('') : '<tr><td colspan="5" class="table-empty">No applications yet</td></tr>';
  } catch (err) { toast(err.message, 'error'); }
}

async function applyForDrive(driveId) {
  try {
    const user = JSON.parse(localStorage.getItem('cpms_user'));
    await api.applyToDrive({ drive_id: driveId, student_id: user.student_id });
    toast('Application submitted successfully!');
    loadAvailableDrives();
  } catch (err) { toast(err.message, 'error'); }
}

async function loadProfile() {
  const user = JSON.parse(localStorage.getItem('cpms_user'));
  if (!user) return;
  document.getElementById('p_name').textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name || '—';
  document.getElementById('p_id').textContent = user.student_id || user.admin_id || '—';
  document.getElementById('p_email').textContent = user.email || '—';
  document.getElementById('p_dept').textContent = user.dept_name || user.dept_code || (user.role ? 'Administration' : '—');
  document.getElementById('p_cgpa').textContent = user.cgpa || 'N/A';
  document.getElementById('p_backlogs').textContent = user.backlogs || 0;
}

// ─── Auth ────────────────────────────────────────────────────
function logout() {
  api.clearToken();
  window.location.href = '/login.html';
}
