'use client';

import { useState, useEffect, useRef } from 'react';
import { listPersonas, createPersona, deletePersona } from './actions';
import type { PersonaWithImage } from './actions';

export default function PersonasAdminPage() {
  const [personas, setPersonas] = useState<PersonaWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function load() {
    setLoading(true);
    const result = await listPersonas();
    setPersonas(result);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(formData: FormData) {
    setCreating(true);
    setMessage(null);
    const result = await createPersona(formData);
    setCreating(false);
    if (result.success) {
      setMessage({ ok: true, text: 'Persona created' });
      setShowForm(false);
      formRef.current?.reset();
      await load();
    } else {
      setMessage({ ok: false, text: result.error || 'Failed' });
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    setMessage(null);
    const result = await deletePersona(id);
    setDeleting(null);
    if (result.success) {
      setMessage({ ok: true, text: `Deleted ${name}` });
      await load();
    } else {
      setMessage({ ok: false, text: result.error || 'Failed' });
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Persona Management</h1>
          <p className="text-sm text-gray-500 mt-1">{personas.length} personas in pool</p>
        </div>
        <div className="flex gap-3">
          <a href="/admin" className="px-3 py-2 text-sm border rounded hover:bg-gray-50">
            Back to Admin
          </a>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : 'Add Persona'}
          </button>
        </div>
      </div>

      {message && (
        <p className={`text-sm font-mono ${message.ok ? 'text-green-700' : 'text-red-700'}`}>
          {message.ok ? 'OK' : 'ERROR'}: {message.text}
        </p>
      )}

      {/* Add Form */}
      {showForm && (
        <form
          ref={formRef}
          action={handleCreate}
          className="border rounded-lg p-6 space-y-4 bg-gray-50"
        >
          <h2 className="text-lg font-semibold">New Persona</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input name="name" required className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g. Bella Rossi" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stereotype</label>
              <input name="stereotype" required className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g. The Influencer" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea name="description" required rows={2} className="w-full px-3 py-2 border rounded text-sm" placeholder="Character description..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <select name="theme" className="px-3 py-2 border rounded text-sm">
              <option value="DEFAULT">DEFAULT</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Headshot (1024x1024)</label>
              <input type="file" name="headshot" accept="image/png,image/jpeg,image/webp" required className="text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Medium (864x1184)</label>
              <input type="file" name="medium" accept="image/png,image/jpeg,image/webp" required className="text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Full Body (768x1344)</label>
              <input type="file" name="full" accept="image/png,image/jpeg,image/webp" required className="text-sm" />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Persona'}
          </button>
        </form>
      )}

      {/* Persona Grid */}
      {loading ? (
        <p className="text-gray-500 text-sm animate-pulse">Loading personas...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {personas.map((p) => (
            <div key={p.id} className="border rounded-lg overflow-hidden bg-white">
              <div className="aspect-square bg-gray-100 relative">
                <img
                  src={p.headshotUrl}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="p-3 space-y-1">
                <div className="text-sm font-bold truncate">{p.name}</div>
                <div className="text-xs text-gray-500 truncate">{p.stereotype}</div>
                <div className="text-xs text-gray-400 line-clamp-2">{p.description}</div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-gray-400 font-mono">{p.id}</span>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    disabled={deleting === p.id}
                    className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {deleting === p.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
