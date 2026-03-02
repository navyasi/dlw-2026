import type { SemanticBlock } from "@/lib/api";

export default function SemanticBlocks({ blocks }: { blocks: SemanticBlock[] }) {
    return (
        <div role="region" aria-label="Additional notes and details">
            {blocks.map((b, i) => (
                <div
                    key={i}
                    className={`semantic-block ${(b.tag || '').toLowerCase()}`}
                    role="note"
                    aria-label={`${b.tag || 'Note'}: ${b.text.substring(0, 60)}`}
                >
                    <div className="tag-label">{b.tag || 'Note'}</div>
                    <div>{b.text}</div>
                </div>
            ))}
        </div>
    );
}
