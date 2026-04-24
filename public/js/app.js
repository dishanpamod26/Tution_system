// Global Variables
let currentStudentCategoryFilter = 'All';
let qrCodeInstance = null;

// Initialize
window.onload = () => {
    try {
        updateDateTime();
        setInterval(updateDateTime, 1000 * 60);
        router('dashboard');
    } catch (e) {
        console.error("Critical initialization error:", e);
        alert("The system failed to load. Please check the console for errors.");
    }
};


function updateDateTime() {
    const now = new Date();
    document.getElementById('current-datetime').innerText = now.toLocaleString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

// Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;

    const isOpen = !sidebar.classList.contains('-translate-x-full');

    if (isOpen) {
        // Close
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    } else {
        // Open
        overlay.classList.remove('hidden');
        setTimeout(() => {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('opacity-0');
        }, 10);
    }
}

// Navigation
function router(viewId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-' + viewId).classList.add('active');
    
    document.querySelectorAll('main > div > section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    
    const titles = {
        'dashboard': 'Dashboard Overview',
        'teachers': 'Teachers Management',
        'students': 'Students Directory',
        'payments': 'Payment Management',
        'schedules': 'Classes & Schedules',
        'active-classes': 'Today\'s Classes',
        'attendance': 'Attendance Tracker'
    };
    document.getElementById('page-title').innerText = titles[viewId] || titles['dashboard'];
    
    if (viewId === 'dashboard') loadDashboard();
    if (viewId === 'teachers') loadTeachers();
    if (viewId === 'students') loadStudents();
    if (viewId === 'payments') {
        document.getElementById('pay-scan-input').focus();
        loadRecentPayments();
        loadPaymentStudentStatus();
    }
    if (viewId === 'schedules') loadScheduleTeachers();
    if (viewId === 'active-classes') loadActiveClasses();
    if (viewId === 'attendance') loadAttendanceView();
    
    // Always close sidebar after navigation
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        toggleSidebar();
    }
}

// ============== DASHBOARD ==============
async function loadDashboard() {
    console.log("📊 Loading Dashboard...");
    
    // Helper to safely update text
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    try {
        // Parallel counts
        const [totalS, olS, alS, totalT] = await Promise.all([
            db.students.count(),
            db.students.where('category').equals('O/L').count(),
            db.students.where('category').equals('A/L').count(),
            db.teachers.count()
        ]);
        setVal('dash-total-students', totalS);
        setVal('dash-ol-students', olS);
        setVal('dash-al-students', alS);
        setVal('dash-teachers', totalT);

        // Load recent enrollments
        const enrollments = await db.enrollments.reverse().limit(5).toArray();
        const tbody = document.getElementById('recent-enrollments-list');
        const emptyMsg = document.getElementById('no-enrollments-msg');
        
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (!enrollments || enrollments.length === 0) {
            if (emptyMsg) emptyMsg.classList.remove('hidden');
        } else {
            if (emptyMsg) emptyMsg.classList.add('hidden');
            
            // Pre-fetch students and teachers for these enrollments
            const sIds = enrollments.map(e => e.studentId);
            const tIds = enrollments.map(e => e.teacherId);
            const [students, teachers] = await Promise.all([
                db.students.filter(s => sIds.includes(s.studentId)).toArray(),
                db.teachers.filter(t => tIds.includes(t.teacherId)).toArray()
            ]);
            const sMap = new Map(students.map(s => [s.studentId, s]));
            const tMap = new Map(teachers.map(t => [t.teacherId, t]));

            let html = '';
            for (let en of enrollments) {
                const student = sMap.get(en.studentId);
                const teacher = tMap.get(en.teacherId);
                if(!student || !teacher) continue;

                html += `
                    <tr class="border-b border-emerald-900/40 hover:bg-emerald-900/20 transition-colors">
                        <td class="py-3 font-mono text-emerald-400">${en.studentId}</td>
                        <td class="py-3 text-white font-medium">${student.name}</td>
                        <td class="py-3"><span class="px-2 py-1 rounded bg-black border border-emerald-900/50 text-xs font-bold text-emerald-200/80">${student.category}</span></td>
                        <td class="py-3 text-emerald-500/60">${teacher.name}</td>
                        <td class="py-3 text-emerald-500/60">${en.subject}</td>
                    </tr>
                `;
            }
            tbody.innerHTML = html;
        }
    } catch (e) {
        console.error("Critical Dashboard Error:", e);
    }
}

// ============== TEACHERS ==============
async function loadTeachers() {
    const search = document.getElementById('teacher-search').value.toLowerCase();
    let teachers = await db.teachers.toArray();
    
    if (search) {
        teachers = teachers.filter(t => t.name.toLowerCase().includes(search) || t.teacherId.toLowerCase().includes(search));
    }

    const tbody = document.getElementById('teachers-list');
    if (!tbody) return;

    let html = '';
    teachers.forEach(t => {
        html += `
            <tr class="hover:bg-slate-800/50 transition-colors">
                <td class="p-4 font-mono text-indigo-400 font-medium">${t.teacherId}</td>
                <td class="p-4 text-white font-bold">${t.name}</td>
                <td class="p-4 text-slate-400">${t.nic || '-'}</td>
                <td class="p-4">${t.phone}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-md bg-[#1e293b] border border-slate-600 text-xs font-bold text-slate-300">${t.category}</span></td>
                <td class="p-4 text-slate-400">${t.subjects}</td>
                <td class="p-4 flex gap-2">
                    <button onclick="editTeacher('${t.id}')" class="p-2 rounded bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteTeacher('${t.id}')" class="p-2 rounded bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white transition-colors"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function openTeacherModal() {
    const modal = document.getElementById('modal-teacher');
    document.getElementById('teacher-edit-id').value = '';
    document.getElementById('modal-teacher-title').innerText = 'Register Teacher';
    document.getElementById('t-name').value = '';
    document.getElementById('t-nic').value = '';
    document.getElementById('t-phone').value = '';
    document.getElementById('t-subjects').value = '';
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('modal-teacher-content').classList.remove('scale-95');
    }, 10);
}

async function editTeacher(id) {
    const t = await db.teachers.get(parseInt(id)) || await db.teachers.get(id);
    if(!t) return alert("Teacher not found");
    
    openTeacherModal();
    document.getElementById('teacher-edit-id').value = t.id;
    document.getElementById('modal-teacher-title').innerText = 'Edit Teacher';
    document.getElementById('t-name').value = t.name;
    document.getElementById('t-nic').value = t.nic || '';
    document.getElementById('t-phone').value = t.phone;
    document.getElementById('t-category').value = t.category;
    document.getElementById('t-subjects').value = t.subjects;
}

function closeTeacherModal() {
    const modal = document.getElementById('modal-teacher');
    modal.classList.add('opacity-0');
    document.getElementById('modal-teacher-content').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('t-name').value = '';
        document.getElementById('t-phone').value = '';
        document.getElementById('t-category').value = 'O/L';
        document.getElementById('t-subjects').value = '';
    }, 300);
}

async function saveTeacher(e) {
    e.preventDefault();
    const editId = document.getElementById('teacher-edit-id').value;
    const name = document.getElementById('t-name').value;
    const nic = document.getElementById('t-nic').value;
    const phone = document.getElementById('t-phone').value;
    const category = document.getElementById('t-category').value;
    const subjects = document.getElementById('t-subjects').value;
    
    if (editId) {
        const existing = await db.teachers.get(parseInt(editId)) || await db.teachers.get(editId);
        const teacherId = existing ? existing.teacherId : `TCH-REPAIR`;
        await db.teachers.put({ id: parseInt(editId) || editId, teacherId, name, nic, phone, category, subjects });
    } else {
        const teachers = await db.teachers.toArray();
        const teacherId = `TCH-${1001 + teachers.length}`;
        await db.teachers.add({ teacherId, name, nic, phone, category, subjects });
    }

    closeTeacherModal();
    loadTeachers();
    if(document.getElementById('nav-dashboard') && document.getElementById('nav-dashboard').classList.contains('active')) loadDashboard();
}

async function deleteTeacher(id) {
    if(!id) return;
    
    const t = await db.teachers.get(parseInt(id)) || await db.teachers.get(id);
    const teacherName = t ? t.name : "Teacher";

    if(confirm(`Are you sure you want to delete ${teacherName}?`)) {
        try {
            await db.teachers.delete(parseInt(id));
            await db.teachers.delete(id);
            showToast("Teacher Deleted Successfully!");
            loadTeachers();
        } catch (err) {
            console.error("❌ Delete failed:", err);
            alert("Error deleting teacher.");
        }
    }
}

// ============== STUDENTS ==============
function filterStudentCat(cat) {
    currentStudentCategoryFilter = cat;
    ['All', 'OL', 'AL'].forEach(c => {
        document.getElementById(`btn-cat-${c}`).classList.replace('bg-emerald-900', 'text-emerald-500/60');
        document.getElementById(`btn-cat-${c}`).classList.remove('text-white');
    });
    
    const activeBtn = document.getElementById(`btn-cat-${cat.replace('/','')}`);
    if(activeBtn.classList.contains('text-emerald-500/60')) {
        activeBtn.classList.replace('text-emerald-500/60', 'bg-emerald-900');
    }
    activeBtn.classList.add('text-white');
    loadStudents();
}

async function loadStudents() {
    const search = document.getElementById('student-search').value.toLowerCase();
    let query = db.students;
    
    if (currentStudentCategoryFilter !== 'All') {
        query = db.students.where('category').equals(currentStudentCategoryFilter);
    }
    
    let students = await query.toArray();
    
    if (search) {
        students = students.filter(s => 
            s.name.toLowerCase().includes(search) || 
            s.studentId.toLowerCase().includes(search) ||
            s.phone.includes(search) ||
            s.nic.toLowerCase().includes(search)
        );
    }

    const tbody = document.getElementById('students-list');
    if (!tbody) return;

    let html = '';
    for (const s of students) {
        const refDisplay = s.category === 'O/L' ? s.phone : s.nic;

        html += `
            <tr class="hover:bg-emerald-900/30 transition-colors">
                <td class="p-4 font-mono text-emerald-400 font-medium">${s.studentId}</td>
                <td class="p-4 text-white font-bold">${s.name}</td>
                <td class="p-4 text-emerald-500/60 font-medium">${refDisplay || '-'}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-md bg-[#000] border border-emerald-900/50 text-xs font-bold text-emerald-200/80">${s.category}</span></td>
                <td class="p-4 text-emerald-500/60">${s.school || '-'}</td>
                <td class="p-4 flex gap-2">
                    <button onclick="viewStudentQR('${s.studentId}')" class="p-2 rounded bg-emerald-900/30 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors" title="View QR Card"><i class="fa-solid fa-qrcode"></i></button>
                    <button onclick="editStudent('${s.id}')" class="p-2 rounded bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteStudent('${s.id}')" class="p-2 rounded bg-red-900/30 text-red-500 hover:bg-red-600 hover:text-white transition-colors"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

function openStudentModal() {
    const modal = document.getElementById('modal-student');
    document.getElementById('student-edit-id').value = '';
    document.getElementById('modal-student-title').innerText = 'Register New Student';
    document.getElementById('s-name').value = '';
    document.getElementById('s-phone').value = '';
    document.getElementById('s-nic').value = '';
    document.getElementById('s-address').value = '';
    document.getElementById('s-school').value = '';
    document.getElementById('s-parent-name').value = '';
    document.getElementById('s-parent-phone').value = '';
    document.getElementById('s-reg-fee').value = '1000';
    document.getElementById('subject-selection-area').innerHTML = '';
    addEnrollmentRow();

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('modal-student-content').classList.remove('scale-95');
    }, 10);
    
    toggleStudentFields();
}

async function editStudent(id) {
    const s = await db.students.get(parseInt(id)) || await db.students.get(id);
    if(!s) return alert("Student not found");

    openStudentModal();
    document.getElementById('student-edit-id').value = s.id;
    document.getElementById('modal-student-title').innerText = 'Edit Student';
    document.getElementById('s-name').value = s.name;
    document.getElementById('s-phone').value = s.phone || '';
    document.getElementById('s-nic').value = s.nic || '';
    document.getElementById('s-address').value = s.address || '';
    document.getElementById('s-school').value = s.school || '';
    document.getElementById('s-parent-name').value = s.parentName || '';
    document.getElementById('s-parent-phone').value = s.parentPhone || '';
    document.getElementById('s-category').value = s.category;
    
    // Enrollments
    const enrolls = await db.enrollments.where('studentId').equals(s.studentId).toArray();
    document.getElementById('subject-selection-area').innerHTML = '';
    for(let en of enrolls) {
        const rowId = Date.now() + Math.random();
        const area = document.getElementById('subject-selection-area');
        const newRow = document.createElement('div');
        newRow.className = "enroll-row glass-panel p-4 rounded-xl border border-slate-700 bg-slate-800/30 relative fade-in mt-3";
        newRow.innerHTML = `
            <button type="button" onclick="this.parentElement.remove()" class="absolute top-2 right-2 w-6 h-6 bg-red-900/50 text-red-400 rounded hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors"><i class="fa-solid fa-xmark text-xs"></i></button>
            <label class="block text-xs font-semibold text-slate-400 uppercase mb-2">Select Teacher</label>
            <select class="enroll-teacher w-full px-4 py-2.5 rounded-lg text-sm mb-3" required onchange="updateSubjectDropdown(this)">
                <option value="">-- Choose Teacher --</option>
            </select>
            <label class="block text-xs font-semibold text-slate-400 uppercase mb-2">Select Subject</label>
            <select class="enroll-subject w-full px-4 py-2.5 rounded-lg text-sm" required>
                <option value="">-- Choose Subject --</option>
            </select>
        `;
        area.appendChild(newRow);
        
        // Wait for next tick to populate teacher dropdowns and set values
        await populateTeacherDropdowns();
        const tSel = newRow.querySelector('.enroll-teacher');
        tSel.value = en.teacherId;
        await updateSubjectDropdown(tSel);
        newRow.querySelector('.enroll-subject').value = en.subject;
    }
    toggleStudentFields();
}

function closeStudentModal() {
    const modal = document.getElementById('modal-student');
    modal.classList.add('opacity-0');
    document.getElementById('modal-student-content').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('s-name').value = '';
        document.getElementById('s-phone').value = '';
        document.getElementById('s-nic').value = '';
        document.getElementById('s-address').value = '';
        document.getElementById('s-school').value = '';
        document.getElementById('s-parent-name').value = '';
        document.getElementById('s-parent-phone').value = '';
        document.getElementById('s-reg-fee').value = '';
        
        // Reset enrollments area to just 1 row
        const area = document.getElementById('subject-selection-area');
        area.innerHTML = `
            <div class="enroll-row glass-panel p-4 rounded-xl border border-slate-700 bg-slate-800/30">
                <label class="block text-xs font-semibold text-slate-400 uppercase mb-2">Select Teacher</label>
                <select class="enroll-teacher w-full px-4 py-2.5 rounded-lg text-sm mb-3" required onchange="updateSubjectDropdown(this)">
                    <option value="">-- Choose Teacher --</option>
                </select>
                <label class="block text-xs font-semibold text-slate-400 uppercase mb-2">Select Subject</label>
                <select class="enroll-subject w-full px-4 py-2.5 rounded-lg text-sm" required>
                    <option value="">-- Choose Subject --</option>
                </select>
            </div>
        `;
    }, 300);
}

function toggleStudentFields() {
    const cat = document.getElementById('s-category').value;
    const pPhone = document.getElementById('div-phone');
    const pNic = document.getElementById('div-nic');
    const iPhone = document.getElementById('s-phone');
    const iNic = document.getElementById('s-nic');

    if (cat === 'O/L') {
        pPhone.classList.remove('hidden');
        iPhone.required = true;
        pNic.classList.add('hidden');
        iNic.required = false;
        iNic.value = '';
    } else {
        pNic.classList.remove('hidden');
        iNic.required = true;
        pPhone.classList.remove('hidden'); // allow phone too, but NIC is primary
        iPhone.required = false;
    }
    
    populateTeacherDropdowns();
}

async function populateTeacherDropdowns() {
    const cat = document.getElementById('s-category').value;
    
    // Get teachers matching category or 'Both'
    const teachers = await db.teachers.toArray();
    const filtered = teachers.filter(t => t.category === cat || t.category === 'Both');
    
    let options = '<option value="">-- Choose Teacher --</option>';
    filtered.forEach(t => {
        options += `<option value="${t.teacherId}">${t.name} (${t.subjects})</option>`;
    });

    document.querySelectorAll('.enroll-teacher').forEach(select => {
        // Keep current selection if valid
        const currentVal = select.value;
        select.innerHTML = options;
        if(currentVal) select.value = currentVal;
    });
}

async function updateSubjectDropdown(selectEl) {
    const teacherId = selectEl.value;
    const subjectSelect = selectEl.parentElement.querySelector('.enroll-subject');
    
    subjectSelect.innerHTML = '<option value="">-- Choose Subject --</option>';
    if(!teacherId) return;

    const teacher = await db.teachers.where('teacherId').equals(teacherId).first();
    if(teacher) {
        const subs = teacher.subjects.split(',').map(s => s.trim());
        subs.forEach(s => {
            if(s) subjectSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }
}

function addEnrollmentRow() {
    const rowId = Date.now();
    const area = document.getElementById('subject-selection-area');
    const newRow = document.createElement('div');
    newRow.className = "enroll-row glass-panel p-4 rounded-xl border border-slate-700 bg-slate-800/30 relative fade-in mt-3";
    newRow.innerHTML = `
        <button type="button" onclick="this.parentElement.remove()" class="absolute top-2 right-2 w-6 h-6 bg-red-900/50 text-red-400 rounded hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors"><i class="fa-solid fa-xmark text-xs"></i></button>
        <label class="block text-xs font-semibold text-slate-400 uppercase mb-2">Select Teacher</label>
        <select class="enroll-teacher w-full px-4 py-2.5 rounded-lg text-sm mb-3" required onchange="updateSubjectDropdown(this)">
            <option value="">-- Choose Teacher --</option>
        </select>
        <label class="block text-xs font-semibold text-slate-400 uppercase mb-2">Select Subject</label>
        <select class="enroll-subject w-full px-4 py-2.5 rounded-lg text-sm" required>
            <option value="">-- Choose Subject --</option>
        </select>
    `;
    area.appendChild(newRow);
    populateTeacherDropdowns();
}

async function saveStudent(e) {
    e.preventDefault();
    const editId = document.getElementById('student-edit-id').value;
    const category = document.getElementById('s-category').value;
    const name = document.getElementById('s-name').value;
    const phone = document.getElementById('s-phone').value;
    const nic = document.getElementById('s-nic').value;
    const address = document.getElementById('s-address').value;
    const school = document.getElementById('s-school').value;
    const parentName = document.getElementById('s-parent-name').value;
    const parentPhone = document.getElementById('s-parent-phone').value;
    const regFee = parseFloat(document.getElementById('s-reg-fee').value || 0);

    const refId = category === 'O/L' ? phone : nic;

    const enrollRows = document.querySelectorAll('.enroll-row');
    const enrollments = [];
    for(let row of enrollRows) {
        const t = row.querySelector('.enroll-teacher').value;
        const s = row.querySelector('.enroll-subject').value;
        if(t && s) enrollments.push({ teacherId: t, subject: s });
    }

    if(enrollments.length === 0) return alert("Please select at least one teacher and subject.");

    let studentId;
    if (editId) {
        const existing = await db.students.get(parseInt(editId)) || await db.students.get(editId);
        studentId = existing ? existing.studentId : `STU-REPAIR`;
        await db.students.put({ 
            id: editId, studentId, refId, nic, phone, category, name, address, parentName, parentPhone, school 
        });
        // Clear old enrollments and re-add
        const oldEnrolls = await db.enrollments.where('studentId').equals(studentId).toArray();
        for(let oe of oldEnrolls) await db.enrollments.delete(oe.id);
    } else {
        const count = await db.students.count();
        studentId = `STU-${1001 + count}`;
        await db.students.add({
            studentId, refId, nic, phone, category, name, address, parentName, parentPhone, school
        });
    }

    for(let en of enrollments) {
        await db.enrollments.add({
            studentId, teacherId: en.teacherId, subject: en.subject
        });
    }

    if (!editId && regFee > 0) {
        const payCount = await db.payments.count();
        const paymentId = `PAY-${1000 + payCount}`;
        await db.payments.add({
            paymentId, 
            studentId, 
            amount: regFee,
            type: 'Registration',
            date: new Date().toISOString(),
            status: 'Completed'
        });
    }

    closeStudentModal();
    loadStudents();
    if(document.getElementById('nav-dashboard') && document.getElementById('nav-dashboard').classList.contains('active')) loadDashboard();
    
    if(!editId) {
        const qrData = JSON.stringify({ ID: studentId, Name: name, Category: category, Ref: refId });
        showQrModal(name, studentId, qrData);
    }
}

async function deleteStudent(id) {
    if(!id) return alert("Invalid Student ID");

    const s = await db.students.get(parseInt(id)) || await db.students.get(id);
    if(confirm(`Are you sure you want to delete student ${s ? s.name : id} and all their enrollments?`)) {
        try {
            if(s) {
                const enrollments = await db.enrollments.where('studentId').equals(s.studentId).toArray();
                for(let en of enrollments) await db.enrollments.delete(en.id);
            }
            await db.students.delete(parseInt(id));
            await db.students.delete(id);
            showToast("Student Deleted Successfully!");
            loadStudents();
            if(document.getElementById('nav-dashboard') && document.getElementById('nav-dashboard').classList.contains('active')) loadDashboard();
        } catch (err) {
            console.error("Delete failed:", err);
        }
    }
}

// ============== ENROLL EXISTING STUDENT ==============
function openEnrollModal() {
    const modal = document.getElementById('modal-enroll');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('modal-enroll-content').classList.remove('scale-95');
    }, 10);
}

function closeEnrollModal() {
    const modal = document.getElementById('modal-enroll');
    modal.classList.add('opacity-0');
    document.getElementById('modal-enroll-content').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('existing-s-search').value = '';
        document.getElementById('existing-s-details').classList.add('hidden');
        document.getElementById('existing-s-enroll-form').classList.add('hidden');
    }, 300);
}

async function searchExistingStudent() {
    const searchVal = document.getElementById('existing-s-search').value.trim();
    if(!searchVal) return;

    const searchValUpper = searchVal.toUpperCase();
    const searchValPrefixed = /^\d+$/.test(searchVal) ? `STU-${searchVal}` : searchValUpper;

    // Search by refId, phone, nic, or exact/numeric-only studentId
    const student = await db.students.filter(s => 
        s.refId === searchVal || 
        s.phone === searchVal || 
        s.nic.toUpperCase() === searchValUpper || 
        s.studentId.toUpperCase() === searchValUpper ||
        s.studentId.toUpperCase() === searchValPrefixed
    ).first();

    if(student) {
        document.getElementById('existing-s-details').classList.remove('hidden');
        document.getElementById('found-s-name').innerText = student.name;
        document.getElementById('found-s-reg').innerText = `Reg: ${student.studentId}`;
        document.getElementById('found-s-cat').innerText = `Category: ${student.category}`;
        document.getElementById('found-s-id').value = student.studentId;
        document.getElementById('found-s-category').value = student.category;

        // Load teachers
        const teachers = await db.teachers.toArray();
        const filtered = teachers.filter(t => t.category === student.category || t.category === 'Both');
        
        let options = '<option value="">-- Choose Teacher --</option>';
        filtered.forEach(t => {
            options += `<option value="${t.teacherId}">${t.name} (${t.subjects})</option>`;
        });
        document.getElementById('new-enroll-teacher').innerHTML = options;
        document.getElementById('new-enroll-subject').innerHTML = '<option value="">-- Choose Subject --</option>';
        
        document.getElementById('existing-s-enroll-form').classList.remove('hidden');
        document.getElementById('existing-s-enroll-form').classList.add('fade-in');
    } else {
        alert("Student not found.");
        document.getElementById('existing-s-details').classList.add('hidden');
        document.getElementById('existing-s-enroll-form').classList.add('hidden');
    }
}

async function updateNewEnrollSubjectDropdown() {
    const selectEl = document.getElementById('new-enroll-teacher');
    const teacherId = selectEl.value;
    const subjectSelect = document.getElementById('new-enroll-subject');
    
    subjectSelect.innerHTML = '<option value="">-- Choose Subject --</option>';
    if(!teacherId) return;

    const teacher = await db.teachers.where('teacherId').equals(teacherId).first();
    if(teacher) {
        const subs = teacher.subjects.split(',').map(s => s.trim());
        subs.forEach(s => {
            if(s) subjectSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }
}

async function saveNewEnrollment() {
    const studentId = document.getElementById('found-s-id').value;
    const teacherId = document.getElementById('new-enroll-teacher').value;
    const subject = document.getElementById('new-enroll-subject').value;

    if(!teacherId || !subject) {
        alert('Please select teacher and subject');
        return;
    }

    // Check if already enrolled
    const exists = await db.enrollments.where({studentId: studentId, teacherId: teacherId, subject: subject}).first();
    if(exists) {
        alert('Student is already enrolled in this subject under this teacher.');
        return;
    }

    await db.enrollments.add({
        studentId, teacherId, subject
    });

    alert("Successfully enrolled to new subject!");
    closeEnrollModal();
    if(document.getElementById('nav-dashboard').classList.contains('active')) loadDashboard();
}

// ============== QR MODAL ==============
async function viewStudentQR(studentId) {
    const student = await db.students.where('studentId').equals(studentId).first();
    if(student) {
        const qrData = JSON.stringify({ ID: student.studentId, Name: student.name, Category: student.category, Ref: student.refId });
        showQrModal(student.name, student.studentId, qrData);
    }
}

function showQrModal(studentName, regNo, dataStr) {
    const modal = document.getElementById('modal-qr');
    document.getElementById('qr-student-name').innerText = studentName;
    document.getElementById('qr-reg-no').innerText = regNo;

    const qrContainer = document.getElementById('qrcode-container');
    qrContainer.innerHTML = '';
    
    qrCodeInstance = new QRCode(qrContainer, {
        text: dataStr,
        width: 160,
        height: 160,
        colorDark : "#1e1b4b",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('modal-qr-content').classList.remove('scale-95');
    }, 10);
}

function closeQrModal() {
    const modal = document.getElementById('modal-qr');
    modal.classList.add('opacity-0');
    document.getElementById('modal-qr-content').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        if(qrCodeInstance) {
            qrCodeInstance.clear();
        }
    }, 300);
}

function printStudentCard() {
    const printWindow = window.open('', '_blank');
    const regNo = document.getElementById('qr-reg-no').innerText;
    const name = document.getElementById('qr-student-name').innerText;
    const qrImage = document.getElementById('qrcode-container').querySelector('img').src;

    printWindow.document.write(`
        <html>
        <head>
            <title>Print ID Card</title>
            <style>
                body { font-family: 'Arial', sans-serif; display: flex; justify-content: center; padding: 20px; background: #fff;}
                .card { width: 300px; border: 2px solid #1e1b4b; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                .header { background: #1e1b4b; color: white; margin: -20px -20px 20px -20px; padding: 15px; border-radius: 10px 10px 0 0; font-weight: bold; font-size: 18px;}
                .name { font-size: 18px; font-weight: bold; margin-bottom: 5px; color: #1e1b4b;}
                .reg { font-size: 14px; color: #666; margin-bottom: 15px; }
                img { width: 150px; height: 150px; margin-bottom: 15px; border: 5px solid #f1f5f9; border-radius: 10px;}
                .footer { font-size: 12px; color: #999; border-top: 1px dashed #ccc; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">EduCore Student ID</div>
                <div class="name">${name}</div>
                <div class="reg">ID: ${regNo}</div>
                <img src="${qrImage}" />
                <div class="footer">Please present this QR code during classes.</div>
            </div>
            <script>
                window.onload = function() { window.print(); window.close(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ============== DOWNLOAD QR ==============
function downloadQR() {
    const qrImage = document.getElementById('qrcode-container').querySelector('img');
    if (!qrImage) {
        alert("QR Code not fully generated yet. Try again.");
        return;
    }
    const studentName = document.getElementById('qr-student-name').innerText;
    const a = document.createElement('a');
    a.href = qrImage.src;
    a.download = `QR_${studentName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ============== PAYMENTS ==============
async function searchPaymentStudent(forceScanStr = null) {
    let searchVal = forceScanStr || document.getElementById('pay-scan-input').value.trim();
    if(!searchVal) return;

    // Check if it's JSON from QR code scanner
    if (searchVal.startsWith('{') && searchVal.endsWith('}')) {
        try {
            const data = JSON.parse(searchVal);
            if (data.ID) searchVal = data.ID;
        } catch(e) {}
    }

    const searchValUpper = searchVal.toUpperCase();
    const searchValPrefixed = /^\d+$/.test(searchVal) ? `STU-${searchVal}` : searchValUpper;

    const student = await db.students.filter(s => 
        s.refId === searchVal || 
        s.phone === searchVal || 
        s.nic.toUpperCase() === searchValUpper || 
        s.studentId.toUpperCase() === searchValUpper ||
        s.studentId.toUpperCase() === searchValPrefixed
    ).first();
    
    if(student) {
        document.getElementById('payment-student-info').classList.remove('hidden');
        document.getElementById('payment-student-info').classList.add('fade-in');
        document.getElementById('pay-student-name').innerText = student.name;
        document.getElementById('pay-student-id').innerText = student.studentId;
        document.getElementById('pay-student-cat').innerText = student.category;

        // Load Enrollments for this student
        const enrollments = await db.enrollments.where('studentId').equals(student.studentId).toArray();
        const selectEl = document.getElementById('pay-enrollment');
        selectEl.innerHTML = '<option value="">-- Choose Subject / Teacher --</option>';

        for(let en of enrollments) {
            const teacher = await db.teachers.where('teacherId').equals(en.teacherId).first();
            const tName = teacher ? teacher.name : 'Unknown';
            
            // Check for arrears
            const balance = await calculateBalance(student.studentId, en.teacherId, en.subject);
            const balText = balance > 0 ? ` (Balance: LKR ${balance.toFixed(2)})` : '';
            
            selectEl.innerHTML += `<option value="${en.teacherId}|${en.subject}" data-balance="${balance}">${en.subject} (by ${tName})${balText}</option>`;
        }
        
        document.getElementById('pay-amount').value = '';
        document.getElementById('pay-scan-input').value = '';

        // Auto-select and show balance if only one enrollment
        if (enrollments.length === 1) {
            selectEl.selectedIndex = 1;
            const balance = selectEl.options[1].getAttribute('data-balance');
            if (parseFloat(balance) > 0) {
                document.getElementById('pay-amount').value = balance;
            }
        }

    } else {
        alert("Student not found.");
        document.getElementById('payment-student-info').classList.add('hidden');
    }
}

async function calculateBalance(studentId, teacherId, subject) {
    // Use filter() — works with the MongoDB API layer
    const allAtt = await db.attendance.filter(
        a => a.studentId === studentId && a.teacherId === teacherId && a.subject === subject
    ).toArray();
    if (allAtt.length === 0) return 0;
    
    // Pre-fetch all schedules for this teacher+subject
    const allScheds = await db.schedules.filter(
        s => s.teacherId === teacherId && s.subject === subject
    ).toArray();
    const schedMap = new Map(allScheds.map(s => [s.month, s]));
    
    // Pre-fetch all payments for this student+teacher+subject
    const allPayments = await db.payments.filter(
        p => p.studentId === studentId && p.teacherId === teacherId && p.subject === subject
    ).toArray();
    
    let totalDue = 0;
    
    for (const att of allAtt) {
        const sched = schedMap.get(att.month);
        const fee = sched ? parseFloat(sched.monthlyFee || 0) : 0;
        
        if (fee > 0) {
            let attendedAny = att.sessions ? att.sessions.length > 0 : Object.keys(att).some(k => k.startsWith('sess_') && att[k] === 1);

            if (attendedAny) {
                const totalPaidForMonth = allPayments
                    .filter(p => p.date.startsWith(att.month) && (p.type === 'MonthlyFee' || p.type === 'Advance'))
                    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
                
                if (totalPaidForMonth < fee) {
                    totalDue += (fee - totalPaidForMonth);
                }
            }
        }
    }
    return totalDue;
}

async function loadPaymentStudentStatus() {
    const search = document.getElementById('pay-status-search').value.toLowerCase();
    const tbody = document.getElementById('payment-status-list');
    if (!tbody) return;

    const currentMonth = new Date().toISOString().substring(0, 7);
    
    // Optimize: Get all data once
    const [students, allEnrollments, allPayments] = await Promise.all([
        db.students.toArray(),
        db.enrollments.toArray(),
        db.payments.filter(p => p.date.startsWith(currentMonth) && (p.type === 'MonthlyFee' || p.type === 'Advance')).toArray()
    ]);

    let html = '';
    for (const student of students) {
        if (search && !student.name.toLowerCase().includes(search) && !student.studentId.toLowerCase().includes(search)) continue;
        
        const enrollments = allEnrollments.filter(en => en.studentId === student.studentId);
        for (const en of enrollments) {
            const hasPaid = allPayments.some(p => p.studentId === student.studentId && p.teacherId === en.teacherId && p.subject === en.subject);
            
            const statusLabel = hasPaid 
                ? '<span class="px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 text-[10px] font-bold">PAID</span>'
                : '<span class="px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 text-[10px] font-bold">NOT PAID</span>';

            html += `
                <tr class="hover:bg-emerald-950/30">
                    <td class="py-2.5">
                        <p class="text-white font-bold text-xs">${student.name}</p>
                        <p class="text-[9px] text-emerald-500/50 font-mono">${student.studentId}</p>
                    </td>
                    <td class="py-2.5 text-xs text-emerald-200/70">${en.subject}</td>
                    <td class="py-2.5 text-center">${statusLabel}</td>
                </tr>
            `;
        }
    }
    tbody.innerHTML = html;
}

function handlePaymentScan(e) {
    if(e.key === 'Enter') {
        searchPaymentStudent();
    }
}

async function processPayment() {
    const studentId = document.getElementById('pay-student-id').innerText;
    const enrollVal = document.getElementById('pay-enrollment').value;
    const amount = document.getElementById('pay-amount').value;
    const type = document.getElementById('pay-type').value;

    if(!enrollVal || !amount) {
        alert("Please select an enrollment and enter an amount.");
        return;
    }

    const [teacherId, subject] = enrollVal.split('|');

    const count = await db.payments.count();
    const paymentId = `PAY-${1000 + count}`;
    const date = new Date().toISOString();

    await db.payments.add({
        paymentId, studentId, teacherId, subject, amount: parseFloat(amount), type, date
    });

    alert(`Payment Successful!\\n\\nReceipt: ${paymentId}\\nAmount: LKR ${amount}\\nType: ${type}\\nSubject: ${subject}`);
    
    document.getElementById('payment-student-info').classList.add('hidden');
    document.getElementById('pay-scan-input').focus();
    loadRecentPayments();
    loadPaymentStudentStatus();
}

function updatePaymentAmount() {
    const selectEl = document.getElementById('pay-enrollment');
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    if (selectedOption && selectedOption.dataset.balance) {
        document.getElementById('pay-amount').value = selectedOption.dataset.balance;
    } else {
        document.getElementById('pay-amount').value = '';
    }
}

async function loadRecentPayments() {
    const list = document.getElementById('recent-payments-list');
    const msg = document.getElementById('no-payments-msg');
    
    // Get all payments, sort descending, limit to 15
    const payments = await db.payments.reverse().limit(15).toArray();
    
    if(payments.length === 0) {
        msg.classList.remove('hidden');
        list.innerHTML = '';
    } else {
        msg.classList.add('hidden');
        // Pre-fetch students
        const sIds = [...new Set(payments.map(p => p.studentId))];
        const students = await db.students.filter(s => sIds.includes(s.studentId)).toArray();
        const sMap = new Map(students.map(s => [s.studentId, s]));

        let html = '';
        for(let p of payments) {
            const student = sMap.get(p.studentId);
            const sName = student ? student.name : p.studentId;
            const d = new Date(p.date).toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'});
            
            html += `
                <tr class="hover:bg-slate-800/50 transition-colors">
                    <td class="p-3 font-mono text-emerald-400 font-bold">${p.paymentId}</td>
                    <td class="p-3 text-white font-medium">${sName}</td>
                    <td class="p-3 text-slate-300">
                        ${p.subject} <br>
                        <span class="text-[10px] uppercase text-indigo-400 font-bold bg-indigo-900/30 px-2 py-0.5 rounded">${p.type}</span>
                    </td>
                    <td class="p-3 text-emerald-400 font-bold">LKR ${parseFloat(p.amount).toFixed(2)}</td>
                    <td class="p-3 text-slate-400 text-xs">${d}</td>
                </tr>
            `;
        }
        list.innerHTML = html;
    }
}

// ============== SCHEDULES ==============
let currentAttMonth = new Date().toISOString().substring(0, 7);

async function loadScheduleTeachers() {
    const teachers = await db.teachers.toArray();
    const sel = document.getElementById('sch-teacher');
    sel.innerHTML = '<option value="">-- Choose Teacher --</option>';
    teachers.forEach(t => {
        sel.innerHTML += `<option value="${t.teacherId}">${t.name}</option>`;
    });
}

async function loadScheduleSubjects() {
    const teacherId = document.getElementById('sch-teacher').value;
    const sel = document.getElementById('sch-subject');
    sel.innerHTML = '<option value="">-- Choose Subject --</option>';
    if(!teacherId) return;
    
    const t = await db.teachers.where('teacherId').equals(teacherId).first();
    if(t && t.subjects) {
        const subs = t.subjects.split(',').map(s => s.trim());
        subs.forEach(s => {
            sel.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }
}

async function loadScheduleDates() {
    const teacherId = document.getElementById('sch-teacher').value;
    const subject = document.getElementById('sch-subject').value;
    const month = currentAttMonth;
    document.getElementById('sch-top-month-display').innerText = month;
    
    const datesArea = document.getElementById('sch-dates-area');
    const sessionsList = document.getElementById('sch-sessions-list');
    
    if(!teacherId || !subject) {
        datesArea.classList.add('hidden');
        return;
    }
    
    datesArea.classList.remove('hidden');
    document.getElementById('sch-fee-container').classList.remove('hidden');
    
    let sched = await db.schedules.where('[teacherId+subject+month]').equals([teacherId, subject, month]).first();
    
    if (sched && sched.monthlyFee) {
        document.getElementById('sch-monthly-fee').value = sched.monthlyFee;
    } else {
        document.getElementById('sch-monthly-fee').value = '';
    }
    
    sessionsList.innerHTML = '';
    if(!sched || !sched.sessions || sched.sessions.length === 0) {
        sessionsList.innerHTML = '<p class="text-emerald-500/60 text-sm italic">No sessions scheduled for this month yet.</p>';
    } else {
        // Sort sessions by date and time
        sched.sessions.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        
        sched.sessions.forEach((sess, idx) => {
            sessionsList.innerHTML += `
                <div class="flex justify-between items-center bg-black p-4 rounded-xl border border-emerald-900/50">
                    <div>
                        <span class="text-emerald-400 font-bold uppercase text-xs mr-2 border border-emerald-500/30 px-2 py-1 rounded bg-emerald-900/30">${sess.type}</span>
                        <span class="text-white text-sm font-semibold">${sess.date} @ ${sess.time}</span>
                    </div>
                </div>
            `;
        });
    }
}

async function addScheduleSession() {
    const teacherId = document.getElementById('sch-teacher').value;
    const subject = document.getElementById('sch-subject').value;
    const month = currentAttMonth;
    
    const date = document.getElementById('new-sch-date').value;
    const time = document.getElementById('new-sch-time').value;
    const type = document.getElementById('new-sch-type').value;

    if(!teacherId || !subject || !date || !time || !type) {
        alert("Please fill all session details.");
        return;
    }

    let sched = await db.schedules.filter(
        s => s.teacherId === teacherId && s.subject === subject && s.month === month
    ).first();
    const newSession = {
        id: 'sess_' + Date.now() + Math.floor(Math.random()*1000),
        date: date,
        time: time,
        type: type
    };

    if(sched) {
        if(!sched.sessions) sched.sessions = [];
        sched.sessions.push(newSession);
        await db.schedules.update(sched.id, { sessions: sched.sessions });
    } else {
        await db.schedules.add({
            teacherId, subject, month,
            sessions: [newSession]
        });
    }

    document.getElementById('new-sch-date').value = '';
    document.getElementById('new-sch-time').value = '';
    loadScheduleDates();
}

async function updateMonthlyFee() {
    const teacherId = document.getElementById('sch-teacher').value;
    const subject = document.getElementById('sch-subject').value;
    const month = currentAttMonth;
    const fee = document.getElementById('sch-monthly-fee').value;

    if (!fee) {
        alert("Please enter a fee.");
        return;
    }

    let sched = await db.schedules.where('[teacherId+subject+month]').equals([teacherId, subject, month]).first();
    if (sched) {
        await db.schedules.update(sched.id, { monthlyFee: fee });
    } else {
        await db.schedules.add({
            teacherId, subject, month,
            monthlyFee: fee,
            sessions: []
        });
    }
    
    showToast("Monthly fee updated successfully!", "success");
}

// ============== ACTIVE CLASSES & ATTENDANCE ==============
let activeClassSession = null;

async function loadActiveClasses() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Week boundaries (Monday to Sunday)
    const curr = new Date();
    const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1); 
    const firstday = new Date(curr.setDate(first));
    const lastday = new Date(curr.setDate(firstday.getDate() + 6));
    
    const startOfWeek = firstday.toISOString().split('T')[0];
    const endOfWeek = lastday.toISOString().split('T')[0];
    
    const currentMonth = todayStr.substring(0, 7);

    const displayDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('att-top-date-display').innerText = displayDate;

    // Reset UI
    document.getElementById('att-scanner-container').classList.add('hidden');
    document.getElementById('active-classes-categories').classList.remove('hidden');
    document.getElementById('attendance-student-info').classList.add('hidden');
    activeClassSession = null;

    const sections = {
        today: { el: document.getElementById('active-classes-today'), count: 0, html: '' },
        tomorrow: { el: document.getElementById('active-classes-tomorrow'), count: 0, html: '' },
        week: { el: document.getElementById('active-classes-week'), count: 0, html: '' },
        month: { el: document.getElementById('active-classes-month'), count: 0, html: '' }
    };

    const [allScheds, allTeachers, allAttendance] = await Promise.all([
        db.schedules.toArray(),
        db.teachers.toArray(),
        db.attendance.toArray()
    ]);
    const teacherMap = new Map(allTeachers.map(t => [t.teacherId, t]));

    for (const sched of allScheds) {
        if (!sched.sessions) continue;
        const t = teacherMap.get(sched.teacherId);
        const tName = t ? t.name : sched.teacherId;

        for (const sess of sched.sessions) {
            if (sess.date < todayStr) continue;
            
            let targetSection = null;
            if (sess.date === todayStr) targetSection = sections.today;
            else if (sess.date === tomorrowStr) targetSection = sections.tomorrow;
            else if (sess.date >= startOfWeek && sess.date <= endOfWeek) targetSection = sections.week;
            else if (sess.date.startsWith(currentMonth)) targetSection = sections.month;

            if (targetSection) {
                targetSection.count++;
                const attendedCount = allAttendance.filter(a => a.teacherId === sched.teacherId && a.subject === sched.subject && a[sess.id] === 1).length;

                const typeColors = {
                    'Theory':   { bg: 'bg-emerald-400',  text: 'text-emerald-900', border: 'border-emerald-500/60' },
                    'Revision': { bg: 'bg-blue-400',     text: 'text-blue-900',    border: 'border-blue-500/60'    },
                    'Paper':    { bg: 'bg-orange-400',   text: 'text-orange-900',  border: 'border-orange-500/60'  }
                };
                const tCls = typeColors[sess.type] || typeColors['Theory'];

                targetSection.html += `
                    <div
                        class="relative glass-panel rounded-2xl border-2 ${tCls.border} hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all cursor-pointer group p-5 flex flex-col gap-3"
                        onclick="startActiveSession('${sched.teacherId}', '${sched.subject}', '${sess.id}', '${sess.type}', '${tName}', '${sess.time}')"
                    >
                        <div class="flex justify-between items-start">
                            <span class="text-[9px] font-black uppercase ${tCls.bg} ${tCls.text} px-2.5 py-1 rounded-full tracking-wider">${sess.type}</span>
                            <span class="text-[9px] text-emerald-500/60 font-semibold">${attendedCount} Joined</span>
                        </div>
                        <h4 class="text-white font-extrabold text-sm leading-tight group-hover:text-emerald-300 transition-colors">${sched.subject}</h4>
                        <p class="text-emerald-500/70 text-[10px] font-semibold flex items-center gap-1.5"><i class="fa-solid fa-chalkboard-user"></i> ${tName}</p>
                        <div class="flex items-center justify-between mt-1">
                            <div class="flex items-center gap-2 text-emerald-300 font-mono text-xs"><i class="fa-regular fa-calendar text-emerald-500"></i> ${sess.date === todayStr ? 'Today' : sess.date}</div>
                            <div class="flex items-center gap-2 text-emerald-300 font-mono text-xs"><i class="fa-regular fa-clock text-emerald-500"></i> ${sess.time}</div>
                        </div>
                        <button class="mt-2 w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-all">Scan Attendance</button>
                    </div>`;
            }
        }
    }

    // Update sections
    Object.entries(sections).forEach(([key, s]) => {
        s.el.innerHTML = s.html || `
                <div class="col-span-full py-6 px-4 border border-dashed border-emerald-900/30 rounded-2xl text-center">
                    <p class="text-[10px] text-emerald-900 font-bold uppercase tracking-widest">No classes scheduled</p>
                </div>`;
    });
}

function startActiveSession(teacherId, subject, sessionId, sessionType, teacherName, sessionTime) {
    activeClassSession = { teacherId, subject, sessionId, month: currentAttMonth };

    // Hide cards, show scanner panel
    document.getElementById('active-classes-categories').classList.add('hidden');
    document.getElementById('att-scanner-container').classList.remove('hidden');
    document.getElementById('scanner-session-title').innerText = `${subject} — ${teacherName}`;
    document.getElementById('scanner-session-type').innerText = sessionType;
    document.getElementById('scanner-time-display').innerText = sessionTime || '';
    document.getElementById('attendance-student-info').classList.add('hidden');

    loadJoinedList(teacherId, subject, sessionId);

    const scanInput = document.getElementById('att-scan-input');
    scanInput.value = '';
    scanInput.focus();
}

async function loadJoinedList(teacherId, subject, sessionId) {
    const listEl = document.getElementById('att-joined-list');
    listEl.innerHTML = '';

    const records = await db.attendance.filter(
        a => a.teacherId === teacherId && a.subject === subject && a[sessionId] === 1
    ).toArray();

    if (records.length === 0) {
        listEl.innerHTML = '<p class="text-emerald-800 text-xs italic">No students have joined yet.</p>';
        return;
    }

    for (const rec of records) {
        const student = await db.students.where('studentId').equals(rec.studentId).first();
        const name = student ? student.name : rec.studentId;
        listEl.innerHTML += `
            <div class="flex items-center justify-between bg-emerald-950/60 border border-emerald-900/40 px-4 py-2 rounded-xl">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <span class="text-white text-xs font-semibold">${name}</span>
                </div>
                <span class="text-emerald-600 font-mono text-[10px]">${rec.studentId}</span>
            </div>`;
    }
}

function closeActiveSession() {
    activeClassSession = null;
    document.getElementById('active-classes-categories').classList.remove('hidden');
    document.getElementById('att-scanner-container').classList.add('hidden');
}

async function searchAttendanceStudent(forceScanStr = null) {
    if (!activeClassSession) return;
    const { teacherId, subject, sessionId, month } = activeClassSession;

    let searchVal = forceScanStr || document.getElementById('att-scan-input').value.trim();
    if (!searchVal) return;

    // Parse QR JSON
    if (searchVal.startsWith('{') && searchVal.endsWith('}')) {
        try { const d = JSON.parse(searchVal); if (d.ID) searchVal = d.ID; } catch(e) {}
    }

    const searchValUpper = searchVal.toUpperCase();
    const searchValPrefixed = /^\d+$/.test(searchVal) ? `STU-${searchVal}` : searchValUpper;

    const student = await db.students.filter(s =>
        s.refId === searchVal ||
        s.phone === searchVal ||
        s.nic.toUpperCase() === searchValUpper ||
        s.studentId.toUpperCase() === searchValUpper ||
        s.studentId.toUpperCase() === searchValPrefixed
    ).first();

    if (!student) {
        showToast('Student not found.', 'error');
        document.getElementById('att-scan-input').value = '';
        return;
    }

    // Check enrollment
    const en = await db.enrollments.filter(
        e => e.studentId === student.studentId && e.teacherId === teacherId && e.subject === subject
    ).first();
    if (!en) {
        showToast(`${student.name} is NOT enrolled in ${subject}.`, 'error');
        document.getElementById('att-scan-input').value = '';
        return;
    }

    // — AUTO MARK ATTENDANCE —
    let attRecord = await db.attendance.filter(
        a => a.studentId === student.studentId && a.teacherId === teacherId && a.subject === subject && a.month === month
    ).first();

    const alreadyMarked = attRecord && attRecord[sessionId] === 1;

    if (!alreadyMarked) {
        // — CHECK PAYMENT —
        const pays = await db.payments.where('studentId').equals(student.studentId)
            .and(p => p.teacherId === teacherId && p.subject === subject && p.date.startsWith(month) && (p.type === 'MonthlyFee' || p.type === 'Advance'))
            .toArray();
        
        if (pays.length === 0) {
            const balance = await calculateBalance(student.studentId, teacherId, subject);
            showAttWarning(student.name, balance, async (proceed) => {
                if (proceed) {
                    await finalizeAttendance(student, teacherId, subject, sessionId, month, alreadyMarked);
                }
            });
            document.getElementById('att-scan-input').value = '';
            return;
        }
    }

    await finalizeAttendance(student, teacherId, subject, sessionId, month, alreadyMarked);
}

async function finalizeAttendance(student, teacherId, subject, sessionId, month, alreadyMarked) {
    let attRecord = await db.attendance.filter(
        a => a.studentId === student.studentId && a.teacherId === teacherId && a.subject === subject && a.month === month
    ).first();

    if (!alreadyMarked) {
        if (!attRecord) {
            await db.attendance.add({ studentId: student.studentId, teacherId, subject, month });
            attRecord = await db.attendance.filter(
                a => a.studentId === student.studentId && a.teacherId === teacherId && a.subject === subject && a.month === month
            ).first();
        }
        attRecord[sessionId] = 1;
        await db.attendance.put(attRecord);
    }

    // Show joined card
    document.getElementById('att-student-name').innerText = student.name;
    document.getElementById('att-student-id').innerText = student.studentId;
    document.getElementById('att-student-cat').innerText  = student.category;
    const infoEl = document.getElementById('attendance-student-info');
    infoEl.classList.remove('hidden');
    infoEl.classList.add('fade-in');

    if (alreadyMarked) {
        showToast(`${student.name} already joined this class.`, 'warn');
    } else {
        showToast(`${student.name} joined & marked present!`, 'success');
    }

    document.getElementById('att-scan-input').value = '';

    // Refresh joined list
    await loadJoinedList(teacherId, subject, sessionId);

    // Auto-hide student info after 3 seconds
    setTimeout(() => {
        infoEl.classList.add('hidden');
        document.getElementById('att-scan-input').focus();
    }, 2500);
}

let attWarningCallback = null;

function showAttWarning(name, balance, callback) {
    attWarningCallback = callback;
    document.getElementById('att-warning-balance').innerText = `LKR ${balance.toFixed(2)}`;
    const modal = document.getElementById('modal-att-warning');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('modal-att-warning-content').classList.remove('scale-95');
    }, 10);
}

function closeAttWarning(proceed) {
    const modal = document.getElementById('modal-att-warning');
    modal.classList.add('opacity-0');
    document.getElementById('modal-att-warning-content').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        if (attWarningCallback) attWarningCallback(proceed);
        attWarningCallback = null;
    }, 300);
}

function handleAttendanceScan(e) {
    if (e.key === 'Enter') searchAttendanceStudent();
}

// ============== ATTENDANCE VIEW ==============
async function loadAttendanceView() {
    document.getElementById('att-view-search').value = '';
    await renderAttendanceList('');
}

async function searchAttendanceView() {
    const query = document.getElementById('att-view-search').value.trim().toLowerCase();
    await renderAttendanceList(query);
}

async function renderAttendanceList(search) {
    const container = document.getElementById('attendance-students-list');
    container.innerHTML = '<p class="text-emerald-700 text-xs text-center py-6">Loading...</p>';

    let students = await db.students.toArray();
    if (search) {
        students = students.filter(s =>
            s.name.toLowerCase().includes(search) ||
            s.studentId.toLowerCase().includes(search) ||
            (s.phone && s.phone.includes(search)) ||
            (s.nic && s.nic.toLowerCase().includes(search))
        );
    }

    if (students.length === 0) {
        container.innerHTML = '<p class="text-emerald-700 text-sm italic text-center py-8">No students found.</p>';
        return;
    }

    // Pre-fetch all data needed for the list to avoid repeated DB calls inside the loop
    const [allEnrollments, allTeachers, allSchedules, allAttendance] = await Promise.all([
        db.enrollments.toArray(),
        db.teachers.toArray(),
        db.schedules.toArray(),
        db.attendance.toArray()
    ]);
    const teacherMap = new Map(allTeachers.map(t => [t.teacherId, t]));

    let mainHtml = '';
    for (const student of students) {
        const enrollments = allEnrollments.filter(en => en.studentId === student.studentId);
        if (enrollments.length === 0) continue;

        let subjectCards = '';
        for (const enr of enrollments) {
            const teacher = teacherMap.get(enr.teacherId);
            const tName = teacher ? teacher.name : enr.teacherId;

            const scheds = allSchedules.filter(s => s.teacherId === enr.teacherId && s.subject === enr.subject);
            let allSessions = [];
            scheds.forEach(sr => { if (sr.sessions) allSessions.push(...sr.sessions); });
            allSessions.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

            if (allSessions.length === 0) continue;

            const attRecords = allAttendance.filter(a => a.studentId === student.studentId && a.teacherId === enr.teacherId && a.subject === enr.subject);
            const attMap = {};
            attRecords.forEach(ar => { Object.keys(ar).forEach(k => { if (k.startsWith('sess_')) attMap[k] = ar[k]; }); });

            let presentCount = 0;
            let circles = '';
            allSessions.forEach((sess, idx) => {
                const isPresent = attMap[sess.id] === 1;
                if (isPresent) presentCount++;
                const label = sess.type.substring(0, 1).toUpperCase() + (idx + 1);
                circles += `
                    <div class="flex flex-col items-center gap-1" title="${sess.date} ${sess.type}">
                        <div class="w-9 h-9 rounded-full ${isPresent ? 'bg-emerald-500 border-emerald-400' : 'bg-red-500/80 border-red-400'} border-2 flex items-center justify-center">
                            <i class="fa-solid ${isPresent ? 'fa-check' : 'fa-xmark'} text-white text-[8px]"></i>
                        </div>
                        <span class="text-[8px] ${isPresent ? 'text-emerald-400' : 'text-red-400'} font-bold">${label}</span>
                    </div>`;
            });

            const total = allSessions.length;
            const perc = total > 0 ? presentCount / total : 0;
            const statusHtml = total === 0 ? '<span class="text-emerald-800 text-[9px]">No Schedule</span>' :
                perc >= 1 ? '<span class="bg-emerald-400 text-emerald-900 text-[9px] font-black px-2 py-0.5 rounded-full">Outstanding</span>' :
                perc >= 0.75 ? '<span class="bg-emerald-600/80 text-white text-[9px] font-black px-2 py-0.5 rounded-full">Good</span>' :
                perc >= 0.5 ? '<span class="bg-yellow-500/80 text-yellow-900 text-[9px] font-black px-2 py-0.5 rounded-full">Average</span>' :
                '<span class="bg-red-500/80 text-white text-[9px] font-black px-2 py-0.5 rounded-full">Weak</span>';

            subjectCards += `
                <div class="bg-black/40 border border-emerald-900/40 rounded-xl p-4">
                    <div class="flex justify-between items-center mb-3">
                        <div><p class="text-white text-xs font-bold">${enr.subject}</p><p class="text-emerald-600 text-[10px]">${tName}</p></div>
                        <div class="flex items-center gap-2">${statusHtml}<span class="text-emerald-600 text-[10px] font-mono">${presentCount}/${total}</span></div>
                    </div>
                    <div class="flex flex-wrap gap-2">${circles}</div>
                </div>`;
        }

        if (subjectCards) {
            mainHtml += `
                <div class="glass-panel rounded-2xl border border-emerald-900/40 overflow-hidden">
                    <div class="flex items-center justify-between px-5 py-4 border-b border-emerald-900/40">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-teal-900 flex items-center justify-center text-white font-bold text-sm">${student.name.charAt(0).toUpperCase()}</div>
                            <div><p class="text-white font-bold text-sm">${student.name}</p><p class="text-emerald-600 font-mono text-[10px]">${student.studentId}</p></div>
                        </div>
                        <span class="text-[10px] font-bold border border-emerald-900/50 text-emerald-400 px-2 py-1 rounded-lg">${student.category}</span>
                    </div>
                    <div class="p-4 space-y-3">${subjectCards}</div>
                </div>`;
        }
    }
    container.innerHTML = mainHtml || '<p class="text-emerald-700 text-sm italic text-center py-8">No attendance data available yet.</p>';
}

// ============== TOAST NOTIFICATION ==============
function showToast(message, type = 'success') {
    const existing = document.getElementById('toast-notification');
    if (existing) existing.remove();

    const colors = {
        success: 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200',
        error:   'bg-red-900/90 border-red-500/50 text-red-200',
        warn:    'bg-amber-900/90 border-amber-500/50 text-amber-200'
    };
    const icons = {
        success: 'fa-circle-check text-emerald-400',
        error:   'fa-circle-xmark text-red-400',
        warn:    'fa-triangle-exclamation text-amber-400'
    };

    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = `fixed bottom-6 right-6 z-[999] flex items-center gap-3 px-5 py-4 rounded-2xl border ${colors[type]} backdrop-blur-xl shadow-2xl text-sm font-semibold transition-all duration-500`;
    toast.style.transform = 'translateY(100px)';
    toast.style.opacity = '0';
    toast.innerHTML = `<i class="fa-solid ${icons[type]} text-lg"></i><span>${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 2800);
}

