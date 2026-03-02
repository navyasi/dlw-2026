import type { ConceptBox as ConceptBoxType } from "@/lib/api";

interface Props {
    data: ConceptBoxType;
}

export default function ConceptBox({ data }: Props) {
    return (
        <div className="concept-box">
            <h3>{data.term}</h3>
            <p style={{ fontSize: 15, marginBottom: 12 }}>{data.definition}</p>
            <div className="meta-row">
                <div className="meta-item">
                    <div className="label">Intuition</div>
                    <div>{data.intuition}</div>
                </div>
                <div className="meta-item">
                    <div className="label">Why it matters</div>
                    <div>{data.why_it_matters}</div>
                </div>
            </div>
        </div>
    );
}
