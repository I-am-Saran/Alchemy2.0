import React, { useState } from "react";
import TopNav from "./TopNav";
import { Outlet } from "react-router-dom";

export default function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* ✅ Sidebar (fixed on left for desktop) */}
      <div className="hidden sm:flex">
        <TopNav open={true} onClose={() => setOpen(false)} />
      </div>

      {/* ✅ Mobile Sidebar Toggle */}
      <div className="sm:hidden">
        <TopNav open={open} onClose={() => setOpen(false)} />
      </div>

      {/* ✅ Main Page Area */}
      <div className="flex flex-col flex-1 overflow-hidden sm:ml-52">
        {/* Header Bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <button
            className="sm:hidden text-gray-700 border rounded px-2 py-1"
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            Alchemy QA Platform
          </h1>
        </header>

        {/* Main Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
