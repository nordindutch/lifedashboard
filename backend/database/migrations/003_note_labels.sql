CREATE TABLE IF NOT EXISTS note_labels (
    note_id  INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, label_id)
);
CREATE INDEX IF NOT EXISTS idx_note_labels_note  ON note_labels(note_id);
CREATE INDEX IF NOT EXISTS idx_note_labels_label ON note_labels(label_id);
