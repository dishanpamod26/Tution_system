// api/students.js — Students CRUD
const { getDb, setCors } = require('./_db');
const { ObjectId } = require('mongodb');

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = await getDb();
        const col = db.collection('students');

        // GET — all students or search
        if (req.method === 'GET') {
            const { studentId, category, search } = req.query;
            const filter = {};
            if (studentId) filter.studentId = studentId;
            if (category) filter.category = category;
            if (search) {
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { studentId: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                    { nic: { $regex: search, $options: 'i' } },
                    { refId: search }
                ];
            }
            const students = await col.find(filter).toArray();
            return res.status(200).json(students);
        }

        // POST — add new student
        if (req.method === 'POST') {
            const body = req.body;
            const result = await col.insertOne(body);
            return res.status(201).json({ ...body, _id: result.insertedId });
        }

        // PUT — update student by _id
        if (req.method === 'PUT') {
            const { _id, ...body } = req.body;
            if (!_id) return res.status(400).json({ error: '_id required' });
            await col.updateOne({ _id: new ObjectId(_id) }, { $set: body });
            return res.status(200).json({ success: true });
        }

        // DELETE — delete student by _id
        if (req.method === 'DELETE') {
            const id = req.query.id;
            if (!id) return res.status(400).json({ error: 'id required' });
            await col.deleteOne({ _id: new ObjectId(id) });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        console.error('Students API Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
