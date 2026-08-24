"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { customersApi } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";
import { Customer, PaginationEnvelope } from "@/types/api";
import { Role } from "@/types/enums";
import {
  Archive,
  Edit2,
  Inbox,
  Loader2,
  PlusCircle,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";

export default function CustomersPage() {
  const { user } = useAuth();

  const [customerData, setCustomerData] = useState<PaginationEnvelope<Customer> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createCompany, setCreateCompany] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editArchived, setEditArchived] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await customersApi.list({
        page,
        page_size: 25,
        search: search || undefined,
        include_archived: includeArchived,
      });
      setCustomerData(res);
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, includeArchived]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsSubmittingCreate(true);
    try {
      await customersApi.create({
        name: createName.trim(),
        email: createEmail.trim(),
        company: createCompany.trim() || undefined,
        phone: createPhone.trim() || undefined,
      });
      setIsCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreateCompany("");
      setCreatePhone("");
      fetchCustomers();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create customer record");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleEditOpen = (c: Customer) => {
    setEditingCustomer(c);
    setEditName(c.name);
    setEditEmail(c.email);
    setEditCompany(c.company || "");
    setEditPhone(c.phone || "");
    setEditArchived(c.is_archived);
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setEditError(null);
    setIsSubmittingEdit(true);
    try {
      await customersApi.update(editingCustomer.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        company: editCompany.trim() || undefined,
        phone: editPhone.trim() || undefined,
        is_archived: editArchived,
      });
      setIsEditOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setEditError(err.message || "Failed to update customer");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  return (
    <AppShell
      title="Customer Accounts Administration"
      subtitle="Manage corporate client accounts, portal credentials, and archiving"
      allowedRoles={[Role.ADMIN]}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Customer Directory
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All registered client entities eligible for ticket intake.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Customer Record
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search customers by name, company, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>

          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked);
                setPage(1);
              }}
              className="rounded border-slate-300 text-indigo-600"
            />
            <span>Include Archived Customers</span>
          </label>
        </div>

        {/* Customer Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs">Loading customer records...</p>
              </div>
            ) : !customerData || customerData.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Inbox className="h-10 w-10 text-slate-400 mb-3 stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  No customers found
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Create a new customer record to enable ticket intake.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4">Contact Email</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Portal Account</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {customerData.items.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {c.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {c.company || "—"}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                          {c.email}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {c.phone || "—"}
                        </td>
                        <td className="py-3.5 px-4">
                          {c.has_portal_access ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              <UserCheck className="h-3 w-3" /> Active Login
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                              No Login
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {c.is_archived ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                              <Archive className="h-3 w-3" /> Archived
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatDate(c.created_at)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditOpen(c)}
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal: Create Customer */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New Customer Record"
          description="Register a corporate account for ticket intake and SLA agreements."
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            {createError && (
              <p className="text-xs text-rose-600">{createError}</p>
            )}
            <Input
              label="Customer Contact Name"
              required
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Alice Johnson"
            />
            <Input
              label="Primary Email"
              type="email"
              required
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="alice@acme.com"
            />
            <Input
              label="Company Name"
              value={createCompany}
              onChange={(e) => setCreateCompany(e.target.value)}
              placeholder="Acme Corporation"
            />
            <Input
              label="Phone Number"
              value={createPhone}
              onChange={(e) => setCreatePhone(e.target.value)}
              placeholder="+1-555-0101"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isSubmittingCreate}>
                Create Customer
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Edit Customer */}
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title="Edit Customer Profile"
          description="Update company contact details or archive access."
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <p className="text-xs text-rose-600">{editError}</p>
            )}
            <Input
              label="Customer Contact Name"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Input
              label="Primary Email"
              type="email"
              required
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
            <Input
              label="Company Name"
              value={editCompany}
              onChange={(e) => setEditCompany(e.target.value)}
            />
            <Input
              label="Phone Number"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editArchived}
                  onChange={(e) => setEditArchived(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600"
                />
                <span className={editArchived ? "text-rose-600" : ""}>
                  Archive Customer Record
                </span>
              </label>
              {editArchived && (
                <p className="text-[11px] text-rose-500 mt-1">
                  Archiving this customer will automatically deactivate their portal login account and prevent opening new tickets.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isSubmittingEdit}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
