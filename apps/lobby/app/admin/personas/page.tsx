'use client';

import { useState, useEffect, useRef } from 'react';
import { listPersonas, createPersona, deletePersona } from './actions';
import type { PersonaWithImage } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function PersonasAdminPage() {
  const [personas, setPersonas] = useState<PersonaWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');
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

  const filtered = personas.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.stereotype.toLowerCase().includes(s) || p.id.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personas</h1>
          <p className="text-sm text-muted-foreground">{personas.length} personas in pool</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Persona'}
        </Button>
      </div>

      {message && (
        <Badge variant={message.ok ? 'outline' : 'destructive'} className={message.ok ? 'bg-green-50 text-green-700' : ''}>
          {message.ok ? 'OK' : 'ERROR'}: {message.text}
        </Badge>
      )}

      {/* Add Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Persona</CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Name</label>
                  <Input name="name" required placeholder="e.g. Bella Rossi" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Stereotype</label>
                  <Input name="stereotype" required placeholder="e.g. The Influencer" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Description</label>
                <Textarea name="description" required rows={2} placeholder="Character description..." />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Theme</label>
                <select name="theme" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="DEFAULT">DEFAULT</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Headshot (1024x1024)</label>
                  <Input type="file" name="headshot" accept="image/png,image/jpeg,image/webp" required />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Medium (864x1184)</label>
                  <Input type="file" name="medium" accept="image/png,image/jpeg,image/webp" required />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Full Body (768x1344)</label>
                  <Input type="file" name="full" accept="image/png,image/jpeg,image/webp" required />
                </div>
              </div>

              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create Persona'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Input
        placeholder="Search personas..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Persona Grid */}
      {loading ? (
        <p className="text-muted-foreground text-sm animate-pulse">Loading personas...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="aspect-square bg-muted relative">
                <img
                  src={p.headshotUrl}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <CardContent className="p-3 space-y-1">
                <div className="text-sm font-bold truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">{p.stereotype}</div>
                <div className="text-xs text-muted-foreground/70 line-clamp-2">{p.description}</div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{p.id}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDelete(p.id, p.name)}
                    disabled={deleting === p.id}
                  >
                    {deleting === p.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
