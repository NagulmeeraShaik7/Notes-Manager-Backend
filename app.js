const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Joi = require('joi');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./notes.db', (err) => {
    if (err) console.error('Error opening database:', err);
    else console.log('Connected to SQLite database.');
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Validation schema
const noteSchema = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    category: Joi.string().valid('Work', 'Personal', 'Others').default('Others'),
});

// Create a new note
app.post('/notes', (req, res) => {
    const { error, value } = noteSchema.validate(req.body);
    if (error) return res.status(400).send({ message: error.details[0].message });

    const { title, description, category } = value;
    const query = `INSERT INTO notes (title, description, category) VALUES (?, ?, ?)`;
    db.run(query, [title, description, category], function (err) {
        if (err) return res.status(500).send({ message: 'Failed to create note.' });
        res.send({ id: this.lastID, ...value });
    });
});

// Fetch all notes with optional pagination, search, and filtering
app.get('/notes', (req, res) => {
    const { search, category, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT * FROM notes WHERE 1=1`;
    const params = [];

    if (search) {
        query += ` AND title LIKE ?`;
        params.push(`%${search}%`);
    }
    if (category) {
        query += ` AND category = ?`;
        params.push(category);
    }
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).send({ message: 'Failed to fetch notes.', error: err.message });
        res.send({ page: Number(page), limit: Number(limit), notes: rows });
    });
});

// Update a note
app.put('/notes/:id', (req, res) => {
    const { id } = req.params;
    const { error, value } = noteSchema.validate(req.body);
    if (error) return res.status(400).send({ message: error.details[0].message });

    const { title, description, category } = value;
    const query = `UPDATE notes SET title = ?, description = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(query, [title, description, category, id], function (err) {
        if (err) return res.status(500).send({ message: 'Failed to update note.' });
        if (this.changes === 0) return res.status(404).send({ message: 'Note not found.' });
        res.send({ message: 'Note updated successfully.' });
    });
});

// Delete a note
app.delete('/notes/:id', (req, res) => {
    const { id } = req.params;
    const query = `DELETE FROM notes WHERE id = ?`;
    db.run(query, [id], function (err) {
        if (err) return res.status(500).send({ message: 'Failed to delete note.' });
        if (this.changes === 0) return res.status(404).send({ message: 'Note not found.' });
        res.send({ message: 'Note deleted successfully.' });
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
