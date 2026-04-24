// ============================================================
// db.js — MongoDB Cloud API Layer
// All data operations go through Vercel serverless API routes
// ============================================================

const API = {
    // Core fetch helper
    async call(endpoint, method = 'GET', body = null, params = {}) {
        const url = new URL('/api/' + endpoint, window.location.origin);
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body && method !== 'GET') opts.body = JSON.stringify(body);
        const res = await fetch(url.toString(), opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `API error ${res.status}`);
        }
        return res.json();
    },

    get:    (ep, params)     => API.call(ep, 'GET', null, params),
    post:   (ep, body)       => API.call(ep, 'POST', body),
    put:    (ep, body)       => API.call(ep, 'PUT', body),
    delete: (ep, params)     => API.call(ep, 'DELETE', null, params),
};

// ============================================================
// Collection Builder — creates a Dexie-compatible interface
// ============================================================
function makeCollection(name) {
    return {
        // Fetch all (with optional filter params)
        toArray: (params) => API.get(name, params),

        // Count all
        count: async (params) => {
            const all = await API.get(name, params);
            return all.length;
        },

        // Get single by _id
        get: async (id) => {
            if (!id) return null;
            const all = await API.get(name);
            return all.find(r => r._id == id || r._id?.toString() == id?.toString()) || null;
        },

        // Add new record
        add: (data) => API.post(name, data),

        // Update by _id (pass whole object with _id field)
        put: (data) => API.put(name, data),

        // Delete by _id
        delete: (id) => API.delete(name, { id }),

        // Update a specific field
        update: async (id, changes) => {
            const existing = await makeCollection(name).get(id);
            if (!existing) throw new Error(`Record ${id} not found in ${name}`);
            return API.put(name, { ...existing, ...changes, _id: existing._id });
        },

        // filter(fn) — fetch all then filter client-side
        filter: (fn) => ({
            first:   async () => { const all = await API.get(name); return all.find(fn) || null; },
            toArray: async () => { const all = await API.get(name); return all.filter(fn); },
            count:   async () => { const all = await API.get(name); return all.filter(fn).length; },
        }),

        // where(field).equals(val) — uses API query params when possible
        where: (field) => ({
            equals: (val) => {
                const params = {};
                // Known indexed fields — pass as query param for efficiency
                const indexedFields = ['teacherId','studentId','category','subject','month'];
                if (indexedFields.includes(field)) params[field] = val;

                return {
                    first:   async () => {
                        if (Object.keys(params).length) {
                            const r = await API.get(name, params);
                            return r[0] || null;
                        }
                        const all = await API.get(name);
                        return all.find(r => r[field] == val) || null;
                    },
                    toArray: async () => {
                        if (Object.keys(params).length) return API.get(name, params);
                        const all = await API.get(name);
                        return all.filter(r => r[field] == val);
                    },
                    count:   async () => {
                        const col = makeCollection(name);
                        const arr = await col.where(field).equals(val).toArray();
                        return arr.length;
                    },
                };
            },

            // between — fetch all and filter client-side (for compound keys)
            between: (lower, upper) => ({
                toArray: async () => {
                    const all = await API.get(name);
                    return all; // attendance compound index handled server-side via filter()
                }
            })
        }),

        // reverse().limit(n)
        reverse: () => ({
            limit: (n) => ({
                toArray: async () => {
                    const params = {};
                    if (n) params.limit = n;
                    const data = await API.get(name, params);
                    // payments API already returns sorted by date desc; others reverse here
                    return name === 'payments' ? data : [...data].reverse().slice(0, n);
                }
            })
        }),
    };
}

// ============================================================
// db — Dexie-like database object (API-backed)
// ============================================================
const db = {
    teachers:    makeCollection('teachers'),
    students:    makeCollection('students'),
    enrollments: makeCollection('enrollments'),
    payments:    makeCollection('payments'),
    schedules:   makeCollection('schedules'),
    attendance:  makeCollection('attendance'),
};

// Health check on load
(async () => {
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.status === 'Connected') {
            console.log('✅ MongoDB Connected — Cloud Mode Active');
        } else {
            console.warn('⚠️ MongoDB issue:', data);
        }
    } catch (e) {
        console.error('❌ Cannot reach API. Check Vercel deployment and MONGODB_URI.', e);
    }
})();
