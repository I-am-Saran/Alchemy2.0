import { Card, CardBody, Typography } from "@material-tailwind/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function DataTable({ columns, rows, searchKey = "title", viewHref, actionRenderer }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return rows.filter((r) => String(r[searchKey] || "").toLowerCase().includes(term));
  }, [q, rows, searchKey]);

  return (
    <Card className="glass-panel">
      <CardBody>
        <div className="flex items-center justify-between gap-4 pb-3">
  <Typography variant="h6" className="text-primary">Results</Typography>
          <input
            aria-label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="max-w-sm w-full rounded-xl bg-white border border-neutral-300 px-3 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-800">
            <thead>
              <tr className="border-y border-neutral-200 bg-neutral-50">
                {columns.map((c) => (
                  <th key={c.accessor} className="px-3 py-2 text-left font-medium text-gray-700">{c.header}</th>
                ))}
                {viewHref && <th className="px-3 py-2" />}
                {actionRenderer && <th className="px-3 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                  {columns.map((c) => (
                    <td key={c.accessor} className="px-3 py-2">{row[c.accessor]}</td>
                  ))}
                  {viewHref && (
                    <td className="px-3 py-2 text-right">
                      <Link to={`${viewHref}/${row.id}`} className="text-accent hover:underline">View</Link>
                    </td>
                  )}
                  {actionRenderer && (
                    <td className="px-3 py-2 text-right">
                      {actionRenderer(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}