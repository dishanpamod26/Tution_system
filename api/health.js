// api/health.js — MongoDB Connection Health Check
const { getDb, setCors } = require('./_db');

module.exports = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = await getDb();
        await db.command({ ping: 1 });
        res.status(200).json({ status: 'Connected', db: 'educore' });
    } catch (e) {
        res.status(500).json({ status: 'Error', error: e.message });
    }
};
