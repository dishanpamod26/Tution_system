// api/schedules.js — Schedules CRUD
const { getDb, setCors } = require('./_db');
const { ObjectId } = require('mongodb');

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = await getDb();
        const col = db.collection('schedules');

        // GET — filter by teacherId/subject/month
        if (req.method === 'GET') {
            const { teacherId, subject, month } = req.query;
            const filter = {};
            if (teacherId) filter.teacherId = teacherId;
            if (subject) filter.subject = subject;
            if (month) filter.month = month;
            const data = await col.find(filter).toArray();
            return res.status(200).json(data);
        }

        // POST — create schedule
        if (req.method === 'POST') {
            const body = req.body;
            if (!body.sessions) body.sessions = [];
            const result = await col.insertOne(body);
            return res.status(201).json({ ...body, _id: result.insertedId });
        }

        // PUT — update schedule (add session / update fee)
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
        console.error('Schedules API Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
