// js/api.js  — Centralised API client
const BASE = (typeof process !== 'undefined' && process.env.API_URL) ? process.env.API_URL : 'http://localhost:5000/api';

function getToken() { return localStorage.getItem('cpms_token'); }
function setToken(t) { localStorage.setItem('cpms_token', t); }
function clearToken() { localStorage.removeItem('cpms_token'); localStorage.removeItem('cpms_user'); }

async function request(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + endpoint, opts);
  const data = await res.json();

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login.html';
    return;
  }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const api = {
  // Auth
  login:         (email, password) => request('POST', '/auth/login', { email, password }),
  studentLogin:  (student_id, password) => request('POST', '/auth/student-login', { student_id, password }),
  me:            () => request('GET', '/auth/me'),

  // Students
  getStudents:   (params = {}) => request('GET', '/students?' + new URLSearchParams(params)),
  getStudent:    (id) => request('GET', '/students/' + id),
  createStudent: (data) => request('POST', '/students', data),
  updateStudent: (id, data) => request('PUT', '/students/' + id, data),
  deleteStudent: (id) => request('DELETE', '/students/' + id),
  studentApps:   (id) => request('GET', '/students/' + id + '/applications'),
  studentStats:  () => request('GET', '/students/stats'),

  // Companies
  getCompanies:   () => request('GET', '/companies'),
  getCompany:     (id) => request('GET', '/companies/' + id),
  createCompany:  (data) => request('POST', '/companies', data),
  updateCompany:  (id, data) => request('PUT', '/companies/' + id, data),
  deleteCompany:  (id) => request('DELETE', '/companies/' + id),

  // Drives
  getDrives:       (params = {}) => request('GET', '/drives?' + new URLSearchParams(params)),
  createDrive:     (data) => request('POST', '/drives', data),
  updateDrive:     (id, data) => request('PUT', '/drives/' + id, data),
  eligibleStudents:(id) => request('GET', '/drives/' + id + '/eligible'),

  // Applications
  getApplications: (params = {}) => request('GET', '/applications?' + new URLSearchParams(params)),
  applyToDrive:    (data) => request('POST', '/applications', data),
  updateAppStatus: (id, status, remarks) => request('PUT', '/applications/' + id + '/status', { status, remarks }),
  getPipeline:     () => request('GET', '/applications/pipeline'),

  // Offers
  getOffers:      () => request('GET', '/offers'),
  getOfferStats:  () => request('GET', '/offers/stats'),
  createOffer:    (data) => request('POST', '/offers', data),
  acceptOffer:    (id) => request('PUT', '/offers/' + id + '/accept'),

  // Interviews
  getInterviews:  (appId) => request('GET', '/offers/interviews/' + appId),
  addInterview:   (data) => request('POST', '/offers/interviews', data),
  updateInterview:(id, data) => request('PUT', '/offers/interviews/' + id, data),

  // Analytics
  getDashboard:   () => request('GET', '/analytics/dashboard'),
  getCTCDist:     () => request('GET', '/analytics/ctc-distribution'),
  getMonthly:     () => request('GET', '/analytics/monthly-placements'),

  // Utils
  getToken, setToken, clearToken
};

window.api = api;
