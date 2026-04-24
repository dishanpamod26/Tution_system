// api/attendance.js — Attendance CRUD
const { getDb, setCors } = require('./_db');
const { ObjectId } = require('mongodb');

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = await getDb();
        const col = db.collection('attendance');

        // GET — filter
        if (req.method === 'GET') {
            const { studentId, teacherId, subject, month } = req.query;
            const filter = {};
            if (studentId) filter.studentId = studentId;
            if (teacherId) filter.teacherId = teacherId;
            if (subject) filter.subject = subject;
            if (month) filter.month = month;
            const data = await col.find(filter).toArray();
            return res.status(200).json(data);
        }

        // POST — create attendance record
        if (req.method === 'POST') {
            const body = req.body;
            const result = await col.insertOne(body);
            return res.status(201).json({ ...body, _id: result.insertedId });
        }

        // PUT — update attendance record (mark session)
        if (req.method === 'PUT') {
            const { _id, ...body } = req.body;
            if (!_id) return res.status(400).json({ error: '_id required' });
            await col.updateOne({ _id: new ObjectId(_id) }, { $set: body });
            return res.status(200).json({ success: true });
        }

        // DELETE — by _id
        if (req.method === 'DELETE') {
            const id = req.query.id;
            if (!id) return res.status(400).json({ error: 'id required' });
            await col.deleteOne({ _id: new ObjectId(id) });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        console.error('Attendance API Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
