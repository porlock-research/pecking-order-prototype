'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RawStateTabProps {
  state: any;
}

export function RawStateTab({ state }: RawStateTabProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Raw State</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(state, null, 2));
          }}
        >
          Copy JSON
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="bg-gray-950 text-green-400 p-4 rounded-md text-xs overflow-x-auto max-h-[70vh]">
          {JSON.stringify(state, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
