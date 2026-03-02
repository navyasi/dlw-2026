import type { WorkedExample } from "@/lib/api";

export default function WorkedExamples({ examples }: { examples: WorkedExample[] }) {
    return (
        <div style={{ marginBottom: 16 }}>
            {examples.map((ex, i) => (
                <div className="worked-example" key={i}>
                    <div className="ex-header">Example: {ex.title}</div>
                    <ol className="ex-steps">
                        {ex.steps.map((step, si) => <li key={si}>{step}</li>)}
                    </ol>
                    <div className="ex-result">✓ {ex.result}</div>
                </div>
            ))}
        </div>
    );
}
