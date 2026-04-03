'use client';

import { useState, useEffect } from 'react';
import { listSignups } from './actions';
import type { SignupsResult } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function SignupsPage() {
  const [data, setData] = useState<SignupsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  async function load(p: number) {
    setLoading(true);
    const result = await listSignups(p);
    setData(result);
    setPage(p);
    setLoading(false);
  }

  useEffect(() => { load(1); }, []);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  const filtered = data?.rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.email?.toLowerCase().includes(s)
      || r.phone?.includes(s)
      || r.referralCode?.toLowerCase().includes(s)
      || r.referredBy?.toLowerCase().includes(s);
  }) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Playtest Signups</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} total signup{data?.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(page)} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <Input
        placeholder="Search by email, phone, or referral code..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Referred By</TableHead>
              <TableHead>Referral Code</TableHead>
              <TableHead>Signed Up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(row => (
              <TableRow key={row.id}>
                <TableCell className="text-sm font-mono">{row.email ?? '\u2014'}</TableCell>
                <TableCell className="text-sm font-mono">{row.phone ?? '\u2014'}</TableCell>
                <TableCell className="text-sm">{row.messagingApp ?? '\u2014'}</TableCell>
                <TableCell className="text-sm">
                  {row.referralSource}
                  {row.referralDetail ? ` (${row.referralDetail})` : ''}
                </TableCell>
                <TableCell className="text-sm font-mono">{row.referredBy ?? '\u2014'}</TableCell>
                <TableCell className="text-sm font-mono">{row.referralCode ?? '\u2014'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(row.signedUpAt + 'Z').toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No signups found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(page - 1)}
            disabled={page <= 1 || loading}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(page + 1)}
            disabled={page >= totalPages || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
