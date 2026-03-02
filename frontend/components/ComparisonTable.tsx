import type { ComparisonTable as T } from "@/lib/api";

export default function ComparisonTable({ data }: { data: T }) {
    return (
        <div style={{ overflowX: "auto", marginBottom: 16 }} role="region" aria-label="Comparison table">
            <table className="comparison-table" aria-label="Comparison of concepts">
                <thead>
                    <tr>
                        {data.headers.map((h, i) => <th key={i}>{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {data.rows.map((row, ri) => (
                        <tr key={ri}>
                            {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
