// api/enrollments.js — Enrollments CRUD
const { getDb, setCors } = require('./_db');
const { ObjectId } = require('mongodb');

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = await getDb();
        const col = db.collection('enrollments');

        // GET — filter by studentId or teacherId
        if (req.method === 'GET') {
            const { studentId, teacherId, subject } = req.query;
            const filter = {};
            if (studentId) filter.studentId = studentId;
            if (teacherId) filter.teacherId = teacherId;
            if (subject) filter.subject = subject;
            const data = await col.find(filter).toArray();
            return res.status(200).json(data);
        }

        // POST — add enrollment
        if (req.method === 'POST') {
            const body = req.body;
            // Check duplicate
            const exists = await col.findOne({
                studentId: body.studentId,
                teacherId: body.teacherId,
                subject: body.subject
            });
            if (exists) return res.status(409).json({ error: 'Already enrolled' });
            const result = await col.insertOne(body);
            return res.status(201).json({ ...body, _id: result.insertedId });
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
        console.error('Enrollments API Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
