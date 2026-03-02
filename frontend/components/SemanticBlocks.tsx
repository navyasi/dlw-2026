import type { SemanticBlock } from "@/lib/api";

export default function SemanticBlocks({ blocks }: { blocks: SemanticBlock[] }) {
    return (
        <div>
            {blocks.map((b, i) => (
                <div
                    key={i}
                    className={`semantic-block ${(b.tag || '').toLowerCase()}`}
                >
                    <div className="tag-label">{b.tag || 'Note'}</div>
                    <div>{b.text}</div>
                </div>
            ))}
        </div>
    );
}
