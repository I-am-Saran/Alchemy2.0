import React, { useState } from "react";

/**
 * ControlsTable
 * - Pure React truncation using inline styles (no Tailwind line-clamp plugin required)
 * - Shows "See more" only when text is longer than maxLength
 * - Works for all long-text columns
 */

const ControlsTable = ({ controls }) => {
  const [expandedCells, setExpandedCells] = useState({});

  const toggleExpand = (rowIndex, colName) => {
    setExpandedCells((prev) => ({
      ...prev,
      [`${rowIndex}-${colName}`]: !prev[`${rowIndex}-${colName}`],
    }));
  };

  const renderCell = (value, rowIndex, colName, maxLength = 150, maxLines = 3) => {
    if (value === null || value === undefined || value === "") return <span className="text-gray-400">—</span>;

    const normalized = String(value);
    const isExpanded = !!expandedCells[`${rowIndex}-${colName}`];

    // Decide whether the "See more" should be offered (based on string length)
    const shouldTruncate = normalized.length > maxLength;

    // Styles for collapsed view (approximate maxLines * lineHeight)
    const lineHeightPx = 20; // adjust if your font-size / line-height differ
    const collapsedMaxHeight = `${lineHeightPx * maxLines}px`;

    return (
      <div>
        <div
          className="whitespace-pre-wrap"
          style={
            shouldTruncate && !isExpanded
              ? { maxHeight: collapsedMaxHeight, overflow: "hidden" }
              : {}
          }
        >
          {normalized}
        </div>

        {shouldTruncate && (
          <button
            onClick={() => toggleExpand(rowIndex, colName)}
            className="mt-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium"
          >
            {isExpanded ? "See less" : "See more"}
          </button>
        )}
      </div>
    );
  };

  if (!controls || controls.length === 0) {
    return <p className="text-center text-gray-500">No controls found.</p>;
  }

  return (
    <div className="relative w-full">
      <div className="overflow-x-auto overflow-y-auto max-h-[75vh] rounded-2xl shadow-lg border border-gray-200 bg-white">
        <table className="min-w-[2000px] text-sm text-gray-700">
          <thead className="sticky top-0 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-700 text-white z-10">
            <tr>
              {[
                "S.No","ID","Analyze Comments","Observations/Action Item",
                "Responsible Team","Owner","Control Domain","Requirement",
                "Description","ISO 27001","NIST CSF","SOC 2","GDPR",
                "IT Act 2000","PCI DSS","HIPAA","Priority","Status",
                "Review Date","Audit Review Status","Comments","Plan",
                "Do","Check","Act","Date","Comments2",
              ].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 bg-white">
            {controls.map((c, rowIndex) => (
              <tr key={c.id || rowIndex} className="hover:bg-emerald-50 transition duration-150 ease-in-out even:bg-gray-50">
                <td className="px-4 py-2">{c.sno}</td>
                <td className="px-4 py-2 font-semibold text-emerald-700">{c.id}</td>

                <td className="px-4 py-2">{renderCell(c["analyze_comments"], rowIndex, "analyze_comments", 120)}</td>
                <td className="px-4 py-2">{renderCell(c["observations_action_item"], rowIndex, "observations_action_item", 140)}</td>
                <td className="px-4 py-2">{c["reponsible_team"]}</td>
                <td className="px-4 py-2">{c["owner"]}</td>
                <td className="px-4 py-2">{c["control_domain"]}</td>
                <td className="px-4 py-2">{renderCell(c["requirement"], rowIndex, "requirement", 140)}</td>
                <td className="px-4 py-2">{renderCell(c["description"], rowIndex, "description", 140)}</td>

                <td className="px-4 py-2">{c["ISO_27001"]}</td>
                <td className="px-4 py-2">{c["NIST_CSF"]}</td>
                <td className="px-4 py-2">{c["SOC_2"]}</td>
                <td className="px-4 py-2">{c["GDPR"]}</td>
                <td className="px-4 py-2">{c["IT_Act_2000"]}</td>
                <td className="px-4 py-2">{c["PCI_DSS"]}</td>
                <td className="px-4 py-2">{c["HIPAA"]}</td>

                <td className={`px-4 py-2 font-semibold ${c["Priority"]==="Critical"?"text-red-600":c["Priority"]==="High"?"text-orange-600":"text-gray-600"}`}>{c["Priority"]}</td>

                <td className={`px-4 py-2 font-medium ${c["Status"]?.includes("Implemented")?"text-green-600":"text-yellow-600"}`}>{c["Status"]}</td>

                <td className="px-4 py-2">{c["Review_Date"]}</td>
                <td className="px-4 py-2">{c["Audit_Review_Status"]}</td>

                <td className="px-4 py-2">{renderCell(c["Comments"], rowIndex, "Comments", 160)}</td>
                <td className="px-4 py-2">{renderCell(c["Plan"], rowIndex, "Plan", 160)}</td>
                <td className="px-4 py-2">{renderCell(c["Do"], rowIndex, "Do", 160)}</td>
                <td className="px-4 py-2">{renderCell(c["Check"], rowIndex, "Check", 160)}</td>
                <td className="px-4 py-2">{renderCell(c["Act"], rowIndex, "Act", 160)}</td>

                <td className="px-4 py-2">{c["Date"]}</td>
                <td className="px-4 py-2">{renderCell(c["Comments_1"], rowIndex, "Comments_1", 140)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ControlsTable;
