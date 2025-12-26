import { useMemo, useState } from "react";
import ListPageWrapper from "../components/ListPageWrapper";
import { tasks as seedTasks } from "../data/tasks";

export default function TasksList() {
  // Initialize rows from seed data
  const [rows, setRows] = useState(() =>
    seedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: "",
      assignedTo: t.owner,
      priority: "medium",
      status: t.status,
      dueDate: t.due,
      createdBy: "System",
      createdDate: new Date().toISOString().slice(0, 10),
    }))
  );

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "medium",
    status: "todo",
    dueDate: "",
  });

  const nextId = useMemo(
    () => rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1,
    [rows]
  );

  const handleCreateClick = () => {
    setFormData({
      title: "",
      description: "",
      assignedTo: "",
      priority: "medium",
      status: "todo",
      dueDate: "",
    });
    setEditingId(null);
    setFormOpen(true);
  };

  const handleEditClick = (row) => {
    setFormData({
      title: row.title || "",
      description: row.description || "",
      assignedTo: row.assignedTo || "",
      priority: row.priority || "medium",
      status: row.status || "todo",
      dueDate: row.dueDate || "",
    });
    setEditingId(row.id);
    setFormOpen(true);
  };

  const handleViewClick = (row) => {
    setFormData(row);
    setEditingId(row.id);
    setViewOpen(true);
  };

  const handleDeleteClick = (row) => {
    setEditingId(row.id);
    setDeleteOpen(true);
  };

  const handleFormChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFormSubmit = () => {
    if (!formData.title.trim() || !formData.assignedTo.trim()) {
      alert("Please provide both Title and Assigned To.");
      return;
    }

    if (editingId == null) {
      const newRow = {
        id: nextId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        assignedTo: formData.assignedTo.trim(),
        priority: formData.priority,
        status: formData.status,
        dueDate: formData.dueDate || new Date().toISOString().slice(0, 10),
        createdBy: "You",
        createdDate: new Date().toISOString().slice(0, 10),
      };
      setRows((prev) => [...prev, newRow]);
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                title: formData.title.trim(),
                description: formData.description.trim(),
                assignedTo: formData.assignedTo.trim(),
                priority: formData.priority,
                status: formData.status,
                dueDate: formData.dueDate || r.dueDate,
              }
            : r
        )
      );
    }
    setFormOpen(false);
  };

  const handleDeleteConfirm = () => {
    setRows((prev) => prev.filter((r) => r.id !== editingId));
    setDeleteOpen(false);
    setEditingId(null);
  };

  const columns = [
    { key: "id", label: "Task ID" },
    { key: "title", label: "Title" },
    { key: "description", label: "Description" },
    { key: "assignedTo", label: "Assigned To" },
    {
      key: "priority",
      label: "Priority",
      render: (row) => <span className="capitalize">{row.priority}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <span className="capitalize">{row.status}</span>,
    },
    { key: "dueDate", label: "Due Date" },
    { key: "createdBy", label: "Created By" },
    { key: "createdDate", label: "Created Date" },
  ];

  const filters = [
    {
      key: "status",
      label: "Status",
      options: [
        { label: "Todo", value: "todo" },
        { label: "In Progress", value: "in-progress" },
        { label: "Done", value: "done" },
      ],
    },
    {
      key: "priority",
      label: "Priority",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
    },
  ];

  const formFields = [
    {
      key: "title",
      label: "Task Title",
      placeholder: "Clear and concise task title",
    },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Details, steps, context",
    },
    { key: "assignedTo", label: "Assigned To", placeholder: "Owner of this task" },
    {
      key: "priority",
      label: "Priority",
      type: "select",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { label: "Todo", value: "todo" },
        { label: "In Progress", value: "in-progress" },
        { label: "Done", value: "done" },
      ],
    },
    { key: "dueDate", label: "Due Date", placeholder: "YYYY-MM-DD" },
  ];

  return (
    <ListPageWrapper
      title="Tasks"
      items={rows}
      columns={columns}
      searchKeys={["title", "description", "assignedTo"]}
      filters={filters}
      onCreateClick={handleCreateClick}
      onEditClick={handleEditClick}
      onDeleteClick={handleDeleteClick}
      onViewClick={handleViewClick}
      formOpen={formOpen}
      onFormClose={() => setFormOpen(false)}
      formData={formData}
      onFormChange={handleFormChange}
      formFields={formFields}
      onFormSubmit={handleFormSubmit}
      formTitle={editingId == null ? "Create Task" : `Edit Task #${editingId}`}
      viewOpen={viewOpen}
      onViewClose={() => setViewOpen(false)}
      viewData={formData}
      deleteOpen={deleteOpen}
      onDeleteClose={() => setDeleteOpen(false)}
      onDeleteConfirm={handleDeleteConfirm}
    />
  );
}
