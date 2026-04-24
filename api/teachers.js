// api/teachers.js — Teachers CRUD
const { getDb, setCors } = require('./_db');
const { ObjectId } = require('mongodb');

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = await getDb();
        const col = db.collection('teachers');

        // GET — all teachers or filter by teacherId
        if (req.method === 'GET') {
            const { teacherId, category } = req.query;
            const filter = {};
            if (teacherId) filter.teacherId = teacherId;
            if (category) filter.category = { $in: [category, 'Both'] };
            const teachers = await col.find(filter).toArray();
            return res.status(200).json(teachers);
        }

        // POST — add new teacher
        if (req.method === 'POST') {
            const body = req.body;
            const result = await col.insertOne(body);
            return res.status(201).json({ ...body, _id: result.insertedId });
        }

        // PUT — update teacher by _id
        if (req.method === 'PUT') {
            const { _id, ...body } = req.body;
            if (!_id) return res.status(400).json({ error: '_id required' });
            await col.updateOne({ _id: new ObjectId(_id) }, { $set: body });
            return res.status(200).json({ success: true });
        }

        // DELETE — delete teacher by _id
        if (req.method === 'DELETE') {
            const id = req.query.id;
            if (!id) return res.status(400).json({ error: 'id required' });
            await col.deleteOne({ _id: new ObjectId(id) });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        console.error('Teachers API Error:', e);
        // Return detailed error for debugging
        return res.status(500).json({ 
            error: e.message, 
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined,
            hint: "Check MONGODB_URI and IP Whitelist in Atlas"
        });
    }
};
