// api/payments.js — Payments CRUD
const { getDb, setCors } = require('./_db');
const { ObjectId } = require('mongodb');

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = await getDb();
        const col = db.collection('payments');

        // GET — filter options
        if (req.method === 'GET') {
            const { studentId, teacherId, subject, month, limit } = req.query;
            const filter = {};
            if (studentId) filter.studentId = studentId;
            if (teacherId) filter.teacherId = teacherId;
            if (subject) filter.subject = subject;
            if (month) filter.date = { $regex: `^${month}` };

            let query = col.find(filter).sort({ date: -1 });
            if (limit) query = query.limit(parseInt(limit));
            const data = await query.toArray();
            return res.status(200).json(data);
        }

        // POST — add payment
        if (req.method === 'POST') {
            const body = req.body;
            // Auto generate paymentId if not given
            if (!body.paymentId) {
                const count = await col.countDocuments();
                body.paymentId = `PAY-${1000 + count + 1}`;
            }
            if (!body.date) body.date = new Date().toISOString();
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
        console.error('Payments API Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
