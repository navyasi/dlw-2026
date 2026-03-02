"use client";

import { useState } from "react";
import { X, Clock, CalendarDays, Tag as TagIcon } from "lucide-react";

interface Props {
    day: string;
    startHour: number;
    onClose: () => void;
    onSave: (title: string, start: string, end: string, tags: string[]) => void;
}

export default function AddBusyModal({ day, startHour, onClose, onSave }: Props) {
    const [title, setTitle] = useState("Busy");
    const [start, setStart] = useState(`${startHour.toString().padStart(2, "0")}:00`);
    const [end, setEnd] = useState(`${(startHour + 1).toString().padStart(2, "0")}:00`);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");

    const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput("");
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="add-busy-modal" onClick={e => e.stopPropagation()}>
                <button className="add-busy-modal__close" onClick={onClose} aria-label="Close">
                    <X size={18} />
                </button>

                <input
                    className="add-busy-modal__title-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Event Title"
                    autoFocus
                />

                <div className="add-busy-modal__row">
                    <CalendarDays size={16} className="add-busy-modal__icon" />
                    <span className="add-busy-modal__label">Date</span>
                    <span className="add-busy-modal__value">{day}</span>
                </div>

                <div className="add-busy-modal__row">
                    <Clock size={16} className="add-busy-modal__icon" />
                    <span className="add-busy-modal__label">Time</span>
                    <div className="add-busy-modal__time-inputs">
                        <input
                            type="time"
                            value={start}
                            onChange={e => setStart(e.target.value)}
                            className="add-busy-modal__input"
                        />
                        <span>→</span>
                        <input
                            type="time"
                            value={end}
                            onChange={e => setEnd(e.target.value)}
                            className="add-busy-modal__input"
                        />
                    </div>
                </div>

                <div className="add-busy-modal__row add-busy-modal__row--tags">
                    <TagIcon size={16} className="add-busy-modal__icon" />
                    <span className="add-busy-modal__label">Tags</span>
                    <div className="add-busy-modal__tags-container">
                        {tags.map((t) => (
                            <span key={t} className="add-busy-modal__tag">
                                {t}
                                <button onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                        <input
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                            className="add-busy-modal__tag-input"
                            placeholder={tags.length === 0 ? "Add tags (press Enter)..." : "Add tag..."}
                        />
                    </div>
                </div>

                <div className="add-busy-modal__actions">
                    <button className="btn btn-primary" onClick={() => onSave(title, start, end, tags)}>
                        Save Event
                    </button>
                </div>
            </div>
        </div>
    );
}
